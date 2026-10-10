import test from 'node:test';
import assert from 'node:assert/strict';
import { addToCart, advanceOrder, blank, cancelRefundAmount, cartSignature, checkoutCart, confirmDemoPayment, orderNeedsOperatorAttention, orderPayable, parseState, products } from '../lib/market/domain.ts';
import { actionSchema, applyAction } from '../lib/market/actions.ts';
import { canPerformAction } from '../lib/market/access.ts';
import { orderAttention } from '../lib/market/notice-panel.ts';
import { orderNeedsCustomerDecision } from '../lib/market/order-groups.ts';
import { syncOrderLedger } from '../lib/market/finance-auto.ts';
import { orderFinance } from '../lib/market/finance.ts';
import { renderHistory, renderNotification } from '../lib/market/history-copy.ts';
import { customsVersion } from '../lib/market/world.ts';

const placed = () => {
  const state = addToCart(blank(), products[0], products[0].variants[0], 1000);
  return checkoutCart(state, 'extra-test', cartSignature(state.cart), false, 1001, customsVersion);
};
const paid = () => { const state = placed(); return confirmDemoPayment(state, state.orders[0].id, 1002); };
const act = (state, action, operator) => applyAction(state, actionSchema.parse(action), operator);

test('the operator issues an extra invoice on a paid order; the customer sees it until it is paid', () => {
  let state = paid();
  const order = state.orders[0], id = order.id, before = orderPayable(order);
  state = act(state, { type: 'extra-charge-request', id, amountUsd: 12.5, reason: 'Магазин поднял цену' }, true);
  const charge = state.orders[0].extraCharges[0];
  assert.equal(charge.status, 'pending');
  assert.equal(charge.amount, Math.ceil(12.5 * order.quote.fx));
  assert.equal(charge.reason, 'Магазин поднял цену');
  // Waiting: the customer must act, the operator queue shows it, the order does not move on.
  assert.equal(orderAttention(state.orders[0]), 'extra');
  assert.equal(orderNeedsCustomerDecision(state.orders[0]), true);
  assert.equal(orderNeedsOperatorAttention(state.orders[0]), true);
  assert.equal(orderPayable(state.orders[0]), before);
  assert.throws(() => advanceOrder(state, id, 0), /недоступен/);
  assert.equal(state.notifications[0].code, 'extra-charge-requested');
  assert.match(renderNotification(state.notifications[0], 'en').message, /Магазин поднял цену/);
  // A second invoice waits for the first.
  assert.throws(() => act(state, { type: 'extra-charge-request', id, amountUsd: 3, reason: 'Ещё' }, true), /уже ждёт доплата/);
  // The amount the customer saw must match.
  assert.throws(() => act(state, { type: 'extra-charge-pay', id, chargeId: charge.id, amount: charge.amount + 1 }, false), /Сумма изменилась/);
  const after = act(state, { type: 'extra-charge-pay', id, chargeId: charge.id, amount: charge.amount }, false);
  const done = after.orders[0];
  assert.equal(done.extraCharges[0].status, 'paid');
  assert.equal(orderAttention(done), null);
  assert.equal(orderNeedsOperatorAttention(done), false);
  assert.equal(orderPayable(done), before + charge.amount);
  // Marked in Atlas like the order payment: order funds, never the customer's balance.
  const entry = after.entries.find((item) => item.id === 'extra-charge:' + charge.id);
  assert.deepEqual([entry.debit, entry.credit, entry.amount], ['demo-provider', 'order-funds', charge.amount]);
  assert.equal(cancelRefundAmount(after, done), orderPayable(order) + charge.amount);
  assert.match(renderHistory(done.history.at(-1), 'ru'), /Платёжный провайдер не подтвердил списание/);
  // Paying again changes nothing; the order moves on.
  assert.equal(act(after, { type: 'extra-charge-pay', id, chargeId: charge.id, amount: charge.amount }, false), after);
  assert.equal(advanceOrder(after, id, 0).orders[0].status, 1);
  // Stored state reads back.
  assert.equal(parseState(JSON.stringify(after)).orders[0].extraCharges[0].status, 'paid');
});

test('only an operator issues or withdraws an invoice, only on a paid active order', () => {
  const unpaid = placed();
  assert.throws(() => act(unpaid, { type: 'extra-charge-request', id: unpaid.orders[0].id, amountUsd: 5, reason: 'Разница' }, true), /оплаченному/);
  const state = paid(), id = state.orders[0].id;
  assert.throws(() => act(state, { type: 'extra-charge-request', id, amountUsd: 5, reason: 'Разница' }, false), /только оператору/);
  assert.throws(() => actionSchema.parse({ type: 'extra-charge-request', id, amountUsd: 0, reason: 'Разница' }));
  assert.throws(() => actionSchema.parse({ type: 'extra-charge-request', id, amountUsd: 5, reason: ' ' }));
  const issued = act(state, { type: 'extra-charge-request', id, amountUsd: 5, reason: 'Разница' }, true);
  const charge = issued.orders[0].extraCharges[0];
  assert.throws(() => act(issued, { type: 'extra-charge-cancel', id, chargeId: charge.id }, false), /только оператору/);
  const withdrawn = act(issued, { type: 'extra-charge-cancel', id, chargeId: charge.id }, true);
  assert.equal(withdrawn.orders[0].extraCharges[0].status, 'cancelled');
  assert.equal(orderAttention(withdrawn.orders[0]), null);
  assert.throws(() => act(withdrawn, { type: 'extra-charge-pay', id, chargeId: charge.id, amount: charge.amount }, false), /больше не ждёт/);
  // Procurement issues invoices; the warehouse does not.
  const staff = (role) => ({ operator: false, role, permissions: ['operations.act'] });
  assert.equal(canPerformAction(staff('procurement'), 'extra-charge-request'), true);
  assert.equal(canPerformAction(staff('warehouse'), 'extra-charge-request'), false);
  assert.equal(canPerformAction(staff('procurement'), 'extra-charge-pay'), false);
});

test('a paid extra invoice goes to the books as a customer payment and transit goods', () => {
  let state = paid();
  const id = state.orders[0].id;
  state = act(state, { type: 'extra-charge-request', id, amountUsd: 10, reason: 'Доставка магазина' }, true);
  const pending = state.orders[0];
  assert.equal(syncOrderLedger(pending, 'u1').some((entry) => entry.id.includes('-extra-')), false);
  const charge = pending.extraCharges[0];
  state = act(state, { type: 'extra-charge-pay', id, chargeId: charge.id, amount: charge.amount }, false);
  const ledger = syncOrderLedger(state.orders[0], 'u1');
  const extra = ledger.find((entry) => entry.id === `AUTO-${id}-customer_payment-extra-${charge.id}`);
  assert.equal(extra.amountUzs, charge.amount);
  assert.equal(orderFinance(state.orders[0], 'u1').goods, orderFinance(pending, 'u1').goods + charge.amount);
  assert.equal(orderFinance(state.orders[0], 'u1').revenue, orderFinance(pending, 'u1').revenue);
});
