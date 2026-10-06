import test from 'node:test';
import assert from 'node:assert/strict';
import { addToCart, blank, cancelOrder, cartSignature, checkoutCart, confirmDemoPayment, orderPayable, products } from '../lib/market/domain.ts';
import { customsVersion } from '../lib/market/world.ts';
import { groupOrders, groupStoreNames, orderNeedsCustomerDecision, orderStoreHost, storeGroupName } from '../lib/market/order-groups.ts';

const nike = { ...products[0], id: 'nike-1', sourceUrl: 'https://www.nike.com/t/shoe', country: 'США', shippingKnown: true };
const nike2 = { ...products[0], id: 'nike-2', name: 'Second Nike', sourceUrl: 'https://nike.com/t/other', country: 'США', shippingKnown: true };
const zara = { ...products[2], id: 'zara-1', sourceUrl: 'https://www.zara.com/es/en/p.html', country: 'Испания', shippingKnown: true };

/** Checkout and record the simulated payment, so the lines are "in progress", not "awaiting payment". */
function checkout(state, key, now) {
  let next = checkoutCart(state, key, cartSignature(state.cart), false, now, customsVersion);
  for (const order of next.orders) if (order.payment?.status === 'pending') next = confirmDemoPayment(next, order.id, now + 1);
  return next;
}

test('one checkout with lines from two stores becomes one group with two store sections', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = addToCart(s, nike2, nike2.variants[0], 1001);
  s = addToCart(s, zara, zara.variants[0], 1002);
  s = checkout(s, 'batch-a', 2000);
  assert.equal(s.orders.length, 3);
  const groups = groupOrders(s.orders);
  assert.equal(groups.length, 1);
  const [group] = groups;
  assert.equal(group.key, 'batch:batch-a');
  assert.equal(group.batchId, 'batch-a');
  assert.equal(group.orders.length, 3);
  assert.equal(group.items, 3);
  assert.equal(group.payable, s.orders.reduce((sum, order) => sum + orderPayable(order), 0));
  assert.equal(group.createdAt, 2000);
  assert.equal(group.stage, 'active');
  assert.equal(group.status, 0);
  assert.equal(group.attention, 0);
  assert.deepEqual(group.stores.map((store) => [store.host, store.country, store.orders.length]), [['nike.com', 'США', 2], ['zara.com', 'Испания', 1]]);
  assert.deepEqual(groupStoreNames(group, 'ru'), ['Nike', 'Zara']);
  assert.equal(storeGroupName(group.stores[0], 'en'), 'Nike');
});

test('separate checkouts stay separate groups and keep the given order', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = checkout(s, 'first', 2000);
  s = addToCart(s, zara, zara.variants[0], 3000);
  s = checkout(s, 'second', 4000);
  // state.orders is newest first; the groups follow the lines as given.
  assert.deepEqual(groupOrders(s.orders).map((group) => group.batchId), ['second', 'first']);
  const groups = groupOrders([...s.orders].reverse());
  assert.deepEqual(groups.map((group) => group.batchId), ['first', 'second']);
  assert.ok(groups.every((group) => group.orders.length === 1 && group.stores.length === 1));
});

test('orders without a batch id (older documents, link orders) are groups of one', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = addToCart(s, zara, zara.variants[0], 1001);
  s = checkout(s, 'legacy', 2000);
  const legacy = s.orders.map((order) => { const copy = { ...order }; delete copy.batchId; return copy; });
  const groups = groupOrders(legacy);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.key), legacy.map((order) => `order:${order.id}`));
  assert.ok(groups.every((group) => group.batchId === undefined));
});

test('a cancelled line leaves the sum and count; a fully cancelled group is cancelled', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = addToCart(s, zara, zara.variants[0], 1001);
  s = checkout(s, 'mixed', 2000);
  const [first, second] = s.orders;
  assert.equal(groupOrders(s.orders)[0].stage, 'active');
  s = cancelOrder(s, first.id, 2500);
  let [group] = groupOrders(s.orders);
  assert.equal(group.cancelled, 1);
  assert.equal(group.items, 1);
  assert.equal(group.payable, orderPayable(second));
  assert.equal(group.stage, 'active');
  assert.equal(group.stores.find((store) => store.host === 'nike.com').payable, 0);
  s = cancelOrder(s, second.id, 2600);
  [group] = groupOrders(s.orders);
  assert.equal(group.stage, 'cancelled');
  assert.equal(group.status, undefined);
  assert.equal(group.payable, 0);
});

test('the stage follows the most urgent line: a pending decision wins, then the lowest status, then done', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = addToCart(s, zara, zara.variants[0], 1001);
  s = checkout(s, 'stages', 2000);
  const [a, b] = s.orders;
  const done = { ...a, status: 5 };
  const shipped = { ...b, status: 3 };
  assert.deepEqual(groupOrders([done, shipped]).map((group) => [group.stage, group.status]), [['active', 3]]);
  assert.deepEqual(groupOrders([done, { ...b, status: 5 }]).map((group) => [group.stage, group.status]), [['done', 5]]);
  const waiting = { ...shipped, payment: { id: 'PAY-1', amount: shipped.quote.total, status: 'pending', createdAt: 2100 } };
  assert.equal(orderNeedsCustomerDecision(waiting), true);
  assert.equal(orderNeedsCustomerDecision({ ...waiting, cancelled: true }), false);
  const [group] = groupOrders([done, waiting]);
  assert.equal(group.stage, 'attention');
  assert.equal(group.attention, 1);
  const extra = { ...shipped, settlement: { ...shipped.quote, actualWeight: 2, dimensionalWeight: 2, chargeableWeight: 2, shipping: 1, extra: 5000, refund: 0 } };
  assert.equal(orderNeedsCustomerDecision(extra), true);
  assert.equal(orderNeedsCustomerDecision({ ...extra, extraApproved: true }), false);
});

test('store host parsing is forgiving', () => {
  assert.equal(orderStoreHost({ product: { sourceUrl: 'https://WWW.Zara.com/x' } }), 'zara.com');
  assert.equal(orderStoreHost({ product: { sourceUrl: 'not a url' } }), '');
  assert.equal(orderStoreHost({ product: {} }), '');
  assert.equal(storeGroupName({ host: '', brand: 'Anker' }, 'ru'), 'Anker');
  assert.equal(storeGroupName({ host: 'shop.example.org', brand: 'X' }, 'ru'), 'shop.example.org');
});
