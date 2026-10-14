import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryPerKgUsdFor, deliverySpeeds, tariff } from '../lib/market/domain.ts';
import { deliveryDaysFor, deliveryRegions } from '../lib/market/site-content.ts';
import { homeCopy } from '../lib/market/home-copy.ts';
import { expressDayGroups, expressLead, factDays, factDaysNote, factPrice, speedPriceRange, tariffRows } from '../lib/market/home-facts.ts';

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

test('the facts row says "from" only when the regions have different prices', () => {
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

test('express days are grouped: the US 5–9 first and alone, the other five 7–9', () => {
  const rows = tariffRows(tariff);
  assert.deepEqual(expressDayGroups(rows), [
    { days: [5, 9], regions: ['us'] },
    { days: [7, 9], regions: ['uk', 'cn', 'de', 'it', 'es'] },
  ]);
  assert.deepEqual(factDays(rows), { days: [5, 9], regions: ['us'], lead: 'us' });
  // Days set in the admin win over the code defaults.
  assert.deepEqual(expressDayGroups(tariffRows({ ...tariff, deliveryDays: { cn: [4, 6] } }))[0], { days: [4, 6], regions: ['cn'] });
});

test('the days cell never pairs one range with all six flags', () => {
  const same = tariffRows({ ...tariff, deliveryDays: { us: [7, 9] } });
  const groups = expressDayGroups(same);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].regions.length, 6);
  assert.equal(factDays(same).lead, null, 'no leading flag when the fastest group has several regions');
});

test('the days note says what the days are before the countries, so a narrow cell cuts only the list', () => {
  const rows = tariffRows(tariff);
  assert.equal(factDaysNote(factDays(rows), 'ru'), 'экспресс, от склада · США');
  assert.equal(factDaysNote(factDays(rows), 'uz'), 'ekspress, ombordan · AQSh');
  assert.equal(factDaysNote(factDays(rows), 'en'), 'express, from warehouse · USA');
  // Two countries or more in the fastest group (days set in the admin): the qualifier still comes first.
  const two = factDays(tariffRows({ ...tariff, deliveryDays: { uk: [5, 9] } }));
  assert.deepEqual(two.regions, ['us', 'uk']);
  assert.equal(factDaysNote(two, 'ru'), 'экспресс, от склада · США, Великобритания');
  const six = factDays(tariffRows({ ...tariff, deliveryDays: { us: [7, 9] } }));
  for (const locale of ['ru', 'uz', 'en']) {
    const c = homeCopy[locale];
    assert.ok(factDaysNote(six, locale).startsWith(`${c.tariffs.speeds.express.toLocaleLowerCase(locale)}, ${c.wide.fromWarehouse} · `), locale);
  }
});

test('a region without express days is left out of the groups', () => {
  const rows = tariffRows(tariff).map(row => row.region.id === 'us'
    ? { ...row, options: row.options.map(option => option.speed === 'express' ? { ...option, days: null } : option) }
    : row);
  assert.deepEqual(expressDayGroups(rows), [{ days: [7, 9], regions: ['uk', 'cn', 'de', 'it', 'es'] }]);
  const none = rows.map(row => ({ ...row, options: row.options.map(option => ({ ...option, days: null })) }));
  assert.deepEqual(expressDayGroups(none), []);
  assert.equal(factDays(none), null);
});

test('wide-screen copy: units agree with the count and nothing Cyrillic leaks into Uzbek or English', () => {
  assert.equal(homeCopy.ru.wide.storesUnit(207), 'магазинов');
  assert.equal(homeCopy.ru.wide.storesUnit(1), 'магазин');
  assert.equal(homeCopy.ru.wide.countriesUnit(6), 'стран');
  assert.equal(homeCopy.ru.wide.countriesUnit(3), 'страны');
  assert.equal(homeCopy.ru.wide.daysUnit(9), 'рабочих дней');
  assert.equal(homeCopy.en.wide.storesUnit(1), 'store');
  assert.equal(homeCopy.en.wide.countriesUnit(6), 'countries');
  assert.equal(homeCopy.uz.wide.countriesUnit(6), 'ta davlat');
  for (const locale of ['uz', 'en']) {
    const wide = homeCopy[locale].wide;
    const text = JSON.stringify(wide) + wide.storesUnit(207) + wide.countriesUnit(6) + wide.priceFrom('$1') + wide.daysUnit(9);
    assert.doesNotMatch(text, /[Ѐ-ӿ]/, `${locale}: no Cyrillic`);
  }
  assert.equal(homeCopy.ru.wide.stepCheck.length, 2);
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
  // The phone table breaks only «Великобритания», at the syllable; the plain name stays for the canvas and the facts row.
  assert.equal(homeCopy.ru.tariffs.tableRegions.uk.replace(/\u00ad/g, ''), homeCopy.ru.tariffs.regions.uk);
  assert.equal(homeCopy.ru.tariffs.regions.uk.includes('\u00ad'), false);
});
