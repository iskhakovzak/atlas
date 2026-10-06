'use client';

import {useEffect,useId,useState,type ReactNode} from 'react';
import type {LucideIcon} from 'lucide-react';
import {formatSum} from '@/lib/market/home-copy';
import {Modal} from './market-ui';
import {ledgerKinds,type AccountingSettings,type LedgerKind,type MonthSummary,type Obligations,type OrderFinance,type YearSummary} from '@/lib/market/finance';
import {groupNames,kindsOfGroup,type LedgerEntryView} from './accounting-helpers';

/** GET /api/finance?month=… as the engine returns it today, plus the optional fields of the contract still being written (lib/market/finance-api.md). */
export type Kinds=Record<LedgerKind,{direction:'in'|'out';group:'transit'|'expense'|'income'|'tax';ru:string}>;
export type MonthBooks={month:string;summary:MonthSummary;entries:LedgerEntryView[];orders:OrderFinance[];orderEntries:LedgerEntryView[];stages:Record<string,string>;obligations:Obligations;settings:AccountingSettings;kinds:Kinds;locked:boolean;
 /** From the engine (finance-api.md): the tariff rate and the ledger rates, the cash position since 1 January, the reconcile report (only with &check=1). */
 fx?:{usd:number;cbuRate?:number;markup:number;source:string;updatedAt?:number;rates:Record<string,number>};cash?:unknown;reconcile?:unknown;warnings?:unknown;positions?:unknown;closings?:unknown};
export type YearBooks={year:number;summary:YearSummary;settings:AccountingSettings;taxCalendar?:unknown;cash?:unknown};
/** What every accounting tab receives from the shell (app/accounting-view.tsx). */
export type AccountingContext={
 books:MonthBooks;yearBooks:YearBooks|null;month:string;setMonth:(month:string)=>void;usdRate:number;
 canWrite:boolean;isAdmin:boolean;canBackup:boolean;busy:boolean;
 /** Runs one write, shows the toast, reloads the books; swallows and reports failures. */
 run:(work:()=>Promise<void>,done?:string)=>Promise<boolean>;
 reload:()=>Promise<void>;
};

export const money=(value:number)=>formatSum(value,'ru');
/** A soum amount with a sign: negatives in a muted red, positives optionally with "+". */
export function Amount({value,plus=false,className=''}:{value:number;plus?:boolean;className?:string}){
 const negative=value<0;
 return <span className={`acc-amount${negative?' acc-negative':''}${className?' '+className:''}`}>{negative?'−':plus&&value>0?'+':''}{money(Math.abs(value))}</span>;
}

export const statusNames={pending:'Ожидает оплаты',paid:'Оплачен',refunded:'Возвращён',cancelled:'Отменён'} as const;
export const stageNames=['Ожидает выкупа','Выкуплен','На зарубежном складе','Готов к отправке','В пути','Доставлен'];
export const currencies=['USD','EUR','GBP','CNY','RUB','KZT','TRY','AED'];
export const dateTime=(at:number)=>new Date(at).toLocaleString('ru-RU',{timeZone:'Asia/Tashkent',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});

// ----- API -----
export const post=(body:unknown)=>fetch('/api/finance',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)}).then(async response=>{const data=await response.json().catch(()=>({})) as {error?:string};if(!response.ok)throw Error(data.error??(response.status===403?'Нет права на запись в бухгалтерии.':response.status===409?'Период закрыт или данные изменились — обновите страницу.':'Не удалось сохранить.'));return data});
export const load=async<T,>(query:string)=>{const response=await fetch('/api/finance?'+query,{credentials:'same-origin',cache:'no-store'});const data=await response.json().catch(()=>({})) as T&{error?:string};if(!response.ok)throw Error(data.error??(response.status===403?'Нет доступа к бухгалтерии.':'Не удалось загрузить бухгалтерию.'));return data};
/** Downloads a text blob from the browser (JSON backup of the loaded month). */
export function downloadText(name:string,text:string,type='application/json'){
 const url=URL.createObjectURL(new Blob([text],{type}));const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// ----- small UI pieces -----
export function KindSelect({value,onChange,kinds,allowEmpty=false,label='Вид',id,hideLabel=false}:{value:string;onChange:(kind:string)=>void;kinds:Kinds;allowEmpty?:boolean;label?:string;id?:string;hideLabel?:boolean}){
 return <label className="field acc-inline"><span className={hideLabel?'sr-only':undefined}>{label}</span><select id={id} value={value} onChange={event=>onChange(event.target.value)}>
  {allowEmpty&&<option value="">Все виды</option>}
  {(Object.keys(groupNames) as (keyof typeof groupNames)[]).map(group=><optgroup key={group} label={groupNames[group]}>{kindsOfGroup(group).map(kind=><option key={kind} value={kind}>{kinds[kind]?.ru??ledgerKinds[kind].ru}</option>)}</optgroup>)}
 </select></label>;
}
export function Badge({tone='neutral',children}:{tone?:'neutral'|'ok'|'warn'|'error'|'auto'|'bank';children:ReactNode}){return <span className={`acc-badge acc-badge-${tone}${tone==='bank'?' acc-badge-auto':''}`}>{children}</span>}
/** A KPI card: a muted label with an optional icon, the value in one line, a one-line note pinned to the bottom (hover shows the full text). */
export function Kpi({label,value,note,icon:Icon,loss=false}:{label:ReactNode;value:ReactNode;note?:ReactNode;icon?:LucideIcon;loss?:boolean}){
 return <article className={loss?'acc-kpi loss':'acc-kpi'}>
  <span className="acc-kpi-label"><span>{label}</span>{Icon&&<Icon size={18} aria-hidden="true"/>}</span>
  <strong>{value}</strong>
  {note!==undefined&&note!==''&&<small title={typeof note==='string'?note:undefined}>{note}</small>}
 </article>;
}
/** A label/value fact in an even grid (.acc-facts): the month summary, the income breakdown. */
export function Fact({label,children}:{label:ReactNode;children:ReactNode}){return <div className="acc-fact"><dt>{label}</dt><dd>{children}</dd></div>}
export function Status({children}:{children:ReactNode}){return <p className="micro acc-status" role="status">{children}</p>}
export function Alert({children}:{children:ReactNode}){return <p className="notice error" role="alert">{children}</p>}

/** A sparkline of 12 monthly values (no library); the title carries the numbers for screen readers. */
export function Spark({values,labels,title,tone='income'}:{values:number[];labels:string[];title:string;tone?:'income'|'profit'|'expense'}){
 const width=320,height=56,pad=4;
 const min=Math.min(0,...values),max=Math.max(0,...values),span=max-min||1;
 const stepX=values.length>1?(width-pad*2)/(values.length-1):0;
 const points=values.map((value,index)=>({x:Math.round((pad+index*stepX)*100)/100,y:Math.round((height-pad-((value-min)/span)*(height-pad*2))*100)/100}));
 const path=points.map((point,index)=>`${index?'L':'M'}${point.x} ${point.y}`).join(' ');
 const zeroY=Math.round((height-pad-((0-min)/span)*(height-pad*2))*100)/100;
 const area=points.length>1?`${path} L${points[points.length-1].x} ${zeroY} L${points[0].x} ${zeroY} Z`:'';
 const last=values[values.length-1]??0;
 return <figure className={`acc-spark acc-spark-${tone}`}>
  <figcaption><span>{title}</span><strong><Amount value={last}/></strong></figcaption>
  <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} по месяцам: `+values.map((value,index)=>`${labels[index]} ${money(value)}`).join(', ')} preserveAspectRatio="none">
   {area&&<path className="acc-spark-area" d={area}/>}
   <line className="acc-spark-zero" x1={pad} x2={width-pad} y1={zeroY} y2={zeroY}/>
   {path&&<path className="acc-spark-line" d={path}/>}
  </svg>
 </figure>;
}

/**
 * Confirmation without window.confirm/prompt: a Modal with the question, an optional reason field (minimum 3
 * characters, goes to the audit log) and the confirm button. `danger` paints the confirm button as a warning.
 */
export function ConfirmDialog({open,title,description,confirmLabel,reasonLabel,reasonPlaceholder,danger=false,busy=false,onConfirm,onClose,children}:{open:boolean;title:string;description:string;confirmLabel:string;reasonLabel?:string;reasonPlaceholder?:string;danger?:boolean;busy?:boolean;onConfirm:(reason:string)=>void|Promise<void>;onClose:()=>void;children?:ReactNode}){
 const [reason,setReason]=useState(''),[touched,setTouched]=useState(false);
 const id=useId();
 useEffect(()=>{if(!open){queueMicrotask(()=>{setReason('');setTouched(false)})}},[open]);
 const invalid=!!reasonLabel&&reason.trim().length<3;
 return <Modal open={open} onClose={onClose} title={title} description={description}>
  <form className="acc-dialog" onSubmit={event=>{event.preventDefault();setTouched(true);if(invalid)return;void onConfirm(reason.trim())}}>
   {children}
   {reasonLabel&&<label className="field"><span>{reasonLabel}</span><input id={`${id}-reason`} value={reason} placeholder={reasonPlaceholder} minLength={3} maxLength={300} onChange={event=>setReason(event.target.value)} onBlur={()=>setTouched(true)} aria-invalid={touched&&invalid?true:undefined} aria-describedby={touched&&invalid?`${id}-reason-error`:undefined}/>{touched&&invalid&&<small id={`${id}-reason-error`} className="acc-field-error">Укажите причину — от 3 символов. Она попадёт в аудит.</small>}</label>}
   <div className="acc-dialog-actions">
    <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>Отмена</button>
    <button type="submit" className={danger?'btn primary acc-danger':'btn primary'} disabled={busy||invalid}>{confirmLabel}</button>
   </div>
  </form>
 </Modal>;
}
