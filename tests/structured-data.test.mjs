import test from 'node:test';
import assert from 'node:assert/strict';
import { breadcrumbs, faqPage, jsonLd, publicViewPaths, siteGraph } from '../lib/seo/structured-data.ts';
import { publicMetadata, rootMetadata } from '../app/route-metadata.ts';

const noContacts = { telegramSupport: null, telegramChannel: null, phone: null, instagram: null, supportEmail: null };

test('the site graph uses a square logo, no search box and only published contacts', () => {
  const [organization, website] = siteGraph('ru', noContacts)['@graph'];
  assert.equal(organization.logo.width, organization.logo.height);
  assert.match(organization.description, /Ташкент/);
  assert.deepEqual(organization.areaServed, { '@type': 'City', name: 'Tashkent', containedInPlace: { '@type': 'Country', name: 'Uzbekistan' } }, 'Atlas delivers only within Tashkent');
  assert.equal(organization.alternateName, 'atlasmarket.uz');
  assert.deepEqual(website.inLanguage, ['uz', 'uz-Cyrl', 'ru', 'en']);
  assert.equal(organization.sameAs, undefined);
  assert.equal(organization.contactPoint, undefined);
  assert.equal(website.potentialAction, undefined, 'no SearchAction: /catalog?q= is filtered in the browser only');
  const filled = siteGraph('uz', { ...noContacts, telegramChannel: 'atlas_uz', supportEmail: 'help@atlasmarket.uz' })['@graph'][0];
  assert.deepEqual(filled.sameAs, ['https://t.me/atlas_uz']);
  assert.equal(filled.contactPoint[0].email, 'help@atlasmarket.uz');
  assert.equal(filled.contactPoint[0].telephone, undefined);
  assert.equal(filled.legalName, undefined);
  const company = siteGraph('ru', noContacts, { entityName: 'ООО «Атлас»', inn: '123456789', address: { ru: 'Ташкент, ул. Пример, 1', uz: 'Toshkent', en: 'Tashkent' } })['@graph'][0];
  assert.equal(company.legalName, 'ООО «Атлас»');
  assert.equal(company.taxID, '123456789');
  assert.equal(company.address.streetAddress, 'Ташкент, ул. Пример, 1');
});

test('breadcrumbs link the form of the page canonical: ?lang on a version, bare on the x-default', () => {
  const list = breadcrumbs('en', '/customs', 'Customs terms', 'en');
  assert.deepEqual(list.itemListElement.map((item) => item.item), ['https://atlasmarket.uz/?lang=en', 'https://atlasmarket.uz/customs?lang=en']);
  const bare = breadcrumbs('uz', '/customs', 'Bojxona', null);
  assert.deepEqual(bare.itemListElement.map((item) => item.item), ['https://atlasmarket.uz/', 'https://atlasmarket.uz/customs']);
  const legal = breadcrumbs('uz', '/terms', 'Shartlar', 'uz', 'ru');
  assert.equal(legal.itemListElement[1].item, 'https://atlasmarket.uz/terms?lang=ru', 'a Russian-only page links its canonical');
  assert.equal(publicViewPaths.products, '/catalog');
  assert.equal(publicViewPaths.cart, undefined, 'private views get no breadcrumbs');
});

test('FAQ data repeats the shown questions and drops empty ones', () => {
  const faq = faqPage([{ q: 'Сколько ехать?', a: 'Две недели.' }, { q: 'Пусто', a: ' ' }]);
  assert.equal(faq.mainEntity.length, 1);
  assert.equal(faq.mainEntity[0].acceptedAnswer.text, 'Две недели.');
});

test('inline JSON-LD cannot close its script tag', () => {
  const html = jsonLd({ text: '</script><script>alert(1)</script>' });
  assert.doesNotMatch(html, /</);
  assert.deepEqual(JSON.parse(html), { text: '</script><script>alert(1)</script>' });
});

test('titles never repeat the brand and only public pages declare index', () => {
  for (const page of ['home', 'catalog', 'stores', 'customs', 'support', 'app']) for (const lang of ['uz', 'ru', 'en']) {
    const { title, openGraph, robots } = publicMetadata(page, lang);
    const shown = typeof title === 'string' ? `${title} · Atlas` : title.absolute;
    assert.equal(shown.match(/Atlas/g).length, 1, `${page} ${lang}: ${shown}`);
    assert.equal(openGraph.title, shown);
    assert.equal(robots.index, true);
  }
  assert.equal(rootMetadata('ru').robots, undefined, 'the 404 page keeps a single noindex');
});

test('search-console verification tags appear only when the codes are set', () => {
  assert.equal(rootMetadata('ru').verification, undefined);
  assert.equal(rootMetadata('ru', { google: ' ', yandex: '' }).verification, undefined);
  assert.deepEqual(rootMetadata('uz', { google: 'g-code', yandex: 'y-code' }).verification, { google: 'g-code', yandex: 'y-code' });
});
