const encoder = new TextEncoder();
const maxResponseBytes = 6_000_000;
const allowedRequestHeaders = new Set([
  'accept', 'accept-language', 'anti-csrftoken-a2z', 'cache-control', 'content-type',
  'cookie', 'origin', 'referer', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
  'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site', 'user-agent', 'x-requested-with',
]);

function hex(bytes) {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function validateEndpoint(value) {
  const endpoint = new URL(value);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.port ||
      endpoint.search || endpoint.hash || endpoint.pathname !== '/v1/fetch' ||
      /^\d+(?:\.\d+){3}$/.test(endpoint.hostname) || endpoint.hostname === 'localhost') {
    throw new Error('Importer proxy endpoint must be a public HTTPS /v1/fetch URL.');
  }
  return endpoint.href;
}

function requestBody(value) {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof URLSearchParams) return value.toString();
  throw new TypeError('Importer proxy accepts only bounded text request bodies.');
}

function base64Bytes(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(maxResponseBytes / 3) * 4 + 8) {
    throw new Error('Invalid importer proxy response size.');
  }
  const binary = atob(value);
  if (binary.length > maxResponseBytes) throw new Error('Importer proxy response exceeds the size limit.');
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

const engines = new Set(['auto', 'fetch', 'impersonate', 'browser']);

/**
 * Creates the signed merchant-request transport used by the Site Worker.
 * `engine: 'auto'` lets the proxy retry a walled answer with a Chrome TLS
 * fingerprint and, on the Tashkent gateway, in its own desktop Chrome; the
 * engine that answered comes back as `x-atlas-engine`.
 */
export function createMerchantProxyFetch({endpoint, secret, engine = 'auto', fetchImpl = fetch, now = Date.now, nonce = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}}) {
  const proxyEndpoint = validateEndpoint(endpoint);
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Importer proxy secret is invalid.');
  if (!engines.has(engine)) throw new Error('Unknown importer proxy engine.');
  const key = crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);

  return async (input, init = {}) => {
    const target = new URL(input instanceof URL ? input.href : String(input));
    if (target.protocol !== 'https:' || target.username || target.password || target.port || target.hash ||
        /^\d+(?:\.\d+){3}$/.test(target.hostname) || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(target.hostname)) {
      throw new Error('Unsafe importer target URL.');
    }
    const method = String(init.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'POST') throw new Error('Unsupported importer request method.');
    const headers = {};
    for (const [name, value] of new Headers(init.headers)) {
      const keyName = name.toLowerCase();
      if (allowedRequestHeaders.has(keyName)) headers[keyName] = value;
    }
    const body = requestBody(init.body);
    if (body && body.length > 16_384) throw new Error('Importer request body exceeds the size limit.');
    if (method === 'GET' && body !== undefined) throw new Error('GET importer requests cannot contain a body.');
    // The route's own limit for this attempt (route-ladder.ts). A proxy that predates it ignores the field.
    const deadlineMs = Number.isInteger(init.deadlineMs) && init.deadlineMs >= 1_000 && init.deadlineMs <= 30_000 ? init.deadlineMs : undefined;
    const payload = JSON.stringify({version: 1, url: target.href, method, headers, engine, ...(body !== undefined ? {body} : {}), ...(deadlineMs !== undefined ? {deadlineMs} : {})});
    const timestamp = String(now());
    const requestNonce = nonce();
    if (!/^\d{13}$/.test(timestamp) || !/^[a-f0-9]{32}$/i.test(requestNonce)) throw new Error('Invalid importer proxy request metadata.');
    const signature = hex(await crypto.subtle.sign('HMAC', await key, encoder.encode(`${timestamp}\n${requestNonce}\n${payload}`)));
    const response = await fetchImpl(proxyEndpoint, {
      method: 'POST',
      redirect: 'manual',
      signal: init.signal,
      headers: {
        'content-type': 'application/json',
        'x-atlas-proxy-timestamp': timestamp,
        'x-atlas-proxy-nonce': requestNonce,
        'x-atlas-proxy-signature': signature,
      },
      body: payload,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Importer proxy rejected the request (${response.status}).`);
    }
    const result = await response.json();
    if (!result || result.version !== 1 || !Number.isInteger(result.status) || result.status < 200 || result.status > 599 ||
        !result.headers || typeof result.headers !== 'object' || typeof result.body !== 'string') {
      throw new Error('Malformed importer proxy response.');
    }
    const responseHeaders = new Headers();
    if (typeof result.headers.contentType === 'string' && result.headers.contentType.length <= 256) responseHeaders.set('content-type', result.headers.contentType);
    if (typeof result.headers.location === 'string' && result.headers.location.length <= 4096) responseHeaders.set('location', result.headers.location);
    if (typeof result.engine === 'string' && /^[a-z]{1,20}$/.test(result.engine)) responseHeaders.set('x-atlas-engine', result.engine);
    if (Array.isArray(result.attempts)) {
      const attempts = result.attempts.slice(0, 4).filter(value => typeof value === 'string' && /^[a-z0-9:-]{1,40}$/.test(value));
      if (attempts.length) responseHeaders.set('x-atlas-attempts', attempts.join(' '));
    }
    if (Array.isArray(result.headers.setCookie)) {
      for (const cookie of result.headers.setCookie.slice(0, 20)) {
        if (typeof cookie === 'string' && cookie.length <= 4096 && !/[\r\n]/.test(cookie)) responseHeaders.append('set-cookie', cookie);
      }
    }
    const bytes = base64Bytes(result.body);
    return new Response(bytes.length && result.status !== 204 && result.status !== 304 ? bytes : null, {
      status: result.status,
      headers: responseHeaders,
    });
  };
}
