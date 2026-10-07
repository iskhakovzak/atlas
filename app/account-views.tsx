"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/site-link";
import { AlertCircle, ArrowRight, ArrowUpRight, Bell, Check, FileCheck2, Info, LifeBuoy, LogOut, MapPin, MessageCircle, Package, Pencil, Plus, RefreshCw, ScanLine, Shield, ShoppingBag, Trash2, Wallet } from "lucide-react";
import { useMarket } from "@/lib/market/store";
import { courierAllowanceUsd } from "@/lib/market/customs";
import { balanceOf, orderPayable, totalOf, type SavedDeliveryProfile, type State } from "@/lib/market/domain";
import type { Action } from "@/lib/market/actions";
import { monthlyAllowance, recipientKey, type RecipientAllowance } from "@/lib/market/allowance";
import { localizedStatuses, serverError, type Locale } from "@/lib/market/i18n";
import { calcCopy } from "@/lib/market/calc-copy";
import { formatSum } from "@/lib/market/home-copy";
import { accountCopy, formatLongDate, itemCount, recipientCopy, type AccountCopy } from "@/lib/market/customer-copy";
import { consentDocuments, consentVersion, deletionBlockers, deletionSummary, missingConsents } from "@/lib/market/account-delete";
import { appInfo, isNative, nativePlatform, type AppInfo } from "@/lib/native/bridge";
import { toast } from "sonner";
import { Modal } from "./market-ui";
import { Money } from "./money";
import { SafeDeleteButton } from "./safe-delete-button";
import { ThemeToggle } from "./theme-control";
import { RecipientForm } from "./recipient-form";
import { SignInMethods } from "./sign-in-methods";
import { AllowanceMeter } from "./allowance-meter";

// Account home, mobile-first: one "what needs you now" card, four quick tiles, then
// recipients, customs allowance, documents, support and settings — each shown once.
export function AccountView() {
  const { user, state, ready, act, pricing, refresh, siteContent } = useMarket();
  const lang = state.communication.language;
  const c = accountCopy[lang];
  const [editor, setEditor] = useState<SavedDeliveryProfile | "new" | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticket, setTicket] = useState({ subject: "", text: "" });
  const aboutOrder = useSearchParams().get("order") ?? "";
  // "Question about this order" from /orders opens the support form with the order number filled in.
  useEffect(() => {
    if (!/^AT-[A-Z0-9]{4,12}$/.test(aboutOrder)) return;
    queueMicrotask(() => { setTicketOpen(true); setTicket(current => current.subject ? current : { ...current, subject: c.support.aboutOrder(aboutOrder) }); });
    window.setTimeout(() => document.getElementById("support")?.scrollIntoView({ block: "start" }), 300);
  }, [aboutOrder, c.support]);
  const identityProfiles = state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);
  const activeOrders = state.orders.filter(order => !order.cancelled && order.status < 5);
  const pendingApproval = activeOrders.find(order => (order.changeRequests ?? []).some(request => request.status === "pending"));
  const pendingPayment = activeOrders.find(order => order.payment?.status === "pending");
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
  const next = pendingApproval ? { title: c.next.approval, hint: pendingApproval.product.name, href: `/orders#${pendingApproval.id}`, icon: <AlertCircle aria-hidden="true" />, order: pendingApproval, tone: "warn" }
    : pendingPayment ? { title: c.next.payment, hint: pendingPayment.product.name, href: `/orders#${pendingPayment.id}`, icon: <Wallet aria-hidden="true" />, order: pendingPayment, tone: "warn" }
    : currentOrder ? { title: c.next.inProgress, hint: currentOrder.product.name, href: `/orders#${currentOrder.id}`, icon: <Package aria-hidden="true" />, order: currentOrder, tone: "info" }
    : state.cart.length ? { title: c.next.cart, hint: c.next.cartHint(itemCount(cartCount, lang)), href: "/cart", icon: <ShoppingBag aria-hidden="true" />, tone: "info" }
    : !state.deliveryProfiles.length ? { title: c.next.recipient, hint: c.next.recipientHint, icon: <MapPin aria-hidden="true" />, tone: "info" }
    : null;
  const dueOrder = !pendingApproval && pendingPayment ? pendingPayment : undefined;

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
        {/* An order waiting for payment is shown as its bill: the amount on paper, the demo note on the plate. */}
        <section className={"cabinet-next" + (next ? ` ${next.tone}` : " done") + (dueOrder ? " folio" : "")} aria-labelledby="cabinet-next-title">
          {dueOrder ? <p className="folio-cap"><b>{c.next.label}</b><span>{c.next.orderNo(dueOrder.id)}</span></p> : <p className="cabinet-eyebrow">{c.next.label}</p>}
          <div className={dueOrder ? "folio-sheet" : "cabinet-next-inner"}>
            <div className="cabinet-next-body">
              <span className="cabinet-next-icon">{next ? next.icon : <Check aria-hidden="true" />}</span>
              <div><h2 id="cabinet-next-title">{next ? next.title : c.next.allSet}</h2><p>{next ? next.hint : c.next.allSetHint}</p></div>
            </div>
            {dueOrder && <p className="bill-total"><span>{c.next.due}</span><strong><Money value={orderPayable(dueOrder)} locale={lang} /></strong></p>}
            {next?.order && <div className="cabinet-progress">
              <div className="cabinet-bar" role="progressbar" aria-label={statuses[next.order.status]} aria-valuemin={1} aria-valuemax={statuses.length} aria-valuenow={next.order.status + 1}><span style={{ width: `${(next.order.status + 1) / statuses.length * 100}%` }} /></div>
              <small>{c.next.stage(next.order.status + 1, statuses.length)}: {statuses[next.order.status]}</small>
            </div>}
            {next ? (next.href ? <Link className="btn primary" href={next.href}>{c.next.open}</Link> : <button type="button" className="btn primary" onClick={() => setEditor("new")}>{c.next.add}<Plus size={17} aria-hidden="true" /></button>)
              : <Link className="btn primary" href="/order-by-link">{c.next.newOrder}</Link>}
          </div>
          {dueOrder && <p className="folio-foot">{c.next.noCharge}</p>}
        </section>

        <nav className="cabinet-tiles" aria-label={c.tiles.label}>
          <Link href="/orders"><Package aria-hidden="true" /><span>{c.tiles.orders}</span><strong>{state.orders.length}</strong><small>{activeOrders.length ? c.tiles.ordersActive(activeOrders.length) : state.orders.length ? c.tiles.ordersTotal(state.orders.length) : c.tiles.none}</small></Link>
          <Link href="/cart"><ShoppingBag aria-hidden="true" /><span>{c.tiles.cart}</span><strong>{cartCount}</strong><small>{cartCount ? formatSum(totalOf(state.cart), lang) : c.tiles.cartEmpty}</small></Link>
          <Link href="/balance"><Wallet aria-hidden="true" /><span>{c.tiles.balance}</span><strong className="cabinet-money">{formatSum(balance, lang)}</strong><small>{c.tiles.balanceSub}</small></Link>
          <Link href="/notifications"><Bell aria-hidden="true" /><span>{c.tiles.notifications}</span><strong>{state.notifications.length}</strong><small>{unread ? c.tiles.unread(unread) : c.tiles.noUnread}</small></Link>
        </nav>

        <section className="cabinet-card" aria-labelledby="cabinet-recipients-title">
          <h2 id="cabinet-recipients-title">{c.recipients.title}</h2>
          <p className="cabinet-lead">{c.recipients.lead}</p>
          {state.deliveryProfiles.length ? <ul className="cabinet-recipients">{state.deliveryProfiles.map(profile => {
            const passport = identityProfiles.find(identity => identity.recipientProfileId === profile.id);
            // A recipient saved under their own name would show it twice.
            const named = profile.label.trim() && profile.label.trim() !== profile.recipient.trim();
            return <li key={profile.id}>
              <div className="cabinet-recipient-top"><b>{named ? profile.label : profile.recipient}</b>{profile.primary && <span className="cabinet-badge">{c.recipients.primary}</span>}</div>
              <p>{named && <>{profile.recipient} · </>}<span className="nowrap">{profile.phone}</span></p>
              <p className="cabinet-muted">{[profile.region, profile.city, profile.address, profile.postalCode].filter(Boolean).join(", ")}</p>
              <div className="cabinet-recipient-foot">
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

        <section className="cabinet-card" id="support" aria-labelledby="cabinet-support-title">
          <div className="cabinet-card-head"><div><h2 id="cabinet-support-title">{c.support.title}</h2><p className="cabinet-lead">{c.support.lead}</p></div>
            {telegram && <a className="btn secondary" href={`https://t.me/${telegram}`} target="_blank" rel="noopener noreferrer">{c.support.telegram}<ArrowUpRight size={16} aria-hidden="true" /></a>}</div>
          {state.supportTickets.length ? <ul className="cabinet-tickets">{state.supportTickets.slice(0, 3).map(item => <li key={item.id}>
            <div className="cabinet-ticket-head"><b>{item.subject}</b><span className={"cabinet-status " + item.status}>{item.status === "open" ? c.support.waiting : item.status === "answered" ? c.support.answered : c.support.closed}</span></div>
            <details><summary>{c.support.history} · {c.support.messages(item.replies.length)}</summary>
              {item.replies.map(reply => <p className="ticket-reply" key={reply.id}><b>{reply.author === "support" ? c.support.team : c.support.you}</b><br />{reply.text}</p>)}
              {item.status !== "closed" && <form className="support-reply-form" onSubmit={async event => { event.preventDefault(); const form = event.currentTarget; const input = form.elements.namedItem("reply") as HTMLInputElement; if (await act({ type: "support-reply", id: item.id, text: input.value })) input.value = ""; }}><input name="reply" aria-label={c.support.replyPlaceholder} required minLength={3} maxLength={1000} placeholder={c.support.replyPlaceholder} /><button className="btn secondary">{c.support.reply}</button></form>}
            </details>
          </li>)}</ul> : null}
          {ticketOpen ? <form className="cabinet-ticket-form" onSubmit={async event => { event.preventDefault(); if (await act({ type: "support-create", subject: ticket.subject, text: ticket.text })) { setTicket({ subject: "", text: "" }); setTicketOpen(false); toast.success(c.support.sent); } }}>
            <label htmlFor="support-subject">{c.support.subject}</label><input id="support-subject" required minLength={3} maxLength={120} value={ticket.subject} onChange={event => setTicket({ ...ticket, subject: event.target.value })} />
            <label htmlFor="support-question">{c.support.question}</label><textarea id="support-question" required minLength={3} maxLength={1000} rows={4} value={ticket.text} onChange={event => setTicket({ ...ticket, text: event.target.value })} />
            <div className="cabinet-form-foot"><small>{ticket.text.length} / 1000</small><button className="btn primary" disabled={!ready}><MessageCircle size={16} aria-hidden="true" />{c.support.send}</button></div>
          </form> : <button type="button" className="cabinet-add" onClick={() => setTicketOpen(true)}><Plus size={18} aria-hidden="true" />{c.support.newTicket}</button>}
        </section>
      </div>

      <div className="cabinet-side">
        <CustomsAllowance groups={allowance} primaryName={primaryRecipient?.recipient} cartUsd={cartUsd} c={c} locale={lang} />

        <section className="cabinet-card" aria-labelledby="cabinet-documents-title">
          <h2 id="cabinet-documents-title">{c.documents.title}</h2>
          <ul className="cabinet-rows">
            <li><Link href="/identity"><ScanLine aria-hidden="true" /><span>{c.documents.passport}<small>{identityProfiles.length ? c.documents.passportCount(identityProfiles.length) : c.documents.missing}</small></span><ArrowRight size={18} aria-hidden="true" /></Link></li>
            <li><Link href="/declaration"><FileCheck2 aria-hidden="true" /><span>{c.documents.declarations}<small>{c.documents.declarationsCount(state.declarations.length)}</small></span><ArrowRight size={18} aria-hidden="true" /></Link></li>
          </ul>
          <p className="cabinet-note">{c.documents.note}</p>
        </section>

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
  const anyOver = rows.some(row => row.usedUsd > limit);
  const month = new Intl.DateTimeFormat(locale === "oz" ? "uz-Cyrl" : locale, { month: "long" }).format(new Date());
  return <section className={"cabinet-card cabinet-customs" + (anyOver ? " over" : "")} aria-labelledby="cabinet-customs-title">
    <div className="cabinet-customs-top">
      <h2 id="cabinet-customs-title">{c.customs.title}</h2>
      <span className="cabinet-month">{month}</span>
    </div>
    <p className="cabinet-lead">{c.customs.perPerson}</p>
    {rows.length ? <ul className="cabinet-allowance">{rows.map(row => {
      const over = row.usedUsd > limit;
      const name = row.name || c.customs.unnamed;
      return <li key={row.key} className={over ? "over" : undefined}>
        <div className="cabinet-allowance-head">
          <span className="cabinet-allowance-who"><i aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</i><b>{name}</b></span>
          <span className="cabinet-allowance-figure"><strong>${Math.round((over ? row.usedUsd - limit : limit - row.usedUsd) * 100) / 100}</strong><small>{over ? c.customs.overLabel : c.customs.leftLabel}</small></span>
        </div>
        <AllowanceMeter limit={limit} orders={row.parts ?? []} cartUsd={row.name === primaryName || rows.length === 1 ? cartUsd : 0} locale={locale} label={name} />
        <p className="cabinet-allowance-status">{over ? c.customs.over(row.usedUsd - limit) : c.customs.used(row.usedUsd, limit)}</p>
      </li>;
    })}</ul> : <p className="cabinet-empty">{c.customs.empty}</p>}
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
  useEffect(() => {
    if (!isNative()) return;
    queueMicrotask(() => setNative(true));
    void appInfo().then(value => { if (value) setInfo(value); });
  }, []);
  const consents = state.consents ?? [];
  const missing = missingConsents(state);
  const platform = info?.platform ?? nativePlatform();
  return <>
    <section className="cabinet-card" aria-labelledby="cabinet-settings-title">
      <h2 id="cabinet-settings-title">{c.settings.title}</h2>
      <div className="cabinet-setting"><span>{c.settings.theme}</span><ThemeToggle locale={locale} /></div>
      <Link className="cabinet-setting cabinet-setting-link" href="/support"><span className="cabinet-setting-label"><LifeBuoy size={18} aria-hidden="true" />{c.settings.support}</span><ArrowRight size={18} aria-hidden="true" /></Link>
      <Link className="cabinet-setting cabinet-setting-link" href="/privacy"><span className="cabinet-setting-label"><Shield size={18} aria-hidden="true" />{c.settings.privacy}</span><ArrowRight size={18} aria-hidden="true" /></Link>
      <Link className="cabinet-setting cabinet-setting-link" href="/terms"><span className="cabinet-setting-label"><FileCheck2 size={18} aria-hidden="true" />{c.settings.terms}</span><ArrowRight size={18} aria-hidden="true" /></Link>
      <div className="cabinet-setting cabinet-setting-block">
        <span>{c.settings.consents}</span>
        {consents.length ? <ul className="cabinet-consents">{consents.map(item => <li key={item.key}><b>{c.settings.consentDoc[item.key]}</b><small>{c.settings.consentVersion(item.version)} · {formatLongDate(item.acceptedAt, locale)}</small></li>)}</ul> : <p className="cabinet-muted">{c.settings.consentsNone}</p>}
        {missing.length > 0 && <button type="button" className="btn secondary" disabled={!ready} onClick={() => void act({ type: "consent-accept", documents: [...consentDocuments], version: consentVersion })}>{c.settings.consentsAccept}</button>}
      </div>
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

    <section className="cabinet-card cabinet-danger" aria-labelledby="cabinet-delete-title">
      <h2 id="cabinet-delete-title">{c.deletion.title}</h2>
      <p className="cabinet-lead">{c.deletion.lead}</p>
      <button type="button" className="cabinet-signout cabinet-delete-open" onClick={() => setDeleting(true)}><Trash2 size={18} aria-hidden="true" />{c.deletion.open}</button>
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
