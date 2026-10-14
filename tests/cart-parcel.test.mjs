import test from 'node:test';
import assert from 'node:assert/strict';
import { guaranteeAmount, parcelRoomKg, parcelStoreHost, reorderCandidates, sourceHost, uninsuredParcelLimit } from '../lib/market/cart-parcel.ts';
import { combinedShipmentWeight, packagingKg } from '../lib/market/world.ts';
import { claimLimit, tariff, uninsuredLossPerKgUsd } from '../lib/market/domain.ts';

const line = (boxedWeight, quantity = 1, sourceUrl = 'https://www.Amazon.com/dp/1') => ({ quantity, product: { sourceUrl, boxedWeight } });

test('store host: lower case, without www, empty without a valid link', () => {
  assert.equal(sourceHost('https://www.Nike.com/t/shoe'), 'nike.com');
  assert.equal(sourceHost('not a url'), '');
  assert.equal(sourceHost(undefined), '');
  assert.equal(parcelStoreHost([{ product: {} }, { product: { sourceUrl: 'https://WWW.zara.com/ro/x' } }]), 'zara.com');
  assert.equal(parcelStoreHost([{ product: {} }]), '');
});

test('parcel room: what still fits into the 1 kg minimum, rounded down to 0.1 kg', () => {
  // 0.2 kg + 0.3 kg packaging = 0.5 kg: 0.5 kg more is still billed as 1 kg.
  assert.equal(parcelRoomKg([line(0.2)]), 0.5);
  // Floating point: 1 − (0.5 + 0.3) is 0.19999…, still 0.2 kg.
  assert.equal(parcelRoomKg([line(0.25, 2)]), 0.2);
  assert.equal(parcelRoomKg([line(0.1), line(0.15, 2)]), 0.3);
  // Below 0.2 kg or over the minimum: nothing to say.
  assert.equal(parcelRoomKg([line(0.55)]), undefined);
  assert.equal(parcelRoomKg([line(1.4)]), undefined);
  // The server combines only lines with a store page and a boxed weight; otherwise no promise.
  assert.equal(parcelRoomKg([line(0.2), line(undefined)]), undefined);
  assert.equal(parcelRoomKg([line(0.2, 1, '')]), undefined);
  assert.equal(parcelRoomKg([]), undefined);
});

test('parcel room never changes the billed weight when it is used up', () => {
  for (const boxed of [0.05, 0.1, 0.17, 0.2, 0.33, 0.41, 0.5]) {
    const room = parcelRoomKg([line(boxed)]);
    if (room === undefined) continue;
    assert.equal(combinedShipmentWeight(boxed + room), 1, `boxed ${boxed} + room ${room}`);
    assert.ok(boxed + room + packagingKg <= 1 + 1e-9);
  }
});

const guarantee = tariff.serviceCatalog.find((service) => service.id === 'shipping-insurance');
const quoted = (usd, merchandise, shipping, extra = {}) => ({ quantity: 1, product: { usd }, quote: { merchandise, shipping, deliveryMargin: 0, sourceShipping: 0, weight: 1, ...extra } });

test('guarantee amount: the parcel rate on each line’s goods and delivery, rounded per line', () => {
  const fx = 12_000;
  // $100 of goods + 600 000 soum delivery = $150: under the $200 threshold, 2.9%.
  assert.equal(guaranteeAmount(guarantee, [quoted(100, 1_200_000, 600_000)], fx), Math.round(1_800_000 * 0.029));
  // Two lines worth $250 together: the higher 3.9% on each.
  const lines = [quoted(100, 1_200_000, 300_000), quoted(100, 1_200_000, 300_000)];
  assert.equal(guaranteeAmount(guarantee, lines, fx), 2 * Math.round(1_500_000 * 0.039));
  // Not a value-percent service: nothing.
  assert.equal(guaranteeAmount({ pricingMode: 'operator-quote' }, lines, fx), 0);
});

test('uninsured limit: $15 per kg of each line, never more than its goods, as a loss claim', () => {
  const fx = 12_000;
  assert.equal(uninsuredLossPerKgUsd, 15);
  // 1.9 kg: $28.50 = 342 000 soum, under the goods.
  assert.equal(uninsuredParcelLimit([{ quote: { merchandise: 1_214_829, weight: 1.9 } }], fx), 342_000);
  // Light, cheap goods: the goods are the limit.
  assert.equal(uninsuredParcelLimit([{ quote: { merchandise: 100_000, weight: 2 } }], fx), 100_000);
  // Lines are their own orders: each is capped on its own.
  assert.equal(uninsuredParcelLimit([{ quote: { merchandise: 100_000, weight: 2 } }, { quote: { merchandise: 900_000, weight: 1, fx: 13_000 } }], fx), 100_000 + 195_000);
  // The same figure claimLimit gives the order for a loss.
  const order = { quote: { merchandise: 1_214_829, weight: 1.9, fx }, changeRequests: [], extraCharges: [], requestedServiceIds: [] };
  assert.equal(uninsuredParcelLimit([order], fx), claimLimit(order, 'loss'));
});

test('reorder candidates: delivered, not cancelled, with a store page, newest first, one per product page', () => {
  const order = (id, createdAt, extra = {}) => ({ id, createdAt, status: 5, cancelled: false, product: { sourceUrl: `https://www.nike.com/t/${id}` }, ...extra });
  const orders = [
    order('a', 1),
    order('b', 5),
    order('c', 3, { status: 4 }),
    order('d', 4, { cancelled: true }),
    order('e', 6, { product: {} }),
    order('f', 7, { product: { sourceUrl: 'https://nike.com/t/b?utm_source=x' } }),
    order('g', 2),
    order('h', 0),
  ];
  assert.deepEqual(reorderCandidates(orders).map((entry) => entry.id), ['f', 'g', 'a']);
  assert.deepEqual(reorderCandidates(orders, 1).map((entry) => entry.id), ['f']);
  assert.deepEqual(reorderCandidates([]), []);
});
