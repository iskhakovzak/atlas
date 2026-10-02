import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogRouteMetadata, customsRouteMetadata, legalRouteMetadata, privateRouteMetadata, storesRouteMetadata } from '../app/route-metadata.ts';

test('public routes have route-specific canonical and Open Graph URLs', () => {
  assert.equal(catalogRouteMetadata.alternates.canonical, '/');
  assert.equal(customsRouteMetadata.alternates.canonical, '/customs');
  assert.equal(legalRouteMetadata.alternates.canonical, '/legal');
  assert.equal(storesRouteMetadata.alternates.canonical, '/stores');
  assert.equal(customsRouteMetadata.openGraph.url, '/customs');
  assert.equal(legalRouteMetadata.openGraph.url, '/legal');
  assert.equal(storesRouteMetadata.openGraph.url, '/stores');
});

test('private and order-entry routes are explicitly excluded from search indexing', () => {
  assert.deepEqual(privateRouteMetadata.robots, {
    index: false, follow: false, googleBot: {index: false, follow: false},
  });
});
