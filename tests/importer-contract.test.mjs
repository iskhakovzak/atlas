import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractProduct, extractAdidasProduct, inferSizeRegion, isConfirmedUnavailableVariant} from '../lib/importer/extract.ts';

const html = data => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
const nike = JSON.parse(readFileSync(new URL('./fixtures/importer/nike-cortez.json', import.meta.url), 'utf8'));

test('captured Nike ProductGroup retains exact listing and distinct merchant size identifiers', () => {
  const result = extractProduct(html(nike.product), nike.sourceUrl + '?utm_source=fixture');
  assert.equal(result.price, 76.97);
  assert.equal(result.currency, 'USD');
  assert.deepEqual(result.variants.map(v => [v.id, v.size]), [['00197600816527', '6'], ['00197600804203', '6.5']]);
  assert.ok(result.image.startsWith('https://static.nike.com/'));
  // Do not assert availability: this captured source does not publish it.
});

test('Nike embedded product data keeps exact style price, gallery and stock matrix', () => {
  const sourceUrl = 'https://www.nike.com/t/example/DM4044-108';
  const product = {
    styleCode: 'DM4044-108',
    brands: ['Nike'],
    colorDescription: 'White/Varsity Blue',
    productType: 'FOOTWEAR',
    taxonomyLabels: ['Lifestyle', 'Shoes'],
    productInfo: {fullTitle: "Nike Cortez Leather Men's Shoes"},
    prices: {currency: 'USD', currentPrice: 76.97, initialPrice: 95},
    contentImages: [{properties: {portrait: {url: 'https://static.nike.com/one.jpg'}, squarish: {url: 'https://static.nike.com/two.jpg'}}}],
    sizes: [
      {label: '6', status: 'ACTIVE', gtins: [{gtin: '00197600816527'}]},
      {label: '6.5', status: 'INACTIVE', gtins: [{gtin: '00197600804203'}]},
    ],
  };
  const htmlText = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props: {pageProps: {selectedProduct: product}}})}</script>`;
  const result = extractProduct(htmlText, sourceUrl);
  assert.equal(result.method, 'Nike product data');
  assert.equal(result.price, 76.97);
  assert.equal(result.category, 'Обувь');
  assert.equal(result.images.length, 2);
  assert.deepEqual(result.variants.map(item => [item.id, item.size, item.available, item.availabilityKnown]), [
    ['00197600816527', '6', true, true],
    ['00197600804203', '6.5', false, true],
  ]);
});

test('size-region hint follows a known storefront locale and unknown availability stays selectable', () => {
  assert.equal(inferSizeRegion('https://www.nike.com/t/shoes/example', 'USD'), 'US');
  assert.equal(inferSizeRegion('https://www.nike.com/gb/t/shoes/example', 'GBP'), 'UK');
  assert.equal(inferSizeRegion('https://www.nike.com/de/t/shoes/example', 'EUR'), 'EU');
  assert.equal(inferSizeRegion('https://merchant.example/product/123', 'USD'), undefined);
  assert.equal(isConfirmedUnavailableVariant({available: false, availabilityKnown: true}), true);
  assert.equal(isConfirmedUnavailableVariant({available: false, availabilityKnown: false}), false);
  assert.equal(isConfirmedUnavailableVariant({available: true, availabilityKnown: true}), false);
});

test('exact listing wins over earlier recommended JSON-LD products', () => {
  const source = 'https://www.target.com/p/item/-/A-123';
  const product = (url, price, sku) => ({'@type':'Product', url, name:'Item', sku, color:'Blue', offers:{price, priceCurrency:'USD'}});
  const result = extractProduct(html([product('https://www.target.com/p/other/-/A-456', 1, 'wrong'), product('https://target.com/p/item/-/A-123/', 20, 'right')]), source + '?utm_campaign=example');
  assert.equal(result.price, 20);
  assert.equal(result.sku, 'right');
  assert.equal(result.variants[0].id, 'right');
});

test('unrelated or unsafe structured URLs cannot supply source prices', () => {
  for (const url of ['https://www.target.com/p/other', 'https://evil.example/p/item', 'https://user:password@www.target.com/p/item', 'http://www.target.com/p/item']) {
    const result = extractProduct(html({'@type':'Product', url, name:'Wrong', offers:{price:1, priceCurrency:'USD'}}), 'https://www.target.com/p/item');
    assert.equal(result.price, undefined);
    assert.equal(result.title, undefined);
  }
});

test('matched parent retains matrix when recommendations appear first', () => {
  const data = [{'@type':'Product', url:'https://www.nike.com/t/other', name:'Recommendation', offers:{price:1}}, nike.product];
  assert.equal(extractProduct(html(data), nike.sourceUrl).variants.length, 2);
});

test('unaddressed ProductGroup stays compatible and matrix is bounded', () => {
  const data = {'@type':'ProductGroup', name:'Shirt', hasVariant:Array.from({length:100}, (_, i) => ({'@type':'Product', size:String(i), sku:i, offers:{price:10, priceCurrency:'EUR'}}))};
  const result = extractProduct(html(data), 'https://www.zalando.com/shirt');
  assert.equal(result.title, 'Shirt');
  assert.equal(result.variants.length, 80);
  assert.equal(result.variants[0].id, '0');
});

test('Adidas rejects a valid-looking response for a different URL article', () => {
  const wrong = {id:'OTHER1', name:'Wrong item', price:1, orderable:1};
  assert.equal(extractAdidasProduct(wrong, undefined, 'https://www.adidas.com/us/shoes/IF4492.html'), undefined);
});

test('shared parent SKUs do not collapse different size selections', () => {
  const data = {'@type':'ProductGroup', name:'Shirt', hasVariant:['S', 'M'].map(size => ({'@type':'Product', sku:'PARENT', size, offers:{price:10, priceCurrency:'EUR'}}))};
  const result = extractProduct(html(data), 'https://www.zalando.com/shirt');
  assert.deepEqual(result.variants.map(v => v.id), [undefined, undefined]);
  assert.deepEqual(result.variants.map(v => v.label), ['S', 'M']);
});

test('priority merchant embedded state keeps the exact Walmart listing and option matrix', () => {
  const sourceUrl = 'https://www.walmart.com/ip/Atlas-Runner/123456789';
  const state = {
    props: {pageProps: {product: {
      productId: '123456789',
      name: 'Atlas Runner Shoes',
      brand: {name: 'Atlas'},
      category: 'Shoes',
      price: 39.99,
      currency: 'USD',
      images: [{url: 'https://i5.walmartimages.com/runner.jpg'}],
      variants: [
        {id: 'sku-8', size: '8', color: 'Black', price: 39.99, availability: 'In Stock'},
        {id: 'sku-9', size: '9', color: 'Black', price: 39.99, availability: 'Out of Stock'},
      ],
    }, recommendation: {productId: '999999999', name: 'Wrong item', price: 1}},
  }};
  const result = extractProduct(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(state)}</script>`, sourceUrl);
  assert.equal(result.method, 'walmart.com embedded product data');
  assert.equal(result.title, 'Atlas Runner Shoes');
  assert.equal(result.price, 39.99);
  assert.deepEqual(result.variants.map(v => [v.color, v.size, v.available, v.availabilityKnown]), [
    ['Black', '8', true, true], ['Black', '9', false, true],
  ]);
  assert.equal(result.images[0], 'https://i5.walmartimages.com/runner.jpg');
});

test('priority merchant embedded state accepts a European exact id but ignores recommendations', () => {
  const sourceUrl = 'https://www.zalando.de/atlas-runner/AB1234-001.html';
  const state = {
    product: {styleCode: 'AB1234-001', title: 'Atlas Runner', brand: 'Atlas', price: {amount: 89.95}, currencyCode: 'EUR', image: 'https://img01.ztat.net/runner.jpg', sizes: [
      {id: 's40', label: '40', status: 'available'}, {id: 's41', label: '41', status: 'sold out'},
    ]},
    recommendation: {styleCode: 'ZZ9999-001', title: 'Other runner', price: 2},
  };
  const result = extractProduct(`<script id="__PRELOADED_STATE__" type="application/json">${JSON.stringify(state)}</script>`, sourceUrl);
  assert.equal(result.method, 'zalando.de embedded product data');
  assert.equal(result.currency, 'EUR');
  assert.equal(result.country, 'Германия');
  assert.deepEqual(result.variants.map(v => [v.label, v.available, v.availabilityKnown]), [['40', true, true], ['41', false, true]]);
});

test('embedded state does not accept a longer recommendation id containing the linked id', () => {
  const sourceUrl = 'https://www.walmart.com/ip/item/123456789';
  const state = {recommendation: {productId: 'prefix-123456789-other', name: 'Different item', price: 1, currency: 'USD'}};
  const result = extractProduct(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(state)}</script>`, sourceUrl);
  assert.equal(result.price, undefined);
  assert.equal(result.title, undefined);
});

test('embedded state keeps product-defining colour queries exact', () => {
  const sourceUrl = 'https://www.asos.com/prd/12345678?colour=blue';
  const state = {product: {url: 'https://www.asos.com/prd/12345678?colour=red', name: 'Red shirt', price: 10, currency: 'GBP'}};
  const result = extractProduct(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(state)}</script>`, sourceUrl);
  assert.equal(result.price, undefined);
  assert.equal(result.title, undefined);
});
