import { database, HttpError, recordAudit } from "./server";
import { balanceOf, parseState } from "./domain";
import { accountingSettingsSchema, isPeriodLocked, lockedPeriodMessage, monthKey, monthSummary, obligations, yearMonths, yearSummary, type AccountingSettings, type LedgerEntry, type LedgerEntryInput, type LedgerKind, type OrderFinance } from "./finance";

type Operator = { userId: string; email: string };

export async function accountingSettings(): Promise<AccountingSettings> {
  const row = await database().prepare("SELECT value FROM market_settings WHERE key='accounting'").first<{ value: string }>();
  try { return accountingSettingsSchema.parse(row ? JSON.parse(row.value) : {}); } catch { return accountingSettingsSchema.parse({}); }
}
async function writeAccountingSettings(next: AccountingSettings, user: Operator) {
  await database().prepare("INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES ('accounting',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(JSON.stringify(next), Date.now(), user.userId).run();
}
/** Saves the editable settings (tax rate, ledger fx rates); the period lock changes only through lockPeriod / unlockPeriod. */
export async function saveAccountingSettings(value: Partial<AccountingSettings>, user: Operator) {
  const current = await accountingSettings();
  const patch = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
  const next = accountingSettingsSchema.parse({ ...current, ...patch, lockedThrough: current.lockedThrough });
  await writeAccountingSettings(next, user);
  await recordAudit(user, "accounting.settings", "settings", "accounting", { profitTaxRate: next.profitTaxRate, fxRates: next.fxRates });
  return next;
}
/** Closes every month up to `month` inclusive: the ledger there becomes read-only. Only forward; reopening needs a reason. */
export async function lockPeriod(month: string, user: Operator) {
  monthKey.parse(month);
  const current = await accountingSettings();
  if (current.lockedThrough && month < current.lockedThrough) throw new HttpError(409, `Период уже закрыт по ${current.lockedThrough}. Чтобы закрыть по ${month}, сначала откройте его заново.`);
  const next = { ...current, lockedThrough: month };
  await writeAccountingSettings(next, user);
  await recordAudit(user, "accounting.lock", "settings", "accounting", { lockedThrough: month, before: current.lockedThrough ?? null });
  return next;
}
/** Reopens closed months (all of them, or back to `through`); the reason goes to the audit log. */
export async function unlockPeriod(reason: string, user: Operator, through?: string) {
  const current = await accountingSettings();
  if (!current.lockedThrough) throw new HttpError(409, "Закрытых периодов нет.");
  if (through) { monthKey.parse(through); if (through >= current.lockedThrough) throw new HttpError(400, "Укажите месяц раньше текущей границы закрытия."); }
  const next: AccountingSettings = { ...current };
  if (through) next.lockedThrough = through; else delete next.lockedThrough;
  await writeAccountingSettings(next, user);
  await recordAudit(user, "accounting.unlock", "settings", "accounting", { reason, before: current.lockedThrough, after: next.lockedThrough ?? null });
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
/** Every ledger row linked to one of the orders, whatever its date: an order's margin must see a carrier paid next month. */
export async function ledgerForOrders(orderIds: string[]) {
  const out: LedgerEntry[] = [], db = database();
  for (let index = 0; index < orderIds.length; index += 90) {
    const chunk = orderIds.slice(index, index + 90);
    const rows = await db.prepare(`SELECT * FROM market_ledger_entries WHERE order_id IN (${chunk.map(() => "?").join(",")}) ORDER BY occurred_on DESC LIMIT 5000`).bind(...chunk).all<LedgerRow>();
    out.push(...rows.results.map(entryOf));
  }
  return out;
}
export async function addLedgerEntry(input: LedgerEntryInput, user: Operator) {
  if (isPeriodLocked(await accountingSettings(), input.occurredOn)) throw new HttpError(409, lockedPeriodMessage(input.occurredOn.slice(0, 7)));
  const id = "LED-" + crypto.randomUUID(), now = Date.now();
  await database().prepare("INSERT INTO market_ledger_entries (id,kind,amount_uzs,original_amount,original_currency,occurred_on,order_id,counterparty,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, input.kind, input.amountUzs, input.originalAmount ?? null, input.originalCurrency ?? null, input.occurredOn, input.orderId || null, input.counterparty || null, input.note || null, user.email || user.userId, now).run();
  await recordAudit(user, "ledger.add", "ledger", id, { kind: input.kind, amountUzs: input.amountUzs, occurredOn: input.occurredOn });
  return id;
}
export async function voidLedgerEntry(id: string, reason: string, user: Operator) {
  const row = await database().prepare("SELECT occurred_on, voided_at FROM market_ledger_entries WHERE id=?").bind(id).first<{ occurred_on: string; voided_at: number | null }>();
  if (!row || row.voided_at !== null) return false;
  if (isPeriodLocked(await accountingSettings(), row.occurred_on)) throw new HttpError(409, lockedPeriodMessage(row.occurred_on.slice(0, 7)));
  const result = await database().prepare("UPDATE market_ledger_entries SET voided_at=?,voided_by=?,void_reason=? WHERE id=? AND voided_at IS NULL").bind(Date.now(), user.email || user.userId, reason, id).run();
  if (result.meta.changes) await recordAudit(user, "ledger.void", "ledger", id, { reason });
  return Boolean(result.meta.changes);
}
/** Fixing an entry = voiding it and adding the corrected copy; the corrected copy's date must be open too, so check it first. */
export async function replaceLedgerEntry(id: string, reason: string, input: LedgerEntryInput, user: Operator) {
  if (isPeriodLocked(await accountingSettings(), input.occurredOn)) throw new HttpError(409, lockedPeriodMessage(input.occurredOn.slice(0, 7)));
  if (!(await voidLedgerEntry(id, reason, user))) throw new HttpError(404, "Запись не найдена или уже аннулирована.");
  const nextId = await addLedgerEntry(input, user);
  await recordAudit(user, "ledger.replace", "ledger", nextId, { replaces: id, reason });
  return nextId;
}

type FinanceRow = { order_id: string; customer_id: string; status: OrderFinance["status"]; created_at: number; paid_at: number | null; month: string | null; goods: number; store_shipping: number; reserve: number; payable: number; commission: number; delivery: number; fx_gain: number; services: number; revenue: number };
const financeOf = (r: FinanceRow): OrderFinance => ({ orderId: r.order_id, customerId: r.customer_id, status: r.status, createdAt: r.created_at, ...(r.paid_at !== null ? { paidAt: r.paid_at } : {}), ...(r.month ? { month: r.month } : {}), goods: r.goods, storeShipping: r.store_shipping, reserve: r.reserve, payable: r.payable, commission: r.commission, delivery: r.delivery, fxGain: r.fx_gain, services: r.services, revenue: r.revenue });
/** Orders paid in [from, to], plus the ones created then (pending, cancelled), for the books and the export. */
export async function orderBooks(from: string, to: string): Promise<OrderFinance[]> {
  const start = Date.parse(from + "-01T00:00:00+05:00"), end = Date.parse(to + "-01T00:00:00+05:00") + 31 * 86400_000;
  const rows = await database().prepare("SELECT * FROM market_order_finance WHERE (month >= ? AND month <= ?) OR (created_at >= ? AND created_at < ?) ORDER BY coalesce(paid_at, created_at) DESC LIMIT 20000").bind(from, to, start, end).all<FinanceRow>();
  return rows.results.map(financeOf);
}
export async function books(from: string, to: string, months: string[]) {
  const [orders, entries, settings] = await Promise.all([orderBooks(from, to), ledger(from, to), accountingSettings()]);
  return { orders, entries, settings, summaries: months.map((month) => monthSummary(month, orders, entries, settings.profitTaxRate)) };
}
export async function yearBooks(year: number) {
  const months = yearMonths(year);
  const [orders, entries, settings] = await Promise.all([orderBooks(months[0], months[11]), ledger(months[0], months[11]), accountingSettings()]);
  return { settings, orders, entries, summary: yearSummary(year, orders, entries, settings.profitTaxRate) };
}

/** Order stage from the operational projection: "0" waiting for buyout … "5" delivered, or "cancelled". */
export async function orderStages(orderIds: string[]) {
  const stages: Record<string, string> = {}, db = database();
  for (let index = 0; index < orderIds.length; index += 90) {
    const chunk = orderIds.slice(index, index + 90);
    const rows = await db.prepare(`SELECT id, status FROM market_order_records WHERE id IN (${chunk.map(() => "?").join(",")})`).bind(...chunk).all<{ id: string; status: string }>();
    for (const row of rows.results) stages[row.id] = row.status;
  }
  return stages;
}
/** What Atlas still expects or owes: unpaid orders, customers' internal balances, paid orders not yet bought from the store. */
export async function obligationsSnapshot() {
  const db = database();
  const [open, accounts] = await Promise.all([
    db.prepare("SELECT * FROM market_order_finance WHERE status IN ('pending','paid') ORDER BY created_at DESC LIMIT 5000").all<FinanceRow>(),
    db.prepare("SELECT state FROM market_accounts LIMIT 5000").all<{ state: string }>(),
  ]);
  const orders = open.results.map(financeOf);
  const stages = await orderStages(orders.filter((order) => order.status === "paid").map((order) => order.orderId));
  const balances = accounts.results.map((row) => { try { return balanceOf(parseState(row.state)); } catch { return 0; } });
  return obligations(orders, stages, balances);
}
