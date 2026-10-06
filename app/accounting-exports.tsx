'use client';

import {useState} from 'react';
import {DatabaseBackup,Download,FileJson} from 'lucide-react';
import {downloadText,type AccountingContext} from './accounting-shared';
import {monthBackup,todayTashkent} from './accounting-helpers';

const csvKinds:[string,string,string][]=[['summary','Сводка по месяцам','доход, расходы, прибыль, налог по каждому месяцу периода'],['orders','Заказы','каждый заказ: транзит, комиссия, доставка, курс, услуги, к оплате'],['margins','Заказы с маржой','заказы с привязанными расходами и фактической маржой'],['ledger','Журнал операций','все записи журнала за период, включая аннулированные']];

/** Выгрузки: every CSV for the accountant, the year table, a JSON of the loaded month and the full D1 backup. */
export function AccountingExports({ctx}:{ctx:AccountingContext}){
 const {books,month,canBackup}=ctx;
 const [from,setFrom]=useState(()=>month.slice(0,4)+'-01'),[to,setTo]=useState(month);
 const valid=/^\d{4}-\d{2}$/.test(from)&&/^\d{4}-\d{2}$/.test(to)&&from<=to;
 const exportUrl=(kind:string)=>`/api/finance?export=${kind}&from=${from}&to=${to}`;
 return <div className="acc-tab-body">
  <div className="acc-block">
   <div className="acc-block-head"><h4>CSV для бухгалтера</h4></div>
   <div className="accounting-grid acc-grid-2">
    <label className="field"><span>С месяца</span><input type="month" value={from} onChange={event=>event.target.value&&setFrom(event.target.value)}/></label>
    <label className="field"><span>По месяц</span><input type="month" value={to} onChange={event=>event.target.value&&setTo(event.target.value)}/></label>
   </div>
   {!valid&&<p className="notice error" role="alert">Начало периода позже конца.</p>}
   <ul className="acc-export-list">
    {csvKinds.map(([kind,label,hint])=><li key={kind}><a className={valid?'btn secondary':'btn secondary acc-disabled'} aria-disabled={!valid} href={valid?exportUrl(kind):undefined} download><Download size={16} aria-hidden="true"/>{label}</a><small>{hint}</small></li>)}
    <li><a className="btn secondary" href={`/api/finance?export=year&year=${from.slice(0,4)}`} download><Download size={16} aria-hidden="true"/>Год {from.slice(0,4)} по месяцам</a><small>12 месяцев, кварталы и итог года с налогом-ориентиром</small></li>
    <li><a className="btn secondary" href={`/api/finance?export=book&month=${month}`} download><Download size={16} aria-hidden="true"/>Полная книга {month}</a><small>все записи журнала месяца (авто, вручную, выписка, аннулированные) и строки заказов</small></li>
   </ul>
   <p className="micro">CSV с разделителем «;», UTF-8 с BOM и десятичной запятой — открывается в Excel без настроек. Суммы в сумах. Платёжные статусы — отметки в Atlas, не движение денег.</p>
  </div>
  <div className="acc-block">
   <div className="acc-block-head"><h4>JSON-бэкап</h4></div>
   <ul className="acc-export-list">
    <li><a className={valid?'btn secondary':'btn secondary acc-disabled'} aria-disabled={!valid} href={valid?`/api/finance?export=backup&from=${from}&to=${to}`:undefined} download><FileJson size={16} aria-hidden="true"/>Книги за период (JSON)</a><small>настройки, заказы, журнал и сводки за выбранные месяцы — с сервера</small></li>
    <li><button type="button" className="btn secondary" onClick={()=>downloadText(`atlas-accounting-${books.month}-${todayTashkent()}.json`,monthBackup(books))}><FileJson size={16} aria-hidden="true"/>Месяц {books.month} как на экране (JSON)</button><small>то, что сейчас загружено в этот раздел, без запроса к серверу</small></li>
    {canBackup?<li><a className="btn secondary" href="/api/backup" download><DatabaseBackup size={16} aria-hidden="true"/>Полный бэкап базы (JSON)</a><small>все таблицы D1, включая клиентов и документы — храните как секрет</small></li>
    :<li><span className="btn secondary acc-disabled" aria-disabled="true"><DatabaseBackup size={16} aria-hidden="true"/>Полный бэкап базы</span><small>доступен только с правом system.manage (администратор)</small></li>}
   </ul>
  </div>
 </div>;
}
