/**
 * Small, independent Cloudflare Cron Worker for Atlas catalog refreshes.
 *
 * Deploy this worker separately from the Sites/Vinext application. The site
 * secret is configured with `wrangler secret put`, never committed here and
 * never exposed to browser code.
 */
export interface Env {
  ATLAS_SITE_URL?: string;
  ATLAS_CATALOG_REFRESH_SECRET?: string;
}

const refreshPath = '/api/internal/catalog-refresh';
const encoder = new TextEncoder();

type RefreshReasonCode =
  | 'site_url_missing'
  | 'site_url_invalid'
  | 'site_url_https_required'
  | 'site_url_origin_required'
  | 'refresh_secret_missing'
  | 'upstream_unreachable'
  | 'upstream_rejected'
  | 'unexpected_failure';

type SiteOriginResult = {valid: true; origin: string} | {valid: false; reasonCode: RefreshReasonCode};

export interface CatalogRefreshReadiness {
  configured: boolean;
  siteUrlConfigured: boolean;
  httpsOriginValid: boolean;
  refreshSecretConfigured: boolean;
  reasonCodes: RefreshReasonCode[];
}

class CatalogRefreshError extends Error {
  readonly reasonCode: RefreshReasonCode;
  readonly status?: number;

  constructor(reasonCode: RefreshReasonCode, status?: number) {
    super(reasonCode);
    this.name = 'CatalogRefreshError';
    this.reasonCode = reasonCode;
    this.status = status;
  }
}

function validateSiteOrigin(value: string | undefined): SiteOriginResult {
  if (typeof value !== 'string' || !value.trim()) return {valid: false, reasonCode: 'site_url_missing'};
  if (value !== value.trim()) return {valid: false, reasonCode: 'site_url_invalid'};

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {valid: false, reasonCode: 'site_url_invalid'};
  }

  if (parsed.protocol !== 'https:') return {valid: false, reasonCode: 'site_url_https_required'};
  if (
    parsed.username || parsed.password || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash
  ) return {valid: false, reasonCode: 'site_url_origin_required'};

  return {valid: true, origin: parsed.origin};
}

export function getCatalogRefreshReadiness(env: Env): CatalogRefreshReadiness {
  const site = validateSiteOrigin(env.ATLAS_SITE_URL);
  const siteUrlConfigured = typeof env.ATLAS_SITE_URL === 'string' && env.ATLAS_SITE_URL.trim().length > 0;
  const refreshSecretConfigured = typeof env.ATLAS_CATALOG_REFRESH_SECRET === 'string'
    && env.ATLAS_CATALOG_REFRESH_SECRET.trim().length > 0;
  const reasonCodes: RefreshReasonCode[] = [];

  if (!site.valid) reasonCodes.push(site.reasonCode);
  if (!refreshSecretConfigured) reasonCodes.push('refresh_secret_missing');

  return {
    configured: reasonCodes.length === 0,
    siteUrlConfigured,
    httpsOriginValid: site.valid,
    refreshSecretConfigured,
    reasonCodes,
  };
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function sign(secret: string, timestamp: string) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}\nPOST\n${refreshPath}`)));
}

export async function runRefresh(env: Env, fetcher: typeof fetch = fetch) {
  const site = validateSiteOrigin(env.ATLAS_SITE_URL);
  if (!site.valid) throw new CatalogRefreshError(site.reasonCode);
  if (typeof env.ATLAS_CATALOG_REFRESH_SECRET !== 'string' || !env.ATLAS_CATALOG_REFRESH_SECRET.trim()) {
    throw new CatalogRefreshError('refresh_secret_missing');
  }

  const timestamp = String(Date.now());
  let response: Response;
  try {
    response = await fetcher(`${site.origin}${refreshPath}`, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'x-atlas-refresh-timestamp': timestamp,
        'x-atlas-refresh-signature': await sign(env.ATLAS_CATALOG_REFRESH_SECRET, timestamp),
        accept: 'application/json',
      },
    });
  } catch {
    throw new CatalogRefreshError('upstream_unreachable');
  }

  if (!response.ok) throw new CatalogRefreshError('upstream_rejected', response.status);
  const body = await response.text();
  return body;
}

async function scheduleRefresh(env: Env, ctx: ExecutionContext) {
  const startedAt = Date.now();
  ctx.waitUntil((async () => {
    try {
      await runRefresh(env);
      console.log(JSON.stringify({
        event: 'atlas_catalog_refresh',
        outcome: 'success',
        durationMs: Math.max(0, Date.now() - startedAt),
      }));
    } catch (error) {
      const knownFailure = error instanceof CatalogRefreshError ? error : undefined;
      console.error(JSON.stringify({
        event: 'atlas_catalog_refresh',
        outcome: 'failure',
        reasonCode: knownFailure?.reasonCode ?? 'unexpected_failure',
        ...(knownFailure?.status ? {status: knownFailure.status} : {}),
        durationMs: Math.max(0, Date.now() - startedAt),
      }));
    }
  })());
}

const worker = {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    await scheduleRefresh(env, ctx);
  },
  async fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname !== '/health') return new Response('Not found', {status: 404});
    if (request.method !== 'GET') return new Response('Method not allowed', {status: 405});
    const readiness = getCatalogRefreshReadiness(env);
    return new Response(JSON.stringify({
      ok: readiness.configured,
      service: 'atlas-catalog-refresh',
      readiness,
    }), {
      status: readiness.configured ? 200 : 503,
      headers: {'cache-control': 'no-store', 'content-type': 'application/json'},
    });
  },
};

export default worker;
