import test from 'node:test';
import assert from 'node:assert/strict';
import { blank } from '../lib/market/domain.ts';
import { monthlyAllowance, monthlyUsedFor, recipientKey } from '../lib/market/allowance.ts';

const now = new Date(2026, 9, 15, 12).getTime();
const order = (id, usd, extra = {}) => ({
  id, product: { id, name: id, brand: '', category: 'Другое', usd, weight: 1, image: '', variants: [''] }, variant: '', quantity: 1,
  quote: { merchandise: usd * 12000, fx: 12000 }, status: 0, createdAt: new Date(2026, 9, 3).getTime(), history: [], cancelled: false, balanceUsed: 0, ...extra,
});

test('the monthly allowance is counted per person, by name, across addresses', () => {
  const state = {
    ...blank(),
    deliveryProfiles: [
      { id: 'home', label: 'Дом', primary: true, recipient: 'Анна Каримова', phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Навои, 1', postalCode: '', comment: '' },
      { id: 'work', label: 'Работа', primary: false, recipient: 'анна  каримова', phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Бабура, 2', postalCode: '', comment: '' },
    ],
    orders: [
      order('A', 120, { deliveryProfileId: 'home' }),
      order('B', 50, { deliveryProfileId: 'work' }),
      order('C', 70, { delivery: { recipient: 'Ольга Каримова', phone: '', region: '', city: '', address: '', postalCode: '', comment: '' } }),
      order('D', 500, { cancelled: true, deliveryProfileId: 'home' }),
      order('E', 300, { deliveryProfileId: 'home', createdAt: new Date(2026, 8, 30).getTime() }),
    ],
  };
  const groups = monthlyAllowance(state, 12000, now);
  assert.deepEqual(groups.map(group => [group.name, group.usedUsd, group.orders]), [['Анна Каримова', 170, 2], ['Ольга Каримова', 70, 1]]);
  assert.equal(monthlyUsedFor(state, 'АННА КАРИМОВА', 12000, now), 170);
  assert.equal(monthlyUsedFor(state, 'Кто-то ещё', 12000, now), 0);
  assert.equal(recipientKey('  '), 'unknown');
});
