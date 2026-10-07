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
  assert.deepEqual(panel.action.map(entry => [entry.order.id, entry.reason, entry.notice?.id]), [['AT-1', 'payment', 'n2']]);
  assert.deepEqual(panel.updates.map(item => item.id), ['n4', 'n3']);
});
