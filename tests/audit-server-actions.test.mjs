import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionError, codedActionError, editorialShippingFor, prepareAction, staleRevision } from '../lib/market/actions-server.ts';
import { addToCart, blank, cartSignature, holdOf, products, storeShippingReserves, tariff } from '../lib/market/domain.ts';
import { defaultPolicy } from '../lib/market/policy.ts';
import { initialCatalog } from '../lib/market/catalog-editor.ts';
import { communityCatalogProducts } from '../lib/market/community-deals.ts';
import { ManualEntryFallbackError, UnsupportedStoreError } from '../lib/importer/fetch.ts';
import { recentCheckMs } from '../lib/market/cart-check.ts';
import { customsVersion } from '../lib/market/world.ts';

// applyAction (checkout) reads the clock itself, so the fixtures work around the real time.
const now = Date.now();
const product = (id, price, overrides = {}) => ({
  ...products[0], id, name: id, usd: price, variants: ['Black · 9'], country: 'США', boxedWeight: 0.8, weight: 1.3,
  sourceUrl: `https://www.amazon.com/dp/${id}`, sourcePrice: price, sourceCurrency: 'USD', sourceVariantId: 'v9',
  sourceShipping: 10, sourceShippingUsd: 10, sourceShippingCurrency: 'USD', sourceShippingEstimated: true, shippingKnown: true,
  ...overrides,
});
const live = (price, overrides = {}) => ({ title: 'Item', price, currency: 'USD', variants: [{ id: 'v9', label: 'Black · 9', price, available: true }], warnings: [], ...overrides });
const home = { recipient: 'Анна Каримова', phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Амира Темура, 1', postalCode: '100000', comment: '' };
const checkout = (state) => ({ type: 'checkout', key: 'audit-' + Math.random(), signature: cartSignature(state.cart), useBalance: false, expectedCredit: 0, consentVersion: customsVersion, delivery: home });
const noFetch = async () => { throw Error('the store must not be asked'); };
const deps = (overrides = {}) => ({ fetchProduct: noFetch, pricing: tariff, policy: defaultPolicy, operator: false, now, recentCheckMs, ...overrides });
const down = async () => { throw new ManualEntryFallbackError('blocked', undefined, 'blocked'); };

test('(a) checkout after the store price changed: refused with err_35, the line marked and repriced, no order', async () => {
  const state = addToCart(blank(), product('a', 40), 'Black · 9', now, tariff);
  const result = await prepareAction(state, checkout(state), deps({ fetchProduct: async () => live(45) }));
  assert.equal(result.refusal, 'err_35');
  const [line] = result.next.cart;
  assert.deepEqual([line.priceChange.previousPrice, line.priceChange.price], [40, 45]);
  assert.equal(line.product.sourcePrice, 45);
  assert.ok(line.quote.total > state.cart[0].quote.total, 'the new store price is in the new total');
  assert.equal(result.next.orders.length, 0);
});

test('(b) only the 15-minute hold ran out with the same totals: the signature is renewed and the order is placed', async () => {
  const added = now - 20 * 60_000;
  const state = addToCart(blank(), product('b', 40, { sourceCheckedAt: now }), 'Black · 9', added, tariff);
  assert.ok(now >= state.cart[0].quote.expiresAt);
  const action = checkout(state), signature = action.signature;
  const result = await prepareAction(state, action, deps());
  assert.equal(result.refusal, undefined);
  assert.notEqual(action.signature, signature, 'the action carries the renewed signature');
  assert.equal(result.next.orders.length, 1);
  assert.equal(result.next.cart.length, 0);
});

test('(c) an expired quote that renews to other totals (same tariff version) is refused with err_37', async () => {
  const state = addToCart(blank(), product('c', 40, { sourceCheckedAt: now }), 'Black · 9', now - 20 * 60_000, tariff);
  const pricing = { ...tariff, fx: tariff.fx + 100 };
  const result = await prepareAction(state, checkout(state), deps({ pricing }));
  assert.equal(result.refusal, 'err_37');
  assert.equal(result.next.orders.length, 0);
  assert.notEqual(result.next.cart[0].quote.total, state.cart[0].quote.total, 'the cart shows the renewed total');
  assert.ok(result.next.cart[0].quote.expiresAt > now);
});

test('(d) a line priced under another tariff version is refused with err_37 and requoted', async () => {
  const state = addToCart(blank(), product('d', 40, { sourceCheckedAt: now }), 'Black · 9', now, tariff);
  const pricing = { ...tariff, version: tariff.version + '-next' };
  const result = await prepareAction(state, checkout(state), deps({ pricing }));
  assert.equal(result.refusal, 'err_37');
  assert.equal(result.next.cart[0].quote.tariffVersion, pricing.version);
  assert.equal(result.next.orders.length, 0);
});

test('(e) a customs-help choice the quotes do not carry is refused with err_37', async () => {
  const base = addToCart(blank(), product('e', 40, { sourceCheckedAt: now }), 'Black · 9', now, tariff);
  const state = { ...base, cartCustoms: { outsideUsed: false, help: true } };
  const result = await prepareAction(state, checkout(state), deps());
  assert.equal(result.refusal, 'err_37');
  assert.ok(result.next.cart.every((item) => item.quote.customsHelp));
  assert.equal(result.next.orders.length, 0);
});

test('(f) only unreachable stores give err_38; any other blocked line gives err_36', async () => {
  const old = now - 2 * 60 * 60_000;
  const unreachable = addToCart(blank(), product('f1', 40, { sourceCheckedAt: old }), 'Black · 9', now, tariff);
  const first = await prepareAction(unreachable, { type: 'cart-check' }, deps({ fetchProduct: down }));
  assert.equal(first.refusal, 'err_38');
  assert.equal(first.next.cart[0].sourceIssue.kind, 'unreachable');
  const mixed = addToCart(unreachable, product('f2', 30, { sourceCheckedAt: old }), 'Black · 9', now, tariff);
  const fetchProduct = async (url) => url.endsWith('/f1') ? down() : live(30, { currency: 'EUR' });
  const second = await prepareAction(mixed, checkout(mixed), deps({ fetchProduct }));
  assert.equal(second.refusal, 'err_36');
  assert.deepEqual(second.next.cart.map((item) => item.sourceIssue?.kind), ['unreachable', 'currency']);
  assert.equal(second.next.orders.length, 0);
});

test('(g) cart-add: a changed store price is a 409 err_34; a store failure without the manual right is rethrown', async () => {
  const add = (overrides = {}) => ({ type: 'cart-add', product: product('g', 40, overrides), variant: 'Black · 9' });
  await assert.rejects(prepareAction(blank(), add(), deps({ fetchProduct: async () => live(44) })),
    (error) => error instanceof ActionError && error.status === 409 && error.code === 'err_34');
  await assert.rejects(prepareAction(blank(), add(), deps({ fetchProduct: down })), ManualEntryFallbackError);
  // A buyer-confirmed product goes on when the store hides its data.
  const manual = await prepareAction(blank(), add({ sourceManuallyConfirmed: true }), deps({ fetchProduct: down }));
  assert.equal(manual.next.cart.length, 1);
  // A verified add records the check on the same action object the route reads afterwards.
  const action = add({ sourceCheckedAt: 1, stockQuantity: 99 });
  const verified = await prepareAction(blank(), action, deps({ fetchProduct: async () => live(40) }));
  assert.equal(action.product.sourceCheckedAt, now);
  assert.equal(action.product.stockQuantity, undefined);
  assert.equal(verified.verifiedSource.price, 40);
  assert.equal(verified.next.cart[0].product.sourceCheckedAt, now);
});

test('(h) only the catalog grants an unknown-delivery reserve; stated store delivery is charged even above $50', async () => {
  const stated = async () => live(40, { shipping: 20, shippingCurrency: 'USD' });
  // The customer lowered the reserve of a catalog card to $3: the catalog's $10 stands, and the store's $20 is not compared.
  const catalogCard = { type: 'cart-add', product: product('h1', 40, { sourceShipping: 3, sourceShippingUsd: 3 }), variant: 'Black · 9' };
  const editorialShipping = async () => ({ sourceShippingUsd: 10, sourceShippingEstimated: true });
  const kept = await prepareAction(blank(), catalogCard, deps({ fetchProduct: stated, editorialShipping }));
  const line = kept.next.cart[0];
  assert.deepEqual([line.product.sourceShippingEstimated, line.product.sourceShippingUsd, line.product.sourceShipping], [true, 10, 10]);
  assert.equal(line.quote.sourceShipping ?? 0, 0, 'the reserve stays outside the total');
  assert.equal(holdOf(kept.next.cart), 10 * tariff.fx);
  // Without a catalog record, claiming "delivery unknown" against a page that states it is a changed product.
  const claimed = { type: 'cart-add', product: product('h2', 40, { sourceShipping: 0, sourceShippingUsd: 0 }), variant: 'Black · 9' };
  await assert.rejects(prepareAction(blank(), claimed, deps({ fetchProduct: stated, editorialShipping: async () => undefined })),
    (error) => error instanceof ActionError && error.status === 409 && error.code === 'err_34');
  // Items above $50 with the store's stated delivery: the delivery is in the total, not "free".
  const expensive = { type: 'cart-add', product: product('h3', 120, { sourceShipping: 20, sourceShippingUsd: 20, sourceShippingEstimated: false }), variant: 'Black · 9' };
  const charged = await prepareAction(blank(), expensive, deps({ fetchProduct: async () => live(120, { shipping: 20, shippingCurrency: 'USD' }) }));
  assert.equal(charged.next.cart[0].quote.sourceShipping, Math.ceil(20 * tariff.fx));
  assert.equal(holdOf(charged.next.cart), 0);
  // At checkout an older cart line that claims a reserve is corrected to the stated delivery (err_35 with the new total).
  const cart = addToCart(blank(), product('h4', 40, { sourceShipping: 0, sourceShippingUsd: 0 }), 'Black · 9', now, tariff);
  const corrected = await prepareAction(cart, checkout(cart), deps({ fetchProduct: stated, editorialShipping: async () => undefined }));
  assert.equal(corrected.refusal, 'err_35');
  assert.equal(corrected.next.cart[0].product.sourceShippingEstimated, false);
  assert.equal(corrected.next.cart[0].quote.sourceShipping, Math.ceil(20 * tariff.fx));
  // The same line from a catalog card takes the catalog's $10 reserve at checkout: its $0 is corrected and shown first (err_37).
  const catalogLine = await prepareAction(cart, { type: 'cart-check' }, deps({ fetchProduct: stated, editorialShipping }));
  assert.equal(catalogLine.refusal, 'err_37');
  assert.deepEqual([catalogLine.next.cart[0].product.sourceShippingEstimated, catalogLine.next.cart[0].product.sourceShippingUsd], [true, 10]);
  assert.equal(holdOf(catalogLine.next.cart), 10 * tariff.fx);
  // Once corrected, the next check passes.
  const again = await prepareAction(catalogLine.next, { type: 'cart-check' }, deps({ fetchProduct: stated, editorialShipping }));
  assert.equal(again.refusal, undefined);
});

test('the catalog record is found by canonical link in published cards and community deals only', () => {
  const document = structuredClone(initialCatalog());
  const card = document.entries.find((entry) => entry.published && !communityCatalogProducts.some((deal) => deal.id === entry.id));
  card.published.sourceShippingUsd = 7;
  card.published.sourceShippingEstimated = false;
  const tracked = new URL(card.published.sourceUrl);
  tracked.searchParams.set('utm_source', 'ad');
  assert.deepEqual(editorialShippingFor(document, tracked.href), { sourceShippingUsd: 7, sourceShippingEstimated: false });
  const deal = communityCatalogProducts[0];
  assert.deepEqual(editorialShippingFor({ ...document, entries: [] }, deal.sourceUrl), { sourceShippingUsd: 10, sourceShippingEstimated: true });
  // A customer's link draft is not published: it grants nothing, and neither do unknown or unsupported links.
  const draftOnly = { ...document, entries: [{ ...card, published: undefined, origin: 'customer-link', queueState: 'queued' }] };
  assert.equal(editorialShippingFor(draftOnly, card.draft.sourceUrl), undefined);
  assert.equal(editorialShippingFor(document, 'https://www.amazon.com/dp/NOT-IN-CATALOG'), undefined);
  assert.equal(editorialShippingFor(document, 'https://example.org/item'), undefined);
  assert.equal(editorialShippingFor(document, undefined), undefined);
});

test('(i) a product the store no longer confirms is a 400 with a localized code', async () => {
  const add = (overrides = {}) => ({ type: 'cart-add', product: product('i', 40, overrides), variant: 'Black · 9' });
  const code = (expected) => (error) => error instanceof ActionError && error.status === 400 && error.code === expected;
  await assert.rejects(prepareAction(blank(), add({ sourcePrice: undefined }), deps({ fetchProduct: async () => live(40) })), code('err_67'));
  await assert.rejects(prepareAction(blank(), add(), deps({ fetchProduct: async () => live(40, { currency: 'EUR' }) })), code('err_68'));
  await assert.rejects(prepareAction(blank(), add(), deps({ fetchProduct: async () => live(40, { variants: [{ id: 'v10', label: 'Black · 10', price: 40 }] }) })), code('err_69'));
  await assert.rejects(prepareAction(blank(), add(), deps({ fetchProduct: async () => live(undefined, { variants: [{ id: 'v9', label: 'Black · 9', available: true }] }) })), code('err_70'));
  await assert.rejects(prepareAction(blank(), add(), deps({ fetchProduct: async () => live(40, { variants: [{ id: 'v9', label: 'Black · 9', price: 40, quantity: 0 }] }) })), code('err_71'));
});

test('the route maps coded errors and detects a stale revision', async () => {
  assert.deepEqual(codedActionError(new ActionError(409, 'err_34')), { status: 409, code: 'err_34' });
  assert.deepEqual(codedActionError(Object.assign(Error('Укажите почтовый индекс получателя: 6 цифр.'), { code: 'err_61' })), { status: 400, code: 'err_61' });
  assert.equal(codedActionError(Object.assign(Error('socket'), { code: 'ECONNRESET' })), undefined);
  assert.equal(codedActionError(Error('Корзина пуста.')), undefined);
  assert.equal(codedActionError(new UnsupportedStoreError()), undefined, 'a code whose text needs the store count keeps its message');
  assert.equal(codedActionError('err_1'), undefined);
  // A domain check that throws a coded Error reaches the route as that code.
  const cart = addToCart(blank(), product('j', 40, { sourceCheckedAt: now }), 'Black · 9', now, tariff);
  await assert.rejects(prepareAction(cart, { ...checkout(cart), delivery: { ...home, postalCode: '' } }, deps()),
    (error) => assert.deepEqual(codedActionError(error), { status: 400, code: 'err_61' }) ?? true);
  assert.equal(staleRevision(4, 4), false);
  assert.equal(staleRevision(3, 4), true);
  assert.equal(staleRevision(undefined, 0), true);
});

test('(h2) the store decides the delivery currency: a known EUR 0 against a page stating $20 is corrected', async () => {
  const stated = async () => live(40, { shipping: 20, shippingCurrency: 'USD' });
  const crafted = { sourceShipping: 0, sourceShippingUsd: 0, sourceShippingCurrency: 'EUR', sourceShippingEstimated: false };
  await assert.rejects(prepareAction(blank(), { type: 'cart-add', product: product('k1', 40, crafted), variant: 'Black · 9' }, deps({ fetchProduct: stated })),
    (error) => error instanceof ActionError && error.status === 409 && error.code === 'err_34');
  const cart = addToCart(blank(), product('k1', 40, crafted), 'Black · 9', now, tariff);
  assert.equal(cart.cart[0].quote.sourceShipping ?? 0, 0);
  const result = await prepareAction(cart, checkout(cart), deps({ fetchProduct: stated }));
  assert.equal(result.refusal, 'err_35');
  const [line] = result.next.cart;
  assert.deepEqual([line.product.sourceShippingEstimated, line.product.sourceShipping, line.product.sourceShippingCurrency], [false, 20, 'USD']);
  assert.equal(line.quote.sourceShipping, Math.ceil(20 * tariff.fx));
  assert.equal(result.next.orders.length, 0);
});

test('(h3) a claimed reserve against a page stating delivery in another supported currency takes that delivery', async () => {
  const euro = async () => live(40, { shipping: 20, shippingCurrency: 'EUR' });
  await assert.rejects(prepareAction(blank(), { type: 'cart-add', product: product('k2', 40), variant: 'Black · 9' }, deps({ fetchProduct: euro })),
    (error) => error instanceof ActionError && error.code === 'err_34');
  const cart = addToCart(blank(), product('k2', 40), 'Black · 9', now, tariff);
  const result = await prepareAction(cart, { type: 'cart-check' }, deps({ fetchProduct: euro }));
  assert.equal(result.refusal, 'err_35');
  const [line] = result.next.cart;
  assert.deepEqual([line.product.sourceShippingEstimated, line.product.sourceShippingCurrency, line.product.sourceShippingUsd], [false, 'EUR', 22]);
  assert.equal(line.quote.sourceShipping, Math.ceil(22 * tariff.fx));
  assert.equal(holdOf(result.next.cart), 0);
});

test('(h4) a known-free delivery the store does not state becomes the $10 reserve, and the order carries the hold', async () => {
  const silent = async () => live(40);
  const crafted = { sourceShipping: 0, sourceShippingUsd: 0, sourceShippingEstimated: false };
  await assert.rejects(prepareAction(blank(), { type: 'cart-add', product: product('k3', 40, crafted), variant: 'Black · 9' }, deps({ fetchProduct: silent })),
    (error) => error instanceof ActionError && error.status === 409 && error.code === 'err_34');
  const cart = addToCart(blank(), product('k3', 40, crafted), 'Black · 9', now, tariff);
  assert.equal(holdOf(cart.cart), 0);
  const refused = await prepareAction(cart, checkout(cart), deps({ fetchProduct: silent }));
  // Never checked with the store, the line's "known free" delivery becomes the reserve before the check (err_37: new hold).
  assert.equal(refused.refusal, 'err_37');
  const [line] = refused.next.cart;
  assert.deepEqual([line.product.sourceShippingEstimated, line.product.sourceShippingUsd], [true, 10]);
  assert.equal(holdOf(refused.next.cart), 10 * tariff.fx);
  assert.equal(storeShippingReserves(refused.next.cart, tariff)[0].free, false);
  // The customer sees the hold and checks out again: the order carries it outside the total.
  const placed = await prepareAction(refused.next, checkout(refused.next), deps({ fetchProduct: silent }));
  assert.equal(placed.refusal, undefined);
  assert.equal(placed.next.orders.length, 1);
  assert.equal(placed.next.orders[0].product.sourceShippingEstimated, true);
  assert.equal(placed.next.orders[0].quote.storeShippingHold, 10 * tariff.fx);
  // A catalog card whose delivery the operator confirmed keeps it when the store states none.
  const confirmed = async () => ({ sourceShippingUsd: 6, sourceShippingEstimated: false });
  const card = await prepareAction(blank(), { type: 'cart-add', product: product('k4', 40, crafted), variant: 'Black · 9' }, deps({ fetchProduct: silent, editorialShipping: confirmed }));
  assert.deepEqual([card.next.cart[0].product.sourceShippingEstimated, card.next.cart[0].product.sourceShippingUsd], [false, 6]);
  assert.equal(card.next.cart[0].quote.sourceShipping, Math.ceil(6 * tariff.fx));
});

test('(h5) the unknown-delivery hold is never below $10 outside the catalog: a $0 reserve is not free below $50', async () => {
  const silent = async () => live(40);
  const zero = { sourceShipping: 0, sourceShippingUsd: 0, sourceShippingEstimated: true };
  const added = await prepareAction(blank(), { type: 'cart-add', product: product('m1', 40, zero), variant: 'Black · 9' }, deps({ fetchProduct: silent }));
  assert.equal(holdOf(added.next.cart), 10 * tariff.fx);
  assert.equal(storeShippingReserves(added.next.cart, tariff)[0].free, false);
  // A larger hold the customer chose stays; a manual line from a store that hides its data gets the floor too.
  const raised = await prepareAction(blank(), { type: 'cart-add', product: product('m2', 40, { sourceShipping: 25, sourceShippingUsd: 25 }), variant: 'Black · 9' }, deps({ fetchProduct: silent }));
  assert.equal(holdOf(raised.next.cart), 25 * tariff.fx);
  const manual = await prepareAction(blank(), { type: 'cart-add', product: product('m3', 40, { ...zero, sourceManuallyConfirmed: true }), variant: 'Black · 9' }, deps({ fetchProduct: down }));
  assert.equal(holdOf(manual.next.cart), 10 * tariff.fx);
  // A catalog reserve is the operator's, even below $10.
  const card = await prepareAction(blank(), { type: 'cart-add', product: product('m4', 40, zero), variant: 'Black · 9' }, deps({ fetchProduct: silent, editorialShipping: async () => ({ sourceShippingUsd: 4, sourceShippingEstimated: true }) }));
  assert.equal(holdOf(card.next.cart), 4 * tariff.fx);
  // An older cart line with a $0 reserve is raised at checkout and shown first (err_37), then the order carries $10.
  const cart = addToCart(blank(), product('m5', 40, { ...zero, sourceCheckedAt: now }), 'Black · 9', now, tariff);
  assert.equal(holdOf(cart.cart), 0);
  const refused = await prepareAction(cart, checkout(cart), deps());
  assert.equal(refused.refusal, 'err_37');
  assert.equal(holdOf(refused.next.cart), 10 * tariff.fx);
  const placed = await prepareAction(refused.next, checkout(refused.next), deps());
  assert.equal(placed.refusal, undefined);
  assert.equal(placed.next.orders[0].quote.storeShippingHold, 10 * tariff.fx);
  // Above $50 from the store the reserve is free anyway: raising it changes nothing the customer sees, no refusal.
  const big = addToCart(blank(), product('m6', 120, { ...zero, sourceCheckedAt: now }), 'Black · 9', now, tariff);
  const free = await prepareAction(big, checkout(big), deps());
  assert.equal(free.refusal, undefined);
  assert.equal(free.next.orders.length, 1);
});

test('(h5) without a store response a claimed known delivery is the reserve at cart-add', async () => {
  const crafted = { sourceShipping: 0, sourceShippingUsd: 0, sourceShippingEstimated: false, sourceManuallyConfirmed: true };
  const blocked = async () => { throw new ManualEntryFallbackError('blocked'); };
  const added = await prepareAction(blank(), { type: 'cart-add', product: product('m1', 5, crafted), variant: 'Black · 9' }, deps({ fetchProduct: blocked }));
  const [line] = added.next.cart;
  assert.deepEqual([line.product.sourceShippingEstimated, line.product.sourceShippingUsd], [true, 10]);
  assert.equal(line.quote.sourceShipping ?? 0, 0, 'the reserve stays outside the total');
  assert.equal(holdOf(added.next.cart), 10 * tariff.fx);
});
