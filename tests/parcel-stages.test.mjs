// The eight parcel stages (owner, 1 November 2026): "Таможня" and "В Ташкенте" after "В пути", set by the operator by
// hand. The stored `status` keeps its six values (saved accounts, the D1 projection and the queue SQL read them), the
// two new stages are a mark on status 4, and every new stage reaches the buyer as a notice — so in Telegram and push.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  products, blank, addToCart, cartSignature, checkoutCart, confirmDemoPayment, advanceOrder, inspectWarehouseOrder,
  saveDeliveryProfile, setParcel, receiveOrder, parseState, parcelStageOf, parcelStages, statuses, deliveredStage,
  confirmIdentity,
} from '../lib/market/domain.ts';
import { customsVersion } from '../lib/market/world.ts';
import { localizedParcelStages, localizedStatuses } from '../lib/market/i18n.ts';
import { newNotices } from '../lib/market/telegram-state.ts';
import { formatTelegramNotices } from '../lib/market/telegram-notices.ts';
import { pushMessages } from '../lib/market/push-notices.ts';
import { renderNotification } from '../lib/market/history-copy.ts';
import { operatorNextStep } from '../lib/market/operator-queue.ts';
import { buyerParcels, parcelOf, profileActions, parcelAction } from '../lib/market/parcels.ts';
import { firstProfileAction } from '../lib/market/profile-strip.ts';

const noon = Date.UTC(2026, 10, 1, 7, 0); // 12:00 in Tashkent: nothing is silenced for the night
// The checkout names the saved recipient, as the cart does (its passport is looked up by that id).
const checkout = (s, key, now) => checkoutCart(s, key, cartSignature(s.cart), false, now, customsVersion, undefined, s.deliveryProfiles[0]?.id);
const storeItem = (id) => ({ ...products[0], id, name: 'Item ' + id, usd: 30, weight: 0.8, boxedWeight: 0.5, sourceUrl: 'https://shop.example.com/products/' + id, country: 'США', shippingKnown: true, sourceShippingUsd: 0 });
const profile = { recipient: 'Анна Каримова', phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Навои, 15', postalCode: '100000', comment: '' };
const ok = { condition: 'ok', quantityReceived: 1, notes: '', services: [], packageGroup: '' };

/** Two lines of one checkout from one store: one parcel. Returns the state after payment and the two ids. */
function placed() {
  let s = saveDeliveryProfile(blank(), profile, 'Дом');
  s = addToCart(s, storeItem('a'), 'US 9', 1000);
  s = addToCart(s, storeItem('b'), 'US 9', 1000);
  s = checkout(s, 'k1', 1001);
  const ids = s.orders.map((order) => order.id);
  for (const id of ids) s = confirmDemoPayment(s, id, 1100);
  return { s, ids };
}
/** The same parcel walked to "В пути" (status 4) through buyout, warehouse, one weighing and the tracking number. */
function onTheWay() {
  let { s, ids } = placed();
  for (const id of ids) { s = advanceOrder(s, id, 0, 1200); s = advanceOrder(s, id, 1, 1300); s = inspectWarehouseOrder(s, id, ok, 1400); }
  s = receiveOrder(s, ids[0], [0.9, 20, 20, 10], 1500);
  for (const id of ids) { s = setParcel(s, id, 'DHL', 'TRK-' + id, 'TAS-1', 1600); s = advanceOrder(s, id, 3, 1700); }
  return { s, ids };
}

test('the scale: eight stages, the first five and the last are the old six, in every language', () => {
  assert.equal(parcelStages.length, 8);
  assert.deepEqual(parcelStages.slice(0, 5), statuses.slice(0, 5));
  assert.equal(parcelStages[deliveredStage], statuses[5]);
  for (const locale of ['ru', 'uz', 'oz', 'en']) {
    const names = localizedParcelStages(locale), old = localizedStatuses(locale);
    assert.equal(names.length, 8, locale);
    assert.deepEqual(names.slice(0, 5), old.slice(0, 5), locale);
    assert.equal(names[7], old[5], locale);
    assert.equal(new Set(names).size, 8, locale + ': every stage has its own name');
  }
  assert.deepEqual(localizedParcelStages('ru').slice(5, 7), ['Таможня', 'В Ташкенте']);
  assert.match(localizedParcelStages('oz')[6], /^[Ѐ-ӿ\s]+$/, 'Uzbek Cyrillic is Cyrillic');
});

test('mapping is safe for saved orders: no status is renumbered, the mark only refines status 4', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((status) => parcelStageOf({ status })), [0, 1, 2, 3, 4, 7]);
  assert.equal(parcelStageOf({ status: 4, transitStage: 'customs' }), 5);
  assert.equal(parcelStageOf({ status: 4, transitStage: 'tashkent' }), 6);
  // A stray mark never moves another status: delivered stays delivered, a bought order stays bought.
  assert.equal(parcelStageOf({ status: 5, transitStage: 'tashkent' }), 7);
  assert.equal(parcelStageOf({ status: 1, transitStage: 'customs' }), 1);
  // An account saved before 1 November 2026 parses as it was: a delivered order is still delivered.
  const { s } = onTheWay();
  const before = JSON.parse(JSON.stringify(advanceOrder(advanceOrder(advanceOrder(s, s.orders[0].id, 4, 1800), s.orders[0].id, 5, 1900), s.orders[0].id, 6, 2000)));
  for (const order of before.orders) delete order.transitStage;
  const legacy = { ...before, orders: [{ ...before.orders[0], status: 5 }, { ...before.orders[1], status: 4 }] };
  const parsed = parseState(JSON.stringify(legacy));
  assert.deepEqual(parsed.orders.map((order) => [order.status, parcelStageOf(order)]), [[5, 7], [4, 4]]);
  assert.throws(() => parseState(JSON.stringify({ ...legacy, orders: [{ ...legacy.orders[0], transitStage: 'moon' }] })), 'only the two known marks are stored');
});

test('the operator moves a parcel on its way through "Таможня" and "В Ташкенте" to "Доставлен"', () => {
  let { s, ids } = onTheWay();
  const [a, b] = ids;
  assert.deepEqual(operatorNextStep(s.orders.find((o) => o.id === a)), { kind: 'yours', key: 'toCustoms' });
  // A second click with the stage the operator saw before is refused, as for every other stage.
  const customs = advanceOrder(s, a, 4, 1800);
  assert.throws(() => advanceOrder(customs, a, 4, 1801), /Статус уже изменился/);
  // The box travels whole: both orders of the parcel are at customs, still status 4 for every older reader.
  assert.deepEqual(customs.orders.map((o) => [o.status, o.transitStage, parcelStageOf(o)]), [[4, 'customs', 5], [4, 'customs', 5]]);
  for (const order of customs.orders) {
    assert.deepEqual(order.history.at(-1), { at: 1800, text: 'Таможня', code: 'parcel-stage', params: { stage: 5 } });
    assert.equal(order.parcel.events.at(-1).status, 'Таможенное оформление в Узбекистане');
  }
  // One notice for the parcel, not one per order.
  const notices = newNotices(s, customs, 1800);
  assert.equal(notices.length, 1);
  assert.deepEqual({ code: notices[0].code, params: notices[0].params }, { code: 'parcel-stage', params: { stage: 5, orders: 2 } });
  s = advanceOrder(customs, b, 5, 1900);
  assert.deepEqual(s.orders.map(parcelStageOf), [6, 6]);
  assert.equal(operatorNextStep(s.orders[0]).key, 'deliver');
  s = advanceOrder(s, a, 6, 2000);
  const delivered = s.orders.find((o) => o.id === a);
  assert.equal(delivered.status, 5);
  assert.equal(parcelStageOf(delivered), deliveredStage);
  assert.equal('transitStage' in JSON.parse(JSON.stringify(delivered)), false, 'the mark is cleared on delivery');
  assert.throws(() => advanceOrder(s, a, 7, 2100));
});

test('every new stage reaches the buyer as a notice — so a Telegram and push message — from the payment to the door', () => {
  let { s, ids } = placed();
  const [a] = ids;
  const steps = [];
  const step = (next, now) => { steps.push(newNotices(s, next, now).map((n) => n.code)); s = next; };
  step(advanceOrder(s, a, 0, 1200), 1200);                 // Выкуплен
  step(advanceOrder(s, a, 1, 1300), 1300);                 // На зарубежном складе
  s = inspectWarehouseOrder(s, a, ok, 1400);
  s = advanceOrder(s, ids[1], 0, 1410); s = advanceOrder(s, ids[1], 1, 1420); s = inspectWarehouseOrder(s, ids[1], ok, 1430);
  step(receiveOrder(s, a, [0.9, 20, 20, 10], 1500), 1500); // Готов к отправке (the weighing notice)
  s = setParcel(s, a, 'DHL', 'TRK-1', 'TAS-1', 1600);
  step(advanceOrder(s, a, 3, 1700), 1700);                 // В пути
  step(advanceOrder(s, a, 4, 1800), 1800);                 // Таможня
  step(advanceOrder(s, a, 5, 1900), 1900);                 // В Ташкенте
  step(advanceOrder(s, a, 6, 2000), 2000);                 // Доставлен
  assert.equal(steps.length, 7);
  for (const codes of steps) assert.ok(codes.length >= 1, 'a notice on every stage');
  assert.deepEqual(steps.map((codes) => codes[0]), ['status', 'status', steps[2][0], 'status', 'parcel-stage', 'parcel-stage', 'status']);
  assert.match(steps[2][0], /^parcel-(weighed|refund|extra)$/);
});

test('the stage message in Telegram and push: the stage as the headline, the parcel page behind the button', () => {
  const { s, ids } = onTheWay();
  const next = advanceOrder(s, ids[0], 4, noon);
  const notices = newNotices(s, next, noon);
  const message = formatTelegramNotices(notices, next.orders, 'ru', 'https://atlasmarket.uz', noon);
  assert.match(message.text, /<b>Посылка: Таможня<\/b>/);
  assert.match(message.text, /таможенное оформление в Узбекистане/);
  assert.equal(message.disable_notification, false, 'a new stage rings');
  assert.deepEqual(message.reply_markup.inline_keyboard, [[{ text: 'Открыть посылку', url: `https://atlasmarket.uz/account/parcels/${ids[0]}` }]]);
  for (const locale of ['uz', 'en']) assert.doesNotMatch(formatTelegramNotices(notices, next.orders, locale, 'https://atlasmarket.uz', noon).text, /[а-яё]/i, locale);
  assert.match(formatTelegramNotices(notices, next.orders, 'oz', 'https://atlasmarket.uz', noon).text, /Посилка: Божхонада/);
  assert.equal(renderNotification(notices[0], 'en').title, 'Parcel: Customs');
  const [push] = pushMessages(notices, next.orders, 'ru');
  assert.equal(push.title, 'Таможня');
  assert.equal(push.url, `/account/parcels/${ids[0]}`);
  const tashkent = advanceOrder(next, ids[0], 5, noon + 1);
  assert.equal(renderNotification(newNotices(next, tashkent, noon + 1)[0], 'uz').title, 'Posilka: Toshkentda');
});

test('a paid order whose recipient has no passport gets its own action notice, once per recipient', () => {
  const { s, ids } = placed();
  const asks = s.notifications.filter((n) => n.code === 'passport-needed');
  assert.equal(asks.length, 1, 'two orders, one recipient: asked once');
  const [ask] = asks;
  assert.equal(ask.params.recipient, s.deliveryProfiles[0].id);
  assert.ok(ids.includes(ask.orderId));
  // Telegram marks it as an action and leads to the documents page on that recipient; it names no one.
  const message = formatTelegramNotices([ask], s.orders, 'ru', 'https://atlasmarket.uz', noon);
  assert.match(message.text, /<i>Нужно ваше действие<\/i>/);
  assert.doesNotMatch(message.text, /Анна|Каримова/);
  assert.deepEqual(message.reply_markup.inline_keyboard, [[{ text: 'Добавить паспорт', url: `https://atlasmarket.uz/account/documents?recipient=${encodeURIComponent(ask.params.recipient)}` }]]);
  // With the passport saved first, nothing is asked.
  let withPassport = saveDeliveryProfile(blank(), profile, 'Дом');
  withPassport = confirmIdentity(withPassport, { documentId: 'doc-1', recipientProfileId: withPassport.deliveryProfiles[0].id, firstName: 'Анна', lastName: 'Каримова', birthDate: '1990-01-01', nationality: 'Узбекистан', passportNumber: 'AA1234567' }, noon);
  withPassport = addToCart(withPassport, storeItem('c'), 'US 9', 1000);
  withPassport = checkout(withPassport, 'k2', 1001);
  withPassport = confirmDemoPayment(withPassport, withPassport.orders[0].id, 1100);
  assert.equal(withPassport.notifications.filter((n) => n.code === 'passport-needed').length, 0);
});

test('the profile: one parcel per store box, its stage, «Требует действия» in order, the same first action for the header', () => {
  let s = saveDeliveryProfile(blank(), profile, 'Дом');
  s = addToCart(s, storeItem('a'), 'US 9', 1000);
  s = addToCart(s, storeItem('b'), 'US 9', 1000);
  s = checkout(s, 'k1', 1001);
  const parcels = buyerParcels(s.orders);
  assert.equal(parcels.length, 1);
  assert.equal(parcels[0].stage, 0);
  assert.equal(parcels[0].awaitingPayment, true);
  assert.equal(parcelOf(s.orders, s.orders[1].id).id, parcels[0].id, 'any order number opens its parcel');
  // Unpaid: the payment is the one action (the passport waits until it is paid).
  const unpaid = profileActions(s);
  assert.deepEqual(unpaid.map((action) => action.kind), ['payment']);
  assert.equal(firstProfileAction(s).kind, 'payment');
  assert.equal(parcelAction(parcels[0], unpaid).kind, 'payment');
  for (const order of s.orders) s = confirmDemoPayment(s, order.id, 1100);
  const paid = profileActions(s);
  assert.deepEqual(paid.map((action) => action.kind), ['passport']);
  assert.equal(paid[0].href, '/account/documents?recipient=' + encodeURIComponent(s.deliveryProfiles[0].id));
  assert.deepEqual(firstProfileAction(s), { kind: 'passport', orderId: paid[0].orderId, href: paid[0].href });
  // Each order keeps its own purchase stage until the warehouse; the parcel shows the least advanced one.
  s = advanceOrder(s, s.orders[0].id, 0, 1200);
  const [parcel] = buyerParcels(s.orders);
  assert.deepEqual(parcel.live.map(parcelStageOf).sort(), [0, 1]);
  assert.equal(parcel.stage, 0);
  assert.equal(parcel.awaitingPayment, false);
});
