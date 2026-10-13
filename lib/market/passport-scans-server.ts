import { env } from 'cloudflare:workers';
import { database, HttpError } from './server.ts';

type ScanRow = { id: string; object_key: string; status: string; confirmed_data: string | null };

/**
 * Passport scans and photos are no longer kept (13.10.2026): they may count as biometric data.
 * Removes uploaded files from R2 in batches. A confirmed passport keeps its typed details (the row
 * becomes a text entry, so orders that rely on it still work); an unconfirmed upload is deleted.
 */
export async function purgePassportScans(limit = 200) {
  if (!env.BUCKET) throw new HttpError(503, 'err_21');
  const db = database(), now = Date.now();
  const rows = (await db.prepare("SELECT id,object_key,status,confirmed_data FROM market_identity_documents WHERE object_key<>'' ORDER BY created_at LIMIT ?")
    .bind(Math.max(1, Math.min(limit, 1000))).all<ScanRow>()).results;
  let kept = 0, deleted = 0;
  for (const row of rows) {
    await env.BUCKET.delete(row.object_key);
    if (row.status === 'confirmed' && row.confirmed_data) {
      await db.prepare("UPDATE market_identity_documents SET object_key='', filename='passport-text', content_type='text/plain', size=0, updated_at=? WHERE id=?").bind(now, row.id).run();
      kept++;
    } else {
      await db.prepare('DELETE FROM market_identity_documents WHERE id=?').bind(row.id).run();
      deleted++;
    }
  }
  const left = await db.prepare("SELECT COUNT(*) AS count FROM market_identity_documents WHERE object_key<>''").first<{ count: number }>();
  return { removed: rows.length, keptAsText: kept, deleted, remaining: Number(left?.count ?? 0) };
}
