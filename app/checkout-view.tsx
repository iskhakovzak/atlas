"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import Link from "@/components/site-link";
import { ArrowLeft, ArrowRight, BadgeCheck, CircleCheck, ClipboardPaste, IdCard, Info, Loader2, Lock, MapPin, Plus, ShoppingBag, Tag, TriangleAlert, UserRound, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMarket } from "@/lib/market/store";
import { toast } from "@/lib/market/toast";
import { balanceOf, blockingSourceIssue, cartDeliverySpeed, cartSignature, checkoutLines, customsHelpChosen, deliveryAddressLine, isPostalCode, totalOf, withCustomsHelpFor, type CartItem, type DeliveryProfile, type DeliverySpeed, type Order } from "@/lib/market/domain";
import { cartCustomsEstimate } from "@/lib/market/allowance";
import { courierAllowanceUsd } from "@/lib/market/customs";
import { capitalizeFirst, capitalizeWords } from "@/lib/market/text-case";
import { isServedRegion, onlyServedCity, regionLabel, streets, suggestions, uzPhone, uzPhoneDigits } from "@/lib/market/addresses";
import { cartCopy, recipientCopy } from "@/lib/market/customer-copy";
import { checkoutCopy, promoCodeText } from "@/lib/market/checkout-copy";
import { calcCopy } from "@/lib/market/calc-copy";
import { deliverySpeedOptions, fasterText } from "@/lib/market/delivery-speed";
import { countryName, customsVersion } from "@/lib/market/world";
import { formatPercent, formatSum } from "@/lib/market/format";
import { normalizePromoCode, promoDiscount, promoOrderSum, type PromoPreview } from "@/lib/market/promo";
import { estimateGuestCart, pendingGuestLines } from "@/lib/market/guest-cart";
import { serverError, type Locale } from "@/lib/market/i18n";
import { CustomsPanel, DeliverySpeedSwitch, customsDutyAmount, sumQuotes, usdText } from "./calc-summary";
import { ProductImage } from "./market-ui";
import { Money } from "./money";
import { UzPhoneInput } from "./phone-input";
import { CheckoutSignIn } from "./checkout-signin";
import { shownVariant } from "./checkout-review";
import { useGuestCart, useGuestMerging } from "./use-guest-cart";

/*
 * The one-page checkout (redesign stage 6, 1 November 2026; /cart/checkout). From top to bottom: Вход (inline, every
 * method) → Получатель (the last one used, others one tap away) → Доставка (standard unless changed) → Таможня (only
 * when a duty applies) → Из чего сумма → Промокод → the pinned «Оплатить N сум». Every amount here is the server's
 * pricing (lib/market/domain.ts); the server checks the stores, the tariff, the customs duty, the promo code and the
 * balance again when the order is placed, and refuses with the new total rather than taking an old one.
 * Payment is simulated: «Оплатить» places the orders and marks them paid in Atlas (payment-demo-batch) while no payment
 * provider is connected; the screen says so and never claims a card was charged. The passport is asked for after
 * payment, on «Заказ принят».
 */

const emptyDelivery: DeliveryProfile = { recipient: "", phone: "", region: "Ташкент", city: "Ташкент", address: "", postalCode: "", comment: "" };
type Field = "savedPostal" | "recipient" | "phone" | "address" | "postal";
const fieldIds: Record<Field, string> = { savedPostal: "co-saved-postal", recipient: "co-recipient", phone: "co-phone", address: "co-address", postal: "co-postal" };
/** Store refusals that repriced or marked the cart: the page shows what changed instead of an error. */
const repricedCodes = new Set(["err_35", "err_36", "err_37", "err_38"]);
const promoCodes = new Set(["err_87", "err_88", "err_89", "err_90", "err_91"]);

const storeMoney = (amount: number, currency: string, locale: Locale) => {
  if (currency === "USD") return usdText(amount, locale);
  try { return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${amount} ${currency}`; }
};
/** A line's quote is past its 15 minutes (read when «Оплатить» is pressed, not during render). */
const quoteExpired = (lines: CartItem[]) => lines.length > 0 && Date.now() >= Math.min(...lines.map((item) => item.quote.expiresAt));
const kgText = (kg: number, locale: Locale) => kg ? new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", { maximumFractionDigits: 2 }).format(kg) : "";

/** One numbered block of the page; a locked one (before sign-in) shows only its title. */
function Block({ index, title, done, locked, lockedText, aside, children, id }: { index: number; title: string; done?: boolean; locked?: boolean; lockedText?: string; aside?: ReactNode; children?: ReactNode; id: string }) {
  return <section className={"co-block" + (locked ? " is-locked" : "") + (done ? " is-done" : "")} aria-labelledby={id}>
    <header className="co-block-head">
      <span className="co-step" aria-hidden="true">{done ? <CircleCheck size={18} /> : index}</span>
      <h2 id={id} tabIndex={-1}>{title}</h2>
      {aside}
    </header>
    {locked ? <p className="co-locked">{lockedText}</p> : children}
  </section>;
}

export function CheckoutView() {
  const { status, ready, state, act, pricing, user, refresh, lastActionError } = useMarket();
  const locale = state.communication.language;
  const t = checkoutCopy[locale], k = calcCopy[locale], cc = cartCopy[locale], rc = recipientCopy[locale];
  const guest = useGuestCart();
  const merging = useGuestMerging();
  // «Заказ принят»: the checkout key in the address, so a reload shows the same screen.
  const [placed, setPlaced] = useState("");
  useEffect(() => { const key = new URLSearchParams(window.location.search).get("placed"); if (key) queueMicrotask(() => setPlaced(key.slice(0, 80))); }, []);

  const lines = checkoutLines(state.cart);
  const waitingGuest = pendingGuestLines(guest.cart).length > 0;
  // ---- Сверка цены: once the account (and a guest's moved cart) is here, the stores are asked before anything is shown as final.
  const [check, setCheck] = useState<"idle" | "running" | "done" | "failed">("idle");
  const checkStarted = useRef(false);
  const runCheck = async () => {
    setCheck("running");
    const ok = await act({ type: "cart-check" }, { queue: true });
    // A store that changed the price or the item answers with the repriced cart: the page shows what changed.
    const result = ok || repricedCodes.has(lastActionError()?.code ?? "") ? "done" : "failed";
    setCheck(result);
    return result;
  };
  useEffect(() => {
    if (!ready || merging || waitingGuest || placed || checkStarted.current || !lines.length) return;
    checkStarted.current = true;
    queueMicrotask(() => void runCheck());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, merging, waitingGuest, placed, lines.length]);

  // ---- Получатель: the one used last (the latest order's), else the main one, else the first in Tashkent; or a new one.
  const served = state.deliveryProfiles.filter((profile) => isServedRegion(profile.region));
  const lastUsed = useMemo(() => {
    const order = [...state.orders].sort((a, b) => b.createdAt - a.createdAt).find((item) => item.deliveryProfileId && served.some((profile) => profile.id === item.deliveryProfileId));
    return order?.deliveryProfileId ?? served.find((profile) => profile.primary)?.id ?? served[0]?.id ?? "";
  }, [state.orders, served]);
  const [chosen, setChosen] = useState<string | null>(null);
  const selected = chosen ?? (lastUsed || "manual");
  const [listOpen, setListOpen] = useState(false);
  const [draft, setDraft] = useState<DeliveryProfile | null>(null);
  const personName = (() => { const name = user?.name?.trim() ?? ""; return name && !name.includes("@") && !/^[+\d\s()-]+$/.test(name) ? name : ""; })();
  const manual = selected === "manual";
  const savedProfile = manual ? undefined : state.deliveryProfiles.find((profile) => profile.id === selected);
  const delivery: DeliveryProfile = manual ? draft ?? { ...emptyDelivery, recipient: personName, phone: state.communication.phone } : savedProfile ?? emptyDelivery;
  const setDelivery = (next: DeliveryProfile) => setDraft(next);
  const savedNeedsPostal = Boolean(savedProfile && !isPostalCode(savedProfile.postalCode));
  const [savedPostal, setSavedPostal] = useState("");
  const [saveRecipient, setSaveRecipient] = useState(true);
  const [commentOpen, setCommentOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<Field, boolean>>>({});
  const errors: Record<Field, boolean> = {
    savedPostal: savedNeedsPostal && !isPostalCode(savedPostal),
    recipient: manual && delivery.recipient.trim().length < 2,
    phone: manual && uzPhoneDigits(delivery.phone).length !== 9,
    address: manual && delivery.address.trim().length < 5,
    postal: manual && !isPostalCode(delivery.postalCode),
  };
  const invalid = (field: Field) => (touched || Boolean(touchedFields[field])) && errors[field];
  const touch = (field: Field, value: string) => { if (value.trim() && !touchedFields[field]) setTouchedFields((fields) => ({ ...fields, [field]: true })); };
  const errorText = (field: Field) => field === "phone" ? rc.phoneError : field === "postal" || field === "savedPostal" ? rc.postalError : field === "recipient" ? cc.checkout.errors.recipient : cc.checkout.errors.address;
  const hint = (field: Field, text?: string) => invalid(field)
    ? <small id={fieldIds[field] + "-hint"} className="rf-error co-error">{errorText(field)}</small>
    : text ? <small id={fieldIds[field] + "-hint"}>{text}</small> : null;
  const describedBy = (field: Field, text?: string) => invalid(field) || text ? fieldIds[field] + "-hint" : undefined;

  // ---- Доставка, таможня, сумма: the same pricing as the cart and the server.
  const speed = cartDeliverySpeed(state.cart);
  const speedCountries = state.cart.map((item) => countryName(item.product));
  const [speedBusy, setSpeedBusy] = useState(false);
  const changeSpeed = async (next: DeliverySpeed) => { if (speedBusy) return; setSpeedBusy(true); try { await act({ type: "cart-delivery-speed", speed: next }); } finally { setSpeedBusy(false); } };
  const customsChoices = state.cartCustoms ?? { outsideUsed: false, help: customsHelpChosen(state) };
  const customsRemembered = !state.cartCustoms && state.customsPreference !== undefined;
  const [customsRemember, setCustomsRemember] = useState(true);
  const [customsBusy, setCustomsBusy] = useState(false);
  const customs = cartCustomsEstimate(state, pricing, { profile: savedProfile, name: delivery.recipient }, customsChoices);
  const dutyDue = customsDutyAmount(customs, pricing), duty = customsChoices.help ? dutyDue : 0;
  // With a duty and no choice yet, «Atlas pays customs» is the starting choice (owner, 7.10.2026), as in the cart.
  const customsDefaulted = useRef(false);
  const customsDefault = ready && !state.cartCustoms && state.customsPreference === undefined && lines.length > 0 && dutyDue > 0;
  useEffect(() => {
    if (!customsDefault || customsDefaulted.current || customsBusy) return;
    customsDefaulted.current = true;
    void act({ type: "cart-customs", value: { outsideUsed: false, help: true } });
  }, [customsDefault, customsBusy, act]);
  const saveCustoms = async (next: typeof customsChoices) => { setCustomsBusy(true); try { await act({ type: "cart-customs", value: next }); } finally { setCustomsBusy(false); } };
  const customsHelpAmount = customsChoices.help ? lines.reduce((sum, item) => sum + (item.quote.customsHelp ?? 0), 0) : lines.reduce((sum, item) => sum + Math.round(item.quote.merchandise * pricing.customsHelpFee), 0);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const billed = withCustomsHelpFor(lines, customs, pricing.fx);
  const sums = sumQuotes(billed.map((item) => item.quote));
  const weight = Math.round(lines.reduce((sum, item) => sum + item.quote.weight, 0) * 100) / 100;

  // ---- Промокод: the server's answer for the code, the discount worked out here the same way the server does.
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoText, setPromoText] = useState("");
  const [promo, setPromo] = useState<PromoPreview | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const orderSum = promoOrderSum(billed);
  const promoBelowMin = Boolean(promo?.minOrder && orderSum < promo.minOrder);
  const discount = promo && !promoBelowMin ? promoDiscount(promo, billed).total : 0;
  async function applyPromo(typed = promoText) {
    const code = normalizePromoCode(typed);
    if (!code || promoBusy) return;
    setPromoBusy(true); setPromoError("");
    try {
      const response = await fetch("/api/promo", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ code }) });
      const data = await response.json().catch(() => ({})) as { promo?: PromoPreview; error?: string; errorCode?: string };
      if (!response.ok || !data.promo) { setPromo(null); setPromoError(data.errorCode ? serverError(locale, data.errorCode) : data.error ?? serverError(locale, "err_87")); return; }
      // The field gives way to the applied code: focus moves to that line at once (not to the top of the page or the skip link).
      flushSync(() => { setPromo(data.promo!); setPromoText(data.promo!.code); });
      document.getElementById("co-promo-applied")?.focus();
    } catch { setPromoError(serverError(locale, "err_87")); }
    finally { setPromoBusy(false); }
  }

  const balance = balanceOf(state);
  const [useBalance, setUseBalance] = useState(false);
  const goods = totalOf(billed) - discount;
  const credit = useBalance ? Math.min(goods + duty, Math.max(0, balance)) : 0;
  const payable = goods + duty - credit;

  // ---- Оплатить
  const checkoutKey = useRef<{ signature: string; key: string } | null>(null);
  const placing = useRef(false);
  const [paying, setPaying] = useState<"" | "order" | "pay">("");
  const blocked = lines.some(blockingSourceIssue);
  async function pay() {
    if (placing.current || !ready || !lines.length || check === "running" || merging) return;
    setTouched(true);
    const first = (Object.keys(errors) as Field[]).find((field) => errors[field]);
    if (first) { document.getElementById(fieldIds[first])?.focus(); document.getElementById(fieldIds[first])?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    if (dutyDue > 0 && !consent) { setConsentError(true); document.getElementById("co-consent")?.focus(); return; }
    if (blocked) { document.getElementById("co-changes")?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    // The quote lives 15 minutes (lib/market/domain.ts): an older one is checked with the stores again first, so the
    // server never answers «Расчёт истёк» to a page that cannot renew it. The customer sees the new total, then pays.
    if (quoteExpired(lines)) { await recheck(); return; }
    placing.current = true; setPaying("order");
    try {
      const signature = cartSignature(state.cart);
      if (checkoutKey.current?.signature !== signature) checkoutKey.current = { signature, key: crypto.randomUUID() };
      const key = checkoutKey.current.key;
      const sentDelivery = manual && onlyServedCity ? { ...delivery, region: onlyServedCity, city: onlyServedCity } : delivery;
      const ok = await act({
        type: "checkout", key, signature, useBalance, expectedCredit: credit, consentVersion: customsVersion,
        customsDuty: customsChoices.help ? duty : undefined,
        delivery: sentDelivery, deliveryProfileId: manual ? undefined : selected,
        identityProfileId: manual ? undefined : (state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : [])).find((identity) => identity.recipientProfileId === selected)?.documentId,
        postalCode: savedNeedsPostal ? savedPostal : undefined,
        saveRecipientLabel: manual && saveRecipient ? (state.deliveryProfiles.length ? delivery.recipient.trim().slice(0, 60) : rc.labels.home) : undefined,
        ...(promo && discount ? { promoCode: promo.code, promoDiscount: discount } : {}),
      }, { queue: true });
      if (!ok) {
        const code = lastActionError()?.code ?? "";
        // The quote ran out or the tariff changed meanwhile: the stores are asked again and the new total is shown.
        if (code === "err_75" || code === "err_76") { await recheck(); return; }
        if (promoCodes.has(code)) { setPromo(null); setPromoOpen(true); setPromoError(serverError(locale, code)); document.getElementById("co-promo-input")?.focus(); }
        else if (repricedCodes.has(code)) { setCheck("done"); window.scrollTo({ top: 0, behavior: "smooth" }); }
        return;
      }
      checkoutKey.current = null;
      setPaying("pay");
      flushSync(() => setPlaced(key));
      window.history.replaceState(window.history.state, "", "/cart/checkout?placed=" + encodeURIComponent(key));
      window.scrollTo({ top: 0, behavior: "instant" });
    } finally { placing.current = false; setPaying(""); }
  }
  async function recheck() {
    if ((await runCheck()) === "done") toast.message(t.checkout.check.rechecked);
  }
  // The answer to «Оплатить» was lost (the connection dropped after the server placed the orders): the account read
  // again carries orders with this checkout key, so the page goes on to «Заказ принят» instead of an empty cart.
  useEffect(() => {
    const tried = checkoutKey.current?.key;
    if (placed || !tried || placing.current || !state.orders.some((order) => order.batchId === tried)) return;
    checkoutKey.current = null;
    queueMicrotask(() => {
      setPlaced(tried);
      window.history.replaceState(window.history.state, "", "/cart/checkout?placed=" + encodeURIComponent(tried));
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }, [state.orders, placed, paying]);
  // Placed: the orders still waiting are marked paid at once — the demo stands in for the payment page (one mark per checkout).
  const placedOrders = placed ? state.orders.filter((order) => order.batchId === placed) : [];
  const waitingPay = placedOrders.filter((order) => !order.cancelled && order.payment?.status === "pending");
  const markStarted = useRef("");
  useEffect(() => {
    if (!ready || !placed || !waitingPay.length || markStarted.current === placed) return;
    markStarted.current = placed;
    const amount = waitingPay.reduce((sum, order) => sum + (order.payment?.amount ?? 0), 0);
    queueMicrotask(() => void act({ type: "payment-demo-batch", batchId: placed, amount }, { queue: true }).then((ok) => { if (!ok) toast.error(serverError(locale, "err_10")); }));
  }, [ready, placed, waitingPay, act, locale]);

  // Signed in on this page (a code, Telegram): focus moves to the next step, Получатель, instead of falling to the page.
  const signedInHere = useRef(false);
  useEffect(() => {
    if (status === "guest") { signedInHere.current = true; return; }
    if (!ready || !signedInHere.current) return;
    signedInHere.current = false;
    window.requestAnimationFrame(() => document.getElementById("co-recipient-title")?.focus());
  }, [status, ready]);
  const openList = () => {
    flushSync(() => setListOpen(true));
    (document.querySelector<HTMLInputElement>(".co-recipients input:checked") ?? document.querySelector<HTMLInputElement>(".co-recipients input:not(:disabled)"))?.focus();
  };

  if (placed) return <PlacedView orders={placedOrders} loading={!ready && status !== "guest"} guest={status === "guest"} paying={waitingPay.length > 0} locale={locale} onSignedIn={() => void refresh()} />;

  // ---- Who is here
  const loadingAccount = status === "loading";
  const signedIn = ready;
  const guestItems = !signedIn ? estimateGuestCart(guest.cart, pricing) : [];
  const shownLines: CartItem[] = signedIn ? lines : guestItems;
  const shownSums = signedIn ? sums : sumQuotes(guestItems.map((item) => item.quote));
  const shownWeight = signedIn ? weight : Math.round(guestItems.reduce((sum, item) => sum + item.quote.weight, 0) * 100) / 100;
  const nothing = signedIn ? !lines.length && !merging && !waitingGuest : !guestItems.length && status === "guest";
  const changes = signedIn ? lines.filter((item) => item.priceChange || item.sourceIssue) : [];
  const later = state.cart.filter((item) => item.selected === false).reduce((sum, item) => sum + item.quantity, 0);
  const who = user ? (user.name && !user.name.includes("@") ? user.name : user.contact || user.email || user.name) : "";
  const guestGoodsUsd = guestItems.reduce((sum, item) => sum + (item.product.usd ?? 0) * item.quantity, 0);
  // A guest whose items are above the courier allowance owes a duty for sure: the total is shown as approximate, with a line saying so.
  const guestDuty = !signedIn && guestGoodsUsd > (pricing.customsAllowanceUsd ?? courierAllowanceUsd);

  if (nothing && !loadingAccount) return <div className="co-page">
    <header className="co-head"><h1>{t.checkout.title}</h1></header>
    <section className="co-empty basket-empty"><span className="basket-empty-icon" aria-hidden="true"><ShoppingBag size={28} /></span><h2>{t.checkout.empty}</h2><p>{cc.empty.text}</p>
      <div className="basket-empty-actions"><Link className="btn primary" href="/catalog">{t.checkout.emptyAction}<ArrowRight size={18} aria-hidden="true" /></Link><Link className="btn secondary" href="/order-by-link"><ClipboardPaste size={18} aria-hidden="true" />{cc.empty.paste}</Link></div>
    </section>
  </div>;

  const busyNow = paying !== "" || check === "running" || merging || waitingGuest && signedIn;
  const canPay = signedIn && lines.length > 0 && !busyNow && !blocked && !customsBusy;
  const payLabel = paying === "order" ? t.checkout.pay.busy : paying === "pay" ? t.checkout.pay.paying : merging || (waitingGuest && signedIn) ? t.merge.moving : check === "running" ? t.checkout.check.running : t.checkout.pay.button(formatSum(signedIn ? payable : shownSums.total, locale));

  const payButton = signedIn
    ? <button type="button" className="btn primary co-pay" disabled={!canPay} aria-busy={busyNow || undefined} onClick={() => void pay()}>{busyNow ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}<span>{payLabel}</span></button>
    : <a className="btn primary co-pay" href="#co-signin-title" onClick={(event) => { event.preventDefault(); const title = document.getElementById("co-signin-title"); title?.scrollIntoView({ block: "start", behavior: "smooth" }); title?.focus({ preventScroll: true }); }}><UserRound size={16} aria-hidden="true" /><span>{t.checkout.pay.signinFirst}</span></a>;

  return <div className="co-page">
    <header className="co-head">
      <Link className="co-back" href="/cart"><ArrowLeft size={16} aria-hidden="true" />{t.checkout.back}</Link>
      <h1>{t.checkout.title}</h1>
    </header>
    <div className="co-layout">
      <div className="co-main">
        {/* 1 · Вход */}
        <Block index={1} id="co-signin-title" title={t.checkout.signin.title} done={signedIn}>
          {signedIn ? <p className="co-signed" role="status"><UserRound size={16} aria-hidden="true" /><span>{t.checkout.signin.done(who)}</span></p>
            : loadingAccount ? <div className="login-skeleton" role="status"><span className="sr-only">{t.merge.moving}</span><i aria-hidden="true" /><b aria-hidden="true" /></div>
            : <><p className="co-hint">{t.checkout.signin.hint}</p><CheckoutSignIn locale={locale} onDone={() => void refresh()} /></>}
        </Block>

        {/* What changed at the store since the item was added (Сверка цены), and anything blocking the order. The live
            region is on the page from the start, so a screen reader announces the change when the check brings it. */}
        <p className="sr-only" aria-live="polite">{signedIn && changes.length > 0 ? (blocked ? cc.item.issues.variant : t.checkout.check.changedTitle) : ""}</p>
        {signedIn && (check === "running" || merging || waitingGuest) && <p className="co-checking" role="status"><Loader2 size={16} className="spin" aria-hidden="true" />{merging || waitingGuest ? t.merge.moving : t.checkout.check.running}</p>}
        {signedIn && check === "failed" && <p className="co-notice warn" role="alert"><TriangleAlert size={16} aria-hidden="true" /><span>{t.checkout.check.failed}</span><button type="button" className="text-button" onClick={() => void runCheck()}>{t.checkout.check.retry}</button></p>}
        {signedIn && changes.length > 0 && <section id="co-changes" className={"co-changes" + (blocked ? " is-blocked" : "")} aria-labelledby="co-changes-title">
          <h2 id="co-changes-title"><Info size={16} aria-hidden="true" />{blocked ? cc.item.issues.variant : t.checkout.check.changedTitle}</h2>
          <ul>{changes.map((item) => {
            const change = item.priceChange, currency = change?.currency ?? item.product.sourceCurrency ?? "USD";
            return <li key={item.id}><b>{item.product.name}</b>
              {change && change.price !== change.previousPrice && <span>{(change.price > change.previousPrice ? cc.item.priceUp : cc.item.priceDown)(storeMoney(change.previousPrice, currency, locale), storeMoney(change.price, currency, locale))}</span>}
              {change?.shipping !== undefined && change.shipping !== change.previousShipping && <span>{cc.item.shippingChanged(storeMoney(change.previousShipping ?? 0, item.product.sourceShippingCurrency ?? currency, locale), storeMoney(change.shipping, item.product.sourceShippingCurrency ?? currency, locale))}</span>}
              {item.sourceIssue && <span className={blockingSourceIssue(item) ? "co-issue" : ""}>{cc.item.issues[item.sourceIssue.kind]}</span>}
            </li>;
          })}</ul>
          <p className="co-hint">{blocked ? <Link href="/cart">{t.checkout.back}</Link> : t.checkout.check.changedHint}</p>
        </section>}

        {/* 2 · Получатель */}
        <Block index={2} id="co-recipient-title" title={t.checkout.recipient.title} locked={!signedIn} lockedText={t.checkout.signin.locked}
          aside={signedIn && state.deliveryProfiles.length > 0 && !listOpen ? <button type="button" className="text-button co-aside" onClick={openList}>{manual ? t.checkout.recipient.list : t.checkout.recipient.other}</button> : undefined}>
          {signedIn && <>
            {!listOpen && savedProfile && <div className="co-recipient-card">
              <MapPin size={18} aria-hidden="true" />
              <span><b>{savedProfile.recipient}</b><span className="nowrap">{savedProfile.phone}</span><small>{deliveryAddressLine(savedProfile)}</small></span>
            </div>}
            {listOpen && <fieldset className="co-recipients"><legend>{t.checkout.recipient.list}</legend>
              {state.deliveryProfiles.map((profile) => {
                const ok = isServedRegion(profile.region);
                return <label key={profile.id} className={"co-recipient" + (selected === profile.id ? " selected" : "") + (ok ? "" : " unavailable")}>
                  <input type="radio" name="co-recipient" value={profile.id} disabled={!ok} checked={selected === profile.id} onChange={() => { flushSync(() => { setChosen(profile.id); setTouched(false); setTouchedFields({}); setListOpen(false); }); document.getElementById("co-recipient-title")?.focus(); }} />
                  <span><b>{profile.recipient}{profile.primary && <em>{cc.checkout.primary}</em>}</b><span className="nowrap">{profile.phone}</span><small>{ok ? deliveryAddressLine(profile) : cc.checkout.outsideServed}</small></span>
                </label>;
              })}
              <label className={"co-recipient co-recipient-new" + (manual ? " selected" : "")}>
                <input type="radio" name="co-recipient" value="manual" checked={manual} onChange={() => { flushSync(() => { setChosen("manual"); setDraft({ ...emptyDelivery }); setTouched(false); setTouchedFields({}); setListOpen(false); }); document.getElementById(fieldIds.recipient)?.focus(); }} />
                <span><b><Plus size={16} aria-hidden="true" />{t.checkout.recipient.add}</b></span>
              </label>
            </fieldset>}
            {savedNeedsPostal && <div className={"field" + (invalid("savedPostal") ? " invalid" : "")}><label htmlFor={fieldIds.savedPostal}>{cc.checkout.postal}</label><input id={fieldIds.savedPostal} autoComplete="postal-code" inputMode="numeric" maxLength={6} required aria-invalid={invalid("savedPostal")} aria-describedby={describedBy("savedPostal", cc.checkout.postalMissing)} value={savedPostal} onBlur={(event) => touch("savedPostal", event.currentTarget.value)} onChange={(event) => setSavedPostal(event.target.value.replace(/\D/g, "").slice(0, 6))} />{hint("savedPostal", cc.checkout.postalMissing)}</div>}
            {manual && <div className="co-form">
              <div className="co-two">
                <div className={"field" + (invalid("recipient") ? " invalid" : "")}><label htmlFor={fieldIds.recipient}>{cc.checkout.recipient}</label><input id={fieldIds.recipient} autoComplete="name" autoCapitalize="words" required minLength={2} maxLength={100} aria-invalid={invalid("recipient")} aria-describedby={describedBy("recipient")} value={delivery.recipient} onBlur={(event) => touch("recipient", event.currentTarget.value)} onChange={(event) => setDelivery({ ...delivery, recipient: capitalizeWords(event.target.value) })} />{hint("recipient")}</div>
                <div className={"field" + (invalid("phone") ? " invalid" : "")}><label htmlFor={fieldIds.phone}>{cc.checkout.phone}<span className="sr-only"> +998</span></label><span className="rf-phone"><span aria-hidden="true">+998</span><UzPhoneInput id={fieldIds.phone} required aria-invalid={invalid("phone")} aria-describedby={describedBy("phone")} digits={uzPhoneDigits(delivery.phone)} onBlur={(event) => touch("phone", event.currentTarget.value)} onDigits={(digits) => setDelivery({ ...delivery, phone: uzPhone(digits) })} /></span>{hint("phone")}</div>
              </div>
              {onlyServedCity && <p className="co-served"><MapPin size={16} aria-hidden="true" /><span><b>{cc.checkout.city}: {regionLabel(onlyServedCity, locale)}</b><small>{cc.checkout.servedOnly}</small></span></p>}
              <div className={"field" + (invalid("address") ? " invalid" : "")}><label htmlFor={fieldIds.address}>{cc.checkout.street}</label><input id={fieldIds.address} list="co-streets" autoComplete="street-address" autoCapitalize="sentences" required minLength={5} maxLength={220} aria-invalid={invalid("address")} aria-describedby={describedBy("address")} placeholder={cc.checkout.streetPlaceholder} value={delivery.address} onBlur={(event) => touch("address", event.currentTarget.value)} onChange={(event) => setDelivery({ ...delivery, address: capitalizeFirst(event.target.value) })} /><datalist id="co-streets">{suggestions(streets, delivery.address).map((value) => <option key={value} value={value} />)}</datalist>{hint("address")}</div>
              <div className="co-two">
                <div className={"field" + (invalid("postal") ? " invalid" : "")}><label htmlFor={fieldIds.postal}>{cc.checkout.postal}</label><input id={fieldIds.postal} autoComplete="postal-code" inputMode="numeric" required maxLength={6} aria-invalid={invalid("postal")} aria-describedby={describedBy("postal", cc.checkout.postalHint)} value={delivery.postalCode} onBlur={(event) => touch("postal", event.currentTarget.value)} onChange={(event) => setDelivery({ ...delivery, postalCode: event.target.value.replace(/\D/g, "").slice(0, 6) })} />{hint("postal", cc.checkout.postalHint)}</div>
                {commentOpen || delivery.comment.trim()
                  ? <div className="field"><label htmlFor="co-comment">{cc.checkout.comment} <span className="rf-optional">({rc.optional})</span></label><input id="co-comment" maxLength={300} value={delivery.comment} onChange={(event) => setDelivery({ ...delivery, comment: event.target.value })} /></div>
                  : <button type="button" className="text-button co-add-comment" onClick={() => { flushSync(() => setCommentOpen(true)); document.getElementById("co-comment")?.focus(); }}><Plus size={16} aria-hidden="true" />{cc.checkout.addComment}</button>}
              </div>
              <div className="co-check"><Checkbox id="co-save-recipient" checked={saveRecipient} onCheckedChange={(value) => setSaveRecipient(value === true)} /><label htmlFor="co-save-recipient">{cc.checkout.saveRecipient}</label></div>
            </div>}
            <p className="co-note"><IdCard size={15} aria-hidden="true" />{t.checkout.recipient.passportLater}</p>
          </>}
        </Block>

        {/* 3 · Доставка */}
        <Block index={3} id="co-speed-title" title={t.checkout.speed.title} locked={!signedIn} lockedText={t.checkout.signin.locked}>
          {signedIn && <DeliverySpeedSwitch value={speed} options={deliverySpeedOptions(pricing, speedCountries, locale)} locale={locale} busy={speedBusy} note={fasterText(pricing, speedCountries, locale)} onChange={(next) => void changeSpeed(next)} />}
        </Block>

        {/* 4 · Таможня: only when this recipient owes a duty; otherwise one line in the sum says there is none. */}
        {signedIn && dutyDue > 0 && <Block index={4} id="co-customs-title" title={t.checkout.customs.title}>
          <CustomsPanel estimate={customs} choices={customsChoices} locale={locale} pricing={pricing} profiles={[]} onChoices={(next) => void saveCustoms(next)} helpAmount={customsHelpAmount} remembered={customsRemembered} busy={customsBusy} remember={customsRemember} onRemember={setCustomsRemember} />
          <div className={"co-check co-consent" + (consentError ? " invalid" : "")}>
            <Checkbox id="co-consent" aria-label={cc.checkout.consent.before + cc.checkout.consent.link + cc.checkout.consent.after} checked={consent} aria-invalid={consentError} aria-describedby={consentError ? "co-consent-error" : undefined} onCheckedChange={(value) => { setConsent(value === true); if (value === true) setConsentError(false); }} />
            <label htmlFor="co-consent">{cc.checkout.consent.before}<Link href="/customs" target="_blank">{cc.checkout.consent.link}</Link>{cc.checkout.consent.after}</label>
          </div>
          {consentError && <p id="co-consent-error" className="co-error" role="alert">{cc.checkout.consentRequired}</p>}
        </Block>}
      </div>

      {/* 5 · Из чего сумма, promo code and the pay button; stays in view on a wide screen. */}
      <aside className="co-summary" aria-labelledby="co-sum-title">
        <h2 id="co-sum-title">{t.checkout.sum.title}</h2>
        <ul className="co-items">{shownLines.map((item) => <li key={item.id}>
          <span className="co-item-photo"><ProductImage product={item.product} locale={locale} decorative size={120} /></span>
          <span className="co-item-text"><b>{item.product.name}</b><small>{[shownVariant(item.variant, item.product.sourceOptions), item.quantity > 1 ? `× ${item.quantity}` : ""].filter(Boolean).join(" · ")}</small></span>
          {shownLines.length > 1 && <span className="co-item-sum">{formatSum(item.quote.merchandise, locale)}</span>}
        </li>)}</ul>
        {later > 0 && <p className="co-hint">{t.checkout.sum.later(later)}</p>}
        <dl className="co-lines">
          <div><dt>{t.checkout.sum.item}</dt><dd><Money value={shownSums.merchandise} locale={locale} /></dd></div>
          <div><dt>{t.checkout.sum.service}<small>{shownSums.customsHelp > 0 ? t.checkout.sum.serviceHelpCustoms(formatPercent(pricing.margin + pricing.buyoutFee + pricing.conversionFee, locale), formatSum(shownSums.customsHelp, locale)) : t.checkout.sum.serviceHelp(formatPercent(pricing.margin + pricing.buyoutFee + pricing.conversionFee, locale))}</small></dt><dd><Money value={shownSums.service + shownSums.buyout + shownSums.conversion + shownSums.customsHelp} locale={locale} /></dd></div>
          {discount > 0 && promo && <div className="co-line-promo"><dt><span><Tag size={14} aria-hidden="true" />{t.checkout.sum.promo(promoCodeText(promo.code, locale))}</span><small>{t.checkout.sum.promoBase}</small></dt><dd>−<Money value={discount} locale={locale} /></dd></div>}
          <div><dt>{t.checkout.sum.delivery(kgText(shownWeight, locale), k.speeds[signedIn ? speed : "standard"].toLowerCase())}</dt><dd><Money value={shownSums.shipping + shownSums.deliveryMargin + shownSums.reserve} locale={locale} /></dd></div>
          {shownSums.sourceShipping > 0 && <div><dt>{t.checkout.sum.storeShipping}</dt><dd><Money value={shownSums.sourceShipping} locale={locale} /></dd></div>}
          {shownSums.insurance > 0 && <div><dt>{t.checkout.sum.guarantee}</dt><dd><Money value={shownSums.insurance} locale={locale} /></dd></div>}
          {shownSums.optionalServices > 0 && <div><dt>{k.lines.optional}</dt><dd><Money value={shownSums.optionalServices} locale={locale} /></dd></div>}
          {signedIn && (duty > 0
            ? <div><dt>{t.checkout.sum.duty}</dt><dd><Money value={duty} locale={locale} /></dd></div>
            : dutyDue > 0 ? <div className="co-line-apart"><dt>{t.checkout.sum.duty} ≈</dt><dd>{formatSum(dutyDue, locale)}</dd></div>
            : <div className="co-line-zero"><dt>{t.checkout.customs.none}</dt><dd><Money value={0} locale={locale} /></dd></div>)}
          {guestDuty && <div className="co-line-apart"><dt>{t.checkout.sum.dutyLater}</dt><dd>—</dd></div>}
          {credit > 0 && <div><dt>{t.checkout.sum.balance}</dt><dd>−<Money value={credit} locale={locale} /></dd></div>}
          <div className="co-total"><dt>{t.checkout.sum.total}</dt><dd>{!signedIn && "≈ "}<Money value={signedIn ? payable : shownSums.total} locale={locale} animate /></dd></div>
        </dl>
        {shownSums.storeShippingHold > 0 && <p className="co-hint">{t.checkout.sum.hold(formatSum(shownSums.storeShippingHold, locale))}</p>}
        {!signedIn && <p className="co-hint">{t.guest.estimate}</p>}
        {signedIn && balance > 0 && <div className="co-check"><Checkbox id="co-balance" checked={useBalance} onCheckedChange={(value) => setUseBalance(value === true)} /><label htmlFor="co-balance">{cc.summary.balance}<small>{cc.summary.available}: {formatSum(balance, locale)}</small></label></div>}

        {/* 6 · Промокод */}
        {signedIn && <div className="co-promo">
          {promo && discount > 0 ? <p id="co-promo-applied" className="co-promo-applied" role="status" tabIndex={-1}><BadgeCheck size={16} aria-hidden="true" /><span>{t.checkout.promo.applied(promoCodeText(promo.code, locale), formatSum(discount, locale))}<small>{t.checkout.promo.onlyService}</small></span><button type="button" className="icon-btn" aria-label={t.checkout.promo.remove} onClick={() => { setPromo(null); setPromoText(""); setPromoError(""); }}><X size={16} aria-hidden="true" /></button></p>
            : promoOpen || promoText || promoError ? <form className="co-promo-form" noValidate onSubmit={(event) => { event.preventDefault(); void applyPromo(); }}>
              <label htmlFor="co-promo-input">{t.checkout.promo.label}</label>
              <div className="co-promo-row">
                <input id="co-promo-input" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={40} placeholder={t.checkout.promo.placeholder} aria-invalid={Boolean(promoError || promoBelowMin) || undefined} aria-describedby="co-promo-hint" value={promoText} onChange={(event) => { setPromoText(event.target.value); setPromoError(""); if (promo) setPromo(null); }} />
                <button type="submit" className="btn secondary" disabled={promoBusy || !promoText.trim()} aria-busy={promoBusy || undefined}>{promoBusy ? <Loader2 size={16} className="spin" aria-label={t.checkout.promo.checking} /> : t.checkout.promo.apply}</button>
              </div>
              <small id="co-promo-hint" className={promoError || promoBelowMin ? "co-error" : ""} role={promoError || promoBelowMin ? "alert" : undefined}>{promoError || (promoBelowMin && promo?.minOrder ? serverError(locale, "err_90") + " " + t.checkout.promo.minOrder(formatSum(promo.minOrder, locale)) : t.checkout.promo.onlyService)}</small>
            </form>
            : <button type="button" className="text-button co-promo-open" onClick={() => { flushSync(() => setPromoOpen(true)); document.getElementById("co-promo-input")?.focus(); }}><Tag size={15} aria-hidden="true" />{t.checkout.promo.open}</button>}
        </div>}
        {signedIn && dutyDue <= 0 && <p className="co-hint">{cc.checkout.consentImplied.before}<Link href="/customs" target="_blank">{cc.checkout.consentImplied.link}</Link>{cc.checkout.consentImplied.after}</p>}
        {/* On a wide screen the button stands under the sum it pays (the aside stays in view); on a phone it is in the pinned bar. */}
        <div className="co-summary-pay">{payButton}</div>
        <p className="co-demo">{t.checkout.pay.demo}</p>
      </aside>
    </div>

    {/* The pay bar: pinned to the bottom on every screen, above the phone's home indicator (safe area). */}
    <div className="co-paybar" role="region" aria-label={t.checkout.sum.total}>
      <div className="co-paybar-inner">
        <div className="co-paybar-sum"><span>{signedIn ? t.checkout.sum.total : t.checkout.sum.items(shownLines.reduce((sum, item) => sum + item.quantity, 0))}</span><strong>{!signedIn && "≈ "}<Money value={signedIn ? payable : shownSums.total} locale={locale} /></strong></div>
        {payButton}
      </div>
    </div>
  </div>;
}

/** «Заказ принят»: the order numbers, the paid mark (demo), and the passport as the next step. */
function PlacedView({ orders, loading, guest, paying, locale, onSignedIn }: { orders: Order[]; loading: boolean; guest: boolean; paying: boolean; locale: Locale; onSignedIn: () => void }) {
  const { state } = useMarket();
  const t = checkoutCopy[locale].success;
  const first = orders[0];
  const recipientId = first?.deliveryProfileId;
  const identities = state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);
  const passportReady = Boolean(first?.identity || (recipientId && identities.some((identity) => identity.recipientProfileId === recipientId)));
  const paid = orders.length > 0 && orders.every((order) => order.payment?.status === "paid");
  // The screen says what happened: the heading takes the focus (a screen reader reads it) and the tab is named after it.
  useEffect(() => {
    document.getElementById("co-placed-title")?.focus();
    const before = document.title;
    document.title = t.title + " · Atlas";
    return () => { document.title = before; };
  }, [t.title]);
  return <div className="co-page co-placed-page">
    <section className="co-placed" aria-labelledby="co-placed-title">
      <svg className="co-placed-mark" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" /><path d="M20 33.5l8 8 16-17" /></svg>
      <h1 id="co-placed-title" tabIndex={-1}>{t.title}</h1>
      {guest ? <div className="co-placed-signin"><p>{t.signin}</p><CheckoutSignIn locale={locale} onDone={onSignedIn} /></div>
        : loading || !first ? <p className="co-hint"><Loader2 size={16} className="spin" aria-hidden="true" /></p> : <>
        <p>{t.text(orders.length)}</p>
        <dl className="co-placed-facts">
          <div><dt>{t.numbers}</dt><dd>{orders.map((order) => <Link key={order.id} href={"/orders#" + encodeURIComponent(order.id)}>{order.id}</Link>)}</dd></div>
          <div><dt>{t.total}</dt><dd><Money value={orders.reduce((sum, order) => sum + order.quote.total, 0)} locale={locale} />{paid ? <em className="co-paid"><CircleCheck size={14} aria-hidden="true" />{t.paid}</em> : paying ? <Loader2 size={14} className="spin" aria-hidden="true" /> : null}</dd></div>
        </dl>
        <p className="co-demo">{t.demo}</p>
      </>}
      {/* Only the paid mark is announced when it arrives, not the whole screen again. */}
      <p className="sr-only" aria-live="polite">{paid ? t.paidNow : ""}</p>
    </section>
    {first && <section className="co-passport" aria-labelledby="co-passport-title">
      <IdCard size={22} aria-hidden="true" />
      <div>
        <h2 id="co-passport-title">{t.passportTitle}</h2>
        <p>{passportReady ? t.passportReady : t.passportText(first.delivery?.recipient ?? "")}</p>
      </div>
      {!passportReady && <Link className="btn primary" href={recipientId ? `/identity?recipient=${encodeURIComponent(recipientId)}` : "/identity"}>{t.addPassport}<ArrowRight size={18} aria-hidden="true" /></Link>}
    </section>}
    {!guest && <div className="co-placed-links"><Link className="btn secondary" href={first ? "/orders#" + encodeURIComponent(first.id) : "/orders"}>{t.orders}</Link><Link className="text-button" href="/catalog">{t.catalog}</Link></div>}
  </div>;
}
