import {env} from 'cloudflare:workers';
import {database, pricing, recordAudit} from './server';
import {effectiveFx} from './domain';
import {accountingSettings} from './finance-server';
import {autoActor} from './finance-auto';
import {brightDataApiOrigin, brightDataDatasets, brightDataSettingsKey, brightDataSettingsSchema, brightDataStoreNames, paidRecordsByDay, parseBrightDataSettings, tashkentMonth, type BrightDataSettings, type BrightDataStore} from '@/lib/importer/brightdata';
import {d1BrightDataJobs, tashkentDay, type D1Like} from '@/lib/importer/brightdata-d1';
import {brightDataLedgerPrefix, planBrightDataLedger} from './provider-ledger';

type Operator = {userId: string; email: string};
const db = () => database() as unknown as D1Like;
const apiKey = () => (env as unknown as {BRIGHTDATA_API_KEY?: string}).BRIGHTDATA_API_KEY?.trim() ?? '';

export async function brightDataSettings(): Promise<BrightDataSettings> {
  const row = await database().prepare('SELECT value FROM market_settings WHERE key=?').bind(brightDataSettingsKey).first<{value: string}>();
  return parseBrightDataSettings(row?.value);
}
export async function saveBrightDataSettings(value: unknown, user: Operator) {
  const current = await brightDataSettings(), patch = Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined));
  const next = brightDataSettingsSchema.parse({...current, ...patch, stores: {...current.stores, ...(patch.stores as object | undefined)}});
  await database().prepare('INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by')
    .bind(brightDataSettingsKey, JSON.stringify(next), Date.now(), user.userId).run();
  await recordAudit(user, 'providers.brightdata.settings', 'settings', brightDataSettingsKey, next);
  return next;
}

/**
 * Collections the customer stopped waiting for still finish (and are billed) on Bright Data's side: ask Bright Data
 * about running jobs older than a minute and record their outcome, so the usage and the books match the invoice.
 */
export async function settleBrightDataJobs(now = Date.now(), limit = 25) {
  const key = apiKey();
  if (!key) return 0;
  const rows = await database().prepare("SELECT snapshot_id FROM market_provider_jobs WHERE provider='brightdata' AND status='running' AND created_at < ? ORDER BY created_at LIMIT ?").bind(now - 60_000, limit).all<{snapshot_id: string}>();
  const jobs = d1BrightDataJobs(db());
  let settled = 0;
  for (const row of rows.results) {
    try {
      const response = await fetch(`${brightDataApiOrigin}/datasets/v3/progress/${row.snapshot_id}`, {headers: {Authorization: `Bearer ${key}`}, signal: AbortSignal.timeout(8000)});
      if (response.status === 404) { await jobs.finish(row.snapshot_id, 'failed', 0, now, 'not found'); settled++; continue; }
      if (!response.ok) continue;
      const progress = await response.json() as {status?: string; records?: number};
      if (progress.status === 'ready') { await jobs.finish(row.snapshot_id, Number(progress.records) > 0 ? 'ready' : 'empty', Math.max(0, Math.floor(Number(progress.records) || 0)), now); settled++; }
      else if (progress.status === 'failed') { await jobs.finish(row.snapshot_id, 'failed', 0, now, 'collection failed'); settled++; }
    } catch { /* the next run asks again */ }
  }
  return settled;
}

type DayRow = {day: string; store: string; records: number};
async function daysOf(month: string) {
  const rows = await database().prepare("SELECT day,store,SUM(records) AS records FROM market_provider_jobs WHERE provider='brightdata' AND month=? AND day IS NOT NULL GROUP BY day,store").bind(month).all<DayRow>();
  const totals = new Map<string, number>(), stores: Record<string, Record<string, number>> = {};
  for (const row of rows.results) {
    totals.set(row.day, (totals.get(row.day) ?? 0) + Number(row.records));
    (stores[row.day] ??= {})[brightDataStoreNames[row.store as BrightDataStore] ?? row.store] = Number(row.records);
  }
  return {days: [...totals].map(([day, records]) => ({day, records})), stores};
}

/** Posts the paid Bright Data records of finished days (this month and the last) as "Сервисы и хостинг" expenses. */
export async function syncBrightDataLedger(now = Date.now()) {
  const settings = await brightDataSettings();
  if (!settings.ledger) return {inserted: 0, skipped: []};
  const today = tashkentDay(now), month = tashkentMonth(now), previous = tashkentMonth(new Date(month + '-01T00:00:00Z').getTime() - 86_400_000 - 5 * 3600_000);
  const [accounting, tariff] = await Promise.all([accountingSettings(), pricing()]);
  // The provider is paid in dollars by card: the Central Bank rate, without Atlas's customer markup.
  const usdRate = tariff.fxCbuRate ?? effectiveFx(tariff);
  let inserted = 0;
  const skipped: {day: string; reason: string}[] = [];
  for (const selected of [previous, month]) {
    const {days, stores} = await daysOf(selected);
    if (!days.length) continue;
    const existing = await database().prepare('SELECT id FROM market_ledger_entries WHERE id LIKE ? AND occurred_on >= ? AND occurred_on <= ?').bind(brightDataLedgerPrefix + '%', selected + '-01', selected + '-31').all<{id: string}>();
    const plan = planBrightDataLedger(days, settings, {today, usdRate, accounting, existingIds: new Set(existing.results.map(row => row.id)), stores});
    skipped.push(...plan.skipped);
    for (const entry of plan.insert) {
      const result = await database().prepare('INSERT OR IGNORE INTO market_ledger_entries (id,kind,amount_uzs,original_amount,original_currency,occurred_on,order_id,counterparty,note,created_by,created_at) VALUES (?,?,?,?,?,?,NULL,?,?,?,?)')
        .bind(entry.id, entry.kind, entry.amountUzs, entry.originalAmount ?? null, entry.originalCurrency ?? null, entry.occurredOn, entry.counterparty ?? null, entry.note ?? null, autoActor, now).run();
      if (result.meta.changes) inserted++;
    }
  }
  return {inserted, skipped};
}

export type ProviderJobView = {snapshotId: string; store: string; status: string; records: number; purpose: string; url: string; error?: string; createdAt: number; finishedAt?: number};
export type ProviderUsage = {
  provider: 'brightdata'; month: string; configured: boolean; settings: BrightDataSettings; datasets: Record<string, string>;
  used: number; running: number; freeLeft: number; paidRecords: number; costUsd: number; limitLeft: number;
  stores: {store: string; name: string; jobs: number; records: number; failed: number}[];
  days: {day: string; records: number; paidRecords: number; usd: number; posted: boolean}[];
  postedUzs: number; skipped: {day: string; reason: string}[]; jobs: ProviderJobView[];
};

/** The "Сервисы" tab: this month's collections, the free allowance left, the cost and what the books already carry. */
export async function brightDataUsage(month: string, skipped: {day: string; reason: string}[] = []): Promise<ProviderUsage> {
  const settings = await brightDataSettings();
  const [byStore, {days}, recent, posted] = await Promise.all([
    database().prepare("SELECT store,COUNT(*) AS jobs,SUM(records) AS records,SUM(CASE WHEN status IN ('failed','empty') THEN 1 ELSE 0 END) AS failed,SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) AS running FROM market_provider_jobs WHERE provider='brightdata' AND month=? GROUP BY store").bind(month).all<{store: string; jobs: number; records: number; failed: number; running: number}>(),
    daysOf(month),
    database().prepare("SELECT snapshot_id,store,status,records,purpose,url,error,created_at,finished_at FROM market_provider_jobs WHERE provider='brightdata' AND month=? ORDER BY created_at DESC LIMIT 50").bind(month).all<{snapshot_id: string; store: string; status: string; records: number; purpose: string; url: string; error: string | null; created_at: number; finished_at: number | null}>(),
    database().prepare('SELECT id,amount_uzs FROM market_ledger_entries WHERE id LIKE ? AND voided_at IS NULL AND occurred_on >= ? AND occurred_on <= ?').bind(brightDataLedgerPrefix + '%', month + '-01', month + '-31').all<{id: string; amount_uzs: number}>(),
  ]);
  const records = byStore.results.reduce((sum, row) => sum + Number(row.records ?? 0), 0);
  const running = byStore.results.reduce((sum, row) => sum + Number(row.running ?? 0), 0);
  const charges = paidRecordsByDay(days, settings.freeRecordsPerMonth, settings.pricePer1kUsd);
  const postedIds = new Set(posted.results.map(row => row.id));
  const paidRecords = charges.reduce((sum, charge) => sum + charge.paidRecords, 0);
  return {
    provider: 'brightdata', month, configured: Boolean(apiKey()), settings, datasets: brightDataDatasets,
    used: records + running, running, freeLeft: Math.max(0, settings.freeRecordsPerMonth - records), paidRecords,
    costUsd: Math.round(paidRecords * settings.pricePer1kUsd / 1000 * 100) / 100, limitLeft: Math.max(0, settings.monthlyRecordLimit - records - running),
    stores: (Object.keys(brightDataDatasets) as BrightDataStore[]).map(store => {
      const row = byStore.results.find(item => item.store === store);
      return {store, name: brightDataStoreNames[store], jobs: Number(row?.jobs ?? 0), records: Number(row?.records ?? 0), failed: Number(row?.failed ?? 0)};
    }),
    days: charges.map(charge => ({...charge, posted: postedIds.has(brightDataLedgerPrefix + charge.day)})),
    postedUzs: posted.results.reduce((sum, row) => sum + row.amount_uzs, 0), skipped,
    jobs: recent.results.map(row => ({snapshotId: row.snapshot_id, store: row.store, status: row.status, records: row.records, purpose: row.purpose, url: row.url, ...(row.error ? {error: row.error} : {}), createdAt: row.created_at, ...(row.finished_at !== null ? {finishedAt: row.finished_at} : {})})),
  };
}

/** Settles finished jobs and posts finished days; never fails the caller (books, catalog cron). */
export async function refreshProviderBooks(now = Date.now()) {
  try { await settleBrightDataJobs(now); } catch (error) { console.warn('[brightdata] settle failed', (error as Error).name); }
  try { return await syncBrightDataLedger(now); } catch (error) { console.warn('[brightdata] ledger sync failed', (error as Error).name); return {inserted: 0, skipped: []}; }
}
