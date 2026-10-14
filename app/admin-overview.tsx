"use client";
// Admin → Обзор: KPIs for today / 7 days / 30 days, the order funnel and the "needs attention" list (computed on the server).
import {useEffect,useState} from "react";
import Link from "@/components/site-link";
import {BarChart3,ClipboardList,Package,Settings2,ShieldCheck,TriangleAlert,UsersRound,WalletCards} from "lucide-react";
import type {Permission} from "@/lib/market/access";
import {groupAttention,type AttentionItem} from "@/lib/market/admin-dashboard";
import {attentionDetail,attentionKindLabel,funnelStageLabel} from "@/lib/market/admin-dashboard-copy";
import {queueTabTotals} from "@/lib/market/operator-queue";
import {ruPlural} from "@/lib/market/format";
import {useMarket} from "@/lib/market/store";
import {intlLocale,pickLocale,uzText} from "@/lib/market/uz-cyrl";
import {load as loadBooks,type YearBooks} from "./accounting-shared";
import {money,type AdminData} from "./admin-shared";

type Period="today"|"week"|"month";
const percent=(value:number)=>`${Math.round(value*100)} %`;
// The overview in the screen language. Funnel stages and attention groups are translated by their keys (status, kind);
// attention lines with customer or store data keep the Russian text the server sends (admin-dashboard-copy.ts).
const overviewCopy={
 ru:{periods:{today:'Сегодня',week:'7 дней',month:'30 дней'} as Record<Period,string>,kpi:'Показатели',kpiIntro:'По сохранённым заказам и корзинам клиентов. «Оплачено» — отметка в Atlas, не подтверждение поступления денег.',periodGroup:'Период показателей',newOrders:'Новые заказы',newOrdersNote:(period:string)=>`${period}, включая отменённые`,paidMarks:'Отметок «оплачено»',paidNote:'статус в Atlas, не движение денег',payable:'Сумма к оплате',payableNote:'по неотменённым заказам периода',average:'Средний чек',averageNote:'сумма к оплате / заказы',conversion:'Корзина → заказ',conversionNote:(done:number,all:number)=>`${done} из ${all} клиентов с корзиной`,noKpi:'Показатели не рассчитаны: сервер не вернул дашборд. Обновите страницу.',funnel:'Воронка заказов',funnelIntro:'Сколько заказов на каждом этапе сейчас.',attention:'Требуют внимания',attentionIntro:'Пороги настраиваются во вкладке «Система».',firstN:(shown:number,all:number)=>`Показаны первые ${shown} из ${all}.`,ok:'Сейчас ничего не ждёт реакции.',queueTag:'очередь',sections:'Рабочие разделы',sectionsIntro:'Переходите сразу к задаче, которую нужно обработать.',queue:'Очередь заказов',queueNote:(active:number,attention:number)=>`${active} в работе · ${attention} нужно решение`,support:'Поддержка',supportNote:(n:number)=>`${n} ${ruPlural(n,['открытое обращение','открытых обращения','открытых обращений'])}`,analytics:'Аналитика',analyticsNote:'заказы и комиссии',finance:'Финансы',income:(month:string,sum:string)=>`Доход Atlas за ${month}: ${sum}`,pricing:'Тарифы и услуги',pricingNote:'курс, ставки, комиссия',staff:'Команда',staffNote:(n:number)=>`${n} ${ruPlural(n,['сотрудник','сотрудника','сотрудников'])}`,rules:'Правила',rulesNote:'лимиты и запреты'},
 uz:{periods:{today:'Bugun',week:'7 kun',month:'30 kun'} as Record<Period,string>,kpi:'Ko‘rsatkichlar',kpiIntro:'Saqlangan buyurtmalar va mijozlar savatlari bo‘yicha. «To‘langan» — Atlasdagi belgi, pul tushganining tasdig‘i emas.',periodGroup:'Ko‘rsatkichlar davri',newOrders:'Yangi buyurtmalar',newOrdersNote:(period:string)=>`${period}, bekor qilinganlari bilan`,paidMarks:'«To‘langan» belgilari',paidNote:'Atlasdagi holat, pul harakati emas',payable:'To‘lanadigan summa',payableNote:'davrdagi bekor qilinmagan buyurtmalar bo‘yicha',average:'O‘rtacha chek',averageNote:'to‘lanadigan summa / buyurtmalar',conversion:'Savat → buyurtma',conversionNote:(done:number,all:number)=>`savati bor ${all} mijozdan ${done} tasi`,noKpi:'Ko‘rsatkichlar hisoblanmadi: server boshqaruv panelini qaytarmadi. Sahifani yangilang.',funnel:'Buyurtmalar voronkasi',funnelIntro:'Hozir har bir bosqichda nechta buyurtma bor.',attention:'E’tibor talab qiladi',attentionIntro:'Chegaralar «Tizim» bo‘limida sozlanadi.',firstN:(shown:number,all:number)=>`${all} tadan dastlabki ${shown} tasi ko‘rsatilgan.`,ok:'Hozir hech narsa javob kutmayapti.',queueTag:'navbat',sections:'Ish bo‘limlari',sectionsIntro:'Ishlov berish kerak bo‘lgan vazifaga darhol o‘ting.',queue:'Buyurtmalar navbati',queueNote:(active:number,attention:number)=>`${active} ta jarayonda · ${attention} ta qaror kerak`,support:'Yordam',supportNote:(n:number)=>`${n} ta ochiq murojaat`,analytics:'Tahlil',analyticsNote:'buyurtmalar va komissiyalar',finance:'Moliya',income:(month:string,sum:string)=>`${month} uchun Atlas daromadi: ${sum}`,pricing:'Tariflar va xizmatlar',pricingNote:'kurs, stavkalar, komissiya',staff:'Jamoa',staffNote:(n:number)=>`${n} ta xodim`,rules:'Qoidalar',rulesNote:'limitlar va taqiqlar'},
 en:{periods:{today:'Today',week:'7 days',month:'30 days'} as Record<Period,string>,kpi:'Metrics',kpiIntro:'From saved orders and customer carts. “Paid” is a mark in Atlas, not a confirmation that money arrived.',periodGroup:'Metrics period',newOrders:'New orders',newOrdersNote:(period:string)=>`${period}, including cancelled`,paidMarks:'“Paid” marks',paidNote:'a status in Atlas, not a money movement',payable:'Amount payable',payableNote:'for the period’s orders that are not cancelled',average:'Average order',averageNote:'amount payable / orders',conversion:'Cart → order',conversionNote:(done:number,all:number)=>`${done} of ${all} customers with a cart`,noKpi:'Metrics were not calculated: the server returned no dashboard. Reload the page.',funnel:'Order funnel',funnelIntro:'How many orders are at each stage now.',attention:'Needs attention',attentionIntro:'Thresholds are set in the “System” tab.',firstN:(shown:number,all:number)=>`Showing the first ${shown} of ${all}.`,ok:'Nothing is waiting for a response right now.',queueTag:'queue',sections:'Work sections',sectionsIntro:'Go straight to the task that needs handling.',queue:'Order queue',queueNote:(active:number,attention:number)=>`${active} in progress · ${attention} need a decision`,support:'Support',supportNote:(n:number)=>`${n} open ${n===1?'request':'requests'}`,analytics:'Analytics',analyticsNote:'orders and fees',finance:'Finance',income:(month:string,sum:string)=>`Atlas income for ${month}: ${sum}`,pricing:'Tariffs and services',pricingNote:'rate, prices, fee',staff:'Team',staffNote:(n:number)=>`${n} staff ${n===1?'member':'members'}`,rules:'Rules',rulesNote:'limits and bans'},
};

export function AdminOverview({data,can,selectTab,accessNotice}:{data:AdminData;can:(permission:Permission)=>boolean;selectTab:(tab:'pricing'|'staff'|'rules'|'system'|'finance')=>void;accessNotice:string}){
 const {state}=useMarket(),lang=state.communication.language,o=pickLocale(overviewCopy,lang);
 const [period,setPeriod]=useState<Period>("week");
 const periodLabels=o.periods;
 // The queue shortcut counts with the /operations tab rules, so its numbers match the queue tabs.
 const queue=queueTabTotals(data.accounts);
 // Atlas income of this month from the books (GET /api/finance?year=): "—" while loading or when the books are unavailable.
 const canFinance=can('finance.read');
 const [income,setIncome]=useState<number|null>(null);
 useEffect(()=>{
  if(!canFinance)return;
  let alive=true;
  const now=new Date(),month=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  loadBooks<YearBooks>('year='+now.getFullYear()).then(books=>{if(alive)setIncome(books.summary.months.find(item=>item.month===month)?.income.total??null)}).catch(()=>{if(alive)setIncome(null)});
  return()=>{alive=false};
 },[canFinance]);
 // Chrome has no Uzbek month names (it prints "M10"), so Uzbek takes its own list; the name opens the sentence there.
 const thisMonth=new Date(),monthName=lang==='uz'||lang==='oz'?uzText(lang,['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'][thisMonth.getMonth()]):new Intl.DateTimeFormat(intlLocale(lang),{month:'long'}).format(thisMonth);
 const dashboard=data.dashboard,kpi=dashboard?.kpis[period];
 const attention=dashboard?.attention??[],groups=groupAttention(attention);
 const openTickets=data.accounts.reduce((sum,account)=>sum+account.state.supportTickets.filter(ticket=>ticket.status==='open').length,0);
 const maxStage=Math.max(1,...(dashboard?.funnel.map(stage=>stage.count)??[1]));
 // A "stuck at the warehouse" line names the order's stage, which the browser reads from the loaded account.
 const now=new Date().getTime(),stuckStatus=(item:AttentionItem)=>item.kind==='warehouse-stale'&&item.orderId?data.accounts.find(account=>account.id===item.accountId)?.state.orders.find(order=>order.id===item.orderId)?.status:undefined;
 return <div className="admin-dashboard">
  <section className="surface admin-section admin-kpi">
   <div className="admin-section-head"><div><h2>{o.kpi}</h2><p>{o.kpiIntro}</p></div>
    <div className="admin-segment" role="group" aria-label={o.periodGroup}>{(Object.keys(periodLabels) as Period[]).map(id=><button type="button" key={id} aria-pressed={period===id} className={period===id?'active':''} onClick={()=>setPeriod(id)}>{periodLabels[id]}</button>)}</div></div>
   {kpi?<section className="admin-metrics admin-kpi-grid">
    <article><Package/><span>{o.newOrders}</span><strong>{kpi.newOrders}</strong><small>{o.newOrdersNote(periodLabels[period].toLocaleLowerCase(intlLocale(lang)))}</small></article>
    <article><ClipboardList/><span>{o.paidMarks}</span><strong>{kpi.paidMarks}</strong><small>{o.paidNote}</small></article>
    <article><WalletCards/><span>{o.payable}</span><strong>{money(kpi.payable,lang)}</strong><small>{o.payableNote}</small></article>
    <article><BarChart3/><span>{o.average}</span><strong>{money(kpi.averageCheck,lang)}</strong><small>{o.averageNote}</small></article>
    <article><UsersRound/><span>{o.conversion}</span><strong>{percent(kpi.conversion)}</strong><small>{o.conversionNote(kpi.convertedAccounts,kpi.engagedAccounts)}</small></article>
   </section>:<p className="micro">{o.noKpi}</p>}
  </section>
  <div className="admin-two">
   <section className="surface admin-section admin-funnel">
    <div className="admin-section-head"><div><h2>{o.funnel}</h2><p>{o.funnelIntro}</p></div></div>
    {dashboard?<ol className="admin-funnel-list">{dashboard.funnel.map(stage=><li key={String(stage.status)} className={stage.status==='cancelled'?'cancelled':''}><span>{funnelStageLabel(stage,lang)}</span><i aria-hidden="true" style={{width:`${Math.max(2,Math.round(stage.count/maxStage*100))}%`}}/><b>{stage.count}</b></li>)}</ol>:null}
   </section>
   <section className="surface admin-section admin-attention">
    <div className="admin-section-head"><div><h2>{o.attention}</h2><p>{o.attentionIntro}</p></div><span className="admin-count">{attention.length}</span></div>
    {attention.length?<div className="admin-attention-groups">{groups.map(group=><details key={group.kind} open={group.items.length<=5}><summary><TriangleAlert/><span>{attentionKindLabel(group.kind,lang)}</span><b>{group.items.length}</b></summary><ul>{group.items.slice(0,50).map((item,index)=><AttentionRow key={`${item.kind}:${item.orderId??item.accountId??index}:${index}`} item={item} detail={attentionDetail(item,lang,now,stuckStatus(item))} queueTag={o.queueTag}/>)}{group.items.length>50&&<li className="micro">{o.firstN(50,group.items.length)}</li>}</ul></details>)}</div>:<p className="admin-ok"><ShieldCheck/>{o.ok}</p>}
   </section>
  </div>
  <section className="admin-shortcuts surface admin-section"><div className="admin-section-head"><div><h2>{o.sections}</h2><p>{o.sectionsIntro}</p></div></div><div className="admin-shortcut-grid"><Link href="/operations"><Package/><b>{o.queue}</b><span>{o.queueNote(queue.active,queue.attention)}</span></Link>{can('support.reply')&&<Link href="/admin?tab=support"><UsersRound/><b>{o.support}</b><span>{o.supportNote(openTickets)}</span></Link>}{canFinance&&<button type="button" onClick={()=>selectTab('finance')}><WalletCards/><b>{o.finance}</b><span>{o.income(monthName,income===null?'—':money(income,lang))}</span></button>}{canFinance&&<Link href="/analytics"><BarChart3/><b>{o.analytics}</b><span>{o.analyticsNote}</span></Link>}{can('pricing.manage')&&<button type="button" onClick={()=>selectTab('pricing')}><WalletCards/><b>{o.pricing}</b><span>{o.pricingNote}</span></button>}{can('staff.manage')&&<button type="button" onClick={()=>selectTab('staff')}><UsersRound/><b>{o.staff}</b><span>{o.staffNote(data.staff.length)}</span></button>}{can('policy.manage')&&<button type="button" onClick={()=>selectTab('rules')}><Settings2/><b>{o.rules}</b><span>{o.rulesNote}</span></button>}</div></section>
  <div className="notice"><ShieldCheck/><span>{accessNotice}</span></div>
 </div>;
}

function AttentionRow({item,detail,queueTag}:{item:AttentionItem;detail:string;queueTag:string}){
 const external=item.href.startsWith('/operations');
 return <li><Link href={item.href}><b>{item.title}</b><span>{detail}</span></Link>{external&&<small>{queueTag}</small>}</li>;
}
