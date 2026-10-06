import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {products, blank, addToCart, cartSignature, checkoutCart as checkoutCore, confirmDemoPayment, advanceOrder, inspectWarehouseOrder, cancelOrder, saveDeliveryProfile} from '../lib/market/domain.ts';
import {customsVersion} from '../lib/market/world.ts';
import {changedOrders, orderFingerprint, vanishedOrderIds, writeProjection} from '../lib/market/projection.ts';

const checkout = (s, key, now) => checkoutCore(s, key, cartSignature(s.cart), false, now, customsVersion);

// A D1-shaped adapter over in-memory SQLite with every drizzle migration applied; counts written statements.
function memoryD1() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync(new URL('../drizzle/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort())
    for (const part of fs.readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8').split('--> statement-breakpoint')) if (part.trim()) sqlite.exec(part);
  const db = {sqlite, written: 0};
  const statement = (sql, args = []) => ({
    sql, args,
    bind: (...values) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    run: async () => sqlite.prepare(sql).run(...args),
    all: async () => ({results: sqlite.prepare(sql).all(...args)}),
  });
  db.prepare = (sql) => statement(sql);
  db.batch = async (list) => {
    db.written += list.length;
    sqlite.exec('BEGIN');
    try { const results = list.map((item) => sqlite.prepare(item.sql).run(...item.args)); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  };
  return db;
}
// Projection rows without the sync timestamps (a full rebuild stamps every row with its own time).
function dump(db) {
  const rows = (sql) => db.sqlite.prepare(sql).all().map((row) => ({...row}));
  return {
    customers: rows('SELECT id,email,name,phone,locale,status FROM market_customers ORDER BY id'),
    records: rows('SELECT id,customer_id,status,source_store,source_url,currency,total,assigned_role,created_at FROM market_order_records ORDER BY id'),
    fees: rows('SELECT * FROM market_order_fee_lines ORDER BY id'),
    events: rows('SELECT * FROM market_order_events ORDER BY id'),
    finance: rows('SELECT order_id,customer_id,status,created_at,paid_at,month,goods,store_shipping,reserve,payable,commission,delivery,fx_gain,services,revenue FROM market_order_finance ORDER BY order_id'),
  };
}
const home = {recipient: 'Анна Каримова', phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Амира Темура, 1', postalCode: '100000', comment: ''};
const storeItem = (id) => ({...products[0], id, name: 'Item ' + id, usd: 30, weight: 0.8, boxedWeight: 0.5, sourceUrl: 'https://shop.example.com/products/' + id, country: 'США', shippingKnown: true, sourceShippingUsd: 0});

// A customer's documents over time: checkout of two orders, a favorite, payment, purchase, warehouse, a cancel, a new order.
function journey() {
  const states = [];
  let s = saveDeliveryProfile(blank(), home, 'Дом');
  states.push(s);
  s = addToCart(s, storeItem('a'), 'US 9', 1000);
  s = addToCart(s, storeItem('b'), 'US 9', 1000);
  s = checkout(s, 'k1', 1001); states.push(s);
  s = {...s, favorites: [...s.favorites, products[1].id]}; states.push(s);
  const [a, b] = s.orders.map((order) => order.id);
  s = confirmDemoPayment(s, a, 1100); states.push(s);
  s = advanceOrder(s, a, 0, 1200); states.push(s);
  s = advanceOrder(s, a, 1, 1300); states.push(s);
  s = inspectWarehouseOrder(s, a, {condition: 'ok', quantityReceived: 1, notes: '', services: [], packageGroup: ''}, 1400); states.push(s);
  s = cancelOrder(s, b, 1500); states.push(s);
  s = checkout(addToCart(s, storeItem('c'), 'US 10', 1600), 'k2', 1601); states.push(s);
  return states;
}

test('incremental projection after every save equals a full rebuild of the final document', async () => {
  const states = journey(), other = journey().slice(0, 4);
  const incremental = memoryD1();
  let previous = null;
  for (const [index, state] of states.entries()) { await writeProjection(incremental, 'email:anna@x.uz', state, {now: 10_000 + index, previous}); previous = state; }
  previous = null;
  for (const [index, state] of other.entries()) { await writeProjection(incremental, 'phone:+998901112233', state, {now: 20_000 + index, previous}); previous = state; }
  const full = memoryD1();
  await writeProjection(full, 'email:anna@x.uz', states.at(-1), {now: 99_000});
  await writeProjection(full, 'phone:+998901112233', other.at(-1), {now: 99_000});
  const left = dump(incremental), right = dump(full);
  assert.ok(left.records.length === 5 && left.events.length > 5 && left.finance.length === 5);
  assert.deepEqual(left, right);
});

test('a save that changes no order writes one statement (the customer row), not the whole history', async () => {
  const states = journey(), db = memoryD1();
  await writeProjection(db, 'email:anna@x.uz', states[1], {now: 1, previous: states[0]});
  const before = db.written;
  const result = await writeProjection(db, 'email:anna@x.uz', states[2], {now: 2, previous: states[1]}); // favorites only
  assert.equal(result.orders.length, 0);
  assert.equal(db.written - before, 1);
  // A payment touches one order only.
  const paid = await writeProjection(db, 'email:anna@x.uz', states[3], {now: 3, previous: states[2]});
  assert.deepEqual(paid.orders.map((order) => order.id), [states[3].orders[0].id]);
});

test('an order whose sync was missed heals on its next change', async () => {
  const states = journey(), db = memoryD1();
  let previous = null;
  for (const [index, state] of states.entries()) {
    // The save of states[4] (purchase step) never reached the projection (background sync failed).
    if (index !== 4) await writeProjection(db, 'email:anna@x.uz', state, {now: index, previous});
    previous = state;
  }
  const full = memoryD1();
  await writeProjection(full, 'email:anna@x.uz', states.at(-1), {now: 99});
  assert.deepEqual(dump(db), dump(full));
});

test('changedOrders: new, edited and payment-entry changes count; equal documents do not', () => {
  const states = journey();
  assert.equal(changedOrders(states[1], null).length, 2);
  assert.equal(changedOrders(states[2], states[1]).length, 0);
  assert.equal(changedOrders(states[1], states[0]).length, 2);
  const [a] = states[3].orders;
  assert.deepEqual(changedOrders(states[3], states[2]).map((order) => order.id), [a.id]);
  // The demo payment entry alone (the auto ledger reads it) changes the fingerprint.
  const withoutEntry = {...states[3], entries: states[3].entries.filter((entry) => entry.id !== 'demo-payment:' + a.id)};
  assert.notEqual(orderFingerprint(a, states[3].entries), orderFingerprint(a, withoutEntry.entries));
  assert.deepEqual(changedOrders(states[3], withoutEntry).map((order) => order.id), [a.id]);
  assert.deepEqual(vanishedOrderIds(states[2], states[3]), []);
  assert.deepEqual(vanishedOrderIds({...states[3], orders: [a]}, states[3]), [states[3].orders[1].id]);
});

test('an order number owned by another customer is never overwritten, incrementally or in full', async () => {
  const states = journey(), db = memoryD1();
  await writeProjection(db, 'email:anna@x.uz', states[1], {now: 1});
  const taken = states[1].orders[0].id;
  const intruder = {...states[3]};
  const result = await writeProjection(db, 'tg:42', intruder, {now: 2, previous: states[0]});
  assert.equal(result.foreign.has(taken), true);
  assert.equal(result.orders.some((order) => order.id === taken), false);
  assert.equal(db.sqlite.prepare('SELECT customer_id FROM market_order_records WHERE id=?').get(taken).customer_id, 'email:anna@x.uz');
  assert.equal(db.sqlite.prepare('SELECT customer_id FROM market_order_finance WHERE order_id=?').get(taken).customer_id, 'email:anna@x.uz');
});
