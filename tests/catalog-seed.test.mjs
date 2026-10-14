// /catalog and /stores render with the public catalog from the server (14.10.2026): the first HTML has the final grid.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogSeed, catalogSeedMaxChars } from '../lib/market/catalog-seed.ts';
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
  assert.match(data, /export async function initialPublicCatalog\(\):Promise<CatalogSeedValue\|null>\{\n try\{\n  const \[\{document\},pricing\]=await Promise\.all\(\[readCatalog\(\),currentPricing\(\)\]\);\n  return catalogSeed\(document,pricing\);\n \}catch\{return null\}\n\}/);
  assert.match(source('app/api/catalog/route.ts'), /const \[\{document\},currentPricing\]=await Promise\.all\(\[readCatalog\(\),pricing\(\)\]\);/);
  // /catalog keeps loading the catalog in the browser: with the full grid in the first paint Lighthouse's mobile simulation
  // scored it 79 instead of 85 (14.10.2026), and its skeleton shift is small enough to cost no score.
  const catalogPage = source('app/catalog/page.tsx');
  assert.doesNotMatch(catalogPage, /CatalogSeed|initialPublicCatalog/);
  assert.match(catalogPage, /return <Marketplace view="products"><CatalogView mode="catalog" initial=\{readCatalogQuery\(await searchParams\)\} \/><\/Marketplace>;/);
  assert.match(source('app/stores/page.tsx'), /<CatalogSeed value=\{await initialPublicCatalog\(\)\}><Marketplace view="stores"><StoresDirectory\/><\/Marketplace><\/CatalogSeed>/);
});

test('until the provider takes the seed over, the pages under it see the seed as a finished catalog', () => {
  const store = source('lib/market/store.tsx');
  assert.match(store, /c&&seed&&c\.catalogSeed!==seed\?\{\.\.\.c,catalogProducts:seed\.products,collections:seed\.collections,catalogReady:true,catalogError:'',loadCatalog:seededLoad\}:c/);
  // Taking it over marks the catalog as loaded, so no page asks /api/catalog for it again.
  assert.match(store, /const adoptCatalog=useCallback\(\(seed:CatalogSeedValue\)=>\{\n  catalogLoaded\.current=true;/);
  assert.match(store, /useEffect\(\(\)=>\{if\(value&&adopt\)adopt\(value\)\},\[value,adopt\]\);/);
  // The client keeps only the type: the catalog editor and Zod stay on the server.
  assert.match(store, /^import type \{CatalogSeedValue\} from '\.\/catalog-seed';$/m);
});
