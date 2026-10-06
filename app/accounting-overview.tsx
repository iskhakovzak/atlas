'use client';

import {useMemo} from 'react';
import {AlertTriangle,CircleAlert,Info} from 'lucide-react';
import type {LedgerKind} from '@/lib/market/finance';
import {Amount,money,Spark,type AccountingContext} from './accounting-shared';
import {clientReconcile,moneyPositions,monthLabel,monthNamesShort,normalizeIssues,sortIssues,type ReconcileIssue} from './accounting-helpers';

/** Обзор: the month's cards, twelve-month sparklines, money positions and the reconcile warnings. */
export function AccountingOverview({ctx,onOpenTab}:{ctx:AccountingContext;onOpenTab:(tab:'ledger'|'orders'|'closing'|'taxes')=>void}){
 const {books,yearBooks,usdRate}=ctx;
 const s=books.summary;
 const issues=useMemo(()=>sortIssues([...normalizeIssues(books.reconcile??books.warnings),...clientReconcile({month:books.month,orders:books.orders,entries:books.entries,orderEntries:books.orderEntries,stages:books.stages,settings:books.settings,usdRate})]),[books,usdRate]);
 const positions=useMemo(()=>moneyPositions(s,books.obligations,books.positions,books.cash),[s,books.obligations,books.positions,books.cash]);
 const months=yearBooks?.summary.months??[];
 const labels=months.map(m=>monthNamesShort[Number(m.month.slice(5))-1]);
 const expenseLines=Object.entries(s.expenses).filter(([key,value])=>key!=='total'&&(value as number)>0).sort((a,b)=>(b[1] as number)-(a[1] as number));
 return <div className="acc-tab-body">
  <div className="accounting-cards">
   <article><span>Доход Atlas за {monthLabel(books.month)}</span><strong><Amount value={s.income.total}/></strong><small>Комиссия {money(s.income.commission)} · доставка {money(s.income.delivery)} · курс {money(s.income.fxGain)} · услуги {money(s.income.services)} · прочее {money(s.income.other)}</small></article>
   <article><span>Расходы</span><strong><Amount value={-s.expenses.total}/></strong><small>{expenseLines.length?expenseLines.slice(0,4).map(([key,value])=>`${books.kinds[key as LedgerKind]?.ru}: ${money(value as number)}`).join('; ')+(expenseLines.length>4?'…':''):'Записей о расходах нет'}</small></article>
   <article className={s.profit<0?'loss':undefined}><span>Прибыль до налога</span><strong><Amount value={s.profit}/></strong><small>{s.orders} оплаченных заказов (отметка в Atlas, не поступление денег)</small></article>
   <article><span>Налог на прибыль, {Math.round(s.taxRate*1000)/10} %</span><strong><Amount value={s.tax}/></strong><small>Ориентир, сверьте с бухгалтером. Отмечено уплаченным: {money(s.taxPaid)}</small></article>
   <article className={s.net<0?'loss':undefined}><span>Чистая прибыль</span><strong><Amount value={s.net}/></strong><small>Транзит: за товары начислено {money(s.transit.goodsCharged)}, приход по журналу {money(s.transit.in)}, расход {money(s.transit.out)}</small></article>
  </div>

  {months.length?<div className="acc-sparks" aria-label={`Динамика за ${yearBooks?.year}`}>
   <Spark title="Доход Atlas" tone="income" labels={labels} values={months.map(m=>m.income.total)}/>
   <Spark title="Расходы" tone="expense" labels={labels} values={months.map(m=>m.expenses.total)}/>
   <Spark title="Прибыль до налога" tone="profit" labels={labels} values={months.map(m=>m.profit)}/>
  </div>:<p className="micro" role="status">Годовая динамика загружается…</p>}

  <div className="acc-block">
   <div className="acc-block-head"><h4>Денежные позиции</h4><span className="micro">{books.cash?`с начала года по ${monthLabel(books.month)}`:'снимок на сейчас, все месяцы'}</span></div>
   <div className="acc-positions">
    {positions.map(position=><article key={position.id} className={`acc-position acc-position-${position.kind}`}><span>{position.label}</span><strong><Amount value={position.amount}/></strong><small>{position.hint}</small></article>)}
   </div>
   <p className="micro">Платежи на сайте симулируются: позиции показывают ожидания и обязательства по отметкам в Atlas, а не остатки на счетах. Выкуп определяется по этапу заказа «Ожидает выкупа».</p>
  </div>

  <div className="acc-block">
   <div className="acc-block-head"><h4>Сверка{books.reconcile?'':' (на клиенте)'}</h4>{issues.length?<span className="micro">{issues.filter(issue=>issue.severity!=='info').length} требуют внимания · {issues.filter(issue=>issue.severity==='info').length} для сведения</span>:<span className="micro">расхождений нет</span>}</div>
   {issues.length?<ul className="acc-issues">{issues.map((issue,index)=><IssueRow key={`${issue.code}-${issue.orderId??''}-${issue.entryId??''}-${index}`} issue={issue} onOpenTab={onOpenTab}/>)}</ul>
   :<p className="micro acc-ok">Сверка месяца чистая: заказы, журнал и курсы согласованы. Можно переходить к закрытию.</p>}
  </div>
 </div>;
}

function IssueRow({issue,onOpenTab}:{issue:ReconcileIssue;onOpenTab:(tab:'ledger'|'orders'|'closing'|'taxes')=>void}){
 const Icon=issue.severity==='error'?CircleAlert:issue.severity==='warn'?AlertTriangle:Info;
 const target=issue.entryId?'ledger':issue.orderId?'orders':issue.code==='fx-missing'?'closing':issue.code==='tax-rate'?'taxes':null;
 return <li className={`acc-issue acc-issue-${issue.severity}`}>
  <Icon size={16} aria-hidden="true"/>
  <span><span className="sr-only">{issue.severity==='error'?'Ошибка: ':issue.severity==='warn'?'Предупреждение: ':'К сведению: '}</span>{issue.message}</span>
  {target&&<button type="button" className="text-button" onClick={()=>onOpenTab(target)}>{target==='ledger'?'К журналу':target==='orders'?'К заказам':target==='closing'?'К курсам':'К налогам'}</button>}
 </li>;
}
