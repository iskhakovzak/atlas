import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { officialBadgeLabel, officialListing } from '../lib/market/official-stores.ts';
import { brandForHost } from '../lib/market/store-brands.ts';

// Owner decision of 2 November 2026: one store plate on every product card and the product page; the verified mark only
// for the brand's own store.
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const at = (host, brand, extra = {}) => officialListing({ store: host, brand, sourceUrl: `https://${host}/p/1`, ...extra }, brandForHost(host));

test('the verified mark: the brand on its own site or its verified marketplace store, nothing else', () => {
  assert.equal(at('www.nike.com', 'Nike'), 'Nike');
  assert.equal(at('www.zara.com', 'ZARA'), 'Zara');
  assert.equal(at('www.adidas.com', 'adidas'), 'adidas');
  assert.equal(at('www.anker.com', 'Anker'), 'Anker');
  assert.equal(at('www.hm.com', 'H&M'), 'H&M', 'letters only');
  // A retailer selling another brand, a marketplace seller, a product without a brand: no mark.
  assert.equal(at('www.sephora.com', 'NYX Professional Makeup'), undefined);
  assert.equal(at('www.target.com', 'NYX'), undefined);
  assert.equal(at('www.amazon.com', 'Amazon Basics'), undefined, 'a marketplace is never «official»');
  assert.equal(at('www.nike.com', ''), undefined, 'never guessed without a brand');
  assert.equal(at('www.nike.com', 'adidas'), undefined);
  assert.equal(at('www.ebay.com', 'adidas'), undefined, 'anyone can sell adidas on eBay');
  // eBay: only every option sold by the verified adidas store (lib/market/official-stores.ts officialEbaySellers).
  assert.equal(at('www.ebay.com', 'adidas', { sourceSellerId: 'adidas_official' }), 'adidas');
  assert.equal(at('www.ebay.com', 'adidas', { sourceVariants: [{ label: 'a', available: true, sellerId: 'adidas_official' }, { label: 'b', available: true, sellerId: 'someone' }] }), undefined);
  for (const locale of ['ru', 'uz', 'oz', 'en']) assert.ok(officialBadgeLabel(locale).length > 5, locale);
  assert.equal(officialBadgeLabel('ru'), 'Официальный магазин бренда');
});

test('cards and the product page use one plate; the mark is only drawn for an official listing', () => {
  const card = source('app/catalog-card.tsx');
  assert.match(card, /const officialMark = officialListing\(\{ \.\.\.product, store: item\.store \}, storeBrand\);/);
  assert.match(card, /<StoreBadge brand=\{plateBrand\} size=\{30\} official=\{Boolean\(officialMark\)\}/);
  // The full card and the compact card (home shelves, «Вы смотрели») both carry it on the photo.
  assert.equal(card.match(/\{storeBadge\}/g).length, 2);
  const logo = source('app/store-logo.tsx');
  assert.match(logo, /\{official && <span className="store-badge-check" title=\{officialLabel\} aria-hidden="true">/);
  const css = source('app/stores.css');
  assert.match(css, /\.store-badge-plate \{[^}]*background: #fff;/);
  assert.match(css, /\.store-badge-check \{[^}]*background: #1f4d3b;/);
});
