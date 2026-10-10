import test from 'node:test';
import assert from 'node:assert/strict';
import { noticePanel, noticeTarget, orderAttention } from '../lib/market/notice-panel.ts';

const order = (id, extra = {}) => ({ id, status: 1, cancelled: false, changeRequests: [], ...extra });
const notice = (id, at, extra = {}) => ({ id, at, title: id, message: '', read: false, ...extra });

test('orders that wait for the customer', () => {
  assert.equal(orderAttention(order('A', { settlement: { extra: 12 }, extraApproved: false })), 'extra');
  assert.equal(orderAttention(order('A', { settlement: { extra: 12 }, extraApproved: true })), null);
  assert.equal(orderAttention(order('B', { customsSettlement: { extra: 3 } })), 'extra');
  assert.equal(orderAttention(order('C', { changeRequests: [{ status: 'pending' }] })), 'change');
  assert.equal(orderAttention(order('D', { payment: { status: 'pending' } })), 'payment');
  assert.equal(orderAttention(order('D', { payment: { status: 'pending' }, cancelled: true })), null);
  assert.equal(orderAttention(order('E', { payment: { status: 'paid' } })), null);
});

test('a notification leads to its order or document', () => {
  assert.deepEqual(noticeTarget({ orderId: 'AT-1' }), { href: '/orders#AT-1', kind: 'order' });
  assert.deepEqual(noticeTarget({ code: 'declaration-saved' }), { href: '/declaration', kind: 'document' });
  assert.equal(noticeTarget({}), null);
});

test('panel: action first with its latest message, then recent updates without repeats', () => {
  const state = {
    orders: [order('AT-1', { payment: { status: 'pending' } }), order('AT-2')],
    notifications: [notice('n1', 1, { orderId: 'AT-1', read: true }), notice('n2', 5, { orderId: 'AT-1' }), notice('n3', 3, { orderId: 'AT-2' }), notice('n4', 4)],
  };
  const panel = noticePanel(state, 2);
  assert.equal(panel.unread, 3);
  assert.equal(panel.total, 4);
  // No notification asks for the payment: the item shows none rather than an unrelated message.
  assert.deepEqual(panel.action.map(entry => [entry.order.id, entry.reason, entry.notice?.id]), [['AT-1', 'payment', undefined]]);
  assert.deepEqual(panel.updates.map(item => item.id), ['n2', 'n4']);
});

test('panel: one item per checkout, the most urgent reason, with a message about that reason only', () => {
  const state = {
    orders: [
      order('AT-1', { batchId: 'B1', payment: { status: 'pending' }, status: 0, createdAt: 2 }),
      order('AT-2', { batchId: 'B1', payment: { status: 'pending' }, status: 0, createdAt: 2 }),
      order('AT-3', { batchId: 'B2', settlement: { extra: 5 }, extraApproved: false, createdAt: 1 }),
      order('AT-4', { batchId: 'B2', changeRequests: [{ status: 'pending' }], createdAt: 1 }),
    ],
    notifications: [notice('n1', 9, { orderId: 'AT-3', code: 'tracking-added' }), notice('n2', 4, { orderId: 'AT-3', code: 'parcel-extra' })],
  };
  const panel = noticePanel(state);
  assert.deepEqual(panel.action.map(entry => [entry.order.batchId, entry.reason, entry.notice?.id]), [['B2', 'extra', 'n2'], ['B1', 'payment', undefined]]);
  assert.deepEqual(panel.updates.map(item => item.id), ['n1']);
});
