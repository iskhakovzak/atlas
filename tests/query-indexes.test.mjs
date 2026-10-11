import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const statements = (tag) => readFileSync(new URL(`../drizzle/${tag}.sql`, import.meta.url), 'utf8').split('--> statement-breakpoint').filter(statement => statement.trim());
/** Migrations in journal order (all, or those `keep` allows), in an in-memory SQLite (D1 is SQLite). */
function migrated(keep = () => true) {
  const raw = new DatabaseSync(':memory:');
  const journal = JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
  for (const {tag} of journal.entries) if (keep(tag)) for (const statement of statements(tag)) raw.exec(statement);
  return raw;
}
const plan = (raw, query) => raw.prepare(`EXPLAIN QUERY PLAN ${query}`).all().map(row => row.detail).join(' | ');

test('the queries that filter or sort on a column use an index, not a full table scan', () => {
  const raw = migrated();
  const cases = [
    ['DELETE FROM market_rate_limits WHERE expires_at < 1', 'idx_market_rate_limits_expires'],
    ['DELETE FROM market_import_cache WHERE expires_at < 1', 'idx_market_import_cache_expires'],
    ['SELECT user_id,name,state,revision,updated_at FROM market_accounts ORDER BY updated_at DESC LIMIT 200', 'idx_market_accounts_updated'],
    ["SELECT user_id,email,method,created_at FROM market_auth_sessions WHERE email IN ('a@b.c','d@e.f')", 'idx_market_auth_sessions_email'],
    ["SELECT id FROM market_audit_events WHERE actor_email='a@b.c' ORDER BY created_at DESC LIMIT 50", 'idx_market_audit_events_actor_created'],
    ["SELECT id FROM market_audit_events WHERE entity_type='order' ORDER BY created_at DESC LIMIT 50", 'idx_market_audit_events_type_created'],
    ['SELECT DISTINCT actor_email FROM market_audit_events ORDER BY actor_email LIMIT 200', 'idx_market_audit_events_actor_created'],
    ["SELECT id FROM market_operational_errors WHERE area='client' AND message='x' AND resolved_at IS NULL AND created_at>1 ORDER BY created_at DESC LIMIT 1", 'idx_market_operational_errors_problem'],
    ['SELECT * FROM market_order_finance ORDER BY created_at ASC LIMIT 20000', 'idx_market_order_finance_created'],
    ["SELECT * FROM market_order_finance WHERE status IN ('pending','paid') ORDER BY created_at DESC LIMIT 5000", 'idx_market_order_finance_status_created'],
    ["SELECT id FROM market_ledger_entries WHERE kind='expense' AND voided_at IS NULL AND occurred_on >= '2026-10-01' AND occurred_on <= '2026-10-31' ORDER BY occurred_on ASC LIMIT 5000", 'idx_market_ledger_entries_kind_occurred'],
    ["SELECT snapshot_id FROM market_provider_jobs WHERE provider='brightdata' AND status='running' AND created_at < 1 ORDER BY created_at LIMIT 20", 'idx_market_provider_jobs_status'],
  ];
  for (const [query, index] of cases) assert.match(plan(raw, query), new RegExp(index), query);
});

test('migrations 0013 and 0014 can run again on a database that already has their indexes', () => {
  const raw = migrated();
  for (const statement of [...statements('0013_query_indexes'), ...statements('0014_more_query_indexes')]) raw.exec(statement);
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name='idx_market_provider_jobs_status'").get().n, 1);
});

test('0014 applies to a database without 0012: its tables come from earlier migrations', () => {
  const raw = migrated(tag => tag < '0012');
  for (const statement of statements('0014_more_query_indexes')) raw.exec(statement);
  const names = statements('0014_more_query_indexes').map(statement => statement.match(/`(idx_[^`]+)`/)[1]);
  assert.equal(names.length, 3);
  for (const name of names) assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name=?").get(name).n, 1, name);
});
