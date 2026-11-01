"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/components/site-link";
import { ArrowRight, Check, CircleAlert, FileText, Package, ShieldCheck, Truck, UsersRound, WalletCards } from "lucide-react";
import { useMarket } from "@/lib/market/store";
import { hasPermission } from "@/lib/market/access";
import { money, orderNeedsOperatorAttention, statuses, type State } from "@/lib/market/domain";
import { summarizeSavedQuotes } from "@/lib/market/admin-finance";
import { localizedStatuses } from "@/lib/market/i18n";
import { pickLocale } from "@/lib/market/uz-cyrl";
import { Empty, PageHeading } from "./market-ui";

type OperationsAccount = { id: string; name: string; state: State; revision: number; updatedAt: number };

// The analytics screen in the language of the screen. Figures come from saved quotes and Atlas marks: "marked as paid"
// is a mark in Atlas, not money that moved, and the readiness list says plainly what is not connected yet.
const analyticsCopy = {
  ru: { deniedTitle: "Доступ только администратору или роли «Финансы»", deniedText: "Аналитика содержит сводные данные всех заказов.", cabinet: "Личный кабинет", over: "ОПЕРАЦИОННЫЙ КОНТРОЛЬ", title: "Бизнес в одном экране.", intro: "Заказы, платежи, логистика и готовность процессов.", openQueue: "Открыть очередь", loading: "Собираем показатели…", loadFailed: "Не удалось загрузить аналитику.", unavailable: "Отчёт пока недоступен", retry: "Повторить", customers: "Клиенты", profiles: "профилей в Atlas", orders: "Заказы", inWork: (n: number) => `${n} сейчас в работе`, paid: "Отмечено оплаченным", fees: (sum: string) => `сборы Atlas по сметам: ${sum}`, parcels: "Посылки", messages: (n: number) => `${n} email/SMS подготовлено`, funnel: "Воронка заказов", total: (n: number) => `${n} всего`, awaitingPayment: "Ждёт оплаты клиента", waiting: "Ждут клиента", waitingText: (sum: string) => `Неоплаченные заказы и неподтверждённые доплаты — ход за клиентом. Ждёт оплаты: ${sum}.`, operatorDecision: (n: number) => `Нужно решение оператора: ${n}`, readiness: "Готовность к запуску", control: "Контроль", notConnected: "не подключено", reviewNeeded: "нужна проверка", payment: "Платёжный провайдер", messaging: "Отправка email и SMS о заказах", legal: "Юридическая проверка документов", ready: ["Адрес и получатель при оформлении", "Посылки и трек-номера", "Назначения и внутренние заметки", "Импорт с подтверждением данных покупателем", "Автоматическая проверка интерфейса"], notice: "Для реального запуска ещё потребуются договоры и ключи платёжного, логистического, email- и SMS-провайдеров, юридическая проверка и публичная политика доступа." },
  uz: { deniedTitle: "Faqat administrator yoki «Moliya» roli uchun", deniedText: "Tahlil barcha buyurtmalar bo‘yicha jamlangan ma’lumotlarni o‘z ichiga oladi.", cabinet: "Shaxsiy kabinet", over: "OPERATSION NAZORAT", title: "Biznes bitta ekranda.", intro: "Buyurtmalar, to‘lovlar, logistika va jarayonlar tayyorligi.", openQueue: "Navbatni ochish", loading: "Ko‘rsatkichlar yig‘ilmoqda…", loadFailed: "Tahlilni yuklab bo‘lmadi.", unavailable: "Hisobot hozircha mavjud emas", retry: "Qayta urinish", customers: "Mijozlar", profiles: "Atlasdagi profillar", orders: "Buyurtmalar", inWork: (n: number) => `${n} tasi hozir ishda`, paid: "To‘langan deb belgilangan", fees: (sum: string) => `smetalar bo‘yicha Atlas yig‘imlari: ${sum}`, parcels: "Jo‘natmalar", messages: (n: number) => `${n} ta email/SMS tayyorlangan`, funnel: "Buyurtmalar voronkasi", total: (n: number) => `jami ${n} ta`, awaitingPayment: "Mijoz to‘lovini kutmoqda", waiting: "Mijozni kutmoqda", waitingText: (sum: string) => `To‘lanmagan buyurtmalar va tasdiqlanmagan qo‘shimcha to‘lovlar — navbat mijozda. To‘lov kutilmoqda: ${sum}.`, operatorDecision: (n: number) => `Operator qarori kerak: ${n}`, readiness: "Ishga tushirishga tayyorlik", control: "Nazorat", notConnected: "ulanmagan", reviewNeeded: "tekshiruv kerak", payment: "To‘lov provayderi", messaging: "Buyurtmalar bo‘yicha email va SMS yuborish", legal: "Hujjatlarni yuridik tekshirish", ready: ["Rasmiylashtirishda manzil va qabul qiluvchi", "Jo‘natmalar va trek-raqamlar", "Topshiriqlar va ichki eslatmalar", "Xaridor ma’lumotlarini tasdiqlagan holda import", "Interfeysni avtomatik tekshirish"], notice: "Haqiqiy ishga tushirish uchun to‘lov, logistika, email va SMS provayderlari bilan shartnomalar va kalitlar, yuridik tekshiruv hamda ochiq kirish siyosati hali kerak bo‘ladi." },
  en: { deniedTitle: "Admins and the Finance role only", deniedText: "Analytics holds summary data for all orders.", cabinet: "My account", over: "OPERATIONS CONTROL", title: "The business on one screen.", intro: "Orders, payments, logistics and process readiness.", openQueue: "Open the queue", loading: "Gathering the figures…", loadFailed: "Could not load analytics.", unavailable: "The report is not available yet", retry: "Try again", customers: "Customers", profiles: "profiles in Atlas", orders: "Orders", inWork: (n: number) => `${n} in progress now`, paid: "Marked as paid", fees: (sum: string) => `Atlas fees per quotes: ${sum}`, parcels: "Parcels", messages: (n: number) => `${n} email/SMS prepared`, funnel: "Order funnel", total: (n: number) => `${n} total`, awaitingPayment: "Awaiting customer payment", waiting: "Waiting for customer", waitingText: (sum: string) => `Unpaid orders and unapproved extra payments — the customer’s move. Awaiting payment: ${sum}.`, operatorDecision: (n: number) => `Operator decision needed: ${n}`, readiness: "Launch readiness", control: "Control", notConnected: "not connected", reviewNeeded: "review needed", payment: "Payment provider", messaging: "Order email and SMS sending", legal: "Legal review of documents", ready: ["Address and recipient at checkout", "Parcels and tracking numbers", "Assignments and internal notes", "Import with buyer data confirmation", "Automated interface checks"], notice: "A real launch still needs contracts and keys from the payment, logistics, email and SMS providers, a legal review and a public access policy." },
};

export function AnalyticsView() {
  const { user, ready, state } = useMarket();
  const lang = state.communication.language;
  const t = pickLocale(analyticsCopy, lang);
  const canReadFinance = hasPermission(user, "finance.read");
  const [accounts, setAccounts] = useState<OperationsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!canReadFinance) return;
    setLoading(true);
    try {
      const response = await fetch("/api/operations", { cache: "no-store" });
      const data = await response.json() as { accounts?: OperationsAccount[]; error?: string };
      if (!response.ok || !data.accounts) throw Error(data.error ?? "");
      setAccounts(data.accounts); setError(null);
    } catch (nextError) { setError((nextError as Error).message); }
    finally { setLoading(false); }
  }, [canReadFinance]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const report = useMemo(() => {
    const orders = accounts.flatMap((account) => account.state.orders);
    const active = orders.filter((order) => !order.cancelled && order.status < 5);
    const paid = orders.filter((order) => order.payment?.status === "paid");
    const messages = accounts.reduce((sum, account) => sum + account.state.messageDeliveries.length, 0);
    return {
      orders,
      active,
      paid,
      customers: accounts.length,
      // Saved quotes, not money received: "paid" is the Atlas mark, fees are every Atlas line of the quote.
      finance: summarizeSavedQuotes(orders),
      parcels: orders.filter((order) => order.parcel).length,
      attention: orders.filter((order) => !order.cancelled && ((order.payment?.status === "pending") || (order.settlement?.extra && !order.extraApproved) || (order.storeShippingSettlement?.extra && !order.storeShippingExtraApproved))).length,
      operator: orders.filter(orderNeedsOperatorAttention).length,
      messages,
    };
  }, [accounts]);
  // "Awaiting purchase" holds both the unpaid orders (the customer's move) and the paid ones (Atlas buys): two rows.
  const statusNames = localizedStatuses(lang);
  const funnel = [
    { key: "unpaid", label: t.awaitingPayment, count: report.orders.filter((order) => !order.cancelled && order.status === 0 && order.payment?.status === "pending").length },
    { key: "buyout", label: statusNames[0], count: report.orders.filter((order) => !order.cancelled && order.status === 0 && order.payment?.status !== "pending").length },
    ...statuses.slice(1).map((_, offset) => ({ key: String(offset + 1), label: statusNames[offset + 1], count: report.orders.filter((order) => !order.cancelled && order.status === offset + 1).length })),
  ];
  // Not connected first, with an amber mark; what works keeps the green check.
  const readiness = [
    { label: t.payment, done: false, note: t.notConnected },
    { label: t.messaging, done: false, note: t.notConnected },
    { label: t.legal, done: false, note: t.reviewNeeded },
    ...t.ready.map((label) => ({ label, done: true, note: "" })),
  ];
  if (ready && !canReadFinance) return <Empty title={t.deniedTitle} description={t.deniedText} href="/account" label={t.cabinet} />;
  return <>
    <PageHeading overline={t.over} title={t.title} description={t.intro}><Link className="btn secondary" href="/operations">{t.openQueue} <ArrowRight size={16} /></Link></PageHeading>
    {loading ? <div className="surface loading-state">{t.loading}</div> : error !== null ? <Empty title={t.unavailable} description={error || t.loadFailed} href="/analytics" label={t.retry} /> : <>
      <section className="analytics-grid">
        <article><UsersRound /><span>{t.customers}</span><strong>{report.customers}</strong><small>{t.profiles}</small></article>
        <article><Package /><span>{t.orders}</span><strong>{report.orders.length}</strong><small>{t.inWork(report.active.length)}</small></article>
        <article><WalletCards /><span>{t.paid}</span><strong>{money(report.finance.paymentStates.paid.amount)}</strong><small>{t.fees(money(report.finance.atlasFees))}</small></article>
        <article><Truck /><span>{t.parcels}</span><strong>{report.parcels}</strong><small>{t.messages(report.messages)}</small></article>
      </section>
      <section className="analytics-layout">
        <article className="surface status-report"><div className="section-heading"><h2>{t.funnel}</h2><span>{t.total(report.orders.length)}</span></div>{funnel.map((row) => { const width = report.orders.length && row.count ? Math.max(4, row.count / report.orders.length * 100) : 0; return <div className="status-row" key={row.key}><span>{row.label}</span><div><i style={{ width: `${width}%` }} /></div><b>{row.count}</b></div>; })}</article>
        <article className="surface attention-report"><CircleAlert size={24} /><h2>{t.waiting}</h2><strong>{report.attention}</strong><p>{t.waitingText(money(report.finance.paymentStates.pending.amount))}</p><Link className="text-link" href="/operations">{t.operatorDecision(report.operator)} <ArrowRight size={16} /></Link></article>
      </section>
      <section className="surface release-readiness"><div className="section-heading"><h2>{t.readiness}</h2><span className="status-badge">{t.control}</span></div><div className="readiness-grid">
        {readiness.map((item) => item.done ? <div key={item.label}><Check size={16} aria-hidden="true" /><span>{item.label}</span></div> : <div key={item.label} className="is-pending"><CircleAlert size={16} aria-hidden="true" /><span>{item.label} — <b>{item.note}</b></span></div>)}
      </div><div className="notice warning"><ShieldCheck size={18} /><span>{t.notice}</span></div></section>
    </>}
  </>;
}

export function LegalView() {
  return <>
    <PageHeading overline="ДОКУМЕНТЫ ATLAS" title="Правила Atlas." description="Условия сервиса, оплаты, возвратов и обработки данных. Перед коммерческим запуском их должен проверить юрист."><span className="status-badge">Редакция 10.09.2026</span></PageHeading>
    <div className="legal-grid">
      <section className="surface"><FileText /><h2>Условия использования</h2><p>Atlas помогает оформить заказ на товар иностранного магазина и показывает отдельные составляющие предварительной стоимости. Наличие, финальная цена, возможность ввоза и сроки подтверждаются отдельно.</p><p>Платёжный провайдер, фактический выкуп и доставка пока не подключены. Подтверждение в Atlas не списывает деньги и не создаёт отправку.</p></section>
      <section className="surface"><ShieldCheck /><h2>Конфиденциальность</h2><p>Профиль содержит данные входа, адрес получателя, телефон, историю заказов и выбранные каналы связи. Доступ к данным ограничен задачами аккаунта и заказа в Atlas; перед подключением внешнего провайдера будут отдельно указаны передаваемые ему данные.</p><p>Сроки хранения, порядок исправления и удаления данных необходимо утвердить до коммерческого запуска.</p></section>
      <section className="surface"><WalletCards /><h2>Оплата и возвраты</h2><p>Сумма разбивается на товар, доставку магазина, сервисный сбор, международную доставку и резерв. Изменения, требующие доплаты, подтверждаются клиентом отдельно.</p><p>В рабочей версии возврат должен выполняться через исходный платёжный метод и подтверждаться серверным событием провайдера.</p></section>
      <section className="surface"><CircleAlert /><h2>Ограничения товаров</h2><p>Нельзя оформлять запрещённые законом товары, опасные вещества, оружие, контрафакт и позиции, которые перевозчик или таможня не принимают. Atlas вправе остановить такой заказ до оплаты или выкупа.</p><p>Конкретный список необходимо согласовать с перевозчиком и юридическим консультантом.</p></section>
    </div>
    <div className="notice"><ShieldCheck size={20} /><span>Таможенная памятка вынесена отдельно и остаётся информационной. <Link href="/customs">Открыть таможенные условия</Link>.</span></div>
  </>;
}
