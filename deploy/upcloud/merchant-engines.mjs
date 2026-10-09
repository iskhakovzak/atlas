/**
 * Merchant request engines for the egress proxy.
 *
 * `fetch` is Node's own client. `impersonate` sends the same request with a
 * real Chrome TLS/HTTP2 fingerprint (the optional `impit` package); several bot
 * walls answer 403 to Node's fingerprint but serve the page to Chrome's. In
 * `auto` mode the proxy tries the engine that last worked for the host first and
 * moves on only when the answer is a wall. No engine solves a CAPTCHA: a page
 * that still asks for one is returned as-is and the importer falls back to
 * manual entry.
 */

const maxResponseBytes = 6_000_000;
const preferenceTtlMs = 6 * 60 * 60 * 1000;
export const engineNames = ['fetch', 'impersonate'];
// The importer's Chrome identity would contradict the impersonated TLS fingerprint.
const impersonatedHeaders = new Set(['user-agent', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform']);

// Akamai's sensor-only interstitial: HTTP 200, a few KB, its challenge container or one obfuscated
// same-site script (`/a/b/c/d?v=<uuid>`) and no product. Real product pages are far larger.
const akamaiInterstitial = /sec-if-cpt|_sec\/cp_challenge|sec-container|<script\b[^>]*\bsrc=["']\/(?:[\w-]+\/){3,}[\w-]+\?v=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}["']/i;

export async function readUpstream(response, limit = maxResponseBytes) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw Object.assign(new Error('response_limit'), {status: 502}); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}

/**
 * Names the wall a merchant answered with, or `undefined` for a usable answer.
 * Coarse on purpose: the Site importer runs its own, stricter checks afterwards.
 */
export function blockedSignal(status, location, contentType, bytes) {
  if ([401, 403, 407, 418, 429].includes(status)) return `http-${status}`;
  if (status >= 300 && status < 400) {
    try { if (/\/(?:blocked|captcha|challenge|denied|access-denied)\b/i.test(new URL(location ?? '', 'https://merchant.invalid/').pathname)) return 'redirect-wall'; } catch { /* a malformed Location is the importer's to reject */ }
    return undefined;
  }
  if (!/html/i.test(contentType ?? '')) return undefined;
  const head = bytes.subarray(0, 120_000).toString('utf8');
  if (/"@type"\s*:\s*"Product"/i.test(head)) return undefined;
  if (/bm-verify|_sec\/verify|ak_bmsc_challenge|<title>\s*Access Denied\s*<\/title>/i.test(head)) return 'akamai';
  if (bytes.length < 12_000 && akamaiInterstitial.test(head)) return 'akamai';
  if (/px-captcha|_pxhd|window\._pxUuid|PerimeterX/i.test(head)) return 'perimeterx';
  if (/cf-chl|cf_chl_opt|<title>\s*Just a moment/i.test(head)) return 'cloudflare';
  if (/geo\.captcha-delivery\.com|dd\.captcha|datadome/i.test(head)) return 'datadome';
  const visible = head.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ');
  if (/verify (?:that )?you are (?:a )?human|pardon our interruption|robot check|press (?:and|&) hold/i.test(visible)) return 'captcha';
  return undefined;
}

/** Remembers, per host, the engine whose last answer was not a wall. In memory only. */
export function createEnginePlanner(available, now = Date.now) {
  const preferred = new Map();
  return {
    order(host) {
      const remembered = preferred.get(host);
      if (remembered && remembered.until > now() && available.includes(remembered.engine)) return [remembered.engine, ...available.filter(name => name !== remembered.engine)];
      return [...available];
    },
    succeeded(host, engine) {
      if (preferred.size > 2000) preferred.clear();
      preferred.set(host, {engine, until: now() + preferenceTtlMs});
    },
  };
}

/** Loads the optional Chrome-fingerprint client; the proxy keeps working without it. */
export async function loadImpersonator() {
  let Impit;
  try { ({Impit} = await import('impit')); } catch { return undefined; }
  const client = new Impit({browser: 'chrome', followRedirects: false});
  return (target, {method, headers, body, signal}) => client.fetch(target.href, {
    method,
    headers: Object.fromEntries(Object.entries(headers).filter(([name]) => !impersonatedHeaders.has(name))),
    redirect: 'manual',
    signal,
    ...(body !== undefined ? {body} : {}),
  });
}

/**
 * A fetch-compatible function running the engines in-process, for local merchant
 * checks (`npm run importer:check -- --engines`) without the VM. Egress is this
 * machine's own address, not the New York proxy.
 */
export async function createLocalEngineFetch({mode = 'auto'} = {}) {
  const impersonator = await loadImpersonator();
  const engines = {fetch, ...(impersonator ? {impersonate: impersonator} : {})};
  const planner = createEnginePlanner(engineNames.filter(name => engines[name]));
  return async (input, init = {}) => {
    const target = new URL(input instanceof URL ? input.href : String(input));
    const headers = Object.fromEntries([...new Headers(init.headers)].map(([name, value]) => [name.toLowerCase(), value]));
    const method = String(init.method ?? 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? init.body : init.body instanceof URLSearchParams ? init.body.toString() : undefined;
    const result = await fetchWithEngines({target, method, headers, body, mode, engines, planner, signal: init.signal ?? undefined});
    const responseHeaders = new Headers({'x-atlas-engine': result.engine, 'x-atlas-attempts': result.attempts.join(' ')});
    if (result.contentType) responseHeaders.set('content-type', result.contentType);
    if (result.location) responseHeaders.set('location', result.location);
    for (const cookie of result.setCookie) responseHeaders.append('set-cookie', cookie);
    return new Response(result.bytes.length && result.status !== 204 && result.status !== 304 ? result.bytes : null, {status: result.status, headers: responseHeaders});
  };
}

/**
 * One merchant request through the planned engines, inside a single deadline.
 * Cookies and POSTs (the Amazon delivery-location flow) stay on the engine they
 * were built for; only anonymous GETs escalate.
 */
export async function fetchWithEngines({target, method, headers, body, mode, engines, planner, signal, deadlineMs = 13_000, clock = Date.now}) {
  const available = engineNames.filter(name => engines[name]);
  const escalates = mode === 'auto' && method === 'GET' && !headers.cookie;
  const plan = mode === 'auto' ? (escalates ? planner.order(target.hostname) : ['fetch']) : [mode];
  if (!plan.length || plan.some(name => !available.includes(name))) throw Object.assign(new Error('engine_unavailable'), {status: 400});
  const deadline = clock() + deadlineMs, attempts = [];
  let result, failure;
  for (const [index, engine] of plan.entries()) {
    const remaining = deadline - clock();
    if (signal?.aborted || attempts.length && remaining < 1500) break;
    // A merchant that stalls one engine (Best Buy holds Node's connection open) must not starve the next.
    const budget = index < plan.length - 1 ? Math.min(remaining, Math.round(deadlineMs * 0.6)) : remaining;
    const timeout = AbortSignal.timeout(Math.max(budget, 1000));
    try {
      const upstream = await engines[engine](target, {method, headers, body, redirect: 'manual', signal: signal ? AbortSignal.any([signal, timeout]) : timeout});
      const bytes = await readUpstream(upstream);
      const contentType = upstream.headers.get('content-type') ?? undefined;
      const location = upstream.headers.get('location') ?? undefined;
      const wall = blockedSignal(upstream.status, location, contentType, bytes);
      const setCookie = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [];
      result = {engine, status: upstream.status, contentType, location, setCookie, bytes};
      attempts.push(`${engine}:${upstream.status}${wall ? ':' + wall : ''}`);
      if (!wall) { if (escalates) planner.succeeded(target.hostname, engine); break; }
    } catch (error) {
      failure = error;
      attempts.push(`${engine}:${error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'error'}`);
    }
  }
  if (!result) throw failure ?? new Error('no_engine_answered');
  return {...result, attempts};
}
