import test from 'node:test';
import assert from 'node:assert/strict';
import { toCyrillic, verbatim, withCyrillic, pickLocale, uzText, htmlLang, intlLocale } from '../lib/market/uz-cyrl.ts';
import { supportedLocale, isUzbek, locales } from '../lib/market/i18n.ts';

test('Uzbek letters map to Cyrillic', () => {
  assert.equal(toCyrillic('O‘zbekiston bo‘ylab yetkazib berish'), 'Ўзбекистон бўйлаб етказиб бериш');
  assert.equal(toCyrillic('G‘alla, ma’lumot'), 'Ғалла, маълумот');
  assert.equal(toCyrillic('Choy va shokolad'), 'Чой ва шоколад');
  assert.equal(toCyrillic('yo‘l, Yangi yil'), 'йўл, Янги йил');
  assert.equal(toCyrillic('Elektron'), 'Электрон');
});

test('loanwords keep the soft sign and hard forms', () => {
  assert.equal(toCyrillic('Profil, profilda'), 'Профиль, профильда');
  assert.equal(toCyrillic('Sentabr, 1-sentabrdagi'), 'Сентябрь, 1-сентябрьдаги');
  assert.equal(toCyrillic('Kompyuter, kuryer'), 'Компьютер, курьер');
  assert.equal(toCyrillic('aksiya'), 'акция');
});

test('brands, codes, placeholders, URLs and e-mails stay Latin', () => {
  assert.equal(toCyrillic('Zara buyurtmasi ATL-123'), 'Zara буюртмаси ATL-123');
  assert.equal(toCyrillic('Narx 25 USD'), 'Нарх 25 USD');
  assert.equal(toCyrillic('{count} ta xabar'), '{count} та хабар');
  assert.equal(toCyrillic('pochta: test@example.com'), 'почта: test@example.com');
  assert.equal(toCyrillic('https://atlasmarket.uz/orders'), 'https://atlasmarket.uz/orders');
  assert.equal(toCyrillic('AQSH va BAA'), 'АҚШ ва БАА');
});

test('brands keep Latin before an Uzbek ending; look-alike words do not', () => {
  assert.equal(toCyrillic('Atlasda saqlandi'), 'Atlasда сақланди');
  assert.equal(toCyrillic('Telegram’ga yozing'), 'Telegram’га ёзинг');
  assert.equal(toCyrillic('zarar, Temur'), 'зарар, Темур');
});

test('verbatim values are not transliterated', () => {
  assert.equal(toCyrillic(`${verbatim('Nike Air shoes')} mahsuloti`), 'Nike Air shoes маҳсулоти');
});

test('derived dictionaries and helpers', () => {
  const dict = withCyrillic({ ru: { hi: 'Привет', n: (name) => `Salom, ${name}` }, uz: { hi: 'Salom', n: (name) => `Salom, ${name}` }, en: { hi: 'Hi', n: (name) => `Hi, ${name}` } });
  assert.equal(dict.oz.hi, 'Салом');
  assert.equal(dict.oz.n('Bobur'), 'Салом, Bobur', 'function arguments are user data');
  assert.equal(pickLocale({ ru: 'а', uz: 'xabar', en: 'b' }, 'oz'), 'хабар');
  assert.equal(uzText('uz', 'xabar'), 'xabar');
  assert.equal(uzText('oz', 'xabar'), 'хабар');
  assert.equal(htmlLang('oz'), 'uz-Cyrl');
  assert.equal(intlLocale('oz'), 'uz-Cyrl-UZ');
  assert.equal(supportedLocale('oz'), 'oz');
  assert.ok(isUzbek('oz') && isUzbek('uz') && !isUzbek('ru'));
  assert.deepEqual([...locales].sort(), ['en', 'oz', 'ru', 'uz']);
});
