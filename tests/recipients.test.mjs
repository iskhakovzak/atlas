import test from 'node:test';
import assert from 'node:assert/strict';
import { addToCart, blank, cartSignature, products } from '../lib/market/domain.ts';
import { applyAction } from '../lib/market/actions.ts';
import { customsVersion } from '../lib/market/world.ts';

const home = { recipient: 'Анна Каримова', phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Амира Темура, 1', postalCode: '100000', comment: '' };
const parents = { ...home, recipient: 'Ольга Каримова', address: 'ул. Навои, 15' };
const save = (state, extra) => applyAction(state, { type: 'delivery-profile-save', ...extra }, false);

test('saving without the new fields keeps the old behaviour: the newest recipient becomes the default', () => {
  let state = save(blank(), { value: home, label: 'Дом' });
  state = save(state, { value: parents, label: 'Родители' });
  assert.equal(state.deliveryProfiles.length, 2);
  assert.deepEqual(state.deliveryProfiles.filter(profile => profile.primary).map(profile => profile.label), ['Родители']);
  assert.equal(state.deliveryProfile.address, parents.address);
});

test('a recipient saved with primary=false keeps the current default; the first one is always default', () => {
  let state = save(blank(), { value: home, label: 'Дом', primary: false });
  assert.equal(state.deliveryProfiles[0].primary, true);
  state = save(state, { value: parents, label: 'Родители', primary: false });
  assert.deepEqual(state.deliveryProfiles.map(profile => [profile.label, profile.primary]), [['Дом', true], ['Родители', false]]);
  assert.equal(state.deliveryProfile.address, home.address);
});

test('editing by id changes that recipient in place and can move the default, but never removes it', () => {
  let state = save(blank(), { value: home, label: 'Дом' });
  state = save(state, { value: parents, label: 'Родители', primary: false });
  const id = state.deliveryProfiles.find(profile => profile.label === 'Родители').id;
  state = save(state, { id, value: { ...parents, phone: '+998 91 000 00 00' }, label: 'Мама', primary: true });
  assert.equal(state.deliveryProfiles.length, 2);
  assert.deepEqual(state.deliveryProfiles.map(profile => profile.label), ['Дом', 'Мама']);
  const edited = state.deliveryProfiles.find(profile => profile.id === id);
  assert.equal(edited.phone, '+998 91 000 00 00');
  assert.equal(edited.primary, true);
  assert.equal(state.deliveryProfiles.filter(profile => profile.primary).length, 1);
  assert.equal(state.deliveryProfile.phone, '+998 91 000 00 00');
  state = save(state, { id, value: edited, label: 'Мама', primary: false });
  assert.equal(state.deliveryProfiles.find(profile => profile.id === id).primary, true);
});

test('editing an unknown recipient is rejected', () => {
  assert.throws(() => save(blank(), { id: 'missing', value: home, label: 'Дом' }), /не найден/);
});

test('checkout can keep a typed address as a saved recipient and link the orders to it', () => {
  const cart = addToCart(blank(), products[0], products[0].variants[0], Date.now());
  const checkout = (state, extra) => applyAction(state, { type: 'checkout', key: 'save-recipient-' + Math.random(), signature: cartSignature(state.cart), useBalance: false, expectedCredit: 0, consentVersion: customsVersion, delivery: home, ...extra }, false);
  const saved = checkout(cart, { saveRecipientLabel: 'Дом' });
  assert.equal(saved.deliveryProfiles.length, 1);
  assert.equal(saved.deliveryProfiles[0].primary, true);
  assert.equal(saved.orders[0].deliveryProfileId, saved.deliveryProfiles[0].id);
  const plain = checkout(cart, {});
  assert.equal(plain.deliveryProfiles.length, 0);
  assert.equal(plain.orders[0].deliveryProfileId, undefined);
});

test('a new or edited recipient needs a six-digit postal code; making an older one the default does not', () => {
  assert.throws(() => save(blank(), { value: { ...home, postalCode: '' }, label: 'Дом' }), /индекс/);
  assert.throws(() => save(blank(), { value: { ...home, postalCode: '1000' }, label: 'Дом' }), /индекс/);
  const older = { ...home, postalCode: '', id: 'older', label: 'Родители', primary: false };
  let state = save(blank(), { value: home, label: 'Дом' });
  state = { ...state, deliveryProfiles: [...state.deliveryProfiles, older] };
  state = save(state, { id: 'older', value: { ...home, postalCode: '' }, label: 'Родители', primary: true });
  assert.equal(state.deliveryProfiles.find(profile => profile.id === 'older').primary, true);
  assert.throws(() => save(state, { id: 'older', value: { ...home, postalCode: '', phone: '+998 91 000 00 00' }, label: 'Родители' }), /индекс/);
});

test('checkout needs a postal code; a recipient saved without one gets it at checkout', () => {
  const cart = addToCart(blank(), products[0], products[0].variants[0], Date.now());
  const checkout = (state, extra) => applyAction(state, { type: 'checkout', key: 'postal-' + Math.random(), signature: cartSignature(state.cart), useBalance: false, expectedCredit: 0, consentVersion: customsVersion, ...extra }, false);
  assert.throws(() => checkout(cart, { delivery: { ...home, postalCode: '' } }), /индекс/);
  const older = { ...home, postalCode: '', id: 'older', label: 'Дом', primary: true };
  const withOlder = { ...cart, deliveryProfiles: [older], deliveryProfile: { ...home, postalCode: '' } };
  assert.throws(() => checkout(withOlder, { delivery: older, deliveryProfileId: 'older' }), /индекс/);
  const placed = checkout(withOlder, { delivery: older, deliveryProfileId: 'older', postalCode: '100011' });
  assert.equal(placed.orders.length, 1);
  assert.equal(placed.deliveryProfiles[0].postalCode, '100011');
  assert.equal(placed.orders[0].delivery.postalCode, '100011');
});

test('delivery is Tashkent-only for now: a new recipient or an order elsewhere is refused with err_78', () => {
  const samarkand = { ...home, region: 'Самаркандская область', city: 'Самарканд', postalCode: '140100' };
  assert.throws(() => save(blank(), { value: samarkand, label: 'Дача' }), (error) => error.code === 'err_78' && /Ташкент/.test(error.message));
  const cart = addToCart(blank(), products[0], products[0].variants[0], Date.now());
  const checkout = (state, extra) => applyAction(state, { type: 'checkout', key: 'tashkent-' + Math.random(), signature: cartSignature(state.cart), useBalance: false, expectedCredit: 0, consentVersion: customsVersion, ...extra }, false);
  assert.throws(() => checkout(cart, { delivery: samarkand }), (error) => error.code === 'err_78');
  // A recipient saved elsewhere before 10.10.2026 stays in the account and can still be made the default...
  const older = { ...samarkand, id: 'older', label: 'Дача', primary: false };
  let state = save(blank(), { value: home, label: 'Дом' });
  state = { ...state, deliveryProfiles: [...state.deliveryProfiles, older] };
  state = save(state, { id: 'older', value: samarkand, label: 'Дача', primary: true });
  assert.equal(state.deliveryProfiles.find(profile => profile.id === 'older').primary, true);
  // ...but an order cannot go there, and the Tashkent recipient still works.
  const withCart = { ...state, cart: cart.cart };
  assert.throws(() => checkout(withCart, { delivery: samarkand, deliveryProfileId: 'older' }), (error) => error.code === 'err_78');
  const homeId = state.deliveryProfiles.find(profile => profile.label === 'Дом').id;
  assert.equal(checkout(withCart, { delivery: home, deliveryProfileId: homeId }).orders.length, 1);
});
