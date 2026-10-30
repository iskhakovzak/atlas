/**
 * How well Atlas reads each store, from the operator's catalog imports (27 October 2026): read in full, only in part,
 * or not at all, with the last reason. The admin shows it beside the link field, so a batch of links to a store that
 * cannot be read right now is seen before it is pasted. Kept in market_settings ('catalog-store-health').
 */
export type StoreHealthRow = { ok: number; partial: number; failed: number; at: number; reason?: string; averageDurationMs?: number };
export type StoreHealth = Record<string, StoreHealthRow>;
export type StoreReadOutcome = { url: string; result: 'ok' | 'partial' | 'failed'; reason?: string; durationMs?: number };

export const storeHealthKey = 'catalog-store-health';
const maxHosts = 400, window = 50;

export function storeHost(url: string) {
  try { return new URL(url).hostname.toLowerCase().replace(/^(?:www|m)\./, ''); } catch { return ''; }
}

/** Adds a batch's outcomes; old counts fade (each row keeps at most the last `window` reads in proportion). */
export function mergeStoreHealth(previous: StoreHealth, outcomes: StoreReadOutcome[], now: number): StoreHealth {
  const next: StoreHealth = { ...previous };
  for (const outcome of outcomes) {
    const host = storeHost(outcome.url);
    if (!host) continue;
    const row = { ...(next[host] ?? { ok: 0, partial: 0, failed: 0, at: now }) };
    const total = row.ok + row.partial + row.failed;
    if (total >= window) { const scale = (window - 1) / total; row.ok *= scale; row.partial *= scale; row.failed *= scale; }
    row[outcome.result] += 1;
    row.at = now;
    if (typeof outcome.durationMs === 'number' && Number.isFinite(outcome.durationMs) && outcome.durationMs >= 0) {
      const duration = Math.min(outcome.durationMs, 120_000);
      row.averageDurationMs = Math.round(row.averageDurationMs === undefined ? duration : row.averageDurationMs * 0.8 + duration * 0.2);
    }
    if (outcome.result !== 'ok') row.reason = (outcome.reason ?? '').slice(0, 200);
    else delete row.reason;
    next[host] = { ...row, ok: round(row.ok), partial: round(row.partial), failed: round(row.failed) };
  }
  const hosts = Object.keys(next);
  if (hosts.length > maxHosts) for (const host of hosts.sort((a, b) => next[a].at - next[b].at).slice(0, hosts.length - maxHosts)) delete next[host];
  return next;
}
const round = (value: number) => Math.round(value * 100) / 100;

export type StoreReadability = 'reads' | 'partial' | 'fails' | 'unknown';
/** The store's state for the admin: mostly read, often partial, mostly not read, or not tried yet. */
export function storeReadability(row: StoreHealthRow | undefined): StoreReadability {
  if (!row) return 'unknown';
  const total = row.ok + row.partial + row.failed;
  if (!total) return 'unknown';
  if (row.failed / total >= 0.5) return 'fails';
  if (row.ok / total >= 0.6) return 'reads';
  return 'partial';
}
