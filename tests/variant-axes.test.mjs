import test from 'node:test';
import assert from 'node:assert/strict';
import { axisLabel, axisOptionState, pickAxis, picksOf, priceRange, resolveVariant, variantAxes, withOptionAxes } from '../lib/market/variant-axes.ts';

// The owner's example (eBay adidas Essentials Fleece pants, 1 November 2026): four combinations only.
const pant = (type, size, color, price, id) => ({
  id, label: `Size Type: ${type} · Size: ${size} · Color: ${color}`, available: true, availabilityKnown: true, price, quantity: 9,
  options: [{ name: 'Size Type', value: type }, { name: 'Size', value: size }, { name: 'Color', value: color }, { name: 'Brand', value: 'adidas' }, { name: 'Inseam', value: 'Not Available' }, { name: 'MPN', value: 'O7865' }, { name: 'UPC', value: 'upc-' + id }],
});
const pants = [pant('Regular', '2XL', 'Black / White', 13, 1), pant('Big & Tall', '3XLT', 'Black / White', 13, 2), pant('Regular', '2XL', 'Dark Grey Heather / Black', 14, 3), pant('Big & Tall', '6XL', 'Black / White', 13, 4)];

test('a sparse eBay matrix splits into colour, size type and size; constant specifics and the UPC are dropped', () => {
  const axes = variantAxes(pants);
  assert.deepEqual(axes.map(axis => [axis.name, axis.kind]), [['Color', 'color'], ['Size Type', 'fit'], ['Size', 'size']]);
  assert.deepEqual(axes[2].values, ['2XL', '3XLT', '6XL']);
});

test('colour and size named only as options fill the fields, so the colour tiles and size chips apply', () => {
  const filled = withOptionAxes(pants);
  assert.equal(filled[2].color, 'Dark Grey Heather / Black');
  assert.equal(filled[1].size, '3XLT');
  assert.equal(filled[1].sizeLabel, 'Size');
  assert.equal(filled[0].label, pants[0].label, 'the label (the cart key) stays the store’s');
  const zara = [{ label: 'Black · S', color: 'Black', size: 'S', available: true }];
  assert.equal(withOptionAxes(zara), zara, 'nothing to fill: the same list');
});

test('within one colour: a size type leaves only its sizes open, and an axis with one possible value takes it', () => {
  const black = withOptionAxes(pants).filter(item => item.color === 'Black / White');
  const axes = variantAxes(black);
  assert.deepEqual(axes.map(axis => axis.name), ['Size Type', 'Size']);
  let picks = pickAxis(black, axes, {}, 'Size Type', 'Regular');
  assert.deepEqual(picks, { 'Size Type': 'Regular', Size: '2XL' }, 'Regular has one size: picked for the customer');
  assert.equal(resolveVariant(black, axes, picks)?.id, 1);
  assert.equal(axisOptionState(black, axes, picks, 'Size', '3XLT'), 'out');
  assert.equal(axisOptionState(black, axes, picks, 'Size Type', 'Big & Tall'), 'open', 'an earlier axis is never closed by a later pick');
  picks = pickAxis(black, axes, picks, 'Size Type', 'Big & Tall');
  assert.deepEqual(picks, { 'Size Type': 'Big & Tall' }, 'the conflicting 2XL is reset; two sizes remain to choose');
  assert.equal(resolveVariant(black, axes, picks), undefined);
  picks = pickAxis(black, axes, picks, 'Size', '6XL');
  assert.equal(resolveVariant(black, axes, picks)?.id, 4);
  assert.deepEqual(pickAxis(black, axes, picks, 'Size', '6XL'), { 'Size Type': 'Big & Tall' }, 'tapping the chosen value clears it');
});

test('sold-out options are closed, never resolved first', () => {
  const items = [
    { label: 'Red · S', color: 'Red', size: 'S', available: false, availabilityKnown: true, options: [{ name: 'Width', value: 'Wide' }] },
    { label: 'Red · M', color: 'Red', size: 'M', available: true, availabilityKnown: true, options: [{ name: 'Width', value: 'Wide' }] },
    { label: 'Red · M narrow', color: 'Red', size: 'M', available: true, availabilityKnown: true, options: [{ name: 'Width', value: 'Narrow' }] },
  ];
  const axes = variantAxes(items);
  assert.deepEqual(axes.map(axis => axis.name), ['Size', 'Width']);
  assert.equal(axisOptionState(items, axes, {}, 'Size', 'S'), 'out');
  assert.equal(axisOptionState(items, axes, { Size: 'M' }, 'Width', 'Narrow'), 'open');
  assert.equal(resolveVariant(items, axes, { Size: 'M', Width: 'Wide' })?.label, 'Red · M');
});

test('one axis only: sizes, sorted, no other rows', () => {
  const items = ['XL', 'S', 'M'].map(size => ({ label: size, size, sizeLabel: 'Size', available: true }));
  const axes = variantAxes(items);
  assert.deepEqual(axes, [{ name: 'Size', kind: 'size', values: ['S', 'M', 'XL'] }]);
  assert.equal(resolveVariant(items, axes, pickAxis(items, axes, {}, 'Size', 'M'))?.label, 'M');
});

test('Zara-like colour and size fields: two axes, the picks of an option round-trip', () => {
  const items = [];
  for (const color of ['Black', 'Ecru']) for (const size of ['XS', 'S', 'M']) items.push({ label: `${color} · ${size}`, color, size, sizeLabel: 'Size', price: color === 'Ecru' ? 229.9 : 199.9, available: !(color === 'Ecru' && size === 'XS'), availabilityKnown: true });
  const axes = variantAxes(items);
  assert.deepEqual(axes.map(axis => axis.name), ['Color', 'Size']);
  assert.deepEqual(picksOf(items[4], axes), { Color: 'Ecru', Size: 'S' });
  assert.equal(axisOptionState(items, axes, { Color: 'Ecru' }, 'Size', 'XS'), 'out');
  assert.deepEqual(priceRange(items, axes, {}), { min: 199.9, max: 229.9 });
  assert.deepEqual(priceRange(items, axes, { Color: 'Ecru' }), { min: 229.9, max: 229.9 });
});

test('Amazon options without their own price still resolve (the page loads that price on choice)', () => {
  const items = ['Black', 'Navy'].flatMap((color, i) => ['8', '9'].map(size => ({ label: `${color} · ${size}`, color, size, sourceUrl: `https://www.amazon.com/dp/B0${i}${size}`, available: true, availabilityKnown: i === 0, price: i === 0 ? 34.99 : undefined })));
  const axes = variantAxes(items);
  const picks = pickAxis(items, axes, pickAxis(items, axes, {}, 'Color', 'Navy'), 'Size', '9');
  assert.equal(resolveVariant(items, axes, picks)?.price, undefined);
  assert.equal(resolveVariant(items, axes, picks)?.label, 'Navy · 9');
  assert.deepEqual(priceRange(items, axes, { Color: 'Navy' }), {}, 'no invented price');
});

test('a sparse size-type list keeps the size, not the size type it implies', () => {
  const items = [pant('Regular', '2XL', 'Black', 13, 1), pant('Big & Tall', '3XLT', 'Black', 13, 2)];
  assert.deepEqual(variantAxes(items).map(axis => axis.name), ['Size']);
});

test('axis names in the page language; unknown names stay as the store wrote them', () => {
  assert.deepEqual(axisLabel('Size Type'), ['Тип размера', 'O‘lcham turi', 'Size type']);
  assert.deepEqual(axisLabel('Colour'), ['Цвет', 'Rang', 'Colour']);
  assert.equal(axisLabel('Inseam')[0], 'Длина по шаговому шву');
  assert.deepEqual(axisLabel('Heel Height'), ['Heel Height', 'Heel Height', 'Heel Height']);
});
