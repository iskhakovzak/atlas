'use client';

import {useMemo,useState,type FormEvent} from 'react';
import {Bot,Eye,Pencil,Plus,X} from 'lucide-react';
import {convertToUzs,filterLedger,ledgerPageSize,paginate,type LedgerKind} from '@/lib/market/finance';
import {Modal} from './market-ui';
import {Amount,Badge,ConfirmDialog,currencies,dateTime,KindSelect,money,post,type AccountingContext} from './accounting-shared';
import {entryDirection,entrySourceLabel,filterLedgerView,groupNames,isAutoEntry,isBankEntry,isEditableEntry,todayTashkent,validateDraft,type EntryDraft,type LedgerEntryView} from './accounting-helpers';

const emptyDraft=():EntryDraft=>({kind:'carrier',amountUzs:'',originalAmount:'',originalCurrency:'USD',occurredOn:todayTashkent(),orderId:'',counterparty:'',note:''});
type Filter={group:''|keyof typeof groupNames;kind:LedgerKind|'';orderId:string;counterparty:string;text:string;auto:'all'|'auto'|'manual';voided:'all'|'live'|'voided'};

/** Журнал: filters and search, pages of 100, add / fix / void with a reason; auto entries are view-only. */
export function AccountingLedger({ctx,initialOrderId=''}:{ctx:AccountingContext;initialOrderId?:string}){
 const {books,usdRate,canWrite,busy,run}=ctx;
 const kinds=books.kinds,settings=books.settings;
 const [filter,setFilter]=useState<Filter>({group:'',kind:'',orderId:initialOrderId,counterparty:'',text:'',auto:'all',voided:'all'}),[page,setPage]=useState(1);
 const patch=(value:Partial<Filter>)=>{setFilter(current=>({...current,...value}));setPage(1)};
 const filtered=useMemo(()=>filterLedgerView(filterLedger(books.entries,filter),filter),[books.entries,filter]);
 const paged=paginate(filtered,page);
 const autoCount=useMemo(()=>books.entries.filter(isAutoEntry).length,[books.entries]);

 // ----- the form: new entry or a fix (void + corrected copy) -----
 const [draft,setDraft]=useState<EntryDraft>(emptyDraft),[autoAmount,setAutoAmount]=useState(true),[fixing,setFixing]=useState<LedgerEntryView|null>(null),[fixReason,setFixReason]=useState(''),[submitted,setSubmitted]=useState(false),[serverError,setServerError]=useState('');
 const [formOpen,setFormOpen]=useState(false);
 const fxRates=settings.fxRates;
 const rateFor=(currency:string)=>currency==='USD'?usdRate:currency==='UZS'?1:fxRates?.[currency];
 const errors=useMemo(()=>validateDraft(draft,settings),[draft,settings]);
 const setForeign=(value:Partial<Pick<EntryDraft,'originalAmount'|'originalCurrency'>>)=>setDraft(current=>{const next={...current,...value};const converted=convertToUzs(Number(next.originalAmount),next.originalCurrency,usdRate,fxRates);return autoAmount&&converted!==null?{...next,amountUzs:String(converted)}:next});
 const startFix=(entry:LedgerEntryView)=>{setFixing(entry);setFixReason('');setAutoAmount(false);setSubmitted(false);setServerError('');setFormOpen(true);setDraft({kind:entry.kind,amountUzs:String(entry.amountUzs),originalAmount:entry.originalAmount===undefined?'':String(entry.originalAmount),originalCurrency:entry.originalCurrency??'USD',occurredOn:entry.occurredOn,orderId:entry.orderId??'',counterparty:entry.counterparty??'',note:entry.note??''});document.getElementById('acc-ledger-form')?.scrollIntoView({behavior:'smooth',block:'start'})};
 const resetForm=()=>{setFixing(null);setFixReason('');setDraft(emptyDraft());setAutoAmount(true);setSubmitted(false);setServerError('')};
 async function submit(event:FormEvent){
  event.preventDefault();setSubmitted(true);setServerError('');
  if(Object.keys(errors).length)return;
  if(fixing&&fixReason.trim().length<3)return;
  const value={kind:draft.kind,amountUzs:Math.round(Number(draft.amountUzs)),occurredOn:draft.occurredOn,
   ...(draft.originalAmount.trim()?{originalAmount:Number(draft.originalAmount),originalCurrency:draft.originalCurrency}:{}),
   ...(draft.orderId.trim()?{orderId:draft.orderId.trim().toUpperCase()}:{}),...(draft.counterparty.trim()?{counterparty:draft.counterparty.trim()}:{}),...(draft.note.trim()?{note:draft.note.trim()}:{})};
  const ok=await run(async()=>{try{if(fixing)await post({kind:'replace',id:fixing.id,reason:fixReason.trim(),value});else await post({kind:'entry',value})}catch(failure){setServerError((failure as Error).message);throw failure}},fixing?'Запись исправлена: старая аннулирована, новая добавлена.':'Запись добавлена.');
  if(ok){if(fixing)resetForm();else{setDraft(current=>({...current,amountUzs:'',originalAmount:'',orderId:'',note:''}));setAutoAmount(true);setSubmitted(false)}}
 }

 // ----- void with a reason, and the read-only view of an entry -----
 const [voiding,setVoiding]=useState<LedgerEntryView|null>(null),[viewing,setViewing]=useState<LedgerEntryView|null>(null);
 const showErrors=submitted;
 const fieldError=(key:keyof EntryDraft)=>showErrors&&errors[key]?<small className="acc-field-error" id={`acc-f-${key}-error`}>{errors[key]}</small>:null;

 return <div className="acc-tab-body">
  {canWrite&&<div className="acc-block-head">
   <h4 id="acc-ledger-form">{fixing?`Исправление записи ${fixing.id.slice(0,12)}…`:'Новая запись'}</h4>
   {fixing?<button type="button" className="text-button" onClick={resetForm}><X size={14} aria-hidden="true"/> Отменить исправление</button>
   :<button type="button" className="btn secondary acc-compact" aria-expanded={formOpen} aria-controls="acc-ledger-form-body" onClick={()=>setFormOpen(open=>!open)}><Plus size={16} aria-hidden="true"/>{formOpen?'Скрыть форму':'Добавить запись'}</button>}
  </div>}
  {canWrite&&(formOpen||fixing)&&<form id="acc-ledger-form-body" className={fixing?'accounting-form acc-fixing':'accounting-form'} onSubmit={submit} noValidate aria-labelledby="acc-ledger-form">
   {fixing&&<p className="micro">Старая запись будет аннулирована с указанной причиной, исправленная копия добавится новой записью. Обе остаются в журнале и аудите.</p>}
   {books.locked&&!fixing&&<p className="micro acc-warn">Месяц {books.month} закрыт — записи с датой в нём сервер отклонит. Выберите дату в открытом месяце или откройте месяц заново во вкладке «Закрытие».</p>}
   <div className="accounting-grid">
    <KindSelect id="acc-f-kind" value={draft.kind} onChange={kind=>setDraft({...draft,kind})} kinds={kinds}/>
    <label className="field"><span>Дата</span><input id="acc-f-date" type="date" required value={draft.occurredOn} aria-invalid={showErrors&&!!errors.occurredOn} aria-describedby={showErrors&&errors.occurredOn?'acc-f-occurredOn-error':undefined} onChange={event=>setDraft({...draft,occurredOn:event.target.value})}/>{fieldError('occurredOn')}</label>
    <label className="field"><span>Сумма в валюте (если была)</span><span className="accounting-currency"><input id="acc-f-foreign" inputMode="decimal" value={draft.originalAmount} aria-invalid={showErrors&&!!errors.originalAmount} onChange={event=>setForeign({originalAmount:event.target.value.replace(',','.').replace(/[^\d.]/g,'')})}/><select aria-label="Валюта" value={draft.originalCurrency} onChange={event=>setForeign({originalCurrency:event.target.value})}>{currencies.map(code=><option key={code}>{code}</option>)}</select></span>{fieldError('originalAmount')}{draft.originalAmount&&!errors.originalAmount&&<small className="acc-hint">{rateFor(draft.originalCurrency)?`По курсу ${money(rateFor(draft.originalCurrency) as number)} за 1 ${draft.originalCurrency}${autoAmount?'':' (сумма в сумах изменена вручную)'}`:`Курс ${draft.originalCurrency} не задан — введите сумму в сумах вручную или задайте курс в «Закрытии»`}</small>}</label>
    <label className="field"><span>Сумма, сум</span><input id="acc-f-amount" inputMode="numeric" required value={draft.amountUzs} aria-invalid={showErrors&&!!errors.amountUzs} aria-describedby={showErrors&&errors.amountUzs?'acc-f-amountUzs-error':undefined} onChange={event=>{setAutoAmount(false);setDraft({...draft,amountUzs:event.target.value.replace(/\D/g,'')})}}/>{fieldError('amountUzs')}</label>
    <label className="field"><span>Заказ</span><input id="acc-f-order" placeholder="AT-…" value={draft.orderId} aria-invalid={showErrors&&!!errors.orderId} onChange={event=>setDraft({...draft,orderId:event.target.value})}/>{fieldError('orderId')}</label>
    <label className="field"><span>Контрагент</span><input id="acc-f-counterparty" maxLength={120} value={draft.counterparty} onChange={event=>setDraft({...draft,counterparty:event.target.value})}/>{fieldError('counterparty')}</label>
    <label className="field accounting-note"><span>Комментарий</span><input id="acc-f-note" maxLength={500} value={draft.note} onChange={event=>setDraft({...draft,note:event.target.value})}/>{fieldError('note')}</label>
    {fixing&&<label className="field accounting-note"><span>Причина исправления</span><input id="acc-f-reason" required minLength={3} maxLength={300} value={fixReason} aria-invalid={showErrors&&fixReason.trim().length<3} onChange={event=>setFixReason(event.target.value)}/>{showErrors&&fixReason.trim().length<3&&<small className="acc-field-error">Укажите причину — от 3 символов.</small>}</label>}
   </div>
   {serverError&&<p className="notice error" role="alert">{serverError}</p>}
   <div className="acc-form-actions">
    <button className="btn primary" disabled={busy}>{fixing?<><Pencil size={16} aria-hidden="true"/>Исправить запись</>:<><Plus size={16} aria-hidden="true"/>Добавить</>}</button>
    {showErrors&&Object.keys(errors).length>0&&<span className="acc-field-error" role="alert">Проверьте поля: {Object.keys(errors).length}</span>}
   </div>
  </form>}

  <div className="accounting-ledger">
   <div className="acc-block-head"><h4>Журнал за {books.month}</h4><span className="micro">{filtered.length===books.entries.length?`${books.entries.length} записей`:`${filtered.length} из ${books.entries.length} записей`}{autoCount?` · авто: ${autoCount}`:''}</span></div>
   <div className="acc-filters" role="search" aria-label="Фильтры журнала">
    <label className="field acc-inline"><span>Группа</span><select value={filter.group} onChange={event=>patch({group:event.target.value as Filter['group'],kind:''})}><option value="">Все группы</option>{(Object.keys(groupNames) as (keyof typeof groupNames)[]).map(group=><option key={group} value={group}>{groupNames[group].split(' (')[0]}</option>)}</select></label>
    <KindSelect value={filter.kind} onChange={kind=>patch({kind:kind as LedgerKind|''})} kinds={kinds} allowEmpty/>
    <label className="field acc-inline"><span>Заказ</span><input placeholder="AT-…" value={filter.orderId} onChange={event=>patch({orderId:event.target.value})}/></label>
    <label className="field acc-inline"><span>Контрагент</span><input value={filter.counterparty} onChange={event=>patch({counterparty:event.target.value})}/></label>
    <label className="field acc-inline"><span>Поиск</span><input type="search" placeholder="комментарий, вид, id" value={filter.text} onChange={event=>patch({text:event.target.value})}/></label>
    <label className="field acc-inline"><span>Источник</span><select value={filter.auto} onChange={event=>patch({auto:event.target.value as Filter['auto']})}><option value="all">Все</option><option value="manual">Введённые вручную</option><option value="auto">Только авто</option></select></label>
    <label className="field acc-inline"><span>Показывать</span><select value={filter.voided} onChange={event=>patch({voided:event.target.value as Filter['voided']})}><option value="all">Все</option><option value="live">Действующие</option><option value="voided">Аннулированные</option></select></label>
   </div>
   {paged.items.length?<div className="acc-scroll acc-cards-on-phone"><table className="accounting-table acc-ledger-table"><thead><tr><th scope="col">Дата</th><th scope="col">Вид</th><th scope="col" className="num">Сумма</th><th scope="col">Заказ, контрагент</th><th scope="col"><span className="sr-only">Действия</span></th></tr></thead>
    <tbody>{paged.items.map(entry=>{const auto=isAutoEntry(entry),editable=canWrite&&isEditableEntry(entry,settings);const direction=entryDirection(entry);return <tr key={entry.id} className={entry.voidedAt?'voided':undefined}>
     <td data-label="Дата">{entry.occurredOn}</td>
     <td data-label="Вид"><span className="acc-kind">{kinds[entry.kind]?.ru??entry.kind}{auto&&<Badge tone="auto"><Bot size={12} aria-hidden="true"/>авто</Badge>}{isBankEntry(entry)&&<Badge tone="bank">выписка</Badge>}</span>{entry.note&&<small>{entry.note}</small>}{entry.voidedAt&&<small>Аннулировано {dateTime(entry.voidedAt)}: {entry.voidReason}</small>}</td>
     <td data-label="Сумма" className={direction==='in'?'num in':'num out'}><Amount value={direction==='in'?entry.amountUzs:-entry.amountUzs} plus/>{entry.originalAmount!==undefined&&<small>{entry.originalAmount} {entry.originalCurrency}</small>}</td>
     <td data-label="Заказ, контрагент">{entry.orderId?<a className="text-link" href={`/operations#${encodeURIComponent(entry.orderId)}`}>{entry.orderId}</a>:null}{entry.orderId&&entry.counterparty?', ':''}{entry.counterparty??''}{!entry.orderId&&!entry.counterparty?'—':''}</td>
     <td className="acc-actions">
      <button type="button" className="text-button" onClick={()=>setViewing(entry)}><Eye size={14} aria-hidden="true"/>Просмотр</button>
      {editable&&<><button type="button" className="text-button" onClick={()=>startFix(entry)}>Исправить</button><button type="button" className="text-button" onClick={()=>setVoiding(entry)}>Аннулировать</button></>}
      {canWrite&&!entry.voidedAt&&!editable&&<small>{auto?'запись движка':'период закрыт'}</small>}
     </td>
    </tr>})}</tbody></table></div>:<p className="micro" role="status">{books.entries.length?'По этим условиям записей нет.':'Записей за этот месяц нет.'}</p>}
   {paged.pages>1&&<nav className="acc-pager" aria-label="Страницы журнала"><button type="button" className="btn secondary" disabled={paged.page<=1} onClick={()=>setPage(paged.page-1)}>Назад</button><span>Страница {paged.page} из {paged.pages} · по {ledgerPageSize}</span><button type="button" className="btn secondary" disabled={paged.page>=paged.pages} onClick={()=>setPage(paged.page+1)}>Вперёд</button></nav>}
  </div>

  <ConfirmDialog open={!!voiding} title="Аннулировать запись?" description={voiding?`${voiding.occurredOn} · ${kinds[voiding.kind]?.ru} · ${money(voiding.amountUzs)}. Запись останется в журнале с пометкой и причиной; удалить её нельзя.`:''} confirmLabel="Аннулировать" reasonLabel="Причина аннулирования" reasonPlaceholder="например, продублирована" danger busy={busy} onClose={()=>setVoiding(null)}
   onConfirm={async reason=>{const entry=voiding;if(!entry)return;const ok=await run(()=>post({kind:'void',id:entry.id,reason}).then(()=>undefined),'Запись аннулирована.');if(ok)setVoiding(null)}}/>

  <Modal open={!!viewing} onClose={()=>setViewing(null)} title={viewing?`Запись ${viewing.id.slice(0,16)}…`:'Запись'} description={viewing&&isAutoEntry(viewing)?'Запись создал движок бухгалтерии по событию заказа; она следует за заказом сама, вручную её не правят.':viewing&&isBankEntry(viewing)?'Запись подтверждена из выписки банка; её можно исправить или аннулировать, пока месяц открыт.':'Подробности записи журнала.'}>
   {viewing&&<dl className="acc-details">
    <div><dt>Вид</dt><dd>{kinds[viewing.kind]?.ru} · {groupNames[kinds[viewing.kind]?.group??'expense'].split(' (')[0]}</dd></div>
    <div><dt>Дата</dt><dd>{viewing.occurredOn}</dd></div>
    <div><dt>Сумма</dt><dd><Amount value={entryDirection(viewing)==='in'?viewing.amountUzs:-viewing.amountUzs} plus/>{viewing.originalAmount!==undefined?` (${viewing.originalAmount} ${viewing.originalCurrency})`:''}</dd></div>
    {viewing.orderId&&<div><dt>Заказ</dt><dd><a className="text-link" href={`/operations#${encodeURIComponent(viewing.orderId)}`}>{viewing.orderId}</a></dd></div>}
    {viewing.counterparty&&<div><dt>Контрагент</dt><dd>{viewing.counterparty}</dd></div>}
    {viewing.note&&<div><dt>Комментарий</dt><dd>{viewing.note}</dd></div>}
    {viewing.reference&&<div><dt>Ссылка</dt><dd>{viewing.reference}</dd></div>}
    <div><dt>Источник</dt><dd>{entrySourceLabel(viewing)} · {viewing.createdBy}</dd></div>
    <div><dt>Создана</dt><dd>{dateTime(viewing.createdAt)}</dd></div>
    {viewing.voidedAt&&<div><dt>Аннулирована</dt><dd>{dateTime(viewing.voidedAt)} — {viewing.voidReason}</dd></div>}
    <div><dt>Идентификатор</dt><dd className="acc-mono">{viewing.id}</dd></div>
   </dl>}
   <div className="acc-dialog-actions"><button type="button" className="btn secondary" onClick={()=>setViewing(null)}>Закрыть</button></div>
  </Modal>
 </div>;
}
