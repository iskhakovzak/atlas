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
    {csvKinds.map(([kind,label,hint])=><li key={kind}><a className={valid?'acc-export':'acc-export acc-disabled'} aria-disabled={!valid} href={valid?exportUrl(kind):undefined} download><Download size={18} aria-hidden="true"/><b>{label}</b><small>{hint}</small></a></li>)}
    <li><a className="acc-export" href={`/api/finance?export=year&year=${from.slice(0,4)}`} download><Download size={18} aria-hidden="true"/><b>Год {from.slice(0,4)} по месяцам</b><small>12 месяцев, кварталы и итог года с налогом-ориентиром</small></a></li>
    <li><a className="acc-export" href={`/api/finance?export=book&month=${month}`} download><Download size={18} aria-hidden="true"/><b>Полная книга {month}</b><small>все записи журнала месяца и строки заказов</small></a></li>
   </ul>
   <p className="micro">CSV с разделителем «;», UTF-8 с BOM и десятичной запятой — открывается в Excel без настроек. Суммы в сумах. Платёжные статусы — отметки в Atlas, не движение денег.</p>
  </div>
  <div className="acc-block">
   <div className="acc-block-head"><h4>JSON-бэкап</h4></div>
   <ul className="acc-export-list">
    <li><a className={valid?'acc-export':'acc-export acc-disabled'} aria-disabled={!valid} href={valid?`/api/finance?export=backup&from=${from}&to=${to}`:undefined} download><FileJson size={18} aria-hidden="true"/><b>Книги за период (JSON)</b><small>настройки, заказы, журнал и сводки за выбранные месяцы — с сервера</small></a></li>
    <li><button type="button" className="acc-export" onClick={()=>downloadText(`atlas-accounting-${books.month}-${todayTashkent()}.json`,monthBackup(books))}><FileJson size={18} aria-hidden="true"/><b>Месяц {books.month} как на экране (JSON)</b><small>то, что сейчас загружено в этот раздел, без запроса к серверу</small></button></li>
    {canBackup?<li><a className="acc-export" href="/api/backup" download><DatabaseBackup size={18} aria-hidden="true"/><b>Полный бэкап базы (JSON)</b><small>все таблицы D1, включая клиентов и документы — храните как секрет</small></a></li>
    :<li><span className="acc-export acc-disabled" aria-disabled="true"><DatabaseBackup size={18} aria-hidden="true"/><b>Полный бэкап базы</b><small>доступен только с правом system.manage (администратор)</small></span></li>}
   </ul>
  </div>
 </div>;
}
