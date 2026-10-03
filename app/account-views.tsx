"use client";

import { useState } from "react";
import Link from "@/components/site-link";
import { AlertCircle, ArrowRight, ArrowUpRight, Bell, Check, FileCheck2, LogOut, MapPin, MessageCircle, Package, Plus, ScanLine, ShoppingBag, Wallet } from "lucide-react";
import { useMarket } from "@/lib/market/store";
import { courierAllowanceUsd, customsReferences as customsSources } from "@/lib/market/customs";
import { CustomsCalculator } from "./customs-estimate";
import { balanceOf, totalOf } from "@/lib/market/domain";
import { localizedStatuses } from "@/lib/market/i18n";
import { formatSum } from "@/lib/market/home-copy";
import { accountCopy, formatLongDate, itemCount, type AccountCopy } from "@/lib/market/customer-copy";
import { siteContent } from "@/lib/market/site-content";
import { cities, regions, streets, suggestions } from "@/lib/market/addresses";
import { toast } from "sonner";
import { Modal, PageHeading } from "./market-ui";
import { SafeDeleteButton } from "./safe-delete-button";
import { ThemeToggle } from "./theme-control";

// Account home, mobile-first: one "what needs you now" card, four quick tiles, then
// recipients, customs allowance, documents, support and settings — each shown once.
export function AccountView() {
  const { user, state, ready, act, pricing } = useMarket();
  const lang = state.communication.language;
  const c = accountCopy[lang];
  const [addressOpen, setAddressOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticket, setTicket] = useState({ subject: "", text: "" });
  const identityProfiles = state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);
  const activeOrders = state.orders.filter(order => !order.cancelled && order.status < 5);
  const pendingApproval = activeOrders.find(order => (order.changeRequests ?? []).some(request => request.status === "pending"));
  const pendingPayment = activeOrders.find(order => order.payment?.status === "pending");
  const currentOrder = pendingApproval ?? pendingPayment ?? activeOrders[0];
  const unread = state.notifications.filter(item => !item.read).length;
  const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const balance = balanceOf(state);
  const statuses = localizedStatuses(lang);
  const date = new Date();
  const monthlyUsd = Math.round(state.orders.filter(order => {
    const created = new Date(order.createdAt);
    return !order.cancelled && created.getMonth() === date.getMonth() && created.getFullYear() === date.getFullYear();
  }).reduce((sum, order) => sum + order.quote.merchandise / (order.quote.fx ?? pricing.fx), 0));
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
          {next ? (next.href ? <Link className="btn primary" href={next.href}>{c.next.open}<ArrowRight size={17} aria-hidden="true" /></Link> : <button type="button" className="btn primary" onClick={() => setAddressOpen(true)}>{c.next.add}<Plus size={17} aria-hidden="true" /></button>)
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
                {passport ? <span className="cabinet-chip ok"><Check size={14} aria-hidden="true" />{c.recipients.passportOk(passport.passportMasked)}</span> : <Link className="cabinet-chip warn" href="/identity"><ScanLine size={14} aria-hidden="true" />{c.recipients.addPassport}</Link>}
                <SafeDeleteButton label={c.recipients.remove} itemName={profile.label} locale={lang} onConfirm={() => act({ type: "delivery-profile-remove", id: profile.id })} />
              </div>
            </li>;
          })}</ul> : <p className="cabinet-empty">{c.recipients.empty}</p>}
          <button type="button" className="cabinet-add" onClick={() => setAddressOpen(true)}><Plus size={18} aria-hidden="true" />{c.recipients.add}</button>
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
        <CustomsAllowance used={monthlyUsd} c={c} />

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

    <Modal open={addressOpen} onClose={() => setAddressOpen(false)} title={c.form.title} description={c.form.note} locale={lang}><AddressForm c={c} onSave={async value => { if (await act({ type: "delivery-profile-save", value: value.profile, label: value.label })) { setAddressOpen(false); toast.success(c.form.saved); } }} /></Modal>
  </div>;
}

/** Purchases through Atlas this month against the duty-free courier allowance. */
function CustomsAllowance({ used, c }: { used: number; c: AccountCopy }) {
  const limit = courierAllowanceUsd, over = used > limit;
  return <section className={"cabinet-card cabinet-customs" + (over ? " over" : "")} aria-labelledby="cabinet-customs-title">
    <h2 id="cabinet-customs-title">{c.customs.title}</h2>
    <strong className="cabinet-customs-value">{c.customs.used(used, limit)}</strong>
    <div className="cabinet-bar" role="progressbar" aria-labelledby="cabinet-customs-title" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(used, limit)}><span style={{ width: `${Math.min(100, used / limit * 100)}%` }} /></div>
    <p className="cabinet-customs-left">{over ? c.customs.over(used - limit) : c.customs.left(limit - used)}</p>
    <p className="cabinet-note">{c.customs.note}</p>
    <Link className="cabinet-link" href="/customs">{c.customs.link}<ArrowRight size={16} aria-hidden="true" /></Link>
  </section>;
}

function AddressForm({ c, onSave }: { c: AccountCopy; onSave: (value: { label: string; profile: { recipient: string; phone: string; region: string; city: string; address: string; postalCode: string; comment: string } }) => Promise<void> }) {
  const copy = c.form;
  const [value, setValue] = useState({ label: copy.defaultLabel, recipient: "", phone: "", region: "", city: "", address: "", postalCode: "", comment: "" });
  return <form className="address-form" onSubmit={event => { event.preventDefault(); void onSave({ label: value.label, profile: value }); }}>
    <label htmlFor="account-address-label">{copy.label}</label><input id="account-address-label" required maxLength={80} value={value.label} onChange={e => setValue({ ...value, label: e.target.value })} />
    <label htmlFor="account-recipient">{copy.recipient}</label><input id="account-recipient" required maxLength={120} autoComplete="name" value={value.recipient} onChange={e => setValue({ ...value, recipient: e.target.value })} />
    <label htmlFor="account-phone">{copy.phone}</label><input id="account-phone" type="tel" inputMode="tel" required maxLength={50} autoComplete="tel" placeholder="+998 90 123 45 67" value={value.phone} onChange={e => setValue({ ...value, phone: e.target.value })} />
    <label htmlFor="account-region">{copy.region}</label><input id="account-region" list="account-region-suggestions" required minLength={2} maxLength={100} autoComplete="address-level1" value={value.region} onChange={e => setValue({ ...value, region: e.target.value })} /><datalist id="account-region-suggestions">{suggestions(regions, value.region).map(item => <option key={item} value={item} />)}</datalist>
    <label htmlFor="account-city">{copy.city}</label><input id="account-city" list="account-city-suggestions" required minLength={2} maxLength={100} autoComplete="address-level2" value={value.city} onChange={e => setValue({ ...value, city: e.target.value })} /><datalist id="account-city-suggestions">{suggestions(cities, value.city).map(item => <option key={item} value={item} />)}</datalist>
    <label htmlFor="account-street">{copy.address}</label><input id="account-street" list="account-street-suggestions" required minLength={5} maxLength={220} autoComplete="street-address" value={value.address} onChange={e => setValue({ ...value, address: e.target.value })} /><datalist id="account-street-suggestions">{suggestions(streets, value.address).map(item => <option key={item} value={item} />)}</datalist><small>{copy.hint}</small>
    <label htmlFor="account-postal">{copy.postal}</label><input id="account-postal" inputMode="numeric" maxLength={30} autoComplete="postal-code" value={value.postalCode} onChange={e => setValue({ ...value, postalCode: e.target.value })} />
    <button className="btn primary">{copy.save}</button>
  </form>;
}

export function CustomsView() {
  const { pricing, state } = useMarket();
  if(state.communication.language!=='ru')return <LocalizedCustoms locale={state.communication.language} fx={pricing.fx}/>;
  return <>
    <PageHeading overline="ДО ОФОРМЛЕНИЯ ЗАКАЗА" title="Таможня: что нужно учитывать." description="Памятка для личных некоммерческих покупок в Узбекистан. Проверена 11 сентября 2026 года." />
    <div className="customs-grid"><section className="surface"><h2>Курьерские отправления</h2><strong className="customs-limit">$200</strong><p>Лимит беспошлинного ввоза на имя физического лица за календарный месяц по нормам, введённым с 1 мая 2025 года. Учитывайте покупки у других продавцов и сервисов.</p></section><section className="surface"><h2>Почтовые отправления</h2><strong className="customs-limit">$100</strong><p>Для международных почтовых отправлений установлена отдельная норма. Нельзя автоматически применять к ним курьерский лимит.</p></section></div>
    <CustomsCalculator fx={pricing.fx} locale={state.communication.language}/><section className="surface customs-text"><details className="ux-disclosure"><summary>Если стоимость выше нормы</summary><p>Для личных некоммерческих товаров превышение установленных норм облагается единым таможенным платежом. Конкретный расчёт зависит от таможенной стоимости, количества, категории и способа ввоза. Возможны отдельные сборы.</p></details><details className="ux-disclosure"><summary>Какая ставка используется</summary><p>Для обычного личного курьерского ввоза: 30% превышения, минимум $3 за кг облагаемой части. С 1 января 2027 года пункт 8 УП-174 предусматривает 20%, минимум $2 за кг. НДС повторно не добавляется. Дата прибытия меняет ставку в калькуляторе.</p><details><summary>Почему не 3% или 5% из публикаций?</summary><p>ПП-136 устанавливает отдельный эксперимент для бондовых складов и зарегистрированных платформ: 3% плюс НДС для специального перечня либо единый платёж 5%. Это не общий режим зарубежных покупок; 5% не означает 5% плюс НДС, а курьерский лимит $200 к этой схеме не переносится.</p></details></details><details className="ux-disclosure"><summary>Что означает ваше согласие</summary><p>При оформлении вы подтверждаете, что ознакомлены с условиями и понимаете возможность дополнительных таможенных платежей. Это не разрешение на автоматическое списание произвольной суммы: доплата согласовывается отдельно.</p></details><details className="ux-disclosure"><summary>Что Atlas пока не знает</summary><p>Мы не получаем ваши покупки через другие сервисы и официальный остаток месячного лимита. Оценка таможни показана отдельно и не включена в сумму Atlas. Страна магазина сама по себе не определяет размер платежа; некоторые категории и коммерческие партии имеют другие требования.</p></details><details className="ux-disclosure"><summary>Официальные источники</summary><div className="source-list">{customsSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={16} /></a>)}</div><p className="micro">Перед реальными покупками проверьте действующую редакцию правил и расчёт перевозчика. Эта памятка не заменяет таможенное решение.</p></details></section>
  </>;
}

function LocalizedCustoms({locale,fx}:{locale:'uz'|'en';fx:number}){
  const c=locale==='uz'?{overline:'BUYURTMA RASMIYLASHTIRISHDAN OLDIN',title:'Bojxona: nimalarni bilish kerak.',intro:'O‘zbekistondagi shaxsiy notijorat xaridlar uchun qo‘llanma.',courier:'Kuryer jo‘natmalari',courierText:'Jismoniy shaxs nomiga bir oy uchun bojsiz olib kirish limiti. Boshqa xizmatlardagi xaridlarni ham hisobga oling.',postal:'Pochta jo‘natmalari',postalText:'Xalqaro pochta jo‘natmalari uchun alohida norma mavjud. Kuryer limitini avtomatik qo‘llab bo‘lmaydi.',overLimit:'Qiymat limitdan oshsa',overText:'Limitdan oshgan qism yagona bojxona to‘lovi bilan soliqqa tortiladi. Hisob qiymat, miqdor, kategoriya va olib kirish usuliga bog‘liq.',rate:'Qaysi stavka ishlatiladi',rateText:'Oddiy shaxsiy kuryer jo‘natmasi uchun: oshgan qismning 30 foizi, kamida har kg uchun $3. 2027-yildan 20 foiz va kamida $2 nazarda tutilgan.',consent:'Roziligingiz nimani anglatadi',consentText:'Shartlarni o‘qiganingizni va qo‘shimcha to‘lov ehtimolini tushunganingizni tasdiqlaysiz. Qo‘shimcha to‘lov alohida kelishiladi.',unknown:'Atlas nimani bilmaydi',unknownText:'Boshqa xizmatlardagi rasmiy oylik limit qoldig‘i bizga ko‘rinmaydi. Baholangan bojxona summasi Atlas narxiga kirmaydi.',sources:'Rasmiy manbalar',sourcesText:'Haqiqiy xariddan oldin amaldagi qoidalarni tekshiring.'}:{overline:'BEFORE CHECKOUT',title:'Customs: what to keep in mind.',intro:'A guide for personal, non-commercial purchases in Uzbekistan.',courier:'Courier shipments',courierText:'Duty-free allowance for an individual per calendar month. Include purchases made through other services.',postal:'Postal shipments',postalText:'International postal shipments have a separate allowance. The courier allowance cannot be applied automatically.',overLimit:'If the value exceeds the allowance',overText:'The excess is subject to a single customs payment. The calculation depends on value, quantity, category and import method.',rate:'Which rate applies',rateText:'For ordinary personal courier imports: 30% of the excess, at least $3 per taxable kilogram. From 2027, 20% and at least $2 per kilogram are planned.',consent:'What your consent means',consentText:'You confirm that you understand the terms and possible extra customs payments. Any top-up is agreed separately.',unknown:'What Atlas does not know yet',unknownText:'We cannot see the official monthly allowance used through other services. The customs estimate is separate from the Atlas amount.',sources:'Official sources',sourcesText:'Before a real purchase, check the current rules.'};
  return <><PageHeading overline={c.overline} title={c.title} description={c.intro}/><div className="customs-grid"><section className="surface"><h2>{c.courier}</h2><strong className="customs-limit">$200</strong><p>{c.courierText}</p></section><section className="surface"><h2>{c.postal}</h2><strong className="customs-limit">$100</strong><p>{c.postalText}</p></section></div><CustomsCalculator fx={fx} locale={locale}/><section className="surface customs-text"><details className="ux-disclosure"><summary>{c.overLimit}</summary><p>{c.overText}</p></details><details className="ux-disclosure"><summary>{c.rate}</summary><p>{c.rateText}</p></details><details className="ux-disclosure"><summary>{c.consent}</summary><p>{c.consentText}</p></details><details className="ux-disclosure"><summary>{c.unknown}</summary><p>{c.unknownText}</p></details><details className="ux-disclosure"><summary>{c.sources}</summary><div className="source-list">{customsSources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={16}/></a>)}</div><p className="micro">{c.sourcesText}</p></details></section></>;
}
