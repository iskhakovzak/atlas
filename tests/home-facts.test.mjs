import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryPerKgUsdFor, deliverySpeeds, tariff } from '../lib/market/domain.ts';
import { deliveryDaysFor, deliveryRegions } from '../lib/market/site-content.ts';
import { homeCopy } from '../lib/market/home-copy.ts';
import { expressLead, factPrice, speedDaysRange, speedPriceRange, tariffRows } from '../lib/market/home-facts.ts';

// The rates cards' own calculation before it moved to lib/market/home-facts.ts (app/home-sections.tsx DeliveryTariffs).
const oldCards = pricing => deliveryRegions.map(region => {
  const country = region.countries.find(name => pricing.countryOverrides?.[name]) ?? region.countries[0];
  const options = deliverySpeeds.map(speed => ({ speed, days: deliveryDaysFor(pricing, region.id, speed), usd: deliveryPerKgUsdFor(pricing, country, speed) }));
  return { region, options };
});
const withOverrides = { ...tariff, countryOverrides: { 'Китай': { standardPerKgUsd: 12 }, 'Германия': { perKgUsd: 17 } } };

test('tariff rows are the same as the rates cards computed before', () => {
  assert.deepEqual(tariffRows(tariff), oldCards(tariff));
  assert.deepEqual(tariffRows(withOverrides), oldCards(withOverrides));
  const china = tariffRows(withOverrides).find(row => row.region.id === 'cn');
  assert.equal(china.options.find(option => option.speed === 'standard').usd, 12);
  assert.deepEqual(tariffRows(tariff).map(row => row.region.id), ['us', 'uk', 'cn', 'de', 'it', 'es']);
});

test('a speed card says "from" only when the regions have different prices', () => {
  const rows = tariffRows(tariff);
  assert.deepEqual(speedPriceRange(rows, 'standard'), { min: 13.98, max: 13.98 });
  assert.equal(factPrice(rows, 'standard', 'ru'), '$13,98');
  assert.equal(factPrice(rows, 'express', 'en'), '$15.98');
  const mixed = tariffRows(withOverrides);
  assert.deepEqual(speedPriceRange(mixed, 'standard'), { min: 12, max: 13.98 });
  assert.equal(factPrice(mixed, 'standard', 'ru'), 'от $12');
  assert.equal(factPrice(mixed, 'standard', 'uz'), '$12 dan');
  assert.equal(factPrice(mixed, 'express', 'en'), 'from $15.98');
  assert.equal(speedPriceRange([], 'express'), null);
  assert.equal(factPrice([], 'express', 'ru'), null);
});

test('a speed card shows the shortest and longest days across the countries that have them', () => {
  const rows = tariffRows(tariff);
  assert.deepEqual(speedDaysRange(rows, 'express'), { min: 5, max: 9 });
  assert.deepEqual(speedDaysRange(rows, 'standard'), { min: 9, max: 14 });
  // Days set in the admin win over the code defaults.
  assert.deepEqual(speedDaysRange(tariffRows({ ...tariff, deliveryDays: { cn: [4, 6] } }), 'express'), { min: 4, max: 9 });
  // A region without days is left out, and no days at all give no range.
  const none = rows.map(row => ({ ...row, options: row.options.map(option => ({ ...option, days: null })) }));
  assert.equal(speedDaysRange(none, 'express'), null);
  const usOnly = rows.map(row => row.region.id === 'us' ? row : { ...row, options: row.options.map(option => ({ ...option, days: null })) });
  assert.deepEqual(speedDaysRange(usOnly, 'express'), { min: 5, max: 9 });
});

test('the "from" price copy has no Cyrillic in Uzbek or English', () => {
  for (const locale of ['uz', 'en']) assert.doesNotMatch(homeCopy[locale].tariffs.priceFrom('$1') + homeCopy[locale].tariffs.all + homeCopy[locale].tariffs.tableNote, /[Ѐ-ӿ]/, locale);
});
test('express lead: business days saved, per country and per end of the range', () => {
  // US 5–9 vs 9–14 saves 4–5; the other five 7–9 vs 9–14 save 2–5.
  assert.deepEqual(expressLead(tariffRows(tariff)), { min: 2, max: 5 });
  // The same saving everywhere: one number.
  const same = { ...tariff, deliveryDays: { us: [5, 9], uk: [5, 9], cn: [5, 9], de: [5, 9], it: [5, 9], es: [5, 9] }, standardDeliveryDays: { us: [8, 12], uk: [8, 12], cn: [8, 12], de: [8, 12], it: [8, 12], es: [8, 12] } };
  assert.deepEqual(expressLead(tariffRows(same)), { min: 3, max: 3 });
});

test('express lead: nothing is claimed when express is not faster somewhere, or no country has both speeds', () => {
  assert.equal(expressLead(tariffRows({ ...tariff, deliveryDays: { cn: [9, 14] } })), null);
  assert.equal(expressLead(tariffRows({ ...tariff, deliveryDays: { de: [7, 14] } })), null, 'the upper ends are equal');
  const rows = tariffRows(tariff);
  assert.equal(expressLead(rows.map(row => ({ ...row, options: row.options.map(option => ({ ...option, days: null })) }))), null);
  assert.equal(expressLead([]), null);
  // A country without days is left out, not counted as zero.
  const noUs = rows.map(row => row.region.id === 'us' ? { ...row, options: row.options.map(option => ({ ...option, days: null })) } : row);
  assert.deepEqual(expressLead(noUs), { min: 2, max: 5 });
});

test('express lead copy: the range with business days in every language', () => {
  assert.equal(homeCopy.ru.tariffs.faster('2–5', 5), 'На 2–5 рабочих дней быстрее');
  assert.equal(homeCopy.ru.tariffs.faster('2', 2), 'На 2 рабочих дня быстрее');
  assert.equal(homeCopy.ru.tariffs.faster('1', 1), 'На 1 рабочий день быстрее');
  assert.equal(homeCopy.uz.tariffs.faster('2–5', 5), '2–5 ish kuni tezroq');
  assert.equal(homeCopy.en.tariffs.faster('2–5', 5), '2–5 business days faster');
  assert.equal(homeCopy.en.tariffs.faster('1', 1), '1 business day faster');
  assert.equal(homeCopy.oz.tariffs.faster('2–5', 5), '2–5 иш куни тезроқ');
  // The phone table breaks only «Великобритания», at the syllable; the plain name stays for the cards and other pages.
  assert.equal(homeCopy.ru.tariffs.tableRegions.uk.replace(/\u00ad/g, ''), homeCopy.ru.tariffs.regions.uk);
  assert.equal(homeCopy.ru.tariffs.regions.uk.includes('\u00ad'), false);
});
