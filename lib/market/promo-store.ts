import { normalizePromoCode, promoErrors, promoProblem, type PromoInput, type PromoKind, type PromoRule } from './promo.ts';

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

/** Repair missed returns after a saved cancellation, then read the current cap and the customer's remaining uses. */
export async function reconcilePromoUses(db: PromoDb, rule: PromoRule, userId: string, used: string[], returnable: string[]): Promise<PromoRule | null> {
  if (returnable.length) {
    try {
      await returnPromoUses(db, userId, returnable);
      const current = await findPromo(db, rule.code);
      return current?.oncePerCustomer
        ? { ...current, usedByCustomer: (await customerPromoUses(db, current.id, userId)).length > 0 }
        : current;
    } catch (error) {
      console.error('Promo use return failed', error);
    }
  }
  return { ...rule, usedByCustomer: used.length > 0 };
}

/** The server's promo calculation and the orders it applies to. */
export type PromoUse = {
  rule: Pick<PromoRule, 'id' | 'code' | 'kind' | 'value' | 'minOrder' | 'oncePerCustomer'>;
  userId: string;
  batchId: string;
  orderIds: string[];
  discount: number;
};

/** A validated canonical account document; the caller retains parsing and post-save side effects. */
export type PromoAccountCommit = { userId: string; revision: number; serialized: string };

/**
 * Commit the account revision, code count and redemption in one database transaction. Each following statement
 * runs only if its predecessor wrote a row. The account write checks current eligibility and the terms used for
 * the calculation, because the operator may edit a code while checkout is checking merchant prices.
 */
export async function commitPromoAccount(db: PromoDb, use: PromoUse, account: PromoAccountCommit, now = Date.now()): Promise<{ saved: true } | { saved: false; code: string }> {
  if (!db.batch) throw new Error('Atomic promo persistence requires database batch support');
  if (account.userId !== use.userId) throw new Error('Promo account ownership mismatch');
  const { rule } = use;
  // An undefined flag means the code was read on the pre-0018 schema. Otherwise check the live flag even if it was off.
  const hasCustomerLimit = rule.oncePerCustomer !== undefined;
  const customerLimit = hasCustomerLimit
    ? 'AND (c.once_per_customer=0 OR NOT EXISTS (SELECT 1 FROM market_promo_redemptions r WHERE r.code_id=c.id AND r.user_id=? AND r.returned_at IS NULL))'
    : '';
  const [saved] = await db.batch([
    db.prepare(`UPDATE market_accounts SET state=?, revision=revision+1, updated_at=? WHERE user_id=? AND revision=?
      AND NOT EXISTS (SELECT 1 FROM market_promo_redemptions WHERE batch_id=?)
      AND EXISTS (SELECT 1 FROM market_promo_codes c WHERE c.id=? AND c.code=? AND c.kind=? AND c.value=?
        AND c.min_order IS ? AND c.active=1
        AND (c.starts_at IS NULL OR c.starts_at<=?) AND (c.ends_at IS NULL OR c.ends_at>?)
        AND (c.max_uses IS NULL OR c.uses<c.max_uses) ${customerLimit})`)
      .bind(account.serialized, now, account.userId, account.revision, use.batchId,
        rule.id, rule.code, rule.kind, rule.value, rule.minOrder ?? null, now, now, ...(hasCustomerLimit ? [use.userId] : [])),
    db.prepare('UPDATE market_promo_codes SET uses=uses+1, updated_at=? WHERE id=? AND changes()=1').bind(now, rule.id),
    db.prepare('INSERT INTO market_promo_redemptions (id,code_id,code,user_id,batch_id,order_ids,discount,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1')
      .bind('RED-' + crypto.randomUUID(), rule.id, rule.code, use.userId, use.batchId, JSON.stringify(use.orderIds.slice(0, 50)), use.discount, now),
  ]);
  if (saved.meta.changes === 1) return { saved: true };
  // A stale account or competing/legacy key asks the client to refresh; never touch its owner's record.
  const current = await db.prepare('SELECT revision FROM market_accounts WHERE user_id=?').bind(account.userId).first<{ revision: number }>();
  if (!current || current.revision !== account.revision) return { saved: false, code: 'err_4' };
  const collision = await db.prepare('SELECT 1 AS found FROM market_promo_redemptions WHERE batch_id=?').bind(use.batchId).first();
  if (collision) return { saved: false, code: 'err_4' };
  const latest = await findPromo(db, rule.code);
  if (!latest || latest.id !== rule.id || latest.kind !== rule.kind || latest.value !== rule.value || (latest.minOrder ?? null) !== (rule.minOrder ?? null)) {
    return { saved: false, code: promoErrors.changed };
  }
  if (latest.oncePerCustomer) {
    latest.usedByCustomer = Boolean(await db.prepare('SELECT 1 AS found FROM market_promo_redemptions WHERE code_id=? AND user_id=? AND returned_at IS NULL LIMIT 1').bind(rule.id, use.userId).first());
  }
  return { saved: false, code: promoProblem(latest, now) ?? promoErrors.changed };
}
