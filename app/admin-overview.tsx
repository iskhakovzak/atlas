"use client";
// Admin → Обзор: KPIs for today / 7 days / 30 days, the order funnel and the "needs attention" list (computed on the server).
import {useState} from "react";
import Link from "@/components/site-link";
import {BarChart3,ClipboardList,Package,Settings2,ShieldCheck,TriangleAlert,UsersRound,WalletCards} from "lucide-react";
import type {Permission} from "@/lib/market/access";
import {groupAttention,type AttentionItem} from "@/lib/market/admin-dashboard";
import {money,type AdminData} from "./admin-shared";

type Period="today"|"week"|"month";
const periodLabels:Record<Period,string>={today:"Сегодня",week:"7 дней",month:"30 дней"};
const percent=(value:number)=>`${Math.round(value*100)} %`;

export function AdminOverview({data,can,selectTab,accessNotice}:{data:AdminData;can:(permission:Permission)=>boolean;selectTab:(tab:'pricing'|'staff'|'rules'|'system')=>void;accessNotice:string}){
 const [period,setPeriod]=useState<Period>("week");
 const dashboard=data.dashboard,kpi=dashboard?.kpis[period];
 const attention=dashboard?.attention??[],groups=groupAttention(attention);
 const openTickets=data.accounts.reduce((sum,account)=>sum+account.state.supportTickets.filter(ticket=>ticket.status==='open').length,0);
 const maxStage=Math.max(1,...(dashboard?.funnel.map(stage=>stage.count)??[1]));
 return <div className="admin-dashboard">
  <section className="surface admin-section admin-kpi">
   <div className="admin-section-head"><div><h2>Показатели</h2><p>По сохранённым заказам и корзинам клиентов. «Оплачено» — отметка в Atlas, не подтверждение поступления денег.</p></div>
    <div className="admin-segment" role="group" aria-label="Период показателей">{(Object.keys(periodLabels) as Period[]).map(id=><button type="button" key={id} aria-pressed={period===id} className={period===id?'active':''} onClick={()=>setPeriod(id)}>{periodLabels[id]}</button>)}</div></div>
   {kpi?<section className="admin-metrics admin-kpi-grid">
    <article><Package/><span>Новые заказы</span><strong>{kpi.newOrders}</strong><small>{periodLabels[period].toLowerCase()}, включая отменённые</small></article>
    <article><ClipboardList/><span>Отметок «оплачено»</span><strong>{kpi.paidMarks}</strong><small>статус в Atlas, не движение денег</small></article>
    <article><WalletCards/><span>Сумма к оплате</span><strong>{money(kpi.payable)}</strong><small>по неотменённым заказам периода</small></article>
    <article><BarChart3/><span>Средний чек</span><strong>{money(kpi.averageCheck)}</strong><small>сумма к оплате / заказы</small></article>
    <article><UsersRound/><span>Корзина → заказ</span><strong>{percent(kpi.conversion)}</strong><small>{kpi.convertedAccounts} из {kpi.engagedAccounts} клиентов с корзиной</small></article>
   </section>:<p className="micro">Показатели не рассчитаны: сервер не вернул дашборд. Обновите страницу.</p>}
  </section>
  <div className="admin-two">
   <section className="surface admin-section admin-funnel">
    <div className="admin-section-head"><div><h2>Воронка заказов</h2><p>Сколько заказов на каждом этапе сейчас.</p></div></div>
    {dashboard?<ol className="admin-funnel-list">{dashboard.funnel.map(stage=><li key={String(stage.status)} className={stage.status==='cancelled'?'cancelled':''}><span>{stage.label}</span><i aria-hidden="true" style={{width:`${Math.max(2,Math.round(stage.count/maxStage*100))}%`}}/><b>{stage.count}</b></li>)}</ol>:null}
   </section>
   <section className="surface admin-section admin-attention">
    <div className="admin-section-head"><div><h2>Требуют внимания</h2><p>Пороги настраиваются во вкладке «Система».</p></div><span className="admin-count">{attention.length}</span></div>
    {attention.length?<div className="admin-attention-groups">{groups.map(group=><details key={group.kind} open={group.items.length<=5}><summary><TriangleAlert/><span>{group.label}</span><b>{group.items.length}</b></summary><ul>{group.items.slice(0,50).map((item,index)=><AttentionRow key={`${item.kind}:${item.orderId??item.accountId??index}:${index}`} item={item}/>)}{group.items.length>50&&<li className="micro">Показаны первые 50 из {group.items.length}.</li>}</ul></details>)}</div>:<p className="admin-ok"><ShieldCheck/>Сейчас ничего не ждёт реакции.</p>}
   </section>
  </div>
  <section className="admin-shortcuts surface admin-section"><div className="admin-section-head"><div><h2>Рабочие разделы</h2><p>Переходите сразу к задаче, которую нужно обработать.</p></div></div><div className="admin-shortcut-grid"><Link href="/operations"><Package/><b>Очередь заказов</b><span>{attention.filter(item=>item.orderId).length} заказов ждут</span></Link>{can('support.reply')&&<Link href="/admin?tab=support"><UsersRound/><b>Поддержка</b><span>{openTickets} открытых обращений</span></Link>}{can('finance.read')&&<Link href="/analytics"><BarChart3/><b>Аналитика</b><span>заказы и комиссии</span></Link>}{can('pricing.manage')&&<button type="button" onClick={()=>selectTab('pricing')}><WalletCards/><b>Тарифы и услуги</b><span>курс, ставки, комиссия</span></button>}{can('staff.manage')&&<button type="button" onClick={()=>selectTab('staff')}><UsersRound/><b>Команда</b><span>{data.staff.length} сотрудников</span></button>}{can('policy.manage')&&<button type="button" onClick={()=>selectTab('rules')}><Settings2/><b>Правила</b><span>лимиты и запреты</span></button>}</div></section>
  <div className="notice"><ShieldCheck/><span>{accessNotice}</span></div>
 </div>;
}

function AttentionRow({item}:{item:AttentionItem}){
 const external=item.href.startsWith('/operations');
 return <li><Link href={item.href}><b>{item.title}</b><span>{item.detail}</span></Link>{external&&<small>очередь</small>}</li>;
}
