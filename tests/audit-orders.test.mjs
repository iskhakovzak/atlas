import test from 'node:test';
import assert from 'node:assert/strict';
import {
  products, blank, addToCart, cartSignature, checkoutCart as checkoutCore, confirmDemoPayment, advanceOrder, inspectWarehouseOrder,
  receiveOrder, cancelOrder, cancelRefundAmount, balanceOf, parcelOrders, codedError, assertDeliveryAddress, price, changeQuantity,
  setCartServices, saveDeliveryProfile, confirmIdentity, submitDeclarationPreview, tariff, stateSchema, confirmStoreShipping,
} from '../lib/market/domain.ts';
import { applyAction } from '../lib/market/actions.ts';
import { customsVersion } from '../lib/market/world.ts';

const NOW = Date.UTC(2026, 9, 6);
const checkout = (s, key, balance, now, ...rest) => checkoutCore(s, key, cartSignature(s.cart), balance, now, customsVersion, ...rest);
const codeOf = (fn) => { try { fn(); } catch (error) { return { code: error.code, message: error.message }; } return null; };

test('domain validation errors carry err_60–66 with the Russian messages unchanged', () => {
  const error = codedError('err_99', 'Текст');
  assert.ok(error instanceof Error);
  assert.deepEqual([error.code, error.message], ['err_99', 'Текст']);
  assert.deepEqual(codeOf(() => assertDeliveryAddress(undefined)), { code: 'err_60', message: 'Укажите адрес доставки.' });
  assert.deepEqual(codeOf(() => assertDeliveryAddress({ address: 'Amir Temur 1', postalCode: '' })), { code: 'err_61', message: 'Укажите почтовый индекс получателя: 6 цифр.' });
  assert.deepEqual(codeOf(() => price(0, 1)), { code: 'err_62', message: 'Проверьте цену, вес и количество (от 1 до 10).' });
  assert.deepEqual(codeOf(() => addToCart(blank(), products[0], 'US 9', 1000, tariff, 11)), { code: 'err_63', message: 'Количество — от 1 до 10.' });
  const cart = addToCart(blank(), products[0], 'US 9', 1000);
  assert.deepEqual(codeOf(() => changeQuantity(cart, cart.cart[0].id, 0)), { code: 'err_63', message: 'Количество — от 1 до 10.' });
  const required = { ...tariff, serviceCatalog: tariff.serviceCatalog.map((service) => service.id === 'content-photo' ? { ...service, required: true, pricingMode: 'fixed', feeUzs: 1000 } : service) };
  assert.deepEqual(codeOf(() => setCartServices(cart, cart.cart[0].id, [], required)), { code: 'err_64', message: 'Выберите обязательные услуги перед оформлением.' });
  assert.deepEqual(codeOf(() => checkoutCore({ ...cart, cart: cart.cart.map((item) => ({ ...item, requestedServiceIds: [] })) }, 'k', cartSignature(cart.cart.map((item) => ({ ...item, requestedServiceIds: [] }))), false, 1001, customsVersion, undefined, undefined, undefined, required)), { code: 'err_64', message: 'Выберите обязательные услуги перед оформлением.' });
  // An order without any saved address: the declaration asks for one.
  let s = checkout(addToCart(blank(), products[0], 'US 9', 1000), 'no-address', false, 1001);
  s = confirmIdentity(s, { documentId: 'doc-x', firstName: 'Анна', lastName: 'Каримова', birthDate: '1990-01-01', nationality: 'UZ', passportNumber: 'AA1234567' }, NOW + 1002);
  assert.deepEqual(codeOf(() => submitDeclarationPreview(s, [s.orders[0].id], 1003)), { code: 'err_65', message: 'Сначала сохраните адрес доставки.' });
});

const home = { recipient: 'Анна Каримова', phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Амира Темура, 1', postalCode: '100000', comment: '' };
const parents = { ...home, recipient: 'Ольга Каримова', address: 'ул. Навои, 15' };
const passport = (documentId, recipientProfileId, number) => ({ documentId, recipientProfileId, firstName: 'Анна', lastName: 'Каримова', birthDate: '1990-01-01', nationality: 'UZ', passportNumber: number });
function twoRecipients() {
  let s = saveDeliveryProfile(blank(), home, 'Дом');
  s = saveDeliveryProfile(s, parents, 'Родители', undefined, false);
  const [first, second] = [s.deliveryProfiles.find((p) => p.label === 'Дом').id, s.deliveryProfiles.find((p) => p.label === 'Родители').id];
  s = confirmIdentity(s, passport('doc-1', first, 'AA1111111'), NOW + 1100);
  return { s, first, second };
}

test('a declaration for a saved recipient uses only that recipient’s passport', () => {
  const { s: start, second } = twoRecipients();
  let s = addToCart(start, products[0], 'US 9', 1200);
  s = checkout(s, 'decl-1', false, 1201, undefined, second);
  const id = s.orders[0].id;
  assert.equal(s.orders[0].deliveryProfileId, second);
  assert.equal(s.orders[0].identity, undefined);
  // The only confirmed passport (also state.identityProfile) belongs to the first recipient: it is never used.
  assert.equal(s.identityProfile.recipientProfileId !== second, true);
  const error = codeOf(() => submitDeclarationPreview(s, [id], 1300));
  assert.equal(error.code, 'err_66');
  assert.match(error.message, /паспорт этого получателя/);
  assert.throws(() => applyAction(s, { type: 'declaration-preview', orderIds: [id] }, false), /паспорт этого получателя/);
  // Once the second recipient's own passport is confirmed, the declaration carries it.
  s = confirmIdentity(s, passport('doc-2', second, 'BB2222222'), NOW + 1400);
  const declared = submitDeclarationPreview(s, [id], 1500);
  assert.equal(declared.declarations[0].identity.documentId, 'doc-2');
  assert.equal(declared.declarations[0].identity.passportMasked, '•••• 2222');
  assert.equal(declared.notifications[0].code, 'declaration-saved');
});

test('an order snapshot with another recipient’s passport is not used for this recipient', () => {
  const { s: start, first, second } = twoRecipients();
  let s = checkout(addToCart(start, products[0], 'US 9', 1200), 'decl-2', false, 1201, undefined, second);
  const foreign = s.identityProfiles.find((profile) => profile.recipientProfileId === first);
  s = { ...s, orders: s.orders.map((order) => ({ ...order, identity: foreign })) };
  assert.throws(() => submitDeclarationPreview(s, [s.orders[0].id], 1300), /паспорт этого получателя/);
});

test('orders without a saved recipient keep the earlier passport fallback and message', () => {
  let s = checkout(addToCart(blank(), products[0], 'US 9', 1000), 'legacy', false, 1001, home);
  assert.throws(() => submitDeclarationPreview(s, [s.orders[0].id], 1002), /Сначала подтвердите паспортные данные получателя\./);
  s = confirmIdentity(s, passport('doc-legacy', undefined, 'CC3333333'), NOW + 1003);
  assert.equal(submitDeclarationPreview(s, [s.orders[0].id], 1004).declarations[0].identity.documentId, 'doc-legacy');
});

test('cancelling an unpaid order credits nothing and leaves the payment unpaid', () => {
  let s = checkout(addToCart(blank(), products[0], 'US 9', 1000), 'unpaid', false, 1001);
  const id = s.orders[0].id;
  assert.equal(cancelRefundAmount(s, s.orders[0]), 0);
  for (const next of [cancelOrder(s, id, 1100), applyAction(s, { type: 'cancel', id }, false)]) {
    assert.equal(balanceOf(next), 0);
    assert.equal(next.entries.some((entry) => entry.id.startsWith('cancel:')), false);
    const order = next.orders.find((item) => item.id === id);
    assert.equal(order.cancelled, true);
    assert.notEqual(order.payment.status, 'refunded');
    assert.equal(order.history.at(-1).text, 'Заказ отменён до оплаты. Списаний не было.');
    assert.equal(order.history.at(-1).code, 'cancel-unpaid');
  }
  s = cancelOrder(s, id, 1100);
  assert.equal(cancelOrder(s, id, 1200), s);
});

test('cancelling a partly balance-paid order returns exactly the balance used', () => {
  // A credit of 100 000 soum on the balance, less than the order total.
  const seeded = { ...blank(), entries: [{ id: 'seed', orderId: 'seed', at: 1, amount: 100_000, debit: 'adjustment', credit: 'customer-credit', description: 'seed' }] };
  let s = checkout(addToCart(seeded, products[0], 'US 9', 1000), 'partial', true, 1001);
  const order = s.orders[0];
  assert.equal(order.balanceUsed, 100_000);
  assert.equal(order.payment.status, 'pending');
  assert.equal(balanceOf(s), 0);
  assert.equal(cancelRefundAmount(s, order), 100_000);
  s = cancelOrder(s, order.id, 1100);
  assert.equal(balanceOf(s), 100_000);
  assert.equal(s.entries.find((entry) => entry.id === 'cancel:' + order.id).amount, 100_000);
  assert.equal(s.orders[0].payment.status, 'pending');
  assert.equal(s.orders[0].history.at(-1).text, 'Заказ отменён до выкупа. Сумма учтена на внутреннем балансе Atlas; банковский перевод не выполнялся.');
  assert.deepEqual(s.orders[0].history.at(-1).params, { refund: 100_000 });
});

test('cancelling a recorded payment still credits the full amount once', () => {
  let s = checkout(addToCart(blank(), products[0], 'US 9', 1000), 'paid', false, 1001);
  const id = s.orders[0].id, total = s.orders[0].quote.total;
  s = confirmDemoPayment(s, id, 1002);
  s = cancelOrder(s, id, 1100);
  assert.equal(balanceOf(s), total);
  assert.equal(s.orders[0].payment.status, 'refunded');
  assert.equal(balanceOf(cancelOrder(s, id, 1200)), total);
});

test('a legacy store-shipping refund on an unpaid order credits nothing', () => {
  let s = checkout(addToCart(blank(), products[0], 'US 9', 1000), 'legacy-ship', false, 1001);
  // An order from before the separate hold: the estimate was inside the order sum (sourceShipping).
  s = { ...s, orders: s.orders.map((order) => ({ ...order, product: { ...order.product, sourceShippingEstimated: true, sourceShippingUsd: 10 }, quote: { ...order.quote, sourceShipping: 120_000, storeShippingHold: undefined } })) };
  const next = confirmStoreShipping(s, s.orders[0].id, 5, 1100);
  assert.ok(next.orders[0].storeShippingSettlement.refund > 0);
  assert.equal(balanceOf(next), 0);
  assert.equal(next.entries.some((entry) => entry.id.startsWith('store-shipping:')), false);
  // The history does not claim a refund that was never recorded.
  const event = next.orders[0].history.at(-1);
  assert.equal(event.code, 'store-shipping-partial-legacy');
  assert.equal(event.params.credited, 0);
  assert.doesNotMatch(event.text, /Возврат/);
  assert.match(event.text, /ничего не зачислено/);
  // Paid first: the refund is credited, and a later cancel does not credit it twice.
  const paid = confirmDemoPayment(s, s.orders[0].id, 1050);
  const settled = confirmStoreShipping(paid, s.orders[0].id, 5, 1100);
  const refund = settled.orders[0].storeShippingSettlement.refund;
  assert.equal(balanceOf(settled), refund);
  assert.equal(balanceOf(cancelOrder(settled, s.orders[0].id, 1200)), paid.orders[0].payment.amount);
});

const storeItem = (id, extra = {}) => ({ ...products[0], id, name: 'Item ' + id, usd: 30, weight: 0.8, boxedWeight: 0.5, sourceUrl: 'https://shop.example.com/products/' + id, country: 'США', shippingKnown: true, sourceShippingUsd: 0, ...extra });
const ready = (s, id, now) => {
  s = confirmDemoPayment(s, id, now);
  s = advanceOrder(s, id, 0, now + 1);
  s = advanceOrder(s, id, 1, now + 2);
  return inspectWarehouseOrder(s, id, { condition: 'ok', quantityReceived: s.orders.find((order) => order.id === id).quantity, notes: '', services: [], packageGroup: '' }, now + 3);
};
function parcelOfTwo() {
  let s = addToCart(blank(), storeItem('a'), 'US 9', 1000);
  s = addToCart(s, storeItem('b'), 'US 9', 1000);
  return checkout(s, 'parcel', false, 1001);
}

test('one weighing settles the whole store parcel: Σ shipping = ceil(chargeable × perKg), idempotent', () => {
  let s = parcelOfTwo();
  assert.equal(s.orders.length, 2);
  const [a, b] = s.orders;
  // The quote already treated them as one 1.3 kg parcel (0.5 + 0.5 + 0.3 packaging).
  assert.equal(Math.round((a.quote.weight + b.quote.weight) * 1000) / 1000, 1.3);
  s = ready(s, a.id, 1100);
  s = ready(s, b.id, 1200);
  assert.deepEqual(parcelOrders(s, a).map((order) => order.id), [a.id, b.id]);
  const weighed = receiveOrder(s, a.id, [1.3, 20, 15, 10], 1300);
  const orders = weighed.orders;
  const perKg = a.quote.perKg;
  const shippingTotal = Math.ceil(1.3 * perKg);
  assert.equal(orders.reduce((sum, order) => sum + order.settlement.shipping, 0), shippingTotal);
  assert.equal(orders.reduce((sum, order) => sum + order.settlement.extra, 0), 0);
  assert.equal(orders.reduce((sum, order) => sum + order.settlement.refund, 0), 0);
  for (const order of orders) {
    assert.equal(order.status, 3);
    assert.deepEqual(order.settlement.parcelOrderIds, [a.id, b.id]);
    assert.equal(order.settlement.parcelShipping, shippingTotal);
    assert.equal(order.settlement.actualWeight, 1.3);
    assert.equal(order.history.at(-1).code, 'parcel-weighed');
  }
  assert.equal(weighed.notifications.filter((notice) => notice.code === 'parcel-weighed').length, 2);
  // Weighing again, from either order, changes nothing.
  assert.equal(receiveOrder(weighed, a.id, [5, 50, 50, 50], 1400), weighed);
  assert.equal(receiveOrder(weighed, b.id, [5, 50, 50, 50], 1400), weighed);
  assert.equal(applyAction(weighed, { type: 'receive', id: b.id, dimensions: [5, 50, 50, 50] }, true).orders.every((order) => order.settlement.parcelShipping === shippingTotal), true);
  // The weighed state parses as a stored document.
  assert.doesNotThrow(() => stateSchema.parse(JSON.parse(JSON.stringify(weighed))));
});

test('a heavier parcel splits the extra by quoted delivery and refunds nobody twice', () => {
  let s = parcelOfTwo();
  const [a, b] = s.orders;
  s = ready(ready(s, a.id, 1100), b.id, 1200);
  const weighed = receiveOrder(s, b.id, [2.05, 20, 15, 10], 1300);
  const shippingTotal = Math.ceil(2.05 * a.quote.perKg);
  assert.equal(weighed.orders.reduce((sum, order) => sum + order.settlement.shipping, 0), shippingTotal);
  const paid = a.quote.shipping + a.quote.reserve + b.quote.shipping + b.quote.reserve;
  assert.equal(weighed.orders.reduce((sum, order) => sum + order.settlement.extra - order.settlement.refund, 0), shippingTotal - paid);
});

function parcelOf(lines, key) {
  let s = blank();
  for (const [id, boxedWeight, quantity] of lines) s = addToCart(s, storeItem(id, { boxedWeight }), 'US 9', 1000, tariff, quantity);
  s = checkout(s, key, false, 1001);
  for (const [index, order] of s.orders.entries()) s = ready(s, order.id, 1100 + index * 10);
  return s;
}
test('a parcel weighed exactly at its quoted weight leaves every order at its quote', () => {
  const cases = [[['a', 0.4, 1], ['b', 0.7, 1]], [['a', 0.2, 1], ['b', 0.9, 1]], [['a', 1.0, 1], ['b', 0.45, 1]], [['a', 0.2, 2], ['b', 0.9, 1], ['c', 0.45, 3]]];
  for (const [index, lines] of cases.entries()) {
    const s = parcelOf(lines, 'exact-' + index);
    assert.equal(s.orders.length, lines.length);
    const quoted = Math.round(s.orders.reduce((sum, order) => sum + order.quote.weight, 0) * 1000) / 1000;
    const weighed = receiveOrder(s, s.orders[0].id, [quoted, 10, 10, 10], 1300);
    for (const order of weighed.orders) {
      assert.equal(order.settlement.extra, 0, `case ${index}: ${order.id}`);
      assert.equal(order.settlement.refund, order.quote.reserve, `case ${index}: ${order.id}`);
      assert.equal(order.settlement.shipping, order.quote.shipping, `case ${index}: ${order.id}`);
    }
    const refunds = weighed.entries.filter((entry) => entry.id.startsWith('settlement:'));
    assert.ok(refunds.every((entry) => entry.amount === weighed.orders.find((order) => order.id === entry.orderId).quote.reserve));
  }
});

test('an unpaid neighbour (status 0) does not hold the parcel back', () => {
  let s = parcelOfTwo();
  const [a, b] = s.orders;
  s = ready(s, a.id, 1100);
  assert.deepEqual(parcelOrders(s, a).map((order) => order.id), [a.id]);
  const weighed = receiveOrder(s, a.id, [0.9, 20, 15, 10], 1300);
  assert.equal(weighed.orders.find((order) => order.id === a.id).status, 3);
  assert.equal(weighed.orders.find((order) => order.id === b.id).status, 0);
  assert.equal(weighed.orders.find((order) => order.id === b.id).settlement, undefined);
});

test('a bought neighbour still on the way holds the parcel until the operator weighs without it', () => {
  let s = parcelOfTwo();
  const [a, b] = s.orders;
  s = ready(s, a.id, 1100);
  s = advanceOrder(confirmDemoPayment(s, b.id, 1200), b.id, 0, 1201);
  assert.equal(s.orders.find((order) => order.id === b.id).status, 1);
  assert.throws(() => receiveOrder(s, a.id, [0.9, 20, 15, 10], 1300), new RegExp(`Заказ ${b.id}: Заказ ещё не готов`));
  // Only a bought order of this parcel that has not arrived can be left out.
  assert.throws(() => receiveOrder(s, a.id, [0.9, 20, 15, 10], 1300, [a.id]), /Без взвешивания/);
  assert.throws(() => receiveOrder(s, a.id, [0.9, 20, 15, 10], 1300, ['other']), /Без взвешивания/);
  const weighed = receiveOrder(s, a.id, [0.9, 20, 15, 10], 1300, [b.id]);
  const weighedA = weighed.orders.find((order) => order.id === a.id);
  assert.equal(weighedA.status, 3);
  // 0.9 kg on the scale is still billed at the 1 kg minimum.
  assert.equal(weighedA.settlement.shipping, Math.ceil(1 * a.quote.perKg));
  assert.equal(weighed.orders.find((order) => order.id === b.id).settlement, undefined);
  // B arrives later and is weighed on its own.
  let later = advanceOrder(weighed, b.id, 1, 1400);
  later = inspectWarehouseOrder(later, b.id, { condition: 'ok', quantityReceived: 1, notes: '', services: [], packageGroup: '' }, 1401);
  const done = receiveOrder(later, b.id, [0.8, 20, 15, 10], 1500);
  const weighedB = done.orders.find((order) => order.id === b.id);
  assert.equal(weighedB.status, 3);
  assert.equal(weighedB.settlement.shipping, Math.ceil(1 * b.quote.perKg));
  assert.equal(weighedB.settlement.parcelOrderIds, undefined);
});

test('a parcel with an order not yet inspected cannot be weighed', () => {
  let s = parcelOfTwo();
  const [a, b] = s.orders;
  s = ready(s, a.id, 1100);
  s = confirmDemoPayment(s, b.id, 1200);
  s = advanceOrder(advanceOrder(s, b.id, 0, 1201), b.id, 1, 1202);
  assert.throws(() => receiveOrder(s, a.id, [1.3, 20, 15, 10], 1300), new RegExp(`Заказ ${b.id}: Сначала завершите приёмку`));
  // A cancelled order leaves the parcel; the rest weighs on its own.
  const alone = parcelOrders({ ...s, orders: s.orders.map((order) => order.id === b.id ? { ...order, cancelled: true } : order) }, a);
  assert.deepEqual(alone.map((order) => order.id), [a.id]);
  // An order at the warehouse with something open can be left out too, so the rest is never stuck behind it.
  const weighed = receiveOrder(s, a.id, [1.3, 20, 15, 10], 1300, [b.id]);
  assert.equal(weighed.orders.find((order) => order.id === a.id).status, 3);
  assert.equal(weighed.orders.find((order) => order.id === b.id).settlement, undefined);
});

test('a parcel lighter than 1 kg on the scale keeps the 1 kg minimum it was quoted at', () => {
  let s = addToCart(blank(), storeItem('light', { boxedWeight: 0.2 }), 'US 9', 1000);
  s = checkout(s, 'light', false, 1001);
  const [o] = s.orders;
  s = ready(s, o.id, 1100);
  const weighed = receiveOrder(s, o.id, [0.5, 10, 10, 10], 1300).orders[0];
  assert.equal(o.quote.weight, 1);
  assert.equal(weighed.settlement.chargeableWeight, 1);
  assert.equal(weighed.settlement.shipping, Math.ceil(o.quote.perKg));
});

test('an older order without a batch weighs alone, as before', () => {
  let s = checkout(addToCart(blank(), storeItem('c'), 'US 9', 1000), 'single', false, 1001);
  s = { ...s, orders: s.orders.map((order) => ({ ...order, batchId: undefined })) };
  const order = s.orders[0];
  assert.deepEqual(parcelOrders(s, order).map((item) => item.id), [order.id]);
  s = ready(s, order.id, 1100);
  const weighed = receiveOrder(s, order.id, [1.3, 20, 15, 10], 1200);
  const settlement = weighed.orders[0].settlement;
  assert.equal(settlement.shipping, Math.ceil(1.3 * order.quote.perKg));
  assert.equal(settlement.parcelOrderIds, undefined);
  assert.equal(weighed.orders[0].status, 3);
});
