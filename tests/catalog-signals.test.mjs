import test from 'node:test';
import assert from 'node:assert/strict';
import { tariff } from '../lib/market/domain.ts';
import { catalogItems } from '../lib/market/catalog-query.ts';
import { signalsFor } from '../lib/market/catalog-signals.ts';

const base = { brand: 'Nike', country: 'США', image: 'https://example.com/i.jpg', variants: ['Уточнить вариант в магазине'], sourceShippingUsd: 10, sourceShippingEstimated: true, observedOn: '2026-10-01' };
const product = (id, overrides) => ({ ...base, id, name: id, store: 'nike', category: 'Обувь', usd: 60, boxedWeight: 1, weight: 1.3, sourceUrl: `https://www.nike.com/t/${id}`, ...overrides });
const sized = [{ label: '9', size: '9', available: true }, { label: '10', size: '10', available: true }, { label: '11', size: '11', available: true }];
const itemOf = (overrides) => catalogItems([product('runner', overrides)], tariff)[0];

const guest = { locale: 'ru', pricing: tariff, parcel: null, inCart: false, member: false, remainingUsd: null, dutyLimitUsd: 200 };
const member = (remainingUsd) => ({ ...guest, member: true, remainingUsd });
const kinds = (signals) => signals.map((signal) => signal.kind);
const colours = (signals) => signals.filter((signal) => signal.tone !== 'neutral');

test('never more than two chips, and at most one of them coloured', () => {
  const item = itemOf({ sourceVariants: sized });
  // Everything at once: a shared parcel, an allowance that fits, free store delivery, in the cart, three sizes.
  const signals = signalsFor(item, { ...member(200), parcel: { store: 'nike.com', extra: 118_000 }, inCart: true });
  assert.ok(signals.length <= 2);
  assert.equal(colours(signals).length, 1);
  assert.deepEqual(kinds(signals), ['parcel', 'cart']);
  assert.equal(signals[0].tone, 'mint');
  assert.equal(signals[0].text, '+118 000 сум к посылке Nike');
  assert.match(signals[0].hint, /Отдельной посылкой — \d/);
});

test('mint priority: the parcel, then the allowance, then free store delivery', () => {
  const item = itemOf({ sourceVariants: sized });
  assert.deepEqual(kinds(signalsFor(item, { ...member(200), parcel: { store: 'nike.com', extra: 50_000 } })), ['parcel', 'sizes']);
  const limit = signalsFor(item, member(200));
  assert.deepEqual(kinds(limit), ['limit', 'sizes']);
  assert.equal(limit[0].text, 'В лимите $200');
  assert.equal(limit[1].text, '3 размера');
  // Above $50 from the store its unknown delivery is free: the guest's one win.
  const free = signalsFor(item, guest);
  assert.deepEqual(kinds(free), ['free-shipping', 'sizes']);
  assert.equal(free[0].tone, 'mint');
  assert.match(free[0].hint, /\$50/);
  // Below the threshold the hold applies, so nothing is free and nothing is coloured.
  assert.deepEqual(kinds(signalsFor(itemOf({ usd: 20 }), guest)), []);
  // A store that states its delivery price has no "free" chip either.
  assert.deepEqual(kinds(signalsFor(itemOf({ sourceShippingEstimated: false, sourceShippingUsd: 0 }), guest)), []);
});

test('a guest never sees "within the allowance"', () => {
  const item = itemOf({ usd: 20, boxedWeight: 0.3, weight: 1 });
  assert.deepEqual(kinds(signalsFor(item, guest)), []);
  assert.deepEqual(kinds(signalsFor(item, { ...guest, member: true, remainingUsd: null })), [], 'a member without a countable allowance is a guest here');
  assert.deepEqual(kinds(signalsFor(item, member(200))), ['limit']);
});

test('amber displaces mint: above the allowance there is no win to show', () => {
  const item = itemOf({ sourceVariants: sized });
  const over = signalsFor(item, { ...member(40), parcel: { store: 'nike.com', extra: 50_000 } });
  assert.deepEqual(kinds(over), ['over-limit', 'sizes']);
  assert.equal(over[0].tone, 'amber');
  assert.equal(over[0].text, 'Дороже лимита на $20');
  assert.equal(signalsFor(itemOf({ usd: 45.5 }), member(40))[0].text, 'Дороже лимита на $6', 'whole dollars, rounded up');
  const guestOver = signalsFor(itemOf({ usd: 290, boxedWeight: 2.5, weight: 3 }), guest);
  assert.equal(guestOver[0].kind, 'over-limit');
  assert.equal(guestOver[0].text, 'Дороже лимита $200');
  assert.match(guestOver[0].hint, /не входит/);
  assert.equal(colours(signalsFor(itemOf({ usd: 200 }), guest)).filter((signal) => signal.tone === 'amber').length, 0, 'exactly the limit still fits');
});

test('an unconfirmed price gets no mint allowance chip, only the "we check before you order" note', () => {
  const stale = itemOf({ usd: 3, priceNeedsConfirmation: true, sourcePrice: 3, sourceCurrency: 'USD', sourceVariants: sized });
  const signals = signalsFor(stale, member(200));
  assert.deepEqual(kinds(signals), ['stale']);
  assert.equal(signals[0].tone, 'neutral');
  assert.equal(signals[0].text, 'Сверим перед заказом');
  // Its last price still counts against the allowance, as on the duty-free filter.
  assert.deepEqual(kinds(signalsFor(itemOf({ usd: 3, priceNeedsConfirmation: true, sourcePrice: 300, sourceCurrency: 'USD' }), guest)), ['over-limit', 'stale']);
});

test('neutral chips: in the cart first, then stale, eBay stock, sizes', () => {
  const item = itemOf({ usd: 20, sourceVariants: sized });
  assert.deepEqual(kinds(signalsFor(item, { ...guest, inCart: true })), ['cart', 'sizes']);
  const ebay = (stockQuantity) => itemOf({ usd: 20, sourceUrl: 'https://www.ebay.com/itm/1', stockSource: 'ebay', stockQuantity, sourceVariants: sized });
  const stock = signalsFor(ebay(3), guest);
  assert.deepEqual(kinds(stock), ['stock', 'sizes']);
  assert.equal(stock[0].text, 'Осталось 3 шт. · eBay');
  assert.deepEqual(kinds(signalsFor(ebay(11), guest)), ['sizes'], 'plenty of stock is not a signal');
  assert.deepEqual(kinds(signalsFor(ebay(0), guest)), ['sizes'], 'sold out is not a stock count');
  assert.deepEqual(kinds(signalsFor(itemOf({ usd: 20, sourceVariants: sized.slice(0, 1) }), guest)), [], 'one size is not a choice');
});

test('every language has its own wording', () => {
  const item = itemOf({ sourceVariants: sized });
  assert.equal(signalsFor(item, { ...member(200), locale: 'en' })[0].text, 'Within the $200 allowance');
  assert.equal(signalsFor(item, { ...member(200), locale: 'uz' })[0].text, '$200 limit ichida');
  assert.equal(signalsFor(item, { ...member(200), locale: 'en' })[1].text, '3 sizes');
  assert.equal(signalsFor(item, { ...member(200), locale: 'uz' })[1].text, '3 ta o‘lcham');
  assert.equal(signalsFor(item, { ...guest, locale: 'en', parcel: { store: 'nike.com', extra: 1000 } })[0].text, '+1 000 UZS to your Nike parcel');
});
