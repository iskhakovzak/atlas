import { z } from "zod";
import { failure, HttpError, identity, json, operator, requestJson, sameOrigin } from "@/lib/market/server";
import { accountingSettingsSchema, ledgerCsv, ledgerEntryInput, ledgerKinds, monthsBetween, ordersCsv, summaryCsv } from "@/lib/market/finance";
import { addLedgerEntry, books, saveAccountingSettings, voidLedgerEntry } from "@/lib/market/finance-server";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
async function operatorUser() { const user = await identity(); if (!operator(user.email)) throw new HttpError(403, "Доступно только администратору."); return user; }
const thisMonth = () => new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 7);

// GET ?month=YYYY-MM: that month's books. GET ?export=orders|ledger|summary&from=YYYY-MM&to=YYYY-MM: a CSV for the accountant.
export async function GET(request: Request) {
  try {
    await operatorUser();
    const url = new URL(request.url), exportKind = url.searchParams.get("export");
    if (exportKind) {
      const from = month.parse(url.searchParams.get("from") ?? thisMonth()), to = month.parse(url.searchParams.get("to") ?? from);
      if (from > to) throw new HttpError(400, "Начало периода позже конца.");
      const months = monthsBetween(from, to), data = await books(from, to, months);
      const csv = exportKind === "orders" ? ordersCsv(data.orders) : exportKind === "ledger" ? ledgerCsv(data.entries) : exportKind === "summary" ? summaryCsv(data.summaries) : null;
      if (!csv) throw new HttpError(400, "Неизвестная выгрузка.");
      return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="atlas-${exportKind}-${from}${to !== from ? "_" + to : ""}.csv"`, "Cache-Control": "private, no-store" } });
    }
    const selected = month.parse(url.searchParams.get("month") ?? thisMonth());
    const data = await books(selected, selected, [selected]);
    return json({ month: selected, summary: data.summaries[0], entries: data.entries, orders: data.orders.filter((order) => order.month === selected), settings: data.settings, kinds: ledgerKinds });
  } catch (error) { return failure(error, request); }
}

const action = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("entry"), value: ledgerEntryInput }),
  z.object({ kind: z.literal("void"), id: z.string().min(4).max(80), reason: z.string().trim().min(3).max(300) }),
  z.object({ kind: z.literal("settings"), value: accountingSettingsSchema }),
]);
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await operatorUser();
    const payload = action.safeParse(await requestJson(request, 20_000));
    if (!payload.success) throw new HttpError(400, "Проверьте поля записи.");
    const body = payload.data;
    if (body.kind === "entry") return json({ id: await addLedgerEntry(body.value, user) }, 201);
    if (body.kind === "void") { if (!(await voidLedgerEntry(body.id, body.reason, user))) throw new HttpError(404, "Запись не найдена или уже аннулирована."); return json({ ok: true }); }
    return json({ settings: await saveAccountingSettings(body.value, user) });
  } catch (error) { return failure(error, request); }
}
