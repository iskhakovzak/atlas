import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  addToCart,
  balanceOf,
  blank,
  cartSignature,
  checkoutCart,
  confirmDemoPayment,
  orderNeedsOperatorAttention,
  parseState,
  products,
} from '../lib/market/domain.ts';
import { actionSchema, applyAction } from '../lib/market/actions.ts';
import { customsVersion } from '../lib/market/world.ts';

const preparedOrder = () => {
  let state = addToCart(blank(), products[0], products[0].variants[0], 1000);
  state = checkoutCart(state, 'issue-test', cartSignature(state.cart), false, 1001, customsVersion);
  return confirmDemoPayment(state, state.orders[0].id, 1002);
};

const updateAction = (id, values = {}) => actionSchema.parse({
  type: 'order-issue-update',
  id,
  category: 'merchant',
  status: 'investigating',
  ...values,
});

test('issue cases are optional so pre-existing order state still parses', () => {
  const legacy = preparedOrder();
  delete legacy.orders[0].issueCase;
  const parsed = parseState(JSON.stringify(legacy));
  assert.equal(parsed.orders[0].issueCase, undefined);

  const updated = applyAction(parsed, updateAction(parsed.orders[0].id, { proposedRefund: 42000 }), true);
  assert.equal(parseState(JSON.stringify(updated)).orders[0].issueCase.proposedRefund, 42000);
});

test('operator issue updates classify the case and retain bounded status/amount history', () => {
  const state = preparedOrder();
  const id = state.orders[0].id;
  let next = applyAction(state, updateAction(id, { proposedRefund: 42000 }), true);
  next = applyAction(next, updateAction(id, { category: 'warehouse', status: 'refund-review' }), true);

  const issueCase = next.orders[0].issueCase;
  assert.equal(issueCase.category, 'warehouse');
  assert.equal(issueCase.status, 'refund-review');
  assert.equal(issueCase.proposedRefund, undefined);
  assert.equal(issueCase.history.length, 2);
  assert.equal(issueCase.history[0].proposedRefund, 42000);
  assert.equal(issueCase.history[1].category, 'warehouse');
  assert.equal(issueCase.history[1].status, 'refund-review');
  assert.equal(next.orders[0].history.at(-1).text, 'Оператор обновил разбор проблемы/возврата.');
});

test('unresolved cases remain in the operator attention queue even after order cancellation', () => {
  const state = preparedOrder();
  const id = state.orders[0].id;
  const open = applyAction(state, updateAction(id, { status: 'waiting-merchant' }), true);
  assert.equal(orderNeedsOperatorAttention(open.orders[0]), true);
  assert.equal(orderNeedsOperatorAttention({ ...open.orders[0], cancelled: true }), true);
  const resolved = applyAction(open, updateAction(id, { status: 'resolved' }), true);
  assert.equal(orderNeedsOperatorAttention(resolved.orders[0]), false);
});

test('issue amount validation rejects malformed, fractional, negative and oversized values', () => {
  const state = preparedOrder();
  const id = state.orders[0].id;
  for (const proposedRefund of ['1000', -1, 1000.5, 100_000_001, NaN, Infinity]) {
    assert.equal(actionSchema.safeParse({
      type: 'order-issue-update', id, category: 'payment', status: 'refund-review', proposedRefund,
    }).success, false);
  }
  assert.throws(() => applyAction(state, {
    type: 'order-issue-update', id, category: 'payment', status: 'refund-review', proposedRefund: 1000.5,
  }, true));
  assert.equal(actionSchema.safeParse({
    type: 'order-issue-update', id, category: 'payment', status: 'refund-review', proposedRefund: 0,
  }).success, true);
});

test('a proposed refund is a case note only and never changes payment, ledger or payable amount', () => {
  const state = preparedOrder();
  const id = state.orders[0].id;
  const before = {
    payment: structuredClone(state.orders[0].payment),
    entries: structuredClone(state.entries),
    balance: balanceOf(state),
    quote: structuredClone(state.orders[0].quote),
  };

  const next = applyAction(state, updateAction(id, { category: 'payment', status: 'refund-review', proposedRefund: 275000 }), true);

  assert.deepEqual(next.orders[0].payment, before.payment);
  assert.deepEqual(next.entries, before.entries);
  assert.equal(balanceOf(next), before.balance);
  assert.deepEqual(next.orders[0].quote, before.quote);
  assert.equal(next.orders[0].issueCase.proposedRefund, 275000);
});

test('customer action path denies operator-only issue updates and keeps notes/messages separate', () => {
  const state = preparedOrder();
  const id = state.orders[0].id;
  const existingNotificationCount = state.notifications.length;
  const caseAction = updateAction(id, { proposedRefund: 10000 });
  assert.throws(() => applyAction(state, caseAction, false), /Доступно только оператору/);

  const caseSaved = applyAction(state, caseAction, true);
  assert.equal(caseSaved.orders[0].staffNotes, undefined);
  assert.equal(caseSaved.notifications.length, existingNotificationCount);

  const noteSaved = applyAction(caseSaved, { type: 'staff-note', id, text: 'Проверить ответ магазина.' }, true);
  assert.equal(noteSaved.orders[0].staffNotes[0].text, 'Проверить ответ магазина.');
  assert.equal(noteSaved.notifications.length, existingNotificationCount);
  assert.equal(noteSaved.orders[0].issueCase.history.length, 1);

  const messageSaved = applyAction(noteSaved, { type: 'order-notify', id, title: 'Обновление заказа', message: 'Мы проверяем вопрос.' }, true);
  assert.equal(messageSaved.notifications[0].orderId, id);
  assert.equal(messageSaved.orders[0].staffNotes.length, 1);
  assert.equal(messageSaved.orders[0].issueCase.history.length, 1);
});

test('operator issue route retains primary-operator, origin, revision/CAS and audit boundaries', async () => {
  const [operationsRoute, customerRoute, server] = await Promise.all([
    readFile(new URL('../app/api/operations/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/actions/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/market/server.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(operationsRoute, /sameOrigin\(request\)/);
  assert.match(operationsRoute, /await requireOperator\(\)/);
  assert.match(operationsRoute, /"order-issue-update"/);
  assert.match(operationsRoute, /current\.revision !== payload\.data\.revision/);
  assert.match(operationsRoute, /persist\(current\.id, next, current\.revision\)/);
  assert.match(operationsRoute, /recordAudit\(user,`order\.\$\{parsedAction\.data\.type\}`/);
  assert.match(server, /env\.ATLAS_OPERATOR_EMAIL&&email\.toLowerCase\(\)===env\.ATLAS_OPERATOR_EMAIL\.toLowerCase\(\)/);

  // The authenticated customer route passes only the configured operator identity to
  // applyAction; ordinary customers therefore hit the operator-only action guard.
  assert.match(customerRoute, /applyAction\(current\.state,parsed\.data,operator\(user\.email\)/);
});
