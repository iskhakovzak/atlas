'use client';

import {useCallback,useMemo,useState,type ChangeEvent} from 'react';
import {FileUp,ListChecks} from 'lucide-react';
import {convertToUzs,type LedgerKind} from '@/lib/market/finance';
import {Amount,Badge,ConfirmDialog,KindSelect,money,post,type AccountingContext} from './accounting-shared';
import {matchStatement,mergeBankProposals,parseBankCsv,plural,type StatementMatch,type StatementParse} from './accounting-helpers';

type Override={kind?:LedgerKind;orderId?:string;counterparty?:string;note?:string};
const statusCopy={recorded:'уже в журнале',order:'похоже на оплату заказа',new:'новая запись'} as const;
const maxFile=2*1024*1024;

/** Выписка: a bank CSV → matches against the ledger and the orders → the operator confirms the rows to record. */
export function AccountingStatement({ctx}:{ctx:AccountingContext}){
 const {books,usdRate,canWrite,isAdmin,busy,run}=ctx;
 const [text,setText]=useState(''),[fileName,setFileName]=useState(''),[readError,setReadError]=useState('');
 const [overrides,setOverrides]=useState<Record<string,Override>>({}),[selected,setSelected]=useState<Set<string>>(new Set()),[confirming,setConfirming]=useState(false),[result,setResult]=useState<{ok:number;failed:string[]}|null>(null);
 // The engine's own matching (POST bank-import: order numbers in the purpose, payments already recorded) — administrator only, nothing is written.
 const [proposals,setProposals]=useState<{csv:string;list:unknown;lines:number;errors:{row:number;reason:string}[]}|null>(null),[checking,setChecking]=useState(false),[checkError,setCheckError]=useState('');
 const parsed:StatementParse|null=useMemo(()=>text.trim()?parseBankCsv(text):null,[text]);
 const fxRates=books.settings.fxRates;
 const convert=useCallback((amount:number,currency:string)=>convertToUzs(amount,currency,usdRate,fxRates),[usdRate,fxRates]);
 const matches=useMemo(()=>{const own=parsed?matchStatement(parsed.rows,books.entries,books.orders,convert):[];return proposals&&proposals.csv===text?mergeBankProposals(own,proposals.list):own},[parsed,books.entries,books.orders,convert,proposals,text]);
 async function checkOnServer(csv:string){
  if(!isAdmin||!csv.trim())return;
  setChecking(true);setCheckError('');
  try{const data=await post({kind:'bank-import',csv:csv.slice(0,1_000_000)}) as {lines?:number;errors?:{row:number;reason:string}[];proposals?:unknown};setProposals({csv,list:data.proposals??[],lines:data.lines??0,errors:data.errors??[]})}
  catch(failure){setCheckError((failure as Error).message)}
  finally{setChecking(false)}
 }
 const draftOf=(match:StatementMatch)=>({...match.draft,...overrides[match.row.id]});
 const selectable=matches.filter(match=>match.status!=='recorded');
 const toggle=(id:string,on:boolean)=>setSelected(current=>{const next=new Set(current);if(on)next.add(id);else next.delete(id);return next});
 const reset=()=>{setText('');setFileName('');setOverrides({});setSelected(new Set());setResult(null);setReadError('');setProposals(null);setCheckError('')};
 async function readFile(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  if(file.size>maxFile){setReadError('Файл больше 2 МБ — выгрузите выписку за меньший период.');return}
  setReadError('');setResult(null);setSelected(new Set());setOverrides({});setFileName(file.name);
  const buffer=await file.arrayBuffer();
  let decoded=new TextDecoder('utf-8',{fatal:false}).decode(buffer);
  if(/�/.test(decoded))decoded=new TextDecoder('windows-1251').decode(buffer);
  setText(decoded);
  void checkOnServer(decoded);
 }
 const bankOrderId=/^AT-[0-9A-Z]{8,12}$/i;
 const drop=(ids:string[])=>setSelected(current=>{const next=new Set(current);for(const id of ids)next.delete(id);return next});
 async function confirmSelected(){
  const chosen=selectable.filter(match=>selected.has(match.row.id));
  const failed:string[]=[];let ok=0;
  const label=(match:StatementMatch)=>`${match.row.date} ${money(draftOf(match).amountUzs)}`;
  const valueOf=(match:StatementMatch)=>{const draft=draftOf(match);return {kind:draft.kind,amountUzs:Math.round(draft.amountUzs),occurredOn:draft.occurredOn,...(draft.originalAmount?{originalAmount:draft.originalAmount,originalCurrency:draft.originalCurrency}:{}),...(draft.orderId?{orderId:draft.orderId}:{}),...(draft.counterparty?{counterparty:draft.counterparty.slice(0,120)}:{}),note:(`Выписка${fileName?` ${fileName}`:''}: ${draft.note||match.row.description||'без назначения'}`).slice(0,500)}};
  // Customer payments with an order number go through bank-confirm (BANK-… ids, one audit event) when the administrator confirms; everything else is an ordinary entry.
  const viaBank=isAdmin?chosen.filter(match=>draftOf(match).kind==='customer_payment'&&bankOrderId.test(draftOf(match).orderId)):[];
  const viaEntry=chosen.filter(match=>!viaBank.includes(match));
  await run(async()=>{
   if(viaBank.length){
    try{await post({kind:'bank-confirm',entries:viaBank.map(valueOf)});ok+=viaBank.length;drop(viaBank.map(match=>match.row.id))}
    catch(failure){for(const match of viaBank)failed.push(`${label(match)}: ${(failure as Error).message}`)}
   }
   for(const match of viaEntry){
    try{await post({kind:'entry',value:valueOf(match)});ok++;drop([match.row.id])}catch(failure){failed.push(`${label(match)}: ${(failure as Error).message}`)}
   }
   setResult({ok,failed});
   if(failed.length)throw Error(`Записано ${ok} из ${chosen.length}; ${failed.length} не удалось — см. список ниже.`);
  },`Записано ${chosen.length} ${plural(chosen.length,['строка','строки','строк'])} выписки.`);
  setConfirming(false);
 }
 return <div className="acc-tab-body">
  <div className="acc-block">
   <div className="acc-block-head"><h4>Загрузить выписку банка</h4></div>
   <p className="micro">CSV из интернет-банка: колонки «дата», «сумма» (или «дебет»/«кредит»), «назначение», «контрагент» — разделитель и заголовок определяются автоматически. Строки сопоставляются с журналом (по сумме и дате ±5 дней) и с заказами (по номеру AT-… в назначении или по сумме к оплате). Ничего не записывается, пока вы не подтвердите выбранные строки.</p>
   <div className="acc-upload">
    <label className="btn secondary acc-file"><FileUp size={16} aria-hidden="true"/>{fileName?`Файл: ${fileName}`:'Выбрать CSV'}<input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={event=>void readFile(event)}/></label>
    {text&&<button type="button" className="btn secondary" onClick={reset}>Очистить</button>}
   </div>
   <label className="field"><span>Или вставьте строки выписки</span><textarea rows={4} value={text} placeholder={'Дата;Сумма;Назначение;Контрагент\n03.10.2026;-1 250 000;DHL Express счёт 123;DHL\n05.10.2026;2 480 000;Оплата заказа AT-1234ABCD;Клиент'} onChange={event=>{setText(event.target.value);setResult(null)}}/></label>
   {isAdmin&&text.trim()&&<div className="acc-toolbar"><button type="button" className="btn secondary acc-compact" disabled={checking||busy} onClick={()=>void checkOnServer(text)}>{checking?'Сверяем с сервером…':proposals&&proposals.csv===text?'Сверить с сервером ещё раз':'Сверить с сервером'}</button><span className="micro">{proposals&&proposals.csv===text?`Сервер разобрал ${proposals.lines} ${plural(proposals.lines,['строку','строки','строк'])}: номера заказов в назначении и уже записанные оплаты учтены.`:'Сервер найдёт номера заказов в назначении и уже записанные оплаты; ничего не запишет.'}</span></div>}
   {checking&&<p className="micro" role="status">Сверяем выписку с книгами…</p>}
   {checkError&&<p className="notice error" role="alert">Сверка на сервере не удалась: {checkError}. Ниже — сопоставление на клиенте.</p>}
   {readError&&<p className="notice error" role="alert">{readError}</p>}
   {parsed&&parsed.errors.length>0&&<div className="notice warning" role="alert"><b>Замечания при разборе</b><ul>{parsed.errors.map((error,index)=><li key={index}>{error}</li>)}</ul></div>}
   {proposals&&proposals.csv===text&&proposals.errors.length>0&&<div className="notice warning" role="status"><b>Замечания сервера</b><ul>{proposals.errors.slice(0,20).map((error,index)=><li key={index}>Строка {error.row}: {error.reason}</li>)}</ul></div>}
  </div>

  {parsed&&matches.length>0&&<div className="acc-block">
   <div className="acc-block-head"><h4>Сопоставление</h4><span className="micro">{matches.length} строк · уже в журнале: {matches.filter(match=>match.status==='recorded').length} · похожи на заказы: {matches.filter(match=>match.status==='order').length} · новых: {matches.filter(match=>match.status==='new').length}</span></div>
   {canWrite&&<div className="acc-toolbar"><button type="button" className="text-button" onClick={()=>setSelected(new Set(selectable.map(match=>match.row.id)))}>Выбрать все новые</button><button type="button" className="text-button" onClick={()=>setSelected(new Set())}>Снять выбор</button></div>}
   <div className="acc-scroll acc-cards-on-phone"><table className="accounting-table acc-statement-table">
    <thead><tr>{canWrite&&<th scope="col"><span className="sr-only">Выбрать</span></th>}<th scope="col">Дата</th><th scope="col" className="num">Сумма</th><th scope="col">Назначение</th><th scope="col">Сопоставление</th><th scope="col">Вид записи</th><th scope="col">Заказ</th></tr></thead>
    <tbody>{matches.map(match=>{const draft=draftOf(match);const id=match.row.id;const disabled=match.status==='recorded'||!canWrite;const rateMissing=match.row.currency!=='UZS'&&convert(1,match.row.currency)===null;return <tr key={id} className={match.status==='recorded'?'muted-row':undefined}>
     {canWrite&&<td data-label="Выбрать"><input type="checkbox" aria-label={`Записать строку ${match.row.date} ${money(draft.amountUzs)}`} disabled={disabled||rateMissing} checked={selected.has(id)} onChange={event=>toggle(id,event.target.checked)}/></td>}
     <td data-label="Дата">{match.row.date}</td>
     <td data-label="Сумма" className="num"><Amount value={match.row.amount>0?draft.amountUzs:-draft.amountUzs} plus/>{match.row.currency!=='UZS'&&<small>{match.row.amount} {match.row.currency}{rateMissing?' — курс не задан':''}</small>}</td>
     <td data-label="Назначение">{match.row.description||'—'}{match.row.counterparty&&<small>{match.row.counterparty}</small>}</td>
     <td data-label="Сопоставление"><Badge tone={match.status==='recorded'?'ok':match.status==='order'?'warn':'neutral'}>{statusCopy[match.status]}</Badge>{match.entry&&<small>{match.entry.occurredOn} · {books.kinds[match.entry.kind]?.ru}</small>}{match.order&&<small>{match.order.orderId} · к оплате {money(match.order.payable)}</small>}{match.serverNote&&<small>Сервер: {match.serverNote}</small>}</td>
     <td data-label="Вид записи">{disabled?<span>{books.kinds[draft.kind]?.ru}</span>:<KindSelect label={`Вид для строки ${match.row.date}`} hideLabel value={draft.kind} onChange={kind=>setOverrides({...overrides,[id]:{...overrides[id],kind:kind as LedgerKind}})} kinds={books.kinds}/>}</td>
     <td data-label="Заказ">{disabled?<span>{draft.orderId||'—'}</span>:<label className="field acc-inline"><span className="sr-only">Заказ для строки {match.row.date}</span><input placeholder="AT-…" value={draft.orderId} onChange={event=>setOverrides({...overrides,[id]:{...overrides[id],orderId:event.target.value.trim().toUpperCase()}})}/></label>}</td>
    </tr>})}</tbody></table></div>
   {canWrite&&<div className="acc-form-actions"><button type="button" className="btn primary" disabled={busy||!selected.size} onClick={()=>setConfirming(true)}><ListChecks size={16} aria-hidden="true"/>Записать выбранные ({selected.size})</button><span className="micro">Строки «уже в журнале» пропускаются. {isAdmin?'Оплаты заказов с номером AT-… записываются как «выписка» (BANK-…), остальные строки — обычными записями с пометкой «Выписка».':'Каждая строка станет обычной записью журнала с пометкой «Выписка».'}</span></div>}
   {result&&<div className={result.failed.length?'notice warning':'notice'} role="status"><b>Записано: {result.ok}</b>{result.failed.length>0&&<ul>{result.failed.map((line,index)=><li key={index}>{line}</li>)}</ul>}</div>}
  </div>}
  {parsed&&!matches.length&&!parsed.errors.length&&<p className="micro" role="status">В файле не нашлось строк с датой и суммой.</p>}

  <ConfirmDialog open={confirming} title={`Записать ${selected.size} ${plural(selected.size,['строку','строки','строк'])}?`} description="В журнал добавятся обычные записи с датой и суммой из выписки; вид и заказ — как выбрано в таблице. Записи можно будет исправить или аннулировать, пока месяц открыт." confirmLabel="Записать" busy={busy} onClose={()=>setConfirming(false)} onConfirm={()=>confirmSelected()}/>
 </div>;
}
