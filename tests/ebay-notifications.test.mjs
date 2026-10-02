import test, {afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {
  clearEbayNotificationCachesForTests,
  createEbayChallengeResponse,
  derEcdsaToP1363,
  EBAY_NOTIFICATION_ENDPOINT,
  parseEbaySignatureHeader,
  readEbayNotificationBody,
  verifyEbayNotification,
} from '../lib/market/ebay-notifications.ts';

afterEach(() => clearEbayNotificationCachesForTests());

function derInteger(value) {
  let first = 0;
  while (first < value.length - 1 && value[first] === 0) first++;
  let integer = value.slice(first);
  if (integer[0] & 0x80) integer = Uint8Array.from([0, ...integer]);
  return Uint8Array.from([2, integer.length, ...integer]);
}

function rawSignatureToDer(raw) {
  const r = derInteger(raw.slice(0, 32));
  const s = derInteger(raw.slice(32));
  const sequence = Uint8Array.from([...r, ...s]);
  return Uint8Array.from([0x30, sequence.length, ...sequence]);
}

function base64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

async function createSignedHeader(payload, privateKey, kid = 'test-key-1') {
  const raw = new Uint8Array(await crypto.subtle.sign(
    {name: 'ECDSA', hash: 'SHA-1'},
    privateKey,
    new TextEncoder().encode(JSON.stringify(payload)),
  ));
  return base64(new TextEncoder().encode(JSON.stringify({
    alg: 'ECDSA',
    kid,
    signature: base64(rawSignatureToDer(raw)),
    digest: 'SHA1',
  })));
}

test('eBay challenge response hashes challenge, token and the exact registered endpoint in order', async () => {
  const challenge = 'ebay-random-challenge-code';
  const token = 'A'.repeat(48);
  const expected = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${challenge}${token}${EBAY_NOTIFICATION_ENDPOINT}`));
  const hex = Array.from(new Uint8Array(expected), byte => byte.toString(16).padStart(2, '0')).join('');
  assert.equal(await createEbayChallengeResponse(challenge, token), hex);
  await assert.rejects(createEbayChallengeResponse(challenge, 'too-short'));
});

test('eBay notification verifies ECC signature and caches application token and public key', async () => {
  clearEbayNotificationCachesForTests();
  const pair = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const pemBody = base64(spki).match(/.{1,64}/g).join('\n');
  const pem = `-----BEGIN PUBLIC KEY-----\n${pemBody}\n-----END PUBLIC KEY-----`;
  const payload = {metadata: {topic: 'MARKETPLACE_ACCOUNT_DELETION', schemaVersion: '1.0', deprecated: false}, notification: {notificationId: 'notice-1', data: {userId: 'private-id'}}};
  const header = await createSignedHeader(payload, pair.privateKey);
  const decodedHeader = JSON.parse(atob(header));
  assert.equal(decodedHeader.alg, 'ECDSA');
  assert.equal(decodedHeader.digest, 'SHA1');
  assert.equal(decodedHeader.kid, 'test-key-1');
  assert.ok(atob(decodedHeader.signature).length >= 68);
  assert.equal(parseEbaySignatureHeader(header).kid, 'test-key-1');
  assert.equal(derEcdsaToP1363(Uint8Array.from(atob(decodedHeader.signature), value => value.charCodeAt(0))).length, 64);
  const calls = [];
  const fetcher = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({url, init});
    if (url.pathname === '/identity/v1/oauth2/token') return Response.json({access_token: 'test-access-token', expires_in: 3600});
    if (url.pathname === '/commerce/notification/v1/public_key/test-key-1') return Response.json({key: pem});
    throw new Error('Unexpected eBay request.');
  };
  const config = {clientId: 'test-client', clientSecret: 'test-secret'};

  const valid = await verifyEbayNotification(payload, header, config, fetcher);
  assert.deepEqual(calls.map(({url}) => url.pathname), ['/identity/v1/oauth2/token', '/commerce/notification/v1/public_key/test-key-1']);
  assert.equal(valid, true);
  assert.equal(await verifyEbayNotification(payload, header, config, fetcher), true);
  assert.equal(calls.filter(({url}) => url.pathname.endsWith('/oauth2/token')).length, 1);
  assert.equal(calls.filter(({url}) => url.pathname.includes('/public_key/')).length, 1);
  assert.equal(calls.find(({url}) => url.pathname.includes('/public_key/')).init.headers.Authorization, 'Bearer test-access-token');
  assert.equal(await verifyEbayNotification({...payload, notification: {notificationId: 'tampered'}}, header, config, fetcher), false);
});

test('invalid signature encodings are rejected before any eBay request', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; throw new Error('must not fetch'); };
  assert.equal(await verifyEbayNotification({}, 'not-base64', {clientId: 'x', clientSecret: 'y'}, fetcher), false);
  assert.equal(calls, 0);
});

test('notification request body is bounded before JSON parsing', async () => {
  const request = new Request('https://atlasmarket.uz/api/ebay/notifications', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: 'x'.repeat(129),
  });
  await assert.rejects(readEbayNotificationBody(request, 128), RangeError);
});
