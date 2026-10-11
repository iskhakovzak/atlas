import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractSharedLink, sharedLinkTarget, SHARED_TEXT_LIMIT } from '../lib/market/shared-link.ts';

test('share: the link is found inside the text a store app shares, without the punctuation after it', () => {
  assert.equal(extractSharedLink('Смотри, какие кроссовки https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr/CW2288-111 через Nike'), 'https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr/CW2288-111');
  assert.equal(extractSharedLink('Check this out: https://www.zara.com/uz/ru/item-p01234567.html?v1=1.'), 'https://www.zara.com/uz/ru/item-p01234567.html?v1=1');
  assert.equal(extractSharedLink('«https://www.amazon.com/dp/B0ABCDEF12»'), 'https://www.amazon.com/dp/B0ABCDEF12');
  assert.equal(extractSharedLink('(https://www.ebay.com/itm/1234567890)'), 'https://www.ebay.com/itm/1234567890');
});

test('share: the shared URL wins over the text and the title; nothing usable gives an empty link', () => {
  assert.equal(extractSharedLink('https://www.nike.com/t/a/1', 'text https://www.nike.com/t/b/2', 'title'), 'https://www.nike.com/t/a/1');
  assert.equal(extractSharedLink(null, 'Nike Dunk https://www.nike.com/t/b/2', 'Nike'), 'https://www.nike.com/t/b/2');
  assert.equal(extractSharedLink(undefined, 'Nike Dunk Low', 'Look at https://www.nike.com/t/c/3'), 'https://www.nike.com/t/c/3');
  assert.equal(extractSharedLink('', 'Just words', null), '');
  assert.equal(extractSharedLink('ftp://example.com/file', 'javascript:alert(1)', 'mailto:a@b.uz'), '');
  assert.equal(extractSharedLink('https://localhost/item'), '');
  assert.equal(extractSharedLink('https://user:pass@www.nike.com/t/a/1'), '');
});

test('share: a very long text is read only up to the limit', () => {
  assert.equal(extractSharedLink('x'.repeat(SHARED_TEXT_LIMIT) + ' https://www.nike.com/t/a/1'), '');
  assert.equal(extractSharedLink('x '.repeat(10) + 'https://www.nike.com/t/a/1'), 'https://www.nike.com/t/a/1');
});

test('share: the route sends the link to the order form, or the empty form with a note', () => {
  assert.equal(sharedLinkTarget('https://www.nike.com/t/a/1?x=1&y=2'), '/order-by-link?url=https%3A%2F%2Fwww.nike.com%2Ft%2Fa%2F1%3Fx%3D1%26y%3D2');
  assert.equal(sharedLinkTarget(''), '/order-by-link?shared=nolink');
});

test('share: the installed site and the Android app are registered as share targets', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.share_target, { action: '/share', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } });
  const android = await readFile(new URL('../mobile/android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(android, /android\.intent\.action\.SEND[\s\S]{0,200}android:mimeType="text\/plain"/);
  const activity = await readFile(new URL('../mobile/android/app/src/main/java/uz/atlasmarket/app/MainActivity.java', import.meta.url), 'utf8');
  assert.match(activity, /path\("\/share"\)/);
  const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8');
  assert.match(robots, /Disallow: \/share\r?\n/);
});
