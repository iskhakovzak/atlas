'use client';

import {useCallback,useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {Download} from 'lucide-react';
import {toast} from 'sonner';
import {useMarket} from '@/lib/market/store';
import {effectiveFx} from '@/lib/market/domain';
import {hasPermission} from '@/lib/market/access';
import {sparkline,type MonthSummary,type PeriodTotal} from '@/lib/market/finance';
import {Alert,load,money,Status,type AccountingContext,type MonthBooks,type YearBooks} from './accounting-shared';
import {monthNamesShort,nextMonth,previousMonth,todayTashkent} from './accounting-helpers';
import {AccountingOverview} from './accounting-overview';
import {AccountingLedger} from './accounting-ledger';
import {AccountingOrders} from './accounting-orders';
import {AccountingClosing} from './accounting-closing';
import {AccountingStatement} from './accounting-statement';
import {AccountingTaxes} from './accounting-taxes';
import {AccountingExports} from './accounting-exports';

type Tab='overview'|'ledger'|'orders'|'closing'|'statement'|'taxes'|'exports'|'year';
const tabs:[Tab,string][]=[['overview','Обзор'],['ledger','Журнал'],['orders','Заказы'],['closing','Закрытие'],['statement','Выписка'],['taxes','Налоги'],['exports','Выгрузки'],['year','Год']];
const writeTabs:Tab[]=['statement'];

/**
 * The books for the operator (lib/market/finance.ts), split into tabs: overview with sparklines, positions and the
 * reconcile; the ledger with fixes and voids; the month's orders with their margin and a printable invoice; the
 * closing checklist; a bank statement import; the tax calendar; exports; the year table. Editing needs finance.write
 * (lib/market/access.ts); everyone else reads. Payments on the site are simulated: "paid" is a mark in Atlas.
 */
export function AccountingView(){
 const {pricing,user}=useMarket();
 const usdRate=effectiveFx(pricing);
 const canWrite=hasPermission(user,'finance.write'),isAdmin=!!user?.operator,canBackup=hasPermission(user,'system.manage');
 const [month,setMonth]=useState(()=>todayTashkent().slice(0,7));
 const [tab,setTab]=useState<Tab>('overview');
 const [books,setBooks]=useState<MonthBooks|null>(null),[yearBooks,setYearBooks]=useState<YearBooks|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [ledgerOrder,setLedgerOrder]=useState({id:'',key:0});
 const requested=useRef(0);
 const reload=useCallback(async()=>{
  const ticket=++requested.current;
  setLoading(true);
  try{
   const year=Number(month.slice(0,4));
   // &check=1 adds the engine's reconcile report (lib/market/finance-api.md); older engines ignore the flag.
   const [nextBooks,nextYear]=await Promise.all([load<MonthBooks>('month='+month+'&check=1'),load<YearBooks>('year='+year).catch(()=>null)]);
   if(ticket!==requested.current)return;
   setBooks(nextBooks);setYearBooks(nextYear);setError('');
  }catch(failure){if(ticket===requested.current)setError((failure as Error).message)}
  finally{if(ticket===requested.current)setLoading(false)}
 },[month]);
 useEffect(()=>{queueMicrotask(()=>void reload())},[reload]);
 const run=useCallback(async(work:()=>Promise<void>,done?:string)=>{
  if(busy)return false;
  setBusy(true);
  try{await work();if(done)toast.success(done);await reload();return true}
  catch(failure){toast.error((failure as Error).message);return false}
  finally{setBusy(false)}
 },[busy,reload]);

 const visibleTabs=tabs.filter(([id])=>canWrite||!writeTabs.includes(id));
 const tabRefs=useRef<Record<string,HTMLButtonElement|null>>({});
 const onTabKey=(event:KeyboardEvent<HTMLDivElement>)=>{
  const index=visibleTabs.findIndex(([id])=>id===tab);if(index<0)return;
  const next=event.key==='ArrowRight'?(index+1)%visibleTabs.length:event.key==='ArrowLeft'?(index-1+visibleTabs.length)%visibleTabs.length:event.key==='Home'?0:event.key==='End'?visibleTabs.length-1:-1;
  if(next<0)return;event.preventDefault();const id=visibleTabs[next][0];setTab(id);tabRefs.current[id]?.focus();
 };
 const openTab=(next:Tab)=>{setTab(next);document.getElementById('acc-tabs')?.scrollIntoView({behavior:'smooth',block:'start'})};
 const showInLedger=(orderId:string)=>{setLedgerOrder(current=>({id:orderId,key:current.key+1}));openTab('ledger')};
 const thisMonth=todayTashkent().slice(0,7);

 const head=<div className="accounting-head">
  <div><h3 id="accounting-title">Бухгалтерия</h3><p className="micro">Atlas работает как агент: деньги за товар, доставку магазина и пошлины — транзит. Доход Atlas — комиссия, международная доставка, курсовая наценка и услуги по оплаченным заказам месяца плюс прочие доходы; расходы — записи журнала. Оплаты на сайте симулируются: «оплачен» — отметка в Atlas, не поступление денег. Ставку налога и схему сверьте с бухгалтером.</p></div>
  <div className="acc-toolbar">
   <div className="acc-month-nav" role="group" aria-label="Месяц отчёта">
    <button type="button" className="btn secondary acc-compact" aria-label="Предыдущий месяц" onClick={()=>setMonth(previousMonth(month))}>‹</button>
    <label className="field accounting-month"><span>Месяц</span><input type="month" value={month} max={nextMonth(thisMonth)} onChange={event=>/^\d{4}-\d{2}$/.test(event.target.value)&&setMonth(event.target.value)}/></label>
    <button type="button" className="btn secondary acc-compact" aria-label="Следующий месяц" disabled={month>=nextMonth(thisMonth)} onClick={()=>setMonth(nextMonth(month))}>›</button>
   </div>
   {!canWrite&&<span className="acc-badge" title="Право finance.write не выдано">только чтение</span>}
  </div>
 </div>;

 if(!books)return <section className="accounting" aria-labelledby="accounting-title">{head}{error?<Alert>{error}</Alert>:<Status>Загружаем бухгалтерию…</Status>}</section>;
 // The engine's fx.usd is the same tariff rate the server used for the books; the client tariff is the fallback.
 const ctx:AccountingContext={books,yearBooks,month,setMonth,usdRate:books.fx?.usd??usdRate,canWrite,isAdmin,canBackup,busy,run,reload};

 return <section className="accounting" aria-labelledby="accounting-title" aria-busy={loading||busy}>
  {head}
  {error&&<Alert>{error}</Alert>}
  {loading&&!error&&<Status>Обновляем данные…</Status>}
  <div id="acc-tabs" className="acc-tabs" role="tablist" aria-label="Разделы бухгалтерии" onKeyDown={onTabKey}>
   {visibleTabs.map(([id,label])=><button key={id} ref={element=>{tabRefs.current[id]=element}} type="button" role="tab" id={`acc-tab-${id}`} aria-selected={tab===id} aria-controls={`acc-panel-${id}`} tabIndex={tab===id?0:-1} onClick={()=>setTab(id)}>{label}</button>)}
  </div>
  <div id={`acc-panel-${tab}`} role="tabpanel" aria-labelledby={`acc-tab-${tab}`} className="acc-panel">
   {tab==='overview'&&<AccountingOverview ctx={ctx} onOpenTab={openTab}/>}
   {tab==='ledger'&&<AccountingLedger key={ledgerOrder.key} ctx={ctx} initialOrderId={ledgerOrder.id}/>}
   {tab==='orders'&&<AccountingOrders ctx={ctx} onShowInLedger={showInLedger}/>}
   {tab==='closing'&&<AccountingClosing ctx={ctx}/>}
   {tab==='statement'&&canWrite&&<AccountingStatement ctx={ctx}/>}
   {tab==='taxes'&&<AccountingTaxes ctx={ctx}/>}
   {tab==='exports'&&<AccountingExports ctx={ctx}/>}
   {tab==='year'&&(yearBooks?<YearView data={yearBooks}/>:<Status>Годовые данные загружаются…</Status>)}
  </div>
 </section>;
}

function YearView({data}:{data:YearBooks}){
 const s=data.summary;
 const incomeLine=sparkline(s.months.map(m=>m.income.total)),profitLine=sparkline(s.months.map(m=>m.profit));
 const describe=(label:string,values:number[])=>`${label} по месяцам ${s.year}: `+values.map((value,index)=>`${monthNamesShort[index]} ${money(value)}`).join(', ');
 const row=(label:string,p:MonthSummary|PeriodTotal,className?:string,key?:string)=><tr key={key??label} className={className}><th scope="row">{label}</th><td className="num">{p.orders}</td><td className="num">{money(p.income.commission)}</td><td className="num">{money(p.income.delivery)}</td><td className="num">{money(p.income.fxGain)}</td><td className="num">{money(p.income.services)}</td><td className="num">{money(p.income.other)}</td><td className="num"><b>{money(p.income.total)}</b></td><td className="num">{money(p.expenses.total)}</td><td className={p.profit<0?'num loss':'num'}><b>{money(p.profit)}</b></td><td className="num">{money(p.tax)}</td><td className="num"><b>{money(p.net)}</b></td><td className="num">{money(p.taxPaid)}</td></tr>;
 return <div className="acc-tab-body acc-year">
  <div className="accounting-cards">
   <article><span>Доход Atlas за {s.year}</span><strong>{money(s.total.income.total)}</strong><small>{s.total.orders} оплаченных заказов</small></article>
   <article><span>Расходы</span><strong>{money(s.total.expenses.total)}</strong><small>по записям журнала</small></article>
   <article className={s.total.profit<0?'loss':undefined}><span>Прибыль до налога</span><strong>{money(s.total.profit)}</strong><small>налог {Math.round(s.taxRate*1000)/10} % — ориентир: {money(s.total.tax)}</small></article>
   <article><span>Чистая прибыль</span><strong>{money(s.total.net)}</strong><small>Налог отмечен уплаченным: {money(s.total.taxPaid)}</small></article>
  </div>
  <figure className="acc-spark acc-spark-year">
   <svg viewBox="0 0 320 64" role="img" aria-label={describe('Доход',s.months.map(m=>m.income.total))+'. '+describe('Прибыль',s.months.map(m=>m.profit))} preserveAspectRatio="none">
    {incomeLine.area&&<path className="acc-spark-area" d={incomeLine.area}/>}
    {incomeLine.path&&<path className="acc-spark-income" d={incomeLine.path}/>}
    {profitLine.path&&<path className="acc-spark-profit" d={profitLine.path}/>}
   </svg>
   <figcaption><span className="acc-legend income">Доход</span><span className="acc-legend profit">Прибыль до налога</span><span>{monthNamesShort[0]} – {monthNamesShort[11]} {s.year}</span></figcaption>
  </figure>
  <p className="micro">Налог на прибыль в Узбекистане отчитывается поквартально; итоги кварталов здесь — ориентир по ставке из настроек, не расчёт декларации. Сверьте с бухгалтером.</p>
  <div className="acc-scroll"><table className="accounting-table acc-table acc-year-table">
   <thead><tr><th scope="col">Период</th><th scope="col">Заказы</th><th scope="col">Комиссия</th><th scope="col">Доставка</th><th scope="col">Курс</th><th scope="col">Услуги</th><th scope="col">Прочее</th><th scope="col">Доход</th><th scope="col">Расходы</th><th scope="col">Прибыль</th><th scope="col">Налог</th><th scope="col">Чистая</th><th scope="col">Налог уплачен</th></tr></thead>
   <tbody>{s.quarters.flatMap((quarter,index)=>[...s.months.slice(index*3,index*3+3).map(m=>row(`${monthNamesShort[Number(m.month.slice(5))-1]} ${m.month.slice(0,4)}`,m,undefined,m.month)),row(quarter.label,quarter,'quarter')])}{row(s.total.label,s.total,'total')}</tbody>
  </table></div>
  <div className="accounting-downloads"><a className="btn secondary" href={`/api/finance?export=year&year=${s.year}`} download><Download size={16} aria-hidden="true"/>Год по месяцам (CSV)</a></div>
 </div>;
}
