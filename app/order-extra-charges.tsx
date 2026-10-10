import { useState } from "react";
import { ArrowRight, Receipt } from "lucide-react";
import { toast } from "@/lib/market/toast";
import { orderInsuranceRate, pendingExtraCharge, type ExtraCharge, type Order } from "@/lib/market/domain";
import type { Action } from "@/lib/market/actions";
import type { Locale } from "@/lib/market/i18n";
import { formatSum } from "@/lib/market/format";
import { formatDateTime } from "@/lib/market/customer-copy";
import { withCyrillic } from "@/lib/market/uz-cyrl";

/**
 * Extra invoices on a paid order (since 10 October 2026). The operator issues one with an amount and a reason;
 * the customer sees "Доплатить {сумма}" only while it waits. Paying records the mark in Atlas: no payment provider is
 * connected, which the confirmation dialog says once; the card itself stays short.
 */
export const extraChargeCopy = /*@__PURE__*/withCyrillic({
  ru: { title: "Нужна доплата по заказу", pay: (amount: string) => `Доплатить ${amount}`, paid: "Доплачено", cancelled: "Счёт отменён", list: "Доплаты по заказу" },
  uz: { title: "Buyurtma bo‘yicha qo‘shimcha to‘lov kerak", pay: (amount: string) => `${amount} qo‘shimcha to‘lash`, paid: "Qo‘shimcha to‘langan", cancelled: "Hisob bekor qilindi", list: "Buyurtma bo‘yicha qo‘shimcha to‘lovlar" },
  en: { title: "Extra payment needed", pay: (amount: string) => `Pay ${amount} extra`, paid: "Paid extra", cancelled: "Invoice withdrawn", list: "Extra payments on this order" },
});

/** On an insured line a dearer price carries the insurance on the difference (the line's rate, locked at checkout). */
export const insuranceShare = /*@__PURE__*/withCyrillic({
  ru: (amount: string) => `В том числе страховка ${amount}`,
  uz: (amount: string) => `Shu jumladan sug‘urta ${amount}`,
  en: (amount: string) => `Including insurance ${amount}`,
});

/** The customer's "now" item: the waiting invoice with its reason and the "Доплатить" button. */
export function CustomerExtraCharge({ order, locale, busy, onPay }: { order: Order; locale: Locale; busy: boolean; onPay: (charge: ExtraCharge) => void }) {
  const charge = pendingExtraCharge(order);
  if (!charge) return null;
  const t = extraChargeCopy[locale];
  return <div className="order-x-action-item">
    <Receipt size={20} aria-hidden="true" />
    <div><h3>{t.title}</h3><p>{charge.reason}</p>{charge.insuranceAmount ? <p className="micro">{insuranceShare[locale](formatSum(charge.insuranceAmount, locale))}</p> : null}</div>
    <button type="button" className="btn primary" disabled={busy} onClick={() => onPay(charge)}>{t.pay(formatSum(charge.amount, locale))}<ArrowRight size={16} aria-hidden="true" /></button>
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
  // Goods (a dearer price, the default) carry the insurance on an insured line; delivery or a fee does not.
  const [goods, setGoods] = useState(true);
  const [busy, setBusy] = useState(false);
  const rate = orderInsuranceRate(order);
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
        <b>{formatSum(charge.amount, "ru")}</b> (${charge.amountUsd.toFixed(2)}{charge.insuranceAmount ? ` + страховка ${formatSum(charge.insuranceAmount, "ru")}` : ""}) · {charge.reason} · {status(charge)}
        {charge.status === "pending" && <> <button type="button" className="text-button" disabled={busy} onClick={() => void save({ type: "extra-charge-cancel", id: order.id, chargeId: charge.id }, "Счёт на доплату отменён")}>Отменить счёт</button></>}
      </li>)}</ul>}
      {canIssue && !waiting && <form onSubmit={(event) => {
        event.preventDefault();
        void save({ type: "extra-charge-request", id: order.id, amountUsd: Number(amountUsd), reason, goods }, "Счёт на доплату отправлен покупателю").then((ok) => { if (ok) { setAmountUsd(""); setReason(""); setGoods(true); } });
      }}>
        <div className="two-fields">
          <div className="field"><label htmlFor={`extra-usd-${order.id}`}>Сумма, USD</label><input id={`extra-usd-${order.id}`} type="number" inputMode="decimal" required min="0.01" max="10000" step=".01" value={amountUsd} onChange={(event) => setAmountUsd(event.target.value)} /></div>
          <div className="field"><label htmlFor={`extra-reason-${order.id}`}>Причина для покупателя</label><input id={`extra-reason-${order.id}`} required minLength={2} maxLength={300} placeholder="Например, магазин изменил цену" value={reason} onChange={(event) => setReason(event.target.value)} /></div>
        </div>
        {rate ? <label className="warehouse-issue-resolution"><input type="checkbox" checked={goods} onChange={(event) => setGoods(event.target.checked)} /><span>Это цена товара<small>Посылка застрахована: к доплате за товар прибавится страховка {Math.round(rate * 1000) / 10} % от разницы. Снимите отметку, если это доставка магазина или сбор.</small></span></label> : null}
        <button className="btn secondary" disabled={busy || !reason.trim() || !(Number(amountUsd) > 0)}>Выставить доплату</button>
        <p className="micro">Сумма пересчитывается в сумы по курсу заказа. Покупатель увидит кнопку «Доплатить» в «Моих заказах»; заказ нельзя двигать дальше, пока счёт не оплачен или не отменён.</p>
      </form>}
      {waiting && <p className="micro">Покупатель ещё не оплатил счёт. Новый можно выставить после оплаты или отмены.</p>}
    </div>
  </section>;
}
