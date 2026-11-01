import test from 'node:test';
import assert from 'node:assert/strict';
import { isChoosingOption, variantSummary } from '../lib/market/variant-label.ts';

const ebayOptions = [{ name: 'Size Type', value: 'Regular' }, { name: 'Department', value: 'men' }, { name: 'Type', value: 'Pants' }, { name: 'Style', value: 'Pants' }, { name: 'Material', value: 'see description' }, { name: 'Size', value: '2XL' }, { name: 'Brand', value: 'adidas' }, { name: 'Inseam', value: 'Not Available' }, { name: 'MPN', value: 'O7865' }, { name: 'Color', value: 'Black / White' }];

test('the owner’s cart line: only colour, size type and size, value only, in picker order', () => {
  const label = 'Size Type: Regular · Department: men · Type: Pants · Style: Pants · Material: see description · Size: 2XL · Brand: adidas · Inseam: Not Available · MPN: O7865';
  assert.equal(variantSummary(label, ebayOptions), 'Black / White · Regular · 2XL');
  assert.equal(variantSummary(label), 'Regular · 2XL', 'without the options: from the label alone');
});

test('a label cut short and followed by eBay item IDs is rebuilt from the options', () => {
  assert.equal(variantSummary('Size Type: Regular · Size: 2XL · Color: Black / Whi · 156826584434 / 459450658576 / adidas_official', ebayOptions), 'Black / White · Regular · 2XL');
});

test('plain labels stay as they are (Zara, Amazon, Nike)', () => {
  assert.equal(variantSummary('Beige / White · M', [{ name: 'Color', value: 'Beige / White' }]), 'Beige / White · M');
  assert.equal(variantSummary('128 GB'), '128 GB');
  assert.equal(variantSummary(''), '');
});

test('descriptive specifics and placeholders are never choices', () => {
  for (const [name, value] of [['Department', 'men'], ['Brand', 'adidas'], ['MPN', 'O7865'], ['Material', 'Cotton'], ['Inseam', 'Not Available'], ['Size', 'see description']]) assert.equal(isChoosingOption(name, value), false, name);
  for (const [name, value] of [['US Shoe Size', '9.5'], ['Width', 'Wide'], ['Inseam', '32'], ['Colour', 'Red'], ['Size Type', 'Big & Tall']]) assert.equal(isChoosingOption(name, value), true, name);
});
