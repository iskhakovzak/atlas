import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

// Never print row contents: account and identity tables contain private information.
export const requiredTables = Object.freeze([
  'market_accounts','market_audit_events','market_auth_challenges','market_auth_links',
  'market_auth_sessions','market_auth_tokens','market_backup_exports','market_customer_notes',
  'market_customers','market_identity_documents','market_import_cache','market_import_outcomes',
  'market_ledger_entries','market_legal_consents','market_operational_errors','market_order_documents',
  'market_order_events','market_order_fee_lines','market_order_finance','market_order_records',
  'market_provider_jobs','market_push_subscriptions','market_rate_limits','market_settings',
  'market_staff_directory','market_web_vitals',
]);

export function inspectBackup(backup) {
  const tables = backup && typeof backup === 'object' && backup.tables && typeof backup.tables === 'object' ? backup.tables : {};
  const missing = requiredTables.filter(name => !Object.hasOwn(tables, name));
  const invalid = requiredTables.filter(name => Object.hasOwn(tables, name) && !Array.isArray(tables[name]));
  return {missing, invalid, tablesComplete: missing.length === 0 && invalid.length === 0};
}

async function main() {
  const [file, expectedHash] = process.argv.slice(2);
  if (!file || !expectedHash || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    console.error('Usage: node scripts/check-migration-backup.mjs <backup.json> <expected-sha256>');
    process.exitCode = 2; return;
  }
  const bytes = await readFile(file);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expectedHash.toLowerCase()) { console.error('Checksum mismatch.'); process.exitCode = 1; return; }
  const result = inspectBackup(JSON.parse(bytes.toString('utf8')));
  console.log(JSON.stringify({checksum: 'verified', ...result, filesVerified: false}));
  // A complete table list alone never confirms R2 files, consistency, or a successful restore.
  if (!result.tablesComplete) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Cannot read or parse backup.'); process.exitCode = 1; });
}
