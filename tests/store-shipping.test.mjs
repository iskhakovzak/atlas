import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/market/actions.ts';
import { addToCart, blank, changeQuantity, checkoutCart, cartSignature, confirmStoreShipping, holdOf, pricingSchema, products, storeShippingHoldUsd, storeShippingReserves, storeShippingUsd, tariff, totalOf } from '../lib/market/domain.ts';
import { customsVersion } from '../lib/market/world.ts';
import { dealQuote } from '../lib/market/deals.ts';

const fx = tariff.fx;
// A store that did not publish delivery to the warehouse: the importer puts in an editable $10 estimate.
const item = (id, usd, overrides = {}) => ({
  ...products[0], id, name: id, usd, variants: ['One'], country: 'США', boxedWeight: 0.4, weight: 1,
  sourceUrl: `https://www.amazon.com/dp/${id}`, sourcePrice: usd, sourceCurrency: 'USD',
  sourceShipping: 10, sourceShippingUsd: 10, sourceShippingCurrency: 'USD', sourceShippingEstimated: true, shippingKnown: true,
  ...overrides,
});
const charged = (state) => state.cart.reduce((sum, entry) => sum + (entry.quote.sourceShipping ?? 0), 0);
const lineSum = (entry) => entry.quote.merchandise + entry.quote.service + entry.quote.shipping + entry.quote.reserve + (entry.quote.sourceShipping ?? 0) + (entry.quote.buyout ?? 0) + (entry.quote.conversion ?? 0) + (entry.quote.deliveryMargin ?? 0) + (entry.quote.optionalServices ?? 0);

test('unknown store delivery is free strictly above $50, else a $10 hold outside the total', () => {
  for (const usd of [50.01, 120]) {
    const state = addToCart(blank(), item('coat', usd), 'One', 1);
    assert.equal(holdOf(state.cart), 0, `$${usd}: free`);
    assert.equal(charged(state), 0);
  }
  for (const usd of [50, 12]) {
    const state = addToCart(blank(), item('socks', usd), 'One', 1);
    assert.equal(holdOf(state.cart), 10 * fx, `$${usd}: a $10 hold`);
    assert.equal(charged(state), 0, 'the hold is not charged');
    assert.equal(totalOf(state.cart), lineSum(state.cart[0]), 'the total has no hold in it');
  }
  assert.equal(storeShippingUsd(item('socks', 12)), 0);
  assert.equal(storeShippingHoldUsd(item('socks', 12), 12), 10);
  assert.equal(storeShippingHoldUsd(item('coat', 120), 120), 0);
});

test('a stated store delivery charge is part of the total whatever the order size', () => {
  const known = item('tv', 300, { sourceShippingUsd: 25, sourceShipping: 25, sourceShippingEstimated: false });
  const state = addToCart(blank(), known, 'One', 1);
  assert.equal(charged(state), 25 * fx);
  assert.equal(holdOf(state.cart), 0);
  assert.equal(storeShippingUsd(known, 300), 25);
});

test('one store order has one hold, split by merchandise, and none above $50 in total', () => {
  let state = addToCart(blank(), item('cap', 20), 'One', 1);
  state = addToCart(state, item('belt', 20), 'One', 2);
  assert.equal(holdOf(state.cart), 10 * fx, 'two cheap items from one store share one $10 hold');
  assert.ok(state.cart.every((entry) => (entry.quote.storeShippingHold ?? 0) > 0), 'the hold is split between them');
  assert.equal(totalOf(state.cart), state.cart.reduce((sum, entry) => sum + lineSum(entry), 0));
  const [summary] = storeShippingReserves(state.cart);
  assert.deepEqual([summary.subtotalUsd, summary.reserveUsd, summary.missingUsd], [40, 10, 10.01]);
  state = addToCart(state, item('scarf', 15), 'One', 3);
  assert.equal(holdOf(state.cart), 0, '$55 from one store: free');
  assert.equal(storeShippingReserves(state.cart)[0].missingUsd, 0);
});

test('quantity counts toward the threshold instead of multiplying the hold', () => {
  let state = addToCart(blank(), item('tee', 20), 'One', 1);
  state = changeQuantity(state, state.cart[0].id, 2, 2);
  assert.equal(holdOf(state.cart), 10 * fx, '2 × $20 still holds $10 once');
  state = changeQuantity(state, state.cart[0].id, 3, 3);
  assert.equal(holdOf(state.cart), 0, '3 × $20 = $60');
});

test('different stores and storefront countries are separate store orders', () => {
  let state = addToCart(blank(), item('cap', 30), 'One', 1);
  state = addToCart(state, item('mug', 30, { sourceUrl: 'https://www.target.com/p/mug' }), 'One', 2);
  state = addToCart(state, item('pen', 30, { sourceUrl: 'https://www.amazon.com/dp/pen', country: 'Германия' }), 'One', 3);
  assert.equal(holdOf(state.cart), 3 * 10 * fx);
  assert.equal(storeShippingReserves(state.cart).length, 3);
});

test('removing an item prices the rest of its store order again', () => {
  let state = addToCart(blank(), item('cap', 30), 'One', 1);
  state = addToCart(state, item('belt', 30), 'One', 2);
  assert.equal(holdOf(state.cart), 0);
  state = applyAction(state, { type: 'cart-remove', id: state.cart[1].id }, false);
  assert.equal(state.cart.length, 1);
  assert.equal(holdOf(state.cart), 10 * fx, 'the $30 cap alone is at or below the threshold again');
});

test('the threshold is a pricing setting, and older pricing rows get $50', () => {
  const strict = { ...tariff, storeShippingFreeFromUsd: 100 };
  assert.equal(holdOf(addToCart(blank(), item('coat', 80), 'One', 1, strict).cart), 10 * fx);
  const { storeShippingFreeFromUsd, ...old } = tariff;
  assert.equal(storeShippingFreeFromUsd, 50);
  assert.equal(pricingSchema.parse(old).storeShippingFreeFromUsd, 50);
  assert.equal(dealQuote(item('coat', 80), tariff).holdUsd, 0, 'catalog cards follow the same rule');
  assert.equal(dealQuote(item('coat', 80), strict).holdUsd, 10);
  assert.equal(dealQuote(item('coat', 80), strict).costs.sourceShipping, 0, 'and never put the hold in the total');
});

test('checkout keeps the hold out of the amount to pay and in the order history', () => {
  let state = addToCart(blank(), item('cap', 20), 'One', 1);
  state = checkoutCart(state, 'k1', cartSignature(state.cart), false, 2, customsVersion);
  const [order] = state.orders;
  assert.equal(order.payment.amount, order.quote.total);
  assert.equal(order.quote.storeShippingHold, 10 * fx);
  assert.ok(order.history.some((event) => event.text.includes('удерживается отдельно')));
});

test('within the hold the store delivery needs no new consent; above it only the difference does', () => {
  const ordered = (usd) => {
    let state = addToCart(blank(), item('cap', usd), 'One', 1);
    return checkoutCart(state, 'k-' + usd, cartSignature(state.cart), false, 2, customsVersion);
  };
  const cheap = ordered(20);
  const within = confirmStoreShipping(cheap, cheap.orders[0].id, 7, 3).orders[0].storeShippingSettlement;
  assert.deepEqual([within.held, within.extra, within.refund, within.released], [true, 0, 0, Math.ceil(10 * fx) - Math.ceil(7 * fx)]);
  const state = ordered(20);
  const above = confirmStoreShipping(state, state.orders[0].id, 14, 3).orders[0].storeShippingSettlement;
  assert.equal(above.extra, Math.ceil(14 * fx) - 10 * fx, 'only the part above the hold waits for approval');
  assert.equal(above.refund, 0, 'nothing was paid, so nothing is refunded to the balance');
  const free = ordered(120);
  const charge = confirmStoreShipping(free, free.orders[0].id, 7, 3).orders[0].storeShippingSettlement;
  assert.equal(charge.extra, Math.ceil(7 * fx), 'free delivery that turns out charged is an extra the customer approves');
});
