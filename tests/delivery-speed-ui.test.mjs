import test from 'node:test';
import assert from 'node:assert/strict';
import { addToCart, blank, cartDeliverySpeed, products, setCartDeliverySpeed, tariff } from '../lib/market/domain.ts';
import { daysRangeFor, deliverySpeedCopy, deliverySpeedOptions, rateTextFor, regionForCountry, savingText, totalsBySpeed } from '../lib/market/delivery-speed.ts';
import { calcCopy } from '../lib/market/calc-copy.ts';

const locales = ['ru', 'uz', 'en'];

test('every locale has the full delivery-speed wording', () => {
  for (const locale of locales) {
    const c = deliverySpeedCopy[locale];
    assert.ok(c.title && c.names.express && c.names.standard && c.short.express && c.short.standard && c.daysUnknown && c.samePrice && c.appliesToCart && c.saving);
    assert.match(c.days(5, 9), /5–9/);
    assert.match(c.perKg('$15,98'), /\$15,98\/(кг|kg)/);
    assert.match(c.cheaperBy('10 000 сум'), /10 000 сум/);
    assert.ok(calcCopy[locale].speeds.express && calcCopy[locale].speeds.standard);
    assert.match(calcCopy[locale].speedRule('$15.98', '5–9', '$13.98', '9–14'), /\$15\.98.*\$13\.98/);
  }
});

test('dispatch countries map to regions; unknown ones are priced like the US', () => {
  assert.equal(regionForCountry('США'), 'us');
  assert.equal(regionForCountry('Германия'), 'de');
  assert.equal(regionForCountry('Китай'), 'cn');
  assert.equal(regionForCountry(undefined), 'us');
  assert.equal(regionForCountry('Другая страна'), 'us');
});

test('delivery windows: express 5–9 from the US, 7–9 elsewhere, standard 9–14; mixed carts show min–max', () => {
  assert.deepEqual(daysRangeFor(tariff, ['США'], 'express'), [5, 9]);
  assert.deepEqual(daysRangeFor(tariff, ['Германия'], 'express'), [7, 9]);
  assert.deepEqual(daysRangeFor(tariff, ['США', 'Германия'], 'express'), [5, 9]);
  assert.deepEqual(daysRangeFor(tariff, ['США', 'Китай'], 'standard'), [9, 14]);
  assert.deepEqual(daysRangeFor(tariff, [], 'express'), [5, 9]);
  // The admin's own window wins over the default.
  assert.deepEqual(daysRangeFor({ ...tariff, standardDeliveryDays: { us: [10, 12] } }, ['США'], 'standard'), [10, 12]);
});

test('rate text names the tariff of the speed, as a range when countries differ', () => {
  assert.equal(rateTextFor(tariff, ['США'], 'express', 'ru'), '$15,98/кг');
  assert.equal(rateTextFor(tariff, ['США'], 'standard', 'en'), '$13.98/kg');
  const withOverride = { ...tariff, countryOverrides: { ...tariff.countryOverrides, Китай: { perKgUsd: 18 } } };
  assert.equal(rateTextFor(withOverride, ['США', 'Китай'], 'express', 'en'), '$15.98–$18/kg');
});

test('options read "Express · 5–9 business days · $15.98/kg" and "Standard · 9–14 business days · $13.98/kg"', () => {
  const [express, standard] = deliverySpeedOptions(tariff, ['США'], 'en');
  assert.equal(express.speed, 'express');
  assert.equal(express.label, 'Express · 5–9 business days · $15.98/kg');
  assert.equal(standard.label, 'Standard · 9–14 business days · $13.98/kg');
  assert.equal(deliverySpeedOptions(tariff, ['США'], 'ru')[1].label, 'Обычная · 9–14 раб. дней · $13,98/кг');
});

test('standard is cheaper by the per-kg difference on the billable weight', () => {
  const state = addToCart(blank(), products[0], products[0].variants[0], Date.now(), tariff, 1);
  const totals = totalsBySpeed(state.cart, tariff, Date.now());
  assert.ok(totals.express > totals.standard);
  const weight = state.cart[0].quote.weight;
  const expected = Math.ceil(weight * tariff.perKg) - Math.ceil(weight * Math.round(13.98 * tariff.fx));
  assert.ok(Math.abs(totals.express - totals.standard - expected) <= Math.ceil(tariff.reserve * expected) + 2);
  assert.match(savingText(state.cart, tariff, 'ru'), /^Обычная дешевле на \d[\d\s]* сум$/);
  assert.equal(savingText([], tariff, 'ru'), '');
  // The saving the helper predicts is what the server's switch produces.
  const standard = setCartDeliverySpeed(state, 'standard', Date.now(), tariff);
  assert.equal(cartDeliverySpeed(standard.cart), 'standard');
  assert.equal(standard.cart[0].quote.total, totals.standard);
});
