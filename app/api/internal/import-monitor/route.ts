import {env} from 'cloudflare:workers';
import {failure, HttpError, json} from '@/lib/market/server';
import {apiErrorMessage, requestLocale} from '@/lib/market/i18n';
import {importMonitorPath, isAuthorizedCatalogRefresh} from '@/lib/market/catalog-refresh-auth';
import {recordGatewayProbe, sendDailyDigest, type GatewayProbe} from '@/lib/market/import-monitor';
import {importMonitorLive, monitorDeps} from '@/lib/market/import-monitor-server';

/** One bare POST to the gateway: it answers 415 (no JSON) when it is up; a tunnel or host that is down gives 5xx or nothing. */
async function probeGateway(): Promise<GatewayProbe> {
  const endpoint = (env as unknown as {ATLAS_TASHKENT_PROXY_URL?: string}).ATLAS_TASHKENT_PROXY_URL?.trim() ?? '';
  if (!endpoint) return {configured: false, status: 0, ms: 0};
  const started = Date.now();
  try {
    const response = await fetch(endpoint, {method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(8000)});
    await response.body?.cancel();
    return {configured: true, status: response.status, ms: Date.now() - started};
  } catch {
    return {configured: true, status: 0, ms: Date.now() - started};
  }
}

/**
 * Called every 10 minutes by workers/import-monitor, signed with its own ATLAS_IMPORT_MONITOR_SECRET
 * (the same scheme as the catalog refresh, bound to this path).
 * Checks the gateway (🔴 at once / 🟢 when back) and sends the 10:00 Tashkent summary once a day.
 */
export async function POST(request: Request) {
  try {
    if (!await isAuthorizedCatalogRefresh(request, (env as unknown as {ATLAS_IMPORT_MONITOR_SECRET?: string}).ATLAS_IMPORT_MONITOR_SECRET, Date.now(), importMonitorPath)) throw new HttpError(401, 'Недопустимый запрос мониторинга.');
    if (!importMonitorLive(request)) return json({ok: true, live: false});
    const deps = monitorDeps();
    const probe = await probeGateway();
    const gateway = await recordGatewayProbe(deps, probe);
    const digest = await sendDailyDigest(deps);
    return json({ok: true, live: true, gateway, status: probe.status, digest});
  } catch (error) {
    return failure(error, request);
  }
}

export async function GET(request: Request) {
  const locale = requestLocale(request);
  return json({error: locale === 'ru' ? 'Используйте защищённый POST-запрос.' : apiErrorMessage(405, locale)}, 405);
}
