import test from 'node:test';
import assert from 'node:assert/strict';
import {runRefresh} from '../workers/catalog-refresh/src/index.ts';
import {isAuthorizedCatalogRefresh} from '../lib/market/catalog-refresh-auth.ts';

test('cron worker signs the protected Atlas refresh endpoint without exposing credentials', async () => {
  let captured;
  const response = await runRefresh({
    ATLAS_SITE_URL: 'https://atlas.example.test/',
    ATLAS_CATALOG_REFRESH_SECRET: 'test-secret',
  }, async (url, init) => {
    captured = {url, init};
    return new Response(JSON.stringify({ok: true}), {status: 200, headers: {'content-type': 'application/json'}});
  });
  assert.equal(response, JSON.stringify({ok: true}));
  assert.equal(captured.url, 'https://atlas.example.test/api/internal/catalog-refresh');
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.init.headers.Cookie, undefined);
  const request = new Request(captured.url, captured.init);
  assert.equal(await isAuthorizedCatalogRefresh(request, 'test-secret', Number(captured.init.headers['x-atlas-refresh-timestamp'])), true);
});

test('cron worker refuses non-HTTPS site endpoints', async () => {
  await assert.rejects(() => runRefresh({ATLAS_SITE_URL: 'http://atlas.example.test', ATLAS_CATALOG_REFRESH_SECRET: 'x'}), /HTTPS/);
});
