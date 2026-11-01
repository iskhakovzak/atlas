"use client";
import { shownBrand } from "@/lib/importer/brand-name";

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/site-link";
import { ArrowRight, ArrowUpRight, BadgeCheck, Bookmark, ClipboardPaste, Clock3, Heart, Info, Loader2, MessageSquare, Minus, Package, Plus, RotateCcw, ShieldCheck, ShoppingBag, Store, TriangleAlert, Truck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMarket } from "@/lib/market/store";
import { cartDeliverySpeed, checkoutLines, customsHelpChosen, inCheckout, maxLineQuantity, parcelServiceUnits, storeDiscount, storeParcelKey, storeShippingReserves, totalOf, serviceTitle, serviceDescription, serviceFeeForCountry, withCustomsHelpFor, type CartItem, type DeliverySpeed, type Product } from "@/lib/market/domain";
import { guaranteeAmount, parcelRoomKg, parcelStoreHost, reorderCandidates, uninsuredParcelLimit } from "@/lib/market/cart-parcel";
import { orderGroupCopy } from "@/lib/market/order-groups";
import { LazyProductSheet } from "./product-sheet-lazy";
import { loadChunk } from "@/lib/market/stale-build";
import { daysRangeFor, deliverySpeedCopy, deliverySpeedOptions, fasterText } from "@/lib/market/delivery-speed";
import { countryName } from "@/lib/market/world";
import { formatKg, formatPercent, formatSum, formatUsd } from "@/lib/market/format";
import { cartCopy, countryLabel, itemCount, linkOrderCopy, parcelCount, type CartCopy } from "@/lib/market/customer-copy";
import { cartCustomsEstimate } from "@/lib/market/allowance";
import { calcCopy } from "@/lib/market/calc-copy";
import { CalcLines, CustomsPanel, DeliverySpeedSwitch, HoldNote, customsDutyAmount, sumQuotes, usdText } from "./calc-summary";
import type { Locale } from "@/lib/market/i18n";
import { LoadingCards, ProductImage, WasPrice } from "./market-ui";
import { Money } from "./money";
import { SafeDeleteButton } from "./safe-delete-button";
import { toast } from "@/lib/market/toast";
import { usePendingCartAdd } from "./pending-cart-add";
import { GuestCartView, GuestProblems } from "./guest-cart-view";
import { useGuestCart, useGuestMerging } from "./use-guest-cart";
import { checkoutCopy } from "@/lib/market/checkout-copy";
import { pendingCartFreshMs } from "@/lib/market/link-order-draft";
import {uzText,withCyrillic} from '@/lib/market/uz-cyrl';
import {isUzbek} from '@/lib/market/i18n';
import { catalogUrlKey, sameCatalogProduct, storeHost } from "@/lib/market/catalog-query";

// The rows of catalog cards under the cart (picks under an empty one, saved products under a full one) are their own
// chunk: they need the catalog anyway and sit below everything the cart is for.
const CartPicks = lazy(() => loadChunk(() => import("./cart-picks")).then((module) => ({ default: module.CartPicks })));

/** Favourites and removal in the cart: saving keeps the line; "save for later" saves and then removes it. */
const keepCopy = /*@__PURE__*/withCyrillic({
  ru: { save: "В избранное", saved: "В избранном", later: "Отложить", laterLabel: "Отложить в избранное", laterDone: "Отложено в избранное", open: "Открыть избранное", removed: (name: string) => `Удалено из корзины: ${name}`, undo: "Вернуть", removeVariant: "Удалить вариант", removeAll: (n: number) => `Удалить все (${n})`, variants: "Варианты этого товара" },
  uz: { save: "Saqlanganlarga", saved: "Saqlanganlarda", later: "Qoldirish", laterLabel: "Saqlanganlarga qoldirish", laterDone: "Saqlanganlarga qoldirildi", open: "Saqlanganlarni ochish", removed: (name: string) => `Savatdan olib tashlandi: ${name}`, undo: "Qaytarish", removeVariant: "Variantni o‘chirish", removeAll: (n: number) => `Hammasini o‘chirish (${n})`, variants: "Shu tovar variantlari" },
  en: { save: "Save", saved: "Saved", later: "Later", laterLabel: "Save for later", laterDone: "Moved to favourites", open: "Open favourites", removed: (name: string) => `Removed from cart: ${name}`, undo: "Undo", removeVariant: "Remove option", removeAll: (n: number) => `Remove all (${n})`, variants: "Options of this product" },
});
import { useStickyFit } from "./sticky-fit";
import { productGroups, shownVariant, storeName } from "./checkout-review";
import { cartColourOptions } from "@/lib/market/domain";
import { readableNikeSizeLabel } from "@/lib/market/nike-size-chart";
import { cartSelectCopy } from "@/lib/market/cart-select-copy";

/** More than one dispatch country in the cart: the speed note says it applies to every parcel. */
const parcelsDiffer = (countries: string[]) => new Set(countries).size > 1;

/** Lines of one product (sizes or colors of the same store item) sit together and share one note (owner, 7.10.2026). */

/** An amount in the store's currency, e.g. "$29,99" or "129,90 RON"; dollars sign first, as everywhere on the site (usdText). */
function sourceMoney(amount: number, currency: string, locale: Locale) {
  if (currency === "USD") return usdText(amount, locale);
  try { return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${amount} ${currency}`; }
}
/** Store price as the shop shows it. */
const storePrice = (item: CartItem, locale: Locale) => sourceMoney(item.product.sourcePrice ?? item.product.usd, item.product.sourceCurrency ?? "USD", locale);
const clock = (at: number, locale: Locale) => new Date(at).toLocaleTimeString(locale === "ru" ? "ru-RU" : isUzbek(locale) ? uzText(locale, "uz-UZ") : "en-US", { hour: "2-digit", minute: "2-digit" });

/**
 * Quantity stepper that waits for a pause (400 ms) before saving, so quick taps add up to one request
 * instead of being dropped while the previous one is still saving. Remounted (by key) on a server change.
 * A save still waiting out its pause sits in `pending`, so "Check out" can send it at once and check out the new quantity.
 */
function QuantityControl({ item, c, save, pending }: { item: CartItem; c: CartCopy; save: (quantity: number) => Promise<boolean>; pending: Map<string, () => Promise<boolean>> }) {
  const [value, setValue] = useState(item.quantity);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushRef = useRef<(() => Promise<boolean>) | undefined>(undefined);
  const id = item.id;
  useEffect(() => () => { clearTimeout(timer.current); if (pending.get(id) === flushRef.current) pending.delete(id); }, [pending, id]);
  // Never more than the store reports left (when it reports a count at all).
  const max = Math.max(1, maxLineQuantity(item.product));
  const optionName = [item.product.name, shownVariant(item.variant, item.product.sourceOptions)].filter(Boolean).join(" · ");
  function step(delta: number) {
    const next = Math.min(max, Math.max(1, value + delta));
    if (next === value) return;
    setValue(next);
    clearTimeout(timer.current);
    const flush = () => { clearTimeout(timer.current); if (pending.get(id) === flush) pending.delete(id); return save(next).then((ok) => { if (!ok) setValue(item.quantity); return ok; }); };
    flushRef.current = flush; pending.set(id, flush);
    timer.current = setTimeout(() => void flush(), 400);
  }
  return <div className="basket-qty" role="group" aria-label={`${c.item.quantity}: ${optionName}`}>
    <button type="button" aria-label={`${c.item.decrease}: ${optionName}`} disabled={value <= 1} onClick={() => step(-1)}><Minus size={16} aria-hidden="true" /></button>
    <output aria-live="polite">{value}</output>
    <button type="button" aria-label={`${c.item.increase}: ${optionName}`} disabled={value >= max} onClick={() => step(1)}><Plus size={16} aria-hidden="true" /></button>
  </div>;
}

/** The customer's note on a cart line (or on all options of one product): shown when set, edited in place, saved on blur; never sent to the store. */
function ItemNote({ id, note, locale, save }: { id: string; note: string; locale: Locale; save: (note: string) => Promise<boolean> }) {
  const k = calcCopy[locale];
  const [open, setOpen] = useState(Boolean(note));
  const [text, setText] = useState(note);
  if (!open) return <button type="button" className="basket-note-add" onClick={() => setOpen(true)}><MessageSquare size={16} aria-hidden="true" />{k.blocks.comment}</button>;
  return <div className="basket-note">
    <label htmlFor={`note-${id}`}>{k.blocks.comment}<small> · {k.commentHint}</small></label>
    <textarea id={`note-${id}`} rows={2} maxLength={500} value={text} placeholder={k.commentPlaceholder} onChange={(event) => setText(event.target.value)}
      onBlur={() => { if (text.trim() !== note) void save(text); if (!text.trim()) setOpen(false); }} />
  </div>;
}

/**
 * After the 15-minute price hold: "we check prices with the stores first". No countdown before it (14.10.2026: a ticking
 * timer reads as pressure, and an expired hold loses nothing). Ticks on its own so the rest of the cart does not re-render.
 */
function PriceHold({ expiresAt, c }: { expiresAt: number; c: CartCopy }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0), timer = setInterval(tick, 15000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  // After the hold the total is not lost: "Check out" checks the stores and reprices first.
  if (!now || now < expiresAt) return null;
  return <p className="basket-expiry"><Clock3 size={16} aria-hidden="true" />{c.summary.recheckNote}</p>;
}

/** Dollars rounded up to the cent, sign first ("$12,50"), as the rest of the cart writes them. */
const usd = (amount: number, locale: Locale) => usdText(Math.ceil(amount * 100 - 1e-6) / 100, locale);

/** Long store titles are cut to three lines; a tap shows the whole name. */
function ItemName({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  return <h3 className={"basket-name" + (open ? " open" : "")}>{name.length > 70
    ? <button type="button" className="basket-name-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>{name}</button>
    : name}</h3>;
}

export function CartView() {
  const { state, act, ready, error, status, pricing, catalogProducts, catalogReady, loadCatalog } = useMarket();
  // Lines of this browser's guest cart that the store refused when they moved into the account, and the move itself.
  const guestCart = useGuestCart(), merging = useGuestMerging();
  const guestProblems = guestCart.cart.lines.filter((line) => line.problem);
  const [favoriteBusy, setFavoriteBusy] = useState("");
  // Catalog products by their store page, built once per catalog, so each line finds its product in one lookup.
  const catalogByUrl = useMemo(() => new Map(catalogProducts.flatMap((product) => product.sourceUrl ? [[catalogUrlKey(product.sourceUrl), product] as const] : [])), [catalogProducts]);
  // Favourites hold catalog products: a cart line can be saved when it is a product from the Atlas catalog.
  // Only lines with a store page can be catalog products; the catalog loads once the cart is on screen, never before it.
  // An empty cart shows the catalog's picks and saved products show under a full one, so those need it too.
  const needsCatalog = ready && (!state.cart.length || state.favorites.length > 0 || state.cart.some((line) => line.product.sourceUrl));
  // The product opened from a row of catalog cards under the cart (CartPicks).
  const [picked, setPicked] = useState<Product | null>(null);
  // Stores the catalog has more of (by host, products not already in the cart): a parcel from one links to the catalog filtered by it.
  const catalogHosts = useMemo(() => new Set(catalogProducts.flatMap((product) => product.sourceUrl && !state.cart.some((line) => sameCatalogProduct(line.product, product)) ? [storeHost(product)] : [])), [catalogProducts, state.cart]);
  // Saved products not already in the cart, shown under it: the customer's own choice, not a recommendation.
  const savedPicks = useMemo(() => catalogReady ? catalogProducts.filter((product) => state.favorites.includes(product.id) && !state.cart.some((line) => sameCatalogProduct(line.product, product))) : [], [catalogReady, catalogProducts, state.favorites, state.cart]);
  // An empty cart: how many saved products there are (the catalog's, once it is here) and the last delivered ones to order again.
  const favoriteCount = catalogReady ? catalogProducts.filter((product) => state.favorites.includes(product.id)).length : state.favorites.length;
  const reorders = useMemo(() => reorderCandidates(state.orders), [state.orders]);
  useEffect(() => {
    if (!needsCatalog) return;
    if ("requestIdleCallback" in window) { const handle = window.requestIdleCallback(() => void loadCatalog(), { timeout: 2000 }); return () => window.cancelIdleCallback(handle); }
    const timer = setTimeout(() => void loadCatalog(), 300);
    return () => clearTimeout(timer);
  }, [needsCatalog, loadCatalog]);
  // Quantity saves still waiting out their pause (line id -> send now); "Check out" sends them first.
  const [pendingQuantities] = useState(() => new Map<string, () => Promise<boolean>>());
  // Parcel services shown as chosen at once while they save (parcel key -> the choice being saved); clicks queue up.
  // The ref holds the latest choice at once, so a second click in the same moment builds on the first one.
  const [serviceDrafts, setServiceDrafts] = useState<Record<string, { serviceIds: string[]; units: Record<string, number>; savingId: string }>>({});
  const serviceDraftsRef = useRef(serviceDrafts);
  const setDrafts = (next: typeof serviceDrafts) => { serviceDraftsRef.current = next; setServiceDrafts(next); };
  // Checkboxes shown at once while the server reprices the lines left for later (line id -> ticked).
  const [selectDrafts, setSelectDrafts] = useState<Record<string, boolean>>({});
  const [verifying, setVerifying] = useState(false);
  const [summaryCta, setSummaryCta] = useState<HTMLButtonElement | null>(null);
  const [customsRecipient, setCustomsRecipient] = useState("");
  const [customsBusy, setCustomsBusy] = useState(false);
  const [summaryCtaInView, setSummaryCtaInView] = useState(false);
  const [speedBusy, setSpeedBusy] = useState(false);

  // The phone bar repeats the total and the button; it steps aside while the summary's own button is on screen.
  useEffect(() => {
    if (!summaryCta || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setSummaryCtaInView(entry.isIntersecting), { rootMargin: "0px 0px -150px 0px" });
    observer.observe(summaryCta);
    return () => observer.disconnect();
  }, [summaryCta]);

  const summaryRef = useStickyFit();

  // Services switched off or made required are put right by the server whenever it renews the cart (renewCart).

  const locale = state.communication.language;
  const c = cartCopy[locale];
  const k = calcCopy[locale];
  // A link-order item a guest asked for before signing in lands here too when the cart is opened first, if it was asked
  // for minutes ago (an older one waits for its own item page). The toast names it, so nobody gets an item unnoticed.
  const pendingWords = linkOrderCopy[locale].pending;
  const pendingAdd = usePendingCartAdd(true, (result) => {
    const action = result.pending.action;
    if (result.status === "added") {
      const name = action.type === "cart-add" ? action.product.name : action.items[0]?.product.name ?? "";
      toast.success(pendingWords.addedItem(name, result.pending.units) + (result.speedKept ? " " + pendingWords.speedKept : ""));
      return;
    }
    // act() already showed the server's reason, worded for the item page ("we loaded the new price"); here one message.
    toast.dismiss();
    toast.error(result.status === "changed" ? pendingWords.changedElsewhere : pendingWords.failedElsewhere, { action: { label: pendingWords.open, onClick: () => window.location.assign(result.pending.returnTo) } });
  }, { maxAgeMs: pendingCartFreshMs });
  // Only the ticked lines are checked out now; the rest stay in the cart, priced as their own parcels (owner, 7.10.2026).
  const lines = checkoutLines(state.cart);
  const s = cartSelectCopy[locale];
  const ticked = (item: CartItem) => selectDrafts[item.id] ?? inCheckout(item);
  const selecting = Object.keys(selectDrafts).length > 0;
  const earliestExpiry = lines.reduce((min, item) => Math.min(min, item.quote.expiresAt), Infinity);
  const count = lines.reduce((sum, item) => sum + item.quantity, 0);
  const allCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const laterCount = allCount - count;
  // Customs: the allowance is per recipient and calendar month; the customer picks whose it is.
  const primaryProfile = state.deliveryProfiles.find(profile => profile.primary) ?? state.deliveryProfiles[0];
  const customsProfile = state.deliveryProfiles.find(profile => profile.id === customsRecipient) ?? primaryProfile;
  // This cart's choice, else the one remembered from an earlier cart (the server prices the lines the same way).
  const customsChoices = state.cartCustoms ?? { outsideUsed: false, help: customsHelpChosen(state) };
  const customsRemembered = !state.cartCustoms && state.customsPreference !== undefined;
  const [customsRemember, setCustomsRemember] = useState(true);
  const customs = cartCustomsEstimate(state, pricing, { profile: customsProfile, name: customsProfile ? undefined : state.deliveryProfile?.recipient }, customsChoices);
  // "Atlas pays customs for me" prepays the estimated duty: for the cart's recipient here, for the chosen one at checkout.
  const cartDuty = customsChoices.help ? customsDutyAmount(customs, pricing) : 0;
  // No duty for the recipient: the customs fee is not in the bill (owner, 7.10.2026); the server bills the same way.
  // The Atlas balance and the recipient are chosen on the checkout page (redesign stage 6): the cart shows the total.
  const billed = withCustomsHelpFor(lines, customs, pricing.fx);
  const total = totalOf(billed);
  const payable = total + cartDuty;
  const lineTotal = (item: CartItem, lines = billed) => lines.find(line => line.id === item.id)?.quote.total ?? item.quote.total;
  // Owner, 7.10.2026: with duty to pay and nothing chosen yet, "Atlas pays customs" is the starting choice. Sent once;
  // the fee then shows on the card and in the bill, and "I will pay myself" is one tap away.
  const customsDefaulted = useRef(false);
  const customsDefault = !state.cartCustoms && state.customsPreference === undefined && lines.length > 0 && customsDutyAmount(customs, pricing) > 0;
  useEffect(() => {
    if (!customsDefault || customsDefaulted.current || customsBusy) return;
    customsDefaulted.current = true;
    void act({ type: "cart-customs", value: { outsideUsed: false, help: true } });
  }, [customsDefault, customsBusy, act]);
  // "Atlas pays customs for me": the same per-line rounding as the server; once chosen, the fee is in the bill.
  const customsHelpAmount = customsChoices.help
    ? lines.reduce((sum, item) => sum + (item.quote.customsHelp ?? 0), 0)
    : lines.reduce((sum, item) => sum + Math.round(item.quote.merchandise * pricing.customsHelpFee), 0);
  // Insurance (paid with the order) leads the list: it is the one choice that changes the total right away.
  const checkoutServices = pricing.serviceCatalog.filter((service) => service.enabled && service.requestStage === "checkout")
    .sort((a, b) => Number(b.pricingMode === "value-percent") - Number(a.pricingMode === "value-percent"));
  const sums = sumQuotes(billed.map(item => item.quote));
  const cartWeight = Math.round(lines.reduce((sum, item) => sum + item.quote.weight, 0) * 100) / 100;
  // One delivery speed for the whole cart; the windows and rates cover every dispatch country in it.
  const speed = cartDeliverySpeed(state.cart);
  const speedCountries = state.cart.map(item => countryName(item.product));
  const speedOptions = deliverySpeedOptions(pricing, speedCountries, locale);
  // How much sooner express arrives stays in view (owner, 14.10.2026: not the price difference, the cards show the rates);
  // "one speed for every parcel" is the secondary rule (a "?" on phones).
  const speedNote = fasterText(pricing, speedCountries, locale);
  const speedTip = parcelsDiffer(speedCountries) ? deliverySpeedCopy[locale].appliesToCart : undefined;
  const speedDays = (country: string) => { const range = daysRangeFor(pricing, [country], speed); return range ? deliverySpeedCopy[locale].days(range[0], range[1]) : ""; };
  // Store orders whose delivery price is unknown: a separate hold up to the threshold, free above it.
  const reserves = storeShippingReserves(lines, pricing);
  // One block per store parcel: one store shipping from one country (a second dispatch country is a second block).
  const parcels = state.cart.reduce<{ key: string; store: string; title: string; country: string; origin: string; items: CartItem[] }[]>((groups, item) => {
    const key = storeParcelKey(item);
    const group = groups.find(entry => entry.key === key);
    if (group) group.items.push(item);
    else { const store = storeName(item, locale); groups.push({ key, store, title: c.item.parcelFrom(store), country: countryLabel(countryName(item.product), locale), origin: countryName(item.product), items: [item] }); }
    return groups;
  }, []);

  /** Ticks or unticks lines at once on screen; the server reprices both parts. Clicks made while saving queue up. */
  async function select(ids: string[], selected: boolean) {
    const changed = state.cart.filter(item => ids.includes(item.id) && ticked(item) !== selected).map(item => item.id);
    if (!changed.length) return;
    setSelectDrafts(drafts => ({ ...drafts, ...Object.fromEntries(changed.map(id => [id, selected])) }));
    try { await act({ type: "cart-select", ids: changed, selected }, { queue: true }); }
    finally { setSelectDrafts(drafts => Object.fromEntries(Object.entries(drafts).filter(([id, value]) => !changed.includes(id) || value !== selected))); }
  }
  /** Checkbox state of several lines: all, none or some ("indeterminate"). */
  const tickState = (items: CartItem[]) => items.every(ticked) ? true : items.some(ticked) ? "indeterminate" as const : false;
  const selectBox = (items: CartItem[], label: string) => <span className="basket-select"><Checkbox aria-label={label} checked={tickState(items)} onCheckedChange={() => void select(items.map(item => item.id), tickState(items) !== true)} /></span>;

  async function changeSpeed(next: DeliverySpeed) {
    if (speedBusy) return;
    setSpeedBusy(true);
    try { await act({ type: "cart-delivery-speed", speed: next }); }
    finally { setSpeedBusy(false); }
  }

  /**
   * "Check out": a quantity tapped a moment ago is saved first (queued), then the one-page checkout opens
   * (/cart/checkout, redesign stage 6). It checks prices with the stores itself, so nothing is asked here.
   */
  async function openCheckout() {
    if (verifying || selecting) return;
    if (!lines.length) { toast.message(s.noneSelected); return; }
    setVerifying(true);
    const saved = (await Promise.all([...pendingQuantities.values()].map((flush) => flush()))).every(Boolean);
    if (!saved) { setVerifying(false); return; }
    window.location.assign("/cart/checkout");
  }

  const kc = keepCopy[locale];
  const catalogMatch = (item: CartItem) => item.product.sourceUrl ? catalogByUrl.get(catalogUrlKey(item.product.sourceUrl)) : undefined;
  async function toggleFavorite(id: string) {
    if (favoriteBusy) return false;
    setFavoriteBusy(id);
    try { return await act({ type: "favorite", id }); } finally { setFavoriteBusy(""); }
  }
  /** Saved, then every given line leaves the cart in one request. */
  async function saveForLater(lines: CartItem[], id: string) {
    if (!state.favorites.includes(id) && !await toggleFavorite(id)) return;
    const ids = lines.map((line) => line.id);
    if (await act({ type: "cart-remove", id: ids[0], ids: ids.length > 1 ? ids : undefined })) toast.success(kc.laterDone, { action: { label: kc.open, onClick: () => window.location.assign("/favorites") } });
  }
  /** Removes the lines, then offers «Вернуть» for 8 s: the server restores its own copy of them (cart-restore).
   *  Both wait for a save already under way (`queue`) instead of being dropped, since one tap now removes. */
  async function removeWithUndo(ids: string[], name: string) {
    const removed = await act({ type: "cart-remove", id: ids[0], ids: ids.length > 1 ? ids : undefined }, { queue: true });
    if (removed) toast.message(kc.removed(name), { duration: 8000, action: { label: kc.undo, onClick: () => void restoreLines(ids, name) } });
    return removed;
  }
  async function restoreLines(ids: string[], name: string) {
    // The toast closes on its button; if the restore did not go through, a new toast offers it again.
    if (!await act({ type: "cart-restore", ids }, { queue: true })) toast.error(kc.removed(name), { duration: 8000, action: { label: kc.undo, onClick: () => void restoreLines(ids, name) } });
  }
  /** The heart (keeps the line) and "save for later" (saves, then removes), for a catalog product only. */
  function keepActions(lines: CartItem[]) {
    const match = catalogMatch(lines[0]);
    if (!match) return null;
    const saved = state.favorites.includes(match.id);
    return <>
      <button type="button" className={"basket-fav" + (saved ? " saved" : "")} aria-pressed={saved} aria-label={kc.save} title={saved ? kc.saved : kc.save} disabled={Boolean(favoriteBusy)} aria-busy={favoriteBusy === match.id || undefined} onClick={() => void toggleFavorite(match.id)}><Heart size={18} aria-hidden="true" /></button>
      <button type="button" className="basket-later" aria-label={kc.laterLabel} title={kc.laterLabel} disabled={Boolean(favoriteBusy)} onClick={() => void saveForLater(lines, match.id)}><Bookmark size={16} aria-hidden="true" /><span>{kc.later}</span></button>
    </>;
  }
  /** What the last check with the store found: a new price (already in the total) or something to fix. */
  function itemNotes(item: CartItem) {
    const change = item.priceChange, issue = item.sourceIssue, currency = change?.currency ?? item.product.sourceCurrency ?? "USD";
    const reopen = item.product.sourceUrl ? `/order-by-link?url=${encodeURIComponent(item.product.sourceUrl)}` : "";
    return <>
      {change && <p className={"basket-item-note " + (change.price > change.previousPrice || (change.shipping ?? 0) > (change.previousShipping ?? 0) ? "up" : "down")} role="status">
        <Info size={16} aria-hidden="true" /><span>
          {change.price !== change.previousPrice && (change.price > change.previousPrice ? c.item.priceUp : c.item.priceDown)(sourceMoney(change.previousPrice, currency, locale), sourceMoney(change.price, currency, locale))}
          {change.shipping !== undefined && change.shipping !== change.previousShipping && <> {c.item.shippingChanged(sourceMoney(change.previousShipping ?? 0, item.product.sourceShippingCurrency ?? currency, locale), sourceMoney(change.shipping, item.product.sourceShippingCurrency ?? currency, locale))}</>}
        </span></p>}
      {issue && <p className={"basket-item-note " + (issue.kind === "unreachable" ? "soft" : "issue")} role={issue.kind === "unreachable" ? "status" : "alert"}>
        <TriangleAlert size={16} aria-hidden="true" /><span>{c.item.issues[issue.kind]}{issue.kind !== "unreachable" && reopen && <> <Link href={reopen}>{c.item.reload}</Link></>}</span></p>}
    </>;
  }
  const stockText = (item: CartItem) => item.product.stockQuantity !== undefined
    ? `${item.product.stockQuantity ? k.stockLeft(item.product.stockQuantity) : k.outOfStock} · ${k.stockByEbay}`
    : item.product.stockMoreThan !== undefined ? `${k.stockMore(item.product.stockMoreThan)} · ${k.stockByEbay}` : "";

  function renderItem(item: CartItem) {
    // The country is in the parcel's heading above; the line names only its option (27 October 2026).
    const meta = shownVariant(item.variant, item.product.sourceOptions);
    const issue = item.sourceIssue, stock = stockText(item);
    return <article className={"basket-item" + (issue && issue.kind !== "unreachable" ? " has-issue" : "") + (ticked(item) ? "" : " is-later")} key={item.id}>
      {selectBox([item], s.selectLine([item.product.name, shownVariant(item.variant, item.product.sourceOptions)].filter(Boolean).join(" · ")))}
      <div className="basket-photo"><ProductImage product={item.product} locale={locale} decorative size={240} /></div>
      <div className="basket-info">
        {shownBrand(item.product.brand) && <p className="basket-brand">{shownBrand(item.product.brand)}</p>}
        <ItemName name={item.product.name} />
        {!ticked(item) && <span className="basket-later-tag">{s.later}</span>}
        {meta && <p className="basket-meta">{meta}</p>}
        <p className="basket-meta">{item.product.sourceUrl ? <a className="basket-source" href={item.product.sourceUrl} target="_blank" rel="noopener noreferrer">{c.item.storePrice}: {storePrice(item, locale)}<ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> ({c.item.openStore})</span></a> : <>{c.item.storePrice}: {storePrice(item, locale)}</>}{item.quantity > 1 ? ` × ${item.quantity}` : ""}{(() => { const off = storeDiscount(item.product); return off && <WasPrice was={off.was} percent={off.percent} format={value => sourceMoney(value, item.product.sourceCurrency ?? "USD", locale)} />; })()}</p>
        {!item.priceChange && !issue && item.product.sourceCheckedAt && <p className="basket-meta basket-checked"><BadgeCheck size={14} aria-hidden="true" />{c.item.checked(clock(item.product.sourceCheckedAt, locale))}</p>}
        {stock && <p className={"basket-meta basket-stock" + ((item.product.stockQuantity ?? 99) <= 3 ? " low" : "")}>{stock}</p>}
      </div>
      <div className="basket-price"><strong>{formatSum(lineTotal(item), locale)}</strong>{item.quantity > 1 && <small>{c.item.forQuantity(item.quantity)}</small>}</div>
      {itemNotes(item)}
      <div className="basket-controls">
        <QuantityControl key={`${item.id}:${item.quantity}`} item={item} c={c} pending={pendingQuantities} save={(quantity) => act({ type: "cart-quantity", id: item.id, quantity }, { queue: true })} />
        {keepActions([item])}
        <SafeDeleteButton label={c.item.remove} itemName={item.product.name} locale={locale} instant onConfirm={() => removeWithUndo([item.id], item.product.name)} />
      </div>
      {renderNote(item)}
    </article>;
  }

  /** The customer's note on one option (owner, 7.10.2026: each size keeps its own note; nothing is merged). */
  function renderNote(item: CartItem) {
    const note = item.note ?? "";
    return <ItemNote key={`${item.id}:${note}`} id={item.id} note={note} locale={locale} save={(text) => act({ type: "cart-note", id: item.id, note: text }, { queue: true })} />;
  }

  /**
   * Options of one product: the product once (tick for all, photo, name, store, total, favourites, "remove all"), then
   * one compact row per option (tick, option, quantity, sum, remove) with that option's own note. Warehouse services
   * are chosen for the whole store parcel below.
   */
  function renderGroup(lines: CartItem[]) {
    const lead = lines[0], ids = lines.map((line) => line.id);
    const colour = cartColourOptions(lead.product)?.color;
    const total = lines.reduce((sum, line) => sum + lineTotal(line), 0), units = lines.reduce((sum, line) => sum + line.quantity, 0);
    return <div className="basket-group" key={`group:${lead.id}`}>
      <article className="basket-item basket-group-head">
        {selectBox(lines, s.selectGroup(lead.product.name))}
        <div className="basket-photo"><ProductImage product={lead.product} locale={locale} decorative size={240} /></div>
        <div className="basket-info">
          {shownBrand(lead.product.brand) && <p className="basket-brand">{shownBrand(lead.product.brand)}</p>}
          <ItemName name={lead.product.name} />
          {colour && <p className="basket-meta">{colour}</p>}
          {lead.product.sourceUrl && <p className="basket-meta"><a className="basket-source" href={lead.product.sourceUrl} target="_blank" rel="noopener noreferrer">{c.item.openStore}<ArrowUpRight size={14} aria-hidden="true" /></a></p>}
        </div>
        <div className="basket-price"><strong>{formatSum(total, locale)}</strong><small>{c.item.forQuantity(units)}</small></div>
        <div className="basket-controls">
          {keepActions(lines)}
          <SafeDeleteButton label={kc.removeAll(lines.length)} itemName={lead.product.name} locale={locale} instant onConfirm={() => removeWithUndo(ids, lead.product.name)} />
        </div>
      </article>
      <ul className="basket-variants" aria-label={kc.variants}>{lines.map((item) => {
        const issue = item.sourceIssue, stock = stockText(item), checked = !item.priceChange && !issue && item.product.sourceCheckedAt;
        return <li className={"basket-variant" + (issue && issue.kind !== "unreachable" ? " has-issue" : "") + (ticked(item) ? "" : " is-later")} key={item.id}>
          {selectBox([item], s.selectLine([item.product.name, shownVariant(item.variant, item.product.sourceOptions)].filter(Boolean).join(" · ")))}
          <div className="basket-variant-info">
            <b>{readableNikeSizeLabel(cartColourOptions(item.product)?.label ?? "") || shownVariant(item.variant) || item.variant}</b>{!ticked(item) && <span className="basket-later-tag">{s.later}</span>}
            <small>{storePrice(item, locale)}{item.quantity > 1 ? ` × ${item.quantity}` : ""}{checked ? <> · <BadgeCheck size={14} role="img" aria-label={c.item.checked(clock(item.product.sourceCheckedAt!, locale))} /></> : null}{stock ? ` · ${stock}` : ""}</small>
          </div>
          <QuantityControl key={`${item.id}:${item.quantity}`} item={item} c={c} pending={pendingQuantities} save={(quantity) => act({ type: "cart-quantity", id: item.id, quantity }, { queue: true })} />
          <strong className="basket-variant-sum">{formatSum(lineTotal(item), locale)}</strong>
          <SafeDeleteButton label={kc.removeVariant} itemName={[item.product.name, shownVariant(item.variant, item.product.sourceOptions)].filter(Boolean).join(" · ")} locale={locale} instant onConfirm={() => removeWithUndo([item.id], [item.product.name, shownVariant(item.variant, item.product.sourceOptions)].filter(Boolean).join(" · "))} />
          {itemNotes(item)}
          {renderNote(item)}
        </li>;
      })}</ul>
    </div>;
  }

  /**
   * The services chosen for one store parcel, shared by its guarantee row and its folded list of warehouse services:
   * what is saved and what shows while a click saves.
   */
  function parcelServiceState(parcelKey: string, items: CartItem[]) {
    const draft = serviceDrafts[parcelKey];
    const saved = checkoutServices.filter(service => items.some(line => line.requestedServiceIds?.includes(service.id))).map(service => service.id);
    const savedUnits: Record<string, number> = Object.fromEntries(saved.flatMap(id => { const most = Math.max(0, ...items.map(line => line.requestedServiceUnits?.[id] ?? 0)); return most ? [[id, most]] : []; }));
    return { lead: items[0], chosen: draft?.serviceIds ?? saved, units: draft?.units ?? savedUnits, savingId: draft?.savingId };
  }

  /**
   * Ticks or unticks one service of a parcel (clicks only). The tick shows at once with "Saving…"; a second click while
   * saving builds on the first instead of being lost, and the requests go one after another.
   */
  function toggleParcelService(parcelKey: string, items: CartItem[], service: (typeof checkoutServices)[number], on: boolean, typed?: number) {
    const { lead, chosen, units } = parcelServiceState(parcelKey, items);
    const ids = items.map(line => line.id);
    const counted = !["package", "item"].includes(service.unit);
    const latest = serviceDraftsRef.current[parcelKey];
    const base = latest?.serviceIds ?? chosen;
    const serviceIds = on ? [...new Set([...base, service.id])] : base.filter(id => id !== service.id);
    const nextUnits = { ...(latest?.units ?? units) };
    if (on && counted) nextUnits[service.id] = typed ?? units[service.id] ?? 1; else delete nextUnits[service.id];
    const next = { serviceIds, units: nextUnits, savingId: service.id };
    setDrafts({ ...serviceDraftsRef.current, [parcelKey]: next });
    void act({ type: "cart-services", id: lead.id, ids, serviceIds, serviceUnits: nextUnits }, { queue: true })
      .finally(() => { if (serviceDraftsRef.current[parcelKey] === next) { const rest = { ...serviceDraftsRef.current }; delete rest[parcelKey]; setDrafts(rest); } });
  }

  /** "over $200: 3,9%" when a value-percent service takes a higher rate above its threshold. */
  const highRate = (service: (typeof checkoutServices)[number]) => service.valuePercentHigh !== undefined && service.valueThresholdUsd !== undefined && service.valuePercentHigh !== service.valuePercent
    ? c.services.highRule(formatUsd(service.valueThresholdUsd, locale), formatPercent(service.valuePercentHigh, locale))
    : undefined;

  /**
   * The Atlas safe-arrival guarantee (a value-percent service) as its own row of the parcel, not folded with the warehouse
   * wishes (14.10.2026): it is the one paid choice with a known price. Never ticked in advance; the amount this parcel would
   * pay stands beside it before the tick, and the last line says what a loss is compensated without it (claimLimit). The
   * server prices it again (cart-services).
   */
  function renderGuarantee(parcelKey: string, items: CartItem[]) {
    const guarantees = checkoutServices.filter(service => service.pricingMode === "value-percent");
    if (!guarantees.length) return null;
    const { chosen, savingId } = parcelServiceState(parcelKey, items);
    const toggle = (service: (typeof checkoutServices)[number], on: boolean) => toggleParcelService(parcelKey, items, service, on);
    // Priced as the server does (valueServiceFees): the lines being checked out are one parcel, the ones left for later another.
    const billed = items.filter(ticked), basis = billed.length ? billed : items;
    const limit = uninsuredParcelLimit(basis, pricing.fx);
    return guarantees.map((service) => {
      const checked = chosen.includes(service.id) || service.required;
      const saving = savingId === service.id;
      const boxId = `cart-guarantee-${parcelKey}-${service.id}`;
      return <div className="basket-guarantee" key={service.id} aria-busy={saving || undefined}>
        <Checkbox id={boxId} checked={checked} disabled={service.required} aria-describedby={`${boxId}-limit`} onCheckedChange={(value) => toggle(service, value === true)} />
        <span className="basket-guarantee-copy">
          <span className="basket-guarantee-head"><label htmlFor={boxId}><ShieldCheck size={16} aria-hidden="true" />{serviceTitle(service, locale)}</label>{service.required && <em>{c.services.required}</em>}{saving && <span className="basket-service-saving" role="status"><Loader2 size={14} className="spin" aria-hidden="true" />{s.saving}</span>}</span>
          <small className="basket-guarantee-rate">{c.services.percentRule(formatPercent(service.valuePercent ?? 0, locale), highRate(service))}</small>
          <small>{serviceDescription(service, locale)}</small>
          <small id={`${boxId}-limit`}>{c.services.uninsuredLimit(formatSum(limit, locale))}</small>
        </span>
        <b className="basket-guarantee-sum">+{formatSum(guaranteeAmount(service, basis, pricing.fx), locale)}</b>
      </div>;
    });
  }

  /**
   * Warehouse services of one store parcel (owner, 7.10.2026): chosen once for the parcel, counted per parcel (a
   * contents photo), per piece (checking each item) or as typed (extra photos). They are wishes outside the order total,
   * folded under "Parcel services"; the guarantee has its own row above them (renderGuarantee).
   */
  function renderParcelServices(parcelKey: string, items: CartItem[]) {
    const services = checkoutServices.filter(service => service.pricingMode !== "value-percent");
    if (!services.length) return null;
    const { lead, chosen, units, savingId } = parcelServiceState(parcelKey, items);
    const toggle = (service: (typeof checkoutServices)[number], on: boolean, typed?: number) => toggleParcelService(parcelKey, items, service, on, typed);
    const chosenHere = services.filter(service => chosen.includes(service.id)).length;
    return <details className="basket-services basket-parcel-services">
      <summary><span>{s.parcelServices}<small>{c.services.optional}</small></span>{chosenHere > 0 && <b>{chosenHere}</b>}</summary>
      <p>{s.parcelServicesHint} {c.services.hint}</p>
      <div className="basket-service-list">{services.map((service) => {
        const checked = chosen.includes(service.id) || service.required;
        const counted = !["package", "item"].includes(service.unit);
        const count = parcelServiceUnits(service, items.map(line => ({ quantity: line.quantity, requestedServiceUnits: counted ? { [service.id]: units[service.id] ?? 1 } : undefined })));
        const unitFee = serviceFeeForCountry(service, lead.product.country);
        const unitLabel = service.unit === "package" ? s.unitPackage : service.unit === "item" ? s.unitItem(count) : service.unit === "photo" ? s.unitPhoto(count) : `× ${count}`;
        const saving = savingId === service.id;
        const unitName = c.services.units[service.unit];
        const boxId = `cart-service-${parcelKey}-${service.id}`;
        return <div className="basket-service" key={service.id} aria-busy={saving || undefined}>
          <Checkbox id={boxId} checked={checked} disabled={service.required} onCheckedChange={(value) => toggle(service, value === true)} />
          <span className="basket-service-copy"><b><label htmlFor={boxId}>{serviceTitle(service, locale)}</label>{checked && <span className="basket-service-unit">{unitLabel}</span>}{service.required && <em>{c.services.required}</em>}{saving && <span className="basket-service-saving" role="status"><Loader2 size={14} className="spin" aria-hidden="true" />{s.saving}</span>}</b><small>{serviceDescription(service, locale)}</small>
            <small className="basket-service-rate">{service.pricingMode === "fixed"
              ? `${c.services.fixed}: ${formatSum(unitFee, locale)} / ${unitName}${count > 1 ? ` · ${count} × ${formatSum(unitFee, locale)} = ${formatSum(unitFee * count, locale)}` : ""}`
              : c.services.quote}</small>
          </span>
          {counted && checked && <span className="basket-service-units"><label htmlFor={`cart-service-units-${parcelKey}-${service.id}`}>{c.services.quantity} · {unitName}</label><input key={units[service.id] ?? 1} id={`cart-service-units-${parcelKey}-${service.id}`} type="number" inputMode="numeric" min="1" max="100" step="1" defaultValue={units[service.id] ?? 1} onBlur={(event) => { const typed = Number(event.target.value); if (Number.isInteger(typed) && typed >= 1 && typed <= 100 && typed !== (units[service.id] ?? 1)) toggle(service, true, typed); else event.target.value = String(units[service.id] ?? 1); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} /></span>}
        </div>;
      })}</div>
    </details>;
  }

  // Each fee on its own line; the store-delivery hold and customs stay outside the amount to pay.
  const linesFor = (duty: number, fromBalance: number, lines = sums) => <CalcLines sums={{ ...lines, customsDuty: duty, total: lines.total + duty }} locale={locale} pricing={pricing} weightKg={cartWeight} storeShippingState="none" anyFree={reserves.some(entry => entry.free)} speed={speed}>
    {fromBalance > 0 && <div className="basket-lines basket-lines-credit"><div className="basket-line"><span className="basket-line-label">{c.summary.fromBalance}</span><b>−{formatSum(fromBalance, locale)}</b></div></div>}
  </CalcLines>;
  const summaryLines = linesFor(cartDuty, 0);
  const saveCustoms = async (next: typeof customsChoices) => { setCustomsBusy(true); try { await act({ type: "cart-customs", value: next }); } finally { setCustomsBusy(false); } };
  // The allowance in two lines and "Atlas pays customs for me", which adds its fee to the bill right away.
  const customsPanel = <CustomsPanel estimate={customs} choices={customsChoices} locale={locale} pricing={pricing} profiles={state.deliveryProfiles} recipientId={customsProfile?.id} onRecipient={setCustomsRecipient} onChoices={(next) => void saveCustoms(next)} helpAmount={customsHelpAmount} remembered={customsRemembered} busy={customsBusy} remember={customsRemember} onRemember={setCustomsRemember} compact />;


  // A guest's cart lives in this browser (redesign stage 6): the page shows it with an estimate and leads to checkout.
  if (status === "guest") return <GuestCartView />;
  if (!ready) return <div className="basket-page">
    <header className="basket-head"><h1>{c.title}</h1></header>
    {error
      ? <section className="basket-empty"><span className="basket-empty-icon" aria-hidden="true"><ShoppingBag size={28} /></span><h2>{c.signin.title}</h2><p>{c.signin.text}</p><div className="basket-empty-actions"><Link className="btn primary" href="/login?return_to=%2Fcart">{c.signin.action}<ArrowRight size={18} aria-hidden="true" /></Link></div></section>
      : <LoadingCards label={c.loading} rows={2} shape="basket" />}
  </div>;

  if (!state.cart.length) return <div className="basket-page">
    <header className="basket-head"><h1>{c.title}</h1></header>
    {merging || pendingAdd.sending ? <div className="basket-loading" role="status"><Loader2 size={18} className="spin" aria-hidden="true" /> {merging ? checkoutCopy[locale].merge.moving : pendingWords.sending}</div> : <>
      <GuestProblems lines={guestProblems} locale={locale} onDismiss={(key) => guestCart.remove([key])} />
      <section className="basket-empty"><span className="basket-empty-icon" aria-hidden="true"><ShoppingBag size={28} /></span><h2>{c.empty.title}</h2><p>{c.empty.text}</p>
        <div className="basket-empty-actions"><Link className="btn primary" href="/order-by-link"><ClipboardPaste size={18} aria-hidden="true" />{c.empty.paste}</Link><Link className="btn secondary" href="/stores">{c.empty.stores}</Link>{favoriteCount > 0 && <Link className="btn secondary" href="/favorites"><Heart size={18} aria-hidden="true" />{c.empty.favorites(favoriteCount)}</Link>}</div>
      </section>
      {/* Delivered before (14.10.2026): the same store page again through the link order, which checks today's price. */}
      {reorders.length > 0 && <section className="basket-reorder" aria-labelledby="basket-reorder-title">
        <h2 id="basket-reorder-title">{c.empty.ordered}</h2>
        <ul>{reorders.map((order) => <li key={order.id}>
          <div className="basket-reorder-photo"><ProductImage product={order.product} locale={locale} decorative size={160} /></div>
          <span className="basket-reorder-name">{order.product.name}</span>
          <Link className="btn secondary" href={`/order-by-link?url=${encodeURIComponent(order.product.sourceUrl ?? "")}`}><RotateCcw size={16} aria-hidden="true" />{orderGroupCopy[locale].reorder}<span className="sr-only">: {order.product.name}</span></Link>
        </li>)}</ul>
      </section>}
      {/* The catalog's picks, in the storefront's order; a card opens the product sheet. */}
      {catalogReady && catalogProducts.length >= 4 && <Suspense fallback={null}><CartPicks products={catalogProducts} onSelect={setPicked} /></Suspense>}
    </>}
    <LazyProductSheet product={picked} onClose={() => setPicked(null)} />
  </div>;

  return <div className="basket-page has-sticky">
    <header className="basket-head"><h1>{c.title}</h1><p>{itemCount(allCount, locale)} · {parcelCount(parcels.length, locale)}</p></header>
    <div className="basket-layout">
      <div className="basket-parcels">
        {merging && <p className="basket-loading" role="status"><Loader2 size={18} className="spin" aria-hidden="true" /> {checkoutCopy[locale].merge.moving}</p>}
        <GuestProblems lines={guestProblems} locale={locale} onDismiss={(key) => guestCart.remove([key])} />
        {state.cart.length > 1 && <div className="basket-select-bar">
          <label>{selectBox(state.cart, s.selectAll)}{s.selectAll}</label>
          <small aria-live="polite">{selecting ? s.saving : s.selectedOf(state.cart.filter(ticked).reduce((sum, item) => sum + item.quantity, 0), allCount)}</small>
        </div>}
        {parcels.map(parcel => {
          const reserve = reserves.find(entry => parcel.items.some(item => entry.itemIds.includes(item.id)));
          const reserveShown = Boolean(reserve && reserve.reserveUsd > 0);
          // "More from {store}" (14.10.2026): only for a store the catalog has, and once per parcel, in the first note shown.
          const host = parcelStoreHost(parcel.items);
          const more = host && catalogHosts.has(host) ? <Link href={`/catalog?store=${encodeURIComponent(host)}`}>{c.item.moreFrom(parcel.store)}<ArrowRight size={14} aria-hidden="true" /></Link> : null;
          // Delivery is charged for at least 1 kg: what still fits under it adds no delivery cost (the lines being checked out).
          const room = parcelRoomKg(parcel.items.filter(ticked));
          return <section className="basket-parcel" key={parcel.key} aria-label={parcel.title}>
            <h2 className="basket-parcel-title">{parcels.length > 1 || parcel.items.length > 1 ? selectBox(parcel.items, s.selectStore(parcel.store)) : <Store size={16} aria-hidden="true" />}<span>{parcel.title}</span><small>{[parcel.country, speedDays(parcel.origin)].filter(Boolean).join(" · ")}</small></h2>
            {productGroups(parcel.items).map(lines => lines.length === 1 ? renderItem(lines[0]) : renderGroup(lines))}
            {/* Only an open question goes here; free store delivery is its own line in the bill. */}
            {reserve && reserveShown && <p className="basket-parcel-note">
              <Truck size={16} aria-hidden="true" /><span>{c.item.parcelReserve(usd(reserve.missingUsd, locale))}{more && <> {more}</>}</span>
            </p>}
            {room !== undefined && <p className="basket-parcel-note basket-parcel-room">
              <Package size={16} aria-hidden="true" /><span>{c.item.parcelRoom(formatKg(room, locale), parcel.store)}{!reserveShown && more && <> {more}</>}</span>
            </p>}
            {renderGuarantee(parcel.key, parcel.items)}
            {renderParcelServices(parcel.key, parcel.items)}
          </section>;
        })}
        <div className="basket-continue-row">
          <Link className="basket-continue" href="/catalog">{c.summary.continue}<ArrowRight size={16} aria-hidden="true" /></Link>
          <Link className="basket-continue" href="/order-by-link"><ClipboardPaste size={16} aria-hidden="true" />{c.summary.addByLink}</Link>
        </div>
      </div>
      {/* The bill in a folder: the sheet is the amount to pay, the slip below holds what stays outside it. */}
      <aside ref={summaryRef} className="basket-summary folio" aria-labelledby="basket-summary-title">
        <div className="folio-sheet">
          <h2 id="basket-summary-title">{c.summary.title}</h2>
          <DeliverySpeedSwitch value={speed} options={speedOptions} locale={locale} busy={speedBusy} note={speedNote} tip={speedTip} onChange={(next) => void changeSpeed(next)} />
          {summaryLines}
          {customsPanel}
          <div className="basket-total bill-total"><span>{c.summary.payable}</span><strong><Money value={payable} locale={locale} animate /></strong></div>
          {lines.length > 0 && <PriceHold expiresAt={earliestExpiry} c={c} />}
          <button ref={setSummaryCta} type="button" className="btn primary basket-cta" disabled={verifying} aria-busy={verifying || selecting} aria-disabled={!lines.length || selecting || undefined} aria-describedby={!lines.length ? "basket-none-hint" : undefined} onClick={() => void openCheckout()}>{verifying ? <>{c.summary.verifying}<Loader2 size={18} className="spin" aria-hidden="true" /></> : selecting ? <>{s.saving}<Loader2 size={18} className="spin" aria-hidden="true" /></> : <>{s.checkoutN(count)}<ArrowRight size={18} aria-hidden="true" /></>}</button>
          {/* What the button leads to (14.10.2026): the recipient and the checks come first; nothing is paid without a yes. */}
          {lines.length > 0 && <ul className="basket-assurance basket-cta-assurance"><li><ShieldCheck size={16} aria-hidden="true" />{c.summary.assurance}</li></ul>}
          {!lines.length && <p id="basket-none-hint" className="basket-none-hint" role="status"><Info size={16} aria-hidden="true" />{s.noneSelected}</p>}
          {lines.length > 0 && laterCount > 0 && <p className="basket-later-note">{s.laterCount(laterCount)}</p>}
        </div>
        {sums.storeShippingHold > 0 && <section className="folio-outside" aria-labelledby="basket-outside-title">
          <h3 id="basket-outside-title">{c.summary.outside}</h3>
          <HoldNote amount={sums.storeShippingHold} locale={locale} pricing={pricing} />
        </section>}
      </aside>
    </div>

    {/* Saved products not in the cart (14.10.2026), under both columns: they open the product sheet, where they are added as anywhere. */}
    {savedPicks.length > 0 && <Suspense fallback={null}><CartPicks title={kc.saved} link={{ href: "/favorites", label: kc.open }} products={savedPicks} limit={4} onSelect={setPicked} /></Suspense>}
    <LazyProductSheet product={picked} onClose={() => setPicked(null)} />

    <div className={"basket-sticky" + (summaryCtaInView ? " is-hidden" : "")} role="region" aria-label={c.sticky.label} aria-hidden={summaryCtaInView || undefined}>
      <div><span>{c.summary.payable}</span><strong>{formatSum(payable, locale)}</strong></div>
      <button type="button" className="btn primary" disabled={verifying} aria-busy={verifying || selecting} aria-disabled={!lines.length || selecting || undefined} onClick={() => void openCheckout()}>{verifying || selecting ? <Loader2 size={18} className="spin" aria-label={verifying ? c.summary.verifying : s.saving} /> : <>{lines.length ? s.checkoutN(count) : s.noneSelected}<ArrowRight size={18} aria-hidden="true" /></>}</button>
    </div>


  </div>;

}
