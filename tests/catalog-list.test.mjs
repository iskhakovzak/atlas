// The public catalog list without options, galleries and descriptions (3 November 2026, lib/market/catalog-list.ts): the
// cards, filters and sorting must read the same from its summary as from the full product, and the sheet completes it
// from GET /api/catalog/<id>.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogListProduct, catalogVariantSummary, publicCatalogCache, publicCatalogList } from '../lib/market/catalog-list.ts';
import { variantSummaryOf } from '../lib/market/catalog-summary.ts';
import { catalogItems, catalogPriceSpread, productSizes, productStockSizes } from '../lib/market/catalog-query.ts';
import { cheapestUsd } from '../lib/market/deals.ts';
import { officialListing, officialStoreBrand } from '../lib/market/official-stores.ts';
import { initialCatalog, publicCatalog } from '../lib/market/catalog-editor.ts';
import { tariff } from '../lib/market/domain.ts';
import { loadCatalogProduct, preloadCatalogProduct } from '../lib/market/catalog-product-client.ts';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const now = Date.parse('2026-11-03T09:00:00Z');
const gallery = (n) => Array.from({ length: 12 }, (_, i) => `https://i.ebayimg.com/images/g/p${n}-${i}/s-l1600.jpg`);
const option = (label, size, extra = {}) => ({ id: `v-${label}`, label, size, color: 'Black', available: true, images: gallery(label.length), options: [{ name: 'Size', value: size ?? '' }], image: 'https://i.ebayimg.com/images/g/x/s-l1600.jpg', ...extra });
const product = (n, overrides = {}) => ({
  id: `find-${n}`, name: `Sneaker ${n}`, brand: 'adidas', category: 'Обувь', country: 'США', weight: 1.3, boxedWeight: 1, usd: 60, store: 'ebay.com', observedOn: '2026-11-02',
  image: `https://i.ebayimg.com/images/g/p${n}/s-l1600.jpg`, sourceImages: gallery(n), sourceUrl: `https://www.ebay.com/itm/${n}`, sourceCurrency: 'USD', sourcePrice: 60,
  variants: ['US 9', 'US 10', 'US 11'], description: 'Описание '.repeat(80), sourceGroupId: `g${n}`, sourceVariantScope: 'group', sourceVariantsComplete: true,
  sourceColorwayImages: [{ color: 'Black', images: gallery(n + 100) }],
  sourceVariants: [
    option('US 9', 'US 9', { price: 55, sellerId: 'adidas_official', quantity: 3 }),
    option('US 10', 'US 10', { price: 60, sellerId: 'adidas_official' }),
    option('US 11', 'US 11', { price: 52, sellerId: 'adidas_official', quantity: 0 }),
    option('US 12', 'US 12', { price: 70, available: false, sellerId: 'adidas_official' }),
    option('US 13', 'US 13', { availabilityKnown: false, sellerId: 'adidas_official' }),
  ],
  sourceShippingUsd: 0, sourceShippingEstimated: false, sourceCheckedAt: now, addedAt: now, facets: { colors: ['black'] },
  ...overrides,
});
const fixtures = [
  product(1),
  product(2, { sourceVariants: [option('One size', undefined, { price: 20 })] }),
  product(3, { sourceVariants: [], variants: ['Уточнить вариант в магазине'] }),
  product(4, { sourceCurrency: 'EUR', sourcePrice: 50, sourceVariants: [option('S', 'S', { price: 45, sellerId: 'shop_a' }), option('M', 'M', { price: 49, sellerId: 'shop_b' })] }),
  product(5, { priceNeedsConfirmation: true, sourceVariants: [option('S', 'S', { availabilityKnown: false, available: true })] }),
  product(6, { sourceVariants: [option('8', '8', { price: 30 }), option('8.5', '8,5', { price: 30 })] }),
];

test('a list product leaves out the options, galleries and description and is marked as a list entry', () => {
  const full = product(1);
  const listed = catalogListProduct(full);
  for (const key of ['sourceVariants', 'sourceImages', 'sourceColorwayImages', 'description', 'sourceGroupId', 'sourceVariantScope', 'sourceVariantsComplete']) assert.equal(key in listed, false, key);
  for (const key of ['id', 'name', 'brand', 'category', 'image', 'usd', 'sourcePrice', 'sourceCurrency', 'sourceUrl', 'variants', 'facets', 'weight', 'boxedWeight', 'sourceShippingUsd', 'addedAt']) assert.deepEqual(listed[key], full[key], key);
  assert.equal(listed.listing, true);
  assert.deepEqual(listed.variantSummary, { sizes: ['9', '10', '11', '13'], stockSizes: ['9', '10'], lowestPrice: 55, priceSpread: true, sellers: ['adidas_official'] });
  assert.ok(JSON.stringify(listed).length * 8 < JSON.stringify(full).length, `${JSON.stringify(listed).length} vs ${JSON.stringify(full).length}`);
  assert.equal(full.sourceVariants.length, 5, 'the full product is not changed');
  assert.equal(catalogListProduct(listed), listed, 'a list entry stays as it is');
  assert.deepEqual(catalogVariantSummary(product(3, { sourceVariants: [] })), {});
  assert.equal(variantSummaryOf(full), undefined, 'a full product is read from its options');
  assert.deepEqual(variantSummaryOf(catalogListProduct(product(3, { sourceVariants: [] }))), {}, 'a list entry without options has an empty summary');
});

test('cards, filters, sorting and the official mark read the same from the list as from the full product', () => {
  const full = fixtures, listed = full.map(catalogListProduct);
  const rates = { ...tariff, rates: { ...tariff.rates, EUR: 1.1 } };
  const a = catalogItems(full, rates), b = catalogItems(listed, rates);
  for (const [index, item] of a.entries()) {
    const other = b[index], id = item.product.id;
    assert.deepEqual(other.sizes, item.sizes, id + ' sizes');
    assert.deepEqual(other.stockSizes, item.stockSizes, id + ' stock sizes');
    assert.equal(other.usd, item.usd, id + ' usd');
    assert.deepEqual(other.costs, item.costs, id + ' costs');
    assert.equal(other.discount, item.discount, id + ' discount');
    assert.deepEqual(other.attrs, item.attrs, id + ' filters');
    assert.equal(cheapestUsd(listed[index], rates), cheapestUsd(full[index], rates), id + ' cheapest');
    assert.equal(catalogPriceSpread(listed[index]), catalogPriceSpread(full[index]), id + ' «от»');
    assert.deepEqual(productSizes(listed[index]), productSizes(full[index]));
    assert.deepEqual(productStockSizes(listed[index]), productStockSizes(full[index]));
    assert.equal(officialStoreBrand(listed[index]), officialStoreBrand(full[index]), id + ' official store');
    assert.equal(officialListing(listed[index], undefined), officialListing(full[index], undefined));
  }
  assert.equal(officialStoreBrand(listed[0]), 'adidas', 'the official eBay store survives the list');
  assert.equal(catalogPriceSpread(listed[0]), true);
  assert.equal(catalogPriceSpread(listed[5]), false, 'one price for every option: no «от»');
  // A currency without a rate has no cheaper option, as before.
  assert.equal(cheapestUsd(listed[3], tariff), cheapestUsd(full[3], tariff));
});

test('the public list of the real catalog: every product listed, collections kept, much lighter', () => {
  const catalog = publicCatalog(initialCatalog(), tariff, now);
  const list = publicCatalogList(catalog);
  assert.deepEqual(list.products.map((item) => item.id), catalog.products.map((item) => item.id));
  assert.deepEqual(list.collections, catalog.collections);
  assert.ok(list.products.every((item) => item.listing === true && !('sourceVariants' in item) && !('sourceImages' in item) && !('description' in item)));
  assert.ok(JSON.stringify(list).length < JSON.stringify(catalog).length);
});

test('GET /api/catalog: the public list is cached a minute; the operator view and errors are not', () => {
  assert.equal(publicCatalogCache, 'public, max-age=60, stale-while-revalidate=600');
  const route = source('app/api/catalog/route.ts');
  assert.match(route, /if\(admin\)return json\(\{document,saleJob,batchJob,catalogFormat:'chunks-v2',storeHealth:await readStoreHealth\(\)\}\);/);
  assert.match(route, /return Response\.json\(\{\.\.\.publicCatalogList\(publicCatalog\(document,currentPricing\)\),pricing:withoutAuthor\(currentPricing\)\},\{headers:\{'Cache-Control':publicCatalogCache\}\}\);/);
  // The public answer reads no session: nothing in it belongs to one visitor.
  const publicPart = route.slice(route.indexOf('export async function GET'), route.indexOf('export async function POST'));
  assert.match(publicPart, /if\(admin\)\{const user=await identity\(\);/);
  assert.equal(publicPart.match(/identity\(\)/g).length, 1, 'only the operator branch asks who is there');
  // The middleware leaves API routes alone, so it cannot replace the header.
  assert.match(source('middleware.ts'), /matcher: \["\/\(\(\?!api\/\|_next\/\|\.\*\\\\\.\[a-zA-Z0-9\]\+\$\)\.\*\)"\]/);
  // The browser uses its cache for the list; a retry after a failure asks the server again.
  assert.match(source('lib/market/store.tsx'), /fetch\('\/api\/catalog',\{cache:force\?'no-cache':'default'\}\)/);
});

test('GET /api/catalog/<id>: one published product in full, cached like the list, 404 otherwise', () => {
  const route = source('app/api/catalog/[id]/route.ts');
  assert.match(route, /const found=id&&id\.length<=200\?await publicCatalogProduct\(id\):null;/);
  assert.match(route, /if\(!found\)throw new HttpError\(404,'Товар каталога не найден\.'\);/);
  assert.match(route, /return Response\.json\(\{product:found\.product\},\{headers:\{'Cache-Control':publicCatalogCache\}\}\);/);
  assert.match(route, /catch\(error\)\{return failure\(error,request\)\}/);
  // The product page and the endpoint read the same full card; the sitemap reads the full catalog too.
  assert.match(source('lib/market/initial-data.ts'), /byId:new Map\(publicCatalog\(document,pricing,now\)\.products\.map\(item=>\[item\.id,item\]\)\)/);
  // Priced once per catalog revision and tariff, for at most half a minute.
  assert.match(source('lib/market/initial-data.ts'), /productMemo\.key!==key\|\|now-productMemo\.at>productMemoMs/);
  // The pages' list (first page, seeds, store pages) is the same list the API serves.
  const data = source('lib/market/initial-data.ts');
  assert.match(data, /const \{products,collections\}=publicCatalogList\(publicCatalog\(document,pricing\)\);/);
  assert.match(data, /const catalog=publicCatalogList\(publicCatalog\(document,pricing\)\);/);
  assert.match(source('lib/market/catalog-seed.ts'), /publicCatalogList\(publicCatalog\(document,pricing,now\)\)/);
});

test('the sheet and ?catalog= links load the full product once, and a failed load is asked again', async () => {
  const realFetch = globalThis.fetch;
  const calls = [];
  let fail = true;
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (fail) return new Response(JSON.stringify({ error: 'down' }), { status: 503 });
    const id = decodeURIComponent(String(url).split('/').pop());
    return new Response(JSON.stringify({ product: { ...product(1), id } }), { status: 200 });
  };
  try {
    await assert.rejects(loadCatalogProduct('find-a'));
    fail = false;
    const first = await loadCatalogProduct('find-a');
    assert.equal(first.id, 'find-a');
    assert.equal(first.sourceVariants.length, 5, 'the full product, with its options');
    await loadCatalogProduct('find-a');
    assert.deepEqual(calls, ['/api/catalog/find-a', '/api/catalog/find-a'], 'a failure is not kept; a success is');
    preloadCatalogProduct({ id: 'find-b' });
    assert.equal(calls.length, 2, 'a full product needs no load');
    preloadCatalogProduct({ id: 'find b', listing: true });
    assert.equal(calls.at(-1), '/api/catalog/find%20b');
  } finally { globalThis.fetch = realFetch; }
  const link = source('app/global-link-order.tsx');
  assert.match(link, /catalogLinkSeed\(linkCatalogFull\?\.id === catalogId \? \[linkCatalogFull\] : catalogProducts, catalogId, requestedUrl, link\)/);
  assert.match(link, /void Promise\.all\(\[loadCatalog\(\),full\]\)\.finally/);
});
