import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deliveryRegions, formCountries, formCountryOption, hasCountryTariff, otherCountry, tariffCountries } from '../lib/market/site-content.ts';
import { tariffRows } from '../lib/market/home-facts.ts';
import { pricingForCountry, tariff } from '../lib/market/domain.ts';

// Owner's iPhone (2 November 2026): the manual product form on /order-by-link.
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('the form offers the countries /delivery has a tariff for, «Другая страна» last', () => {
  const delivery = tariffRows(tariff).flatMap((row) => row.region.countries);
  assert.deepEqual(tariffCountries(), delivery, 'the same source as /delivery');
  assert.deepEqual(formCountries(), [...delivery, 'Другая страна']);
  assert.equal(formCountries().at(-1), otherCountry);
  for (const gone of ['Франция', 'Румыния', 'Турция', 'Япония', 'Южная Корея', 'ОАЭ', 'Канада', 'Австралия']) assert.ok(!formCountries().includes(gone), gone);
  assert.equal(deliveryRegions.length, 6);
});

test('a country an import names without a tariff shows as «Другая страна», keeps its name and the price the server gives it', () => {
  assert.equal(formCountryOption('США'), 'США');
  assert.equal(formCountryOption('Китай'), 'Китай');
  assert.equal(formCountryOption('Франция'), 'Другая страна');
  assert.equal(formCountryOption('Другая страна'), 'Другая страна');
  assert.equal(hasCountryTariff('Франция'), false);
  assert.equal(hasCountryTariff('Другая страна'), false);
  assert.equal(hasCountryTariff('Великобритания'), true);
  // The server prices such a country with the base tariff, as before (no invented per-country price).
  assert.equal(pricingForCountry(tariff, 'Франция'), tariff);
  const page = source('app/global-link-order.tsx');
  assert.match(page, /value=\{formCountryOption\(canonicalCountry\(country\)\)\}/);
  assert.match(page, /\{formCountries\(\)\.map\(\(value\) => <option/);
  // The name an import gave stays editable in «Другая страна», and the product keeps it (country === "Другая страна" ? otherCountry : country).
  assert.match(page, /value=\{country === "Другая страна" \? otherCountry : countryLabel\(canonicalCountry\(country\), lang\)\}/);
  assert.match(page, /\{!hasCountryTariff\(canonicalCountry\(country\)\) && <p id="ship-country-note"/);
  assert.match(page, /Точную стоимость Atlas подтвердит перед выкупом/);
});

test('the bar says what to fill in instead of «К оплате —», and its button stays a submit', () => {
  const page = source('app/global-link-order.tsx');
  assert.match(page, /<div className="pd-bar-ask"><span>\{k\.lines\.total\}<\/span><strong>\{name\.trim\(\) && !\(Number\(amount\) > 0\) \? tx\("Укажите цену товара"/);
  assert.match(page, /type="submit" form="link-order-form" className="btn primary" disabled=\{checking \|\| !orderable \|\| addBusy/);
  // The submit finds the first missing field, opens its block, scrolls to it and focuses it with its message.
  assert.match(page, /\{id:'amount',invalid:/);
  assert.match(page, /target\?\.focus\(\{preventScroll:true\}\);/);
});

test('pinned bars never float over a hidden bottom menu: they step aside while a field is focused, sit at the edge without a menu', () => {
  const mobile = source('app/mobile.css');
  assert.match(mobile, /:focus\) \.mobile-nav \{ display: none; \}/);
  assert.match(mobile, /select\):focus\) :is\(\.basket-sticky, \.co-paybar, \.pd-bar-sheet\) \{ display: none; \}/);
  assert.match(source('app/styles/link-pages.css'), /body:not\(:has\(\.mobile-nav\)\) \.basket-sticky \{ bottom: 0; padding-bottom: calc\(10px \+ env\(safe-area-inset-bottom\)\); \}/);
});
