import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectBackup,requiredTables} from '../scripts/check-migration-backup.mjs';

test('a partial backup must not be accepted as complete', () => {
  const result = inspectBackup({tables: {market_accounts: []}});
  assert.equal(result.tablesComplete, false);
  assert.ok(result.missing.includes('market_auth_sessions'));
  assert.ok(result.missing.includes('market_identity_documents'));
});

test('all required tables must be present and arrays', () => {
  const tables = Object.fromEntries(requiredTables.map(name => [name, []]));
  assert.equal(inspectBackup({tables}).tablesComplete, true);
  tables.market_accounts = null;
  assert.deepEqual(inspectBackup({tables}).invalid, ['market_accounts']);
});
