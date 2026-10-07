import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createEbayAwareMerchantFetch, isFixedEbayApiRequest} from '../lib/importer/ebay-transport.ts';
import {createMerchantProxyFetch} from '../lib/importer/proxy-client.mjs';
import {fetchProduct} from '../lib/importer/fetch.ts';
import {clearEbayTokenCacheForTests} from '../lib/importer/ebay.ts';

const config = {clientId: 'synthetic-client', clientSecret: 'synthetic-secret', environment: 'production'};
const source = 'https://www.ebay.com/itm/123456789012';
const item = {
  itemId: 'v1|123456789012|0', title: 'Synthetic eBay transport product',
  price: {value: '25', currency: 'USD'}, buyingOptions: ['FIXED_PRICE'],
  image: {imageUrl: 'https://i.ebayimg.com/images/g/test/s-l500.jpg'}, itemLocation: {country: 'US'},
};

test('only fixed eBay OAuth and Browse routes on the production or sandbox origin bypass egress', () => {
  for (const host of ['api.ebay.com', 'api.sandbox.ebay.com']) {
    assert.equal(isFixedEbayApiRequest(`https://${host}/identity/v1/oauth2/token`, {method: 'POST'}), true);
    assert.equal(isFixedEbayApiRequest(`https://${host}/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=123456789012`), true);
    assert.equal(isFixedEbayApiRequest(new URL(`https://${host}/buy/browse/v1/item/get_items_by_item_group?item_group_id=123456789012`), {method: 'GET'}), true);
  }
  assert.equal(isFixedEbayApiRequest('not a URL'), false);
  assert.equal(isFixedEbayApiRequest(source), false);
  assert.equal(isFixedEbayApiRequest('https://api.ebay.com.example/identity/v1/oauth2/token', {method: 'POST'}), false);
  assert.equal(isFixedEbayApiRequest('https://www.api.ebay.com/identity/v1/oauth2/token', {method: 'POST'}), false);
});

test('unsafe official API targets and unsupported route/method pairs are rejected before transport', async () => {
  const targets = [
    ['http://api.ebay.com/identity/v1/oauth2/token', 'POST'],
    ['https://user@api.ebay.com/identity/v1/oauth2/token', 'POST'],
    ['https://user:password@api.ebay.com/identity/v1/oauth2/token', 'POST'],
    ['https://api.ebay.com:8443/identity/v1/oauth2/token', 'POST'],
    ['https://api.ebay.com/identity/v1/oauth2/token#fragment', 'POST'],
    ['https://api.ebay.com/identity/v1/oauth2/token', 'GET'],
    ['https://api.ebay.com/buy/browse/v1/item/get_item_by_legacy_id', 'POST'],
    ['https://api.ebay.com/buy/browse/v1/item/get_items_by_item_group', 'DELETE'],
    ['https://api.ebay.com/buy/browse/v1/item/search', 'GET'],
    ['https://api.ebay.com/identity/v1/oauth2/token/extra', 'POST'],
  ];
  let calls = 0;
  const unexpected = async () => { calls++; throw new Error('must not send'); };
  const fetcher = createEbayAwareMerchantFetch(unexpected, () => config, unexpected);
  for (const [url, method] of targets) {
    await assert.rejects(fetcher(url, {method}), /Unsafe eBay API target|Unsupported eBay API request/);
  }
  assert.equal(calls, 0);
});

test('shared importer transport sends OAuth/Browse directly and keeps API headers and body out of the signed proxy', async () => {
  clearEbayTokenCacheForTests();
  const apiCalls = [];
  const proxyCalls = [];
  const proxy = createMerchantProxyFetch({
    endpoint: 'https://proxy.example.com/v1/fetch', secret: 'a'.repeat(64),
    fetchImpl: async (url, init) => {
      proxyCalls.push({url, payload: JSON.parse(init.body)});
      return Response.json({version: 1, status: 200, headers: {contentType: 'text/html'}, body: Buffer.from('<title>Merchant</title>').toString('base64')});
    },
  });
  const apiFetch = async (input, init) => {
    const url = new URL(String(input));
    apiCalls.push({url, init});
    if (url.pathname.endsWith('/oauth2/token')) return Response.json({access_token: 'synthetic-access-token', expires_in: 3600});
    return Response.json(item);
  };
  const fetcher = createEbayAwareMerchantFetch(proxy, () => config, apiFetch);
  const product = await fetchProduct(source, fetcher);
  assert.equal(product.method, 'eBay Browse API');
  assert.equal(product.price, 25);
  assert.equal(proxyCalls.length, 0);
  assert.equal(apiCalls.length, 2);
  assert.equal(apiCalls[0].init.headers.Authorization, `Basic ${btoa('synthetic-client:synthetic-secret')}`);
  assert.equal(new URLSearchParams(String(apiCalls[0].init.body)).get('grant_type'), 'client_credentials');
  assert.equal(apiCalls[1].init.headers.Authorization, 'Bearer synthetic-access-token');
  assert.ok(apiCalls.every(call => call.url.hostname === 'api.ebay.com' && call.init.redirect === 'manual'));

  await fetcher('https://www.nike.com/t/synthetic-product', {headers: {Accept: 'text/html'}});
  assert.equal(proxyCalls.length, 1);
  assert.equal(proxyCalls[0].payload.url, 'https://www.nike.com/t/synthetic-product');
  assert.deepEqual(proxyCalls[0].payload.headers, {accept: 'text/html'});
  assert.equal(proxyCalls[0].payload.body, undefined);
  assert.ok(!JSON.stringify(proxyCalls).includes('synthetic-secret'));
  assert.ok(!JSON.stringify(proxyCalls).includes('synthetic-access-token'));
  clearEbayTokenCacheForTests();
});

test('merchant diagnostic CLI uses optional Browse bindings and still fails closed for a partial proxy', () => {
  const preload = `globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.hostname !== 'api.sandbox.ebay.com') throw new Error('unexpected transport');
    if (url.pathname.endsWith('/oauth2/token')) return Response.json({access_token:'synthetic-access-token',expires_in:3600});
    return Response.json(${JSON.stringify(item)});
  };`;
  const env = {
    ...process.env, EBAY_CLIENT_ID: 'synthetic-client', EBAY_CLIENT_SECRET: 'synthetic-secret', EBAY_ENV: 'sandbox',
    ATLAS_IMPORT_PROXY_URL: '', ATLAS_IMPORT_PROXY_SECRET: '',
  };
  const cli = fileURLToPath(new URL('../scripts/check-merchant-imports.mjs', import.meta.url));
  const args = ['--experimental-strip-types', '--import', `data:text/javascript,${encodeURIComponent(preload)}`, cli, source];
  const result = spawnSync(process.execPath, args, {env, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.results[0].status, 'details-imported');
  assert.equal(report.results[0].method, 'eBay Browse API');
  assert.equal(report.results[0].price, 25);
  assert.ok(!result.stdout.includes('synthetic-secret'));
  const partial = spawnSync(process.execPath, args, {env: {...env, ATLAS_IMPORT_PROXY_URL: 'https://proxy.example.com/v1/fetch'}, encoding: 'utf8'});
  assert.notEqual(partial.status, 0);
  assert.match(partial.stderr, /direct fallback is disabled/);
});
