import test from 'node:test';
import assert from 'node:assert/strict';
import { serverError, serverErrors } from '../lib/market/i18n.ts';
import { compareProductSnapshot } from '../lib/importer/verify.ts';
import { allowedUrl, supportedStoreCount, UnsupportedStoreError } from '../lib/importer/fetch.ts';

const codes = Array.from({ length: 14 }, (_, index) => `err_${60 + index}`);
const generic = (locale) => serverError(locale, 'err_unknown');

test('every new error code has its text in ru, uz and en', () => {
  for (const locale of ['ru', 'uz', 'en'])
    for (const code of codes) {
      assert.equal(typeof serverErrors[locale][code], 'string', `${locale} ${code}`);
      assert.notEqual(serverError(locale, code), generic(locale), `${locale} ${code} is specific`);
    }
});

test('the Russian texts are the messages thrown today', () => {
  assert.equal(serverError('ru', 'err_60'), 'Укажите адрес доставки.');
  assert.equal(serverError('ru', 'err_61'), 'Укажите почтовый индекс получателя: 6 цифр.');
  assert.equal(serverError('ru', 'err_62'), 'Проверьте цену, вес и количество (от 1 до 10).');
  assert.equal(serverError('ru', 'err_63'), 'Количество — от 1 до 10.');
  assert.equal(serverError('ru', 'err_64'), 'Выберите обязательные услуги перед оформлением.');
  assert.equal(serverError('ru', 'err_65'), 'Сначала сохраните адрес доставки.');
  assert.equal(serverError('ru', 'err_66'), 'Сначала подтвердите паспорт этого получателя.');
  assert.equal(serverError('ru', 'err_73'), 'Товар не найден в каталоге. Добавьте его по ссылке на магазин.');
});

test('uz and en name the postal code instead of the generic text', () => {
  assert.match(serverError('uz', 'err_61'), /indeks/i);
  assert.match(serverError('en', 'err_61'), /postal code/i);
  assert.notEqual(serverError('uz', 'err_61'), generic('uz'));
  assert.notEqual(serverError('en', 'err_61'), generic('en'));
});

test('a blocked store check carries a code whose Russian text is its message', () => {
  const product = { id: 'x', name: 'x', brand: '', category: 'Обувь', usd: 40, weight: 1.3, image: '', variants: ['Black · 9'], sourceUrl: 'https://www.amazon.com/dp/x', sourcePrice: 40, sourceCurrency: 'USD', sourceVariantId: 'v9' };
  const live = { title: 'x', price: 40, currency: 'USD', variants: [{ id: 'v9', label: 'Black · 9', price: 40, available: true }], warnings: [] };
  const cases = [
    [{ ...product, sourcePrice: undefined }, live, 'err_67'],
    [product, { ...live, currency: 'EUR' }, 'err_68'],
    [product, { ...live, variants: [{ id: 'v10', label: 'Black · 10', price: 40 }] }, 'err_69'],
    [product, { ...live, price: undefined, variants: [{ id: 'v9', label: 'Black · 9' }] }, 'err_70'],
    [product, { ...live, variants: [{ id: 'v9', label: 'Black · 9', price: 40, quantity: 0 }] }, 'err_71'],
  ];
  for (const [item, extracted, code] of cases) {
    const check = compareProductSnapshot(item, 'Black · 9', extracted, 1);
    assert.equal(check.status, 'blocked');
    assert.equal(check.code, code);
    assert.equal(check.message, serverError('ru', code), `${code}: the stored Russian text is unchanged`);
  }
});

test('an unsupported store link is a coded error with the number of stores', () => {
  assert.throws(() => allowedUrl('https://example.org/products/shoe'), (error) => error instanceof UnsupportedStoreError && error.code === 'err_72' && error.supportedStoreCount === supportedStoreCount);
  const error = new UnsupportedStoreError();
  assert.equal(error.message, 'Этот магазин пока не в списке поддерживаемых. Вставьте ссылку из одного из ' + supportedStoreCount + ' магазинов или заполните товар вручную.');
  assert.equal(serverError('ru', 'err_72', { count: supportedStoreCount }), error.message);
  for (const locale of ['uz', 'en']) {
    const text = serverError(locale, 'err_72', { count: supportedStoreCount });
    assert.ok(text.includes(String(supportedStoreCount)) && !text.includes('{count}'), locale);
  }
  // Without values a placeholder text is returned as it is.
  assert.match(serverError('en', 'err_72'), /\{count\}/);
});
