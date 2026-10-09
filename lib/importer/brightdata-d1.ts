import {brightDataClaimPrefix, brightDataRunningStaleMs, brightDataSettingsKey, parseBrightDataSettings, tashkentMonth, type BrightDataJob, type BrightDataJobs, type BrightDataSettings} from './brightdata.ts';

/** The part of a D1 binding these helpers use (a fake in tests). */
export type D1Like = {prepare(query: string): {bind(...values: unknown[]): {first<T>(): Promise<T | null>; run(): Promise<unknown>; all<T>(): Promise<{results: T[]}>}}};

export const tashkentDay = (at: number) => new Date(at + 5 * 3600_000).toISOString().slice(0, 10);

type JobRow = {snapshot_id: string; store: string; item_key: string; status: string; records: number; created_at: number; finished_at: number | null};
/** market_provider_jobs (drizzle/0012_provider_jobs.sql) as the job store of lib/importer/brightdata.ts. */
export function d1BrightDataJobs(db: D1Like): BrightDataJobs {
  return {
    async latest(key, since) {
      const row = await db.prepare("SELECT snapshot_id,store,item_key,status,records,created_at,finished_at FROM market_provider_jobs WHERE provider='brightdata' AND item_key=? AND created_at>=? ORDER BY created_at DESC LIMIT 1").bind(key, since).first<JobRow>();
      if (!row) return;
      return {snapshotId: row.snapshot_id, store: row.store as BrightDataJob['store'], key: row.item_key, status: row.status as BrightDataJob['status'], records: row.records, createdAt: row.created_at, ...(row.finished_at !== null ? {finishedAt: row.finished_at} : {})};
    },
    async used(month) {
      const row = await db.prepare("SELECT COALESCE(SUM(CASE WHEN status='running' THEN 1 ELSE records END),0) AS used FROM market_provider_jobs WHERE provider='brightdata' AND month=?").bind(month).first<{used: number}>();
      return Number(row?.used ?? 0);
    },
    async claim(job, claimStaleBefore) {
      // One statement, so D1 applies the check and the insert together: a second request sees the first one's row.
      const result = await db.prepare(`INSERT INTO market_provider_jobs (snapshot_id,provider,store,dataset,item_key,url,purpose,status,records,month,created_at)
        SELECT ?,'brightdata',?,?,?,?,?,'running',0,?,? WHERE NOT EXISTS (SELECT 1 FROM market_provider_jobs WHERE provider='brightdata' AND item_key=? AND status='running'
        AND created_at>=? AND (snapshot_id NOT LIKE '${brightDataClaimPrefix}%' OR created_at>=?))`)
        .bind(job.snapshotId, job.store, job.dataset, job.key, job.url, job.purpose, tashkentMonth(job.createdAt), job.createdAt, job.key, job.createdAt - brightDataRunningStaleMs, claimStaleBefore).run() as {meta?: {changes?: number}};
      return Number(result?.meta?.changes ?? 0) > 0;
    },
    async assign(claimId, snapshotId) {
      await db.prepare("UPDATE market_provider_jobs SET snapshot_id=? WHERE snapshot_id=? AND status='running'").bind(snapshotId, claimId).run();
    },
    async finish(snapshotId, status, records, at, error) {
      // Billed when the collection finishes: the month and day follow the finish time.
      await db.prepare("UPDATE market_provider_jobs SET status=?,records=?,error=?,finished_at=?,month=?,day=? WHERE snapshot_id=? AND status='running'")
        .bind(status, records, error ?? null, at, tashkentMonth(at), tashkentDay(at), snapshotId).run();
    },
  };
}

export async function readBrightDataSettings(db: D1Like): Promise<BrightDataSettings> {
  const row = await db.prepare('SELECT value FROM market_settings WHERE key=?').bind(brightDataSettingsKey).first<{value: string}>();
  return parseBrightDataSettings(row?.value);
}
