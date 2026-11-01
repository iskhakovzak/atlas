"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/site-link";
import { InfoTip } from "@/components/info-tip";
import { ArrowLeft, ArrowRight, ArrowUpRight, Bell, Check, FileCheck2, Heart, Info, LifeBuoy, LogOut, MapPin, MessageCircle, Package, Pencil, Plus, RefreshCw, ScanLine, Settings2, Shield, ShoppingBag, Trash2, UserCog, Wallet } from "lucide-react";
import { useMarket } from "@/lib/market/store";
import { courierAllowanceUsd } from "@/lib/market/customs";
import { isServedRegion } from "@/lib/market/addresses";
import { balanceOf, type SavedDeliveryProfile, type State } from "@/lib/market/domain";
import { buyerParcels, documentsPath, parcelAction, parcelActive, profileActions } from "@/lib/market/parcels";
import { profileCopy } from "@/lib/market/profile-copy";
import type { Action } from "@/lib/market/actions";
import { monthlyAllowance, recipientKey, type RecipientAllowance } from "@/lib/market/allowance";
import { isUzbek, serverError, type Locale } from "@/lib/market/i18n";
import { uzText } from "@/lib/market/uz-cyrl";
import { uzMonths } from "@/lib/market/notices-copy";
import { calcCopy } from "@/lib/market/calc-copy";
import { formatSum } from "@/lib/market/format";
import { accountCopy, formatLongDate, recipientCopy, type AccountCopy } from "@/lib/market/customer-copy";
import { consentDocuments, consentVersion, deletionBlockers, deletionSummary, missingConsents } from "@/lib/market/account-delete";
import { appInfo, isNative, nativePlatform, type AppInfo } from "@/lib/native/bridge";
import { toast } from "@/lib/market/toast";
import { Modal } from "./modal";
import { SafeDeleteButton } from "./safe-delete-button";
import { ThemeToggle } from "./theme-control";
import { RecipientForm } from "./recipient-form";
import { SignInMethods } from "./sign-in-methods";
import { TelegramNoticesSetting, TelegramNudge } from "./telegram-notices";
import { PushSettingsRow } from "./push-toggle";
import { ProfileActionCard, ParcelCard } from "./profile-parcels";
import { AllowanceMeter, allowanceMoney } from "./allowance-meter";

// The profile, mobile-first and parcel-first (1 November 2026): «Требует действия», the active parcels with their stage
// bar and one button, six tiles (orders, balance, documents, notifications, saved, settings), then recipients and
// support; the customs allowance beside them. Settings live on /account/settings, documents on /account/documents.
export function AccountView() {
  const { user, state, ready, act, pricing, siteContent } = useMarket();
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
  // The profile is built around the parcel (lib/market/parcels.ts): what waits for the buyer, then the parcels on their way.
  const parcels = buyerParcels(state.orders);
  const activeParcels = parcels.filter(parcelActive);
  const actions = profileActions(state);
  // A passport card speaks of the furthest parcel of its recipient: "for customs" once one of them is on its way.
  const actionStage = (action: (typeof actions)[number]) => action.kind === "passport"
    ? Math.max(-1, ...activeParcels.filter(parcel => parcel.deliveryProfileId === action.recipientId || parcel.id === action.parcelId).map(parcel => parcel.stage ?? -1))
    : undefined;
  const unread = state.notifications.filter(item => !item.read).length;
  const balance = balanceOf(state);
  const allowance = monthlyAllowance(state, pricing.fx);
  const primaryRecipient = state.deliveryProfiles.find(profile => profile.primary) ?? state.deliveryProfiles[0];
  const cartUsd = Math.round(state.cart.reduce((sum, item) => sum + item.product.usd * item.quantity, 0));
  const telegram = siteContent.contacts.telegramSupport;

  if (!user) return <section className="cabinet-card cabinet-signin"><h1>{c.signin.title}</h1><p>{c.signin.text}</p><a className="btn primary" href="/login?return_to=%2Faccount">{c.signin.action}<ArrowRight size={18} aria-hidden="true" /></a></section>;

  const contact = user.email || user.contact;
  const since = formatLongDate(user.createdAt, lang);
  const p = profileCopy[lang];
  const tileWords = p.hub.tiles;
  const passportsSaved = identityProfiles.length;

  return <div className="cabinet pf-hub">
    <header className="cabinet-head">
      <span className="cabinet-avatar" aria-hidden="true">{(user.name || contact || "A").trim().charAt(0).toUpperCase()}</span>
      <div className="cabinet-identity"><h1>{p.hub.title}</h1><p><b>{user.name}</b>{contact && contact !== user.name ? <> · {contact}</> : null}<small>{c.since(since)}</small></p></div>
      {(user.operator || !!user.permissions?.length) && <Link className="btn secondary cabinet-manage" href="/admin">{c.manage}<ArrowUpRight size={18} aria-hidden="true" /></Link>}
    </header>

    <div className="cabinet-grid">
      <div className="cabinet-main">
        {/* Parcel first (owner, 1 November 2026): what waits for the buyer, then the parcels on their way, each with its
            eight-stage bar and one button. A new account sees one invitation instead of empty blocks. */}
        {actions.length > 0 && <section className="pf-section" aria-labelledby="pf-actions-title">
          <h2 id="pf-actions-title" className="pf-section-title">{p.hub.actions}<span className="pf-count">{actions.length}</span></h2>
          <ul className="pf-actions">{actions.map(action => <ProfileActionCard key={action.kind + action.orderId + (action.recipientId ?? "")} action={action} locale={lang} stage={actionStage(action)} />)}</ul>
        </section>}
        {activeParcels.length > 0 ? <section className="pf-section" aria-labelledby="pf-parcels-title">
          <div className="pf-section-head"><h2 id="pf-parcels-title" className="pf-section-title">{p.hub.parcels}<span className="pf-count">{activeParcels.length}</span></h2><Link className="pf-section-link" href="/orders">{p.hub.allParcels}<ArrowRight size={16} aria-hidden="true" /></Link></div>
          {!actions.length && <p className="pf-calm"><Check size={16} aria-hidden="true" />{p.hub.allSet}. {p.hub.allSetHint}</p>}
          <ul className="pf-parcels">{activeParcels.map(parcel => <ParcelCard key={parcel.id} parcel={parcel} action={parcelAction(parcel, actions)} locale={lang} listed />)}</ul>
          <TelegramNudge locale={lang} />
        </section> : !actions.length && <section className="pf-empty cabinet-card" aria-labelledby="pf-empty-title">
          <span className="pf-empty-icon" aria-hidden="true"><Package size={22} /></span>
          <div><h2 id="pf-empty-title">{state.orders.length ? p.hub.parcelsEmpty : c.next.firstOrder}</h2><p>{state.orders.length ? p.hub.parcelsEmptyHint : c.next.firstOrderHint}</p></div>
          {state.cart.length ? <Link className="btn primary" href="/cart">{c.next.checkout}<ArrowRight size={18} aria-hidden="true" /></Link> : <Link className="btn primary" href="/order-by-link">{p.hub.newOrder}<ArrowRight size={18} aria-hidden="true" /></Link>}
        </section>}

        {/* Six sections of the profile, each one tap away (plan §2: Заказы/Посылки, Баланс, Документы, Уведомления, Избранное, Настройки). */}
        <nav className="pf-tiles" aria-label={tileWords.label}>
          <Link href="/orders"><Package aria-hidden="true" /><span>{tileWords.orders}</span><small>{tileWords.ordersSub(activeParcels.length, parcels.length)}</small></Link>
          <Link href="/balance"><Wallet aria-hidden="true" /><span>{tileWords.balance}</span><small className="cabinet-money">{balance !== 0 ? formatSum(balance, lang) : tileWords.balanceSub}</small></Link>
          <Link href="/account/documents"><FileCheck2 aria-hidden="true" /><span>{tileWords.documents}</span><small>{tileWords.documentsSub(passportsSaved, state.declarations.length)}</small></Link>
          <Link href="/notifications"><Bell aria-hidden="true" /><span>{tileWords.notifications}</span><small>{tileWords.notificationsSub(unread)}</small>{unread > 0 && <i className="pf-tile-dot" aria-hidden="true" />}</Link>
          <Link href="/favorites"><Heart aria-hidden="true" /><span>{tileWords.favorites}</span><small>{tileWords.favoritesSub(state.favorites.length)}</small></Link>
          <Link href="/account/settings"><Settings2 aria-hidden="true" /><span>{tileWords.settings}</span><small>{tileWords.settingsSub}</small></Link>
        </nav>

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
                {passport ? <span className="cabinet-chip ok"><Check size={14} aria-hidden="true" />{c.recipients.passportOk(passport.passportMasked)}</span> : <Link className="cabinet-chip warn" href={documentsPath(profile.id)}><ScanLine size={14} aria-hidden="true" />{c.recipients.addPassport}</Link>}
              </div>
              <div className="cabinet-recipient-actions">
                <button type="button" className="cabinet-text-btn" onClick={() => setEditor(profile)}><Pencil size={16} aria-hidden="true" />{c.recipients.edit}</button>
                {!profile.primary && <button type="button" className="cabinet-text-btn" onClick={() => void act({ type: "delivery-profile-save", id: profile.id, value: profile, label: profile.label, primary: true })}>{c.recipients.makePrimary}</button>}
                <SafeDeleteButton label={c.recipients.remove} itemName={profile.label} locale={lang} onConfirm={() => act({ type: "delivery-profile-remove", id: profile.id })} />
              </div>
            </li>;
          })}</ul> : <p className="cabinet-empty">{c.recipients.empty}</p>}
          <button type="button" className="cabinet-add" onClick={() => setEditor("new")}><Plus size={18} aria-hidden="true" />{c.recipients.add}</button>
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

        {/* Language, theme, Telegram, sign-in methods and the account itself moved to /account/settings (1 November 2026). */}
        <Link className="cabinet-link pf-settings-link" href="/account/settings"><Settings2 size={16} aria-hidden="true" />{tileWords.settings}<ArrowRight size={16} aria-hidden="true" /></Link>
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
      <h2 id="cabinet-settings-title">{profileCopy[locale].settings.help}</h2>
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

const settingsLanguages: { code: Locale; lang: string; name: string }[] = [
  { code: "ru", lang: "ru", name: "Русский" },
  { code: "uz", lang: "uz-Latn", name: "O‘zbekcha" },
  { code: "oz", lang: "uz-Cyrl", name: "Ўзбекча" },
  { code: "en", lang: "en", name: "English" },
];

/**
 * /account/settings (1 November 2026): language, theme, parcel notices in Telegram and the browser, sign-in methods,
 * help and legal documents, consents, account deletion and sign-out — moved out of the profile hub, nothing removed.
 */
export function SettingsView() {
  const { user, state, ready, act, refresh, setLocale } = useMarket();
  const lang = state.communication.language;
  const c = accountCopy[lang], p = profileCopy[lang];
  if (!user) return <section className="cabinet-card cabinet-signin"><h1>{c.signin.title}</h1><p>{c.signin.text}</p><a className="btn primary" href="/login?return_to=%2Faccount%2Fsettings">{c.signin.action}<ArrowRight size={18} aria-hidden="true" /></a></section>;
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    window.location.assign("/");
  }
  return <div className="cabinet pf-page pf-settings">
    <header className="pf-page-head">
      <Link className="pf-back" href="/account"><ArrowLeft size={16} aria-hidden="true" />{p.parcel.back}</Link>
      <h1>{p.settings.title}</h1>
      <p>{p.settings.lead}</p>
    </header>
    <div className="pf-settings-grid">
      <div className="pf-settings-col">
        <section className="cabinet-card" aria-labelledby="pf-language-title">
          <h2 id="pf-language-title">{p.settings.language}</h2>
          <div className="pf-segmented" role="radiogroup" aria-labelledby="pf-language-title">
            {/* A radio group: one tab stop (the chosen language), arrows move and choose (WAI-ARIA radio group). */}
            {settingsLanguages.map((item, index) => <button key={item.code} type="button" role="radio" lang={item.lang} aria-checked={item.code === lang} tabIndex={item.code === lang ? 0 : -1} className={item.code === lang ? "selected" : undefined} onClick={() => { if (item.code !== lang) setLocale(item.code); }} onKeyDown={event => {
              const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : event.key === "Home" ? -index : event.key === "End" ? settingsLanguages.length - 1 - index : 0;
              if (!step) return;
              event.preventDefault();
              const target = (index + step + settingsLanguages.length) % settingsLanguages.length;
              (event.currentTarget.parentElement?.children[target] as HTMLElement | undefined)?.focus();
              setLocale(settingsLanguages[target].code);
            }}>{item.name}</button>)}
          </div>
          <div className="cabinet-setting pf-theme-row"><span>{p.settings.theme}</span><ThemeToggle locale={lang} /></div>
        </section>
        {/* Telegram first: a message on every new stage of a parcel and a separate one when an action is needed. */}
        <section className="cabinet-card" id="notices" aria-labelledby="pf-notices-title">
          <h2 id="pf-notices-title">{p.settings.notices}</h2>
          <TelegramNoticesSetting locale={lang} />
          <PushSettingsRow locale={lang} />
          <p className="cabinet-lead pf-notices-lead">{p.settings.noticesLead}</p>
          <Link className="cabinet-link" href="/notifications">{p.hub.tiles.notifications}<ArrowRight size={16} aria-hidden="true" /></Link>
        </section>
      </div>
      <div className="pf-settings-col">
        <SignInMethods locale={lang} />
        <SettingsCard c={c} locale={lang} state={state} ready={ready} act={act} refresh={refresh} onSignOut={signOut} onSupport={() => window.location.assign("/account?support=new#support")} />
      </div>
    </div>
  </div>;
}
