import test from 'node:test';
import assert from 'node:assert/strict';
import { products, tariff, blank, addToCart, changeQuantity, setCartCustoms, cartSignature, checkoutCart, totalOf, balanceOf, confirmCustomsDuty, approveCustomsExtra, advanceOrder, orderPayable } from '../lib/market/domain.ts';
import { cartCustomsEstimate } from '../lib/market/allowance.ts';
import { orderFinance } from '../lib/market/finance.ts';
import { customsVersion } from '../lib/market/world.ts';

const help = { outsideUsed: false, help: true }, none = { outsideUsed: false, help: false };

test('"Atlas pays customs for me" adds 4.98% of the goods price (no delivery) to the bill at once, and comes off the same way', () => {
  const cart = addToCart(blank(), products[0], products[0].variants[0], 1000);
  const before = cart.cart[0].quote.total;
  const chosen = setCartCustoms(cart, help, 2000, tariff);
  const line = chosen.cart[0].quote;
  assert.equal(tariff.customsHelpFee, 0.0498);
  assert.equal(line.customsHelp, Math.round(line.merchandise * 0.0498));
  assert.equal(line.total, before + line.customsHelp);
  assert.notEqual(line.id, cart.cart[0].quote.id, 'a new quote: the signature the customer confirms changes with it');
  // Later cart changes keep the choice.
  const more = changeQuantity(chosen, chosen.cart[0].id, 2, 3000, tariff);
  assert.equal(more.cart[0].quote.customsHelp, Math.round(more.cart[0].quote.merchandise * 0.0498));
  const removed = setCartCustoms(more, none, 4000, tariff);
  assert.equal(removed.cart[0].quote.customsHelp, undefined);
  assert.equal(totalOf(removed.cart), totalOf(more.cart) - more.cart[0].quote.customsHelp);
});

test('the fee is part of the order amount; the next cart starts without it; the books count it as income', () => {
  const chosen = setCartCustoms(addToCart(blank(), products[0], products[0].variants[0], 1000), help, 1000, tariff);
  const placed = checkoutCart(chosen, 'k1', cartSignature(chosen.cart), false, 2000, customsVersion);
  const order = placed.orders[0];
  assert.equal(order.quote.customsHelp, chosen.cart[0].quote.customsHelp);
  assert.equal(order.payment.amount, chosen.cart[0].quote.total);
  assert.ok(order.history.some((entry) => entry.text.includes('оплату таможни через Atlas')));
  assert.equal(placed.cartCustoms, undefined, 'the choice belonged to that checkout');
  const books = orderFinance(order, 'c');
  assert.equal(books.services, order.quote.customsHelp);
  assert.equal(books.revenue, books.commission + books.delivery + books.fxGain + books.services);
});

test('a cart whose lines do not match the customs choice is repriced before checkout', () => {
  const cart = addToCart(blank(), products[0], products[0].variants[0], 1000);
  const stale = { ...cart, cartCustoms: help };
  assert.throws(() => checkoutCart(stale, 'k2', cartSignature(stale.cart), false, 2000, customsVersion), /Корзина пересчитана/);
});

const now = Date.UTC(2026, 9, 5, 12);
/** Three pairs at $99 for one recipient: $297, $97 over the $200 allowance. */
function overAllowance() {
  const cart = setCartCustoms(addToCart(blank(), products[0], products[0].variants[0], now, tariff, 3), help, now, tariff);
  const customs = cartCustomsEstimate(cart, tariff, { name: 'Zarina Karimova' }, cart.cartCustoms, now);
  return { cart, customs, duty: Math.ceil(customs.estimateUsd * tariff.fx) };
}

test('the estimated duty is prepaid in the order amount, exactly as the confirmation step showed it', () => {
  const { cart, customs, duty } = overAllowance();
  assert.ok(duty > 0);
  assert.throws(() => checkoutCart(cart, 'd0', cartSignature(cart.cart), false, now, customsVersion, undefined, undefined, undefined, tariff, customs, duty - 1), /Пошлина пересчитана/);
  const placed = checkoutCart(cart, 'd1', cartSignature(cart.cart), false, now, customsVersion, undefined, undefined, undefined, tariff, customs, duty);
  const order = placed.orders[0];
  assert.equal(order.quote.customsDuty, duty);
  assert.equal(order.quote.total, cart.cart[0].quote.total + duty);
  assert.equal(order.payment.amount, order.quote.total);
  const books = orderFinance(order, 'c');
  assert.equal(books.services, order.quote.customsHelp, 'the duty is transit, not Atlas income');
});

test('customs charging less returns the rest to the balance; more waits for consent and blocks delivery', () => {
  const { cart, customs, duty } = overAllowance();
  const placed = checkoutCart(cart, 'd2', cartSignature(cart.cart), false, now, customsVersion, undefined, undefined, undefined, tariff, customs, duty);
  const id = placed.orders[0].id;
  const inTransit = { ...placed, orders: placed.orders.map((o) => ({ ...o, status: 4 })) };
  assert.throws(() => advanceOrder(inTransit, id, 4), /недоступен/, 'not delivered before the duty is settled');
  const lower = confirmCustomsDuty(inTransit, id, customs.estimateUsd / 2, now);
  assert.equal(lower.orders[0].customsSettlement.refund, duty - Math.ceil(customs.estimateUsd / 2 * tariff.fx));
  assert.equal(balanceOf(lower), lower.orders[0].customsSettlement.refund);
  assert.equal(advanceOrder(lower, id, 4).orders[0].status, 5);
  const higher = confirmCustomsDuty(inTransit, id, customs.estimateUsd + 10, now);
  const extra = higher.orders[0].customsSettlement.extra;
  assert.ok(extra > 0);
  assert.equal(balanceOf(higher), 0);
  assert.throws(() => advanceOrder(higher, id, 4));
  assert.throws(() => approveCustomsExtra(higher, id, extra + 1), /Сумма изменилась/);
  const approved = approveCustomsExtra(higher, id, extra, now);
  assert.equal(advanceOrder(approved, id, 4).orders[0].status, 5);
  assert.equal(orderPayable(approved.orders[0]), approved.orders[0].quote.total);
});
