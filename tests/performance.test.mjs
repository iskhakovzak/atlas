import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePerformanceSamples, performancePercentile, performanceRoute, summarizePerformanceSamples, upsertPerformanceSample } from '../lib/market/performance.ts';

test('performance route groups do not retain arbitrary path segments', () => {
  assert.equal(performanceRoute('/'), 'catalog');
  assert.equal(performanceRoute('/orders'), 'orders');
  assert.equal(performanceRoute('/admin'), 'admin');
  assert.equal(performanceRoute('/customer/private-email@example.test'), 'other');
});

test('samples reject stale and malformed values and stay bounded', () => {
  const now = Date.now();
  assert.deepEqual(parsePerformanceSamples(JSON.stringify([
    {id: 'fresh', capturedAt: now, route: 'catalog', ttfbMs: 48.26, cls: 0.12345, apiCount: 2, apiSlowCount: 9},
    {id: 'stale', capturedAt: now - 3_600_001, route: 'catalog'},
    {id: 'private', capturedAt: now, route: '/orders/private-customer'},
    {id: 'invalid', capturedAt: now, route: 'orders', lcpMs: -1},
  ])), [
    {id: 'fresh', capturedAt: now, route: 'catalog', ttfbMs: 48.3, cls: 0.123, apiCount: 2, apiSlowCount: 2},
    {id: 'invalid', capturedAt: now, route: 'orders'},
  ]);
  assert.deepEqual(parsePerformanceSamples('{bad json'), []);
});

test('samples upsert by page and summaries compute p75 and API latency', () => {
  const now = Date.now();
  const initial = Array.from({length: 20}, (_, i) => ({id: `id-${i}`, capturedAt: now - i, route: 'catalog'}));
  const updated = upsertPerformanceSample(initial, {id: 'id-0', capturedAt: now, route: 'catalog', lcpMs: 1200});
  assert.equal(updated.length, 20);
  assert.equal(updated.filter((item) => item.id === 'id-0').length, 1);
  const summary = summarizePerformanceSamples([
    {id: 'a', capturedAt: now, route: 'catalog', lcpMs: 1000, apiCount: 2, apiSlowCount: 1, apiTotalMs: 300, apiMaxMs: 200},
    {id: 'b', capturedAt: now - 1, route: 'orders', lcpMs: 2000, apiCount: 1, apiSlowCount: 0, apiTotalMs: 100, apiMaxMs: 100},
    {id: 'c', capturedAt: now - 2, route: 'admin', lcpMs: 3000, apiCount: 1, apiSlowCount: 1, apiTotalMs: 2000, apiMaxMs: 2000},
  ]);
  assert.equal(summary.lcpMs, 3000);
  assert.equal(summary.apiCount, 4);
  assert.equal(summary.apiAverageMs, 600);
  assert.equal(summary.apiMaxMs, 2000);
});

test('percentile handles sparse samples and clamps out-of-range percentiles', () => {
  assert.equal(performancePercentile([], 0.75), undefined);
  assert.equal(performancePercentile([300, 100, 200], 0.75), 300);
  assert.equal(performancePercentile([300, 100, 200], 9), 300);
});
