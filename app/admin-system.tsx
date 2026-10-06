"use client";
// Admin → Система: the status board (D1, the CBU rate, the projection, the tariff version, the last backup), the action
// buttons (refresh the rate, sync the projection, download the backup), the attention thresholds, warnings and errors.
import {useEffect,useState} from "react";
import {Database,History,Package,RefreshCw,ShieldCheck,TriangleAlert,WalletCards} from "lucide-react";
import {toast} from "sonner";
import type {Pricing} from "@/lib/market/domain";
import {defaultAdminSettings,type AdminSettings} from "@/lib/market/admin-dashboard";
import {PerformanceSummary} from "./performance-summary";
import {ago,dateTime,getOperations,postOperations,type AdminData,type AuditEvent,type SystemStatus} from "./admin-shared";

type Thresholds=AdminSettings['attention'];
const thresholdFields:Array<{key:keyof Thresholds;label:string;unit:string;max:number}>=[
 {key:'pendingPaymentDays',label:'Ожидают оплаты дольше',unit:'дн.',max:365},{key:'paidNotBoughtDays',label:'Оплачены, но не выкуплены дольше',unit:'дн.',max:365},{key:'warehouseDays',label:'На складе дольше',unit:'дн.',max:365},
 {key:'topupDays',label:'Доплата без ответа дольше',unit:'дн.',max:365},{key:'ticketDays',label:'Обращение открыто дольше',unit:'дн.',max:365},{key:'fxStaleHours',label:'Курс ЦБ старше',unit:'ч',max:720},
];

export function AdminSystem({data,copy,onChanged}:{data:AdminData;copy:{system:string;sync:string;backup:string;errors:string;clear:string};onChanged:(next:{health?:AdminData['health'];audit?:AuditEvent[];pricing?:Pricing;adminSettings?:AdminSettings})=>void}){
 const [status,setStatus]=useState<SystemStatus|null>(null),[statusError,setStatusError]=useState(''),[busy,setBusy]=useState(''),[thresholds,setThresholds]=useState<Thresholds>(data.adminSettings?.attention??defaultAdminSettings.attention);
 const loadStatus=()=>{getOperations<{system:SystemStatus}>('system=1').then(next=>{setStatus(next.system);setStatusError('')}).catch(error=>setStatusError((error as Error).message))};
 useEffect(()=>{loadStatus()},[]);
 // Saved thresholds arriving from the server replace the draft; tracked during render, not in an effect.
 const [seenSettings,setSeenSettings]=useState(data.adminSettings);
 if(data.adminSettings!==seenSettings){setSeenSettings(data.adminSettings);setThresholds(data.adminSettings?.attention??defaultAdminSettings.attention)}
 async function run(kind:'projection-rebuild'|'fx-refresh',success:string){setBusy(kind);try{const next=await postOperations<{health?:AdminData['health'];audit?:AuditEvent[];pricing?:Pricing}>({kind});onChanged(next);toast.success(success);loadStatus()}catch(error){toast.error((error as Error).message)}finally{setBusy('')}}
 async function saveThresholds(){setBusy('settings');try{const next=await postOperations<{adminSettings:AdminSettings;audit:AuditEvent[]}>({kind:'admin-settings',value:{attention:thresholds}});onChanged(next);toast.success('Пороги сохранены. Список «Требуют внимания» пересчитается при следующей загрузке.')}catch(error){toast.error((error as Error).message)}finally{setBusy('')}}
 const dirty=JSON.stringify(thresholds)!==JSON.stringify(data.adminSettings?.attention??defaultAdminSettings.attention);
 return <>
  <section className="surface admin-section admin-system">
   <div className="admin-section-head"><div><h2>{copy.system}</h2><p>Заказы хранятся документом аккаунта и одновременно раскладываются по операционным таблицам.</p></div>
    <div className="admin-system-actions"><button type="button" className="btn secondary" disabled={!!busy} onClick={()=>void run('fx-refresh','Курс ЦБ обновлён и записан в журнал.')}><RefreshCw size={16}/>{busy==='fx-refresh'?'Запрашиваем ЦБ…':'Обновить курс сейчас'}</button><button type="button" className="btn primary" disabled={!!busy} onClick={()=>void run('projection-rebuild','Операционная база синхронизирована.')}>{busy==='projection-rebuild'?'…':copy.sync}</button><a className="btn secondary" href="/api/backup">{copy.backup}</a></div></div>
   {statusError&&<p className="notice error" role="alert">{statusError}</p>}
   <section className="admin-metrics admin-status-grid">
    <article className={status&&!status.db.ok?'bad':''}><Database/><span>База D1</span><strong>{status?status.db.ok?'в порядке':'нет ответа':'…'}</strong><small>{status?`ответ ${status.db.latencyMs} мс · проверено ${ago(status.checkedAt)}`:'проверяем'}</small></article>
    <article><WalletCards/><span>Курс USD</span><strong>{status?`${new Intl.NumberFormat('ru-RU').format(Math.round(status.fx.rate))} сум`:'…'}</strong><small>{status?status.fx.source==='cbu'?`ЦБ${status.fx.cbuDate?` на ${status.fx.cbuDate}`:''}${status.fx.updatedAt?` · обновлён ${ago(status.fx.updatedAt)}`:' · ещё не читался'}`:'установлен вручную':''}</small></article>
    <article><RefreshCw/><span>Синхронизация</span><strong>{status?.projection.lastSyncAt?ago(status.projection.lastSyncAt):'—'}</strong><small>{status?`${status.projection.customers} клиентов · ${status.projection.orders} заказов в проекции`:''}</small></article>
    <article><Package/><span>Версия тарифа</span><strong>{status?.pricing.revision??'—'}</strong><small>{status?`${status.pricing.version} · ${dateTime(status.pricing.updatedAt)}`:''}</small></article>
    <article><History/><span>Резервная копия</span><strong>{status?.backup.lastAt?ago(status.backup.lastAt):'не делалась'}</strong><small>{status?.backup.records!=null?`${status.backup.records} записей · ${status.backup.checksum}…`:'объём виден после первого экспорта'}</small></article>
    <article><Database/><span>Операционная база</span><strong>{data.health.orders}</strong><small>{data.health.customers} клиентов · {data.health.feeLines} начислений · {data.health.events} событий</small></article>
   </section>
   {status&&!status.customerNotesTable&&<div className="notice warning" role="alert"><TriangleAlert/><span>Таблица заметок о клиентах не создана: примените миграцию drizzle/0011_admin_customer_notes.sql.</span></div>}
   {data.setupWarnings?.map(warning=><div className="notice" role="alert" key={warning}><TriangleAlert/><span>{warning}</span></div>)}
   <TelegramBotSetup/>
   <h3 className="admin-subhead">Пороги «Требуют внимания»</h3>
   <div className="admin-thresholds">{thresholdFields.map(field=><label className="field" key={field.key} htmlFor={`threshold-${field.key}`}><span>{field.label}</span><span className="admin-unit"><input id={`threshold-${field.key}`} type="number" inputMode="numeric" min="0" max={field.max} step="1" value={thresholds[field.key]} onChange={event=>setThresholds({...thresholds,[field.key]:Math.max(0,Math.min(field.max,Math.round(Number(event.target.value)||0)))})}/><b>{field.unit}</b></span></label>)}</div>
   <div className="admin-system-actions"><button type="button" className="btn primary" disabled={!!busy||!dirty} onClick={()=>void saveThresholds()}>{busy==='settings'?'Сохраняем…':'Сохранить пороги'}</button><button type="button" className="btn secondary" disabled={!!busy} onClick={()=>setThresholds(defaultAdminSettings.attention)}>По умолчанию</button>{data.adminSettings?.updatedAt?<span className="micro">Изменено {dateTime(data.adminSettings.updatedAt)}{data.adminSettings.managedBy?` · ${data.adminSettings.managedBy}`:''}</span>:null}</div>
   <div className="monitor-panel"><h3>{copy.errors}</h3>{data.errors.length?data.errors.slice(0,10).map(error=><p key={error.id}><b>{error.area}{error.count&&error.count>1?` ×${error.count}`:''}</b><span>{error.message}{error.route?` · ${error.route}`:''}</span><time>{dateTime(error.lastSeen??error.createdAt)}</time></p>):<p className="micro">{copy.clear}</p>}</div>
   <div className="notice"><ShieldCheck/><span>Экспорт доступен только администратору, содержит контрольную сумму и фиксируется в журнале. Паспортные файлы не включаются. Режима обслуживания нет: механизм не реализован.</span></div>
  </section>
  <PerformanceSummary field={data.vitals??null}/>
 </>;
}

/** Sign-in through the Telegram bot: connects the bot's webhook to this site once; until then the widget stays. */
export function TelegramBotSetup(){
 const [status,setStatus]=useState<{configured:boolean;connected:boolean}|null>(null),[busy,setBusy]=useState(false);
 useEffect(()=>{fetch('/api/auth/telegram/connect',{credentials:'same-origin'}).then(response=>response.ok?response.json() as Promise<{configured:boolean;connected:boolean}>:null).then(setStatus).catch(()=>setStatus(null))},[]);
 if(!status)return null;
 async function connect(){
  setBusy(true);
  try{
   const response=await fetch('/api/auth/telegram/connect',{method:'POST',credentials:'same-origin'});
   const data=await response.json().catch(()=>({})) as {ok?:boolean;detail?:string};
   if(!response.ok||!data.ok)throw Error(data.detail??String(response.status));
   setStatus({configured:true,connected:true});toast.success('Бот подключён: кнопка входа теперь открывает Telegram.');
  }catch(error){toast.error('Не удалось подключить бота: '+(error as Error).message)}
  finally{setBusy(false)}
 }
 return <div className="notice" role="status"><ShieldCheck/><span>{!status.configured
  ?'Вход через Telegram выключен: задайте секреты TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_USERNAME.'
  :status.connected?'Вход через Telegram-бота подключён к этому сайту. Подключите снова, если сменился адрес сайта или токен бота.'
  :'Вход через Telegram работает старым виджетом. Подключите бота, и кнопка будет сразу открывать приложение Telegram.'}
  {status.configured&&<> <button type="button" className="btn secondary" disabled={busy} onClick={()=>void connect()}>{status.connected?'Подключить снова':'Подключить бота'}</button></>}</span></div>;
}
