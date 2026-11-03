// Timing of every /api/* route handler, kept in this server process's memory only (3 November 2026): no database write per
// request. Each route file's exported GET/POST/… is wrapped at build time (build/api-timing-plugin.ts) with its file
// pattern (`/api/import`, never a raw URL with ids or a query). Admin → Система reads the summary through
// GET /api/operations?system=1 (system.manage, checked on the server like the rest of the section).
//
// Per route+method: minute buckets give an exact count, 5xx count and maximum over the window; a ring of the latest
// samples gives p50/p95 (nearest rank). Recording is O(1); sorting happens only when the operator opens the summary.
// On the VPS that is the one Node process since its last start; on a Worker it is one isolate.

export type ApiRouteTiming = {
  route: string;
  method: string;
  /** Requests in the window (exact). */
  count: number;
  /** Responses with status ≥ 500 or a thrown handler (exact). */
  errors: number;
  p50: number;
  p95: number;
  max: number;
  /** Samples the percentiles were taken from (fewer than `count` when the ring was overrun). */
  sampled: number;
};
export type ApiTimingSummary = { since: number; windowMs: number; routes: ApiRouteTiming[] };

type Bucket = { minute: number; count: number; errors: number; max: number };
type Series = { route: string; method: string; durations: Float64Array; at: Float64Array; next: number; size: number; buckets: Bucket[] };

export type ApiTimingOptions = { windowMs?: number; bucketMs?: number; samples?: number; maxSeries?: number; now?: number };

export function createApiTimings(options: ApiTimingOptions = {}) {
  const bucketMs = options.bucketMs ?? 60_000;
  const windowMs = options.windowMs ?? 60 * 60_000;
  const bucketCount = Math.max(1, Math.ceil(windowMs / bucketMs));
  const samples = options.samples ?? 512;
  const maxSeries = options.maxSeries ?? 200;
  const since = options.now ?? Date.now();
  const series = new Map<string, Series>();

  function record(method: string, route: string, ms: number, status: number, now = Date.now()) {
    if (!Number.isFinite(ms) || ms < 0) return;
    const key = method + " " + route;
    let entry = series.get(key);
    if (!entry) {
      // Patterns come from route files, so the set is small; the cap only guards against a wrapper misuse.
      if (series.size >= maxSeries) return;
      entry = { route, method, durations: new Float64Array(samples), at: new Float64Array(samples), next: 0, size: 0, buckets: [] };
      series.set(key, entry);
    }
    entry.durations[entry.next] = ms;
    entry.at[entry.next] = now;
    entry.next = (entry.next + 1) % samples;
    if (entry.size < samples) entry.size++;
    const minute = Math.floor(now / bucketMs), slot = minute % bucketCount;
    let bucket = entry.buckets[slot];
    if (!bucket || bucket.minute !== minute) bucket = entry.buckets[slot] = { minute, count: 0, errors: 0, max: 0 };
    bucket.count++;
    if (status >= 500) bucket.errors++;
    if (ms > bucket.max) bucket.max = ms;
  }

  function summary(now = Date.now()): ApiTimingSummary {
    const firstMinute = Math.floor(now / bucketMs) - bucketCount + 1, cutoff = now - windowMs;
    const routes: ApiRouteTiming[] = [];
    for (const entry of series.values()) {
      let count = 0, errors = 0, max = 0;
      for (const bucket of entry.buckets) {
        if (!bucket || bucket.minute < firstMinute) continue;
        count += bucket.count; errors += bucket.errors; if (bucket.max > max) max = bucket.max;
      }
      if (!count) continue;
      const recent: number[] = [];
      for (let index = 0; index < entry.size; index++) if (entry.at[index] >= cutoff) recent.push(entry.durations[index]);
      recent.sort((a, b) => a - b);
      routes.push({ route: entry.route, method: entry.method, count, errors, p50: percentile(recent, 0.5), p95: percentile(recent, 0.95), max: round(max), sampled: recent.length });
    }
    routes.sort((a, b) => b.p95 - a.p95 || b.count - a.count || a.route.localeCompare(b.route));
    return { since, windowMs, routes };
  }

  return { record, summary };
}

/** Nearest-rank percentile of an ascending list, rounded to 0.1 ms. */
export function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  return round(sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]);
}
const round = (ms: number) => Math.round(ms * 10) / 10;

// One aggregator per process, shared by every module instance (the dev server can load this file more than once).
const globalKey = "__atlasApiTimings";
type ApiTimings = ReturnType<typeof createApiTimings>;
export function apiTimings(): ApiTimings {
  const scope = globalThis as unknown as Record<string, ApiTimings | undefined>;
  return (scope[globalKey] ??= createApiTimings());
}
export const apiTimingSummary = (now?: number) => apiTimings().summary(now);

// redirect() and notFound() leave a handler by throwing; they are answers, not server errors.
function thrownStatus(error: unknown) {
  const digest = typeof (error as { digest?: unknown })?.digest === "string" ? (error as { digest: string }).digest : "";
  if (digest.startsWith("NEXT_REDIRECT")) return 307;
  const fallback = /^NEXT_HTTP_ERROR_FALLBACK;(\d{3})$/.exec(digest);
  if (fallback) return Number(fallback[1]);
  return digest === "NEXT_NOT_FOUND" ? 404 : 500;
}

/** Wraps one exported route handler: time until it returns its Response (a streamed body is not included). */
export function timeRouteHandler<A extends unknown[], R>(route: string, method: string, handler: (...args: A) => R | Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A) => {
    const started = performance.now();
    let status = 500;
    try {
      const response = await handler(...args);
      status = response instanceof Response ? response.status : 200;
      return response;
    } catch (error) {
      status = thrownStatus(error);
      throw error;
    } finally {
      try { apiTimings().record(method, route, performance.now() - started, status); } catch { /* timing never breaks a request */ }
    }
  };
}
