import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionError, prepareAction } from '../lib/market/actions-server.ts';
import { blank, cartSignature, products, tariff } from '../lib/market/domain.ts';
import { defaultPolicy } from '../lib/market/policy.ts';
import { recentCheckMs } from '../lib/market/cart-check.ts';
import { customsVersion } from '../lib/market/world.ts';
import { fetchProduct, ManualEntryFallbackError } from '../lib/importer/fetch.ts';
import { browserStoreRoots, isBrowserStoreHost, isManualEntryStoreHost, isSupportedStoreHost, manualEntryStoreRoots } from '../lib/importer/stores.ts';
import { requiresMerchantSnapshot } from '../lib/importer/manual-fallback.ts';
import { withMerchantRoutes } from '../lib/importer/route-ladder.ts';

const now = Date.now();
const bestBuyUrl = 'https://www.bestbuy.com/site/apple-airpods-4-white/6447384.p?skuId=6447384';
const sephoraUrl = 'https://www.sephora.com/product/raspberry-ripple-cologne-P517158?skuId=2890044';
const unknownUrl = 'https://example-shop.com/p/1';
const product = (id, overrides = {}) => ({
  ...products[0], id, name: id, usd: 30, variants: ['Black · M'], country: 'США', boxedWeight: 0.6, weight: 1,
  sourceUrl: bestBuyUrl, sourcePrice: 30, sourceCurrency: 'USD', sourceShipping: 10, sourceShippingUsd: 10, sourceShippingCurrency: 'USD',
  sourceShippingEstimated: true, shippingKnown: true, ...overrides,
});
const unreachable = async () => { throw new ManualEntryFallbackError('blocked', undefined, 'blocked'); };
const deps = (overrides = {}) => ({ fetchProduct: unreachable, pricing: tariff, policy: defaultPolicy, operator: false, now, recentCheckMs, ...overrides });
const home = { recipient: 'Анна Каримова', phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Амира Темура, 1', postalCode: '100000', comment: '' };
const addAndOrder = async (item) => {
  const added = await prepareAction(blank(), { type: 'cart-add', product: item, variant: 'Black · M' }, deps());
  assert.equal(added.next.cart.length, 1);
  assert.equal(added.next.cart[0].product.sourceManuallyConfirmed, true);
  const state = added.next;
  const placed = await prepareAction(state, { type: 'checkout', key: 'manual-' + item.id, signature: cartSignature(state.cart), useBalance: false, expectedCredit: 0, consentVersion: customsVersion, delivery: home }, deps());
  assert.equal(placed.refusal, undefined);
  assert.equal(placed.next.orders.length, 1);
};

test('stores Atlas cannot read and stores only the gateway Chrome reads are separate lists inside the store list', () => {
  for (const host of ['www.bestbuy.com', 'www.columbia.com']) {
    assert.ok(isManualEntryStoreHost(host), host);
    assert.ok(!isBrowserStoreHost(host), host);
    assert.ok(isSupportedStoreHost(host), host);
  }
  for (const host of ['www.sephora.com', 'www2.hm.com', 'www.hm.com', 'www.macys.com', 'www.levi.com', 'www.newbalance.com', 'www.victoriassecret.com', 'api.victoriassecret.com']) {
    assert.ok(isBrowserStoreHost(host), host);
    assert.ok(!isManualEntryStoreHost(host), host);
    assert.ok(isSupportedStoreHost(host), host + ' stays an accepted store');
  }
  for (const host of ['www.walmart.com', 'www.target.com', 'www.sephora.es', 'evil-hm.com', 'sephora.com.evil.example'])
    assert.ok(!isManualEntryStoreHost(host) && !isBrowserStoreHost(host), host);
  assert.equal(manualEntryStoreRoots.filter(root => browserStoreRoots.includes(root)).length, 0);
});

test('a manual-entry store link is not fetched: the importer answers "manual" with the brand', async () => {
  const calls = [];
  const error = await fetchProduct(bestBuyUrl, async (input) => { calls.push(String(input)); return new Response('', { status: 200 }); }).catch((value) => value);
  assert.ok(error instanceof ManualEntryFallbackError);
  assert.equal(error.reason, 'manual');
  assert.equal(error.partial.brand, 'bestbuy.com');
  assert.equal(calls.length, 0);
});

test('which lines need a live store check', () => {
  assert.equal(requiresMerchantSnapshot({ sourceUrl: bestBuyUrl, sourceManuallyConfirmed: true }), false);
  assert.throws(() => requiresMerchantSnapshot({ sourceUrl: bestBuyUrl, sourceManuallyConfirmed: false }), /подтвердите/);
  assert.equal(requiresMerchantSnapshot({ sourceUrl: unknownUrl, sourceManuallyConfirmed: true }), false);
  assert.throws(() => requiresMerchantSnapshot({ sourceUrl: unknownUrl }), /подтвердите/);
  // A browser store is still asked; the confirmation only covers a gateway that cannot answer.
  assert.equal(requiresMerchantSnapshot({ sourceUrl: sephoraUrl, sourceManuallyConfirmed: true }), true);
  assert.equal(requiresMerchantSnapshot({ sourceUrl: 'https://www.target.com/p/-/A-1', sourceManuallyConfirmed: true }), true);
  // Public HTTPS only, as before.
  assert.throws(() => requiresMerchantSnapshot({ sourceUrl: 'http://example-shop.com/p/1', sourceManuallyConfirmed: true }));
  assert.throws(() => requiresMerchantSnapshot({ sourceUrl: 'https://192.168.1.10/p/1', sourceManuallyConfirmed: true }));
});

test('a confirmed line from a manual-entry store or an unknown site is added and ordered; an unconfirmed one is refused', async () => {
  for (const sourceUrl of [bestBuyUrl, unknownUrl]) {
    await assert.rejects(
      prepareAction(blank(), { type: 'cart-add', product: product('u', { sourceUrl, sourceManuallyConfirmed: false }), variant: 'Black · M' }, deps()),
      /подтвердите цену и вариант/,
    );
    await addAndOrder(product('c-' + new URL(sourceUrl).hostname, { sourceUrl, sourceManuallyConfirmed: true }));
  }
});

test('a browser store keeps the confirmation for a gateway that cannot answer and is still asked live', async () => {
  let asked = 0;
  const offline = async () => { asked++; throw new ManualEntryFallbackError('timeout', undefined, 'timeout'); };
  const added = await prepareAction(blank(), { type: 'cart-add', product: product('s', { sourceUrl: sephoraUrl, sourceManuallyConfirmed: true }), variant: 'Black · M' }, deps({ fetchProduct: offline }));
  assert.equal(asked, 1);
  assert.equal(added.next.cart[0].product.sourceManuallyConfirmed, true);
  await assert.rejects(
    prepareAction(blank(), { type: 'cart-add', product: product('s2', { sourceUrl: sephoraUrl, sourceManuallyConfirmed: false }), variant: 'Black · M' }, deps({ fetchProduct: offline })),
    (error) => error instanceof ActionError && error.code === 'err_38',
  );
});

test('a store Atlas reads never keeps a customer confirmation instead of a live check', async () => {
  const target = product('t', { sourceUrl: 'https://www.target.com/p/-/A-12345678', sourceManuallyConfirmed: true });
  await assert.rejects(
    prepareAction(blank(), { type: 'cart-add', product: target, variant: 'Black · M' }, deps()),
    (error) => error instanceof ActionError && error.code === 'err_38',
  );
});

test('the Tashkent route gets a longer turn for browser stores only', async () => {
  const seen = [];
  const slow = { name: 'tashkent', attemptMs: (target) => isBrowserStoreHost(target.hostname) ? 400 : 50, fetch: (_input, init) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })), 150);
    init.signal.addEventListener('abort', () => { clearTimeout(timer); reject(init.signal.reason); });
  }) };
  const next = { name: 'us-vps', fetch: async (input) => { seen.push(String(input)); return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }); } };
  const ladder = withMerchantRoutes([slow, next]);
  assert.equal((await ladder(sephoraUrl)).headers.get('x-atlas-route'), 'tashkent');
  assert.equal((await ladder('https://www.target.com/p/-/A-1')).headers.get('x-atlas-route'), 'us-vps');
  assert.deepEqual(seen, ['https://www.target.com/p/-/A-1']);
});
