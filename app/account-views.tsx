"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/site-link";
import { InfoTip } from "@/components/info-tip";
import { AlertCircle, ArrowRight, ArrowUpRight, Bell, Check, FileCheck2, Heart, Info, LifeBuoy, Link2, LogOut, MapPin, MessageCircle, Package, Pencil, Plus, RefreshCw, ScanLine, Shield, ShoppingBag, Trash2, UserCog, Wallet } from "lucide-react";
import { useMarket } from "@/lib/market/store";
import { courierAllowanceUsd } from "@/lib/market/customs";
import { isServedRegion } from "@/lib/market/addresses";
import { balanceOf, totalOf, type SavedDeliveryProfile, type State } from "@/lib/market/domain";
import { groupOrders, orderGroupCopy } from "@/lib/market/order-groups";
import { pendingApprovalOf, pendingPaymentOf } from "@/lib/market/next-step";
import type { Action } from "@/lib/market/actions";
import { monthlyAllowance, recipientKey, type RecipientAllowance } from "@/lib/market/allowance";
import { isUzbek, localizedStatuses, serverError, type Locale } from "@/lib/market/i18n";
import { uzText } from "@/lib/market/uz-cyrl";
import { uzMonths } from "@/lib/market/notices-copy";
import { calcCopy } from "@/lib/market/calc-copy";
import { formatSum } from "@/lib/market/format";
import { accountCopy, formatLongDate, formatShortDate, itemCount, ordersCopy, recipientCopy, type AccountCopy } from "@/lib/market/customer-copy";
import { consentDocuments, consentVersion, deletionBlockers, deletionSummary, missingConsents } from "@/lib/market/account-delete";
import { appInfo, isNative, nativePlatform, type AppInfo } from "@/lib/native/bridge";
import { toast } from "@/lib/market/toast";
import { ProductImage } from "./market-ui";
import { Modal } from "./modal";
import { Money } from "./money";
import { SafeDeleteButton } from "./safe-delete-button";
import { ThemeToggle } from "./theme-control";
import { RecipientForm } from "./recipient-form";
import { SignInMethods } from "./sign-in-methods";
import { TelegramNoticesSetting, TelegramNudge } from "./telegram-notices";
import { AllowanceMeter, allowanceMoney } from "./allowance-meter";

// Account home, mobile-first: one "what needs you now" card, four quick tiles, then
// recipients, customs allowance, documents, support and settings — each shown once.
export function AccountView() {
  const { user, state, ready, act, pricing, refresh, siteContent } = useMarket();
  const lang = state.communication.language;
  const c = accountCopy[lang];
  const [editor, setEditor] = useState<SavedDeliveryProfile | "new" | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticket, setTicket] = useState({ subject: "", text: "" });
  // The support form on its way ("new" or the ticket id): its button is locked and says "Sending…".
  const [sending, setSending] = useState<string | null>(null);
  const search = useSearchParams();
  const aboutOrder = search.get("order") ?? "";
  // "Question about this order" from /orders opens the support form with the order number filled in.
  useEffect(() => {
    if (!/^AT-[A-Z0-9]{4,12}$/.test(aboutOrder)) return;
    queueMicrotask(() => { setTicketOpen(true); setTicket(current => current.subject ? current : { ...current, subject: c.support.aboutOrder(aboutOrder) }); });
    window.setTimeout(() => document.getElementById("support")?.scrollIntoView({ block: "start" }), 300);
  }, [aboutOrder, c.support]);
  // "Write to support" on /support (?support=new) opens the empty form once the account is drawn; nothing is sent by itself.
  const wantsSupport = search.get("support") === "new";
  const signedIn = Boolean(user);
  const supportOpened = useRef(false);
  useEffect(() => {
    if (!wantsSupport || !signedIn || supportOpened.current) return;
    queueMicrotask(() => setTicketOpen(true));
    const timer = window.setTimeout(() => { supportOpened.current = true; document.getElementById("support")?.scrollIntoView({ block: "start" }); }, 120);
    return () => window.clearTimeout(timer);
  }, [wantsSupport, signedIn]);
  const identityProfiles = state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);
  const activeOrders = state.orders.filter(order => !order.cancelled && order.status < 5);
  // Purchases are checkouts, as on "My orders": one card, one payment, one count (order-groups.ts).
  const groups = groupOrders(state.orders);
  const activeGroups = groups.filter(group => group.status !== undefined && group.status < 5);
  const gc = orderGroupCopy[lang];
  // The same rule as the orders page, the notifications panel and the home "continue" strip (lib/market/next-step.ts):
  // a доплата or a change waits for the customer, over all lines; then the checkout's one payment (its amount, not one line's share).
  const pendingApproval = pendingApprovalOf(state.orders);
  const duePayment = pendingPaymentOf(groups);
  const dueGroup = duePayment?.group;
  const pendingPayment = duePayment?.order;
  const currentOrder = pendingApproval ?? pendingPayment ?? activeOrders[0];
  const unread = state.notifications.filter(item => !item.read).length;
  const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const balance = balanceOf(state);
  const statuses = localizedStatuses(lang);
  const allowance = monthlyAllowance(state, pricing.fx);
  const primaryRecipient = state.deliveryProfiles.find(profile => profile.primary) ?? state.deliveryProfiles[0];
  const cartUsd = Math.round(state.cart.reduce((sum, item) => sum + item.product.usd * item.quantity, 0));
  const telegram = siteContent.contacts.telegramSupport;

  if (!user) return <section className="cabinet-card cabinet-signin"><h1>{c.signin.title}</h1><p>{c.signin.text}</p><a className="btn primary" href="/login?return_to=%2Faccount">{c.signin.action}<ArrowRight size={18} aria-hidden="true" /></a></section>;

  const contact = user.email || user.contact;
  const since = formatLongDate(user.createdAt, lang);
  const next = pendingApproval ? { title: gc.attention, hint: pendingApproval.product.name, href: `/orders#${pendingApproval.id}`, icon: <AlertCircle aria-hidden="true" />, order: pendingApproval, tone: "warn" }
    : pendingPayment && dueGroup ? { title: c.next.payment, hint: dueGroup.orders.length > 1 ? itemCount(dueGroup.items, lang) : pendingPayment.product.name, href: `/orders#${pendingPayment.id}`, icon: <Wallet aria-hidden="true" />, order: pendingPayment, tone: "warn" }
    : currentOrder ? { title: c.next.inProgress, hint: currentOrder.product.name, href: `/orders#${currentOrder.id}`, icon: <Package aria-hidden="true" />, order: currentOrder, tone: "info" }
    : state.cart.length ? { title: c.next.cart, hint: c.next.cartHint(itemCount(cartCount, lang)), href: "/cart", icon: <ShoppingBag aria-hidden="true" />, tone: "info", items: state.cart.slice(0, 3), cart: true }
    // A new customer: the first order by link is the one thing to do; "Add recipient" stays in its card just below.
    : !state.orders.length ? { title: c.next.firstOrder, hint: c.next.firstOrderHint, href: "/order-by-link", icon: <Link2 aria-hidden="true" />, tone: "info", first: true }
    : !state.deliveryProfiles.length ? { title: c.next.recipient, hint: c.next.recipientHint, icon: <MapPin aria-hidden="true" />, tone: "info" }
    : null;
  const due = !pendingApproval && dueGroup?.payment ? dueGroup : undefined;
  // "All set": the last delivered order with its store link can be ordered again through the usual import and price check.
  const lastDelivered = next ? undefined : [...state.orders].filter(order => order.status === 5 && !order.cancelled && order.product.sourceUrl).sort((a, b) => b.createdAt - a.createdAt)[0];

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    window.location.assign("/");
  }

  return <div className="cabinet">
    <header className="cabinet-head">
      <span className="cabinet-avatar" aria-hidden="true">{(user.name || contact || "A").trim().charAt(0).toUpperCase()}</span>
      <div className="cabinet-identity"><h1>{c.title}</h1><p><b>{user.name}</b>{contact && contact !== user.name ? <> · {contact}</> : null}<small>{c.since(since)}</small></p></div>
      {(user.operator || !!user.permissions?.length) && <Link className="btn secondary cabinet-manage" href="/admin">{c.manage}<ArrowUpRight size={17} aria-hidden="true" /></Link>}
    </header>

    <div className="cabinet-grid">
      <div className="cabinet-main">
        {/* A checkout waiting for payment is shown as its bill: the checkout's one amount. The provider note is said in the pay dialog only. */}
        <section className={"cabinet-next" + (next ? ` ${next.tone}` : " done") + (due ? " folio" : "")} aria-labelledby="cabinet-next-title">
          {due ? <p className="folio-cap"><b>{c.next.label}</b><span>{gc.title(formatShortDate(due.createdAt, lang))}</span></p> : <p className="cabinet-eyebrow">{c.next.label}</p>}
          <div className={due ? "folio-sheet" : "cabinet-next-inner"}>
            <div className="cabinet-next-body">
              <span className="cabinet-next-icon">{next ? next.icon : <Check aria-hidden="true" />}</span>
              <div><h2 id="cabinet-next-title">{next ? next.title : c.next.allSet}</h2><p>{next ? next.hint : c.next.allSetHint}</p></div>
            </div>
            {due?.payment && <p className="bill-total"><span>{c.next.due}</span><strong><Money value={due.payment.amount} locale={lang} /></strong></p>}
            {next?.order && <div className="cabinet-progress">
              {/* One segment per stage: the stages behind are filled, the current one is drawn in progress (owner, 12 October 2026). */}
              <div className="cabinet-steps" role="progressbar" aria-label={statuses[next.order.status]} aria-valuemin={1} aria-valuemax={statuses.length} aria-valuenow={next.order.status + 1}>
                {statuses.map((stage, index) => <span key={stage} className={index < next.order!.status ? "done" : index === next.order!.status ? "now" : undefined} />)}
              </div>
              <small>{c.next.stage(next.order.status + 1, statuses.length)}: {next.order.payment?.status === "pending" ? gc.awaitingPayment : statuses[next.order.status]}</small>
            </div>}
            {/* The cart's first items and its sum, as on the "Cart" tile (an estimate: the cart recounts the total). */}
            {next?.items && <div className="cabinet-next-cart">
              <span className="cabinet-next-thumbs" aria-hidden="true">
                {next.items.map(item => <span key={item.id} className="cabinet-next-thumb"><ProductImage product={item.product} decorative locale={lang} size={96} /></span>)}
                {state.cart.length > next.items.length && <span className="cabinet-next-thumb cabinet-next-more">+{state.cart.length - next.items.length}</span>}
              </span>
              <p className="cabinet-next-sum"><strong>{formatSum(totalOf(state.cart), lang)}</strong><small>{c.next.cartEstimate}</small></p>
            </div>}
            {next ? (next.first ? <Link className="btn primary" href="/order-by-link">{c.next.newOrder}<ArrowRight size={18} aria-hidden="true" /></Link>
              : next.cart ? <Link className="btn primary" href="/cart">{c.next.checkout}<ArrowRight size={18} aria-hidden="true" /></Link>
              : next.order && next.href ? <Link className="btn primary" href={next.href}>{c.next.openOrder}<ArrowRight size={18} aria-hidden="true" /></Link>
              : next.href ? <Link className="btn primary" href={next.href}>{c.next.open}</Link>
              : <button type="button" className="btn primary" onClick={() => setEditor("new")}>{c.next.add}<Plus size={17} aria-hidden="true" /></button>)
              : <Link className="btn primary" href="/order-by-link">{c.next.newOrder}</Link>}
            {/* "All set" and a delivered order with its store link: order it again — a fresh import and price check, not the old price. */}
            {lastDelivered?.product.sourceUrl && <div className="cabinet-repeat">
              <span className="cabinet-next-thumb" aria-hidden="true"><ProductImage product={lastDelivered.product} decorative locale={lang} size={96} /></span>
              <span className="cabinet-repeat-text"><b>{lastDelivered.product.name}</b><small>{c.next.repeatNote}</small></span>
              <Link className="btn secondary" href={`/order-by-link?url=${encodeURIComponent(lastDelivered.product.sourceUrl)}`}>{ordersCopy[lang].repeat}</Link>
            </div>}
            {/* Telegram order notices, softly: only with a paid order on its way and the notices off (app/telegram-notices.tsx). */}
            <TelegramNudge locale={lang} />
          </div>
        </section>

        {/* A brand-new account would see four zeros under "Place your first order": the tiles wait for the first
            order, cart line, balance or notice (the header and the bottom bar lead to the same pages). */}
        {(groups.length > 0 || cartCount > 0 || balance !== 0 || state.notifications.length > 0) && <nav className="cabinet-tiles" aria-label={c.tiles.label}>
          <Link href="/orders"><Package aria-hidden="true" /><span>{c.tiles.orders}</span><strong>{groups.length}</strong><small>{activeGroups.length ? c.tiles.ordersActive(activeGroups.length) : groups.length ? c.tiles.ordersTotal(groups.length) : c.tiles.none}</small></Link>
          <Link href="/cart"><ShoppingBag aria-hidden="true" /><span>{c.tiles.cart}</span><strong>{cartCount}</strong><small>{cartCount ? formatSum(totalOf(state.cart), lang) : c.tiles.cartEmpty}</small></Link>
          <Link href="/balance"><Wallet aria-hidden="true" /><span>{c.tiles.balance}</span><strong className="cabinet-money">{formatSum(balance, lang)}</strong><small>{c.tiles.balanceSub}</small></Link>
          <Link href="/notifications"><Bell aria-hidden="true" /><span>{c.tiles.notifications}</span><strong>{state.notifications.length}</strong><small>{unread ? c.tiles.unread(unread) : c.tiles.noUnread}</small></Link>
        </nav>}
        {/* The header heart is desktop-only and the phone's bottom bar has no favourites: the way there from the account.
            No count — saved ids may point at items no longer in the catalogue, and /favorites would show fewer. */}
        {state.favorites.length > 0 && <Link className="cabinet-link cabinet-favorites" href="/favorites"><Heart size={16} aria-hidden="true" />{c.tiles.favorites}<ArrowRight size={16} aria-hidden="true" /></Link>}

        <section className="cabinet-card" aria-labelledby="cabinet-recipients-title">
          <h2 id="cabinet-recipients-title">{c.recipients.title}<InfoTip locale={lang}>{c.recipients.lead}</InfoTip></h2>
          <p className="cabinet-lead tip-text">{c.recipients.lead}</p>
          {state.deliveryProfiles.length ? <ul className="cabinet-recipients">{state.deliveryProfiles.map(profile => {
            const passport = identityProfiles.find(identity => identity.recipientProfileId === profile.id);
            // A recipient saved under their own name would show it twice.
            const named = profile.label.trim() && profile.label.trim() !== profile.recipient.trim();
            return <li key={profile.id}>
              <div className="cabinet-recipient-top"><b>{named ? profile.label : profile.recipient}</b>{profile.primary && <span className="cabinet-badge">{c.recipients.primary}</span>}</div>
              <p>{named && <>{profile.recipient} · </>}<span className="nowrap">{profile.phone}</span></p>
              <p className="cabinet-muted">{[profile.region, profile.city, profile.address, profile.postalCode].filter(Boolean).join(", ")}</p>
              <div className="cabinet-recipient-foot">
                {/* Tashkent only for now (10.10.2026): orders to this recipient wait for an address in Tashkent. */}
                {!isServedRegion(profile.region) && <span className="cabinet-chip warn"><MapPin size={14} aria-hidden="true" />{recipientCopy[lang].servedOnly}</span>}
                {passport ? <span className="cabinet-chip ok"><Check size={14} aria-hidden="true" />{c.recipients.passportOk(passport.passportMasked)}</span> : <Link className="cabinet-chip warn" href={`/identity?recipient=${encodeURIComponent(profile.id)}`}><ScanLine size={14} aria-hidden="true" />{c.recipients.addPassport}</Link>}
              </div>
              <div className="cabinet-recipient-actions">
                <button type="button" className="cabinet-text-btn" onClick={() => setEditor(profile)}><Pencil size={15} aria-hidden="true" />{c.recipients.edit}</button>
                {!profile.primary && <button type="button" className="cabinet-text-btn" onClick={() => void act({ type: "delivery-profile-save", id: profile.id, value: profile, label: profile.label, primary: true })}>{c.recipients.makePrimary}</button>}
                <SafeDeleteButton label={c.recipients.remove} itemName={profile.label} locale={lang} onConfirm={() => act({ type: "delivery-profile-remove", id: profile.id })} />
              </div>
            </li>;
          })}</ul> : <p className="cabinet-empty">{c.recipients.empty}</p>}
          <button type="button" className="cabinet-add" onClick={() => setEditor("new")}><Plus size={18} aria-hidden="true" />{c.recipients.add}</button>
        </section>

        {/* Next to the recipients: a passport belongs to a recipient. In the main column the two columns end closer on a computer. */}
        <section className="cabinet-card" aria-labelledby="cabinet-documents-title">
          <h2 id="cabinet-documents-title">{c.documents.title}<InfoTip locale={lang}>{c.documents.note}</InfoTip></h2>
          <ul className="cabinet-rows">
            <li><Link href="/identity"><ScanLine aria-hidden="true" /><span>{c.documents.passport}<small>{identityProfiles.length ? c.documents.passportCount(identityProfiles.length) : c.documents.missing}</small></span><ArrowRight size={18} aria-hidden="true" /></Link></li>
            <li><Link href="/declaration"><FileCheck2 aria-hidden="true" /><span>{c.documents.declarations}<small>{c.documents.declarationsCount(state.declarations.length)}</small></span><ArrowRight size={18} aria-hidden="true" /></Link></li>
          </ul>
          <p className="cabinet-note tip-text">{c.documents.note}</p>
        </section>

        <section className="cabinet-card" id="support" aria-labelledby="cabinet-support-title">
          <div className="cabinet-card-head"><div><h2 id="cabinet-support-title">{c.support.title}<InfoTip locale={lang}>{c.support.lead}</InfoTip></h2><p className="cabinet-lead tip-text">{c.support.lead}</p></div>
            {telegram && <a className="btn secondary" href={`https://t.me/${telegram}`} target="_blank" rel="noopener noreferrer">{c.support.telegram}<ArrowUpRight size={16} aria-hidden="true" /></a>}</div>
          {state.supportTickets.length ? <ul className="cabinet-tickets">{state.supportTickets.slice(0, 3).map(item => <li key={item.id}>
            <div className="cabinet-ticket-head"><b>{item.subject}</b><span className={"cabinet-status " + item.status}>{item.status === "open" ? c.support.waiting : item.status === "answered" ? c.support.answered : c.support.closed}</span></div>
            <details><summary>{c.support.history} · {c.support.messages(item.replies.length)}</summary>
              {item.replies.map(reply => <p className="ticket-reply" key={reply.id}><b>{reply.author === "support" ? c.support.team : c.support.you}</b><br />{reply.text}</p>)}
              {item.status !== "closed" && <form className="support-reply-form" onSubmit={async event => { event.preventDefault(); if (sending) return; const form = event.currentTarget; const input = form.elements.namedItem("reply") as HTMLInputElement; setSending(item.id); try { if (await act({ type: "support-reply", id: item.id, text: input.value })) input.value = ""; } finally { setSending(null); } }}><input name="reply" aria-label={c.support.replyPlaceholder} required minLength={3} maxLength={1000} placeholder={c.support.replyPlaceholder} /><button className="btn secondary" disabled={Boolean(sending)} aria-busy={sending === item.id}>{sending === item.id ? c.support.sending : c.support.reply}</button></form>}
            </details>
          </li>)}</ul> : null}
          {ticketOpen ? <form className="cabinet-ticket-form" onSubmit={async event => { event.preventDefault(); if (sending) return; setSending("new"); try { if (await act({ type: "support-create", subject: ticket.subject, text: ticket.text })) { setTicket({ subject: "", text: "" }); setTicketOpen(false); toast.success(c.support.sent); } } finally { setSending(null); } }}>
            <label htmlFor="support-subject">{c.support.subject}</label><input id="support-subject" required minLength={3} maxLength={120} value={ticket.subject} onChange={event => setTicket({ ...ticket, subject: event.target.value })} />
            <label htmlFor="support-question">{c.support.question}</label><textarea id="support-question" required minLength={3} maxLength={1000} rows={4} value={ticket.text} onChange={event => setTicket({ ...ticket, text: event.target.value })} />
            <div className="cabinet-form-foot"><small>{ticket.text.length} / 1000</small><button className="btn primary" disabled={!ready || Boolean(sending)} aria-busy={sending === "new"}><MessageCircle size={16} aria-hidden="true" />{sending === "new" ? c.support.sending : c.support.send}</button></div>
          </form> : <button type="button" className="cabinet-add" onClick={() => setTicketOpen(true)}><Plus size={18} aria-hidden="true" />{c.support.newTicket}</button>}
        </section>
      </div>

      <div className="cabinet-side">
        <CustomsAllowance groups={allowance} primaryName={primaryRecipient?.recipient} cartUsd={cartUsd} c={c} locale={lang} />

        <SignInMethods locale={lang} />

        <SettingsCard c={c} locale={lang} state={state} ready={ready} act={act} refresh={refresh} onSignOut={signOut} onSupport={() => {
          setTicket(current => ({ ...current, subject: current.subject || c.deletion.supportSubject }));
          setTicketOpen(true);
          window.setTimeout(() => document.getElementById("support")?.scrollIntoView({ block: "start" }), 50);
        }} />
      </div>
    </div>

    <Modal open={editor !== null} onClose={() => setEditor(null)} title={editor === "new" ? recipientCopy[lang].addTitle : recipientCopy[lang].editTitle} description={recipientCopy[lang].note} locale={lang}>
      {editor !== null && <RecipientForm key={editor === "new" ? "new" : editor.id} locale={lang} initial={editor === "new" ? undefined : editor} isFirst={!state.deliveryProfiles.length} onSave={async value => {
        const editing = editor === "new" ? undefined : editor;
        if (await act({ type: "delivery-profile-save", value: value.profile, label: value.label, id: editing?.id, primary: value.primary })) { setEditor(null); toast.success(editing ? recipientCopy[lang].updated : recipientCopy[lang].saved); }
      }} />}
    </Modal>
  </div>;
}

/** This month's purchases through Atlas against the duty-free courier allowance, per recipient. */
function CustomsAllowance({ groups, primaryName, cartUsd, c, locale }: { groups: RecipientAllowance[]; primaryName?: string; cartUsd: number; c: AccountCopy; locale: Locale }) {
  const limit = courierAllowanceUsd;
  // Show the default recipient even before their first order, so the empty state still says "for whom".
  const rows = groups.length ? groups : primaryName ? [{ key: recipientKey(primaryName), name: primaryName, usedUsd: 0, orders: 0 }] : [];
  const month = isUzbek(locale) ? uzText(locale, uzMonths[new Date().getMonth()]) : new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date());
  return <section className="cabinet-card cabinet-customs" aria-labelledby="cabinet-customs-title">
    <div className="cabinet-customs-top">
      <h2 id="cabinet-customs-title">{c.customs.title}<InfoTip locale={locale}>{c.customs.perPerson}</InfoTip></h2>
      <span className="cabinet-month">{month}</span>
    </div>
    <p className="cabinet-lead tip-text">{c.customs.perPerson}</p>
    {rows.length ? <ul className="cabinet-allowance">{rows.map(row => {
      // The meter's own sum (cents kept), so the headline, the bar and the note show the same figure.
      const used = row.parts?.length ? Math.round(row.parts.reduce((sum, part) => sum + part.usd, 0) * 100) / 100 : row.usedUsd;
      const over = used > limit;
      const name = row.name || c.customs.unnamed;
      return <li key={row.key} className={over ? "over" : undefined}>
        <div className="cabinet-allowance-head">
          <span className="cabinet-allowance-who"><i aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</i><b>{name}</b></span>
          <span className="cabinet-allowance-figure"><strong>{allowanceMoney(over ? used - limit : limit - used)}</strong><small>{over ? c.customs.overLabel : c.customs.leftLabel}</small></span>
        </div>
        <AllowanceMeter limit={limit} orders={row.parts ?? []} cartUsd={row.name === primaryName || rows.length === 1 ? cartUsd : 0} locale={locale} label={name} headline />
        {/* "$0 of $200" only repeated the headline: the line shows once something counts against the limit (27 October 2026). */}
        {(over || used > 0) && <p className="cabinet-allowance-status">{over ? c.customs.over : c.customs.used(used, limit)}</p>}
      </li>;
    })}</ul> : <ul className="cabinet-allowance">
      {/* No recipient yet: the whole allowance and its scale, with the cart on it — no invented recipient name. */}
      <li>
        <div className="cabinet-allowance-head solo">
          <span className="cabinet-allowance-figure"><strong>{allowanceMoney(limit)}</strong><small>{c.customs.leftLabel}</small></span>
        </div>
        <AllowanceMeter limit={limit} orders={[]} cartUsd={cartUsd} locale={locale} label={c.customs.title} headline />
        <p className="cabinet-allowance-status">{c.customs.empty}</p>
      </li>
    </ul>}
    {cartUsd > 0 && <p className="cabinet-customs-cart"><ShoppingBag size={16} aria-hidden="true" />{c.customs.cart(cartUsd)}</p>}
    {/* Each person has their own allowance: a relative may be the recipient only with their own details. */}
    <details className="cabinet-customs-more">
      <summary><Info size={16} aria-hidden="true" />{c.customs.how}</summary>
      <p className="cabinet-note">{c.customs.note}</p>
      <p className="cabinet-note">{calcCopy[locale].customs.relative} {calcCopy[locale].customs.rule}</p>
    </details>
    <Link className="cabinet-link" href="/customs">{c.customs.link}<ArrowRight size={16} aria-hidden="true" /></Link>
  </section>;
}

type SettingsProps = { c: AccountCopy; locale: Locale; state: State; ready: boolean; act: (action: Action) => Promise<boolean>; refresh: () => Promise<void>; onSignOut: () => void; onSupport: () => void };

/** Settings rows the stores expect in the app: help, legal documents, consents, "restore purchases", about, sign out, delete. */
function SettingsCard({ c, locale, state, ready, act, refresh, onSignOut, onSupport }: SettingsProps) {
  const [native, setNative] = useState(false);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [restored, setRestored] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const accountRow = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!isNative()) return;
    queueMicrotask(() => setNative(true));
    void appInfo().then(value => { if (value) setInfo(value); });
  }, []);
  // /delete-account links to /account#account-delete: the folded "Consents and account" row opens and comes into view.
  // Only the row — the delete dialog itself is never opened for the person.
  useEffect(() => {
    const row = accountRow.current;
    if (!row || window.location.hash !== "#account-delete") return;
    row.open = true;
    const timer = window.setTimeout(() => row.scrollIntoView({ block: "center" }), 60);
    return () => window.clearTimeout(timer);
  }, []);
  const consents = state.consents ?? [];
  const missing = missingConsents(state);
  const platform = info?.platform ?? nativePlatform();
  return <>
    <section className="cabinet-card" aria-labelledby="cabinet-settings-title">
      <h2 id="cabinet-settings-title">{c.settings.title}</h2>
      {/* First: order notices in Telegram, the customer's own consent (hidden while the bot is not set up). */}
      <TelegramNoticesSetting locale={locale} />
      <div className="cabinet-setting"><span>{c.settings.theme}</span><ThemeToggle locale={locale} /></div>
      <Link className="cabinet-setting cabinet-setting-link" href="/support"><span className="cabinet-setting-label"><LifeBuoy size={18} aria-hidden="true" />{c.settings.support}</span><ArrowRight size={18} aria-hidden="true" /></Link>
      <Link className="cabinet-setting cabinet-setting-link" href="/privacy"><span className="cabinet-setting-label"><Shield size={18} aria-hidden="true" />{c.settings.privacy}</span><ArrowRight size={18} aria-hidden="true" /></Link>
      <Link className="cabinet-setting cabinet-setting-link" href="/terms"><span className="cabinet-setting-label"><FileCheck2 size={18} aria-hidden="true" />{c.settings.terms}</span><ArrowRight size={18} aria-hidden="true" /></Link>
      {/* Consents and account deletion fold into one row: they are needed rarely, so they are not shown open
          (owner, 12 October 2026). The row opens by itself while a consent still has to be accepted. */}
      <details ref={accountRow} id="account-delete" className="cabinet-setting-more" open={missing.length > 0 || undefined}>
        <summary className="cabinet-setting">
          <span className="cabinet-setting-label"><UserCog size={18} aria-hidden="true" />{c.settings.account}</span>
          <small className={missing.length ? "cabinet-setting-need" : undefined}>{missing.length ? c.settings.consentsNeed : c.settings.consentsOk}</small>
        </summary>
        <div className="cabinet-setting-more-body">
          <p className="cabinet-setting-sub">{c.settings.consents}</p>
          {consents.length ? <ul className="cabinet-consents">{consents.map(item => <li key={item.key}><b>{c.settings.consentDoc[item.key]}</b><small>{c.settings.consentVersion(item.version)} · {formatLongDate(item.acceptedAt, locale)}</small></li>)}</ul> : <p className="cabinet-muted">{c.settings.consentsNone}</p>}
          {missing.length > 0 && <button type="button" className="btn secondary" disabled={!ready} onClick={() => void act({ type: "consent-accept", documents: [...consentDocuments], version: consentVersion })}>{c.settings.consentsAccept}</button>}
          <div className="cabinet-delete-row">
            <p className="cabinet-muted">{c.deletion.lead}</p>
            <button type="button" className="cabinet-text-btn cabinet-delete-open" onClick={() => setDeleting(true)}><Trash2 size={16} aria-hidden="true" />{c.deletion.open}</button>
          </div>
        </div>
      </details>
      {native && <div className="cabinet-setting cabinet-setting-block">
        <button type="button" className="cabinet-text-btn" disabled={restoring} onClick={async () => {
          setRestoring(true);
          // Nothing is bought through the stores: "restore" only reloads the account the orders live in.
          try { await refresh(); setRestored(c.settings.restored(state.orders.length)); } finally { setRestoring(false); }
        }}><RefreshCw size={16} aria-hidden="true" />{c.settings.restore}</button>
        {restored && <p className="cabinet-muted" role="status">{restored}</p>}
      </div>}
      {native && <div className="cabinet-setting cabinet-setting-block">
        <span className="cabinet-setting-label"><Info size={18} aria-hidden="true" />{c.settings.about}</span>
        <p className="cabinet-muted">{info ? c.settings.aboutVersion(info.version, info.build) : null}{info && platform ? " · " : null}{platform ? c.settings.aboutPlatform[platform] : null}</p>
        <Link className="cabinet-link" href="/app">{c.settings.aboutLink}<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>}
      <button type="button" className="cabinet-signout" onClick={onSignOut}><LogOut size={18} aria-hidden="true" />{c.settings.signOut}</button>
    </section>
    <DeleteAccountDialog open={deleting} onClose={() => setDeleting(false)} c={c} locale={locale} state={state} onSupport={() => { setDeleting(false); onSupport(); }} />
  </>;
}

/** Confirmation sheet: what goes, what stays, what still blocks, the lost balance, and the final button. */
function DeleteAccountDialog({ open, onClose, c, locale, state, onSupport }: { open: boolean; onClose: () => void; c: AccountCopy; locale: Locale; state: State; onSupport: () => void }) {
  const [acknowledge, setAcknowledge] = useState(false);
  const [busy, setBusy] = useState(false);
  const summary = deletionSummary(state);
  const blockers = deletionBlockers(state);
  const d = c.deletion;
  const canDelete = !blockers.length && (summary.balance <= 0 || acknowledge) && !busy;
  async function remove() {
    setBusy(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true, acknowledgeBalance: acknowledge }) });
      const data = await res.json().catch(() => ({})) as { deleted?: boolean; errorCode?: string; error?: string };
      if (!res.ok || !data.deleted) { toast.error((data.errorCode ? serverError(locale, data.errorCode) : undefined) ?? data.error ?? d.failed); return; }
      toast.success(d.done);
      window.location.assign("/");
    } catch { toast.error(d.failed); }
    finally { setBusy(false); }
  }
  return <Modal open={open} onClose={onClose} title={d.title} description={d.lead} locale={locale}>
    <div className="delete-account">
      <div className="delete-account-lists">
        <div><b>{d.removed}</b><ul>{d.removedList.map(item => <li key={item}>{item}</li>)}</ul></div>
        <div><b>{d.kept}</b><ul>{d.keptList.map(item => <li key={item}>{item}</li>)}</ul></div>
      </div>
      {blockers.length > 0 && <div className="notice warning delete-account-blocked">
        <p><b>{d.blocked(blockers.length)}</b> {d.blockedHint}</p>
        <ul>{blockers.map(order => <li key={order.id}><Link href={`/orders#${order.id}`}>{order.id}</Link> · {order.product.name}</li>)}</ul>
        <div className="delete-account-actions"><Link className="btn secondary" href="/orders">{d.orders}</Link><button type="button" className="btn secondary" onClick={onSupport}><MessageCircle size={16} aria-hidden="true" />{d.support}</button></div>
      </div>}
      {summary.orders.autoCancel > 0 && <p className="cabinet-note">{d.autoCancel(summary.orders.autoCancel)}</p>}
      {summary.balance > 0 && <label className="delete-account-ack"><input type="checkbox" checked={acknowledge} onChange={event => setAcknowledge(event.target.checked)} /><span>{d.balance(formatSum(summary.balance, locale))}</span></label>}
      <div className="delete-account-actions">
        <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>{d.cancel}</button>
        <button type="button" className="btn primary delete-account-confirm" disabled={!canDelete} onClick={() => void remove()}><Trash2 size={16} aria-hidden="true" />{d.confirm}</button>
      </div>
    </div>
  </Modal>;
}
