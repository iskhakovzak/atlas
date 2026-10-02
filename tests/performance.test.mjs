import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePerformanceSamples,
  performancePercentile,
  performanceRoute,
  summarizePerformanceSamples,
  upsertPerformanceSample,
} from '../lib/market/performance.ts';

test('performance route groups never retain arbitrary path segments', () => {
  assert.equal(performanceRoute('/'), 'catalog');
  assert.equal(performanceRoute('/orders'), 'orders');
  assert.equal(performanceRoute('/admin'), 'admin');
  assert.equal(performanceRoute('/customer/private-email@example.test'), 'other');
});

test('performance sample parsing is bounded, recent, and rejects malformed metrics', () => {
  const now = Date.now();
  const parsed = parsePerformanceSamples(JSON.stringify([
    {id: 'new', capturedAt: now, route: 'catalog', ttfbMs: 48.26, cls: 0.12345, apiCount: 2, apiSlowCount: 9, apiTotalMs: 180, apiMaxMs: 500},
    {id: 'stale', capturedAt: now - 3_600_001, route: 'catalog'},
    {id: 'private-route', capturedAt: now, route: '/orders/private-customer'},
    {id: 'invalid-values', capturedAt: now, route: 'orders', lcpMs: -1, inpMs: Number.NaN},
  ]));

  assert.deepEqual(parsed, [
    {id: 'new', capturedAt: now, route: 'catalog', ttfbMs: 48.3, cls: 0.123, apiCount: 2, apiSlowCount: 2, apiTotalMs: 180, apiMaxMs: 500},
    {id: 'invalid-values', capturedAt: now, route: 'orders'},
  ]);
  assert.deepEqual(parsePerformanceSamples('{bad json'), []);
});

test('upsert replaces one page sample and keeps the most recent 20', () => {
  const now = Date.now();
  const initial = Array.from({length: 20}, (_, index) => ({
    id: `id-${index}`, capturedAt: now - index, route: 'catalog',
  }));
  const updated = upsertPerformanceSample(initial, {
    id: 'id-0', capturedAt: now, route: 'catalog', lcpMs: 1200,
  });
  assert.equal(updated.length, 20);
  assert.equal(updated[0].id, 'id-0');
  assert.equal(updated[0].lcpMs, 1200);
  assert.equal(updated.filter((sample) => sample.id === 'id-0').length, 1);
});

test('summary uses p75 and combines API duration totals without user identifiers', () => {
  const now = Date.now();
  const summary = summarizePerformanceSamples([
    {id: 'a', capturedAt: now, route: 'catalog', lcpMs: 1000, inpMs: 50, apiCount: 2, apiSlowCount: 1, apiTotalMs: 300, apiMaxMs: 200},
    {id: 'b', capturedAt: now - 1, route: 'orders', lcpMs: 2000, inpMs: 100, apiCount: 1, apiSlowCount: 0, apiTotalMs: 100, apiMaxMs: 100},
    {id: 'c', capturedAt: now - 2, route: 'admin', lcpMs: 3000, inpMs: 400, apiCount: 0, apiSlowCount: 0, apiTotalMs: 0, apiMaxMs: 0},
    {id: 'd', capturedAt: now - 3, route: 'other', lcpMs: 4000, inpMs: 500, apiCount: 1, apiSlowCount: 1, apiTotalMs: 2000, apiMaxMs: 2000},
  ]);

  assert.equal(summary.sampleCount, 4);
  assert.equal(summary.lcpMs, 3000);
  assert.equal(summary.inpMs, 400);
  assert.equal(summary.apiCount, 4);
  assert.equal(summary.apiSlowCount, 2);
  assert.equal(summary.apiAverageMs, 600);
  assert.equal(summary.apiMaxMs, 2000);
});

test('percentile handles sparse samples and clamps invalid percentile requests', () => {
  assert.equal(performancePercentile([], 0.75), undefined);
  assert.equal(performancePercentile([300, 100, 200], 0.75), 300);
  assert.equal(performancePercentile([300, 100, 200], 9), 300);
});
