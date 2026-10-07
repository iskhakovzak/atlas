import test from 'node:test';
import assert from 'node:assert/strict';
import { homeMetadata, privateMetadata, privateRouteMetadata, publicMetadata, rootMetadata } from '../app/route-metadata.ts';
import { renderLocale } from '../lib/market/i18n.ts';

const paths = { home: '/', stores: '/stores', customs: '/customs', legal: '/legal', privacy: '/privacy', terms: '/terms', support: '/support', app: '/app', 'delete-account': '/delete-account' };

test('every public page has self-canonical ?lang versions and an x-default', () => {
  for (const [page, path] of Object.entries(paths)) {
    const languages = { uz: `${path}?lang=uz`, ru: `${path}?lang=ru`, en: `${path}?lang=en`, 'x-default': path };
    for (const [lang, ogLocale] of [['uz', 'uz_UZ'], ['ru', 'ru_RU'], ['en', 'en_US']]) {
      const metadata = publicMetadata(page, lang, 'ru');
      assert.equal(metadata.alternates.canonical, `${path}?lang=${lang}`, `${page} ${lang}`);
      assert.equal(metadata.openGraph.url, `${path}?lang=${lang}`);
      assert.equal(metadata.openGraph.locale, ogLocale, 'the explicit version wins over the visitor language');
      assert.deepEqual(metadata.alternates.languages, languages);
      assert.equal(metadata.twitter.card, 'summary_large_image');
      assert.equal(metadata.openGraph.images[0].width, 1200);
      assert.equal(metadata.openGraph.images[0].height, 630);
    }
    for (const lang of [undefined, '', 'xx', 'RU']) assert.equal(publicMetadata(page, lang, 'uz').alternates.canonical, path);
  }
});

test('the x-default page is titled in the language it renders in', () => {
  assert.equal(homeMetadata().openGraph.locale, 'uz_UZ', 'crawlers without a preference get Uzbek');
  assert.equal(homeMetadata(undefined, 'ru').openGraph.locale, 'ru_RU');
  assert.match(publicMetadata('stores', undefined, 'ru').title, /Магазины/);
  assert.match(publicMetadata('stores', undefined, 'uz').title, /do‘konlar/);
  assert.match(publicMetadata('customs', 'en', 'ru').title, /Customs/);
  assert.match(publicMetadata('support', undefined, 'ru').title.absolute, /^Поддержка Atlas$/);
  assert.match(publicMetadata('delete-account', 'en', 'uz').title, /Delete/);
  assert.match(publicMetadata('app', 'uz').title.absolute, /ilovasi/);
  assert.deepEqual(homeMetadata('en').title, { absolute: 'Atlas — shop international stores with delivery to Uzbekistan' });
});

test('Uzbek metadata uses the ‘ letter mark, not ASCII apostrophes', () => {
  for (const page of Object.keys(paths)) {
    const { title, description } = publicMetadata(page, 'uz');
    assert.doesNotMatch(JSON.stringify({ title, description }), /o'|g'|O'|G'/);
  }
  assert.doesNotMatch(JSON.stringify(rootMetadata('uz')), /o'|g'|O'|G'/);
});

test('private and order-entry routes are excluded from indexing but titled in the page language', () => {
  assert.deepEqual(privateRouteMetadata.robots, {
    index: false, follow: false, googleBot: {index: false, follow: false},
  });
  assert.deepEqual(privateMetadata('cart', 'uz').robots, privateRouteMetadata.robots);
  assert.equal(privateMetadata('cart', 'uz').title, 'Savat');
  assert.equal(privateMetadata('cart', 'ru').title, 'Корзина');
  assert.equal(privateMetadata('orders', 'en').title, 'My orders');
});

test('root metadata points at the app icons and manifest', () => {
  const metadata = rootMetadata('ru');
  assert.equal(metadata.manifest, '/manifest.webmanifest');
  assert.equal(metadata.icons.apple, '/apple-touch-icon.png');
  assert.equal(metadata.title.template, '%s · Atlas');
  assert.equal(metadata.openGraph.locale, 'ru_RU');
  assert.deepEqual(metadata.openGraph.alternateLocale, ['uz_UZ', 'en_US']);
});

test('an explicit ?lang version outranks the saved choice and the browser language', () => {
  assert.equal(renderLocale('en', 'atlas-language=ru', 'uz'), 'en');
  assert.equal(renderLocale(null, 'atlas-language=ru', 'en'), 'ru');
  assert.equal(renderLocale('xx', null, 'en-US,en;q=0.9'), 'en');
  assert.equal(renderLocale(undefined, null, null), 'uz');
});
