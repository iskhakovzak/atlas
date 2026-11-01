import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { absoluteUrl, canonicalPath, languageAlternates, localizedPath, pageLanguageSet, withLang } from '../lib/seo/locales.ts';
import { pageMetadata, alternateOgLocales } from '../lib/seo/metadata.ts';
import { breadcrumbList, collectionPage, jsonLd, productJsonLd, webPage } from '../lib/seo/structured-data.ts';
import { buildSitemap, entryUrls, productEntries, publicPageEntries, storeEntries } from '../lib/seo/sitemap.ts';
import { productPath, seoRouteFiles, seoRoutes, storePath } from '../lib/seo/routes.ts';
import { customsPageCheckedOn, courierAllowanceUsd } from '../lib/market/customs.ts';
import { atlasServiceFee, customsHelpShare, deliveryPerKgUsd, standardDeliveryPerKgUsd, tariff } from '../lib/market/domain.ts';
import { packagingKg } from '../lib/market/world.ts';
import { storeBrands } from '../lib/market/store-brands.ts';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// 1. Language versions and internal links.
test('?lang versions: alternates, canonical and the Russian-only legal pages', () => {
  assert.equal(localizedPath('/catalog', 'oz'), '/catalog?lang=oz');
  assert.equal(localizedPath('/?q=nike#faq', 'ru'), '/?q=nike&lang=ru#faq');
  assert.equal(absoluteUrl('/stores', 'en'), 'https://atlasmarket.uz/stores?lang=en');
  assert.equal(absoluteUrl('/stores'), 'https://atlasmarket.uz/stores');
  assert.deepEqual(languageAlternates('/app'), { uz: '/app?lang=uz', 'uz-Cyrl': '/app?lang=oz', ru: '/app?lang=ru', en: '/app?lang=en', 'x-default': '/app' });
  assert.deepEqual(languageAlternates('/terms', 'ru'), { ru: '/terms?lang=ru', 'x-default': '/terms?lang=ru' });
  assert.equal(canonicalPath('/support', null), '/support');
  assert.equal(canonicalPath('/support', 'oz'), '/support?lang=oz');
  assert.equal(canonicalPath('/privacy', 'en', pageLanguageSet('/privacy')), '/privacy?lang=ru');
  assert.equal(pageLanguageSet('/customs'), 'all');
});

test('internal links keep the ?lang of a language version, only for public pages', () => {
  assert.equal(withLang('/catalog', 'ru'), '/catalog?lang=ru');
  assert.equal(withLang('/', 'oz'), '/?lang=oz');
  assert.equal(withLang('/#tariffs', 'en'), '/?lang=en#tariffs');
  assert.equal(withLang('/catalog?q=nike', 'ru'), '/catalog?q=nike&lang=ru');
  assert.equal(withLang('/catalog/p/abc', 'uz'), '/catalog/p/abc?lang=uz', 'future product pages too');
  assert.equal(withLang('/catalog?lang=en', 'ru'), '/catalog?lang=en', 'an explicit language is kept');
  assert.equal(withLang('/catalog', null), '/catalog', 'x-default pages keep bare links');
  for (const href of ['/cart', '/account', '/order-by-link?url=x', '/login?return_to=%2F', 'https://t.me/x', '//evil.example/catalog', 'mailto:a@b.c'])
    assert.equal(withLang(href, 'ru'), href, href);
});

test('the language menu is made of links to the ?lang versions of the page', () => {
  const menu = source('app/header-language.tsx');
  assert.match(menu, /<a className="lang-option"[^>]*href=\{`\$\{pathname\|\|'\/'\}\?lang=\$\{item\.code\}`\}/);
  assert.match(menu, /hrefLang=/);
  assert.match(menu, /event\.preventDefault\(\);onChange\(item\.code\)/, 'a click still switches in place');
  assert.match(source('components/site-link.tsx'), /withLang\(given, usePageLang\(\)\)/);
});

// 2. Metadata for any page, the redesigned ones included.
test('pageMetadata builds canonical, hreflang, Open Graph and Twitter for a new page', () => {
  const text = (locale) => ({ title: locale === 'ru' ? 'Nike Air Force 1 — доставка в Ташкент' : 'Nike Air Force 1', description: 'd'.repeat(100) });
  const meta = pageMetadata({ path: '/catalog/p/abc', lang: 'ru', fallback: 'uz', text, image: { url: 'https://cdn.example/1.jpg', width: 800, height: 800, alt: 'Nike Air Force 1 — белый' } });
  assert.equal(meta.alternates.canonical, '/catalog/p/abc?lang=ru');
  assert.equal(meta.alternates.languages['uz-Cyrl'], '/catalog/p/abc?lang=oz');
  assert.equal(meta.title, 'Nike Air Force 1 — доставка в Ташкент');
  assert.equal(meta.openGraph.title, 'Nike Air Force 1 — доставка в Ташкент · Atlas');
  assert.equal(meta.openGraph.locale, 'ru_RU');
  assert.deepEqual(meta.openGraph.alternateLocale, ['uz_UZ', 'en_US']);
  assert.equal(meta.openGraph.images[0].alt, 'Nike Air Force 1 — белый');
  assert.equal(meta.twitter.card, 'summary_large_image');
  assert.equal(meta.robots.index, true);
  const bare = pageMetadata({ path: '/catalog/p/abc', lang: undefined, fallback: 'uz', text });
  assert.equal(bare.alternates.canonical, '/catalog/p/abc');
  assert.equal(bare.openGraph.images[0].width, 1200, 'the site banner without a photo');
  assert.deepEqual(alternateOgLocales('oz'), ['ru_RU', 'en_US'], 'uz and oz share uz_UZ');
});

// 3. Structured data.
test('Product JSON-LD: an Offer only with a real UZS total, availability only when the store confirmed it', () => {
  const base = { path: productPath('find-1'), requested: 'ru', name: 'Air Force 1', sku: 'find-1', images: ['https://cdn.example/1.jpg', 'http://insecure.example/2.jpg', '/local.png'], brand: 'Nike', category: 'Обувь', color: ' ' };
  const unpriced = productJsonLd(base);
  assert.equal(unpriced.offers, undefined, 'a price waiting for confirmation gives no Offer');
  assert.deepEqual(unpriced.image, ['https://cdn.example/1.jpg']);
  assert.equal(unpriced.color, undefined);
  assert.deepEqual(unpriced.brand, { '@type': 'Brand', name: 'Nike' });
  for (const field of ['aggregateRating', 'review', 'hasMerchantReturnPolicy', 'shippingDetails']) assert.equal(unpriced[field], undefined, field);
  const priced = productJsonLd({ ...base, priceUzs: 1111825.4, priceValidUntil: '2026-11-02' });
  assert.deepEqual(priced.offers, { '@type': 'Offer', url: 'https://atlasmarket.uz/catalog/p/find-1?lang=ru', price: '1111825', priceCurrency: 'UZS', priceValidUntil: '2026-11-02', seller: { '@id': 'https://atlasmarket.uz/#organization' } });
  assert.equal(productJsonLd({ ...base, priceUzs: 5, availability: 'InStock' }).offers.availability, 'https://schema.org/InStock');
  for (const priceUzs of [0, -1, Number.NaN, null]) assert.equal(productJsonLd({ ...base, priceUzs }).offers, undefined, String(priceUzs));
  assert.equal(productJsonLd({ ...base, condition: 'used' }).itemCondition, 'https://schema.org/UsedCondition');
});

test('breadcrumbs, collection pages and dated pages', () => {
  const trail = breadcrumbList([{ name: 'Главная', path: '/' }, { name: 'Магазины', path: '/stores' }, { name: 'Nike', path: storePath('nike') }], 'ru');
  assert.deepEqual(trail.itemListElement.map((item) => [item.position, item.item]), [[1, 'https://atlasmarket.uz/?lang=ru'], [2, 'https://atlasmarket.uz/stores?lang=ru'], [3, 'https://atlasmarket.uz/stores/nike?lang=ru']]);
  const list = collectionPage({ path: '/stores/nike', requested: null, name: 'Nike', itemPaths: ['/catalog/p/a', '/catalog/p/b'] });
  assert.equal(list.mainEntity.numberOfItems, 2);
  assert.equal(list.mainEntity.itemListElement[1].url, 'https://atlasmarket.uz/catalog/p/b');
  const page = webPage({ path: '/customs', requested: 'oz', locale: 'oz', name: 'Bojxona', dateModified: customsPageCheckedOn, citations: ['https://lex.uz/docs/7484114'] });
  assert.equal(page['@id'], 'https://atlasmarket.uz/customs?lang=oz');
  assert.equal(page.inLanguage, 'uz-Cyrl');
  assert.deepEqual(JSON.parse(jsonLd(page)), page);
});

test('/customs: the dated WebPage repeats the date the page shows in every language', () => {
  assert.equal(customsPageCheckedOn, '2026-09-11');
  const view = source('app/customs-view.tsx');
  for (const shown of ['Проверена 11 сентября 2026 года', '2026-yil 11-sentabrda tekshirilgan', 'Checked on 11 September 2026']) assert.ok(view.includes(shown), shown);
  assert.match(source('app/customs/page.tsx'), /dateModified: customsPageCheckedOn/);
});

// 4. Sitemap.
test('sitemap: one URL per language version, lastmod only where known, no changefreq or priority', () => {
  const xml = buildSitemap(publicPageEntries({ '/customs': customsPageCheckedOn }));
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(locs.length, 7 * 5 + 3, 'seven pages in five forms, three Russian-only documents once');
  assert.equal(new Set(locs).size, locs.length);
  assert.ok(locs.includes('https://atlasmarket.uz/legal?lang=ru'));
  assert.ok(!locs.includes('https://atlasmarket.uz/legal'));
  assert.doesNotMatch(xml, /changefreq|priority/);
  assert.equal((xml.match(/<lastmod>2026-09-11<\/lastmod>/g) ?? []).length, 5, 'the customs page and its versions');
  assert.equal((xml.match(/<lastmod>/g) ?? []).length, 5);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9" xmlns:xhtml="http:\/\/www.w3.org\/1999\/xhtml">/);
});

test('sitemap: products and stores get their pages, the newest date and escaped URLs', () => {
  const entries = productEntries([{ id: 'find-1', addedAt: Date.UTC(2026, 9, 1), sourceCheckedAt: Date.UTC(2026, 9, 30), confirmedAt: Date.UTC(2026, 9, 5) }, { id: 'a&b' }]);
  assert.deepEqual(entries[0], { path: '/catalog/p/find-1', lastmod: Date.UTC(2026, 9, 30) });
  assert.deepEqual(entryUrls(entries[0]).slice(0, 2), ['https://atlasmarket.uz/catalog/p/find-1', 'https://atlasmarket.uz/catalog/p/find-1?lang=uz']);
  const xml = buildSitemap([...entries, ...storeEntries([{ slug: 'nike', lastmod: '2026-10-31' }])]);
  assert.match(xml, /<loc>https:\/\/atlasmarket.uz\/catalog\/p\/find-1\?lang=ru<\/loc>[\s\S]*?<lastmod>2026-10-30<\/lastmod>/);
  assert.match(xml, /\/catalog\/p\/a%26b/);
  assert.doesNotMatch(xml, /a&b/);
  assert.match(xml, /<loc>https:\/\/atlasmarket.uz\/stores\/nike<\/loc>/);
});

test('sitemap lists a redesigned page family only once its page file exists', () => {
  for (const [flag, file] of Object.entries(seoRouteFiles)) {
    if (seoRoutes[flag]) assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${flag} is on but ${file} is missing`);
  }
  assert.ok(!existsSync(new URL('../public/sitemap.xml', import.meta.url)), 'a static file would shadow the generated sitemap');
  assert.match(source('app/sitemap.xml/route.ts'), /application\/xml/);
});

// 5. Crawling rules, head metadata for bots, Vary.
test('robots lets crawlers render the catalog feed and see the noindex of /order-by-link', () => {
  const robots = source('public/robots.txt');
  const groups = robots.split(/\n(?=User-agent:)/).filter((block) => block.startsWith('User-agent:'));
  for (const block of groups) {
    assert.ok(block.indexOf('Allow: /api/catalog$') !== -1 && block.indexOf('Allow: /api/catalog$') < block.indexOf('Disallow: /api/'), block.split('\n')[0]);
    assert.match(block, /^Disallow: \/order-by-link\?$/m);
    assert.doesNotMatch(block, /^Disallow: \/order-by-link$/m);
  }
  assert.match(robots, /^Sitemap: https:\/\/atlasmarket.uz\/sitemap.xml$/m);
});

test('crawlers, Googlebot included, get metadata in <head>; browsers keep streaming', async () => {
  const { default: config } = await import('../next.config.ts');
  const bots = new RegExp(config.htmlLimitedBots.source, 'i');
  for (const ua of ['Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; YandexBot/3.0)', 'Mozilla/5.0 (compatible; bingbot/2.0)', 'GPTBot/1.1', 'ClaudeBot/1.0', 'PerplexityBot/1.0', 'TelegramBot (like TwitterBot)', 'Mozilla/5.0 Chrome-Lighthouse'])
    assert.ok(bots.test(ua), ua);
  for (const ua of ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'])
    assert.ok(!bots.test(ua), ua);
  assert.match(source('middleware.ts'), /"Vary", "Accept-Language, Cookie"/);
});

// 6. llms.txt states the same figures as the code defaults.
test('llms.txt key facts match the tariff, customs and store constants', () => {
  const llms = source('public/llms.txt');
  const guarantee = tariff.serviceCatalog.find((service) => service.id === 'shipping-insurance');
  const percent = (share) => `${+(share * 100).toFixed(2)}%`;
  for (const fact of [`$${deliveryPerKgUsd} per kg`, `$${standardDeliveryPerKgUsd} per kg`, `${percent(atlasServiceFee)} fee`, `${percent(customsHelpShare)} of the cart`, `${percent(guarantee.valuePercent)} of the parcel`, `${percent(guarantee.valuePercentHigh)} above $${guarantee.valueThresholdUsd}`, `up to $${courierAllowanceUsd} per recipient`, `${packagingKg} kg of packaging`, `${storeBrands.length} supported stores`, '?lang=oz', 'delivering to Tashkent'])
    assert.ok(llms.includes(fact), fact);
  assert.doesNotMatch(llms, /separate quote lines/, 'the bill shows one "Atlas service" line since PR #48');
});
