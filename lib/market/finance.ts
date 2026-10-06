import { z } from "zod";
import type { Order } from "./domain.ts";

/**
 * Accounting for Atlas as a purchasing agent.
 * - Transit (not Atlas income): money for the goods and the store's delivery, customs paid for a customer,
 *   refunds. It passes through Atlas to the store, the carrier's customs broker or back to the customer.
 * - Income: the Atlas fee (service, buyout, conversion), international delivery with its margin, the 1.2%
 *   markup on the Central Bank rate, extra services, the customs-help fee and other income.
 * - Expenses: what the operator records in the ledger (carrier, payment and bank fees, packaging, salaries…).
 * Profit = income − expenses; the profit tax is profit × the rate set in the admin (confirm it with the accountant).
 */
export const ledgerKinds = {
  goods_purchase: { direction: "out", group: "transit", ru: "Оплата магазину за товар", uz: "Do‘konga tovar uchun to‘lov", en: "Paid to the store for goods" },
  store_shipping: { direction: "out", group: "transit", ru: "Доставка магазина", uz: "Do‘kon yetkazishi", en: "Store delivery" },
  customs_paid: { direction: "out", group: "transit", ru: "Пошлина, оплаченная за клиента", uz: "Mijoz uchun to‘langan boj", en: "Customs paid for a customer" },
  refund: { direction: "out", group: "transit", ru: "Возврат клиенту", uz: "Mijozga qaytarish", en: "Refund to a customer" },
  carrier: { direction: "out", group: "expense", ru: "Перевозчик (международная доставка)", uz: "Tashuvchi (xalqaro yetkazish)", en: "Carrier (international delivery)" },
  payment_fee: { direction: "out", group: "expense", ru: "Комиссия платёжной системы", uz: "To‘lov tizimi komissiyasi", en: "Payment provider fee" },
  bank_fee: { direction: "out", group: "expense", ru: "Банк и конвертация", uz: "Bank va konvertatsiya", en: "Bank and conversion" },
  packaging: { direction: "out", group: "expense", ru: "Склад и упаковка", uz: "Ombor va qadoqlash", en: "Warehouse and packaging" },
  salary: { direction: "out", group: "expense", ru: "Зарплаты и подрядчики", uz: "Ish haqi va pudratchilar", en: "Salaries and contractors" },
  rent: { direction: "out", group: "expense", ru: "Аренда", uz: "Ijara", en: "Rent" },
  marketing: { direction: "out", group: "expense", ru: "Реклама", uz: "Reklama", en: "Marketing" },
  software: { direction: "out", group: "expense", ru: "Сервисы и хостинг", uz: "Servislar va xosting", en: "Software and hosting" },
  other_expense: { direction: "out", group: "expense", ru: "Прочий расход", uz: "Boshqa xarajat", en: "Other expense" },
  tax_paid: { direction: "out", group: "tax", ru: "Уплаченный налог на прибыль", uz: "To‘langan foyda solig‘i", en: "Profit tax paid" },
  customer_payment: { direction: "in", group: "transit", ru: "Оплата от клиента", uz: "Mijozdan to‘lov", en: "Payment from a customer" },
  /** The customer paid an order from the internal balance: an internal movement, not new money (auto entry). */
  balance_payment: { direction: "in", group: "transit", ru: "Оплата с внутреннего баланса", uz: "Ichki balansdan to‘lov", en: "Paid from the internal balance" },
  /** Money credited back to the customer's internal balance (weighing, store delivery, customs, cancellation): no bank transfer. */
  balance_refund: { direction: "out", group: "transit", ru: "Возврат на внутренний баланс", uz: "Ichki balansga qaytarish", en: "Credited back to the internal balance" },
  customs_reimbursed: { direction: "in", group: "transit", ru: "Клиент вернул пошлину", uz: "Mijoz bojni qaytardi", en: "Customs reimbursed by a customer" },
  customs_help_fee: { direction: "in", group: "income", ru: "Комиссия за помощь с таможней", uz: "Bojxona yordami komissiyasi", en: "Customs-help fee" },
  other_income: { direction: "in", group: "income", ru: "Прочий доход", uz: "Boshqa daromad", en: "Other income" },
} as const;
export type LedgerKind = keyof typeof ledgerKinds;
const kindNames = Object.keys(ledgerKinds) as [LedgerKind, ...LedgerKind[]];

/** What the operator enters: one money movement. Amounts are in soum; a foreign amount keeps its currency and rate. */
export const ledgerEntryInput = z.object({
  kind: z.enum(kindNames),
  amountUzs: z.number().int().positive().max(100_000_000_000),
  originalAmount: z.number().positive().max(10_000_000).optional(),
  originalCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  orderId: z.string().trim().max(40).optional(),
  counterparty: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});
export type LedgerEntryInput = z.infer<typeof ledgerEntryInput>;
export type LedgerEntry = LedgerEntryInput & { id: string; createdBy: string; createdAt: number; voidedAt?: number; voidReason?: string };
export const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const accountingSettingsSchema = z.object({
  /** Profit tax rate as a share (0.15 = 15%). Set by the owner after checking with the accountant. */
  profitTaxRate: z.number().min(0).max(0.5).default(0.15),
  /** Months up to and including this one are closed: no ledger entry may be added or voided there. */
  lockedThrough: monthKey.optional(),
  /** Soum per unit of a foreign currency for the ledger form (USD comes from the tariff). Set by the owner; the accountant checks it. */
  fxRates: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().positive().max(1_000_000)).optional(),
});
export type AccountingSettings = z.infer<typeof accountingSettingsSchema>;
/** True when a date ("YYYY-MM-DD") or month ("YYYY-MM") falls into a closed period. */
export const isPeriodLocked = (settings: Pick<AccountingSettings, "lockedThrough">, dateOrMonth: string) => !!settings.lockedThrough && dateOrMonth.slice(0, 7) <= settings.lockedThrough;
export const lockedPeriodMessage = (month: string) => `Период ${month} закрыт. Чтобы изменить его, откройте месяц заново с указанием причины.`;

/** Soum for a foreign amount: USD by the tariff rate, other currencies by the accounting settings; null when the rate is unknown. */
export function convertToUzs(amount: number, currency: string, usdRate: number, fxRates?: Record<string, number>): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const rate = currency === "UZS" ? 1 : currency === "USD" ? usdRate : fxRates?.[currency];
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(amount * rate);
}

/** One order in the books, from its quote snapshot, weight settlement and approved changes. All amounts in soum. */
export type OrderFinance = {
  orderId: string; customerId: string; createdAt: number;
  /** "paid" counts in income; cancelled and refunded orders never do. */
  status: "pending" | "paid" | "refunded" | "cancelled";
  paidAt?: number; month?: string;
  goods: number; storeShipping: number; reserve: number; payable: number;
  commission: number; delivery: number; fxGain: number; services: number; revenue: number;
};
export const monthOf = (at: number) => new Date(at + 5 * 3600_000).toISOString().slice(0, 7); // Tashkent time

export function orderFinance(order: Order, customerId: string): OrderFinance {
  const q = order.quote;
  // The markup on the Central Bank rate is part of the goods line; it is Atlas income, the rest is transit.
  const fxGain = q.fxMarkup ? Math.round(q.merchandise * (1 - 1 / q.fxMarkup)) : 0;
  const approved = (order.changeRequests ?? []).filter((item) => item.status === "approved" && item.amountDelta !== 0);
  const delta = (kinds: string[]) => approved.filter((item) => kinds.includes(item.kind)).reduce((sum, item) => sum + item.amountDelta, 0);
  // After weighing, the final shipping replaces the estimate; the unused reserve went back to the customer.
  const shipping = order.settlement ? order.settlement.shipping : q.shipping;
  const commission = q.service + (q.buyout ?? 0) + (q.conversion ?? 0);
  const delivery = shipping + (q.deliveryMargin ?? 0);
  const services = (q.optionalServices ?? 0) + (q.customsHelp ?? 0) + delta(["warehouse-service"]);
  const goods = q.merchandise - fxGain + delta(["price", "variant", "substitution"]);
  const storeShipping = (order.storeShippingSettlement ? order.storeShippingSettlement.actual : q.sourceShipping ?? 0) + delta(["source-shipping"]);
  const status = order.cancelled ? "cancelled" : order.payment?.status === "paid" ? "paid" : order.payment?.status === "refunded" ? "refunded" : "pending";
  const paidAt = status === "paid" ? order.payment?.updatedAt : undefined;
  return {
    orderId: order.id, customerId, createdAt: order.createdAt, status, paidAt, month: paidAt ? monthOf(paidAt) : undefined,
    goods, storeShipping, reserve: order.settlement ? 0 : q.reserve, payable: q.total,
    commission, delivery, fxGain, services, revenue: commission + delivery + fxGain + services,
  };
}

export type MonthSummary = {
  month: string; orders: number;
  income: { commission: number; delivery: number; fxGain: number; services: number; other: number; total: number };
  transit: { goodsCharged: number; storeShippingCharged: number; in: number; out: number };
  expenses: Partial<Record<LedgerKind, number>> & { total: number };
  profit: number; taxRate: number; tax: number; net: number; taxPaid: number;
};

/** A month's result: income from orders paid that month plus income entries, minus that month's expenses. */
export function monthSummary(month: string, orders: OrderFinance[], entries: LedgerEntry[], taxRate: number): MonthSummary {
  const paid = orders.filter((order) => order.status === "paid" && order.month === month);
  const live = entries.filter((entry) => !entry.voidedAt && entry.occurredOn.slice(0, 7) === month);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const of = (group: string, direction?: string) => live.filter((entry) => ledgerKinds[entry.kind].group === group && (!direction || ledgerKinds[entry.kind].direction === direction));
  const income = {
    commission: sum(paid.map((order) => order.commission)), delivery: sum(paid.map((order) => order.delivery)),
    fxGain: sum(paid.map((order) => order.fxGain)), services: sum(paid.map((order) => order.services)),
    other: sum(of("income").map((entry) => entry.amountUzs)), total: 0,
  };
  income.total = income.commission + income.delivery + income.fxGain + income.services + income.other;
  const expenses: MonthSummary["expenses"] = { total: 0 };
  for (const entry of of("expense")) { expenses[entry.kind] = (expenses[entry.kind] ?? 0) + entry.amountUzs; expenses.total += entry.amountUzs; }
  const profit = income.total - expenses.total, tax = Math.round(Math.max(0, profit) * taxRate);
  return {
    month, orders: paid.length, income,
    transit: { goodsCharged: sum(paid.map((order) => order.goods)), storeShippingCharged: sum(paid.map((order) => order.storeShipping)), in: sum(of("transit", "in").map((entry) => entry.amountUzs)), out: sum(of("transit", "out").map((entry) => entry.amountUzs)) },
    expenses, profit, taxRate, tax, net: profit - tax, taxPaid: sum(of("tax").map((entry) => entry.amountUzs)),
  };
}

// ---------- CSV for the accountant: ";" separated, UTF-8 with BOM, opens directly in Excel ----------
const cell = (value: unknown) => { const text = value === undefined || value === null ? "" : String(value); return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
export const toCsv = (rows: unknown[][]) => "﻿" + rows.map((row) => row.map(cell).join(";")).join("\r\n") + "\r\n";
const day = (at?: number) => at ? new Date(at + 5 * 3600_000).toISOString().slice(0, 10) : "";
const statusRu = { pending: "ожидает оплаты", paid: "оплачен", refunded: "возвращён", cancelled: "отменён" } as const;

export function ordersCsv(orders: OrderFinance[]) {
  return toCsv([
    ["Заказ", "Клиент", "Создан", "Оплачен", "Статус", "Товар (транзит)", "Доставка магазина (транзит)", "Резерв (транзит)", "Комиссия Atlas", "Международная доставка", "Курсовая наценка", "Услуги", "Доход Atlas", "К оплате клиентом"],
    ...orders.map((o) => [o.orderId, o.customerId, day(o.createdAt), day(o.paidAt), statusRu[o.status], o.goods, o.storeShipping, o.reserve, o.commission, o.delivery, o.fxGain, o.services, o.revenue, o.payable]),
  ]);
}

export function ledgerCsv(entries: LedgerEntry[]) {
  return toCsv([
    ["Дата", "Вид", "Группа", "Направление", "Сумма, сум", "Сумма в валюте", "Валюта", "Заказ", "Контрагент", "Комментарий", "Внёс", "Аннулировано", "Причина", "Источник", "Номер"],
    ...entries.map((e) => { const k = ledgerKinds[e.kind]; return [e.occurredOn, k.ru, { transit: "транзит", expense: "расход", income: "доход", tax: "налог" }[k.group], k.direction === "in" ? "приход" : "расход", e.amountUzs, e.originalAmount === undefined ? "" : String(e.originalAmount).replace(".", ","), e.originalCurrency ?? "", e.orderId ?? "", e.counterparty ?? "", e.note ?? "", e.createdBy, day(e.voidedAt), e.voidReason ?? "", entrySourceRu(e.id), e.id]; }),
  ]);
}
/** Where an entry came from, by its id prefix: AUTO- (from order events), BANK- (bank statement import), LED- (entered by hand). */
export const entrySource = (id: string): "auto" | "bank" | "manual" => id.startsWith("AUTO-") ? "auto" : id.startsWith("BANK-") ? "bank" : "manual";
export const entrySourceRu = (id: string) => ({ auto: "авто", bank: "выписка", manual: "вручную" })[entrySource(id)];

export function summaryCsv(months: MonthSummary[]) {
  const expenseKinds = (Object.keys(ledgerKinds) as LedgerKind[]).filter((kind) => ledgerKinds[kind].group === "expense");
  return toCsv([
    ["Месяц", "Оплаченных заказов", "Комиссия Atlas", "Доставка", "Курсовая наценка", "Услуги", "Прочий доход", "Доход всего", ...expenseKinds.map((kind) => ledgerKinds[kind].ru), "Расходы всего", "Прибыль до налога", "Ставка налога", "Налог на прибыль", "Чистая прибыль", "Налог уплачен", "Товар получен (транзит)", "Доставка магазина получена (транзит)"],
    ...months.map((m) => [m.month, m.orders, m.income.commission, m.income.delivery, m.income.fxGain, m.income.services, m.income.other, m.income.total, ...expenseKinds.map((kind) => m.expenses[kind] ?? 0), m.expenses.total, m.profit, `${Math.round(m.taxRate * 1000) / 10}%`, m.tax, m.net, m.taxPaid, m.transit.goodsCharged, m.transit.storeShippingCharged]),
  ]);
}

/** Months from `from` to `to` inclusive, "YYYY-MM". */
export function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  let [year, month] = from.split("-").map(Number);
  const [endYear, endMonth] = to.split("-").map(Number);
  while ((year < endYear || (year === endYear && month <= endMonth)) && out.length < 120) { out.push(`${year}-${String(month).padStart(2, "0")}`); month++; if (month > 12) { month = 1; year++; } }
  return out;
}

// ---------- Year: twelve months, four quarters (the profit tax in Uzbekistan is reported quarterly — a guide, not a filing) ----------
export type PeriodTotal = Omit<MonthSummary, "month" | "taxRate"> & { label: string; months: string[] };
export type YearSummary = { year: number; taxRate: number; months: MonthSummary[]; quarters: PeriodTotal[]; total: PeriodTotal };

/** Adds up month summaries into one period; the tax is the sum of the months' tax, not recomputed on the netted profit. */
export function sumSummaries(label: string, months: MonthSummary[]): PeriodTotal {
  const sum = (pick: (m: MonthSummary) => number) => months.reduce((total, m) => total + pick(m), 0);
  const expenses: PeriodTotal["expenses"] = { total: sum((m) => m.expenses.total) };
  for (const m of months) for (const [kind, value] of Object.entries(m.expenses)) if (kind !== "total") expenses[kind as LedgerKind] = (expenses[kind as LedgerKind] ?? 0) + (value as number);
  return {
    label, months: months.map((m) => m.month), orders: sum((m) => m.orders),
    income: { commission: sum((m) => m.income.commission), delivery: sum((m) => m.income.delivery), fxGain: sum((m) => m.income.fxGain), services: sum((m) => m.income.services), other: sum((m) => m.income.other), total: sum((m) => m.income.total) },
    transit: { goodsCharged: sum((m) => m.transit.goodsCharged), storeShippingCharged: sum((m) => m.transit.storeShippingCharged), in: sum((m) => m.transit.in), out: sum((m) => m.transit.out) },
    expenses, profit: sum((m) => m.profit), tax: sum((m) => m.tax), net: sum((m) => m.net), taxPaid: sum((m) => m.taxPaid),
  };
}
export const yearMonths = (year: number) => monthsBetween(`${year}-01`, `${year}-12`);
export function yearSummary(year: number, orders: OrderFinance[], entries: LedgerEntry[], taxRate: number): YearSummary {
  const months = yearMonths(year).map((month) => monthSummary(month, orders, entries, taxRate));
  const quarters = [0, 1, 2, 3].map((q) => sumSummaries(`${q + 1} кв. ${year}`, months.slice(q * 3, q * 3 + 3)));
  return { year, taxRate, months, quarters, total: sumSummaries(`${year} год`, months) };
}

// ---------- Per-order margin: the order's Atlas income minus the ledger expenses linked to it (carrier, payment fee…) ----------
export type OrderMargin = { orderId: string; revenue: number; linkedExpenses: number; linkedTransitOut: number; linkedTransitIn: number; margin: number; entries: LedgerEntry[] };
export function orderMargin(order: OrderFinance, entries: LedgerEntry[]): OrderMargin {
  const linked = entries.filter((entry) => !entry.voidedAt && entry.orderId === order.orderId);
  const of = (group: string, direction: string) => linked.filter((entry) => ledgerKinds[entry.kind].group === group && ledgerKinds[entry.kind].direction === direction).reduce((sum, entry) => sum + entry.amountUzs, 0);
  const linkedExpenses = of("expense", "out");
  return { orderId: order.orderId, revenue: order.revenue, linkedExpenses, linkedTransitOut: of("transit", "out"), linkedTransitIn: of("transit", "in"), margin: order.revenue - linkedExpenses, entries: linked };
}
export const orderMargins = (orders: OrderFinance[], entries: LedgerEntry[]) => orders.map((order) => orderMargin(order, entries));

// ---------- Receivables and obligations (a snapshot, not a payment: all payments on the site are simulated) ----------
export type Obligations = {
  /** Orders waiting for the customer's payment: the amount Atlas expects. */
  pendingOrders: { count: number; amount: number };
  /** Internal customer balances (credit Atlas owes back or will apply to a next order). */
  customerBalances: { count: number; amount: number };
  /** Paid by the customer but not yet bought from the store: goods and store delivery still to be paid out. */
  transitToStores: { count: number; goods: number; storeShipping: number; total: number };
};
/** `stages` maps order id → order stage ("0" = waiting for buyout, "1" = bought …, "cancelled"); balances are per customer. */
export function obligations(orders: OrderFinance[], stages: Record<string, string>, balances: number[]): Obligations {
  const pending = orders.filter((order) => order.status === "pending");
  const unbought = orders.filter((order) => order.status === "paid" && stages[order.orderId] === "0");
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const positive = balances.filter((value) => value > 0);
  const goods = sum(unbought.map((order) => order.goods)), storeShipping = sum(unbought.map((order) => order.storeShipping));
  return {
    pendingOrders: { count: pending.length, amount: sum(pending.map((order) => order.payable)) },
    customerBalances: { count: positive.length, amount: sum(positive) },
    transitToStores: { count: unbought.length, goods, storeShipping, total: goods + storeShipping },
  };
}

// ---------- Ledger search and paging ----------
export type LedgerFilter = { kind?: LedgerKind | "" ; orderId?: string; counterparty?: string; text?: string; voided?: "all" | "live" | "voided" };
export function filterLedger(entries: LedgerEntry[], filter: LedgerFilter) {
  const norm = (value?: string) => (value ?? "").trim().toLowerCase();
  const orderId = norm(filter.orderId), counterparty = norm(filter.counterparty), text = norm(filter.text);
  return entries.filter((entry) => {
    if (filter.kind && entry.kind !== filter.kind) return false;
    if (filter.voided === "live" && entry.voidedAt) return false;
    if (filter.voided === "voided" && !entry.voidedAt) return false;
    if (orderId && !norm(entry.orderId).includes(orderId)) return false;
    if (counterparty && !norm(entry.counterparty).includes(counterparty)) return false;
    if (text && ![entry.note, entry.counterparty, entry.orderId, ledgerKinds[entry.kind].ru, entry.id].some((field) => norm(field).includes(text))) return false;
    return true;
  });
}
export const ledgerPageSize = 100;
export function paginate<T>(items: T[], page: number, size = ledgerPageSize) {
  const pages = Math.max(1, Math.ceil(items.length / size)), current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length };
}
/** A copy of an entry for the "fix" flow: void the old one, add this one edited. */
export const entryDraftFrom = (entry: LedgerEntry): LedgerEntryInput => ({ kind: entry.kind, amountUzs: entry.amountUzs, occurredOn: entry.occurredOn, ...(entry.originalAmount !== undefined ? { originalAmount: entry.originalAmount } : {}), ...(entry.originalCurrency ? { originalCurrency: entry.originalCurrency } : {}), ...(entry.orderId ? { orderId: entry.orderId } : {}), ...(entry.counterparty ? { counterparty: entry.counterparty } : {}), ...(entry.note ? { note: entry.note } : {}) });

// ---------- Sparkline: an SVG path for a series, no library ----------
export type Sparkline = { path: string; area: string; points: { x: number; y: number; value: number }[]; min: number; max: number };
export function sparkline(values: number[], width = 320, height = 64, pad = 4): Sparkline {
  if (!values.length) return { path: "", area: "", points: [], min: 0, max: 0 };
  const min = Math.min(0, ...values), max = Math.max(0, ...values), span = max - min || 1;
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const points = values.map((value, index) => ({ x: Math.round((pad + index * stepX) * 100) / 100, y: Math.round((height - pad - ((value - min) / span) * (height - pad * 2)) * 100) / 100, value }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ");
  const zeroY = Math.round((height - pad - ((0 - min) / span) * (height - pad * 2)) * 100) / 100;
  const area = points.length > 1 ? `${path} L${points[points.length - 1].x} ${zeroY} L${points[0].x} ${zeroY} Z` : "";
  return { path, area, points, min, max };
}

// ---------- More CSV: orders with their margin, and the year by months ----------
export function orderMarginCsv(orders: OrderFinance[], entries: LedgerEntry[]) {
  return toCsv([
    ["Заказ", "Клиент", "Создан", "Оплачен", "Статус", "Доход Atlas", "Комиссия Atlas", "Международная доставка", "Курсовая наценка", "Услуги", "Привязанные расходы", "Фактическая маржа", "Транзит привязан: расход", "Транзит привязан: приход", "Товар (транзит)", "Доставка магазина (транзит)", "Записей журнала"],
    ...orders.map((o) => { const m = orderMargin(o, entries); return [o.orderId, o.customerId, day(o.createdAt), day(o.paidAt), statusRu[o.status], o.revenue, o.commission, o.delivery, o.fxGain, o.services, m.linkedExpenses, m.margin, m.linkedTransitOut, m.linkedTransitIn, o.goods, o.storeShipping, m.entries.length]; }),
  ]);
}
export function yearCsv(summary: YearSummary) {
  const row = (label: string, p: PeriodTotal | MonthSummary) => [label, p.orders, p.income.commission, p.income.delivery, p.income.fxGain, p.income.services, p.income.other, p.income.total, p.expenses.total, p.profit, p.tax, p.net, p.taxPaid, p.transit.goodsCharged, p.transit.storeShippingCharged];
  const rows: unknown[][] = [["Период", "Оплаченных заказов", "Комиссия Atlas", "Доставка", "Курсовая наценка", "Услуги", "Прочий доход", "Доход всего", "Расходы всего", "Прибыль до налога", `Налог на прибыль (${Math.round(summary.taxRate * 1000) / 10}%, ориентир)`, "Чистая прибыль", "Налог уплачен", "Товар получен (транзит)", "Доставка магазина получена (транзит)"]];
  summary.quarters.forEach((quarter, index) => { summary.months.slice(index * 3, index * 3 + 3).forEach((m) => rows.push(row(m.month, m))); rows.push(row(quarter.label, quarter)); });
  rows.push(row(summary.total.label, summary.total));
  return toCsv(rows);
}
