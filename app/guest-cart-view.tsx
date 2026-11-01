"use client";
import Link from "@/components/site-link";
import { ArrowRight, ArrowUpRight, ClipboardPaste, Info, Minus, Plus, ShoppingBag, Store, TriangleAlert, X } from "lucide-react";
import { useMarket } from "@/lib/market/store";
import { estimateGuestCart, maxGuestQuantity, type GuestLine } from "@/lib/market/guest-cart";
import { storeParcelKey, type CartItem } from "@/lib/market/domain";
import { cartCopy, countryLabel, itemCount, parcelCount } from "@/lib/market/customer-copy";
import { checkoutCopy } from "@/lib/market/checkout-copy";
import { countryName } from "@/lib/market/world";
import { formatSum } from "@/lib/market/format";
import type { Locale } from "@/lib/market/i18n";
import { shownBrand } from "@/lib/importer/brand-name";
import { CalcLines, sumQuotes } from "./calc-summary";
import { ProductImage } from "./market-ui";
import { Money } from "./money";
import { SafeDeleteButton } from "./safe-delete-button";
import { shownVariant, storeName } from "./checkout-review";
import { useGuestCart } from "./use-guest-cart";

/** Where a line's product page is: its catalog card when it came from the catalog, else the link page with its store link. */
export function guestLineHref(line: Pick<GuestLine, "product" | "href">) {
  if (line.href) return line.href;
  const source = line.product.sourceUrl;
  return source ? `/order-by-link?url=${encodeURIComponent(source)}` : "/catalog";
}

/**
 * Lines that were in the browser cart before sign-in but the store refused when they moved into the account (redesign
 * stage 6): named with the reason, a link to the product page and «Убрать». Shown on the cart page.
 */
export function GuestProblems({ lines, locale, onDismiss }: { lines: GuestLine[]; locale: Locale; onDismiss: (key: string) => void }) {
  const t = checkoutCopy[locale].guest;
  if (!lines.length) return null;
  return <section className="guest-problems" aria-labelledby="guest-problems-title">
    <h2 id="guest-problems-title"><TriangleAlert size={16} aria-hidden="true" />{t.problemsTitle}</h2>
    <p>{t.problemsHint}</p>
    <ul>{lines.map((line) => <li key={line.key}>
      <span className="guest-problem-photo"><ProductImage product={line.product} locale={locale} decorative size={120} /></span>
      <span className="guest-problem-text"><b>{line.product.name}</b><small>{[shownVariant(line.variant, line.product.sourceOptions), t.problem(line.problem?.code)].filter(Boolean).join(" · ")}</small></span>
      <Link className="btn secondary" href={guestLineHref(line)}>{t.openItem}<span className="sr-only">: {line.product.name}</span></Link>
      <button type="button" className="icon-btn" aria-label={`${t.dismiss}: ${line.product.name}`} onClick={() => onDismiss(line.key)}><X size={16} aria-hidden="true" /></button>
    </li>)}</ul>
  </section>;
}

/**
 * The cart of a visitor who has not signed in (redesign stage 6): the browser's lines grouped into store parcels, priced
 * with the public tariff as an estimate, quantity and removal, and «Оформить» to the one-page checkout where sign-in
 * happens. The server prices everything again when the lines move into the account.
 */
export function GuestCartView() {
  const { state, pricing } = useMarket();
  const locale = state.communication.language;
  const c = cartCopy[locale], t = checkoutCopy[locale];
  const guest = useGuestCart();
  const items = estimateGuestCart(guest.cart, pricing);
  const problems = guest.cart.lines.filter((line) => line.problem);
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const sums = sumQuotes(items.map((item) => item.quote));
  const weight = Math.round(items.reduce((sum, item) => sum + item.quote.weight, 0) * 100) / 100;
  const parcels = items.reduce<{ key: string; title: string; country: string; items: CartItem[] }[]>((groups, item) => {
    const key = storeParcelKey(item);
    const group = groups.find((entry) => entry.key === key);
    if (group) group.items.push(item);
    else groups.push({ key, title: c.item.parcelFrom(storeName(item, locale)), country: countryLabel(countryName(item.product), locale), items: [item] });
    return groups;
  }, []);

  if (!items.length) return <div className="basket-page">
    <header className="basket-head"><h1>{c.title}</h1></header>
    <GuestProblems lines={problems} locale={locale} onDismiss={(key) => guest.remove([key])} />
    <section className="basket-empty"><span className="basket-empty-icon" aria-hidden="true"><ShoppingBag size={28} /></span><h2>{c.empty.title}</h2><p>{c.empty.text}</p>
      <div className="basket-empty-actions"><Link className="btn primary" href="/catalog">{t.checkout.emptyAction}<ArrowRight size={18} aria-hidden="true" /></Link><Link className="btn secondary" href="/order-by-link"><ClipboardPaste size={18} aria-hidden="true" />{c.empty.paste}</Link></div>
    </section>
  </div>;

  return <div className="basket-page has-sticky guest-cart">
    <header className="basket-head"><h1>{c.title}</h1><p>{itemCount(units, locale)} · {parcelCount(parcels.length, locale)}</p></header>
    <div className="basket-layout">
      <div className="basket-parcels">
        <GuestProblems lines={problems} locale={locale} onDismiss={(key) => guest.remove([key])} />
        {parcels.map((parcel) => <section className="basket-parcel" key={parcel.key} aria-label={parcel.title}>
          <h2 className="basket-parcel-title"><Store size={16} aria-hidden="true" /><span>{parcel.title}</span><small>{parcel.country}</small></h2>
          {parcel.items.map((item) => {
            const name = [item.product.name, shownVariant(item.variant, item.product.sourceOptions)].filter(Boolean).join(" · ");
            return <article className="basket-item" key={item.id}>
              <div className="basket-photo"><ProductImage product={item.product} locale={locale} decorative size={240} /></div>
              <div className="basket-info">
                {shownBrand(item.product.brand) && <p className="basket-brand">{shownBrand(item.product.brand)}</p>}
                <h3 className="basket-name">{item.product.name}</h3>
                {shownVariant(item.variant, item.product.sourceOptions) && <p className="basket-meta">{shownVariant(item.variant, item.product.sourceOptions)}</p>}
                {item.product.sourceUrl && <p className="basket-meta"><a className="basket-source" href={item.product.sourceUrl} target="_blank" rel="noopener noreferrer">{c.item.openStore}<ArrowUpRight size={14} aria-hidden="true" /></a></p>}
              </div>
              <div className="basket-price"><strong>≈ {formatSum(item.quote.total, locale)}</strong>{item.quantity > 1 && <small>{c.item.forQuantity(item.quantity)}</small>}</div>
              <div className="basket-controls">
                <div className="basket-qty" role="group" aria-label={`${c.item.quantity}: ${name}`}>
                  <button type="button" aria-label={`${c.item.decrease}: ${name}`} disabled={item.quantity <= 1} onClick={() => guest.setQuantity(item.id, item.quantity - 1)}><Minus size={16} aria-hidden="true" /></button>
                  <output aria-live="polite">{item.quantity}</output>
                  <button type="button" aria-label={`${c.item.increase}: ${name}`} disabled={item.quantity >= maxGuestQuantity} onClick={() => guest.setQuantity(item.id, item.quantity + 1)}><Plus size={16} aria-hidden="true" /></button>
                </div>
                <SafeDeleteButton label={c.item.remove} itemName={item.product.name} locale={locale} instant onConfirm={async () => guest.remove([item.id])} />
              </div>
            </article>;
          })}
        </section>)}
        <div className="basket-continue-row">
          <Link className="basket-continue" href="/catalog">{c.summary.continue}<ArrowRight size={16} aria-hidden="true" /></Link>
          <Link className="basket-continue" href="/order-by-link"><ClipboardPaste size={16} aria-hidden="true" />{c.summary.addByLink}</Link>
        </div>
      </div>
      <aside className="basket-summary folio" aria-labelledby="guest-summary-title">
        <div className="folio-sheet">
          <h2 id="guest-summary-title">{c.summary.title}</h2>
          <CalcLines sums={sums} locale={locale} pricing={pricing} weightKg={weight} storeShippingState="none" speed="standard" />
          <div className="basket-total bill-total"><span>{c.summary.payable}</span><strong>≈ <Money value={sums.total} locale={locale} /></strong></div>
          <p className="guest-estimate"><Info size={16} aria-hidden="true" />{t.guest.estimate}</p>
          <Link className="btn primary basket-cta" href="/cart/checkout">{t.guest.checkout}<ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </aside>
    </div>
    <div className="basket-sticky" role="region" aria-label={c.sticky.label}>
      <div><span>{c.summary.payable}</span><strong>≈ {formatSum(sums.total, locale)}</strong></div>
      <Link className="btn primary" href="/cart/checkout">{t.guest.checkout}<ArrowRight size={18} aria-hidden="true" /></Link>
    </div>
  </div>;
}
