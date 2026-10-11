import test from 'node:test';
import assert from 'node:assert/strict';
import { retryOriginal, sizedImage } from '../lib/market/image-size.ts';

test('Amazon: only the size number shrinks, the AC prefix stays, bare and smaller files are untouched', () => {
  assert.equal(sizedImage('https://m.media-amazon.com/images/I/61OzkDt-WjL._AC_SL1500_.jpg', 600), 'https://m.media-amazon.com/images/I/61OzkDt-WjL._AC_SL600_.jpg');
  assert.equal(sizedImage('https://m.media-amazon.com/images/I/71v686sxRAL._SL1500_.jpg', 200), 'https://m.media-amazon.com/images/I/71v686sxRAL._SL200_.jpg');
  assert.equal(sizedImage('https://m.media-amazon.com/images/I/61OzkDt-WjL._AC_UX679_.jpg', 600), 'https://m.media-amazon.com/images/I/61OzkDt-WjL._AC_UX600_.jpg');
  assert.equal(sizedImage('https://m.media-amazon.com/images/I/31ol4e40VQL.jpg', 600), 'https://m.media-amazon.com/images/I/31ol4e40VQL.jpg');
  assert.equal(sizedImage('https://m.media-amazon.com/images/I/61OzkDt-WjL._AC_SL500_.jpg', 600), 'https://m.media-amazon.com/images/I/61OzkDt-WjL._AC_SL500_.jpg');
  assert.equal(sizedImage('https://m.media-amazon.com/images/P/B01LZTBKBG.01.L.jpg', 200), 'https://m.media-amazon.com/images/P/B01LZTBKBG.01.L.jpg');
});

test('eBay picks the next fixed size, never a larger one than saved', () => {
  assert.equal(sizedImage('https://i.ebayimg.com/images/g/aUMAAeSwKYJqrW9s/s-l1600.webp', 600), 'https://i.ebayimg.com/images/g/aUMAAeSwKYJqrW9s/s-l640.webp');
  assert.equal(sizedImage('https://i.ebayimg.com/images/g/aUMAAeSwKYJqrW9s/s-l500.webp', 600), 'https://i.ebayimg.com/images/g/aUMAAeSwKYJqrW9s/s-l500.webp');
});

test('Nike swaps its named transformation for a width and keeps the automatic format', () => {
  assert.equal(sizedImage('https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto%2Cu_x/abc/CORTEZ.png', 600), 'https://static.nike.com/a/images/w_600/f_auto%2Cu_x/abc/CORTEZ.png');
  assert.equal(sizedImage('https://static.nike.com/a/images/t_default/u_x,c_scale/abc/ZOOM.png', 600), 'https://static.nike.com/a/images/w_600,f_auto/u_x,c_scale/abc/ZOOM.png');
});

test('Scene7, Shopify and Wolverine sizes; the height keeps its proportion', () => {
  assert.equal(sizedImage('https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/airtag?wid=890&hei=740&fmt=jpeg', 600), 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/airtag?wid=600&hei=499&fmt=jpeg');
  assert.equal(sizedImage('https://target.scene7.com/is/image/Target/GUEST_1?wid=800&hei=800&qlt=80', 200), 'https://target.scene7.com/is/image/Target/GUEST_1?wid=200&hei=200&qlt=80');
  assert.equal(sizedImage('https://cdn.shopify.com/s/files/1/a.png?v=1', 600), 'https://cdn.shopify.com/s/files/1/a.png?v=1&width=600');
  assert.equal(sizedImage('https://thekit.wolverineworldwide.com/match/media_lookup/X/?preset=dw-large', 600), 'https://thekit.wolverineworldwide.com/match/media_lookup/X/?preset=dw-medium');
});

test('unknown hosts, local files and broken addresses pass through unchanged', () => {
  for (const src of ['/images/sneaker.webp', 'https://i5.walmartimages.com/seo/a.jpeg', 'https://www.brooksrunning.com/on/demandware.static/-/x/a.png', 'http://m.media-amazon.com/images/I/a._SL1500_.jpg', 'https://', '']) {
    assert.equal(sizedImage(src, 600), src);
  }
});

test('demo photos saved as .jpg are shown from the lighter .webp copy', () => {
  assert.equal(sizedImage('/images/sneaker.jpg', 240), '/images/sneaker.webp');
  assert.equal(sizedImage('/images/headphones.jpg', 600), '/images/headphones.webp');
  assert.equal(sizedImage('/images/other.jpg', 600), '/images/other.jpg');
});

test('retryOriginal tries the store address once per address, then gives up', () => {
  const attrs = { src: 'https://m.media-amazon.com/images/I/a._SL600_.jpg' };
  const image = { dataset: {}, getAttribute: (name) => attrs[name], set src(value) { attrs.src = value; }, get src() { return attrs.src; } };
  const original = 'https://m.media-amazon.com/images/I/a._SL1500_.jpg';
  assert.equal(retryOriginal(image, original), true);
  assert.equal(attrs.src, original);
  assert.equal(retryOriginal(image, original), false);
  attrs.src = 'https://m.media-amazon.com/images/I/b._SL600_.jpg';
  assert.equal(retryOriginal(image, 'https://m.media-amazon.com/images/I/b._SL1500_.jpg'), true);
});
