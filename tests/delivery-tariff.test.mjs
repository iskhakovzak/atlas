import test from 'node:test';
import assert from 'node:assert/strict';
import { cartDeliverySpeed, deliveryPerKgUsd, deliveryPerKgUsdFor, effectiveFx, normalizePricing, perKgSoumFor, price, pricingSchema, quote, setCartDeliverySpeed, standardDeliveryPerKgUsd, tariff, upgradePricing, blank, addToCart, products } from '../lib/market/domain.ts';
import { fxRefreshDue, parseCbuRate, withCbuRate } from '../lib/market/fx.ts';

test('the default tariff charges express $15.98 per kg and standard $13.98 per kg, at the tariff rate', () => {
  assert.equal(deliveryPerKgUsd, 15.98);
  assert.equal(standardDeliveryPerKgUsd, 13.98);
  assert.equal(tariff.perKgUsd, 15.98);
  assert.equal(tariff.standardPerKgUsd, 13.98);
  assert.equal(tariff.perKg, Math.round(15.98 * tariff.fx));
  assert.equal(perKgSoumFor(tariff, 'express'), tariff.perKg);
  assert.equal(perKgSoumFor(tariff, 'standard'), Math.round(13.98 * tariff.fx));
  assert.equal(price(100, 1, 1, 0, tariff).shipping, tariff.perKg);
  assert.equal(price(100, 1.3, 1, 0, tariff).shipping, Math.ceil(1.3 * tariff.perKg));
  assert.equal(price(100, 1.3, 1, 0, tariff, 'standard').shipping, Math.ceil(1.3 * Math.round(13.98 * tariff.fx)));
  assert.equal(deliveryPerKgUsdFor(tariff, 'США'), 15.98);
  assert.equal(deliveryPerKgUsdFor(tariff, 'США', 'standard'), 13.98);
  assert.equal(deliveryPerKgUsdFor({ ...tariff, countryOverrides: { 'Китай': { standardPerKgUsd: 12 } } }, 'Китай', 'standard'), 12);
  const q = quote(100, 1, 1000, 1, 0, tariff, 'standard');
  assert.deepEqual([q.deliverySpeed, q.perKg], ['standard', Math.round(13.98 * tariff.fx)]);
  assert.equal(quote(100, 1, 1000, 1, 0, tariff).deliverySpeed, 'express');
});

test('the customer switches the whole cart between express and standard delivery', () => {
  const fx = { ...tariff, fx: 12000, perKg: Math.round(15.98 * 12000) };
  let state = addToCart(blank(), products[0], products[0].variants[0], 1000, fx);
  assert.equal(cartDeliverySpeed(state.cart), 'express', 'a cart saved before the choice is express');
  const express = state.cart[0].quote;
  state = setCartDeliverySpeed(state, 'standard', 1000, fx);
  const standard = state.cart[0].quote;
  assert.equal(cartDeliverySpeed(state.cart), 'standard');
  assert.ok(standard.shipping < express.shipping, 'standard delivery costs less');
  assert.equal(standard.merchandise, express.merchandise, 'only the delivery changes');
  assert.equal(standard.total - express.total, (standard.shipping - express.shipping) + (standard.reserve - express.reserve));
  assert.throws(() => setCartDeliverySpeed(state, 'rocket', 1000, fx));
  assert.throws(() => setCartDeliverySpeed(blank(), 'standard', 1000, fx));
  // A line added later joins the cart at its speed.
  state = addToCart(state, products[1], products[1].variants[0], 1000, fx);
  assert.deepEqual(state.cart.map(item => item.deliverySpeed), ['standard', 'standard']);
  assert.equal(state.cart[1].quote.deliverySpeed, 'standard');
});

test('soum per kg follows the dollar rate, for the base rate and country overrides', () => {
  const next = normalizePricing({ ...tariff, fx: 12500, perKg: 1, perKgUsd: 15, countryOverrides: { 'Китай': { perKgUsd: 14 }, 'Турция': { perKg: 200000 } } });
  assert.equal(perKgSoumFor({ ...next, standardPerKgUsd: 10 }, 'standard'), 125000, 'standard soum per kg follows the same rate');
  assert.equal(next.perKg, 187500);
  assert.equal(next.countryOverrides['Китай'].perKg, 175000);
  // A soum-only override saved before USD rates stays as it was.
  assert.deepEqual(next.countryOverrides['Турция'], { perKg: 200000 });
  assert.equal(deliveryPerKgUsdFor(next, 'Китай'), 14);
  assert.equal(deliveryPerKgUsdFor(next, 'Турция'), 16);
  assert.equal(deliveryPerKgUsdFor({ ...next, deliveryMargin: 0.1 }, 'США'), 16.5);
});

test('a tariff saved before the owner decisions gets $15.98/$13.98 per kg, exactly the 9.98% fee and the CBU rate under a new version', () => {
  const legacy = pricingSchema.parse({ ...tariff, perKgUsd: undefined, standardPerKgUsd: undefined, perKg: 90000, fx: 12600, margin: 0.12, fxSource: undefined, revision: undefined, version: 'managed-1' });
  assert.equal(legacy.fxSource, 'manual');
  const upgraded = upgradePricing(legacy);
  assert.deepEqual([upgraded.perKgUsd, upgraded.standardPerKgUsd, upgraded.margin, upgraded.fxSource, upgraded.fxMarkup, upgraded.revision], [15.98, 13.98, 0.0998, 'cbu', 1.012, 5]);
  // Until the server reads the bank's rate, the stored rate stands.
  assert.equal(upgraded.fx, 12600);
  assert.equal(upgraded.perKg, Math.round(15.98 * 12600));
  assert.equal(upgraded.version, 'managed-1+r5');
  // Revisions 3–5: no international reserve, customs through Atlas at 4.98%, and a saved 1% conversion or
  // buyout no longer turns the fee into 10.98%; per-country rates give way to $15.98 everywhere.
  const second = upgradePricing(pricingSchema.parse({ ...tariff, revision: 3, margin: 0.1, conversionFee: 0.01, buyoutFee: 0.01, deliveryMargin: 0.1, reserve: 0.2, customsHelpFee: 0.03, countryOverrides: { Китай: { perKgUsd: 14, reserve: 0.3 }, США: { perKgUsd: 16, optionalServices: 5000 } }, version: 'managed-3' }));
  assert.deepEqual([second.reserve, second.customsHelpFee, second.margin, second.buyoutFee, second.conversionFee, second.deliveryMargin, second.perKgUsd, second.standardPerKgUsd, second.version], [0, 0.0498, 0.0998, 0, 0, 0, 15.98, 13.98, 'managed-3+r5']);
  assert.deepEqual(second.countryOverrides, { США: { optionalServices: 5000 } });
  assert.equal(deliveryPerKgUsdFor(second, 'Китай'), 15.98);
  // Revision 2 with a 1% conversion fee showed "10,98%" on the home page: the commission folds into the 9.98% fee.
  const tenNinetyEight = upgradePricing(pricingSchema.parse({ ...tariff, perKgUsd: 15, standardPerKgUsd: undefined, fx: 12600, margin: 0.0998, conversionFee: 0.01, revision: 2, version: 'managed-2' }));
  assert.deepEqual([tenNinetyEight.margin, tenNinetyEight.buyoutFee, tenNinetyEight.conversionFee, tenNinetyEight.perKgUsd, tenNinetyEight.standardPerKgUsd, tenNinetyEight.revision, tenNinetyEight.version], [0.0998, 0, 0, 15.98, 13.98, 5, 'managed-2+r5']);
  // Revision 4 ($14.98 everywhere) becomes $15.98 express with $13.98 standard; a rate the owner set by hand at that revision stays.
  const fourteen = upgradePricing(pricingSchema.parse({ ...tariff, perKgUsd: 14.98, standardPerKgUsd: undefined, fx: 12600, fxSource: 'manual', revision: 4, version: 'managed-4' }));
  assert.deepEqual([fourteen.perKgUsd, fourteen.standardPerKgUsd, fourteen.perKg, fourteen.revision, fourteen.version], [15.98, 13.98, Math.round(15.98 * 12600), 5, 'managed-4+r5']);
  const custom = upgradePricing(pricingSchema.parse({ ...tariff, perKgUsd: 13, standardPerKgUsd: 11, fx: 12600, fxSource: 'manual', revision: 4, version: 'managed-4' }));
  assert.deepEqual([custom.perKgUsd, custom.standardPerKgUsd, custom.perKg, custom.revision], [13, 11, 13 * 12600, 5]);
  const saved = upgradePricing(pricingSchema.parse({ ...tariff, perKgUsd: 13, fx: 12600, fxSource: 'manual', margin: 0.1, version: 'managed-5' }));
  assert.deepEqual([saved.perKg, saved.margin, saved.version], [13 * 12600, 0.1, 'managed-5'], 'a tariff saved after them keeps its own values');
  assert.ok(upgradePricing({ ...legacy, version: 'v'.repeat(80) }).version.length <= 80);
});

test('the CBU rate × 1.012 sets the soum rate; a changed rate is a new tariff version', () => {
  assert.deepEqual(parseCbuRate([{ Ccy: 'USD', Rate: '11772.95', Nominal: '1', Date: '03.10.2026' }]), { rate: 11772.95, date: '2026-10-03' });
  for (const bad of [null, [], [{ Ccy: 'EUR', Rate: '13000', Date: '03.10.2026' }], [{ Ccy: 'USD', Rate: 'abc', Date: '03.10.2026' }], [{ Ccy: 'USD', Rate: '50', Date: '03.10.2026' }]])
    assert.equal(parseCbuRate(bad), null);
  const cbu = { ...tariff, fxSource: 'cbu', fxCbuRate: undefined, version: 'v1' };
  const next = withCbuRate(cbu, { rate: 11772.95, date: '2026-10-03' }, 1000);
  assert.equal(next.fx, Math.round(11772.95 * 1.012));
  assert.equal(next.perKg, Math.round(15.98 * next.fx));
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
