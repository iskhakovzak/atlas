'use client';

import {useMemo,useState} from 'react';
import {CircleCheck,CircleX,Lock,LockOpen,TriangleAlert} from 'lucide-react';
import {Amount,ConfirmDialog,currencies,dateTime,Fact,money,post,type AccountingContext} from './accounting-shared';
import {clientReconcile,closingChecklist,monthLabel,normalizeClosings,normalizeIssues,previousMonth,sortIssues,todayTashkent} from './accounting-helpers';

/** Закрытие: the checklist, close / reopen with a reason (reopen is for the administrator), the history and the ledger fx rates. */
export function AccountingClosing({ctx}:{ctx:AccountingContext}){
 const {books,month,usdRate,canWrite,isAdmin,busy,run}=ctx;
 const settings=books.settings;
 const issues=useMemo(()=>sortIssues([...normalizeIssues(books.reconcile??books.warnings),...clientReconcile({month:books.month,orders:books.orders,entries:books.entries,orderEntries:books.orderEntries,stages:books.stages,settings,usdRate})]),[books,settings,usdRate]);
 const {checks,canClose}=useMemo(()=>closingChecklist({month,summary:books.summary,entries:books.entries,orders:books.orders,settings,issues}),[month,books,settings,issues]);
 const history=useMemo(()=>normalizeClosings(books.closings),[books.closings]);
 const [closing,setClosing]=useState(false),[reopening,setReopening]=useState(false);
 const [rates,setRates]=useState<Record<string,string>>({}),[ratesError,setRatesError]=useState('');
 const fxRates=settings.fxRates;
 async function saveRates(){
  const next:Record<string,number>={...(fxRates??{})};
  for(const [code,text] of Object.entries(rates)){const value=Number(text.replace(',','.'));if(!text.trim())delete next[code];else if(!Number.isFinite(value)||value<=0){setRatesError(`Курс ${code} должен быть числом больше нуля.`);return}else next[code]=value}
  setRatesError('');
  const ok=await run(()=>post({kind:'settings',value:{fxRates:next}}).then(()=>undefined),'Курсы для журнала сохранены.');
  if(ok)setRates({});
 }
 const futureMonth=month>todayTashkent().slice(0,7);
 return <div className="acc-tab-body">
  <div className="acc-period">
   {books.locked?<span className="acc-badge locked"><Lock size={14} aria-hidden="true"/>{monthLabel(month)} закрыт{settings.lockedThrough&&settings.lockedThrough!==month?` (закрыто по ${settings.lockedThrough})`:''}</span>
   :<span className="acc-badge"><LockOpen size={14} aria-hidden="true"/>{monthLabel(month)} открыт{settings.lockedThrough?` · закрыто по ${settings.lockedThrough}`:' · закрытых месяцев нет'}</span>}
   {canWrite&&!books.locked&&<button type="button" className="btn primary" disabled={busy||!canClose} onClick={()=>setClosing(true)}><Lock size={16} aria-hidden="true"/>Закрыть месяц</button>}
   {canWrite&&books.locked&&isAdmin&&<button type="button" className="btn secondary" disabled={busy} onClick={()=>setReopening(true)}><LockOpen size={16} aria-hidden="true"/>Открыть заново</button>}
   {canWrite&&books.locked&&!isAdmin&&<span className="micro">Открыть закрытый месяц может только администратор.</span>}
  </div>
  <div className="acc-block">
   <div className="acc-block-head"><h4>Чек-лист закрытия</h4><span className="micro">{checks.filter(check=>check.ok).length} из {checks.length}</span></div>
   <ul className="acc-checklist">{checks.map(check=><li key={check.id} className={check.ok?'ok':check.required?'fail':'warn'}>
    {check.ok?<CircleCheck size={18} aria-hidden="true"/>:check.required?<CircleX size={18} aria-hidden="true"/>:<TriangleAlert size={18} aria-hidden="true"/>}
    <div><b>{check.label}</b>{!check.required&&<span className="acc-optional"> · не блокирует</span>}<small>{check.detail}</small></div>
    <span className="sr-only">{check.ok?'выполнено':check.required?'не выполнено, блокирует закрытие':'предупреждение'}</span>
   </li>)}</ul>
   <p className="micro">Закрытие делает журнал этого и всех более ранних месяцев неизменяемым: записи нельзя добавлять, исправлять и аннулировать. Итоги месяца при этом считаются заново при каждом открытии — закрытие не «замораживает» цифры, а защищает первичку. {futureMonth?'Будущий месяц закрыть нельзя.':''}</p>
  </div>

  <div className="acc-block">
   <div className="acc-block-head"><h4>Итог месяца к закрытию</h4></div>
   <dl className="acc-facts">
    <Fact label="Доход Atlas"><Amount value={books.summary.income.total}/></Fact>
    <Fact label="Расходы"><Amount value={-books.summary.expenses.total}/></Fact>
    <Fact label="Прибыль до налога"><Amount value={books.summary.profit}/></Fact>
    <Fact label={`Налог ${Math.round(books.summary.taxRate*1000)/10} %, ориентир`}><Amount value={books.summary.tax}/></Fact>
    <Fact label="Чистая прибыль"><Amount value={books.summary.net}/></Fact>
    <Fact label="Записей действует">{books.entries.filter(entry=>!entry.voidedAt).length}</Fact>
    <Fact label="Записей аннулировано">{books.entries.filter(entry=>entry.voidedAt).length}</Fact>
    <Fact label="Оплаченных заказов">{books.summary.orders}</Fact>
   </dl>
  </div>

  <div className="acc-block">
   <div className="acc-block-head"><h4>История закрытий</h4></div>
   {history.length?<ul className="acc-history">{history.map((event,index)=><li key={`${event.at}-${index}`}>{event.action==='lock'?<Lock size={14} aria-hidden="true"/>:<LockOpen size={14} aria-hidden="true"/>}<div><b>{event.action==='lock'?`Закрыто по ${event.lockedThrough??'—'}`:`Открыто заново${event.lockedThrough?` до ${event.lockedThrough}`:' полностью'}`}</b><small>{event.at?dateTime(event.at):''}{event.by?` · ${event.by}`:''}{event.before?` · было: ${event.before}`:''}{event.reason?` · причина: ${event.reason}`:''}</small></div></li>)}</ul>
   :<p className="micro" role="status">{settings.lockedThrough?`Сейчас закрыто по ${settings.lockedThrough}. Полная история закрытий и повторных открытий хранится в аудите (admin → Аудит, действия accounting.lock / accounting.unlock).`:'Закрытий ещё не было.'}</p>}
  </div>

  <div className="acc-block">
   <div className="acc-block-head"><h4>Курсы для журнала</h4><span className="micro">сум за 1 единицу валюты</span></div>
   <div className="acc-rates">
    <label className="field acc-inline"><span>USD</span><input value={money(usdRate)} readOnly aria-describedby="acc-rate-usd-hint"/></label>
    {currencies.filter(code=>code!=='USD').map(code=><label key={code} className="field acc-inline"><span>{code}</span><input inputMode="decimal" placeholder={fxRates?.[code]?String(fxRates[code]):'не задан'} value={rates[code]??''} disabled={!canWrite} onChange={event=>setRates({...rates,[code]:event.target.value.replace(/[^\d.,]/g,'')})}/></label>)}
    {canWrite&&<button type="button" className="btn secondary" disabled={busy||!Object.keys(rates).length} onClick={()=>void saveRates()}>Сохранить курсы</button>}
   </div>
   {ratesError&&<p className="notice error" role="alert">{ratesError}</p>}
   <p className="micro" id="acc-rate-usd-hint">USD — из тарифа (ЦБ × наценка), не редактируется. Остальные курсы задаёт владелец вручную для пересчёта валютных записей в сумы; сверьте с банком и бухгалтером. Пустое поле убирает курс.</p>
  </div>

  <ConfirmDialog open={closing} title={`Закрыть ${monthLabel(month)}?`} description={`Записи журнала за ${month} и все более ранние месяцы станут неизменяемыми. Открыть заново сможет только администратор с указанием причины — она попадёт в аудит.`} confirmLabel="Закрыть месяц" busy={busy} onClose={()=>setClosing(false)}
   onConfirm={async()=>{const ok=await run(()=>post({kind:'lock',month}).then(()=>undefined),`Период по ${month} закрыт.`);if(ok)setClosing(false)}}>
   <ul className="acc-checklist acc-checklist-compact">{checks.filter(check=>!check.ok).map(check=><li key={check.id} className="warn"><TriangleAlert size={16} aria-hidden="true"/><div><b>{check.label}</b><small>{check.detail}</small></div></li>)}</ul>
  </ConfirmDialog>
  <ConfirmDialog open={reopening} title={`Открыть ${monthLabel(month)} заново?`} description={`Граница закрытия сдвинется на ${previousMonth(month)}; записи за ${month} и позже снова можно будет менять. Причина попадёт в аудит.`} confirmLabel="Открыть заново" reasonLabel="Причина" reasonPlaceholder="например, бухгалтер нашёл пропущенный счёт" danger busy={busy} onClose={()=>setReopening(false)}
   onConfirm={async reason=>{const ok=await run(()=>post({kind:'unlock',reason,through:previousMonth(month)}).then(()=>undefined),`Месяц ${month} открыт заново.`);if(ok)setReopening(false)}}/>
 </div>;
}
