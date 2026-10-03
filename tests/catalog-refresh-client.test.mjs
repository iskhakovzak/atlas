import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {
  buildCatalogRefreshEndpoint,
  CatalogRefreshClientError,
  normalizeCatalogRefreshSummary,
  runCatalogRefresh,
} from '../lib/market/catalog-refresh-client.mjs';

test('builds the protected refresh endpoint from an HTTPS site origin', () => {
  const endpoint = buildCatalogRefreshEndpoint({ATLAS_SITE_URL: 'https://atlasmarket.uz/'});
  assert.equal(endpoint.href, 'https://atlasmarket.uz/api/internal/catalog-refresh');
});

test('rejects unsafe or unexpected refresh endpoints', () => {
  for (const environment of [
    {ATLAS_SITE_URL: 'http://atlasmarket.uz'},
    {ATLAS_SITE_URL: 'https://user:pass@atlasmarket.uz'},
    {ATLAS_SITE_URL: 'https://atlasmarket.uz:8443'},
    {ATLAS_REFRESH_URL: 'https://atlasmarket.uz/other'},
    {ATLAS_REFRESH_URL: 'https://atlasmarket.uz/api/internal/catalog-refresh?x=1'},
  ]) {
    assert.throws(() => buildCatalogRefreshEndpoint(environment), CatalogRefreshClientError);
  }
});

test('only accepts a complete, bounded numeric refresh summary', () => {
  const result = normalizeCatalogRefreshSummary({
    ok: true, selected: 5, checked: 4, available: 2, soldOut: 1, unknown: 1, failed: 1, skipped: 0,
    productUrls: ['must not be logged'],
  });
  assert.deepEqual(result, {selected: 5, checked: 4, available: 2, soldOut: 1, unknown: 1, failed: 1, skipped: 0});
  assert.throws(() => normalizeCatalogRefreshSummary({ok: true, selected: -1}), CatalogRefreshClientError);
});

test('signs the exact HTTPS POST path and returns only aggregate metrics', async () => {
  const secret = 'test-refresh-secret';
  const timestamp = '1790798400000';
  let request;
  const result = await runCatalogRefresh({
    environment: {ATLAS_SITE_URL: 'https://atlasmarket.uz', ATLAS_CATALOG_REFRESH_SECRET: secret},
    now: () => Number(timestamp),
    fetcher: async (url, options) => {
      request = {url, options};
      return new Response(JSON.stringify({
        ok: true, selected: 1, checked: 1, available: 1, soldOut: 0, unknown: 0, failed: 0, skipped: 0,
        productUrl: 'https://example.invalid/private-log-data',
      }), {status: 200, headers: {'content-type': 'application/json'}});
    },
  });

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}\nPOST\n/api/internal/catalog-refresh`)
    .digest('hex');
  assert.equal(request.url, 'https://atlasmarket.uz/api/internal/catalog-refresh');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.redirect, 'error');
  assert.equal(request.options.headers['x-atlas-refresh-timestamp'], timestamp);
  assert.equal(request.options.headers['x-atlas-refresh-signature'], expected);
  assert.deepEqual(result, {event: 'atlas_catalog_refresh', outcome: 'success', selected: 1, checked: 1, available: 1, soldOut: 0, unknown: 0, failed: 0, skipped: 0});
});
