import test from 'node:test';
import assert from 'node:assert/strict';
import { pushMessages, validPushSubscription } from '../lib/market/push-notices.ts';
import { base64UrlEncode } from '../lib/market/web-push.ts';

const order = { id: 'AT-1', product: { name: 'Anker Nano Charger', image: 'https://cdn.example.com/a.png' } };
const notice = (id, extra = {}) => ({ id, at: 1, read: false, title: 'Статус заказа изменён', message: 'Доставлено', ...extra });

test('a push says what the bell says: the status as the headline, the product under it, and opens the order', () => {
  const [message] = pushMessages([notice('n1', { orderId: 'AT-1', code: 'status', params: { status: 5 } })], [order], 'ru');
  assert.equal(message.body, 'Anker Nano Charger');
  assert.notEqual(message.title, 'Статус заказа изменён');
  assert.equal(message.url, '/orders#AT-1');
  assert.equal(message.tag, 'atlas-n1');
  assert.equal(message.icon, 'https://cdn.example.com/a.png');
});

test('a batch rings at most three times (the newest), and a notice without an order opens itself', () => {
  const messages = pushMessages(['a', 'b', 'c', 'd', 'e'].map((id) => notice(id)), [], 'en');
  assert.deepEqual(messages.map((item) => item.tag), ['atlas-c', 'atlas-d', 'atlas-e']);
  assert.equal(messages[0].url, '/notifications?id=c');
  assert.equal('icon' in messages[0], false);
});

test('only real push services with valid keys are accepted (the server never posts elsewhere)', () => {
  const p256dh = base64UrlEncode(Uint8Array.from({ length: 65 }, (_, index) => index === 0 ? 4 : index));
  const auth = base64UrlEncode(new Uint8Array(16).fill(7));
  const good = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh, auth } };
  assert.deepEqual(validPushSubscription(good), { endpoint: good.endpoint, p256dh, auth });
  assert.ok(validPushSubscription({ ...good, endpoint: 'https://web.push.apple.com/QK' }));
  assert.equal(validPushSubscription({ ...good, endpoint: 'https://evil.example.com/fcm.googleapis.com' }), null);
  assert.equal(validPushSubscription({ ...good, endpoint: 'http://fcm.googleapis.com/x' }), null);
  assert.equal(validPushSubscription({ ...good, keys: { p256dh: 'AAAA', auth } }), null);
  assert.equal(validPushSubscription(null), null);
});
