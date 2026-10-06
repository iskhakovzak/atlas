import { z } from "zod";
import { failure, HttpError, identity, json, operator, pricing, requestJson, requirePermission, sameOrigin } from "@/lib/market/server";
import { effectiveFx } from "@/lib/market/domain";
import { accountingSettingsSchema, ledgerCsv, ledgerEntryInput, ledgerKinds, monthOf, monthsBetween, orderMarginCsv, ordersCsv, summaryCsv, yearCsv } from "@/lib/market/finance";
import { cashPosition, fullBookCsv, matchBankLines, parseBankStatement, reconcile, taxCalendar } from "@/lib/market/finance-auto";
import { addLedgerEntry, books, confirmBankEntries, existingOrderIds, invoiceFor, ledgerByKind, ledgerForOrders, lockPeriod, obligationsSnapshot, orderFinanceByIds, orderStages, recordedPayments, replaceLedgerEntry, saveAccountingSettings, skippedAutoEntries, unlockPeriod, voidLedgerEntry, yearBooks } from "@/lib/market/finance-server";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const year = z.coerce.number().int().min(2024).max(2100);
/** Staff with the finance role read and write the books; reopening a closed month stays with the administrator. */
async function financeUser(permission: "finance.read" | "finance.write") { const user = await identity(); await requirePermission(user, permission); return user; }
async function adminUser() { const user = await identity(); if (!operator(user.email)) throw new HttpError(403, "Доступно только администратору."); return user; }
const thisMonth = () => new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 7);
const csvResponse = (csv: string, name: string) => new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "private, no-store" } });

// GET ?month=YYYY-MM: that month's books with its orders, their linked entries and the obligations snapshot.
// GET ?year=YYYY: twelve month summaries, quarters and the year total.
// GET ?export=orders|ledger|summary|margins&from=YYYY-MM&to=YYYY-MM, or ?export=year&year=YYYY: a CSV for the accountant.
export async function GET(request: Request) {
  try {
    await financeUser("finance.read");
    const url = new URL(request.url), exportKind = url.searchParams.get("export");
    // ?invoice=AT-…: the invoice-calculation of one order as data for printing (not a fiscal document).
    if (url.searchParams.has("invoice")) {
      const orderId = z.string().trim().regex(/^AT-[0-9A-Z]{8,12}$/i).parse(url.searchParams.get("invoice")).toUpperCase();
      const invoice = await invoiceFor(orderId);
      if (!invoice) throw new HttpError(404, "Заказ не найден в книгах.");
      return json({ invoice });
    }
    if (exportKind === "year") {
      const selected = year.parse(url.searchParams.get("year") ?? thisMonth().slice(0, 4));
      return csvResponse(yearCsv((await yearBooks(selected)).summary), `atlas-year-${selected}`);
    }
    // ?export=book&month=: the full book of a month — every ledger row (auto, manual, bank, voided) and the order rows.
    if (exportKind === "book") {
      const selected = month.parse(url.searchParams.get("month") ?? thisMonth());
      const data = await books(selected, selected, [selected]);
      const orders = data.orders.filter((order) => order.month === selected || (order.status !== "paid" && monthOf(order.createdAt) === selected));
      return csvResponse(fullBookCsv(selected, orders, data.entries, data.summaries[0]), `atlas-book-${selected}`);
    }
    // ?export=backup&from=&to=: a JSON backup of the books for the period (settings, orders, entries, summaries).
    if (exportKind === "backup") {
      const from = month.parse(url.searchParams.get("from") ?? thisMonth()), to = month.parse(url.searchParams.get("to") ?? from);
      if (from > to) throw new HttpError(400, "Начало периода позже конца.");
      const months = monthsBetween(from, to), data = await books(from, to, months);
      const body = JSON.stringify({ version: 1, exportedAt: Date.now(), from, to, settings: data.settings, orders: data.orders, entries: data.entries, summaries: data.summaries });
      return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="atlas-accounting-${from}${to !== from ? "_" + to : ""}.json"`, "Cache-Control": "private, no-store" } });
    }
    if (exportKind) {
      const from = month.parse(url.searchParams.get("from") ?? thisMonth()), to = month.parse(url.searchParams.get("to") ?? from);
      if (from > to) throw new HttpError(400, "Начало периода позже конца.");
      const months = monthsBetween(from, to), data = await books(from, to, months);
      const csv = exportKind === "orders" ? ordersCsv(data.orders) : exportKind === "ledger" ? ledgerCsv(data.entries) : exportKind === "summary" ? summaryCsv(data.summaries)
        : exportKind === "margins" ? orderMarginCsv(data.orders, await ledgerForOrders(data.orders.map((order) => order.orderId))) : null;
      if (!csv) throw new HttpError(400, "Неизвестная выгрузка.");
      return csvResponse(csv, `atlas-${exportKind}-${from}${to !== from ? "_" + to : ""}`);
    }
    if (url.searchParams.has("year")) {
      const selected = year.parse(url.searchParams.get("year"));
      // Tax paid for the fourth quarter lands in the next year's first months: read tax_paid through 1 March.
      const [data, taxPaid, obligations] = await Promise.all([yearBooks(selected), ledgerByKind("tax_paid", `${selected}-01-01`, `${selected + 1}-03-01`), obligationsSnapshot()]);
      const current = thisMonth(), lastMonth = current.slice(0, 4) === String(selected) ? current : `${selected}-12`;
      return json({ year: selected, summary: data.summary, settings: data.settings, taxCalendar: taxCalendar(data.summary, taxPaid), cash: cashPosition(lastMonth, data.summary.months, obligations) });
    }
    const selected = month.parse(url.searchParams.get("month") ?? thisMonth()), yearStart = selected.slice(0, 4) + "-01";
    const [data, ytd, tariff] = await Promise.all([books(selected, selected, [selected]), books(yearStart, selected, monthsBetween(yearStart, selected)), pricing()]);
    // The month's orders: paid that month, or created that month and still unpaid / refunded / cancelled.
    const orders = data.orders.filter((order) => order.month === selected || (order.status !== "paid" && monthOf(order.createdAt) === selected));
    const ids = orders.map((order) => order.orderId);
    const [orderEntries, stages, obligations] = await Promise.all([ledgerForOrders(ids), orderStages(ids), obligationsSnapshot()]);
    const fx = { usd: effectiveFx(tariff), ...(tariff.fxCbuRate ? { cbuRate: tariff.fxCbuRate } : {}), markup: tariff.fxMarkup ?? 1.012, source: tariff.fxSource, ...(tariff.fxUpdatedAt ? { updatedAt: tariff.fxUpdatedAt } : {}), rates: { ...(data.settings.fxRates ?? {}), USD: effectiveFx(tariff) } };
    const body = { month: selected, summary: data.summaries[0], entries: data.entries, orders, orderEntries, stages, obligations, settings: data.settings, kinds: ledgerKinds, locked: !!data.settings.lockedThrough && selected <= data.settings.lockedThrough, fx, cash: cashPosition(selected, ytd.summaries, obligations) };
    if (url.searchParams.get("check") !== "1") return json(body);
    // &check=1: the reconciliation of the month with explanations.
    const referenced = [...new Set([...data.entries, ...orderEntries].map((entry) => entry.orderId).filter((id): id is string => !!id))];
    const [knownOrderIds, skipped] = await Promise.all([existingOrderIds(referenced), skippedAutoEntries()]);
    return json({ ...body, reconcile: reconcile({ month: selected, orders, entries: data.entries, orderEntries, stages, knownOrderIds, summary: data.summaries[0], settings: data.settings, skipped }) });
  } catch (error) { return failure(error, request); }
}

const reason = z.string().trim().min(3).max(300);
const action = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("entry"), value: ledgerEntryInput }),
  z.object({ kind: z.literal("void"), id: z.string().min(4).max(80), reason }),
  z.object({ kind: z.literal("replace"), id: z.string().min(4).max(80), reason, value: ledgerEntryInput }),
  z.object({ kind: z.literal("settings"), value: z.object({ profitTaxRate: z.number().min(0).max(0.5).optional(), fxRates: accountingSettingsSchema.shape.fxRates }) }),
  z.object({ kind: z.literal("lock"), month }),
  z.object({ kind: z.literal("unlock"), reason, through: month.optional() }),
  // Bank statement: parse and match by the order number in the purpose; nothing is written until bank-confirm.
  z.object({ kind: z.literal("bank-import"), csv: z.string().min(1).max(1_000_000) }),
  z.object({ kind: z.literal("bank-confirm"), entries: z.array(ledgerEntryInput.extend({ kind: z.literal("customer_payment"), orderId: z.string().trim().regex(/^AT-[0-9A-Z]{8,12}$/i) })).min(1).max(200) }),
]);
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await financeUser("finance.write");
    const payload = action.safeParse(await requestJson(request, 20_000));
    if (!payload.success) throw new HttpError(400, "Проверьте поля записи.");
    const body = payload.data;
    if (body.kind === "entry") return json({ id: await addLedgerEntry(body.value, user) }, 201);
    if (body.kind === "void") { if (!(await voidLedgerEntry(body.id, body.reason, user))) throw new HttpError(404, "Запись не найдена или уже аннулирована."); return json({ ok: true }); }
    if (body.kind === "replace") return json({ id: await replaceLedgerEntry(body.id, body.reason, body.value, user) }, 201);
    if (body.kind === "lock") return json({ settings: await lockPeriod(body.month, user) });
    if (body.kind === "unlock") { await adminUser(); return json({ settings: await unlockPeriod(body.reason, user, body.through) }); }
    if (body.kind === "bank-import") {
      await adminUser();
      const parsed = parseBankStatement(body.csv);
      const ids = parsed.lines.map((line) => line.orderId).filter((id): id is string => !!id);
      const [orders, recorded] = await Promise.all([orderFinanceByIds(ids), recordedPayments(ids)]);
      return json({ lines: parsed.lines.length, errors: parsed.errors, proposals: matchBankLines(parsed.lines, orders, recorded) });
    }
    if (body.kind === "bank-confirm") {
      await adminUser();
      const entries = body.entries.map((entry) => ({ ...entry, orderId: entry.orderId.toUpperCase() }));
      return json({ ids: await confirmBankEntries(entries, user) }, 201);
    }
    return json({ settings: await saveAccountingSettings(body.value, user) });
  } catch (error) { return failure(error, request); }
}
