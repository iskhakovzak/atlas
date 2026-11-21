import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogLifetime, importDraft } from '../lib/market/catalog-editor.ts';
import { createPublicCatalogMemo } from '../lib/market/public-catalog-cache.ts';
import { applyCatalogQuery, catalogItems, emptyCatalogQuery } from '../lib/market/catalog-query.ts';
import { courierAllowanceUsd } from '../lib/market/customs.ts';
import { tariff } from '../lib/market/domain.ts';
import { routeHarness } from './support/route-harness.mjs';

const id = 'stock-cache-test';
const now = 1_800_000_000_000;

function catalog(checkedAt = now - 1000, data = {}) {
  const image = 'https://cdn.shopify.com/s/files/1/product.jpg';
  const draft = importDraft({
    title: 'Atlas test product', sourceUrl: 'https://www.allbirds.com/products/test-shoe',
    brand: 'Allbirds', category: 'Обувь', country: 'США', image, images: [image], warnings: [],
    price: 50, referencePrice: 80, currency: 'EUR',
    variants: [{ id: 'navy-8', label: 'Navy · 8', size: '8', available: true, availabilityKnown: true, price: 50 }],
    ...data,
  }, [], 'США', checkedAt);
  return { revision: 1, collections: [], entries: [{id, draft, published: structuredClone(draft), publishedAt: checkedAt}] };
}

test('the compact list and full product reuse the same projection until the head or rates change', () => {
  const read = createPublicCatalogMemo();
  const snapshot = catalog();
  const initial = read(snapshot, tariff, now);
  const full = initial.product(id);
  assert.ok(full.sourceVariants.length);
  assert.equal(initial.list().products[0].sourceVariants, undefined);
  const again = read(snapshot, tariff, now + 50);
  assert.strictEqual(again.list(), initial.list());
  assert.strictEqual(again.product(id), full);
  const otherRates = { ...tariff, rates: {...tariff.rates, EUR: tariff.rates.EUR * 2} };
  assert.notEqual(read(snapshot, otherRates, now + 60).product(id).usd, full.usd);
  const hidden = {...snapshot, entries: [{...snapshot.entries[0], published: undefined}]};
  assert.equal(read(hidden, otherRates, now + 61).product(id), undefined, 'a changed head can keep the same revision');
});

test('a cached stocked variant becomes unconfirmed at the exact catalog deadline', () => {
  const read = createPublicCatalogMemo();
  const snapshot = catalog(now - catalogLifetime + 10);
  assert.equal(read(snapshot, tariff, now).product(id).sourceVariants[0].availabilityKnown, true);
  const before = read(snapshot, tariff, now + 9).product(id);
  assert.equal(before.priceNeedsConfirmation, false);
  const after = read(snapshot, tariff, now + 10).product(id);
  assert.equal(after.priceNeedsConfirmation, true);
  assert.equal(after.sourceVariants[0].price, undefined);
  assert.equal(read(snapshot, tariff, now + 10).list().products[0].priceNeedsConfirmation, true);
});

test('a catalog editor gets a private copy and a new stored head invalidates both public routes', async t => {
  const h = routeHarness();
  t.after(() => h.db.sqlite.close());
  const {readCatalog,readCatalogSnapshot} = await h.route('lib/market/catalog-server.ts');
  const {GET: list} = await h.route('app/api/catalog/route.ts');
  const {GET: detail} = await h.route('app/api/catalog/[id]/route.ts');
  const document = {...catalog(Date.now() - 1000), bundledSyncDisabled: true};
  h.db.sqlite.prepare('INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES (?,?,?,?)')
    .run('catalog', JSON.stringify(document), Date.now(), 'fixture');

  const first = await readCatalogSnapshot();
  const editor = await readCatalog();
  delete editor.document.entries[0].published;
  assert.strictEqual((await readCatalogSnapshot()).document, first.document);
  assert.ok(first.document.entries[0].published);

  const index = () => h.call(list, {url:'/api/catalog'});
  const product = () => h.call(request => detail(request, {params:Promise.resolve({id})}), {url:'/api/catalog/'+id});
  const published = await index();
  assert.equal(published.status, 200);
  assert.equal((await published.json()).products[0].id, id);
  const full = await product();
  assert.match(full.headers.get('cache-control'), /max-age=60/);
  assert.ok((await full.json()).product.sourceVariants.length);
  assert.equal((await h.call(list, {url:'/api/catalog?admin=1'})).status, 401);

  h.db.sqlite.prepare("UPDATE market_settings SET value=? WHERE key='catalog'").run(JSON.stringify(editor.document));
  assert.deepEqual((await (await index()).json()).products, []);
  assert.equal((await product()).status, 404);
  await h.settle();
});

test('the home view sends eight ranked summaries and safe pricing while the catalog still sends all cards', async t => {
  const h = routeHarness();
  t.after(() => h.db.sqlite.close());
  const {GET} = await h.route('app/api/catalog/route.ts');
  const checkedAt = Date.now() - 1000;
  const entries = Array.from({length:12}, (_, index) => {
    const price = 35 + index;
    const {entries:[entry]} = catalog(checkedAt, {
      title: `Shoe ${index}`,
      sourceUrl: `https://www.allbirds.com/products/shoe-${index}`,
      price,
      referencePrice: 55 + index * 2,
      variants: [{id:'navy-8',label:'Navy · 8',size:'8',available:true,availabilityKnown:true,price}],
    });
    return {...entry, id:`shoe-${index}`};
  });
  const insert = h.db.sqlite.prepare('INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES (?,?,?,?)');
  insert.run('catalog', JSON.stringify({revision:1, collections:[], entries, bundledSyncDisabled:true}), checkedAt, 'fixture');
  insert.run('pricing', JSON.stringify({...tariff, fxSource:'manual', managedBy:'private@atlas.test'}), checkedAt, 'fixture');
  const index = await h.call(GET, {url:'/api/catalog'});
  const home = await h.call(GET, {url:'/api/catalog?view=home'});
  assert.equal(index.status, 200);
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('cache-control'), index.headers.get('cache-control'));
  const all = JSON.parse(await index.text());
  const preview = JSON.parse(await home.text());
  assert.equal(all.products.length, 12);
  assert.equal(preview.total, 12);
  const ranked = applyCatalogQuery(catalogItems(all.products, all.pricing), emptyCatalogQuery, {dutyLimitUsd:courierAllowanceUsd});
  assert.deepEqual(preview.products, ranked.slice(0, 8).map(item => item.product));
  assert.ok(preview.products.every(product => product.listing && product.sourceVariants === undefined));
  assert.deepEqual(preview.pricing, all.pricing);
  assert.equal(preview.pricing.managedBy, undefined);
  assert.equal((await h.call(GET, {url:'/api/catalog?admin=1&view=home'})).status, 401);

  h.db.sqlite.prepare("UPDATE market_settings SET value=? WHERE key='catalog'")
    .run(JSON.stringify({revision:2, collections:[], entries:[], bundledSyncDisabled:true}));
  assert.deepEqual(await (await h.call(GET, {url:'/api/catalog?view=home'})).json(), {
    products:[], total:0, pricing:preview.pricing,
  });
  await h.settle();
});
