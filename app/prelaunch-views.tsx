"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/components/site-link";
import { ArrowRight, Check, CircleAlert, FileText, Package, ShieldCheck, Truck, UsersRound, WalletCards } from "lucide-react";
import { useMarket } from "@/lib/market/store";
import { money, statuses, type State } from "@/lib/market/domain";
import { Empty, PageHeading } from "./market-ui";

type OperationsAccount = { id: string; name: string; state: State; revision: number; updatedAt: number };

export function AnalyticsView() {
  const { user, ready } = useMarket();
  const [accounts, setAccounts] = useState<OperationsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!user?.operator) return;
    setLoading(true);
    try {
      const response = await fetch("/api/operations", { cache: "no-store" });
      const data = await response.json() as { accounts?: OperationsAccount[]; error?: string };
      if (!response.ok || !data.accounts) throw Error(data.error ?? "Не удалось загрузить аналитику.");
      setAccounts(data.accounts); setError(null);
    } catch (nextError) { setError((nextError as Error).message); }
    finally { setLoading(false); }
  }, [user?.operator]);
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
      gmv: orders.filter((order) => !order.cancelled).reduce((sum, order) => sum + order.quote.total, 0),
      service: orders.filter((order) => !order.cancelled).reduce((sum, order) => sum + order.quote.service, 0),
      parcels: orders.filter((order) => order.parcel).length,
      attention: orders.filter((order) => !order.cancelled && ((order.payment?.status === "pending") || (order.settlement?.extra && !order.extraApproved) || (order.storeShippingSettlement?.extra && !order.storeShippingExtraApproved))).length,
      messages,
    };
  }, [accounts]);
  if (ready && !user?.operator) return <Empty title="Доступ только администратору" description="Аналитика содержит сводные данные всех заказов." href="/account" label="Личный кабинет" />;
  return <>
    <PageHeading overline="ОПЕРАЦИОННЫЙ КОНТРОЛЬ" title="Бизнес в одном экране." description="Заказы, платежи, логистика и готовность процессов."><Link className="btn secondary" href="/operations">Открыть очередь <ArrowRight size={16} /></Link></PageHeading>
    {loading ? <div className="surface loading-state">Собираем показатели…</div> : error ? <Empty title="Отчёт пока недоступен" description={error} href="/analytics" label="Повторить" /> : <>
      <section className="analytics-grid">
        <article><UsersRound /><span>Клиенты</span><strong>{report.customers}</strong><small>профилей в Atlas</small></article>
        <article><Package /><span>Заказы</span><strong>{report.orders.length}</strong><small>{report.active.length} сейчас в работе</small></article>
        <article><WalletCards /><span>Оборот</span><strong>{money(report.gmv)}</strong><small>комиссия {money(report.service)}</small></article>
        <article><Truck /><span>Посылки</span><strong>{report.parcels}</strong><small>{report.messages} email/SMS подготовлено</small></article>
      </section>
      <section className="analytics-layout">
        <article className="surface status-report"><div className="section-heading"><h2>Воронка заказов</h2><span>{report.orders.length} всего</span></div>{statuses.map((status, index) => { const count = report.orders.filter((order) => !order.cancelled && order.status === index).length; const width = report.orders.length ? Math.max(4, count / report.orders.length * 100) : 0; return <div className="status-row" key={status}><span>{status}</span><div><i style={{ width: `${width}%` }} /></div><b>{count}</b></div>; })}</article>
        <article className="surface attention-report"><CircleAlert size={25} /><h2>Требуют внимания</h2><strong>{report.attention}</strong><p>Неоплаченные заказы и неподтверждённые доплаты.</p><Link className="text-link" href="/operations">Перейти к обработке <ArrowRight size={15} /></Link></article>
      </section>
      <section className="surface release-readiness"><div className="section-heading"><h2>Готовность к запуску</h2><span className="status-badge">Контроль</span></div><div className="readiness-grid">
        {["Адрес и получатель при оформлении", "Безопасная имитация платежа", "Посылки и трек-номера", "Назначения и внутренние заметки", "Email/SMS в режиме предпросмотра", "Импорт с ручной проверкой", "Черновики юридических документов", "Автоматический smoke-тест"].map((item) => <div key={item}><Check size={16} /><span>{item}</span></div>)}
      </div><div className="notice warning"><ShieldCheck size={19} /><span>Для реального запуска ещё потребуются договоры и ключи платёжного, логистического, email- и SMS-провайдеров, юридическая проверка и публичная политика доступа.</span></div></section>
    </>}
  </>;
}

export function LegalView() {
  return <>
    <PageHeading overline="ДОКУМЕНТЫ ATLAS" title="Правила Atlas." description="Условия сервиса, оплаты, возвратов и обработки данных. Перед коммерческим запуском их должен проверить юрист."><span className="status-badge">Редакция 10.09.2026</span></PageHeading>
    <div className="legal-grid">
      <section className="surface"><FileText /><h2>Условия использования</h2><p>Atlas помогает оформить заказ на товар иностранного магазина и показывает отдельные составляющие предварительной стоимости. Наличие, финальная цена, возможность ввоза и сроки подтверждаются отдельно.</p><p>В предрелизе платежи, выкуп и доставка имитируются. Нажатие тестовых кнопок не создаёт денежных обязательств.</p></section>
      <section className="surface"><ShieldCheck /><h2>Конфиденциальность</h2><p>Профиль содержит данные входа, адрес получателя, телефон, историю заказов и выбранные каналы связи. Эти данные используются только для демонстрации работы заказа и не передаются внешним провайдерам.</p><p>Перед запуском необходимо утвердить сроки хранения, порядок экспорта, исправления и удаления данных.</p></section>
      <section className="surface"><WalletCards /><h2>Оплата и возвраты</h2><p>Сумма разбивается на товар, доставку магазина, сервисный сбор, международную доставку и резерв. Изменения, требующие доплаты, подтверждаются клиентом отдельно.</p><p>В рабочей версии возврат должен выполняться через исходный платёжный метод и подтверждаться серверным событием провайдера.</p></section>
      <section className="surface"><CircleAlert /><h2>Ограничения товаров</h2><p>Нельзя оформлять запрещённые законом товары, опасные вещества, оружие, контрафакт и позиции, которые перевозчик или таможня не принимают. Atlas вправе остановить такой заказ до оплаты или выкупа.</p><p>Конкретный список необходимо согласовать с перевозчиком и юридическим консультантом.</p></section>
    </div>
    <div className="notice"><ShieldCheck size={20} /><span>Таможенная памятка вынесена отдельно и остаётся информационной. <Link href="/customs">Открыть таможенные условия</Link>.</span></div>
  </>;
}
