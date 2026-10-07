import test from 'node:test';
import assert from 'node:assert/strict';
import {clearEbayTokenCacheForTests, EbayBrowseApiError, EbayManualReviewError, fetchEbayProduct} from '../lib/importer/ebay.ts';
import {fetchProduct, ManualEntryFallbackError} from '../lib/importer/fetch.ts';

const credentials = {clientId: 'app-client-id', clientSecret: 'private-cert-secret', environment: 'production'};
const listingId = '123456789012';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});
}

function ebayItem({variationId, size, amount, availability = 'IN_STOCK', color = 'Blue'} = {}) {
  return {
    itemId: `v1|${listingId}|${variationId}`,
    title: 'Atlas Trail Running Shoe',
    brand: 'Atlas Example',
    categoryPath: 'Clothing, Shoes & Accessories|Athletic Shoes',
    price: {value: String(amount), currency: 'USD'},
    itemLocation: {country: 'US'},
    image: {imageUrl: 'http://i.ebayimg.com/images/g/main/s-l500.jpg'},
    additionalImages: [{imageUrl: 'https://i.ebayimg.com/images/g/side/s-l500.jpg'}],
    color,
    localizedAspects: [
      {name: "Size (Men's)", value: size},
      {name: 'Color', value: color},
    ],
    estimatedAvailabilities: [{estimatedAvailabilityStatus: availability}],
    buyingOptions: ['FIXED_PRICE'],
  };
}

function createEbayApiMock({items = [], initialItem = {
  ...ebayItem({variationId: '9002', size: '9', amount: 91.25}),
  primaryItemGroup: {itemGroupId: listingId, itemGroupType: 'SELLER_DEFINED_VARIATIONS', itemGroupTitle: 'Atlas Trail Running Shoe'},
}} = {}) {
  const calls = [];
  const fetcher = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({url, init});
    if (url.pathname === '/identity/v1/oauth2/token') return json({access_token: 'test-access-token', expires_in: 3600});
    if (url.pathname === '/buy/browse/v1/item/get_item_by_legacy_id') return json(initialItem);
    if (url.pathname === '/buy/browse/v1/item/get_items_by_item_group') return json({items});
    throw new Error(`Unexpected eBay API request: ${url.pathname}`);
  };
  return {calls, fetcher};
}

test('eBay Browse reads exact listing group, seller size/color, per-option prices and only active variants', async () => {
  clearEbayTokenCacheForTests();
  const {calls, fetcher} = createEbayApiMock({items: [
    ebayItem({variationId: '9001', size: '8.5', amount: 88.5}),
    ebayItem({variationId: '9002', size: '9', amount: 91.25}),
    ebayItem({variationId: '9003', size: '8.5', amount: 89.75, color: 'Rose'}),
    ebayItem({variationId: '9004', size: '9.5', amount: 93, availability: 'OUT_OF_STOCK'}),
  ]});
  const source = 'https://www.ebay.com/itm/Atlas-Trail-Shoe/123456789012?var=9002';
  const importer = Object.assign(fetcher, {ebayBrowseConfig: () => credentials});
  const product = await fetchProduct(source, importer);

  assert.equal(product.method, 'eBay Browse API · listing variations');
  assert.equal(product.title, 'Atlas Trail Running Shoe');
  assert.equal(product.currency, 'USD');
  assert.equal(product.price, undefined, 'variation price must be selected from the exact option');
  assert.equal(product.country, 'США');
  assert.equal(product.selectedVariantColor, 'Blue');
  assert.deepEqual(product.variants.map(item => [item.id, item.size, item.sizeLabel, item.color, item.price, item.available]), [
    ['9001', '8.5', "Size (Men's)", 'Blue', 88.5, true],
    ['9002', '9', "Size (Men's)", 'Blue', 91.25, true],
    ['9003', '8.5', "Size (Men's)", 'Rose', 89.75, true],
  ]);
  assert.match(product.images[0], /^https:\/\/i\.ebayimg\.com\//);
  assert.ok(product.warnings.some(value => /не преобразует/.test(value)));

  const tokenCall = calls.find(call => call.url.pathname.endsWith('/oauth2/token'));
  assert.equal(tokenCall.init.method, 'POST');
  assert.equal(new URLSearchParams(String(tokenCall.init.body)).get('scope'), 'https://api.ebay.com/oauth/api_scope');
  const itemCall = calls.find(call => call.url.pathname.endsWith('/get_item_by_legacy_id'));
  assert.equal(itemCall.url.searchParams.get('legacy_item_id'), listingId);
  assert.equal(itemCall.url.searchParams.get('legacy_variation_id'), '9002');
  const groupCall = calls.find(call => call.url.pathname.endsWith('/get_items_by_item_group'));
  assert.equal(groupCall.url.searchParams.get('item_group_id'), listingId);
  assert.equal(groupCall.init.headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_US');
  assert.match(groupCall.init.headers.Authorization, /^Bearer test-access-token$/);
});

test('regional eBay marketplace is sent explicitly and a standalone item keeps its exact price', async () => {
  clearEbayTokenCacheForTests();
  const direct = {
    itemId: `v1|${listingId}|0`,
    title: 'Chaqueta de prueba',
    categoryPath: 'Ropa|Chaquetas',
    price: {value: '24.50', currency: 'EUR'},
    itemLocation: {country: 'ES'},
    image: {imageUrl: 'https://i.ebayimg.com/images/g/jacket/s-l500.jpg'},
    buyingOptions: ['FIXED_PRICE'],
    estimatedAvailabilities: [{estimatedAvailabilityStatus: 'IN_STOCK'}],
  };
  const {calls, fetcher} = createEbayApiMock({initialItem: direct});
  const product = await fetchEbayProduct(`https://www.ebay.es/itm/${listingId}`, credentials, fetcher);
  assert.equal(product?.price, 24.5);
  assert.equal(product?.currency, 'EUR');
  assert.equal(product?.country, 'Испания');
  assert.equal(product?.variants?.[0].price, 24.5);
  assert.equal(calls.find(call => call.url.pathname.endsWith('/get_item_by_legacy_id')).init.headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_ES');
});

test('a parent variation link recovers a legacy-item 400 through its exact item group', async () => {
  clearEbayTokenCacheForTests();
  const items = [
    ebayItem({variationId: '9001', size: '8', amount: 28}),
    ebayItem({variationId: '9002', size: '9', amount: 31}),
    ebayItem({variationId: '9003', size: '10', amount: 28, availability: 'OUT_OF_STOCK'}),
  ];
  const calls = [];
  const fetcher = async input => {
    const url = new URL(String(input)); calls.push(url);
    if (url.pathname.endsWith('/oauth2/token')) return json({access_token: 'test-access-token', expires_in: 3600});
    if (url.pathname.endsWith('/get_item_by_legacy_id')) return json({errors:[{errorId:11001}]}, 400);
    assert.equal(url.searchParams.get('item_group_id'), listingId);
    return json({items});
  };
  const product = await fetchEbayProduct(`https://www.ebay.com/itm/${listingId}`, credentials, fetcher);
  assert.equal(product.title, 'Atlas Trail Running Shoe');
  assert.equal(product.currency, 'USD');
  assert.equal(product.price, undefined);
  assert.equal(product.selectedVariantColor, undefined, 'a parent URL must not select the first child color');
  assert.deepEqual(product.variants.map(v => [v.id, v.size, v.price]), [['9001','8',28],['9002','9',31]]);
  assert.equal(calls.length, 3);
});

test('an explicit invalid child variation is not replaced with the parent group', async () => {
  clearEbayTokenCacheForTests();
  const calls = [];
  const fetcher = async input => {
    const url = new URL(String(input)); calls.push(url);
    return url.pathname.endsWith('/oauth2/token')
      ? json({access_token:'test-access-token', expires_in:3600})
      : json({errors:[{errorId:11001}]}, 400);
  };
  await assert.rejects(fetchEbayProduct(`https://www.ebay.com/itm/${listingId}?var=9999`, credentials, fetcher), error => error instanceof EbayBrowseApiError && error.status === 400);
  assert.equal(calls.length, 2);
});

test('an explicit child link rejects successful sibling data before mapping or loading its group', async () => {
  for (const grouped of [false, true]) {
    clearEbayTokenCacheForTests();
    const initialItem = ebayItem({variationId: '9001', size: '8', amount: 28});
    if (grouped) initialItem.primaryItemGroup = {itemGroupId: listingId, itemGroupType: 'SELLER_DEFINED_VARIATIONS'};
    const {calls, fetcher} = createEbayApiMock({initialItem, items: [
      initialItem,
      ebayItem({variationId: '9002', size: '9', amount: 31}),
    ]});
    await assert.rejects(
      fetchEbayProduct(`https://www.ebay.com/itm/${listingId}?var=9002`, credentials, fetcher),
      error => error instanceof EbayManualReviewError && error.stage === 'variant_data' && error.status === 200,
    );
    assert.equal(calls.length, 2, 'sibling data must not become the requested child or a group preview');
  }
});

test('an explicit child link preserves the matching child identity and price', async () => {
  clearEbayTokenCacheForTests();
  const {calls, fetcher} = createEbayApiMock({initialItem: ebayItem({variationId: '9002', size: '9', amount: 31})});
  const product = await fetchEbayProduct(`https://www.ebay.com/itm/${listingId}?var=9002`, credentials, fetcher);
  assert.equal(product.price, 31);
  assert.equal(product.variants[0].id, '9002');
  assert.equal(product.variants[0].size, '9');
  assert.equal(calls.length, 2);
});

test('parent recovery rejects unrelated group data and keeps a sold-out group unavailable', async () => {
  for (const unrelated of [true, false]) {
    clearEbayTokenCacheForTests();
    const item = ebayItem({variationId:'9001',size:'8',amount:28,availability:'OUT_OF_STOCK'});
    if (unrelated) item.itemId = 'v1|999999999999|9001';
    const fetcher = async input => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/oauth2/token')) return json({access_token:'test-access-token', expires_in:3600});
      if (path.endsWith('/get_item_by_legacy_id')) return json({errors:[{errorId:11001}]},400);
      return json({items:[item]});
    };
    await assert.rejects(fetchEbayProduct(`https://www.ebay.com/itm/${listingId}`, credentials, fetcher), unrelated ? /запрошенного объявления/ : /больше недоступно/);
  }
});

test('eBay auction and mismatched variation responses do not become a purchasable price', async () => {
  clearEbayTokenCacheForTests();
  const auction = {itemId: `v1|${listingId}|0`, title: 'Auction', price: {value: '2', currency: 'USD'}, buyingOptions: ['AUCTION']};
  const first = createEbayApiMock({initialItem: auction});
  await assert.rejects(fetchEbayProduct(`https://www.ebay.com/itm/${listingId}`, credentials, first.fetcher), /аукцион|фиксированной цены/i);

  clearEbayTokenCacheForTests();
  const mismatched = ebayItem({variationId: '9001', size: '8.5', amount: 88.5});
  mismatched.itemId = 'v1|999999999999|9001';
  const unrelated = createEbayApiMock({items: [mismatched]});
  const source = 'https://www.ebay.com/itm/Atlas-Trail-Shoe/123456789012';
  await assert.rejects(fetchProduct(source, Object.assign(unrelated.fetcher, {ebayBrowseConfig: () => credentials})), error => error instanceof ManualEntryFallbackError && /вариант вручную|варианта с проверяемой ценой/i.test(error.message));
});

test('missing credentials or unsupported eBay path leaves the safe legacy/manual flow available', async () => {
  clearEbayTokenCacheForTests();
  let calls = 0;
  const fetcher = async () => { calls++; throw new Error('should not call eBay Browse API'); };
  assert.equal(await fetchEbayProduct(`https://www.ebay.com/itm/${listingId}`, {}, fetcher), undefined);
  assert.equal(await fetchEbayProduct('https://www.ebay.com/itm/seller-short-link', credentials, fetcher), undefined);
  assert.equal(calls, 0);
});

test('eBay API failures retain only a safe diagnostic stage and HTTP status', async () => {
  clearEbayTokenCacheForTests();
  const privateBody = JSON.stringify({errors: [{errorId: 12345, message: 'private-ebay-error-details'}]});
  const oauthFailure = async () => new Response(privateBody, {status: 401, headers: {'Content-Type': 'application/json'}});
  await assert.rejects(
    fetchEbayProduct(`https://www.ebay.com/itm/${listingId}`, credentials, oauthFailure),
    error => error instanceof EbayBrowseApiError && error.stage === 'oauth' && error.status === 401 && error.errorId === 12345 && !error.message.includes('private-ebay-error-details'),
  );

  clearEbayTokenCacheForTests();
  const browseFailure = async (input) => new URL(String(input)).pathname.endsWith('/oauth2/token')
    ? json({access_token: 'test-access-token', expires_in: 3600})
    : new Response(privateBody, {status: 403, headers: {'Content-Type': 'application/json'}});
  await assert.rejects(
    fetchEbayProduct(`https://www.ebay.com/itm/${listingId}`, credentials, browseFailure),
    error => error instanceof EbayBrowseApiError && error.stage === 'browse_item' && error.status === 403 && error.errorId === 12345 && !error.message.includes('private-ebay-error-details'),
  );
});

test('eBay fallback logs stage and status without listing URL or upstream body', async () => {
  clearEbayTokenCacheForTests();
  const privateBody = JSON.stringify({errors: [{errorId: 12345, message: 'private-ebay-error-details'}]});
  const fetcher = Object.assign(async input => new URL(String(input)).pathname.endsWith('/oauth2/token')
    ? json({access_token: 'test-access-token', expires_in: 3600})
    : new Response(privateBody, {status: 403, headers: {'Content-Type': 'application/json'}}), {ebayBrowseConfig: () => credentials});
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = message => warnings.push(String(message));
  try {
    await assert.rejects(fetchProduct(`https://www.ebay.com/itm/${listingId}`, fetcher), error => error instanceof ManualEntryFallbackError);
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual(warnings, ['[eBay import] stage=browse_item status=403 errorId=12345']);
  assert.ok(warnings.every(message => !message.includes(listingId) && !message.includes(privateBody)));
});

test('an ended or unavailable eBay listing is not converted into the manual order fallback', async () => {
  clearEbayTokenCacheForTests();
  const {fetcher} = createEbayApiMock({initialItem: {
    itemId: `v1|${listingId}|0`,
    title: 'Ended listing',
    price: {value: '10', currency: 'USD'},
    buyingOptions: ['FIXED_PRICE'],
    estimatedAvailabilities: [{estimatedAvailabilityStatus: 'OUT_OF_STOCK'}],
  }});
  await assert.rejects(fetchProduct(`https://www.ebay.com/itm/${listingId}`, Object.assign(fetcher, {ebayBrowseConfig: () => credentials})), /больше недоступно/i);
});
