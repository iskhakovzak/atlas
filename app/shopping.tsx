"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/site-link";
import { ArrowRight, ArrowUpRight, BadgeCheck, Check, ClipboardPaste, Clock3, Info, Loader2, MessageSquare, Minus, Plus, ShoppingBag, Store, TriangleAlert, Truck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMarket } from "@/lib/market/store";
import { balanceOf, cartSignature, isPostalCode, maxLineQuantity, storeDiscount, merchantParcelKey, storeShippingReserves, totalOf, serviceTitle, serviceDescription, serviceFeeForCountry, type CartItem, type DeliveryProfile } from "@/lib/market/domain";
import { countryName, customsVersion } from "@/lib/market/world";
import { formatSum } from "@/lib/market/home-copy";
import { cartCopy, countryLabel, itemCount, minutesLeft, parcelCount, recipientCopy, type CartCopy } from "@/lib/market/customer-copy";
import { cartCustomsEstimate } from "@/lib/market/allowance";
import { calcCopy } from "@/lib/market/calc-copy";
import { CalcLines, CustomsPanel, HoldNote, sumQuotes } from "./calc-summary";
import { storefrontLabel } from "@/lib/market/store-brands";
import type { Locale } from "@/lib/market/i18n";
import { Modal, ProductImage, WasPrice } from "./market-ui";
import { Money } from "./money";
import { SafeDeleteButton } from "./safe-delete-button";
import { cities, regionCapital, regionLabel, regions, streets, suggestions, uzPhone, uzPhoneDigits } from "@/lib/market/addresses";
import { UzPhoneInput } from "./phone-input";

const emptyDelivery: DeliveryProfile = { recipient: "", phone: "", region: "Ташкент", city: "Ташкент", address: "", postalCode: "", comment: "" };

function storeHost(item: CartItem) {
  try { return item.product.sourceUrl ? new URL(item.product.sourceUrl).hostname.replace(/^www\./, "") : ""; } catch { return ""; }
}

/** An amount in the store's currency, e.g. "$29.99" or "129,90 RON". */
function sourceMoney(amount: number, currency: string, locale: Locale) {
  try { return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${amount} ${currency}`; }
}
/** Store price as the shop shows it. */
const storePrice = (item: CartItem, locale: Locale) => sourceMoney(item.product.sourcePrice ?? item.product.usd, item.product.sourceCurrency ?? "USD", locale);
const clock = (at: number, locale: Locale) => new Date(at).toLocaleTimeString(locale === "ru" ? "ru-RU" : locale === "uz" ? "uz-UZ" : "en-US", { hour: "2-digit", minute: "2-digit" });
/** Refusals that repriced or marked the cart: the dialog closes so the customer sees what changed. */
const cartChangedCodes = new Set(["err_35", "err_36", "err_37", "err_38"]);

/**
 * Quantity stepper that waits for a pause (400 ms) before saving, so quick taps add up to one request
 * instead of being dropped while the previous one is still saving. Remounted (by key) on a server change.
 */
function QuantityControl({ item, c, save }: { item: CartItem; c: CartCopy; save: (quantity: number) => Promise<boolean> }) {
  const [value, setValue] = useState(item.quantity);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // Never more than the store reports left (when it reports a count at all).
  const max = Math.max(1, maxLineQuantity(item.product));
  function step(delta: number) {
    const next = Math.min(max, Math.max(1, value + delta));
    if (next === value) return;
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(next).then((ok) => { if (!ok) setValue(item.quantity); }); }, 400);
  }
  return <div className="basket-qty" role="group" aria-label={`${c.item.quantity}: ${item.product.name}`}>
    <button type="button" aria-label={`${c.item.decrease}: ${item.product.name}`} disabled={value <= 1} onClick={() => step(-1)}><Minus size={16} aria-hidden="true" /></button>
    <output aria-live="polite">{value}</output>
    <button type="button" aria-label={`${c.item.increase}: ${item.product.name}`} disabled={value >= max} onClick={() => step(1)}><Plus size={16} aria-hidden="true" /></button>
  </div>;
}

/** The customer's note on a cart line: shown when set, edited in place, saved on blur; never sent to the store. */
function ItemNote({ item, locale, save }: { item: CartItem; locale: Locale; save: (note: string) => Promise<boolean> }) {
  const k = calcCopy[locale];
  const [open, setOpen] = useState(Boolean(item.note));
  const [text, setText] = useState(item.note ?? "");
  if (!open) return <button type="button" className="basket-note-add" onClick={() => setOpen(true)}><MessageSquare size={15} aria-hidden="true" />{k.blocks.comment}</button>;
  return <div className="basket-note">
    <label htmlFor={`note-${item.id}`}>{k.blocks.comment}<small> · {k.commentHint}</small></label>
    <textarea id={`note-${item.id}`} rows={2} maxLength={500} value={text} placeholder={k.commentPlaceholder} onChange={(event) => setText(event.target.value)}
      onBlur={() => { if (text.trim() !== (item.note ?? "")) void save(text); if (!text.trim()) setOpen(false); }} />
  </div>;
}

/** "Price held for N min", ticking on its own so the rest of the cart does not re-render every 15 s. */
function PriceHold({ expiresAt, locale, c }: { expiresAt: number; locale: Locale; c: CartCopy }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0), timer = setInterval(tick, 15000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  // After the hold the total is not lost: "Check out" checks the stores and reprices first.
  const expired = now > 0 && now >= expiresAt;
  return <p className="basket-expiry"><Clock3 size={15} aria-hidden="true" />{expired ? c.summary.recheckNote : now ? c.summary.validFor(minutesLeft(expiresAt - now, locale)) : c.summary.checking}</p>;
}

function usd(amount: number, locale: Locale) {
  const rounded = Math.ceil(amount * 100 - 1e-6) / 100;
  const digits = Number.isInteger(rounded) ? 0 : 2;
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(rounded);
}

/** The importer's name for the only option of a product: not worth showing to the customer. */
const shownVariant = (variant?: string) => variant && variant !== "Выбранный вариант" ? variant : "";

/** Long store titles are cut to three lines; a tap shows the whole name. */
function ItemName({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  return <h3 className={"basket-name" + (open ? " open" : "")}>{name.length > 70
    ? <button type="button" className="basket-name-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>{name}</button>
    : name}</h3>;
}

/** Checkout progress shared by the cart page and the checkout dialog. */
function CheckoutSteps({ current, c }: { current: number; c: CartCopy }) {
  return <ol className="basket-steps" aria-label={c.stepsLabel}>{c.steps.map((step, index) =>
    <li key={step} data-state={index < current ? "done" : index === current ? "current" : "next"} aria-current={index === current ? "step" : undefined}>
      <span aria-hidden="true">{index < current ? <Check size={13} /> : index + 1}</span>{step}
    </li>)}</ol>;
}

export function CartView() {
  const { state, act, lastActionError, ready, error, user, pricing } = useMarket();
  const [useBalance, setUseBalance] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [review, setReview] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryProfile>(emptyDelivery);
  const [selectedProfile, setSelectedProfile] = useState("");
  // Recipients saved before postal codes were required may have none: checkout asks for it once.
  const savedRecipient = state.deliveryProfiles.find(profile => profile.id === selectedProfile);
  const savedNeedsPostal = Boolean(savedRecipient && !isPostalCode(savedRecipient.postalCode));
  const [busy, setBusy] = useState(false);
  const [saveRecipient, setSaveRecipient] = useState(true);
  const [savingServiceItemId, setSavingServiceItemId] = useState<string | null>(null);
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null);
  // The checkout that was just placed: the page moves on to its order as soon as the orders arrive.
  const [placedKey, setPlacedKey] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [summaryCta, setSummaryCta] = useState<HTMLButtonElement | null>(null);
  const [customsRecipient, setCustomsRecipient] = useState("");
  const [customsBusy, setCustomsBusy] = useState(false);
  const [summaryCtaInView, setSummaryCtaInView] = useState(false);

  // The phone bar repeats the total and the button; it steps aside while the summary's own button is on screen.
  useEffect(() => {
    if (!summaryCta || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setSummaryCtaInView(entry.isIntersecting), { rootMargin: "0px 0px -150px 0px" });
    observer.observe(summaryCta);
    return () => observer.disconnect();
  }, [summaryCta]);

  // Keeps cart services in line with the catalog (a service switched off or made required). It used to fire a
  // request per item on every cart change; a request in flight then made the customer's own tap on a service do
  // nothing. Now: one line at a time, never while the customer is saving, and never the same fix twice.
  const normalizationSent = useRef("");
  useEffect(() => {
    if (!ready || savingServiceItemId !== null) return;
    const available = pricing.serviceCatalog.filter((service) => service.enabled && service.requestStage === "checkout");
    const allowedIds = new Set(available.map((service) => service.id));
    for (const item of state.cart) {
      const selected = item.requestedServiceIds ?? [];
      const current = selected.filter((serviceId) => allowedIds.has(serviceId));
      const missingRequired = available.filter((service) => service.required && !current.includes(service.id)).map((service) => service.id);
      const normalized = [...current, ...missingRequired];
      const normalizedUnits = Object.fromEntries(Object.entries(item.requestedServiceUnits ?? {}).filter(([serviceId]) => normalized.includes(serviceId) && available.some((service) => service.id === serviceId && !["package", "item"].includes(service.unit))));
      const differs = normalized.length !== selected.length || normalized.some((serviceId, index) => serviceId !== selected[index]) || JSON.stringify(normalizedUnits) !== JSON.stringify(item.requestedServiceUnits ?? {});
      const fix = `${item.id}:${normalized.join(",")}:${JSON.stringify(normalizedUnits)}`;
      if (!differs || normalizationSent.current === fix) continue;
      normalizationSent.current = fix;
      void act({ type: "cart-services", id: item.id, serviceIds: normalized, serviceUnits: normalizedUnits });
      return;
    }
  }, [act, pricing.serviceCatalog, ready, state.cart, savingServiceItemId]);

  const locale = state.communication.language;
  const c = cartCopy[locale];
  const k = calcCopy[locale];
  const earliestExpiry = state.cart.reduce((min, item) => Math.min(min, item.quote.expiresAt), Infinity);
  const total = totalOf(state.cart);
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  // Customs: the allowance is per recipient and calendar month; the customer picks whose it is.
  const primaryProfile = state.deliveryProfiles.find(profile => profile.primary) ?? state.deliveryProfiles[0];
  const customsProfile = state.deliveryProfiles.find(profile => profile.id === customsRecipient) ?? primaryProfile;
  const customsChoices = state.cartCustoms ?? { outsideUsed: false, help: false };
  const customs = cartCustomsEstimate(state, pricing, { profile: customsProfile, name: customsProfile ? undefined : state.deliveryProfile?.recipient }, customsChoices);
  const balance = balanceOf(state);
  const credit = useBalance ? Math.min(total, Math.max(0, balance)) : 0;
  const payable = total - credit;
  // "Atlas pays customs for me": the same per-line rounding as the server; once chosen, the fee is in the bill.
  const customsHelpAmount = customsChoices.help
    ? state.cart.reduce((sum, item) => sum + (item.quote.customsHelp ?? 0), 0)
    : state.cart.reduce((sum, item) => sum + Math.round(item.quote.total * pricing.customsHelpFee), 0);
  const checkoutServices = pricing.serviceCatalog.filter((service) => service.enabled && service.requestStage === "checkout");
  const identityProfiles = state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);
  const sums = sumQuotes(state.cart.map(item => item.quote));
  const cartWeight = Math.round(state.cart.reduce((sum, item) => sum + item.quote.weight, 0) * 100) / 100;
  // Store orders whose delivery price is unknown: a separate hold up to the threshold, free above it.
  const reserves = storeShippingReserves(state.cart, pricing);
  const freeFrom = usd(pricing.storeShippingFreeFromUsd ?? 50, locale);
  // Same grouping as the server's parcel allocation: one store and one origin country share a parcel.
  const parcels = state.cart.reduce<{ key: string; title: string; country: string; items: CartItem[] }[]>((groups, item) => {
    const key = merchantParcelKey(item);
    const group = groups.find(entry => entry.key === key);
    if (group) group.items.push(item);
    else { const host = storeHost(item); groups.push({ key, title: c.item.parcelFrom((host && storefrontLabel(host, locale)) || item.product.brand), country: countryLabel(countryName(item.product), locale), items: [item] }); }
    return groups;
  }, []);

  async function openCheckout() {
    if (verifying) return;
    // The server checks prices with the stores and reprices at the current tariff; a change keeps the
    // customer in the cart with the new total and a note on the item instead of opening the form.
    setVerifying(true);
    const ok = await act({ type: "cart-check" });
    setVerifying(false);
    if (!ok) return;
    const saved = state.deliveryProfiles.find(profile => profile.primary) ?? state.deliveryProfiles[0];
    setSelectedProfile(saved?.id ?? "manual");
    setDelivery(saved ?? state.deliveryProfile ?? { ...emptyDelivery, recipient: user?.name ?? "", phone: state.communication.phone });
    setConsentError(false);
    setCheckoutOpen(true);
    setReview(false);
  }

  async function checkout() {
    if (busy) return;
    setBusy(true);
    const selectedIdentity = selectedProfile === "manual" ? undefined : identityProfiles.find(profile => profile.recipientProfileId === selectedProfile);
    const savedPostal = savedNeedsPostal ? delivery.postalCode : undefined;
    const key = crypto.randomUUID();
    const ok = await act({ type: "checkout", key, signature: cartSignature(state.cart), useBalance, expectedCredit: credit, consentVersion: customsVersion, delivery, deliveryProfileId: selectedProfile === "manual" ? undefined : selectedProfile, identityProfileId: selectedIdentity?.documentId, postalCode: savedPostal,
      // A recipient typed here is kept for the next order and the passport, unless the customer opts out.
      saveRecipientLabel: selectedProfile === "manual" && saveRecipient ? (state.deliveryProfiles.length ? delivery.recipient.trim().slice(0, 60) : recipientCopy[locale].labels.home) : undefined });
    setBusy(false);
    if (ok) { setCheckoutOpen(false); setPlacedKey(key); }
    else if (cartChangedCodes.has(lastActionError()?.code ?? "")) setCheckoutOpen(false);
  }

  // After checkout the customer goes straight to the new order in My orders, where it waits for payment. When a
  // payment provider is connected, its payment page goes in between; until then nothing is charged.
  useEffect(() => {
    if (!placedKey) return;
    const placed = state.orders.find(order => order.batchId === placedKey);
    if (placed) { window.location.assign("/orders#" + encodeURIComponent(placed.id)); return; }
    // The orders normally arrive with the checkout answer; if not, My orders loads them itself.
    const fallback = window.setTimeout(() => window.location.assign("/orders"), 3000);
    return () => window.clearTimeout(fallback);
  }, [placedKey, state.orders]);

  function renderItem(item: CartItem) {
    const selectedServices = item.requestedServiceIds ?? [];
    const serviceUnits = item.requestedServiceUnits ?? {};
    const meta = [shownVariant(item.variant), countryLabel(countryName(item.product), locale)].filter(Boolean).join(" · ");
    const change = item.priceChange, issue = item.sourceIssue, currency = change?.currency ?? item.product.sourceCurrency ?? "USD";
    const reopen = item.product.sourceUrl ? `/order-by-link?url=${encodeURIComponent(item.product.sourceUrl)}` : "";
    return <article className={"basket-item" + (issue && issue.kind !== "unreachable" ? " has-issue" : "")} key={item.id}>
      <div className="basket-photo"><ProductImage product={item.product} locale={locale} decorative /></div>
      <div className="basket-info">
        {item.product.brand && <p className="basket-brand">{item.product.brand}</p>}
        <ItemName name={item.product.name} />
        <p className="basket-meta">{meta}</p>
        <p className="basket-meta">{item.product.sourceUrl ? <a className="basket-source" href={item.product.sourceUrl} target="_blank" rel="noopener noreferrer">{c.item.storePrice}: {storePrice(item, locale)}<ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> ({c.item.openStore})</span></a> : <>{c.item.storePrice}: {storePrice(item, locale)}</>}{item.quantity > 1 ? ` × ${item.quantity}` : ""}{(() => { const off = storeDiscount(item.product); return off && <WasPrice was={off.was} percent={off.percent} format={value => sourceMoney(value, item.product.sourceCurrency ?? "USD", locale)} />; })()}</p>
        {!change && !issue && item.product.sourceCheckedAt && <p className="basket-meta basket-checked"><BadgeCheck size={14} aria-hidden="true" />{c.item.checked(clock(item.product.sourceCheckedAt, locale))}</p>}
        {item.product.stockQuantity !== undefined
          ? <p className={"basket-meta basket-stock" + (item.product.stockQuantity <= 3 ? " low" : "")}>{item.product.stockQuantity ? k.stockLeft(item.product.stockQuantity) : k.outOfStock} · {k.stockByEbay}</p>
          : item.product.stockMoreThan !== undefined && <p className="basket-meta basket-stock">{k.stockMore(item.product.stockMoreThan)} · {k.stockByEbay}</p>}
      </div>
      <div className="basket-price"><strong>{formatSum(item.quote.total, locale)}</strong>{item.quantity > 1 && <small>{c.item.forQuantity(item.quantity)}</small>}</div>
      {/* What the last check with the store found: a new price (already in the total) or something to fix. */}
      {change && <p className={"basket-item-note " + (change.price > change.previousPrice || (change.shipping ?? 0) > (change.previousShipping ?? 0) ? "up" : "down")} role="status">
        <Info size={16} aria-hidden="true" /><span>
          {change.price !== change.previousPrice && (change.price > change.previousPrice ? c.item.priceUp : c.item.priceDown)(sourceMoney(change.previousPrice, currency, locale), sourceMoney(change.price, currency, locale))}
          {change.shipping !== undefined && change.shipping !== change.previousShipping && <> {c.item.shippingChanged(sourceMoney(change.previousShipping ?? 0, item.product.sourceShippingCurrency ?? currency, locale), sourceMoney(change.shipping, item.product.sourceShippingCurrency ?? currency, locale))}</>}
        </span></p>}
      {issue && <p className={"basket-item-note " + (issue.kind === "unreachable" ? "soft" : "issue")} role={issue.kind === "unreachable" ? "status" : "alert"}>
        <TriangleAlert size={16} aria-hidden="true" /><span>{c.item.issues[issue.kind]}{issue.kind !== "unreachable" && reopen && <> <Link href={reopen}>{c.item.reload}</Link></>}</span></p>}
      <div className="basket-controls">
        <QuantityControl key={`${item.id}:${item.quantity}`} item={item} c={c} save={(quantity) => act({ type: "cart-quantity", id: item.id, quantity })} />
        <SafeDeleteButton label={c.item.remove} itemName={item.product.name} locale={locale} onConfirm={() => act({ type: "cart-remove", id: item.id })} />
      </div>
      <ItemNote key={`${item.id}:${item.note ?? ""}`} item={item} locale={locale} save={(note) => act({ type: "cart-note", id: item.id, note })} />
      {checkoutServices.length > 0 && <details className="basket-services">
        <summary><span>{c.services.title}<small>{c.services.optional}</small></span>{selectedServices.length > 0 && <b>{selectedServices.length}</b>}</summary>
        <p>{c.services.hint}</p>
        <div className="basket-service-list">{checkoutServices.map((service) => {
          const checked = selectedServices.includes(service.id) || service.required;
          const units = service.unit === "package" ? 1 : service.unit === "item" ? item.quantity : serviceUnits[service.id] ?? 1;
          const unitFee = serviceFeeForCountry(service, item.product.country);
          const amount = unitFee * units;
          const serviceUnitsNext = { ...serviceUnits };
          const updateService = async (selected: boolean, nextUnits = units) => {
            if (savingServiceItemId !== null) return;
            const next = selected ? [...new Set([...selectedServices, service.id])] : selectedServices.filter((id) => id !== service.id);
            if (["package", "item"].includes(service.unit)) delete serviceUnitsNext[service.id];
            else if (selected) serviceUnitsNext[service.id] = nextUnits;
            else delete serviceUnitsNext[service.id];
            setSavingServiceItemId(item.id);
            setSavingServiceId(service.id);
            try { await act({ type: "cart-services", id: item.id, serviceIds: next, serviceUnits: serviceUnitsNext }); }
            finally { setSavingServiceItemId(null); setSavingServiceId(null); }
          };
          const unitName = c.services.units[service.unit];
          const saving = savingServiceItemId === item.id && savingServiceId === service.id;
          return <div className="basket-service" key={service.id} aria-busy={saving || undefined}>
            <Checkbox aria-label={serviceTitle(service, locale)} checked={checked} disabled={service.required || savingServiceItemId !== null} onCheckedChange={(value) => void updateService(value === true)} />
            <span className="basket-service-copy"><b>{serviceTitle(service, locale)}{service.required && <em>{c.services.required}</em>}{saving && <span className="basket-service-saving" role="status"><Loader2 size={13} className="spin" aria-hidden="true" />{locale === "ru" ? "Сохраняем…" : locale === "uz" ? "Saqlanmoqda…" : "Saving…"}</span>}</b><small>{serviceDescription(service, locale)}</small>
              <small className="basket-service-rate">{service.pricingMode === "fixed"
                ? `${c.services.fixed}: ${formatSum(unitFee, locale)} / ${unitName}${units > 1 ? ` · ${units} × ${formatSum(unitFee, locale)} = ${formatSum(amount, locale)}` : ""} · ${c.services.notIncluded}`
                : `${c.services.quote} · ${c.services.notIncluded}`}</small>
            </span>
            {!["package", "item"].includes(service.unit) && checked && <span className="basket-service-units"><label htmlFor={`cart-service-units-${item.id}-${service.id}`}>{c.services.quantity} · {unitName}</label><input key={units} id={`cart-service-units-${item.id}-${service.id}`} type="number" inputMode="numeric" min="1" max="100" step="1" disabled={savingServiceItemId !== null} defaultValue={units} onBlur={(event) => { const nextUnits = Number(event.target.value); if (Number.isInteger(nextUnits) && nextUnits >= 1 && nextUnits <= 100 && nextUnits !== units) void updateService(true, nextUnits); else event.target.value = String(units); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} /></span>}
          </div>;
        })}</div>
      </details>}
    </article>;
  }

  // Each fee on its own line; the store-delivery hold and customs stay outside the amount to pay.
  const summaryLines = <CalcLines sums={sums} locale={locale} pricing={pricing} weightKg={cartWeight} storeShippingState="none" anyFree={reserves.some(entry => entry.free)}>
    {credit > 0 && <div className="basket-lines basket-lines-credit"><div className="basket-line"><span className="basket-line-label">{c.summary.fromBalance}</span><b>−{formatSum(credit, locale)}</b></div></div>}
  </CalcLines>;
  const saveCustoms = async (next: typeof customsChoices) => { setCustomsBusy(true); try { await act({ type: "cart-customs", value: next }); } finally { setCustomsBusy(false); } };
  // The allowance in two lines and "Atlas pays customs for me", which adds its fee to the bill right away.
  const customsPanel = <CustomsPanel estimate={customs} choices={customsChoices} locale={locale} pricing={pricing} profiles={state.deliveryProfiles} recipientId={customsProfile?.id} onRecipient={setCustomsRecipient} onChoices={(next) => void saveCustoms(next)} helpAmount={customsHelpAmount} busy={customsBusy} compact />;


  if (!ready) return <div className="basket-page">
    <header className="basket-head"><h1>{c.title}</h1></header>
    {error
      ? <section className="basket-empty"><span className="basket-empty-icon" aria-hidden="true"><ShoppingBag size={28} /></span><h2>{c.signin.title}</h2><p>{c.signin.text}</p><div className="basket-empty-actions"><Link className="btn primary" href="/login?return_to=%2Fcart">{c.signin.action}<ArrowRight size={18} aria-hidden="true" /></Link></div></section>
      : <div className="basket-loading" role="status">{c.loading}</div>}
  </div>;

  if (placedKey) return <div className="basket-page">
    <header className="basket-head"><h1>{c.success.title}</h1></header>
    <div className="basket-loading" role="status"><Loader2 size={18} className="spin" aria-hidden="true" /> <Link href="/orders">{c.success.orders}</Link></div>
  </div>;

  if (!state.cart.length) return <div className="basket-page">
    <header className="basket-head"><h1>{c.title}</h1></header>
    <section className="basket-empty"><span className="basket-empty-icon" aria-hidden="true"><ShoppingBag size={28} /></span><h2>{c.empty.title}</h2><p>{c.empty.text}</p>
      <div className="basket-empty-actions"><Link className="btn primary" href="/order-by-link"><ClipboardPaste size={18} aria-hidden="true" />{c.empty.paste}</Link><Link className="btn secondary" href="/stores">{c.empty.stores}</Link></div>
    </section>
  </div>;

  return <div className="basket-page has-sticky">
    <header className="basket-head"><h1>{c.title}</h1><p>{itemCount(count, locale)} · {parcelCount(parcels.length, locale)}</p></header>
    <CheckoutSteps current={0} c={c} />
    <div className="basket-layout">
      <div className="basket-parcels">
        {parcels.map(parcel => {
          const reserve = reserves.find(entry => parcel.items.some(item => entry.itemIds.includes(item.id)));
          return <section className="basket-parcel" key={parcel.key} aria-label={parcel.title}>
            <h2 className="basket-parcel-title"><Store size={16} aria-hidden="true" /><span>{parcel.title}</span><small>{parcel.country}</small></h2>
            {parcel.items.map(renderItem)}
            {reserve && <p className={"basket-parcel-note" + (reserve.reserveUsd ? "" : " ok")}>
              {reserve.reserveUsd ? <Truck size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              <span>{reserve.reserveUsd ? c.item.parcelReserve(usd(reserve.missingUsd, locale), usd(reserve.reserveUsd, locale)) : c.item.parcelFree(freeFrom)}</span>
            </p>}
          </section>;
        })}
        <Link className="basket-continue" href="/">{c.summary.continue}<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      {/* The bill in a folder: the sheet is the amount to pay, the slip below holds what stays outside it. */}
      <aside className="basket-summary folio" aria-labelledby="basket-summary-title">
        <div className="folio-sheet">
          <h2 id="basket-summary-title">{c.summary.title}</h2>
          {summaryLines}
          {customsPanel}
          {balance > 0 && <div className="basket-balance"><Checkbox id="use-balance" checked={useBalance} onCheckedChange={(value) => setUseBalance(value === true)} /><label htmlFor="use-balance">{c.summary.balance}<small>{c.summary.available}: {formatSum(balance, locale)}</small></label></div>}
          <div className="basket-total bill-total"><span>{c.summary.payable}</span><strong><Money value={payable} locale={locale} /></strong></div>
          <PriceHold expiresAt={earliestExpiry} locale={locale} c={c} />
          <button ref={setSummaryCta} type="button" className="btn primary basket-cta" disabled={verifying} aria-busy={verifying} onClick={() => void openCheckout()}>{verifying ? <>{c.summary.verifying}<Loader2 size={18} className="spin" aria-hidden="true" /></> : c.summary.checkout}</button>
        </div>
        {sums.storeShippingHold > 0 && <section className="folio-outside" aria-labelledby="basket-outside-title">
          <h3 id="basket-outside-title">{c.summary.outside}</h3>
          <HoldNote amount={sums.storeShippingHold} locale={locale} pricing={pricing} />
        </section>}
      </aside>
    </div>

    <div className={"basket-sticky" + (summaryCtaInView ? " is-hidden" : "")} role="region" aria-label={c.sticky.label} aria-hidden={summaryCtaInView || undefined}>
      <div><span>{c.summary.payable}</span><strong>{formatSum(payable, locale)}</strong></div>
      <button type="button" className="btn primary" disabled={verifying} aria-busy={verifying} onClick={() => void openCheckout()}>{verifying ? <Loader2 size={18} className="spin" aria-label={c.summary.verifying} /> : <>{c.sticky.checkout}<ArrowRight size={18} aria-hidden="true" /></>}</button>
    </div>

    <Modal open={checkoutOpen} onClose={() => { if (!busy) setCheckoutOpen(false); }} title={review ? c.checkout.reviewTitle : c.checkout.title} description={review ? c.checkout.reviewHint : c.checkout.hint} locale={locale}>
      <CheckoutSteps current={review ? 2 : 1} c={c} />
      <form className="checkout-form basket-checkout" onSubmit={(event) => {
        event.preventDefault();
        if (!review) { setReview(true); return; }
        if (!consent) { setConsentError(true); document.getElementById("checkout-consent")?.focus(); return; }
        void checkout();
      }}>
        {!review && <>
          {state.deliveryProfiles.length > 0 && <fieldset className="recipient-choices"><legend>{c.checkout.saved}</legend>
            {state.deliveryProfiles.map(profile => {
              const passport = identityProfiles.find(identity => identity.recipientProfileId === profile.id);
              // The label repeats the name when a recipient was saved under it: show it once.
              const named = profile.label.trim() && profile.label.trim() !== profile.recipient.trim();
              return <label className={"recipient-choice" + (selectedProfile === profile.id ? " selected" : "")} key={profile.id}>
                <input type="radio" name="checkout-recipient" value={profile.id} checked={selectedProfile === profile.id} onChange={() => { setSelectedProfile(profile.id); setDelivery(profile); }} />
                <span className="recipient-choice-body">
                  <strong>{named ? profile.label : profile.recipient}{profile.primary && <em>{c.checkout.primary}</em>}</strong>
                  <span>{named && <>{profile.recipient} · </>}<span className="nowrap">{profile.phone}</span></span>
                  <small>{[profile.region, profile.city, profile.address, profile.postalCode].filter(Boolean).join(", ")}</small>
                  <small className={passport ? "recipient-passport-ok" : "recipient-passport-missing"}>{passport ? c.checkout.passportOk : c.checkout.passportMissing}</small>
                </span>
              </label>;
            })}
            <label className={"recipient-choice recipient-choice-manual" + (selectedProfile === "manual" ? " selected" : "")}>
              <input type="radio" name="checkout-recipient" value="manual" checked={selectedProfile === "manual"} onChange={() => { setSelectedProfile("manual"); setDelivery({ ...emptyDelivery }); }} />
              <span className="recipient-choice-body"><strong><Plus size={16} aria-hidden="true" />{c.checkout.newRecipient}</strong></span>
            </label>
          </fieldset>}
          {/* A recipient saved before postal codes were required gets one here; it is saved into that recipient. */}
          {savedNeedsPostal && <div className="field checkout-postal"><label htmlFor="saved-postal-code">{c.checkout.postal}</label><input id="saved-postal-code" autoComplete="postal-code" inputMode="numeric" required pattern="\d{6}" maxLength={6} title={c.checkout.postalHint} aria-describedby="saved-postal-hint" value={delivery.postalCode} onChange={(event) => setDelivery({ ...delivery, postalCode: event.target.value.replace(/\D/g, "").slice(0, 6) })} /><small id="saved-postal-hint">{c.checkout.postalMissing}</small></div>}
          {/* A saved recipient is complete as chosen; the address fields are for a new one. */}
          {(selectedProfile === "manual" || !state.deliveryProfiles.length) && <>
          <div className="two-fields">
            <div className="field"><label htmlFor="recipient">{c.checkout.recipient}</label><input id="recipient" autoComplete="name" required minLength={2} maxLength={100} value={delivery.recipient} onChange={(event) => { setSelectedProfile("manual"); setDelivery({ ...delivery, recipient: event.target.value }); }} /></div>
            <div className="field"><label htmlFor="recipient-phone">{c.checkout.phone}<span className="sr-only"> +998</span></label><span className="rf-phone"><span aria-hidden="true">+998</span><UzPhoneInput id="recipient-phone" required pattern="\d{2} \d{3} \d{2} \d{2}" title={recipientCopy[locale].phoneError} digits={uzPhoneDigits(delivery.phone)} onDigits={(digits) => { setSelectedProfile("manual"); setDelivery({ ...delivery, phone: uzPhone(digits) }); }} /></span></div>
            <div className="field"><label htmlFor="region">{c.checkout.region}</label><select id="region" autoComplete="address-level1" required value={delivery.region} onChange={(event) => { const region = event.target.value, capital = regionCapital(region); setSelectedProfile("manual"); setDelivery({ ...delivery, region, city: !delivery.city.trim() || cities.includes(delivery.city) ? capital ?? delivery.city : delivery.city }); }}>{!regions.includes(delivery.region) && <option value={delivery.region}>{delivery.region || recipientCopy[locale].regionPlaceholder}</option>}{regions.map(value => <option key={value} value={value}>{regionLabel(value, locale)}</option>)}</select></div>
            <div className="field"><label htmlFor="city">{c.checkout.city}</label><input id="city" list="city-suggestions" autoComplete="address-level2" required minLength={2} maxLength={100} value={delivery.city} onChange={(event) => { setSelectedProfile("manual"); setDelivery({ ...delivery, city: event.target.value }); }} /><datalist id="city-suggestions">{suggestions(cities, delivery.city).map(value => <option key={value} value={value} />)}</datalist></div>
          </div>
          <div className="field"><label htmlFor="delivery-address">{c.checkout.street}</label><input id="delivery-address" list="street-suggestions" autoComplete="street-address" required minLength={5} maxLength={220} placeholder={c.checkout.streetPlaceholder} value={delivery.address} onChange={(event) => { setSelectedProfile("manual"); setDelivery({ ...delivery, address: event.target.value }); }} /><datalist id="street-suggestions">{suggestions(streets, delivery.address).map(value => <option key={value} value={value} />)}</datalist></div>
          <div className="two-fields">
            <div className="field"><label htmlFor="postal-code">{c.checkout.postal}</label><input id="postal-code" autoComplete="postal-code" inputMode="numeric" required pattern="\d{6}" maxLength={6} title={c.checkout.postalHint} aria-describedby="postal-code-hint" value={delivery.postalCode} onChange={(event) => { setSelectedProfile("manual"); setDelivery({ ...delivery, postalCode: event.target.value.replace(/\D/g, "").slice(0, 6) }); }} /><small id="postal-code-hint">{c.checkout.postalHint}</small></div>
            <div className="field"><label htmlFor="delivery-comment">{c.checkout.comment} <span className="rf-optional">({recipientCopy[locale].optional})</span></label><input id="delivery-comment" maxLength={300} value={delivery.comment} onChange={(event) => { setSelectedProfile("manual"); setDelivery({ ...delivery, comment: event.target.value }); }} /></div>
          </div>
          <div className="basket-consent"><Checkbox id="save-recipient" checked={saveRecipient} onCheckedChange={(value) => setSaveRecipient(value === true)} /><label htmlFor="save-recipient">{c.checkout.saveRecipient}</label></div>
          </>}
        </>}
        {review && <section className="checkout-review">
          <div className="basket-review-recipient"><div><h3>{delivery.recipient}</h3><p>{delivery.phone}</p><p>{[delivery.region, delivery.city, delivery.address, delivery.postalCode].filter(Boolean).join(", ")}</p></div><button type="button" className="text-button" onClick={() => setReview(false)}>{c.checkout.edit}</button></div>
          <ul className="basket-review-items">{state.cart.map(item => <li key={item.id}>
            <span>{item.product.name}<small>{[shownVariant(item.variant), `× ${item.quantity}`].filter(Boolean).join(" · ")}</small>
              {(item.requestedServiceIds ?? []).map(id => {
                const service = pricing.serviceCatalog.find(value => value.id === id);
                if (!service) return null;
                const units = service.unit === "package" ? 1 : service.unit === "item" ? item.quantity : item.requestedServiceUnits?.[id] ?? 1;
                const fee = serviceFeeForCountry(service, item.product.country) * units;
                return <small className="review-service" key={id}>+ {serviceTitle(service, locale)} · {service.pricingMode === "fixed" ? `${formatSum(fee, locale)} · ${c.checkout.serviceNotAdded}` : c.checkout.servicePriceLater}</small>;
              })}
            </span><b>{formatSum(item.quote.total, locale)}</b>
          </li>)}</ul>
          {summaryLines}
          <HoldNote amount={sums.storeShippingHold} locale={locale} pricing={pricing} />
          {/* The estimate for the person chosen in this checkout; the server works it out again and keeps it with the orders. */}
          <CustomsPanel estimate={cartCustomsEstimate(state, pricing, { profile: state.deliveryProfiles.find(profile => profile.id === selectedProfile), name: delivery.recipient }, customsChoices)} choices={customsChoices} locale={locale} pricing={pricing} profiles={[]} onChoices={(next) => void saveCustoms(next)} helpAmount={customsHelpAmount} busy={customsBusy} />
          <div className={"basket-consent" + (consentError ? " invalid" : "")}>
            <Checkbox id="checkout-consent" checked={consent} aria-invalid={consentError} aria-describedby={consentError ? "checkout-consent-error" : undefined} onCheckedChange={(value) => { setConsent(value === true); if (value === true) setConsentError(false); }} />
            <label htmlFor="checkout-consent">{c.checkout.consent.before}<Link href="/customs" target="_blank">{c.checkout.consent.link}</Link>{c.checkout.consent.after}</label>
          </div>
          {consentError && <p id="checkout-consent-error" className="basket-consent-error" role="alert">{c.checkout.consentRequired}</p>}
        </section>}
        <div className="payment-preview"><div><span>{c.checkout.estimated}</span><b>{itemCount(count, locale)}</b></div><strong>{formatSum(payable, locale)}</strong></div>
        {review && <p className="micro">{c.checkout.preorderNote}</p>}
        <button className="btn primary full" disabled={busy}>{busy ? c.checkout.saving : review ? c.checkout.confirm : c.checkout.next}{busy ? <Loader2 size={18} className="spin" aria-hidden="true" /> : review ? <Check size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}</button>
      </form>
    </Modal>

  </div>;

}
