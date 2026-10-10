import test from 'node:test';
import assert from 'node:assert/strict';
import { addToCart, blank, cartSignature, checkoutCart, products } from '../lib/market/domain.ts';
import { groupOrders, groupStageText, orderGroupCopy } from '../lib/market/order-groups.ts';
import { noticePanel, orderAttention } from '../lib/market/notice-panel.ts';
import { renderNotification } from '../lib/market/history-copy.ts';
import { customsVersion } from '../lib/market/world.ts';

const nike = { ...products[0], id: 'nike-1', sourceUrl: 'https://www.nike.com/t/shoe', country: 'США', shippingKnown: true };
const zara = { ...products[2], id: 'zara-1', sourceUrl: 'https://www.zara.com/es/en/p.html', country: 'Испания', shippingKnown: true };

function cart() {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  return addToCart(s, zara, zara.variants[0], 1001);
}
const credit = (state, amount) => ({ ...state, entries: [...state.entries, { id: 'seed', orderId: 'seed', at: 1, amount, debit: 'adjustment', credit: 'customer-credit', description: 'seed' }] });

test('pay card: the part the balance covered is named, so the button may ask less than the total', () => {
  const s = credit(cart(), 50_000);
  const placed = checkoutCart(s, 'batch-bal', cartSignature(s.cart), true, 2000, customsVersion);
  const [group] = groupOrders(placed.orders);
  assert.ok(group.payment, 'a partial balance leaves a payment to make');
  assert.equal(group.payment.fromBalance, 50_000);
  // The button amount plus the balance part is the checkout total: no number disagrees with another.
  const quoted = placed.orders.reduce((sum, order) => sum + order.quote.total, 0);
  assert.equal(group.payment.amount + group.payment.fromBalance, quoted);
  for (const locale of ['ru', 'uz', 'en']) assert.ok(orderGroupCopy[locale].payBalance('50 000').includes('50 000'));
});

test('pay card: without the balance there is no balance line', () => {
  const s = cart();
  const placed = checkoutCart(s, 'batch-plain', cartSignature(s.cart), false, 2000, customsVersion);
  const [group] = groupOrders(placed.orders);
  assert.equal(group.payment.fromBalance, undefined);
});

test('a checkout fully covered by the balance asks for nothing', () => {
  const s = credit(cart(), 1_000_000_000);
  const placed = checkoutCart(s, 'batch-all', cartSignature(s.cart), true, 2000, customsVersion);
  const [group] = groupOrders(placed.orders);
  assert.equal(group.payment, undefined);
  assert.equal(group.attention, 0);
  assert.notEqual(groupStageText(group, 'ru').label, orderGroupCopy.ru.awaitingPayment);
  assert.deepEqual(noticePanel(placed).action, []);
});

test('the header and the line say "awaiting payment" the same way in every locale', () => {
  const s = cart();
  const placed = checkoutCart(s, 'batch-words', cartSignature(s.cart), false, 2000, customsVersion);
  const [group] = groupOrders(placed.orders);
  for (const locale of ['ru', 'uz', 'en']) assert.equal(groupStageText(group, locale).label, orderGroupCopy[locale].awaitingPayment);
});

test('a доплата notice in the panel speaks with the button verb and carries the amount', () => {
  const at = 5000;
  for (const [code, params] of [['parcel-extra', { extra: 12_000 }], ['customs-duty-over', { actual: 30_000, estimated: 18_000, extra: 12_000 }], ['store-shipping-over', { actual: 30_000, hold: 18_000, extra: 12_000 }]]) {
    const { title, message } = renderNotification({ id: 'n', at, title: 'x', message: 'x', read: false, orderId: 'AT-1', code, params }, 'ru');
    assert.match(message, /12[\s  ]?000/, code);
    assert.match(message, /доплатите/i, code);
    assert.doesNotMatch(message, /подтвердите/i, code);
    assert.notEqual(message, title);
  }
  // Older stored texts without a code read the same way.
  for (const legacy of ['Менеджер уточнил стоимость. Откройте заказ и подтвердите доплату.', 'Таможня начислила больше предоплаты. Откройте заказ и подтвердите доплату.', 'Фактическая доставка магазина больше резерва. Откройте заказ и подтвердите разницу.']) {
    for (const locale of ['ru', 'uz', 'en']) {
      const { message } = renderNotification({ title: 'Нужна доплата за доставку', message: legacy }, locale);
      assert.doesNotMatch(message, /подтвердите|tasdiqlang|approve/i, `${locale}: ${message}`);
    }
  }
});

test('a cancelled line never asks for anything', () => {
  const s = cart();
  const placed = checkoutCart(s, 'batch-x', cartSignature(s.cart), false, 2000, customsVersion);
  for (const order of placed.orders) assert.equal(orderAttention({ ...order, cancelled: true }), null);
});
