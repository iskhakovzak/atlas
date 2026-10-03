"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/site-link";
import { AlertCircle, ArrowRight, ArrowUpRight, Bell, Check, FileCheck2, LogOut, MapPin, MessageCircle, Package, Pencil, Plus, ScanLine, ShoppingBag, Wallet } from "lucide-react";
import { useMarket } from "@/lib/market/store";
import { courierAllowanceUsd } from "@/lib/market/customs";
import { balanceOf, totalOf, type SavedDeliveryProfile } from "@/lib/market/domain";
import { monthlyAllowance, recipientKey, type RecipientAllowance } from "@/lib/market/allowance";
import { localizedStatuses } from "@/lib/market/i18n";
import { formatSum } from "@/lib/market/home-copy";
import { accountCopy, formatLongDate, itemCount, recipientCopy, type AccountCopy } from "@/lib/market/customer-copy";
import { siteContent } from "@/lib/market/site-content";
import { toast } from "sonner";
import { Modal } from "./market-ui";
import { SafeDeleteButton } from "./safe-delete-button";
import { ThemeToggle } from "./theme-control";
import { RecipientForm } from "./recipient-form";

// Account home, mobile-first: one "what needs you now" card, four quick tiles, then
// recipients, customs allowance, documents, support and settings — each shown once.
export function AccountView() {
  const { user, state, ready, act, pricing } = useMarket();
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

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    window.location.assign("/");
  }

  return <div className="cabinet">
    <header className="cabinet-head">
      <span className="cabinet-avatar" aria-hidden="true">{(user.name || contact || "A").trim().charAt(0).toUpperCase()}</span>
      <div className="cabinet-identity"><h1>{c.title}</h1><p><b>{user.name}</b>{contact && contact !== user.name ? <> · {contact}</> : null}<small>{c.since(since)}</small></p></div>
      {user.operator && <Link className="btn secondary cabinet-manage" href="/admin">{c.manage}<ArrowUpRight size={17} aria-hidden="true" /></Link>}
    </header>

    <div className="cabinet-grid">
      <div className="cabinet-main">
        <section className={"cabinet-next" + (next ? ` ${next.tone}` : " done")} aria-labelledby="cabinet-next-title">
          <p className="cabinet-eyebrow">{c.next.label}</p>
          <div className="cabinet-next-body">
            <span className="cabinet-next-icon">{next ? next.icon : <Check aria-hidden="true" />}</span>
            <div><h2 id="cabinet-next-title">{next ? next.title : c.next.allSet}</h2><p>{next ? next.hint : c.next.allSetHint}</p></div>
          </div>
          {next?.order && <div className="cabinet-progress">
            <div className="cabinet-bar" role="progressbar" aria-label={statuses[next.order.status]} aria-valuemin={1} aria-valuemax={statuses.length} aria-valuenow={next.order.status + 1}><span style={{ width: `${(next.order.status + 1) / statuses.length * 100}%` }} /></div>
            <small>{c.next.stage(next.order.status + 1, statuses.length)} · {statuses[next.order.status]}</small>
          </div>}
          {next ? (next.href ? <Link className="btn primary" href={next.href}>{c.next.open}<ArrowRight size={17} aria-hidden="true" /></Link> : <button type="button" className="btn primary" onClick={() => setEditor("new")}>{c.next.add}<Plus size={17} aria-hidden="true" /></button>)
            : <Link className="btn primary" href="/order-by-link">{c.next.newOrder}<ArrowRight size={17} aria-hidden="true" /></Link>}
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
            return <li key={profile.id}>
              <div className="cabinet-recipient-top"><b>{profile.label}</b>{profile.primary && <span className="cabinet-badge">{c.recipients.primary}</span>}</div>
              <p>{profile.recipient} · {profile.phone}</p>
              <p className="cabinet-muted">{profile.region}, {profile.city}, {profile.address}</p>
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
          </li>)}</ul> : <p className="cabinet-empty">{c.support.none}</p>}
          {ticketOpen || !state.supportTickets.length ? <form className="cabinet-ticket-form" onSubmit={async event => { event.preventDefault(); if (await act({ type: "support-create", subject: ticket.subject, text: ticket.text })) { setTicket({ subject: "", text: "" }); setTicketOpen(false); toast.success(c.support.sent); } }}>
            <label htmlFor="support-subject">{c.support.subject}</label><input id="support-subject" required minLength={3} maxLength={120} value={ticket.subject} onChange={event => setTicket({ ...ticket, subject: event.target.value })} />
            <label htmlFor="support-question">{c.support.question}</label><textarea id="support-question" required minLength={3} maxLength={1000} rows={4} value={ticket.text} onChange={event => setTicket({ ...ticket, text: event.target.value })} />
            <div className="cabinet-form-foot"><small>{ticket.text.length} / 1000</small><button className="btn primary" disabled={!ready}><MessageCircle size={16} aria-hidden="true" />{c.support.send}</button></div>
          </form> : <button type="button" className="cabinet-add" onClick={() => setTicketOpen(true)}><Plus size={18} aria-hidden="true" />{c.support.newTicket}</button>}
        </section>
      </div>

      <div className="cabinet-side">
        <CustomsAllowance groups={allowance} primaryName={primaryRecipient?.recipient} cartUsd={cartUsd} c={c} />

        <section className="cabinet-card" aria-labelledby="cabinet-documents-title">
          <h2 id="cabinet-documents-title">{c.documents.title}</h2>
          <ul className="cabinet-rows">
            <li><Link href="/identity"><ScanLine aria-hidden="true" /><span>{c.documents.passport}<small>{identityProfiles.length ? c.documents.passportCount(identityProfiles.length) : c.documents.missing}</small></span><ArrowRight size={18} aria-hidden="true" /></Link></li>
            <li><Link href="/declaration"><FileCheck2 aria-hidden="true" /><span>{c.documents.declarations}<small>{c.documents.declarationsCount(state.declarations.length)}</small></span><ArrowRight size={18} aria-hidden="true" /></Link></li>
          </ul>
          <p className="cabinet-note">{c.documents.note}</p>
        </section>

        <section className="cabinet-card" aria-labelledby="cabinet-settings-title">
          <h2 id="cabinet-settings-title">{c.settings.title}</h2>
          <div className="cabinet-setting"><span>{c.settings.theme}</span><ThemeToggle locale={lang} /></div>
          <Link className="cabinet-setting cabinet-setting-link" href="/legal">{c.settings.rules}<ArrowRight size={18} aria-hidden="true" /></Link>
          <button type="button" className="cabinet-signout" onClick={() => void signOut()}><LogOut size={18} aria-hidden="true" />{c.settings.signOut}</button>
        </section>
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
function CustomsAllowance({ groups, primaryName, cartUsd, c }: { groups: RecipientAllowance[]; primaryName?: string; cartUsd: number; c: AccountCopy }) {
  const limit = courierAllowanceUsd;
  // Show the default recipient even before their first order, so the empty state still says "for whom".
  const rows = groups.length ? groups : primaryName ? [{ key: recipientKey(primaryName), name: primaryName, usedUsd: 0, orders: 0 }] : [];
  const anyOver = rows.some(row => row.usedUsd > limit);
  return <section className={"cabinet-card cabinet-customs" + (anyOver ? " over" : "")} aria-labelledby="cabinet-customs-title">
    <h2 id="cabinet-customs-title">{c.customs.title}</h2>
    <p className="cabinet-lead">{c.customs.perPerson}</p>
    {rows.length ? <ul className="cabinet-allowance">{rows.map(row => {
      const over = row.usedUsd > limit;
      return <li key={row.key} className={over ? "over" : undefined}>
        <div className="cabinet-allowance-head"><b>{row.name || c.customs.unnamed}</b><strong>{c.customs.used(row.usedUsd, limit)}</strong></div>
        <div className="cabinet-bar" role="progressbar" aria-label={row.name || c.customs.unnamed} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(row.usedUsd, limit)}><span style={{ width: `${Math.min(100, row.usedUsd / limit * 100)}%` }} /></div>
        <small>{over ? c.customs.over(row.usedUsd - limit) : c.customs.left(limit - row.usedUsd)}</small>
      </li>;
    })}</ul> : <p className="cabinet-empty">{c.customs.empty}</p>}
    {cartUsd > 0 && <p className="cabinet-customs-cart">{c.customs.cart(cartUsd)}</p>}
    <p className="cabinet-note">{c.customs.note}</p>
    <Link className="cabinet-link" href="/customs">{c.customs.link}<ArrowRight size={16} aria-hidden="true" /></Link>
  </section>;
}
