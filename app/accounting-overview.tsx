'use client';

import {useMemo} from 'react';
import {AlertTriangle,CircleAlert,Info,Landmark,PiggyBank,Receipt,TrendingUp,Wallet} from 'lucide-react';
import type {LedgerKind} from '@/lib/market/finance';
import {Amount,Fact,Kpi,money,Spark,type AccountingContext} from './accounting-shared';
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
   <Kpi icon={Wallet} label={`Доход Atlas за ${monthLabel(books.month)}`} value={<Amount value={s.income.total}/>} note="состав дохода — в таблице ниже"/>
   <Kpi icon={Receipt} label="Расходы" value={<Amount value={-s.expenses.total}/>} note={expenseLines.length?expenseLines.map(([key,value])=>`${books.kinds[key as LedgerKind]?.ru}: ${money(value as number)}`).join('; '):'записей о расходах нет'}/>
   <Kpi icon={TrendingUp} label="Прибыль до налога" value={<Amount value={s.profit}/>} loss={s.profit<0} note={`${s.orders} оплаченных заказов — отметка в Atlas`}/>
   <Kpi icon={Landmark} label={`Налог на прибыль, ${Math.round(s.taxRate*1000)/10} %`} value={<Amount value={s.tax}/>} note={`ориентир · уплачено ${money(s.taxPaid)}`}/>
   <Kpi icon={PiggyBank} label="Чистая прибыль" value={<Amount value={s.net}/>} loss={s.net<0} note="после налога-ориентира"/>
  </div>
  <dl className="acc-facts" aria-label="Состав дохода и транзит месяца">
   <Fact label="Комиссия"><Amount value={s.income.commission}/></Fact>
   <Fact label="Международная доставка"><Amount value={s.income.delivery}/></Fact>
   <Fact label="Курсовая наценка"><Amount value={s.income.fxGain}/></Fact>
   <Fact label="Услуги"><Amount value={s.income.services}/></Fact>
   <Fact label="Прочие доходы"><Amount value={s.income.other}/></Fact>
   <Fact label="Транзит: начислено за товары"><Amount value={s.transit.goodsCharged}/></Fact>
   <Fact label="Транзит: приход по журналу"><Amount value={s.transit.in}/></Fact>
   <Fact label="Транзит: расход по журналу"><Amount value={s.transit.out}/></Fact>
  </dl>

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
  <Icon size={18} aria-hidden="true"/>
  <div><b>{issue.severity==='error'?'Ошибка':issue.severity==='warn'?'Внимание':'К сведению'}</b><span>{issue.message}</span></div>
  {target&&<button type="button" className="text-button" onClick={()=>onOpenTab(target)}>{target==='ledger'?'К журналу':target==='orders'?'К заказам':target==='closing'?'К курсам':'К налогам'}</button>}
 </li>;
}
