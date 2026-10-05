import test from 'node:test';
import assert from 'node:assert/strict';
import { blank, tariff } from '../lib/market/domain.ts';
import { allowanceMonth, cartCustomsEstimate, countsTowardAllowance, monthlyAllowance, monthlyUsedFor, recipientKey } from '../lib/market/allowance.ts';

const now = new Date(2026, 9, 15, 12).getTime();
// A bought (status 1), paid order created this month unless stated otherwise.
const order = (id, usd, extra = {}) => ({
  id, product: { id, name: id, brand: '', category: 'Другое', usd, weight: 1, image: '', variants: [''] }, variant: '', quantity: 1,
  quote: { merchandise: usd * 12000, fx: 12000 }, status: 1, payment: { status: 'paid' }, createdAt: new Date(2026, 9, 3).getTime(), history: [], cancelled: false, balanceUsed: 0, ...extra,
});
const profile = (id, recipient, extra = {}) => ({ id, label: id, primary: false, recipient, phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Навои, 1', postalCode: '', comment: '', ...extra });

test('the monthly allowance is counted per person, by name, across addresses, for bought and paid orders only', () => {
  const state = {
    ...blank(),
    deliveryProfiles: [profile('home', 'Анна Каримова', { primary: true }), profile('work', 'анна  каримова')],
    orders: [
      order('A', 120, { deliveryProfileId: 'home' }),
      order('B', 50, { deliveryProfileId: 'work' }),
      order('C', 70, { delivery: { recipient: 'Ольга Каримова', phone: '', region: '', city: '', address: '', postalCode: '', comment: '' } }),
      order('D', 500, { cancelled: true, deliveryProfileId: 'home' }),
      order('E', 300, { deliveryProfileId: 'home', status: 0 }),
      order('F', 400, { deliveryProfileId: 'home', payment: { status: 'pending' } }),
      // Delivered (imported) in September: that month's allowance, not this one.
      order('G', 300, { deliveryProfileId: 'home', status: 5, createdAt: new Date(2026, 8, 2).getTime(), history: [{ at: new Date(2026, 8, 28).getTime(), text: 'Доставлен' }] }),
    ],
  };
  assert.deepEqual(monthlyAllowance(state, 12000, now).map(group => [group.name, group.usedUsd, group.orders]), [['Анна Каримова', 170, 2], ['Ольга Каримова', 70, 1]]);
  assert.equal(monthlyUsedFor(state, 'АННА КАРИМОВА', 12000, now), 170);
  assert.equal(monthlyUsedFor(state, 'Кто-то ещё', 12000, now), 0);
  assert.equal(recipientKey('  '), 'unknown');
  assert.deepEqual(['A', 'D', 'E', 'F'].map(id => countsTowardAllowance(state.orders.find(o => o.id === id))), [true, false, false, false]);
  assert.equal(allowanceMonth(state.orders.find(o => o.id === 'G'), now), '2026-09');
  // Bought in September but still on its way: imported this month at the earliest.
  assert.equal(allowanceMonth(order('H', 1, { createdAt: new Date(2026, 8, 20).getTime() }), now), '2026-10');
});

test('two people with the same name are told apart by their passports', () => {
  const state = {
    ...blank(),
    deliveryProfiles: [profile('a', 'Ali Valiyev'), profile('b', 'Ali Valiyev')],
    identityProfiles: [
      { documentId: 'd1', recipientProfileId: 'a', firstName: 'Ali', lastName: 'Valiyev', birthDate: '1990-01-01', passportMasked: 'AA ••• 1111', nationality: 'UZ', confirmedAt: 1 },
      { documentId: 'd2', recipientProfileId: 'b', firstName: 'Ali', lastName: 'Valiyev', birthDate: '1980-01-01', passportMasked: 'AB ••• 2222', nationality: 'UZ', confirmedAt: 1 },
    ],
    orders: [order('A', 150, { deliveryProfileId: 'a' })],
  };
  assert.equal(cartCustomsEstimate(state, tariff, { profile: state.deliveryProfiles[0] }, undefined, now).atlasUsedUsd, 150);
  assert.equal(cartCustomsEstimate(state, tariff, { profile: state.deliveryProfiles[1] }, undefined, now).atlasUsedUsd, 0);
});

test('customs is charged on the part above the allowance left; outside use and the help fee are separate', () => {
  const cart = [{ id: 'c', product: { usd: 1100 }, quantity: 1 }];
  const state = { ...blank(), cart, deliveryProfiles: [profile('a', 'Zarina Karimova')] };
  const who = { profile: state.deliveryProfiles[0] };
  const base = cartCustomsEstimate(state, tariff, who, undefined, now);
  assert.deepEqual([base.allowanceUsd, base.dutiableUsd, base.estimateUsd], [200, 900, 180], '$1 100 with the full $200 left: $900 is dutiable');
  const outside = cartCustomsEstimate(state, tariff, who, { outsideUsed: true, outsideUsd: 150, help: false }, now);
  assert.equal(outside.dutiableUsd, 1050);
  const unknown = cartCustomsEstimate(state, tariff, who, { outsideUsed: true, help: false }, now);
  assert.deepEqual([unknown.outsideUnknown, unknown.dutiableUsd], [true, 1100], 'used elsewhere without an amount: the allowance counts as used up');
  const help = cartCustomsEstimate(state, tariff, who, { outsideUsed: false, help: true }, now);
  assert.deepEqual([help.helpRequested, help.helpFeeUsd], [true, 33], 'Atlas help: 3% of the $1 100 goods value');
  const small = cartCustomsEstimate({ ...state, cart: [{ id: 'c', product: { usd: 120 }, quantity: 1 }] }, tariff, who, { outsideUsed: false, help: true }, now);
  assert.deepEqual([small.dutiableUsd, small.estimateUsd, small.helpRequested], [0, 0, undefined], 'nothing dutiable, nothing to help with');
});
