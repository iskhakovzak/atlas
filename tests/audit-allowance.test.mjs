import test from 'node:test';
import assert from 'node:assert/strict';
import { blank, tariff } from '../lib/market/domain.ts';
import { allowanceMonth, cartCustomsEstimate, monthOf, monthlyAllowance, monthlyUsedFor } from '../lib/market/allowance.ts';
import { tashkentDay, tashkentMonth } from '../lib/market/world.ts';

// Audit #13: the allowance month is counted in Tashkent time (UTC+5, no DST), the same calendar as accounting,
// whatever the time zone of the process (the Worker runs in UTC). All timestamps below are UTC instants.
const order = (id, usd, extra = {}) => ({
  id, product: { id, name: id, brand: '', category: 'Другое', usd, weight: 1, image: '', variants: [''] }, variant: '', quantity: 1,
  quote: { merchandise: usd * 12000, fx: 12000 }, status: 1, payment: { status: 'paid' }, createdAt: Date.UTC(2026, 8, 10), history: [], cancelled: false, balanceUsed: 0, ...extra,
});
const profile = (id, recipient) => ({ id, label: id, primary: true, recipient, phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Навои, 1', postalCode: '100000', comment: '' });
// Delivered at 20:00 UTC on 30 September = 01:00 on 1 October in Tashkent.
const deliveredAt = Date.UTC(2026, 8, 30, 20, 0);
const delivered = order('D', 150, { deliveryProfileId: 'home', status: 5, history: [{ at: deliveredAt, text: 'Доставлен' }] });

test('Tashkent calendar helpers are UTC+5 and do not depend on the process time zone', () => {
  assert.equal(tashkentMonth(Date.UTC(2026, 8, 30, 18, 59)), '2026-09');
  assert.equal(tashkentMonth(Date.UTC(2026, 8, 30, 19, 0)), '2026-10');
  assert.equal(tashkentDay(Date.UTC(2026, 8, 30, 18, 59)), '2026-09-30');
  assert.equal(tashkentDay(Date.UTC(2026, 8, 30, 19, 0)), '2026-10-01');
  assert.equal(tashkentMonth(Date.UTC(2026, 11, 31, 19, 30)), '2027-01');
  assert.equal(monthOf, tashkentMonth, 'the exported monthOf keeps its name and is the Tashkent month');
  assert.equal(monthOf(Date.UTC(2026, 8, 30, 18, 59)), '2026-09');
});

test('an order delivered at 01:00 on 1 October in Tashkent counts in October', () => {
  assert.equal(allowanceMonth(delivered, Date.UTC(2026, 8, 30, 21, 30)), '2026-10');
  const state = { ...blank(), deliveryProfiles: [profile('home', 'Анна Каримова')], orders: [delivered] };
  assert.equal(monthlyUsedFor(state, 'Анна Каримова', 12000, Date.UTC(2026, 9, 15, 7)), 150);
  assert.equal(monthlyAllowance(state, 12000, Date.UTC(2026, 9, 15, 7))[0]?.usedUsd, 150);
  // Still 30 September in UTC, but September in Tashkent is over, so it no longer counts there.
  assert.equal(monthlyUsedFor(state, 'Анна Каримова', 12000, Date.UTC(2026, 8, 30, 12)), 0);
});

test('a delivery at 23:59 on 30 September in Tashkent stays in September', () => {
  const late = { ...delivered, history: [{ at: Date.UTC(2026, 8, 30, 18, 59), text: 'Доставлен' }] };
  assert.equal(allowanceMonth(late, Date.UTC(2026, 9, 15, 7)), '2026-09');
});

test('the cart customs estimate uses the Tashkent month and the Tashkent date for the customs rule', () => {
  const state = { ...blank(), deliveryProfiles: [profile('home', 'Анна Каримова')], orders: [delivered], cart: [{ id: 'c', product: { usd: 100 }, quantity: 1, quote: { total: 1_500_000 } }] };
  const estimate = cartCustomsEstimate(state, tariff, { profile: state.deliveryProfiles[0] }, undefined, Date.UTC(2026, 8, 30, 19, 30));
  assert.equal(estimate.month, '2026-10');
  assert.equal(estimate.atlasUsedUsd, 150);
  // 31 August 19:30 UTC is already 1 September in Tashkent: the rule effective 2026-09-01 (20%, $2/kg) applies.
  const pricing = { ...tariff, customsRate: undefined, customsMinimumPerKg: undefined };
  const september = cartCustomsEstimate({ ...state, orders: [] }, pricing, { profile: state.deliveryProfiles[0] }, undefined, Date.UTC(2026, 7, 31, 19, 30));
  assert.equal(september.month, '2026-09');
  assert.equal(september.rate, 0.2);
  assert.equal(september.minimumPerKg, 2);
  const august = cartCustomsEstimate({ ...state, orders: [] }, pricing, { profile: state.deliveryProfiles[0] }, undefined, Date.UTC(2026, 7, 31, 18, 30));
  assert.equal(august.month, '2026-08');
  assert.equal(august.rate, 0.3);
});
