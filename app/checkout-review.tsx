import type { ReactNode } from "react";
import { Check, Info, TriangleAlert } from "lucide-react";
import { cartModelKey, serviceTitle, storeParcels, parcelServiceUnits, type CartItem, type Pricing } from "@/lib/market/domain";
import { cartSelectCopy } from "@/lib/market/cart-select-copy";
import { calcCopy } from "@/lib/market/calc-copy";
import { countryLabel } from "@/lib/market/customer-copy";
import { countryName } from "@/lib/market/world";
import { formatSum } from "@/lib/market/format";
import { storefrontLabel } from "@/lib/market/store-brands";
import type { Locale } from "@/lib/market/i18n";
import { ProductImage } from "./market-ui";

/** One product (sizes or colors of the same store item) is one link with one name. */
export const productKey = cartModelKey;
export function productGroups(items: CartItem[]) {
  const groups: CartItem[][] = [];
  for (const item of items) {
    const group = groups.find(entry => productKey(entry[0].product) === productKey(item.product));
    if (group) group.push(item);
    else groups.push([item]);
  }
  return groups;
}
export function storeHost(item: Pick<CartItem, "product">) {
  try { return item.product.sourceUrl ? new URL(item.product.sourceUrl).hostname.replace(/^www\./, "") : ""; } catch { return ""; }
}
/** The store's name as the customer knows it (Nike, Zara), or the brand for a line without a link. */
export const storeName = (item: Pick<CartItem, "product">, locale: Locale) => { const host = storeHost(item); return (host && storefrontLabel(host, locale)) || item.product.brand || host; };
/** The importer's name for the only option of a product is not worth showing. */
export const shownVariant = (variant?: string) => variant && variant !== "Выбранный вариант" ? variant : "";

/**
 * The order on the confirmation step as a compact table (owner, 7.10.2026): numbered lines grouped by store parcel and
 * model, columns Item · Option · Qty · Amount (no per-piece column: the line total includes fees and delivery, so a
 * "price" made from it would not match the store price in the cart); a changed price or a store problem is shown on its own line.
 * The parcel's services sit under it; each option's own note sits under its line. On a phone the columns fold into one card per line.
 */
export function CheckoutReviewTable({ lines, locale, pricing, onLeaveForLater, busy }: {
  lines: CartItem[]; locale: Locale; pricing: Pricing;
  /** Takes a line out of this checkout; it stays in the cart. Hidden when it is the only line. */
  onLeaveForLater?: (id: string) => void; busy?: boolean;
}) {
  const s = cartSelectCopy[locale], r = s.review;
  // Numbered in the order shown: parcel by parcel, model by model.
  const numbers = new Map(storeParcels(lines).flatMap(parcel => productGroups(parcel.items).flat()).map((item, index) => [item.id, index + 1]));
  return <div className="review-table" role="table" aria-label={r.checks}>
    <div className="review-row review-head" role="row">
      <span role="columnheader" className="review-n">№</span>
      <span role="columnheader">{r.columns.item}</span>
      <span role="columnheader">{r.columns.variant}</span>
      <span role="columnheader" className="review-num">{r.columns.quantity}</span>
      <span role="columnheader" className="review-num">{r.columns.sum}</span>
    </div>
    {storeParcels(lines).map(parcel => {
      const lead = parcel.items[0];
      // A catalog line has no store link: its brand label may already name the country.
      const name = storeName(lead, locale), country = countryLabel(countryName(lead.product), locale);
      const services = pricing.serviceCatalog.filter(service => parcel.items.some(line => line.requestedServiceIds?.includes(service.id)));
      return <div className="review-parcel" role="rowgroup" key={parcel.key}>
        <div className="review-parcel-title" role="row"><span role="cell">{country && !name.includes(country) ? r.parcel(name, country) : name}</span></div>
        {productGroups(parcel.items).map(group => {
          return <div className="review-model" key={group[0].id}>
            {group.map((item, index) => {
              const issue = item.sourceIssue && item.sourceIssue.kind !== "unreachable";
              return <div className={"review-row" + (issue ? " has-issue" : item.priceChange ? " has-change" : "")} role="row" key={item.id}>
                <span role="cell" className="review-n">{numbers.get(item.id)}</span>
                <span role="cell" className="review-item">
                  {index === 0 ? <><span className="review-photo"><ProductImage product={item.product} locale={locale} decorative /></span><span className="review-name">{item.product.name}</span></>
                    : <span className="sr-only">{item.product.name}</span>}
                </span>
                <span role="cell" className="review-variant">{shownVariant(item.variant) || "—"}</span>
                <span role="cell" className="review-num" data-label={r.columns.quantity}>{item.quantity}</span>
                <span role="cell" className="review-num review-sum" data-label={r.columns.sum}>{formatSum(item.quote.total, locale)}</span>
                {(issue || item.priceChange || (onLeaveForLater && lines.length > 1)) && <span className="review-row-extra" role="cell">
                  {issue ? <span className="review-flag issue" role="alert"><TriangleAlert size={14} aria-hidden="true" />{r.lineIssue}</span>
                    : item.priceChange ? <span className="review-flag change" role="status"><Info size={14} aria-hidden="true" />{r.lineChanged}</span> : null}
                  {onLeaveForLater && lines.length > 1 && <button type="button" className="text-button review-later" disabled={busy} onClick={() => onLeaveForLater(item.id)}>{s.leaveForLater}</button>}
                </span>}
                {item.note?.trim() && <span className="review-row-note" role="cell"><b>{r.note}:</b> {item.note.trim()}</span>}
              </div>;
            })}
          </div>;
        })}
        {services.length > 0 && <p className="review-services" role="row"><span role="cell"><b>{r.services_}:</b> {services.map(service => {
          const units = parcelServiceUnits(service, parcel.items.filter(line => line.requestedServiceIds?.includes(service.id)));
          const unit = service.unit === "package" ? s.unitPackage : service.unit === "item" ? s.unitItem(units) : service.unit === "photo" ? s.unitPhoto(units) : `× ${units}`;
          return `${serviceTitle(service, locale)} (${unit})`;
        }).join(" · ")}</span></p>}
      </div>;
    })}
  </div>;
}

/**
 * The review's confirm button with the amount beside it. On a phone (app/cart-select.css, <= 720px) the bar stays at the
 * bottom of the dialog over the whole review, so "Confirm" never needs a scroll (owner, 10.10.2026); on a wide screen the
 * amount stays hidden (the payment preview above already shows it) and the button is the plain full-width one.
 * `children` is the existing submit button: the bar adds no handler of its own.
 */
export function ReviewConfirmBar({ amount, locale, children }: { amount: number; locale: Locale; children: ReactNode }) {
  return <div className="review-confirm-bar">
    <span className="review-confirm-amount"><small>{calcCopy[locale].lines.total}</small><b>{formatSum(amount, locale)}</b></span>
    {children}
  </div>;
}

/** The things the owner wants checked before the order is placed, each with a way back to change it. */
export function CheckoutChecklist({ locale, items }: { locale: Locale; items: { key: string; label: string; value: ReactNode; ok?: boolean; onChange?: () => void }[] }) {
  const r = cartSelectCopy[locale].review;
  return <section className="review-checklist" aria-label={r.checks}>
    <h3>{r.checks}</h3>
    <ol>{items.map(item => <li key={item.key} data-ok={item.ok === false ? "no" : "yes"}>
      <span className="review-check-mark" aria-hidden="true">{item.ok === false ? <TriangleAlert size={14} /> : <Check size={14} />}</span>
      <span className="review-check-body"><span>{item.label}</span><b>{item.value}</b></span>
      {item.onChange && <button type="button" className="text-button" onClick={item.onChange}>{r.change}</button>}
    </li>)}</ol>
  </section>;
}
