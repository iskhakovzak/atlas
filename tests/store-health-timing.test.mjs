import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeStoreHealth } from '../lib/market/store-health.ts';

test('store health keeps a bounded moving average without storing product URLs', () => {
  let health = mergeStoreHealth({}, [{url:'https://www.example.com/a?secret=1',result:'ok',durationMs:1000}], 1);
  health = mergeStoreHealth(health, [{url:'https://www.example.com/b',result:'failed',durationMs:3000}], 2);
  assert.equal(health['example.com'].averageDurationMs, 1400);
  assert.equal(JSON.stringify(health).includes('secret'), false);
  health = mergeStoreHealth(health, [{url:'https://example.com/c',result:'ok',durationMs:NaN}], 3);
  assert.equal(health['example.com'].averageDurationMs, 1400);
});
