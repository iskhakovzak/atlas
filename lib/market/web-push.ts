// Web Push without a library (27 October 2026): the message is encrypted for one browser subscription
// (RFC 8291, "aes128gcm") and signed for the push service with the site's VAPID key (RFC 8292). Only WebCrypto,
// so the same code runs in the Worker and in node:test.

export type PushSubscriptionKeys = { endpoint: string; p256dh: string; auth: string };
/** The site's VAPID pair: the public key as the browser sees it (65-byte point) and the private scalar (32 bytes), base64url. */
export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

const encoder = new TextEncoder();
/** Bytes on an ordinary ArrayBuffer: what WebCrypto and fetch accept. */
type Bytes = Uint8Array<ArrayBuffer>;

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function base64UrlDecode(text: string): Bytes {
  const normal = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normal + '='.repeat((4 - (normal.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
async function hmac(key: Bytes, data: Bytes): Promise<Bytes> {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, data));
}

/** A P-256 public key as a 65-byte uncompressed point: what `PushSubscription.getKey('p256dh')` gives and what VAPID's `k=` carries. */
export function isP256Point(bytes: Uint8Array) { return bytes.length === 65 && bytes[0] === 4; }

function vapidJwk(keys: VapidKeys): JsonWebKey {
  const point = base64UrlDecode(keys.publicKey);
  if (!isP256Point(point)) throw Error('VAPID public key must be a 65-byte P-256 point');
  return { kty: 'EC', crv: 'P-256', x: base64UrlEncode(point.slice(1, 33)), y: base64UrlEncode(point.slice(33, 65)), d: keys.privateKey, ext: true };
}

/** The VAPID `Authorization` header for one push service (the endpoint's origin), valid 12 hours. */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, now = Date.now()): Promise<string> {
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64UrlEncode(encoder.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: keys.subject })));
  const key = await crypto.subtle.importKey('jwk', vapidJwk(keys), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // WebCrypto signs ES256 as raw r‖s (64 bytes): exactly the JWS form.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${base64UrlEncode(signature)}, k=${keys.publicKey}`;
}

/**
 * RFC 8291 encryption of one message for one subscription: a fresh sender key and salt each time, one record
 * (the body stays far under 4 KB). Returns the request body with its aes128gcm header.
 */
export async function encryptPushPayload(subscription: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>, payload: Bytes, salt: Bytes = crypto.getRandomValues(new Uint8Array(16))): Promise<Bytes> {
  const receiverPublic = base64UrlDecode(subscription.p256dh), authSecret = base64UrlDecode(subscription.auth);
  if (!isP256Point(receiverPublic) || authSecret.length < 16) throw Error('Invalid push subscription keys');
  const sender = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', sender.publicKey));
  const receiverKey = await crypto.subtle.importKey('raw', receiverPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, sender.privateKey, 256));
  // HKDF by hand (one block each): the auth secret mixes into the shared secret, then the salt gives the key and nonce.
  const prkKey = await hmac(authSecret, shared);
  const ikm = await hmac(prkKey, concat(encoder.encode('WebPush: info\0'), receiverPublic, senderPublic, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(encoder.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(encoder.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // 0x02: the last (and only) record's padding delimiter.
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const recordSize = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, recordSize, new Uint8Array([senderPublic.length]), senderPublic, cipher);
}

export type PushResult = { ok: true } | { ok: false; gone: boolean; status: number };

/** Sends one message. A 404 or 410 means the browser dropped the subscription: the caller deletes it. */
export async function sendWebPush(subscription: PushSubscriptionKeys, message: unknown, keys: VapidKeys, options: { ttl?: number; urgency?: 'normal' | 'high'; fetcher?: typeof fetch } = {}): Promise<PushResult> {
  const body = await encryptPushPayload(subscription, encoder.encode(JSON.stringify(message)));
  const response = await (options.fetcher ?? fetch)(subscription.endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidAuthorization(subscription.endpoint, keys), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(options.ttl ?? 86400), Urgency: options.urgency ?? 'normal' },
    body,
  });
  if (response.ok) return { ok: true };
  return { ok: false, gone: response.status === 404 || response.status === 410, status: response.status };
}
