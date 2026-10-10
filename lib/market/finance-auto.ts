import { statuses, type Entry, type Order } from "./domain.ts";
import {
  entrySourceRu, ledgerKinds, monthOf, orderFinance, toCsv,
  type AccountingSettings, type LedgerEntry, type LedgerEntryInput, type LedgerKind, type MonthSummary, type Obligations, type OrderFinance, type YearSummary,
} from "./finance.ts";

/**
 * Automation and correctness of the books. Everything here is pure and tested; lib/market/finance-server.ts
 * reads and writes D1 around it. Payments, buyouts and deliveries in Atlas are simulated: an entry records the
 * mark Atlas made, never a bank confirmation.
 */

// ---------- Auto entries from order events ----------
export const autoPrefix = "AUTO-";
export const autoVoidPrefix = "auto:";
export const autoActor = "system:auto";
export type AutoEntry = LedgerEntryInput & { id: string };
export const isAutoEntry = (entry: { id: string }) => entry.id.startsWith(autoPrefix);
/** "AUTO-AT-1-goods_purchase-2" → "AUTO-AT-1-goods_purchase": the id without the re-issue number. */
export const autoBaseId = (id: string) => id.replace(/-\d+$/, "");
const autoId = (orderId: string, kind: LedgerKind, cause?: string) => `${autoPrefix}${orderId}-${kind}${cause ? "-" + cause : ""}`;
const dayOf = (at: number) => new Date(at + 5 * 3600_000).toISOString().slice(0, 10); // Tashkent
const historyAt = (order: Order, test: (text: string) => boolean) => order.history.find((event) => test(event.text))?.at;

/**
 * The auto entries an order should have right now, with deterministic ids. Calling it again for the same order
 * returns the same list, so the server can diff it against the ledger (planAutoLedger). `balanceEntries` (the
 * account's internal movements) tell whether a now-refunded order was marked paid before.
 */
export function syncOrderLedger(order: Order, customerId: string, options: { balanceEntries?: Entry[] } = {}): AutoEntry[] {
  const f = orderFinance(order, customerId), out: AutoEntry[] = [], id = order.id, pay = order.payment;
  const demoPayment = options.balanceEntries?.find((entry) => entry.id === "demo-payment:" + id);
  const paidMark = !!pay && pay.amount > 0 && (pay.status === "paid" || (pay.status === "refunded" && (options.balanceEntries ? !!demoPayment : true)));
  const push = (kind: LedgerKind, cause: string | undefined, amountUzs: number, at: number, extra: Partial<LedgerEntryInput>) => {
    if (!(amountUzs > 0)) return;
    out.push({ id: autoId(id, kind, cause), kind, amountUzs: Math.round(amountUzs), occurredOn: dayOf(at), orderId: id, ...extra });
  };
  if (paidMark && pay) {
    const at = demoPayment?.at ?? historyAt(order, (text) => text.startsWith("Статус оплаты отмечен")) ?? pay.updatedAt;
    push("customer_payment", undefined, pay.amount, at, { counterparty: customerId, note: "Статус оплаты отмечен в Atlas; платёж симулируется" });
  }
  // Extra invoices the customer paid (marked in Atlas, simulated like the order's payment): transit money.
  const extras = (order.extraCharges ?? []).filter((charge) => charge.status === "paid");
  for (const charge of extras)
    push("customer_payment", "extra-" + charge.id, charge.amount, charge.paidAt ?? charge.requestedAt, { counterparty: customerId, note: "Доплата по счёту оператора отмечена в Atlas; платёж симулируется" });
  const extrasPaid = extras.reduce((sum, charge) => sum + charge.amount, 0);
  const balanceUsed = order.balanceUsed ?? 0;
  if (balanceUsed > 0) push("balance_payment", undefined, balanceUsed, order.createdAt, { counterparty: customerId, note: "Оплата заказа из внутреннего баланса" });
  if (!order.cancelled) {
    if (order.status >= 1) push("goods_purchase", undefined, f.goods, historyAt(order, (text) => text === statuses[1]) ?? order.createdAt, { counterparty: order.product.brand, note: "Выкуп товара (статус «Выкуплен»)" });
    const s = order.storeShippingSettlement;
    if (s) push("store_shipping", undefined, s.extra && !order.storeShippingExtraApproved ? Math.min(s.actual, s.estimated) : s.actual, historyAt(order, (text) => text.includes("подтвердил доставку магазина")) ?? order.createdAt, { counterparty: order.product.brand, note: s.extra && !order.storeShippingExtraApproved ? "Доставка магазина в пределах согласованной суммы; доплата ждёт согласия клиента" : "Фактическая доставка магазина" });
    const c = order.customsSettlement;
    if (c) push("customs_paid", undefined, c.extra && !order.customsExtraApproved ? c.estimated : c.actual, c.at, { counterparty: "Таможня", note: c.extra && !order.customsExtraApproved ? "Пошлина в пределах предоплаты; доплата ждёт согласия клиента" : "Пошлина, оплаченная Atlas из предоплаты" });
  }
  if (order.settlement?.refund) push("balance_refund", "settlement", order.settlement.refund, historyAt(order, (text) => text.startsWith("Взвешивание завершено")) ?? order.createdAt, { counterparty: customerId, note: "Остаток доставки после взвешивания — на внутренний баланс" });
  if (order.storeShippingSettlement?.refund) push("balance_refund", "store-shipping", order.storeShippingSettlement.refund, historyAt(order, (text) => text.includes("подтвердил доставку магазина")) ?? order.createdAt, { counterparty: customerId, note: "Разница доставки магазина — на внутренний баланс" });
  if (order.customsSettlement?.refund) push("balance_refund", "customs", order.customsSettlement.refund, order.customsSettlement.at, { counterparty: customerId, note: "Остаток предоплаты пошлины — на внутренний баланс" });
  if (order.cancelled) push("balance_refund", "cancel", (paidMark && pay ? pay.amount : 0) + balanceUsed + extrasPaid, historyAt(order, (text) => text.startsWith("Заказ отменён")) ?? order.createdAt, { counterparty: customerId, note: "Отмена заказа: сумма учтена на внутреннем балансе, банковский перевод не выполнялся" });
  return out;
}

export type SkippedAuto = { id: string; kind: LedgerKind; amountUzs: number; occurredOn: string; orderId: string; action: "insert" | "void"; reason: string; at: number };
export type AutoPlan = { insert: AutoEntry[]; void: { id: string; reason: string }[]; skipped: SkippedAuto[]; unchanged: number };
const locked = (settings: Pick<AccountingSettings, "lockedThrough">, day: string) => !!settings.lockedThrough && day.slice(0, 7) <= settings.lockedThrough;
const sameAuto = (row: LedgerEntry, entry: AutoEntry) => row.kind === entry.kind && row.amountUzs === entry.amountUzs && row.occurredOn === entry.occurredOn && (row.orderId ?? "") === (entry.orderId ?? "");

/**
 * Diff of the expected auto entries against the auto rows already in the ledger (manual rows are never
 * touched): insert the missing, void the ones whose condition no longer holds, re-issue a changed one under
 * the next number. An auto row the operator voided by hand stays voided (reconcile reports it). Entries that
 * would land in a closed month are neither inserted nor voided: they go to `skipped` for the discrepancy list.
 */
export function planAutoLedger(expected: AutoEntry[], existing: LedgerEntry[], settings: Pick<AccountingSettings, "lockedThrough">, now = Date.now()): AutoPlan {
  const plan: AutoPlan = { insert: [], void: [], skipped: [], unchanged: 0 };
  const byBase = new Map<string, LedgerEntry[]>();
  for (const row of existing) if (isAutoEntry(row)) { const base = autoBaseId(row.id); byBase.set(base, [...(byBase.get(base) ?? []), row]); }
  const skip = (entry: AutoEntry, action: SkippedAuto["action"], id = entry.id) => plan.skipped.push({ id, kind: entry.kind, amountUzs: entry.amountUzs, occurredOn: entry.occurredOn, orderId: entry.orderId ?? "", action, reason: `Период ${entry.occurredOn.slice(0, 7)} закрыт`, at: now });
  const nextId = (base: string, rows: LedgerEntry[]) => { if (!rows.length) return base; const max = Math.max(0, ...rows.map((row) => row.id === base ? 1 : Number(row.id.slice(base.length + 1)) || 1)); return `${base}-${max + 1}`; };
  const seen = new Set<string>();
  for (const entry of expected) {
    const base = entry.id, rows = byBase.get(base) ?? [], live = rows.find((row) => !row.voidedAt);
    seen.add(base);
    if (live && sameAuto(live, entry)) { plan.unchanged++; continue; }
    if (live) {
      if (locked(settings, live.occurredOn)) { skip(entry, "void", live.id); continue; }
      plan.void.push({ id: live.id, reason: `${autoVoidPrefix} сумма или дата изменились по данным заказа` });
    } else {
      const latest = rows[rows.length - 1];
      if (latest?.voidedAt && !(latest.voidReason ?? "").startsWith(autoVoidPrefix)) continue; // voided by hand: respected
    }
    const next = { ...entry, id: nextId(base, rows) };
    if (locked(settings, next.occurredOn)) skip(next, "insert"); else plan.insert.push(next);
  }
  for (const [base, rows] of byBase) {
    if (seen.has(base)) continue;
    for (const row of rows.filter((row) => !row.voidedAt)) {
      if (locked(settings, row.occurredOn)) plan.skipped.push({ id: row.id, kind: row.kind, amountUzs: row.amountUzs, occurredOn: row.occurredOn, orderId: row.orderId ?? "", action: "void", reason: `Период ${row.occurredOn.slice(0, 7)} закрыт`, at: now });
      else plan.void.push({ id: row.id, reason: `${autoVoidPrefix} условие больше не выполняется (заказ изменён или отменён)` });
    }
  }
  return plan;
}

// ---------- Reconciliation: checks with explanations ----------
export type ReconcileCheck = { id: string; severity: "ok" | "info" | "warn" | "error"; title: string; detail: string; orderIds?: string[]; amount?: number; count?: number };
export type ReconcileReport = { month: string; checkedAt: number; ok: boolean; errors: number; warnings: number; checks: ReconcileCheck[] };
export type ReconcileInput = {
  month: string;
  /** The month's orders (paid that month, or created then and unpaid / cancelled). */
  orders: OrderFinance[];
  /** The month's ledger. */
  entries: LedgerEntry[];
  /** Entries linked to the month's orders, whatever their date. */
  orderEntries: LedgerEntry[];
  stages: Record<string, string>;
  /** Order ids that exist in the books (for the entries' order references). */
  knownOrderIds: Iterable<string>;
  summary: MonthSummary;
  settings: Pick<AccountingSettings, "lockedThrough">;
  skipped?: SkippedAuto[];
  now?: number;
  /** Days after the payment mark before an unbought order is flagged. */
  staleDays?: number;
};
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const list = (ids: string[]) => ids.slice(0, 20).join(", ") + (ids.length > 20 ? ` и ещё ${ids.length - 20}` : "");
export const shiftMonth = (month: string, by: number) => { const [year, mon] = month.split("-").map(Number); const index = year * 12 + (mon - 1) + by; return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`; };

export function reconcile(input: ReconcileInput): ReconcileReport {
  const now = input.now ?? Date.now(), month = input.month, checks: ReconcileCheck[] = [];
  const live = (entries: LedgerEntry[]) => entries.filter((entry) => !entry.voidedAt);
  const monthEntries = live(input.entries).filter((entry) => entry.occurredOn.slice(0, 7) === month);
  const linked = live(input.orderEntries);
  const known = new Set(input.knownOrderIds);
  for (const order of input.orders) known.add(order.orderId);
  const paid = input.orders.filter((order) => order.status === "paid" && order.month === month);
  // 1. Payment entries of every paid order add up to the amount payable.
  const mismatched = paid.filter((order) => sum(linked.filter((entry) => entry.orderId === order.orderId && (entry.kind === "customer_payment" || entry.kind === "balance_payment")).map((entry) => entry.amountUzs)) !== order.payable);
  checks.push(mismatched.length
    ? { id: "payments-match", severity: "error", title: "Оплаты не сходятся с суммой заказа", detail: `По ${mismatched.length} оплаченным заказам сумма записей «Оплата от клиента» и «Оплата с внутреннего баланса» не равна сумме к оплате: ${list(mismatched.map((order) => order.orderId))}.`, orderIds: mismatched.map((order) => order.orderId), count: mismatched.length }
    : { id: "payments-match", severity: "ok", title: "Оплаты сходятся", detail: `По всем ${paid.length} оплаченным заказам месяца записи оплаты равны сумме к оплате.`, count: paid.length });
  // 2. Paid to the store ≤ the goods line of the order.
  const overpaid = input.orders.filter((order) => sum(linked.filter((entry) => entry.orderId === order.orderId && entry.kind === "goods_purchase").map((entry) => entry.amountUzs)) > order.goods);
  checks.push(overpaid.length
    ? { id: "goods-within-order", severity: "warn", title: "Магазину оплачено больше стоимости товара", detail: `По ${overpaid.length} заказам сумма «Оплата магазину за товар» больше строки «Товар» заказа: ${list(overpaid.map((order) => order.orderId))}. Проверьте дубли или одобрите изменение цены в заказе.`, orderIds: overpaid.map((order) => order.orderId), count: overpaid.length }
    : { id: "goods-within-order", severity: "ok", title: "Оплата магазинам в пределах заказов", detail: "Ни по одному заказу оплата магазину не превышает стоимость товара." });
  // 3. Paid, but not bought for longer than N days.
  const staleMs = (input.staleDays ?? 7) * 86400_000;
  const stale = input.orders.filter((order) => order.status === "paid" && input.stages[order.orderId] === "0" && order.paidAt !== undefined && now - order.paidAt > staleMs);
  checks.push(stale.length
    ? { id: "paid-not-bought", severity: "warn", title: "Оплачены, но не выкуплены", detail: `${stale.length} заказов отмечены оплаченными больше ${input.staleDays ?? 7} дней назад и всё ещё ждут выкупа: ${list(stale.map((order) => order.orderId))}. Деньги клиентов лежат как транзит.`, orderIds: stale.map((order) => order.orderId), amount: sum(stale.map((order) => order.goods + order.storeShipping)), count: stale.length }
    : { id: "paid-not-bought", severity: "ok", title: "Выкуп идёт в срок", detail: `Нет оплаченных заказов, ждущих выкупа дольше ${input.staleDays ?? 7} дней.` });
  // 4. Entries referring to an order that does not exist.
  const unknown = monthEntries.filter((entry) => entry.orderId && !known.has(entry.orderId));
  checks.push(unknown.length
    ? { id: "unknown-order", severity: "warn", title: "Записи с неизвестным номером заказа", detail: `${unknown.length} записей ссылаются на заказ, которого нет в книгах: ${list([...new Set(unknown.map((entry) => entry.orderId!))])}. Исправьте номер через «Исправить».`, orderIds: [...new Set(unknown.map((entry) => entry.orderId!))], amount: sum(unknown.map((entry) => entry.amountUzs)), count: unknown.length }
    : { id: "unknown-order", severity: "ok", title: "Номера заказов в записях верны", detail: "Все записи месяца с номером заказа ссылаются на существующие заказы." });
  // 5. Carrier expenses without an order: cannot be attributed to a margin.
  const carrier = monthEntries.filter((entry) => entry.kind === "carrier" && !entry.orderId);
  checks.push(carrier.length
    ? { id: "carrier-unlinked", severity: "info", title: "Расходы перевозчика без заказа", detail: `${carrier.length} записей «Перевозчик» на ${sum(carrier.map((entry) => entry.amountUzs))} сум не привязаны к заказу, поэтому не попадают в маржу заказов.`, amount: sum(carrier.map((entry) => entry.amountUzs)), count: carrier.length }
    : { id: "carrier-unlinked", severity: "ok", title: "Перевозчик привязан к заказам", detail: "Все расходы перевозчика за месяц привязаны к заказам." });
  // 6. The month's auto payment entries against the paid orders of the month.
  const autoPaid = sum(monthEntries.filter((entry) => isAutoEntry(entry) && (entry.kind === "customer_payment" || entry.kind === "balance_payment")).map((entry) => entry.amountUzs));
  const payable = sum(paid.map((order) => order.payable));
  checks.push(autoPaid === payable
    ? { id: "income-vs-auto", severity: "ok", title: "Автозаписи оплат совпадают с заказами", detail: `Автозаписи оплат за месяц: ${autoPaid} сум, к оплате по оплаченным заказам: ${payable} сум. Доход Atlas за месяц ${input.summary.income.total} сум считается из заказов, не из записей.`, amount: autoPaid }
    : { id: "income-vs-auto", severity: "warn", title: "Автозаписи оплат расходятся с заказами", detail: `Автозаписи оплат за месяц: ${autoPaid} сум, к оплате по оплаченным заказам: ${payable} сум, разница ${payable - autoPaid} сум. Возможные причины: автозапись аннулирована вручную, период был закрыт при отметке оплаты, оплата отмечена в другом месяце.`, amount: payable - autoPaid });
  // 7. Negative profit.
  checks.push(input.summary.profit < 0
    ? { id: "negative-profit", severity: "warn", title: "Убыток за месяц", detail: `Расходы ${input.summary.expenses.total} сум превышают доход ${input.summary.income.total} сум: прибыль ${input.summary.profit} сум. Налог за месяц не начисляется (ориентир, сверьте с бухгалтером).`, amount: input.summary.profit }
    : { id: "negative-profit", severity: "ok", title: "Месяц прибыльный", detail: `Прибыль до налога ${input.summary.profit} сум.`, amount: input.summary.profit });
  // 8. Months older than two are expected to be closed.
  const threshold = shiftMonth(monthOf(now), -3);
  const lockedThrough = input.settings.lockedThrough;
  checks.push(!lockedThrough || lockedThrough < threshold
    ? { id: "unclosed-months", severity: "info", title: "Есть незакрытые месяцы", detail: `Закрыто по: ${lockedThrough ?? "нет закрытых"}. Месяцы по ${threshold} включительно старше двух месяцев — закройте их, чтобы записи там больше не менялись.` }
    : { id: "unclosed-months", severity: "ok", title: "Старые месяцы закрыты", detail: `Закрыто по ${lockedThrough}.` });
  // 9. Auto entries that could not be written because the month was closed.
  const skipped = (input.skipped ?? []).filter((item) => item.occurredOn.slice(0, 7) === month), skippedElsewhere = (input.skipped ?? []).length - skipped.length;
  checks.push(skipped.length
    ? { id: "auto-skipped", severity: "error", title: "Автозаписи не попали в закрытый месяц", detail: `${skipped.length} автозаписей (${skipped.filter((item) => item.action === "insert").length} создать, ${skipped.filter((item) => item.action === "void").length} аннулировать) относятся к закрытому ${month}: ${list(skipped.map((item) => `${item.id} ${item.amountUzs} сум`))}. Откройте месяц заново с причиной — сервер допишет их при следующем изменении заказа.`, orderIds: [...new Set(skipped.map((item) => item.orderId))], amount: sum(skipped.map((item) => item.amountUzs)), count: skipped.length }
    : { id: "auto-skipped", severity: "ok", title: "Все автозаписи записаны", detail: skippedElsewhere ? `В ${month} пропущенных автозаписей нет (в других закрытых месяцах: ${skippedElsewhere}).` : "Ни одна автозапись не была остановлена закрытым периодом." });
  // 10. Auto entries voided by hand: respected, but the books now differ from the orders.
  const voidedByHand = input.entries.filter((entry) => isAutoEntry(entry) && entry.voidedAt && entry.occurredOn.slice(0, 7) === month && !(entry.voidReason ?? "").startsWith(autoVoidPrefix));
  checks.push(voidedByHand.length
    ? { id: "auto-voided-manually", severity: "info", title: "Автозаписи аннулированы вручную", detail: `${voidedByHand.length} автозаписей аннулированы оператором и не будут созданы заново: ${list(voidedByHand.map((entry) => entry.id))}. Если это ошибка, внесите запись вручную.`, count: voidedByHand.length, amount: sum(voidedByHand.map((entry) => entry.amountUzs)) }
    : { id: "auto-voided-manually", severity: "ok", title: "Автозаписи не правились вручную", detail: "Все автозаписи месяца соответствуют заказам." });
  const errors = checks.filter((check) => check.severity === "error").length, warnings = checks.filter((check) => check.severity === "warn").length;
  return { month, checkedAt: now, ok: errors === 0, errors, warnings, checks };
}

// ---------- Cash position: what is expected, owed and due, cumulative from the start of the year ----------
export type CashPosition = {
  month: string; yearStart: string;
  receivable: { count: number; amount: number };
  owedToStores: { count: number; goods: number; storeShipping: number; total: number };
  customerBalances: { count: number; amount: number };
  tax: { accrued: number; paid: number; due: number };
  ytd: { income: number; expenses: number; profit: number; net: number; orders: number };
  note: string;
};
export const cashPositionNote = "Платежи, выкуп и доставка в Atlas симулируются: суммы — отметки в книгах, а не остатки на счетах. Налог — ориентир, сверьте с бухгалтером.";
/** `summaries` are the months from January to `month` of the same year (any order); obligations is the live snapshot. */
export function cashPosition(month: string, summaries: MonthSummary[], obligations: Obligations): CashPosition {
  const yearStart = month.slice(0, 4) + "-01";
  const ytd = summaries.filter((item) => item.month >= yearStart && item.month <= month);
  const accrued = sum(ytd.map((item) => item.tax)), paid = sum(ytd.map((item) => item.taxPaid));
  return {
    month, yearStart,
    receivable: { ...obligations.pendingOrders },
    owedToStores: { ...obligations.transitToStores },
    customerBalances: { ...obligations.customerBalances },
    tax: { accrued, paid, due: Math.max(0, accrued - paid) },
    ytd: { income: sum(ytd.map((item) => item.income.total)), expenses: sum(ytd.map((item) => item.expenses.total)), profit: sum(ytd.map((item) => item.profit)), net: sum(ytd.map((item) => item.net)), orders: sum(ytd.map((item) => item.orders)) },
    note: cashPositionNote,
  };
}

// ---------- Tax calendar: quarterly profit tax periods (a guide for the owner, not a filing) ----------
export type TaxQuarter = { quarter: 1 | 2 | 3 | 4; label: string; months: string[]; periodEnd: string; deadline: string; tax: number; accruedToDate: number; paidToDate: number; due: number; status: "upcoming" | "current" | "due" | "paid" | "overdue" | "none" };
export type TaxCalendar = { year: number; taxRate: number; note: string; quarters: TaxQuarter[] };
export const taxCalendarNote = "Ориентир, сверьте с бухгалтером: отчётные периоды и сроки могут отличаться от режима налогообложения Atlas. Суммы — по ставке из настроек.";
const lastDay = (month: string) => { const [year, mon] = month.split("-").map(Number); return `${month}-${String(new Date(Date.UTC(year, mon, 0)).getUTCDate()).padStart(2, "0")}`; };
/** `taxPaid` — live `tax_paid` entries (any date, the next year's first months included for the fourth quarter). */
export function taxCalendar(summary: YearSummary, taxPaid: LedgerEntry[], now = Date.now()): TaxCalendar {
  const today = dayOf(now), year = summary.year;
  const deadlines = [`${year}-04-20`, `${year}-07-20`, `${year}-10-20`, `${year + 1}-03-01`];
  let accrued = 0;
  const quarters = summary.quarters.map((quarter, index): TaxQuarter => {
    accrued += quarter.tax;
    const deadline = deadlines[index], periodEnd = lastDay(quarter.months[2]);
    const paidToDate = sum(taxPaid.filter((entry) => !entry.voidedAt && entry.kind === "tax_paid" && entry.occurredOn >= `${year}-01-01` && entry.occurredOn <= deadline).map((entry) => entry.amountUzs));
    const due = Math.max(0, accrued - paidToDate);
    const status: TaxQuarter["status"] = today < `${quarter.months[0]}-01` ? "upcoming" : today <= periodEnd ? "current" : due === 0 ? (quarter.tax === 0 && accrued === 0 ? "none" : "paid") : today <= deadline ? "due" : "overdue";
    return { quarter: (index + 1) as TaxQuarter["quarter"], label: quarter.label, months: quarter.months, periodEnd, deadline, tax: quarter.tax, accruedToDate: accrued, paidToDate, due, status };
  });
  return { year, taxRate: summary.taxRate, note: taxCalendarNote, quarters };
}

// ---------- Bank statement import: parse, match by order number, propose — the operator confirms ----------
export type BankLine = { row: number; date: string; amount: number; purpose: string; orderId?: string };
export type BankParse = { lines: BankLine[]; errors: { row: number; reason: string }[] };
const orderNumber = /\bAT-[0-9A-F]{8,12}\b/i;
function parseDay(text: string): string | null {
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/); if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ru = text.match(/^(\d{2})[./](\d{2})[./](\d{4})/); if (ru) return `${ru[3]}-${ru[2]}-${ru[1]}`;
  return null;
}
const parseAmount = (text: string) => { const clean = text.replace(/[\s ]/g, "").replace(/^["']|["']$/g, ""); if (!/^[-+]?\d+([.,]\d+)?$/.test(clean)) return NaN; return Math.round(Number(clean.replace(",", "."))); };
const unquote = (text: string) => text.trim().replace(/^"([\s\S]*)"$/, "$1").replace(/""/g, '"');
/** Lines "date;amount;purpose" (";", tab or "," separated; a header line and empty lines are skipped). */
export function parseBankStatement(text: string, maxLines = 2000): BankParse {
  const out: BankParse = { lines: [], errors: [] };
  const raw = text.replace(/^﻿/, "").split(/\r?\n/);
  for (let index = 0; index < raw.length && out.lines.length + out.errors.length < maxLines; index++) {
    const line = raw[index]; if (!line.trim()) continue;
    const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const parts = line.split(delimiter);
    const row = index + 1;
    if (parts.length < 2) { if (index === 0) continue; out.errors.push({ row, reason: "Нужны хотя бы дата и сумма" }); continue; }
    const date = parseDay(unquote(parts[0]));
    if (!date) { if (index === 0) continue; out.errors.push({ row, reason: "Дата не распознана (ГГГГ-ММ-ДД или ДД.ММ.ГГГГ)" }); continue; }
    const amount = parseAmount(unquote(parts[1]));
    if (!Number.isFinite(amount) || amount <= 0) { out.errors.push({ row, reason: "Сумма не распознана или не положительна" }); continue; }
    const purpose = unquote(parts.slice(2).join(delimiter)).slice(0, 300);
    const match = purpose.match(orderNumber);
    out.lines.push({ row, date, amount, purpose, ...(match ? { orderId: match[0].toUpperCase() } : {}) });
  }
  return out;
}
export type BankProposal = { row: number; date: string; amount: number; purpose: string; orderId?: string; found: boolean; status?: OrderFinance["status"]; payable?: number; alreadyRecorded: boolean; action: "propose" | "skip"; reason: string; entry?: LedgerEntryInput };
/** `recorded` — order id → sum of live customer_payment entries already in the ledger. Nothing is written here. */
export function matchBankLines(lines: BankLine[], orders: Record<string, OrderFinance>, recorded: Record<string, number>): BankProposal[] {
  return lines.map((line): BankProposal => {
    const base = { row: line.row, date: line.date, amount: line.amount, purpose: line.purpose, ...(line.orderId ? { orderId: line.orderId } : {}) };
    if (!line.orderId) return { ...base, found: false, alreadyRecorded: false, action: "skip", reason: "В назначении нет номера заказа AT-…" };
    const order = orders[line.orderId];
    if (!order) return { ...base, found: false, alreadyRecorded: false, action: "skip", reason: "Заказ с таким номером не найден" };
    const already = (recorded[line.orderId] ?? 0) > 0;
    if (order.status === "cancelled") return { ...base, found: true, status: order.status, payable: order.payable, alreadyRecorded: already, action: "skip", reason: "Заказ отменён; оформите возврат вручную, если деньги пришли" };
    if (already) return { ...base, found: true, status: order.status, payable: order.payable, alreadyRecorded: true, action: "skip", reason: `Оплата по заказу уже записана (${recorded[line.orderId]} сум, автозапись или вручную)` };
    const differs = line.amount !== order.payable;
    return {
      ...base, found: true, status: order.status, payable: order.payable, alreadyRecorded: false, action: "propose",
      reason: differs ? `Сумма отличается от суммы к оплате ${order.payable} сум — проверьте перед подтверждением` : "Сумма совпадает с заказом",
      entry: { kind: "customer_payment", amountUzs: line.amount, occurredOn: line.date, orderId: line.orderId, counterparty: "Банк (выписка)", note: `Выписка банка, строка ${line.row}: ${line.purpose}`.slice(0, 500) },
    };
  });
}

// ---------- Invoice-calculation for the customer: data for printing, never a fiscal document ----------
export type InvoiceLine = { kind: string; label: string; amount: number };
export type InvoiceData = {
  number: string; issuedAt: number; createdAt: number; paidAt?: number;
  status: OrderFinance["status"]; statusRu: string;
  customer: { id: string; name?: string; email?: string; phone?: string };
  lines: InvoiceLine[];
  goods: number; services: number; delivery: number; total: number;
  split: { transit: number; atlasIncome: number };
  disclaimer: string;
};
export const invoiceDisclaimer = "Не фискальный документ. Счёт-расчёт Atlas: оплата, выкуп и доставка в Atlas симулируются, списания и банковского подтверждения нет. Цены магазина, доставка и таможня — ориентир на момент расчёта.";
const invoiceStatusRu = { pending: "ожидает оплаты", paid: "оплата отмечена в Atlas", refunded: "возвращён на баланс", cancelled: "отменён" } as const;
export function invoiceData(finance: OrderFinance, feeLines: InvoiceLine[], customer: InvoiceData["customer"], total?: number, now = Date.now()): InvoiceData {
  const lines = feeLines.filter((line) => line.amount !== 0);
  const adjustments = sum(feeLines.filter((line) => line.kind.startsWith("adjustment_")).map((line) => line.amount));
  const of = (...kinds: string[]) => sum(feeLines.filter((line) => kinds.includes(line.kind)).map((line) => line.amount));
  return {
    number: finance.orderId, issuedAt: now, createdAt: finance.createdAt, ...(finance.paidAt !== undefined ? { paidAt: finance.paidAt } : {}),
    status: finance.status, statusRu: invoiceStatusRu[finance.status], customer, lines,
    goods: of("item", "adjustment_price", "adjustment_variant", "adjustment_substitution"),
    services: of("service", "buyout", "conversion", "optional_services", "customs_help", "adjustment_warehouse-service"),
    delivery: of("merchant_shipping", "international_shipping", "delivery_margin", "international_reserve", "adjustment_source-shipping"),
    total: total ?? Math.max(0, finance.payable + adjustments),
    split: { transit: finance.goods + finance.storeShipping + finance.reserve, atlasIncome: finance.revenue },
    disclaimer: invoiceDisclaimer,
  };
}

// ---------- Full book of a month: every ledger row (auto, manual, bank, voided) and the order rows ----------
const dayText = (at?: number) => at ? dayOf(at) : "";
const statusRu = { pending: "ожидает оплаты", paid: "оплачен", refunded: "возвращён", cancelled: "отменён" } as const;
export function fullBookCsv(month: string, orders: OrderFinance[], entries: LedgerEntry[], summary: MonthSummary) {
  const rows: unknown[][] = [["Полная книга месяца", month], ["Доход Atlas", summary.income.total, "Расходы", summary.expenses.total, "Прибыль до налога", summary.profit, `Налог (${Math.round(summary.taxRate * 1000) / 10}%, ориентир)`, summary.tax, "Налог уплачен", summary.taxPaid], []];
  rows.push(["Журнал"], ["Номер", "Источник", "Дата", "Вид", "Группа", "Направление", "Сумма, сум", "Сумма в валюте", "Валюта", "Заказ", "Контрагент", "Комментарий", "Внёс", "Аннулировано", "Причина"]);
  for (const e of entries) { const k = ledgerKinds[e.kind]; rows.push([e.id, entrySourceRu(e.id), e.occurredOn, k.ru, { transit: "транзит", expense: "расход", income: "доход", tax: "налог" }[k.group], k.direction === "in" ? "приход" : "расход", e.amountUzs, e.originalAmount === undefined ? "" : String(e.originalAmount).replace(".", ","), e.originalCurrency ?? "", e.orderId ?? "", e.counterparty ?? "", e.note ?? "", e.createdBy, dayText(e.voidedAt), e.voidReason ?? ""]); }
  rows.push([], ["Заказы"], ["Заказ", "Клиент", "Создан", "Оплачен", "Статус", "Товар (транзит)", "Доставка магазина (транзит)", "Резерв (транзит)", "Комиссия Atlas", "Международная доставка", "Курсовая наценка", "Услуги", "Доход Atlas", "К оплате клиентом"]);
  for (const o of orders) rows.push([o.orderId, o.customerId, dayText(o.createdAt), dayText(o.paidAt), statusRu[o.status], o.goods, o.storeShipping, o.reserve, o.commission, o.delivery, o.fxGain, o.services, o.revenue, o.payable]);
  return toCsv(rows);
}
