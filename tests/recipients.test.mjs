import test from 'node:test';
import assert from 'node:assert/strict';
import { addToCart, blank, cartSignature, products } from '../lib/market/domain.ts';
import { applyAction } from '../lib/market/actions.ts';
import { customsVersion } from '../lib/market/world.ts';

const home = { recipient: 'Анна Каримова', phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Амира Темура, 1', postalCode: '', comment: '' };
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
