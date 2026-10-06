import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { addToCart, balanceOf, blank, cartSignature, checkoutCart, confirmDemoPayment, orderNeedsOperatorAttention, parseState, products } from '../lib/market/domain.ts';
import { actionSchema, applyAction } from '../lib/market/actions.ts';
import { customsVersion } from '../lib/market/world.ts';

const orderWithPayment = () => {
  let state = addToCart(blank(), products[0], products[0].variants[0], 1000);
  state = checkoutCart(state, 'issue-test', cartSignature(state.cart), false, 1001, customsVersion);
  return confirmDemoPayment(state, state.orders[0].id, 1002);
};
const update = (id, values = {}) => actionSchema.parse({ type: 'order-issue-update', id, category: 'merchant', status: 'investigating', ...values });

test('issue cases remain optional for previously stored orders', () => {
  const legacy = orderWithPayment();
  delete legacy.orders[0].issueCase;
  assert.equal(parseState(JSON.stringify(legacy)).orders[0].issueCase, undefined);
});

test('operator issue updates keep bounded history and never move payment or customer balance', () => {
  const state = orderWithPayment();
  const orderId = state.orders[0].id;
  const beforePayment = structuredClone(state.orders[0].payment);
  const beforeBalance = balanceOf(state);
  let next = applyAction(state, update(orderId, { proposedRefund: 42000 }), true);
  next = applyAction(next, update(orderId, { category: 'payment', status: 'refund-review' }), true);
  assert.equal(next.orders[0].issueCase.history.length, 2);
  assert.equal(next.orders[0].issueCase.history[0].proposedRefund, 42000);
  assert.equal(next.orders[0].issueCase.proposedRefund, undefined);
  assert.deepEqual(next.orders[0].payment, beforePayment);
  assert.equal(balanceOf(next), beforeBalance);
  assert.equal(orderNeedsOperatorAttention({ ...next.orders[0], cancelled: true }), true);
  next = applyAction(next, update(orderId, { status: 'resolved' }), true);
  assert.equal(orderNeedsOperatorAttention(next.orders[0]), false);
});

test('issue updates are operator-only and reject invalid refund proposals', () => {
  const state = orderWithPayment();
  const id = state.orders[0].id;
  assert.throws(() => applyAction(state, update(id), false), /Доступно только оператору/);
  for (const proposedRefund of [-1, 4.5, 100_000_001, '1000']) {
    assert.equal(actionSchema.safeParse({ type: 'order-issue-update', id, category: 'payment', status: 'refund-review', proposedRefund }).success, false);
  }
});

test('operator API keeps issue updates inside the authenticated operator allowlist', async () => {
  const route = await readFile(new URL('../app/api/operations/route.ts', import.meta.url), 'utf8');
  assert.match(route, /await requireOperator\(\)/);
  // The operator allowlist lives in lib/market/access.ts (operatorActions); the route refuses anything outside it.
  const access = await readFile(new URL('../lib/market/access.ts', import.meta.url), 'utf8');
  assert.match(access, /'order-issue-update': \{ permission: 'operations\.act'/);
  assert.match(route, /operatorActionTypes\.includes\(parsedAction\.data\.type\)/);
  assert.match(route, /sameOrigin\(request\)/);
  assert.match(route, /persist\(current\.id, next, current\.revision\)/);
});
