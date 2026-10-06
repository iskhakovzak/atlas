import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, actionSchema } from '../lib/market/actions.ts';
import { addToCart, blank, cartSignature, products, tariff } from '../lib/market/domain.ts';
import { customsVersion } from '../lib/market/world.ts';
import { defaultPolicy } from '../lib/market/policy.ts';

const original = products[0];
const tampered = { ...original, usd: 0.01, weight: 0.01, boxedWeight: 0.01, image: 'https://evil.example/x.gif', name: 'X', variants: ['ANY'] };

test('cart-add of a product without a link takes price, weight, photo and name from the server list', () => {
  const action = actionSchema.parse({ type: 'cart-add', product: tampered, variant: original.variants[0] });
  const state = applyAction(blank(), action, false, tariff, defaultPolicy);
  const line = state.cart[0];
  assert.equal(line.product.usd, 99);
  assert.equal(line.product.weight, 1.9);
  assert.equal(line.product.boxedWeight, original.boxedWeight);
  assert.equal(line.product.image, '/images/sneaker.jpg');
  assert.equal(line.product.name, original.name);
  assert.deepEqual(line.product.variants, original.variants);
  // The server list itself is not mutated by the cart.
  assert.equal(products[0].usd, 99);
});

test('a client-only option is not accepted for a product without a link', () => {
  const action = actionSchema.parse({ type: 'cart-add', product: tampered, variant: 'ANY' });
  assert.throws(() => applyAction(blank(), action, false, tariff, defaultPolicy));
});

test('an unknown product id without a link is refused with err_73', () => {
  const action = actionSchema.parse({ type: 'cart-add', product: { ...tampered, id: 'hacked' }, variant: original.variants[0] });
  let error;
  try { applyAction(blank(), action, false, tariff, defaultPolicy); } catch (caught) { error = caught; }
  assert.ok(error, 'expected a refusal');
  assert.match(error.message, /не найден/);
  assert.equal(error.code, 'err_73');
});

test('cart-add-many with a tampered product gets the server values too', () => {
  const action = actionSchema.parse({ type: 'cart-add-many', items: [{ product: tampered, variant: original.variants[0], quantity: 1 }, { product: tampered, variant: original.variants[1], quantity: 2 }] });
  const state = applyAction(blank(), action, false, tariff, defaultPolicy);
  assert.equal(state.cart.length, 2);
  for (const line of state.cart) {
    assert.equal(line.product.usd, 99);
    assert.equal(line.product.weight, 1.9);
    assert.equal(line.product.image, '/images/sneaker.jpg');
    assert.equal(line.product.name, original.name);
  }
  const unknown = actionSchema.parse({ type: 'cart-add-many', items: [{ product: tampered, variant: original.variants[0], quantity: 1 }, { product: { ...tampered, id: 'hacked' }, variant: original.variants[0], quantity: 1 }] });
  assert.throws(() => applyAction(blank(), unknown, false, tariff, defaultPolicy), /не найден/);
});

test('policy still applies: to the sent name first, then to the server record', () => {
  assert.throws(() => applyAction(blank(), { type: 'cart-add', product: { ...original, name: 'Collectible weapon' }, variant: original.variants[0] }, false, tariff, defaultPolicy), /ручной проверки/);
  // A blocked category is refused even when the client relabels the product.
  const headphones = products[1];
  assert.throws(() => applyAction(blank(), { type: 'cart-add', product: { ...headphones, category: 'Обувь' }, variant: headphones.variants[0] }, false, tariff, { ...defaultPolicy, blockedCategories: [headphones.category] }), /недоступна/);
});

const home = { recipient: 'Анна Каримова', phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Амира Темура, 1', postalCode: '100000', comment: '' };
const parents = { ...home, recipient: 'Ольга Каримова', address: 'ул. Навои, 15' };
const passport = (documentId, recipientProfileId, lastName) => ({ type: 'identity-confirm', documentId, recipientProfileId, firstName: 'Тест', lastName, birthDate: '1990-01-01', passportNumber: 'AA1234567', nationality: 'Узбекистан' });

test('removing a recipient removes their passport from the account state', () => {
  let state = applyAction(blank(), { type: 'delivery-profile-save', value: home, label: 'Дом' }, false);
  state = applyAction(state, { type: 'delivery-profile-save', value: parents, label: 'Родители', primary: false }, false);
  const [first, second] = state.deliveryProfiles;
  state = applyAction(state, passport('doc-1', first.id, 'Каримова'), false);
  state = applyAction(state, passport('doc-2', second.id, 'Родители'), false);
  assert.equal(state.identityProfile.documentId, 'doc-2');
  state = applyAction(state, { type: 'delivery-profile-remove', id: second.id }, false);
  assert.deepEqual(state.identityProfiles.map(profile => profile.documentId), ['doc-1']);
  assert.equal(state.identityProfile, undefined);
  assert.equal(state.deliveryProfiles.length, 1);
  assert.equal(state.deliveryProfiles[0].primary, true);
  // Removing the other recipient keeps an unrelated account passport in place.
  state = applyAction(state, passport('doc-3', first.id, 'Каримова'), false);
  state = applyAction(state, { type: 'delivery-profile-save', value: parents, label: 'Родители', primary: false }, false);
  const third = state.deliveryProfiles.find(profile => profile.label === 'Родители');
  state = applyAction(state, { type: 'delivery-profile-remove', id: third.id }, false);
  assert.equal(state.identityProfile.documentId, 'doc-3');
  assert.deepEqual(state.identityProfiles.map(profile => profile.documentId), ['doc-3']);
});

test('a legacy account with only identityProfile drops it when its recipient is removed', () => {
  let state = applyAction(blank(), { type: 'delivery-profile-save', value: home, label: 'Дом' }, false);
  const id = state.deliveryProfiles[0].id;
  state = { ...state, identityProfile: { documentId: 'legacy-doc', recipientProfileId: id, firstName: 'Тест', lastName: 'Старый', birthDate: '1990-01-01', passportMasked: '•••• 4567', nationality: 'Узбекистан', confirmedAt: 1 }, identityProfiles: undefined };
  state = applyAction(state, { type: 'delivery-profile-remove', id }, false);
  assert.equal(state.identityProfile, undefined);
  assert.equal(state.identityProfiles, undefined);
});

// Declarations: an order for a saved recipient never borrows another person's passport.
const placeOrder = (state, extra) => {
  const cart = addToCart(state, products[0], products[0].variants[0], Date.now());
  return applyAction(cart, { type: 'checkout', key: 'decl-' + Math.random(), signature: cartSignature(cart.cart), useBalance: false, expectedCredit: 0, consentVersion: customsVersion, ...extra }, false);
};
const twoRecipients = () => {
  let state = applyAction(blank(), { type: 'delivery-profile-save', value: home, label: 'Дом' }, false);
  state = applyAction(state, { type: 'delivery-profile-save', value: parents, label: 'Родители', primary: false }, false);
  return state;
};

test('a declaration for a recipient without a confirmed passport is refused, not filled with another one', () => {
  let state = twoRecipients();
  const [first, second] = state.deliveryProfiles;
  state = applyAction(state, passport('doc-1', first.id, 'Каримова'), false);
  state = placeOrder(state, { delivery: parents, deliveryProfileId: second.id });
  const order = state.orders[0];
  assert.equal(order.deliveryProfileId, second.id);
  let error;
  try { applyAction(state, { type: 'declaration-preview', orderIds: [order.id] }, false); } catch (caught) { error = caught; }
  assert.ok(error, 'expected a refusal');
  assert.match(error.message, /паспорт/);
  assert.equal(error.code, 'err_66');
});

test('once the second recipient confirms a passport, the declaration carries that passport', () => {
  let state = twoRecipients();
  const [first, second] = state.deliveryProfiles;
  state = applyAction(state, passport('doc-1', first.id, 'Каримова'), false);
  state = placeOrder(state, { delivery: parents, deliveryProfileId: second.id });
  state = applyAction(state, passport('doc-2', second.id, 'Ольга'), false);
  state = applyAction(state, { type: 'declaration-preview', orderIds: [state.orders[0].id] }, false);
  assert.equal(state.declarations[0].identity.documentId, 'doc-2');
  assert.equal(state.declarations[0].identity.lastName, 'Ольга');
});

test('after a recipient is removed, a typed-address order does not get their passport', () => {
  let state = twoRecipients();
  const [first, second] = state.deliveryProfiles;
  state = applyAction(state, passport('doc-1', first.id, 'Каримова'), false);
  state = applyAction(state, passport('doc-2', second.id, 'Ольга'), false);
  state = applyAction(state, { type: 'delivery-profile-remove', id: second.id }, false);
  state = placeOrder(state, { delivery: { ...parents, address: 'ул. Бабура, 7' } });
  const order = state.orders[0];
  assert.equal(order.deliveryProfileId, undefined);
  let declared;
  try { declared = applyAction(state, { type: 'declaration-preview', orderIds: [order.id] }, false); } catch (error) { assert.match(error.message, /паспорт/); }
  if (declared) assert.notEqual(declared.declarations[0].identity.documentId, 'doc-2');
});
