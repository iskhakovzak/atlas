import test from 'node:test';
import assert from 'node:assert/strict';
import { tariff, price, quote, repriceCart, blank } from '../lib/market/domain.ts';
import { catalogCategories } from '../lib/market/catalog-editor.ts';
import { catalogAllowance } from '../lib/market/allowance.ts';
import {
  categorySlugs, readCatalogQuery, catalogQueryString, emptyCatalogQuery, normalizeSize, compareSizes, productSizes,
  catalogItems, applyCatalogQuery, catalogFacets, relaxations, withoutFilter, activeFilterCount, parcelExtra, cartParcelStores, storeLabel,
} from '../lib/market/catalog-query.ts';

const base = { brand: 'Brand', country: 'США', image: 'https://example.com/i.jpg', variants: ['Уточнить вариант в магазине'], sourceShippingUsd: 10, sourceShippingEstimated: true, observedOn: '2026-10-01' };
const item = (id, overrides) => ({ ...base, id, name: id, store: 'x', category: 'Обувь', usd: 50, boxedWeight: 1, weight: 1.5, sourceUrl: `https://www.amazon.com/dp/${id}`, ...overrides });
const products = [
  item('runner', { usd: 60, sourceUrl: 'https://www.nike.com/t/runner', sourceVariants: [{ label: 'Black · US 9', size: 'US 9', available: true }, { label: 'Black · 10', size: '10', available: true }, { label: 'Black · 11', size: '11', available: false, availabilityKnown: true }] }),
  item('trail', { usd: 90, sourceVariants: [{ label: '9', size: '9', available: true, availabilityKnown: false }, { label: '12', size: '12', available: true }] }),
  item('hoodie', { category: 'Одежда', usd: 45, sourceVariants: [{ label: 'm', size: 'm', available: true }, { label: 'XS', size: 'XS', available: true }] }),
  item('gloss', { category: 'Красота и уход', usd: 3, boxedWeight: 0.1, weight: 1, priceNeedsConfirmation: true, sourcePrice: 3, sourceCurrency: 'USD' }),
  item('laptop', { category: 'Электроника', usd: 290, boxedWeight: 2.5, weight: 3, sourceUrl: 'https://www.ebay.com/itm/1' }),
];
const context = { dutyLimitUsd: 200 };
const items = catalogItems(products, tariff, []);

test('every catalog category has a URL slug', () => {
  for (const category of catalogCategories) assert.ok(categorySlugs[category], category);
  assert.equal(new Set(Object.values(categorySlugs)).size, Object.keys(categorySlugs).length);
});

test('catalog filters survive the URL and keep other parameters such as the language', () => {
  const query = { ...emptyCatalogQuery, q: 'nike air', category: 'Обувь', stores: ['nike.com', 'amazon.com'], price: '300k-600k', sizes: ['9', 'XS'], duty: true, sale: true, fresh: true, sort: 'cheap', collection: 'autumn-edit' };
  const text = catalogQueryString(query, new URLSearchParams('lang=uz&cat=old'));
  assert.equal(new URLSearchParams(text).get('lang'), 'uz');
  assert.equal(new URLSearchParams(text).get('cat'), 'shoes');
  assert.deepEqual(readCatalogQuery(text), query);
  assert.equal(catalogQueryString(emptyCatalogQuery), '');
  assert.equal(activeFilterCount(query), 10, 'every chosen value counts, the search does not');
});

test('unknown or oversized URL values are dropped instead of trusted', () => {
  const query = readCatalogQuery('cat=weapons&price=free&sort=random&set=../x&store=' + 'a'.repeat(70) + ',Nike.com&duty=yes&q=' + 'x'.repeat(200));
  assert.equal(query.category, '');
  assert.equal(query.price, '');
  assert.equal(query.sort, 'best');
  assert.equal(query.collection, '');
  assert.deepEqual(query.stores, ['nike.com']);
  assert.equal(query.duty, false);
  assert.equal(query.q.length, 80);
  assert.deepEqual(readCatalogQuery({ cat: ['beauty', 'shoes'], lang: 'ru' }).category, 'Красота и уход');
});

test('sizes from different US stores match and sort naturally', () => {
  assert.equal(normalizeSize('US 9'), '9');
  assert.equal(normalizeSize(' us  9,5 '), '9.5');
  assert.equal(normalizeSize('xs'), 'XS');
  assert.equal(normalizeSize('s tall'), 'S tall');
  assert.deepEqual(['L', '10', 'XS', '9.5', 'One size', 'M'].sort(compareSizes), ['9.5', '10', 'XS', 'M', 'L', 'One size']);
  // A size the store marked unavailable is not offered; an unconfirmed one still is.
  assert.deepEqual(productSizes(products[0]), ['9', '10']);
  assert.deepEqual(productSizes(products[1]), ['9', '12']);
});

test('filters combine, and each facet counts with the other filters applied', () => {
  const shoes = { ...emptyCatalogQuery, category: 'Обувь' };
  assert.deepEqual(applyCatalogQuery(items, shoes, context).map((entry) => entry.product.id).sort(), ['runner', 'trail']);
  const sized = { ...shoes, sizes: ['9'] };
  assert.equal(applyCatalogQuery(items, sized, context).length, 2);
  assert.equal(applyCatalogQuery(items, { ...sized, sizes: ['12'] }, context).length, 1);
  const facets = catalogFacets(items, { ...sized, stores: ['nike.com'] }, context);
  // The category facet ignores the category filter but keeps the store and size filters.
  assert.equal(facets.categories.get('Обувь'), 1);
  // The store facet ignores the store filter: both shoe stores stay selectable.
  assert.deepEqual(facets.stores, [['amazon.com', 1], ['nike.com', 1]]);
  // Sizes come only from the selected category.
  assert.deepEqual(facets.sizes.map(([size]) => size), ['9', '10']);
  assert.equal(facets.total, items.length);
});

test('search needs every word and also finds the store and translated category', () => {
  assert.deepEqual(applyCatalogQuery(items, { ...emptyCatalogQuery, q: 'ebay' }, context).map((entry) => entry.product.id), ['laptop']);
  assert.equal(applyCatalogQuery(items, { ...emptyCatalogQuery, q: 'nike trail' }, context).length, 0);
  const words = (entry) => entry.product.category === 'Одежда' ? 'Kiyim' : '';
  assert.deepEqual(applyCatalogQuery(items, { ...emptyCatalogQuery, q: 'kiyim' }, { ...context, words }).map((entry) => entry.product.id), ['hoodie']);
});

test('price bands use the delivered total, lower bound inclusive', () => {
  const totals = Object.fromEntries(items.map((entry) => [entry.product.id, entry.costs.total]));
  for (const entry of items) {
    const band = catalogFacets([entry], emptyCatalogQuery, context).prices;
    assert.equal([...band.values()].reduce((sum, value) => sum + value, 0), 1, `${entry.product.id} sits in exactly one band`);
  }
  const cheap = applyCatalogQuery(items, { ...emptyCatalogQuery, price: 'to-300k' }, context);
  assert.ok(cheap.every((entry) => entry.costs.total < 300_000));
  assert.ok(Object.values(totals).some((total) => total >= 600_000));
});

test('duty-free filter uses the product price against the remaining allowance', () => {
  const dutyFree = (limit) => applyCatalogQuery(items, { ...emptyCatalogQuery, duty: true }, { dutyLimitUsd: limit }).map((entry) => entry.product.id).sort();
  assert.deepEqual(dutyFree(200), ['gloss', 'hoodie', 'runner', 'trail']);
  assert.deepEqual(dutyFree(55), ['gloss', 'hoodie']);
  assert.deepEqual(dutyFree(0), []);
});

test('recommended order puts confirmed prices first, then discounts, then the lower total', () => {
  const ids = applyCatalogQuery(items, emptyCatalogQuery, context).map((entry) => entry.product.id);
  assert.equal(ids.at(-1), 'gloss');
  const cheap = applyCatalogQuery(items, { ...emptyCatalogQuery, sort: 'cheap' }, context).map((entry) => entry.costs.total);
  assert.deepEqual(cheap, [...cheap].sort((a, b) => a - b));
  const expensive = applyCatalogQuery(items, { ...emptyCatalogQuery, sort: 'expensive' }, context).map((entry) => entry.costs.total);
  assert.deepEqual(expensive, [...expensive].sort((a, b) => b - a));
  const newest = catalogItems([{ ...products[2], addedAt: 5 }, { ...products[0], addedAt: 9 }], tariff, []);
  assert.deepEqual(applyCatalogQuery(newest, { ...emptyCatalogQuery, sort: 'new' }, context).map((entry) => entry.product.id), ['runner', 'hoodie']);
});

test('an empty result suggests the single filter whose removal brings most products back', () => {
  const query = { ...emptyCatalogQuery, category: 'Обувь', sizes: ['XS'], duty: true };
  assert.equal(applyCatalogQuery(items, query, context).length, 0);
  const options = relaxations(items, query, context);
  // Dropping the category also drops its sizes, so it brings back every duty-free product.
  assert.deepEqual(options.map((option) => [option.key.kind, option.count]), [['category', 4], ['size', 2]]);
  assert.deepEqual(withoutFilter(query, { kind: 'category' }).sizes, []);
});

test('a product from a store already in the cart costs only what it adds to that parcel', () => {
  const now = Date.parse('2026-10-04T10:00:00Z');
  const inCart = products[1];
  const cart = [{ id: 'c1', product: inCart, variant: '9', quantity: 1, requestedServiceIds: [], quote: quote(inCart.usd, inCart.weight, now, 1, 10, tariff) }];
  assert.deepEqual(cartParcelStores(cart), ['amazon.com']);
  const gloss = products[3];
  const extra = parcelExtra(cart, gloss, 3, tariff, now);
  const sum = (list) => repriceCart(list, now, tariff).reduce((total, entry) => total + entry.quote.total, 0);
  const candidate = { id: 'catalog-preview', product: { ...gloss, usd: 3 }, variant: gloss.variants[0], quantity: 1, requestedServiceIds: [], quote: quote(3, gloss.weight, now, 1, 10, tariff) };
  assert.equal(extra.store, 'amazon.com');
  assert.equal(extra.extra, sum([...cart, candidate]) - sum(cart));
  // The light item shares the parcel's paid kilogram, so it costs less than on its own.
  assert.ok(extra.extra < price(3, gloss.weight, 1, 10, tariff).total);
  assert.equal(parcelExtra(cart, products[0], 60, tariff, now), null, 'another store ships separately');
  assert.equal(parcelExtra([], gloss, 3, tariff, now), null);
  assert.equal(parcelExtra(cart, gloss, undefined, tariff, now), null);
});

test('the catalog shows the allowance of the primary recipient', () => {
  const now = Date.parse('2026-10-15T10:00:00Z');
  const state = blank();
  assert.equal(catalogAllowance(state, tariff.fx, now), null);
  state.deliveryProfiles = [
    { id: 'a', label: 'Uy', recipient: 'Ali Valiyev', phone: '+998901234567', region: 'Toshkent', city: 'Toshkent', address: 'Amir Temur 1', postalCode: '', comment: '', primary: false },
    { id: 'b', label: 'Ish', recipient: 'Zarina Karimova', phone: '+998901234568', region: 'Toshkent', city: 'Toshkent', address: 'Navoiy 2', postalCode: '', comment: '', primary: true },
  ];
  // Bought and paid orders count in their month of import: a delivered one in its delivery month, one on its way now.
  const order = (recipient, usd, createdAt, deliveredAt) => ({ createdAt, cancelled: false, status: deliveredAt ? 5 : 1, history: deliveredAt ? [{ at: deliveredAt, text: 'Доставлен' }] : [], payment: { status: 'paid' }, deliveryProfileId: undefined, delivery: { recipient }, quote: { merchandise: usd * tariff.fx, fx: tariff.fx } });
  state.orders = [order('Zarina Karimova', 120, now - 86_400_000), order('Zarina Karimova', 999, Date.parse('2026-09-10T10:00:00Z'), Date.parse('2026-09-30T10:00:00Z')), order('Ali Valiyev', 50, now)];
  assert.deepEqual(catalogAllowance(state, tariff.fx, now), { name: 'Zarina Karimova', usedUsd: 120, remainingUsd: 80 });
});

test('store labels use brand names, name other storefronts by country and fall back to the domain', () => {
  assert.equal(storeLabel('zara.com'), 'Zara');
  assert.equal(storeLabel('brooksrunning.com'), 'Brooks Running');
  assert.equal(storeLabel('amazon.de'), 'Amazon · Германия');
  assert.equal(storeLabel('amazon.de', 'en'), 'Amazon · Germany');
  assert.equal(storeLabel('unknown-shop.example'), 'unknown-shop.example');
});
