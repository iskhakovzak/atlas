import test from 'node:test';
import assert from 'node:assert/strict';
import {readImportCachePreview} from '../lib/market/import-cache-preview.ts';

test('cache preview sends a cache-only request and exposes no price or stock', async () => {
  const url = 'https://example.com/item';
  const preview = await readImportCachePreview(url, async (path, init) => {
    assert.equal(path, '/api/import');
    assert.deepEqual(JSON.parse(init.body), {url, cacheOnly: true});
    return Response.json({cached: true, title: 'Shoe', brand: 'Brand', image: 'https://example.com/image.jpg', price: 12, stock: 'in-stock'});
  });
  assert.deepEqual(preview, {title: 'Shoe', brand: 'Brand', images: ['https://example.com/image.jpg']});
});

test('misses, failures and non-cached responses never become previews', async () => {
  for (const fetcher of [
    async () => new Response(null, {status: 204}),
    async () => new Response(null, {status: 500}),
    async () => Response.json({title: 'Unconfirmed'}),
    async () => { throw new Error('offline'); },
  ]) assert.equal(await readImportCachePreview('https://example.com/item', fetcher), null);
});
