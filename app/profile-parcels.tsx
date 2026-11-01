"use client";

import Link from "@/components/site-link";
import { ArrowRight, Check } from "lucide-react";
import { deliveredStage, type Order } from "@/lib/market/domain";
import { localizedParcelStages, type Locale } from "@/lib/market/i18n";
import { countryLabel, formatShortDate, itemCount } from "@/lib/market/customer-copy";
import { storeGroupName } from "@/lib/market/order-groups";
import { parcelPath, type BuyerParcel, type ProfileAction } from "@/lib/market/parcels";
import { profileCopy } from "@/lib/market/profile-copy";
import { formatSum } from "@/lib/market/format";
import { ProductImage } from "./market-ui";
import { stepOfAction } from "@/lib/market/next-step";
import { ActionCard } from "./action-card";

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
      <span className="pf-stage-dot" aria-hidden="true">{state(index) === "done" ? <Check size={14} strokeWidth={2.6} /> : index + 1}</span>
      <span className="pf-stage-name">{label(index)}</span>
    </li>)}
  </ol>;
}

/** One «Требует действия» card (1 November 2026): the same card as the home hero's (app/action-card.tsx) — what is needed
 *  in plain words, the product's photo and name, the order number small and grey, one button. */
export function ProfileActionCard({ action, locale, orders }: { action: ProfileAction; locale: Locale; orders: readonly Order[] }) {
  return <ActionCard as="li" step={stepOfAction(action, orders)} locale={locale} />;
}

/** The title of a parcel: "Посылка из Nike (США)". */
export function parcelTitle(parcel: BuyerParcel, locale: Locale) {
  const store = storeGroupName(parcel.store, locale), country = parcel.store.country ? countryLabel(parcel.store.country, locale) : "";
  // A catalogue item without a store link is named by its brand, which may already name the country — in the stored
  // (Russian) words as well as in this language's.
  const name = country && !store.includes(country) && !store.includes(parcel.store.country) ? `${store} (${country})` : store;
  // «Аудио · Европа»: the dot is glued to both words, so a wrapped title never ends on «·» or starts with it.
  return name ? profileCopy[locale].parcel.title(name.replace(/ · /g, "\u00a0·\u00a0")) : profileCopy[locale].parcel.fallbackTitle;
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
