import test from 'node:test';
import assert from 'node:assert/strict';
import { tariff, price, quote, repriceCart, blank } from '../lib/market/domain.ts';
import { catalogCategories } from '../lib/market/catalog-editor.ts';
import { catalogAllowance } from '../lib/market/allowance.ts';
import {
  categorySlugs, readCatalogQuery, catalogQueryString, emptyCatalogQuery, normalizeSize, compareSizes, productSizes,
  catalogItems, topDealThreshold, applyCatalogQuery, catalogFacets, relaxations, withoutFilter, activeFilterCount, parcelExtra, cartParcelStores, storeLabel, sameCatalogProduct,
  paginate, pageNumbers, facetGroupVisible, quickChips, quickChipActive, toggleQuickChip, productAttrs, productStockSizes, defaultPerPage,
} from '../lib/market/catalog-query.ts';
import { searchWords } from '../lib/market/catalog-synonyms.ts';

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
  const query = {
    ...emptyCatalogQuery, q: 'nike air', categories: ['Обувь', 'Одежда'], stores: ['nike.com', 'amazon.com'], brands: ['adidas'], priceMin: 300_000, priceMax: 600_000, sizes: ['9', 'XS'],
    attrs: { department: ['men', 'kids'], type: ['sneakers'], color: ['black', 'white'], pack: ['3'], storage: ['128gb'] },
    discount: 50, duty: true, fresh: true, stock: true, sort: 'discount', collection: 'autumn-edit', page: 3, per: 48,
  };
  const text = catalogQueryString(query, new URLSearchParams('lang=uz&cat=old&page=9'));
  const params = new URLSearchParams(text);
  assert.equal(params.get('lang'), 'uz');
  assert.equal(params.get('cat'), 'shoes,clothing');
  assert.equal(params.get('price'), '300000-600000');
  assert.equal(params.get('for'), 'men,kids');
  assert.equal(params.get('color'), 'black,white');
  assert.equal(params.get('mem'), '128gb');
  assert.equal(params.get('off'), '50');
  assert.equal(params.get('page'), '3');
  assert.equal(params.get('per'), '48');
  assert.deepEqual(readCatalogQuery(text), query);
  assert.equal(catalogQueryString(emptyCatalogQuery), '');
  // Page 1 and the default page size are not written; an open price end is.
  assert.equal(catalogQueryString({ ...emptyCatalogQuery, page: 1, per: defaultPerPage, priceMax: 300_000 }), '?price=-300000');
  assert.deepEqual(readCatalogQuery('price=150000-'), { ...emptyCatalogQuery, priceMin: 150_000 });
  assert.equal(activeFilterCount(query), 20, 'every chosen value counts, the search does not');
});

test('old links keep working: price bands become ranges, sale=1 is "any discount"', () => {
  assert.deepEqual([readCatalogQuery('price=to-300k').priceMin, readCatalogQuery('price=to-300k').priceMax], [0, 300_000]);
  assert.deepEqual([readCatalogQuery('price=600k-1m').priceMin, readCatalogQuery('price=600k-1m').priceMax], [600_000, 1_000_000]);
  assert.deepEqual([readCatalogQuery('price=from-2m').priceMin, readCatalogQuery('price=from-2m').priceMax], [2_000_000, 0]);
  assert.equal(readCatalogQuery('sale=1').discount, 1);
  assert.equal(catalogQueryString(readCatalogQuery('sale=1')), '?sale=1');
  assert.deepEqual(readCatalogQuery('cat=beauty').categories, ['Красота и уход']);
  // A reversed range is put in order; "stock" means nothing without a size.
  assert.deepEqual([readCatalogQuery('price=900000-100000').priceMin, readCatalogQuery('price=900000-100000').priceMax], [100_000, 900_000]);
  assert.equal(readCatalogQuery('stock=1').stock, false);
  assert.equal(readCatalogQuery('size=9&stock=1').stock, true);
});

test('unknown or oversized URL values are dropped instead of trusted', () => {
  const query = readCatalogQuery('cat=weapons&price=free&sort=random&set=../x&store=' + 'a'.repeat(70) + ',Nike.com&duty=yes&off=45&page=-2&per=1000&color=Black,<b>,' + 'x'.repeat(50) + '&q=' + 'x'.repeat(200));
  assert.deepEqual(query.categories, []);
  assert.equal(query.priceMin + query.priceMax, 0);
  assert.equal(query.discount, 0, 'only the offered thresholds');
  assert.equal(query.page, 1);
  assert.equal(query.per, defaultPerPage);
  assert.deepEqual(query.attrs, { color: ['black'] }, 'slugs only, lower-cased');
  assert.equal(query.sort, 'best');
  assert.equal(query.collection, '');
  assert.deepEqual(query.stores, ['nike.com']);
  assert.equal(query.duty, false);
  assert.equal(query.q.length, 80);
  assert.deepEqual(readCatalogQuery({ cat: ['beauty', 'shoes'], lang: 'ru' }).categories, ['Красота и уход']);
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
  const shoes = { ...emptyCatalogQuery, categories: ['Обувь'] };
  assert.deepEqual(applyCatalogQuery(items, shoes, context).map((entry) => entry.product.id).sort(), ['runner', 'trail']);
  const sized = { ...shoes, sizes: ['9'] };
  assert.equal(applyCatalogQuery(items, sized, context).length, 2);
  assert.equal(applyCatalogQuery(items, { ...sized, sizes: ['12'] }, context).length, 1);
  const facets = catalogFacets(items, { ...sized, stores: ['nike.com'] }, context);
  // The category facet ignores the category filter but keeps the store and size filters.
  assert.equal(facets.categories.get('Обувь'), 1);
  // The store facet ignores the store filter: both shoe stores stay selectable.
  assert.deepEqual(facets.stores, [['amazon.com', 1], ['nike.com', 1]]);
  // Sizes come only from the selected category, in the shoe group.
  assert.deepEqual(facets.sizes.shoes.map(([size]) => size), ['9', '10']);
  assert.deepEqual(facets.sizes.clothes, []);
  // Several categories are one OR group.
  assert.equal(applyCatalogQuery(items, { ...emptyCatalogQuery, categories: ['Обувь', 'Одежда'] }, context).length, 3);
  assert.equal(facets.total, items.length);
});

test('search needs every word and also finds the store and translated category', () => {
  assert.deepEqual(applyCatalogQuery(items, { ...emptyCatalogQuery, q: 'ebay' }, context).map((entry) => entry.product.id), ['laptop']);
  assert.equal(applyCatalogQuery(items, { ...emptyCatalogQuery, q: 'nike trail' }, context).length, 0);
  const words = (entry) => entry.product.category === 'Одежда' ? 'Kiyim' : '';
  assert.deepEqual(applyCatalogQuery(items, { ...emptyCatalogQuery, q: 'kiyim' }, { ...context, words }).map((entry) => entry.product.id), ['hoodie']);
});

test('search speaks the customer’s language: synonyms and Russian brand spellings through context.words, "ё" as "е", transliteration', () => {
  const spoken = { ...context, words: (entry) => searchWords(entry) };
  const find = (q, ctx = spoken) => applyCatalogQuery(items, { ...emptyCatalogQuery, q }, ctx).map((entry) => entry.product.id).sort();
  assert.deepEqual(find('кроссовки'), ['runner', 'trail']);
  assert.deepEqual(find('Найк'), ['runner']);
  assert.deepEqual(find('найк кроссовки'), ['runner']);
  assert.deepEqual(find('кроссовки', context), [], 'the synonyms come from context.words');
  // Transliteration needs no dictionary: "ибей" is listed, "ебей" too, and "лаптоп" is read as "laptop".
  assert.deepEqual(find('ебей'), ['laptop']);
  assert.deepEqual(find('лаптоп', context), ['laptop']);
  const yo = catalogItems([item('tree', { name: 'Ёлка искусственная' })], tariff);
  assert.equal(applyCatalogQuery(yo, { ...emptyCatalogQuery, q: 'елка' }, context).length, 1);
  assert.equal(applyCatalogQuery(yo, { ...emptyCatalogQuery, q: '  ЁЛКА   искусств ' }, context).length, 1);
});

test('the price range uses the delivered total, both ends inclusive, and its bounds ignore the range itself', () => {
  const totals = items.map((entry) => entry.costs.total).sort((a, b) => a - b);
  const [low, high] = [totals[1], totals[3]];
  const ranged = applyCatalogQuery(items, { ...emptyCatalogQuery, priceMin: low, priceMax: high }, context);
  assert.deepEqual(ranged.map((entry) => entry.costs.total).sort((a, b) => a - b), totals.slice(1, 4));
  assert.ok(applyCatalogQuery(items, { ...emptyCatalogQuery, priceMax: 300_000 }, context).every((entry) => entry.costs.total <= 300_000));
  const facets = catalogFacets(items, { ...emptyCatalogQuery, priceMin: low, priceMax: high }, context);
  assert.deepEqual([facets.price.min, facets.price.max, facets.price.count], [totals[0], totals.at(-1), totals.length]);
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

test('the operator’s storefront position comes before freshness; unranked products follow in the usual order', () => {
  const ranked = catalogItems([products[0], { ...products[3], rank: 0 }, { ...products[2], rank: 5 }, products[1], { ...products[4], rank: 2 }], tariff, []);
  assert.deepEqual(applyCatalogQuery(ranked, emptyCatalogQuery, context).map((entry) => entry.product.id), ['gloss', 'laptop', 'hoodie', 'runner', 'trail']);
  assert.equal(ranked[0].rank, undefined);
  assert.equal(ranked[1].rank, 0);
  // Other sorts ignore the position.
  const cheap = applyCatalogQuery(ranked, { ...emptyCatalogQuery, sort: 'cheap' }, context).map((entry) => entry.costs.total);
  assert.deepEqual(cheap, [...cheap].sort((a, b) => a - b));
});

test('items carry when the store last confirmed the snapshot, else the day it was observed', () => {
  const checked = catalogItems([item('a', { sourceCheckedAt: 1_700_000_000_000 }), item('b', { observedOn: '2026-09-13' }), item('c', { observedOn: undefined })], tariff, []);
  assert.deepEqual(checked.map((entry) => entry.checkedAt), [1_700_000_000_000, Date.parse('2026-09-13'), 0]);
});

test('by default the products themselves are the records, so an imported snapshot shows its store discount', () => {
  const sale = item('sale', { usd: 60, referenceUsd: 100 });
  const [withDiscount] = catalogItems([sale], tariff);
  assert.equal(withDiscount.discount, 40);
  assert.equal(withDiscount.referenceUsd, 100);
  assert.equal(catalogItems([sale], tariff, [])[0].discount, 0, 'explicit records still decide');
  // Owner, 12 October 2026: a dated USD snapshot keeps its discount (the card shows the date); another currency has none.
  assert.equal(catalogItems([{ ...sale, priceNeedsConfirmation: true, sourcePrice: 60, sourceCurrency: 'USD' }], tariff)[0].discount, 40, 'a dated USD price keeps its discount');
  assert.equal(catalogItems([{ ...sale, priceNeedsConfirmation: true, sourcePrice: 60, sourceCurrency: 'EUR' }], tariff)[0].discount, 0, 'a dated price in another currency has no discount');
});

test('an empty result suggests the single filter whose removal brings most products back', () => {
  const query = { ...emptyCatalogQuery, categories: ['Обувь'], sizes: ['XS'], duty: true };
  assert.equal(applyCatalogQuery(items, query, context).length, 0);
  const options = relaxations(items, query, context);
  // Dropping the category also drops its sizes, so it brings back every duty-free product.
  assert.deepEqual(options.map((option) => [option.key.kind, option.count]), [['category', 4], ['size', 2]]);
  assert.deepEqual(withoutFilter(query, { kind: 'category', value: 'Обувь' }).sizes, []);
});

// Products with facets as the import derives them (lib/market/catalog-facets.ts).
const faceted = catalogItems([
  item('ultra', { usd: 80, referenceUsd: 160, facets: { v: 1, department: 'men', type: 'sneakers', sport: 'running', colors: ['black', 'white'] }, sourceVariants: [{ label: '9', size: '9', available: true }, { label: '10', size: '10', available: true, availabilityKnown: false }] }),
  item('samba', { usd: 70, referenceUsd: 100, facets: { v: 1, department: 'unisex', type: 'sneakers', sport: 'lifestyle', colors: ['white'] }, sourceVariants: [{ label: '10', size: '10', available: true }] }),
  item('tee', { category: 'Одежда', usd: 20, referenceUsd: 25, facets: { v: 1, department: 'women', type: 'tshirts', colors: ['pink'], sleeve: 'short' } }),
  item('socks', { category: 'Одежда', usd: 12, facets: { v: 1, department: 'kids', type: 'socks', pack: 3, colors: ['white', 'Not a slug!'], fit: 42 } }),
  item('plain', { category: 'Одежда', usd: 30 }),
], tariff);

test('facets become filter values: unknown or malformed values are dropped, "men" and "women" include unisex', () => {
  assert.deepEqual(productAttrs(faceted[3].product), { department: ['kids'], type: ['socks'], pack: ['3'], color: ['white'] });
  assert.deepEqual(productAttrs(faceted[4].product), {});
  const ids = (query) => applyCatalogQuery(faceted, { ...emptyCatalogQuery, ...query }, context).map((entry) => entry.product.id).sort();
  assert.deepEqual(ids({ attrs: { department: ['men'] } }), ['samba', 'ultra']);
  assert.deepEqual(ids({ attrs: { department: ['women', 'kids'] } }), ['samba', 'socks', 'tee'], 'OR within a group');
  assert.deepEqual(ids({ attrs: { department: ['men'], color: ['black'] } }), ['ultra'], 'AND across groups');
  assert.deepEqual(ids({ attrs: { pack: ['3'] } }), ['socks']);
  const facets = catalogFacets(faceted, { ...emptyCatalogQuery, attrs: { color: ['white'] } }, context);
  // The colour group counts with every other filter but itself: every colour stays selectable.
  assert.deepEqual(Object.fromEntries(facets.attrs.color.values), { white: 3, black: 1, pink: 1 });
  assert.equal(facets.attrs.department.values.find(([value]) => value === 'men')[1], 2, 'men counts the unisex pair too');
});

test('a group shows only when it splits the products and a fifth of them have data; a chosen one always shows', () => {
  assert.equal(facetGroupVisible([['black', 5]], 5, 5), false, 'one value on every product does not split');
  assert.equal(facetGroupVisible([['black', 5], ['white', 5]], 5, 5), false, 'every value on every product does not split either');
  assert.equal(facetGroupVisible([['black', 3], ['white', 2]], 5, 5), true);
  assert.equal(facetGroupVisible([['128gb', 1], ['256gb', 1]], 2, 20), false, 'under 20 % of the products have it');
  assert.equal(facetGroupVisible([['128gb', 1], ['256gb', 3]], 4, 20), true, 'exactly 20 % is enough');
  assert.equal(facetGroupVisible([['black', 5]], 5, 5, 1), true);
  const facets = catalogFacets(faceted, emptyCatalogQuery, context);
  assert.equal(facets.attrs.type.visible, true);
  assert.equal(facets.attrs.sleeve.visible, true, '1 of 5 products has a sleeve: exactly a fifth');
  assert.equal(facets.attrs.pack.visible, true);
  assert.equal(catalogFacets(faceted, { ...emptyCatalogQuery, categories: ['Обувь'] }, context).attrs.sleeve.visible, false, 'no shoe has a sleeve');
  assert.equal(facets.attrs.storage.visible, false);
  // Without a category the sizes still show, grouped by shoes and clothing.
  assert.equal(facets.sizes.visible, true);
  assert.deepEqual(facets.sizes.shoes.map(([size, value]) => [size, value]), [['9', 1], ['10', 2]]);
});

test('discount filter and sort: thresholds count with the other filters, "Biggest discount" orders by it', () => {
  assert.deepEqual(faceted.map((entry) => entry.discount), [50, 30, 20, 0, 0]);
  const facets = catalogFacets(faceted, { ...emptyCatalogQuery, discount: 50 }, context);
  assert.deepEqual([...facets.discounts], [[1, 3], [30, 2], [50, 1], [70, 0]]);
  assert.deepEqual(applyCatalogQuery(faceted, { ...emptyCatalogQuery, discount: 30 }, context).map((entry) => entry.product.id), ['ultra', 'samba']);
  const order = applyCatalogQuery(faceted, { ...emptyCatalogQuery, sort: 'discount' }, context).map((entry) => entry.product.id);
  assert.deepEqual(order.slice(0, 3), ['ultra', 'samba', 'tee']);
  assert.deepEqual(order.slice(3), ['socks', 'plain'], 'no discount: cheaper first');
});

test('"size in stock" keeps only products where the chosen size is available now', () => {
  assert.deepEqual(productStockSizes(faceted[0].product), ['9'], 'a size of unknown availability is not "in stock"');
  const ids = (query) => applyCatalogQuery(faceted, { ...emptyCatalogQuery, ...query }, context).map((entry) => entry.product.id).sort();
  assert.deepEqual(ids({ sizes: ['10'] }), ['samba', 'ultra']);
  assert.deepEqual(ids({ sizes: ['10'], stock: true }), ['samba']);
  assert.equal(catalogFacets(faceted, { ...emptyCatalogQuery, sizes: ['10'] }, context).stock, 1);
  assert.equal(withoutFilter({ ...emptyCatalogQuery, sizes: ['10'], stock: true }, { kind: 'size', value: '10' }).stock, false, 'no size, no stock filter');
});

test('pages slice the result, clamp a page past the end and show gaps between page links', () => {
  const list = Array.from({ length: 307 }, (_, index) => index);
  const page = paginate(list, 2, 24);
  assert.deepEqual([page.page, page.pages, page.start, page.end, page.items[0], page.items.length], [2, 13, 24, 48, 24, 24]);
  const last = paginate(list, 99, 24);
  assert.deepEqual([last.page, last.start, last.end, last.items.length], [13, 288, 307, 19]);
  assert.deepEqual(paginate([], 4, 24), { page: 1, pages: 1, start: 0, end: 0, items: [] });
  assert.deepEqual(pageNumbers(1, 26), [1, 2, 'gap', 26]);
  assert.deepEqual(pageNumbers(5, 26), [1, 'gap', 4, 5, 6, 'gap', 26]);
  assert.deepEqual(pageNumbers(3, 26), [1, 2, 3, 4, 'gap', 26], 'a gap of one page shows the page');
  assert.deepEqual(pageNumbers(26, 26), [1, 'gap', 25, 26]);
  assert.deepEqual(pageNumbers(1, 1), [1]);
});

test('quick chips appear only when they narrow the pool without emptying it, and toggle one value', () => {
  const chips = quickChips(faceted, { ...context, collections: [{ id: 'all', productIds: faceted.map((entry) => entry.product.id) }, { id: 'pair', productIds: ['ultra'] }] });
  const ids = chips.map((chip) => chip.id);
  assert.ok(ids.includes('cat:Обувь') && ids.includes('cat:Одежда'));
  assert.ok(ids.includes('for:men') && ids.includes('for:kids'));
  assert.ok(ids.includes('off:50'));
  assert.ok(!ids.includes('price'), 'every product is under 300k: the chip would change nothing');
  assert.ok(ids.includes('set:pair') && !ids.includes('set:all'));
  const men = chips.find((chip) => chip.id === 'for:men');
  const on = toggleQuickChip(emptyCatalogQuery, men);
  assert.deepEqual(on.attrs, { department: ['men'] });
  assert.equal(quickChipActive(on, men), true);
  assert.deepEqual(toggleQuickChip(on, men).attrs, { department: [] });
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

test('a cart line made by the link order is the catalog product it came from', () => {
  const runner = { id: 'runner', sourceUrl: 'https://www.nike.com/t/runner' };
  // The link order keys a line by URL and option; tracking parameters, the hash and "www." do not matter.
  assert.ok(sameCatalogProduct({ id: 'https://www.nike.com/t/runner#Black · US 9', sourceUrl: 'https://www.nike.com/t/runner' }, runner));
  assert.ok(sameCatalogProduct({ id: 'x', sourceUrl: 'https://nike.com/t/runner?utm_source=atlas#top' }, runner));
  assert.equal(sameCatalogProduct({ id: 'x', sourceUrl: 'https://www.nike.com/t/other' }, runner), false);
  assert.equal(sameCatalogProduct({ id: 'x', sourceUrl: 'https://www.nike.com/t/runner?color=red' }, runner), false);
  // Products without a store link compare by id alone.
  assert.ok(sameCatalogProduct({ id: 'manual' }, { id: 'manual' }));
  assert.equal(sameCatalogProduct({ id: 'manual' }, { id: 'manual', sourceUrl: 'https://www.nike.com/t/runner' }), false);
});

test('"Top price" marks the best fifth by discount, never under 40 %', () => {
  // 10 items: the best fifth is 2; both are 40 %+ off.
  assert.equal(topDealThreshold([70, 66, 64, 64, 60, 58, 56, 55, 53, 41]), 66);
  // Few items still get one badge; ties at the threshold share it.
  assert.equal(topDealThreshold([50, 45]), 50);
  assert.deepEqual([70, 66, 66, 10].filter((d) => d >= topDealThreshold([70, 66, 66, 10])), [70]);
  // Nothing is 40 %+ off: no badge at all.
  assert.equal(topDealThreshold([39, 20, 0]), Infinity);
  // Only one item clears 40 %: it alone gets the badge, whatever the share says.
  assert.equal(topDealThreshold([45, 30, 20, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 45);
});

test('the admin queue names one reason and one action for a waiting card', async () => {
  const { catalogQueueVerdict } = await import('../lib/market/catalog-queue-verdict.ts');
  assert.deepEqual(catalogQueueVerdict('Название · Фото · Цена · Валюта · Страна отправки · Доступный вариант · Ошибка проверки магазина'), { text: 'Магазин не ответил — данных нет.', action: 'recheck', label: 'Перечитать' });
  assert.equal(catalogQueueVerdict('Страна отправки').action, 'edit');
  assert.equal(catalogQueueVerdict('Доступный вариант · Нет доступных вариантов').action, 'delete');
  assert.equal(catalogQueueVerdict('Опубликовано; уточняем у магазина: Магазин ещё не подтвердил полноту вариантов').action, undefined);
});

test('store health counts reads per store and says which stores fail', async () => {
  const { mergeStoreHealth, storeReadability } = await import('../lib/market/store-health.ts');
  let health = mergeStoreHealth({}, [
    { url: 'https://www.mango.com/a', result: 'failed', reason: 'blocked' }, { url: 'https://shop.mango.com/b', result: 'failed' },
    { url: 'https://tartecosmetics.com/x', result: 'ok' }, { url: 'https://tartecosmetics.com/y', result: 'partial', reason: 'country' },
    { url: 'not a url', result: 'ok' },
  ], 1);
  assert.equal(storeReadability(health['mango.com']), 'fails');
  assert.equal(health['mango.com'].reason, 'blocked');
  assert.equal(storeReadability(health['tartecosmetics.com']), 'partial');
  assert.equal(storeReadability(health['nike.com']), 'unknown');
  for (let i = 0; i < 60; i++) health = mergeStoreHealth(health, [{ url: 'https://tartecosmetics.com/z', result: 'ok' }], 2 + i);
  assert.equal(storeReadability(health['tartecosmetics.com']), 'reads');
  assert.ok(health['tartecosmetics.com'].ok + health['tartecosmetics.com'].partial <= 51, 'old reads fade');
  assert.equal(health['tartecosmetics.com'].reason, undefined);
});

test('store health keeps a phone link under its store', async () => {
  const { mergeStoreHealth } = await import('../lib/market/store-health.ts');
  assert.deepEqual(Object.keys(mergeStoreHealth({}, [{ url: 'https://m.zara.com/es/en/x-p1.html', result: 'failed' }, { url: 'https://www.zara.com/es/en/y-p2.html', result: 'ok' }], 1)), ['zara.com']);
});
