import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openAtlasDatabase } from '../scripts/vps-bindings.mjs';
import { commitPromoAccount, savePromo, findPromo } from '../lib/market/promo-store.ts';

const now = 1_800_000_000_000;
const terms = { code: 'ATOMIC', kind: 'fixed', value: 5000, maxUses: 1, active: true, oncePerCustomer: true };

async function setup(t, overrides = {}) {
  const db = openAtlasDatabase(':memory:');
  t.after(() => db.close());
  db.exec('CREATE TABLE market_accounts(user_id TEXT PRIMARY KEY,state TEXT NOT NULL,revision INTEGER NOT NULL,updated_at INTEGER); CREATE TABLE market_order_finance(order_id TEXT PRIMARY KEY);');
  for (const migration of ['0017_promo_codes.sql', '0018_promo_once_return.sql']) {
    db.exec(readFileSync(new URL('../drizzle/' + migration, import.meta.url), 'utf8'));
  }
  const code = await savePromo(db, { ...terms, ...overrides }, 'operator', now);
  return { db, code };
}

function createAccount(db, userId = 'customer') {
  return db.prepare("INSERT INTO market_accounts VALUES (?,'{}',0,?)").bind(userId, now).run();
}

function loadAccount(db, userId = 'customer') {
  return db.prepare('SELECT state,revision FROM market_accounts WHERE user_id=?').bind(userId).first();
}

function checkout(code, batchId = 'key', userId = 'customer', revision = 0) {
  const order = { id: 'AT-' + batchId, batchId, quote: { promoDiscount: code.value } };
  const use = { rule: code, userId, batchId, orderIds: [order.id], discount: code.value };
  const account = { userId, revision, serialized: JSON.stringify({ checkoutKeys: [batchId], orders: [order] }) };
  return { use, account };
}

function records(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM market_promo_redemptions').first('n');
}

test('atomic promo save commits the canonical order, discount record and use together', async (t) => {
  const { db, code } = await setup(t);
  await createAccount(db);
  const { use, account } = checkout(code);
  assert.deepEqual(await commitPromoAccount(db, use, account, now), { saved: true });
  const stored = await loadAccount(db);
  assert.equal(stored.revision, 1);
  assert.equal(JSON.parse(stored.state).orders[0].id, 'AT-key');
  assert.equal((await findPromo(db, code.code)).uses, 1);
  assert.equal(await records(db), 1);
});

test('an error in the last statement rolls back the checkout and permits a retry', async (t) => {
  const { db, code } = await setup(t);
  await createAccount(db);
  const { use, account } = checkout(code);
  const failing = {
    ...db,
    prepare(sql) {
      return db.prepare(sql.startsWith('INSERT INTO market_promo_redemptions')
        ? 'INSERT INTO missing_table VALUES (?,?,?,?,?,?,?,?)'
        : sql);
    },
  };
  await assert.rejects(commitPromoAccount(failing, use, account, now), /missing_table/);
  assert.deepEqual(await loadAccount(db), { revision: 0, state: '{}' });
  assert.equal((await findPromo(db, code.code)).uses, 0);
  assert.equal(await records(db), 0);
  assert.deepEqual(await commitPromoAccount(db, use, account, now), { saved: true });
  assert.equal((await loadAccount(db)).revision, 1);
  assert.equal((await findPromo(db, code.code)).uses, 1);
  assert.equal(await records(db), 1);
});

test('the checkout key persists and guards against a second write even with the current revision', async (t) => {
  const { db, code } = await setup(t);
  await createAccount(db);
  const { use, account } = checkout(code);
  await commitPromoAccount(db, use, account, now);
  assert.deepEqual(await commitPromoAccount(db, use, { ...account, revision: 1 }, now), { saved: false, code: 'err_4' });
  const stored = JSON.parse((await loadAccount(db)).state);
  assert.deepEqual(stored.checkoutKeys, [use.batchId]);
  assert.equal(stored.orders.length, 1);
  assert.equal((await findPromo(db, code.code)).uses, 1);
  assert.equal(await records(db), 1);
});

test('two simultaneous saves of one revision have a single winner', async (t) => {
  const { db, code } = await setup(t);
  await createAccount(db);
  const { use, account } = checkout(code);
  const results = await Promise.all([1, 2].map(() => commitPromoAccount(db, use, account, now)));
  assert.equal(results.filter((result) => result.saved).length, 1);
  assert.deepEqual(results.find((result) => !result.saved), { saved: false, code: 'err_4' });
  assert.equal((await loadAccount(db)).revision, 1);
  assert.equal((await findPromo(db, code.code)).uses, 1);
  assert.equal(await records(db), 1);
});

test('two customers competing for the last use leave the losing account unchanged', async (t) => {
  const { db, code } = await setup(t);
  const checkouts = ['a', 'b'].map((userId) => checkout(code, 'key-' + userId, userId));
  await Promise.all(checkouts.map(({ use }) => createAccount(db, use.userId)));
  const results = await Promise.all(checkouts.map(({ use, account }) => commitPromoAccount(db, use, account, now)));
  assert.equal(results.filter((result) => result.saved).length, 1);
  const loser = results.findIndex((result) => !result.saved);
  assert.deepEqual(results[loser], { saved: false, code: 'err_89' });
  assert.deepEqual(await loadAccount(db, checkouts[loser].use.userId), { revision: 0, state: '{}' });
  assert.equal((await findPromo(db, code.code)).uses, 1);
  assert.equal(await records(db), 1);
});

test('an unrelated account edit refuses a stale checkout without consuming a use', async (t) => {
  const { db, code } = await setup(t);
  await createAccount(db);
  await db.prepare('UPDATE market_accounts SET revision=1').run();
  const { use, account } = checkout(code);
  assert.deepEqual(await commitPromoAccount(db, use, account, now), { saved: false, code: 'err_4' });
  assert.deepEqual(await loadAccount(db), { revision: 1, state: '{}' });
  assert.equal((await findPromo(db, code.code)).uses, 0);
  assert.equal(await records(db), 0);
});

test('a checkout with a legacy reservation requests a refresh and preserves its record', async (t) => {
  const { db, code } = await setup(t);
  await createAccount(db);
  const { use, account } = checkout(code);
  await db.prepare('UPDATE market_promo_codes SET uses=1').run();
  await db.prepare('INSERT INTO market_promo_redemptions(id,code_id,code,user_id,batch_id,order_ids,discount,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind('legacy', code.id, code.code, 'another-customer', use.batchId, '["retained-old-order"]', 5000, now).run();
  assert.deepEqual(await commitPromoAccount(db, use, account, now), { saved: false, code: 'err_4' });
  assert.equal((await loadAccount(db)).revision, 0);
  assert.equal((await findPromo(db, code.code)).uses, 1);
  assert.equal(await records(db), 1);
});

test('discount terms edited by the operator invalidate the stale calculation', async (t) => {
  const { db, code } = await setup(t);
  await createAccount(db);
  const { use, account } = checkout(code);
  for (const change of [{ value: 6000 }, { minOrder: 12_000 }]) {
    await savePromo(db, { id: code.id, ...terms, ...change }, 'operator', now + 1);
    assert.deepEqual(await commitPromoAccount(db, use, account, now + 1), { saved: false, code: 'err_91' });
  }
  assert.deepEqual(await loadAccount(db), { revision: 0, state: '{}' });
  assert.equal((await findPromo(db, code.code)).uses, 0);
  assert.equal(await records(db), 0);
});

test('the database applies a per-customer limit enabled while checkout was underway', async (t) => {
  const multiple = { oncePerCustomer: false, maxUses: 10 };
  const { db, code } = await setup(t, multiple);
  await createAccount(db);
  const first = checkout(code);
  assert.deepEqual(await commitPromoAccount(db, first.use, first.account, now), { saved: true });
  const second = checkout(code, 'second', first.use.userId, 1);
  await savePromo(db, { id: code.id, ...terms, maxUses: multiple.maxUses }, 'operator', now + 1);
  assert.deepEqual(await commitPromoAccount(db, second.use, second.account, now + 1), { saved: false, code: 'err_96' });
  assert.equal((await loadAccount(db)).revision, 1);
  assert.equal((await findPromo(db, code.code)).uses, 1);
  assert.equal(await records(db), 1);
});
