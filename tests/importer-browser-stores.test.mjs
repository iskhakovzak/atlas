import test from 'node:test';
import assert from 'node:assert/strict';
import {createEnginePlanner, fetchWithEngines} from '../deploy/upcloud/merchant-engines.mjs';
import {loadBrowserEngine} from '../deploy/upcloud/browser-engine.mjs';
import {extractProduct} from '../lib/importer/extract.ts';

const page = (body, status = 200) => new Response(body, {status, headers: {'content-type': 'text/html; charset=utf-8'}});
const productHtml = '<html><script type="application/ld+json">{"@type":"Product","name":"Cologne","offers":{"price":"20","priceCurrency":"USD"}}</script></html>';
const ld = value => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

test('auto mode reaches the desktop browser only after the cheaper engines meet a wall, then starts with it', async () => {
  const deadlines = [];
  const engines = {
    fetch: async () => page('<title>Access Denied</title>', 403),
    impersonate: async () => page('<title>Access Denied</title>', 403),
    browser: async (_target, options) => { deadlines.push(options.deadline); return page(productHtml); },
  };
  const planner = createEnginePlanner(['fetch', 'impersonate', 'browser']);
  const target = new URL('https://www.sephora.com/product/x-P1');
  const first = await fetchWithEngines({target, method: 'GET', headers: {}, mode: 'auto', engines, planner});
  assert.equal(first.engine, 'browser');
  assert.deepEqual(first.attempts, ['fetch:403:http-403', 'impersonate:403:http-403', 'browser:200']);
  assert.ok(Number.isFinite(deadlines[0]) && deadlines[0] > Date.now(), 'the browser learns its own deadline');
  const second = await fetchWithEngines({target, method: 'GET', headers: {}, mode: 'auto', engines, planner});
  assert.deepEqual(second.attempts, ['browser:200']);
  // A session request (Amazon's cookies) never escalates to another engine.
  const session = await fetchWithEngines({target, method: 'GET', headers: {cookie: 'a=b'}, mode: 'auto', engines, planner});
  assert.deepEqual(session.attempts, ['fetch:403:http-403']);
});

test('the browser engine is off without an installed Chrome', () => {
  assert.equal(loadBrowserEngine({executable: undefined}), undefined);
  assert.equal(loadBrowserEngine({executable: 'C:/no/such/chrome.exe', profileDir: 'x'}), undefined);
});

test('Sephora: the linked SKU from the page state, every size with sale and list prices', () => {
  const source = 'https://www.sephora.com/product/raspberry-ripple-cologne-P517158?skuId=2890044&icid2=homepage';
  const sku = (skuId, size, list, sale, extra = {}) => ({skuId, size, variationValue: `${size} cologne spray`, listPrice: list, salePrice: sale, isOutOfStock: false, skuImages: {imageUrl: `https://www.sephora.com/productimages/sku/s${skuId}-main-zoom.jpg`}, ...extra});
  const state = {page: {product: {
    productId: 'P517158', variationType: 'Size + Concentration + Formulation',
    productDetails: {displayName: 'Raspberry Ripple Cologne with White Musk', brand: {displayName: 'Jo Malone London'}},
    parentCategory: {displayName: 'Perfume'},
    currentSku: sku('2890044', '3.4 oz/100 ml', '$175.00', '$122.50'),
    onSaleChildSkus: [sku('2890028', '0.34 oz/10 mL', '$38.00', '$26.60'), sku('2890044', '3.4 oz/100 ml', '$175.00', '$122.50'), sku('2890069', '1 oz/30 ml', '$95.00', '$66.50', {isOutOfStock: true})],
  }}};
  const html = `<script id="linkStore" type="text/json">${JSON.stringify(state)}</script>`;
  const result = extractProduct(html, source);
  assert.equal(result.title, 'Raspberry Ripple Cologne with White Musk');
  assert.equal(result.brand, 'Jo Malone London');
  assert.equal(result.price, 122.5);
  assert.equal(result.referencePrice, 175);
  assert.equal(result.currency, 'USD');
  assert.equal(result.selectedVariantId, '2890044');
  assert.deepEqual(result.variants.map(v => [v.size, v.price, v.compareAtPrice, v.available]), [
    ['3.4 oz/100 ml', 122.5, 175, true], ['0.34 oz/10 mL', 26.6, 38, true], ['1 oz/30 ml', 66.5, 95, false],
  ]);
  assert.equal(extractProduct(html, source.replace('2890044', '2890028')).price, 26.6);
  // A SKU that is not on the page, or another product's page, gives no price.
  assert.equal(extractProduct(html, source.replace('2890044', '9999999')).price, undefined);
  assert.equal(extractProduct(html, 'https://www.sephora.com/product/other-P999?skuId=2890044').price, undefined);
  assert.equal(extractProduct(html.replace('"$175.00"', '"€175.00"').replace('"$122.50"', '"€122.50"'), source).price, undefined);
});

test("Macy's: offers naming a colour and size become the options; bare sold-out offers are left out", () => {
  const source = 'https://www.macys.com/shop/product/polo-jacket?ID=26244617';
  const offer = (size, price) => ({'@type': 'Offer', itemOffered: {'@type': 'IndividualProduct', color: 'Sweet Tomato', size}, SKU: 'S' + size, price, priceCurrency: 'USD', availability: 'http://schema.org/InStock'});
  const html = ld({'@type': 'Product', name: 'Quilted Jacket', url: source, brand: {name: 'Polo Ralph Lauren'}, offers: [offer('L', '348.00'), offer('M', '348.00'), {'@type': 'Offer', SKU: 'X', availability: 'http://schema.org/OutOfStock'}]});
  const result = extractProduct(html, source);
  assert.equal(result.price, 348);
  assert.deepEqual(result.variants.map(v => [v.label, v.size, v.price]), [['Sweet Tomato · L', 'L', 348], ['Sweet Tomato · M', 'M', 348]]);
  // A priced offer without an option name is not guessed at.
  const unnamed = ld({'@type': 'Product', name: 'Quilted Jacket', url: source, offers: [offer('L', '348.00'), {'@type': 'Offer', price: '10', priceCurrency: 'USD'}]});
  assert.deepEqual(extractProduct(unnamed, source).variants, []);
});

test('New Balance: a group that is the linked listing prices its sizes when they all cost the same', () => {
  const source = 'https://www.newbalance.com/pd/fuelcell-rebel-v5/MFCXV5_RU-FTW-838113.html';
  const size = (value, price) => ({'@type': 'Product', name: 'FuelCell Rebel v5', color: 'SATSUMA ORANGE', size: value, sku: 'MFCX5IM-' + value, offers: {'@type': 'Offer', url: `https://www.newbalance.com/pd/fuelcell-rebel-v5/MFCX5IM-${value}.html`, price, priceCurrency: 'USD', availability: 'https://schema.org/InStock'}});
  const group = sizes => ld({'@type': 'ProductGroup', name: 'FuelCell Rebel v5', url: source, '@id': source, brand: {name: 'New Balance'}, hasVariant: sizes});
  const result = extractProduct(group([size('7', '144.99'), size('8', '144.99')]), source);
  assert.equal(result.price, 144.99);
  assert.equal(result.currency, 'USD');
  assert.deepEqual(result.variants.map(v => v.size), ['7', '8']);
  // Different prices per size: no single price for the listing.
  assert.equal(extractProduct(group([size('7', '144.99'), size('8', '99.99')]), source).price, undefined);
});

test("Levi's: a stray array among a group's children does not hide the linked child's price", () => {
  const source = 'https://www.levi.com/US/en_US/jeans/p/0057U0007';
  const html = ld([{'@type': 'ProductGroup', name: "501 Loose Men's Jeans", brand: {name: 'Levi'}, hasVariant: [
    {'@type': 'Product', name: "501 Loose Men's Jeans", color: 'Medium Wash', '@id': source, offers: {'@type': 'Offer', url: source, price: '77.0', priceCurrency: 'USD', availability: 'https://schema.org/InStock'}},
    [{url: 'https://www.levi.com/US/en_US/jeans/p/0057U0008'}],
  ]}]);
  const result = extractProduct(html, source);
  assert.equal(result.price, 77);
  assert.equal(result.currency, 'USD');
});
