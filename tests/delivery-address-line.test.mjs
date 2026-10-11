import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryAddressLine } from '../lib/market/domain.ts';
import { shipAddressText } from '../lib/market/order-groups.ts';

const tashkent = { recipient: 'Atlas Operator', phone: '+998901234567', region: 'Ташкент', city: 'Ташкент', address: 'ул. Амира Темура, 10', postalCode: '100000', comment: '' };

test('address line: Tashkent the region and Tashkent the city are said once', () => {
  assert.equal(deliveryAddressLine(tashkent), 'Ташкент, ул. Амира Темура, 10, 100000');
  assert.equal(deliveryAddressLine({ ...tashkent, city: 'ташкент ' }), 'ташкент, ул. Амира Темура, 10, 100000');
  assert.equal(deliveryAddressLine({ ...tashkent, region: 'Самаркандская область', city: 'Самарканд' }), 'Самаркандская область, Самарканд, ул. Амира Темура, 10, 100000');
});

test('address line: an order saved before postal codes were required has none, and nothing dangles', () => {
  assert.equal(deliveryAddressLine({ region: 'Ташкент', city: 'Ташкент', address: 'Юнусабад 4' }), 'Ташкент, Юнусабад 4');
  assert.equal(deliveryAddressLine({ region: '', city: 'Ташкент', address: 'Юнусабад 4', postalCode: '' }), 'Ташкент, Юнусабад 4');
});

test('copied recipient: name, phone and the address line, ready to paste into a message', () => {
  assert.equal(shipAddressText(tashkent), 'Atlas Operator, +998901234567, Ташкент, ул. Амира Темура, 10, 100000');
  assert.equal(shipAddressText({ ...tashkent, phone: ' ', postalCode: undefined }), 'Atlas Operator, Ташкент, ул. Амира Темура, 10');
});
