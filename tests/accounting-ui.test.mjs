import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clientReconcile, closingChecklist, entrySourceLabel, filterLedgerView, findOrderId, guessKind, invoiceFromOrder, isAutoEntry, isBankEntry, isEditableEntry, matchStatement, mergeBankProposals, monthBackup, monthLabel, moneyPositions,
  nextMonth, normalizeClosings, normalizeInvoice, normalizeIssues, normalizeTaxCalendar, parseBankCsv, parseStatementAmount, parseStatementDate, previousMonth, sortIssues, taxCalendar, validateDraft,
} from '../app/accounting-helpers.ts';
import { monthSummary, yearSummary, obligations } from '../lib/market/finance.ts';

const order = (extra = {}) => ({ orderId: 'AT-1234ABCD', customerId: 'email:a@b.uz', createdAt: Date.UTC(2026, 9, 3), status: 'paid', paidAt: Date.UTC(2026, 9, 5), month: '2026-10', goods: 1_000_000, storeShipping: 0, reserve: 40_000, payable: 1_360_000, commission: 98_000, delivery: 210_000, fxGain: 12_000, services: 0, revenue: 320_000, ...extra });
const entry = (kind, amountUzs, extra = {}) => ({ id: 'LED-' + kind + amountUzs + (extra.orderId ?? ''), kind, amountUzs, occurredOn: '2026-10-12', createdBy: 'op@atlas.uz', createdAt: 1, ...extra });
const settings = { profitTaxRate: 0.15 };

test('months: labels and neighbours', () => {
  assert.equal(monthLabel('2026-10'), 'октябрь 2026');
  assert.equal(previousMonth('2026-01'), '2025-12');
  assert.equal(nextMonth('2026-12'), '2027-01');
});

test('auto entries are recognised by id prefix (finance-api.md), flag, source or system author and are never editable', () => {
  assert.equal(isAutoEntry(entry('carrier', 1)), false);
  assert.equal(isAutoEntry({ ...entry('customer_payment', 5), id: 'AUTO-AT-1234ABCD-customer_payment', createdBy: 'system:auto' }), true);
  assert.equal(isBankEntry({ ...entry('customer_payment', 5), id: 'BANK-abc' }), true);
  assert.equal(isEditableEntry({ ...entry('customer_payment', 5), id: 'BANK-abc' }, settings), true, 'bank entries stay editable');
  assert.deepEqual([entrySourceLabel({ ...entry('carrier', 1), id: 'AUTO-x' }), entrySourceLabel({ ...entry('carrier', 1), id: 'BANK-x' }), entrySourceLabel(entry('carrier', 1))], ['авто', 'выписка', 'вручную']);
  assert.equal(isAutoEntry(entry('carrier', 1, { auto: true })), true);
  assert.equal(isAutoEntry(entry('carrier', 1, { source: 'auto' })), true);
  assert.equal(isAutoEntry(entry('carrier', 1, { source: 'manual' })), false);
  assert.equal(isAutoEntry(entry('carrier', 1, { createdBy: 'system:settlement' })), true);
  assert.equal(isEditableEntry(entry('carrier', 1), settings), true);
  assert.equal(isEditableEntry(entry('carrier', 1, { auto: true }), settings), false);
  assert.equal(isEditableEntry(entry('carrier', 1, { voidedAt: 5, voidReason: 'x' }), settings), false);
  assert.equal(isEditableEntry(entry('carrier', 1), { lockedThrough: '2026-10' }), false);
});

test('the ledger view filter adds group, source and a date range', () => {
  const entries = [entry('carrier', 10), entry('other_income', 20, { auto: true }), entry('goods_purchase', 30, { occurredOn: '2026-10-01' })];
  assert.deepEqual(filterLedgerView(entries, { group: 'expense' }).map((e) => e.kind), ['carrier']);
  assert.deepEqual(filterLedgerView(entries, { auto: 'auto' }).map((e) => e.kind), ['other_income']);
  assert.deepEqual(filterLedgerView(entries, { auto: 'manual' }).length, 2);
  assert.deepEqual(filterLedgerView(entries, { from: '2026-10-05' }).length, 2);
  assert.deepEqual(filterLedgerView(entries, { to: '2026-10-05' }).map((e) => e.kind), ['goods_purchase']);
});

test('draft validation mirrors the server rules and the period lock', () => {
  const good = { kind: 'carrier', amountUzs: '125000', originalAmount: '', originalCurrency: 'USD', occurredOn: '2026-10-12', orderId: 'AT-1234ABCD', counterparty: 'DHL', note: '' };
  assert.deepEqual(validateDraft(good, settings, '2026-10-20'), {});
  const bad = validateDraft({ ...good, amountUzs: '12.5', orderId: 'заказ №5', originalAmount: '-3', originalCurrency: 'usd', occurredOn: '2027-05-01' }, settings, '2026-10-20');
  assert.ok(bad.amountUzs && bad.orderId && bad.originalAmount && bad.originalCurrency && bad.occurredOn);
  assert.match(validateDraft({ ...good, occurredOn: '2026-09-30' }, { lockedThrough: '2026-09' }, '2026-10-20').occurredOn, /закрыт/);
  assert.equal(validateDraft({ ...good, amountUzs: '0' }, settings).amountUzs, 'Сумма в сумах — целое число больше нуля.');
});

test('reconcile: server issues of any shape plus the client checks, sorted by severity', () => {
  assert.deepEqual(normalizeIssues(['Строка']), [{ severity: 'warn', code: 'server', message: 'Строка' }]);
  assert.deepEqual(normalizeIssues({ issues: [{ severity: 'error', code: 'x', message: 'Ошибка', orderId: 'AT-1' }, { text: 'Текст' }, {}] }), [{ severity: 'error', code: 'x', message: 'Ошибка', orderId: 'AT-1' }, { severity: 'warn', code: 'server', message: 'Текст' }]);
  assert.deepEqual(normalizeIssues(undefined), []);
  // the engine's ReconcileReport: "ok" checks are dropped, title and detail join, a single orderId is kept
  const report = normalizeIssues({ month: '2026-10', ok: false, errors: 1, warnings: 0, checks: [{ id: 'payments-match', severity: 'ok', title: 'Оплаты сходятся', detail: '' }, { id: 'unknown-order', severity: 'error', title: 'Неизвестный заказ', detail: 'AT-X нет в книгах', orderIds: ['AT-X'] }, { id: 'paid-not-bought', severity: 'warn', title: 'Не выкуплены', detail: '2 заказа', orderIds: ['AT-1', 'AT-2'], count: 2 }] });
  assert.deepEqual(report, [{ severity: 'error', code: 'unknown-order', message: 'Неизвестный заказ — AT-X нет в книгах', orderId: 'AT-X' }, { severity: 'warn', code: 'paid-not-bought', message: 'Не выкуплены — 2 заказа' }]);
  const issues = clientReconcile({
    month: '2026-10', usdRate: 12_144, settings: { profitTaxRate: 0, fxRates: {} },
    orders: [order(), order({ orderId: 'AT-CANCELLED', status: 'cancelled' })],
    entries: [entry('carrier', 100_000, { originalAmount: 100, originalCurrency: 'EUR' }), entry('carrier', 50_000, { originalAmount: 100, originalCurrency: 'USD' }), entry('bank_fee', 5000, { orderId: 'AT-ELSEWHERE' })],
    orderEntries: [entry('carrier', 20_000, { orderId: 'AT-CANCELLED' })],
    stages: { 'AT-1234ABCD': 'cancelled' },
  });
  const codes = sortIssues(issues).map((issue) => issue.code);
  assert.deepEqual(codes, ['paid-cancelled', 'expense-on-cancelled', 'fx-missing', 'tax-rate', 'fx-drift', 'order-not-in-month']);
});

test('closing checklist blocks on the required items only', () => {
  const summary = monthSummary('2026-09', [order({ month: '2026-09' })], [entry('carrier', 100_000, { occurredOn: '2026-09-12' })], 0.15);
  const base = { month: '2026-09', summary, entries: [entry('carrier', 100_000, { occurredOn: '2026-09-12' })], orders: [order({ month: '2026-09' })], settings, issues: [], today: '2026-10-06' };
  const clean = closingChecklist(base);
  assert.equal(clean.canClose, true);
  assert.deepEqual(clean.checks.map((check) => check.ok), [true, true, true, true, true, true]);
  const blocked = closingChecklist({ ...base, issues: [{ severity: 'warn', code: 'x', message: 'x' }, { severity: 'info', code: 'i', message: 'i' }] });
  assert.equal(blocked.canClose, false);
  assert.match(blocked.checks.find((check) => check.id === 'reconcile').detail, /^1 расхождение/);
  assert.equal(closingChecklist({ ...base, month: '2026-10' }).canClose, false, 'the current month cannot be closed');
  assert.equal(closingChecklist({ ...base, settings: { profitTaxRate: 0.15, lockedThrough: '2026-09' } }).canClose, false, 'already closed');
  const pending = closingChecklist({ ...base, orders: [order({ status: 'pending', month: undefined })] });
  assert.equal(pending.canClose, true, 'pending orders only warn');
  assert.equal(pending.checks.find((check) => check.id === 'pending').ok, false);
  const missingFx = closingChecklist({ ...base, entries: [entry('carrier', 1, { occurredOn: '2026-09-02', originalAmount: 1, originalCurrency: 'EUR' })] });
  assert.equal(missingFx.canClose, false);
  assert.match(missingFx.checks.find((check) => check.id === 'fx').detail, /EUR/);
});

test('closing history accepts audit rows or plain events', () => {
  const rows = normalizeClosings([
    { action: 'accounting.lock', created_at: 2, actor_email: 'a@b.uz', details: { lockedThrough: '2026-09', before: null } },
    { action: 'unlock', at: 3, by: 'admin', lockedThrough: '2026-08', reason: 'ошибка' },
    { action: 'other', at: 4 }, 'junk',
  ]);
  assert.deepEqual(rows, [{ at: 3, action: 'unlock', by: 'admin', lockedThrough: '2026-08', reason: 'ошибка' }, { at: 2, action: 'lock', by: 'a@b.uz', lockedThrough: '2026-09' }]);
  assert.deepEqual(normalizeClosings(undefined), []);
});

test('the tax calendar shows accrued vs marked paid by quarter', () => {
  const orders = [order({ month: '2026-02', paidAt: Date.UTC(2026, 1, 5) }), order({ orderId: 'AT-2', month: '2026-05', paidAt: Date.UTC(2026, 4, 5) })];
  const entries = [entry('tax_paid', 48_000, { occurredOn: '2026-04-20' }), entry('tax_paid', 10_000, { occurredOn: '2026-07-20' })];
  const quarters = taxCalendar(yearSummary(2026, orders, entries, 0.15));
  assert.equal(quarters.length, 4);
  assert.deepEqual(quarters.map((q) => q.status), ['due', 'paid', 'over', 'none'], 'Q1 accrued and unpaid, Q2 paid in full, Q3 paid without accrual, Q4 empty');
  assert.equal(quarters[0].accrued, 48_000);
  assert.equal(quarters[0].due, 48_000);
  assert.equal(quarters[0].periodEnd, '2026-03-31');
  assert.equal(quarters[1].due, 0);
  assert.equal(quarters[1].paid, 48_000);
  assert.equal(taxCalendar(yearSummary(2026, orders, [entry('tax_paid', 20_000, { occurredOn: '2026-05-02' })], 0.15))[1].status, 'partial');
  // the engine's calendar (GET ?year=) is preferred and keeps the deadline and the cumulative figures
  const summary = yearSummary(2026, orders, entries, 0.15);
  const server = normalizeTaxCalendar({ year: 2026, taxRate: 0.15, note: 'ориентир', quarters: [{ quarter: 1, label: '1 кв. 2026', months: ['2026-01', '2026-02', '2026-03'], periodEnd: '2026-03-31', deadline: '2026-04-20', tax: 48_000, accruedToDate: 48_000, paidToDate: 48_000, due: 0, status: 'paid' }, { quarter: 2, label: '2 кв. 2026', months: ['2026-04', '2026-05', '2026-06'], periodEnd: '2026-06-30', deadline: '2026-07-20', tax: 48_000, accruedToDate: 96_000, paidToDate: 58_000, due: 38_000, status: 'overdue' }] }, summary);
  assert.equal(server.length, 2);
  assert.deepEqual([server[0].deadline, server[0].status, server[0].profit, server[1].due, server[1].paidToDate, server[1].status], ['2026-04-20', 'paid', summary.quarters[0].profit, 38_000, 58_000, 'overdue']);
  assert.equal(normalizeTaxCalendar(undefined), null);
  assert.equal(normalizeTaxCalendar({ quarters: [] }), null);
});

test('statement: dates and amounts in the formats banks use', () => {
  assert.equal(parseStatementDate('03.10.2026'), '2026-10-03');
  assert.equal(parseStatementDate('2026-10-03 12:00'), '2026-10-03');
  assert.equal(parseStatementDate('03/10/2026'), '2026-10-03');
  assert.equal(parseStatementDate('99.99.2026'), null);
  assert.equal(parseStatementAmount('1 250 000,50'), 1_250_000.5);
  assert.equal(parseStatementAmount('1,250,000.50'), 1_250_000.5);
  assert.equal(parseStatementAmount('-12 000'), -12_000);
  assert.equal(parseStatementAmount('(12 000)'), -12_000);
  assert.equal(parseStatementAmount('1.250.000'), 1_250_000);
  assert.equal(parseStatementAmount('12,50 UZS'), 12.5);
  assert.equal(parseStatementAmount('DHL'), null);
});

test('statement CSV: header with amount column, header with debit/credit, no header at all', () => {
  const withHeader = parseBankCsv('﻿Дата;Сумма;Назначение платежа;Контрагент\n03.10.2026;-1 250 000;DHL Express счёт 123;DHL\n05.10.2026;2 480 000;"Оплата заказа AT-1234ABCD; клиент";Иванов\n;;;\n');
  assert.deepEqual(withHeader.errors, []);
  assert.equal(withHeader.delimiter, ';');
  assert.equal(withHeader.rows.length, 2);
  assert.deepEqual([withHeader.rows[0].date, withHeader.rows[0].amount, withHeader.rows[0].description, withHeader.rows[0].counterparty], ['2026-10-03', -1_250_000, 'DHL Express счёт 123', 'DHL']);
  assert.equal(withHeader.rows[1].description, 'Оплата заказа AT-1234ABCD; клиент');
  const debitCredit = parseBankCsv('Date,Debit,Credit,Details,Currency\n2026-10-03,1250000,,Carrier DHL,UZS\n2026-10-04,,300.00,Refund from Zara,USD');
  assert.deepEqual(debitCredit.errors, []);
  assert.deepEqual(debitCredit.rows.map((row) => [row.amount, row.currency]), [[-1_250_000, 'UZS'], [300, 'USD']]);
  const bare = parseBankCsv('03.10.2026\t-1250000\tDHL Express\n04.10.2026\t900000\tКлиент оплата AT-1234ABCD');
  assert.deepEqual(bare.errors, []);
  assert.equal(bare.header, null);
  assert.deepEqual(bare.rows.map((row) => row.amount), [-1_250_000, 900_000]);
  assert.ok(parseBankCsv('').errors.length);
  assert.ok(parseBankCsv('просто текст без таблицы').errors.length);
});

test('statement matching: recorded entries are skipped, order payments found, kinds guessed', () => {
  assert.equal(guessKind('DHL Express invoice', -1), 'carrier');
  assert.equal(guessKind('Комиссия Payme', -1), 'payment_fee');
  assert.equal(guessKind('Аренда офиса октябрь', -1), 'rent');
  assert.equal(guessKind('Налог на прибыль 3 кв', -1), 'tax_paid');
  assert.equal(guessKind('что-то', -1), 'other_expense');
  assert.equal(guessKind('Оплата заказа AT-1234ABCD', 1), 'customer_payment');
  assert.equal(guessKind('Проценты банка', 1), 'other_income');
  assert.equal(findOrderId('Оплата заказа at-1234abcd от клиента'), 'AT-1234ABCD');
  assert.equal(findOrderId('AT-1234ABCD1234 длинный'), 'AT-1234ABCD1234');
  assert.equal(findOrderId('без номера'), '');
  const rows = parseBankCsv('Дата;Сумма;Назначение\n12.10.2026;-100 000;DHL Express\n14.10.2026;1 360 000;Оплата заказа AT-1234ABCD\n15.10.2026;-250 000;Аренда склада\n16.10.2026;-200;USD перевод').rows;
  rows[3].currency = 'USD';
  const matches = matchStatement(rows, [entry('carrier', 100_000)], [order()], (amount, currency) => currency === 'UZS' ? Math.round(amount) : currency === 'USD' ? Math.round(amount * 12_144) : null);
  assert.deepEqual(matches.map((match) => match.status), ['recorded', 'order', 'new', 'new']);
  assert.equal(matches[0].entry.id, 'LED-carrier100000');
  assert.deepEqual([matches[1].draft.kind, matches[1].draft.orderId, matches[1].order.orderId], ['customer_payment', 'AT-1234ABCD', 'AT-1234ABCD']);
  assert.deepEqual([matches[2].draft.kind, matches[2].draft.amountUzs], ['rent', 250_000]);
  assert.deepEqual([matches[3].draft.amountUzs, matches[3].draft.originalAmount, matches[3].draft.originalCurrency, matches[3].draft.kind], [2_428_800, 200, 'USD', 'bank_fee']);
  // the same ledger entry is not matched twice
  const twice = matchStatement([rows[0], { ...rows[0], id: 'dup' }], [entry('carrier', 100_000)], []);
  assert.deepEqual(twice.map((match) => match.status), ['recorded', 'new']);
  // the engine's bank-import proposals override the client verdict for the same date and amount
  const own = matchStatement(rows, [], []);
  const merged = mergeBankProposals(own, [
    { row: 2, date: '2026-10-14', amount: 1_360_000, purpose: 'Оплата заказа AT-1234ABCD', orderId: 'AT-1234ABCD', found: true, status: 'paid', payable: 1_360_000, alreadyRecorded: true, action: 'skip', reason: 'Оплата по заказу уже записана' },
    { row: 3, date: '2026-10-15', amount: -250_000, purpose: 'Аренда склада', found: false, alreadyRecorded: false, action: 'skip', reason: 'В назначении нет номера заказа AT-…' },
  ]);
  assert.deepEqual([merged[1].status, merged[1].serverNote, merged[2].status, merged[2].serverNote], ['recorded', 'Оплата по заказу уже записана', 'new', undefined]);
  const proposed = mergeBankProposals(matchStatement(rows.slice(1, 2), [], []), [{ row: 2, date: '2026-10-14', amount: 1_360_000, purpose: 'x', orderId: 'AT-1234ABCD', found: true, status: 'pending', payable: 1_360_000, alreadyRecorded: false, action: 'propose', reason: 'Сумма совпадает' }]);
  assert.deepEqual([proposed[0].status, proposed[0].order.orderId, proposed[0].draft.kind, proposed[0].draft.orderId], ['order', 'AT-1234ABCD', 'customer_payment', 'AT-1234ABCD']);
  assert.equal(mergeBankProposals(own, undefined), own);
});

test('invoice: lines add up to the payable amount; the engine JSON is accepted when valid', () => {
  const invoice = invoiceFromOrder(order({ services: 15_000, storeShipping: 30_000, payable: 1_405_000 }), '2026-10-06');
  assert.equal(invoice.number, 'СР-1234ABCD');
  assert.equal(invoice.lines.reduce((sum, line) => sum + line.amount, 0), 1_405_000);
  assert.deepEqual(invoice.lines.map((line) => line.label), ['Товар по цене магазина', 'Доставка магазина', 'Сервис Atlas (комиссия)', 'Международная доставка', 'Дополнительные услуги', 'Возвратный резерв на доставку']);
  assert.equal(invoice.lines[0].amount, 1_012_000, 'goods + fx markup = the store price line');
  const short = invoiceFromOrder(order({ payable: 1_300_000 }));
  assert.equal(short.lines.at(-1).amount, -60_000);
  assert.equal(short.lines.reduce((sum, line) => sum + line.amount, 0), 1_300_000);
  assert.equal(normalizeInvoice({ month: '2026-10', entries: [] }), null, 'a month payload is not an invoice');
  const fromServer = normalizeInvoice({ invoice: { orderId: 'AT-1', number: 'X-1', lines: [{ label: 'A', amount: 5 }, { bad: true }], total: 5, status: 'paid' } });
  assert.deepEqual([fromServer.number, fromServer.lines.length, fromServer.total, fromServer.status], ['X-1', 1, 5, 'paid']);
  // the engine's InvoiceData (GET ?invoice=): number = order id, timestamps, customer object, kinds, split and disclaimer
  const engine = normalizeInvoice({ invoice: { number: 'AT-1234ABCD', issuedAt: Date.UTC(2026, 9, 6, 7), createdAt: Date.UTC(2026, 9, 3, 7), paidAt: Date.UTC(2026, 9, 5, 7), status: 'paid', statusRu: 'оплата отмечена в Atlas', customer: { id: 'email:a@b.uz', name: 'Иван', email: 'a@b.uz' }, lines: [{ kind: 'merchandise', label: 'Товар', amount: 1_012_000 }, { kind: 'service', label: 'Сервис Atlas', amount: 98_000 }], goods: 1_012_000, services: 0, delivery: 0, total: 1_110_000, split: { transit: 1_000_000, atlasIncome: 110_000 }, disclaimer: 'Не фискальный документ.' } });
  assert.deepEqual([engine.number, engine.orderId, engine.issuedOn, engine.createdOn, engine.paidOn, engine.customerId, engine.customer.name, engine.statusRu, engine.lines[0].transit, engine.lines[1].transit, engine.split.atlasIncome, engine.note], ['AT-1234ABCD', 'AT-1234ABCD', '2026-10-06', '2026-10-03', '2026-10-05', 'email:a@b.uz', 'Иван', 'оплата отмечена в Atlas', true, undefined, 110_000, 'Не фискальный документ.']);
});

test('money positions come from the obligations snapshot plus optional engine positions', () => {
  const summary = monthSummary('2026-10', [order()], [entry('tax_paid', 10_000)], 0.15);
  const snapshot = obligations([order({ orderId: 'AT-P', status: 'pending', month: undefined }), order()], { 'AT-1234ABCD': '0' }, [5000, -200, 700]);
  const positions = moneyPositions(summary, snapshot, [{ id: 'cash', label: 'Касса', amount: 1, hint: 'h', kind: 'asset' }, { bad: true }]);
  assert.deepEqual(positions.map((position) => [position.id, position.amount]), [['receivable', 1_360_000], ['balances', 5700], ['stores', 1_000_000], ['tax-due', summary.tax - 10_000], ['cash', 1]]);
  // the engine's CashPosition (cumulative since 1 January) replaces the snapshot when present
  const cash = moneyPositions(summary, snapshot, undefined, { month: '2026-10', yearStart: '2026-01', receivable: { count: 2, amount: 10 }, owedToStores: { count: 1, goods: 20, storeShipping: 5, total: 25 }, customerBalances: { count: 3, amount: 30 }, tax: { accrued: 100, paid: 40, due: 60 }, ytd: { income: 500, expenses: 100, profit: 400, net: 340, orders: 7 }, note: 'n' });
  assert.deepEqual(cash.map((position) => [position.id, position.amount, position.kind]), [['receivable', 10, 'asset'], ['stores', 25, 'transit'], ['balances', 30, 'liability'], ['tax-due', 60, 'liability'], ['ytd', 400, 'asset']]);
});

test('the month backup is valid JSON with the loaded books', () => {
  const summary = monthSummary('2026-10', [order()], [], 0.15);
  const json = JSON.parse(monthBackup({ month: '2026-10', summary, entries: [entry('carrier', 1)], orders: [order()], orderEntries: [], settings }, 123));
  assert.deepEqual([json.format, json.version, json.exportedAt, json.month, json.entries.length, json.orders[0].orderId], ['atlas-accounting-month', 1, 123, '2026-10', 1, 'AT-1234ABCD']);
});
