// Pure helpers for the admin dashboard: KPIs, the order funnel, the "needs attention" list, their thresholds
// (market_settings key "admin"), audit filters and CSV exports. No server imports, so tests run on node:test.
import { z } from "zod";
import { balanceOf, orderPayable, statuses, type Order, type Pricing, type State, type SupportTicket } from "./domain.ts";
import type { Permission } from "./access.ts";

const days = z.number().int().min(0).max(365);
/** Thresholds behind "Требуют внимания" (days / hours). Stored in market_settings key "admin"; every field optional so old rows parse. */
export const adminSettingsSchema = z.object({
  attention: z.object({
    pendingPaymentDays: days.default(2),
    paidNotBoughtDays: days.default(3),
    warehouseDays: days.default(7),
    topupDays: days.default(1),
    ticketDays: days.default(1),
    fxStaleHours: z.number().int().min(1).max(720).default(24),
  }).default({}),
  version: z.string().max(80).optional(),
  updatedAt: z.number().int().nonnegative().optional(),
  managedBy: z.string().max(160).optional(),
});
export type AdminSettings = z.infer<typeof adminSettingsSchema>;
export type AttentionThresholds = AdminSettings["attention"];
export const defaultAdminSettings: AdminSettings = adminSettingsSchema.parse({});
/** A stored value (JSON text or object) → settings; anything unreadable gives the defaults. */
export function parseAdminSettings(value: unknown): AdminSettings {
  try {
    const raw = typeof value === "string" ? JSON.parse(value) : value;
    const parsed = adminSettingsSchema.safeParse(raw ?? {});
    return parsed.success ? parsed.data : defaultAdminSettings;
  } catch { return defaultAdminSettings; }
}

export type DashboardAccount = { id: string; name: string; state: State; revision?: number; updatedAt: number };
const dayMs = 86_400_000;

// ---------- KPIs ----------
export type PeriodKpi = {
  /** Orders created in the period (cancelled ones included in `newOrders`, excluded from money). */
  newOrders: number;
  /** Orders whose payment is marked paid in Atlas (a mark, not money received) with the mark in the period. */
  paidMarks: number;
  /** Sum payable of non-cancelled orders created in the period, soum. */
  payable: number;
  /** `payable` / non-cancelled orders, soum; 0 when none. */
  averageCheck: number;
  /** Cart → order: accounts that placed an order in the period over accounts that touched a cart or ordered. 0–1. */
  conversion: number;
  convertedAccounts: number;
  engagedAccounts: number;
};
export type DashboardKpis = { today: PeriodKpi; week: PeriodKpi; month: PeriodKpi };
function startOfDay(now: number) { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function periodKpi(accounts: DashboardAccount[], from: number, now = Date.now()): PeriodKpi {
  let newOrders = 0, paidMarks = 0, payable = 0, live = 0, converted = 0, engaged = 0;
  for (const account of accounts) {
    const orders = account.state.orders;
    const inPeriod = orders.filter((order) => order.createdAt >= from && order.createdAt <= now);
    newOrders += inPeriod.length;
    for (const order of inPeriod) if (!order.cancelled) { live++; payable += orderPayable(order); }
    for (const order of orders) if (order.payment?.status === "paid" && order.payment.updatedAt >= from && order.payment.updatedAt <= now) paidMarks++;
    const touchedCart = account.state.cart.length > 0 && account.updatedAt >= from;
    if (inPeriod.some((order) => !order.cancelled)) { converted++; engaged++; }
    else if (touchedCart) engaged++;
  }
  return { newOrders, paidMarks, payable, averageCheck: live ? Math.round(payable / live) : 0, conversion: engaged ? converted / engaged : 0, convertedAccounts: converted, engagedAccounts: engaged };
}
export function dashboardKpis(accounts: DashboardAccount[], now = Date.now()): DashboardKpis {
  return { today: periodKpi(accounts, startOfDay(now), now), week: periodKpi(accounts, now - 7 * dayMs, now), month: periodKpi(accounts, now - 30 * dayMs, now) };
}

// ---------- Funnel ----------
export type FunnelStage = { status: number | "cancelled"; label: string; count: number };
export function orderFunnel(accounts: DashboardAccount[]): FunnelStage[] {
  const counts = new Array<number>(statuses.length).fill(0);
  let cancelled = 0;
  for (const account of accounts) for (const order of account.state.orders) {
    if (order.cancelled) cancelled++;
    else if (order.status >= 0 && order.status < statuses.length) counts[order.status]++;
  }
  return [...statuses.map((label, status) => ({ status, label, count: counts[status] })), { status: "cancelled" as const, label: "Отменён", count: cancelled }];
}

// ---------- Needs attention ----------
export type AttentionKind = "pending-payment" | "paid-not-bought" | "warehouse-stale" | "topup-unanswered" | "ticket-open" | "cart-price-change" | "fx-stale" | "catalog-error" | "staff-invited";
export type AttentionItem = { kind: AttentionKind; title: string; detail: string; href: string; at: number; accountId?: string; orderId?: string };
export const attentionKindLabels: Record<AttentionKind, string> = {
  "pending-payment": "Ожидают оплаты",
  "paid-not-bought": "Оплачены, не выкуплены",
  "warehouse-stale": "Залежались на складе",
  "topup-unanswered": "Доплаты без ответа",
  "ticket-open": "Открытые обращения",
  "cart-price-change": "Магазин изменил цену в корзине",
  "fx-stale": "Курс ЦБ устарел",
  "catalog-error": "Ошибки проверки каталога",
  "staff-invited": "Сотрудники без активации",
};
/** Which right opens each attention kind (everyone with the queue sees order items). */
export const attentionKindPermissions: Record<AttentionKind, Permission> = {
  "pending-payment": "operations.read", "paid-not-bought": "operations.read", "warehouse-stale": "operations.read", "topup-unanswered": "operations.read",
  "ticket-open": "support.reply", "cart-price-change": "operations.read", "fx-stale": "pricing.manage", "catalog-error": "catalog.manage", "staff-invited": "staff.manage",
};
export type AttentionInput = {
  accounts: DashboardAccount[];
  pricing?: Pick<Pricing, "fxSource" | "fxUpdatedAt" | "fxCbuDate"> | null;
  catalogErrors?: Array<{ id: string; name: string; error: string; at?: number }>;
  staff?: Array<{ email: string; displayName: string; status: string; updatedAt: number }>;
  settings?: AdminSettings;
  now?: number;
};
const lastHistoryAt = (order: Order) => order.history.length ? Math.max(...order.history.map((event) => event.at)) : order.createdAt;
const daysAgo = (at: number, now: number) => Math.floor((now - at) / dayMs);
const dayWord = (n: number) => { const t = n % 100, l = n % 10; return t >= 11 && t <= 14 ? "дней" : l === 1 ? "день" : l >= 2 && l <= 4 ? "дня" : "дней"; };
export const daysText = (n: number) => `${n} ${dayWord(n)}`;
/** Why an order waits for the customer's answer on more money; `null` when nothing is pending. */
export function pendingTopup(order: Order): string | null {
  if (order.cancelled) return null;
  if (order.settlement?.extra && !order.extraApproved) return "доплата за вес";
  if (order.storeShippingSettlement?.extra && !order.storeShippingExtraApproved) return "доплата за доставку магазина";
  if (order.customsSettlement?.extra && !order.customsExtraApproved) return "доплата за пошлину";
  const request = (order.changeRequests ?? []).find((item) => item.status === "pending");
  return request ? `запрос «${request.title}»` : null;
}
export function attentionItems(input: AttentionInput): AttentionItem[] {
  const now = input.now ?? Date.now(), t = (input.settings ?? defaultAdminSettings).attention, items: AttentionItem[] = [];
  const orderHref = (order: Order) => `/operations#${encodeURIComponent(order.id)}`;
  for (const account of input.accounts) {
    for (const order of account.state.orders) {
      if (order.cancelled) continue;
      const base = { accountId: account.id, orderId: order.id, href: orderHref(order) };
      if (order.status === 0 && order.payment?.status === "pending" && now - order.createdAt >= t.pendingPaymentDays * dayMs)
        items.push({ ...base, kind: "pending-payment", title: `${order.id} · ${account.name}`, detail: `Ожидает оплаты ${daysText(daysAgo(order.createdAt, now))}`, at: order.createdAt });
      if (order.status === 0 && order.payment?.status === "paid" && now - order.payment.updatedAt >= t.paidNotBoughtDays * dayMs)
        items.push({ ...base, kind: "paid-not-bought", title: `${order.id} · ${account.name}`, detail: `Отмечен оплаченным ${daysText(daysAgo(order.payment.updatedAt, now))} назад, выкуп не отмечен`, at: order.payment.updatedAt });
      if ((order.status === 2 || order.status === 3) && now - lastHistoryAt(order) >= t.warehouseDays * dayMs)
        items.push({ ...base, kind: "warehouse-stale", title: `${order.id} · ${account.name}`, detail: `${statuses[order.status]} уже ${daysText(daysAgo(lastHistoryAt(order), now))}`, at: lastHistoryAt(order) });
      const topup = pendingTopup(order);
      if (topup && now - lastHistoryAt(order) >= t.topupDays * dayMs)
        items.push({ ...base, kind: "topup-unanswered", title: `${order.id} · ${account.name}`, detail: `Без ответа клиента: ${topup}, ${daysText(daysAgo(lastHistoryAt(order), now))}`, at: lastHistoryAt(order) });
    }
    for (const ticket of account.state.supportTickets as SupportTicket[]) {
      if (ticket.status === "open" && now - ticket.updatedAt >= t.ticketDays * dayMs)
        items.push({ kind: "ticket-open", title: `${ticket.subject} · ${account.name}`, detail: `Без ответа ${daysText(daysAgo(ticket.updatedAt, now))}`, href: "/admin?tab=support", at: ticket.updatedAt, accountId: account.id });
    }
    const changed = account.state.cart.filter((item) => item.priceChange);
    if (changed.length) {
      const latest = Math.max(...changed.map((item) => item.priceChange!.at));
      items.push({ kind: "cart-price-change", title: account.name, detail: `${changed.length} поз. в корзине: ${changed.map((item) => `${item.product.name} ${item.priceChange!.previousPrice} → ${item.priceChange!.price} ${item.priceChange!.currency}`).join("; ").slice(0, 240)}`, href: `/admin?tab=customers&customer=${encodeURIComponent(account.id)}`, at: latest, accountId: account.id });
    }
  }
  const pricing = input.pricing;
  if (pricing && pricing.fxSource === "cbu" && now - (pricing.fxUpdatedAt ?? 0) >= t.fxStaleHours * 3_600_000)
    items.push({ kind: "fx-stale", title: "Курс ЦБ не обновлялся", detail: pricing.fxUpdatedAt ? `Последнее обновление ${new Date(pricing.fxUpdatedAt).toLocaleString("ru-RU")}${pricing.fxCbuDate ? ` (дата ЦБ ${pricing.fxCbuDate})` : ""}` : "Курс ещё ни разу не читался с сайта ЦБ", href: "/admin?tab=system", at: pricing.fxUpdatedAt ?? 0 });
  for (const entry of input.catalogErrors ?? [])
    items.push({ kind: "catalog-error", title: entry.name || entry.id, detail: entry.error.slice(0, 200), href: "/admin?tab=catalog", at: entry.at ?? 0 });
  for (const member of input.staff ?? []) if (member.status === "invited")
    items.push({ kind: "staff-invited", title: member.displayName, detail: `${member.email} приглашён ${daysText(daysAgo(member.updatedAt, now))} назад, статус не «Активен»`, href: "/admin?tab=staff", at: member.updatedAt });
  return items.sort((a, b) => a.at - b.at);
}
/** Only the kinds the viewer's rights open. */
export function attentionFor(items: AttentionItem[], can: (permission: Permission) => boolean) {
  return items.filter((item) => can(attentionKindPermissions[item.kind]));
}
export function groupAttention(items: AttentionItem[]) {
  const groups = new Map<AttentionKind, AttentionItem[]>();
  for (const item of items) groups.set(item.kind, [...(groups.get(item.kind) ?? []), item]);
  return [...groups].map(([kind, list]) => ({ kind, label: attentionKindLabels[kind], items: list }));
}

// ---------- Customers ----------
export type CustomerRow = {
  id: string; name: string; email: string; phone: string; locale: string; status: "active" | "review" | "blocked";
  orders: number; activeOrders: number; payable: number; balance: number; openTickets: number; cartLines: number; cartPriceChanges: number; createdAt: number; updatedAt: number;
};
export function customerRow(account: DashboardAccount, status: CustomerRow["status"] = "active"): CustomerRow {
  const state = account.state, orders = state.orders.filter((order) => !order.cancelled);
  const firstOrder = state.orders.length ? Math.min(...state.orders.map((order) => order.createdAt)) : account.updatedAt;
  return {
    id: account.id, name: account.name, email: state.communication.email || (account.id.startsWith("email:") ? account.id.slice(6) : ""), phone: state.communication.phone || state.deliveryProfile?.phone || "", locale: state.communication.language, status,
    orders: state.orders.length, activeOrders: orders.filter((order) => order.status < 5).length, payable: orders.reduce((sum, order) => sum + orderPayable(order), 0), balance: balanceOf(state),
    openTickets: state.supportTickets.filter((ticket) => ticket.status === "open").length, cartLines: state.cart.length, cartPriceChanges: state.cart.filter((item) => item.priceChange).length, createdAt: firstOrder, updatedAt: account.updatedAt,
  };
}
/** Name, phone, email, account id or an order number; empty query keeps everything. */
export function searchCustomers<T extends DashboardAccount>(accounts: T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase("ru");
  if (!q) return accounts;
  const digits = q.replace(/\D/g, "");
  return accounts.filter((account) => {
    const row = customerRow(account);
    if ([row.name, row.email, account.id].some((value) => value.toLocaleLowerCase("ru").includes(q))) return true;
    if (digits.length >= 4 && row.phone.replace(/\D/g, "").includes(digits)) return true;
    return account.state.orders.some((order) => order.id.toLocaleLowerCase("ru").includes(q));
  });
}
const csvCell = (value: unknown) => { const text = value == null ? "" : String(value); return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text; };
export const csvOf = (rows: unknown[][]) => "﻿" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
/** Contacts and totals only: never identity documents, addresses or passport data. */
export function customersCsv(rows: CustomerRow[]) {
  return csvOf([
    ["id", "Имя", "Email", "Телефон", "Язык", "Доступ", "Заказов", "В работе", "Сумма к оплате, сум", "Баланс, сум", "Открытых обращений", "Позиций в корзине", "Первый заказ", "Обновлён"],
    ...rows.map((row) => [row.id, row.name, row.email, row.phone, row.locale, row.status, row.orders, row.activeOrders, row.payable, row.balance, row.openTickets, row.cartLines, new Date(row.createdAt).toISOString(), new Date(row.updatedAt).toISOString()]),
  ]);
}

// ---------- Audit ----------
export type AuditLike = { id: string; actorEmail: string; action: string; entityType: string; entityId?: string; details?: string; createdAt: number };
export type AuditQuery = { actor?: string; entity?: string; from?: string; to?: string; q?: string; page?: number; pageSize?: number };
export const auditPageSize = 50;
/** "YYYY-MM-DD" → the first millisecond of that day (local), or `null`. */
export function dayStart(value?: string | null) { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; const at = new Date(value + "T00:00:00").getTime(); return Number.isFinite(at) ? at : null; }
export function dayEnd(value?: string | null) { const start = dayStart(value); return start === null ? null : start + dayMs - 1; }
export function filterAudit<T extends AuditLike>(events: T[], query: AuditQuery): T[] {
  const from = dayStart(query.from), to = dayEnd(query.to), q = query.q?.trim().toLocaleLowerCase("ru");
  return events.filter((event) =>
    (!query.actor || query.actor === "all" || event.actorEmail === query.actor) &&
    (!query.entity || query.entity === "all" || event.entityType === query.entity) &&
    (from === null || event.createdAt >= from) && (to === null || event.createdAt <= to) &&
    (!q || [event.action, event.entityType, event.entityId ?? "", event.actorEmail, event.details ?? ""].join(" ").toLocaleLowerCase("ru").includes(q)));
}
export function pageOf<T>(items: T[], page = 1, size = auditPageSize) {
  const pages = Math.max(1, Math.ceil(items.length / size)), current = Math.min(Math.max(1, page), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length, pageSize: size };
}
export function auditCsv(events: AuditLike[]) {
  return csvOf([["Время", "Автор", "Действие", "Объект", "ID", "Детали"], ...events.map((event) => [new Date(event.createdAt).toISOString(), event.actorEmail, event.action, event.entityType, event.entityId ?? "", event.details ?? ""])]);
}
/** Event details for the expanded row: parsed JSON when possible, otherwise the raw text. */
export function auditDetails(event: Pick<AuditLike, "details">): { pretty: string; fields: Array<[string, string]> } {
  if (!event.details) return { pretty: "", fields: [] };
  try {
    const value = JSON.parse(event.details);
    if (value && typeof value === "object" && !Array.isArray(value))
      return { pretty: JSON.stringify(value, null, 2), fields: Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, typeof item === "string" ? item : JSON.stringify(item)]) };
    return { pretty: JSON.stringify(value, null, 2), fields: [] };
  } catch { return { pretty: event.details, fields: [] }; }
}
/** The policy history from the log: one row per `policy.update`, with the saved version when it was recorded. */
export function policyHistory(events: AuditLike[]) {
  return events.filter((event) => event.action === "policy.update").sort((a, b) => b.createdAt - a.createdAt).map((event) => ({ id: event.id, at: event.createdAt, actor: event.actorEmail, ...auditDetails(event) }));
}

// ---------- Team ----------
export type StaffLike = { email: string; displayName: string; role: string; status: string; updatedAt: number };
export function filterStaff<T extends StaffLike>(members: T[], filter: { role?: string; status?: string; q?: string }) {
  const q = filter.q?.trim().toLocaleLowerCase("ru");
  return members.filter((member) => (!filter.role || filter.role === "all" || member.role === filter.role) && (!filter.status || filter.status === "all" || member.status === filter.status) && (!q || `${member.displayName} ${member.email}`.toLocaleLowerCase("ru").includes(q)));
}
/** Who may be disabled: never yourself (err_55), never the primary administrator (err_56). Returns the error code or `null`. */
export function staffDeactivationError(input: { targetEmail: string; actorEmail: string; operatorEmail?: string | null }) {
  const target = input.targetEmail.trim().toLowerCase();
  if (target === input.actorEmail.trim().toLowerCase()) return "err_55";
  if (input.operatorEmail && target === input.operatorEmail.trim().toLowerCase()) return "err_56";
  return null;
}
/** The invitation text for a staff member: sign-in by email code, then "Управление". */
export function inviteText(email: string, siteUrl = "atlas") {
  return `Откройте ${siteUrl}, войдите по коду на email ${email.trim().toLowerCase()} (или через Google с этим адресом), затем нажмите «Управление» в шапке. Вход по телефону или Telegram доступа не даёт.`;
}

// ---------- Rules ----------
export type PolicyDraft = { maxCartLines: number; maxCartWeightKg: number; maxMerchandiseUsd: number; blockedCategories: string[]; restrictedTerms: string[] };
/** Field → message for the rules form; empty when the draft is valid (mirrors policySchema's limits). */
export function policyErrors(draft: PolicyDraft): Partial<Record<keyof PolicyDraft, string>> {
  const errors: Partial<Record<keyof PolicyDraft, string>> = {};
  if (!Number.isInteger(draft.maxCartLines) || draft.maxCartLines < 1 || draft.maxCartLines > 20) errors.maxCartLines = "От 1 до 20 позиций";
  if (!Number.isFinite(draft.maxCartWeightKg) || draft.maxCartWeightKg <= 0 || draft.maxCartWeightKg > 200) errors.maxCartWeightKg = "От 0,1 до 200 кг";
  if (!Number.isFinite(draft.maxMerchandiseUsd) || draft.maxMerchandiseUsd <= 0 || draft.maxMerchandiseUsd > 50_000) errors.maxMerchandiseUsd = "От 1 до 50 000 USD";
  if (draft.blockedCategories.length > 20 || draft.blockedCategories.some((item) => item.length < 1 || item.length > 80)) errors.blockedCategories = "До 20 категорий, каждая до 80 символов";
  if (draft.restrictedTerms.length > 40 || draft.restrictedTerms.some((item) => item.length < 2 || item.length > 80)) errors.restrictedTerms = "До 40 слов, каждое от 2 до 80 символов";
  return errors;
}

// ---------- Tariff summary ----------
export type PricingSnapshot = { fx: number; fxSource: string; fxDate?: string; fxUpdatedAt?: number; expressPerKgUsd: number; standardPerKgUsd: number; marginPercent: number; reserve: number; customsHelpPercent: number; storeShippingFreeFromUsd: number; updatedAt: number; version: string; managedBy?: string };
export function pricingSnapshot(pricing: Pricing): PricingSnapshot {
  return {
    fx: pricing.fx, fxSource: pricing.fxSource === "cbu" ? `ЦБ × ${pricing.fxMarkup}` : "установлен вручную", fxDate: pricing.fxCbuDate, fxUpdatedAt: pricing.fxUpdatedAt,
    expressPerKgUsd: pricing.perKgUsd ?? 15.98, standardPerKgUsd: pricing.standardPerKgUsd ?? 13.98, marginPercent: Math.round(pricing.margin * 10000) / 100, reserve: pricing.reserve,
    customsHelpPercent: Math.round(pricing.customsHelpFee * 10000) / 100, storeShippingFreeFromUsd: pricing.storeShippingFreeFromUsd, updatedAt: pricing.updatedAt, version: pricing.version, managedBy: pricing.managedBy,
  };
}

// ---------- Tabs ----------
export const adminTabIds = ["overview", "catalog", "content", "customers", "support", "finance", "pricing", "staff", "rules", "system", "audit"] as const;
export type AdminTabId = typeof adminTabIds[number];
export function isAdminTab(value: unknown): value is AdminTabId { return typeof value === "string" && (adminTabIds as readonly string[]).includes(value); }
/** The tab from `?tab=`; unknown or missing → "overview". */
export function tabFromSearch(search: string): AdminTabId { const value = new URLSearchParams(search).get("tab"); return isAdminTab(value) ? value : "overview"; }
export function searchWithTab(search: string, tab: AdminTabId) { const params = new URLSearchParams(search); if (tab === "overview") params.delete("tab"); else params.set("tab", tab); params.delete("customer"); const text = params.toString(); return text ? `?${text}` : ""; }
