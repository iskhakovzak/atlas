import test from 'node:test';
import assert from 'node:assert/strict';
import { addToCart, blank, changeQuantity, products, tariff } from '../lib/market/domain.ts';
import { applyOptimistic, isOptimistic, withPending } from '../lib/market/optimistic.ts';

const cart = () => { let s = addToCart(blank(), products[0], 'US 9', 1000); s = addToCart(s, products[0], 'US 8', 1000); return s; };

test('only safe actions are optimistic: never adding to the cart, promo codes or payment', () => {
  for (const type of ['favorite', 'cart-quantity', 'cart-select', 'cart-remove', 'notifications-read']) assert.equal(isOptimistic({ type }), true, type);
  for (const type of ['cart-add', 'cart-add-many', 'checkout', 'promo-apply', 'cart-check', 'cart-delivery-speed']) assert.equal(isOptimistic({ type }), false, type);
});

test('a heart tapped twice quickly ends where it started, whatever the server says in between', () => {
  const server = blank();
  const pending = [{ type: 'favorite', id: 'p1' }, { type: 'favorite', id: 'p1' }];
  assert.deepEqual(withPending(server, pending.slice(0, 1)).favorites, ['p1'], 'first tap: saved at once');
  assert.deepEqual(withPending(server, pending).favorites, [], 'second tap: unsaved at once');
  // The first request answered (saved on the server); the second is still on its way: the screen stays unsaved.
  const afterFirst = { ...server, favorites: ['p1'] };
  assert.deepEqual(withPending(afterFirst, pending.slice(1)).favorites, []);
});

test('a removal the server refuses comes back: the screen returns to the server state without it', () => {
  const server = cart();
  const id = server.cart[1].id;
  const shown = withPending(server, [{ type: 'cart-remove', id }]);
  assert.equal(shown.cart.length, 1, 'gone at once');
  assert.ok(shown.cart.every(item => item.id !== id));
  // Refused: the intent is dropped and the server's state shows again, the line restored.
  assert.equal(withPending(server, []).cart.length, 2);
});

test('a quantity is priced like the server prices it, and 409 reconciles: the newer server state plus what is still pending', () => {
  const server = cart();
  const id = server.cart[0].id;
  const optimistic = applyOptimistic(server, { type: 'cart-quantity', id, quantity: 3 }, tariff, 2000);
  const expected = changeQuantity(server, id, 3, 2000, tariff);
  assert.deepEqual(optimistic.cart.map(item => [item.quantity, item.quote?.total]), expected.cart.map(item => [item.quantity, item.quote?.total]));
  // 409: someone else's change (the other line removed) arrives; the pending quantity is applied on top of it.
  const newer = { ...server, cart: server.cart.slice(0, 1) };
  const shown = withPending(newer, [{ type: 'cart-quantity', id, quantity: 3 }], tariff, 2000);
  assert.equal(shown.cart.length, 1);
  assert.equal(shown.cart[0].quantity, 3);
  // A pending action that no longer applies (its line is gone) is skipped, not forced.
  const gone = withPending({ ...server, cart: [] }, [{ type: 'cart-quantity', id, quantity: 3 }], tariff, 2000);
  assert.equal(gone.cart.length, 0);
});

test('unticking lines and reading notifications show at once', () => {
  const server = cart();
  const id = server.cart[0].id;
  assert.equal(applyOptimistic(server, { type: 'cart-select', ids: [id], selected: false }).cart[0].selected, false);
  assert.equal(applyOptimistic(server, { type: 'cart-select', ids: ['missing'], selected: false }), undefined, 'a line already gone waits for the server');
  const noted = { ...blank(), notifications: [{ id: 'n', at: 1, read: false, title: 't', text: 'x' }] };
  const read = applyOptimistic(noted, { type: 'notifications-read' });
  assert.ok(read);
});
