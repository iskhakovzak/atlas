import assert from 'node:assert/strict';
import test from 'node:test';
import {budget, metricsFromReport, overBudget, parseArgs} from '../scripts/perf-budget.mjs';

test('perf budget arguments: base URL, product page and runs', () => {
  assert.deepEqual(parseArgs(['http://127.0.0.1:8797/']), {base: 'http://127.0.0.1:8797', product: '', runs: 1});
  assert.deepEqual(parseArgs(['https://staging.example', '--product', '/catalog/p/x', '--runs', '3']), {base: 'https://staging.example', product: '/catalog/p/x', runs: 3});
  assert.throws(() => parseArgs([]), /Usage/);
  assert.throws(() => parseArgs(['http://a', '--fast']), /Unknown argument/);
});

test('perf budget reads LCP, CLS, TBT and the score from a Lighthouse report', () => {
  const report = {categories: {performance: {score: 0.65}}, audits: {
    'largest-contentful-paint': {numericValue: 6270}, 'cumulative-layout-shift': {numericValue: 0.006},
    'total-blocking-time': {numericValue: 20}, 'first-contentful-paint': {numericValue: 4840}}};
  const metrics = metricsFromReport(report);
  assert.deepEqual(metrics, {lcpMs: 6270, cls: 0.006, tbtMs: 20, fcpMs: 4840, score: 65});
  assert.deepEqual(overBudget(metrics, budget['/']), []);
  assert.deepEqual(overBudget({...metrics, lcpMs: 9000, cls: 0.2, score: 40}, budget['/']), ['LCP 9000 ms > 7500 ms', 'CLS 0.200 > 0.1', 'score 40 < 55']);
  assert.throws(() => metricsFromReport({runtimeError: {message: 'NO_NAVSTART'}, audits: {}}), /NO_NAVSTART/);
});
