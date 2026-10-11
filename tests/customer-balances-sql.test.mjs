import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { customerBalancesSql } from '../lib/market/finance.ts';
import { balanceOf } from '../lib/market/domain.ts';

const entry = (amount, debit, credit) => ({ id: 'E' + Math.random(), orderId: 'O', at: 1, amount, debit, credit, description: '' });
const states = {
  credited: { entries: [entry(50_000, 'cash', 'customer-credit'), entry(20_000, 'customer-credit', 'order')] },
  spentAll: { entries: [entry(10_000, 'cash', 'customer-credit'), entry(10_000, 'customer-credit', 'order')] },
  overdrawn: { entries: [entry(5_000, 'customer-credit', 'order')] },
  unrelated: { entries: [entry(99_000, 'cash', 'order')] },
  empty: { entries: [] },
};

test('the SQL balance sum matches balanceOf and keeps only positive balances', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE market_accounts (user_id TEXT PRIMARY KEY, state TEXT)');
  const insert = db.prepare('INSERT INTO market_accounts VALUES (?, ?)');
  for (const [id, state] of Object.entries(states)) insert.run(id, JSON.stringify(state));
  insert.run('broken', '{not json');
  const sql = db.prepare(customerBalancesSql).all().map(row => row.balance).sort((a, b) => a - b);
  const js = Object.values(states).map(state => balanceOf(state)).filter(value => value > 0).sort((a, b) => a - b);
  assert.deepEqual(sql, js);
  assert.deepEqual(sql, [30_000]);
});
