import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { toast } from "@/lib/market/toast";
import {
  claimKindsOpen,
  claimLimit,
  claimWindowDays,
  orderInsuranceRate,
  uninsuredDamagePerKgUsd,
  uninsuredLossPerKgUsd,
  type Order,
  type ParcelClaim,
  type ParcelClaimKind,
} from "@/lib/market/domain";
import type { Action } from "@/lib/market/actions";
import type { Locale } from "@/lib/market/i18n";
import { formatSum } from "@/lib/market/format";
import { formatDateTime } from "@/lib/market/customer-copy";
import { withCyrillic } from "@/lib/market/uz-cyrl";

/**
 * Claims on a lost or damaged parcel (since 10 October 2026). Atlas insures parcels itself: an insured line gets back
 * up to the goods value, an uninsured one $15 per kg on a loss and $3 per kg on damage (never above the goods value).
 * The customer reports once the parcel left for Tashkent (a loss) or on receipt within 14 days (damage); the operator
 * approves an amount up to the limit, which lands on the Atlas balance, or declines with a reason.
 */
export const claimCopy = /*@__PURE__*/withCyrillic({
  ru: {
    open: "Сообщить о проблеме с посылкой",
    kind: { loss: "Посылка потерялась", damage: "Товар пришёл повреждённым" } as Record<ParcelClaimKind, string>,
    describe: "Что случилось",
    placeholder: "Например: коробка пришла вскрытой, на экране трещина",
    photos: "Фото повреждений пришлите в поддержку — так проверим быстрее.",
    insured: (limit: string) => `Посылка застрахована: вернём до ${limit} — полную стоимость товара.`,
    uninsured: (limit: string) => `Посылка без страховки: возмещаем $${uninsuredLossPerKgUsd} за кг при утере и $${uninsuredDamagePerKgUsd} за кг при порче — здесь до ${limit}.`,
    window: `О порче сообщите в течение ${claimWindowDays} дней после получения.`,
    send: "Отправить претензию",
    sending: "Отправляем…",
    sent: "Претензия отправлена",
    status: { submitted: "Претензия на проверке", approved: "Возмещение зачислено", declined: "Претензия отклонена" } as Record<ParcelClaim["status"], string>,
    limit: (limit: string) => `Возмещение до ${limit}`,
    credited: (amount: string) => `${amount} — на балансе Atlas`,
  },
  uz: {
    open: "Posilka bilan muammo haqida xabar berish",
    kind: { loss: "Posilka yo‘qoldi", damage: "Mahsulot shikastlangan holda keldi" } as Record<ParcelClaimKind, string>,
    describe: "Nima bo‘ldi",
    placeholder: "Masalan: quti ochilgan holda keldi, ekranda yoriq bor",
    photos: "Shikast fotosuratlarini qo‘llab-quvvatlashga yuboring — tezroq tekshiramiz.",
    insured: (limit: string) => `Posilka sug‘urtalangan: ${limit} gacha — mahsulotning to‘liq narxini qaytaramiz.`,
    uninsured: (limit: string) => `Posilka sug‘urtasiz: yo‘qolsa kg uchun $${uninsuredLossPerKgUsd}, shikastlansa kg uchun $${uninsuredDamagePerKgUsd} — bu yerda ${limit} gacha.`,
    window: `Shikast haqida olganingizdan keyin ${claimWindowDays} kun ichida xabar bering.`,
    send: "Da’voni yuborish",
    sending: "Yuborilmoqda…",
    sent: "Da’vo yuborildi",
    status: { submitted: "Da’vo tekshirilmoqda", approved: "Qoplash o‘tkazildi", declined: "Da’vo rad etildi" } as Record<ParcelClaim["status"], string>,
    limit: (limit: string) => `Qoplash ${limit} gacha`,
    credited: (amount: string) => `${amount} — Atlas balansida`,
  },
  en: {
    open: "Report a problem with the parcel",
    kind: { loss: "The parcel was lost", damage: "The item arrived damaged" } as Record<ParcelClaimKind, string>,
    describe: "What happened",
    placeholder: "For example: the box arrived open, the screen is cracked",
    photos: "Send photos of the damage to support — it speeds up the check.",
    insured: (limit: string) => `The parcel is insured: we return up to ${limit}, the full value of the goods.`,
    uninsured: (limit: string) => `The parcel is not insured: we pay $${uninsuredLossPerKgUsd} per kg on a loss and $${uninsuredDamagePerKgUsd} per kg on damage — up to ${limit} here.`,
    window: `Report damage within ${claimWindowDays} days of receipt.`,
    send: "Send the claim",
    sending: "Sending…",
    sent: "Claim sent",
    status: { submitted: "Claim under review", approved: "Compensation credited", declined: "Claim declined" } as Record<ParcelClaim["status"], string>,
    limit: (limit: string) => `Compensation up to ${limit}`,
    credited: (amount: string) => `${amount} on your Atlas balance`,
  },
});

/** The customer's side: the claims filed on the line, and the form while a claim can be filed. */
export function CustomerParcelClaim({ order, locale, busy, run }: { order: Order; locale: Locale; busy: boolean; run: (action: Action) => Promise<boolean> }) {
  const t = claimCopy[locale];
  const open = claimKindsOpen(order);
  const [kind, setKind] = useState<ParcelClaimKind>(open.includes("damage") ? "damage" : "loss");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const claims = order.claims ?? [];
  if (!open.length && !claims.length) return null;
  const chosen = open.includes(kind) ? kind : open[0];
  const insured = Boolean(orderInsuranceRate(order));
  return <>
    {claims.map((claim) => <div key={claim.id} className={"order-x-note " + (claim.status === "approved" ? "ok" : claim.status === "declined" ? "muted" : "warn")}>
      <LifeBuoy size={18} aria-hidden="true" />
      <div>
        <b>{t.status[claim.status]}</b>
        <p>{t.kind[claim.kind]} · {formatDateTime(claim.reportedAt, locale)}</p>
        <p>{claim.status === "approved" && claim.amount ? t.credited(formatSum(claim.amount, locale)) : claim.status === "declined" ? claim.note : t.limit(formatSum(claim.limit, locale))}</p>
      </div>
    </div>)}
    {chosen && <details className="order-x-more parcel-claim">
      <summary>{t.open}</summary>
      <form className="order-x-more-body" onSubmit={(event) => {
        event.preventDefault();
        if (sending || busy) return;
        setSending(true);
        void run({ type: "parcel-claim-report", id: order.id, kind: chosen, description })
          .then((ok) => { if (ok) { setDescription(""); toast.success(t.sent); } })
          .finally(() => setSending(false));
      }}>
        <fieldset className="service-options">
          <legend className="sr-only">{t.open}</legend>
          {open.map((value) => <label key={value}><input type="radio" name={`claim-kind-${order.id}`} value={value} checked={chosen === value} onChange={() => setKind(value)} />{t.kind[value]}</label>)}
        </fieldset>
        <div className="field"><label htmlFor={`claim-text-${order.id}`}>{t.describe}</label><textarea id={`claim-text-${order.id}`} rows={3} required minLength={10} maxLength={1000} placeholder={t.placeholder} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        <p className="micro">{insured ? t.insured(formatSum(claimLimit(order, chosen), locale)) : t.uninsured(formatSum(claimLimit(order, chosen), locale))} {open.includes("damage") ? t.window : ""} {chosen === "damage" ? t.photos : ""}</p>
        <button className="btn secondary" disabled={busy || sending || description.trim().length < 10}>{sending ? t.sending : t.send}</button>
      </form>
    </details>}
  </>;
}

/** The operator's side: every claim on the line, and the decision on the one waiting. */
export function OperatorParcelClaims({ order, run, locale }: { order: Order; run: (action: Action) => Promise<boolean>; locale: Locale }) {
  const claims = order.claims ?? [];
  const waiting = claims.find((claim) => claim.status === "submitted");
  const [amount, setAmount] = useState(waiting ? String(waiting.limit) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!claims.length) return null;
  const decide = async (decision: "approved" | "declined") => {
    if (!waiting || busy) return;
    setBusy(true);
    try {
      const ok = await run({ type: "parcel-claim-decide", id: order.id, claimId: waiting.id, decision, amount: decision === "approved" ? Math.round(Number(amount || waiting.limit)) : undefined, note });
      if (ok) toast.success(decision === "approved" ? "Возмещение зачислено на баланс покупателя" : "Претензия отклонена, покупатель увидит причину");
    } finally {
      setBusy(false);
    }
  };
  const kinds: Record<ParcelClaimKind, string> = { loss: "утеря", damage: "порча" };
  const statuses: Record<ParcelClaim["status"], string> = { submitted: "ждёт решения", approved: "одобрена", declined: "отклонена" };
  return <section className="settlement-box parcel-claim-ops" aria-label="Претензия по посылке">
    <LifeBuoy size={22} aria-hidden="true" />
    <div>
      <h3>Претензия по посылке</h3>
      <ul className="micro">{claims.map((claim) => <li key={claim.id}>
        <b>{kinds[claim.kind]}</b> · {formatDateTime(claim.reportedAt, locale)} · {claim.insured ? "застрахована" : "без страховки"} · лимит {formatSum(claim.limit, "ru")} · {statuses[claim.status]}
        {claim.amount ? ` · выплачено ${formatSum(claim.amount, "ru")}` : ""}{claim.note ? ` · ${claim.note}` : ""}
        <br />«{claim.description}»
      </li>)}</ul>
      {waiting && <form onSubmit={(event) => { event.preventDefault(); void decide("approved"); }}>
        <div className="two-fields">
          <div className="field"><label htmlFor={`claim-amount-${order.id}`}>Возмещение, сум</label><input id={`claim-amount-${order.id}`} type="number" min="1" max={waiting.limit} step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
          <div className="field"><label htmlFor={`claim-note-${order.id}`}>Комментарий покупателю</label><input id={`claim-note-${order.id}`} maxLength={500} placeholder="Обязателен при отказе" value={note} onChange={(event) => setNote(event.target.value)} /></div>
        </div>
        <div className="order-x-buttons">
          <button type="button" className="btn secondary" disabled={busy || note.trim().length < 5} onClick={() => void decide("declined")}>Отклонить</button>
          <button className="btn primary" disabled={busy || !(Number(amount) > 0) || Number(amount) > waiting.limit}>{busy ? "…" : "Одобрить и зачислить"}</button>
        </div>
        <p className="micro">{waiting.insured ? "Посылка застрахована: до полной стоимости товара." : `Без страховки: $${uninsuredLossPerKgUsd}/кг при утере, $${uninsuredDamagePerKgUsd}/кг при порче, не больше стоимости товара.`} Сумма зачисляется на внутренний баланс покупателя; деньги на карту не отправляются.</p>
      </form>}
    </div>
  </section>;
}
