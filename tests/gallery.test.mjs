import test from 'node:test';
import assert from 'node:assert/strict';
import { gallerySwipeStep } from '../lib/market/gallery.ts';
import { applyAction } from '../lib/market/actions.ts';
import { blank, products, parseState } from '../lib/market/domain.ts';

test('gallery swipes require a deliberate horizontal gesture', () => {
  assert.equal(gallerySwipeStep(-100, 5, 360), 1);
  assert.equal(gallerySwipeStep(100, 5, 360), -1);
  for (const args of [[-15, 0, 360], [-50, 100, 360], [0, 100, 360], [NaN, 0, 360], [100, 0, 0]])
    assert.equal(gallerySwipeStep(...args), 0);
});

test('cart gallery preserves safe images and rejects unsafe customer URLs', () => {
  const product = { ...products[0], id: 'gallery-fixture', country: 'США', shippingKnown: true, sourceUrl: 'https://www.nike.com/product', sourcePrice: 20, sourceCurrency: 'USD', sourceShipping: 10, sourceShippingCurrency: 'USD', boxedWeight: 1, sourceManuallyConfirmed: true, image: 'https://static.nike.com/photo.jpg', sourceImages: ['https://static.nike.com/photo.jpg', 'https://static.nike.com/back.jpg'] };
  const next = applyAction(blank(), { type: 'cart-add', product, variant: product.variants[0] }, false);
  assert.deepEqual(next.cart[0].product.sourceImages, product.sourceImages);
  assert.equal(parseState(JSON.stringify(next)).cart[0].product.sourceImages.length, 2);
  const old = structuredClone(next);
  delete old.cart[0].product.sourceImages;
  assert.equal(parseState(JSON.stringify(old)).cart.length, 1);
  for (const unsafe of ['http://static.nike.com/p.jpg', 'https://127.0.0.1/p.jpg', 'javascript:alert(1)'])
    assert.throws(() => applyAction(blank(), { type: 'cart-add', product: { ...product, sourceImages: [unsafe] }, variant: product.variants[0] }, false), /изображение/);
});
