'use client';

import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {Download,Plus} from 'lucide-react';
import {toast} from 'sonner';
import {formatSum} from '@/lib/market/home-copy';
import type {LedgerEntry,LedgerKind,MonthSummary,OrderFinance} from '@/lib/market/finance';

type Kinds=Record<LedgerKind,{direction:'in'|'out';group:'transit'|'expense'|'income'|'tax';ru:string}>;
type Books={month:string;summary:MonthSummary;entries:LedgerEntry[];orders:OrderFinance[];settings:{profitTaxRate:number};kinds:Kinds};
const money=(value:number)=>formatSum(value,'ru');
const groups:[string,string][]=[['expense','Расходы'],['income','Доходы'],['transit','Транзит (товар, доставка магазина, пошлины, возвраты)'],['tax','Налог']];
const today=()=>new Date(Date.now()+5*3600_000).toISOString().slice(0,10);
const post=(body:unknown)=>fetch('/api/finance',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)}).then(async response=>{const data=await response.json().catch(()=>({})) as {error?:string};if(!response.ok)throw Error(data.error??'Не удалось сохранить.');return data});

/**
 * The books for the operator: a month's Atlas income, expenses, profit and profit tax (lib/market/finance.ts),
 * the money ledger with additions and voids, and CSV exports for the accountant.
 */
export function AccountingView(){
 const [month,setMonth]=useState(()=>today().slice(0,7));
 const [books,setBooks]=useState<Books|null>(null),[error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const load=useCallback(async(selected:string)=>{
  try{const response=await fetch('/api/finance?month='+selected,{credentials:'same-origin',cache:'no-store'});const data=await response.json() as Books&{error?:string};if(!response.ok)throw Error(data.error??'Не удалось загрузить бухгалтерию.');setBooks(data);setError('')}
  catch(failure){setError((failure as Error).message)}
 },[]);
 useEffect(()=>{queueMicrotask(()=>void load(month))},[month,load]);
 // New ledger entry: the amount is in soum; a foreign amount is kept as a note of what was actually paid.
 const [draft,setDraft]=useState({kind:'carrier' as LedgerKind,amountUzs:'',originalAmount:'',originalCurrency:'USD',occurredOn:today(),orderId:'',counterparty:'',note:''});
 async function add(event:FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);
  try{
   await post({kind:'entry',value:{kind:draft.kind,amountUzs:Math.round(Number(draft.amountUzs)),occurredOn:draft.occurredOn,
    ...(draft.originalAmount?{originalAmount:Number(draft.originalAmount),originalCurrency:draft.originalCurrency}:{}),
    ...(draft.orderId.trim()?{orderId:draft.orderId.trim()}:{}),...(draft.counterparty.trim()?{counterparty:draft.counterparty.trim()}:{}),...(draft.note.trim()?{note:draft.note.trim()}:{})}});
   toast.success('Запись добавлена.');setDraft(value=>({...value,amountUzs:'',originalAmount:'',orderId:'',note:''}));await load(draft.occurredOn.slice(0,7)===month?month:month);
  }catch(failure){toast.error((failure as Error).message)}finally{setBusy(false)}
 }
 async function voidEntry(entry:LedgerEntry){
  const reason=window.prompt('Почему аннулировать запись? Она останется в журнале с пометкой.');if(!reason||reason.trim().length<3)return;
  try{await post({kind:'void',id:entry.id,reason:reason.trim()});toast.success('Запись аннулирована.');await load(month)}catch(failure){toast.error((failure as Error).message)}
 }
 const [rate,setRate]=useState('');
 async function saveRate(){
  const value=Number(rate.replace(',','.'))/100;if(!Number.isFinite(value)||value<0||value>0.5){toast.error('Ставка от 0 до 50%.');return}
  try{await post({kind:'settings',value:{profitTaxRate:value}});toast.success('Ставка сохранена.');setRate('');await load(month)}catch(failure){toast.error((failure as Error).message)}
 }
 const [from,setFrom]=useState(()=>today().slice(0,4)+'-01'),[to,setTo]=useState(()=>today().slice(0,7));
 const exportUrl=(kind:string)=>`/api/finance?export=${kind}&from=${from}&to=${to}`;
 if(!books)return <section className="accounting" aria-labelledby="accounting-title"><h3 id="accounting-title">Бухгалтерия</h3><p className="micro" role="status">{error||'Загружаем бухгалтерию…'}</p></section>;
 const s=books.summary,kinds=books.kinds;
 return <section className="accounting" aria-labelledby="accounting-title">
  <div className="accounting-head">
   <div><h3 id="accounting-title">Бухгалтерия</h3><p className="micro">Atlas работает как агент: деньги за товар, доставку магазина и пошлины — транзит. Доход Atlas — комиссия, международная доставка, курсовая наценка и услуги по оплаченным заказам месяца плюс прочие доходы. Расходы — записи журнала. Ставку налога на прибыль сверьте с бухгалтером.</p></div>
   <label className="field accounting-month"><span>Месяц</span><input type="month" value={month} onChange={event=>event.target.value&&setMonth(event.target.value)}/></label>
  </div>
  {error&&<p className="notice error" role="alert">{error}</p>}
  <div className="accounting-cards">
   <article><span>Доход Atlas</span><strong>{money(s.income.total)}</strong><small>Комиссия {money(s.income.commission)}, доставка {money(s.income.delivery)}, курс {money(s.income.fxGain)}, услуги {money(s.income.services)}, прочее {money(s.income.other)}</small></article>
   <article><span>Расходы</span><strong>{money(s.expenses.total)}</strong><small>{Object.entries(s.expenses).filter(([key])=>key!=='total').map(([key,value])=>`${kinds[key as LedgerKind]?.ru}: ${money(value as number)}`).join('; ')||'Записей о расходах нет'}</small></article>
   <article className={s.profit<0?'loss':undefined}><span>Прибыль до налога</span><strong>{money(s.profit)}</strong><small>{s.orders} оплаченных заказов</small></article>
   <article><span>Налог на прибыль, {Math.round(s.taxRate*1000)/10}%</span><strong>{money(s.tax)}</strong><small>Уплачено за месяц: {money(s.taxPaid)}</small></article>
   <article><span>Чистая прибыль</span><strong>{money(s.net)}</strong><small>Транзит: за товары получено {money(s.transit.goodsCharged)}, приход {money(s.transit.in)}, расход {money(s.transit.out)}</small></article>
  </div>
  <div className="accounting-rate"><label className="field"><span>Ставка налога на прибыль, %</span><input inputMode="decimal" placeholder={String(Math.round(books.settings.profitTaxRate*1000)/10)} value={rate} onChange={event=>setRate(event.target.value)}/></label><button type="button" className="btn secondary" disabled={!rate} onClick={()=>void saveRate()}>Сохранить ставку</button></div>
  <form className="accounting-form" onSubmit={add}>
   <h4>Добавить запись</h4>
   <div className="accounting-grid">
    <label className="field"><span>Вид</span><select value={draft.kind} onChange={event=>setDraft({...draft,kind:event.target.value as LedgerKind})}>{groups.map(([group,label])=><optgroup key={group} label={label}>{(Object.keys(kinds) as LedgerKind[]).filter(kind=>kinds[kind].group===group).map(kind=><option key={kind} value={kind}>{kinds[kind].ru}</option>)}</optgroup>)}</select></label>
    <label className="field"><span>Дата</span><input type="date" required value={draft.occurredOn} onChange={event=>setDraft({...draft,occurredOn:event.target.value})}/></label>
    <label className="field"><span>Сумма, сум</span><input inputMode="numeric" required value={draft.amountUzs} onChange={event=>setDraft({...draft,amountUzs:event.target.value.replace(/\D/g,'')})}/></label>
    <label className="field"><span>Сумма в валюте (если была)</span><span className="accounting-currency"><input inputMode="decimal" value={draft.originalAmount} onChange={event=>setDraft({...draft,originalAmount:event.target.value.replace(',','.').replace(/[^\d.]/g,'')})}/><select aria-label="Валюта" value={draft.originalCurrency} onChange={event=>setDraft({...draft,originalCurrency:event.target.value})}>{['USD','EUR','GBP','CNY','RUB'].map(code=><option key={code}>{code}</option>)}</select></span></label>
    <label className="field"><span>Заказ</span><input placeholder="AT-…" value={draft.orderId} onChange={event=>setDraft({...draft,orderId:event.target.value})}/></label>
    <label className="field"><span>Контрагент</span><input value={draft.counterparty} onChange={event=>setDraft({...draft,counterparty:event.target.value})}/></label>
    <label className="field accounting-note"><span>Комментарий</span><input value={draft.note} onChange={event=>setDraft({...draft,note:event.target.value})}/></label>
   </div>
   <button className="btn primary" disabled={busy||!draft.amountUzs}><Plus size={16} aria-hidden="true"/>Добавить</button>
  </form>
  <div className="accounting-ledger">
   <h4>Журнал за {books.month}</h4>
   {books.entries.length?<table className="accounting-table"><thead><tr><th scope="col">Дата</th><th scope="col">Вид</th><th scope="col">Сумма</th><th scope="col">Заказ, контрагент</th><th scope="col"><span className="sr-only">Действие</span></th></tr></thead>
    <tbody>{books.entries.map(entry=><tr key={entry.id} className={entry.voidedAt?'voided':undefined}>
     <td>{entry.occurredOn}</td>
     <td>{kinds[entry.kind]?.ru}{entry.note&&<small>{entry.note}</small>}{entry.voidedAt&&<small>Аннулировано: {entry.voidReason}</small>}</td>
     <td className={kinds[entry.kind]?.direction==='in'?'in':'out'}>{kinds[entry.kind]?.direction==='in'?'+':'−'}{money(entry.amountUzs)}{entry.originalAmount&&<small>{entry.originalAmount} {entry.originalCurrency}</small>}</td>
     <td>{[entry.orderId,entry.counterparty].filter(Boolean).join(', ')||'—'}</td>
     <td>{!entry.voidedAt&&<button type="button" className="text-button" onClick={()=>void voidEntry(entry)}>Аннулировать</button>}</td>
    </tr>)}</tbody></table>:<p className="micro">Записей за этот месяц нет.</p>}
  </div>
  <div className="accounting-export">
   <h4>Выгрузка для бухгалтера</h4>
   <div className="accounting-grid">
    <label className="field"><span>С месяца</span><input type="month" value={from} onChange={event=>event.target.value&&setFrom(event.target.value)}/></label>
    <label className="field"><span>По месяц</span><input type="month" value={to} onChange={event=>event.target.value&&setTo(event.target.value)}/></label>
   </div>
   <div className="accounting-downloads">
    <a className="btn secondary" href={exportUrl('summary')}><Download size={16} aria-hidden="true"/>Сводка по месяцам</a>
    <a className="btn secondary" href={exportUrl('orders')}><Download size={16} aria-hidden="true"/>Заказы</a>
    <a className="btn secondary" href={exportUrl('ledger')}><Download size={16} aria-hidden="true"/>Журнал операций</a>
   </div>
   <p className="micro">CSV с разделителем «;» открывается в Excel без настроек. Суммы в сумах.</p>
  </div>
 </section>;
}
