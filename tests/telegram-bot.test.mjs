import test from 'node:test';
import assert from 'node:assert/strict';
import { botLinks, botLang, parseBotUpdate, validStartToken } from '../lib/auth/telegram-bot.ts';

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
  assert.equal(start('hello'), null);
});

test('the confirm tap carries who confirmed; anything else is ignored', () => {
  const tap = (data) => parseBotUpdate({ callback_query: { id: 'cb1', from, data, message: { message_id: 9, chat: { id: 5, type: 'private' } } } });
  assert.deepEqual(tap('ok:' + token), { kind: 'confirm', callbackId: 'cb1', chatId: 5, messageId: 9, token, lang: 'uz', user: { id: '123456789', name: 'Zarina Karimova' } });
  assert.equal(tap('no:' + token), null);
  assert.equal(tap('ok:x'), null);
  assert.equal(parseBotUpdate(null), null);
  assert.equal(botLang('en-GB'), 'en');
  assert.equal(botLang(undefined), 'ru');
});
