"use client";
// Admin → Клиенты: search, the table, CSV export (contacts and totals only) and the customer card with operator notes.
import {useEffect,useMemo,useState} from "react";
import Link from "@/components/site-link";
import {Download,Search,UserRound} from "lucide-react";
import { toast } from "@/lib/market/toast";
import {statuses} from "@/lib/market/domain";
import {customerRow,searchCustomers,type CustomerRow} from "@/lib/market/admin-dashboard";
import {Modal} from "./market-ui";
import {ago,customerStatusLabels,dateOnly,dateTime,downloadCsv,getOperations,money,postOperations,type AdminData,type CustomerNote,type CustomerStatus} from "./admin-shared";

type Card={customer:CustomerRow;revision:number;orders:Array<{id:string;status:number;cancelled:boolean;payable:number;createdAt:number;name:string;brand:string;payment:string|null;deliverySpeed:string}>;tickets:Array<{id:string;subject:string;status:string;updatedAt:number;replies:number}>;notes:CustomerNote[];recipients:Array<{recipient:string;city:string;phone:string}>;language:string};
const paymentLabels:Record<string,string>={pending:'ожидает отметки',paid:'отмечен оплаченным',refunded:'возврат'};

export function AdminCustomers({data,busy,canBlock,onStatus,initialCustomer}:{data:AdminData;busy:boolean;canBlock:boolean;onStatus:(accountId:string,status:CustomerStatus)=>Promise<void>;initialCustomer?:string}){
 const [query,setQuery]=useState(''),[statusFilter,setStatusFilter]=useState<'all'|CustomerStatus>('all'),[open,setOpen]=useState<string|null>(initialCustomer??null);
 const rows=useMemo(()=>searchCustomers(data.accounts,query).map(account=>customerRow(account,data.customerStatuses[account.id]??'active')).filter(row=>statusFilter==='all'||row.status===statusFilter).sort((a,b)=>b.updatedAt-a.updatedAt),[data,query,statusFilter]);
 // ?customer=<id> from an attention link opens the card; tracked during render (no effect), so a later manual close holds.
 const [seenCustomer,setSeenCustomer]=useState(initialCustomer);
 if(initialCustomer!==seenCustomer){setSeenCustomer(initialCustomer);if(initialCustomer)setOpen(initialCustomer)}
 return <section className="surface admin-section admin-customers">
  <div className="admin-section-head"><div><h2>Клиенты и доступ</h2><p>Поиск по имени, телефону, email или номеру заказа. Карточка открывает заказы, обращения и заметки операторов.</p></div><div className="admin-system-actions"><button type="button" className="btn secondary" onClick={()=>downloadCsv('customers=csv')}><Download size={17}/>Экспорт CSV</button></div></div>
  <div className="admin-filters">
   <label className="field"><span>Поиск</span><span className="admin-search"><Search size={16} aria-hidden="true"/><input type="search" placeholder="Имя, телефон, email, AT-…" value={query} onChange={event=>setQuery(event.target.value)}/></span></label>
   <label className="field"><span>Доступ</span><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value as 'all'|CustomerStatus)}><option value="all">Все</option><option value="active">Активные</option><option value="review">На проверке</option><option value="blocked">Заблокированные</option></select></label>
   <p className="micro admin-filter-count">{rows.length} из {data.accounts.length}</p>
  </div>
  <div className="admin-scroll"><table className="admin-grid"><thead><tr><th>Клиент</th><th className="num">Заказы</th><th className="num">К оплате</th><th className="num">Баланс</th><th className="num">Обращения</th><th>Доступ</th></tr></thead><tbody>
   {rows.map(row=><tr key={row.id}>
    <td><button type="button" className="admin-link" onClick={()=>setOpen(row.id)}><b>{row.name}</b><small>{row.email||row.phone||row.id}</small></button>{row.cartPriceChanges>0&&<i className="admin-flag">цена изменилась в корзине</i>}</td>
    <td className="num"><b>{row.orders}</b>{row.activeOrders?<small>{row.activeOrders} в работе</small>:null}</td>
    <td className="num">{money(row.payable)}</td>
    <td className="num">{money(row.balance)}</td>
    <td className="num">{row.openTickets}</td>
    <td className="admin-cell-control"><select aria-label={`Доступ ${row.name}`} disabled={busy} value={row.status} onChange={event=>void onStatus(row.id,event.target.value as CustomerStatus)}><option value="active">Активен</option><option value="review">На проверке</option><option value="blocked" disabled={!canBlock}>Заблокирован</option></select></td>
   </tr>)}
   {!rows.length&&<tr><td colSpan={6} className="micro">Никого не найдено.</td></tr>}
  </tbody></table></div>
  <p className="micro">Экспорт содержит контакты и суммы; паспортные данные и адреса не выгружаются. «Заблокирован» ставит только администратор.</p>
  <CustomerCard key={open??'none'} id={open} busy={busy} canBlock={canBlock} onClose={()=>setOpen(null)} onStatus={onStatus} status={open?data.customerStatuses[open]??'active':'active'}/>
 </section>;
}

function CustomerCard({id,busy,canBlock,onClose,onStatus,status}:{id:string|null;busy:boolean;canBlock:boolean;onClose:()=>void;onStatus:(accountId:string,status:CustomerStatus)=>Promise<void>;status:CustomerStatus}){
 const [card,setCard]=useState<Card|null>(null),[error,setError]=useState(''),[note,setNote]=useState(''),[saving,setSaving]=useState(false);
 // The parent keys this component by `id`, so every card starts empty; the effect only runs the request.
 useEffect(()=>{if(!id)return;let cancelled=false;getOperations<Card>(`customer=${encodeURIComponent(id)}`).then(next=>{if(!cancelled)setCard(next)}).catch(failure=>{if(!cancelled)setError((failure as Error).message)});return()=>{cancelled=true}},[id]);
 async function addNote(){if(!id||!note.trim())return;setSaving(true);try{const next=await postOperations<{notes:CustomerNote[]}>({kind:'customer-note',accountId:id,text:note.trim()});setCard(current=>current?{...current,notes:next.notes}:current);setNote('');toast.success('Заметка сохранена и записана в журнал.')}catch(failure){toast.error((failure as Error).message)}finally{setSaving(false)}}
 const customer=card?.customer;
 return <Modal open={!!id} onClose={onClose} title={customer?.name??'Клиент'} description={customer?[customer.email,customer.phone].filter(Boolean).join(' · ')||customer.id:'Загружаем карточку…'}>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {card&&customer&&<div className="admin-card">
   <div className="admin-card-facts">
    <div><span>Заказов</span><b>{customer.orders}</b></div><div><span>К оплате</span><b>{money(customer.payable)}</b></div><div><span>Баланс</span><b>{money(customer.balance)}</b></div><div><span>Открытых обращений</span><b>{customer.openTickets}</b></div><div><span>Язык</span><b>{card.language}</b></div><div><span>Первый заказ</span><b>{dateOnly(customer.createdAt)}</b></div>
   </div>
   <label className="field admin-card-status"><span>Доступ</span><select disabled={busy} value={status} onChange={event=>void onStatus(customer.id,event.target.value as CustomerStatus)}><option value="active">{customerStatusLabels.active}</option><option value="review">{customerStatusLabels.review}</option><option value="blocked" disabled={!canBlock}>{customerStatusLabels.blocked}</option></select></label>
   {card.recipients.length>0&&<p className="micro">Получатели: {card.recipients.map(item=>`${item.recipient}${item.city?` (${item.city})`:''}`).join(', ')}. Полные адреса и документы в карточке не показываются.</p>}
   <h3>Заказы</h3>
   {card.orders.length?<div className="admin-scroll"><table className="admin-grid"><thead><tr><th>Заказ</th><th>Товар</th><th>Этап</th><th className="num">К оплате</th><th>Оплата</th><th className="num">Создан</th></tr></thead><tbody>{card.orders.map(order=><tr key={order.id} className={order.cancelled?'muted':''}><td><Link href={`/operations#${encodeURIComponent(order.id)}`}>{order.id}</Link></td><td>{order.brand} · {order.name}</td><td>{order.cancelled?'Отменён':statuses[order.status]}</td><td className="num">{money(order.payable)}</td><td>{order.payment?paymentLabels[order.payment]??order.payment:'нет записи'}</td><td className="num">{dateOnly(order.createdAt)}</td></tr>)}</tbody></table></div>:<p className="micro">Заказов ещё нет.</p>}
   <h3>Обращения</h3>
   {card.tickets.length?<ul className="admin-plain-list">{card.tickets.map(ticket=><li key={ticket.id}><b>{ticket.subject}</b><span>{ticket.status==='open'?'ждёт ответа':ticket.status==='answered'?'отвечено':'закрыто'} · {ticket.replies} сообщений · {ago(ticket.updatedAt)}</span></li>)}</ul>:<p className="micro">Обращений нет.</p>}
   <h3><UserRound size={16} aria-hidden="true"/> Заметки операторов</h3>
   <ul className="admin-plain-list admin-notes">{card.notes.map(item=><li key={item.id}><span>{item.text}</span><small>{item.authorEmail} · {dateTime(item.createdAt)}</small></li>)}{!card.notes.length&&<li className="micro">Заметок пока нет. Они видны только сотрудникам и записываются в журнал.</li>}</ul>
   <form className="admin-note-form" onSubmit={event=>{event.preventDefault();void addNote()}}><label className="field" htmlFor="customer-note"><span>Новая заметка</span><textarea id="customer-note" rows={3} maxLength={1000} value={note} onChange={event=>setNote(event.target.value)} placeholder="Что важно знать о клиенте: договорённости, особенности доставки…"/></label><button type="submit" className="btn primary" disabled={saving||!note.trim()}>{saving?'Сохраняем…':'Добавить заметку'}</button></form>
  </div>}
 </Modal>;
}
