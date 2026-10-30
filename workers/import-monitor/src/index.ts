/**
 * Atlas import monitor: a small Cloudflare Cron Worker, deployed apart from the Sites/Vinext site (which has no
 * cron). Every 10 minutes it calls the site's protected /api/internal/import-monitor; the site probes the import
 * gateway, tells the owner in Telegram when it goes down or comes back, and sends the 10:00 summary. The worker
 * knows neither the gateway address nor the Telegram bot: only the site URL and the signing secret it shares with the site.
 */
export interface Env {
  ATLAS_SITE_URL?: string;
  ATLAS_IMPORT_MONITOR_SECRET?: string;
}

export const monitorPath = '/api/internal/import-monitor';
const encoder = new TextEncoder();

function siteOrigin(value: string | undefined) {
  try {
    const url = new URL(value ?? '');
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

async function sign(secret: string, timestamp: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}\nPOST\n${monitorPath}`));
  return [...new Uint8Array(signed)].map(value => value.toString(16).padStart(2, '0')).join('');
}

/** One signed call; the answer (gateway up/down, digest sent) goes to the Worker log. */
export async function runMonitor(env: Env, fetcher: typeof fetch = fetch) {
  const origin = siteOrigin(env.ATLAS_SITE_URL);
  if (!origin) throw new Error('site_url_invalid');
  const secret = env.ATLAS_IMPORT_MONITOR_SECRET?.trim();
  if (!secret) throw new Error('secret_missing');
  const timestamp = String(Date.now());
  const response = await fetcher(`${origin}${monitorPath}`, {
    method: 'POST',
    redirect: 'error',
    headers: {'x-atlas-refresh-timestamp': timestamp, 'x-atlas-refresh-signature': await sign(secret, timestamp), accept: 'application/json'},
  });
  if (!response.ok) throw new Error(`site_rejected_${response.status}`);
  return response.text();
}

const worker = {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runMonitor(env).then(
      body => console.log(JSON.stringify({event: 'atlas_import_monitor', outcome: 'success', body: body.slice(0, 300)})),
      error => console.error(JSON.stringify({event: 'atlas_import_monitor', outcome: 'failure', reason: String((error as Error).message ?? error).slice(0, 200)})),
    ));
  },
  async fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname !== '/health') return new Response('Not found', {status: 404});
    const ok = Boolean(siteOrigin(env.ATLAS_SITE_URL) && env.ATLAS_IMPORT_MONITOR_SECRET?.trim());
    return new Response(JSON.stringify({ok, service: 'atlas-import-monitor'}), {status: ok ? 200 : 503, headers: {'cache-control': 'no-store', 'content-type': 'application/json'}});
  },
};

export default worker;
