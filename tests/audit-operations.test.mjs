import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {products, blank, addToCart, cartSignature, checkoutCart as checkoutCore, confirmDemoPayment, advanceOrder, inspectWarehouseOrder, cancelOrder, saveDeliveryProfile, updateOrderIssueCase, parseState, setParcel, receiveOrder, requestExtraCharge, readyToWeigh, parcelStageOf} from '../lib/market/domain.ts';
import {customsVersion} from '../lib/market/world.ts';
import {operatorQueue, operatorQueueCounts, queueSummaries} from '../lib/market/operator-queue-server.ts';
import {orderCredit, operatorNextStep, orderIdleDays, parseQueueCursor, queueTabTotals, queueCursor, queueMatches, queueSearchFields, queueTabsOf, slimQueueAccount} from '../lib/market/operator-queue.ts';

const checkout = (s, key, now) => checkoutCore(s, key, cartSignature(s.cart), false, now, customsVersion);
const storeItem = (id, extra = {}) => ({...products[0], id, name: 'Item ' + id, usd: 30, weight: 0.8, boxedWeight: 0.5, sourceUrl: 'https://shop.example.com/products/' + id, country: 'США', shippingKnown: true, sourceShippingUsd: 0, ...extra});
const profile = (recipient, phone) => ({recipient, phone, region: 'Ташкент', city: 'Самарканд', address: 'ул. Навои, 15', postalCode: '100000', comment: ''});

function memoryD1() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync(new URL('../drizzle/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort())
    for (const part of fs.readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8').split('--> statement-breakpoint')) if (part.trim()) sqlite.exec(part);
  const statement = (sql, args = []) => ({sql, args, bind: (...values) => statement(sql, values), all: async () => ({results: sqlite.prepare(sql).all(...args)})});
  return {sqlite, prepare: (sql) => statement(sql)};
}

// Three customers: a store parcel in the warehouse with a damaged item, a paid-then-cancelled order (credit), an
// open issue on a delivered-looking order, plain new orders, and a customer with a big unrelated history.
function seed() {
  const db = memoryD1(), accounts = [];
  let anna = saveDeliveryProfile(blank(), profile('Анна Каримова', '+998 90 123 45 67'), 'Дом');
  anna = addToCart(anna, storeItem('a'), 'US 9', 1000);
  anna = addToCart(anna, storeItem('b'), 'US 9', 1000);
  anna = checkout(anna, 'k1', 1001);
  const [a, b] = anna.orders.map((order) => order.id);
  for (const id of [a, b]) { anna = confirmDemoPayment(anna, id, 1100); anna = advanceOrder(anna, id, 0, 1200); anna = advanceOrder(anna, id, 1, 1300); }
  anna = inspectWarehouseOrder(anna, a, {condition: 'damaged', quantityReceived: 1, notes: 'Порван', services: [], packageGroup: ''}, 1400);
  anna = {...anna, communication: {...anna.communication, phone: '+998 91 555 44 33'}};
  accounts.push({id: 'email:anna@x.uz', name: 'Анна', state: anna, revision: 7});

  let bob = saveDeliveryProfile(blank(), profile('Бобур Алиев', '+998 93 000 11 22'), 'Дом');
  bob = checkout(addToCart(bob, storeItem('c', {name: 'Синий рюкзак'}), 'US 9', 2000), 'k2', 2001);
  const c = bob.orders[0].id;
  bob = cancelOrder(confirmDemoPayment(bob, c, 2100), c, 2200);
  bob = checkout(addToCart(bob, storeItem('d'), 'US 9', 2300), 'k3', 2301);
  bob = updateOrderIssueCase(bob, bob.orders.find((order) => !order.cancelled).id, 'merchant', 'open', undefined, 2400);
  bob = checkout(addToCart(bob, storeItem('e'), 'US 9', 2500), 'k4', 2501);
  accounts.push({id: 'tg:42', name: 'Бобур', state: bob, revision: 3});

  let carl = blank();
  for (let index = 0; index < 6; index++) carl = checkout(addToCart(saveDeliveryProfile(carl, profile('Карл', '+998 97 777 66 55'), 'Дом'), storeItem('x' + index), 'US 9', 3000 + index * 10), 'kx' + index, 3001 + index * 10);
  carl = {...carl, favorites: Array.from({length: 300}, (_, index) => 'fav-' + index), supportTickets: []};
  accounts.push({id: 'phone:+998977776655', name: 'Карл', state: carl, revision: 1});
  for (const account of accounts) db.sqlite.prepare('INSERT INTO market_accounts (user_id,name,state,revision,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(account.id, account.name, JSON.stringify(account.state), account.revision, 1, 9);
  return {db, accounts};
}
const allOrders = (accounts) => accounts.flatMap((account) => account.state.orders.map((order) => ({account, order})));
const tabsFull = ({account, order}) => queueTabsOf(order, orderCredit(account.state.entries, order.id));

test('light summaries classify every order exactly like the full order (tabs, counts, search fields)', async () => {
  const {db, accounts} = seed();
  const summaries = await queueSummaries(db);
  const full = allOrders(accounts);
  assert.equal(summaries.length, full.length);
  for (const item of full) {
    const summary = summaries.find((row) => row.id === item.order.id && row.accountId === item.account.id);
    assert.ok(summary, item.order.id);
    assert.deepEqual(queueTabsOf(summary.order, summary.credit), tabsFull(item), item.order.id);
    assert.deepEqual(summary.search, JSON.parse(JSON.stringify(queueSearchFields(item.order, item.account))));
  }
  const counts = await operatorQueueCounts(db);
  for (const key of ['active', 'attention', 'done', 'refunds', 'weighing']) assert.equal(counts[key], full.filter((item) => tabsFull(item)[key]).length, key);
  assert.ok(counts.attention >= 2 && counts.refunds >= 1 && counts.weighing >= 1);
});

test('pages of a tab are newest first, never overlap and together hold every matching order', async () => {
  const {db, accounts} = seed();
  for (const tab of ['active', 'attention', 'done', 'refunds']) {
    const expected = allOrders(accounts).filter((item) => tabsFull(item)[tab]).sort((x, y) => y.order.createdAt - x.order.createdAt);
    const seen = [];
    let cursor = null, guard = 0;
    do {
      const page = await operatorQueue(db, {tab, cursor, limit: 2});
      assert.equal(page.total, expected.length);
      assert.ok(page.orderIds.length <= 2);
      seen.push(...page.orderIds);
      cursor = page.nextCursor;
    } while (cursor && ++guard < 20);
    assert.deepEqual(new Set(seen).size, seen.length, tab);
    assert.deepEqual(seen.toSorted(), expected.map((item) => item.order.id).toSorted(), tab);
    const times = seen.map((id) => expected.find((item) => item.order.id === id).order.createdAt);
    assert.deepEqual(times, times.toSorted((x, y) => y - x), tab);
  }
});

test('a page carries trimmed accounts: listed orders and their parcel, related entries, revision for actions', async () => {
  const {db, accounts} = seed();
  const page = await operatorQueue(db, {tab: 'attention', q: 'Анна'});
  const anna = accounts[0];
  const damaged = anna.state.orders.find((order) => order.warehouseInspection?.condition === 'damaged');
  assert.deepEqual(page.orderIds, [damaged.id]);
  assert.equal(page.accounts.length, 1);
  const [sent] = page.accounts;
  assert.deepEqual([sent.id, sent.name, sent.revision], [anna.id, anna.name, anna.revision]);
  // The parcel sibling travels along (one weighing settles both); no cart, favorites or delivery profiles.
  assert.deepEqual(sent.state.orders.map((order) => order.id).toSorted(), anna.state.orders.map((order) => order.id).toSorted());
  assert.deepEqual(sent.state.cart, []);
  assert.deepEqual(sent.state.deliveryProfiles, []);
  assert.equal(sent.state.communication.phone, '+998 91 555 44 33');
  assert.ok(sent.state.entries.length > 0 && sent.state.entries.every((entry) => sent.state.orders.some((order) => order.id === entry.orderId)));
  // The same trimmed account as the pure helper builds from the full document (the client uses it after actions).
  const expected = slimQueueAccount({...anna, updatedAt: 9}, new Set(page.orderIds));
  assert.deepEqual(sent, JSON.parse(JSON.stringify(expected)));
  assert.deepEqual(parseState(JSON.stringify(sent.state)), sent.state);
});

test('search runs on the server: item, recipient, phone digits, order number; one order by link whatever its tab', async () => {
  const {db, accounts} = seed();
  const bob = accounts[1];
  const backpack = bob.state.orders.find((order) => order.product.name === 'Синий рюкзак');
  assert.deepEqual((await operatorQueue(db, {tab: 'refunds', q: 'рюкзак'})).orderIds, [backpack.id]);
  assert.deepEqual((await operatorQueue(db, {tab: 'active', q: 'рюкзак'})).orderIds, []);
  assert.equal((await operatorQueue(db, {tab: 'active', q: '7776655'})).total, 6);
  assert.equal((await operatorQueue(db, {tab: 'active', q: 'Самарканд'})).total, (await operatorQueue(db, {tab: 'active'})).total);
  const byLink = await operatorQueue(db, {tab: 'active', order: backpack.id});
  assert.deepEqual(byLink.orderIds, [backpack.id]);
  assert.equal(byLink.accounts[0].id, bob.id);
  assert.equal(queueMatches(queueSearchFields(backpack, bob), backpack.id.toLowerCase()), true);
});

test('the page is far smaller than the full documents the old queue sent', async () => {
  const {db, accounts} = seed();
  const page = await operatorQueue(db, {tab: 'attention'});
  const old = JSON.stringify({accounts: accounts.map((account) => ({...account, updatedAt: 9}))}).length;
  assert.ok(JSON.stringify(page).length < old / 2, `${JSON.stringify(page).length} vs ${old}`);
});

test('queue cursor round-trips ids with separators', () => {
  const item = {createdAt: 5, accountId: 'email:a:b@x.uz', id: 'AT-1:2'};
  assert.deepEqual(parseQueueCursor(queueCursor(item)), item);
  assert.equal(parseQueueCursor('junk'), null);
  assert.equal(parseQueueCursor(''), null);
});

test('load more merges pages of one customer: newer copy wins, nothing is lost', async () => {
  const {db, accounts} = seed();
  const {mergeQueueAccounts} = await import('../lib/market/operator-queue.ts');
  const first = await operatorQueue(db, {tab: 'active', limit: 3});
  const second = await operatorQueue(db, {tab: 'active', limit: 3, cursor: first.nextCursor});
  const merged = mergeQueueAccounts(first.accounts, second.accounts);
  const ids = merged.flatMap((account) => account.state.orders.map((order) => order.id));
  for (const id of [...first.orderIds, ...second.orderIds]) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(merged.map((account) => account.id)).size, merged.length);
  const carl = merged.find((account) => account.id === accounts[2].id);
  assert.equal(carl.revision, accounts[2].revision);
});

// The queue row says whose move an order waits for (app/order-workspace.tsx): "yours" with a moving step exactly where
// the operator's main button can move the order on the server (advanceOrder, or weighing via readyToWeigh).
test('operatorNextStep: the operator step is shown exactly where the order can move on', () => {
  const moving = new Set(['buyout', 'receive', 'weigh', 'ship', 'toCustoms', 'toTashkent', 'deliver']);
  const canMove = (state, order) => {
    if (order.status === 2) return readyToWeigh(order);
    try { advanceOrder(state, order.id, parcelStageOf(order), 9000); return true; } catch { return false; }
  };
  const seen = [];
  const look = (state, id, expected) => {
    const order = state.orders.find((item) => item.id === id);
    const step = operatorNextStep(order);
    seen.push(step?.key ?? null);
    assert.deepEqual(step && {kind: step.kind, key: step.key}, expected, `${order.id} status ${order.status}`);
    if (!order.cancelled && order.status < 5) assert.equal(step.kind === 'yours' && moving.has(step.key), canMove(state, order), `${step.key} vs main button`);
  };
  let s = saveDeliveryProfile(blank(), profile('Анна Каримова', '+998 90 123 45 67'), 'Дом');
  s = checkout(addToCart(s, storeItem('p1'), 'US 9', 1000), 'p1', 1001);
  const id = s.orders[0].id;
  look(s, id, {kind: 'waiting', key: 'payment'});
  s = confirmDemoPayment(s, id, 1100);
  look(s, id, {kind: 'yours', key: 'buyout'});
  const withExtra = requestExtraCharge(s, id, 5, 'Цена в магазине выросла', 1150);
  look(withExtra, id, {kind: 'waiting', key: 'decision'});
  s = advanceOrder(s, id, 0, 1200);
  look(s, id, {kind: 'yours', key: 'receive'});
  s = advanceOrder(s, id, 1, 1300);
  look(s, id, {kind: 'yours', key: 'inspect'});
  const damaged = inspectWarehouseOrder(s, id, {condition: 'damaged', quantityReceived: 1, notes: 'Порван', services: [], packageGroup: ''}, 1400);
  look(damaged, id, {kind: 'yours', key: 'problem'});
  s = inspectWarehouseOrder(s, id, {condition: 'ok', quantityReceived: 1, notes: '', services: [], packageGroup: ''}, 1400);
  look(s, id, {kind: 'yours', key: 'weigh'});
  assert.deepEqual(operatorNextStep(s.orders[0], {weighLeadId: 'AT-LEAD'}), {kind: 'waiting', key: 'weighTogether', leadId: 'AT-LEAD'});
  s = receiveOrder(s, id, [0.3, 10, 10, 10], 1500);
  look(s, id, {kind: 'yours', key: 'tracking'});
  s = setParcel(s, id, 'DHL', 'TRK123', 'TAS-1', 1600);
  look(s, id, {kind: 'yours', key: 'ship'});
  s = advanceOrder(s, id, 3, 1700);
  // On its way: the operator marks "Таможня", then "В Ташкенте", then the delivery (1 November 2026).
  look(s, id, {kind: 'yours', key: 'toCustoms'});
  s = advanceOrder(s, id, 4, 1750);
  look(s, id, {kind: 'yours', key: 'toTashkent'});
  s = advanceOrder(s, id, 5, 1760);
  look(s, id, {kind: 'yours', key: 'deliver'});
  s = advanceOrder(s, id, 6, 1800);
  look(s, id, null);
  assert.deepEqual(seen, ['payment', 'buyout', 'decision', 'receive', 'inspect', 'problem', 'weigh', 'tracking', 'ship', 'toCustoms', 'toTashkent', 'deliver', null]);

  // A store charges its own shipping: confirming it comes before the buyout.
  let t = saveDeliveryProfile(blank(), profile('Бобур Алиев', '+998 93 000 11 22'), 'Дом');
  t = checkout(addToCart(t, storeItem('p2', {sourceShippingEstimated: true, sourceShippingUsd: 8}), 'US 9', 2000), 'p2', 2001);
  t = confirmDemoPayment(t, t.orders[0].id, 2100);
  look(t, t.orders[0].id, {kind: 'yours', key: 'storeShipping'});
  // A cancelled order is done, unless an issue is still open.
  const cancelled = cancelOrder(t, t.orders[0].id, 2200);
  assert.equal(operatorNextStep(cancelled.orders[0]), null);
  assert.deepEqual(operatorNextStep(updateOrderIssueCase(cancelled, cancelled.orders[0].id, 'merchant', 'open', undefined, 2300).orders[0]), {kind: 'yours', key: 'problem'});
});

test('operatorNextStep: a delivered order whose duty Atlas pays but never settled is the operator\'s customs step', () => {
  let s = saveDeliveryProfile(blank(), profile('Анна Каримова', '+998 90 123 45 67'), 'Дом');
  s = checkout(addToCart(s, storeItem('p3'), 'US 9', 1000), 'p3', 1001);
  const base = s.orders[0];
  // Older orders reached status 5 before the duty rule; the card still shows the "confirm duty" button.
  const delivered = {...base, status: 5, quote: {...base.quote, customsHelp: 4000, customsDuty: 120000}};
  assert.deepEqual(operatorNextStep(delivered), {kind: 'yours', key: 'customs'});
  // Settled duty, or no customs help at all: nothing left to do.
  assert.equal(operatorNextStep({...delivered, customsSettlement: {estimated: 120000, actual: 120000, actualUsd: 10, refund: 0, extra: 0, at: 2000}}), null);
  assert.equal(operatorNextStep({...base, status: 5}), null);
  // An open problem still comes first; a cancelled order never asks for the duty.
  assert.deepEqual(operatorNextStep(updateOrderIssueCase({...s, orders: [delivered]}, delivered.id, 'merchant', 'open', undefined, 2300).orders[0]), {kind: 'yours', key: 'problem'});
  assert.equal(operatorNextStep({...delivered, cancelled: true}), null);
});

test('orderIdleDays counts whole days since the last order event', () => {
  const order = {createdAt: 0, history: [{at: 1000}, {at: 86400000 * 2 + 1000}]};
  assert.equal(orderIdleDays(order, 86400000 * 2 + 1000), 0);
  assert.equal(orderIdleDays(order, 86400000 * 5), 2);
  assert.equal(orderIdleDays({createdAt: 0, history: []}, 86400000 * 3.5), 3);
  assert.equal(orderIdleDays({createdAt: 5000, history: []}, 0), 0);
});

test('queueTabTotals: the admin overview counts the same orders as the /operations tabs', async () => {
  const {db, accounts} = seed();
  const counts = await operatorQueueCounts(db);
  assert.deepEqual(queueTabTotals(accounts), {active: counts.active, attention: counts.attention});
  assert.deepEqual(queueTabTotals([]), {active: 0, attention: 0});
});
