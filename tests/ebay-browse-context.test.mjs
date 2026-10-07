import test from 'node:test';
import assert from 'node:assert/strict';
import {clearEbayTokenCacheForTests, EbayBrowseApiError, ebayConditionNote, ebayEndUserContext, ebaySellerShipping, ebayShipsTo, fetchEbayProduct} from '../lib/importer/ebay.ts';
import {importDraft} from '../lib/market/catalog-editor.ts';

const credentials = {clientId: 'app-client-id', clientSecret: 'private-cert-secret', environment: 'production'};
const listingId = '123456789012';
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});

function listing(extra = {}) {
  return {
    itemId: `v1|${listingId}|0`,
    title: 'Atlas Trail Running Shoe',
    brand: 'Atlas Example',
    categoryPath: 'Clothing, Shoes & Accessories|Athletic Shoes',
    price: {value: '91.25', currency: 'USD'},
    marketingPrice: {originalPrice: {value: '120.00', currency: 'USD'}, discountPercentage: '24'},
    condition: 'New',
    conditionId: '1000',
    itemLocation: {country: 'US'},
    image: {imageUrl: 'https://i.ebayimg.com/images/g/main/s-l500.jpg'},
    estimatedAvailabilities: [{estimatedAvailabilityStatus: 'IN_STOCK'}],
    buyingOptions: ['FIXED_PRICE'],
    seller: {username: 'atlas_outlet', feedbackPercentage: '99.6', feedbackScore: 1534},
    topRatedBuyingExperience: true,
    shipToLocations: {regionIncluded: [{regionId: 'WORLDWIDE', regionType: 'WORLDWIDE'}], regionExcluded: [{regionId: 'RU', regionType: 'COUNTRY'}]},
    shippingOptions: [
      {shippingServiceCode: 'USPS Priority', shippingCostType: 'FIXED', shippingCost: {value: '12.50', currency: 'USD'}, shipToLocationUsedForEstimate: {country: 'US', postalCode: '19801'}},
      {shippingServiceCode: 'Economy', shippingCostType: 'CALCULATED', shippingCost: {value: '7.95', currency: 'USD'}, shipToLocationUsedForEstimate: {country: 'US', postalCode: '19801'}},
      {shippingServiceCode: 'Canada Post', shippingCost: {value: '1.00', currency: 'CAD'}, shipToLocationUsedForEstimate: {country: 'CA'}},
    ],
    ...extra,
  };
}

function mock(item) {
  const calls = [];
  const fetcher = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({url, init});
    if (url.pathname === '/identity/v1/oauth2/token') return json({access_token: 'test-access-token', expires_in: 3600});
    if (url.pathname === '/buy/browse/v1/item/get_item_by_legacy_id') return json(item);
    throw new Error(`Unexpected eBay API request: ${url.pathname}`);
  };
  return {calls, fetcher};
}

test('the warehouse address goes to eBay as X-EBAY-C-ENDUSERCTX and the cheapest US shipping option, "was" price, seller and condition come back', async () => {
  clearEbayTokenCacheForTests();
  assert.equal(ebayEndUserContext({...credentials}).header, 'contextualLocation=country%3DUS');
  assert.equal(ebayEndUserContext({...credentials, shipToCountry: 'us', shipToPostalCode: '19801'}).header, 'contextualLocation=country%3DUS%2Czip%3D19801');
  assert.equal(ebayEndUserContext({...credentials, shipToCountry: 'USA'}), undefined);

  const {calls, fetcher} = mock(listing());
  const product = await fetchEbayProduct(`https://www.ebay.com/itm/${listingId}`, {...credentials, shipToPostalCode: '19801'}, fetcher);
  const browse = calls.find(call => call.url.pathname.endsWith('/get_item_by_legacy_id'));
  assert.equal(browse.init.headers['X-EBAY-C-ENDUSERCTX'], 'contextualLocation=country%3DUS%2Czip%3D19801');
  assert.equal(browse.init.headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_US');
  assert.equal(calls.find(call => call.url.pathname.endsWith('/oauth2/token')).init.headers['X-EBAY-C-ENDUSERCTX'], undefined);

  assert.equal(product.price, 91.25);
  assert.equal(product.referencePrice, 120);
  assert.equal(product.shipping, 7.95);
  assert.equal(product.shippingCurrency, 'USD');
  assert.equal(product.shippingDestination, 'US');
  assert.ok(product.warnings.some(text => /Продавец eBay: atlas_outlet, положительных отзывов 99,6 %, всего отзывов 1534, статус Top Rated/.test(text)));
  assert.ok(product.warnings.some(text => /Доставка продавца до склада Atlas взята из расчёта eBay/.test(text)));
  assert.ok(!product.warnings.some(text => /Состояние по объявлению/.test(text)), 'a new item needs no condition note');

  // The catalog draft carries the store-stated USD shipping instead of the $10 placeholder.
  const draft = importDraft(product, [], 'США');
  assert.equal(draft.sourceShippingUsd, 7.95);
  assert.equal(draft.sourceShippingEstimated, false);
  assert.equal(draft.referencePrice, 120);
  const placeholder = importDraft({...product, shipping: undefined}, [], 'США');
  assert.equal(placeholder.sourceShippingUsd, 10);
  assert.equal(placeholder.sourceShippingEstimated, true);
});

test('used or refurbished listings are flagged, free shipping is kept as zero, and foreign-currency "was" prices are ignored', async () => {
  clearEbayTokenCacheForTests();
  const item = listing({
    condition: 'Seller refurbished', conditionId: '2500',
    marketingPrice: {originalPrice: {value: '150.00', currency: 'EUR'}},
    shippingOptions: [{shippingCost: {value: '0.00', currency: 'USD'}, shipToLocationUsedForEstimate: {country: 'US'}}],
  });
  const product = await fetchEbayProduct(`https://www.ebay.com/itm/${listingId}`, credentials, mock(item).fetcher);
  assert.equal(product.shipping, 0);
  assert.equal(product.referencePrice, undefined);
  assert.ok(product.warnings.some(text => /Состояние по объявлению eBay: Seller refurbished/.test(text)));
  assert.ok(product.warnings.some(text => /доставляет до склада Atlas бесплатно/.test(text)));
  assert.equal(ebayConditionNote({condition: 'Brand New'}), undefined);
  assert.match(ebayConditionNote({condition: 'New other (see details)', conditionId: '1500'}), /New other/);
  assert.equal(ebaySellerShipping({shippingOptions: [{shippingCost: {value: '-1', currency: 'USD'}}]}, 'US'), undefined);
});

test('a seller who excludes the warehouse country stops the import with a clear reason; unknown ship-to data does not', async () => {
  clearEbayTokenCacheForTests();
  assert.equal(ebayShipsTo({shipToLocations: {regionIncluded: [{regionId: 'EUROPE'}]}}, 'US'), false);
  assert.equal(ebayShipsTo({shipToLocations: {regionIncluded: [{regionId: 'NORTH_AMERICA'}]}}, 'US'), true);
  assert.equal(ebayShipsTo({shipToLocations: {regionExcluded: [{regionId: 'US'}]}}, 'US'), false);
  assert.equal(ebayShipsTo({}, 'US'), undefined);

  const excluded = listing({shipToLocations: {regionIncluded: [{regionId: 'WORLDWIDE'}], regionExcluded: [{regionId: 'US', regionType: 'COUNTRY'}]}});
  await assert.rejects(fetchEbayProduct(`https://www.ebay.com/itm/${listingId}`, credentials, mock(excluded).fetcher), error =>
    error.name === 'EbayManualReviewError' && /не отправляет этот товар в США/.test(error.message));

  const silent = listing({shipToLocations: undefined, shippingOptions: undefined, seller: undefined});
  const product = await fetchEbayProduct(`https://www.ebay.com/itm/${listingId}`, credentials, mock(silent).fetcher);
  assert.equal(product.shipping, undefined);
  assert.ok(!product.warnings.some(text => /Продавец eBay:/.test(text)));
});

test('eBay error ids are explained for the operator: production access, token, rate limit, listing gone', () => {
  const describe = (status, errorId, detail) => new EbayBrowseApiError('browse_item', status, errorId, detail).describe();
  assert.match(describe(403, 1100, 'Access denied'), /HTTP 403, errorId 1100 — Access denied · у этого keyset нет прав на Buy API в production.*eBay Partner Network/);
  assert.match(describe(401, 1001), /токен приложения отклонён/);
  assert.match(describe(429, undefined), /лимит запросов eBay API исчерпан/);
  assert.match(describe(404, 11001), /не найдено/);
  assert.match(describe(400, 11006), /\?var=/);
  assert.equal(describe(500, 99999, 'x'), 'eBay Browse API: запрос объявления, HTTP 500, errorId 99999 — x');
});
