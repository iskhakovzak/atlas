'use client';

import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {Coins,Database,Gift,Receipt} from 'lucide-react';
import type {ProviderUsage} from '@/lib/market/provider-usage';
import type {BrightDataSettings} from '@/lib/importer/brightdata';
import {Alert,Badge,Kpi,load,money,post,Status,dateTime,type AccountingContext} from './accounting-shared';

const statusNames:Record<string,string>={running:'собирается',ready:'готово',failed:'ошибка',empty:'пусто'};
const statusTone=(status:string)=>status==='ready'?'ok':status==='running'?'neutral':'warn';
const purposeNames:Record<string,string>={customer:'клиент',catalog:'каталог'};
const usd=(value:number)=>'$'+value.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:4});
const count=(value:number)=>value.toLocaleString('ru-RU');

/**
 * Сервисы: paid data collection (Bright Data for Walmart). The month's records by store and day, the free
 * allowance left, the cost over it and the daily expense entries already posted to the books ("Сервисы и хостинг",
 * AUTO-BRIGHTDATA-<day>). Settings are saved by the administrator only (audited); everyone with finance.read sees them.
 */
export function AccountingServices({ctx}:{ctx:AccountingContext}){
 const {month,isAdmin,busy,run}=ctx;
 const [usage,setUsage]=useState<ProviderUsage|null>(null),[error,setError]=useState('');
 const [draft,setDraft]=useState<BrightDataSettings|null>(null),[formError,setFormError]=useState('');
 const reload=useCallback(async()=>{
  try{const data=await load<{usage:ProviderUsage}>('providers='+month);setUsage(data.usage);setDraft(data.usage.settings);setError('')}
  catch(failure){setError((failure as Error).message)}
 },[month]);
 useEffect(()=>{queueMicrotask(()=>void reload())},[reload]);

 async function save(event:FormEvent){
  event.preventDefault();
  if(!draft)return;
  const numbers=[draft.pricePer1kUsd,draft.freeRecordsPerMonth,draft.monthlyRecordLimit,draft.waitSeconds,draft.reuseMinutes];
  if(numbers.some(value=>!Number.isFinite(value)||value<0)){setFormError('Проверьте числа: они не могут быть пустыми или отрицательными.');return}
  if(draft.waitSeconds<3||draft.waitSeconds>20){setFormError('Ожидание — от 3 до 20 секунд.');return}
  if(draft.reuseMinutes<5||draft.reuseMinutes>1440){setFormError('Повторное использование — от 5 до 1440 минут.');return}
  setFormError('');
  const ok=await run(async()=>{try{await post({kind:'providers-settings',value:draft})}catch(failure){setFormError((failure as Error).message);throw failure}},'Настройки Bright Data сохранены.');
  if(ok)await reload();
 }
 const set=<K extends keyof BrightDataSettings>(key:K,value:BrightDataSettings[K])=>setDraft(current=>current?{...current,[key]:value}:current);
 const num=(value:string)=>value.trim()===''?Number.NaN:Number(value.replace(',','.'));

 if(error)return <div className="acc-tab-body"><Alert>{error}</Alert></div>;
 if(!usage||!draft)return <div className="acc-tab-body"><Status>Загружаем сервисы…</Status></div>;
 const s=usage.settings,readOnly=!isAdmin||busy;
 return <div className="acc-tab-body">
  <p className="micro">Walmart закрыт от серверов защитой от ботов, поэтому его товары собирает Bright Data (готовые парсеры, 1 запись = 1 кредит = один товар). Первые {count(s.freeRecordsPerMonth)} записей в месяц бесплатны, дальше — {usd(s.pricePer1kUsd)} за 1000. Платная часть каждого завершённого дня автоматически проводится расходом «Сервисы и хостинг» по курсу ЦБ. Пополнение кошелька Bright Data отдельным расходом не проводите — иначе расход учтётся дважды.</p>
  {!usage.configured&&<p className="notice" role="status">На сервере не задан секрет <code>BRIGHTDATA_API_KEY</code> — Bright Data сейчас не используется, Walmart загружается обычным путём.</p>}
  <div className="accounting-cards">
   <Kpi icon={Database} label={`Записей за ${month}`} value={count(usage.used)} note={usage.running?`${usage.running} ещё собирается`:`лимит месяца ${count(s.monthlyRecordLimit)}, осталось ${count(usage.limitLeft)}`}/>
   <Kpi icon={Gift} label="Бесплатных осталось" value={count(usage.freeLeft)} note={`из ${count(s.freeRecordsPerMonth)} в месяц`}/>
   <Kpi icon={Coins} label="Платных записей" value={count(usage.paidRecords)} note={`≈ ${usd(usage.costUsd)} по ${usd(s.pricePer1kUsd)} за 1000`}/>
   <Kpi icon={Receipt} label="Проведено в книги" value={money(usage.postedUzs)} note="расход «Сервисы и хостинг», по дням"/>
  </div>
  {usage.skipped.length>0&&<p className="notice" role="status">Не проведены: {usage.skipped.map(item=>`${item.day} — ${item.reason}`).join('; ')}.</p>}
  <div className="acc-block">
   <div className="acc-block-head"><h4>По магазинам</h4></div>
   <div className="acc-scroll"><table className="accounting-table acc-table">
    <thead><tr><th scope="col">Магазин</th><th scope="col">Сборов</th><th scope="col">Записей</th><th scope="col">Без результата</th><th scope="col">Включён</th></tr></thead>
    <tbody>{usage.stores.map(row=><tr key={row.store}><th scope="row">{row.name}</th><td className="num">{count(row.jobs)}</td><td className="num">{count(row.records)}</td><td className="num">{count(row.failed)}</td><td className="num">{s.enabled&&s.stores[row.store as keyof typeof s.stores]?'да':'нет'}</td></tr>)}</tbody>
   </table></div>
  </div>
  <div className="acc-block">
   <div className="acc-block-head"><h4>По дням</h4><span className="micro">день проводится на следующий день; сегодняшний ещё идёт</span></div>
   {usage.days.length?<div className="acc-scroll"><table className="accounting-table acc-table">
    <thead><tr><th scope="col">День</th><th scope="col">Записей</th><th scope="col">Платных</th><th scope="col">Стоимость</th><th scope="col">В книгах</th></tr></thead>
    <tbody>{usage.days.map(day=><tr key={day.day}><th scope="row">{day.day}</th><td className="num">{count(day.records)}</td><td className="num">{count(day.paidRecords)}</td><td className="num">{usd(day.usd)}</td><td className="num">{day.paidRecords===0?'бесплатно':day.posted?<Badge tone="auto">проведено</Badge>:'ждёт'}</td></tr>)}</tbody>
   </table></div>:<p className="micro" role="status">В этом месяце сборов не было.</p>}
  </div>
  <div className="acc-block">
   <div className="acc-block-head"><h4>Настройки Bright Data</h4>{!isAdmin&&<span className="micro">меняет только администратор</span>}</div>
   <form className="acc-provider-settings" onSubmit={save}>
    <fieldset disabled={readOnly}>
     <legend className="sr-only">Где использовать</legend>
     <label className="acc-check"><input type="checkbox" checked={draft.enabled} onChange={event=>set('enabled',event.target.checked)}/>Использовать Bright Data</label>
     <label className="acc-check"><input type="checkbox" checked={draft.stores.walmart} onChange={event=>set('stores',{...draft.stores,walmart:event.target.checked})}/>Walmart</label>
     <label className="acc-check"><input type="checkbox" checked={draft.catalog} onChange={event=>set('catalog',event.target.checked)}/>Также для каталога и его ежечасной проверки</label>
     <label className="acc-check"><input type="checkbox" checked={draft.ledger} onChange={event=>set('ledger',event.target.checked)}/>Проводить платную часть в бухгалтерию</label>
    </fieldset>
    <fieldset disabled={readOnly} className="accounting-grid acc-grid-2">
     <legend className="sr-only">Цена и лимиты</legend>
     <label className="field"><span>Цена, $ за 1000 записей</span><input inputMode="decimal" value={Number.isNaN(draft.pricePer1kUsd)?'':String(draft.pricePer1kUsd)} onChange={event=>set('pricePer1kUsd',num(event.target.value))}/></label>
     <label className="field"><span>Бесплатных записей в месяц</span><input inputMode="numeric" value={Number.isNaN(draft.freeRecordsPerMonth)?'':String(draft.freeRecordsPerMonth)} onChange={event=>set('freeRecordsPerMonth',Math.round(num(event.target.value)))}/></label>
     <label className="field"><span>Потолок записей в месяц</span><input inputMode="numeric" value={Number.isNaN(draft.monthlyRecordLimit)?'':String(draft.monthlyRecordLimit)} onChange={event=>set('monthlyRecordLimit',Math.round(num(event.target.value)))}/><small className="micro">дальше новые сборы не запускаются; 0 — выключить сборы</small></label>
     <label className="field"><span>Ожидание в одном запросе, с</span><input inputMode="numeric" value={Number.isNaN(draft.waitSeconds)?'':String(draft.waitSeconds)} onChange={event=>set('waitSeconds',Math.round(num(event.target.value)))}/><small className="micro">не успел — страница спросит ещё раз сама</small></label>
     <label className="field"><span>Повторно использовать сбор, мин</span><input inputMode="numeric" value={Number.isNaN(draft.reuseMinutes)?'':String(draft.reuseMinutes)} onChange={event=>set('reuseMinutes',Math.round(num(event.target.value)))}/><small className="micro">тот же товар в это время не оплачивается снова</small></label>
    </fieldset>
    {formError&&<p className="notice error" role="alert">{formError}</p>}
    {isAdmin&&<div><button type="submit" className="btn primary" disabled={busy}>Сохранить настройки</button></div>}
   </form>
  </div>
  <div className="acc-block">
   <div className="acc-block-head"><h4>Последние сборы</h4><span className="micro">до 50 за месяц</span></div>
   {usage.jobs.length?<div className="acc-scroll"><table className="accounting-table acc-table">
    <thead><tr><th scope="col">Начат</th><th scope="col">Магазин</th><th scope="col">Статус</th><th scope="col">Записей</th><th scope="col">Для</th><th scope="col">Товар</th></tr></thead>
    <tbody>{usage.jobs.map(job=><tr key={job.snapshotId}><th scope="row">{dateTime(job.createdAt)}</th><td>{job.store==='walmart'?'Walmart':job.store}</td><td><Badge tone={statusTone(job.status)}>{statusNames[job.status]??job.status}</Badge>{job.error?<small className="micro"> {job.error}</small>:null}</td><td className="num">{count(job.records)}</td><td>{purposeNames[job.purpose]??job.purpose}</td><td><a href={job.url} target="_blank" rel="noopener noreferrer">открыть</a></td></tr>)}</tbody>
   </table></div>:<p className="micro" role="status">Сборов пока нет.</p>}
  </div>
 </div>;
}
