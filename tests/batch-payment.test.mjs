import test from 'node:test';
import assert from 'node:assert/strict';
import { addToCart, blank, cancelOrder, cartSignature, checkoutCart, confirmDemoPayment, pendingBatchPayments, products } from '../lib/market/domain.ts';
import { actionSchema, applyAction } from '../lib/market/actions.ts';
import { actionPermission } from '../lib/market/access.ts';
import { groupOrders, groupStageText } from '../lib/market/order-groups.ts';
import { customsVersion } from '../lib/market/world.ts';
import { noticePanel } from '../lib/market/notice-panel.ts';

const nike = { ...products[0], id: 'nike-1', sourceUrl: 'https://www.nike.com/t/shoe', country: 'США', shippingKnown: true };
const zara = { ...products[2], id: 'zara-1', sourceUrl: 'https://www.zara.com/es/en/p.html', country: 'Испания', shippingKnown: true };

function placed() {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = addToCart(s, nike, nike.variants[1] ?? nike.variants[0], 1001);
  s = addToCart(s, zara, zara.variants[0], 1002);
  return checkoutCart(s, 'batch-pay', cartSignature(s.cart), false, 2000, customsVersion);
}
const act = (state, action) => applyAction(state, actionSchema.parse(action), false);
const total = (state) => pendingBatchPayments(state, 'batch-pay').reduce((sum, order) => sum + order.payment.amount, 0);

test('a checkout has one payment: the same id on every line, one card on the plate', () => {
  const state = placed();
  assert.ok(state.orders.length >= 2);
  const ids = new Set(state.orders.map((order) => order.payment.id));
  assert.equal(ids.size, 1);
  const [group] = groupOrders(state.orders);
  assert.deepEqual(group.payment, { id: [...ids][0], amount: total(state), lines: state.orders.length });
  // The payment counts once, not once per line.
  assert.equal(group.attention, 1);
  assert.equal(group.stage, 'attention');
  // Nothing is bought before the payment.
  assert.equal(groupStageText(group, 'ru').label, 'Ожидает оплаты');
  // The notifications panel asks for it once too.
  assert.deepEqual(noticePanel(state).action.map((entry) => entry.reason), ['payment']);
});

test('catalogue lines without a store link but of one brand and country share a parcel section', () => {
  const plain = { ...products[0], sourceUrl: undefined };
  let s = addToCart(blank(), plain, plain.variants[0], 1000);
  s = addToCart(s, plain, plain.variants[1] ?? plain.variants[0], 1001);
  s = checkoutCart(s, 'plain', cartSignature(s.cart), false, 2000, customsVersion);
  const [group] = groupOrders(s.orders);
  assert.equal(group.stores.length, 1);
  assert.equal(group.stores[0].models.length, 1);
  assert.equal(group.stores[0].models[0].orders.length, s.orders.length);
});

test('paying the checkout marks every line at once, with one notification', () => {
  const state = placed();
  const amount = total(state);
  assert.throws(() => act(state, { type: 'payment-demo-batch', batchId: 'batch-pay', amount: amount + 1 }), /Сумма изменилась/);
  const paid = act(state, { type: 'payment-demo-batch', batchId: 'batch-pay', amount });
  assert.ok(paid.orders.every((order) => order.payment.status === 'paid'));
  assert.ok(paid.orders.every((order) => order.history.at(-1).code === 'payment-recorded'));
  // Per-order ledger marks (the books are per order), never the customer's balance.
  for (const order of paid.orders) {
    const entry = paid.entries.find((item) => item.id === 'demo-payment:' + order.id);
    assert.deepEqual([entry.debit, entry.credit, entry.amount], ['demo-provider', 'order-funds', order.payment.amount]);
  }
  assert.equal(paid.notifications.filter((item) => item.code === 'payment-recorded').length, 1);
  const [group] = groupOrders(paid.orders);
  assert.equal(group.payment, undefined);
  assert.equal(group.attention, 0);
  assert.notEqual(groupStageText(group, 'ru').label, 'Ожидает оплаты');
  // Paying again changes nothing; an unknown checkout is refused.
  assert.equal(act(paid, { type: 'payment-demo-batch', batchId: 'batch-pay', amount }), paid);
  assert.throws(() => act(paid, { type: 'payment-demo-batch', batchId: 'other', amount: 0 }), /не найден/);
  // A customer action, like the single-line payment.
  assert.equal(actionPermission('payment-demo-batch'), undefined);
});

test('a cancelled line leaves the payment; a line paid on its own leaves the rest', () => {
  let state = placed();
  const [first, second] = state.orders;
  state = cancelOrder(state, first.id, 2100);
  assert.equal(pendingBatchPayments(state, 'batch-pay').some((order) => order.id === first.id), false);
  assert.equal(groupOrders(state.orders)[0].payment.lines, state.orders.length - 1);
  state = confirmDemoPayment(state, second.id, 2200);
  const rest = total(state);
  const paid = act(state, { type: 'payment-demo-batch', batchId: 'batch-pay', amount: rest });
  assert.ok(paid.orders.filter((order) => !order.cancelled).every((order) => order.payment.status === 'paid'));
  assert.equal(paid.orders.find((order) => order.id === first.id).payment.status, state.orders.find((order) => order.id === first.id).payment.status);
});
