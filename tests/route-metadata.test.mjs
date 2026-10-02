import test from 'node:test';
import assert from 'node:assert/strict';
import { homeMetadata, customsRouteMetadata, legalRouteMetadata, privateRouteMetadata, storesRouteMetadata } from '../app/route-metadata.ts';

test('home is the Uzbek x-default with self-canonical hreflang alternates', () => {
  const languages = { uz: '/?lang=uz', ru: '/?lang=ru', en: '/?lang=en', 'x-default': '/' };
  for (const lang of [undefined, '', 'xx', 'RU']) {
    const metadata = homeMetadata(lang);
    assert.equal(metadata.alternates.canonical, '/');
    assert.equal(metadata.openGraph.locale, 'uz_UZ');
  }
  for (const [lang, ogLocale] of [['uz', 'uz_UZ'], ['ru', 'ru_RU'], ['en', 'en_US']]) {
    const metadata = homeMetadata(lang);
    assert.equal(metadata.alternates.canonical, `/?lang=${lang}`);
    assert.equal(metadata.openGraph.url, `/?lang=${lang}`);
    assert.equal(metadata.openGraph.locale, ogLocale);
    assert.deepEqual(metadata.alternates.languages, languages);
    assert.equal(metadata.twitter.card, 'summary_large_image');
    assert.equal(metadata.openGraph.images[0].width, 1200);
    assert.equal(metadata.openGraph.images[0].height, 630);
  }
});

test('public routes have route-specific canonical and Open Graph URLs', () => {
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
