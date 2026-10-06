// Pure helpers for Admin → «Для инвестора»: the anonymised snapshot, periods and the comparison with the previous
// period, KPIs, monthly dynamics, unit economics, the funnel, geography, cohorts, the growth model (a model on
// editable assumptions, never a company forecast) and the CSV / text summaries. No server imports: tests run on node:test.
//
// Honesty rules baked in: payments in Atlas are simulated, so "paid" means a mark in Atlas, not money received;
// every figure comes from the Atlas database (market_order_finance, market_order_records, market_customers,
// market_ledger_entries, market_order_events and the account documents for country / category / cart); the model
// is computed only from assumptions the viewer sees and edits, and nothing from it is stored.
import { ledgerKinds, monthOf, monthsBetween, toCsv, type LedgerKind, type OrderFinance } from "./finance.ts";

// ---------- Snapshot (anonymised: no emails, no names; customers become c1, c2, …) ----------
export type InvestorPayment = "pending" | "paid" | "refunded" | "cancelled";
export type InvestorOrder = {
  id: string;
  /** Opaque customer key from the snapshot (c1, c2, …), never an email or account id. */
  customer: string;
  createdAt: number;
  payment: InvestorPayment;
  paidAt?: number;
  /** Order stage from the operational projection: 0 waiting for buyout … 5 delivered; cancelled orders carry "cancelled". */
  stage: number | "cancelled";
  /** When the order reached «Доставлен» by the order events; absent when it has not. */
  deliveredAt?: number;
  payable: number; goods: number; storeShipping: number; commission: number; delivery: number; fxGain: number; services: number; revenue: number;
  /** Live ledger expense entries linked to the order (carrier, payment fee, …), soum. */
  linkedExpenses: number;
  country?: string; category?: string; host?: string;
};
export type InvestorCustomer = { key: string; createdAt: number; isTest: boolean; cartLines: number };
export type InvestorSnapshot = {
  orders: InvestorOrder[];
  customers: InvestorCustomer[];
  computedAt: number;
  /** What the server could read: which sources answered, how many account documents gave country / category. */
  coverage: { financeRows: number; recordRows: number; customerRows: number; accountsRead: number; ordersWithCountry: number; deliveredDates: number; ledgerLinked: number };
};

export const testEmailDomains = ["atlas.local", "sites.test"] as const;
/** Test accounts: the e2e / smoke domains (atlas.local, sites.test) and the e2e-* names; checked on the email and on the account id. */
export function isTestAccount(input: { email?: string | null; id?: string | null }): boolean {
  const candidates = [input.email, input.id].filter((value): value is string => typeof value === "string" && value.length > 0).map((value) => value.trim().toLowerCase());
  for (const value of candidates) {
    const address = value.startsWith("email:") ? value.slice(6) : value;
    const at = address.lastIndexOf("@");
    const domain = at >= 0 ? address.slice(at + 1) : "";
    const local = at >= 0 ? address.slice(0, at) : address;
    if ((testEmailDomains as readonly string[]).includes(domain)) return true;
    if (local.startsWith("e2e-") || address.startsWith("e2e-")) return true;
  }
  return false;
}

export const hostOf = (url?: string | null) => {
  if (!url) return undefined;
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return undefined; }
};
const expenseKinds = new Set((Object.keys(ledgerKinds) as LedgerKind[]).filter((kind) => ledgerKinds[kind].group === "expense"));
export const isExpenseKind = (kind: string) => expenseKinds.has(kind as LedgerKind);

export type SnapshotInput = {
  finance: OrderFinance[];
  /** market_order_records: id → stage ("0"…"5" or "cancelled"), source url and store name. */
  records: Record<string, { status: string; sourceUrl?: string | null; sourceStore?: string | null }>;
  customers: Array<{ id: string; email?: string | null; createdAt: number }>;
  /** order id → sum of live ledger expense entries linked to it. */
  linkedExpenses: Record<string, number>;
  /** order id → when the «Доставлен» event was recorded. */
  deliveredAt: Record<string, number>;
  /** From the account documents: order id → product country / category; customer id → cart lines. */
  orderMeta: Record<string, { country?: string; category?: string; host?: string }>;
  cartLines: Record<string, number>;
  accountsRead: number;
  now?: number;
};
/** Assembles the anonymised snapshot: customer ids become c1, c2, … in order of first appearance; orders keep only money, dates, stage and source facts. */
export function buildInvestorSnapshot(input: SnapshotInput): InvestorSnapshot {
  const now = input.now ?? Date.now();
  const keys = new Map<string, string>(), customers: InvestorCustomer[] = [];
  const customerRows = new Map(input.customers.map((row) => [row.id, row]));
  const firstOrderAt = new Map<string, number>();
  for (const order of input.finance) firstOrderAt.set(order.customerId, Math.min(firstOrderAt.get(order.customerId) ?? Infinity, order.createdAt));
  const ids = [...new Set([...input.customers.map((row) => row.id), ...input.finance.map((order) => order.customerId)])]
    .sort((a, b) => (firstOrderAt.get(a) ?? customerRows.get(a)?.createdAt ?? now) - (firstOrderAt.get(b) ?? customerRows.get(b)?.createdAt ?? now));
  for (const id of ids) {
    const key = `c${customers.length + 1}`, row = customerRows.get(id);
    keys.set(id, key);
    const createdAt = Math.min(row?.createdAt ?? Infinity, firstOrderAt.get(id) ?? Infinity);
    customers.push({ key, createdAt: createdAt === Infinity ? now : createdAt, isTest: isTestAccount({ email: row?.email, id }), cartLines: input.cartLines[id] ?? 0 });
  }
  let ordersWithCountry = 0, deliveredDates = 0, ledgerLinked = 0;
  const orders: InvestorOrder[] = input.finance.map((order) => {
    const record = input.records[order.orderId], meta = input.orderMeta[order.orderId] ?? {};
    const stage: InvestorOrder["stage"] = order.status === "cancelled" || record?.status === "cancelled" ? "cancelled" : record && /^[0-5]$/.test(record.status) ? Number(record.status) : 0;
    const host = meta.host ?? hostOf(record?.sourceUrl);
    const linked = input.linkedExpenses[order.orderId] ?? 0, deliveredAt = input.deliveredAt[order.orderId];
    if (meta.country) ordersWithCountry++;
    if (deliveredAt) deliveredDates++;
    if (linked) ledgerLinked++;
    return {
      id: order.orderId, customer: keys.get(order.customerId) ?? "c0", createdAt: order.createdAt, payment: order.status, ...(order.paidAt ? { paidAt: order.paidAt } : {}),
      stage, ...(deliveredAt ? { deliveredAt } : {}),
      payable: order.payable, goods: order.goods, storeShipping: order.storeShipping, commission: order.commission, delivery: order.delivery, fxGain: order.fxGain, services: order.services, revenue: order.revenue,
      linkedExpenses: linked,
      ...(meta.country ? { country: meta.country } : {}), ...(meta.category ? { category: meta.category } : {}), ...(host ? { host } : {}),
    };
  }).sort((a, b) => a.createdAt - b.createdAt);
  return { orders, customers, computedAt: now, coverage: { financeRows: input.finance.length, recordRows: Object.keys(input.records).length, customerRows: input.customers.length, accountsRead: input.accountsRead, ordersWithCountry, deliveredDates, ledgerLinked } };
}

// ---------- Filters: only paid marks, without test accounts ----------
export type InvestorFilter = { paidOnly?: boolean; excludeTest?: boolean };
export function filterSnapshot(snapshot: InvestorSnapshot, filter: InvestorFilter): { orders: InvestorOrder[]; customers: InvestorCustomer[] } {
  const testKeys = new Set(snapshot.customers.filter((customer) => customer.isTest).map((customer) => customer.key));
  const customers = filter.excludeTest ? snapshot.customers.filter((customer) => !customer.isTest) : snapshot.customers;
  const orders = snapshot.orders.filter((order) => (!filter.excludeTest || !testKeys.has(order.customer)) && (!filter.paidOnly || order.payment === "paid"));
  return { orders, customers };
}

// ---------- Periods: rolling windows so the previous period has the same length ----------
export type InvestorPeriod = "3m" | "6m" | "12m" | "all";
export const investorPeriods: Array<{ id: InvestorPeriod; label: string; months: number | null }> = [
  { id: "3m", label: "3 мес", months: 3 }, { id: "6m", label: "6 мес", months: 6 }, { id: "12m", label: "12 мес", months: 12 }, { id: "all", label: "Всё время", months: null },
];
export const dayMs = 86_400_000;
const monthMs = 30.4375 * dayMs;
export type PeriodRange = { from: number; to: number; previous: { from: number; to: number } | null; label: string };
/** "3m" = the last 91 days vs the 91 before them, and so on; "all" = from the earliest order with no previous period. */
export function periodRange(period: InvestorPeriod, now: number, earliest?: number): PeriodRange {
  const entry = investorPeriods.find((item) => item.id === period) ?? investorPeriods[3];
  if (entry.months === null) return { from: Math.min(earliest ?? now, now), to: now, previous: null, label: entry.label };
  const length = Math.round(entry.months * monthMs);
  const from = now - length + 1;
  return { from, to: now, previous: { from: from - length, to: from - 1 }, label: entry.label };
}
export const inRange = (at: number, range: { from: number; to: number }) => at >= range.from && at <= range.to;
export const ordersIn = (orders: InvestorOrder[], range: { from: number; to: number }) => orders.filter((order) => inRange(order.createdAt, range));

// ---------- KPIs ----------
export type InvestorKpis = {
  /** Non-cancelled orders created in the period. */
  orders: number;
  /** Orders with the paid mark (a mark in Atlas, not money received). */
  paidOrders: number;
  /** Sum payable of the non-cancelled orders, soum. */
  gmv: number;
  gmvPaid: number;
  /** Atlas income of the paid orders: commission + delivery + fx markup + services, soum. */
  revenue: number;
  /** revenue / gmvPaid: Atlas' share of a paid order. 0–1. */
  takeRate: number;
  /** (revenue − ledger expenses linked to the paid orders) / revenue. 0–1; 1 when nothing is linked yet. */
  grossMargin: number;
  linkedExpenses: number;
  /** Distinct customers with a non-cancelled order in the period. */
  activeCustomers: number;
  /** Share of active customers with two or more non-cancelled orders in the period. 0–1. */
  repeatRate: number;
  /** gmv / orders. */
  averageCheck: number;
  /** revenue / paidOrders. */
  revenuePerOrder: number;
  /** Customers whose first-ever order falls in the period. */
  newCustomers: number;
};
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
export function investorKpis(allOrders: InvestorOrder[], range: { from: number; to: number }): InvestorKpis {
  const live = ordersIn(allOrders, range).filter((order) => order.payment !== "cancelled" && order.stage !== "cancelled");
  const paid = live.filter((order) => order.payment === "paid");
  const perCustomer = new Map<string, number>();
  for (const order of live) perCustomer.set(order.customer, (perCustomer.get(order.customer) ?? 0) + 1);
  const firstOrder = new Map<string, number>();
  for (const order of allOrders) if (order.payment !== "cancelled") firstOrder.set(order.customer, Math.min(firstOrder.get(order.customer) ?? Infinity, order.createdAt));
  const gmv = sum(live.map((order) => order.payable)), gmvPaid = sum(paid.map((order) => order.payable));
  const revenue = sum(paid.map((order) => order.revenue)), linkedExpenses = sum(paid.map((order) => order.linkedExpenses));
  const repeat = [...perCustomer.values()].filter((count) => count >= 2).length;
  return {
    orders: live.length, paidOrders: paid.length, gmv, gmvPaid, revenue,
    takeRate: ratio(revenue, gmvPaid), grossMargin: revenue > 0 ? (revenue - linkedExpenses) / revenue : 0, linkedExpenses,
    activeCustomers: perCustomer.size, repeatRate: ratio(repeat, perCustomer.size),
    averageCheck: live.length ? Math.round(gmv / live.length) : 0, revenuePerOrder: paid.length ? Math.round(revenue / paid.length) : 0,
    newCustomers: [...firstOrder.values()].filter((at) => inRange(at, range)).length,
  };
}
/** Change against the previous period as a ratio (0.25 = +25 %); `null` when there is no previous period or it was zero. */
export function compareValue(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || !Number.isFinite(previous) || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}
export type KpiComparison = { current: InvestorKpis; previous: InvestorKpis | null; change: Record<keyof InvestorKpis, number | null> };
export function compareKpis(allOrders: InvestorOrder[], range: PeriodRange): KpiComparison {
  const current = investorKpis(allOrders, range), previous = range.previous ? investorKpis(allOrders, range.previous) : null;
  const change = {} as Record<keyof InvestorKpis, number | null>;
  for (const key of Object.keys(current) as (keyof InvestorKpis)[]) change[key] = previous ? compareValue(current[key], previous[key]) : null;
  return { current, previous, change };
}

// ---------- Months ----------
/** The last `count` calendar months ("YYYY-MM", Tashkent time) ending with the month of `now`. */
export function lastMonths(now: number, count = 12): string[] {
  const end = monthOf(now);
  const [year, month] = end.split("-").map(Number);
  const startIndex = year * 12 + (month - 1) - (count - 1);
  const start = `${Math.floor(startIndex / 12)}-${String((startIndex % 12) + 1).padStart(2, "0")}`;
  return monthsBetween(start, end);
}
export const monthNamesShort = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const monthLabel = (month: string) => `${monthNamesShort[Number(month.slice(5)) - 1]} ${month.slice(2, 4)}`;
export type MonthPoint = { month: string; orders: number; paidOrders: number; gmv: number; revenue: number; newCustomers: number };
/** Dynamics by the month the order was placed (not the month of the paid mark, which the accounting uses). */
export function monthlySeries(allOrders: InvestorOrder[], months: string[]): MonthPoint[] {
  const points = new Map(months.map((month) => [month, { month, orders: 0, paidOrders: 0, gmv: 0, revenue: 0, newCustomers: 0 }]));
  const firstOrder = new Map<string, number>();
  for (const order of allOrders) if (order.payment !== "cancelled" && order.stage !== "cancelled") firstOrder.set(order.customer, Math.min(firstOrder.get(order.customer) ?? Infinity, order.createdAt));
  for (const order of allOrders) {
    if (order.payment === "cancelled" || order.stage === "cancelled") continue;
    const point = points.get(monthOf(order.createdAt));
    if (!point) continue;
    point.orders++; point.gmv += order.payable;
    if (order.payment === "paid") { point.paidOrders++; point.revenue += order.revenue; }
  }
  for (const at of firstOrder.values()) { const point = points.get(monthOf(at)); if (point) point.newCustomers++; }
  return [...points.values()];
}
/** Median month-over-month growth of orders over the last full months with data (−0.5…1), or 0 when there are fewer than two months with orders. */
export function observedGrowth(series: MonthPoint[], window = 4): number {
  const recent = series.slice(-window).map((point) => point.orders);
  const rates: number[] = [];
  for (let index = 1; index < recent.length; index++) if (recent[index - 1] > 0) rates.push((recent[index] - recent[index - 1]) / recent[index - 1]);
  if (!rates.length) return 0;
  const sorted = [...rates].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(Math.max(-0.5, Math.min(1, median)) * 1000) / 1000;
}

// ---------- Unit economics of the average order ----------
export type UnitEconomics = {
  /** "paid": averages over paid orders; "quoted": no paid marks in the period, so averages over the non-cancelled quotes. */
  basis: "paid" | "quoted"; count: number;
  goods: number; storeShipping: number; commission: number; delivery: number; fxGain: number; services: number; revenue: number; linkedExpenses: number; contribution: number;
};
export function unitEconomics(allOrders: InvestorOrder[], range: { from: number; to: number }): UnitEconomics {
  const live = ordersIn(allOrders, range).filter((order) => order.payment !== "cancelled" && order.stage !== "cancelled");
  const paid = live.filter((order) => order.payment === "paid");
  const base = paid.length ? paid : live, basis: UnitEconomics["basis"] = paid.length ? "paid" : "quoted";
  const avg = (pick: (order: InvestorOrder) => number) => (base.length ? Math.round(sum(base.map(pick)) / base.length) : 0);
  const unit = { basis, count: base.length, goods: avg((o) => o.goods), storeShipping: avg((o) => o.storeShipping), commission: avg((o) => o.commission), delivery: avg((o) => o.delivery), fxGain: avg((o) => o.fxGain), services: avg((o) => o.services), revenue: avg((o) => o.revenue), linkedExpenses: avg((o) => o.linkedExpenses), contribution: 0 };
  unit.contribution = unit.revenue - unit.linkedExpenses;
  return unit;
}

// ---------- Funnel and operations ----------
export type FunnelStep = { id: "cart" | "order" | "paid" | "bought" | "delivered"; label: string; count: number };
export type InvestorFunnel = { steps: FunnelStep[]; averageDeliveryDays: number | null; deliveredWithDates: number; cancelled: number };
/** Carts are counted from the current account documents (a cart has no date), the rest from the period's orders. */
export function investorFunnel(allOrders: InvestorOrder[], customers: InvestorCustomer[], range: { from: number; to: number }): InvestorFunnel {
  const inPeriod = ordersIn(allOrders, range);
  const live = inPeriod.filter((order) => order.payment !== "cancelled" && order.stage !== "cancelled");
  const customersOrdered = new Set(live.map((order) => order.customer));
  const carts = customers.filter((customer) => customer.cartLines > 0 && !customersOrdered.has(customer.key)).length + customersOrdered.size;
  const delivered = live.filter((order) => order.stage === 5), dated = delivered.filter((order) => order.deliveredAt && order.deliveredAt > order.createdAt);
  const averageDeliveryDays = dated.length ? Math.round(sum(dated.map((order) => (order.deliveredAt! - order.createdAt) / dayMs)) * 10 / dated.length) / 10 : null;
  return {
    steps: [
      { id: "cart", label: "Корзина или заказ", count: carts },
      { id: "order", label: "Оформили заказ", count: customersOrdered.size },
      { id: "paid", label: "Отметка «оплачено»", count: new Set(live.filter((order) => order.payment === "paid").map((order) => order.customer)).size },
      { id: "bought", label: "Выкуплен", count: new Set(live.filter((order) => typeof order.stage === "number" && order.stage >= 1).map((order) => order.customer)).size },
      { id: "delivered", label: "Доставлен", count: new Set(delivered.map((order) => order.customer)).size },
    ],
    averageDeliveryDays, deliveredWithDates: dated.length, cancelled: inPeriod.length - live.length,
  };
}

// ---------- Geography and assortment ----------
export type ShareRow = { label: string; orders: number; gmv: number; share: number };
export function shareTable(allOrders: InvestorOrder[], range: { from: number; to: number }, key: (order: InvestorOrder) => string | undefined, fallback = "Не указано", limit = 8): ShareRow[] {
  const live = ordersIn(allOrders, range).filter((order) => order.payment !== "cancelled" && order.stage !== "cancelled");
  const groups = new Map<string, { orders: number; gmv: number }>();
  for (const order of live) { const label = key(order) || fallback; const group = groups.get(label) ?? { orders: 0, gmv: 0 }; group.orders++; group.gmv += order.payable; groups.set(label, group); }
  const total = live.length || 1;
  const rows = [...groups].map(([label, group]) => ({ label, orders: group.orders, gmv: group.gmv, share: group.orders / total })).sort((a, b) => b.orders - a.orders || b.gmv - a.gmv || a.label.localeCompare(b.label, "ru"));
  if (rows.length <= limit) return rows;
  const head = rows.slice(0, limit - 1), rest = rows.slice(limit - 1);
  return [...head, { label: "Остальные", orders: sum(rest.map((row) => row.orders)), gmv: sum(rest.map((row) => row.gmv)), share: sum(rest.map((row) => row.share)) }];
}
/** Country of dispatch → a short region for the investor table; unknown countries keep their name. */
export function regionOf(country?: string): string | undefined {
  if (!country) return undefined;
  const europe = new Set(["Испания", "Германия", "Великобритания", "Франция", "Италия", "Румыния", "Польша", "Нидерланды"]);
  if (europe.has(country)) return "Европа";
  return country;
}

// ---------- Cohorts: by the month of the first order, the share of customers who ordered again within 1 / 2 / 3 months ----------
export type CohortRow = { month: string; customers: number; retained: Array<number | null> };
export function retentionCohorts(allOrders: InvestorOrder[], months: string[], horizons = [1, 2, 3], now = Date.now()): CohortRow[] {
  const live = allOrders.filter((order) => order.payment !== "cancelled" && order.stage !== "cancelled");
  const byCustomer = new Map<string, number[]>();
  for (const order of live) byCustomer.set(order.customer, [...(byCustomer.get(order.customer) ?? []), order.createdAt]);
  const index = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1, currentIndex = index(monthOf(now));
  const cohorts = new Map(months.map((month) => [month, { month, customers: 0, back: horizons.map(() => 0) }]));
  for (const dates of byCustomer.values()) {
    const sorted = [...dates].sort((a, b) => a - b), first = monthOf(sorted[0]), cohort = cohorts.get(first);
    if (!cohort) continue;
    cohort.customers++;
    const firstIndex = index(first), later = new Set(sorted.slice(1).map((at) => index(monthOf(at)) - firstIndex));
    horizons.forEach((horizon, position) => { for (let step = 1; step <= horizon; step++) if (later.has(step)) { cohort.back[position]++; break; } });
  }
  return [...cohorts.values()].map((cohort) => ({
    month: cohort.month, customers: cohort.customers,
    // A horizon that has not fully elapsed yet (or an empty cohort) is null: nothing to claim.
    retained: horizons.map((horizon, position) => (cohort.customers && currentIndex - index(cohort.month) >= horizon ? cohort.back[position] / cohort.customers : null)),
  }));
}

// ---------- Growth model: a model on assumptions the viewer edits, never a forecast of the company ----------
export type GrowthAssumptions = { ordersPerMonth: number; growthPct: number; averageCheck: number; takeRate: number };
export type GrowthRow = { index: number; orders: number; gmv: number; revenue: number };
export type GrowthModel = { rows: GrowthRow[]; totalGmv: number; totalRevenue: number; totalOrders: number };
export function clampAssumptions(input: Partial<GrowthAssumptions>): GrowthAssumptions {
  const num = (value: unknown, fallback: number, min: number, max: number) => { const n = typeof value === "number" && Number.isFinite(value) ? value : fallback; return Math.min(max, Math.max(min, n)); };
  return { ordersPerMonth: num(input.ordersPerMonth, 0, 0, 1_000_000), growthPct: num(input.growthPct, 0, -50, 100), averageCheck: num(input.averageCheck, 0, 0, 1_000_000_000), takeRate: num(input.takeRate, 0, 0, 1) };
}
export function growthModel(input: Partial<GrowthAssumptions>, months = 12): GrowthModel {
  const a = clampAssumptions(input), rows: GrowthRow[] = [];
  for (let index = 1; index <= months; index++) {
    const orders = Math.round(a.ordersPerMonth * Math.pow(1 + a.growthPct / 100, index) * 10) / 10;
    const gmv = Math.round(orders * a.averageCheck), revenue = Math.round(gmv * a.takeRate);
    rows.push({ index, orders, gmv, revenue });
  }
  return { rows, totalGmv: sum(rows.map((row) => row.gmv)), totalRevenue: sum(rows.map((row) => row.revenue)), totalOrders: Math.round(sum(rows.map((row) => row.orders))) };
}
/** Assumptions pre-filled from facts: the last three full months' average orders, the observed growth, the period's average check and take rate. */
export function defaultAssumptions(series: MonthPoint[], kpis: InvestorKpis): GrowthAssumptions {
  const full = series.slice(-4, -1), orders = full.length ? sum(full.map((point) => point.orders)) / full.length : series.at(-1)?.orders ?? 0;
  return clampAssumptions({ ordersPerMonth: Math.round(orders * 10) / 10, growthPct: Math.round(observedGrowth(series) * 100), averageCheck: kpis.averageCheck, takeRate: Math.round(kpis.takeRate * 10000) / 10000 });
}

// ---------- The whole page in one object (the UI and the CSV share it) ----------
export type InvestorReport = {
  period: PeriodRange; filter: InvestorFilter; kpis: KpiComparison; months: MonthPoint[]; unit: UnitEconomics; funnel: InvestorFunnel;
  regions: ShareRow[]; stores: ShareRow[]; categories: ShareRow[]; cohorts: CohortRow[]; computedAt: number; coverage: InvestorSnapshot["coverage"]; testCustomers: number;
};
export function investorReport(snapshot: InvestorSnapshot, period: InvestorPeriod, filter: InvestorFilter, now = snapshot.computedAt): InvestorReport {
  const { orders, customers } = filterSnapshot(snapshot, filter);
  const range = periodRange(period, now, orders[0]?.createdAt);
  const months = lastMonths(now, 12);
  return {
    period: range, filter, kpis: compareKpis(orders, range), months: monthlySeries(orders, months), unit: unitEconomics(orders, range), funnel: investorFunnel(orders, customers, range),
    regions: shareTable(orders, range, (order) => regionOf(order.country), "Страна не указана"), stores: shareTable(orders, range, (order) => order.host, "Магазин не указан"), categories: shareTable(orders, range, (order) => order.category, "Категория не указана"),
    cohorts: retentionCohorts(orders, months, [1, 2, 3], now), computedAt: snapshot.computedAt, coverage: snapshot.coverage, testCustomers: snapshot.customers.filter((customer) => customer.isTest).length,
  };
}

// ---------- Text and CSV summaries ----------
export const honestyNote = "Платежи симулируются; «оплачено» — отметка в Atlas, не поступление денег. Прогноза нет: модель роста считается только из показанных допущений.";
const pct = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `${Math.round(value * 1000) / 10} %`);
const delta = (value: number | null) => (value === null ? "" : ` (${value >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(value * 100))} % к прошлому периоду)`);
const soum = (value: number) => `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} сум`;
const dateText = (at: number) => new Date(at + 5 * 3600_000).toISOString().slice(0, 10);
export function summaryText(report: InvestorReport): string {
  const k = report.kpis.current, c = report.kpis.change;
  return [
    `Atlas — покупки в зарубежных магазинах с доставкой в Узбекистан. Сводка за ${report.period.label.toLowerCase()}, данные Atlas на ${dateText(report.computedAt)}.`,
    `GMV: ${soum(k.gmv)}${delta(c.gmv)}`, `Выручка Atlas (по отметкам «оплачено»): ${soum(k.revenue)}${delta(c.revenue)}`,
    `Заказы: ${k.orders}${delta(c.orders)} · оплаченных отметок: ${k.paidOrders}`, `Активные клиенты: ${k.activeCustomers}${delta(c.activeCustomers)} · новые: ${k.newCustomers} · повторные покупки: ${pct(k.repeatRate)}`,
    `Средний чек: ${soum(k.averageCheck)}${delta(c.averageCheck)} · выручка с оплаченного заказа: ${soum(k.revenuePerOrder)}`, `Take rate: ${pct(k.takeRate)} · валовая маржа после привязанных расходов: ${pct(k.grossMargin)}`,
    `Фильтры: ${report.filter.paidOnly ? "только оплаченные" : "все неотменённые заказы"}, ${report.filter.excludeTest ? "без тестовых аккаунтов" : "включая тестовые аккаунты"}.`, honestyNote,
  ].join("\n");
}
export function investorCsv(report: InvestorReport): string {
  const k = report.kpis.current, p = report.kpis.previous, c = report.kpis.change;
  const row = (label: string, key: keyof InvestorKpis, format: (value: number) => string | number = (value) => value) => [label, format(k[key]), p ? format(p[key]) : "", c[key] === null ? "" : `${Math.round(c[key]! * 1000) / 10}%`];
  const share = (value: number) => `${Math.round(value * 1000) / 10}%`;
  return toCsv([
    ["Atlas — витрина для инвестора", `период: ${report.period.label}`, `данные на ${dateText(report.computedAt)}`, report.filter.paidOnly ? "только оплаченные" : "все неотменённые", report.filter.excludeTest ? "без тестовых аккаунтов" : "с тестовыми аккаунтами"],
    [honestyNote], [],
    ["Показатель", "Текущий период", "Предыдущий период", "Изменение"],
    row("GMV, сум", "gmv"), row("Выручка Atlas (оплаченные отметки), сум", "revenue"), row("Заказы", "orders"), row("Оплаченные отметки", "paidOrders"), row("Активные клиенты", "activeCustomers"), row("Новые клиенты", "newCustomers"),
    row("Повторные покупки", "repeatRate", share), row("Средний чек, сум", "averageCheck"), row("Выручка с оплаченного заказа, сум", "revenuePerOrder"), row("Take rate", "takeRate", share), row("Валовая маржа после привязанных расходов", "grossMargin", share), [],
    ["Месяц", "Заказы", "Оплаченные отметки", "GMV, сум", "Выручка Atlas, сум", "Новые клиенты"],
    ...report.months.map((point) => [point.month, point.orders, point.paidOrders, point.gmv, point.revenue, point.newCustomers]), [],
    ["Юнит-экономика среднего заказа", report.unit.basis === "paid" ? "по оплаченным" : "по сметам (оплаченных нет)", `заказов: ${report.unit.count}`],
    ["Товар (транзит)", report.unit.goods], ["Доставка магазина (транзит)", report.unit.storeShipping], ["Комиссия Atlas", report.unit.commission], ["Международная доставка", report.unit.delivery], ["Курсовая наценка", report.unit.fxGain], ["Услуги", report.unit.services], ["Доход Atlas", report.unit.revenue], ["Привязанные расходы журнала", report.unit.linkedExpenses], ["Вклад на заказ", report.unit.contribution], [],
    ["Воронка", ...report.funnel.steps.map((step) => step.label)], ["Клиентов", ...report.funnel.steps.map((step) => step.count)],
    ["Средний срок до «Доставлен», дней", report.funnel.averageDeliveryDays ?? "нет данных", `заказов с датой: ${report.funnel.deliveredWithDates}`], [],
    ["Регион отправки", "Заказы", "GMV, сум", "Доля"], ...report.regions.map((item) => [item.label, item.orders, item.gmv, share(item.share)]), [],
    ["Магазин", "Заказы", "GMV, сум", "Доля"], ...report.stores.map((item) => [item.label, item.orders, item.gmv, share(item.share)]), [],
    ["Категория", "Заказы", "GMV, сум", "Доля"], ...report.categories.map((item) => [item.label, item.orders, item.gmv, share(item.share)]), [],
    ["Когорта (месяц первого заказа)", "Клиентов", "Вернулись за 1 мес", "за 2 мес", "за 3 мес"], ...report.cohorts.map((cohort) => [cohort.month, cohort.customers, ...cohort.retained.map((value) => (value === null ? "" : share(value)))]),
  ]);
}
