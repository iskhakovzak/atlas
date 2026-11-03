// Security regressions (3 November 2026): the real route handlers, a real schema, real sessions
// (tests/support/route-harness.mjs). A customer never reaches operator APIs; a staff member only their own;
// writes from another origin are refused; sign-in limits fire.
import test from 'node:test';
import assert from 'node:assert/strict';
import {routeHarness} from './support/route-harness.mjs';

const customer = {userId: 'email:ann@example.uz', email: 'ann@example.uz', displayName: 'Ann'};
const phoneCustomer = {userId: 'phone:+998901234567', displayName: 'Bob'};
const owner = {userId: 'email:owner@atlas.test', email: 'owner@atlas.test', displayName: 'Owner'};
const supportStaff = {userId: 'email:help@atlas.test', email: 'help@atlas.test', displayName: 'Support'};

/** Operator and admin endpoints with a request that would otherwise be valid. */
const privileged = [
  ['app/api/operations/route.ts', 'GET', '/api/operations'],
  ['app/api/operations/route.ts', 'POST', '/api/operations', {kind: 'projection-rebuild'}],
  ['app/api/finance/route.ts', 'GET', '/api/finance'],
  ['app/api/finance/route.ts', 'POST', '/api/finance', {kind: 'entry', value: {}}],
  ['app/api/backup/route.ts', 'GET', '/api/backup'],
  ['app/api/promo-codes/route.ts', 'GET', '/api/promo-codes'],
  ['app/api/promo-codes/route.ts', 'POST', '/api/promo-codes', {promo: {code: 'FREE100', kind: 'percent', value: 100, active: true}}],
  ['app/api/catalog/route.ts', 'GET', '/api/catalog?admin=1'],
  ['app/api/catalog/route.ts', 'POST', '/api/catalog?admin=1', {kind: 'save', document: {}}],
  ['app/api/site-content/route.ts', 'POST', '/api/site-content', {revision: 0, document: {}}],
  ['app/api/auth/telegram/connect/route.ts', 'GET', '/api/auth/telegram/connect'],
  ['app/api/auth/telegram/connect/route.ts', 'POST', '/api/auth/telegram/connect', {}],
];

async function hit(h, [file, method, url, body], cookie) {
  const handlers = await h.route(file);
  return h.call(handlers[method], {method, url, cookie, body});
}

test('a signed-in customer gets 403 from every operator and admin API, a guest 401', async () => {
  const h = routeHarness();
  const cookies = {email: h.signIn(customer), phone: h.signIn(phoneCustomer)};
  for (const endpoint of privileged) {
    const label = `${endpoint[1]} ${endpoint[2]}`;
    for (const [kind, cookie] of Object.entries(cookies)) {
      const response = await hit(h, endpoint, cookie);
      assert.equal(response.status, 403, `${label} for a ${kind} customer`);
    }
    const guest = await hit(h, endpoint);
    assert.ok([401, 403].includes(guest.status), `${label} for a guest: ${guest.status}`);
  }
  // Nothing was written on the way: no promo code, no audit entry, no catalog or site content.
  for (const table of ['market_promo_codes', 'market_audit_events', 'market_settings']) {
    assert.equal(h.db.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0, table);
  }
});

test('the harness is not trivially refusing: the operator reads the same APIs', async () => {
  const h = routeHarness();
  const cookie = h.signIn(owner);
  for (const endpoint of privileged.filter(([, method, url]) => method === 'GET' && !url.includes('telegram'))) {
    const response = await hit(h, endpoint, cookie);
    assert.equal(response.status, 200, `${endpoint[2]} for the operator: ${response.status}`);
  }
});

test('a support staff member keeps to their rights: no finance, backup, promo codes or catalog editing', async () => {
  const h = routeHarness();
  const now = Date.now();
  h.db.sqlite.prepare("INSERT INTO market_staff_directory (id,email,display_name,role,status,created_at,updated_at) VALUES ('s1',?,?,'support','active',?,?)")
    .run(supportStaff.email, supportStaff.displayName, now, now);
  const cookie = h.signIn(supportStaff);
  assert.equal((await hit(h, privileged[0], cookie)).status, 200, 'support reads the operations queue');
  for (const endpoint of privileged.slice(1)) {
    assert.equal((await hit(h, endpoint, cookie)).status, 403, `${endpoint[1]} ${endpoint[2]} for support`);
  }
  // The same email signed in by phone or Telegram carries no verified email: no staff rights at all.
  const unverified = h.signIn({...supportStaff, userId: 'tg:5150', email: '', method: 'telegram'});
  assert.equal((await hit(h, privileged[0], unverified)).status, 403);
});

test('writes from another site are refused before anything else (CSRF)', async () => {
  const h = routeHarness();
  const cookie = h.signIn(owner);
  for (const [file, url, body] of [
    ['app/api/actions/route.ts', '/api/actions', {revision: 0, action: {type: 'favorite-toggle', productId: 'x'}}],
    ['app/api/account/delete/route.ts', '/api/account/delete', {confirm: true}],
    ['app/api/promo-codes/route.ts', '/api/promo-codes', {promo: {code: 'FREE100', kind: 'percent', value: 100, active: true}}],
    ['app/api/operations/route.ts', '/api/operations', {kind: 'projection-rebuild'}],
  ]) {
    const {POST} = await h.route(file);
    const response = await h.call(POST, {method: 'POST', url, cookie, body, origin: 'https://evil.example'});
    assert.equal(response.status, 403, url);
    const noOrigin = await h.call(POST, {method: 'POST', url, cookie, body, origin: null});
    assert.equal(noOrigin.status, 403, `${url} without Origin`);
  }
  assert.equal(h.db.sqlite.prepare('SELECT count(*) AS n FROM market_accounts').get().n, 0);
});

test('sign-in limits fire: 3 codes per address in 10 minutes, 10 a day, 20 an hour per network', async () => {
  const h = routeHarness();
  const {POST} = await h.route('app/api/auth/otp/route.ts');
  const realNow = Date.now;
  let clock = Math.floor(realNow() / 86_400_000) * 86_400_000 + 60_000;
  Date.now = () => clock;
  const original = console.info;
  console.info = () => {};
  try {
    const start = (target, ip) => h.call(POST, {method: 'POST', url: '/api/auth/otp', body: {step: 'start', channel: 'email', target}, headers: {'cf-connecting-ip': ip}});
    // Per address: the fourth within ten minutes is refused; ten minutes later it works again, up to ten a day.
    for (let index = 0; index < 3; index++) assert.equal((await start('day@example.uz', '198.51.100.10')).status, 200);
    assert.equal((await start('day@example.uz', '198.51.100.10')).status, 429);
    let sent = 3;
    while (sent < 10) {
      clock += 11 * 60_000;
      for (let index = 0; index < 3 && sent < 10; index++, sent++) assert.equal((await start('day@example.uz', `198.51.100.${11 + sent}`)).status, 200, `code ${sent + 1}`);
    }
    clock += 11 * 60_000;
    assert.equal((await start('day@example.uz', '198.51.100.99')).status, 429, 'the eleventh code of the day');
    // Per network: twenty addresses from one IP within the hour, then 429 for a new address too.
    clock += 2 * 60 * 60_000;
    for (let index = 0; index < 20; index++) assert.equal((await start(`n${index}@example.uz`, '203.0.113.50')).status, 200, `address ${index}`);
    const refused = await start('fresh@example.uz', '203.0.113.50');
    assert.equal(refused.status, 429);
    assert.deepEqual(await refused.json(), {error: 'too_many_requests'});
    assert.equal((await start('fresh@example.uz', '203.0.113.51')).status, 200, 'another network is not affected');
  } finally {
    Date.now = realNow;
    console.info = original;
  }
});
