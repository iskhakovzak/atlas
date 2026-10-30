import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
  classifyImportError, customerLines, digestMessage, eventMessage, gatewayAlive, recordGatewayProbe, recordImport,
  sendDailyDigest, tashkentDayStart,
} from '../lib/market/import-monitor.ts';
import {importMonitorPath, isAuthorizedCatalogRefresh, catalogRefreshPath} from '../lib/market/catalog-refresh-auth.ts';
import {monitorPath, runMonitor} from '../workers/import-monitor/src/index.ts';

// Import monitor (owner, 30.10.2026): no request reaches Telegram here; messages are collected from `send`.

function harness(now = Date.UTC(2026, 9, 30, 9, 0)) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE market_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL,updated_by TEXT NOT NULL);');
  sqlite.exec(readFileSync(new URL('../drizzle/0016_import_outcomes.sql', import.meta.url), 'utf8').replaceAll('--> statement-breakpoint', ''));
  const statement = (sql, args = []) => ({
    bind: (...values) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({results: sqlite.prepare(sql).all(...args)}),
    run: async () => sqlite.prepare(sql).run(...args),
  });
  const sent = [];
  const state = {now};
  const deps = () => ({db: {prepare: sql => statement(sql)}, send: async html => { sent.push(html); }, now: state.now});
  return {sqlite, sent, state, deps, rows: () => sqlite.prepare('SELECT host,kind,reason,user_id FROM market_import_outcomes ORDER BY created_at').all()};
}

const customer = {userId: 'phone:+998901234567', name: 'Азиз', phone: '+998901234567', email: 'aziz@example.com', telegramId: '777'};
const blocked = Object.assign(new Error('x'), {name: 'ManualEntryFallbackError', reason: 'blocked'});

test('errors are sorted into failures, link problems and non-failures, in plain words', () => {
  const failed = classifyImportError(blocked, 'HTTP 403 · защита akamai');
  assert.equal(failed.kind, 'failed');
  assert.equal(failed.reason, 'blocked');
  assert.match(failed.detail, /^Магазин заблокировал загрузку .*\(HTTP 403 · защита akamai\)\.$/);
  assert.equal(classifyImportError(Object.assign(new Error(''), {name: 'ManualEntryFallbackError', reason: 'pending'})), undefined, 'Walmart still collecting');
  assert.equal(classifyImportError(Object.assign(new Error(''), {name: 'ManualEntryFallbackError', reason: 'manual'})), undefined, 'a store Atlas never reads');
  assert.equal(classifyImportError(new Error('Магазин сообщил, что карточка товара не найдена. Проверьте ссылку.')).kind, 'link');
  assert.equal(classifyImportError(Object.assign(new Error('aborted'), {name: 'AbortError'})).reason, 'timeout');
  assert.deepEqual(classifyImportError(new Error('Не удалось загрузить товар.')), {kind: 'failed', reason: 'error', detail: 'Не удалось загрузить товар.'});
});

test('the customer block gives every way to call back; a guest is named as one; HTML is escaped', () => {
  const lines = customerLines(customer);
  assert.match(lines, /Покупатель: Азиз/);
  assert.match(lines, /📞 \+998901234567/);
  assert.match(lines, /✉️ aziz@example\.com/);
  assert.match(lines, /<a href="tg:\/\/user\?id=777">/);
  assert.equal(customerLines(undefined), 'Покупатель: не вошёл в аккаунт');
  assert.match(customerLines({userId: 'tg:1', name: 'A'}), /Контакта нет/);
  const message = eventMessage({host: 'www.nike.com', url: 'https://nike.com/p?a=1&b=<x>', kind: 'failed', detail: 'Магазин <b>', customer});
  assert.match(message, /⚠️ Импорт не удался — <b>nike\.com<\/b>/);
  assert.match(message, /a=1&amp;b=&lt;x&gt;/);
  assert.match(message, /Что случилось: Магазин &lt;b&gt;/);
  assert.match(message, /Покупателю открылась ручная форма/);
});

test('every failed attempt is told with the customer; 2 in a row mark the store down once; a success brings it back', async () => {
  const h = harness();
  const fail = {host: 'www.zara.com', url: 'https://www.zara.com/p1', kind: 'failed', reason: 'blocked', detail: 'Магазин заблокировал загрузку.', customer};
  await recordImport(h.deps(), fail);
  assert.equal(h.sent.length, 1, 'one failure: the customer message, no alarm yet');
  h.state.now += 60_000;
  await recordImport(h.deps(), fail);
  assert.equal(h.sent.length, 3);
  assert.match(h.sent[2], /^🔴 <b>zara\.com<\/b> не импортируется: 2 неудачи подряд/);
  h.state.now += 60_000;
  await recordImport(h.deps(), fail);
  assert.equal(h.sent.length, 4, 'still down: the customer is told, the alarm is not repeated');
  h.state.now += 40 * 60_000;
  await recordImport(h.deps(), {host: 'www.zara.com', url: 'https://www.zara.com/p2', kind: 'ok'});
  assert.match(h.sent[4], /^🟢 <b>zara\.com<\/b> снова импортируется\. Не работал 41 мин\.$/);
  await recordImport(h.deps(), {host: 'www.zara.com', url: 'https://www.zara.com/p2', kind: 'ok'});
  assert.equal(h.sent.length, 5, 'a success while up says nothing');
  assert.deepEqual(h.rows().map(row => row.kind), ['failed', 'failed', 'failed', 'ok', 'ok']);
  assert.equal(h.rows()[0].user_id, customer.userId, 'the account id is kept, never the contact');
});

test('a success between two failures resets the count; a link problem never raises the alarm', async () => {
  const h = harness();
  const fail = {host: 'nike.com', url: 'https://nike.com/a', kind: 'failed', detail: 'x', customer};
  await recordImport(h.deps(), fail);
  h.state.now += 1000;
  await recordImport(h.deps(), {host: 'nike.com', url: 'https://nike.com/b', kind: 'ok'});
  h.state.now += 1000;
  await recordImport(h.deps(), fail);
  h.state.now += 1000;
  await recordImport(h.deps(), {host: 'nike.com', url: 'https://nike.com/c', kind: 'link', detail: 'Магазин убрал карточку товара.', customer});
  h.state.now += 1000;
  await recordImport(h.deps(), {host: 'nike.com', url: 'https://nike.com/c', kind: 'link', detail: 'Магазин убрал карточку товара.', customer});
  assert.equal(h.sent.filter(m => m.startsWith('🔴')).length, 0);
  assert.match(h.sent.at(-1), /^ℹ️ Ссылка не на товар — <b>nike\.com<\/b>/);
});

test('a store Atlas does not read is told with who asked; the first of the day is marked new', async () => {
  const h = harness();
  const ask = {host: 'www.shein.com', url: 'https://www.shein.com/x', kind: 'unsupported', customer};
  await recordImport(h.deps(), ask);
  await recordImport(h.deps(), ask);
  assert.match(h.sent[0], /^🆕 Хотели магазин, которого у нас нет: <b>shein\.com<\/b> \(сегодня впервые\)/);
  assert.match(h.sent[0], /Можно предложить выкуп вручную/);
  assert.match(h.sent[1], /^🛍 Хотели магазин/);
  assert.doesNotMatch(h.sent[1], /впервые/);
});

test('quiet attempts count without a customer message; a replayed failure is told but not counted', async () => {
  const h = harness();
  const fail = {host: 'gap.com', url: 'https://gap.com/a', kind: 'failed', detail: 'x'};
  await recordImport(h.deps(), {...fail, quiet: true});
  assert.equal(h.sent.length, 0);
  await recordImport(h.deps(), {...fail, replay: true, customer});
  assert.equal(h.sent.length, 1, 'the customer who got the same failure again is told about');
  assert.equal(h.rows().length, 1, 'no new attempt, no new row');
  assert.equal(h.sent.filter(m => m.startsWith('🔴')).length, 0, 'one real failure is not two');
});

test('the gateway: 🔴 at once when it does not answer, once; 🟢 when it answers (415 is up)', async () => {
  const h = harness();
  assert.equal(gatewayAlive({configured: true, status: 415, ms: 50}), true);
  assert.equal(gatewayAlive({configured: true, status: 530, ms: 50}), false);
  assert.equal(await recordGatewayProbe(h.deps(), {configured: false, status: 0, ms: 0}), 'not-configured');
  assert.equal(await recordGatewayProbe(h.deps(), {configured: true, status: 0, ms: 8000}), 'down');
  await recordGatewayProbe(h.deps(), {configured: true, status: 530, ms: 100});
  assert.equal(h.sent.length, 1);
  assert.match(h.sent[0], /^🔴 Шлюз импорта не отвечает \(нет ответа за 8 с\)/);
  h.state.now += 30 * 60_000;
  assert.equal(await recordGatewayProbe(h.deps(), {configured: true, status: 415, ms: 90}), 'up');
  assert.match(h.sent[1], /^🟢 Шлюз импорта снова отвечает\. Не работал 30 мин\.$/);
});

test('the summary goes out once a day after 10:00 Tashkent, about yesterday', async () => {
  const before = Date.UTC(2026, 9, 30, 4, 50); // 09:50 in Tashkent
  const h = harness(before);
  const yesterday = tashkentDayStart(before) - 3 * 60 * 60_000;
  const add = (host, kind, at) => h.sqlite.prepare('INSERT INTO market_import_outcomes (id,host,kind,url,created_at) VALUES (?,?,?,?,?)').run(crypto.randomUUID(), host, kind, 'https://x', at);
  add('www.shein.com', 'unsupported', yesterday); add('www.shein.com', 'unsupported', yesterday); add('temu.com', 'unsupported', yesterday);
  add('nike.com', 'ok', yesterday); add('zara.com', 'failed', yesterday);
  add('nike.com', 'ok', tashkentDayStart(before) - 2 * 24 * 60 * 60_000);
  assert.equal(await sendDailyDigest(h.deps()), 'early');
  h.state.now = Date.UTC(2026, 9, 30, 5, 5); // 10:05
  assert.equal(await sendDailyDigest(h.deps()), 'sent-now');
  assert.equal(await sendDailyDigest(h.deps()), 'sent');
  assert.equal(h.sent.length, 1);
  assert.match(h.sent[0], /^📊 Импорт за 2026-10-29/);
  assert.match(h.sent[0], /Загружено: 1 · не удалось: 1 · не та ссылка: 0/);
  assert.match(h.sent[0], /Хотели магазины, которых нет: shein\.com ×2, temu\.com ×1/);
  assert.match(h.sent[0], /Сейчас всё работает\./);
  assert.match(digestMessage('d', [], [{host: 'gateway', since: 0}], 90 * 60_000), /Сейчас не работает: шлюз \(1 ч 30 мин\)/);
});

test('the cron worker signs its own path; the site accepts it and refuses it for the catalog refresh', async () => {
  assert.equal(monitorPath, importMonitorPath);
  let seen;
  const fetcher = async (url, init) => { seen = new Request(url, init); return new Response('{"ok":true}'); };
  await runMonitor({ATLAS_SITE_URL: 'https://atlasmarket.uz', ATLAS_IMPORT_MONITOR_SECRET: 's3cret'}, fetcher);
  assert.equal(new URL(seen.url).href, 'https://atlasmarket.uz/api/internal/import-monitor');
  assert.equal(await isAuthorizedCatalogRefresh(seen, 's3cret', Date.now(), importMonitorPath), true);
  assert.equal(await isAuthorizedCatalogRefresh(seen, 'other', Date.now(), importMonitorPath), false);
  const moved = new Request('https://atlasmarket.uz' + catalogRefreshPath, {method: 'POST', headers: seen.headers});
  assert.equal(await isAuthorizedCatalogRefresh(moved, 's3cret'), false, 'the signature is bound to the monitor path');
  await assert.rejects(runMonitor({ATLAS_SITE_URL: 'http://atlasmarket.uz', ATLAS_IMPORT_MONITOR_SECRET: 's'}, fetcher), /site_url_invalid/);
  await assert.rejects(runMonitor({ATLAS_SITE_URL: 'https://atlasmarket.uz'}, fetcher), /secret_missing/);
});

test('wiring: the import route reports live attempts, skips the warm-up, and always opens the manual form', () => {
  const route = readFileSync(new URL('../app/api/import/route.ts', import.meta.url), 'utf8');
  assert.match(route, /manualEntryAvailable: true, orderByHand: canManuallyEnter, monitored/);
  assert.match(route, /if \(leader\) \{/);
  assert.match(route, /!isSupportedStoreHost\(host\) && !warm\) monitorImport/);
  assert.match(route, /replay: true/);
  const clipboard = readFileSync(new URL('../app/use-clipboard-link.ts', import.meta.url), 'utf8');
  assert.match(clipboard, /JSON\.stringify\(\{url:link,warm:true\}\)/);
  const page = readFileSync(new URL('../app/global-link-order.tsx', import.meta.url), 'utf8');
  assert.match(page, /Мы уже знаем о проблеме и можем связаться с вами\./);
  assert.match(page, /setSourceCheckStatus\(byHand\?'manual':'failed'\)/, 'a store that could not answer opens the orderable hand-filled form');
  const server = readFileSync(new URL('../lib/market/import-monitor-server.ts', import.meta.url), 'utf8');
  assert.match(server, /operator\(user\.email\)/, 'the owner\'s own imports are not reported as a customer');
});
