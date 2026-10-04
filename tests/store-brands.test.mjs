import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { supportedStoreRoots } from '../lib/importer/stores.ts';
import { storeLogoKeys } from '../lib/market/store-logos.ts';
import {
  brandKey, brandForHost, brandRegions, popularBrandKeys, storeBrands, storeCountryNames, storeFocusNames, storefrontLabel, unlistedStoreRoots,
} from '../lib/market/store-brands.ts';

test('every allowed store domain belongs to exactly one named brand', () => {
  assert.deepEqual(unlistedStoreRoots, []);
  const roots = storeBrands.flatMap((brand) => brand.storefronts.map((front) => front.root));
  assert.deepEqual([...roots].sort(), [...new Set(supportedStoreRoots)].sort());
  assert.equal(new Set(storeBrands.map((brand) => brand.key)).size, storeBrands.length);
  for (const brand of storeBrands) {
    assert.ok(brand.name.trim(), brand.key);
    assert.ok(storeFocusNames[brand.focus], brand.key);
    for (const front of brand.storefronts) assert.ok(storeCountryNames[front.country], front.root);
  }
  for (const key of popularBrandKeys) assert.ok(storeBrands.some((brand) => brand.key === key), key);
});

test('country storefronts of one store are grouped and named by country', () => {
  assert.equal(brandKey('amazon.co.uk'), 'amazon');
  assert.equal(brandKey('es.victoriassecret.com'), 'victoriassecret');
  assert.equal(brandKey('perfumeriasprimor.eu'), 'primor');
  assert.equal(brandKey('mi.com'), 'xiaomi');
  assert.equal(brandKey('oldnavy.gap.com'), 'oldnavy');
  assert.equal(brandKey('www.nike.com'), 'nike');
  const amazon = brandForHost('www.amazon.co.jp');
  assert.equal(amazon.storefronts[0].root, 'amazon.com', 'the main storefront comes first');
  assert.deepEqual([...brandRegions(amazon)].sort(), ['asia', 'eu', 'other', 'us']);
  assert.equal(storefrontLabel('amazon.com', 'ru'), 'Amazon');
  assert.equal(storefrontLabel('amazon.co.jp', 'ru'), 'Amazon · Япония');
  assert.equal(storefrontLabel('es.victoriassecret.com', 'uz'), 'Victoria’s Secret · Ispaniya');
  assert.equal(brandForHost('example.com'), undefined);
});

test('the logo list matches the files shipped in public/store-logos', () => {
  const files = readdirSync(new URL('../public/store-logos/', import.meta.url)).filter((name) => name.endsWith('.webp')).map((name) => name.slice(0, -5)).sort();
  assert.deepEqual([...storeLogoKeys].sort(), files);
  for (const key of storeLogoKeys) assert.ok(storeBrands.some((brand) => brand.key === key), `${key} has no brand`);
  assert.ok(storeBrands.filter((brand) => brand.logo).length >= 190, 'most brands have a logo');
});
