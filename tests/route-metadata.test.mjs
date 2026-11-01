import test from 'node:test';
import assert from 'node:assert/strict';
import { homeMetadata, homeText, privateMetadata, privateRouteMetadata, publicMetadata, publicPages, rootMetadata } from '../app/route-metadata.ts';
import { storeBrands } from '../lib/market/store-brands.ts';
import { homeCopy } from '../lib/market/home-copy.ts';
import { renderLocale } from '../lib/market/i18n.ts';

const russianOnly = ['legal', 'privacy', 'terms'];
const paths = { home: '/', catalog: '/catalog', stores: '/stores', customs: '/customs', legal: '/legal', privacy: '/privacy', terms: '/terms', support: '/support', app: '/app', 'delete-account': '/delete-account' };

test('every public page has self-canonical ?lang versions and an x-default', () => {
  for (const [page, path] of Object.entries(paths)) {
    if (russianOnly.includes(page)) continue;
    const languages = { uz: `${path}?lang=uz`, 'uz-Cyrl': `${path}?lang=oz`, ru: `${path}?lang=ru`, en: `${path}?lang=en`, 'x-default': path };
    for (const [lang, ogLocale] of [['uz', 'uz_UZ'], ['oz', 'uz_UZ'], ['ru', 'ru_RU'], ['en', 'en_US']]) {
      const metadata = publicMetadata(page, lang, 'ru');
      assert.equal(metadata.alternates.canonical, `${path}?lang=${lang}`, `${page} ${lang}`);
      assert.equal(metadata.openGraph.url, `${path}?lang=${lang}`);
      assert.equal(metadata.openGraph.locale, ogLocale, 'the explicit version wins over the visitor language');
      assert.ok(!metadata.openGraph.alternateLocale.includes(ogLocale), 'og:locale:alternate lists the other languages');
      assert.equal(metadata.openGraph.alternateLocale.length, 2);
      assert.deepEqual(metadata.alternates.languages, languages);
      assert.equal(metadata.twitter.card, 'summary_large_image');
      assert.equal(metadata.openGraph.images[0].width, 1200);
      assert.equal(metadata.openGraph.images[0].height, 630);
    }
    for (const lang of [undefined, '', 'xx', 'RU']) assert.equal(publicMetadata(page, lang, 'uz').alternates.canonical, path);
  }
});

test('the Russian-only legal documents canonicalize every address to ?lang=ru and declare only that version', () => {
  for (const page of russianOnly) {
    const path = paths[page];
    for (const lang of [undefined, 'uz', 'oz', 'ru', 'en']) {
      const metadata = publicMetadata(page, lang, 'uz');
      assert.equal(metadata.alternates.canonical, `${path}?lang=ru`, `${page} ${lang}`);
      assert.deepEqual(metadata.alternates.languages, { ru: `${path}?lang=ru`, 'x-default': `${path}?lang=ru` });
    }
    assert.equal(publicMetadata(page, 'en').openGraph.locale, 'en_US', 'the frame is still titled in the page language');
  }
});

test('titles fit 60 characters with the brand and descriptions 70–160 in every language', () => {
  for (const page of publicPages) for (const lang of ['uz', 'oz', 'ru', 'en']) {
    const { title, description } = publicMetadata(page, lang);
    const shown = typeof title === 'string' ? `${title} · Atlas` : title.absolute;
    assert.ok(shown.length <= 60, `${page} ${lang}: ${shown.length} ${shown}`);
    assert.ok(description.length >= 70 && description.length <= 160, `${page} ${lang}: ${description.length}`);
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
  assert.equal(homeMetadata('en').title, `Shop Amazon, Nike, Zara and ${storeBrands.length - 3} more from Tashkent`);
});

test('owner decision 2 November 2026: the home title and description name the stores and their real count, the h1 does not change', () => {
  const others = storeBrands.length - 3;
  assert.equal(homeMetadata('ru').title, `Amazon, Nike, Zara и ещё ${others} магазинов — в Ташкент`);
  assert.equal(homeMetadata('ru').openGraph.title, `Amazon, Nike, Zara и ещё ${others} магазинов — в Ташкент · Atlas`);
  assert.match(homeMetadata('uz').title, new RegExp(`^Amazon, Nike, Zara va yana ${others} do‘kon`));
  assert.match(homeMetadata('oz').title, new RegExp(`^Amazon, Nike, Zara ва яна ${others} дўкон`), 'store names stay Latin in Cyrillic Uzbek');
  for (const lang of ['uz', 'oz', 'ru', 'en']) {
    const { title, description } = homeMetadata(lang);
    assert.match(description, new RegExp(`Amazon, eBay, Nike, Zara .*${storeBrands.length - 4}`), lang);
    assert.ok(`${title} · Atlas`.length <= 60, `${lang}: ${title}`);
    assert.ok(description.length >= 70 && description.length <= 160, `${lang}: ${description.length}`);
  }
  // Russian agrees the noun with the number; a longer list keeps every title within 60 characters.
  assert.equal(homeText(25).ru.title, 'Amazon, Nike, Zara и ещё 22 магазина — в Ташкент');
  assert.equal(homeText(24).ru.title, 'Amazon, Nike, Zara и ещё 21 магазин — в Ташкент');
  assert.equal(homeText(15).ru.title, 'Amazon, Nike, Zara и ещё 12 магазинов — в Ташкент');
  for (const lang of ['uz', 'oz', 'ru', 'en']) assert.ok(`${homeText(1003)[lang].title} · Atlas`.length <= 60, lang);
  // The home h1 is the page copy, untouched.
  assert.doesNotMatch(homeCopy.ru.hero.title, /Amazon|Zara/);
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
