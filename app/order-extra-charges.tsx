import { useState } from "react";
import { ArrowRight, Receipt } from "lucide-react";
import { toast } from "sonner";
import { pendingExtraCharge, type ExtraCharge, type Order } from "@/lib/market/domain";
import type { Action } from "@/lib/market/actions";
import type { Locale } from "@/lib/market/i18n";
import { formatSum } from "@/lib/market/format";
import { formatDateTime } from "@/lib/market/customer-copy";
import { withCyrillic } from "@/lib/market/uz-cyrl";

/**
 * Extra invoices on a paid order (since 10 October 2026). The operator issues one with an amount and a reason;
 * the customer sees "Доплатить" only while it waits. Paying records the mark in Atlas: no payment provider is
 * connected, so nothing is charged and nothing here says otherwise.
 */
export const extraChargeCopy = /*@__PURE__*/withCyrillic({
  ru: { title: "Нужна доплата по заказу", pay: "Доплатить", paid: "Доплата отмечена в Atlas", cancelled: "Счёт отменён", list: "Доплаты по заказу", note: "Платёжный провайдер не подключён: деньги не списываются, Atlas сохранит только отметку.", dialogTitle: "Записать доплату в Atlas?", dialogText: "Действие отметит доплату в заказе. Платёжный провайдер не подключён: деньги не списываются, подтверждения банка нет." },
  uz: { title: "Buyurtma bo‘yicha qo‘shimcha to‘lov kerak", pay: "Qo‘shimcha to‘lash", paid: "Qo‘shimcha to‘lov Atlasda qayd etildi", cancelled: "Hisob bekor qilindi", list: "Buyurtma bo‘yicha qo‘shimcha to‘lovlar", note: "To‘lov provayderi ulanmagan: pul yechilmaydi, Atlas faqat belgini saqlaydi.", dialogTitle: "Qo‘shimcha to‘lov Atlasda qayd etilsinmi?", dialogText: "Amal buyurtmada qo‘shimcha to‘lovni belgilaydi. To‘lov provayderi ulanmagan: pul yechilmaydi, bank tasdig‘i yo‘q." },
  en: { title: "Extra payment needed", pay: "Pay the difference", paid: "Extra payment recorded in Atlas", cancelled: "Invoice withdrawn", list: "Extra payments on this order", note: "No payment provider is connected: no money is charged, Atlas keeps the mark only.", dialogTitle: "Record the extra payment in Atlas?", dialogText: "This marks the extra payment on the order. No payment provider is connected, so no money is charged and no bank confirmation is received." },
});

/** The customer's "now" item: the waiting invoice with its reason and the "Доплатить" button. */
export function CustomerExtraCharge({ order, locale, busy, onPay }: { order: Order; locale: Locale; busy: boolean; onPay: (charge: ExtraCharge) => void }) {
  const charge = pendingExtraCharge(order);
  if (!charge) return null;
  const t = extraChargeCopy[locale];
  return <div className="order-x-action-item">
    <Receipt size={20} aria-hidden="true" />
    <div><h3>{t.title}</h3><p>{charge.reason}</p><strong className="order-x-delta">+{formatSum(charge.amount, locale)}</strong><p className="micro">{t.note}</p></div>
    <button type="button" className="btn primary" disabled={busy} onClick={() => onPay(charge)}>{t.pay}<ArrowRight size={16} aria-hidden="true" /></button>
  </div>;
}

/** Paid and withdrawn invoices, for the order's calculation block. */
export function ExtraChargeHistory({ order, locale }: { order: Order; locale: Locale }) {
  const done = (order.extraCharges ?? []).filter((charge) => charge.status !== "pending");
  if (!done.length) return null;
  const t = extraChargeCopy[locale];
  return <div className="order-x-note info">
    <Receipt size={18} aria-hidden="true" />
    <div><b>{t.list}</b>{done.map((charge) => <p key={charge.id}>{charge.status === "paid" ? t.paid : t.cancelled}: {formatSum(charge.amount, locale)} · {charge.reason}</p>)}</div>
  </div>;
}

/** Operator: issue an extra invoice on a paid order (USD at the order's rate), see the invoices, withdraw a waiting one. */
export function OperatorExtraCharges({ order, run, locale }: { order: Order; run: (action: Action) => Promise<boolean>; locale: Locale }) {
  const [amountUsd, setAmountUsd] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const charges = order.extraCharges ?? [];
  const waiting = pendingExtraCharge(order);
  const canIssue = !order.cancelled && order.status < 5 && order.payment?.status === "paid";
  if (!canIssue && !charges.length) return null;
  const save = async (action: Action, message: string) => {
    if (busy) return false;
    setBusy(true);
    try {
      const ok = await run(action);
      if (ok) toast.success(message);
      return ok;
    } finally {
      setBusy(false);
    }
  };
  const status = (charge: ExtraCharge) => charge.status === "pending" ? "ждёт оплаты" : charge.status === "paid" ? `отмечена ${formatDateTime(charge.paidAt ?? charge.requestedAt, locale)}` : "отменён";
  return <section className="settlement-box extra-charge-ops" aria-label="Доплата по заказу">
    <Receipt size={22} aria-hidden="true" />
    <div>
      <h3>Доплата по заказу</h3>
      {charges.length > 0 && <ul className="micro">{charges.map((charge) => <li key={charge.id}>
        <b>{formatSum(charge.amount, "ru")}</b> (${charge.amountUsd.toFixed(2)}) · {charge.reason} · {status(charge)}
        {charge.status === "pending" && <> <button type="button" className="text-button" disabled={busy} onClick={() => void save({ type: "extra-charge-cancel", id: order.id, chargeId: charge.id }, "Счёт на доплату отменён")}>Отменить счёт</button></>}
      </li>)}</ul>}
      {canIssue && !waiting && <form onSubmit={(event) => {
        event.preventDefault();
        void save({ type: "extra-charge-request", id: order.id, amountUsd: Number(amountUsd), reason }, "Счёт на доплату отправлен покупателю").then((ok) => { if (ok) { setAmountUsd(""); setReason(""); } });
      }}>
        <div className="two-fields">
          <div className="field"><label htmlFor={`extra-usd-${order.id}`}>Сумма, USD</label><input id={`extra-usd-${order.id}`} type="number" inputMode="decimal" required min="0.01" max="10000" step=".01" value={amountUsd} onChange={(event) => setAmountUsd(event.target.value)} /></div>
          <div className="field"><label htmlFor={`extra-reason-${order.id}`}>Причина для покупателя</label><input id={`extra-reason-${order.id}`} required minLength={2} maxLength={300} placeholder="Например, магазин изменил цену" value={reason} onChange={(event) => setReason(event.target.value)} /></div>
        </div>
        <button className="btn secondary" disabled={busy || !reason.trim() || !(Number(amountUsd) > 0)}>Выставить доплату</button>
        <p className="micro">Сумма пересчитывается в сумы по курсу заказа. Покупатель увидит кнопку «Доплатить» в «Моих заказах»; заказ нельзя двигать дальше, пока счёт не оплачен или не отменён.</p>
      </form>}
      {waiting && <p className="micro">Покупатель ещё не оплатил счёт. Новый можно выставить после оплаты или отмены.</p>}
    </div>
  </section>;
}
