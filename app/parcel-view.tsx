"use client";

import { useState } from "react";
import Link from "@/components/site-link";
import { ArrowLeft, ArrowRight, Check, FileCheck2, LifeBuoy, MapPin, Package, ScanLine, Truck } from "lucide-react";
import { useMarket } from "@/lib/market/store";
import { deliveredStage, deliveryAddressLine, parcelStageOf, type Order } from "@/lib/market/domain";
import { localizedParcelStages, type Locale } from "@/lib/market/i18n";
import { formatDateTime, formatLongDate, itemCount } from "@/lib/market/customer-copy";
import { orderCustomerTotal, orderGroupCopy } from "@/lib/market/order-groups";
import { documentsPath, parcelAction, parcelOf, profileActions } from "@/lib/market/parcels";
import { parcelEventText, profileCopy } from "@/lib/market/profile-copy";
import { readableVariant } from "@/lib/market/nike-size-chart";
import type { Action } from "@/lib/market/actions";
import { ProductImage } from "./market-ui";
import { Money } from "./money";
import { CopyText } from "./copy-text";
import { CustomerParcelClaim } from "./parcel-claim";
import { ParcelStageBar, ProfileActionCard, parcelTitle } from "./profile-parcels";

/**
 * /account/parcels/<order id> (owner, 1 November 2026): the parcel as the buyer follows it — the eight-stage bar, one
 * next step, the orders inside it (each with its own purchase stage until the overseas warehouse), the recipient,
 * tracking, documents and the claim form inside each order. Any order number of the parcel opens it. Every amount and
 * stage comes from the saved account; nothing here is computed for show only.
 */
export function ParcelView({ id }: { id: string }) {
  const { state, ready, act } = useMarket();
  const locale = state.communication.language;
  const t = profileCopy[locale];
  const [busy, setBusy] = useState(false);
  const run = async (action: Action) => { setBusy(true); try { return await act(action); } finally { setBusy(false); } };
  const parcel = ready ? parcelOf(state.orders, id) : undefined;
  if (!ready) return null;
  if (!parcel) return <section className="cabinet-card pf-missing">
    <span className="pf-empty-icon" aria-hidden="true"><Package size={22} /></span>
    <div><h1>{t.parcel.notFound}</h1><p>{t.parcel.notFoundHint}</p></div>
    <div className="pf-missing-actions"><Link className="btn primary" href="/orders">{t.hub.tiles.orders}<ArrowRight size={16} aria-hidden="true" /></Link><Link className="btn secondary" href="/account">{t.parcel.back}</Link></div>
  </section>;

  const action = parcelAction(parcel, profileActions(state));
  const stage = parcel.stage;
  const names = localizedParcelStages(locale);
  const delivered = stage !== undefined && stage >= deliveredStage;
  const total = parcel.live.reduce((sum, order) => sum + orderCustomerTotal(order), 0);
  const items = parcel.live.reduce((sum, order) => sum + order.quantity, 0);
  const tracked = parcel.live.find((order) => order.parcel)?.parcel;
  // Events of the parcel, once each: the orders of one box carry the same events, written a few milliseconds apart when
  // the operator moved them one by one — the earliest stays (review, 1 November 2026). Newest first.
  const seen = new Set<string>();
  const events = parcel.live.flatMap((order) => order.parcel?.events ?? []).sort((a, b) => a.at - b.at).filter((event) => {
    const key = `${event.status}|${event.location ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).reverse();
  const identities = state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);
  const passport = parcel.live.find((order) => order.identity)?.identity ?? (parcel.deliveryProfileId ? identities.find((profile) => profile.recipientProfileId === parcel.deliveryProfileId) : undefined);
  const orderIds = new Set(parcel.orders.map((order) => order.id));
  const declarations = state.declarations.filter((item) => item.orderIds.some((orderId) => orderIds.has(orderId)));
  const delivery = parcel.delivery;
  const recipientProfile = parcel.deliveryProfileId ? state.deliveryProfiles.find((profile) => profile.id === parcel.deliveryProfileId) : undefined;

  return <div className="cabinet pf-page pf-parcel-page">
    <header className="pf-page-head">
      <Link className="pf-back" href="/account"><ArrowLeft size={16} aria-hidden="true" />{t.parcel.back}</Link>
      <h1>{parcelTitle(parcel, locale)}</h1>
      <p className="pf-page-meta">
        <span>{t.parcel.placed(formatLongDate(parcel.createdAt, locale))}</span>
        <span>{itemCount(items, locale)}</span>
        {parcel.live.length > 0 && <span>{t.parcel.total}: <Money value={total} locale={locale} /></span>}
      </p>
    </header>

    <div className="pf-parcel-grid">
      <div className="pf-parcel-main">
        {/* The stage and the one next step: an action when the buyer has one, else a calm line. */}
        <section className="cabinet-card pf-stage-card" aria-labelledby="pf-stage-title">
          {stage === undefined ? <p className="pf-calm muted">{t.parcel.cancelled}</p> : <>
            <p className="pf-eyebrow">{t.stage.of(stage + 1, names.length)}</p>
            <h2 id="pf-stage-title" className="pf-stage-title">{parcel.awaitingPayment && stage === 0 ? t.stage.awaitingPayment : names[stage]}</h2>
            {!delivered && stage + 1 < names.length && <p className="pf-stage-next">{t.stage.next(names[stage + 1])}</p>}
            <ParcelStageBar stage={stage} awaitingPayment={parcel.awaitingPayment} locale={locale} size="full" />
            {action ? <ul className="pf-actions pf-actions-inline"><ProfileActionCard action={action} locale={locale} stage={stage} /></ul>
              : <p className="pf-calm"><Check size={16} aria-hidden="true" />{delivered ? t.parcel.delivered : t.parcel.nothingToDo}</p>}
          </>}
        </section>

        <section className="cabinet-card pf-orders" aria-labelledby="pf-orders-title">
          <h2 id="pf-orders-title">{t.parcel.orders(parcel.orders.length)}</h2>
          {parcel.orders.length > 1 && stage !== undefined && stage <= 2 && <p className="cabinet-lead">{t.parcel.ordersHint}</p>}
          <ul className="pf-order-list">{parcel.orders.map((order) => <ParcelOrderRow key={order.id} order={order} locale={locale} busy={busy} run={run} />)}</ul>
        </section>
      </div>

      <aside className="pf-parcel-side">
        {delivery && <section className="cabinet-card pf-side-card" aria-labelledby="pf-recipient-title">
          <h2 id="pf-recipient-title"><MapPin size={18} aria-hidden="true" />{t.parcel.recipient}</h2>
          <p><b>{delivery.recipient}</b><br /><span className="nowrap">{delivery.phone}</span></p>
          <p className="cabinet-muted">{deliveryAddressLine(delivery)}</p>
        </section>}

        <section className="cabinet-card pf-side-card" aria-labelledby="pf-tracking-title">
          <h2 id="pf-tracking-title"><Truck size={18} aria-hidden="true" />{t.parcel.tracking}</h2>
          {tracked ? <dl className="pf-facts">
            <div><dt>{t.parcel.carrier}</dt><dd>{tracked.carrier}</dd></div>
            <div><dt>{t.parcel.trackingNumber}</dt><dd><span className="pf-mono">{tracked.trackingNumber}</span><CopyText text={tracked.trackingNumber} locale={locale} what="tracking" /></dd></div>
          </dl> : <p className="cabinet-muted">{t.parcel.noTracking}</p>}
          {events.length > 0 && <ol className="pf-events" aria-label={t.parcel.events}>{events.slice(0, 8).map((event) => <li key={`${event.at}-${event.status}-${event.location ?? ""}`}><time>{formatDateTime(event.at, locale)}</time><span>{parcelEventText(event.status, locale)}{event.location ? ` · ${parcelEventText(event.location, locale)}` : ""}</span></li>)}</ol>}
        </section>

        <section className="cabinet-card pf-side-card" aria-labelledby="pf-documents-title">
          <h2 id="pf-documents-title"><FileCheck2 size={18} aria-hidden="true" />{t.parcel.documents}</h2>
          <ul className="pf-doc-list">
            <li className={passport ? "ok" : "todo"}>
              <ScanLine size={16} aria-hidden="true" />
              <span>{passport ? t.parcel.passportOk(passport.passportMasked) : t.parcel.passportMissing}</span>
              {!passport && !delivered && <Link className="cabinet-text-btn" href={documentsPath(recipientProfile?.id)}>{t.parcel.addPassport}<ArrowRight size={14} aria-hidden="true" /></Link>}
            </li>
            {declarations.map((item) => <li key={item.id} className="ok"><FileCheck2 size={16} aria-hidden="true" /><span>{t.parcel.declaration(item.id)}</span></li>)}
          </ul>
          <Link className="cabinet-link" href="/account/documents">{t.parcel.allDocuments}<ArrowRight size={16} aria-hidden="true" /></Link>
        </section>

        <Link className="cabinet-link pf-support-link" href={`/account?order=${encodeURIComponent(parcel.id)}#support`}><LifeBuoy size={16} aria-hidden="true" />{t.parcel.support}<ArrowRight size={16} aria-hidden="true" /></Link>
      </aside>
    </div>
  </div>;
}

/** One order of the parcel: photo, name, variant, its own stage, its sum, the bill on "Мои заказы" and its claim. */
function ParcelOrderRow({ order, locale, busy, run }: { order: Order; locale: Locale; busy: boolean; run: (action: Action) => Promise<boolean> }) {
  const t = profileCopy[locale], gc = orderGroupCopy[locale];
  const names = localizedParcelStages(locale);
  const stageName = order.cancelled ? gc.stage.cancelled : order.payment?.status === "pending" ? t.stage.awaitingPayment : names[parcelStageOf(order)];
  const variant = readableVariant(order.variant, order.product.sourceOptions);
  return <li className="pf-order" data-cancelled={order.cancelled || undefined}>
    <span className="pf-order-photo" aria-hidden="true"><ProductImage product={order.product} decorative locale={locale} size={160} /></span>
    <div className="pf-order-body">
      <b className="pf-order-name">{order.product.name}</b>
      <small>{[variant, `× ${order.quantity}`, order.id].filter(Boolean).join(" · ")}</small>
      <span className="pf-order-stage" data-state={order.cancelled ? "muted" : parcelStageOf(order) >= deliveredStage ? "ok" : "info"}><span className="sr-only">{t.parcel.orderStage}: </span>{stageName}</span>
    </div>
    <div className="pf-order-side">
      <strong><Money value={orderCustomerTotal(order)} locale={locale} /></strong>
      <Link className="cabinet-text-btn" href={`/orders#${encodeURIComponent(order.id)}`}>{t.parcel.openOrder}<ArrowRight size={14} aria-hidden="true" /></Link>
    </div>
    {/* Claims are filed inside the order (owner, 1 November 2026): the same form as on "Мои заказы". */}
    {!order.cancelled && <div className="pf-order-claim"><CustomerParcelClaim order={order} locale={locale} busy={busy} run={run} /></div>}
  </li>;
}

