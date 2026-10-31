import test from 'node:test';
import assert from 'node:assert/strict';
import {extractAdidasProduct} from '../lib/importer/extract.ts';

const url = 'https://www.adidas.com/us/adizero-dropset-pro-training-shoes/LA6280.html?clickId=x';
const product = (id, color, salePrice) => ({id, name: 'ADIZERO Dropset Pro Training Shoes', category: 'Shoes', color, price: 150, salePrice, orderable: true,
  images: [{src: `https://assets.adidas.com/images/w_500/${id}_01.jpg`}], image: {src: `https://assets.adidas.com/images/w_280/${id}.jpg`}});
// The listing has another colour's card, which names this article among the model's colours.
const listing = {raw: {itemList: {items: [{productId: 'KH6710', displayName: 'ADIZERO Dropset Pro Training Shoes', availableSizes: ['11', '7', 'hidden', '9.5'], colorVariations: ['LA6280', 'KH6710']}]}}};

test('adidas: sizes from the model card, the other colours from their own records', () => {
  const result = extractAdidasProduct(product('LA6280', 'Cloud White / Royal Blue', 120), listing, url, [product('KH6710', 'Core Black / Cloud White', 110)]);
  assert.equal(result.variantScope, 'group');
  assert.equal(result.selectedVariantColor, 'Cloud White / Royal Blue');
  const own = result.variants.filter(v => v.colorId === 'LA6280');
  assert.deepEqual(own.map(v => v.size), ['7', '9.5', '11']);
  assert.ok(own.every(v => v.price === 120 && v.availabilityKnown === false));
  const other = result.variants.filter(v => v.colorId === 'KH6710');
  assert.equal(other.length, 3);
  assert.equal(other[0].price, 110);
  assert.equal(other[0].sourceUrl, 'https://www.adidas.com/us/adizero-dropset-pro-training-shoes/KH6710.html');
  assert.match(other[0].image, /w_500\/KH6710_01/);
  assert.deepEqual(result.colorwayImages.map(g => g.colorId), ['LA6280', 'KH6710']);
});

test('adidas: without the listing card it stays one colour', () => {
  const result = extractAdidasProduct(product('LA6280', 'Cloud White / Royal Blue', 120), undefined, url);
  assert.equal(result.variantScope, 'color');
  assert.equal(result.variants.length, 1);
});
