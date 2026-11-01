"use client";

import Link from "@/components/site-link";
import { AlertCircle, ArrowRight, Check, FileText, Wallet } from "lucide-react";
import { deliveredStage } from "@/lib/market/domain";
import { localizedParcelStages, type Locale } from "@/lib/market/i18n";
import { countryLabel, formatShortDate, itemCount } from "@/lib/market/customer-copy";
import { storeGroupName } from "@/lib/market/order-groups";
import { parcelPath, type BuyerParcel, type ProfileAction } from "@/lib/market/parcels";
import { profileCopy } from "@/lib/market/profile-copy";
import { formatSum } from "@/lib/market/format";
import { ProductImage } from "./market-ui";

/**
 * The eight stages of a parcel (GLOSSARY.md «Этап посылки», owner 1 November 2026). `mini`: eight segments and one line
 * under them (profile cards); `full`: every stage named — a column on a phone, a row on a wide screen (the parcel page).
 * Stages behind are filled, the current one is drawn as the step in progress; before the payment stage 1 reads
 * "Ждёт оплаты" instead of "Ожидает выкупа".
 */
export function ParcelStageBar({ stage, awaitingPayment = false, locale, size = "mini" }: { stage: number; awaitingPayment?: boolean; locale: Locale; size?: "mini" | "full" }) {
  const names = localizedParcelStages(locale), t = profileCopy[locale].stage;
  const done = stage >= deliveredStage;
  const state = (index: number) => index < stage || done ? "done" : index === stage ? "now" : "next";
  const label = (index: number) => awaitingPayment && index === 0 ? t.awaitingPayment : names[index];
  if (size === "mini") return <div className="pf-stage-mini">
    <div className="pf-stage-track" role="progressbar" aria-label={`${t.bar}: ${label(stage)}`} aria-valuemin={1} aria-valuemax={names.length} aria-valuenow={stage + 1}>
      {names.map((name, index) => <span key={name} data-state={state(index)} />)}
    </div>
    <p className="pf-stage-line"><span>{t.of(stage + 1, names.length)}</span><b>{label(stage)}</b></p>
  </div>;
  return <ol className="pf-stages" aria-label={t.bar}>
    {names.map((name, index) => <li key={name} data-state={state(index)} aria-current={index === stage && !done ? "step" : undefined}>
      <span className="pf-stage-dot" aria-hidden="true">{state(index) === "done" ? <Check size={13} strokeWidth={2.6} /> : index + 1}</span>
      <span className="pf-stage-name">{label(index)}</span>
    </li>)}
  </ol>;
}

const actionIcon = { extra: AlertCircle, change: AlertCircle, payment: Wallet, passport: FileText } as const;

/** "В пути" and on: the passport is no longer "before dispatch" but for the customs clearance (review, 1 November 2026). */
const transitFrom = 4;

/** One «Требует действия» card: what, why, one button. `stage`: the furthest stage of the parcels it is about. */
export function ProfileActionCard({ action, locale, stage }: { action: ProfileAction; locale: Locale; stage?: number }) {
  const t = profileCopy[locale].action, Icon = actionIcon[action.kind];
  const title = action.kind === "passport" && action.recipientName ? t.passportTitle(action.recipientName) : t[action.kind].title;
  const hint = action.kind === "payment" ? t.paymentHint(itemCount(action.items ?? 1, locale)) : action.kind === "passport" ? (stage !== undefined && stage >= transitFrom ? t.passportHintTransit : t.passportHint) : t.decisionHint(action.name);
  const button = action.kind === "payment" && action.amount !== undefined ? t.pay(formatSum(action.amount, locale)) : t[action.kind].button;
  return <li className="pf-action" data-kind={action.kind}>
    <span className="pf-action-icon" aria-hidden="true"><Icon size={20} /></span>
    <div className="pf-action-copy"><b>{title}</b><p>{hint}</p>{action.kind !== "passport" && <small>{action.orderId}</small>}</div>
    <Link className="btn primary pf-action-button" href={action.href}>{button}<ArrowRight size={16} aria-hidden="true" /></Link>
  </li>;
}

/** The title of a parcel: "Посылка из Nike (США)". */
export function parcelTitle(parcel: BuyerParcel, locale: Locale) {
  const store = storeGroupName(parcel.store, locale), country = parcel.store.country ? countryLabel(parcel.store.country, locale) : "";
  // A catalogue item without a store link is named by its brand, which may already name the country — in the stored
  // (Russian) words as well as in this language's.
  const name = country && !store.includes(country) && !store.includes(parcel.store.country) ? `${store} (${country})` : store;
  return name ? profileCopy[locale].parcel.title(name) : profileCopy[locale].parcel.fallbackTitle;
}

/**
 * An active parcel on the profile: photos, title, the stage bar and its one button (its action, or open the parcel).
 * `listed`: the passport this parcel waits for is already a card in «Требует действия» above — one recipient's passport
 * is shared by all their parcels, so the cards here open the parcel instead of repeating the primary button.
 */
export function ParcelCard({ parcel, action: found, locale, listed = false }: { parcel: BuyerParcel; action?: ProfileAction; locale: Locale; listed?: boolean }) {
  const action = found?.kind === "passport" && listed ? undefined : found;
  const t = profileCopy[locale];
  const items = parcel.live.reduce((sum, order) => sum + order.quantity, 0);
  const photos = parcel.live.slice(0, 3);
  const href = parcelPath(parcel.id);
  return <li className="pf-parcel">
    <div className="pf-parcel-top">
      <span className="pf-parcel-photos" aria-hidden="true">
        {photos.map((order) => <span key={order.id} className="pf-parcel-photo"><ProductImage product={order.product} decorative locale={locale} size={120} /></span>)}
        {parcel.live.length > photos.length && <span className="pf-parcel-photo pf-parcel-more">+{parcel.live.length - photos.length}</span>}
      </span>
      <div className="pf-parcel-head">
        <h3><Link href={href}>{parcelTitle(parcel, locale)}</Link></h3>
        <small>{[itemCount(items, locale), formatShortDate(parcel.createdAt, locale)].join(" · ")}</small>
      </div>
    </div>
    {parcel.stage !== undefined && <ParcelStageBar stage={parcel.stage} awaitingPayment={parcel.awaitingPayment} locale={locale} />}
    {action
      ? <Link className="btn primary pf-parcel-button" href={action.href}>{action.kind === "payment" && action.amount !== undefined ? t.action.pay(formatSum(action.amount, locale)) : t.action[action.kind].button}<ArrowRight size={16} aria-hidden="true" /></Link>
      : <Link className="btn secondary pf-parcel-button" href={href}>{t.hub.openParcel}<ArrowRight size={16} aria-hidden="true" /></Link>}
  </li>;
}
