// /catalog and /stores render with the public catalog from the server (14.10.2026): the first HTML has the final grid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogSeed, catalogSeedMaxChars, storeCatalogSeed } from '../lib/market/catalog-seed.ts';
import { catalogCountsBySlug, productStoreSlug, storeProductIds } from '../lib/market/store-pages.ts';
import { collectionPage } from '../lib/seo/structured-data.ts';
import { productPath } from '../lib/seo/routes.ts';
import { initialCatalog, publicCatalog } from '../lib/market/catalog-editor.ts';
import { tariff } from '../lib/market/domain.ts';

const root = new URL('../', import.meta.url);
const source = (file) => readFileSync(new URL(file, root), 'utf8').replace(/\r\n/g, '\n');
const now = Date.parse('2026-10-14T09:00:00Z');

test('the seed is what GET /api/catalog answers: the public catalog and the tariff without its author', () => {
  const document = initialCatalog();
  const pricing = { ...tariff, managedBy: 'operator@example.com' };
  const seed = catalogSeed(document, pricing, now);
  assert.ok(seed);
  assert.deepEqual({ products: seed.products, collections: seed.collections }, publicCatalog(document, pricing, now));
  assert.equal('managedBy' in seed.pricing, false);
  assert.ok(seed.products.length > 0);
  assert.ok(JSON.stringify(seed).length <= catalogSeedMaxChars);
});

test('nothing published or a catalog too large to inline: the page loads it in the browser as before', () => {
  assert.equal(catalogSeed({ ...initialCatalog(), entries: [] }, tariff, now), null);
  const base = initialCatalog();
  const many = { ...base, entries: Array.from({ length: 40 }, (_, copy) => base.entries.map((entry) => ({ ...entry, id: `${entry.id}-${copy}` }))).flat() };
  assert.ok(JSON.stringify(publicCatalog(many, tariff, now)).length > catalogSeedMaxChars, 'the fixture is over the limit');
  assert.equal(catalogSeed(many, tariff, now), null);
});

test('the server reads the seed as the API does; /stores passes it on, /catalog does not', () => {
  const data = source('lib/market/initial-data.ts');
  assert.match(data, /export async function initialPublicCatalog\(\):Promise<CatalogSeedValue\|null>\{\n try\{\n  const \[\{document\},pricing\]=await Promise\.all\(\[readCatalog\(\{backfill:true\}\),currentPricing\(\)\]\);\n  return catalogSeed\(document,pricing\);\n \}catch\{return null\}\n\}/);
  assert.match(source('app/api/catalog/route.ts'), /const \[\{document\},currentPricing\]=await Promise\.all\(\[readCatalog\(\{backfill:!admin\}\),pricing\(\)\]\);/);
  // /catalog keeps loading the catalog in the browser: with the full grid in the first paint Lighthouse's mobile simulation
  // scored it 79 instead of 85 (14.10.2026), and its skeleton shift is small enough to cost no score.
  const catalogPage = source('app/catalog/page.tsx');
  assert.doesNotMatch(catalogPage, /CatalogSeed|initialPublicCatalog/);
  assert.match(catalogPage, /return <Marketplace view="products"><CatalogView mode="catalog" initial=\{readCatalogQuery\(params\)\} lang=\{typeof params\.lang === \x27string\x27 \? params\.lang : undefined\} \/><\/Marketplace>;/);
  assert.match(source('app/stores/page.tsx'), /<CatalogSeed value=\{await initialPublicCatalog\(\)\}><Marketplace view="stores"><StoresDirectory\/><\/Marketplace><\/CatalogSeed>/);
});

test('until the provider takes the seed over, the pages under it see the seed as a finished catalog', () => {
  const store = source('lib/market/store.tsx');
  assert.match(store, /c&&seed&&\(seed\.scope\|\|c\.catalogSeed!==seed\)\?\{\.\.\.c,catalogProducts:seed\.products,collections:seed\.collections,catalogReady:true,catalogError:'',loadCatalog:seededLoad\}:c/);
  // Taking it over marks the catalog as loaded, so no page asks /api/catalog for it again.
  assert.match(store, /const adoptCatalog=useCallback\(\(seed:CatalogSeedValue\)=>\{\n  catalogLoaded\.current=true;/);
  // One store's part of the catalog (/stores/[slug]) is never taken over as the whole one.
  assert.match(store, /useEffect\(\(\)=>\{if\(value&&!value\.scope&&adopt\)adopt\(value\)\},\[value,adopt\]\);/);
  // The client keeps only the type: the catalog editor and Zod stay on the server.
  assert.match(store, /^import type \{CatalogSeedValue\} from '\.\/catalog-seed';$/m);
});

// Review of stage 8 (1 November 2026): the whole catalog went over the limit at about 50 products, and a store page then
// had no products in its HTML and no CollectionPage. It now takes only its own store's part, and lists the ids from the
// whole catalog.
test('a store page gets its own store’s part of the catalog and its CollectionPage even when the whole catalog is too large', () => {
  const base = initialCatalog();
  const many = { ...base, entries: Array.from({ length: 40 }, (_, copy) => base.entries.map((entry) => ({ ...entry, id: `${entry.id}-${copy}` }))).flat() };
  const catalog = publicCatalog(many, tariff, now);
  assert.equal(catalogSeed(many, tariff, now), null, 'the whole catalog does not fit');
  const counts = catalogCountsBySlug(catalog.products);
  // The smallest store with products: its part fits.
  const [slug, count] = [...counts].sort((a, b) => a[1] - b[1])[0];
  const seed = storeCatalogSeed(catalog, { ...tariff, managedBy: 'operator@example.com' }, slug, productStoreSlug);
  assert.ok(seed, 'one store’s part fits');
  assert.equal(seed.scope, slug);
  assert.equal(seed.products.length, count);
  assert.ok(seed.products.every((product) => productStoreSlug(product) === slug));
  assert.equal('managedBy' in seed.pricing, false);
  const ids = new Set(seed.products.map((product) => product.id));
  assert.ok(seed.collections.every((collection) => collection.productIds.length > 0 && collection.productIds.every((id) => ids.has(id))), 'collections cut down to this store');
  const productIds = storeProductIds(catalog.products, slug);
  assert.deepEqual(productIds, seed.products.map((product) => product.id));
  const page = collectionPage({ path: '/stores/' + slug, requested: 'ru', name: slug, itemPaths: productIds.map(productPath) });
  assert.equal(page.mainEntity.numberOfItems, count);
  // A store without catalog products gets an empty part: the page shows its header at once, without /api/catalog.
  const none = storeCatalogSeed(catalog, tariff, 'no-such-store', productStoreSlug);
  assert.deepEqual({ products: none.products, collections: none.collections, scope: none.scope }, { products: [], collections: [], scope: 'no-such-store' });
  // A part still too large to inline falls back to the browser load, like the whole catalog.
  const [big] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const oneStore = { products: catalog.products.filter((product) => productStoreSlug(product) === big), collections: [] };
  const huge = { products: Array.from({ length: 200 }, (_, n) => oneStore.products.map((product) => ({ ...product, id: `${product.id}-x${n}` }))).flat(), collections: [] };
  assert.equal(storeCatalogSeed(huge, tariff, big, productStoreSlug), null);
});

test('the store page lists its products from the whole catalog, and its seed is scoped', () => {
  const page = source('app/stores/[slug]/page.tsx');
  assert.match(page, /const itemPaths = productIds\.map\(productPath\);/);
  assert.doesNotMatch(page, /seed \? catalogItems/);
  assert.match(source('lib/market/initial-data.ts'), /seed:storeCatalogSeed\(catalog,pricing,slug,productStoreSlug\)/);
});
