import { z } from "zod";
import { failure, HttpError, identity, json, operator, requestJson, requirePermission, sameOrigin } from "@/lib/market/server";
import { accountingSettingsSchema, ledgerCsv, ledgerEntryInput, ledgerKinds, monthOf, monthsBetween, orderMarginCsv, ordersCsv, summaryCsv, yearCsv } from "@/lib/market/finance";
import { addLedgerEntry, books, ledgerForOrders, lockPeriod, obligationsSnapshot, orderStages, replaceLedgerEntry, saveAccountingSettings, unlockPeriod, voidLedgerEntry, yearBooks } from "@/lib/market/finance-server";

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
    if (exportKind === "year") {
      const selected = year.parse(url.searchParams.get("year") ?? thisMonth().slice(0, 4));
      return csvResponse(yearCsv((await yearBooks(selected)).summary), `atlas-year-${selected}`);
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
      const data = await yearBooks(selected);
      return json({ year: selected, summary: data.summary, settings: data.settings });
    }
    const selected = month.parse(url.searchParams.get("month") ?? thisMonth());
    const data = await books(selected, selected, [selected]);
    // The month's orders: paid that month, or created that month and still unpaid / refunded / cancelled.
    const orders = data.orders.filter((order) => order.month === selected || (order.status !== "paid" && monthOf(order.createdAt) === selected));
    const ids = orders.map((order) => order.orderId);
    const [orderEntries, stages, obligations] = await Promise.all([ledgerForOrders(ids), orderStages(ids), obligationsSnapshot()]);
    return json({ month: selected, summary: data.summaries[0], entries: data.entries, orders, orderEntries, stages, obligations, settings: data.settings, kinds: ledgerKinds, locked: !!data.settings.lockedThrough && selected <= data.settings.lockedThrough });
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
    return json({ settings: await saveAccountingSettings(body.value, user) });
  } catch (error) { return failure(error, request); }
}
