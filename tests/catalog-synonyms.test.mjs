import test from 'node:test';
import assert from 'node:assert/strict';
import { brandAliases, categorySynonyms, normalizeSearch, searchWords, transliterate, wordMatches } from '../lib/market/catalog-synonyms.ts';
import { catalogCategories } from '../lib/market/catalog-editor.ts';

const item = (overrides) => ({ product: { name: 'Thing', brand: 'Brand', category: 'Другое' }, store: 'example.com', ...overrides });

test('search strings normalize: lower case, "ё" as "е", one apostrophe, single spaces', () => {
  assert.equal(normalizeSearch('  Ёлка   НОВАЯ '), 'елка новая');
  assert.equal(normalizeSearch('Victoria’s  Secret'), "victoria's secret");
  assert.equal(normalizeSearch('O‘zbek'), "o'zbek");
  assert.equal(normalizeSearch(''), '');
});

test('Cyrillic transliterates to the Latin spelling stores use; Latin passes through', () => {
  assert.equal(transliterate('пума'), 'puma');
  assert.equal(transliterate('Ванс'), 'vans');
  assert.equal(transliterate('лего'), 'lego');
  assert.equal(transliterate('щётка 9'), 'schetka 9');
  assert.equal(transliterate('nike'), 'nike');
  assert.ok(wordMatches('puma suede classic', 'пума'));
  assert.ok(wordMatches('кроссовки', 'кроссовки'));
  assert.equal(wordMatches('adidas samba', 'пума'), false);
});

test('every sized or named catalog category has synonyms, and they are lower case', () => {
  for (const category of catalogCategories.filter((name) => name !== 'Другое')) assert.ok(categorySynonyms[category]?.length, category);
  for (const words of Object.values(categorySynonyms)) for (const word of words) assert.equal(word, word.toLocaleLowerCase());
  for (const [cyrillic, latin] of brandAliases) { assert.match(cyrillic, /^[а-яё ]+$/, cyrillic); assert.equal(latin, latin.toLocaleLowerCase()); }
});

test('"кроссовки" finds shoes, "найк" finds Nike, "виктория сикрет" finds the store with an apostrophe', () => {
  const shoes = searchWords(item({ product: { name: 'Gato LV8', brand: 'Nike', category: 'Обувь' }, store: 'nike.com' }));
  for (const word of ['кроссовки', 'sneakers', 'poyabzal', 'найк']) assert.ok(shoes.split(' ').includes(word), word);
  assert.equal(shoes.includes('адидас'), false);
  const secret = searchWords(item({ product: { name: 'Body mist', brand: 'Victoria’s Secret', category: 'Красота и уход' }, store: 'victoriassecret.com' }));
  assert.ok(secret.includes('виктория сикрет'));
  assert.ok(secret.includes('косметика'));
  // The store alone is enough: the brand field may say something else.
  const balance = searchWords(item({ product: { name: '990v6', brand: 'NB', category: 'Обувь' }, store: 'newbalance.com' }));
  assert.ok(balance.includes('нью баланс') && balance.includes('нью бэланс'));
  const levis = searchWords(item({ product: { name: '501', brand: 'Levi’s', category: 'Одежда' }, store: 'levi.com' }));
  assert.ok(levis.includes('левис'));
});

test('the localized storefront label is searchable, so "germany" finds amazon.de in English', () => {
  const de = searchWords(item({ store: 'amazon.de' }), 'en');
  assert.ok(de.includes('amazon · germany'));
  assert.ok(de.includes('амазон'));
  assert.ok(searchWords(item({ store: 'amazon.de' })).includes('германия'));
  assert.equal(searchWords(item({ store: 'unknown-shop.example' })), '');
});

test('brand aliases match whole words in the text and the squashed store host, never a substring', () => {
  const camera = searchWords(item({ product: { name: 'Megapixel camera with rugged basics', brand: 'Sonya', category: 'Электроника' }, store: 'example.com' }));
  for (const alias of ['гэп', 'угг', 'асикс', 'сони']) assert.equal(camera.includes(alias), false, alias);
  const gap = searchWords(item({ product: { name: 'Logo hoodie', brand: 'Gap', category: 'Одежда' }, store: 'gap.com' }));
  assert.ok(gap.includes('гэп'));
  assert.ok(searchWords(item({ product: { name: 'UGG Tasman', brand: 'UGG', category: 'Обувь' }, store: 'example.com' })).includes('угг'));
  // Short words are not transliterated: "и" must not match every text with an "i".
  assert.equal(wordMatches('ikea billy', 'и'), false);
  assert.ok(wordMatches('ikea billy', 'икеа'));
});
