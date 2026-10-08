import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractProduct, extractAdidasProduct} from '../lib/importer/extract.ts';
import {variantsForSourceColor} from '../lib/importer/link-selection.ts';
import {priorityMerchants} from '../lib/importer/merchant-profiles.ts';

const html = data => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
const nike = JSON.parse(readFileSync(new URL('./fixtures/importer/nike-cortez.json', import.meta.url), 'utf8'));

test('all priority roots accept an exact-source public embedded product contract', () => {
  for (const [index, profile] of priorityMerchants(1).entries()) {
    const sourceUrl = `https://www.${profile.root}/product/atlas-fixture/ATLAS${String(index + 1).padStart(5, '0')}`;
    const state = {props: {pageProps: {product: {
      url: sourceUrl,
      name: 'Atlas Cotton Shirt',
      brand: {name: 'Atlas'},
      price: 24.5,
      currency: 'USD',
      images: [{url: 'https://cdn.example.net/atlas-fixture.jpg'}],
      variants: [{skuId: `ATLAS-SKU-${index}`, color: 'Navy', size: 'M', price: 24.5, availability: 'In Stock'}],
    }}}};
    const result = extractProduct(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(state)}</script>`, sourceUrl);
    assert.equal(result.title, 'Atlas Cotton Shirt', profile.root);
    assert.equal(result.price, 24.5, profile.root);
    assert.equal(result.currency, 'USD', profile.root);
    assert.equal(result.image, 'https://cdn.example.net/atlas-fixture.jpg', profile.root);
    assert.deepEqual(result.variants.map(item => [item.color, item.size]), [['Navy', 'M']], profile.root);
  }
});

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
  assert.equal(result.images.length, 1);
  assert.equal(result.images[0], 'https://static.nike.com/two.jpg');
  assert.deepEqual(result.variants.map(item => [item.id, item.size, item.available, item.availabilityKnown]), [
    ['00197600816527', '6', true, true],
    ['00197600804203', '6.5', false, true],
  ]);
});

test('Nike exact product group exposes sibling colorways without importing recommendations', () => {
  const sourceUrl = 'https://www.nike.com/t/gato-lv8-mens-shoes-Ib4M9R5k/IH3587-400';
  const style = (styleCode, colorDescription, price, image, sizes) => ({
    styleCode,
    colorDescription,
    brands: ['Nike'],
    productType: 'FOOTWEAR',
    productInfo: {fullTitle: "Nike Gato LV8 Men's Shoes"},
    prices: {currency: 'USD', currentPrice: price},
    contentImages: [{properties: {portrait: {url: image}}}],
    sizes,
  });
  const blue = style('IH3587-400', 'Light Armory Blue/White', 73.97, 'https://static.nike.com/blue.jpg', [
    {label: '6', status: 'ACTIVE', gtins: [{gtin: 'blue-6'}]},
    {label: '6.5', status: 'INACTIVE', gtins: [{gtin: 'blue-65'}]},
  ]);
  const red = style('IH3587-401', 'University Red/White', 78.97, 'https://static.nike.com/red.jpg', [
    {label: '7', status: 'ACTIVE', gtins: [{gtin: 'red-7'}]},
  ]);
  const unrelated = style('OTHER-001', 'Black/White', 10, 'https://static.nike.com/unrelated.jpg', [
    {label: '9', status: 'ACTIVE', gtins: [{gtin: 'other-9'}]},
  ]);
  const payload = {props: {pageProps: {
    locale: {currency: 'USD'},
    selectedProduct: {...blue},
    productGroups: [
      {products: {blue, red}},
      {products: {unrelated}},
    ],
  }}};
  const result = extractProduct(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`, sourceUrl);
  assert.equal(result.sku, 'IH3587-400');
  assert.equal(result.price, 73.97);
  assert.deepEqual(result.variants.map(({id,color,size,price,image,available,sizeLabel}) => ({id,color,size,price,image,available,sizeLabel})), [
    {id:'blue-6',color:'Light Armory Blue/White',size:'6',price:73.97,image:'https://static.nike.com/blue.jpg',available:true,sizeLabel:'Nike US men'},
    {id:'blue-65',color:'Light Armory Blue/White',size:'6.5',price:73.97,image:'https://static.nike.com/blue.jpg',available:false,sizeLabel:'Nike US men'},
    {id:'red-7',color:'University Red/White',size:'7',price:78.97,image:'https://static.nike.com/red.jpg',available:true,sizeLabel:'Nike US men'},
  ]);
  assert.deepEqual(variantsForSourceColor(result.variants,result.selectedVariantColor).map(({color,size})=>[color,size]),[
    ['Light Armory Blue/White','6'],
    ['Light Armory Blue/White','6.5'],
  ]);
});

test('Nike live PDP shape matches object PDP URLs and keeps one photo per gallery slot', () => {
  const sourceUrl = 'https://www.nike.com/t/gato-lv8-mens-shoes-Ib4M9R5k/IH3587-400';
  const gallery = prefix => Array.from({length: 8}, (_, index) => ({properties: {
    portrait: {url: `https://static.nike.com/${prefix}-${index + 1}-portrait.jpg`},
    squarish: {url: `https://static.nike.com/${prefix}-${index + 1}-square.jpg`},
  }}));
  const style = ({article, color, price, prefix}) => ({
    styleCode: 'IH3587',
    pdpUrl: {
      url: `https://www.nike.com/t/gato-lv8-mens-shoes-Ib4M9R5k/${article}`,
      path: `/t/gato-lv8-mens-shoes-Ib4M9R5k/${article}`,
    },
    colorDescription: color,
    brands: ['Nike'],
    productType: 'FOOTWEAR',
    productInfo: {fullTitle: "Nike Gato LV8 Men's Shoes"},
    prices: {currency: 'USD', currentPrice: price},
    contentImages: gallery(prefix),
    sizes: [{label: '6', status: 'ACTIVE', gtins: [{gtin: `${prefix}-6`}]}],
  });
  const blue = style({article: 'IH3587-400', color: 'Light Armory Blue/White', price: 73.97, prefix: 'blue'});
  const red = style({article: 'IH3587-401', color: 'University Red/White', price: 78.97, prefix: 'red'});
  const unrelated = {
    ...style({article: 'OTHER-001', color: 'Black/White', price: 10, prefix: 'other'}),
    styleCode: 'OTHER-001',
  };
  const payload = {props: {pageProps: {
    locale: {currency: 'USD'},
    selectedProduct: blue,
    productGroups: [{products: {blue, red}}, {products: {unrelated}}],
  }}};

  const result = extractProduct(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`, sourceUrl);

  assert.equal(result.method, 'Nike product data');
  assert.equal(result.price, 73.97);
  assert.equal(result.selectedVariantColor, 'Light Armory Blue/White');
  assert.deepEqual(result.images, Array.from({length: 8}, (_, index) => `https://static.nike.com/blue-${index + 1}-square.jpg`));
  assert.deepEqual(result.colorwayImages.map(({color, images}) => [color, images.length, images[0]]), [
    ['Light Armory Blue/White', 8, 'https://static.nike.com/blue-1-square.jpg'],
    ['University Red/White', 8, 'https://static.nike.com/red-1-square.jpg'],
  ]);
  assert.deepEqual(result.variants.map(({color, size, price, image}) => [color, size, price, image]), [
    ['Light Armory Blue/White', '6', 73.97, 'https://static.nike.com/blue-1-square.jpg'],
    ['University Red/White', '6', 78.97, 'https://static.nike.com/red-1-square.jpg'],
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

test('Sephora US and Spain exact linkJSON pages import their own price and currency', () => {
  const cases = [
    {url: 'https://www.sephora.com/product/replica-by-fireplace-P404758?skuId=2415552', price: 85, currency: 'USD'},
    {url: 'https://www.sephora.es/p/replica-by-the-fireplace-P3387007.html', price: 115, currency: 'EUR'},
  ];
  for (const item of cases) {
    const data = [
      {'@type': 'Product', url: 'https://www.sephora.com/product/not-this-item-P000001', name: 'Recommendation', offers: {price: 1, priceCurrency: 'USD'}},
      {'@type': 'Product', url: item.url, name: 'Replica fragrance', image: 'https://www.sephora.com/productimages/sku/s123-main-zoom.jpg', brand: {name: 'Maison Margiela'}, offers: {url: item.url, price: item.price, priceCurrency: item.currency, availability: 'https://schema.org/InStock'}},
    ];
    const htmlText = `<script id="linkJSON">${JSON.stringify(data)}</script>`;
    const result = extractProduct(htmlText, item.url);
    assert.equal(result.title, 'Replica fragrance');
    assert.equal(result.price, item.price);
    assert.equal(result.currency, item.currency);
    assert.deepEqual(result.variants, []);
  }
});

test('exact Victoria’s Secret Spain ProductGroup retains shade and band/cup variants without child URLs', () => {
  const sourceUrl = 'https://es.victoriassecret.com/es/vs/bras-catalog/5000009803';
  const product = {
    '@type': 'ProductGroup', url: sourceUrl, name: 'Sujetador Push-Up', brand: {name: "Victoria's Secret"},
    hasVariant: [
      {'@type': 'Product', skuId: 500000980301, additionalProperty: [{name: 'Color', value: 'Black'}, {name: 'Band Size', value: '34'}, {name: 'Cup Size', value: 'B'}], image: 'https://www.victoriassecret.com/images/black.jpg', offers: {price: 59.95, priceCurrency: 'EUR', availability: 'https://schema.org/InStock'}},
      {'@type': 'Product', skuId: 500000980302, additionalProperty: [{name: 'Color', value: 'Black'}, {name: 'Band Size', value: '34'}, {name: 'Cup Size', value: 'C'}], offers: {price: 59.95, priceCurrency: 'EUR'}},
      {'@type': 'Product', skuId: 500000980303, additionalProperty: [{name: 'Color', value: 'Rose'}, {name: 'Band Size', value: '36'}, {name: 'Cup Size', value: 'B'}], offers: {price: 59.95, priceCurrency: 'EUR'}},
    ],
  };
  const result = extractProduct(html(product), sourceUrl);
  assert.equal(result.method, 'JSON-LD');
  assert.equal(result.price, 59.95);
  assert.equal(result.currency, 'EUR');
  assert.equal(result.country, 'Испания');
  assert.equal(result.category, 'Одежда');
  assert.deepEqual(result.variants.map(item => [item.id, item.color, item.size, item.sizeLabel, item.label]), [
    ['500000980301', 'Black', '34 B', 'Band / cup', 'Black · 34 B'],
    ['500000980302', 'Black', '34 C', 'Band / cup', 'Black · 34 C'],
    ['500000980303', 'Rose', '36 B', 'Band / cup', 'Rose · 36 B'],
  ]);
  assert.equal(result.variants[0].availabilityKnown, true);
  assert.equal(result.variants[1].availabilityKnown, false);
});

test('Victoria’s Secret US embedded data keeps exact product sizes and shade options', () => {
  const sourceUrl = 'https://www.victoriassecret.com/us/vs/bras-catalog/5000000009';
  const state = {props: {pageProps: {product: {
    productId: '5000000009', name: 'Push-Up Smooth Bra', brand: "Victoria's Secret", price: 54.95, currency: 'USD',
    variants: [
      {skuId: 91001, optionValues: [{name: 'Shade', value: 'Black'}, {name: 'Band Size', value: '34'}, {name: 'Cup Size', value: 'B'}], isAvailable: true, images: ['https://www.victoriassecret.com/images/black.jpg']},
      {skuId: 91002, optionValues: [{name: 'Shade', value: 'Black'}, {name: 'Band Size', value: '34'}, {name: 'Cup Size', value: 'C'}], isAvailable: false},
    ],
  }}}};
  const result = extractProduct(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(state)}</script>`, sourceUrl);
  assert.equal(result.method, 'victoriassecret.com embedded product data');
  assert.equal(result.price, 54.95);
  assert.equal(result.currency, 'USD');
  assert.equal(result.country, 'США');
  assert.deepEqual(result.variants.map(item => [item.id, item.color, item.size, item.label, item.available, item.availabilityKnown]), [
    ['91001', 'Black', '34 B', 'Black · 34 B', true, true],
    ['91002', 'Black', '34 C', 'Black · 34 C', false, true],
  ]);
  const spainSource = 'https://es.victoriassecret.com/es/vs/bras-catalog/5000009803';
  const spainState = {product: {productId: '5000009803', name: 'Sujetador Push-Up', price: 59.95, currency: 'EUR', variants: [{skuId: 92001, optionValues: [{name: 'Shade', value: 'Rose'}, {name: 'Band Size', value: '36'}, {name: 'Cup Size', value: 'B'}] }]}};
  const spainResult = extractProduct(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(spainState)}</script>`, spainSource);
  assert.equal(spainResult.method, 'es.victoriassecret.com embedded product data');
  assert.equal(spainResult.country, 'Испания');
  assert.equal(spainResult.currency, 'EUR');
});
