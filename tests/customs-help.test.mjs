import test from 'node:test';
import assert from 'node:assert/strict';
import { products, tariff, blank, addToCart, changeQuantity, setCartCustoms, cartSignature, checkoutCart, totalOf } from '../lib/market/domain.ts';
import { orderFinance } from '../lib/market/finance.ts';
import { customsVersion } from '../lib/market/world.ts';

const help = { outsideUsed: false, help: true }, none = { outsideUsed: false, help: false };

test('"Atlas pays customs for me" adds 4.98% of each line to the bill at once, and comes off the same way', () => {
  const cart = addToCart(blank(), products[0], products[0].variants[0], 1000);
  const before = cart.cart[0].quote.total;
  const chosen = setCartCustoms(cart, help, 2000, tariff);
  const line = chosen.cart[0].quote;
  assert.equal(tariff.customsHelpFee, 0.0498);
  assert.equal(line.customsHelp, Math.round(before * 0.0498));
  assert.equal(line.total, before + line.customsHelp);
  assert.notEqual(line.id, cart.cart[0].quote.id, 'a new quote: the signature the customer confirms changes with it');
  // Later cart changes keep the choice.
  const more = changeQuantity(chosen, chosen.cart[0].id, 2, 3000, tariff);
  assert.equal(more.cart[0].quote.customsHelp, Math.round((more.cart[0].quote.total - more.cart[0].quote.customsHelp) * 0.0498));
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
