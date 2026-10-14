import test from 'node:test';
import assert from 'node:assert/strict';
import { botCommands, botLinks, botLang, classifyBotFailure, parseBotUpdate, validStartToken } from '../lib/auth/telegram-bot.ts';

const token = 'AbCdEfGhIjKlMnOpQrStUvWxYz012-_9';
const from = { id: 123456789, is_bot: false, first_name: 'Zarina', last_name: 'Karimova', language_code: 'uz' };

test('the button opens the app: t.me on phones, tg:// on computers, with the one-time token', () => {
  assert.ok(validStartToken(token));
  assert.equal(validStartToken('short'), false);
  assert.equal(validStartToken(token + '!'), false);
  assert.deepEqual(botLinks('atlas_log_in_bot', token), { app: `tg://resolve?domain=atlas_log_in_bot&start=${token}`, web: `https://t.me/atlas_log_in_bot?start=${token}` });
});

test('/start with a token in a private chat asks to confirm; a group, a bot or a broken token does not', () => {
  const start = (text, chat = { id: 5, type: 'private' }, sender = from) => parseBotUpdate({ message: { chat, from: sender, text } });
  assert.deepEqual(start(`/start ${token}`), { kind: 'start', chatId: 5, token, lang: 'uz' });
  assert.deepEqual(start('/start'), { kind: 'start', chatId: 5, token: undefined, lang: 'uz' });
  assert.equal(start(`/start ${token}`).token, token);
  assert.equal(start('/start bad!token').token, undefined);
  assert.equal(start(`/start ${token}`, { id: -1, type: 'group' }), null);
  assert.equal(start(`/start ${token}`, undefined, { ...from, is_bot: true }), null);
  // Any other text gets the "the bot does not read replies" answer (rate-limited in the webhook), not silence.
  assert.deepEqual(start('hello'), { kind: 'text', chatId: 5, subject: 'tg:123456789', lang: 'uz' });
});

test('/stop and /start notify name the Telegram account that wrote, never anything from the text', () => {
  const say = (text, chat = { id: 123456789, type: 'private' }, sender = from) => parseBotUpdate({ message: { chat, from: sender, text } });
  assert.deepEqual(say('/stop'), { kind: 'stop', chatId: 123456789, subject: 'tg:123456789', lang: 'uz' });
  assert.deepEqual(say('/stop@atlas_log_in_bot'), { kind: 'stop', chatId: 123456789, subject: 'tg:123456789', lang: 'uz' });
  assert.equal(say('/STOP').kind, 'stop');
  assert.deepEqual(say('/start notify'), { kind: 'notify', chatId: 123456789, subject: 'tg:123456789', lang: 'uz', plain: false });
  assert.equal(say('/start@atlas_log_in_bot notify').kind, 'notify');
  // "/stop now", "/stop please" or a plain "stop"/"стоп": whoever writes it wants the notices off — still only
  // for the Telegram that wrote, whatever the rest of the text names.
  for (const text of ['/stop now', '/stop please', '/stop tg:999', '/stop\nспасибо', 'stop', 'Стоп', 'STOP!'])
    assert.deepEqual(say(text), { kind: 'stop', chatId: 123456789, subject: 'tg:123456789', lang: 'uz' }, text);
  for (const text of ['/stopped', 'stop it', 'не стоп', '/stops']) assert.equal(say(text).kind, 'text', text);
  // "/start tg:999" is just a start without a token: no other account can be named from the chat.
  assert.equal(say('/start tg:999').kind, 'start');
  assert.equal(say('/start tg:999').token, undefined);
  assert.equal(say('/stop', { id: -100, type: 'group' }), null);
  assert.equal(say('/stop', undefined, { ...from, is_bot: true }), null);
  assert.equal(say('/stop', undefined, { is_bot: false, first_name: 'X' }), null);
});

test('Bot API failures are told apart by their description: only "not started" and "blocked" stop the notices', () => {
  assert.deepEqual(classifyBotFailure({ status: 429, description: 'Too Many Requests: retry after 3', retryAfter: 3 }), { kind: 'rate', retryAfter: 3 });
  assert.deepEqual(classifyBotFailure({ status: 400, description: 'Bad Request: chat not found' }), { kind: 'not-started' });
  assert.deepEqual(classifyBotFailure({ status: 403, description: "Forbidden: bot can't initiate conversation with a user" }), { kind: 'not-started' });
  assert.deepEqual(classifyBotFailure({ status: 400, description: 'Bad Request: PEER_ID_INVALID' }), { kind: 'not-started' });
  assert.deepEqual(classifyBotFailure({ status: 403, description: 'Forbidden: bot was blocked by the user' }), { kind: 'blocked' });
  assert.deepEqual(classifyBotFailure({ status: 403, description: 'Forbidden: user is deactivated' }), { kind: 'blocked' });
  assert.deepEqual(classifyBotFailure({ status: 403 }), { kind: 'blocked' });
  // Atlas's own formatting mistakes never turn a customer's notices off.
  assert.deepEqual(classifyBotFailure({ status: 400, description: "Bad Request: can't parse entities: Unsupported start tag" }), { kind: 'bad-request' });
  assert.deepEqual(classifyBotFailure({ status: 400, description: 'Bad Request: BUTTON_URL_INVALID' }), { kind: 'bad-request' });
  assert.deepEqual(classifyBotFailure({ status: 400, description: 'Bad Request: message is too long' }), { kind: 'bad-request' });
  for (const status of [0, 401, 404, 500, 502]) assert.deepEqual(classifyBotFailure({ status }), { kind: 'unavailable' });
});

test('the command menu offers only /stop, Uzbek by default', () => {
  for (const key of ['default', 'ru', 'uz', 'en']) assert.deepEqual(botCommands[key].map(item => item.command), ['stop']);
  assert.equal(botCommands.default[0].description, botCommands.uz[0].description);
  for (const list of Object.values(botCommands)) for (const item of list) assert.ok(item.description.length >= 3 && item.description.length <= 256);
});

test('the confirm tap carries who confirmed; anything else is ignored', () => {
  const tap = (data) => parseBotUpdate({ callback_query: { id: 'cb1', from, data, message: { message_id: 9, chat: { id: 5, type: 'private' } } } });
  assert.deepEqual(tap('ok:' + token), { kind: 'confirm', callbackId: 'cb1', chatId: 5, messageId: 9, token, lang: 'uz', user: { id: '123456789', name: 'Zarina Karimova' }, media: false });
  // The welcome animation's message is edited by its caption.
  const onAnimation = parseBotUpdate({ callback_query: { id: 'cb2', from, data: 'ok:' + token, message: { message_id: 10, chat: { id: 5, type: 'private' }, animation: { file_id: 'x' }, caption: 'Вход' } } });
  assert.equal(onAnimation.media, true);
  assert.equal(tap('no:' + token), null);
  assert.equal(tap('ok:x'), null);
  assert.equal(parseBotUpdate(null), null);
  assert.equal(botLang('en-GB'), 'en');
  assert.equal(botLang(undefined), 'ru');
});
