"use client";

import { useEffect, useId, useState } from "react";
import Link from "@/components/site-link";
import { ArrowRight, ArrowUpRight, Check, ClipboardPaste, Clock3, Info, Loader2, MapPin, Minus, Plus, ShieldCheck, ShoppingBag, Store } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMarket } from "@/lib/market/store";
import { balanceOf, cartSignature, merchantParcelKey, totalOf, serviceTitle, serviceDescription, serviceFeeForCountry, type CartItem, type DeliveryProfile } from "@/lib/market/domain";
import { atlasServiceBreakdown } from "@/lib/market/quote-presentation";
import { courierAllowanceUsd } from "@/lib/market/customs";
import { countryName, customsVersion } from "@/lib/market/world";
import { formatSum } from "@/lib/market/home-copy";
import { cartCopy, countryLabel, itemCount, minutesLeft, parcelCount, type CartCopy } from "@/lib/market/customer-copy";
import type { Locale } from "@/lib/market/i18n";
import { Modal, ProductImage } from "./market-ui";
import { SafeDeleteButton } from "./safe-delete-button";
import { cities, regions, streets, suggestions } from "@/lib/market/addresses";
import { CustomsEstimate } from "./customs-estimate";

const emptyDelivery: DeliveryProfile = { recipient: "", phone: "", region: "Ташкент", city: "Ташкент", address: "", postalCode: "", comment: "" };

function storeHost(item: CartItem) {
  try { return item.product.sourceUrl ? new URL(item.product.sourceUrl).hostname.replace(/^www\./, "") : ""; } catch { return ""; }
}

/** Store price as the shop shows it, e.g. "$29.99" or "129,90 RON". */
function storePrice(item: CartItem, locale: Locale) {
  const amount = item.product.sourcePrice ?? item.product.usd, currency = item.product.sourceCurrency ?? "USD";
  try { return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${amount} ${currency}`; }
}

/** Checkout progress shared by the cart page and the checkout dialog. */
function CheckoutSteps({ current, c }: { current: number; c: CartCopy }) {
  return <ol className="basket-steps" aria-label={c.stepsLabel}>{c.steps.map((step, index) =>
    <li key={step} data-state={index < current ? "done" : index === current ? "current" : "next"} aria-current={index === current ? "step" : undefined}>
      <span aria-hidden="true">{index < current ? <Check size={13} /> : index + 1}</span>{step}
    </li>)}</ol>;
}

/** One summary row; an optional help text opens below it instead of a floating popover. */
function SummaryLine({ label, amount, locale, help, helpLabel, negative = false }: { label: string; amount: number; locale: Locale; help?: string; helpLabel?: string; negative?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="basket-line">
    <span className="basket-line-label">{label}{help && <button type="button" className="basket-help" aria-label={helpLabel} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}><Info size={15} aria-hidden="true" /></button>}</span>
    <b>{negative ? "−" : ""}{formatSum(amount, locale)}</b>
    {help && open && <p id={id} className="basket-line-help">{help}</p>}
  </div>;
}

export function CartView() {
  const { state, act, ready, error, user, pricing } = useMarket();
  const [useBalance, setUseBalance] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [review, setReview] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryProfile>(emptyDelivery);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingServiceItemId, setSavingServiceItemId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkoutKey, setCheckoutKey] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paidFromCart, setPaidFromCart] = useState(false);
  const [now, setNow] = useState(0);

  // Minute precision is enough for "price held for N min"; expiry is re-checked on the server anyway.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0), timer = setInterval(tick, 15000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    for (const item of state.cart) {
      const selected = item.requestedServiceIds ?? [];
      const available = pricing.serviceCatalog.filter((service) => service.enabled && service.requestStage === "checkout");
      const allowedIds = new Set(available.map((service) => service.id));
      const current = selected.filter((serviceId) => allowedIds.has(serviceId));
      const missingRequired = available.filter((service) => service.required && !current.includes(service.id)).map((service) => service.id);
      const normalized = [...current, ...missingRequired];
      const normalizedUnits = Object.fromEntries(Object.entries(item.requestedServiceUnits ?? {}).filter(([serviceId]) => normalized.includes(serviceId) && available.some((service) => service.id === serviceId && !["package", "item"].includes(service.unit))));
      if (normalized.length !== selected.length || normalized.some((serviceId, index) => serviceId !== selected[index]) || JSON.stringify(normalizedUnits) !== JSON.stringify(item.requestedServiceUnits ?? {}))
        void act({ type: "cart-services", id: item.id, serviceIds: normalized, serviceUnits: normalizedUnits });
    }
  }, [act, pricing.serviceCatalog, ready, state.cart]);

  const locale = state.communication.language;
  const c = cartCopy[locale];
  const earliestExpiry = state.cart.reduce((min, item) => Math.min(min, item.quote.expiresAt), Infinity);
  const expired = now > 0 && state.cart.some((item) => now >= item.quote.expiresAt);
  const total = totalOf(state.cart);
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartMerchandiseUsd = state.cart.reduce((sum, item) => sum + item.product.usd * item.quantity, 0);
  const balance = balanceOf(state);
  const credit = useBalance ? Math.min(total, Math.max(0, balance)) : 0;
  const payable = total - credit;
  const checkoutOrders = checkoutKey ? state.orders.filter(order => order.batchId === checkoutKey) : [];
  const pendingCheckoutOrders = checkoutOrders.filter(order => order.payment?.status === "pending");
  const pendingCheckoutAmount = pendingCheckoutOrders.reduce((sum, order) => sum + (order.payment?.amount ?? 0), 0);
  const checkoutServices = pricing.serviceCatalog.filter((service) => service.enabled && service.requestStage === "checkout");
  const identityProfiles = state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);
  const sums = state.cart.reduce((result, item) => ({
    merchandise: result.merchandise + item.quote.merchandise,
    service: result.service + item.quote.service,
    shipping: result.shipping + item.quote.shipping,
    reserve: result.reserve + item.quote.reserve,
    sourceShipping: result.sourceShipping + (item.quote.sourceShipping ?? 0),
    buyout: result.buyout + (item.quote.buyout ?? 0),
    conversion: result.conversion + (item.quote.conversion ?? 0),
    deliveryMargin: result.deliveryMargin + (item.quote.deliveryMargin ?? 0),
    optionalServices: result.optionalServices + (item.quote.optionalServices ?? 0),
  }), { merchandise: 0, service: 0, shipping: 0, reserve: 0, sourceShipping: 0, buyout: 0, conversion: 0, deliveryMargin: 0, optionalServices: 0 });
  const parts = atlasServiceBreakdown(sums);
  // Same grouping as the server's parcel allocation: one store and one origin country share a parcel.
  const parcels = state.cart.reduce<{ key: string; title: string; country: string; items: CartItem[] }[]>((groups, item) => {
    const key = merchantParcelKey(item);
    const group = groups.find(entry => entry.key === key);
    if (group) group.items.push(item);
    else groups.push({ key, title: c.item.parcelFrom(storeHost(item) || item.product.brand), country: countryLabel(countryName(item.product), locale), items: [item] });
    return groups;
  }, []);

  function openCheckout() {
    if (expired) { void act({ type: "cart-renew" }); return; }
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
    const key = crypto.randomUUID();
    setCheckoutKey(key);
    setPaidFromCart(false);
    const ok = await act({ type: "checkout", key, signature: cartSignature(state.cart), useBalance, expectedCredit: credit, consentVersion: customsVersion, delivery, deliveryProfileId: selectedProfile === "manual" ? undefined : selectedProfile, identityProfileId: selectedIdentity?.documentId });
    setBusy(false);
    if (ok) { setCheckoutOpen(false); setSuccess(true); }
  }

  async function payFromCart() {
    if (paymentBusy) return;
    const pendingIds = pendingCheckoutOrders.map(order => order.id);
    if (!pendingIds.length) { setPaidFromCart(true); return; }
    setPaymentBusy(true);
    let completed = true;
    for (const id of pendingIds) {
      if (!await act({ type: "payment-demo", id })) { completed = false; break; }
    }
    setPaymentBusy(false);
    if (completed) setPaidFromCart(true);
  }

  function renderItem(item: CartItem) {
    const selectedServices = item.requestedServiceIds ?? [];
    const serviceUnits = item.requestedServiceUnits ?? {};
    const meta = [item.variant, countryLabel(countryName(item.product), locale)].filter(Boolean).join(" · ");
    return <article className="basket-item" key={item.id}>
      <div className="basket-photo"><ProductImage product={item.product} locale={locale} decorative /></div>
      <div className="basket-info">
        {item.product.brand && <p className="basket-brand">{item.product.brand}</p>}
        <h3 className="basket-name">{item.product.name}</h3>
        <p className="basket-meta">{meta}</p>
        <p className="basket-meta">{item.product.sourceUrl ? <a className="basket-source" href={item.product.sourceUrl} target="_blank" rel="noopener noreferrer">{c.item.storePrice}: {storePrice(item, locale)}<ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> ({c.item.openStore})</span></a> : <>{c.item.storePrice}: {storePrice(item, locale)}</>}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</p>
      </div>
      <div className="basket-price"><strong>{formatSum(item.quote.total, locale)}</strong>{item.quantity > 1 && <small>{c.item.forQuantity(item.quantity)}</small>}</div>
      <div className="basket-controls">
        <div className="basket-qty" role="group" aria-label={`${c.item.quantity}: ${item.product.name}`}>
          <button type="button" aria-label={`${c.item.decrease}: ${item.product.name}`} disabled={item.quantity <= 1} onClick={() => void act({ type: "cart-quantity", id: item.id, quantity: item.quantity - 1 })}><Minus size={16} aria-hidden="true" /></button>
          <output aria-live="polite">{item.quantity}</output>
          <button type="button" aria-label={`${c.item.increase}: ${item.product.name}`} disabled={item.quantity >= 10} onClick={() => void act({ type: "cart-quantity", id: item.id, quantity: item.quantity + 1 })}><Plus size={16} aria-hidden="true" /></button>
        </div>
        <SafeDeleteButton label={c.item.remove} itemName={item.product.name} locale={locale} onConfirm={() => act({ type: "cart-remove", id: item.id })} />
      </div>
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
            try { await act({ type: "cart-services", id: item.id, serviceIds: next, serviceUnits: serviceUnitsNext }); }
            finally { setSavingServiceItemId(null); }
          };
          const unitName = c.services.units[service.unit];
          return <div className="basket-service" key={service.id}>
            <Checkbox aria-label={serviceTitle(service, locale)} checked={checked} disabled={service.required || savingServiceItemId !== null} onCheckedChange={(value) => void updateService(value === true)} />
            <span className="basket-service-copy"><b>{serviceTitle(service, locale)}{service.required && <em>{c.services.required}</em>}</b><small>{serviceDescription(service, locale)}</small>
              <small className="basket-service-rate">{service.pricingMode === "fixed"
                ? `${c.services.fixed}: ${formatSum(unitFee, locale)} / ${unitName}${units > 1 ? ` · ${units} × ${formatSum(unitFee, locale)} = ${formatSum(amount, locale)}` : ""} · ${c.services.notIncluded}`
                : `${c.services.quote} · ${c.services.notIncluded}`}</small>
            </span>
            {!["package", "item"].includes(service.unit) && checked && <span className="basket-service-units"><label htmlFor={`cart-service-units-${item.id}-${service.id}`}>{c.services.quantity} · {unitName}</label><input id={`cart-service-units-${item.id}-${service.id}`} type="number" inputMode="numeric" min="1" max="100" step="1" disabled={savingServiceItemId !== null} value={units} onChange={(event) => { const nextUnits = Number(event.target.value); if (Number.isInteger(nextUnits) && nextUnits >= 1 && nextUnits <= 100) void updateService(true, nextUnits); }} /></span>}
          </div>;
        })}</div>
      </details>}
    </article>;
  }

  const summaryLines = <div className="basket-lines">
    <SummaryLine label={`${c.summary.items} · ${itemCount(count, locale)}`} amount={sums.merchandise} locale={locale} />
    {sums.sourceShipping > 0 && <SummaryLine label={c.summary.storeShipping} amount={sums.sourceShipping} locale={locale} />}
    {parts.service > 0 && <SummaryLine label={c.summary.service} amount={parts.service} locale={locale} help={c.summary.serviceHelp} helpLabel={c.summary.serviceHelpLabel} />}
    {parts.international > 0 && <SummaryLine label={c.summary.international} amount={parts.international} locale={locale} help={c.summary.internationalHelp} helpLabel={c.summary.internationalHelpLabel} />}
    {sums.reserve > 0 && <SummaryLine label={c.summary.reserve} amount={sums.reserve} locale={locale} help={c.summary.reserveHelp} helpLabel={c.summary.reserveHelpLabel} />}
    {sums.optionalServices > 0 && <SummaryLine label={c.summary.optional} amount={sums.optionalServices} locale={locale} />}
    {credit > 0 && <SummaryLine label={c.summary.fromBalance} amount={credit} locale={locale} negative />}
  </div>;

  // Rendered after checkout empties the cart, so it lives outside the cart layout.
  const successDialog = <Modal open={success} onClose={() => setSuccess(false)} locale={locale} title={paidFromCart ? c.success.statusTitle : c.success.title} description={paidFromCart ? c.success.saved : pendingCheckoutOrders.length ? c.success.pending : checkoutOrders.length ? c.success.saved : c.success.hint}>
    <div className="success-icon"><Check size={35} aria-hidden="true" /></div>
    {!paidFromCart && pendingCheckoutOrders.length > 0 && <div className="basket-total"><span>{c.summary.payable}</span><strong>{formatSum(pendingCheckoutAmount, locale)}</strong></div>}
    {!paidFromCart && pendingCheckoutOrders.length > 0
      ? <button className="btn primary full" disabled={paymentBusy} onClick={() => void payFromCart()}>{paymentBusy ? c.success.updating : c.success.confirm} {paymentBusy ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}</button>
      : <button className="btn secondary full" onClick={() => { setSuccess(false); window.location.assign("/orders"); }}>{c.success.orders} <ArrowRight size={18} aria-hidden="true" /></button>}
    <p className="micro center">{c.success.noCharge}</p>
  </Modal>;

  if (!ready) return <div className="basket-page">
    <header className="basket-head"><h1>{c.title}</h1></header>
    {error
      ? <section className="basket-empty"><span className="basket-empty-icon" aria-hidden="true"><ShoppingBag size={28} /></span><h2>{c.signin.title}</h2><p>{c.signin.text}</p><div className="basket-empty-actions"><Link className="btn primary" href="/login?return_to=%2Fcart">{c.signin.action}<ArrowRight size={18} aria-hidden="true" /></Link></div></section>
      : <div className="basket-loading" role="status">{c.loading}</div>}
  </div>;

  if (!state.cart.length) return <div className="basket-page">
    <header className="basket-head"><h1>{c.title}</h1></header>
    <section className="basket-empty"><span className="basket-empty-icon" aria-hidden="true"><ShoppingBag size={28} /></span><h2>{c.empty.title}</h2><p>{c.empty.text}</p>
      <div className="basket-empty-actions"><Link className="btn primary" href="/order-by-link"><ClipboardPaste size={18} aria-hidden="true" />{c.empty.paste}</Link><Link className="btn secondary" href="/stores">{c.empty.stores}</Link></div>
    </section>
    {successDialog}
  </div>;

  return <div className="basket-page has-sticky">
    <header className="basket-head"><h1>{c.title}</h1><p>{itemCount(count, locale)} · {parcelCount(parcels.length, locale)}</p></header>
    <CheckoutSteps current={0} c={c} />
    <div className="basket-layout">
      <div className="basket-parcels">
        {parcels.map(parcel => <section className="basket-parcel" key={parcel.key} aria-label={parcel.title}>
          <h2 className="basket-parcel-title"><Store size={16} aria-hidden="true" /><span>{parcel.title}</span><small>{parcel.country}</small></h2>
          {parcel.items.map(renderItem)}
        </section>)}
        <Link className="basket-continue" href="/">{c.summary.continue}<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      <aside className="basket-summary" aria-labelledby="basket-summary-title">
        <h2 id="basket-summary-title">{c.summary.title}</h2>
        {summaryLines}
        {balance > 0 && <div className="basket-balance"><Checkbox id="use-balance" checked={useBalance} onCheckedChange={(value) => setUseBalance(value === true)} /><label htmlFor="use-balance">{c.summary.balance}<small>{c.summary.available}: {formatSum(balance, locale)}</small></label></div>}
        <div className="basket-total"><span>{c.summary.payable}</span><strong>{formatSum(payable, locale)}</strong></div>
        <p className={"basket-expiry" + (expired ? " expired" : "")} role={expired ? "alert" : undefined}><Clock3 size={15} aria-hidden="true" />{expired ? c.summary.expired : now ? c.summary.validFor(minutesLeft(earliestExpiry - now, locale)) : c.summary.checking}</p>
        {cartMerchandiseUsd > courierAllowanceUsd && <CustomsEstimate valueUsd={cartMerchandiseUsd} grossKg={state.cart.reduce((sum, item) => sum + (item.product.boxedWeight ?? item.product.weight) * item.quantity, 0)} fx={pricing.fx} locale={locale} />}
        <button type="button" className="btn primary basket-cta" onClick={openCheckout}>{expired ? c.summary.renew : c.summary.checkout}<ArrowRight size={18} aria-hidden="true" /></button>
        <ul className="basket-assurance"><li><ShieldCheck size={16} aria-hidden="true" />{c.summary.assurance}</li><li><Info size={16} aria-hidden="true" />{c.summary.simulation}</li></ul>
      </aside>
    </div>

    <div className="basket-sticky" role="region" aria-label={c.sticky.label}>
      <div><span>{c.summary.payable}</span><strong>{formatSum(payable, locale)}</strong></div>
      <button type="button" className="btn primary" onClick={openCheckout}>{expired ? c.summary.renew : c.sticky.checkout}<ArrowRight size={18} aria-hidden="true" /></button>
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
          <div className="checkout-address-head"><MapPin size={21} aria-hidden="true" /><span>{c.checkout.deliveryUz}</span></div>
          {state.deliveryProfiles.length > 0 && <fieldset className="recipient-choices"><legend>{c.checkout.saved}</legend>
            {state.deliveryProfiles.map(profile => {
              const passport = identityProfiles.find(identity => identity.recipientProfileId === profile.id);
              return <label className={"recipient-choice" + (selectedProfile === profile.id ? " selected" : "")} key={profile.id}>
                <input type="radio" name="checkout-recipient" value={profile.id} checked={selectedProfile === profile.id} onChange={() => { setSelectedProfile(profile.id); setDelivery(profile); }} />
                <span className="recipient-choice-body"><strong>{profile.label}{profile.primary ? ` · ${c.checkout.primary}` : ""}</strong><span>{profile.recipient} · {profile.phone}</span><small>{profile.region}, {profile.city}, {profile.address}</small><small className={passport ? "recipient-passport-ok" : "recipient-passport-missing"}>{passport ? c.checkout.passportOk : c.checkout.passportMissing}</small></span>
              </label>;
            })}
            <button type="button" className={"recipient-choice recipient-choice-manual" + (selectedProfile === "manual" ? " selected" : "")} onClick={() => { setSelectedProfile("manual"); setDelivery(state.deliveryProfile ?? { ...emptyDelivery, recipient: user?.name ?? "", phone: state.communication.phone }); }}><Plus size={16} aria-hidden="true" />{c.checkout.newRecipient}</button>
            <small>{c.checkout.chooseHint}</small>
          </fieldset>}
          <div className="two-fields">
            <div className="field"><label htmlFor="recipient">{c.checkout.recipient}</label><input id="recipient" autoComplete="name" required minLength={2} maxLength={100} value={delivery.recipient} onChange={(event) => { setSelectedProfile("manual"); setDelivery({ ...delivery, recipient: event.target.value }); }} /></div>
            <div className="field"><label htmlFor="recipient-phone">{c.checkout.phone}</label><input id="recipient-phone" required type="tel" inputMode="tel" autoComplete="tel" minLength={7} maxLength={30} placeholder="+998 90 123 45 67" value={delivery.phone} onChange={(event) => { setSelectedProfile("manual"); setDelivery({ ...delivery, phone: event.target.value }); }} /></div>
            <div className="field"><label htmlFor="region">{c.checkout.region}</label><input id="region" list="region-suggestions" autoComplete="address-level1" required minLength={2} maxLength={100} value={delivery.region} onChange={(event) => { setSelectedProfile("manual"); setDelivery({ ...delivery, region: event.target.value }); }} /><datalist id="region-suggestions">{suggestions(regions, delivery.region).map(value => <option key={value} value={value} />)}</datalist></div>
            <div className="field"><label htmlFor="city">{c.checkout.city}</label><input id="city" list="city-suggestions" autoComplete="address-level2" required minLength={2} maxLength={100} value={delivery.city} onChange={(event) => { setSelectedProfile("manual"); setDelivery({ ...delivery, city: event.target.value }); }} /><datalist id="city-suggestions">{suggestions(cities, delivery.city).map(value => <option key={value} value={value} />)}</datalist></div>
          </div>
          <div className="field"><label htmlFor="delivery-address">{c.checkout.street}</label><input id="delivery-address" list="street-suggestions" autoComplete="street-address" required minLength={5} maxLength={220} placeholder={c.checkout.streetPlaceholder} value={delivery.address} onChange={(event) => { setSelectedProfile("manual"); setDelivery({ ...delivery, address: event.target.value }); }} /><datalist id="street-suggestions">{suggestions(streets, delivery.address).map(value => <option key={value} value={value} />)}</datalist><small>{c.checkout.addressHint}</small></div>
          <div className="two-fields">
            <div className="field"><label htmlFor="postal-code">{c.checkout.postal}</label><input id="postal-code" autoComplete="postal-code" inputMode="numeric" maxLength={20} value={delivery.postalCode} onChange={(event) => { setSelectedProfile("manual"); setDelivery({ ...delivery, postalCode: event.target.value }); }} /></div>
            <div className="field"><label htmlFor="delivery-comment">{c.checkout.comment}</label><input id="delivery-comment" maxLength={300} value={delivery.comment} onChange={(event) => { setSelectedProfile("manual"); setDelivery({ ...delivery, comment: event.target.value }); }} /></div>
          </div>
        </>}
        {review && <section className="checkout-review">
          <div className="basket-review-recipient"><div><h3>{delivery.recipient}</h3><p>{delivery.phone}</p><p>{delivery.region}, {delivery.city}, {delivery.address}</p></div><button type="button" className="text-button" onClick={() => setReview(false)}>{c.checkout.edit}</button></div>
          <ul className="basket-review-items">{state.cart.map(item => <li key={item.id}>
            <span>{item.product.name}<small>{item.variant} · {item.quantity}</small>
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

    {successDialog}
  </div>;

}
