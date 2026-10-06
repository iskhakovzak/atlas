import test from 'node:test';
import assert from 'node:assert/strict';
import { tariff } from '../lib/market/domain.ts';
import { deliveryRegions } from '../lib/market/site-content.ts';
import { storeBrands, storeCountryNames } from '../lib/market/store-brands.ts';
import { regionCountryCode, regionForCountryLabel, storeCountryTerms, storeGeo } from '../lib/market/store-geo.ts';

const codes = Object.keys(storeCountryNames);

test('every store country has geography: six dispatch regions, no US fallback, a currency each', () => {
  assert.equal(codes.length, 32);
  assert.deepEqual(Object.keys(storeGeo).sort(), [...codes].sort());
  const withRegion = codes.filter((code) => storeGeo[code].region !== null);
  assert.deepEqual(withRegion.sort(), ['cn', 'de', 'es', 'it', 'uk', 'us']);
  for (const code of codes) {
    const geo = storeGeo[code];
    assert.match(geo.currency, /^[A-Z]{3}$/, code);
    if (geo.region) assert.equal(regionCountryCode(geo.region), code);
  }
  for (const code of ['fr', 'nl', 'at', 'be', 'ie']) assert.equal(storeGeo[code].currency, 'EUR', code);
  assert.equal(storeGeo.us.currency, 'USD');
  assert.equal(storeGeo.uk.currency, 'GBP');
  assert.equal(storeGeo.se.currency, 'SEK');
  assert.equal(storeGeo.dk.currency, 'DKK');
  assert.equal(storeGeo.pl.currency, 'PLN');
  assert.equal(storeGeo.ch.currency, 'CHF');
  assert.equal(storeGeo.cz.currency, 'CZK');
  assert.equal(storeGeo.ca.currency, 'CAD');
  assert.equal(storeGeo.au.currency, 'AUD');
  assert.equal(storeGeo.jp.currency, 'JPY');
  assert.equal(storeGeo.kr.currency, 'KRW');
  assert.equal(storeGeo.tr.currency, 'TRY');
  assert.equal(storeGeo.ae.currency, 'AED');
  assert.equal(storeGeo.cn.currency, 'CNY');
  assert.equal(storeGeo.ph.currency, 'PHP');
  assert.equal(storeGeo.hk.currency, 'HKD');
  assert.equal(storeGeo.my.currency, 'MYR');
  assert.equal(storeGeo.sg.currency, 'SGD');
  assert.equal(storeGeo.nz.currency, 'NZD');
  assert.equal(storeGeo.in.currency, 'INR');
  assert.equal(storeGeo.mx.currency, 'MXN');
  assert.equal(storeGeo.br.currency, 'BRL');
  assert.equal(storeGeo.ar.currency, 'ARS');
  assert.equal(storeGeo.tw.currency, 'TWD');
  // Every storefront country in the directory is covered, so the tiles never miss a flag or currency.
  for (const brand of storeBrands) for (const front of brand.storefronts) assert.ok(storeGeo[front.country], front.root);
});

test('each delivery region maps back to its store country and label', () => {
  for (const region of deliveryRegions) {
    const code = regionCountryCode(region.id);
    assert.equal(storeGeo[code].region, region.id);
    assert.equal(regionForCountryLabel(region.countries[0]), region.id);
    assert.equal(storeCountryNames[code].ru, region.countries[0], 'the Russian country name is the tariff label');
  }
  assert.equal(regionForCountryLabel('США'), 'us');
  assert.equal(regionForCountryLabel('Германия'), 'de');
  assert.equal(regionForCountryLabel('Франция'), null, 'no US fallback for a country without a route');
  assert.equal(regionForCountryLabel('Другая страна'), null);
  assert.equal(regionForCountryLabel(undefined), null);
  assert.equal(regionForCountryLabel(''), null);
});

test('terms of a country with a route: express 5–9 at $15,98/kg from the US, standard 9–14 at $13,98/kg', () => {
  const us = storeCountryTerms(tariff, 'us', 'ru');
  assert.equal(us.region, 'us');
  assert.equal(us.expressDays, '5–9 раб. дней');
  assert.equal(us.expressPerKg, '$15,98/кг');
  assert.equal(us.standardDays, '9–14 раб. дней');
  assert.equal(us.standardPerKg, '$13,98/кг');
  assert.equal(us.currency, 'USD');
  assert.equal(us.currencySupported, true);

  const de = storeCountryTerms(tariff, 'de', 'en');
  assert.equal(de.expressDays, '7–9 business days');
  assert.equal(de.expressPerKg, '$15.98/kg');
  assert.equal(de.standardDays, '9–14 business days');
  assert.equal(de.currency, 'EUR');
  assert.equal(de.currencySupported, true, 'EUR has an FX rate');

  const uz = storeCountryTerms(tariff, 'cn', 'uz');
  assert.equal(uz.expressDays, '7–9 ish kuni');
  assert.equal(uz.expressPerKg, '$15,98/kg');
});

test('terms follow the tariff: admin windows and per-country rates, no digits without a route', () => {
  const custom = { ...tariff, deliveryDays: { us: [4, 6] }, standardDeliveryDays: { us: [10, 12] }, countryOverrides: { 'США': { perKgUsd: 17.25, standardPerKgUsd: 12 } } };
  const us = storeCountryTerms(custom, 'us', 'ru');
  assert.equal(us.expressDays, '4–6 раб. дней');
  assert.equal(us.standardDays, '10–12 раб. дней');
  assert.equal(us.expressPerKg, '$17,25/кг');
  assert.equal(us.standardPerKg, '$12/кг');
  // The override of one country leaves the others on the base tariff.
  assert.equal(storeCountryTerms(custom, 'de', 'ru').expressPerKg, '$15,98/кг');

  const fr = storeCountryTerms(tariff, 'fr', 'ru');
  assert.deepEqual(fr, { region: null, expressDays: null, expressPerKg: null, standardDays: null, standardPerKg: null, currency: 'EUR', currencySupported: true });
  const se = storeCountryTerms(tariff, 'se', 'ru');
  assert.equal(se.region, null);
  assert.equal(se.currency, 'SEK');
  assert.equal(se.currencySupported, false, 'no SEK rate yet');
  // A rate added by the operator makes the currency quotable.
  assert.equal(storeCountryTerms({ ...tariff, rates: { ...tariff.rates, SEK: 0.095 } }, 'se', 'ru').currencySupported, true);
});
