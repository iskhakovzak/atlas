import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractProduct, extractAdidasProduct} from '../lib/importer/extract.ts';

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
