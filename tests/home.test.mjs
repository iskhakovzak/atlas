import test from 'node:test';
import assert from 'node:assert/strict';
import { homeCopy, formatSum, formatUsd, groupDigits } from '../lib/market/home-copy.ts';
import { siteContent, deliveryRegions, deliveryDaysFor, paymentLabels } from '../lib/market/site-content.ts';

function shape(value) {
  if (Array.isArray(value)) return value.map(shape);
  if (typeof value === 'function') return 'function';
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, shape(value[key])]));
  return typeof value;
}

test('home copy has the same keys in Uzbek, Russian and English, with no empty strings', () => {
  assert.deepEqual(shape(homeCopy.uz), shape(homeCopy.ru));
  assert.deepEqual(shape(homeCopy.en), shape(homeCopy.ru));
  for (const [locale, copy] of Object.entries(homeCopy)) {
    const walk = (value, path) => {
      if (typeof value === 'string') assert.ok(value.trim(), `${locale}.${path} is empty`);
      else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) walk(inner, `${path}.${key}`);
    };
    walk(copy, '');
    assert.equal(copy.how.steps.length, 4, `${locale}: four "how it works" steps`);
  }
});

test('Uzbek copy uses Latin script and the ‘ letter mark, not Cyrillic', () => {
  const text = JSON.stringify(homeCopy.uz);
  assert.doesNotMatch(text, /[Ѐ-ӿ]/);
  assert.doesNotMatch(text, /o'|g'|O'|G'/);
});

test('soum amounts use space-grouped digits in every language', () => {
  assert.equal(groupDigits(1234567), '1 234 567');
  assert.equal(groupDigits(999), '999');
  assert.equal(formatSum(465233, 'ru'), '465 233 сум');
  assert.equal(formatSum(465233, 'uz'), '465 233 so‘m');
  assert.equal(formatSum(465233, 'en'), '465 233 UZS');
  assert.equal(homeCopy.ru.tariffs.days(10, 21), '10–21 рабочий день');
  assert.equal(homeCopy.ru.tariffs.days(3, 4), '3–4 рабочих дня');
  assert.equal(homeCopy.ru.tariffs.days(5, 10), '5–10 рабочих дней');
  assert.equal(homeCopy.uz.tariffs.days(7, 9), '7–9 ish kuni');
  assert.equal(formatUsd(15, 'ru'), '$15');
  assert.equal(formatUsd(1.5, 'ru'), '$1,5');
  assert.equal(formatUsd(1.5, 'en'), '$1.5');
  assert.equal(formatUsd(1.25, 'uz'), '$1,25');
});

test('delivery table lists the express and standard routes with their approximate business days', () => {
  assert.deepEqual(deliveryRegions.map(region => [region.countries.join(), siteContent.deliveryDays[region.id]]), [
    ['США', [5, 9]], ['Великобритания', [7, 9]], ['Китай', [7, 9]], ['Германия', [7, 9]], ['Италия', [7, 9]], ['Испания', [7, 9]],
  ]);
  for (const region of deliveryRegions) assert.deepEqual(siteContent.standardDeliveryDays[region.id], [9, 14]);
  assert.deepEqual(deliveryDaysFor({ standardDeliveryDays: { us: [10, 15] } }, 'us', 'standard'), [10, 15]);
  assert.deepEqual(deliveryDaysFor({ standardDeliveryDays: { us: [10, 15] } }, 'uk', 'standard'), [9, 14]);
  assert.deepEqual(deliveryDaysFor({}, 'us'), [5, 9]);
});

test('home tariff copy names both delivery speeds and prints the per-100 g price with two decimals', async () => {
  const { formatPriceUsd } = await import('../lib/market/home-copy.ts');
  const { deliveryPerKgUsdFor, tariff } = await import('../lib/market/domain.ts');
  for (const locale of ['ru', 'uz', 'en']) {
    const copy = homeCopy[locale].tariffs;
    assert.ok(copy.speeds.express && copy.speeds.standard && copy.speedsLabel && copy.perKgUnit, `${locale}: speed labels`);
    assert.ok(homeCopy[locale].faq.timesKnown('x').length > 20);
  }
  assert.equal(formatUsd(deliveryPerKgUsdFor(tariff, undefined, 'express'), 'ru'), '$15,98');
  assert.equal(formatUsd(deliveryPerKgUsdFor(tariff, undefined, 'standard'), 'ru'), '$13,98');
  assert.equal(homeCopy.ru.tariffs.per100g(formatPriceUsd(15.98 / 10, 'ru')), '$1,60 за 100 г');
  assert.equal(homeCopy.en.tariffs.per100g(formatPriceUsd(13.98 / 10, 'en')), '$1.40 per 100 g');
  assert.equal(homeCopy.ru.example.days(5, 9), 'экспресс, примерно 5–9 рабочих дней');
  assert.match(homeCopy.ru.tariffs.lead, /обычная/i);
  assert.match(homeCopy.ru.faq.timesKnown('США: экспресс 5–9 рабочих дней, обычная 9–14 рабочих дней'), /обычная 9–14/);
});

test('site content holds only verified data and is well-formed when filled', () => {
  for (const region of deliveryRegions) {
    const days = siteContent.deliveryDays[region.id];
    if (days) assert.ok(Number.isInteger(days[0]) && Number.isInteger(days[1]) && days[0] > 0 && days[0] <= days[1], `${region.id} delivery days`);
    assert.ok(homeCopy.ru.tariffs.regions[region.id]);
  }
  for (const method of siteContent.paymentMethods) assert.ok(paymentLabels[method], `unknown payment method ${method}`);
  assert.ok(siteContent.completedOrders === null || (Number.isInteger(siteContent.completedOrders) && siteContent.completedOrders >= 0));
  for (const review of siteContent.reviews) for (const locale of ['uz', 'ru', 'en']) assert.ok(review.text[locale]?.trim());
  for (const photo of siteContent.parcelPhotos) assert.ok(photo.src.startsWith('/') && photo.alt.uz && photo.alt.ru && photo.alt.en);
  const { phone } = siteContent.contacts;
  assert.ok(phone === null || /^\+998\d{9}$/.test(phone.replace(/\s/g, '')));
});

test('fees, store prices and dates are written exactly, never rounded into a different number', async () => {
  const { formatPercent, formatPriceUsd, formatDayMonth } = await import('../lib/market/home-copy.ts');
  assert.equal(formatPercent(0.0998, 'ru'), '9,98%');
  assert.equal(formatPercent(0.0998, 'en'), '9.98%');
  assert.equal(formatPercent(1.012 - 1, 'uz'), '1,2%');
  assert.equal(formatPriceUsd(2.72, 'ru'), '$2,72');
  assert.equal(formatPriceUsd(2.7, 'ru'), '$2,70');
  assert.equal(formatPriceUsd(2.72, 'en'), '$2.72');
  assert.equal(formatPriceUsd(100, 'uz'), '$100');
  const october3 = Date.parse('2026-10-03T00:00:00Z');
  assert.equal(formatDayMonth(october3, 'ru'), '3 октября');
  assert.equal(formatDayMonth(october3, 'uz'), '3-oktabr');
  assert.equal(formatDayMonth(october3, 'en'), '3 October');
});

test('the home example bill is priced like a real order: packed weight plus 0.3 kg', async () => {
  const { price, tariff } = await import('../lib/market/domain.ts');
  const { combinedShipmentWeight } = await import('../lib/market/world.ts');
  const quote = price(100, combinedShipmentWeight(1), 1, 0, tariff);
  assert.equal(quote.weight, 1.3);
  assert.equal(quote.shipping, Math.ceil(1.3 * tariff.perKg));
  assert.equal(quote.service, Math.round(quote.merchandise * tariff.margin));
});
