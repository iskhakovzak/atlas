import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogDraftSchema, catalogDocumentSchema, catalogEntryNeedsFacets, poorCatalogFacets, planCatalogFacetBackfill, applyCatalogFacetBackfill, catalogFacetNetworkBatch, initialCatalog} from '../lib/market/catalog-editor.ts';
import {catalogFacetsVersion} from '../lib/market/catalog-facets.ts';

const now = Date.parse('2026-10-31T00:00:00Z');
// A card as prod stored it before facets: every eBay apparel listing "Обувь" with the 1.2 kg shoe estimate.
function legacyDraft(id, name, overrides = {}) {
  return catalogDraftSchema.parse({
    sourceUrl: `https://www.ebay.com/itm/${id}`, name, brand: 'adidas', category: 'Обувь',
    image: 'https://i.ebayimg.com/images/g/a/s-l1600.jpg', images: ['https://i.ebayimg.com/images/g/a/s-l1600.jpg'],
    price: 6, currency: 'USD', referencePrice: 16, country: 'США', boxedWeight: 1.2, weightBasis: 'estimate',
    sourceShippingUsd: 0, sourceShippingEstimated: false, variantScope: 'item', variantsComplete: true,
    variants: [{id: `v1|${id}|0`, productId: id, sellerId: 'adidas_official', options: [{name: 'Size', value: 'M'}], label: 'White / Clear Onix · M', size: 'M', available: true, availabilityKnown: true, price: 6, quantity: 8}],
    collectionIds: ['sale'], description: '', checkedAt: now, warnings: [], rank: 3,
    ...overrides,
  });
}
function entry(id, draft, extra = {}) {
  return {id, draft, published: structuredClone(draft), publishedAt: now - 1000, createdAt: now - 2000, origin: 'operator-import', queueState: 'published', autoManaged: true, ...extra};
}
function document(entries) {
  return catalogDocumentSchema.parse({revision: 7, collections: [{id: 'sale', name: 'Sale', visible: true, position: 0}], entries});
}
const jersey = () => legacyDraft('960011111111', 'adidas men Tabela 23 Jersey', {variants: [{id: 'v1|960011111111|1', productId: '960011111111', options: [{name: 'Color', value: 'Team Navy Blue 2 / White'}, {name: 'Size', value: 'S'}, {name: 'Department', value: 'men'}, {name: 'Type', value: 'Jerseys'}], label: 'Team Navy Blue 2 / White · S', color: 'Team Navy Blue 2 / White', size: 'S', available: true, availabilityKnown: true, price: 18}]});

test('only cards without current facets need work, in the draft or the public copy', () => {
  const fresh = legacyDraft('960000000001', 'adidas women Cushioned Quarter Socks 3 Pairs');
  assert.equal(catalogEntryNeedsFacets(entry('a', fresh)), true);
  const current = {...fresh, facets: {v: catalogFacetsVersion, type: 'socks'}};
  assert.equal(catalogEntryNeedsFacets(entry('b', current)), false);
  assert.equal(catalogEntryNeedsFacets({...entry('c', current), published: fresh}), true, 'a public copy from before facets');
  assert.equal(catalogEntryNeedsFacets(entry('d', {...fresh, facets: {v: catalogFacetsVersion - 1, type: 'socks'}})), true, 'an older derivation');
  assert.equal(catalogEntryNeedsFacets({id: 'e', draft: current}), false, 'an unpublished draft with current facets');
  assert.equal(poorCatalogFacets({v: 1}), true);
  assert.equal(poorCatalogFacets({v: 1, type: 'tshirts'}), true, 'clothes need "for whom"');
  assert.equal(poorCatalogFacets({v: 1, type: 'tshirts', department: 'men'}), false);
  assert.equal(poorCatalogFacets({v: 1, type: 'headphones'}), false, 'electronics have no "for whom"');
});

test('the plan derives cards offline and re-reads only poor eBay cards, a few per run', () => {
  const lanyards = Array.from({length: catalogFacetNetworkBatch + 2}, (_, i) => entry('lanyard-' + i, legacyDraft('96003528863' + i, 'adidas Midrange 2.0', {variants: [{id: `v1|96003528863${i}|0`, options: [{name: 'Size', value: 'One Size'}], label: 'Light Blue / White · One Size', available: true, availabilityKnown: true, price: 8}]})));
  const nike = entry('nike', legacyDraft('x', 'Mystery Item', {sourceUrl: 'https://www.nike.com/t/mystery/AB1234-001'}));
  const done = entry('done', {...jersey(), facets: {v: catalogFacetsVersion, type: 'jerseys', department: 'men'}});
  const plan = planCatalogFacetBackfill(document([entry('socks', legacyDraft('960000000001', 'adidas women Cushioned Quarter Socks 3 Pairs')), ...lanyards, nike, done]));
  assert.deepEqual(plan.offline, ['socks', 'nike'], 'well-described and non-eBay cards are derived from stored data');
  assert.equal(plan.network.length, catalogFacetNetworkBatch);
  assert.ok(plan.network.every(id => id.startsWith('lanyard-')));
  const reread = entry('read', legacyDraft('960035288639', 'adidas Midrange 2.0', {aspects: [{name: 'Brand', value: 'adidas'}]}));
  assert.deepEqual(planCatalogFacetBackfill(document([reread])).offline, ['read'], 'a card already read with its specifics is not read again');
});

test('backfill corrects the category and an estimated weight, and nothing the customer pays or the editor set', () => {
  const doc = document([
    entry('socks', legacyDraft('960000000001', 'adidas women Cushioned Quarter Socks 3 Pairs')),
    entry('jersey', jersey()),
    entry('weighed', legacyDraft('960000000002', 'adidas men Essentials T-Shirt', {boxedWeight: 0.5, weightBasis: 'operator'})),
    entry('legacy-weight', legacyDraft('960000000003', 'adidas kids Tiro Shorts', {weightBasis: undefined})),
    entry('chosen', legacyDraft('960000000004', 'adidas men Running Socks 6 Pairs', {category: 'Спорт', categoryBasis: 'operator'})),
  ]);
  const before = structuredClone(doc);
  const changed = applyCatalogFacetBackfill(doc, doc.entries.map(e => e.id));
  assert.equal(changed, 5);assert.equal(doc.revision, before.revision + 1);
  const byId = Object.fromEntries(doc.entries.map(e => [e.id, e]));

  for (const snapshot of [byId.socks.draft, byId.socks.published]) {
    assert.equal(snapshot.facets.v, catalogFacetsVersion);
    assert.equal(snapshot.facets.type, 'socks');assert.equal(snapshot.facets.department, 'women');assert.equal(snapshot.facets.pack, 3);
    assert.deepEqual(snapshot.facets.colors, ['white']);
    assert.equal(snapshot.category, 'Одежда');assert.equal(snapshot.boxedWeight, 0.25);
  }
  assert.equal(byId.jersey.published.category, 'Одежда');assert.equal(byId.jersey.published.facets.type, 'jerseys');assert.equal(byId.jersey.published.boxedWeight, 0.35);
  assert.equal(byId.weighed.draft.boxedWeight, 0.5, 'an operator weight stays');assert.equal(byId.weighed.draft.category, 'Одежда');
  assert.equal(byId['legacy-weight'].draft.boxedWeight, 1.2, 'a weight of unknown origin may be the editor\'s and stays');
  assert.equal(byId['legacy-weight'].draft.facets.department, 'kids');
  assert.equal(byId.chosen.draft.category, 'Спорт', 'an editor-chosen category stays');assert.equal(byId.chosen.draft.facets.pack, 6);

  // Price, publication, position, collections and identity are untouched.
  for (const [index, item] of doc.entries.entries()) {
    const old = before.entries[index];
    for (const key of ['id', 'publishedAt', 'createdAt', 'queueState', 'autoManaged', 'origin']) assert.deepEqual(item[key], old[key], key);
    for (const side of ['draft', 'published']) for (const key of ['price', 'referencePrice', 'currency', 'variants', 'rank', 'collectionIds', 'checkedAt', 'name', 'sourceUrl', 'sourceShippingUsd', 'weightBasis']) assert.deepEqual(item[side][key], old[side][key], `${item.id}.${side}.${key}`);
  }

  // Idempotent: a second run finds nothing to do and leaves the revision alone.
  assert.equal(applyCatalogFacetBackfill(doc, doc.entries.map(e => e.id)), 0);
  assert.equal(doc.revision, before.revision + 1);
  assert.deepEqual(planCatalogFacetBackfill(doc), {offline: [], network: []});
});

test('a store answer fills in what stored data lacked; a failed read still settles the card', () => {
  const doc = document([
    entry('read', legacyDraft('960035288632', 'adidas Midrange 2.0')),
    entry('failed', legacyDraft('960035288633', 'adidas Argentina Lanyard')),
  ]);
  const store = new Map([['read', {aspects: [{name: 'Department', value: 'Men'}, {name: 'Type', value: 'Athletic Shorts'}], categoryPath: "Clothing, Shoes & Accessories|Men|Men's Clothing|Shorts", category: 'Одежда'}]]);
  assert.equal(applyCatalogFacetBackfill(doc, ['read', 'failed'], store), 2);
  const [read, failed] = doc.entries;
  assert.equal(read.draft.facets.type, 'shorts');assert.equal(read.draft.facets.department, 'men');
  assert.equal(read.draft.category, 'Одежда');assert.equal(read.draft.boxedWeight, 0.35);
  assert.deepEqual(read.published.aspects, store.get('read').aspects);
  assert.equal(read.published.categoryPath, "Clothing, Shoes & Accessories|Men|Men's Clothing|Shorts");
  assert.equal(failed.draft.facets.v, catalogFacetsVersion, 'not retried forever');
  assert.equal(failed.draft.category, 'Обувь', 'an unknown type keeps the category');assert.equal(failed.draft.boxedWeight, 1.2);
  assert.deepEqual(planCatalogFacetBackfill(doc), {offline: [], network: []});
});

test('bundled cards keep their hand-set category; an unpublished draft is backfilled alone', () => {
  const doc = initialCatalog();
  const before = doc.entries.map(e => e.draft.category);
  applyCatalogFacetBackfill(doc, doc.entries.map(e => e.id));
  assert.deepEqual(doc.entries.map(e => e.draft.category), before);
  assert.ok(doc.entries.every(e => e.draft.facets?.v === catalogFacetsVersion && e.published.facets?.v === catalogFacetsVersion));
  const queued = document([{id: 'q', draft: legacyDraft('960000000009', 'adidas women Cushioned Quarter Socks 3 Pairs'), queueState: 'queued'}]);
  assert.equal(applyCatalogFacetBackfill(queued, ['q']), 1);
  assert.equal(queued.entries[0].published, undefined, 'backfill never publishes');
  assert.equal(queued.entries[0].queueState, 'queued');
});
