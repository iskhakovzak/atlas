import test from 'node:test';
import assert from 'node:assert/strict';
import { homeCopy, formatSum, formatUsd, groupDigits } from '../lib/market/home-copy.ts';
import { siteContent, deliveryRegions, paymentLabels } from '../lib/market/site-content.ts';

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

test('delivery table lists the express routes with their approximate business days', () => {
  assert.deepEqual(deliveryRegions.map(region => [region.countries.join(), siteContent.deliveryDays[region.id]]), [
    ['США', [5, 10]], ['Великобритания', [7, 10]], ['Китай', [7, 12]], ['Германия', [7, 9]], ['Италия', [7, 9]], ['Испания', [7, 9]],
  ]);
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
