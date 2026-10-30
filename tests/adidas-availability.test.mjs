import test from 'node:test';
import assert from 'node:assert/strict';
import {extractAdidasProduct} from '../lib/importer/extract.ts';

const url = 'https://www.adidas.com/us/shoe/IF4492.html';
const product = {id: 'IF4492', name: 'Shoe', orderable: 1};
const listing = value => ({raw: {itemList: {items: [{productId: 'IF4492', ...value}]}}});

test('adidas boolean false prevents ordering even if a size is listed', () => {
  const result = extractAdidasProduct(product, listing({orderable: false, availableSizes: ['8'], price: 40}), url);
  assert.equal(result.variants[0].available, false);
  assert.equal(result.variants[0].availabilityKnown, true);
});

test('an empty size list does not establish availability of an unsized variant', () => {
  const result = extractAdidasProduct(product, listing({orderable: 1, availableSizes: [], price: 40}), url);
  assert.equal(result.variants[0].availabilityKnown, false);
});
