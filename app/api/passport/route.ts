import { env } from 'cloudflare:workers';
import { database, failure, HttpError, identity, json, sameOrigin } from '@/lib/market/server';

function bucket() {
  if (!env.BUCKET) throw new HttpError(503, 'err_21');
  return env.BUCKET;
}

export async function GET(request: Request) {
  try {
    const user = await identity();
    // Only uploaded scans (kept from before 13.10.2026, for deletion); typed details have no object.
    const rows = await database().prepare("SELECT id,filename,content_type,size,status,created_at,updated_at FROM market_identity_documents WHERE user_id=? AND object_key<>'' ORDER BY created_at DESC LIMIT 10")
      .bind(user.userId).all();
    return json({ documents: rows.results });
  } catch (error) {
    return failure(error, request);
  }
}

/** Passport scans and photos are no longer collected (13.10.2026): they may count as biometric data. Details are typed as text. */
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await identity();
    throw new HttpError(410, 'err_79');
  } catch (error) {
    // The upload is never read; an unconsumed body left the local workerd restarting on the next request.
    await request.body?.cancel().catch(() => undefined);
    return failure(error, request);
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new HttpError(400, 'err_26');
    const row = await database().prepare('SELECT object_key FROM market_identity_documents WHERE id=? AND user_id=?')
      .bind(id, user.userId).first<{ object_key: string }>();
    if (!row) throw new HttpError(404, 'err_27');
    if (row.object_key) await bucket().delete(row.object_key);
    await database().prepare('DELETE FROM market_identity_documents WHERE id=? AND user_id=?').bind(id, user.userId).run();
    return json({ deleted: true, id });
  } catch (error) {
    return failure(error, request);
  }
}
