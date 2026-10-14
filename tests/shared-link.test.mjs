import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { catalogSearchFor, extractSharedLink, looksLikeLink, normalizeProductLink, searchWords, sharedLinkTarget, storeNamedIn, SHARED_TEXT_LIMIT } from '../lib/market/shared-link.ts';

test('share: the link is found inside the text a store app shares, without the punctuation after it', () => {
  assert.equal(extractSharedLink('Смотри, какие кроссовки https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr/CW2288-111 через Nike'), 'https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr/CW2288-111');
  assert.equal(extractSharedLink('Check this out: https://www.zara.com/uz/ru/item-p01234567.html?v1=1.'), 'https://www.zara.com/uz/ru/item-p01234567.html?v1=1');
  assert.equal(extractSharedLink('«https://www.amazon.com/dp/B0ABCDEF12»'), 'https://www.amazon.com/dp/B0ABCDEF12');
  assert.equal(extractSharedLink('(https://www.ebay.com/itm/1234567890)'), 'https://www.ebay.com/itm/1234567890');
});

test('share: the shared URL wins over the text and the title; nothing usable gives an empty link', () => {
  assert.equal(extractSharedLink('https://www.nike.com/t/a/1', 'text https://www.nike.com/t/b/2', 'title'), 'https://www.nike.com/t/a/1');
  assert.equal(extractSharedLink(null, 'Nike Dunk https://www.nike.com/t/b/2', 'Nike'), 'https://www.nike.com/t/b/2');
  assert.equal(extractSharedLink(undefined, 'Nike Dunk Low', 'Look at https://www.nike.com/t/c/3'), 'https://www.nike.com/t/c/3');
  assert.equal(extractSharedLink('', 'Just words', null), '');
  assert.equal(extractSharedLink('ftp://example.com/file', 'javascript:alert(1)', 'mailto:a@b.uz'), '');
  assert.equal(extractSharedLink('https://localhost/item'), '');
  assert.equal(extractSharedLink('https://user:pass@www.nike.com/t/a/1'), '');
});

test('share: a very long text is read only up to the limit', () => {
  assert.equal(extractSharedLink('x'.repeat(SHARED_TEXT_LIMIT) + ' https://www.nike.com/t/a/1'), '');
  assert.equal(extractSharedLink('x '.repeat(10) + 'https://www.nike.com/t/a/1'), 'https://www.nike.com/t/a/1');
});

test('share: the route sends the link to the order form, or the empty form with a note', () => {
  assert.equal(sharedLinkTarget('https://www.nike.com/t/a/1?x=1&y=2'), '/order-by-link?url=https%3A%2F%2Fwww.nike.com%2Ft%2Fa%2F1%3Fx%3D1%26y%3D2');
  assert.equal(sharedLinkTarget(''), '/order-by-link?shared=nolink');
});

test('share: the installed site and the Android app are registered as share targets', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.share_target, { action: '/share', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } });
  const android = await readFile(new URL('../mobile/android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(android, /android\.intent\.action\.SEND[\s\S]{0,200}android:mimeType="text\/plain"/);
  const activity = await readFile(new URL('../mobile/android/app/src/main/java/uz/atlasmarket/app/MainActivity.java', import.meta.url), 'utf8');
  assert.match(activity, /path\("\/share"\)/);
  const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8');
  assert.match(robots, /Disallow: \/share\r?\n/);
});
test('home link field: a bare domain with a page, shared text and http links become one https link', () => {
  assert.equal(normalizeProductLink('nike.com/t/x'), 'https://nike.com/t/x');
  assert.equal(normalizeProductLink('  www.zara.com/uz/ru/item-p1.html '), 'https://www.zara.com/uz/ru/item-p1.html');
  assert.equal(normalizeProductLink('Смотри: https://www.nike.com/t/a/1 через Nike'), 'https://www.nike.com/t/a/1');
  assert.equal(normalizeProductLink('http://www.nike.com/t/a/1'), 'https://www.nike.com/t/a/1');
  assert.equal(normalizeProductLink('https://www.nike.com/t/a/1?color=white'), 'https://www.nike.com/t/a/1?color=white');
});

test('home link field: words, a domain without a page and unsafe links give no link', () => {
  assert.equal(normalizeProductLink('nike кроссовки'), '');
  assert.equal(normalizeProductLink('nike.com'), '');
  assert.equal(normalizeProductLink('javascript:alert(1)'), '');
  assert.equal(normalizeProductLink('https://user:pass@nike.com/x'), '');
  assert.equal(normalizeProductLink('user:pass@nike.com/x'), '');
  assert.equal(normalizeProductLink('   '), '');
});

test('home link field: a link-like typo keeps the link hint, plain words get the search hint', () => {
  assert.equal(looksLikeLink('nike.com'), true);
  assert.equal(looksLikeLink('htps//nike/t'), true);
  assert.equal(looksLikeLink('see https://'), true);
  assert.equal(looksLikeLink('nike кроссовки'), false);
  assert.equal(looksLikeLink('Air Force 1'), false);
  assert.equal(looksLikeLink('Look: example.com/item/1'), true, 'an address among words is a link without https://');
  assert.equal(looksLikeLink('смотри www.zara.com'), true);
  assert.equal(looksLikeLink('кеды размер 5.5'), false, 'a number with a dot is not an address');
  assert.equal(looksLikeLink('платье h&m'), false);
});

test('home link field: a store named in the words, never by a short ordinary word', () => {
  const stores = [{ key: 'on', name: 'On' }, { key: 'nike', name: 'Nike' }, { key: 'hm', name: 'H&M' }, { key: 'newbalance', name: 'New Balance' }, { key: 'macys', name: 'Macy’s' }];
  assert.deepEqual(searchWords('Nike, кроссовки «Air»!'), ['nike', 'кроссовки', 'air']);
  assert.equal(storeNamedIn('nike кроссовки', stores)?.key, 'nike');
  assert.equal(storeNamedIn('платье H&M', stores)?.key, 'hm');
  assert.equal(storeNamedIn('new balance 990', stores)?.key, 'newbalance');
  assert.equal(storeNamedIn("macy's", stores)?.key, 'macys');
  assert.equal(storeNamedIn('macys', stores)?.key, 'macys');
  assert.equal(storeNamedIn('shoes on sale', stores), null);
  assert.equal(storeNamedIn('nikes', stores), null);
  assert.equal(storeNamedIn('', stores), null);
});

test('home link field: a store named in the Russian spelling the catalog search knows', () => {
  const stores = [{ key: 'nike', name: 'Nike' }, { key: 'newbalance', name: 'New Balance' }, { key: 'victoriassecret', name: 'Victoria’s Secret' }];
  assert.equal(storeNamedIn('найк кроссовки', stores)?.key, 'nike');
  assert.equal(storeNamedIn('Кроссовки НАЙК', stores)?.key, 'nike');
  assert.equal(storeNamedIn('нью бэланс 990', stores)?.key, 'newbalance');
  assert.equal(storeNamedIn('духи виктория сикрет', stores)?.key, 'victoriassecret');
  assert.equal(storeNamedIn('найки', stores), null, 'only the whole spelling');
  assert.equal(storeNamedIn('кроссовки', stores), null);
});

test('home link field: the catalog search keeps only words one product carries, so it never comes back empty', () => {
  const products = [{ name: 'Air Force 1 07', brand: 'Nike', store: 'nike' }, { name: 'Ёлочная игрушка', brand: 'Zara Home', store: 'zara' }];
  assert.equal(catalogSearchFor('nike кроссовки', products), 'nike');
  assert.equal(catalogSearchFor('Nike Air force', products), 'nike air force');
  assert.equal(catalogSearchFor('елочная zara', products), 'елочная zara');
  assert.equal(catalogSearchFor('nike zara', products), 'nike', 'two words on different products would find nothing together');
  assert.equal(catalogSearchFor('кроссовки', products), '');
  assert.equal(catalogSearchFor('ai 1', products), '', 'words under 3 letters are not searched');
  assert.equal(catalogSearchFor('nike', []), '');
  assert.equal(catalogSearchFor('orce кроссовки', products), '', 'a piece inside a word is not offered');
  assert.equal(catalogSearchFor('елочн игрушки', products), 'елочн', 'the start of a word is enough');
});

const shoe = { name: 'Air Force 1 07', brand: 'Nike', store: 'Nike', category: 'Обувь', country: 'США', sourceUrl: 'https://www.nike.com/t/air-force-1-07/CW2288-111' };
const toy = { name: 'Ёлочная игрушка', brand: 'Zara Home', store: 'Zara', category: 'Дом и быт', country: 'США', sourceUrl: 'https://www.zara.com/uz/ru/item-p01234567.html' };
const gadget = { name: 'Echo Dot', brand: 'Amazon', store: 'Amazon', category: 'Электроника', country: 'Германия', sourceUrl: 'https://www.amazon.de/dp/B0ABCDEF12' };

test('home link field: the catalog search reads the words the catalog does — synonyms, Russian brand spellings, transliteration', () => {
  const products = [shoe, toy];
  assert.equal(catalogSearchFor('найк', products), 'найк', 'the Russian spelling of the brand');
  assert.equal(catalogSearchFor('кроссовки', products), 'кроссовки', 'one category word');
  assert.equal(catalogSearchFor('nike кроссовки', products), 'nike кроссовки');
  assert.equal(catalogSearchFor('Найк аир форс', products), 'найк аир', '"аир" is read as "air"; "форс" ("fors") is not "force", so it is left out');
  assert.equal(catalogSearchFor('krossovka', products, 'uz'), 'krossovka', 'the Uzbek synonym');
  assert.equal(catalogSearchFor('кроссовки зара', products), 'кроссовки', 'shoes and Zara are different products');
  assert.equal(catalogSearchFor('orce', products), '', 'a piece inside a word is still not offered');
  assert.equal(catalogSearchFor('ботинки', [{ ...shoe, category: 'Одежда' }]), '', 'a synonym of another category finds nothing');
  assert.equal(catalogSearchFor('germany', [gadget], 'en'), 'germany', 'the storefront label in the page language');
  assert.equal(catalogSearchFor('germany', [gadget], 'ru'), '', 'the Russian page labels it "Германия"');
  assert.equal(catalogSearchFor('германия', [gadget], 'ru'), 'германия');
});

test('home link field: a long search drops whole words, never half a word', () => {
  const long = { ...shoe, name: 'Abcdefghijklmnopqrstuvwxyz Bcdefghijklmnopqrstuvwxyza Cdefghijklmnopqrstuvwxyzab' };
  const search = catalogSearchFor('abcdefghijklmnopqrstuvwxyz bcdefghijklmnopqrstuvwxyza cdefghijklmnopqrstuvwxyzab', [long]);
  assert.equal(search, 'abcdefghijklmnopqrstuvwxyz bcdefghijklmnopqrstuvwxyza');
  assert.ok(search.length <= 60);
});

test('home link field: every offered search finds a product in the real catalog search', async () => {
  const { tariff } = await import('../lib/market/domain.ts');
  const { catalogItems, applyCatalogQuery, emptyCatalogQuery } = await import('../lib/market/catalog-query.ts');
  const { searchWords: catalogWords } = await import('../lib/market/catalog-synonyms.ts');
  const fields = { image: 'https://example.com/i.jpg', variants: ['Уточнить вариант в магазине'], sourceShippingUsd: 10, sourceShippingEstimated: true, observedOn: '2026-10-01', usd: 50, boxedWeight: 1, weight: 1.5 };
  const products = [shoe, toy, gadget].map((product, index) => ({ ...fields, ...product, id: `p${index}` }));
  const items = catalogItems(products, tariff, []);
  for (const locale of ['ru', 'uz', 'en']) {
    const context = { dutyLimitUsd: 200, words: (item) => catalogWords(item, locale) };
    for (const typed of ['найк', 'кроссовки', 'nike кроссовки', 'Найк аир форс', 'krossovka', 'кроссовки зара', 'зара ёлочная', 'амазон эхо', 'germany', 'германия echo', 'sneakers shoes']) {
      const search = catalogSearchFor(typed, products, locale);
      if (search) assert.ok(applyCatalogQuery(items, { ...emptyCatalogQuery, q: search }, context).length > 0, `${locale}: «${typed}» → «${search}»`);
      if (applyCatalogQuery(items, { ...emptyCatalogQuery, q: typed }, context).length > 0) assert.ok(search, `${locale}: the catalog finds «${typed}», so the field offers it`);
    }
  }
});
