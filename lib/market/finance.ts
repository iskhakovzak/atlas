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
export const accountingSettingsSchema = z.object({
  /** Profit tax rate as a share (0.15 = 15%). Set by the owner after checking with the accountant. */
  profitTaxRate: z.number().min(0).max(0.5).default(0.15),
});
export type AccountingSettings = z.infer<typeof accountingSettingsSchema>;

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
    ["Дата", "Вид", "Группа", "Направление", "Сумма, сум", "Сумма в валюте", "Валюта", "Заказ", "Контрагент", "Комментарий", "Внёс", "Аннулировано", "Причина"],
    ...entries.map((e) => { const k = ledgerKinds[e.kind]; return [e.occurredOn, k.ru, { transit: "транзит", expense: "расход", income: "доход", tax: "налог" }[k.group], k.direction === "in" ? "приход" : "расход", e.amountUzs, e.originalAmount === undefined ? "" : String(e.originalAmount).replace(".", ","), e.originalCurrency ?? "", e.orderId ?? "", e.counterparty ?? "", e.note ?? "", e.createdBy, day(e.voidedAt), e.voidReason ?? ""]; }),
  ]);
}

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
