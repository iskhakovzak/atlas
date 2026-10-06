'use client';

import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {Download,Lock,LockOpen,Pencil,Plus,X} from 'lucide-react';
import {toast} from 'sonner';
import {formatSum} from '@/lib/market/home-copy';
import {useMarket} from '@/lib/market/store';
import {effectiveFx} from '@/lib/market/domain';
import {convertToUzs,filterLedger,isPeriodLocked,ledgerPageSize,orderMargin,paginate,sparkline,type AccountingSettings,type LedgerEntry,type LedgerKind,type MonthSummary,type Obligations,type OrderFinance,type PeriodTotal,type YearSummary} from '@/lib/market/finance';

type Kinds=Record<LedgerKind,{direction:'in'|'out';group:'transit'|'expense'|'income'|'tax';ru:string}>;
type MonthBooks={month:string;summary:MonthSummary;entries:LedgerEntry[];orders:OrderFinance[];orderEntries:LedgerEntry[];stages:Record<string,string>;obligations:Obligations;settings:AccountingSettings;kinds:Kinds;locked:boolean};
type YearBooks={year:number;summary:YearSummary;settings:AccountingSettings};
type Draft={kind:LedgerKind;amountUzs:string;originalAmount:string;originalCurrency:string;occurredOn:string;orderId:string;counterparty:string;note:string};
const money=(value:number)=>formatSum(value,'ru');
const groups:[string,string][]=[['expense','Расходы'],['income','Доходы'],['transit','Транзит (товар, доставка магазина, пошлины, возвраты)'],['tax','Налог']];
const currencies=['USD','EUR','GBP','CNY','RUB'];
const stageNames=['Ожидает выкупа','Выкуплен','На зарубежном складе','Готов к отправке','В пути','Доставлен'];
const statusNames={pending:'Ожидает оплаты',paid:'Оплачен',refunded:'Возвращён',cancelled:'Отменён'} as const;
const monthNames=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const today=()=>new Date(Date.now()+5*3600_000).toISOString().slice(0,10);
const previousMonth=(month:string)=>{const [year,index]=month.split('-').map(Number);return index===1?`${year-1}-12`:`${year}-${String(index-1).padStart(2,'0')}`};
const emptyDraft=():Draft=>({kind:'carrier',amountUzs:'',originalAmount:'',originalCurrency:'USD',occurredOn:today(),orderId:'',counterparty:'',note:''});
const post=(body:unknown)=>fetch('/api/finance',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)}).then(async response=>{const data=await response.json().catch(()=>({})) as {error?:string};if(!response.ok)throw Error(data.error??'Не удалось сохранить.');return data});
const load=async<T,>(query:string)=>{const response=await fetch('/api/finance?'+query,{credentials:'same-origin',cache:'no-store'});const data=await response.json() as T&{error?:string};if(!response.ok)throw Error(data.error??'Не удалось загрузить бухгалтерию.');return data};

/**
 * The books for the operator (lib/market/finance.ts): a month's Atlas income, expenses, profit and profit tax with the
 * month's orders and their actual margin, the obligations snapshot, the period lock, the money ledger with fixes and
 * search, a year view with quarters and a sparkline, and CSV exports for the accountant.
 */
export function AccountingView(){
 const {pricing}=useMarket();
 const usdRate=effectiveFx(pricing);
 const [mode,setMode]=useState<'month'|'year'>('month');
 const [month,setMonth]=useState(()=>today().slice(0,7)),[year,setYear]=useState(()=>today().slice(0,4));
 const [books,setBooks]=useState<MonthBooks|null>(null),[yearBooks,setYearBooks]=useState<YearBooks|null>(null),[error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const reload=useCallback(async()=>{
  try{
   if(mode==='month')setBooks(await load<MonthBooks>('month='+month));
   else if(/^\d{4}$/.test(year))setYearBooks(await load<YearBooks>('year='+year));
   setError('');
  }catch(failure){setError((failure as Error).message)}
 },[mode,month,year]);
 useEffect(()=>{queueMicrotask(()=>void reload())},[reload]);
 const run=async(work:()=>Promise<void>,done?:string)=>{if(busy)return;setBusy(true);try{await work();if(done)toast.success(done);await reload()}catch(failure){toast.error((failure as Error).message)}finally{setBusy(false)}};

 // ----- the ledger form: a foreign amount is converted at the tariff rate (USD) or the ledger rates (settings); the soum stay editable -----
 const [draft,setDraft]=useState<Draft>(emptyDraft),[autoAmount,setAutoAmount]=useState(true),[fixing,setFixing]=useState<{entry:LedgerEntry;reason:string}|null>(null);
 const fxRates=books?.settings.fxRates??yearBooks?.settings.fxRates;
 const rateFor=(currency:string)=>currency==='USD'?usdRate:fxRates?.[currency];
 const setForeign=(patch:Partial<Pick<Draft,'originalAmount'|'originalCurrency'>>)=>setDraft(value=>{
  const next={...value,...patch};const converted=convertToUzs(Number(next.originalAmount),next.originalCurrency,usdRate,fxRates);
  return autoAmount&&converted!==null?{...next,amountUzs:String(converted)}:next;
 });
 const startFix=(entry:LedgerEntry)=>{setFixing({entry,reason:''});setAutoAmount(false);setDraft({kind:entry.kind,amountUzs:String(entry.amountUzs),originalAmount:entry.originalAmount===undefined?'':String(entry.originalAmount),originalCurrency:entry.originalCurrency??'USD',occurredOn:entry.occurredOn,orderId:entry.orderId??'',counterparty:entry.counterparty??'',note:entry.note??''});document.getElementById('accounting-form-title')?.scrollIntoView({behavior:'smooth',block:'start'})};
 const cancelFix=()=>{setFixing(null);setDraft(emptyDraft());setAutoAmount(true)};
 async function submit(event:FormEvent){
  event.preventDefault();
  const value={kind:draft.kind,amountUzs:Math.round(Number(draft.amountUzs)),occurredOn:draft.occurredOn,
   ...(draft.originalAmount?{originalAmount:Number(draft.originalAmount),originalCurrency:draft.originalCurrency}:{}),
   ...(draft.orderId.trim()?{orderId:draft.orderId.trim()}:{}),...(draft.counterparty.trim()?{counterparty:draft.counterparty.trim()}:{}),...(draft.note.trim()?{note:draft.note.trim()}:{})};
  if(fixing){
   if(fixing.reason.trim().length<3){toast.error('Укажите причину исправления (от 3 символов).');return}
   await run(async()=>{await post({kind:'replace',id:fixing.entry.id,reason:fixing.reason.trim(),value});cancelFix()},'Запись исправлена: старая аннулирована, новая добавлена.');
  }else await run(async()=>{await post({kind:'entry',value});setDraft(current=>({...current,amountUzs:'',originalAmount:'',orderId:'',note:''}));setAutoAmount(true)},'Запись добавлена.');
 }
 async function voidEntry(entry:LedgerEntry){
  const reason=window.prompt('Почему аннулировать запись? Она останется в журнале с пометкой.');if(!reason||reason.trim().length<3)return;
  await run(()=>post({kind:'void',id:entry.id,reason:reason.trim()}).then(()=>undefined),'Запись аннулирована.');
 }

 // ----- settings: the profit tax rate and the ledger fx rates -----
 const [rate,setRate]=useState(''),[rates,setRates]=useState<Record<string,string>>({});
 async function saveRate(){
  const value=Number(rate.replace(',','.'))/100;if(!Number.isFinite(value)||value<0||value>0.5){toast.error('Ставка от 0 до 50%.');return}
  await run(()=>post({kind:'settings',value:{profitTaxRate:value}}).then(()=>setRate('')),'Ставка сохранена. Сверьте её с бухгалтером.');
 }
 async function saveRates(){
  const next:Record<string,number>={...(fxRates??{})};
  for(const [code,text] of Object.entries(rates)){const value=Number(text.replace(',','.'));if(!text.trim())delete next[code];else if(!Number.isFinite(value)||value<=0){toast.error(`Курс ${code} должен быть числом больше нуля.`);return}else next[code]=value}
  await run(()=>post({kind:'settings',value:{fxRates:next}}).then(()=>setRates({})),'Курсы для журнала сохранены.');
 }

 // ----- period lock -----
 async function lockMonth(){
  if(!window.confirm(`Закрыть ${month}? Записи журнала этого и более ранних месяцев нельзя будет добавлять и аннулировать. Открыть заново можно с указанием причины.`))return;
  await run(()=>post({kind:'lock',month}).then(()=>undefined),`Период по ${month} закрыт.`);
 }
 async function unlockMonth(){
  const reason=window.prompt(`Почему открыть ${month} заново? Причина попадёт в аудит.`);if(!reason||reason.trim().length<3)return;
  await run(()=>post({kind:'unlock',reason:reason.trim(),through:previousMonth(month)}).then(()=>undefined),`Месяц ${month} открыт заново.`);
 }

 // ----- the ledger list: search and pages of 100 -----
 const [filter,setFilter]=useState({kind:'' as LedgerKind|'',orderId:'',counterparty:'',text:'',voided:'all' as 'all'|'live'|'voided'}),[page,setPage]=useState(1);
 const filtered=useMemo(()=>filterLedger(books?.entries??[],filter),[books,filter]);
 const paged=paginate(filtered,page);
 const [orderStatus,setOrderStatus]=useState<'all'|OrderFinance['status']>('all');
 const orderRows=useMemo(()=>{if(!books)return [];const list=orderStatus==='all'?books.orders:books.orders.filter(order=>order.status===orderStatus);return list.map(order=>({order,margin:orderMargin(order,books.orderEntries)}))},[books,orderStatus]);

 const [from,setFrom]=useState(()=>today().slice(0,4)+'-01'),[to,setTo]=useState(()=>today().slice(0,7));
 const exportUrl=(kind:string)=>`/api/finance?export=${kind}&from=${from}&to=${to}`;
 const current=mode==='month'?books:yearBooks;
 const kinds=books?.kinds;
 const lockedThrough=current?.settings.lockedThrough;

 const head=<div className="accounting-head">
  <div><h3 id="accounting-title">Бухгалтерия</h3><p className="micro">Atlas работает как агент: деньги за товар, доставку магазина и пошлины — транзит. Доход Atlas — комиссия, международная доставка, курсовая наценка и услуги по оплаченным заказам месяца плюс прочие доходы. Расходы — записи журнала. Оплаты на сайте симулируются: «оплачен» — тестовая отметка, не поступление денег. Ставку налога и схему сверьте с бухгалтером.</p></div>
  <div className="acc-toolbar">
   <div className="acc-seg" role="group" aria-label="Период отчёта"><button type="button" aria-pressed={mode==='month'} onClick={()=>setMode('month')}>Месяц</button><button type="button" aria-pressed={mode==='year'} onClick={()=>setMode('year')}>Год</button></div>
   {mode==='month'?<label className="field accounting-month"><span>Месяц</span><input type="month" value={month} onChange={event=>event.target.value&&setMonth(event.target.value)}/></label>
   :<label className="field accounting-month"><span>Год</span><input inputMode="numeric" maxLength={4} value={year} onChange={event=>setYear(event.target.value.replace(/\D/g,'').slice(0,4))}/></label>}
  </div>
 </div>;
 if(!current)return <section className="accounting" aria-labelledby="accounting-title">{head}<p className="micro" role="status">{error||'Загружаем бухгалтерию…'}</p></section>;

 return <section className="accounting" aria-labelledby="accounting-title">
  {head}
  {error&&<p className="notice error" role="alert">{error}</p>}
  {mode==='year'&&yearBooks&&<YearView data={yearBooks}/>}
  {mode==='month'&&books&&kinds&&<>
   <div className="acc-period">
    {books.locked?<span className="acc-badge locked"><Lock size={14} aria-hidden="true"/>Месяц закрыт{lockedThrough&&lockedThrough!==month?` (по ${lockedThrough})`:''}</span>:<span className="acc-badge">Месяц открыт{lockedThrough?` · закрыто по ${lockedThrough}`:''}</span>}
    {books.locked?<button type="button" className="btn secondary" disabled={busy} onClick={()=>void unlockMonth()}><LockOpen size={16} aria-hidden="true"/>Открыть заново</button>
    :<button type="button" className="btn secondary" disabled={busy||month>today().slice(0,7)} onClick={()=>void lockMonth()}><Lock size={16} aria-hidden="true"/>Закрыть месяц</button>}
   </div>
   <MonthCards s={books.summary} kinds={kinds}/>
   <ObligationsCards data={books.obligations}/>
   <div className="acc-block">
    <div className="acc-block-head"><h4>Заказы месяца</h4><label className="field acc-inline"><span>Статус</span><select value={orderStatus} onChange={event=>setOrderStatus(event.target.value as typeof orderStatus)}><option value="all">Все</option><option value="paid">Оплачен</option><option value="pending">Ожидает оплаты</option><option value="refunded">Возвращён</option><option value="cancelled">Отменён</option></select></label></div>
    <p className="micro">Оплаченные в этом месяце и созданные в нём неоплаченные заказы. Фактическая маржа = доход Atlas по заказу − привязанные к нему расходы журнала (перевозчик, комиссия платёжки) за любую дату.</p>
    {orderRows.length?<div className="acc-scroll"><table className="accounting-table acc-table">
     <thead><tr><th scope="col">Заказ</th><th scope="col">Статус</th><th scope="col">Товар (транзит)</th><th scope="col">Комиссия</th><th scope="col">Доставка</th><th scope="col">Курс</th><th scope="col">Услуги</th><th scope="col">Доход Atlas</th><th scope="col">Расходы по заказу</th><th scope="col">Факт. маржа</th></tr></thead>
     <tbody>{orderRows.map(({order,margin})=><tr key={order.orderId} className={order.status==='cancelled'||order.status==='refunded'?'muted-row':undefined}>
      <td><a className="text-link" href={`/operations#${encodeURIComponent(order.orderId)}`}>{order.orderId}</a><small>{order.customerId}</small></td>
      <td>{statusNames[order.status]}<small>{books.stages[order.orderId]==='cancelled'?'Отменён':stageNames[Number(books.stages[order.orderId])]??'Этап не найден'}</small></td>
      <td className="num">{money(order.goods)}{order.storeShipping?<small>+ доставка магазина {money(order.storeShipping)}</small>:null}</td>
      <td className="num">{money(order.commission)}</td><td className="num">{money(order.delivery)}</td><td className="num">{money(order.fxGain)}</td><td className="num">{money(order.services)}</td>
      <td className="num"><b>{money(order.revenue)}</b></td>
      <td className="num">{margin.linkedExpenses?money(margin.linkedExpenses):'—'}{margin.entries.length?<small>{margin.entries.length} зап.</small>:null}</td>
      <td className={margin.margin<0?'num loss':'num'}><b>{money(margin.margin)}</b></td>
     </tr>)}</tbody></table></div>:<p className="micro">Заказов с таким статусом в этом месяце нет.</p>}
   </div>
   <div className="acc-settings">
    <div className="accounting-rate"><label className="field"><span>Ставка налога на прибыль, %</span><input inputMode="decimal" placeholder={String(Math.round(books.settings.profitTaxRate*1000)/10)} value={rate} onChange={event=>setRate(event.target.value)}/></label><button type="button" className="btn secondary" disabled={!rate||busy} onClick={()=>void saveRate()}>Сохранить ставку</button></div>
    <div className="acc-rates">
     <span className="acc-rates-title">Курсы для журнала, сум за 1 ед.</span>
     <span className="acc-rate-usd">USD {money(usdRate)}<small>из тарифа</small></span>
     {currencies.filter(code=>code!=='USD').map(code=><label key={code} className="field acc-inline"><span>{code}</span><input inputMode="decimal" placeholder={fxRates?.[code]?String(fxRates[code]):'не задан'} value={rates[code]??''} onChange={event=>setRates({...rates,[code]:event.target.value.replace(/[^\d.,]/g,'')})}/></label>)}
     <button type="button" className="btn secondary" disabled={busy||!Object.keys(rates).length} onClick={()=>void saveRates()}>Сохранить курсы</button>
    </div>
    <p className="micro">Курс USD берётся из тарифа (ЦБ × наценка). Остальные курсы задаёт владелец вручную — сверьте с банком и бухгалтером. Ставка налога по умолчанию 15% — ориентир, подтвердите у бухгалтера.</p>
   </div>
   <form className={fixing?'accounting-form acc-fixing':'accounting-form'} onSubmit={submit} aria-labelledby="accounting-form-title">
    <div className="acc-block-head"><h4 id="accounting-form-title">{fixing?`Исправление записи ${fixing.entry.id.slice(0,12)}…`:'Добавить запись'}</h4>{fixing&&<button type="button" className="text-button" onClick={cancelFix}><X size={14} aria-hidden="true"/> Отменить исправление</button>}</div>
    {fixing&&<p className="micro">Старая запись будет аннулирована с указанной причиной, а исправленная копия добавлена новой записью. Обе остаются в журнале и аудите.</p>}
    <div className="accounting-grid">
     <label className="field"><span>Вид</span><select value={draft.kind} onChange={event=>setDraft({...draft,kind:event.target.value as LedgerKind})}>{groups.map(([group,label])=><optgroup key={group} label={label}>{(Object.keys(kinds) as LedgerKind[]).filter(kind=>kinds[kind].group===group).map(kind=><option key={kind} value={kind}>{kinds[kind].ru}</option>)}</optgroup>)}</select></label>
     <label className="field"><span>Дата</span><input type="date" required value={draft.occurredOn} onChange={event=>setDraft({...draft,occurredOn:event.target.value})}/>{isPeriodLockedClient(lockedThrough,draft.occurredOn)&&<small className="acc-warn">Этот месяц закрыт — запись не сохранится.</small>}</label>
     <label className="field"><span>Сумма в валюте (если была)</span><span className="accounting-currency"><input inputMode="decimal" value={draft.originalAmount} onChange={event=>setForeign({originalAmount:event.target.value.replace(',','.').replace(/[^\d.]/g,'')})}/><select aria-label="Валюта" value={draft.originalCurrency} onChange={event=>setForeign({originalCurrency:event.target.value})}>{currencies.map(code=><option key={code}>{code}</option>)}</select></span>{draft.originalAmount&&<small className="acc-hint">{rateFor(draft.originalCurrency)?`По курсу ${money(rateFor(draft.originalCurrency) as number)} за 1 ${draft.originalCurrency}${autoAmount?'':' (сумма в сумах изменена вручную)'}`:`Курс ${draft.originalCurrency} не задан — введите сумму в сумах вручную`}</small>}</label>
     <label className="field"><span>Сумма, сум</span><input inputMode="numeric" required value={draft.amountUzs} onChange={event=>{setAutoAmount(false);setDraft({...draft,amountUzs:event.target.value.replace(/\D/g,'')})}}/></label>
     <label className="field"><span>Заказ</span><input placeholder="AT-…" value={draft.orderId} onChange={event=>setDraft({...draft,orderId:event.target.value})}/></label>
     <label className="field"><span>Контрагент</span><input value={draft.counterparty} onChange={event=>setDraft({...draft,counterparty:event.target.value})}/></label>
     <label className="field accounting-note"><span>Комментарий</span><input value={draft.note} onChange={event=>setDraft({...draft,note:event.target.value})}/></label>
     {fixing&&<label className="field accounting-note"><span>Причина исправления</span><input required minLength={3} value={fixing.reason} onChange={event=>setFixing({...fixing,reason:event.target.value})}/></label>}
    </div>
    <button className="btn primary" disabled={busy||!draft.amountUzs}>{fixing?<><Pencil size={16} aria-hidden="true"/>Исправить запись</>:<><Plus size={16} aria-hidden="true"/>Добавить</>}</button>
   </form>
   <div className="accounting-ledger">
    <div className="acc-block-head"><h4>Журнал за {books.month}</h4><span className="micro">{filtered.length===books.entries.length?`${books.entries.length} записей`:`${filtered.length} из ${books.entries.length} записей`}</span></div>
    <div className="acc-filters">
     <label className="field acc-inline"><span>Вид</span><select value={filter.kind} onChange={event=>{setFilter({...filter,kind:event.target.value as LedgerKind|''});setPage(1)}}><option value="">Все виды</option>{groups.map(([group,label])=><optgroup key={group} label={label}>{(Object.keys(kinds) as LedgerKind[]).filter(kind=>kinds[kind].group===group).map(kind=><option key={kind} value={kind}>{kinds[kind].ru}</option>)}</optgroup>)}</select></label>
     <label className="field acc-inline"><span>Заказ</span><input placeholder="AT-…" value={filter.orderId} onChange={event=>{setFilter({...filter,orderId:event.target.value});setPage(1)}}/></label>
     <label className="field acc-inline"><span>Контрагент</span><input value={filter.counterparty} onChange={event=>{setFilter({...filter,counterparty:event.target.value});setPage(1)}}/></label>
     <label className="field acc-inline"><span>Поиск</span><input placeholder="комментарий, вид, id" value={filter.text} onChange={event=>{setFilter({...filter,text:event.target.value});setPage(1)}}/></label>
     <label className="field acc-inline"><span>Показывать</span><select value={filter.voided} onChange={event=>{setFilter({...filter,voided:event.target.value as typeof filter.voided});setPage(1)}}><option value="all">Все</option><option value="live">Действующие</option><option value="voided">Аннулированные</option></select></label>
    </div>
    {paged.items.length?<div className="acc-scroll"><table className="accounting-table"><thead><tr><th scope="col">Дата</th><th scope="col">Вид</th><th scope="col">Сумма</th><th scope="col">Заказ, контрагент</th><th scope="col"><span className="sr-only">Действия</span></th></tr></thead>
     <tbody>{paged.items.map(entry=><tr key={entry.id} className={entry.voidedAt?'voided':undefined}>
      <td>{entry.occurredOn}</td>
      <td>{kinds[entry.kind]?.ru}{entry.note&&<small>{entry.note}</small>}{entry.voidedAt&&<small>Аннулировано: {entry.voidReason}</small>}</td>
      <td className={kinds[entry.kind]?.direction==='in'?'in':'out'}>{kinds[entry.kind]?.direction==='in'?'+':'−'}{money(entry.amountUzs)}{entry.originalAmount&&<small>{entry.originalAmount} {entry.originalCurrency}</small>}</td>
      <td>{[entry.orderId,entry.counterparty].filter(Boolean).join(', ')||'—'}</td>
      <td className="acc-actions">{!entry.voidedAt&&!isPeriodLockedClient(lockedThrough,entry.occurredOn)&&<><button type="button" className="text-button" onClick={()=>startFix(entry)}>Исправить</button><button type="button" className="text-button" onClick={()=>void voidEntry(entry)}>Аннулировать</button></>}{!entry.voidedAt&&isPeriodLockedClient(lockedThrough,entry.occurredOn)&&<small>период закрыт</small>}</td>
     </tr>)}</tbody></table></div>:<p className="micro">{books.entries.length?'По этим условиям записей нет.':'Записей за этот месяц нет.'}</p>}
    {paged.pages>1&&<div className="acc-pager"><button type="button" className="btn secondary" disabled={paged.page<=1} onClick={()=>setPage(paged.page-1)}>Назад</button><span>Страница {paged.page} из {paged.pages} · по {ledgerPageSize}</span><button type="button" className="btn secondary" disabled={paged.page>=paged.pages} onClick={()=>setPage(paged.page+1)}>Вперёд</button></div>}
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
     <a className="btn secondary" href={exportUrl('margins')}><Download size={16} aria-hidden="true"/>Заказы с маржой</a>
     <a className="btn secondary" href={exportUrl('ledger')}><Download size={16} aria-hidden="true"/>Журнал операций</a>
     <a className="btn secondary" href={`/api/finance?export=year&year=${from.slice(0,4)}`}><Download size={16} aria-hidden="true"/>Год {from.slice(0,4)} по месяцам</a>
    </div>
    <p className="micro">CSV с разделителем «;» открывается в Excel без настроек. Суммы в сумах.</p>
   </div>
  </>}
 </section>;
}

const isPeriodLockedClient=(lockedThrough:string|undefined,dateOrMonth:string)=>isPeriodLocked({lockedThrough},dateOrMonth);

function MonthCards({s,kinds}:{s:MonthSummary;kinds:Kinds}){
 return <div className="accounting-cards">
  <article><span>Доход Atlas</span><strong>{money(s.income.total)}</strong><small>Комиссия {money(s.income.commission)}, доставка {money(s.income.delivery)}, курс {money(s.income.fxGain)}, услуги {money(s.income.services)}, прочее {money(s.income.other)}</small></article>
  <article><span>Расходы</span><strong>{money(s.expenses.total)}</strong><small>{Object.entries(s.expenses).filter(([key])=>key!=='total').map(([key,value])=>`${kinds[key as LedgerKind]?.ru}: ${money(value as number)}`).join('; ')||'Записей о расходах нет'}</small></article>
  <article className={s.profit<0?'loss':undefined}><span>Прибыль до налога</span><strong>{money(s.profit)}</strong><small>{s.orders} оплаченных заказов</small></article>
  <article><span>Налог на прибыль, {Math.round(s.taxRate*1000)/10}%</span><strong>{money(s.tax)}</strong><small>Уплачено за месяц: {money(s.taxPaid)}</small></article>
  <article><span>Чистая прибыль</span><strong>{money(s.net)}</strong><small>Транзит: за товары получено {money(s.transit.goodsCharged)}, приход {money(s.transit.in)}, расход {money(s.transit.out)}</small></article>
 </div>;
}

function ObligationsCards({data}:{data:Obligations}){
 return <div className="acc-block">
  <h4>Дебиторка и обязательства</h4>
  <div className="accounting-cards acc-obligations">
   <article><span>Ожидают оплаты</span><strong>{money(data.pendingOrders.amount)}</strong><small>{data.pendingOrders.count} заказов без отметки оплаты (отметка тестовая)</small></article>
   <article><span>Внутренние балансы клиентов</span><strong>{money(data.customerBalances.amount)}</strong><small>{data.customerBalances.count} клиентов с положительным балансом — обязательство Atlas</small></article>
   <article><span>Транзит к выплате магазинам</span><strong>{money(data.transitToStores.total)}</strong><small>{data.transitToStores.count} оплаченных, ещё не выкупленных заказов: товар {money(data.transitToStores.goods)}, доставка магазина {money(data.transitToStores.storeShipping)}</small></article>
  </div>
  <p className="micro">Снимок на сейчас по всем месяцам. Выкуп определяется по этапу заказа «Ожидает выкупа»; платежи на сайте симулируются.</p>
 </div>;
}

function YearView({data}:{data:YearBooks}){
 const s=data.summary;
 const incomeLine=sparkline(s.months.map(m=>m.income.total)),profitLine=sparkline(s.months.map(m=>m.profit));
 const describe=(label:string,values:number[])=>`${label} по месяцам ${s.year}: `+values.map((value,index)=>`${monthNames[index]} ${money(value)}`).join(', ');
 const row=(label:string,p:MonthSummary|PeriodTotal,className?:string,key?:string)=><tr key={key??label} className={className}><th scope="row">{label}</th><td className="num">{p.orders}</td><td className="num">{money(p.income.commission)}</td><td className="num">{money(p.income.delivery)}</td><td className="num">{money(p.income.fxGain)}</td><td className="num">{money(p.income.services)}</td><td className="num">{money(p.income.other)}</td><td className="num"><b>{money(p.income.total)}</b></td><td className="num">{money(p.expenses.total)}</td><td className={p.profit<0?'num loss':'num'}><b>{money(p.profit)}</b></td><td className="num">{money(p.tax)}</td><td className="num"><b>{money(p.net)}</b></td><td className="num">{money(p.taxPaid)}</td></tr>;
 return <div className="acc-block acc-year">
  <div className="accounting-cards">
   <article><span>Доход Atlas за {s.year}</span><strong>{money(s.total.income.total)}</strong><small>{s.total.orders} оплаченных заказов</small></article>
   <article><span>Расходы</span><strong>{money(s.total.expenses.total)}</strong><small>по записям журнала</small></article>
   <article className={s.total.profit<0?'loss':undefined}><span>Прибыль до налога</span><strong>{money(s.total.profit)}</strong><small>налог {Math.round(s.taxRate*1000)/10}% — ориентир: {money(s.total.tax)}</small></article>
   <article><span>Чистая прибыль</span><strong>{money(s.total.net)}</strong><small>Налог уплачен: {money(s.total.taxPaid)}</small></article>
  </div>
  <figure className="acc-spark">
   <svg viewBox="0 0 320 64" role="img" aria-label={describe('Доход',s.months.map(m=>m.income.total))+'. '+describe('Прибыль',s.months.map(m=>m.profit))} preserveAspectRatio="none">
    {incomeLine.area&&<path className="acc-spark-area" d={incomeLine.area}/>}
    {incomeLine.path&&<path className="acc-spark-income" d={incomeLine.path}/>}
    {profitLine.path&&<path className="acc-spark-profit" d={profitLine.path}/>}
   </svg>
   <figcaption><span className="acc-legend income">Доход</span><span className="acc-legend profit">Прибыль до налога</span><span>{monthNames[0]} – {monthNames[11]} {s.year}</span></figcaption>
  </figure>
  <p className="micro">Налог на прибыль в Узбекистане отчитывается поквартально; итоги кварталов здесь — ориентир по ставке из настроек, не расчёт декларации. Сверьте с бухгалтером.</p>
  <div className="acc-scroll"><table className="accounting-table acc-table acc-year-table">
   <thead><tr><th scope="col">Период</th><th scope="col">Заказы</th><th scope="col">Комиссия</th><th scope="col">Доставка</th><th scope="col">Курс</th><th scope="col">Услуги</th><th scope="col">Прочее</th><th scope="col">Доход</th><th scope="col">Расходы</th><th scope="col">Прибыль</th><th scope="col">Налог</th><th scope="col">Чистая</th><th scope="col">Налог уплачен</th></tr></thead>
   <tbody>{s.quarters.flatMap((quarter,index)=>[...s.months.slice(index*3,index*3+3).map(m=>row(`${monthNames[Number(m.month.slice(5))-1]} ${m.month.slice(0,4)}`,m,undefined,m.month)),row(quarter.label,quarter,'quarter')])}{row(s.total.label,s.total,'total')}</tbody>
  </table></div>
  <div className="accounting-downloads"><a className="btn secondary" href={`/api/finance?export=year&year=${s.year}`}><Download size={16} aria-hidden="true"/>Год по месяцам (CSV)</a></div>
 </div>;
}
