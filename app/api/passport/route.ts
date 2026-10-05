import { env } from 'cloudflare:workers';
import { database, failure, HttpError, identity, json, rateLimit, sameOrigin } from '@/lib/market/server';

const allowed = new Set(['image/jpeg', 'image/png', 'application/pdf']);

function validMagic(bytes: Uint8Array, type: string) {
  return type === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8
    : type === 'image/png' ? bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])
      : type === 'application/pdf' ? new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
        : false;
}

function bucket() {
  if (!env.BUCKET) throw new HttpError(503, 'err_21');
  return env.BUCKET;
}

export async function GET(request: Request) {
  try {
    const user = await identity();
    const rows = await database().prepare('SELECT id,filename,content_type,size,status,created_at,updated_at FROM market_identity_documents WHERE user_id=? ORDER BY created_at DESC LIMIT 10')
      .bind(user.userId).all();
    return json({ documents: rows.results });
  } catch (error) {
    return failure(error, request);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
    // Each upload keeps up to 8 MB in the bucket: a day's uploads per account are capped.
    await rateLimit(`${user.userId}:passport-upload`, 20, 24 * 60 * 60_000, 'err_40');
    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > 9_000_000) throw new HttpError(413, 'err_22');
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new HttpError(400, 'err_23');
    if (file.size < 100 || file.size > 8_000_000 || !allowed.has(file.type)) throw new HttpError(400, 'err_24');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validMagic(bytes, file.type)) throw new HttpError(400, 'err_25');

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(user.userId));
    const owner = Array.from(new Uint8Array(digest).slice(0, 10), value => value.toString(16).padStart(2, '0')).join('');
    const id = 'DOC-' + crypto.randomUUID();
    const key = `passports/${owner}/${id}`;
    const now = Date.now();
    await bucket().put(key, bytes, { httpMetadata: { contentType: file.type }, customMetadata: { documentId: id } });
    try {
      await database().prepare('INSERT INTO market_identity_documents (id,user_id,object_key,filename,content_type,size,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(id, user.userId, key, file.name.slice(0, 180), file.type, file.size, 'uploaded', now, now).run();
    } catch (error) {
      await bucket().delete(key);
      throw error;
    }
    return json({ document: { id, filename: file.name.slice(0, 180), contentType: file.type, size: file.size, status: 'uploaded', createdAt: now } }, 201);
  } catch (error) {
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
    await bucket().delete(row.object_key);
    await database().prepare('DELETE FROM market_identity_documents WHERE id=? AND user_id=?').bind(id, user.userId).run();
    return json({ deleted: true, id });
  } catch (error) {
    return failure(error, request);
  }
}
