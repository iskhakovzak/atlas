import test from 'node:test';
import assert from 'node:assert/strict';
import { cartAnnouncement } from '../lib/market/cart-announcement.ts';

test('the cart count is said as a whole phrase in each language', () => {
  assert.equal(cartAnnouncement(1, 'ru'), 'В корзине 1 товар');
  assert.equal(cartAnnouncement(3, 'ru'), 'В корзине 3 товара');
  assert.equal(cartAnnouncement(11, 'ru'), 'В корзине 11 товаров');
  assert.equal(cartAnnouncement(0, 'ru'), 'Корзина пуста');
  assert.equal(cartAnnouncement(2, 'uz'), 'Savatda 2 ta tovar');
  assert.equal(cartAnnouncement(1, 'en'), '1 item in your cart');
});
