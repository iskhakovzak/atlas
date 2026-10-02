const EBAY_API_ORIGIN = 'https://api.ebay.com';
const EBAY_API_SCOPE = 'https://api.ebay.com/oauth/api_scope';
const MAX_NOTIFICATION_BYTES = 64_000;
const MAX_SIGNATURE_HEADER_CHARS = 8_192;
const PUBLIC_KEY_TTL_MS = 60 * 60 * 1_000;
const MAX_CACHED_PUBLIC_KEYS = 64;

export const EBAY_NOTIFICATION_ENDPOINT = 'https://atlasmarket.uz/api/ebay/notifications';

const verificationTokenPattern = /^[A-Za-z0-9_-]{32,80}$/;

type EbayNotificationConfig = {
  clientId?: string;
  clientSecret?: string;
  verificationToken?: string;
};

type EbaySignature = {
  alg: string;
  digest: string;
  kid: string;
  signature: string;
};

type CachedToken = {clientId: string; token: string; expiresAt: number};
type CachedPublicKey = {pem: string; expiresAt: number};

let cachedToken: CachedToken | undefined;
const publicKeyCache = new Map<string, CachedPublicKey>();

export class EbayNotificationVerificationError extends Error {
  constructor(message = 'eBay notification verification is temporarily unavailable.') {
    super(message);
    this.name = 'EbayNotificationVerificationError';
  }
}

export async function createEbayChallengeResponse(challengeCode: string, token: string) {
  if (!challengeCode || challengeCode.length > 2_048 || !verificationTokenPattern.test(token)) {
    throw new Error('Invalid eBay notification challenge configuration.');
  }
  const bytes = new TextEncoder().encode(`${challengeCode}${token}${EBAY_NOTIFICATION_ENDPOINT}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function readEbayNotificationBody(request: Request, limit = MAX_NOTIFICATION_BYTES) {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > limit) throw new RangeError('Notification body too large.');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RangeError('Notification body too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
}

function decodeBase64(value: string) {
  if (!value || value.length > MAX_SIGNATURE_HEADER_CHARS || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) {
    throw new Error('Invalid eBay signature encoding.');
  }
  const standard = value.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const padded = standard + '='.repeat((4 - standard.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

export function parseEbaySignatureHeader(value: string): EbaySignature {
  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(decodeBase64(value)));
  } catch {
    throw new Error('Invalid eBay signature header.');
  }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('Invalid eBay signature header.');
  const signature = decoded as Record<string, unknown>;
  const alg = typeof signature.alg === 'string' ? signature.alg.toLowerCase() : '';
  const digest = typeof signature.digest === 'string' ? signature.digest.toUpperCase().replace('-', '') : '';
  const kid = typeof signature.kid === 'string' ? signature.kid : '';
  const signatureValue = typeof signature.signature === 'string' ? signature.signature : '';
  if (alg !== 'ecdsa' || !['SHA1', 'SHA256'].includes(digest) || !/^[A-Za-z0-9_.:-]{1,160}$/.test(kid) || !signatureValue) {
    throw new Error('Unsupported eBay signature header.');
  }
  return {alg, digest, kid, signature: signatureValue};
}

export function derEcdsaToP1363(der: Uint8Array) {
  let offset = 0;
  const readLength = () => {
    const first = der[offset++];
    if (first === undefined) throw new Error('Invalid ECDSA signature.');
    if (first < 0x80) return first;
    const count = first & 0x7f;
    if (count < 1 || count > 2 || offset + count > der.length) throw new Error('Invalid ECDSA signature.');
    let length = 0;
    for (let i = 0; i < count; i++) length = length * 256 + der[offset++];
    if (length < 0x80) throw new Error('Invalid ECDSA signature.');
    return length;
  };
  if (der[offset++] !== 0x30) throw new Error('Invalid ECDSA signature.');
  const sequenceLength = readLength();
  if (offset + sequenceLength !== der.length) throw new Error('Invalid ECDSA signature.');
  const readInteger = () => {
    if (der[offset++] !== 0x02) throw new Error('Invalid ECDSA signature.');
    const length = readLength();
    if (length < 1 || offset + length > der.length) throw new Error('Invalid ECDSA signature.');
    let integer = der.slice(offset, offset + length);
    offset += length;
    if ((integer[0] & 0x80) !== 0) throw new Error('Invalid ECDSA signature.');
    while (integer.length > 1 && integer[0] === 0) integer = integer.slice(1);
    if (integer.length > 32) throw new Error('Invalid ECDSA signature.');
    const component = new Uint8Array(32);
    component.set(integer, 32 - integer.length);
    return component;
  };
  const r = readInteger();
  const s = readInteger();
  if (offset !== der.length) throw new Error('Invalid ECDSA signature.');
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

function pemToDer(pem: string) {
  const match = pem.match(/^-----BEGIN PUBLIC KEY-----([A-Za-z0-9+/=\r\n]+)-----END PUBLIC KEY-----$/);
  if (!match) throw new EbayNotificationVerificationError();
  try {
    const binary = atob(match[1].replace(/\s+/g, ''));
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch {
    throw new EbayNotificationVerificationError();
  }
}

async function readJsonResponse(response: Response, maxBytes = 16_000) {
  if (!response.ok || !/application\/json/i.test(response.headers.get('content-type') ?? '')) {
    await response.body?.cancel();
    throw new EbayNotificationVerificationError();
  }
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) {
    await response.body?.cancel();
    throw new EbayNotificationVerificationError();
  }
  const reader = response.body?.getReader();
  if (!reader) throw new EbayNotificationVerificationError();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new EbayNotificationVerificationError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)) as Record<string, unknown>;
  } catch {
    throw new EbayNotificationVerificationError();
  }
}

async function ebayApplicationToken(config: EbayNotificationConfig, fetcher: typeof fetch, now: number) {
  const clientId = config.clientId?.trim();
  const clientSecret = config.clientSecret;
  if (!clientId || !clientSecret) throw new EbayNotificationVerificationError();
  if (cachedToken?.clientId === clientId && cachedToken.expiresAt > now + 60_000) return cachedToken.token;

  let response: Response;
  try {
    response = await fetcher(`${EBAY_API_ORIGIN}/identity/v1/oauth2/token`, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(5_000),
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({grant_type: 'client_credentials', scope: EBAY_API_SCOPE}),
    });
  } catch {
    throw new EbayNotificationVerificationError();
  }
  const payload = await readJsonResponse(response, 32_000);
  const token = typeof payload.access_token === 'string' ? payload.access_token : '';
  const lifetime = typeof payload.expires_in === 'number' ? payload.expires_in : 0;
  if (!token || lifetime < 120) throw new EbayNotificationVerificationError();
  cachedToken = {clientId, token, expiresAt: now + Math.min(lifetime, 86_400) * 1_000};
  return token;
}

async function ebayPublicKey(kid: string, config: EbayNotificationConfig, fetcher: typeof fetch, now: number) {
  const cached = publicKeyCache.get(kid);
  if (cached && cached.expiresAt > now) return cached.pem;
  const token = await ebayApplicationToken(config, fetcher, now);
  let response: Response;
  try {
    response = await fetcher(`${EBAY_API_ORIGIN}/commerce/notification/v1/public_key/${encodeURIComponent(kid)}`, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(5_000),
      headers: {Authorization: `Bearer ${token}`, Accept: 'application/json'},
    });
  } catch {
    throw new EbayNotificationVerificationError();
  }
  const payload = await readJsonResponse(response);
  const pem = typeof payload.key === 'string' ? payload.key : '';
  if (!pem) throw new EbayNotificationVerificationError();
  publicKeyCache.set(kid, {pem, expiresAt: now + PUBLIC_KEY_TTL_MS});
  if (publicKeyCache.size > MAX_CACHED_PUBLIC_KEYS) {
    const oldest = publicKeyCache.keys().next().value;
    if (oldest) publicKeyCache.delete(oldest);
  }
  return pem;
}

export async function verifyEbayNotification(payload: unknown, signatureHeader: string, config: EbayNotificationConfig, fetcher: typeof fetch = fetch, now = Date.now()) {
  let signature: EbaySignature;
  try {
    signature = parseEbaySignatureHeader(signatureHeader);
  } catch {
    return false;
  }
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = derEcdsaToP1363(decodeBase64(signature.signature));
  } catch {
    return false;
  }
  const pem = await ebayPublicKey(signature.kid, config, fetcher, now);
  try {
    const publicKey = await crypto.subtle.importKey('spki', pemToDer(pem), {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
    const hash = signature.digest === 'SHA1' ? 'SHA-1' : 'SHA-256';
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    return await crypto.subtle.verify({name: 'ECDSA', hash}, publicKey, signatureBytes, bytes);
  } catch {
    return false;
  }
}

export function clearEbayNotificationCachesForTests() {
  cachedToken = undefined;
  publicKeyCache.clear();
}
