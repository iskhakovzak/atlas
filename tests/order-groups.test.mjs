import test from 'node:test';
import assert from 'node:assert/strict';
import { addToCart, blank, cancelOrder, cartSignature, checkoutCart, confirmDemoPayment, orderPayable, products } from '../lib/market/domain.ts';
import { customsVersion } from '../lib/market/world.ts';
import { groupOrders, groupStageText, groupStoreNames, isParcelServiceRequest, orderGroupCopy, orderModelKey, orderNeedsCustomerDecision, orderStoreHost, parcelServicesFor, storeGroupName, storeShortName } from '../lib/market/order-groups.ts';

const nike = { ...products[0], id: 'nike-1', sourceUrl: 'https://www.nike.com/t/shoe', country: 'США', shippingKnown: true };
const nike2 = { ...products[0], id: 'nike-2', name: 'Second Nike', sourceUrl: 'https://nike.com/t/other', country: 'США', shippingKnown: true };
const zara = { ...products[2], id: 'zara-1', sourceUrl: 'https://www.zara.com/es/en/p.html', country: 'Испания', shippingKnown: true };

/** Checkout and record the simulated payment, so the lines are "in progress", not "awaiting payment". */
function checkout(state, key, now) {
  let next = checkoutCart(state, key, cartSignature(state.cart), false, now, customsVersion);
  for (const order of next.orders) if (order.payment?.status === 'pending') next = confirmDemoPayment(next, order.id, now + 1);
  return next;
}

test('one checkout with lines from two stores becomes one group with two store sections', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = addToCart(s, nike2, nike2.variants[0], 1001);
  s = addToCart(s, zara, zara.variants[0], 1002);
  s = checkout(s, 'batch-a', 2000);
  assert.equal(s.orders.length, 3);
  const groups = groupOrders(s.orders);
  assert.equal(groups.length, 1);
  const [group] = groups;
  assert.equal(group.key, 'batch:batch-a');
  assert.equal(group.batchId, 'batch-a');
  assert.equal(group.orders.length, 3);
  assert.equal(group.items, 3);
  assert.equal(group.payable, s.orders.reduce((sum, order) => sum + orderPayable(order), 0));
  assert.equal(group.createdAt, 2000);
  assert.equal(group.stage, 'active');
  assert.equal(group.status, 0);
  assert.equal(group.attention, 0);
  assert.deepEqual(group.stores.map((store) => [store.host, store.country, store.orders.length]), [['nike.com', 'США', 2], ['zara.com', 'Испания', 1]]);
  assert.deepEqual(groupStoreNames(group, 'ru'), ['Nike', 'Zara']);
  assert.equal(storeGroupName(group.stores[0], 'en'), 'Nike');
});

test('separate checkouts stay separate groups and keep the given order', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = checkout(s, 'first', 2000);
  s = addToCart(s, zara, zara.variants[0], 3000);
  s = checkout(s, 'second', 4000);
  // state.orders is newest first; the groups follow the lines as given.
  assert.deepEqual(groupOrders(s.orders).map((group) => group.batchId), ['second', 'first']);
  const groups = groupOrders([...s.orders].reverse());
  assert.deepEqual(groups.map((group) => group.batchId), ['first', 'second']);
  assert.ok(groups.every((group) => group.orders.length === 1 && group.stores.length === 1));
});

test('orders without a batch id (older documents, link orders) are groups of one', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = addToCart(s, zara, zara.variants[0], 1001);
  s = checkout(s, 'legacy', 2000);
  const legacy = s.orders.map((order) => { const copy = { ...order }; delete copy.batchId; return copy; });
  const groups = groupOrders(legacy);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.key), legacy.map((order) => `order:${order.id}`));
  assert.ok(groups.every((group) => group.batchId === undefined));
});

test('a cancelled line leaves the sum and count; a fully cancelled group is cancelled', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = addToCart(s, zara, zara.variants[0], 1001);
  s = checkout(s, 'mixed', 2000);
  const [first, second] = s.orders;
  assert.equal(groupOrders(s.orders)[0].stage, 'active');
  s = cancelOrder(s, first.id, 2500);
  let [group] = groupOrders(s.orders);
  assert.equal(group.cancelled, 1);
  assert.equal(group.items, 1);
  assert.equal(group.payable, orderPayable(second));
  assert.equal(group.stage, 'active');
  assert.equal(group.stores.find((store) => store.host === 'nike.com').payable, 0);
  s = cancelOrder(s, second.id, 2600);
  [group] = groupOrders(s.orders);
  assert.equal(group.stage, 'cancelled');
  assert.equal(group.status, undefined);
  assert.equal(group.payable, 0);
});

test('the stage follows the most urgent line: a pending decision wins, then the lowest status, then done', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = addToCart(s, zara, zara.variants[0], 1001);
  s = checkout(s, 'stages', 2000);
  const [a, b] = s.orders;
  const done = { ...a, status: 5 };
  const shipped = { ...b, status: 3 };
  assert.deepEqual(groupOrders([done, shipped]).map((group) => [group.stage, group.status]), [['active', 3]]);
  assert.deepEqual(groupOrders([done, { ...b, status: 5 }]).map((group) => [group.stage, group.status]), [['done', 5]]);
  const waiting = { ...shipped, payment: { id: 'PAY-1', amount: shipped.quote.total, status: 'pending', createdAt: 2100 } };
  assert.equal(orderNeedsCustomerDecision(waiting), true);
  assert.equal(orderNeedsCustomerDecision({ ...waiting, cancelled: true }), false);
  const [group] = groupOrders([done, waiting]);
  assert.equal(group.stage, 'attention');
  assert.equal(group.attention, 1);
  const extra = { ...shipped, settlement: { ...shipped.quote, actualWeight: 2, dimensionalWeight: 2, chargeableWeight: 2, shipping: 1, extra: 5000, refund: 0 } };
  assert.equal(orderNeedsCustomerDecision(extra), true);
  assert.equal(orderNeedsCustomerDecision({ ...extra, extraApproved: true }), false);
});

test('store host parsing is forgiving', () => {
  assert.equal(orderStoreHost({ product: { sourceUrl: 'https://WWW.Zara.com/x' } }), 'zara.com');
  assert.equal(orderStoreHost({ product: { sourceUrl: 'not a url' } }), '');
  assert.equal(orderStoreHost({ product: {} }), '');
  assert.equal(storeGroupName({ host: '', brand: 'Anker' }, 'ru'), 'Anker');
  assert.equal(storeGroupName({ host: 'shop.example.org', brand: 'X' }, 'ru'), 'shop.example.org');
});

test('one model in three sizes is one model block with three variant lines; another product is its own model', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = addToCart(s, nike, nike.variants[1], 1001);
  s = addToCart(s, nike, nike.variants[2], 1002);
  s = addToCart(s, nike2, nike2.variants[0], 1003);
  s = checkout(s, 'sizes', 2000);
  assert.equal(s.orders.length, 4);
  const [group] = groupOrders(s.orders);
  assert.equal(group.stores.length, 1);
  const [store] = group.stores;
  assert.equal(store.models.length, 2);
  const shoe = store.models.find((model) => model.product.name === nike.name);
  assert.deepEqual(shoe.orders.map((order) => order.variant).sort(), [nike.variants[0], nike.variants[1], nike.variants[2]].sort());
  assert.equal(shoe.items, 3);
  assert.equal(orderModelKey(shoe.orders[0]), orderModelKey(shoe.orders[2]));
  assert.notEqual(orderModelKey(shoe.orders[0]), orderModelKey(store.models.find((model) => model !== shoe).orders[0]));
  // Without a link the product id is the model.
  assert.equal(orderModelKey({ product: { id: 'catalog-1', name: 'X' } }), 'catalog-1');
  assert.equal(storeShortName(store), 'Nike');
  assert.equal(storeShortName({ host: '', brand: 'Anker' }), 'Anker');
});

test('the group stage is honest: one status by name, different statuses as "at different stages" with counts', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = addToCart(s, nike, nike.variants[1], 1001);
  s = addToCart(s, nike, nike.variants[2], 1002);
  s = checkout(s, 'mixed-stages', 2000);
  const [a, b, c] = s.orders;
  const mixed = groupOrders([{ ...a, status: 5 }, { ...b, status: 4 }, { ...c, status: 4 }])[0];
  assert.deepEqual(mixed.progress, [{ status: 4, count: 2 }, { status: 5, count: 1 }]);
  const text = groupStageText(mixed, 'ru');
  assert.equal(text.label, 'На разных этапах');
  assert.equal(text.summary, 'В пути: 2 · Доставлен: 1');
  assert.equal(mixed.tab, 'active');
  assert.equal(groupStageText(mixed, 'uz').label, orderGroupCopy.uz.mixed);
  const transit = groupOrders([{ ...a, status: 4 }, { ...b, status: 4 }])[0];
  assert.deepEqual(groupStageText(transit, 'ru'), { label: 'В пути', tone: 'info' });
  const delivered = groupOrders([{ ...a, status: 5 }, { ...b, status: 5 }, { ...c, status: 5 }])[0];
  assert.deepEqual(groupStageText(delivered, 'en'), { label: 'Delivered', tone: 'ok' });
  // A cancelled line leaves the stage: the rest is delivered, so the checkout is done.
  const partly = groupOrders([{ ...a, status: 5 }, { ...b, status: 2, cancelled: true }])[0];
  assert.equal(groupStageText(partly, 'ru').label, 'Доставлен');
  assert.equal(partly.cancelled, 1);
  const none = groupOrders([{ ...a, cancelled: true }, { ...b, cancelled: true }])[0];
  assert.deepEqual(groupStageText(none, 'ru'), { label: 'Отменён', tone: 'muted' });
});

test('the tab belongs to the whole checkout: attention wins, then any line in work, done only when all are finished', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = addToCart(s, zara, zara.variants[0], 1001);
  s = checkout(s, 'tabs', 2000);
  const [a, b] = s.orders;
  const tabs = (orders) => groupOrders(orders).map((group) => group.tab);
  assert.deepEqual(tabs([{ ...a, status: 5 }, { ...b, status: 3 }]), ['active']);
  assert.deepEqual(tabs([{ ...a, status: 5 }, { ...b, status: 5 }]), ['done']);
  assert.deepEqual(tabs([{ ...a, status: 5 }, { ...b, cancelled: true }]), ['done']);
  assert.deepEqual(tabs([{ ...a, cancelled: true }, { ...b, cancelled: true }]), ['done']);
  const waiting = { ...b, status: 0, payment: { id: 'PAY-1', amount: b.quote.total, status: 'pending', createdAt: 2100 } };
  assert.deepEqual(tabs([{ ...a, status: 5 }, waiting]), ['attention']);
  // A duty above the prepayment is a decision too.
  const duty = { ...a, status: 4, customsSettlement: { actual: 2000, prepaid: 1000, refund: 0, extra: 1000 } };
  assert.equal(orderNeedsCustomerDecision(duty), true);
  assert.equal(orderNeedsCustomerDecision({ ...duty, customsExtraApproved: true }), false);
  // Every line stays in its one group, whatever the tab.
  assert.equal(groupOrders([{ ...a, status: 5 }, waiting])[0].orders.length, 2);
});

test('the latest event is the newest history entry over the lines', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = addToCart(s, zara, zara.variants[0], 1001);
  s = checkout(s, 'latest', 2000);
  const [a, b] = s.orders;
  const later = { ...b, history: [...b.history, { at: 9000, text: 'Посылка прибыла на склад' }] };
  const [group] = groupOrders([a, later]);
  assert.equal(group.latest.order.id, b.id);
  assert.equal(group.latest.entry.at, 9000);
});

test('a warehouse service for the whole parcel is listed once on its store section', () => {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  s = addToCart(s, nike, nike.variants[1], 1001);
  s = addToCart(s, zara, zara.variants[0], 1002);
  s = checkout(s, 'parcel', 2000);
  const nikeOrders = s.orders.filter((order) => orderStoreHost(order) === 'nike.com');
  const zaraOrder = s.orders.find((order) => orderStoreHost(order) === 'zara.com');
  const ids = nikeOrders.map((order) => order.id);
  const request = { id: 'svc-1', serviceId: 'photo', title: { ru: 'Фото содержимого', uz: 'Foto', en: 'Content photos' }, description: { ru: '', uz: '', en: '' }, unit: 'package', units: 1, pricingMode: 'fixed', feeUzs: 10000, origin: 'warehouse', status: 'requested', requestedAt: 3000, parcelOrderIds: ids };
  const own = { ...request, id: 'svc-2', serviceId: 'repack', parcelOrderIds: undefined };
  const orders = s.orders.map((order) => order.id === ids[0] ? { ...order, warehouseServiceRequests: [request, own] } : order);
  const [group] = groupOrders(orders);
  const nikeStore = group.stores.find((store) => store.host === 'nike.com');
  assert.deepEqual(nikeStore.parcelServices.map((item) => [item.request.id, item.holder]), [['svc-1', ids[0]]]);
  assert.deepEqual(group.stores.find((store) => store.host === 'zara.com').parcelServices, []);
  assert.equal(isParcelServiceRequest(request), true);
  assert.equal(isParcelServiceRequest(own), false);
  assert.equal(isParcelServiceRequest({ parcelOrderIds: [ids[0]] }), false);
  // The other line of the parcel is covered by the request kept on the first one; the Zara line is not.
  assert.deepEqual(parcelServicesFor(orders, ids[1]).map((item) => item.request.id), ['svc-1']);
  assert.deepEqual(parcelServicesFor(orders, ids[0]).map((item) => item.request.id), ['svc-1']);
  assert.deepEqual(parcelServicesFor(orders, zaraOrder.id), []);
  assert.equal(orderGroupCopy.ru.parcelCovers(ids.join(', ')), `на всю посылку: ${ids.join(', ')}`);
});
