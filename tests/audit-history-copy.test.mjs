import test from 'node:test';
import assert from 'node:assert/strict';
import {
  products, blank, addToCart, cartSignature, checkoutCart, confirmStoreShipping, approveStoreShippingExtra, confirmDemoPayment,
  advanceOrder, inspectWarehouseOrder, receiveOrder, cancelOrder, money, setParcel, stateSchema,
} from '../lib/market/domain.ts';
import { renderHistory, renderNotification, localizeLegacyStoredCopy, historyCodes, notificationCodes } from '../lib/market/history-copy.ts';
import { formatSum } from '../lib/market/home-copy.ts';
import { customsVersion } from '../lib/market/world.ts';

const cyrillic = /[А-Яа-яЁё]/;
const sums = (params = {}) => Object.entries(params).filter(([key, value]) => typeof value === 'number' && !['status', 'fromBalance', 'from', 'to'].includes(key) && value !== 0).map(([, value]) => value);
// A $20 item whose store does not state its delivery: the $10 hold sits outside the total.
const item = { ...products[0], id: 'link-1', name: 'Кроссовки', usd: 20, weight: 0.8, boxedWeight: 0.5, sourceUrl: 'https://shop.example.com/products/1', country: 'США', shippingKnown: true, sourceShippingEstimated: true, sourceShippingUsd: 10 };

function journey() {
  let s = addToCart(blank(), item, 'US 9', 1000);
  s = checkoutCart(s, 'history-1', cartSignature(s.cart), false, 1001, customsVersion);
  const id = s.orders[0].id;
  s = confirmStoreShipping(s, id, 14, 1100);
  s = approveStoreShippingExtra(s, id, s.orders[0].storeShippingSettlement.extra, 1150);
  s = confirmDemoPayment(s, id, 1200);
  s = advanceOrder(s, id, 0, 1300);
  s = setParcel(s, id, 'UPS', '1Z999', 'NY-1', 1350);
  s = advanceOrder(s, id, 1, 1400);
  s = inspectWarehouseOrder(s, id, { condition: 'ok', quantityReceived: 1, notes: '', services: [], packageGroup: '' }, 1500);
  s = receiveOrder(s, id, [1.3, 20, 15, 10], 1600);
  return s;
}

test('every customer-visible history entry and notification carries a code and renders without Cyrillic in uz and en', () => {
  const s = journey();
  const history = s.orders[0].history;
  assert.ok(history.length >= 8);
  for (const entry of history) {
    assert.ok(entry.code, `history without code: ${entry.text}`);
    assert.ok(historyCodes.includes(entry.code) || ['payment-recorded', 'warehouse-ok'].includes(entry.code), entry.code);
    for (const locale of ['uz', 'en']) {
      const text = renderHistory(entry, locale);
      assert.doesNotMatch(text, cyrillic, `${entry.code} (${locale}): ${text}`);
      for (const amount of sums(entry.params)) assert.ok(text.includes(formatSum(amount, locale)), `${entry.code} (${locale}) lacks ${formatSum(amount, locale)}: ${text}`);
    }
    // Russian text stays as the domain wrote it, for operators and older clients.
    assert.match(entry.text, cyrillic);
  }
  for (const notice of s.notifications) {
    assert.ok(notice.code, `notification without code: ${notice.title}`);
    for (const locale of ['uz', 'en']) {
      const { title, message } = renderNotification(notice, locale);
      assert.doesNotMatch(title + ' ' + message, cyrillic, `${notice.code} (${locale}): ${title} / ${message}`);
    }
  }
  // Notifications with amounts show them in the reader's format.
  const over = s.notifications.find((notice) => notice.code === 'store-shipping-over');
  for (const locale of ['uz', 'en']) {
    const { message } = renderNotification(over, locale);
    for (const key of ['actual', 'hold', 'extra']) assert.ok(message.includes(formatSum(over.params[key], locale)), message);
  }
  const extra = s.notifications.find((notice) => notice.code === 'parcel-extra');
  assert.ok(renderNotification(extra, 'en').message.includes(formatSum(extra.params.extra, 'en')));
  // The hold is never called charged money.
  const hold = history.find((entry) => entry.code === 'store-hold');
  assert.match(renderHistory(hold, 'en'), /reserve of .* kept separately and is not part of the order total/);
  assert.doesNotMatch(renderHistory(hold, 'en'), /charged/);
  assert.ok(hold.text.includes('удерживается отдельно'));
  // Stored documents with codes and params still parse.
  assert.doesNotThrow(() => stateSchema.parse(JSON.parse(JSON.stringify(s))));
});

test('cancelled orders render the unpaid and refunded variants in every language', () => {
  let s = addToCart(blank(), products[0], 'US 9', 1000);
  s = checkoutCart(s, 'cancel-1', cartSignature(s.cart), false, 1001, customsVersion);
  s = cancelOrder(s, s.orders[0].id, 1100);
  const unpaid = s.orders[0].history.at(-1);
  assert.equal(renderHistory(unpaid, 'en'), 'Order cancelled before payment. Nothing was charged.');
  let paid = addToCart(blank(), products[0], 'US 9', 1000);
  paid = checkoutCart(paid, 'cancel-2', cartSignature(paid.cart), false, 1001, customsVersion);
  paid = confirmDemoPayment(paid, paid.orders[0].id, 1002);
  paid = cancelOrder(paid, paid.orders[0].id, 1100);
  const refund = paid.orders[0].history.at(-1);
  for (const locale of ['uz', 'en']) {
    assert.doesNotMatch(renderHistory(refund, locale), cyrillic);
    assert.ok(renderHistory(refund, locale).includes(formatSum(paid.orders[0].quote.total, locale)));
  }
});

test('a legacy store-delivery difference with no recorded payment never reads as a refund', () => {
  let s = addToCart(blank(), products[0], 'US 9', 1000);
  s = checkoutCart(s, 'legacy-store', cartSignature(s.cart), false, 1001, customsVersion);
  s = { ...s, orders: s.orders.map((order) => ({ ...order, product: { ...order.product, sourceShippingEstimated: true, sourceShippingUsd: 10 }, quote: { ...order.quote, sourceShipping: 120_000, storeShippingHold: undefined } })) };
  const next = confirmStoreShipping(s, s.orders[0].id, 5, 1100);
  const event = next.orders[0].history.at(-1);
  const refund = next.orders[0].storeShippingSettlement.refund;
  assert.equal(event.code, 'store-shipping-partial-legacy');
  assert.equal(renderHistory(event, 'ru'), event.text);
  for (const locale of ['uz', 'en']) {
    const text = renderHistory(event, locale);
    assert.doesNotMatch(text, cyrillic);
    assert.ok(text.includes(formatSum(refund, locale)), text);
  }
  assert.match(renderHistory(event, 'en'), /nothing was credited/);
  // Partly recorded: the history names the credited amount.
  const partial = renderHistory({ ...event, params: { ...event.params, credited: 5_000 } }, 'en');
  assert.ok(partial.includes(formatSum(5_000, 'en')) && !/refund/i.test(partial), partial);
});

test('entries saved before codes go through the legacy localizer, amounts included', () => {
  const legacy = { at: 1, text: 'Менеджер подтвердил доставку магазина ' + money(170_000) + '. Это больше резерва ' + money(119_900) + ': нужно согласие покупателя на разницу ' + money(50_100) + '.' };
  const en = renderHistory(legacy, 'en');
  assert.doesNotMatch(en, cyrillic);
  for (const amount of [170_000, 119_900, 50_100]) assert.ok(en.includes(formatSum(amount, 'en')), en);
  const within = renderHistory({ at: 1, text: 'Менеджер подтвердил доставку магазина ' + money(100_000) + ' в пределах резерва ' + money(119_900) + '. Неиспользованная часть резерва ' + money(19_900) + ' освобождается.' }, 'uz');
  assert.doesNotMatch(within, cyrillic);
  assert.ok(within.includes(formatSum(19_900, 'uz')));
  const legacyLines = [
    'Предварительный резерв доставки магазина ' + money(119_900) + ' удерживается отдельно и не входит в сумму заказа. Менеджер уточнит фактическую доставку.',
    'Менеджер подтвердил доставку магазина. Возврат разницы: ' + money(5_000),
    'Взвешивание завершено. Возврат остатка: ' + money(12_000),
    'Взвешивание завершено. Требуется согласование доплаты ' + money(12_000),
    'Покупатель согласовал доплату ' + money(12_000),
    'Заказ оформлен в Atlas. Сумма ' + money(1_234_567) + '. Ожидается подтверждение платёжного провайдера.',
    'Цена и вариант сверены с магазином перед оформлением.',
    'Добавлен трек-номер 1Z999.',
    'Назначено: Склад. Приоритет: Срочный.',
    'Выкуплен',
  ];
  for (const text of legacyLines) for (const locale of ['uz', 'en']) assert.doesNotMatch(renderHistory({ at: 1, text }, locale), cyrillic, text);
  for (const [title, message] of [['Нужно согласовать доставку', 'Фактическая доставка магазина больше резерва. Откройте заказ и подтвердите разницу.'], ['Посылка взвешена', 'Остаток учтён на внутреннем балансе Atlas. Банковский перевод не выполнялся.'], ['Нужна доплата за доставку', 'Фактический или объёмный вес превысил резерв. Проверьте новый расчёт.']]) {
    const rendered = renderNotification({ title, message }, 'en');
    assert.doesNotMatch(rendered.title + rendered.message, cyrillic);
  }
  // Unknown text (an operator's own notification) stays as written; an unknown code falls back to it too.
  assert.equal(localizeLegacyStoredCopy('Свой текст оператора', 'en'), 'Свой текст оператора');
  assert.equal(renderHistory({ at: 1, text: 'Свой текст', code: 'unknown-code', params: {} }, 'en'), 'Свой текст');
  // A known code with a missing amount falls back to the stored text rather than printing "NaN".
  assert.equal(renderHistory({ at: 1, text: 'Выкуплен', code: 'checkout', params: {} }, 'en'), 'Purchased');
});

test('every coded copy exists in ru, uz and en', () => {
  const params = { total: 1000, amount: 1000, hold: 1000, fee: 1000, duty: 1000, from: 1, to: 2, currency: 'USD', actual: 1000, extra: 1000, released: 1000, refund: 1000, credited: 1000, estimated: 1000, tracking: 'T1', carrier: 'UPS', titleRu: 'Фото', titleUz: 'Foto', titleEn: 'Photo', reason: 'n/a', title: 'Swap', delta: 1000, status: 1, fromBalance: 1, limit: 1000, kind: 'loss' };
  assert.ok(historyCodes.length >= 20);
  for (const code of historyCodes) for (const locale of ['ru', 'uz', 'en']) {
    const text = renderHistory({ at: 1, text: 'FALLBACK', code, params }, locale);
    assert.notEqual(text, 'FALLBACK', `${code} ${locale}`);
    if (locale !== 'ru') assert.doesNotMatch(text, cyrillic, `${code} ${locale}: ${text}`);
  }
  for (const code of notificationCodes) for (const locale of ['ru', 'uz', 'en']) {
    const { title, message } = renderNotification({ title: 'FALLBACK', message: 'FALLBACK', code, params }, locale);
    assert.notEqual(message, 'FALLBACK', `${code} ${locale}`);
    if (locale !== 'ru') assert.doesNotMatch(title + message, cyrillic, `${code} ${locale}`);
  }
});
