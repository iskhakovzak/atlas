import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSizes, letterSizes } from '../lib/market/size-order.ts';
import { compareSizes as catalogCompareSizes } from '../lib/market/catalog-query.ts';

const sorted = (list) => [...list].sort(compareSizes);

test('Nike hoodie sizes go from the smallest up, plain sizes before the Tall fit', () => {
  // The order the link-order page showed on 14 October 2026 (alphabetical).
  const nike = ['2XL', '2XL Tall', '3XL', '3XL Tall', '4XL', '4XL Tall', 'L', 'L Tall', 'M', 'M Tall', 'S', 'S Tall', 'XL', 'XL Tall', 'XS', 'XXS', '4XL Tall'];
  assert.deepEqual(sorted([...new Set(nike)]), [
    'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL',
    'S Tall', 'M Tall', 'L Tall', 'XL Tall', '2XL Tall', '3XL Tall', '4XL Tall',
  ]);
});

test('XXL and 2XL (and the like) are the same step of the scale', () => {
  assert.deepEqual(sorted(['XXXL', 'XXL', 'XL', 'L']), ['L', 'XL', 'XXL', 'XXXL']);
  assert.deepEqual(sorted(['3XL', 'XXL', '2XS', 'XS', 'XXXS', 'M']), ['XXXS', '2XS', 'XS', 'M', 'XXL', '3XL']);
  assert.equal(Math.sign(compareSizes('XXL', '3XL')), -1);
  assert.equal(Math.sign(compareSizes('XXXXL', '5XL')), -1);
});

test('shoe sizes by value, US prefix and decimal comma ignored', () => {
  assert.deepEqual(sorted(['10', '7.5', '13', '7', '9', '8.5', '11', '12', '8']), ['7', '7.5', '8', '8.5', '9', '10', '11', '12', '13']);
  assert.deepEqual(sorted(['US 10', '9,5', 'US 9']), ['US 9', '9,5', 'US 10']);
});

test('jeans and labelled sizes in natural order', () => {
  assert.deepEqual(sorted(['32x30', '30x32', '30x30', '28x30']), ['28x30', '30x30', '30x32', '32x30']);
  assert.deepEqual(sorted(['EU 10', 'EU 9', 'EU 11']), ['EU 9', 'EU 10', 'EU 11']);
});

test('lower case and extra spaces sort like the upper-case sizes', () => {
  assert.deepEqual(sorted(['l', 's', ' m ', 'xs']), ['xs', 's', ' m ', 'l']);
  assert.deepEqual(sorted(['M  Tall', 'm', 'S tall']), ['m', 'S tall', 'M  Tall']);
});

test('a mixed list: numbers, then letters, then everything else; brackets stay with their size', () => {
  assert.deepEqual(sorted(['One size', 'L', '10', 'XS', '9.5', 'M']), ['9.5', '10', 'XS', 'M', 'L', 'One size']);
  assert.deepEqual(sorted(['M (8-10)', 'XS (4-5)', 'S (6-7)', 'L (12-14)']), ['XS (4-5)', 'S (6-7)', 'M (8-10)', 'L (12-14)']);
  // A stable answer for equal sizes in different spellings.
  assert.notEqual(compareSizes('XXL', '2XL'), 0);
  assert.equal(compareSizes('M', 'M'), 0);
});

test('the catalog keeps using the same comparator and the same letter list', () => {
  assert.equal(catalogCompareSizes, compareSizes);
  assert.ok(letterSizes.includes('XXL') && letterSizes.includes('2XL'));
});
