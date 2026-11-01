import { normalizePromoCode, promoErrors, type PromoInput, type PromoKind, type PromoRule } from './promo.ts';

/**
 * Promo codes in D1 (migration 0017): `market_promo_codes` holds the codes with their use count, and
 * `market_promo_redemptions` one row per checkout that used a code (the books and the admin list read it).
 * Why a table and not the `market_settings` JSON: a use is counted at the moment an order is placed, by many customers at
 * once; one conditional UPDATE on a row (`uses < max_uses`) cannot hand out more uses than allowed, while a JSON document
 * would make every checkout race every other one (and the operator's edits) on one compare-and-swap.
 * Migration 0018 (owner, 2 November 2026) adds `once_per_customer` to a code and `returned_at` to a redemption: a use is
 * given back once when its checkout is cancelled before the purchase, and a code may work once per customer account.
 * The functions take a D1-like object so tests run them on node:sqlite.
 */
type Bound = { first<T>(): Promise<T | null>; run(): Promise<{ meta: { changes: number } }>; all<T>(): Promise<{ results: T[] }> };
type Statement = { bind(...values: unknown[]): Bound };
/** D1's prepare, and its batch (statements run in order in one transaction) for the use counted together with its record. */
export type PromoDb = { prepare(sql: string): Statement; batch?(statements: Bound[]): Promise<{ meta: { changes: number } }[]> };

type Row = { id: string; code: string; kind: PromoKind; value: number; starts_at: number | null; ends_at: number | null; max_uses: number | null; min_order: number | null; active: number; uses: number; once_per_customer?: number; note: string | null; created_at: number; updated_at: number; discount_total?: number | null; returned_uses?: number | null };
const ruleOf = (row: Row): PromoRule => ({
  id: row.id, code: row.code, kind: row.kind, value: row.value, startsAt: row.starts_at, endsAt: row.ends_at, maxUses: row.max_uses,
  minOrder: row.min_order, active: row.active === 1, uses: row.uses, note: row.note, createdAt: row.created_at, updatedAt: row.updated_at,
  // Before migration 0018 the column is absent: the code behaves as before (no per-customer limit).
  ...(row.once_per_customer !== undefined ? { oncePerCustomer: row.once_per_customer === 1 } : {}),
  ...(row.discount_total !== undefined ? { discountTotal: row.discount_total ?? 0 } : {}),
  ...(row.returned_uses !== undefined ? { returnedUses: row.returned_uses ?? 0 } : {}),
});

/** A code by what the customer typed (any case, spaces ignored); null when there is none. */
export async function findPromo(db: PromoDb, typed: string): Promise<PromoRule | null> {
  const code = normalizePromoCode(typed);
  if (!code) return null;
  const row = await db.prepare('SELECT * FROM market_promo_codes WHERE code=?').bind(code).first<Row>();
  return row ? ruleOf(row) : null;
}

/** Every code, newest first, with the discount given so far (returned uses left out) and how many uses came back. */
export async function listPromos(db: PromoDb): Promise<PromoRule[]> {
  const rows = await db.prepare('SELECT c.*, (SELECT COALESCE(SUM(r.discount),0) FROM market_promo_redemptions r WHERE r.code_id=c.id AND r.returned_at IS NULL) AS discount_total, (SELECT COUNT(*) FROM market_promo_redemptions r WHERE r.code_id=c.id AND r.returned_at IS NOT NULL) AS returned_uses FROM market_promo_codes c ORDER BY c.created_at DESC LIMIT 500').bind().all<Row>();
  return rows.results.map(ruleOf);
}

/**
 * Creates a code, or changes one (`input.id`). The use count is never written from here. Returns null when another code
 * already has this text (the admin form says so). «Один раз на покупателя» is on for a new code unless the form turns it
 * off; a change without the field keeps the code's own setting (codes made before 2 November 2026 stay off).
 */
export async function savePromo(db: PromoDb, input: PromoInput, actor: string, now = Date.now()): Promise<PromoRule | null> {
  const code = normalizePromoCode(input.code);
  const clash = await db.prepare('SELECT id FROM market_promo_codes WHERE code=?').bind(code).first<{ id: string }>();
  if (clash && clash.id !== input.id) return null;
  const values = [code, input.kind, input.value, input.startsAt ?? null, input.endsAt ?? null, input.maxUses ?? null, input.minOrder ?? null, input.active ? 1 : 0, input.note?.trim() || null];
  const once = input.oncePerCustomer === undefined ? null : input.oncePerCustomer ? 1 : 0;
  if (input.id) {
    const result = await db.prepare('UPDATE market_promo_codes SET code=?,kind=?,value=?,starts_at=?,ends_at=?,max_uses=?,min_order=?,active=?,note=?,once_per_customer=COALESCE(?,once_per_customer),updated_at=?,updated_by=? WHERE id=?').bind(...values, once, now, actor, input.id).run();
    if (!result.meta.changes) return null;
    return findPromo(db, code);
  }
  const id = 'PROMO-' + crypto.randomUUID().slice(0, 8).toUpperCase();
  const result = await db.prepare('INSERT OR IGNORE INTO market_promo_codes (id,code,kind,value,starts_at,ends_at,max_uses,min_order,active,note,once_per_customer,uses,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)').bind(id, ...values, once ?? 1, now, now, actor, actor).run();
  return result.meta.changes ? findPromo(db, code) : null;
}

/** This customer's checkouts that used the code and whose use was not returned (the «once per customer» check). */
export async function customerPromoUses(db: PromoDb, codeId: string, userId: string): Promise<string[]> {
  const rows = await db.prepare('SELECT batch_id FROM market_promo_redemptions WHERE code_id=? AND user_id=? AND returned_at IS NULL LIMIT 50').bind(codeId, userId).all<{ batch_id: string }>();
  return rows.results.map((row) => row.batch_id);
}

/**
 * Gives a checkout's use back (owner, 2 November 2026): its orders with the code were cancelled before the store purchase.
 * One transaction per checkout: the redemption is marked returned only if it was not yet, and the count drops only when
 * that mark is this call's own (`changes()` of the statement before) — a repeated cancel, a retried request or two at
 * once return the use once. The record stays, marked, for the history; «Скидок выдано» leaves it out. Returns how many
 * uses came back.
 */
export async function returnPromoUses(db: PromoDb, userId: string, batchIds: string[], now = Date.now()): Promise<number> {
  if (!db.batch) return 0;
  let returned = 0;
  for (const batchId of [...new Set(batchIds)].slice(0, 50)) {
    const [marked] = await db.batch([
      db.prepare('UPDATE market_promo_redemptions SET returned_at=? WHERE batch_id=? AND user_id=? AND returned_at IS NULL').bind(now, batchId, userId),
      db.prepare('UPDATE market_promo_codes SET uses=uses-1, updated_at=? WHERE id=(SELECT code_id FROM market_promo_redemptions WHERE batch_id=?) AND uses>0 AND changes()=1').bind(now, batchId),
    ]);
    returned += marked.meta.changes;
  }
  return returned;
}

/**
 * Counts one use, only while the code is on, inside its dates and under its cap: one statement, so two customers
 * placing the last allowed order at the same moment cannot both get it. False when it may not be used.
 */
export async function reservePromo(db: PromoDb, id: string, now = Date.now()): Promise<boolean> {
  const result = await db.prepare('UPDATE market_promo_codes SET uses=uses+1, updated_at=? WHERE id=? AND active=1 AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>?) AND (max_uses IS NULL OR uses<max_uses)').bind(now, id, now, now).run();
  return result.meta.changes === 1;
}

/** Gives back a use counted for an order that was then not saved (the account changed meanwhile, a write failed). */
export async function releasePromo(db: PromoDb, id: string): Promise<void> {
  await db.prepare('UPDATE market_promo_codes SET uses=uses-1 WHERE id=? AND uses>0').bind(id).run();
}

/** The checkout that used the code (one row per checkout key; repeating it changes nothing). */
export async function recordRedemption(db: PromoDb, value: { codeId: string; code: string; userId: string; batchId: string; orderIds: string[]; discount: number }, now = Date.now()): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO market_promo_redemptions (id,code_id,code,user_id,batch_id,order_ids,discount,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind('RED-' + crypto.randomUUID().slice(0, 8).toUpperCase(), value.codeId, value.code, value.userId, value.batchId, JSON.stringify(value.orderIds.slice(0, 50)), value.discount, now).run();
}

/** One checkout that uses a code: who, which checkout key (the batch), its orders and the discount they carry;
 *  `oncePerCustomer` when the code works once per customer account (checked again inside the counting statement). */
export type PromoUse = { codeId: string; code: string; userId: string; batchId: string; orderIds: string[]; discount: number; oncePerCustomer?: boolean };

/**
 * Places a checkout that uses a code (POST /api/actions): the use is counted and its record written in one transaction
 * before the orders are saved, and both are taken back when the save fails (a stale revision, a failed write), so the
 * admin's «Скидок выдано» and the use count always agree with the orders the books see.
 * - The record goes first (INSERT OR IGNORE, one per checkout key); the count rises only when that row is this call's new
 *   one and the code is still on, in its dates and under its cap; otherwise the new row is removed again. Two requests
 *   with the same key count one use; two customers taking the last use cannot both get it.
 * - «Один раз на покупателя»: the count also needs no other unreturned record of this account for the code, in the same
 *   statement, so two checkouts of one customer paying at once cannot both take it.
 * - `usedUp`: the code could not be counted and nothing was saved; `code` says why — this customer already used it
 *   (err_96) or it is used up, switched off or out of its dates (err_89).
 */
export async function placeWithPromo<T>(db: PromoDb, use: PromoUse | null | undefined, save: () => Promise<T>, now = Date.now()): Promise<{ usedUp: true; code: string } | { usedUp: false; value: T }> {
  if (!use || !db.batch) return { usedUp: false, value: await save() };
  const id = 'RED-' + crypto.randomUUID().slice(0, 8).toUpperCase();
  const mine = 'EXISTS (SELECT 1 FROM market_promo_redemptions WHERE id=?)';
  const [inserted, counted] = await db.batch([
    db.prepare('INSERT OR IGNORE INTO market_promo_redemptions (id,code_id,code,user_id,batch_id,order_ids,discount,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(id, use.codeId, use.code, use.userId, use.batchId, JSON.stringify(use.orderIds.slice(0, 50)), use.discount, now),
    // The per-customer clause names columns of migration 0018 only for a code that has the option (so they exist).
    use.oncePerCustomer
      ? db.prepare(`UPDATE market_promo_codes SET uses=uses+1, updated_at=? WHERE id=? AND ${mine} AND active=1 AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>?) AND (max_uses IS NULL OR uses<max_uses) AND (once_per_customer=0 OR NOT EXISTS (SELECT 1 FROM market_promo_redemptions r WHERE r.code_id=market_promo_codes.id AND r.user_id=? AND r.returned_at IS NULL AND r.id<>?))`)
        .bind(now, use.codeId, id, now, now, use.userId, id)
      : db.prepare(`UPDATE market_promo_codes SET uses=uses+1, updated_at=? WHERE id=? AND ${mine} AND active=1 AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>?) AND (max_uses IS NULL OR uses<max_uses)`)
        .bind(now, use.codeId, id, now, now),
    // The count did not rise (the statement before changed no row): this call's record is removed again.
    db.prepare('DELETE FROM market_promo_redemptions WHERE id=? AND changes()=0').bind(id),
  ]);
  const fresh = inserted.meta.changes === 1;
  if (fresh && counted.meta.changes !== 1) {
    if (!use.oncePerCustomer) return { usedUp: true, code: promoErrors.usedUp };
    // Why it was refused: another unreturned use of this account wins over the general «used up».
    const other = await db.prepare('SELECT 1 AS mine FROM market_promo_redemptions WHERE code_id=? AND user_id=? AND returned_at IS NULL LIMIT 1').bind(use.codeId, use.userId).first<{ mine: number }>().catch(() => null);
    return { usedUp: true, code: other ? promoErrors.alreadyUsed : promoErrors.usedUp };
  }
  try { return { usedUp: false, value: await save() }; }
  catch (error) {
    if (fresh) await db.batch([
      db.prepare(`UPDATE market_promo_codes SET uses=uses-1 WHERE id=? AND uses>0 AND ${mine}`).bind(use.codeId, id),
      db.prepare('DELETE FROM market_promo_redemptions WHERE id=?').bind(id),
    ]).catch((release) => console.error('Promo use release failed', release));
    throw error;
  }
}
