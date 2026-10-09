import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionError, prepareAction } from '../lib/market/actions-server.ts';
import { blank, cartSignature, products, tariff } from '../lib/market/domain.ts';
import { defaultPolicy } from '../lib/market/policy.ts';
import { recentCheckMs } from '../lib/market/cart-check.ts';
import { customsVersion } from '../lib/market/world.ts';
import { fetchProduct, ManualEntryFallbackError } from '../lib/importer/fetch.ts';
import { isManualEntryStoreHost, isSupportedStoreHost, manualEntryStoreRoots } from '../lib/importer/stores.ts';
import { requiresMerchantSnapshot } from '../lib/importer/manual-fallback.ts';

const now = Date.now();
const hmUrl = 'https://www2.hm.com/en_us/productpage.1245444006.html';
const product = (id, overrides = {}) => ({
  ...products[0], id, name: id, usd: 30, variants: ['Black · M'], country: 'США', boxedWeight: 0.6, weight: 1,
  sourceUrl: hmUrl, sourcePrice: 30, sourceCurrency: 'USD', sourceShipping: 10, sourceShippingUsd: 10, sourceShippingCurrency: 'USD',
  sourceShippingEstimated: true, shippingKnown: true, ...overrides,
});
const manual = async (url) => { throw new ManualEntryFallbackError('manual', { sourceUrl: String(url), warnings: [] }, 'manual'); };
const deps = (overrides = {}) => ({ fetchProduct: manual, pricing: tariff, policy: defaultPolicy, operator: false, now, recentCheckMs, ...overrides });
const home = { recipient: 'Анна Каримова', phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Амира Темура, 1', postalCode: '100000', comment: '' };

test('stores Atlas cannot read are listed for manual entry and stay inside the store list', () => {
  for (const host of ['www2.hm.com', 'www.hm.com', 'www.macys.com', 'www.sephora.com', 'www.bestbuy.com', 'www.levi.com', 'www.newbalance.com', 'www.columbia.com', 'www.victoriassecret.com', 'api.victoriassecret.com']) {
    assert.ok(isManualEntryStoreHost(host), host);
    assert.ok(isSupportedStoreHost(host), host + ' stays an accepted store');
  }
  for (const host of ['www.walmart.com', 'www.target.com', 'www.zara.com', 'es.victoriassecret.com', 'www.sephora.es', 'evil-hm.com'])
    assert.ok(!isManualEntryStoreHost(host), host);
  assert.equal(new Set(manualEntryStoreRoots).size, manualEntryStoreRoots.length);
});

test('a manual-entry store link is not fetched: the importer answers "manual" with the brand', async () => {
  const calls = [];
  const error = await fetchProduct(hmUrl, async (input) => { calls.push(String(input)); return new Response('', { status: 200 }); }).catch((value) => value);
  assert.ok(error instanceof ManualEntryFallbackError);
  assert.equal(error.reason, 'manual');
  assert.equal(error.partial.brand, 'hm.com');
  assert.equal(calls.length, 0);
  assert.equal(requiresMerchantSnapshot({ sourceUrl: hmUrl, sourceManuallyConfirmed: true }), false);
  assert.throws(() => requiresMerchantSnapshot({ sourceUrl: hmUrl, sourceManuallyConfirmed: false }), /подтвердите/);
  assert.equal(requiresMerchantSnapshot({ sourceUrl: 'https://www.target.com/p/-/A-1', sourceManuallyConfirmed: true }), true);
});

test('a confirmed manual line is added and ordered; an unconfirmed one is refused like any unread store', async () => {
  await assert.rejects(
    prepareAction(blank(), { type: 'cart-add', product: product('u', { sourceManuallyConfirmed: false }), variant: 'Black · M' }, deps()),
    /подтвердите цену и вариант/,
  );
  const added = await prepareAction(blank(), { type: 'cart-add', product: product('c', { sourceManuallyConfirmed: true }), variant: 'Black · M' }, deps());
  assert.equal(added.next.cart.length, 1);
  assert.equal(added.next.cart[0].product.sourceManuallyConfirmed, true);
  const state = added.next;
  const placed = await prepareAction(state, { type: 'checkout', key: 'manual-' + now, signature: cartSignature(state.cart), useBalance: false, expectedCredit: 0, consentVersion: customsVersion, delivery: home }, deps());
  assert.equal(placed.refusal, undefined);
  assert.equal(placed.next.orders.length, 1);
});

test('a store Atlas reads never keeps a customer confirmation instead of a live check', async () => {
  const target = product('t', { sourceUrl: 'https://www.target.com/p/-/A-12345678', sourceManuallyConfirmed: true });
  await assert.rejects(
    prepareAction(blank(), { type: 'cart-add', product: target, variant: 'Black · M' }, deps({ fetchProduct: async () => { throw new ManualEntryFallbackError('blocked', undefined, 'blocked'); } })),
    (error) => error instanceof ActionError && error.code === 'err_38',
  );
});
