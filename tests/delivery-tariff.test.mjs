import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryPerKgUsd, deliveryPerKgUsdFor, normalizePricing, price, pricingSchema, tariff, upgradePricing } from '../lib/market/domain.ts';

test('the default tariff charges $15 per kg, $1.5 per 100 g, at the tariff rate', () => {
  assert.equal(deliveryPerKgUsd, 15);
  assert.equal(tariff.perKgUsd, 15);
  assert.equal(tariff.perKg, 15 * tariff.fx);
  assert.equal(price(100, 1, 1, 0, tariff).shipping, 15 * tariff.fx);
  assert.equal(price(100, 1.3, 1, 0, tariff).shipping, Math.ceil(1.3 * 15 * tariff.fx));
  assert.equal(deliveryPerKgUsdFor(tariff, 'США'), 15);
});

test('soum per kg follows the dollar rate, for the base rate and country overrides', () => {
  const next = normalizePricing({ ...tariff, fx: 12500, perKg: 1, perKgUsd: 15, countryOverrides: { 'Китай': { perKgUsd: 14 }, 'Турция': { perKg: 200000 } } });
  assert.equal(next.perKg, 187500);
  assert.equal(next.countryOverrides['Китай'].perKg, 175000);
  // A soum-only override saved before USD rates stays as it was.
  assert.deepEqual(next.countryOverrides['Турция'], { perKg: 200000 });
  assert.equal(deliveryPerKgUsdFor(next, 'Китай'), 14);
  assert.equal(deliveryPerKgUsdFor(next, 'Турция'), 16);
  assert.equal(deliveryPerKgUsdFor({ ...next, deliveryMargin: 0.1 }, 'США'), 16.5);
});

test('a tariff saved in soum moves to $15 under a new version; a USD tariff keeps its own', () => {
  const legacy = pricingSchema.parse({ ...tariff, perKgUsd: undefined, perKg: 90000, fx: 12600, version: 'managed-1' });
  const upgraded = upgradePricing(legacy);
  assert.equal(upgraded.perKgUsd, 15);
  assert.equal(upgraded.perKg, 15 * 12600);
  assert.equal(upgraded.version, 'managed-1+usd15');
  const saved = upgradePricing(pricingSchema.parse({ ...tariff, perKgUsd: 13, fx: 12600, version: 'managed-2' }));
  assert.equal(saved.perKg, 13 * 12600);
  assert.equal(saved.version, 'managed-2');
  assert.ok(upgradePricing({ ...legacy, version: 'v'.repeat(80) }).version.length <= 80);
});
