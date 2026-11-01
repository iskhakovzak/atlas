// Redesign stage 8 (1 November 2026): store pages (/stores/[slug]), the store row of the catalog and /delivery.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogCountsBySlug, storeBySlug, storePageIndexable, storePageRedirect, storeProductIds, storeSlugOfHost } from '../lib/market/store-pages.ts';
import { popularBrandKeys, storeBrands } from '../lib/market/store-brands.ts';
import { storeMetadata, publicMetadata, deliveryDescriptionRegions } from '../app/route-metadata.ts';
import { tariffRows } from '../lib/market/home-facts.ts';
import { tariff } from '../lib/market/domain.ts';
import { deliveryCopy } from '../lib/market/delivery-copy.ts';
import { storesCopy } from '../lib/market/stores-copy.ts';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('every store has a URL-safe slug, and a slug finds its store whatever the case', () => {
  for (const brand of storeBrands) assert.match(brand.key, /^[a-z0-9-]+$/, brand.key);
  assert.equal(storeBySlug('nike')?.name, 'Nike');
  assert.equal(storeBySlug('NIKE')?.key, 'nike');
  assert.equal(storeBySlug('no-such-store'), undefined);
  assert.equal(storeBySlug('%E0%A4%A'), undefined, 'a malformed escape is just an unknown store');
});

test('country storefronts share one store page; products are counted by it', () => {
  assert.equal(storeSlugOfHost('amazon.de'), 'amazon');
  assert.equal(storeSlugOfHost('www.amazon.com'), 'amazon');
  assert.equal(storeSlugOfHost('example.org'), '');
  const counts = catalogCountsBySlug([{ sourceUrl: 'https://www.nike.com/t/a' }, { sourceUrl: 'https://www.nike.com/t/b' }, { sourceUrl: 'https://amazon.de/dp/x' }, { store: 'amazon.com' }, { sourceUrl: 'https://example.org/x' }]);
  assert.equal(counts.get('nike'), 2);
  assert.equal(counts.get('amazon'), 2);
  assert.equal(counts.size, 2);
});

test('only stores with catalog products or popular ones are indexed; the rest are noindex, follow', () => {
  const quiet = storeBrands.find((brand) => !popularBrandKeys.includes(brand.key));
  assert.ok(quiet);
  assert.equal(storePageIndexable(quiet, 0), false);
  assert.equal(storePageIndexable(quiet, 3), true);
  assert.equal(storePageIndexable({ key: 'zara' }, 0), true);
  const facts = () => ({ days: '5–9 раб. дней', products: null });
  const indexed = storeMetadata({ slug: 'nike', name: 'Nike', domain: 'nike.com' }, facts, true, 'ru', 'uz');
  assert.equal(indexed.alternates.canonical, '/stores/nike?lang=ru');
  assert.equal(indexed.robots.index, true);
  assert.match(indexed.title, /^Nike с доставкой в Ташкент$/);
  assert.match(indexed.description, /nike\.com/);
  const hidden = storeMetadata({ slug: quiet.key, name: quiet.name, domain: quiet.storefronts[0].root }, facts, false, undefined, 'uz');
  assert.deepEqual(hidden.robots, { index: false, follow: true, googleBot: { index: false, follow: true } });
  assert.equal(hidden.alternates.canonical, '/stores/' + quiet.key);
});

test('store and delivery descriptions fit search snippets in every language', () => {
  for (const lang of ['uz', 'oz', 'ru', 'en']) {
    const meta = storeMetadata({ slug: 'saksfifthavenue', name: 'Saks Fifth Avenue', domain: 'saksfifthavenue.com' }, (locale) => ({ days: '5–9', products: storesCopy[locale].products(12) }), true, lang);
    assert.ok(meta.description.length <= 200, `${lang}: ${meta.description.length}`);
    const delivery = publicMetadata('delivery', lang);
    assert.equal(delivery.alternates.canonical, '/delivery?lang=' + lang);
  }
});

test('/delivery prints each country from the tariff, so a country priced apart shows its own price', () => {
  const pricing = { ...tariff, countryOverrides: { ...(tariff.countryOverrides ?? {}), 'Китай': { perKgUsd: 12 } } };
  const rows = tariffRows(pricing);
  const china = rows.find((row) => row.region.id === 'cn').options.find((option) => option.speed === 'express');
  const us = rows.find((row) => row.region.id === 'us').options.find((option) => option.speed === 'express');
  assert.notEqual(china.usd, us.usd);
  const view = source('app/delivery-view.tsx');
  assert.match(view, /tariffRows\(pricing\)/);
  assert.match(view, /combinedShipmentWeight\(kg\)/, 'the calculator bills the weight as an order does');
  for (const locale of ['ru', 'uz', 'oz', 'en']) assert.ok(deliveryCopy[locale].title && deliveryCopy[locale].weightRules.length === 3, locale);
});

test('the header, the footer and the home rates block lead to /delivery; the stores directory to store pages', () => {
  assert.match(source('app/marketplace.tsx'), /\['\/delivery','delivery',nav\.delivery\]/);
  assert.match(source('app/site-footer.tsx'), /href="\/delivery"/);
  const directory = source('app/stores-directory.tsx');
  assert.match(directory, /<Link className="store-tile" href=\{storePath\(brand\.key\)\}>/);
  assert.match(directory, /window\.location\.replace\(storePath\(brand\.key\)\)/, 'an old ?brand= link opens the store page');
  assert.doesNotMatch(directory, /StoreDialog/);
});

test('a store page without catalog products is only its header: no empty grid', () => {
  const view = source('app/catalog-view.tsx');
  assert.match(view, /const storeEmpty = Boolean\(store\) && \(catalogReady \? pool\.length === 0 : store\?\.count === 0\);/);
  assert.match(view, /\{!storeEmpty && <div className=\{'catalog-layout'/);
  assert.match(view, /mode === 'catalog' && !store && <CatalogStoreRow/);
});

// Review of stage 8 (1 November 2026).
test('old ?brand= links and another case reach the store page by a server redirect (middleware 308)', () => {
  const q = (text) => new URLSearchParams(text);
  assert.equal(storePageRedirect('/stores', q('brand=nike')), '/stores/nike');
  assert.equal(storePageRedirect('/stores', q('brand=NIKE&lang=ru&focus=shoes')), '/stores/nike?lang=ru', 'the language is kept, the directory filters are not');
  assert.equal(storePageRedirect('/stores', q('brand=no-such-store')), null, 'an unknown brand stays on the directory');
  assert.equal(storePageRedirect('/stores', q('focus=shoes')), null);
  assert.equal(storePageRedirect('/stores/NIKE', q('lang=en&cat=shoes')), '/stores/nike?lang=en&cat=shoes');
  assert.equal(storePageRedirect('/stores/nike', q('lang=en')), null, 'the page’s own address');
  assert.equal(storePageRedirect('/stores/no-such-store', q('')), null, 'an unknown store answers 404 itself');
  assert.equal(storePageRedirect('/stores/nike/extra', q('')), null);
  const middleware = source('middleware.ts');
  assert.match(middleware, /const store = storePageRedirect\(request\.nextUrl\.pathname, request\.nextUrl\.searchParams\);\n    if \(store\) return NextResponse\.redirect\(new URL\(store, request\.nextUrl\.origin\), 308\);/);
});

test('a store’s products are listed from the whole catalog, in its order', () => {
  const products = [{ id: 'a', sourceUrl: 'https://www.nike.com/t/a' }, { id: 'b', sourceUrl: 'https://amazon.de/x' }, { id: 'c', store: 'nike.com' }];
  assert.deepEqual(storeProductIds(products, 'nike'), ['a', 'c']);
  assert.deepEqual(storeProductIds(products, 'zara'), []);
});

test('a failed catalog read does not turn a store page noindex', () => {
  const page = source('app/stores/[slug]/page.tsx');
  assert.match(page, /const indexable = counts === null \|\| storePageIndexable\(brand, count\);/);
  // The description writes the days out in full, as the home rates table does.
  assert.match(page, /days: range \? deliveryCopy\[shown\]\.days\(range\[0\], range\[1\]\) : null/);
  assert.equal(deliveryCopy.ru.days(5, 9), '5–9 рабочих дней');
  assert.equal(deliveryCopy.ru.days(2, 3), '2–3 рабочих дня');
});

test('the /delivery description names the countries the page lists', () => {
  assert.deepEqual(tariffRows(tariff).map((row) => row.region.id), [...deliveryDescriptionRegions]);
});

test('Uzbek store title and copy: one title shape, «saytidan» after a domain', () => {
  const meta = storeMetadata({ slug: 'nike', name: 'Nike', domain: 'nike.com' }, () => ({ days: null, products: null }), true, 'uz', 'uz');
  assert.equal(meta.title, 'Nike: Toshkentga yetkazib berish');
  assert.equal(storesCopy.uz.pageTitle('Nike'), meta.title);
  assert.match(meta.description, /^nike\.com saytidan /);
  for (const text of [storesCopy.uz.linkFrom('nike.com'), storesCopy.uz.pageMissing('nike.com'), storesCopy.uz.pageEmpty('nike.com')]) assert.doesNotMatch(text, /nike\.com d(an|agi)/, text);
});

test('store page details: short field on phones, one column without a second card, return to the store after sign-in', () => {
  const css = source('app/styles/catalog-pages.css');
  assert.match(css, /@media \(max-width: 480px\) \{\n  \.store-link \.paste-button > span \{ position: absolute;/);
  assert.match(css, /\.store-page \.pcard-store \{ display: none; \}/);
  assert.match(css, /\.store-about-grid\.is-single \{ grid-template-columns: minmax\(0, 760px\); \}/);
  const about = source('app/store-page.tsx');
  assert.match(about, /const single = !fronts && !note;/);
  assert.doesNotMatch(about, /<dt>\{speed\.names\.express\}<\/dt>/, 'the days and price per kg are only in the header');
  assert.equal(storesCopy.ru.linkFrom('zara.com'), 'Ссылка с zara.com');
  const view = source('app/catalog-view.tsx');
  assert.match(view, /'\/login\?return_to=' \+ encodeURIComponent\(storeSlug \? storePath\(storeSlug\) : '\/catalog'\)/);
  assert.match(view, /storeName \? cc\.searchInStore\(storeName\)/);
});
