import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogFirstPage, firstPageEager, firstPageHigh, slimCatalogItem } from '../lib/market/catalog-first-page.ts';
import { applyCatalogQuery, catalogItems, emptyCatalogQuery, paginate, readCatalogQuery } from '../lib/market/catalog-query.ts';
import { catalogCopy } from '../lib/market/catalog-copy.ts';
import { searchWords } from '../lib/market/catalog-synonyms.ts';
import { courierAllowanceUsd } from '../lib/market/customs.ts';
import { tariff } from '../lib/market/domain.ts';

// Owner decision of 2 November 2026: the first page of /catalog is in the server HTML and the browser keeps those cards.
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const now = Date.now();
const find = (index, overrides = {}) => ({
  id: `p${index}`, name: `Sneaker ${index}`, brand: index % 2 ? 'Nike' : 'adidas', category: 'Обувь', country: 'США', weight: 1, usd: 40 + index,
  image: `https://example.com/p${index}.jpg`, sourceUrl: `https://www.nike.com/t/p${index}`, sourceCurrency: 'USD', sourcePrice: 40 + index,
  variants: ['US 9', 'US 10'], sourceVariants: [{ label: 'US 9', size: 'US 9', available: true, price: 40 + index, images: ['https://example.com/a.jpg'] }, { label: 'US 10', size: 'US 10', available: true, price: 41 + index }],
  sourceImages: Array.from({ length: 8 }, (_, n) => `https://example.com/p${index}-${n}.jpg`), declarationDescription: 'x'.repeat(300),
  sourceCheckedAt: now, addedAt: now - index * 1000, referenceUsd: index % 3 ? undefined : 99,
  ...overrides,
});
const products = Array.from({ length: 30 }, (_, index) => find(index + 1));

test('the server page is the browser page: same products in the same order, page 1 only', () => {
  const context = { dutyLimitUsd: courierAllowanceUsd, collections: [], words: (item) => [catalogCopy.ru.categories[item.product.category] ?? '', searchWords(item, 'ru')].join(' ') };
  for (const query of [emptyCatalogQuery, readCatalogQuery('?sort=price-asc'), readCatalogQuery('?brand=nike'), readCatalogQuery('?q=sneaker%201')]) {
    const browser = paginate(applyCatalogQuery(catalogItems(products, tariff), query, context), 1, query.per).items.map((item) => item.product.id);
    const server = catalogFirstPage(products, [], tariff, query, 'ru');
    assert.deepEqual(server?.map((item) => item.product.id) ?? [], browser, JSON.stringify(query));
  }
  assert.equal(catalogFirstPage(products, [], tariff, emptyCatalogQuery, 'ru').length, 24, 'the first 24 cards');
  assert.equal(catalogFirstPage(products, [], tariff, readCatalogQuery('?page=2'), 'ru'), null, 'a later page keeps the skeleton');
  assert.equal(catalogFirstPage([], [], tariff, emptyCatalogQuery, 'ru'), null);
});

test('each card carries only what the card shows, much less than the product', () => {
  const [item] = catalogItems([find(3)], tariff);
  const slim = slimCatalogItem(item);
  for (const key of ['id', 'name', 'brand', 'category', 'image', 'sourceUrl', 'usd']) assert.equal(slim.product[key], item.product[key], key);
  assert.equal(slim.costs.total, item.costs.total, 'the sum in soum');
  assert.equal(slim.discount, item.discount);
  assert.deepEqual(slim.sizes, item.sizes);
  assert.equal(slim.product.sourceImages, undefined);
  assert.equal(slim.product.declarationDescription, undefined);
  assert.deepEqual(Object.keys(slim.product.sourceVariants[0]).sort(), ['available', 'label', 'price']);
  assert.ok(JSON.stringify(slim).length * 2 < JSON.stringify(item).length, `${JSON.stringify(slim).length} vs ${JSON.stringify(item).length}`);
  const page = catalogFirstPage(products, [], tariff, emptyCatalogQuery, 'ru');
  assert.ok(JSON.stringify(page).length < 24 * 1200, `${JSON.stringify(page).length} characters for 24 cards`);
});

test('the page renders the first page and the view keeps those cards in place until the catalog arrives', () => {
  const page = source('app/catalog/page.tsx');
  assert.match(page, /const firstPage = await initialCatalogFirstPage\(initial, await pageLocale\(\)\);/);
  assert.match(page, /<CatalogView mode="catalog" initial=\{initial\} firstPage=\{firstPage\}/);
  const view = source('app/catalog-view.tsx');
  assert.match(view, /const serverCards = !catalogReady && firstPage\?\.length \? firstPage : null;/);
  assert.match(view, /const gridItems = serverCards \?\? visible;/);
  // One grid element, cards keyed by product: the full cards replace the server ones in place.
  assert.match(view, /gridItems\.map\(\(item, index\) => <CatalogCard key=\{item\.product\.id\}/);
  assert.match(view, /\{!catalogReady && !serverCards \? <CatalogSkeleton/);
  // Only the first row loads at once.
  assert.equal(firstPageEager, 4);
  assert.equal(firstPageHigh, 2);
  assert.match(view, /priority=\{paged\.page === 1 && index < firstPageEager \? \(index < firstPageHigh \? 'high' : 'eager'\) : undefined\}/);
  const card = source('app/catalog-card.tsx');
  assert.match(card, /<h3 className="pcard-title"><a href=\{productHref\} onClick=\{openFromLink\}/, 'the name links to /catalog/p/<id>');
  assert.match(card, /<ProductImage product=\{product\} decorative locale=\{locale\} dims priority=\{priority\} sizes=\{cardSizes\} \/>/);
  const image = source('app/market-ui.tsx');
  assert.match(image, /loading=\{priority\?'eager':'lazy'\} fetchPriority=\{priority==='high'\?'high':undefined\} width=\{dims\?size:undefined\} height=\{dims\?size:undefined\}/);
});
