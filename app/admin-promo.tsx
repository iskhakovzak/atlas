"use client";
// Admin → Промокоды (redesign stage 6, 1 November 2026): create a code, switch it on or off, change its terms, and see how
// many times it was used and how much it took off the Atlas service. Server: app/api/promo-codes/route.ts.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Tag } from "lucide-react";
import { toast } from "@/lib/market/toast";
import { normalizePromoCode, promoCodePattern, promoDefaultEnd, type PromoKind, type PromoRule } from "@/lib/market/promo";
import { money } from "./admin-shared";

type Draft = { id?: string; code: string; kind: PromoKind; value: string; startsOn: string; endsOn: string; maxUses: string; minOrder: string; active: boolean; note: string };
const tashkentDay = (at: number) => new Date(at + 5 * 3600_000).toISOString().slice(0, 10);
/** A date field read as Tashkent midnight; `end` moves it to the next midnight (the code works through that whole day). */
const dayStart = (value: string, end = false) => { if (!value) return null; const at = Date.parse(value + "T00:00:00+05:00"); return Number.isFinite(at) ? at + (end ? 86_400_000 : 0) : null; };
const blank = (): Draft => ({ code: "", kind: "percent", value: "10", startsOn: tashkentDay(Date.now()), endsOn: tashkentDay(promoDefaultEnd(Date.now()) - 86_400_000), maxUses: "100", minOrder: "", active: true, note: "" });
const fromRule = (rule: PromoRule): Draft => ({ id: rule.id, code: rule.code, kind: rule.kind, value: String(rule.value), startsOn: rule.startsAt ? tashkentDay(rule.startsAt) : "", endsOn: rule.endsAt ? tashkentDay(rule.endsAt - 86_400_000) : "", maxUses: rule.maxUses ? String(rule.maxUses) : "", minOrder: rule.minOrder ? String(rule.minOrder) : "", active: rule.active, note: rule.note ?? "" });
const day = (at?: number | null) => at ? new Date(at).toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" }) : "";

async function request<T>(method: "GET" | "POST", body?: unknown): Promise<T> {
  const response = await fetch("/api/promo-codes", { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw Error(data.error ?? "Не удалось выполнить запрос.");
  return data;
}

export function AdminPromo() {
  const [promos, setPromos] = useState<PromoRule[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState<Draft>(blank);
  const [busy, setBusy] = useState(false);
  // Field errors show once a field has something in it or after a save was tried, not on an empty new form.
  const [tried, setTried] = useState(false);
  // The moment the list was read: a code's status («срок истёк») is judged against it, not the clock during render.
  const [now, setNow] = useState(0);
  const load = useCallback(async () => {
    try { setPromos((await request<{ promos: PromoRule[] }>("GET")).promos); setNow(Date.now()); setLoadError(""); } catch (error) { setLoadError((error as Error).message); setPromos([]); }
  }, []);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const code = normalizePromoCode(draft.code);
  const value = Number(draft.value);
  const issues = {
    code: (tried || draft.code) && !promoCodePattern.test(code) ? "3–30 латинских букв, цифр, «-» или «_»." : "",
    value: !(value > 0) || (draft.kind === "percent" ? value > 100 : !Number.isInteger(value)) ? (draft.kind === "percent" ? "Процент от 1 до 100." : "Сумма в сумах, целое число.") : "",
    window: draft.startsOn && draft.endsOn && draft.endsOn < draft.startsOn ? "Конец срока раньше начала." : "",
    maxUses: draft.maxUses && !(Number.isInteger(Number(draft.maxUses)) && Number(draft.maxUses) >= 1) ? "Целое число от 1 или пусто." : "",
    minOrder: draft.minOrder && !(Number.isInteger(Number(draft.minOrder)) && Number(draft.minOrder) >= 1) ? "Сумма в сумах или пусто." : "",
  };
  const invalid = Object.values(issues).some(Boolean);
  async function save(next: Draft, message: string) {
    setBusy(true);
    try {
      const data = await request<{ promos: PromoRule[] }>("POST", { promo: {
        ...(next.id ? { id: next.id } : {}), code: normalizePromoCode(next.code), kind: next.kind, value: Number(next.value), active: next.active,
        startsAt: dayStart(next.startsOn), endsAt: dayStart(next.endsOn, true), maxUses: next.maxUses ? Number(next.maxUses) : null, minOrder: next.minOrder ? Number(next.minOrder) : null,
        ...(next.note.trim() ? { note: next.note.trim() } : {}),
      } });
      setPromos(data.promos); setNow(Date.now()); toast.success(message);
      return true;
    } catch (error) { toast.error((error as Error).message); return false; }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (invalid || busy) return;
    if (await save(draft, draft.id ? `Промокод ${code} изменён и записан в журнал.` : `Промокод ${code} создан и записан в журнал.`)) { setDraft(blank()); setTried(false); }
  }
  const field = (key: keyof typeof issues) => issues[key] ? <small id={`promo-${key}-error`} className="admin-field-error" role="alert">{issues[key]}</small> : null;
  const state = (rule: PromoRule) => !rule.active ? "Выключен" : rule.endsAt && rule.endsAt <= now ? "Срок истёк" : rule.startsAt && rule.startsAt > now ? "Ещё не начался" : rule.maxUses && rule.uses >= rule.maxUses ? "Использован" : "Действует";
  return <section className="surface admin-section admin-promo" aria-labelledby="admin-promo-title">
    <div className="admin-section-head"><div>
      <h2 id="admin-promo-title"><Tag size={20} aria-hidden="true" /> Промокоды</h2>
      <p>Скидка действует только на сервис Atlas (комиссию за выкуп): цену товара, доставку, гарантию и пошлину промокод не меняет, сервис не уходит ниже нуля. Atlas — агент, поэтому скидка уменьшает доход Atlas и видна в бухгалтерии. Использования считаются в момент оформления заказа.</p>
    </div></div>
    <form className="admin-promo-form" noValidate onSubmit={(event) => void submit(event)}>
      <h3 className="admin-subhead">{draft.id ? `Изменить ${draft.code}` : "Новый промокод"}</h3>
      <div className="pricing-grid admin-promo-grid">
        <div className={"field" + (issues.code ? " invalid" : "")}><label htmlFor="promo-code">Код</label><input id="promo-code" autoCapitalize="characters" spellCheck={false} maxLength={30} value={draft.code} aria-invalid={!!issues.code} aria-describedby={issues.code ? "promo-code-error" : undefined} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} />{field("code")}</div>
        <div className="field"><label htmlFor="promo-kind">Скидка</label><select id="promo-kind" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as PromoKind })}><option value="percent">Процент от сервиса Atlas</option><option value="fixed">Сумма в сумах</option></select></div>
        <div className={"field" + (issues.value ? " invalid" : "")}><label htmlFor="promo-value">{draft.kind === "percent" ? "Процент, %" : "Сумма, сум"}</label><input id="promo-value" type="number" inputMode="numeric" min="1" max={draft.kind === "percent" ? 100 : 100000000} step="1" value={draft.value} aria-invalid={!!issues.value} aria-describedby={issues.value ? "promo-value-error" : undefined} onChange={(event) => setDraft({ ...draft, value: event.target.value })} />{field("value")}</div>
        <div className="field"><label htmlFor="promo-start">Действует с</label><input id="promo-start" type="date" value={draft.startsOn} onChange={(event) => setDraft({ ...draft, startsOn: event.target.value })} /></div>
        <div className={"field" + (issues.window ? " invalid" : "")}><label htmlFor="promo-end">по (включительно)</label><input id="promo-end" type="date" value={draft.endsOn} aria-invalid={!!issues.window} aria-describedby={issues.window ? "promo-window-error" : undefined} onChange={(event) => setDraft({ ...draft, endsOn: event.target.value })} />{field("window")}</div>
        <div className={"field" + (issues.maxUses ? " invalid" : "")}><label htmlFor="promo-max">Использований всего</label><input id="promo-max" type="number" inputMode="numeric" min="1" step="1" placeholder="без ограничения" value={draft.maxUses} aria-invalid={!!issues.maxUses} aria-describedby={issues.maxUses ? "promo-maxUses-error" : undefined} onChange={(event) => setDraft({ ...draft, maxUses: event.target.value })} />{field("maxUses")}</div>
        <div className={"field" + (issues.minOrder ? " invalid" : "")}><label htmlFor="promo-min">Заказ от, сум</label><input id="promo-min" type="number" inputMode="numeric" min="1" step="1000" placeholder="любой" value={draft.minOrder} aria-invalid={!!issues.minOrder} aria-describedby={issues.minOrder ? "promo-minOrder-error" : undefined} onChange={(event) => setDraft({ ...draft, minOrder: event.target.value })} />{field("minOrder")}</div>
        <div className="field"><label htmlFor="promo-note">Заметка (видна только сотрудникам)</label><input id="promo-note" maxLength={200} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></div>
      </div>
      <label className="admin-promo-active"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span>Включён</span></label>
      <div className="admin-system-actions">
        <button type="submit" className="btn primary" disabled={busy}>{busy ? "Сохраняем…" : draft.id ? "Сохранить промокод" : "Создать промокод"}</button>
        {draft.id && <button type="button" className="btn secondary" disabled={busy} onClick={() => setDraft(blank())}>Отмена</button>}
      </div>
    </form>
    <h3 className="admin-subhead">Все промокоды</h3>
    {loadError && <p className="notice error" role="alert">{loadError}</p>}
    {!promos ? <p className="micro" role="status">Загружаем…</p> : promos.length ? <div className="acc-scroll acc-cards-on-phone"><table className="accounting-table admin-promo-table">
      <thead><tr><th scope="col">Код</th><th scope="col">Скидка</th><th scope="col">Срок</th><th scope="col">Использований</th><th scope="col">Заказ от</th><th scope="col">Скидок выдано</th><th scope="col">Статус</th><th scope="col"><span className="sr-only">Действия</span></th></tr></thead>
      <tbody>{promos.map((rule) => <tr key={rule.id} className={rule.active ? undefined : "muted-row"}>
        <td data-label="Код"><b>{rule.code}</b>{rule.note && <small>{rule.note}</small>}</td>
        <td data-label="Скидка" className="num">{rule.kind === "percent" ? `${rule.value} % сервиса` : `${money(rule.value)}`}</td>
        <td data-label="Срок">{rule.startsAt || rule.endsAt ? `${day(rule.startsAt) || "…"} — ${rule.endsAt ? day(rule.endsAt - 1) : "…"}` : "без срока"}</td>
        <td data-label="Использований" className="num">{rule.uses}{rule.maxUses ? ` из ${rule.maxUses}` : ""}</td>
        <td data-label="Заказ от" className="num">{rule.minOrder ? money(rule.minOrder) : "—"}</td>
        <td data-label="Скидок выдано" className="num">{money(rule.discountTotal ?? 0)}</td>
        <td data-label="Статус">{state(rule)}</td>
        <td className="acc-actions">
          <button type="button" className="text-button" disabled={busy} onClick={() => void save({ ...fromRule(rule), active: !rule.active }, rule.active ? `Промокод ${rule.code} выключен.` : `Промокод ${rule.code} включён.`)}>{rule.active ? "Выключить" : "Включить"}</button>
          <button type="button" className="text-button" disabled={busy} onClick={() => { setDraft(fromRule(rule)); document.getElementById("promo-code")?.focus(); }}><Pencil size={14} aria-hidden="true" />Изменить</button>
        </td>
      </tr>)}</tbody>
    </table></div> : <p className="micro">Промокодов пока нет. Создайте первый в форме выше.</p>}
  </section>;
}
