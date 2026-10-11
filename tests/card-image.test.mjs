import test from 'node:test';
import assert from 'node:assert/strict';
import {cardImage} from '../lib/market/card-image.ts';

test('card photos ask resizing CDNs for a 600 px copy', () => {
  assert.equal(cardImage('https://m.media-amazon.com/images/I/31ol4e40VQL.jpg'), 'https://m.media-amazon.com/images/I/31ol4e40VQL._AC_SL600_.jpg');
  assert.equal(cardImage('https://m.media-amazon.com/images/I/21JpeF+qx-L._AC_SX679_.jpg'), 'https://m.media-amazon.com/images/I/21JpeF+qx-L._AC_SL600_.jpg');
  assert.equal(cardImage('https://cdn.shopify.com/s/files/1/0493/files/SKU-04.png?v=1764228261'), 'https://cdn.shopify.com/s/files/1/0493/files/SKU-04.png?v=1764228261&width=600');
  assert.equal(cardImage('https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/airtag?wid=890&hei=740&fmt=jpeg'), 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/airtag?wid=600&fmt=jpeg');
  assert.equal(cardImage('https://target.scene7.com/is/image/Target/GUEST_1?wid=1200&qlt=80'), 'https://target.scene7.com/is/image/Target/GUEST_1?wid=600&qlt=80');
});

test('other photos, a set Shopify width and broken links stay as they are', () => {
  for (const src of [
    'https://i5.walmartimages.com/seo/item.jpeg?odnHeight=640',
    'https://m.media-amazon.com/images/P/B0CGY4LZQ3.01.L.jpg',
    'https://static.zara.net/photos/2026/V/0/1/p/1234/567/800/2/w/750/1234567800_1_1_1.jpg?ts=1',
    'https://cdn.shopify.com/s/files/1/item.jpg?width=300',
    '/images/sneaker.webp',
    '',
  ]) assert.equal(cardImage(src), src);
});
