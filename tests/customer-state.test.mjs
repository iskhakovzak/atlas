// Operators' internal order notes (with the author's address) and the team assignment never reach the customer
// (3 November 2026, lib/market/customer-state.ts); the stored account keeps them through the customer's own saves,
// and operators still read them through /api/operations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {products, blank, addToCart, cartSignature, checkoutCart} from '../lib/market/domain.ts';
import {customsVersion} from '../lib/market/world.ts';
import {customerOrder, customerState} from '../lib/market/customer-state.ts';
import {routeHarness} from './support/route-harness.mjs';

const ann = {userId: 'email:ann@example.uz', email: 'ann@example.uz', displayName: 'Ann'};
const owner = {userId: 'email:owner@atlas.test', email: 'owner@atlas.test', displayName: 'Owner'};
const noteText = 'Клиент спорный, проверить оплату';
const staffEmail = 'staff@atlas.test';

function stateWithStaffWork(now) {
  let state = addToCart(blank(), products[0], 'US 9', now);
  state = checkoutCart(state, 'checkout-key-1', cartSignature(state.cart), false, now + 1, customsVersion);
  state.orders[0] = {...state.orders[0], staffNotes: [{id: 'n1', at: now, author: staffEmail, text: noteText}], assignment: {team: 'Закупки', priority: 'Срочный', assignedAt: now}};
  return state;
}

function seed(h) {
  const now = Date.now();
  h.db.sqlite.prepare('INSERT INTO market_accounts (user_id,name,state,revision,created_at,updated_at) VALUES (?,?,?,?,?,?)')
    .run(ann.userId, 'Ann', JSON.stringify(stateWithStaffWork(now)), 3, now - 1000, now);
}

const stored = (h) => JSON.parse(h.db.sqlite.prepare('SELECT state FROM market_accounts WHERE user_id=?').get(ann.userId).state);

function assertClean(text, label) {
  for (const secret of [noteText, staffEmail, 'Срочный', '"staffNotes"', '"assignment"']) {
    assert.equal(text.includes(secret), false, `${label} must not contain ${secret}`);
  }
}

test('customerState drops only the staff-only order fields and leaves the stored state alone', () => {
  const state = stateWithStaffWork(Date.now());
  const view = customerState(state);
  assert.equal(view.orders[0].staffNotes, undefined);
  assert.equal(view.orders[0].assignment, undefined);
  assert.equal(view.orders[0].id, state.orders[0].id);
  assert.deepEqual(Object.keys(view).sort(), Object.keys(state).sort());
  assert.equal(state.orders[0].staffNotes.length, 1, 'the input is not mutated');
  const plain = view.orders[0];
  assert.equal(customerOrder(plain), plain, 'an order without staff fields is passed through');
});

test('GET /api/account and POST /api/actions answer without staff notes; the next save keeps them in D1', async () => {
  const h = routeHarness();
  seed(h);
  const cookie = h.signIn(ann);
  const {GET} = await h.route('app/api/account/route.ts');
  const read = await h.call(GET, {url: '/api/account', cookie});
  assert.equal(read.status, 200);
  const readText = await read.text();
  assertClean(readText, 'GET /api/account');
  const {revision, state} = JSON.parse(readText);
  assert.equal(revision, 3);
  assert.equal(state.orders.length, 1);

  const {POST} = await h.route('app/api/actions/route.ts');
  const write = await h.call(POST, {method: 'POST', url: '/api/actions', cookie, body: {revision, action: {type: 'favorite', id: products[1].id}}});
  assert.equal(write.status, 200);
  const writeText = await write.text();
  assertClean(writeText, 'POST /api/actions');
  assert.equal(JSON.parse(writeText).revision, 4);
  const saved = stored(h);
  assert.deepEqual(saved.favorites, [products[1].id]);
  assert.equal(saved.orders[0].staffNotes[0].text, noteText, 'the stripped answer did not erase the notes');
  assert.equal(saved.orders[0].assignment.priority, 'Срочный');

  // A stale revision: the 409 carries the current account, also without the staff fields.
  const conflict = await h.call(POST, {method: 'POST', url: '/api/actions', cookie, body: {revision: 3, action: {type: 'favorite', id: products[2].id}}});
  assert.equal(conflict.status, 409);
  assertClean(await conflict.text(), 'the 409 answer');
  assert.equal(stored(h).orders[0].staffNotes.length, 1);
});

test('the operator still reads the notes and the assignment through /api/operations', async () => {
  const h = routeHarness();
  seed(h);
  const {GET} = await h.route('app/api/operations/route.ts');
  const response = await h.call(GET, {url: '/api/operations', cookie: h.signIn(owner)});
  assert.equal(response.status, 200);
  const {accounts} = await response.json();
  const order = accounts.find((account) => account.id === ann.userId).state.orders[0];
  assert.equal(order.staffNotes[0].author, staffEmail);
  assert.equal(order.assignment.team, 'Закупки');
});
