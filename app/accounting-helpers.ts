import { entrySource, isPeriodLocked, ledgerKinds, type AccountingSettings, type LedgerEntry, type LedgerKind, type MonthSummary, type Obligations, type OrderFinance, type YearSummary } from '../lib/market/finance.ts';

/**
 * Pure helpers for the accounting screens (app/accounting-*.tsx): no React, no fetch, relative `.ts` imports so
 * tests/accounting-ui.test.mjs can import this file directly. Everything here is a reading aid for the operator;
 * the money itself is computed by lib/market/finance.ts on the server. Payments on the site are simulated, so
 * "paid" anywhere below means "marked paid in Atlas", never money received.
 */

// ---------- months ----------
export const monthNamesShort = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const monthNamesLong = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
/** "2026-10" → "октябрь 2026". */
export const monthLabel = (month: string) => { const index = Number(month.slice(5, 7)) - 1; return `${monthNamesLong[index] ?? month} ${month.slice(0, 4)}`; };
export const previousMonth = (month: string) => { const [year, index] = month.split('-').map(Number); return index === 1 ? `${year - 1}-12` : `${year}-${String(index - 1).padStart(2, '0')}`; };
export const nextMonth = (month: string) => { const [year, index] = month.split('-').map(Number); return index === 12 ? `${year + 1}-01` : `${year}-${String(index + 1).padStart(2, '0')}`; };
/** Today in Tashkent time, "YYYY-MM-DD". */
export const todayTashkent = (now = Date.now()) => new Date(now + 5 * 3600_000).toISOString().slice(0, 10);

// ---------- ledger entries ----------
/** Entries the engine writes itself (AUTO-…, createdBy "system:auto", see lib/market/finance-api.md) are view-only; BANK-… came from a confirmed bank statement. */
export type LedgerEntryView = LedgerEntry & { source?: string; auto?: boolean; reference?: string };
export const isAutoEntry = (entry: LedgerEntryView) => entrySource(entry.id) === 'auto' || entry.auto === true || entry.source === 'auto' || /^(system|auto)(:|@|$)/i.test(entry.createdBy ?? '');
export const isBankEntry = (entry: LedgerEntryView) => entrySource(entry.id) === 'bank' || entry.source === 'bank';
export const entrySourceLabel = (entry: LedgerEntryView) => isAutoEntry(entry) ? 'авто' : isBankEntry(entry) ? 'выписка' : 'вручную';
export const isEditableEntry = (entry: LedgerEntryView, settings: Pick<AccountingSettings, 'lockedThrough'>) => !entry.voidedAt && !isAutoEntry(entry) && !isPeriodLocked(settings, entry.occurredOn);
export const entryDirection = (entry: Pick<LedgerEntry, 'kind'>) => ledgerKinds[entry.kind]?.direction ?? 'out';
export const entryGroup = (entry: Pick<LedgerEntry, 'kind'>) => ledgerKinds[entry.kind]?.group ?? 'expense';
export const groupNames: Record<'expense' | 'income' | 'transit' | 'tax', string> = { expense: 'Расходы', income: 'Доходы', transit: 'Транзит (товар, доставка магазина, пошлины, возвраты)', tax: 'Налог' };
export const kindsOfGroup = (group: keyof typeof groupNames) => (Object.keys(ledgerKinds) as LedgerKind[]).filter((kind) => ledgerKinds[kind].group === group);

/** Extends lib/market/finance.ts filterLedger with "only auto", "group" and a date range; keeps the list order. */
export type LedgerViewFilter = { group?: '' | keyof typeof groupNames; auto?: 'all' | 'auto' | 'manual'; from?: string; to?: string };
export function filterLedgerView(entries: LedgerEntryView[], filter: LedgerViewFilter) {
  return entries.filter((entry) => {
    if (filter.group && entryGroup(entry) !== filter.group) return false;
    if (filter.auto === 'auto' && !isAutoEntry(entry)) return false;
    if (filter.auto === 'manual' && isAutoEntry(entry)) return false;
    if (filter.from && entry.occurredOn < filter.from) return false;
    if (filter.to && entry.occurredOn > filter.to) return false;
    return true;
  });
}

/** Client-side checks of a ledger draft before it goes to the server (the server validates again with Zod). */
export type EntryDraft = { kind: string; amountUzs: string; originalAmount: string; originalCurrency: string; occurredOn: string; orderId: string; counterparty: string; note: string };
export function validateDraft(draft: EntryDraft, settings: Pick<AccountingSettings, 'lockedThrough'>, today = todayTashkent()) {
  const errors: Partial<Record<keyof EntryDraft, string>> = {};
  if (!(draft.kind in ledgerKinds)) errors.kind = 'Выберите вид записи.';
  const amount = Number(draft.amountUzs);
  if (!draft.amountUzs.trim() || !Number.isInteger(amount) || amount <= 0) errors.amountUzs = 'Сумма в сумах — целое число больше нуля.';
  else if (amount > 100_000_000_000) errors.amountUzs = 'Слишком большая сумма.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.occurredOn)) errors.occurredOn = 'Укажите дату.';
  else if (draft.occurredOn > nextMonth(today.slice(0, 7)) + '-01') errors.occurredOn = 'Дата слишком далеко в будущем.';
  else if (isPeriodLocked(settings, draft.occurredOn)) errors.occurredOn = `Месяц ${draft.occurredOn.slice(0, 7)} закрыт — запись не сохранится.`;
  if (draft.originalAmount.trim()) {
    const foreign = Number(draft.originalAmount);
    if (!Number.isFinite(foreign) || foreign <= 0) errors.originalAmount = 'Сумма в валюте — число больше нуля.';
    if (!/^[A-Z]{3}$/.test(draft.originalCurrency)) errors.originalCurrency = 'Код валюты — три латинские буквы.';
  }
  if (draft.orderId.trim() && !/^[A-Za-z0-9-]{3,40}$/.test(draft.orderId.trim())) errors.orderId = 'Номер заказа выглядит как AT-… (буквы, цифры, дефис).';
  if (draft.counterparty.length > 120) errors.counterparty = 'Не длиннее 120 символов.';
  if (draft.note.length > 500) errors.note = 'Не длиннее 500 символов.';
  return errors;
}

// ---------- reconcile: what the engine reports plus what the client can see on its own ----------
export type ReconcileIssue = { severity: 'error' | 'warn' | 'info'; code: string; message: string; orderId?: string; entryId?: string };
type ServerIssue = string | { id?: string; severity?: string; code?: string; title?: string; detail?: string; message?: string; text?: string; orderId?: string; orderIds?: string[]; entryId?: string };
/** Normalises the engine's ReconcileReport (`checks`, severity ok|info|warn|error — "ok" rows are dropped), a plain `issues` list or strings into ReconcileIssue[]. */
export function normalizeIssues(raw: unknown): ReconcileIssue[] {
  const source = raw && typeof raw === 'object' ? raw as { checks?: unknown; issues?: unknown } : null;
  const list: ServerIssue[] = Array.isArray(raw) ? raw : source && Array.isArray(source.checks) ? source.checks as ServerIssue[] : source && Array.isArray(source.issues) ? source.issues as ServerIssue[] : [];
  return list.flatMap((item) => {
    if (typeof item === 'string') return item.trim() ? [{ severity: 'warn' as const, code: 'server', message: item }] : [];
    if (!item || typeof item !== 'object' || item.severity === 'ok') return [];
    const message = item.message ?? item.text ?? [item.title, item.detail].filter(Boolean).join(' — ');
    if (!message) return [];
    const severity = item.severity === 'error' || item.severity === 'info' ? item.severity : 'warn';
    const orderId = item.orderId ?? (Array.isArray(item.orderIds) && item.orderIds.length === 1 ? item.orderIds[0] : undefined);
    return [{ severity, code: item.code ?? item.id ?? 'server', message, ...(orderId ? { orderId } : {}), ...(item.entryId ? { entryId: item.entryId } : {}) }];
  });
}
/** Checks the client can make from the month's data alone; the engine's own reconcile comes on top. */
export function clientReconcile(input: { month: string; orders: OrderFinance[]; entries: LedgerEntryView[]; orderEntries: LedgerEntryView[]; stages: Record<string, string>; settings: AccountingSettings; usdRate: number }): ReconcileIssue[] {
  const issues: ReconcileIssue[] = [];
  const live = input.entries.filter((entry) => !entry.voidedAt);
  const known = new Set(input.orders.map((order) => order.orderId));
  for (const order of input.orders) {
    if (order.status === 'paid' && input.stages[order.orderId] === 'cancelled') issues.push({ severity: 'error', code: 'paid-cancelled', message: `Заказ ${order.orderId} отмечен оплаченным, но этап — «Отменён». Проверьте возврат или снимите отметку.`, orderId: order.orderId });
    if ((order.status === 'cancelled' || order.status === 'refunded') && input.orderEntries.some((entry) => !entry.voidedAt && entry.orderId === order.orderId && entryGroup(entry) === 'expense')) issues.push({ severity: 'warn', code: 'expense-on-cancelled', message: `К отменённому или возвращённому заказу ${order.orderId} привязаны расходы — они не покрываются доходом.`, orderId: order.orderId });
    if (order.status === 'paid' && order.revenue <= 0) issues.push({ severity: 'warn', code: 'zero-revenue', message: `У оплаченного заказа ${order.orderId} нулевой доход Atlas.`, orderId: order.orderId });
  }
  const missing = new Set<string>();
  for (const entry of live) {
    if (entry.originalCurrency && entry.originalCurrency !== 'USD' && entry.originalCurrency !== 'UZS' && !input.settings.fxRates?.[entry.originalCurrency]) missing.add(entry.originalCurrency);
    if (entry.orderId && !known.has(entry.orderId) && entry.occurredOn.slice(0, 7) === input.month) issues.push({ severity: 'info', code: 'order-not-in-month', message: `Запись ${entry.id.slice(0, 12)}… ссылается на заказ ${entry.orderId}, которого нет среди заказов месяца (возможно, оплачен в другом месяце).`, entryId: entry.id, orderId: entry.orderId });
    if (entry.originalAmount && entry.originalCurrency === 'USD' && input.usdRate > 0) {
      const expected = Math.round(entry.originalAmount * input.usdRate);
      if (Math.abs(expected - entry.amountUzs) / Math.max(1, expected) > 0.1) issues.push({ severity: 'info', code: 'fx-drift', message: `Запись ${entry.id.slice(0, 12)}…: ${entry.originalAmount} USD по текущему курсу — это около ${expected} сум, записано ${entry.amountUzs}. Курс на дату мог отличаться.`, entryId: entry.id });
    }
  }
  for (const code of missing) issues.push({ severity: 'warn', code: 'fx-missing', message: `Курс ${code} не задан, а в журнале есть записи в этой валюте. Заполните курсы в «Закрытии».` });
  if (!(input.settings.profitTaxRate > 0)) issues.push({ severity: 'warn', code: 'tax-rate', message: 'Ставка налога на прибыль равна 0 — налог не считается. Ориентир по умолчанию 15 %, сверьте с бухгалтером.' });
  return issues;
}
export const issuesSeverityOrder: Record<ReconcileIssue['severity'], number> = { error: 0, warn: 1, info: 2 };
export const sortIssues = (issues: ReconcileIssue[]) => [...issues].sort((a, b) => issuesSeverityOrder[a.severity] - issuesSeverityOrder[b.severity]);

// ---------- closing checklist ----------
export type ClosingCheck = { id: string; label: string; ok: boolean; required: boolean; detail: string };
export function closingChecklist(input: { month: string; summary: MonthSummary; entries: LedgerEntryView[]; orders: OrderFinance[]; settings: AccountingSettings; issues: ReconcileIssue[]; today?: string }): { checks: ClosingCheck[]; canClose: boolean } {
  const today = input.today ?? todayTashkent();
  const blocking = input.issues.filter((issue) => issue.severity !== 'info');
  const live = input.entries.filter((entry) => !entry.voidedAt && entry.occurredOn.slice(0, 7) === input.month);
  const currencies = [...new Set(live.map((entry) => entry.originalCurrency).filter((code): code is string => !!code && code !== 'USD' && code !== 'UZS'))];
  const missingRates = currencies.filter((code) => !input.settings.fxRates?.[code]);
  const pending = input.orders.filter((order) => order.status === 'pending').length;
  const locked = isPeriodLocked(input.settings, input.month);
  const previousOpen = !!input.settings.lockedThrough && input.settings.lockedThrough < previousMonth(input.month);
  const checks: ClosingCheck[] = [
    { id: 'ended', label: 'Месяц завершился', ok: input.month < today.slice(0, 7), required: true, detail: input.month < today.slice(0, 7) ? 'Можно закрывать.' : 'Текущий или будущий месяц закрывать рано.' },
    { id: 'reconcile', label: 'Расхождения сверки — 0', ok: blocking.length === 0, required: true, detail: blocking.length ? `${blocking.length} ${plural(blocking.length, ['расхождение', 'расхождения', 'расхождений'])} — см. «Обзор».` : 'Сверка чистая.' },
    { id: 'fx', label: 'Курсы валют заполнены', ok: missingRates.length === 0, required: true, detail: missingRates.length ? `Нет курса: ${missingRates.join(', ')}.` : currencies.length ? `Курсы заданы для ${currencies.join(', ')}.` : 'В журнале только сумы и USD.' },
    { id: 'tax', label: 'Налог рассчитан', ok: input.settings.profitTaxRate > 0, required: true, detail: input.settings.profitTaxRate > 0 ? `Ставка ${Math.round(input.settings.profitTaxRate * 1000) / 10} % — ориентир, сверьте с бухгалтером.` : 'Ставка 0 % — укажите ставку во вкладке «Налоги».' },
    { id: 'pending', label: 'Нет заказов без отметки оплаты', ok: pending === 0, required: false, detail: pending ? `${pending} ${plural(pending, ['заказ', 'заказа', 'заказов'])} созданы в этом месяце и ещё не отмечены оплаченными — они попадут в доход месяца отметки.` : 'Все заказы месяца отмечены.' },
    { id: 'chain', label: 'Предыдущие месяцы закрыты', ok: !previousOpen, required: false, detail: previousOpen ? `Закрыто только по ${input.settings.lockedThrough}; закрытие ${input.month} закроет и месяцы между ними.` : input.settings.lockedThrough ? `Закрыто по ${input.settings.lockedThrough}.` : 'Закрытых месяцев пока нет — закрытие этого месяца закроет и все предыдущие.' },
  ];
  return { checks, canClose: !locked && checks.filter((check) => check.required).every((check) => check.ok) };
}
export const plural = (count: number, forms: [string, string, string]) => { const tail = count % 100, last = count % 10; return tail >= 11 && tail <= 14 ? forms[2] : last === 1 ? forms[0] : last >= 2 && last <= 4 ? forms[1] : forms[2]; };

/** A lock/unlock event as the engine may report it (from the audit log); tolerant to field names. */
export type ClosingEvent = { at: number; action: 'lock' | 'unlock'; by: string; lockedThrough?: string; before?: string; reason?: string };
export function normalizeClosings(raw: unknown): ClosingEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const action: ClosingEvent['action'] | null = row.action === 'unlock' || row.action === 'accounting.unlock' ? 'unlock' : row.action === 'lock' || row.action === 'accounting.lock' ? 'lock' : null;
    if (!action) return [];
    const at = Number(row.at ?? row.createdAt ?? row.created_at ?? 0);
    const details = (row.details && typeof row.details === 'object' ? row.details : row) as Record<string, unknown>;
    return [{ at, action, by: String(row.by ?? row.actorEmail ?? row.actor_email ?? ''), ...(typeof details.lockedThrough === 'string' ? { lockedThrough: details.lockedThrough } : typeof details.after === 'string' ? { lockedThrough: details.after } : {}), ...(typeof details.before === 'string' ? { before: details.before } : {}), ...(typeof details.reason === 'string' ? { reason: details.reason } : {}) }];
  }).sort((a, b) => b.at - a.at);
}

// ---------- taxes: quarters as a guide, never a filing ----------
export type TaxStatus = 'none' | 'due' | 'partial' | 'paid' | 'over' | 'upcoming' | 'current' | 'overdue';
/** One quarter: `accrued`/`paid` are the quarter's own figures (client fallback); the engine adds the cumulative `accruedToDate`/`paidToDate` and the `deadline` (a guide). */
export type TaxQuarter = { index: number; label: string; months: string[]; periodEnd: string; deadline?: string; profit?: number; accrued: number; paid: number; accruedToDate?: number; paidToDate?: number; due: number; status: TaxStatus };
export function taxCalendar(summary: YearSummary): TaxQuarter[] {
  return summary.quarters.map((quarter, index) => {
    const accrued = quarter.tax, paid = quarter.taxPaid, due = Math.max(0, accrued - paid);
    const status: TaxQuarter['status'] = accrued === 0 && paid === 0 ? 'none' : paid === 0 ? 'due' : paid < accrued ? 'partial' : paid === accrued ? 'paid' : 'over';
    const lastMonth = quarter.months[quarter.months.length - 1];
    return { index: index + 1, label: quarter.label, months: quarter.months, periodEnd: lastMonth + '-' + String(new Date(Date.UTC(Number(lastMonth.slice(0, 4)), Number(lastMonth.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0'), profit: quarter.profit, accrued, paid, due, status };
  });
}
/** The engine's TaxCalendar (GET ?year=) in the UI shape; null when the field is missing or malformed. */
export function normalizeTaxCalendar(raw: unknown, summary?: YearSummary): TaxQuarter[] | null {
  const quarters = raw && typeof raw === 'object' && Array.isArray((raw as { quarters?: unknown }).quarters) ? (raw as { quarters: Record<string, unknown>[] }).quarters : null;
  if (!quarters || !quarters.length) return null;
  const statuses: TaxStatus[] = ['none', 'due', 'partial', 'paid', 'over', 'upcoming', 'current', 'overdue'];
  const out = quarters.flatMap((quarter, index): TaxQuarter[] => {
    if (typeof quarter.tax !== 'number' || !Array.isArray(quarter.months)) return [];
    const local = summary?.quarters[index];
    const status = statuses.includes(quarter.status as TaxStatus) ? quarter.status as TaxStatus : 'none';
    return [{ index: typeof quarter.quarter === 'number' ? quarter.quarter : index + 1, label: String(quarter.label ?? `${index + 1} кв.`), months: quarter.months as string[], periodEnd: String(quarter.periodEnd ?? ''), ...(typeof quarter.deadline === 'string' ? { deadline: quarter.deadline } : {}), ...(local ? { profit: local.profit, paid: local.taxPaid } : { paid: typeof quarter.paidToDate === 'number' ? quarter.paidToDate : 0 }), accrued: quarter.tax, ...(typeof quarter.accruedToDate === 'number' ? { accruedToDate: quarter.accruedToDate } : {}), ...(typeof quarter.paidToDate === 'number' ? { paidToDate: quarter.paidToDate } : {}), due: typeof quarter.due === 'number' ? quarter.due : 0, status }];
  });
  return out.length ? out : null;
}
export const taxStatusNames: Record<TaxStatus, string> = { none: 'Нет начислений', due: 'К уплате', partial: 'Уплачено частично', paid: 'Уплачено', over: 'Уплачено больше начисленного', upcoming: 'Квартал впереди', current: 'Текущий квартал', overdue: 'Срок прошёл, есть долг' };
export const taxStatusTone = (status: TaxStatus): 'ok' | 'warn' | 'error' | 'neutral' => status === 'paid' ? 'ok' : status === 'overdue' ? 'error' : status === 'due' || status === 'partial' ? 'warn' : 'neutral';

// ---------- bank statement CSV: parse, then match against the ledger and the orders ----------
export type StatementRow = { id: string; date: string; amount: number; currency: string; description: string; counterparty: string; raw: string[] };
export type StatementParse = { rows: StatementRow[]; errors: string[]; delimiter: string; header: string[] | null };
const dateFormats: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^(\d{4})-(\d{2})-(\d{2})/, (m) => `${m[1]}-${m[2]}-${m[3]}`],
  [/^(\d{2})\.(\d{2})\.(\d{4})/, (m) => `${m[3]}-${m[2]}-${m[1]}`],
  [/^(\d{2})\/(\d{2})\/(\d{4})/, (m) => `${m[3]}-${m[2]}-${m[1]}`],
  [/^(\d{4})\.(\d{2})\.(\d{2})/, (m) => `${m[1]}-${m[2]}-${m[3]}`],
];
export function parseStatementDate(text: string): string | null {
  const value = text.trim();
  for (const [pattern, build] of dateFormats) { const match = value.match(pattern); if (match) { const iso = build(match); const month = Number(iso.slice(5, 7)), day = Number(iso.slice(8, 10)); if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return iso; } }
  return null;
}
/** "1 234 567,89" / "1,234,567.89" / "-12 000" / "(12 000)" → number; null when it is not a number. */
export function parseStatementAmount(text: string): number | null {
  let value = text.trim().replace(/\s| /g, '');
  if (!value) return null;
  let negative = false;
  if (/^\(.*\)$/.test(value)) { negative = true; value = value.slice(1, -1); }
  if (value.startsWith('-') || value.startsWith('−')) { negative = true; value = value.slice(1); }
  if (value.startsWith('+')) value = value.slice(1);
  value = value.replace(/[A-Za-zА-Яа-я'’$€£]/g, '');
  if (!value) return null;
  const lastComma = value.lastIndexOf(','), lastDot = value.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) value = lastComma > lastDot ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
  else if (lastComma > -1) value = (value.length - lastComma - 1 === 3 && (value.match(/,/g) ?? []).length > 1) ? value.replace(/,/g, '') : value.replace(',', '.');
  else if (lastDot > -1 && (value.match(/\./g) ?? []).length > 1) value = value.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? (negative ? -number : number) : null;
}
function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = []; let cell = '', quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quoted) { if (char === '"') { if (line[index + 1] === '"') { cell += '"'; index++; } else quoted = false; } else cell += char; }
    else if (char === '"') quoted = true;
    else if (char === delimiter) { cells.push(cell); cell = ''; }
    else cell += char;
  }
  cells.push(cell);
  return cells.map((item) => item.trim());
}
const headerWords = { date: /дата|date|день|sana/i, amount: /сумма|amount|sum\b|summa|оборот/i, debit: /дебет|debit|расход|списан|chiqim|outflow|withdraw/i, credit: /кредит|credit|приход|зачисл|kirim|inflow|deposit/i, description: /назнач|описан|description|details|purpose|коммент|memo|narrative|izoh/i, counterparty: /контрагент|counterparty|получател|плательщик|payee|payer|name|наимен|корреспондент/i, currency: /валют|currency|valyuta/i };
/** Parses a bank CSV export: detects the delimiter, the header (if any), the date, amount (or debit/credit pair) and text columns. */
export function parseBankCsv(text: string): StatementParse {
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.trim());
  if (!lines.length) return { rows: [], errors: ['Файл пустой.'], delimiter: ';', header: null };
  const sample = lines.slice(0, 5).join('\n');
  const delimiter = [';', '\t', ','].map((candidate) => ({ candidate, count: (sample.match(new RegExp(candidate === '\t' ? '\t' : '\\' + candidate, 'g')) ?? []).length })).sort((a, b) => b.count - a.count)[0];
  if (!delimiter.count) return { rows: [], errors: ['Не удалось определить разделитель колонок (ожидаются «;», «,» или табуляция).'], delimiter: ';', header: null };
  const table = lines.map((line) => splitCsvLine(line, delimiter.candidate));
  const first = table[0];
  const looksLikeHeader = first.some((cell) => Object.values(headerWords).some((pattern) => pattern.test(cell))) && !first.some((cell) => parseStatementDate(cell));
  const header = looksLikeHeader ? first : null;
  const body = looksLikeHeader ? table.slice(1) : table;
  const find = (pattern: RegExp) => header ? header.findIndex((cell) => pattern.test(cell)) : -1;
  let dateCol = find(headerWords.date), amountCol = find(headerWords.amount), debitCol = find(headerWords.debit), creditCol = find(headerWords.credit);
  const descriptionCol = find(headerWords.description), counterpartyCol = find(headerWords.counterparty), currencyCol = find(headerWords.currency);
  const probe = body.find((row) => row.length > 1) ?? [];
  if (dateCol < 0) dateCol = probe.findIndex((cell) => parseStatementDate(cell));
  if (amountCol < 0 && debitCol < 0 && creditCol < 0) {
    amountCol = probe.findIndex((cell, index) => index !== dateCol && parseStatementAmount(cell) !== null && /\d/.test(cell) && !/^\d{1,2}$/.test(cell.trim()));
    // Two numeric columns next to each other without a header are more likely debit / credit.
    const nextNumeric = probe.findIndex((cell, index) => index > amountCol && index !== dateCol && parseStatementAmount(cell) !== null && /\d/.test(cell));
    if (amountCol > -1 && nextNumeric > -1 && !header && probe.slice(amountCol + 1, nextNumeric).every((cell) => parseStatementAmount(cell) === null)) { debitCol = amountCol; creditCol = nextNumeric; amountCol = -1; }
  }
  const errors: string[] = [];
  if (dateCol < 0) errors.push('Не найдена колонка с датой (ожидается ДД.ММ.ГГГГ или ГГГГ-ММ-ДД).');
  if (amountCol < 0 && debitCol < 0 && creditCol < 0) errors.push('Не найдена колонка с суммой (или пара дебет/кредит).');
  if (errors.length) return { rows: [], errors, delimiter: delimiter.candidate, header };
  const textCols = (row: string[]) => row.map((cell, index) => ({ cell, index })).filter(({ cell, index }) => index !== dateCol && index !== amountCol && index !== debitCol && index !== creditCol && index !== currencyCol && cell && parseStatementAmount(cell) === null && !parseStatementDate(cell));
  const rows: StatementRow[] = [];
  body.forEach((row, lineIndex) => {
    const date = parseStatementDate(row[dateCol] ?? '');
    let amount: number | null = null;
    if (amountCol > -1) amount = parseStatementAmount(row[amountCol] ?? '');
    else { const debit = debitCol > -1 ? parseStatementAmount(row[debitCol] ?? '') : null, credit = creditCol > -1 ? parseStatementAmount(row[creditCol] ?? '') : null; if (debit !== null || credit !== null) amount = (credit ?? 0) - Math.abs(debit ?? 0); }
    if (!date || amount === null || amount === 0) { if (row.some((cell) => cell)) errors.push(`Строка ${lineIndex + (header ? 2 : 1)} пропущена: нет даты или суммы.`); return; }
    const texts = textCols(row);
    const description = descriptionCol > -1 ? row[descriptionCol] ?? '' : texts.sort((a, b) => b.cell.length - a.cell.length)[0]?.cell ?? '';
    const counterparty = counterpartyCol > -1 ? row[counterpartyCol] ?? '' : texts.find(({ cell }) => cell !== description)?.cell ?? '';
    const currency = currencyCol > -1 && /^[A-Z]{3}$/.test((row[currencyCol] ?? '').trim().toUpperCase()) ? row[currencyCol].trim().toUpperCase() : 'UZS';
    rows.push({ id: `st-${lineIndex}-${date}-${Math.round(Math.abs(amount) * 100)}`, date, amount: Math.round(amount * 100) / 100, currency, description: description.slice(0, 500), counterparty: counterparty.slice(0, 120), raw: row });
  });
  if (!rows.length && !errors.length) errors.push('В файле нет строк с датой и суммой.');
  return { rows, errors: errors.slice(0, 20), delimiter: delimiter.candidate, header };
}

const kindRules: [RegExp, LedgerKind][] = [
  [/dhl|ups\b|fedex|usps|tnt|aramex|carrier|перевоз|cargo|карго|авиа|фрахт|freight|shipping line/i, 'carrier'],
  [/payme|click|uzum pay|paynet|apelsin|эквайр|acquir|комисс.*(плат|терм)|processing/i, 'payment_fee'],
  [/банк|bank|конверт|swift|перевод|комисс|wire|fx fee/i, 'bank_fee'],
  [/аренд|rent|lease|ijara/i, 'rent'],
  [/зарплат|salary|оклад|payroll|ish haqi|подрядчик|contractor/i, 'salary'],
  [/реклам|ads\b|google ads|meta|facebook|instagram|telegram ads|marketing|promo/i, 'marketing'],
  [/hosting|cloudflare|upcloud|подписк|subscription|saas|software|domain|домен|github|openai|resend|eskiz/i, 'software'],
  [/налог|tax|гнк|soliq|бюджет|budget/i, 'tax_paid'],
  [/возврат|refund|qaytar/i, 'refund'],
  [/упаков|packag|qadoq|склад|warehouse|ombor/i, 'packaging'],
  [/пошлин|таможн|customs|bojxona|duty/i, 'customs_paid'],
  [/магазин|store|amazon|ebay|zara|nike|adidas|shop|товар|goods|purchase/i, 'goods_purchase'],
];
/** Guesses the ledger kind from the statement description; the operator confirms it on the screen. */
export function guessKind(description: string, amount: number): LedgerKind {
  const text = description.toLowerCase();
  if (amount > 0) {
    if (/пошлин|таможн|customs|bojxona/.test(text)) return 'customs_reimbursed';
    if (/таможн.*помощ|customs.*help|помощ.*таможн/.test(text)) return 'customs_help_fee';
    if (/заказ|order|\bat-[0-9a-f]{6,}|клиент|customer|mijoz|payme|click|uzum/.test(text)) return 'customer_payment';
    return 'other_income';
  }
  for (const [pattern, kind] of kindRules) if (pattern.test(text)) return kind;
  return 'other_expense';
}
/** Pulls an Atlas order number out of free text: "AT-" + 8 or 12 hex digits. */
export function findOrderId(text: string) { const match = text.match(/\bAT-[0-9A-F]{8}(?:[0-9A-F]{4})?\b/i); return match ? match[0].toUpperCase() : ''; }

export type StatementMatch = {
  row: StatementRow;
  /** recorded: an equal live ledger entry exists already; order: looks like a customer's order payment; new: nothing matches yet. */
  status: 'recorded' | 'order' | 'new';
  entry?: LedgerEntryView; order?: OrderFinance;
  /** What the engine said about the line (bank-import), when it was asked. */
  serverNote?: string;
  draft: { kind: LedgerKind; amountUzs: number; occurredOn: string; orderId: string; counterparty: string; note: string; originalAmount?: number; originalCurrency?: string };
};
const daysApart = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400_000;
/** Matches statement rows to what the books already hold. `convert` turns a foreign row amount into soum (null = unknown rate). */
export function matchStatement(rows: StatementRow[], entries: LedgerEntryView[], orders: OrderFinance[], convert: (amount: number, currency: string) => number | null = (amount, currency) => currency === 'UZS' ? Math.round(amount) : null): StatementMatch[] {
  const live = entries.filter((entry) => !entry.voidedAt);
  const used = new Set<string>();
  return rows.map((row) => {
    const soum = convert(Math.abs(row.amount), row.currency);
    const amountUzs = soum ?? Math.round(Math.abs(row.amount));
    const direction = row.amount > 0 ? 'in' : 'out';
    const text = `${row.description} ${row.counterparty}`;
    const orderId = findOrderId(text);
    const foreign = row.currency !== 'UZS' ? { originalAmount: Math.abs(row.amount), originalCurrency: row.currency } : {};
    const entry = live.find((candidate) => !used.has(candidate.id) && entryDirection(candidate) === direction && daysApart(candidate.occurredOn, row.date) <= 5
      && (candidate.amountUzs === amountUzs || (foreign.originalAmount !== undefined && candidate.originalAmount === foreign.originalAmount && candidate.originalCurrency === foreign.originalCurrency))
      && (!orderId || !candidate.orderId || candidate.orderId === orderId));
    if (entry) { used.add(entry.id); return { row, status: 'recorded', entry, draft: { kind: entry.kind, amountUzs, occurredOn: row.date, orderId: entry.orderId ?? orderId, counterparty: row.counterparty, note: row.description, ...foreign } }; }
    const order = direction === 'in' ? orders.find((candidate) => (orderId ? candidate.orderId === orderId : Math.abs(candidate.payable - amountUzs) <= Math.max(1000, candidate.payable * 0.01)) && candidate.status !== 'cancelled') : undefined;
    if (order) return { row, status: 'order', order, draft: { kind: 'customer_payment', amountUzs, occurredOn: row.date, orderId: order.orderId, counterparty: row.counterparty, note: row.description || `Оплата по выписке за заказ ${order.orderId}`, ...foreign } };
    return { row, status: 'new', draft: { kind: guessKind(text, row.amount), amountUzs, occurredOn: row.date, orderId, counterparty: row.counterparty, note: row.description, ...foreign } };
  });
}

/** The engine's bank-import proposals (POST kind "bank-import", admin only) laid over the client matches: same date and amount → the engine's verdict wins. */
export type BankProposalLike = { date: string; amount: number; orderId?: string; found?: boolean; status?: OrderFinance['status']; payable?: number; alreadyRecorded?: boolean; action?: 'propose' | 'skip'; reason?: string };
export function mergeBankProposals(matches: StatementMatch[], proposals: unknown): StatementMatch[] {
  if (!Array.isArray(proposals)) return matches;
  const byKey = new Map<string, BankProposalLike>();
  for (const item of proposals as BankProposalLike[]) if (item && typeof item.date === 'string' && typeof item.amount === 'number') byKey.set(`${item.date}|${Math.round(item.amount)}`, item);
  return matches.map((match) => {
    const proposal = byKey.get(`${match.row.date}|${Math.round(match.row.amount)}`);
    if (!proposal || !proposal.orderId) return match;
    const serverNote = proposal.reason ?? '';
    if (proposal.alreadyRecorded) return { ...match, status: 'recorded', serverNote, draft: { ...match.draft, orderId: proposal.orderId } };
    if (proposal.found && proposal.action === 'propose' && match.status !== 'recorded') {
      const order: OrderFinance | undefined = match.order ?? (typeof proposal.payable === 'number' ? { orderId: proposal.orderId, customerId: '', createdAt: 0, status: proposal.status ?? 'pending', goods: 0, storeShipping: 0, reserve: 0, payable: proposal.payable, commission: 0, delivery: 0, fxGain: 0, services: 0, revenue: 0 } : undefined);
      return { ...match, status: 'order', serverNote, ...(order ? { order } : {}), draft: { ...match.draft, kind: 'customer_payment', orderId: proposal.orderId } };
    }
    return { ...match, serverNote };
  });
}

// ---------- invoice for the customer ("Счёт-расчёт": the quote as a statement, not a tax invoice) ----------
export type InvoiceLine = { label: string; amount: number; transit?: boolean };
export type InvoiceView = { number: string; orderId: string; customerId: string; customer?: { name?: string; email?: string; phone?: string }; issuedOn: string; createdOn?: string; paidOn?: string; status: OrderFinance['status']; statusRu?: string; lines: InvoiceLine[]; total: number; split?: { transit: number; atlasIncome: number }; note: string };
export function invoiceFromOrder(order: OrderFinance, issuedOn = todayTashkent()): InvoiceView {
  const lines: InvoiceLine[] = [{ label: 'Товар по цене магазина', amount: order.goods + order.fxGain, transit: true }];
  if (order.storeShipping) lines.push({ label: 'Доставка магазина', amount: order.storeShipping, transit: true });
  lines.push({ label: 'Сервис Atlas (комиссия)', amount: order.commission });
  lines.push({ label: 'Международная доставка', amount: order.delivery });
  if (order.services) lines.push({ label: 'Дополнительные услуги', amount: order.services });
  if (order.reserve) lines.push({ label: 'Возвратный резерв на доставку', amount: order.reserve, transit: true });
  const sum = lines.reduce((total, line) => total + line.amount, 0);
  if (sum !== order.payable) lines.push({ label: sum < order.payable ? 'Прочие начисления по смете' : 'Корректировки по смете', amount: order.payable - sum });
  return { number: `СР-${order.orderId.replace(/^AT-/, '')}`, orderId: order.orderId, customerId: order.customerId, issuedOn, status: order.status, lines, total: order.payable, note: 'Счёт-расчёт по сохранённой смете заказа. Atlas действует как агент: суммы за товар и доставку магазина — транзит магазину. Оплата на сайте симулируется; документ не подтверждает получение денег и не является счётом-фактурой.' };
}
/** The engine's InvoiceData (GET ?invoice=, see lib/market/finance-api.md) or any similar JSON in the UI shape; null when it is not an invoice. */
export function normalizeInvoice(raw: unknown): InvoiceView | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = ((raw as { invoice?: unknown }).invoice ?? raw) as Record<string, unknown>;
  if (!Array.isArray(source.lines)) return null;
  const customer = source.customer && typeof source.customer === 'object' ? source.customer as Record<string, unknown> : null;
  const orderId = typeof source.orderId === 'string' ? source.orderId : typeof source.number === 'string' && /^AT-/i.test(source.number) ? source.number : '';
  if (!orderId) return null;
  const lines = (source.lines as Record<string, unknown>[]).flatMap((line) => line && typeof line.label === 'string' && typeof line.amount === 'number' ? [{ label: line.label, amount: line.amount, ...(line.transit || line.kind === 'merchandise' || line.kind === 'source-shipping' || line.kind === 'reserve' ? { transit: true } : {}) }] : []);
  const status = ['pending', 'paid', 'refunded', 'cancelled'].includes(String(source.status)) ? source.status as OrderFinance['status'] : 'pending';
  const dateOf = (value: unknown) => typeof value === 'number' ? todayTashkent(value) : typeof value === 'string' && value ? value.slice(0, 10) : undefined;
  const text = (value: unknown) => typeof value === 'string' && value ? value : undefined;
  const split = source.split && typeof source.split === 'object' && typeof (source.split as { transit?: unknown }).transit === 'number' && typeof (source.split as { atlasIncome?: unknown }).atlasIncome === 'number' ? source.split as { transit: number; atlasIncome: number } : undefined;
  return {
    number: String(source.number ?? `СР-${orderId}`), orderId, customerId: String(customer?.id ?? source.customerId ?? ''),
    ...(customer ? { customer: { ...(text(customer.name) ? { name: text(customer.name) } : {}), ...(text(customer.email) ? { email: text(customer.email) } : {}), ...(text(customer.phone) ? { phone: text(customer.phone) } : {}) } } : {}),
    issuedOn: dateOf(source.issuedAt) ?? dateOf(source.issuedOn) ?? todayTashkent(), ...(dateOf(source.createdAt) ? { createdOn: dateOf(source.createdAt) } : {}), ...(dateOf(source.paidAt) ? { paidOn: dateOf(source.paidAt) } : {}),
    status, ...(text(source.statusRu) ? { statusRu: text(source.statusRu) } : {}), lines, total: typeof source.total === 'number' ? source.total : lines.reduce((total, line) => total + line.amount, 0),
    ...(split ? { split } : {}), note: String(source.disclaimer ?? source.note ?? ''),
  };
}

// ---------- money positions for the overview ----------
export type MoneyPosition = { id: string; label: string; amount: number; hint: string; kind: 'asset' | 'liability' | 'transit' };
type CashLike = { receivable?: { count: number; amount: number }; owedToStores?: { count: number; goods: number; storeShipping: number; total: number }; customerBalances?: { count: number; amount: number }; tax?: { accrued: number; paid: number; due: number }; ytd?: { income: number; expenses: number; profit: number; net: number; orders: number } };
/** The engine's CashPosition (GET ?month=, cumulative since 1 January) when it is there; otherwise the obligations snapshot and the month's tax. */
export function moneyPositions(summary: MonthSummary, obligations: Obligations, extra?: unknown, cash?: unknown): MoneyPosition[] {
  const position = cash && typeof cash === 'object' ? cash as CashLike : null;
  if (position?.receivable && position.owedToStores && position.customerBalances && position.tax) {
    const positions: MoneyPosition[] = [
      { id: 'receivable', label: 'Ожидают оплаты (должны нам)', amount: position.receivable.amount, hint: `${position.receivable.count} ${plural(position.receivable.count, ['заказ', 'заказа', 'заказов'])} без отметки оплаты — отметка в Atlas, не поступление`, kind: 'asset' },
      { id: 'stores', label: 'Должны магазинам (транзит)', amount: position.owedToStores.total, hint: `${position.owedToStores.count} ${plural(position.owedToStores.count, ['заказ', 'заказа', 'заказов'])} оплачены и ещё не выкуплены: товар ${position.owedToStores.goods}, доставка магазина ${position.owedToStores.storeShipping}`, kind: 'transit' },
      { id: 'balances', label: 'Балансы клиентов', amount: position.customerBalances.amount, hint: `${position.customerBalances.count} ${plural(position.customerBalances.count, ['клиент', 'клиента', 'клиентов'])} с положительным балансом — обязательство Atlas`, kind: 'liability' },
      { id: 'tax-due', label: 'Налог к уплате с начала года', amount: position.tax.due, hint: `начислено ${position.tax.accrued}, отмечено уплаченным ${position.tax.paid} — ориентир, сверьте с бухгалтером`, kind: 'liability' },
    ];
    if (position.ytd) positions.push({ id: 'ytd', label: 'Прибыль с начала года', amount: position.ytd.profit, hint: `доход ${position.ytd.income}, расходы ${position.ytd.expenses}, ${position.ytd.orders} оплаченных заказов; чистая ${position.ytd.net}`, kind: 'asset' });
    return appendExtra(positions, extra);
  }
  const positions: MoneyPosition[] = [
    { id: 'receivable', label: 'Ожидают оплаты', amount: obligations.pendingOrders.amount, hint: `${obligations.pendingOrders.count} ${plural(obligations.pendingOrders.count, ['заказ', 'заказа', 'заказов'])} без отметки оплаты (отметка тестовая)`, kind: 'asset' },
    { id: 'balances', label: 'Балансы клиентов', amount: obligations.customerBalances.amount, hint: `${obligations.customerBalances.count} ${plural(obligations.customerBalances.count, ['клиент', 'клиента', 'клиентов'])} с положительным балансом — обязательство Atlas`, kind: 'liability' },
    { id: 'stores', label: 'Транзит к выплате магазинам', amount: obligations.transitToStores.total, hint: `${obligations.transitToStores.count} ${plural(obligations.transitToStores.count, ['оплаченный', 'оплаченных', 'оплаченных'])} заказ(ов) ещё не выкуплен(о): товар ${obligations.transitToStores.goods}, доставка магазина ${obligations.transitToStores.storeShipping}`, kind: 'transit' },
    { id: 'tax-due', label: 'Налог к уплате за месяц', amount: Math.max(0, summary.tax - summary.taxPaid), hint: `начислено ${summary.tax}, уплачено ${summary.taxPaid} — ориентир, сверьте с бухгалтером`, kind: 'liability' },
  ];
  return appendExtra(positions, extra);
}
function appendExtra(positions: MoneyPosition[], extra: unknown) {
  if (Array.isArray(extra)) for (const item of extra as Record<string, unknown>[]) if (item && typeof item.label === 'string' && typeof item.amount === 'number') positions.push({ id: String(item.id ?? item.label), label: item.label, amount: item.amount, hint: String(item.hint ?? ''), kind: item.kind === 'asset' || item.kind === 'liability' || item.kind === 'transit' ? item.kind : 'asset' });
  return positions;
}

// ---------- JSON backup of what the screen has loaded (the full D1 backup is /api/backup) ----------
export function monthBackup(books: { month: string; summary: MonthSummary; entries: LedgerEntryView[]; orders: OrderFinance[]; orderEntries: LedgerEntryView[]; settings: AccountingSettings }, exportedAt = Date.now()) {
  return JSON.stringify({ format: 'atlas-accounting-month', version: 1, exportedAt, month: books.month, settings: books.settings, summary: books.summary, orders: books.orders, entries: books.entries, orderEntries: books.orderEntries }, null, 1);
}
