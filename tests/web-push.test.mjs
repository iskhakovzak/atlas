import test from 'node:test';
import assert from 'node:assert/strict';
import { base64UrlDecode, base64UrlEncode, encryptPushPayload, sendWebPush, vapidAuthorization } from '../lib/market/web-push.ts';

const encoder = new TextEncoder();
async function hmac(key, data) {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, data));
}
const join = (...parts) => { const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let at = 0; for (const part of parts) { out.set(part, at); at += part.length; } return out; };

/** The browser's side of RFC 8291, written from the RFC: decrypts what the sender produced. */
async function decrypt(body, receiver, receiverPublic, authSecret) {
  const salt = body.slice(0, 16), idLength = body[20], senderPublic = body.slice(21, 21 + idLength), cipher = body.slice(21 + idLength);
  const senderKey = await crypto.subtle.importKey('raw', senderPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: senderKey }, receiver.privateKey, 256));
  const ikm = await hmac(await hmac(authSecret, shared), join(encoder.encode('WebPush: info\0'), receiverPublic, senderPublic, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, join(encoder.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, join(encoder.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher));
  assert.equal(plain.at(-1), 2, 'last-record delimiter');
  return new TextDecoder().decode(plain.slice(0, -1));
}

async function browserSubscription() {
  const receiver = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const receiverPublic = new Uint8Array(await crypto.subtle.exportKey('raw', receiver.publicKey));
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  return { receiver, receiverPublic, authSecret, keys: { endpoint: 'https://push.example.test/send/abc', p256dh: base64UrlEncode(receiverPublic), auth: base64UrlEncode(authSecret) } };
}
async function vapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { pair, keys: { publicKey: base64UrlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))), privateKey: jwk.d, subject: 'mailto:support@atlas.test' } };
}

test('a push message encrypted for a subscription decrypts with the browser keys (RFC 8291)', async () => {
  const sub = await browserSubscription();
  const message = JSON.stringify({ title: 'Нужна доплата', body: '79 417 сум', url: '/orders#AT-1' });
  const body = await encryptPushPayload(sub.keys, encoder.encode(message));
  assert.deepEqual([...body.slice(16, 20)], [0, 0, 16, 0], 'record size 4096');
  assert.equal(body[20], 65);
  assert.equal(await decrypt(body, sub.receiver, sub.receiverPublic, sub.authSecret), message);
  // A fresh salt and sender key each time: the same message never repeats on the wire.
  assert.notDeepEqual(await encryptPushPayload(sub.keys, encoder.encode(message)), body);
});

test('the VAPID header is an ES256 token for the push service origin that verifies with the public key', async () => {
  const { pair, keys } = await vapidKeys();
  const now = Date.UTC(2026, 9, 27);
  const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/xyz', keys, now);
  const [, token, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, keys.publicKey);
  const [h, c, s] = token.split('.');
  const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(c)));
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.exp, now / 1000 + 12 * 3600);
  assert.equal(claims.sub, 'mailto:support@atlas.test');
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, base64UrlDecode(s), encoder.encode(`${h}.${c}`)));
});

test('sending reports a dropped subscription (404/410) apart from other failures', async () => {
  const sub = await browserSubscription(), { keys } = await vapidKeys();
  const calls = [];
  const reply = (status) => async (url, init) => { calls.push({ url, init }); return new Response(null, { status }); };
  assert.deepEqual(await sendWebPush(sub.keys, { title: 'x' }, keys, { fetcher: reply(201) }), { ok: true });
  assert.equal(calls[0].init.headers['Content-Encoding'], 'aes128gcm');
  assert.match(calls[0].init.headers.Authorization, /^vapid t=/);
  assert.deepEqual(await sendWebPush(sub.keys, { title: 'x' }, keys, { fetcher: reply(410) }), { ok: false, gone: true, status: 410 });
  assert.deepEqual(await sendWebPush(sub.keys, { title: 'x' }, keys, { fetcher: reply(500) }), { ok: false, gone: false, status: 500 });
});
