/**
 * Small, independent Cloudflare Cron Worker for Atlas catalog refreshes.
 *
 * Deploy this worker separately from the Sites/Vinext application. The site
 * secret is configured with `wrangler secret put`, never committed here and
 * never exposed to browser code.
 */
export interface Env {
  ATLAS_SITE_URL: string;
  ATLAS_CATALOG_REFRESH_SECRET: string;
}

const refreshPath = '/api/internal/catalog-refresh';
const encoder = new TextEncoder();

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
  const site = env.ATLAS_SITE_URL.replace(/\/$/, '');
  if (!/^https:\/\//i.test(site)) throw new Error('ATLAS_SITE_URL must use HTTPS.');
  if (!env.ATLAS_CATALOG_REFRESH_SECRET) throw new Error('ATLAS_CATALOG_REFRESH_SECRET is missing.');
  const timestamp = String(Date.now());
  const response = await fetcher(`${site}${refreshPath}`, {
    method: 'POST',
    headers: {
      'x-atlas-refresh-timestamp': timestamp,
      'x-atlas-refresh-signature': await sign(env.ATLAS_CATALOG_REFRESH_SECRET, timestamp),
      accept: 'application/json',
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Atlas catalog refresh failed (${response.status}): ${body.slice(0, 500)}`);
  return body;
}

const worker = {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runRefresh(env));
  },
  async fetch(request: Request) {
    if (new URL(request.url).pathname !== '/health') return new Response('Not found', {status: 404});
    if (request.method !== 'GET') return new Response('Method not allowed', {status: 405});
    return new Response(JSON.stringify({ok: true, service: 'atlas-catalog-refresh'}), {
      headers: {'content-type': 'application/json'},
    });
  },
};

export default worker;
