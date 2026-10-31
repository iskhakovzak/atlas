import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importDraft, recheckedDraft, changeCatalog, catalogDraftSchema, catalogDocumentSchema, applyCatalogFacetBackfill, catalogCategoryIsAutomatic} from '../lib/market/catalog-editor.ts';
import {tariff} from '../lib/market/domain.ts';
import {compactSum} from '../lib/market/catalog-copy.ts';
import {catalogItems, applyCatalogQuery, catalogFacets, emptyCatalogQuery, readCatalogQuery, catalogQueryString, sizeChosen, toggleSize, withoutFilter} from '../lib/market/catalog-query.ts';

const now = Date.parse('2026-10-31T00:00:00Z');
const image = 'https://i.ebayimg.com/images/g/a/s-l1600.jpg';
const tee = (variants = [['Red', 'M'], ['Blue', 'M']]) => importDraft({sourceUrl: 'https://www.ebay.com/itm/960071970001', title: 'adidas men Essentials T-Shirt', brand: 'adidas', category: 'Одежда', price: 20, currency: 'USD', aspects: [{name: 'Department', value: 'Men'}, {name: 'Type', value: 'T-Shirt'}], image, variants: variants.map(([color, size], i) => ({id: `v1|960071970001|${i}`, label: `${color} · ${size}`, color, size, available: true, availabilityKnown: true, price: 20})), warnings: []}, [], 'США', now);

test('removing a colour from a published card takes it out of the public card\'s facets too', () => {
  const draft = tee();
  assert.deepEqual([...draft.facets.colors].sort(), ['blue', 'red']);
  const doc = {revision: 1, collections: [], entries: [{id: 'tee', draft, published: structuredClone(draft), publishedAt: now, queueState: 'published'}]};
  const sent = catalogDraftSchema.parse({...structuredClone(draft), excludedOptions: {colors: ['Red'], sizes: []}});
  const entry = changeCatalog(doc, {kind: 'edit', id: 'tee', draft: sent}, now).entries[0];
  assert.deepEqual(entry.published.variants.map(v => v.color), ['Blue']);
  assert.deepEqual(entry.published.facets.colors, ['blue']);
  assert.deepEqual(entry.draft.facets.colors, ['blue']);
});

test('a recheck derives facets from the options the card keeps, not the store\'s full answer', () => {
  const previous = {...tee(), excludedOptions: {colors: ['Red'], sizes: []}};
  const updated = recheckedDraft(previous, tee());
  assert.deepEqual(updated.variants.map(v => v.color), ['Blue']);
  assert.deepEqual(updated.facets.colors, ['blue']);
});

test('a category an editor fixed before facets existed is kept and becomes the editor\'s', () => {
  const base = {sourceUrl: 'https://www.ebay.com/itm/960000000077', name: 'adidas Tiro Gloves', brand: 'adidas', image, images: [image], price: 10, currency: 'USD', country: 'США', boxedWeight: 1.2, weightBasis: 'estimate', sourceShippingUsd: 0, sourceShippingEstimated: false, variants: [{id: 'v1|960000000077|0', label: 'Black · M', color: 'Black', size: 'M', available: true, price: 10}], collectionIds: [], description: '', checkedAt: now, warnings: []};
  const fixed = catalogDraftSchema.parse({...base, category: 'Спорт'}), legacy = catalogDraftSchema.parse({...base, category: 'Обувь'});
  assert.equal(catalogCategoryIsAutomatic(fixed), false);
  assert.equal(catalogCategoryIsAutomatic(legacy), true, 'eBay\'s "Clothing, Shoes & ..." root read as shoes');
  const entries = [['fixed', fixed], ['legacy', legacy]].map(([id, draft]) => ({id, draft, published: structuredClone(draft), publishedAt: now, queueState: 'published', origin: 'operator-import'}));
  const doc = catalogDocumentSchema.parse({revision: 1, collections: [], entries});
  applyCatalogFacetBackfill(doc, ['fixed', 'legacy']);
  const [kept, moved] = doc.entries;
  assert.equal(kept.draft.category, 'Спорт');assert.equal(kept.published.category, 'Спорт');
  assert.equal(kept.draft.categoryBasis, 'operator', 'a later recheck keeps it too');
  assert.notEqual(moved.draft.category, 'Обувь');assert.equal(moved.draft.categoryBasis, undefined);
  const rechecked = recheckedDraft({...fixed, facets: undefined}, {...legacy, category: 'Аксессуары', facets: {v: 1, type: 'gloves'}});
  assert.equal(rechecked.category, 'Спорт');assert.equal(rechecked.categoryBasis, 'operator');
});

const base = {brand: 'Brand', country: 'США', image: 'https://example.com/i.jpg', variants: ['x'], sourceShippingUsd: 10, sourceShippingEstimated: true, observedOn: '2026-10-01'};
const item = (id, category, sizes) => ({...base, id, name: id, store: 'x', category, usd: 50, boxedWeight: 1, weight: 1.5, sourceUrl: `https://www.amazon.com/dp/${id}`, sourceVariants: sizes.map(size => ({label: size, size, available: true}))});
const items = catalogItems([item('shoe', 'Обувь', ['9', '10']), item('pants', 'Одежда', ['8', '10']), item('phone', 'Электроника', ['10', '128GB'])], tariff);
const context = {dutyLimitUsd: 200};
const ids = (sizes) => applyCatalogQuery(items, {...emptyCatalogQuery, sizes}, context).map(entry => entry.product.id).sort();

test('a size belongs to its list: shoe 10 and trouser 10 are different filters; other categories have no sizes', () => {
  assert.deepEqual(ids(['shoes:10']), ['shoe']);
  assert.deepEqual(ids(['clothes:10']), ['pants']);
  assert.deepEqual(ids(['10']), ['pants', 'shoe'], 'an old unprefixed link matches either list');
  const facets = catalogFacets(items, emptyCatalogQuery, context);
  assert.deepEqual(facets.sizes.shoes, [['9', 1], ['10', 1]]);
  assert.deepEqual(facets.sizes.clothes, [['8', 1], ['10', 1]], 'the phone\'s "128GB" is not a clothing size');
  const query = readCatalogQuery('size=shoes:10,clothes:M');
  assert.deepEqual(query.sizes, ['shoes:10', 'clothes:M']);
  assert.equal(catalogQueryString(query), '?size=shoes%3A10%2Cclothes%3AM');
  assert.equal(sizeChosen(query.sizes, 'shoes', '10'), true);assert.equal(sizeChosen(query.sizes, 'clothes', '10'), false);
  assert.deepEqual(toggleSize(['10'], 'shoes', '10'), [], 'an old value is dropped, not doubled');
  assert.deepEqual(toggleSize(query.sizes, 'clothes', '10'), ['shoes:10', 'clothes:M', 'clothes:10']);
  assert.deepEqual(withoutFilter(query, {kind: 'size', value: 'shoes:10'}).sizes, ['clothes:M']);
});

test('a bound just under a million prints as a million', () => {
  assert.equal(compactSum(999_600, 'ru'), '1 млн');
  assert.equal(compactSum(999_600, 'en'), '1m');
  assert.equal(compactSum(300_000, 'uz'), '300 ming');
});

test('the background facet write starts only from read-only catalog reads', () => {
  const server = readFileSync(new URL('../lib/market/catalog-server.ts', import.meta.url), 'utf8');
  assert.match(server, /if\(options\?\.backfill\)scheduleCatalogFacetBackfill/);
  assert.match(server, /DELETE FROM market_rate_limits WHERE key=\? AND count=\?/, 'a run releases only its own lease');
});
