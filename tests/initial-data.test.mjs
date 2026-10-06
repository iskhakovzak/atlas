import test from 'node:test';
import assert from 'node:assert/strict';
import { tariff, upgradePricing, pricingRevision } from '../lib/market/domain.ts';
import { samePricing, nextPricing, parseStoredPricing } from '../lib/market/pricing-equal.ts';

test('the same tariff keeps the previous state object, so hydration and reloads do not change the numbers', () => {
  const previous = { ...tariff };
  const fromApi = JSON.parse(JSON.stringify(tariff));
  assert.ok(samePricing(previous, fromApi));
  assert.equal(nextPricing(previous, fromApi), previous);
  // Key order and dropped undefined fields do not matter.
  const reordered = Object.fromEntries(Object.entries(tariff).reverse());
  assert.ok(samePricing(tariff, { ...reordered, managedBy: undefined }));
});

test('a changed tariff replaces the state', () => {
  const changed = { ...tariff, fx: tariff.fx + 10, version: 'demo-2', updatedAt: 1 };
  assert.ok(!samePricing(tariff, changed));
  assert.equal(nextPricing(tariff, changed), changed);
  const sameVersionNewRate = { ...tariff, perKgUsd: tariff.perKgUsd + 1 };
  assert.ok(!samePricing(tariff, sameVersionNewRate));
  assert.ok(!samePricing(null, tariff));
  assert.ok(samePricing(null, null));
});

test('a stored tariff is parsed like the API does: validated and upgraded to the current revision', () => {
  assert.equal(parseStoredPricing(undefined), tariff);
  assert.equal(parseStoredPricing('not json'), tariff);
  assert.equal(parseStoredPricing('{"fx":1}'), tariff);
  const old = { ...tariff, perKgUsd: 15, margin: 0.0998, buyoutFee: 0.005, conversionFee: 0.005, version: 'demo-1', revision: undefined };
  const parsed = parseStoredPricing(JSON.stringify(old));
  assert.deepEqual(parsed, upgradePricing(old));
  assert.equal(parsed.revision, pricingRevision);
  assert.equal(parsed.margin + parsed.buyoutFee + parsed.conversionFee, 0.0998);
  assert.equal(parsed.perKgUsd, 15.98);
});
