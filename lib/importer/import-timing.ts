/** Fixed-name server timings contain no product URL, user information or merchant response. */
export function importTimingHeader(stages: { lookup?: number; merchant?: number; cacheWrite?: number; total: number }): string {
  return (Object.entries(stages) as [string, number | undefined][])
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    .map(([name, value]) => `${name};dur=${Math.round(value!)}`)
    .join(', ');
}
