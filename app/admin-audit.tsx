"use client";
// Admin → Журнал: server-side filters and pages (GET /api/operations?audit=1…), CSV export and event details.
import {useCallback,useEffect,useState} from "react";
import {Download,History} from "lucide-react";
import {auditDetails} from "@/lib/market/admin-dashboard";
import {dateTime,downloadCsv,getOperations,type AuditEvent} from "./admin-shared";

type Page={audit:AuditEvent[];total:number;page:number;pages:number;pageSize:number;facets:{actors:string[];entities:string[]}};
const entityLabels:Record<string,string>={order:'Заказы',catalog:'Каталог',settings:'Тарифы и правила',staff:'Команда',customer:'Клиенты',system:'Система',accounting:'Бухгалтерия',ledger:'Журнал денег',content:'Контент сайта'};
const folders=['all','order','catalog','settings','staff','customer','system'];

export function AdminAudit(){
 const [filter,setFilter]=useState({entity:'all',actor:'all',from:'',to:'',q:''}),[page,setPage]=useState(1),[result,setResult]=useState<Page|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const query=useCallback((current:typeof filter,pageNumber:number)=>{const params=new URLSearchParams({audit:'1',page:String(pageNumber)});if(current.entity!=='all')params.set('entity',current.entity);if(current.actor!=='all')params.set('actor',current.actor);if(current.from)params.set('from',current.from);if(current.to)params.set('to',current.to);if(current.q.trim())params.set('q',current.q.trim());return params.toString()},[]);
 // The request starts in a timer (debounced while typing), so no state is set synchronously inside the effect.
 useEffect(()=>{let cancelled=false;const timer=setTimeout(()=>{setLoading(true);setError('');getOperations<Page>(query(filter,page)).then(next=>{if(!cancelled){setResult(next)}}).catch(failure=>{if(!cancelled)setError((failure as Error).message)}).finally(()=>{if(!cancelled)setLoading(false)})},filter.q?250:0);return()=>{cancelled=true;clearTimeout(timer)}},[filter,page,query]);
 const update=(patch:Partial<typeof filter>)=>{setFilter(current=>({...current,...patch}));setPage(1)};
 const entities=[...new Set([...folders.slice(1),...(result?.facets.entities??[])])];
 return <section className="surface admin-section admin-audit">
  <div className="admin-section-head"><div><h2>Журнал действий</h2><p>Действия сотрудников и системных процессов. Фильтры и страницы считает сервер; записи не удаляются.</p></div><div className="admin-system-actions"><button type="button" className="btn secondary" onClick={()=>downloadCsv(query(filter,1).replace('audit=1','audit=csv'))}><Download size={17}/>CSV по фильтру</button></div></div>
  <nav className="audit-folders" aria-label="Группы действий">{['all',...entities].map(id=><button type="button" key={id} aria-pressed={filter.entity===id} className={filter.entity===id?'active':''} onClick={()=>update({entity:id})}>{id==='all'?'Все действия':entityLabels[id]??id}</button>)}</nav>
  <div className="audit-filters admin-audit-filters">
   <label className="field"><span>Автор</span><select value={filter.actor} onChange={event=>update({actor:event.target.value})}><option value="all">Все авторы</option>{(result?.facets.actors??[]).map(actor=><option key={actor} value={actor}>{actor}</option>)}</select></label>
   <label className="field"><span>Поиск</span><input type="search" placeholder="Действие, email, ID или текст деталей" value={filter.q} onChange={event=>update({q:event.target.value})}/></label>
   <label className="field"><span>С даты</span><input type="date" value={filter.from} max={filter.to||undefined} onChange={event=>update({from:event.target.value})}/></label>
   <label className="field"><span>По дату</span><input type="date" value={filter.to} min={filter.from||undefined} onChange={event=>update({to:event.target.value})}/></label>
  </div>
  {error&&<p className="notice error" role="alert">{error}</p>}
  <p className="micro admin-filter-count" aria-live="polite">{loading?'Загружаем…':result?`${result.total} событий · страница ${result.page} из ${result.pages}`:''}</p>
  {result?.audit.length?<div className="audit-list admin-audit-list">{result.audit.map(event=><AuditRow key={event.id} event={event}/>)}</div>:!loading&&<div className="admin-empty"><History/><h3>Ничего не найдено</h3><p>Поменяйте группу, автора, даты или поисковый запрос.</p></div>}
  {result&&result.pages>1&&<nav className="admin-pager" aria-label="Страницы журнала"><button type="button" className="btn secondary" disabled={result.page<=1||loading} onClick={()=>setPage(result.page-1)}>Назад</button><span>{result.page} / {result.pages}</span><button type="button" className="btn secondary" disabled={result.page>=result.pages||loading} onClick={()=>setPage(result.page+1)}>Дальше</button></nav>}
 </section>;
}

function AuditRow({event}:{event:AuditEvent}){
 const details=auditDetails(event);
 return <details className="admin-audit-row"><summary><div><b>{event.action}</b><span>{entityLabels[event.entityType]??event.entityType}{event.entityId?' · '+event.entityId:''}</span></div><div><span>{event.actorEmail}</span><time dateTime={new Date(event.createdAt).toISOString()}>{dateTime(event.createdAt)}</time></div></summary>
  {details.pretty?<div className="admin-audit-details">{details.fields.length?<dl>{details.fields.map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>:<pre>{details.pretty}</pre>}</div>:<p className="micro">Без деталей.</p>}
 </details>;
}
