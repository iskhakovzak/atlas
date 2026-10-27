import test from 'node:test';
import assert from 'node:assert/strict';
import { optionStock } from '../lib/market/link-order-stock.ts';

const onSale = (label, extra = {}) => ({ label, available: true, availabilityKnown: true, ...extra });
const gone = (label, extra = {}) => ({ label, available: false, availabilityKnown: true, ...extra });

test('no listed options leave the choice to the customer', () => {
  assert.equal(optionStock([]), 'none');
});

test('one confirmed option on sale keeps the choice open', () => {
  assert.equal(optionStock([gone('S'), gone('M'), onSale('2XL Tall')]), 'open');
  assert.equal(optionStock([onSale('One size')]), 'open');
  assert.equal(optionStock([onSale('S', { quantity: 3 }), gone('M')]), 'open');
});

test('every option sold out by the store is "sold out", not a step to choose in', () => {
  assert.equal(optionStock([gone('S'), gone('M'), gone('L')]), 'sold-out');
  // A stock count of 0 is the store's own answer even where availability itself was not stated.
  assert.equal(optionStock([onSale('S', { quantity: 0 }), { label: 'M', available: true, quantity: 0 }]), 'sold-out');
  assert.equal(optionStock([gone('Only option')]), 'sold-out');
});

test('options without any stock answer can be chosen, subject to stock (27 October 2026)', () => {
  assert.equal(optionStock([gone('S'), { label: 'M', available: true, availabilityKnown: false }]), 'open');
  assert.equal(optionStock([{ label: 'S', available: false, availabilityKnown: false }]), 'open');
  // A legacy option says nothing about stock either way: it follows its own flag.
  assert.equal(optionStock([{ label: 'S', available: false }]), 'unconfirmed');
});
