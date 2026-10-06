'use client';

import {useMemo,useState} from 'react';
import {FileText,Printer,ShoppingBag,TrendingUp,Wallet} from 'lucide-react';
import {orderMargin,type OrderFinance} from '@/lib/market/finance';
import {Modal} from './market-ui';
import {Amount,Kpi,load,money,stageNames,statusNames,type AccountingContext} from './accounting-shared';
import {entryDirection,invoiceFromOrder,monthLabel,normalizeInvoice,type InvoiceView} from './accounting-helpers';

type SortKey='date'|'revenue'|'margin';

/** Заказы месяца: status, goods, fee, delivery, margin, linked entries, a link to /operations and the printable invoice. */
export function AccountingOrders({ctx,onShowInLedger}:{ctx:AccountingContext;onShowInLedger:(orderId:string)=>void}){
 const {books}=ctx;
 const [status,setStatus]=useState<'all'|OrderFinance['status']>('all'),[sort,setSort]=useState<SortKey>('date'),[search,setSearch]=useState(''),[open,setOpen]=useState<string|null>(null);
 const rows=useMemo(()=>{
  const needle=search.trim().toLowerCase();
  const list=books.orders.filter(order=>(status==='all'||order.status===status)&&(!needle||order.orderId.toLowerCase().includes(needle)||order.customerId.toLowerCase().includes(needle))).map(order=>({order,margin:orderMargin(order,books.orderEntries)}));
  return list.sort((a,b)=>sort==='revenue'?b.order.revenue-a.order.revenue:sort==='margin'?b.margin.margin-a.margin.margin:(b.order.paidAt??b.order.createdAt)-(a.order.paidAt??a.order.createdAt));
 },[books,status,sort,search]);
 const totals=useMemo(()=>rows.filter(({order})=>order.status==='paid').reduce((sum,{order,margin})=>({revenue:sum.revenue+order.revenue,margin:sum.margin+margin.margin,goods:sum.goods+order.goods,count:sum.count+1}),{revenue:0,margin:0,goods:0,count:0}),[rows]);
 const [invoice,setInvoice]=useState<{order:OrderFinance;view:InvoiceView;source:'server'|'local'}|null>(null),[invoiceBusy,setInvoiceBusy]=useState('');
 async function openInvoice(order:OrderFinance){
  setInvoiceBusy(order.orderId);
  try{
   // The engine's GET ?invoice= wins when it exists; until then the invoice is built from the order's own books.
   const data=await load<unknown>('invoice='+encodeURIComponent(order.orderId)).catch(()=>null);
   const view=normalizeInvoice(data);
   setInvoice({order,view:view??invoiceFromOrder(order),source:view?'server':'local'});
  }finally{setInvoiceBusy('')}
 }
 return <div className="acc-tab-body">
  <div className="accounting-cards acc-cards-3">
   <Kpi icon={ShoppingBag} label={`Оплаченных заказов за ${monthLabel(books.month)}`} value={totals.count} note="по отметке «оплачен» в Atlas, платежи симулируются"/>
   <Kpi icon={Wallet} label="Доход Atlas по ним" value={<Amount value={totals.revenue}/>} note={`товар в транзите: ${money(totals.goods)}`}/>
   <Kpi icon={TrendingUp} label="Фактическая маржа" value={<Amount value={totals.margin}/>} loss={totals.margin<0} note="доход − привязанные расходы журнала"/>
  </div>
  <div className="acc-block">
   <div className="acc-block-head"><h4>Заказы месяца</h4>
    <div className="acc-filters acc-filters-row">
     <label className="field acc-inline"><span>Статус</span><select value={status} onChange={event=>setStatus(event.target.value as typeof status)}><option value="all">Все</option><option value="paid">Оплачен</option><option value="pending">Ожидает оплаты</option><option value="refunded">Возвращён</option><option value="cancelled">Отменён</option></select></label>
     <label className="field acc-inline"><span>Сортировка</span><select value={sort} onChange={event=>setSort(event.target.value as SortKey)}><option value="date">По дате</option><option value="revenue">По доходу</option><option value="margin">По марже</option></select></label>
     <label className="field acc-inline"><span>Поиск</span><input type="search" placeholder="AT-…, клиент" value={search} onChange={event=>setSearch(event.target.value)}/></label>
    </div>
   </div>
   <p className="micro">Оплаченные в этом месяце и созданные в нём неоплаченные заказы. Фактическая маржа = доход Atlas по заказу − привязанные к нему расходы журнала (перевозчик, комиссия платёжки) за любую дату.</p>
   {rows.length?<div className="acc-scroll acc-cards-on-phone"><table className="accounting-table acc-table acc-orders-table">
    <thead><tr><th scope="col">Заказ</th><th scope="col">Статус</th><th scope="col">Товар (транзит)</th><th scope="col">Комиссия</th><th scope="col">Доставка</th><th scope="col">Курс</th><th scope="col">Услуги</th><th scope="col">Доход Atlas</th><th scope="col">Расходы</th><th scope="col">Факт. маржа</th><th scope="col"><span className="sr-only">Действия</span></th></tr></thead>
    <tbody>{rows.map(({order,margin})=>{const expanded=open===order.orderId;return [
     <tr key={order.orderId} className={order.status==='cancelled'||order.status==='refunded'?'muted-row':undefined}>
      <td data-label="Заказ"><a className="text-link" href={`/operations#${encodeURIComponent(order.orderId)}`}>{order.orderId}</a><small>{order.customerId}</small></td>
      <td data-label="Статус">{statusNames[order.status]}<small>{books.stages[order.orderId]==='cancelled'?'Отменён':stageNames[Number(books.stages[order.orderId])]??'Этап не найден'}</small></td>
      <td data-label="Товар (транзит)" className="num">{money(order.goods)}{order.storeShipping?<small>+ доставка магазина {money(order.storeShipping)}</small>:null}</td>
      <td data-label="Комиссия" className="num">{money(order.commission)}</td><td data-label="Доставка" className="num">{money(order.delivery)}</td><td data-label="Курс" className="num">{money(order.fxGain)}</td><td data-label="Услуги" className="num">{money(order.services)}</td>
      <td data-label="Доход Atlas" className="num"><b>{money(order.revenue)}</b></td>
      <td data-label="Расходы" className="num">{margin.linkedExpenses?<Amount value={-margin.linkedExpenses}/>:'—'}{margin.entries.length?<button type="button" className="text-button acc-link-small" aria-expanded={expanded} onClick={()=>setOpen(expanded?null:order.orderId)}>{margin.entries.length} зап.</button>:null}</td>
      <td data-label="Факт. маржа" className="num"><b><Amount value={margin.margin}/></b></td>
      <td className="acc-actions"><button type="button" className="text-button" disabled={invoiceBusy===order.orderId} onClick={()=>void openInvoice(order)}><FileText size={14} aria-hidden="true"/>Счёт-расчёт</button><button type="button" className="text-button" onClick={()=>onShowInLedger(order.orderId)}>В журнале</button></td>
     </tr>,
     expanded?<tr key={order.orderId+'-entries'} className="acc-subrow"><td colSpan={11}><ul className="acc-linked">{margin.entries.map(entry=><li key={entry.id}><span>{entry.occurredOn}</span><span>{books.kinds[entry.kind]?.ru}</span><Amount value={entryDirection(entry)==='in'?entry.amountUzs:-entry.amountUzs} plus/>{entry.note&&<small>{entry.note}</small>}</li>)}</ul></td></tr>:null,
    ]})}</tbody></table></div>:<p className="micro" role="status">Заказов с такими условиями в этом месяце нет.</p>}
  </div>

  <Modal open={!!invoice} onClose={()=>setInvoice(null)} title={invoice?`Счёт-расчёт ${invoice.view.number}`:'Счёт-расчёт'} description="Печатная версия сметы заказа для клиента. Не является счётом-фактурой и не подтверждает оплату.">
   {invoice&&<InvoiceSheet view={invoice.view} source={invoice.source}/>}
   <div className="acc-dialog-actions"><button type="button" className="btn secondary" onClick={()=>setInvoice(null)}>Закрыть</button><button type="button" className="btn primary" onClick={()=>window.print()}><Printer size={16} aria-hidden="true"/>Печать</button></div>
  </Modal>
 </div>;
}

function InvoiceSheet({view,source}:{view:InvoiceView;source:'server'|'local'}){
 return <article className="acc-invoice" aria-label={`Счёт-расчёт ${view.number}`}>
  <header className="acc-invoice-head"><div><span className="wordmark">Atlas</span><small>помощник покупок за рубежом · агент</small></div><div className="acc-invoice-meta"><b>Счёт-расчёт {view.number}</b><span>от {view.issuedOn}</span><span>Заказ {view.orderId}{view.createdOn?` от ${view.createdOn}`:''}</span><span>Клиент {view.customer?.name??view.customerId}</span>{(view.customer?.email||view.customer?.phone)&&<span>{[view.customer?.email,view.customer?.phone].filter(Boolean).join(' · ')}</span>}<span>Статус в Atlas: {view.statusRu??statusNames[view.status]}{view.paidOn?` (${view.paidOn})`:''}</span></div></header>
  <table className="acc-invoice-table"><thead><tr><th scope="col">Позиция</th><th scope="col" className="num">Сумма, сум</th></tr></thead>
   <tbody>{view.lines.map((line,index)=><tr key={index}><td>{line.label}{line.transit&&<small>транзит — передаётся магазину или перевозчику</small>}</td><td className="num"><Amount value={line.amount}/></td></tr>)}</tbody>
   <tfoot><tr><th scope="row">Итого по смете</th><td className="num"><b>{money(view.total)}</b></td></tr></tfoot></table>
  {view.split&&<p className="micro">Справочно: транзит магазину и перевозчику {money(view.split.transit)}, вознаграждение Atlas {money(view.split.atlasIncome)}.</p>}
  {view.note&&<p className="micro">{view.note}</p>}
  <p className="micro">Суммы в сумах по курсу и тарифу на момент расчёта. {source==='local'?'Составлено из сохранённой сметы заказа.':'Выдано движком бухгалтерии.'}</p>
 </article>;
}
