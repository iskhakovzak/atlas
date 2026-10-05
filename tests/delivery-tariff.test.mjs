import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryPerKgUsd, deliveryPerKgUsdFor, effectiveFx, normalizePricing, price, pricingSchema, tariff, upgradePricing } from '../lib/market/domain.ts';
import { fxRefreshDue, parseCbuRate, withCbuRate } from '../lib/market/fx.ts';

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

test('a tariff saved before the owner decisions gets $15/kg, the 9.98% fee and the CBU rate under a new version', () => {
  const legacy = pricingSchema.parse({ ...tariff, perKgUsd: undefined, perKg: 90000, fx: 12600, margin: 0.12, fxSource: undefined, revision: undefined, version: 'managed-1' });
  assert.equal(legacy.fxSource, 'manual');
  const upgraded = upgradePricing(legacy);
  assert.deepEqual([upgraded.perKgUsd, upgraded.margin, upgraded.fxSource, upgraded.fxMarkup, upgraded.revision], [15, 0.0998, 'cbu', 1.012, 3]);
  // Until the server reads the bank's rate, the stored rate stands.
  assert.equal(upgraded.fx, 12600);
  assert.equal(upgraded.perKg, 15 * 12600);
  assert.equal(upgraded.version, 'managed-1+r3');
  // Revision 3 (5 October 2026): no international reserve in the bill, customs paid through Atlas at 4.98% of the cart.
  const second = upgradePricing(pricingSchema.parse({ ...tariff, revision: 2, margin: 0.1, reserve: 0.2, customsHelpFee: 0.03, countryOverrides: { Китай: { perKgUsd: 14, reserve: 0.3 } }, version: 'managed-3' }));
  assert.deepEqual([second.reserve, second.customsHelpFee, second.margin, second.countryOverrides['Китай'].perKgUsd, 'reserve' in second.countryOverrides['Китай'], second.version], [0, 0.0498, 0.1, 14, false, 'managed-3+r3'], 'a revision-2 row keeps its own fee and rates');
  const saved = upgradePricing(pricingSchema.parse({ ...tariff, perKgUsd: 13, fx: 12600, fxSource: 'manual', margin: 0.1, version: 'managed-2' }));
  assert.deepEqual([saved.perKg, saved.margin, saved.version], [13 * 12600, 0.1, 'managed-2'], 'a tariff saved after them keeps its own values');
  assert.ok(upgradePricing({ ...legacy, version: 'v'.repeat(80) }).version.length <= 80);
});

test('the CBU rate × 1.012 sets the soum rate; a changed rate is a new tariff version', () => {
  assert.deepEqual(parseCbuRate([{ Ccy: 'USD', Rate: '11772.95', Nominal: '1', Date: '03.10.2026' }]), { rate: 11772.95, date: '2026-10-03' });
  for (const bad of [null, [], [{ Ccy: 'EUR', Rate: '13000', Date: '03.10.2026' }], [{ Ccy: 'USD', Rate: 'abc', Date: '03.10.2026' }], [{ Ccy: 'USD', Rate: '50', Date: '03.10.2026' }]])
    assert.equal(parseCbuRate(bad), null);
  const cbu = { ...tariff, fxSource: 'cbu', fxCbuRate: undefined, version: 'v1' };
  const next = withCbuRate(cbu, { rate: 11772.95, date: '2026-10-03' }, 1000);
  assert.equal(next.fx, Math.round(11772.95 * 1.012));
  assert.equal(next.perKg, 15 * next.fx);
  assert.equal(effectiveFx(next), next.fx);
  assert.equal(next.version, 'cbu-2026-10-03-1000');
  assert.equal(withCbuRate(next, { rate: 11772.95, date: '2026-10-03' }, 2000).version, next.version, 'the same rate only records the check');
  assert.equal(fxRefreshDue({ fxSource: 'cbu', fxUpdatedAt: 1000 }, 1000 + 5 * 3600_000), false);
  assert.equal(fxRefreshDue({ fxSource: 'cbu', fxUpdatedAt: 1000 }, 1000 + 6 * 3600_000), true);
  assert.equal(fxRefreshDue({ fxSource: 'manual' }, 1000), false);
});

test('the Atlas fee is 9.98% of merchandise only', () => {
  const quote = price(100, 1, 1, 0, tariff);
  assert.equal(quote.service, Math.round(quote.merchandise * 0.0998));
  assert.equal(price(100, 5, 1, 7, tariff).service, quote.service, 'delivery does not change it');
});
