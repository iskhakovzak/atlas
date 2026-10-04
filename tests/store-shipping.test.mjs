import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/market/actions.ts';
import { addToCart, blank, changeQuantity, confirmStoreShipping, pricingSchema, products, storeShippingReserves, storeShippingUsd, tariff } from '../lib/market/domain.ts';
import { dealQuote } from '../lib/market/deals.ts';

const fx = tariff.fx;
// A store that did not publish delivery to the warehouse: the importer puts in an editable $10 estimate.
const item = (id, usd, overrides = {}) => ({
  ...products[0], id, name: id, usd, variants: ['One'], country: 'США', boxedWeight: 0.4, weight: 1,
  sourceUrl: `https://www.amazon.com/dp/${id}`, sourcePrice: usd, sourceCurrency: 'USD',
  sourceShipping: 10, sourceShippingUsd: 10, sourceShippingCurrency: 'USD', sourceShippingEstimated: true, shippingKnown: true,
  ...overrides,
});
const storeShipping = (state) => state.cart.reduce((sum, entry) => sum + (entry.quote.sourceShipping ?? 0), 0);

test('an item from $50 carries no store-delivery reserve, a cheaper one carries $10', () => {
  assert.equal(storeShipping(addToCart(blank(), item('coat', 50), 'One', 1)), 0);
  assert.equal(storeShipping(addToCart(blank(), item('coat', 120), 'One', 1)), 0);
  assert.equal(storeShipping(addToCart(blank(), item('socks', 49.99), 'One', 1)), 10 * fx);
  assert.equal(storeShippingUsd(item('coat', 120), 120), 0);
  assert.equal(storeShippingUsd(item('socks', 12), 12), 10);
});

test('a stated store delivery charge is kept whatever the order size', () => {
  const known = item('tv', 300, { sourceShippingUsd: 25, sourceShipping: 25, sourceShippingEstimated: false });
  assert.equal(storeShipping(addToCart(blank(), known, 'One', 1)), 25 * fx);
  assert.equal(storeShippingUsd(known, 300), 25);
});

test('one store order pays the reserve once, and not at all from $50 in total', () => {
  let state = addToCart(blank(), item('cap', 20), 'One', 1);
  state = addToCart(state, item('belt', 20), 'One', 2);
  assert.equal(storeShipping(state), 10 * fx, 'two cheap items from one store share one $10 reserve');
  assert.ok(state.cart.every((entry) => (entry.quote.sourceShipping ?? 0) > 0), 'the reserve is split between them');
  assert.equal(state.cart.reduce((sum, entry) => sum + entry.quote.total, 0), state.cart.reduce((sum, entry) => sum + entry.quote.merchandise + entry.quote.service + entry.quote.shipping + entry.quote.reserve + (entry.quote.sourceShipping ?? 0) + (entry.quote.buyout ?? 0) + (entry.quote.conversion ?? 0) + (entry.quote.deliveryMargin ?? 0) + (entry.quote.optionalServices ?? 0), 0));
  const [summary] = storeShippingReserves(state.cart);
  assert.deepEqual([summary.subtotalUsd, summary.reserveUsd, summary.missingUsd], [40, 10, 10]);
  state = addToCart(state, item('scarf', 15), 'One', 3);
  assert.equal(storeShipping(state), 0, '$55 from one store: no reserve');
  assert.equal(storeShippingReserves(state.cart)[0].missingUsd, 0);
});

test('quantity counts toward the threshold instead of multiplying the reserve', () => {
  let state = addToCart(blank(), item('tee', 20), 'One', 1);
  state = changeQuantity(state, state.cart[0].id, 2, 2);
  assert.equal(storeShipping(state), 10 * fx, '2 × $20 still pays $10 once');
  state = changeQuantity(state, state.cart[0].id, 3, 3);
  assert.equal(storeShipping(state), 0, '3 × $20 = $60');
});

test('different stores and storefront countries are separate store orders', () => {
  let state = addToCart(blank(), item('cap', 30), 'One', 1);
  state = addToCart(state, item('mug', 30, { sourceUrl: 'https://www.target.com/p/mug' }), 'One', 2);
  state = addToCart(state, item('pen', 30, { sourceUrl: 'https://www.amazon.com/dp/pen', country: 'Германия' }), 'One', 3);
  assert.equal(storeShipping(state), 3 * 10 * fx);
  assert.equal(storeShippingReserves(state.cart).length, 3);
});

test('removing an item prices the rest of its store order again', () => {
  let state = addToCart(blank(), item('cap', 30), 'One', 1);
  state = addToCart(state, item('belt', 30), 'One', 2);
  assert.equal(storeShipping(state), 0);
  state = applyAction(state, { type: 'cart-remove', id: state.cart[1].id }, false);
  assert.equal(state.cart.length, 1);
  assert.equal(storeShipping(state), 10 * fx, 'the $30 cap alone is below the threshold again');
});

test('the threshold is a pricing setting, and older pricing rows get $50', () => {
  const strict = { ...tariff, storeShippingFreeFromUsd: 100 };
  assert.equal(storeShipping(addToCart(blank(), item('coat', 80), 'One', 1, strict)), 10 * fx);
  const { storeShippingFreeFromUsd, ...old } = tariff;
  assert.equal(storeShippingFreeFromUsd, 50);
  assert.equal(pricingSchema.parse(old).storeShippingFreeFromUsd, 50);
  assert.equal(dealQuote(item('coat', 80), tariff).costs.sourceShipping, 0, 'catalog cards follow the same rule');
  assert.equal(dealQuote(item('coat', 80), strict).costs.sourceShipping, 10 * fx);
});

test('a waived reserve still lets the operator settle a store that charges, with the customer’s approval', () => {
  let state = addToCart(blank(), item('coat', 120), 'One', 1);
  state = { ...state, orders: [{ ...state.cart[0], id: 'ORD-1', createdAt: 1, status: 0, history: [], cancelled: false, product: state.cart[0].product, quote: state.cart[0].quote }] };
  const settled = confirmStoreShipping(state, 'ORD-1', 7, 2);
  const settlement = settled.orders[0].storeShippingSettlement;
  assert.equal(settlement.estimated, 0);
  assert.equal(settlement.extra, Math.ceil(7 * fx), 'the store charge becomes an extra that needs approval');
});
