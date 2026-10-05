import { database, recordAudit } from "./server";
import { accountingSettingsSchema, monthSummary, type AccountingSettings, type LedgerEntry, type LedgerEntryInput, type LedgerKind, type OrderFinance } from "./finance";

type Operator = { userId: string; email: string };

export async function accountingSettings(): Promise<AccountingSettings> {
  const row = await database().prepare("SELECT value FROM market_settings WHERE key='accounting'").first<{ value: string }>();
  try { return accountingSettingsSchema.parse(row ? JSON.parse(row.value) : {}); } catch { return accountingSettingsSchema.parse({}); }
}
export async function saveAccountingSettings(value: AccountingSettings, user: Operator) {
  const next = accountingSettingsSchema.parse(value), now = Date.now();
  await database().prepare("INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES ('accounting',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(JSON.stringify(next), now, user.userId).run();
  await recordAudit(user, "accounting.settings", "settings", "accounting", next);
  return next;
}

type LedgerRow = { id: string; kind: LedgerKind; amount_uzs: number; original_amount: number | null; original_currency: string | null; occurred_on: string; order_id: string | null; counterparty: string | null; note: string | null; created_by: string; created_at: number; voided_at: number | null; void_reason: string | null };
const entryOf = (row: LedgerRow): LedgerEntry => ({
  id: row.id, kind: row.kind, amountUzs: row.amount_uzs, occurredOn: row.occurred_on, createdBy: row.created_by, createdAt: row.created_at,
  ...(row.original_amount !== null ? { originalAmount: row.original_amount } : {}), ...(row.original_currency ? { originalCurrency: row.original_currency } : {}),
  ...(row.order_id ? { orderId: row.order_id } : {}), ...(row.counterparty ? { counterparty: row.counterparty } : {}), ...(row.note ? { note: row.note } : {}),
  ...(row.voided_at !== null ? { voidedAt: row.voided_at, voidReason: row.void_reason ?? "" } : {}),
});
/** Ledger rows dated within [from, to] months ("YYYY-MM"), newest first. */
export async function ledger(from: string, to: string) {
  const rows = await database().prepare("SELECT * FROM market_ledger_entries WHERE occurred_on >= ? AND occurred_on <= ? ORDER BY occurred_on DESC, created_at DESC LIMIT 5000").bind(from + "-01", to + "-31").all<LedgerRow>();
  return rows.results.map(entryOf);
}
export async function addLedgerEntry(input: LedgerEntryInput, user: Operator) {
  const id = "LED-" + crypto.randomUUID(), now = Date.now();
  await database().prepare("INSERT INTO market_ledger_entries (id,kind,amount_uzs,original_amount,original_currency,occurred_on,order_id,counterparty,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, input.kind, input.amountUzs, input.originalAmount ?? null, input.originalCurrency ?? null, input.occurredOn, input.orderId || null, input.counterparty || null, input.note || null, user.email || user.userId, now).run();
  await recordAudit(user, "ledger.add", "ledger", id, { kind: input.kind, amountUzs: input.amountUzs, occurredOn: input.occurredOn });
  return id;
}
export async function voidLedgerEntry(id: string, reason: string, user: Operator) {
  const result = await database().prepare("UPDATE market_ledger_entries SET voided_at=?,voided_by=?,void_reason=? WHERE id=? AND voided_at IS NULL").bind(Date.now(), user.email || user.userId, reason, id).run();
  if (result.meta.changes) await recordAudit(user, "ledger.void", "ledger", id, { reason });
  return Boolean(result.meta.changes);
}

type FinanceRow = { order_id: string; customer_id: string; status: OrderFinance["status"]; created_at: number; paid_at: number | null; month: string | null; goods: number; store_shipping: number; reserve: number; payable: number; commission: number; delivery: number; fx_gain: number; services: number; revenue: number };
/** Orders paid in [from, to], plus the ones created then (pending, cancelled), for the books and the export. */
export async function orderBooks(from: string, to: string): Promise<OrderFinance[]> {
  const start = Date.parse(from + "-01T00:00:00+05:00"), end = Date.parse(to + "-01T00:00:00+05:00") + 31 * 86400_000;
  const rows = await database().prepare("SELECT * FROM market_order_finance WHERE (month >= ? AND month <= ?) OR (created_at >= ? AND created_at < ?) ORDER BY coalesce(paid_at, created_at) DESC LIMIT 20000").bind(from, to, start, end).all<FinanceRow>();
  return rows.results.map((r) => ({ orderId: r.order_id, customerId: r.customer_id, status: r.status, createdAt: r.created_at, ...(r.paid_at !== null ? { paidAt: r.paid_at } : {}), ...(r.month ? { month: r.month } : {}), goods: r.goods, storeShipping: r.store_shipping, reserve: r.reserve, payable: r.payable, commission: r.commission, delivery: r.delivery, fxGain: r.fx_gain, services: r.services, revenue: r.revenue }));
}
export async function books(from: string, to: string, months: string[]) {
  const [orders, entries, settings] = await Promise.all([orderBooks(from, to), ledger(from, to), accountingSettings()]);
  return { orders, entries, settings, summaries: months.map((month) => monthSummary(month, orders, entries, settings.profitTaxRate)) };
}
