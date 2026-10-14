"use client";
// Admin → Клиенты: search, the table, CSV export (contacts and totals only) and the customer card with operator notes.
import {useEffect,useMemo,useState} from "react";
import Link from "@/components/site-link";
import {Download,Search,UserRound} from "lucide-react";
import { toast } from "@/lib/market/toast";
import {localizedStatuses} from "@/lib/market/i18n";
import {customerRow,searchCustomers,type CustomerRow} from "@/lib/market/admin-dashboard";
import {useMarket} from "@/lib/market/store";
import {pickLocale} from "@/lib/market/uz-cyrl";
import {agoLocalized} from "@/lib/market/relative-time";
import {Modal} from "./market-ui";
import {customerStatusLabelsFor,dateOnly,dateTime,downloadCsv,getOperations,money,postOperations,type AdminData,type CustomerNote,type CustomerStatus} from "./admin-shared";

type Card={customer:CustomerRow;revision:number;orders:Array<{id:string;status:number;cancelled:boolean;payable:number;createdAt:number;name:string;brand:string;payment:string|null;deliverySpeed:string}>;tickets:Array<{id:string;subject:string;status:string;updatedAt:number;replies:number}>;notes:CustomerNote[];recipients:Array<{recipient:string;city:string;phone:string}>;language:string};
type StatusFilter='all'|CustomerStatus|'cart';
// Closing access or sending a customer for review asks first: both stop checkout (app/api/actions) and land in the log.
const confirmCopy={
 ru:{blocked:(name:string)=>`Закрыть доступ ${name}?`,blockedText:'Клиент не сможет оформлять заказы, пока вы не вернёте доступ. Действие запишется в журнал.',review:(name:string)=>`Отправить ${name} на проверку?`,reviewText:'Пока клиент на проверке, он не сможет оформлять и оплачивать заказы. Действие запишется в журнал.',confirm:'Подтвердить',cancel:'Отмена',cart:'Корзина',cartFilter:'С корзиной без заказа'},
 uz:{blocked:(name:string)=>`${name} uchun kirish yopilsinmi?`,blockedText:'Siz qaytarmaguningizcha mijoz buyurtma bera olmaydi. Amal jurnalga yoziladi.',review:(name:string)=>`${name} tekshiruvga yuborilsinmi?`,reviewText:'Tekshiruv davomida mijoz buyurtma bera olmaydi va to‘lay olmaydi. Amal jurnalga yoziladi.',confirm:'Tasdiqlash',cancel:'Bekor qilish',cart:'Savat',cartFilter:'Savati bor, buyurtmasi yo‘q'},
 en:{blocked:(name:string)=>`Close access for ${name}?`,blockedText:'The customer can’t place orders until you restore access. The action is logged.',review:(name:string)=>`Send ${name} for review?`,reviewText:'While under review, the customer can’t place or pay for orders. The action is logged.',confirm:'Confirm',cancel:'Cancel',cart:'Cart',cartFilter:'Cart without an order'},
};
// The table and the customer card in the screen language; customer data (names, notes, item names) stays as entered.
const customersCopy={
 ru:{title:'Клиенты и доступ',intro:'Поиск по имени, телефону, email или номеру заказа. Карточка открывает заказы, обращения и заметки операторов.',exportCsv:'Экспорт CSV',search:'Поиск',searchPlaceholder:'Имя, телефон, email, AT-…',access:'Доступ',all:'Все',activeMany:'Активные',reviewMany:'На проверке',blockedMany:'Заблокированные',shown:(n:number,all:number)=>n+' из '+all,
  customer:'Клиент',orders:'Заказы',payable:'К оплате',balance:'Баланс',tickets:'Обращения',priceChanged:'цена изменилась в корзине',inWork:(n:number)=>n+' в работе',accessFor:(name:string)=>'Доступ '+name,nobody:'Никого не найдено.',
  exportNote:'Экспорт содержит контакты и суммы; паспортные данные и адреса не выгружаются. «Заблокирован» ставит только администратор.',
  cardFallback:'Клиент',cardLoading:'Загружаем карточку…',ordersCount:'Заказов',openTickets:'Открытых обращений',language:'Язык',firstOrder:'Первый заказ',
  recipients:(list:string)=>'Получатели: '+list+'. Полные адреса и документы в карточке не показываются.',order:'Заказ',item:'Товар',stage:'Этап',payment:'Оплата',created:'Создан',cancelled:'Отменён',
  paymentLabels:{pending:'ожидает отметки',paid:'отмечен оплаченным',refunded:'возврат'} as Record<string,string>,noRecord:'нет записи',noOrders:'Заказов ещё нет.',
  ticketStatus:{open:'ждёт ответа',answered:'отвечено',closed:'закрыто'} as Record<string,string>,messages:(n:number)=>{const t=n%100,l=n%10;return n+' '+(t>=11&&t<=14?'сообщений':l===1?'сообщение':l>=2&&l<=4?'сообщения':'сообщений')},noTickets:'Обращений нет.',
  notes:'Заметки операторов',noNotes:'Заметок пока нет. Они видны только сотрудникам и записываются в журнал.',newNote:'Новая заметка',notePlaceholder:'Что важно знать о клиенте: договорённости, особенности доставки…',saving:'Сохраняем…',addNote:'Добавить заметку',noteSaved:'Заметка сохранена и записана в журнал.'},
 uz:{title:'Mijozlar va ruxsat',intro:'Ism, telefon, email yoki buyurtma raqami bo‘yicha qidiruv. Karta buyurtmalar, murojaatlar va operator qaydlarini ochadi.',exportCsv:'CSV eksport',search:'Qidiruv',searchPlaceholder:'Ism, telefon, email, AT-…',access:'Ruxsat',all:'Hammasi',activeMany:'Faollar',reviewMany:'Tekshiruvda',blockedMany:'Bloklanganlar',shown:(n:number,all:number)=>all+' tadan '+n+' ta',
  customer:'Mijoz',orders:'Buyurtmalar',payable:'To‘lovga',balance:'Balans',tickets:'Murojaatlar',priceChanged:'savatda narx o‘zgardi',inWork:(n:number)=>n+' ta jarayonda',accessFor:(name:string)=>name+': ruxsat',nobody:'Hech kim topilmadi.',
  exportNote:'Eksportda kontaktlar va summalar bor; pasport ma’lumotlari va manzillar chiqarilmaydi. «Bloklangan» holatini faqat administrator qo‘yadi.',
  cardFallback:'Mijoz',cardLoading:'Karta yuklanmoqda…',ordersCount:'Buyurtmalar',openTickets:'Ochiq murojaatlar',language:'Til',firstOrder:'Birinchi buyurtma',
  recipients:(list:string)=>'Qabul qiluvchilar: '+list+'. To‘liq manzillar va hujjatlar kartada ko‘rsatilmaydi.',order:'Buyurtma',item:'Tovar',stage:'Bosqich',payment:'To‘lov',created:'Yaratilgan',cancelled:'Bekor qilingan',
  paymentLabels:{pending:'belgi kutilmoqda',paid:'to‘langan deb belgilangan',refunded:'qaytarilgan'} as Record<string,string>,noRecord:'yozuv yo‘q',noOrders:'Hali buyurtmalar yo‘q.',
  ticketStatus:{open:'javob kutmoqda',answered:'javob berilgan',closed:'yopilgan'} as Record<string,string>,messages:(n:number)=>n+' ta xabar',noTickets:'Murojaatlar yo‘q.',
  notes:'Operator qaydlari',noNotes:'Hozircha qaydlar yo‘q. Ularni faqat xodimlar ko‘radi, har biri jurnalga yoziladi.',newNote:'Yangi qayd',notePlaceholder:'Mijoz haqida muhim narsalar: kelishuvlar, yetkazib berish xususiyatlari…',saving:'Saqlanmoqda…',addNote:'Qayd qo‘shish',noteSaved:'Qayd saqlandi va jurnalga yozildi.'},
 en:{title:'Customers and access',intro:'Search by name, phone, email or order number. The card opens orders, requests and operator notes.',exportCsv:'Export CSV',search:'Search',searchPlaceholder:'Name, phone, email, AT-…',access:'Access',all:'All',activeMany:'Active',reviewMany:'Under review',blockedMany:'Blocked',shown:(n:number,all:number)=>n+' of '+all,
  customer:'Customer',orders:'Orders',payable:'Payable',balance:'Balance',tickets:'Requests',priceChanged:'price changed in cart',inWork:(n:number)=>n+' in progress',accessFor:(name:string)=>'Access for '+name,nobody:'No one found.',
  exportNote:'The export holds contacts and totals; passport data and addresses are not exported. Only the administrator sets “Blocked”.',
  cardFallback:'Customer',cardLoading:'Loading the card…',ordersCount:'Orders',openTickets:'Open requests',language:'Language',firstOrder:'First order',
  recipients:(list:string)=>'Recipients: '+list+'. Full addresses and documents are not shown in the card.',order:'Order',item:'Item',stage:'Stage',payment:'Payment',created:'Created',cancelled:'Cancelled',
  paymentLabels:{pending:'awaiting a mark',paid:'marked paid',refunded:'refunded'} as Record<string,string>,noRecord:'no record',noOrders:'No orders yet.',
  ticketStatus:{open:'awaiting reply',answered:'answered',closed:'closed'} as Record<string,string>,messages:(n:number)=>n+' '+(n===1?'message':'messages'),noTickets:'No requests.',
  notes:'Operator notes',noNotes:'No notes yet. Only staff see them, and each one is logged.',newNote:'New note',notePlaceholder:'What matters about the customer: agreements, delivery details…',saving:'Saving…',addNote:'Add note',noteSaved:'Note saved and logged.'},
};

export function AdminCustomers({data,busy,canBlock,onStatus,initialCustomer}:{data:AdminData;busy:boolean;canBlock:boolean;onStatus:(accountId:string,status:CustomerStatus)=>Promise<void>;initialCustomer?:string}){
 const {state}=useMarket(),lang=state.communication.language,k=pickLocale(confirmCopy,lang),t=pickLocale(customersCopy,lang),statusLabels=customerStatusLabelsFor(lang);
 const [query,setQuery]=useState(''),[statusFilter,setStatusFilter]=useState<StatusFilter>('all'),[open,setOpen]=useState<string|null>(initialCustomer??null);
 const rows=useMemo(()=>searchCustomers(data.accounts,query).map(account=>customerRow(account,data.customerStatuses[account.id]??'active')).filter(row=>statusFilter==='all'||(statusFilter==='cart'?row.cartLines>0&&row.orders===0:row.status===statusFilter)).sort((a,b)=>b.updatedAt-a.updatedAt),[data,query,statusFilter]);
 // "Active" applies at once; "review" and "blocked" wait for the confirmation below (the select keeps the saved value until then).
 const [pendingStatus,setPendingStatus]=useState<{id:string;name:string;status:'review'|'blocked'}|null>(null);
 const requestStatus=async(accountId:string,status:CustomerStatus)=>{
  if(status==='active')return onStatus(accountId,status);
  const account=data.accounts.find(item=>item.id===accountId);
  setPendingStatus({id:accountId,name:account?customerRow(account).name:accountId,status});
 };
 // ?customer=<id> from an attention link opens the card; tracked during render (no effect), so a later manual close holds.
 const [seenCustomer,setSeenCustomer]=useState(initialCustomer);
 if(initialCustomer!==seenCustomer){setSeenCustomer(initialCustomer);if(initialCustomer)setOpen(initialCustomer)}
 return <section className="surface admin-section admin-customers">
  <div className="admin-section-head"><div><h2>{t.title}</h2><p>{t.intro}</p></div><div className="admin-system-actions"><button type="button" className="btn secondary" onClick={()=>downloadCsv('customers=csv')}><Download size={17}/>{t.exportCsv}</button></div></div>
  <div className="admin-filters">
   <label className="field"><span>{t.search}</span><span className="admin-search"><Search size={16} aria-hidden="true"/><input type="search" placeholder={t.searchPlaceholder} value={query} onChange={event=>setQuery(event.target.value)}/></span></label>
   <label className="field"><span>{t.access}</span><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value as StatusFilter)}><option value="all">{t.all}</option><option value="active">{t.activeMany}</option><option value="review">{t.reviewMany}</option><option value="blocked">{t.blockedMany}</option><option value="cart">{k.cartFilter}</option></select></label>
   <p className="micro admin-filter-count">{t.shown(rows.length,data.accounts.length)}</p>
  </div>
  <div className="admin-scroll"><table className="admin-grid"><thead><tr><th>{t.customer}</th><th className="num">{t.orders}</th><th className="num">{t.payable}</th><th className="num">{t.balance}</th><th className="num">{t.tickets}</th><th className="num">{k.cart}</th><th>{t.access}</th></tr></thead><tbody>
   {rows.map(row=><tr key={row.id}>
    <td><button type="button" className="admin-link" onClick={()=>setOpen(row.id)}><b>{row.name}</b><small>{row.email||row.phone||row.id}</small></button>{row.cartPriceChanges>0&&<i className="admin-flag">{t.priceChanged}</i>}</td>
    <td className="num"><b>{row.orders}</b>{row.activeOrders?<small>{t.inWork(row.activeOrders)}</small>:null}</td>
    <td className="num">{money(row.payable,lang)}</td>
    <td className="num">{money(row.balance,lang)}</td>
    <td className="num">{row.openTickets}</td>
    <td className={row.cartLines?'num':'num admin-zero'}>{row.cartLines}</td>
    <td className="admin-cell-control"><select aria-label={t.accessFor(row.name)} disabled={busy} value={row.status} onChange={event=>void requestStatus(row.id,event.target.value as CustomerStatus)}><option value="active">{statusLabels.active}</option><option value="review">{statusLabels.review}</option><option value="blocked" disabled={!canBlock}>{statusLabels.blocked}</option></select></td>
   </tr>)}
   {!rows.length&&<tr><td colSpan={7} className="micro">{t.nobody}</td></tr>}
  </tbody></table></div>
  <p className="micro">{t.exportNote}</p>
  <CustomerCard key={open??'none'} id={open} busy={busy} canBlock={canBlock} onClose={()=>setOpen(null)} onStatus={requestStatus} status={open?data.customerStatuses[open]??'active':'active'}/>
  <Modal open={!!pendingStatus} onClose={()=>setPendingStatus(null)} title={pendingStatus?(pendingStatus.status==='blocked'?k.blocked(pendingStatus.name):k.review(pendingStatus.name)):''} description={pendingStatus?.status==='blocked'?k.blockedText:k.reviewText} locale={state.communication.language}>
   <div className="admin-confirm-actions">
    <button type="button" className="btn secondary" onClick={()=>setPendingStatus(null)}>{k.cancel}</button>
    <button type="button" className="btn primary" disabled={busy} onClick={()=>{const next=pendingStatus;setPendingStatus(null);if(next)void onStatus(next.id,next.status)}}>{k.confirm}</button>
   </div>
  </Modal>
 </section>;
}

function CustomerCard({id,busy,canBlock,onClose,onStatus,status}:{id:string|null;busy:boolean;canBlock:boolean;onClose:()=>void;onStatus:(accountId:string,status:CustomerStatus)=>Promise<void>;status:CustomerStatus}){
 const [card,setCard]=useState<Card|null>(null),[error,setError]=useState(''),[note,setNote]=useState(''),[saving,setSaving]=useState(false);
 const {state}=useMarket(),lang=state.communication.language,t=pickLocale(customersCopy,lang),statusLabels=customerStatusLabelsFor(lang),stages=localizedStatuses(lang),now=new Date().getTime();
 // The parent keys this component by `id`, so every card starts empty; the effect only runs the request.
 useEffect(()=>{if(!id)return;let cancelled=false;getOperations<Card>(`customer=${encodeURIComponent(id)}`).then(next=>{if(!cancelled)setCard(next)}).catch(failure=>{if(!cancelled)setError((failure as Error).message)});return()=>{cancelled=true}},[id]);
 async function addNote(){if(!id||!note.trim())return;setSaving(true);try{const next=await postOperations<{notes:CustomerNote[]}>({kind:'customer-note',accountId:id,text:note.trim()});setCard(current=>current?{...current,notes:next.notes}:current);setNote('');toast.success(t.noteSaved)}catch(failure){toast.error((failure as Error).message)}finally{setSaving(false)}}
 const customer=card?.customer;
 return <Modal open={!!id} onClose={onClose} title={customer?.name??t.cardFallback} description={customer?[customer.email,customer.phone].filter(Boolean).join(' · ')||customer.id:t.cardLoading} locale={lang}>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {card&&customer&&<div className="admin-card">
   <div className="admin-card-facts">
    <div><span>{t.ordersCount}</span><b>{customer.orders}</b></div><div><span>{t.payable}</span><b>{money(customer.payable,lang)}</b></div><div><span>{t.balance}</span><b>{money(customer.balance,lang)}</b></div><div><span>{t.openTickets}</span><b>{customer.openTickets}</b></div><div><span>{t.language}</span><b>{card.language}</b></div><div><span>{t.firstOrder}</span><b>{dateOnly(customer.createdAt,lang)}</b></div>
   </div>
   <label className="field admin-card-status"><span>{t.access}</span><select disabled={busy} value={status} onChange={event=>void onStatus(customer.id,event.target.value as CustomerStatus)}><option value="active">{statusLabels.active}</option><option value="review">{statusLabels.review}</option><option value="blocked" disabled={!canBlock}>{statusLabels.blocked}</option></select></label>
   {card.recipients.length>0&&<p className="micro">{t.recipients(card.recipients.map(item=>`${item.recipient}${item.city?` (${item.city})`:''}`).join(', '))}</p>}
   <h3>{t.orders}</h3>
   {card.orders.length?<div className="admin-scroll"><table className="admin-grid"><thead><tr><th>{t.order}</th><th>{t.item}</th><th>{t.stage}</th><th className="num">{t.payable}</th><th>{t.payment}</th><th className="num">{t.created}</th></tr></thead><tbody>{card.orders.map(order=><tr key={order.id} className={order.cancelled?'muted':''}><td><Link href={`/operations#${encodeURIComponent(order.id)}`}>{order.id}</Link></td><td>{order.brand} · {order.name}</td><td>{order.cancelled?t.cancelled:stages[order.status]}</td><td className="num">{money(order.payable,lang)}</td><td>{order.payment?t.paymentLabels[order.payment]??order.payment:t.noRecord}</td><td className="num">{dateOnly(order.createdAt,lang)}</td></tr>)}</tbody></table></div>:<p className="micro">{t.noOrders}</p>}
   <h3>{t.tickets}</h3>
   {card.tickets.length?<ul className="admin-plain-list">{card.tickets.map(ticket=><li key={ticket.id}><b>{ticket.subject}</b><span>{t.ticketStatus[ticket.status]??ticket.status} · {t.messages(ticket.replies)} · {agoLocalized(ticket.updatedAt,lang,now)}</span></li>)}</ul>:<p className="micro">{t.noTickets}</p>}
   <h3><UserRound size={16} aria-hidden="true"/> {t.notes}</h3>
   <ul className="admin-plain-list admin-notes">{card.notes.map(item=><li key={item.id}><span>{item.text}</span><small>{item.authorEmail} · {dateTime(item.createdAt,lang)}</small></li>)}{!card.notes.length&&<li className="micro">{t.noNotes}</li>}</ul>
   <form className="admin-note-form" onSubmit={event=>{event.preventDefault();void addNote()}}><label className="field" htmlFor="customer-note"><span>{t.newNote}</span><textarea id="customer-note" rows={3} maxLength={1000} value={note} onChange={event=>setNote(event.target.value)} placeholder={t.notePlaceholder}/></label><button type="submit" className="btn primary" disabled={saving||!note.trim()}>{saving?t.saving:t.addNote}</button></form>
  </div>}
 </Modal>;
}
