export const performanceStorageKey = 'atlas:performance:v1';
export const performanceUpdateEvent = 'atlas:performance-updated';

export type PerformanceRoute = 'catalog' | 'account' | 'orders' | 'admin' | 'other';
export type PerformanceSample = {
  id: string; capturedAt: number; route: PerformanceRoute;
  ttfbMs?: number; fcpMs?: number; lcpMs?: number; inpMs?: number; cls?: number;
  apiCount?: number; apiSlowCount?: number; apiTotalMs?: number; apiMaxMs?: number;
};
export type PerformanceSummary = {
  sampleCount: number; ttfbMs?: number; fcpMs?: number; lcpMs?: number; inpMs?: number; cls?: number;
  apiCount: number; apiSlowCount: number; apiAverageMs?: number; apiMaxMs?: number;
};

const routes = new Set<PerformanceRoute>(['catalog', 'account', 'orders', 'admin', 'other']);
const maxSampleAge = 60 * 60 * 1000;

export function performanceRoute(pathname: string): PerformanceRoute {
  if (pathname === '/' || pathname === '/customs' || pathname === '/legal') return 'catalog';
  if (pathname === '/account' || pathname === '/identity') return 'account';
  if (pathname === '/orders' || pathname === '/operations' || pathname === '/notifications') return 'orders';
  if (pathname === '/admin' || pathname === '/analytics') return 'admin';
  return 'other';
}

function finite(value: unknown, max: number, decimals = 1): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) return undefined;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function integer(value: unknown, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) return undefined;
  return value;
}

export function parsePerformanceSamples(value: string | null): PerformanceSample[] {
  if (!value) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const now = Date.now();
  return parsed.flatMap((item): PerformanceSample[] => {
    if (!item || typeof item !== 'object') return [];
    const sample = item as Record<string, unknown>;
    const id = typeof sample.id === 'string' ? sample.id.slice(0, 80) : '';
    const capturedAt = integer(sample.capturedAt, Number.MAX_SAFE_INTEGER);
    const route = typeof sample.route === 'string' && routes.has(sample.route as PerformanceRoute) ? sample.route as PerformanceRoute : undefined;
    if (!id || !capturedAt || capturedAt > now + 60_000 || now - capturedAt > maxSampleAge || !route) return [];
    const apiCount = integer(sample.apiCount, 10_000);
    const apiSlowCount = integer(sample.apiSlowCount, 10_000);
    return [{
      id, capturedAt, route,
      ...(finite(sample.ttfbMs, 600_000) !== undefined ? {ttfbMs: finite(sample.ttfbMs, 600_000)} : {}),
      ...(finite(sample.fcpMs, 600_000) !== undefined ? {fcpMs: finite(sample.fcpMs, 600_000)} : {}),
      ...(finite(sample.lcpMs, 600_000) !== undefined ? {lcpMs: finite(sample.lcpMs, 600_000)} : {}),
      ...(finite(sample.inpMs, 600_000) !== undefined ? {inpMs: finite(sample.inpMs, 600_000)} : {}),
      ...(finite(sample.cls, 10, 3) !== undefined ? {cls: finite(sample.cls, 10, 3)} : {}),
      ...(apiCount !== undefined ? {apiCount} : {}),
      ...(apiSlowCount !== undefined ? {apiSlowCount: Math.min(apiSlowCount, apiCount ?? apiSlowCount)} : {}),
      ...(finite(sample.apiTotalMs, 600_000) !== undefined ? {apiTotalMs: finite(sample.apiTotalMs, 600_000)} : {}),
      ...(finite(sample.apiMaxMs, 600_000) !== undefined ? {apiMaxMs: finite(sample.apiMaxMs, 600_000)} : {}),
    }];
  }).sort((a, b) => b.capturedAt - a.capturedAt).slice(0, 20);
}

export function upsertPerformanceSample(samples: PerformanceSample[], input: PerformanceSample): PerformanceSample[] {
  const [sample] = parsePerformanceSamples(JSON.stringify([input]));
  if (!sample) return samples.slice(0, 20);
  return [sample, ...samples.filter((item) => item.id !== sample.id)].sort((a, b) => b.capturedAt - a.capturedAt).slice(0, 20);
}

export function performancePercentile(values: number[], percentile = 0.75): number | undefined {
  const clean = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (!clean.length) return undefined;
  const bounded = Math.max(0, Math.min(1, percentile));
  return clean[Math.max(0, Math.ceil(bounded * clean.length) - 1)];
}

export function summarizePerformanceSamples(samples: PerformanceSample[]): PerformanceSummary {
  const valueAt = (key: 'ttfbMs' | 'fcpMs' | 'lcpMs' | 'inpMs' | 'cls') =>
    performancePercentile(samples.flatMap((sample) => typeof sample[key] === 'number' ? [sample[key]!] : []));
  const apiCount = samples.reduce((sum, sample) => sum + (sample.apiCount ?? 0), 0);
  const apiSlowCount = samples.reduce((sum, sample) => sum + (sample.apiSlowCount ?? 0), 0);
  const apiTotalMs = samples.reduce((sum, sample) => sum + (sample.apiTotalMs ?? 0), 0);
  const apiMaxMs = samples.reduce<number | undefined>((maximum, sample) => sample.apiMaxMs === undefined ? maximum : Math.max(maximum ?? 0, sample.apiMaxMs), undefined);
  return {
    sampleCount: samples.length, ttfbMs: valueAt('ttfbMs'), fcpMs: valueAt('fcpMs'), lcpMs: valueAt('lcpMs'),
    inpMs: valueAt('inpMs'), cls: valueAt('cls'), apiCount, apiSlowCount,
    apiAverageMs: apiCount ? Math.round(apiTotalMs / apiCount) : undefined, apiMaxMs,
  };
}
