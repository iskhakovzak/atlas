import test from 'node:test';
import assert from 'node:assert/strict';
import { products, tariff, blank, addToCart, changeQuantity, setCartCustoms, cartSignature, checkoutCart, totalOf, balanceOf, confirmCustomsDuty, approveCustomsExtra, advanceOrder, orderPayable, withCustomsHelpFor } from '../lib/market/domain.ts';
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

test('no duty for the recipient: the chosen fee comes off at checkout, nothing is prepaid (owner, 7.10.2026)', () => {
  const chosen = setCartCustoms(addToCart(blank(), products[0], products[0].variants[0], 1000), help, 1000, tariff);
  assert.ok(chosen.cart[0].quote.customsHelp > 0, 'the cart line carries the fee while the choice stands');
  const customs = cartCustomsEstimate(chosen, tariff, { name: 'Zarina Karimova' }, chosen.cartCustoms, 2000);
  assert.equal(customs.estimateUsd, 0);
  assert.equal(customs.helpRequested, undefined);
  assert.deepEqual(withCustomsHelpFor(chosen.cart, customs, tariff.fx).map((line) => line.quote.customsHelp), [undefined]);
  const placed = checkoutCart(chosen, 'k1', cartSignature(chosen.cart), false, 2000, customsVersion, undefined, undefined, undefined, tariff, customs, 0);
  const order = placed.orders[0];
  assert.equal(order.quote.customsHelp, undefined);
  assert.equal(order.quote.customsDuty, undefined);
  assert.equal(order.payment.amount, chosen.cart[0].quote.total - chosen.cart[0].quote.customsHelp);
  assert.ok(!order.history.some((entry) => entry.code === 'customs-help'));
  assert.equal(placed.cartCustoms, undefined, 'the choice belonged to that checkout');
});

test('"remember for next orders" carries the choice into the next cart; unticked, the account forgets it', () => {
  const remembered = setCartCustoms(addToCart(blank(), products[0], products[0].variants[0], 1000), { ...help, remember: true }, 1000, tariff);
  assert.deepEqual(remembered.customsPreference, { help: true });
  assert.equal(remembered.cartCustoms.remember, undefined, 'the flag is not kept in the cart');
  const customs = cartCustomsEstimate(remembered, tariff, { name: 'Zarina Karimova' }, remembered.cartCustoms, 2000);
  const placed = checkoutCart(remembered, 'r1', cartSignature(remembered.cart), false, 2000, customsVersion, undefined, undefined, undefined, tariff, customs, 0);
  const next = addToCart(placed, products[0], products[0].variants[0], 3000);
  assert.equal(next.cartCustoms, undefined);
  assert.ok(next.cart[0].quote.customsHelp > 0, 'the new cart starts with the remembered choice');
  const self = setCartCustoms(next, { ...none, remember: true }, 4000, tariff);
  assert.deepEqual(self.customsPreference, { help: false });
  assert.equal(self.cart[0].quote.customsHelp, undefined);
  const once = setCartCustoms(next, { ...none, remember: false }, 4000, tariff);
  assert.equal(once.customsPreference, undefined);
  const kept = setCartCustoms(next, none, 4000, tariff);
  assert.deepEqual(kept.customsPreference, { help: true }, 'an older client without the flag leaves the remembered choice as it is');
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
  assert.equal(order.quote.customsHelp, cart.cart[0].quote.customsHelp, 'with duty to pay, the fee stays');
  assert.ok(order.history.some((entry) => entry.text.includes('оплату таможни через Atlas')));
  const books = orderFinance(order, 'c');
  assert.equal(books.services, order.quote.customsHelp, 'the duty is transit, not Atlas income');
  assert.equal(books.revenue, books.commission + books.delivery + books.fxGain + books.services);
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
