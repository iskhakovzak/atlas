import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {d1BrightDataJobs} from '../lib/importer/brightdata-d1.ts';

/** The real migration in an in-memory SQLite behind the D1 calls the job store uses. */
function sqliteD1() {
  const raw = new DatabaseSync(':memory:');
  for (const statement of readFileSync(new URL('../drizzle/0012_provider_jobs.sql', import.meta.url), 'utf8').split('--> statement-breakpoint')) raw.exec(statement);
  const db = {prepare(query) {
    const statement = raw.prepare(query);
    return {bind: (...values) => ({
      first: async () => statement.get(...values) ?? null,
      run: async () => ({meta: {changes: Number(statement.run(...values).changes)}}),
      all: async () => ({results: statement.all(...values)}),
    })};
  }};
  return {raw, db};
}

test('D1 reservation: one running job per product; stale reservations and finished jobs free it', async () => {
  const {raw, db} = sqliteD1();
  const jobs = d1BrightDataJobs(db);
  const t = Date.UTC(2026, 9, 10, 12);
  const job = (snapshotId, createdAt) => ({snapshotId, store: 'walmart', dataset: 'gd', key: 'walmart:1', url: 'https://www.walmart.com/ip/1', purpose: 'customer', createdAt});
  assert.equal(await jobs.claim(job('claim:a', t), t - 60_000), true);
  assert.equal(await jobs.claim(job('claim:b', t + 10), t + 10 - 60_000), false, 'a fresh reservation blocks a second request');
  assert.equal(await jobs.claim(job('claim:c', t + 61_000), t + 1_000), true, 'a reservation without a snapshot stops blocking after a minute');
  await jobs.assign('claim:c', 'sd_1');
  assert.equal(await jobs.claim(job('claim:d', t + 20 * 60_000), t + 19 * 60_000), false, 'a running collection blocks for its whole life');
  await jobs.finish('sd_1', 'ready', 1, t + 21 * 60_000);
  assert.equal(await jobs.claim(job('claim:e', t + 22 * 60_000), t + 21 * 60_000), true);
  assert.equal((await jobs.latest('walmart:1', t)).snapshotId, 'claim:e');
  assert.deepEqual(raw.prepare("SELECT snapshot_id, status FROM market_provider_jobs ORDER BY created_at").all().map(row => [row.snapshot_id, row.status]),
    [['claim:a', 'running'], ['sd_1', 'ready'], ['claim:e', 'running']]);
  assert.equal(await jobs.used('2026-10'), 3, 'running jobs count as one record each until settled');
});
