import test from 'node:test';
import assert from 'node:assert/strict';
import { addToCart, blank, cartSignature, checkoutCart, parseState, products, renewCart, tariff } from '../lib/market/domain.ts';
import { compareProductSnapshot, verifyProductSnapshot } from '../lib/importer/verify.ts';
import { ManualEntryFallbackError } from '../lib/importer/fetch.ts';
import { checkCartSources, recentCheckMs, unreachableGraceMs } from '../lib/market/cart-check.ts';
import { customsVersion } from '../lib/market/world.ts';

const now = Date.parse('2026-10-04T12:00:00Z');
const product = (id, price, overrides = {}) => ({
  ...products[0], id, name: id, usd: price, variants: ['Black · 9'], country: 'США', boxedWeight: 0.8, weight: 1.3,
  sourceUrl: `https://www.amazon.com/dp/${id}`, sourcePrice: price, sourceCurrency: 'USD', sourceVariantId: 'v9',
  sourceShipping: 10, sourceShippingUsd: 10, sourceShippingCurrency: 'USD', sourceShippingEstimated: true, shippingKnown: true,
  ...overrides,
});
const live = (price, overrides = {}) => ({ title: 'Item', price, currency: 'USD', variants: [{ id: 'v9', label: 'Black · 9', price, available: true }], warnings: [], ...overrides });

test('a live snapshot is the same, changed (price or stated delivery) or blocked', () => {
  const p = product('a', 40);
  const same = compareProductSnapshot(p, 'Black · 9', live(40), now);
  assert.equal(same.status, 'same');
  assert.equal(same.product.sourceCheckedAt, now);
  const changed = compareProductSnapshot(p, 'Black · 9', live(44.5), now);
  assert.equal(changed.status, 'changed');
  assert.deepEqual(changed.change, { previousPrice: 40, price: 44.5, currency: 'USD' });
  assert.equal(changed.product.sourcePrice, 44.5);
  assert.deepEqual(compareProductSnapshot(p, 'Black · 9', live(40, { currency: 'EUR' }), now).kind, 'currency');
  assert.equal(compareProductSnapshot(p, 'Black · 9', live(40, { variants: [{ id: 'v10', label: 'Black · 10', price: 40 }] }), now).kind, 'variant');
  // Delivery the store states is checked; Atlas's own editable reserve is not.
  const stated = product('b', 40, { sourceShipping: 5, sourceShippingUsd: 5, sourceShippingEstimated: false });
  const shipping = compareProductSnapshot(stated, 'Black · 9', live(40, { shipping: 7.5, shippingCurrency: 'USD' }), now);
  assert.equal(shipping.status, 'changed');
  assert.equal(shipping.change.shipping, 7.5);
  assert.equal(shipping.product.sourceShipping, 7.5);
  // A claimed "delivery unknown" does not hide the delivery the store states: the line takes the store's amount.
  const claimed = compareProductSnapshot(p, 'Black · 9', live(40, { shipping: 7.5 }), now);
  assert.equal(claimed.status, 'changed');
  assert.equal(claimed.product.sourceShippingEstimated, false);
  assert.equal(claimed.product.sourceShipping, 7.5);
  assert.equal(claimed.product.sourceShippingCurrency, 'USD');
  assert.deepEqual([claimed.change.previousShipping, claimed.change.shipping], [undefined, 7.5]);
  // Only a reserve from the Atlas catalog (the server's record) is left as it is.
  const editorial = compareProductSnapshot(p, 'Black · 9', live(40, { shipping: 7.5 }), now, { editorialShipping: true });
  assert.equal(editorial.status, 'same');
  assert.equal(editorial.product.sourceShippingEstimated, true);
  assert.equal(editorial.product.sourceShipping, 10);
  // The store decides the currency too: delivery stated in another supported currency replaces the claimed reserve.
  const euro = compareProductSnapshot(p, 'Black · 9', live(40, { shipping: 7.5, shippingCurrency: 'EUR' }), now);
  assert.equal(euro.status, 'changed');
  assert.deepEqual([euro.product.sourceShippingEstimated, euro.product.sourceShipping, euro.product.sourceShippingCurrency], [false, 7.5, 'EUR']);
  // A "known" delivery the client sends in another currency than the store's is not trusted either.
  const otherCurrency = compareProductSnapshot(product('c', 40, { sourceShipping: 0, sourceShippingUsd: 0, sourceShippingCurrency: 'EUR', sourceShippingEstimated: false }), 'Black · 9', live(40, { shipping: 20 }), now);
  assert.equal(otherCurrency.status, 'changed');
  assert.deepEqual([otherCurrency.product.sourceShipping, otherCurrency.product.sourceShippingCurrency], [20, 'USD']);
  assert.deepEqual([otherCurrency.change.previousShipping, otherCurrency.change.shipping], [undefined, 20]);
  // A currency Atlas does not convert counts as no stated delivery: the reserve stays.
  assert.equal(compareProductSnapshot(p, 'Black · 9', live(40, { shipping: 7.5, shippingCurrency: 'XYZ' }), now).status, 'same');
  // The store states no delivery: a reserve stays; a claimed known delivery becomes Atlas's $10 reserve.
  assert.equal(compareProductSnapshot(p, 'Black · 9', live(40), now).status, 'same');
  const free = compareProductSnapshot(product('e', 40, { sourceShipping: 0, sourceShippingUsd: 0, sourceShippingEstimated: false }), 'Black · 9', live(40), now);
  assert.equal(free.status, 'changed');
  assert.deepEqual([free.product.sourceShippingEstimated, free.product.sourceShipping, free.product.sourceShippingCurrency], [true, 10, 'USD']);
  // A catalog card's confirmed delivery stays when the store states none.
  const confirmed = product('f', 40, { sourceShipping: 6, sourceShippingUsd: 6, sourceShippingEstimated: false });
  assert.equal(compareProductSnapshot(confirmed, 'Black · 9', live(40), now, { editorialShipping: true }).status, 'same');
  // The strict form does not stop on a delivery that only turns into the reserve (it leaves the total).
  assert.equal(verifyProductSnapshot(confirmed, 'Black · 9', live(40), now).sourceShippingEstimated, true);
  assert.throws(() => verifyProductSnapshot(p, 'Black · 9', live(44.5), now), /Цена изменилась: было 40 USD, сейчас 44.5 USD/);
});

test('the cart check updates a changed price, marks it and leaves the rest', async () => {
  let state = addToCart(blank(), product('a', 39.99), 'Black · 9', now, tariff);
  state = addToCart(state, product('b', 25), 'Black · 9', now, tariff);
  const calls = [];
  const fetchSource = async (url) => { calls.push(url); return live(url.endsWith('/a') ? 45.49 : 25); };
  const result = await checkCartSources(state.cart, fetchSource, tariff, now + recentCheckMs + 1);
  assert.equal(calls.length, 2);
  assert.deepEqual(result.changed, [state.cart[0].id]);
  assert.deepEqual(result.blocked, []);
  const [a, b] = result.cart;
  assert.equal(a.product.sourcePrice, 45.49);
  assert.equal(a.product.usd, 45.49, 'the USD price is computed again from the store price');
  assert.deepEqual({ ...a.priceChange, at: 0 }, { previousPrice: 39.99, price: 45.49, currency: 'USD', at: 0 });
  assert.equal(b.priceChange, undefined);
  assert.equal(b.product.sourceCheckedAt, now + recentCheckMs + 1);
  // The marked cart must read back: store prices keep their cents.
  assert.equal(parseState(JSON.stringify({ ...state, cart: result.cart })).cart[0].priceChange.previousPrice, 39.99);
  // Repricing turns the new store price into a new total.
  const repriced = renewCart({ ...state, cart: result.cart }, now + recentCheckMs + 1, tariff);
  assert.ok(repriced.cart[0].quote.total > state.cart[0].quote.total);
});

test('a cart line that claims unknown delivery from a page stating $20 gets the stated delivery in its total', async () => {
  const state = addToCart(blank(), product('d', 40, { sourceShipping: 0, sourceShippingUsd: 0 }), 'Black · 9', now, tariff);
  assert.equal(state.cart[0].quote.sourceShipping ?? 0, 0, 'the claimed reserve is not charged');
  const later = now + recentCheckMs + 1;
  const result = await checkCartSources(state.cart, async () => live(40, { shipping: 20, shippingCurrency: 'USD' }), tariff, later);
  assert.deepEqual(result.changed, [state.cart[0].id]);
  const [line] = result.cart;
  assert.equal(line.product.sourceShippingEstimated, false);
  assert.deepEqual([line.product.sourceShipping, line.product.sourceShippingUsd], [20, 20]);
  assert.equal(line.priceChange.shipping, 20);
  const repriced = renewCart({ ...state, cart: result.cart }, later, tariff);
  assert.equal(repriced.cart[0].quote.sourceShipping, Math.ceil(20 * tariff.fx));
  assert.ok(repriced.cart[0].quote.total > state.cart[0].quote.total);
  // The same line from an Atlas catalog card keeps its reserve.
  const kept = await checkCartSources(state.cart, async () => live(40, { shipping: 20, shippingCurrency: 'USD' }), tariff, later, recentCheckMs, { editorial: () => true });
  assert.deepEqual([kept.changed, kept.cart[0].product.sourceShippingEstimated], [[], true]);
});

test('lines checked a moment ago are not fetched again; lines of one URL share one request', async () => {
  let state = addToCart(blank(), product('a', 40, { sourceCheckedAt: now }), 'Black · 9', now, tariff);
  let calls = 0;
  const result = await checkCartSources(state.cart, async () => { calls++; return live(40); }, tariff, now + 30_000);
  assert.equal(calls, 0);
  assert.deepEqual(result.cart, state.cart);
  state = addToCart(blank(), product('c', 40, { variants: ['Black · 9', 'Black · 10'] }), 'Black · 9', now, tariff);
  state = addToCart(state, product('c', 40, { variants: ['Black · 9', 'Black · 10'], sourceVariantId: 'v10' }), 'Black · 10', now, tariff);
  calls = 0;
  await checkCartSources(state.cart, async () => { calls++; return live(40, { variants: [{ id: 'v9', label: 'Black · 9', price: 40 }, { id: 'v10', label: 'Black · 10', price: 40 }] }); }, tariff, now);
  assert.equal(calls, 1);
});

test('a store that does not answer blocks a line, unless it was confirmed recently', async () => {
  const down = async () => { throw new ManualEntryFallbackError('blocked', undefined, 'blocked'); };
  const never = addToCart(blank(), product('a', 40), 'Black · 9', now, tariff);
  const blocked = await checkCartSources(never.cart, down, tariff, now);
  assert.deepEqual(blocked.blocked, [never.cart[0].id]);
  assert.equal(blocked.cart[0].sourceIssue.kind, 'unreachable');
  const recent = addToCart(blank(), product('a', 40, { sourceCheckedAt: now - 10 * 60_000 }), 'Black · 9', now, tariff);
  const allowed = await checkCartSources(recent.cart, down, tariff, now);
  assert.deepEqual(allowed.blocked, []);
  assert.deepEqual(allowed.unreachable, [recent.cart[0].id]);
  const old = addToCart(blank(), product('a', 40, { sourceCheckedAt: now - unreachableGraceMs - 1 }), 'Black · 9', now, tariff);
  assert.equal((await checkCartSources(old.cart, down, tariff, now)).blocked.length, 1);
  // Right after a failure the store is not asked again; the result stands until the pause is over.
  let calls = 0;
  const counted = async () => { calls++; throw new ManualEntryFallbackError('blocked', undefined, 'blocked'); };
  const again = await checkCartSources(blocked.cart, counted, tariff, now + 10_000);
  assert.deepEqual([calls, again.blocked], [0, [never.cart[0].id]]);
  await checkCartSources(blocked.cart, counted, tariff, now + 31_000);
  assert.equal(calls, 1);
  // A buyer-confirmed line keeps the old behaviour: the store hides its data, the manual details stand.
  const manual = addToCart(blank(), product('a', 40, { sourceManuallyConfirmed: true }), 'Black · 9', now, tariff);
  const kept = await checkCartSources(manual.cart, down, tariff, now);
  assert.deepEqual([kept.blocked, kept.unreachable, kept.cart[0].sourceIssue], [[], [], undefined]);
});

test('checkout refuses an old tariff and items the store no longer confirms, and records the check', () => {
  const later = now + 60_000;
  const base = addToCart(blank(), product('a', 40), 'Black · 9', now, tariff);
  const order = (state, config = tariff) => checkoutCart(state, 'k-' + Math.random(), cartSignature(state.cart), false, later, customsVersion, undefined, undefined, undefined, config);
  assert.throws(() => order(base, { ...tariff, version: 'managed-2' }), /Тарифы Atlas обновились/);
  const issue = { ...base, cart: base.cart.map((item) => ({ ...item, sourceIssue: { kind: 'currency', at: later } })) };
  assert.throws(() => order(issue), /Магазин изменил данные товара/);
  const unreachable = { ...base, cart: base.cart.map((item) => ({ ...item, sourceIssue: { kind: 'unreachable', at: later } })) };
  assert.match(order(unreachable).orders[0].history.map((entry) => entry.text).join(' '), /Магазин не ответил при оформлении/);
  const changed = { ...base, cart: base.cart.map((item) => ({ ...item, product: { ...item.product, sourceCheckedAt: later }, priceChange: { previousPrice: 38, price: 40, currency: 'USD', at: later } })) };
  const history = order(changed).orders[0].history.map((entry) => entry.text).join(' ');
  assert.match(history, /Цена в магазине изменилась до оформления: 38 → 40 USD/);
  assert.match(history, /Цена и вариант сверены с магазином перед оформлением/);
});
