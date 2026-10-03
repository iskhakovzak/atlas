import { database } from './server';
import { summarizeVitals, telemetryRetentionMs, type ClientError, type RouteVitals, type VitalSample, type VitalsRow } from './telemetry';

async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * Beacon budget per IP; the IP is only hashed into a short-lived rate-limit key. Mobile carriers
 * put many customers behind one address, so the budget is generous: it only stops floods.
 */
export async function telemetryAllowed(request: Request, max = 300, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const visitor = await digest('telemetry-ip:' + (request.headers.get('cf-connecting-ip')?.trim().slice(0, 80) || 'unknown'));
  const key = `telemetry:${visitor}:${Math.floor(now / windowMs)}`;
  const row = await database().prepare('INSERT INTO market_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key, now + windowMs).first<{ count: number }>();
  return !!row && row.count <= max;
}

/**
 * Repeats of the same open problem raise its counter instead of adding rows, so one broken
 * release cannot flood the operator's monitor. Areas: "client" (script errors), "csp" (policy reports).
 */
export async function recordClientProblem(area: 'client' | 'csp', message: string, details: { route: string; source?: string; line?: number; kind?: string }) {
  const db = database(), now = Date.now();
  const updated = await db.prepare(`UPDATE market_operational_errors SET details=json_set(details,'$.count',coalesce(json_extract(details,'$.count'),1)+1,'$.lastSeen',?,'$.route',?)
    WHERE id=(SELECT id FROM market_operational_errors WHERE area=? AND message=? AND resolved_at IS NULL AND created_at>? AND json_valid(details) ORDER BY created_at DESC LIMIT 1)`)
    .bind(now, details.route, area, message, now - telemetryRetentionMs).run();
  if (updated.meta.changes) return;
  await db.prepare('INSERT INTO market_operational_errors (id,area,message,details,created_at) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(), area, message, JSON.stringify({ ...details, count: 1, lastSeen: now }), now).run();
}

export async function recordClientErrors(errors: ClientError[]) {
  for (const { message, ...details } of errors) await recordClientProblem('client', message, details);
}

export async function recordVitals(sample: VitalSample) {
  await database().prepare('INSERT INTO market_web_vitals (id,route,device,ttfb_ms,fcp_ms,lcp_ms,inp_ms,cls,api_slow,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), sample.route, sample.device, sample.ttfbMs ?? null, sample.fcpMs ?? null, sample.lcpMs ?? null, sample.inpMs ?? null, sample.cls ?? null, sample.apiSlow ?? null, Date.now()).run();
}

/** Drops samples and client reports past the retention window, plus spent telemetry rate-limit keys. */
export async function pruneTelemetry() {
  const db = database(), now = Date.now(), cutoff = now - telemetryRetentionMs;
  await db.batch([
    db.prepare('DELETE FROM market_web_vitals WHERE created_at < ?').bind(cutoff),
    db.prepare("DELETE FROM market_operational_errors WHERE area IN ('client','csp') AND created_at < ?").bind(cutoff),
    db.prepare("DELETE FROM market_rate_limits WHERE key LIKE 'telemetry:%' AND expires_at < ?").bind(now),
  ]);
}

/** p75 page speed per route over the last `days` days, from at most the 5 000 newest samples. */
export async function vitalsSummary(days = 7): Promise<{ since: number; routes: RouteVitals[] }> {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const rows = await database().prepare('SELECT route,device,ttfb_ms,fcp_ms,lcp_ms,inp_ms,cls FROM market_web_vitals WHERE created_at >= ? ORDER BY created_at DESC LIMIT 5000').bind(since).all<VitalsRow>();
  return { since, routes: summarizeVitals(rows.results) };
}
