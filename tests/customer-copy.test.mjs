import test from 'node:test';
import assert from 'node:assert/strict';
import { accountCopy, balanceCopy, cartCopy, docsCopy, linkOrderCopy, notFoundCopy, recipientCopy, countryLabel, formatDateTime, formatLongDate, formatShortDate, itemCount, minutesLeft, noticesCopy, orderCount, ordersCopy, parcelCount } from '../lib/market/customer-copy.ts';

function shape(value) {
  if (Array.isArray(value)) return value.map(shape);
  if (typeof value === 'function') return 'function';
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, shape(value[key])]));
  return typeof value;
}

for (const [name, copy] of Object.entries({ cart: cartCopy, account: accountCopy, orders: ordersCopy, balance: balanceCopy, notices: noticesCopy, linkOrder: linkOrderCopy, recipient: recipientCopy, docs: docsCopy, notFound: notFoundCopy })) {
  test(`${name} copy has the same keys in Uzbek, Russian and English, with no empty strings`, () => {
    assert.deepEqual(shape(copy.uz), shape(copy.ru));
    assert.deepEqual(shape(copy.en), shape(copy.ru));
    for (const [locale, text] of Object.entries(copy)) {
      const walk = (value, path) => {
        // The Uzbek consent sentence starts with the link, so its lead-in is intentionally empty.
        if (typeof value === 'string') assert.ok(value.trim() || path.endsWith('consent.before'), `${locale}${path} is empty`);
        else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) walk(inner, `${path}.${key}`);
      };
      walk(text, '');
    }
  });

  test(`${name} Uzbek copy uses Latin script and the ‘ letter mark`, () => {
    const text = JSON.stringify(copy.uz);
    assert.doesNotMatch(text, /[Ѐ-ӿ]/);
    assert.doesNotMatch(text, /o'|g'|O'|G'/);
  });
}

test('cart checkout keeps three steps and a customs consent sentence in every language', () => {
  for (const copy of Object.values(cartCopy)) {
    assert.equal(copy.steps.length, 3);
    assert.ok(copy.checkout.consent.link.trim());
  }
});

test('counts are pluralised per language', () => {
  assert.equal(itemCount(1, 'ru'), '1 товар');
  assert.equal(itemCount(3, 'ru'), '3 товара');
  assert.equal(itemCount(11, 'ru'), '11 товаров');
  assert.equal(itemCount(21, 'ru'), '21 товар');
  assert.equal(itemCount(2, 'uz'), '2 ta tovar');
  assert.equal(itemCount(1, 'en'), '1 item');
  assert.equal(itemCount(2, 'en'), '2 items');
  assert.equal(parcelCount(2, 'ru'), '2 посылки');
  assert.equal(parcelCount(5, 'ru'), '5 посылок');
  assert.equal(parcelCount(1, 'en'), '1 parcel');
  assert.equal(accountCopy.ru.tiles.unread(1), '1 новое');
  assert.equal(accountCopy.ru.tiles.unread(3), '3 новых');
  assert.equal(accountCopy.ru.support.messages(2), '2 сообщения');
});

test('price hold shows whole minutes and never zero', () => {
  assert.equal(minutesLeft(14 * 60000 + 1, 'ru'), '15 мин');
  assert.equal(minutesLeft(10, 'uz'), '1 daqiqa');
  assert.equal(minutesLeft(-5000, 'en'), '1 min');
});

test('long dates read naturally, including Uzbek', () => {
  const october3 = new Date(2026, 9, 3, 12).getTime();
  assert.equal(formatLongDate(october3, 'uz'), '3-oktabr, 2026-yil');
  assert.match(formatLongDate(october3, 'ru'), /^3 октября 2026/);
  assert.equal(formatLongDate(october3, 'en'), 'October 3, 2026');
});

test('stored Russian country names are shown in the interface language', () => {
  assert.equal(countryLabel('США', 'ru'), 'США');
  assert.equal(countryLabel('США', 'uz'), 'AQSH');
  assert.equal(countryLabel('Турция', 'en'), 'Turkey');
  assert.equal(countryLabel('Атлантида', 'en'), 'Атлантида');
});

test('order, balance and notification counts read naturally', () => {
  assert.equal(orderCount(1, 'ru'), '1 заказ');
  assert.equal(orderCount(2, 'ru'), '2 заказа');
  assert.equal(orderCount(5, 'ru'), '5 заказов');
  assert.equal(orderCount(3, 'uz'), '3 ta buyurtma');
  assert.equal(orderCount(1, 'en'), '1 order');
  assert.equal(balanceCopy.ru.operations(1), '1 операция');
  assert.equal(balanceCopy.ru.operations(4), '4 операции');
  assert.equal(noticesCopy.ru.unread(1), '1 непрочитанное');
  assert.equal(noticesCopy.ru.more(5), 'Ещё 5 обновлений');
  assert.equal(ordersCopy.ru.attention(2), 'Нужно ваше решение: 2 заказа');
});

test('short dates and date-times drop the year only within the current year', () => {
  const now = new Date(2026, 9, 3, 18).getTime();
  const thisYear = new Date(2026, 9, 3, 9, 5).getTime();
  const lastYear = new Date(2025, 11, 31, 23, 59).getTime();
  assert.equal(formatShortDate(thisYear, 'uz', now), '3-oktabr');
  assert.equal(formatShortDate(lastYear, 'uz', now), '31-dekabr 2025-yil');
  assert.equal(formatShortDate(thisYear, 'en', now), 'October 3');
  assert.equal(formatDateTime(thisYear, 'uz', now), '3-oktabr, 09:05');
  assert.equal(formatDateTime(thisYear, 'ru', now), '3 октября, 09:05');
  assert.match(formatDateTime(lastYear, 'ru', now), /^31 декабря 2025.*, 23:59$/);
});
