import test from 'node:test';
import assert from 'node:assert/strict';
import {products, blank, addToCart, cartSignature, checkoutCart} from '../lib/market/domain.ts';
import {customsVersion} from '../lib/market/world.ts';
import {ACCOUNT_EXPORT_FORMAT, accountExportFilename, buildAccountExport} from '../lib/market/account-export.ts';
import {routeHarness} from './support/route-harness.mjs';

const ann = {userId: 'email:ann@example.uz', email: 'ann@example.uz', displayName: 'Ann'};
const bob = {userId: 'phone:+998901112233', displayName: 'Bob'};

function placedState(now) {
  let state = addToCart(blank(), products[0], 'US 9', now);
  state = checkoutCart(state, 'checkout-key-1', cartSignature(state.cart), false, now + 1, customsVersion);
  state.orders[0] = {...state.orders[0], staffNotes: [{id: 'n1', at: now, author: 'staff@atlas.test', text: 'Позвонить клиенту'}], assignment: {team: 'Закупки', priority: 'Высокий', assignedAt: now}};
  state.deliveryProfiles = [{id: 'R-1', label: 'Дом', primary: true, recipient: 'Ann Valieva', phone: '+998901234567', region: 'Ташкент', city: 'Ташкент', address: 'ул. Навои, 1', postalCode: '', comment: ''}];
  return state;
}

function seed(h) {
  const now = Date.now();
  const insert = (sql, ...values) => h.db.sqlite.prepare(sql).run(...values);
  insert('INSERT INTO market_accounts (user_id,name,state,revision,created_at,updated_at) VALUES (?,?,?,?,?,?)', ann.userId, 'Ann', JSON.stringify(placedState(now)), 3, now - 1000, now);
  insert('INSERT INTO market_accounts (user_id,name,state,revision,created_at,updated_at) VALUES (?,?,?,?,?,?)', bob.userId, 'Bob', JSON.stringify({...placedState(now), orders: []}), 1, now, now);
  insert('INSERT INTO market_auth_links (subject,user_id,method,contact,created_at) VALUES (?,?,?,?,?)', 'tg:4242', ann.userId, 'telegram', 'Telegram', now);
  insert('INSERT INTO market_auth_links (subject,user_id,method,contact,created_at) VALUES (?,?,?,?,?)', 'email:bob@example.uz', bob.userId, 'email', 'bob@example.uz', now);
  insert('INSERT INTO market_legal_consents (id,customer_id,document_key,document_version,accepted_at) VALUES (?,?,?,?,?)', 'c1', ann.userId, 'privacy', '2026-10-13', now);
  insert('INSERT INTO market_legal_consents (id,customer_id,document_key,document_version,accepted_at) VALUES (?,?,?,?,?)', 'c2', bob.userId, 'privacy', '2026-10-13', now);
  insert("INSERT INTO market_identity_documents (id,user_id,object_key,filename,content_type,size,status,confirmed_data,created_at,updated_at) VALUES (?,?,'','passport-text','text/plain',0,'confirmed',?,?,?)",
    'ID-1', ann.userId, JSON.stringify({passportNumber: 'AA1234567', pinfl: '31234567890123'}), now, now);
  insert('INSERT INTO market_push_subscriptions (endpoint,user_id,p256dh,auth,created_at) VALUES (?,?,?,?,?)', 'https://fcm.googleapis.com/fcm/send/secret-endpoint-id', ann.userId, 'p256dh-secret-key', 'auth-secret-key', now);
  insert('INSERT INTO market_auth_challenges (id,kind,target,secret,attempts,created_at,expires_at) VALUES (?,?,?,?,0,?,?)', 'challenge-1', 'email', ann.email, 'code-hash-secret', now, now + 60_000);
}

test('the export holds the customer’s own data and none of the secrets, internal notes or other accounts', async () => {
  const h = routeHarness();
  seed(h);
  const cookie = h.signIn(ann);
  const {GET} = await h.route('app/api/account/export/route.ts');
  const response = await h.call(GET, {url: '/api/account/export', cookie, headers: {origin: 'https://evil.example'}});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.match(response.headers.get('content-disposition'), /^attachment; filename="atlas-data-\d{4}-\d{2}-\d{2}\.json"$/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null, 'no CORS: another site cannot read it');
  const text = await response.text();
  const data = JSON.parse(text);
  assert.equal(data.format, ACCOUNT_EXPORT_FORMAT);
  assert.equal(data.profile.userId, ann.userId);
  assert.equal(data.profile.email, ann.email);
  assert.deepEqual(data.signInMethods.map((item) => item.method), ['email', 'telegram']);
  assert.equal(data.orders.length, 1);
  assert.equal(data.parcels.length, 1);
  assert.deepEqual(data.parcels[0].orderIds, [data.orders[0].id]);
  assert.equal(data.recipients[0].recipient, 'Ann Valieva');
  assert.equal(typeof data.balance.amount, 'number');
  assert.ok(Array.isArray(data.balance.entries));
  assert.ok(Array.isArray(data.account.notifications));
  assert.deepEqual(data.consents, [{document: 'privacy', version: '2026-10-13', acceptedAt: data.consents[0].acceptedAt}]);
  assert.deepEqual(data.passportRecords.map(({id, kind}) => ({id, kind})), [{id: 'ID-1', kind: 'typed'}]);
  assert.deepEqual(data.browserNotifications.map((item) => item.service), ['fcm.googleapis.com']);
  for (const secret of ['AA1234567', '31234567890123', 'secret-endpoint-id', 'p256dh-secret-key', 'auth-secret-key', 'code-hash-secret', 'Позвонить клиенту', 'staff@atlas.test', 'bob@example.uz', bob.userId, '__Host-atlas_session']) {
    assert.equal(text.includes(secret), false, `export must not contain ${secret}`);
  }
  for (const key of ['staffNotes', 'assignment', 'checkoutKeys', 'p256dh']) assert.equal(text.includes(`"${key}"`), false, key);
});

test('only a signed-in customer can export, and five times an hour at most', async () => {
  const h = routeHarness();
  seed(h);
  const {GET} = await h.route('app/api/account/export/route.ts');
  const guest = await h.call(GET, {url: '/api/account/export'});
  assert.equal(guest.status, 401);
  const cookie = h.signIn(ann);
  for (let index = 0; index < 5; index++) assert.equal((await h.call(GET, {url: '/api/account/export', cookie})).status, 200);
  const limited = await h.call(GET, {url: '/api/account/export', cookie});
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).errorCode, 'err_97');
  // The limit is per account: another customer still gets their own file.
  const other = await h.call(GET, {url: '/api/account/export', cookie: h.signIn(bob)});
  assert.equal(other.status, 200);
  assert.equal((await other.json()).profile.userId, bob.userId);
});

test('the builder keeps working on an empty account and names the file by date', () => {
  const now = Date.UTC(2026, 10, 3, 12);
  const data = buildAccountExport({profile: {...ann, name: 'Ann', contact: ann.email, method: 'email', createdAt: now}, state: blank(), signInMethods: [], consents: [], passports: [], orderDocuments: [], promoUses: [{code: 'ATLAS10', order_ids: 'not json', discount: 1000, created_at: now, returned_at: null}], pushSubscriptions: [{endpoint: 'not a url', created_at: now}], now});
  assert.deepEqual(data.orders, []);
  assert.deepEqual(data.parcels, []);
  assert.equal(data.balance.amount, 0);
  assert.deepEqual(data.promoCodeUses, [{code: 'ATLAS10', orderIds: [], discount: 1000, usedAt: now}]);
  assert.deepEqual(data.browserNotifications, [{service: 'unknown', createdAt: now}]);
  assert.equal(accountExportFilename(now), 'atlas-data-2026-11-03.json');
});
