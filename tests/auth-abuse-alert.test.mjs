import test from 'node:test';
import assert from 'node:assert/strict';
import {ABUSE_ALERT_THRESHOLD,abuseAlertText,limitName,maskContact,recordAbuse,watchedLimit} from '../lib/auth/abuse-alert.ts';
import {memoryD1, routeHarness} from './support/route-harness.mjs';

const errors = (db) => db.sqlite.prepare("SELECT message,details FROM market_operational_errors WHERE area='auth' ORDER BY created_at").all()
  .map((row) => ({message: row.message, ...JSON.parse(row.details)}));

test('limit keys lose their hashes; only sign-in limits are watched', () => {
  assert.equal(limitName('send:0123456789abcdef0123456789abcdef:10m'), 'send:10m');
  assert.equal(limitName('send:0123456789abcdef0123456789abcdef:day'), 'send:day');
  assert.equal(limitName('verify-ip:0123456789abcdef0123456789abcdef'), 'verify-ip');
  assert.equal(limitName('telegram-bot-reply:42'), 'telegram-bot-reply');
  for (const name of ['send:10m', 'send:day', 'send-ip', 'verify-ip', 'google-ip', 'apple-ip', 'telegram-ip', 'code-attempts']) assert.ok(watchedLimit(name), name);
  // The bot's own reply and notice limits are ordinary use, not abuse.
  for (const name of ['telegram-bot-reply', 'telegram-bot-notify', 'telegram-bot-stop', 'unknown']) assert.equal(watchedLimit(name), false, name);
});

test('contacts are masked before they reach the log or Telegram', () => {
  assert.equal(maskContact('email', 'ann@example.uz'), 'a**@example.uz');
  assert.equal(maskContact('email', 'a@example.uz'), '*@example.uz');
  assert.equal(maskContact('email', 'verylongname@example.uz'), 'v******@example.uz');
  assert.equal(maskContact('phone', '+998901234567'), '+99890*****67');
  assert.equal(maskContact('email', 'broken'), undefined);
  assert.equal(maskContact('phone', '123'), undefined);
  const text = abuseAlertText({kind: 'rate_limit', limit: 'send:10m', contact: 'a**@example.uz'}, 3);
  assert.match(text, /коды на один адрес/);
  assert.match(text, /a\*\*@example\.uz/);
  assert.match(text, /Событий за час: 3/);
});

test('weak signals alert from the threshold, strong ones at once, and Telegram hears at most once an hour', async () => {
  const db = memoryD1();
  const sent = [];
  const deps = (now) => ({db, now, send: async (html) => { sent.push(html); }});
  const hour = 60 * 60 * 1000, start = Math.floor(Date.now() / hour) * hour + 1000;
  for (let index = 1; index < ABUSE_ALERT_THRESHOLD; index++) {
    assert.deepEqual(await recordAbuse(deps(start + index), {kind: 'rate_limit', limit: 'send:10m', contact: 'a**@example.uz'}), {alerted: false});
  }
  assert.equal(sent.length, 0, 'one impatient person is not an alert');
  assert.deepEqual(await recordAbuse(deps(start + 10), {kind: 'rate_limit', limit: 'send:10m', contact: 'b**@example.uz'}), {alerted: true});
  assert.equal(sent.length, 1);
  assert.match(sent[0], /b\*\*@example\.uz/);
  // Same hour: counted, not sent again.
  await recordAbuse(deps(start + 20), {kind: 'rate_limit', limit: 'verify-ip'});
  assert.equal(sent.length, 1);
  const [row] = errors(db);
  assert.equal(row.message, 'Sign-in limit reached (429)');
  assert.equal(row.count, ABUSE_ALERT_THRESHOLD + 1, 'one row counts the repeats');
  assert.equal(row.limit, 'verify-ip');
  // Next hour: a strong signal alerts on its own.
  assert.deepEqual(await recordAbuse(deps(start + hour), {kind: 'rate_limit', limit: 'send-ip'}), {alerted: true});
  assert.equal(sent.length, 2);
  // Unwatched limits leave no trace; without a sender only the log is written.
  await recordAbuse(deps(start + hour + 1), {kind: 'rate_limit', limit: 'telegram-bot-reply'});
  assert.deepEqual(await recordAbuse({db, now: start + 2 * hour}, {kind: 'rate_limit', limit: 'send-ip'}), {alerted: false});
  assert.equal(errors(db)[0].count, ABUSE_ALERT_THRESHOLD + 3);
});

test('a broken database never turns into a different answer for the visitor', async () => {
  const db = {prepare() { throw new Error('disk full'); }};
  const original = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await recordAbuse({db, now: Date.now()}, {kind: 'rate_limit', limit: 'send-ip'}), {alerted: false});
  } finally {
    console.error = original;
  }
});

function telegramStub() {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({url: String(url), body: JSON.parse(init.body)});
    return Response.json({ok: true, result: {}});
  };
  return {calls, restore: () => { globalThis.fetch = original; }};
}

const monitored = {
  ATLAS_IMPORT_MONITOR: 'on', ATLAS_MONITOR_TELEGRAM: '777000',
  TELEGRAM_BOT_TOKEN: '123:test', TELEGRAM_BOT_USERNAME: 'atlas_test_bot',
};

test('the fourth code request in ten minutes is refused, logged with a masked address, and told to the owner', async () => {
  const h = routeHarness(monitored);
  const telegram = telegramStub();
  try {
    const {POST} = await h.route('app/api/auth/otp/route.ts');
    const start = (ip) => h.call(POST, {method: 'POST', url: '/api/auth/otp', body: {step: 'start', channel: 'email', target: 'victim@example.uz'}, headers: {'cf-connecting-ip': ip}});
    for (let index = 0; index < 3; index++) assert.equal((await start('198.51.100.1')).status, 200);
    const refused = await start('198.51.100.1');
    assert.equal(refused.status, 429);
    assert.deepEqual(await refused.json(), {error: 'too_many_requests'});
    await h.settle();
    const [row] = errors(h.db);
    assert.equal(row.limit, 'send:10m');
    assert.equal(row.contact, 'v*****@example.uz');
    assert.equal(telegram.calls.length, 0, 'a single person over the limit stays in the log');
    // Two more addresses from other networks hit their limits within the hour: now the owner hears.
    for (const [ip, target] of [['198.51.100.2', 'b@example.uz'], ['198.51.100.3', 'c@example.uz']]) {
      for (let index = 0; index < 4; index++) await h.call(POST, {method: 'POST', url: '/api/auth/otp', body: {step: 'start', channel: 'email', target}, headers: {'cf-connecting-ip': ip}});
    }
    await h.settle();
    assert.equal(telegram.calls.length, 1);
    assert.match(telegram.calls[0].url, /\/sendMessage$/);
    assert.equal(telegram.calls[0].body.chat_id, '777000');
    assert.doesNotMatch(telegram.calls[0].body.text, /victim@example\.uz|198\.51\.100/);
  } finally {
    telegram.restore();
  }
});

test('five wrong codes for one sign-in are recorded once, and further guesses get code_expired', async () => {
  const h = routeHarness();
  const {POST} = await h.route('app/api/auth/otp/route.ts');
  const started = await h.call(POST, {method: 'POST', url: '/api/auth/otp', body: {step: 'start', channel: 'phone', target: '+998901234567'}});
  const {challengeId, devCode} = await started.json();
  const wrong = devCode === '000000' ? '111111' : '000000';
  for (let index = 0; index < 5; index++) {
    const answer = await h.call(POST, {method: 'POST', url: '/api/auth/otp', body: {step: 'verify', channel: 'phone', challengeId, code: wrong}});
    assert.equal(answer.status, 400);
    assert.deepEqual(await answer.json(), {error: 'invalid_code'});
  }
  const late = await h.call(POST, {method: 'POST', url: '/api/auth/otp', body: {step: 'verify', channel: 'phone', challengeId, code: devCode}});
  assert.deepEqual(await late.json(), {error: 'code_expired'});
  await h.settle();
  const rows = errors(h.db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].message, 'Sign-in code: all attempts wrong');
  assert.equal(rows[0].contact, '+99890*****67');
  assert.equal(rows[0].count, 1);
});

test('verification from one network is capped at 60 an hour and the cap is logged', async () => {
  const h = routeHarness();
  const {POST} = await h.route('app/api/auth/otp/route.ts');
  const verify = () => h.call(POST, {method: 'POST', url: '/api/auth/otp', body: {step: 'verify', channel: 'email', challengeId: 'A'.repeat(24), code: '123456'}});
  for (let index = 0; index < 60; index++) assert.equal((await verify()).status, 400);
  assert.equal((await verify()).status, 429);
  await h.settle();
  assert.equal(errors(h.db)[0].limit, 'verify-ip');
});
