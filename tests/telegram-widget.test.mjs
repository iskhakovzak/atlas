import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { telegramUserFromHash, telegramUserFromMessage, telegramWidgetOrigin } from '../lib/auth/telegram-widget.ts';

const user = { id: 42, first_name: 'Ali', username: 'ali', auth_date: 1793664000, hash: 'ab'.repeat(32) };
const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

test('the Telegram widget is loaded without data-onauth, which it would eval() under the enforced CSP', () => {
  const login = readFileSync(new URL('../app/login-view.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(login, /setAttribute\('data-onauth'/);
  assert.doesNotMatch(login, /setAttribute\('data-auth-url'/);
  assert.match(login, /event\.origin!==telegramWidgetOrigin/, 'only messages from oauth.telegram.org');
  assert.match(login, /event\.source!==frame\.contentWindow/, 'only from the widget iframe on this page');
  assert.equal(telegramWidgetOrigin, 'https://oauth.telegram.org');
});

test('the widget iframe message gives the user, other messages give nothing', () => {
  assert.deepEqual(telegramUserFromMessage(JSON.stringify({ event: 'auth_user', auth_data: user })), user);
  assert.deepEqual(telegramUserFromMessage(JSON.stringify({ event: 'auth_user', init: true, auth_data: user })), user, 'a remembered login signs in as before');
  assert.deepEqual(telegramUserFromMessage({ event: 'auth_user', auth_data: user }), user);
  for (const other of [JSON.stringify({ event: 'resize', height: 40 }), JSON.stringify({ event: 'auth_user' }), JSON.stringify({ event: 'auth_user', auth_data: [1] }), '{bad json', null, 7, JSON.stringify([user])])
    assert.equal(telegramUserFromMessage(other), null, String(other));
});

test('#tgAuthResult from the redirect fallback is read and removed from the address', () => {
  const encoded = base64url(user);
  assert.deepEqual(telegramUserFromHash('#tgAuthResult=' + encoded), { user, hash: '' });
  assert.deepEqual(telegramUserFromHash('#tab=telegram&tgAuthResult=' + encoded), { user, hash: '#tab=telegram' });
  assert.equal(telegramUserFromHash('#passports'), null);
  assert.equal(telegramUserFromHash(''), null);
  assert.equal(telegramUserFromHash('#tgAuthResult=***'), null);
  assert.equal(telegramUserFromHash('#tgAuthResult=' + base64url('text')), null);
});
