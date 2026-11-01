import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { blank, supportAnswered, updateCommunication } from '../lib/market/domain.ts';
import { actionSchema, applyAction } from '../lib/market/actions.ts';
import { renderNotification } from '../lib/market/history-copy.ts';
import { noticeTarget } from '../lib/market/notice-panel.ts';
import { serverError } from '../lib/market/i18n.ts';
import {
  casUpdate, hasNewNotice, newNotices, quietNotice, setTelegramNotices, shouldNotifyTelegram, stopOutcome, tashkentNight,
  telegramFreshness, telegramNotifyLink, telegramPending, telegramPendingWindow, telegramSilent, telegramView,
} from '../lib/market/telegram-state.ts';
import { botReply, formatTelegramNotices, telegramCopy, visibleLength, welcomeMessage } from '../lib/market/telegram-notices.ts';
import { telegramUiCopy } from '../lib/market/telegram-ui-copy.ts';
import { consentSubject } from '../lib/auth/telegram-bot.ts';

// Telegram order notices, only with the customer's consent (owner, 14.10.2026). No request reaches
// api.telegram.org here: the pure parts are tested directly, the server's wiring by its source.

const noon = Date.UTC(2026, 9, 14, 7, 0); // 12:00 in Tashkent
const origin = 'https://atlasmarket.uz';
const notice = (id, at, extra = {}) => ({ id, at, title: id, message: '', read: false, ...extra });
const withCommunication = (extra, state = blank()) => ({ ...state, communication: { ...state.communication, ...extra } });
// Source-text assertions slice on "\n}\n"; a Windows checkout (core.autocrlf) must not break them.
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('new notices: by id, unread, fresh, oldest first; the same list is nothing new', () => {
  const previous = { notifications: [notice('a', noon - 5_000)] };
  const next = { notifications: [notice('c', noon - 100), notice('a', noon - 5_000), notice('b', noon - 2_000)] };
  assert.deepEqual(newNotices(previous, next, noon).map((item) => item.id), ['b', 'c']);
  assert.equal(hasNewNotice(previous, next, noon), true);
  assert.deepEqual(newNotices(previous, previous, noon), []);
  assert.equal(hasNewNotice(previous, { notifications: [...previous.notifications] }, noon), false);
  // Read, older than ten minutes (a restored backup) or from the future: never sent.
  const odd = { notifications: [notice('r', noon, { read: true }), notice('old', noon - telegramFreshness - 1), notice('later', noon + 120_000)] };
  assert.deepEqual(newNotices({ notifications: [] }, odd, noon), []);
});

test('the cheap gate: only an Atlas write (notify) to an account with the notices on that added a notice', () => {
  const before = withCommunication({ telegramEnabled: true, telegramSince: noon - 60_000 });
  const after = { ...before, notifications: [notice('n1', noon), ...before.notifications] };
  assert.equal(shouldNotifyTelegram(true, before, after, noon), true);
  assert.equal(shouldNotifyTelegram(undefined, before, after, noon), false);
  assert.equal(shouldNotifyTelegram(false, before, after, noon), false);
  assert.equal(shouldNotifyTelegram(true, undefined, after, noon), false);
  assert.equal(shouldNotifyTelegram(true, before, before, noon), false);
  const off = withCommunication({ telegramEnabled: false }, after);
  assert.equal(shouldNotifyTelegram(true, before, off, noon), false);
});

test('switching: on, waiting for Start, off; an off for an older consent leaves a newer one', () => {
  const base = withCommunication({ telegramOff: 'blocked', telegramOffAt: 5 });
  const on = setTelegramNotices(base, { kind: 'on', now: 100, language: 'en' });
  assert.equal(on.communication.telegramEnabled, true);
  assert.equal(on.communication.telegramSince, 100);
  assert.equal(on.communication.language, 'en');
  assert.equal(on.communication.telegramOff, undefined);
  assert.equal(on.communication.telegramPendingAt, undefined);
  // Email/SMS settings stay as they were.
  assert.equal(on.communication.emailEnabled, base.communication.emailEnabled);

  const pending = setTelegramNotices(base, { kind: 'pending', now: 200 });
  assert.equal(pending.communication.telegramEnabled, false);
  assert.equal(pending.communication.telegramPendingAt, 200);
  // A new "Turn on" replaces the old reason for "off": when the wait ends, "blocked" must not come back.
  assert.equal(pending.communication.telegramOff, undefined);
  assert.equal(pending.communication.telegramOffAt, undefined);
  assert.deepEqual(telegramView(pending.communication, undefined, 200 + telegramPendingWindow + 1), { kind: 'off' });

  // A refusal for the consent given at 100 does not turn off the one given at 300.
  const renewed = setTelegramNotices(on, { kind: 'on', now: 300 });
  assert.equal(setTelegramNotices(renewed, { kind: 'off', reason: 'blocked', now: 400, since: 100 }), renewed);
  const blocked = setTelegramNotices(renewed, { kind: 'off', reason: 'blocked', now: 400, since: 300 });
  assert.deepEqual([blocked.communication.telegramEnabled, blocked.communication.telegramOff, blocked.communication.telegramOffAt, blocked.communication.telegramSince], [false, 'blocked', 400, undefined]);

  // Already off and nothing waiting: the very same object, so nothing is written.
  assert.equal(setTelegramNotices(blocked, { kind: 'off', reason: 'customer', now: 500 }), blocked);
  // Waiting for Start, then switched off: the wait is cleared.
  const cancelled = setTelegramNotices(pending, { kind: 'off', reason: 'customer', now: 500 });
  assert.equal(cancelled.communication.telegramPendingAt, undefined);
  assert.equal(cancelled.communication.telegramOff, 'customer');
});

test('what the settings row shows, including Telegram attached again after the consent', () => {
  const on = withCommunication({ telegramEnabled: true, telegramSince: 1_000 }).communication;
  assert.deepEqual(telegramView(on, undefined, noon), { kind: 'on', since: 1_000 });
  assert.deepEqual(telegramView(on, 1_000, noon), { kind: 'on', since: 1_000 });
  assert.deepEqual(telegramView(on, 1_001, noon), { kind: 'changed' });
  const waiting = withCommunication({ telegramEnabled: false, telegramPendingAt: noon - 60_000 }).communication;
  assert.deepEqual(telegramView(waiting, undefined, noon), { kind: 'pending', at: noon - 60_000 });
  assert.equal(telegramPending(waiting, noon - 60_000 + telegramPendingWindow + 1), false);
  assert.deepEqual(telegramView(waiting, undefined, noon - 60_000 + telegramPendingWindow + 1), { kind: 'off' });
  assert.deepEqual(telegramView(withCommunication({ telegramOff: 'bot-stop' }).communication, undefined, noon), { kind: 'off', reason: 'bot-stop' });
  assert.deepEqual(telegramView(withCommunication({ telegramOff: 'whatever' }).communication, undefined, noon), { kind: 'off' });
  assert.equal(telegramNotifyLink('atlas_log_in_bot'), 'https://t.me/atlas_log_in_bot?start=notify');
});

test('sound: night in Tashkent (22–08) and purely informational notices arrive silently', () => {
  assert.equal(tashkentNight(Date.UTC(2026, 9, 14, 17, 0)), true); // 22:00
  assert.equal(tashkentNight(Date.UTC(2026, 9, 14, 16, 59)), false); // 21:59
  assert.equal(tashkentNight(Date.UTC(2026, 9, 14, 2, 59)), true); // 07:59
  assert.equal(tashkentNight(Date.UTC(2026, 9, 14, 3, 0)), false); // 08:00
  for (const code of ['parcel-weighed', 'customs-duty-match', 'store-shipping-within', 'store-shipping-extra-legacy']) assert.equal(quietNotice(code), true, code);
  for (const code of ['status', 'extra-charge-requested', 'change-requested', undefined]) assert.equal(quietNotice(code), false, String(code));
  assert.equal(telegramSilent([{ code: 'parcel-weighed' }, { code: 'customs-duty-match' }], noon), true);
  assert.equal(telegramSilent([{ code: 'parcel-weighed' }, { code: 'status' }], noon), false);
  assert.equal(telegramSilent([{ code: 'extra-charge-requested' }], Date.UTC(2026, 9, 14, 20, 0)), true);
});

test('one notice: escaped title and text, "action needed", product and order, its own https button', () => {
  const orders = [{ id: 'AT-1A2B3C4D5E6F', product: { name: 'Кроссовки <Nike> Air Zoom Pegasus 41 & ещё очень длинное название модели' } }];
  const message = formatTelegramNotices([notice('n1', noon, { orderId: 'AT-1A2B3C4D5E6F', title: 'Ответ <b>ок</b>', message: 'A & B <script>' })], orders, 'ru', origin, noon);
  assert.match(message.text, /^<b>Ответ &lt;b&gt;ок&lt;\/b&gt;<\/b>\nA &amp; B &lt;script&gt;\n/);
  assert.ok(!message.text.includes('<script>'));
  const about = message.text.split('\n').at(-1);
  assert.ok(about.endsWith(' · AT-1A2B3C4D5E6F'));
  assert.ok(about.includes('…'));
  assert.ok(about.replace(' · AT-1A2B3C4D5E6F', '').replace(/&lt;|&gt;|&amp;/g, '_').length <= 60);
  assert.equal(message.reply_markup.inline_keyboard.length, 1);
  assert.equal(message.reply_markup.inline_keyboard[0][0].url, origin + '/orders#AT-1A2B3C4D5E6F');
  assert.equal(message.parse_mode, 'HTML');
  assert.deepEqual(message.link_preview_options, { is_disabled: true });
  assert.equal(message.disable_notification, false);

  const asked = formatTelegramNotices([notice('n2', noon, { orderId: 'AT-1A2B3C4D5E6F', code: 'extra-charge-requested', params: { amount: 120000, reason: 'Магазин изменил цену' } })], orders, 'ru', origin, noon);
  assert.ok(asked.text.startsWith('<i>Нужно ваше действие</i>\n<b>'));

  const reply = formatTelegramNotices([notice('n3', noon, { code: 'support-answered', params: { subject: 'Где посылка?' } })], [], 'ru', origin, noon);
  assert.deepEqual(reply.reply_markup.inline_keyboard[0][0], { text: 'Открыть ответ', url: origin + '/account#support' });
  assert.equal(formatTelegramNotices([], orders, 'ru', origin, noon), null);
});

test('buttons only to the public https site; Uzbek Cyrillic never breaks the HTML tags', () => {
  const one = [notice('n1', noon, { orderId: 'AT-1' })];
  for (const bad of ['http://localhost:5191', 'https://atlasmarket.uz/path', 'javascript:alert(1)', 'tg://resolve?domain=x']) assert.equal(formatTelegramNotices(one, [], 'ru', bad, noon).reply_markup, undefined, bad);
  for (const locale of ['ru', 'uz', 'oz', 'en']) {
    const texts = [formatTelegramNotices([notice('a', noon, { orderId: 'AT-1', code: 'change-requested', params: { title: 'Размер' } }), notice('b', noon - 1, { orderId: 'AT-1' })], [], locale, origin, noon).text, welcomeMessage(locale, origin).text];
    for (const text of texts) {
      assert.ok(!/<\/?[а-яёўқғҳ]/i.test(text), `${locale}: ${text.slice(0, 80)}`);
      assert.ok(/<b>/.test(text));
    }
  }
  assert.ok(welcomeMessage('ru', origin).text.includes('никогда не просит'));
  assert.equal(botReply('a < b & c', origin).text, 'a &lt; b &amp; c');
  assert.deepEqual(botReply('x', origin, { text: 'Открыть', path: '/account#telegram-notices' }).reply_markup.inline_keyboard[0][0], { text: 'Открыть', url: origin + '/account#telegram-notices' });
});

test('a batch: newest first, at most five with "and N more", one button to all notifications, under 4096 characters', () => {
  const many = Array.from({ length: 7 }, (_, index) => notice('n' + index, noon - index * 1_000, { orderId: 'AT-' + index }));
  const message = formatTelegramNotices(many, [], 'ru', origin, noon);
  assert.ok(message.text.startsWith('<b>Новости по заказам: 7</b>'));
  assert.ok(message.text.includes('…и ещё 2'));
  assert.ok(message.text.indexOf('AT-0') < message.text.indexOf('AT-4'));
  assert.ok(!message.text.includes('AT-5'));
  assert.deepEqual(message.reply_markup.inline_keyboard, [[{ text: 'Все уведомления', url: origin + '/notifications' }]]);
  // Telegram counts its 4096 after reading the HTML: a tag is nothing, an entity is one character.
  assert.equal(visibleLength('<b>A &amp; B</b> &lt;i&gt;'), 9);
  // Five full-length notices full of characters that need escaping: whole notices drop, the HTML is never cut.
  const longOrders = Array.from({ length: 5 }, (_, index) => ({ id: 'AT-LONG000000' + index, product: { name: 'Кроссовки <Nike> & '.repeat(10) } }));
  const long = Array.from({ length: 5 }, (_, index) => notice('l' + index, noon - index, { orderId: 'AT-LONG000000' + index, title: '<'.repeat(120), message: '&'.repeat(600) }));
  const big = formatTelegramNotices(long, longOrders, 'ru', origin, noon);
  assert.ok(visibleLength(big.text) <= 4096, String(visibleLength(big.text)));
  assert.ok(big.text.includes('…и ещё 1'), 'one notice dropped');
  assert.ok(big.text.length > 4096, 'the raw HTML is longer than what Telegram counts');
  // Only whole tags and entities: nothing left to cut in the middle.
  assert.doesNotMatch(big.text.replace(/<\/?[bi]>/g, '').replace(/&(?:amp|lt|gt);/g, ''), /[<>&]/);
  assert.ok(big.text.endsWith('…и ещё 1'));
  // The same five, short: all of them, nothing counted.
  const five = formatTelegramNotices(long.map((item) => ({ ...item, title: 'T', message: 'M' })), longOrders, 'ru', origin, noon);
  assert.ok(!five.text.includes('…и ещё'));
});

test('one write over many tries: a conflict is read again, a failure is never "nothing to change"', async () => {
  const conflict = Object.assign(new Error('revision'), { status: 409 });
  const io = (saves, loads = []) => {
    let revision = 1, loaded = 0;
    return {
      calls: () => ({ loaded, saved: revision - 1 }),
      load: async () => { const fail = loads[loaded++]; if (fail) throw fail; return { state: { on: true, revision }, revision }; },
      save: async () => { const fail = saves.shift(); if (fail) throw fail; revision += 1; },
      conflict: (error) => error?.status === 409,
    };
  };
  const off = (state) => (state.on ? { ...state, on: false } : state);
  // Saved on the second try after one concurrent write.
  const once = io([conflict]);
  assert.deepEqual(await casUpdate(once, off), { status: 'saved', state: { on: false, revision: 1 } });
  assert.equal(once.calls().loaded, 2);
  // Three conflicts in a row: failed, carrying the last error — never "unchanged".
  const busy = io([conflict, conflict, conflict]);
  const failed = await casUpdate(busy, off);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.error, conflict);
  assert.equal(busy.calls().loaded, 3);
  // Nothing to change: unchanged, nothing written.
  const already = io([]);
  assert.equal((await casUpdate(already, (state) => state)).status, 'unchanged');
  assert.equal(already.calls().saved, 0);
  // The database could not be read, or refused the write for another reason: failed at once, no retry.
  const down = new Error('D1_ERROR');
  assert.deepEqual(await casUpdate(io([], [down]), off), { status: 'failed', error: down });
  const refused = io([down]);
  assert.deepEqual(await casUpdate(refused, off), { status: 'failed', error: down });
  assert.equal(refused.calls().loaded, 1);

  // What /stop answers over the accounts a Telegram leads to (its own "tg:" account and the one it is attached to).
  assert.equal(stopOutcome([]), 'already');
  assert.equal(stopOutcome([{ status: 'unchanged', state: {} }]), 'already');
  assert.equal(stopOutcome([{ status: 'saved', state: {} }, { status: 'unchanged', state: {} }]), 'stopped');
  assert.equal(stopOutcome([failed]), 'failed');
  assert.equal(stopOutcome([{ status: 'saved', state: {} }, failed]), 'failed');
  for (const locale of ['ru', 'uz', 'oz', 'en']) {
    assert.match(telegramCopy[locale].stopFailed, /\/stop/, locale);
    assert.match(telegramCopy[locale].notifyFailed, /\/start/, locale);
    assert.notEqual(telegramCopy[locale].stopFailed, telegramCopy[locale].alreadyOff, locale);
  }
});

test('consent: the Telegram attached no later than the consent; one attached afterwards needs a new one', () => {
  assert.equal(consentSubject('tg:42', {}), 'tg:42');
  assert.equal(consentSubject('tg:42', { attachedElsewhere: false }, 10), 'tg:42');
  // An account created with Telegram whose Telegram was then attached to another account: nothing is sent.
  assert.equal(consentSubject('tg:42', { attachedElsewhere: true }), null);
  assert.equal(consentSubject('email:a@b.uz', { links: [] }), null);
  assert.equal(consentSubject('email:a@b.uz', { links: [{ subject: 'tg:1', created_at: 100 }, { subject: 'tg:2', created_at: 50 }] }), null);
  assert.equal(consentSubject('email:a@b.uz', { links: [{ subject: 'tg:1', created_at: 100 }] }), 'tg:1');
  assert.equal(consentSubject('email:a@b.uz', { links: [{ subject: 'tg:1', created_at: 100 }] }, 100), 'tg:1');
  assert.equal(consentSubject('email:a@b.uz', { links: [{ subject: 'tg:1', created_at: 100 }] }, 200), 'tg:1');
  // Unlinked and linked again (or someone else's Telegram) after the consent: not the consented recipient.
  assert.equal(consentSubject('email:a@b.uz', { links: [{ subject: 'tg:9', created_at: 300 }] }, 200), null);
  assert.equal(consentSubject('email:a@b.uz', { links: [{ subject: 'tg:9' }] }, 200), null);
  assert.equal(consentSubject('email:a@b.uz', { links: [{ subject: 'google:1', created_at: 1 }] }, 200), null);
});

test('the Telegram fields are the server\'s: the settings form neither clears nor forges them', () => {
  const state = withCommunication({ telegramEnabled: true, telegramSince: 100, telegramPendingAt: undefined });
  const sent = { ...state.communication, emailEnabled: true, language: 'en', telegramEnabled: false, telegramSince: 1, telegramOff: 'customer' };
  const saved = updateCommunication(state, sent);
  assert.equal(saved.communication.emailEnabled, true);
  assert.equal(saved.communication.language, 'en');
  assert.equal(saved.communication.telegramEnabled, true);
  assert.equal(saved.communication.telegramSince, 100);
  assert.equal(saved.communication.telegramOff, undefined);
  const forged = updateCommunication(blank(), { ...blank().communication, telegramEnabled: true, telegramSince: 1 });
  assert.equal(forged.communication.telegramEnabled, undefined);
  assert.equal(forged.communication.telegramSince, undefined);
  // The action schema already drops them from the request.
  const parsed = actionSchema.parse({ type: 'communication-save', value: sent });
  assert.equal('telegramEnabled' in parsed.value, false);
  assert.equal('telegramSince' in parsed.value, false);
  // The language sync in the store saves only a real difference from the server's language.
  assert.match(read('lib/market/store.tsx'), /preferred===serverLocaleRef\.current/);
});

test('"telegram-notify" carries only on/off and the language; it is never applied from client data', () => {
  const parsed = actionSchema.parse({ type: 'telegram-notify', enabled: true, language: 'oz', subject: 'tg:999', userId: 'email:x' });
  assert.deepEqual(parsed, { type: 'telegram-notify', enabled: true, language: 'oz' });
  assert.equal(actionSchema.safeParse({ type: 'telegram-notify' }).success, false);
  assert.equal(actionSchema.safeParse({ type: 'telegram-notify', enabled: true, language: 'de' }).success, false);
  assert.throws(() => applyAction(blank(), { type: 'telegram-notify', enabled: true }, false));
  assert.throws(() => applyAction(blank(), { type: 'telegram-notify', enabled: true }, true));
});

test('an operator\'s support reply is one notice naming the request, never the answer; the customer\'s own is not', () => {
  const opened = applyAction(blank(), { type: 'support-create', subject: 'Где посылка?', text: 'Заказ AT-1 не двигается' }, false);
  const id = opened.supportTickets[0].id;
  const answered = applyAction(opened, { type: 'support-reply', id, text: 'Секретный ответ оператора' }, true);
  const added = answered.notifications.filter((item) => !opened.notifications.some((old) => old.id === item.id));
  assert.equal(added.length, 1);
  assert.equal(added[0].code, 'support-answered');
  assert.deepEqual(added[0].params, { subject: 'Где посылка?' });
  assert.ok(!JSON.stringify(added[0]).includes('Секретный'));
  assert.deepEqual(renderNotification(added[0], 'uz'), { title: 'Yordam xizmati javob berdi', message: 'Где посылка?' });
  assert.deepEqual(noticeTarget(added[0]), { href: '/account#support', kind: 'support' });
  const own = applyAction(opened, { type: 'support-reply', id, text: 'Уточнение' }, false);
  assert.equal(own.notifications.length, opened.notifications.length);
  assert.equal(supportAnswered(opened, 'missing'), opened);
});

test('errors err_81–err_84 are written in every language', () => {
  for (const locale of ['ru', 'uz', 'oz', 'en']) for (const code of ['err_81', 'err_82', 'err_83', 'err_84']) {
    const text = serverError(locale, code);
    assert.ok(text && text !== serverError(locale, 'err_unknown_code'), `${locale} ${code}`);
  }
});

test('the words: no forbidden promises, no ads promise, every language complete', () => {
  const words = JSON.stringify([telegramCopy.ru, telegramCopy.uz, telegramCopy.en, telegramUiCopy.ru, telegramUiCopy.uz, telegramUiCopy.en]);
  for (const forbidden of [/страхов/i, /sug.urta/i, /insurance/i, /курс ЦБ/i, /Оплатить/, /списан/i, /выкуплен/i, /без рекламы/i, /reklamasiz/i, /no ads/i]) assert.doesNotMatch(words, forbidden);
  for (const copy of [telegramCopy, telegramUiCopy]) {
    const keys = Object.keys(copy.ru).sort();
    for (const locale of ['uz', 'oz', 'en']) assert.deepEqual(Object.keys(copy[locale]).sort(), keys, locale);
  }
});

// The server side needs D1 and the Worker: its rules are checked in the source.
test('wiring: only /api/operations asks persist to notify, and the gate runs before anything loads', () => {
  const files = [];
  const walk = (dir) => { for (const name of readdirSync(new URL('../' + dir, import.meta.url))) { const path = join(dir, name); if (statSync(new URL('../' + path, import.meta.url)).isDirectory()) walk(path); else if (/\.tsx?$/.test(name)) files.push(path.replaceAll('\\', '/')); } };
  walk('app'); walk('lib');
  const notifying = files.filter((path) => /persist\([^)]*notify\s*:/.test(read(path)));
  assert.deepEqual(notifying, ['app/api/operations/route.ts']);
  assert.match(read('app/api/operations/route.ts'), /notify: telegramNoticesLive\(request\)/);
  const server = read('lib/market/server.ts');
  const gate = server.indexOf('shouldNotifyTelegram(options.notify');
  assert.ok(gate > 0 && gate < server.indexOf("import('./telegram-notices-server')"));
  assert.doesNotMatch(server, /^import[^\n]*telegram-notices-server/m);
});

test('wiring: delivery goes to the account persist saved, after the consent check; the switch runs in order', () => {
  const source = read('lib/market/telegram-notices-server.ts');
  const body = (name) => { const start = source.indexOf(`export async function ${name}`); return source.slice(start, source.indexOf('\n}\n', start)); };
  const deliver = body('deliverTelegramNotices');
  for (const forbidden of ['currentUser', 'signedInUser', 'identity(', 'headers(', 'request']) assert.ok(!deliver.includes(forbidden), forbidden);
  const order = (text, steps) => { let at = -1; for (const step of steps) { const next = text.indexOf(step, at + 1); assert.ok(next > at, step); at = next; } };
  order(deliver, ['shouldNotifyTelegram(', 'telegramConsentSubject(userId, since)', 'rateLimit(', 'formatTelegramNotices(', 'sendTelegram(', '"blocked"', 'disableTelegramNotices(userId, "blocked", { since })']);
  order(body('toggleTelegramNotices'), ['rateLimit(', 'telegramConfigured()', 'telegramNoticesLive(request)', 'telegramBotConnected()', 'telegramConsentSubject(userId)', '"sendChatAction"', 'kind: "pending"', 'err_82', 'err_83', 'kind: "on"', 'persist(', 'recordConsent(', 'deferBackground(welcome(']);
  // Telegram's answers: 5-second timeouts; a moved webhook keeps the updates waiting (a /stop must arrive).
  const auth = read('lib/auth/server.ts');
  assert.match(auth, /async function botCall\([^)]*timeoutMs=5000\)/);
  assert.match(auth, /drop_pending_updates:false/);
  assert.match(auth, /setMyCommands/);
  // Detaching Telegram turns the notices off; the bot's replies are rate-limited.
  assert.match(read('app/api/auth/links/route.ts'), /detachMethod\(payload\.data\.remove,telegramDetached\)/);
  assert.match(auth, /telegram-bot-reply:\$\{update\.chatId\}`,1,60\*60\*1000/);
  // Rate-limit keys start with the account, as everywhere else ("<userId>:<what>").
  assert.ok(deliver.includes('`${userId}:tg-notify`'));
  assert.ok(!source.includes('`tg-notify:'));
  // A database error is never read as "no Telegram" or "already off": the switch says "try again" (err_83),
  // /stop and /start notify say it did not work, the consent lookup itself never swallows an error.
  const authLf = auth.replaceAll('\r\n', '\n'), consentAt = authLf.indexOf('export async function telegramConsentSubject');
  const consent = consentAt < 0 ? '' : authLf.slice(consentAt, authLf.indexOf('\n}\n', consentAt));
  assert.ok(consent.length > 0 && !consent.includes('catch'));
  assert.ok(!auth.includes('telegramBotName'));
  const hooks = source.slice(source.indexOf('export const telegramNoticeHooks'), source.indexOf('\n};\n', source.indexOf('export const telegramNoticeHooks')));
  const stop = hooks.slice(hooks.indexOf('async stop('), hooks.indexOf('async notify('));
  assert.ok(!stop.includes('.catch(() => null)'));
  order(stop, ['telegramAccountsOf(update.subject)', 'disableTelegramNotices(userId, "bot-stop")', 'stopOutcome(results)', 'recordProblem("stop-failed")', 't.stopFailed']);
  assert.match(hooks.slice(hooks.indexOf('async notify(')), /notifyFailed/);
  assert.match(source, /telegramConsentSubject\(userId\)\.catch\(databaseDown\)/);
});

test('the account shows the setting first in "Настройки"; the policy says what Telegram receives', () => {
  const views = read('app/account-views.tsx');
  // On /account/settings since 1 November 2026, first under "Уведомления о посылках".
  assert.match(views, /<h2 id="pf-notices-title">\{p\.settings\.notices\}<\/h2>\n\s*<TelegramNoticesSetting locale=\{lang\} \/>/);
  assert.match(read('app/telegram-notices.tsx'), /id="telegram-notices"/);
  const privacy = read('app/legal-documents.tsx');
  const section = privacy.slice(privacy.indexOf('id="privacy-signin"'), privacy.indexOf('</section>', privacy.indexOf('id="privacy-signin"')));
  assert.match(section, /заголовок и текст уведомления, название товара и номер заказа/);
  assert.match(section, /после выключения уведомлений или удаления аккаунта/);
  assert.match(section, /<h3>[^<]*; уведомления в Telegram<\/h3>/);
  assert.match(section, /Сообщения доставляет Telegram/);
});

test('the nudge and the light links: only for those who never chose "off", and "on" only while it really sends', () => {
  const ui = read('app/telegram-notices.tsx');
  const nudge = ui.slice(ui.indexOf('export function TelegramNudge'));
  // Any saved reason for "off" (the switch, /stop, a block, unlinking) hides the nudge for good.
  assert.match(nudge, /state\.communication\.telegramOff!==undefined\)return null/);
  // A "Turn on" that did not finish (Start still needed) leads to the settings row instead of vanishing.
  assert.match(nudge, /if\(!await toggle\(true\)\)showSettingsRow\(\)/);
  // The settings row: retry when the account's Telegram could not be read; cancel while waiting for Start.
  assert.match(ui, /link\.failed&&<div className="tg-notices-actions">/);
  assert.match(ui, /onClick=\{\(\)=>switchTo\(false\)\}>\{t\.cancel\}/);
  // The bell and /notifications: a re-linked Telegram ("changed") is not "on".
  assert.match(read('app/telegram-notices-link.tsx'), /telegramView\(state\.communication,link\.linkedAt\)\.kind==='on'/);
  // Uzbek: the site's own spelling, no apostrophe before the suffix.
  assert.doesNotMatch(JSON.stringify([telegramUiCopy.uz, telegramCopy.uz]), /Telegram['‘’ʼ]/);
});
