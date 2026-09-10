"use client";

import { useState } from "react";
import Link from "@/components/site-link";
import { ArrowUpRight, BarChart3, Check, Download, FileCheck2, FileText, LogOut, MessageCircle, Package, Plus, ScanLine, ShieldCheck, Upload, UserRound, Wallet } from "lucide-react";
import { useMarket } from "@/lib/market/store";
import { customsSources } from "@/lib/market/world";
import { balanceOf, money } from "@/lib/market/domain";
import { toast } from "sonner";
import { Modal, PageHeading } from "./market-ui";

export function AccountView() {
  const { user, state, ready, act } = useMarket();
  const [legacy, setLegacy] = useState<string | null>(null);
  const [addressOpen, setAddressOpen] = useState(false);
  const [ticket, setTicket] = useState({ subject: "", text: "" });
  function exportProfile() {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), profile: user, deliveryProfiles: state.deliveryProfiles, communication: state.communication, orders: state.orders, entries: state.entries, declarations: state.declarations, supportTickets: state.supportTickets }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "atlas-profile-export.json"; link.click();
    URL.revokeObjectURL(url);
    toast.success("Экспорт профиля подготовлен");
  }
  return <>
    <PageHeading overline="ЛИЧНОЕ ПРОСТРАНСТВО" title="Ваш профиль Atlas." description="Контакты, адрес доставки, заказы и настройки связи доступны после входа на другом устройстве." />
    {!user ? <section className="surface"><UserRound size={36} /><h2>Вход и создание аккаунта</h2><p>В предрелизе профиль создаётся при первом входе через ChatGPT. Самостоятельная регистрация по email и телефону будет подключаться перед публичным запуском.</p><a className="btn primary" href="/signin-with-chatgpt?return_to=%2Faccount" target="_top">Продолжить с ChatGPT <ArrowUpRight size={18} /></a></section> : <>
      <div className="account-grid">
        <section className="surface"><div className="account-avatar"><UserRound size={30} /></div><h2>{user.name}</h2><p>{user.email}</p><p className="micro">Роль: {user.operator ? "администратор и покупатель" : "покупатель"} · профиль создан {new Date(user.createdAt).toLocaleDateString("ru-RU")}</p>
          {state.deliveryProfile ? <div className="saved-address"><b>Основной получатель</b><span>{state.deliveryProfile.recipient} · {state.deliveryProfile.phone}</span><small>{state.deliveryProfile.region}, {state.deliveryProfile.city}, {state.deliveryProfile.address}</small></div> : <div className="notice"><ShieldCheck size={20} /><span>Адрес сохранится после первого оформления заказа.</span></div>}
          <div className="profile-actions"><button className="btn secondary" onClick={exportProfile}><Download size={17} /> Скачать мои данные</button><a className="text-link" href="/signout-with-chatgpt?return_to=%2Faccount" target="_top"><LogOut size={16} /> Выйти</a></div>
        </section>
        <section className="surface account-links">
          <Link href="/identity"><ScanLine /><div>Паспорт<small>{state.identityProfile ? "Данные подтверждены" : "Нужно подтвердить"}</small></div><ArrowUpRight /></Link>
          <Link href="/declaration"><FileCheck2 /><div>Декларации<small>{state.declarations.length} тестовых пакетов</small></div><ArrowUpRight /></Link>
          <Link href="/orders"><Package /><div>Мои заказы<small>{state.orders.length} заказов</small></div><ArrowUpRight /></Link>
          <Link href="/balance"><Wallet /><div>Демобаланс<small>{money(balanceOf(state))}</small></div><ArrowUpRight /></Link>
          <Link href="/notifications"><ShieldCheck /><div>Email и SMS<small>{state.communication.emailEnabled || state.communication.smsEnabled ? "Настроены" : "Выключены"}</small></div><ArrowUpRight /></Link>
          <Link href="/legal"><FileText /><div>Правила Atlas<small>Документы предрелиза</small></div><ArrowUpRight /></Link>
          <Link href="/customs"><ShieldCheck /><div>Таможенные условия<small>Лимиты и согласие</small></div><ArrowUpRight /></Link>
          {user.operator && <><Link href="/operations"><Package /><div>Кабинет оператора<small>Заказы, команды и трекинг</small></div><ArrowUpRight /></Link><Link href="/analytics"><BarChart3 /><div>Аналитика запуска<small>Показатели и готовность</small></div><ArrowUpRight /></Link></>}
          {user.operator && <Link href="/admin"><ShieldCheck /><div>Правила оформления<small>Лимиты и проверка товаров</small></div><ArrowUpRight /></Link>}
        </section>
      </div>
      <section className="surface account-status"><div className="section-heading"><div><span className="eyebrow">СЛЕДУЮЩЕЕ ДЕЙСТВИЕ</span><h2>Центр заказов</h2></div><Link className="text-link" href="/orders">Все заказы <ArrowUpRight size={16}/></Link></div>{state.orders.length ? state.orders.slice(0, 3).map(order => <article className="status-center-row" key={order.id}><Package size={20}/><div><b>{order.product.name}</b><span>{order.status}</span><small>{order.status === "Ожидает выкупа" ? "Мы ждём подтверждение выкупа." : order.status === "Доставлен" ? "Заказ завершён." : "Следите за изменениями в карточке заказа."}</small></div><Link className="text-link" href="/orders">Открыть</Link></article>) : <p>Пока нет заказов. Вставьте ссылку на товар, чтобы получить предварительный расчёт.</p>}</section>
      <div className="account-grid account-tools">
        <section className="surface"><div className="section-heading"><div><span className="eyebrow">ПОЛУЧАТЕЛИ</span><h2>Адреса доставки</h2></div><button className="icon-btn" aria-label="Добавить адрес" onClick={() => setAddressOpen(true)}><Plus size={18}/></button></div>{state.deliveryProfiles.length ? state.deliveryProfiles.map(profile => <div className="saved-address" key={profile.id}><b>{profile.label}{profile.primary ? " · основной" : ""}</b><span>{profile.recipient} · {profile.phone}</span><small>{profile.region}, {profile.city}, {profile.address}</small><button className="text-button" onClick={() => void act({ type: "delivery-profile-remove", id: profile.id })}>Удалить</button></div>) : <p>Сохраните несколько получателей — при оформлении сможете выбрать нужного.</p>}</section>
        <section className="surface"><span className="eyebrow">ЛИМИТЫ МЕСЯЦА</span><h2>Профиль таможенного риска</h2><strong className="customs-limit">${Math.round(state.orders.filter(order => new Date(order.createdAt).getMonth() === new Date().getMonth()).reduce((sum, order) => sum + order.quote.merchandise / (order.quote.fx ?? 12800), 0))}</strong><p>Сумма ваших тестовых заказов за текущий месяц. Это подсказка, а не официальный остаток лимита: Atlas не видит покупки в других сервисах.</p><Link className="text-link" href="/customs">Проверить условия <ArrowUpRight size={16}/></Link></section>
      </div>
      <div className="account-grid account-tools">
        <section className="surface"><span className="eyebrow">ДОКУМЕНТЫ И ДАННЫЕ</span><h2>Центр документов</h2><p>Паспорт хранится отдельно; декларации создаются только после вашего подтверждения. Счета и фото склада появятся в конкретном заказе, когда оператор добавит их.</p><div className="profile-actions"><Link className="btn secondary" href="/identity"><ScanLine size={16}/> Паспорт</Link><Link className="btn secondary" href="/declaration"><FileCheck2 size={16}/> Декларации</Link><button className="btn secondary" onClick={exportProfile}><Download size={16}/> Экспорт</button></div></section>
        <section className="surface"><span className="eyebrow">ПОДДЕРЖКА</span><h2>Обращения</h2>{state.supportTickets.length ? <div className="ticket-list">{state.supportTickets.slice(0,3).map(item => <div key={item.id}><b>{item.subject}</b><small>{item.status === "open" ? "Ждём ответа" : item.status === "answered" ? "Есть ответ" : "Закрыто"} · {item.replies.length} сообщений</small></div>)}</div> : <p>Напишите нам — история обращения останется в вашем профиле.</p>}<form className="support-form" onSubmit={async event => { event.preventDefault(); if (await act({ type: "support-create", subject: ticket.subject, text: ticket.text })) { setTicket({ subject: "", text: "" }); toast.success("Обращение отправлено в тестовую очередь."); } }}><input required minLength={3} placeholder="Тема обращения" value={ticket.subject} onChange={event => setTicket({ ...ticket, subject: event.target.value })}/><textarea required minLength={3} placeholder="Опишите вопрос" value={ticket.text} onChange={event => setTicket({ ...ticket, text: event.target.value })}/><button className="btn secondary" disabled={!ready}><MessageCircle size={16}/> Отправить обращение</button></form></section>
      </div>
      <section className="surface legacy-import"><h2>Заказы из предыдущей версии</h2><p>Если вы тестировали Atlas в этом браузере, можно один раз перенести старые данные в пустой профиль.</p><button className="btn secondary" disabled={!ready || !!(state.orders.length || state.cart.length || state.entries.length || state.favorites.length)} onClick={() => { try { const raw = localStorage.getItem("atlas-market-demo-v1"); if (!raw) { toast.message("В этом браузере старых данных нет."); return; } setLegacy(raw); } catch { toast.error("Нет доступа к данным браузера."); } }}><Upload size={16} /> Найти прежние заказы</button></section>
    </>}
    <Modal open={!!legacy} onClose={() => setLegacy(null)} title="Перенести тестовые данные?" description="Будут перенесены заказы, корзина, избранное и демобаланс из этого браузера. Подтвердите, что это ваши данные."><button className="btn primary" onClick={async () => { if (legacy && await act({ type: "import-legacy", data: legacy })) { setLegacy(null); toast.success("Данные перенесены в аккаунт."); } }}>Это мои данные — перенести <Check size={18} /></button></Modal>
    <Modal open={addressOpen} onClose={() => setAddressOpen(false)} title="Новый получатель" description="Адрес сохраняется в вашем профиле и используется только для тестового оформления."><AddressForm onSave={async value => { if (await act({ type: "delivery-profile-save", value: value.profile, label: value.label })) { setAddressOpen(false); toast.success("Получатель сохранён."); } }}/></Modal>
  </>;
}

function AddressForm({onSave}:{onSave:(value:{label:string;profile:{recipient:string;phone:string;region:string;city:string;address:string;postalCode:string;comment:string}})=>Promise<void>}) { const [value,setValue]=useState({label:"Новый адрес",recipient:"",phone:"",region:"",city:"",address:"",postalCode:"",comment:""}); return <form className="address-form" onSubmit={event=>{event.preventDefault();void onSave({label:value.label,profile:value})}}><input required placeholder="Название: дом, родители, офис" value={value.label} onChange={e=>setValue({...value,label:e.target.value})}/><input required placeholder="Получатель" value={value.recipient} onChange={e=>setValue({...value,recipient:e.target.value})}/><input required placeholder="Телефон" value={value.phone} onChange={e=>setValue({...value,phone:e.target.value})}/><input required placeholder="Область" value={value.region} onChange={e=>setValue({...value,region:e.target.value})}/><input required placeholder="Город" value={value.city} onChange={e=>setValue({...value,city:e.target.value})}/><input required minLength={5} placeholder="Улица, дом, квартира" value={value.address} onChange={e=>setValue({...value,address:e.target.value})}/><input placeholder="Индекс (необязательно)" value={value.postalCode} onChange={e=>setValue({...value,postalCode:e.target.value})}/><button className="btn primary">Сохранить адрес</button></form> }

export function CustomsView() {
  return <>
    <PageHeading overline="ДО ОФОРМЛЕНИЯ ЗАКАЗА" title="Таможня: что нужно учитывать." description="Памятка для личных некоммерческих покупок в Узбекистан. Проверена 9 сентября 2026 года." />
    <div className="customs-grid"><section className="surface"><h2>Курьерские отправления</h2><strong className="customs-limit">$200</strong><p>Лимит беспошлинного ввоза на имя физического лица за календарный месяц по нормам, введённым с 1 мая 2025 года. Учитывайте покупки у других продавцов и сервисов.</p></section><section className="surface"><h2>Почтовые отправления</h2><strong className="customs-limit">$100</strong><p>Для международных почтовых отправлений установлена отдельная норма. Нельзя автоматически применять к ним курьерский лимит.</p></section></div>
    <section className="surface customs-text"><h2>Если стоимость выше нормы</h2><p>Для личных некоммерческих товаров превышение установленных норм облагается единым таможенным платежом. Конкретный расчёт зависит от таможенной стоимости, количества, категории и способа ввоза. Возможны отдельные сборы.</p><h2>Что означает ваше согласие</h2><p>При оформлении вы подтверждаете, что ознакомлены с условиями и понимаете возможность дополнительных таможенных платежей. Это не разрешение на автоматическое списание произвольной суммы: доплата согласовывается отдельно.</p><h2>Что Atlas пока не знает</h2><p>Мы не получаем ваши покупки через другие сервисы и официальный остаток месячного лимита. Показанный итог пока не включает расчёт таможни. Страна магазина сама по себе не определяет размер платежа; некоторые категории и коммерческие партии имеют другие требования.</p><h2>Официальные источники</h2><div className="source-list">{customsSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={16} /></a>)}</div><p className="micro">Перед реальными покупками проверьте действующую редакцию правил и расчёт перевозчика. Эта памятка не заменяет таможенное решение.</p></section>
  </>;
}
