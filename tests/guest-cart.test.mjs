// The guest's browser cart and its move into the account (redesign stage 6, 1 November 2026); the one-page checkout's
// server checks (recipient, Tashkent, postal code, consent) that the page relies on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addGuestLines, emptyGuestCart, estimateGuestCart, guestCartKey, guestCartTtlMs, guestLineKey, guestUnits, maxGuestLines, mergeActionFor,
  parseGuestCart, pendingGuestLines, readGuestCart, removeGuestLines, safeHref, serializeGuestCart, setGuestQuantity, settleGuestLine, writeGuestCart,
} from '../lib/market/guest-cart.ts';
import { ActionError, prepareAction } from '../lib/market/actions-server.ts';
import { actionSchema } from '../lib/market/actions.ts';
import { addToCart, blank, cartSignature, products, tariff } from '../lib/market/domain.ts';
import { viewAccess } from '../lib/market/access.ts';
import { defaultPolicy } from '../lib/market/policy.ts';
import { recentCheckMs } from '../lib/market/cart-check.ts';
import { customsVersion } from '../lib/market/world.ts';

const now = Date.now();
const product = (id, price, overrides = {}) => ({
  ...products[0], id, name: id, usd: price, variants: ['Black · 9', 'Black · 10'], country: 'США', boxedWeight: 0.8, weight: 1.3,
  sourceUrl: `https://www.amazon.com/dp/${id}`, sourcePrice: price, sourceCurrency: 'USD', sourceVariantId: 'v9',
  sourceShipping: 10, sourceShippingUsd: 10, sourceShippingCurrency: 'USD', sourceShippingEstimated: true, shippingKnown: true,
  ...overrides,
});
const memory = () => { const map = new Map(); return { map, getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) }; };

test('the browser cart is versioned, checked line by line, and expires', () => {
  const { cart } = addGuestLines(emptyGuestCart(now), [{ product: product('a', 40), variant: 'Black · 9', quantity: 2, note: ' size up ', href: '/catalog/p/a' }], now);
  const raw = serializeGuestCart(cart, now);
  const back = parseGuestCart(raw, now);
  assert.equal(back.lines.length, 1);
  assert.equal(back.lines[0].quantity, 2);
  assert.equal(back.lines[0].note, 'size up');
  assert.equal(back.lines[0].href, '/catalog/p/a');
  assert.equal(guestUnits(back), 2);
  // Another version, garbage, a line with a foreign option or a broken product, a cart too old or from the future: dropped.
  assert.equal(parseGuestCart(raw.replace('"v":1', '"v":2'), now).lines.length, 0);
  assert.equal(parseGuestCart('{not json', now).lines.length, 0);
  assert.equal(parseGuestCart(raw, now + guestCartTtlMs + 1).lines.length, 0);
  assert.equal(parseGuestCart(serializeGuestCart(cart, now + 60 * 60_000), now).lines.length, 0);
  const tampered = JSON.parse(raw);
  tampered.lines.push({ ...tampered.lines[0], variant: 'Not sold' }, { ...tampered.lines[0], product: { ...tampered.lines[0].product, usd: 'free' } }, { ...tampered.lines[0], quantity: 99, variant: 'Black · 10', href: 'https://evil.example/' });
  const cleaned = parseGuestCart(JSON.stringify(tampered), now);
  assert.equal(cleaned.lines.length, 2);
  assert.equal(cleaned.lines[1].quantity, 10, 'a quantity is capped at 10');
  assert.equal(cleaned.lines[1].href, undefined, 'only a path on this site is kept');
  assert.equal(safeHref('//evil.example'), undefined);
  assert.equal(safeHref('/order-by-link?url=x'), '/order-by-link?url=x');
});

test('adding: the same option adds up, a new one is a new line, at most 20 lines (all or none)', () => {
  let cart = emptyGuestCart(now);
  cart = addGuestLines(cart, [{ product: product('a', 40), variant: 'Black · 9', quantity: 9 }], now).cart;
  cart = addGuestLines(cart, [{ product: product('a', 41), variant: 'Black · 9', quantity: 5 }], now).cart;
  assert.equal(cart.lines.length, 1);
  assert.equal(cart.lines[0].quantity, 10);
  assert.equal(cart.lines[0].product.usd, 41, 'the newer product data replaces the older');
  cart = addGuestLines(cart, [{ product: product('a', 41), variant: 'Black · 10', quantity: 1 }], now).cart;
  assert.equal(cart.lines.length, 2);
  for (let index = 2; index < maxGuestLines; index++) cart = addGuestLines(cart, [{ product: product('p' + index, 10), variant: 'Black · 9', quantity: 1 }], now).cart;
  const full = addGuestLines(cart, [{ product: product('x', 10), variant: 'Black · 9', quantity: 1 }, { product: product('y', 10), variant: 'Black · 9', quantity: 1 }], now);
  assert.equal(full.full, true);
  assert.equal(full.cart, cart, 'nothing is added when the cart is full');
  const key = guestLineKey(product('a', 41), 'Black · 10');
  assert.equal(setGuestQuantity(cart, key, 0, now).lines.find((line) => line.key === key).quantity, 1);
  assert.equal(removeGuestLines(cart, [key], now).lines.length, maxGuestLines - 1);
});

test('the estimate is the account cart\'s pricing (one parcel per store, standard speed)', () => {
  const cart = addGuestLines(emptyGuestCart(now), [{ product: product('a', 40), variant: 'Black · 9', quantity: 1 }, { product: product('b', 20), variant: 'Black · 9', quantity: 2 }], now).cart;
  const estimate = estimateGuestCart(cart, tariff, now);
  const account = addToCart(addToCart(blank(), product('a', 40), 'Black · 9', now, tariff), product('b', 20), 'Black · 9', now, tariff, 2);
  assert.deepEqual(estimate.map((line) => line.quote.total), account.cart.map((line) => line.quote.total));
  assert.ok(estimate.every((line) => line.deliverySpeed === 'standard'));
});

test('storage: blocked or throwing storage is not an error; an empty cart removes the entry', () => {
  const storage = memory();
  const cart = addGuestLines(emptyGuestCart(now), [{ product: product('a', 40), variant: 'Black · 9', quantity: 1 }], now).cart;
  assert.equal(writeGuestCart(storage, cart, now), true);
  assert.equal(readGuestCart(storage, now).lines.length, 1);
  assert.equal(writeGuestCart(storage, emptyGuestCart(now), now), true);
  assert.equal(storage.map.has(guestCartKey), false);
  const broken = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  assert.equal(writeGuestCart(broken, cart, now), false);
  assert.equal(readGuestCart(broken, now).lines.length, 0);
  assert.equal(readGuestCart(null, now).lines.length, 0);
});

test('moving into the account: one cart-add with merge per line; a moved store price is taken and named', async () => {
  const guest = addGuestLines(emptyGuestCart(now), [{ product: product('m', 40), variant: 'Black · 9', quantity: 2, note: 'gift' }], now).cart;
  const [line] = pendingGuestLines(guest);
  const action = mergeActionFor(line);
  assert.equal(action.merge, true);
  assert.equal(actionSchema.safeParse(action).success, true);
  const live = (price) => async () => ({ title: 'Item', price, currency: 'USD', variants: [{ id: 'v9', label: 'Black · 9', price, available: true }], warnings: [] });
  const deps = (fetchProduct) => ({ fetchProduct, pricing: tariff, policy: defaultPolicy, operator: false, now, recentCheckMs });
  // The account already has another line: the guest's joins it.
  const account = addToCart(blank(), product('other', 30, { sourceCheckedAt: now }), 'Black · 9', now, tariff);
  const same = await prepareAction(account, structuredClone(action), deps(live(40)));
  assert.equal(same.next.cart.length, 2);
  const moved = same.next.cart.find((item) => item.product.id === 'm');
  assert.equal(moved.quantity, 2);
  assert.equal(moved.note, 'gift');
  assert.equal(moved.priceChange, undefined);
  assert.ok(moved.product.sourceCheckedAt, 'the server checked it with the store');
  // The browser's price is never trusted: the store's new one is taken, the server prices it, and the line says so.
  const changed = await prepareAction(account, structuredClone(action), deps(live(52)));
  const repriced = changed.next.cart.find((item) => item.product.id === 'm');
  assert.equal(repriced.product.sourcePrice, 52);
  assert.deepEqual([repriced.priceChange.previousPrice, repriced.priceChange.price], [40, 52]);
  assert.ok(repriced.quote.total > moved.quote.total);
  // A tampered browser total changes nothing: the quote is the server's.
  const tampered = structuredClone(action); tampered.product.usd = 1;
  const fair = await prepareAction(account, tampered, deps(live(40)));
  assert.equal(fair.next.cart.find((item) => item.product.id === 'm').quote.total, moved.quote.total);
  // Without `merge` a moved price is still refused (the product page reloads first).
  const plain = structuredClone(action); delete plain.merge;
  await assert.rejects(prepareAction(account, plain, deps(live(52))), (error) => error instanceof ActionError && error.code === 'err_34');
  // Sold out at the store: refused; the browser keeps the line, marked for the cart page.
  const soldOut = async () => ({ title: 'Item', price: 40, currency: 'USD', variants: [{ id: 'v9', label: 'Black · 9', price: 40, available: false }], warnings: [] });
  await assert.rejects(prepareAction(account, structuredClone(action), deps(soldOut)), (error) => error.code === 'err_71');
  const marked = settleGuestLine(guest, line.key, { moved: false, code: 'err_71' }, now);
  assert.equal(pendingGuestLines(marked).length, 0);
  assert.equal(marked.lines[0].problem.code, 'err_71');
  assert.equal(guestUnits(marked), 0, 'a line that did not move is not counted in the header');
  assert.equal(settleGuestLine(guest, line.key, { moved: true }, now).lines.length, 0);
});

test('guests open the cart and the checkout; private pages still sign in first', () => {
  assert.equal(viewAccess('cart', 'guest'), 'allow');
  assert.equal(viewAccess('checkout', 'guest'), 'allow');
  assert.equal(viewAccess('orders', 'guest'), 'signin');
  assert.equal(viewAccess('identity', 'guest'), 'signin');
  const page = readFileSync(new URL('../app/cart/checkout/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /<Marketplace view="checkout"><CheckoutView\/><\/Marketplace>/);
});

// ---- What the one-page checkout sends, checked by the server ----
const home = { recipient: 'Анна Каримова', phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Амира Темура, 1', postalCode: '100000', comment: '' };
const depsPlain = { fetchProduct: async () => { throw Error('not asked'); }, pricing: tariff, policy: defaultPolicy, operator: false, now, recentCheckMs };
const cartState = () => addToCart(blank(), product('c', 40, { sourceCheckedAt: now }), 'Black · 9', now, tariff);
const order = (state, delivery, extra = {}) => ({ type: 'checkout', key: 'co-' + Math.random(), signature: cartSignature(state.cart), useBalance: false, expectedCredit: 0, consentVersion: customsVersion, delivery, ...extra });

test('checkout validation: postal code, Tashkent only, recipient, consent version, a new recipient saved for next time', async () => {
  const state = cartState();
  await assert.rejects(prepareAction(state, order(state, { ...home, postalCode: '' }), depsPlain), /индекс|postal/i);
  await assert.rejects(prepareAction(state, order(state, { ...home, postalCode: '1000' }), depsPlain), /индекс|postal/i);
  await assert.rejects(prepareAction(state, order(state, { ...home, region: 'Самарканд', city: 'Самарканд' }), depsPlain), (error) => error.code === 'err_78' || /Ташкент/.test(error.message));
  await assert.rejects(prepareAction(state, order(state, { ...home, recipient: 'A' }), depsPlain));
  await assert.rejects(prepareAction(state, order(state, home, { consentVersion: 'old' })));
  const placed = await prepareAction(state, order(state, home, { saveRecipientLabel: 'Дом' }), depsPlain);
  assert.equal(placed.next.orders.length, 1);
  assert.equal(placed.next.orders[0].payment.status, 'pending', 'placed and waiting for the (simulated) payment mark');
  assert.equal(placed.next.deliveryProfiles.length, 1);
  assert.equal(placed.next.orders[0].deliveryProfileId, placed.next.deliveryProfiles[0].id, 'the order refers to the saved recipient (the passport attaches to it)');
});
