import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogRouteMetadata, customsRouteMetadata, legalRouteMetadata, privateRouteMetadata} from '../app/route-metadata.ts';

test('public pages use their own canonical URLs instead of inheriting the homepage URL', () => {
  assert.equal(catalogRouteMetadata.alternates.canonical, '/');
  assert.equal(customsRouteMetadata.alternates.canonical, '/customs');
  assert.equal(legalRouteMetadata.alternates.canonical, '/legal');
  assert.equal(customsRouteMetadata.openGraph.url, '/customs');
  assert.equal(legalRouteMetadata.openGraph.url, '/legal');
});

test('account and workflow routes are explicitly excluded from search indexing', () => {
  assert.deepEqual(privateRouteMetadata.robots, {
    index: false,
    follow: false,
    googleBot: {index: false, follow: false},
  });
});
