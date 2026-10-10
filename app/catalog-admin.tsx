"use client";
/* eslint-disable @next/next/no-img-element */
import {useCallback,useEffect,useMemo,useState} from 'react';
import {BadgeCheck,Check,ChevronDown,EyeOff,FolderPlus,ImageIcon,Link2,Loader2,RefreshCw,Send,Trash2} from 'lucide-react';
import {toast} from 'sonner';
import {Modal} from './market-ui';
import {catalogCategories,catalogIssues,catalogRefreshDueAt,cleanGeneratedCatalogDescription,dueCatalogEntries,isBundledCatalogEntry,isWatchedCatalogEntry,type CatalogCollection,type CatalogDocument,type CatalogDraft,type CatalogEntry} from '@/lib/market/catalog-editor';
import {chunkCatalogIds,parseCatalogImportQueue,removeImportedCatalogLinks} from '@/lib/market/catalog-import-queue';
import {dedupeSafeImages,safeImage} from '@/lib/importer/extract';

type ImportOutcome={url:string;status:'saved'|'failed';id?:string;note?:string;reason?:string};
type Result={published?:number;skipped?:string[];document?:CatalogDocument;urls?:string[];importedId?:string;importNote?:string;results?:ImportOutcome[];recheckResults?:string[];refreshResult?:{selected:number;checked:number;available:number;soldOut:number;unknown:number;failed:number;skipped:number};error?:string};
type ImportStatus='queued'|'importing'|'saved'|'review'|'failed';
type ImportProgress={url:string;status:ImportStatus;detail?:string};
type CatalogScope='queue'|'customer'|'published'|'previous'|'all';
/** Matches the server's batch ceiling: every link in a run is read from its store at the same time. */
const catalogAdminImportBatchSize=25;
const collectionPresets=[
 {name:'Осенняя подборка',nameUz:'Kuzgi to‘plam',nameEn:'Autumn collection'},
 {name:'Готовый образ',nameUz:'Tayyor obraz',nameEn:'Complete outfit'},
 {name:'С одного магазина',nameUz:'Bitta do‘kondan',nameEn:'From one store'},
 {name:'Лучшие скидки',nameUz:'Eng yaxshi chegirmalar',nameEn:'Best deals'},
];
class CatalogRequestError extends Error{constructor(message:string,readonly status?:number){super(message)}}
function hostLabel(url:string){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return url.slice(0,72)}}
function originLabel(origin:CatalogDocument['entries'][number]['origin']){return origin==='customer-link'?'Ссылка клиента':origin==='operator-import'?'Импорт админом':origin==='bundled'?'Стартовый каталог':'Ранее добавлен'}
function inheritedCollections(url:string,document:CatalogDocument){try{const host=new URL(url).hostname.replace(/^www\./,'');const counts=new Map<string,number>();for(const entry of document.entries){try{if(new URL(entry.draft.sourceUrl).hostname.replace(/^www\./,'')===host)for(const id of entry.draft.collectionIds)counts.set(id,(counts.get(id)??0)+1)}catch{}}return [...counts].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([id])=>id)}catch{return []}}
export function CatalogAdmin(){
 const [document,setDocument]=useState<CatalogDocument|null>(null),[urls,setUrls]=useState(''),[country,setCountry]=useState('США'),[collectionIds,setCollectionIds]=useState<string[]>([]),[busy,setBusy]=useState(''),[selected,setSelected]=useState<string[]>([]),[open,setOpen]=useState<string|null>(null),[importProgress,setImportProgress]=useState<ImportProgress[]>([]);
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[scope,setScope]=useState<CatalogScope>('queue'),[visibleCount,setVisibleCount]=useState(24),[deleteDraftIds,setDeleteDraftIds]=useState<string[]>([]),[refreshClock]=useState(()=>Date.now());
 const [newCollection,setNewCollection]=useState<{name:string;nameUz:string;nameEn:string}|null>(null);
 const load=useCallback(async()=>{const r=await fetch('/api/catalog?admin=1',{cache:'no-store'}),data=await r.json() as Result;if(!r.ok||!data.document)throw Error(data.error??'Не удалось загрузить витрину.');setDocument(data.document);return data.document},[]);
 // Loading is the external synchronization performed by this effect.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{void load().catch(error=>toast.error((error as Error).message))},[load]);
 const call=async(command:unknown,revision=document?.revision)=>{if(!document||revision===undefined)throw new Error('Каталог загружается.');const r=await fetch('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,command})});let data:Result={};try{data=await r.json() as Result}catch{}if(!r.ok)throw new CatalogRequestError(data.error??'Не удалось сохранить каталог.',r.status);if(data.document)setDocument(data.document);return data};
 async function importAll(){
   const parsed=parseCatalogImportQueue(urls),batch=parsed.links.slice(0,catalogAdminImportBatchSize);if(!batch.length||!document)return;
   setBusy('import');setImportProgress(batch.map(url=>({url,status:'importing'})));
   let revision=document.revision,data:Result|undefined,failureMessage='';
   try{
    // One request reads every store concurrently and writes the catalog once; a 409 only means another tab saved first, so reload and send again.
    for(let attempt=0;attempt<2&&!data;attempt++){
     const suggested=collectionIds.length?collectionIds:inheritedCollections(batch[0],document);
     try{data=await call({kind:'import-batch',urls:batch,collectionIds:suggested,country},revision)}
     catch(error){
      const failure=error as CatalogRequestError;failureMessage=failure.message;
      if(failure.status===409&&attempt===0){try{revision=(await load()).revision;continue}catch{}}
      break;
     }
    }
    if(!data){setImportProgress(batch.map(url=>({url,status:'failed',detail:failureMessage||'Не удалось добавить черновики.'})));toast.error(failureMessage||'Не удалось добавить черновики.');return}
    const results=data.results??[];
    const saved=results.filter(item=>item.status==='saved'),review=saved.filter(item=>item.note),failed=results.filter(item=>item.status==='failed');
    setImportProgress(batch.map(url=>{const outcome=results.find(item=>item.url===url);if(!outcome)return {url,status:'failed',detail:'Сервер не вернул результат для этой ссылки.'};if(outcome.status==='failed')return {url,status:'failed',detail:outcome.reason??'Не удалось добавить черновик.'};return outcome.note?{url,status:'review',detail:`Черновик на ручную проверку: ${outcome.note}`}:{url,status:'saved',detail:'Черновик сохранён'}}));
    setUrls(value=>removeImportedCatalogLinks(value,saved.map(item=>item.url)));
    const firstImportedId=saved[0]?.id;
    if(firstImportedId){setOpen(firstImportedId);window.setTimeout(()=>window.document.getElementById(`catalog-${firstImportedId}`)?.scrollIntoView({behavior:'smooth',block:'center'}),80)}
    // Everything that passes review goes live at once; only the doubtful cards wait for a look.
    let live=0;const readyIds=saved.filter(item=>!item.note&&item.id).map(item=>item.id!);
    if(readyIds.length){try{const published=await call({kind:'publish',ids:readyIds},data.document?.revision);live=published.published??0}catch{}}
    const waiting=saved.length-live;void review;
    const summary=`В каталоге: ${live}${waiting?`, на проверке: ${waiting}`:''}.`;
    if(failed.length)toast.warning(`${summary} Не добавлено: ${failed.length} — ссылки остались в поле.`);
    else if(waiting)toast.warning(`${summary} Откройте «Новые на проверку».`);
    else toast.success(summary);
   }finally{setBusy('')}
 }
 async function discover(){const {links}=parseCatalogImportQueue(urls);if(links.length!==1)return;setBusy('discover');try{const data=await call({kind:'discover',url:links[0]});setUrls((data.urls??[]).join('\n'));setImportProgress([]);toast.success(`Найдено ссылок: ${data.urls?.length??0}`)}catch(error){toast.error((error as Error).message)}finally{setBusy('')}}
 async function command(value:unknown,message:string){setBusy('save');try{const data=await call(value);const skipped=data.skipped??[];if(skipped.length){setSelected(current=>current.filter(id=>document?.entries.find(item=>item.id===id)&&!data.document?.entries.find(item=>item.id===id)?.published));toast.warning(`Опубликовано: ${data.published??0}. Не прошли проверку (${skipped.length}): ${skipped.slice(0,3).join('; ')}${skipped.length>3?'…':''} — откройте карточки, исправьте и повторите.`,{duration:12000})}else{setSelected([]);toast.success(message)}}catch(error){toast.error((error as Error).message)}finally{setBusy('')}}
 async function deleteDrafts(ids:string[]){if(!ids.length)return;setBusy('delete');try{await call({kind:'delete-drafts',ids});setSelected(current=>current.filter(id=>!ids.includes(id)));setDeleteDraftIds([]);toast.success(`Удалено черновиков: ${ids.length}`)}catch(error){toast.error((error as Error).message)}finally{setBusy('')}}
  async function recheck(ids:string[]){
   const queue=[...new Set(ids)];if(!queue.length||!document)return;
   setBusy('recheck');let revision=document.revision,checked=0,attention=0;
   try{
    const chunks=chunkCatalogIds(queue);
    for(let chunkIndex=0;chunkIndex<chunks.length;chunkIndex++){
     const start=chunkIndex*10,chunk=chunks[chunkIndex];let complete=false;
     for(let attempt=0;attempt<2&&!complete;attempt++){
      try{
       const result=await call({kind:'recheck',ids:chunk},revision);
       revision=result.document?.revision??revision+1;
       const failed=(result.recheckResults??[]).filter(line=>!line.endsWith(': проверено')).length;
       checked+=chunk.length;attention+=failed;complete=true;
      }catch(error){
       const failure=error as CatalogRequestError;
       if(failure.status===409&&attempt===0){try{revision=(await load()).revision;continue}catch{}}
       setSelected(queue.slice(start));
       toast.warning(`Проверено: ${checked}; требуют внимания: ${attention}. Не обработано: ${queue.length-start}. ${failure.message}`);
       return;
      }
     }
    }
    setSelected([]);
    if(attention)toast.warning(`Проверка завершена: ${checked}; требуют внимания: ${attention}. Откройте карточки для просмотра изменений.`);
    else toast.success(`Проверены все выбранные товары: ${checked}`);
   }finally{setBusy('')}
  }
 async function refreshDue(){if(!document)return;setBusy('refresh-due');try{const data=await call({kind:'refresh-due'}),result=data.refreshResult;if(!result){toast.success('Проверка очереди завершена');return}if(result.soldOut)toast.warning(`Скрыто после подтверждения магазина: ${result.soldOut}`);else if(result.failed||result.unknown)toast.warning(`Проверено: ${result.checked}; требуют внимания: ${result.failed+result.unknown}`);else toast.success(result.checked?`Обновлено по источнику: ${result.checked}`:'Сейчас нет товаров для проверки')}catch(error){toast.error((error as Error).message)}finally{setBusy('')}}
 async function addCollection(){if(!newCollection?.name.trim()||!document)return;const id='collection-'+crypto.randomUUID();setBusy('save');try{await call({kind:'collection',collection:{id,name:newCollection.name.trim(),nameUz:newCollection.nameUz.trim(),nameEn:newCollection.nameEn.trim(),description:'',visible:true,position:document.collections.length}});setCollectionIds(ids=>[...ids,id]);setNewCollection(null);toast.success('Подборка создана')}catch(error){toast.error((error as Error).message)}finally{setBusy('')}}
 async function saveDraft(id:string,draft:CatalogDraft){await command({kind:'edit',id,draft},'Карточка сохранена')}
  // Cards held back only by stock/freshness doubts: one click publishes them as "availability confirmed by the operator".
  const soft=useMemo(()=>document?.entries.filter(e=>!e.published&&e.queueState==='queued'&&catalogIssues(e.draft).length>0&&catalogIssues(e.draft).every(issue=>['Обновите источник','Ошибка проверки магазина','Наличие не подтверждено магазином','Подтвердите доступный вариант'].includes(issue)||issue.startsWith('Цена:')||issue.startsWith('Доступные варианты')||issue.startsWith('Название в магазине')||issue.startsWith('Вес магазина')||issue.startsWith('Валюта:'))).map(e=>e.id)??[],[document]);
  const ready=useMemo(()=>document?.entries.filter(e=>!catalogIssues(e.draft).length&&!e.published&&e.queueState==='queued').map(e=>e.id)??[],[document]);
 if(!document)return <section className="surface admin-section" role="status"><Loader2 className="spin"/> Загружаем витрину…</section>;
  const newQueueCount=document.entries.filter(entry=>entry.queueState==='queued'&&!entry.published).length,customerQueueCount=document.entries.filter(entry=>entry.origin==='customer-link'&&!entry.published).length,publishedCount=document.entries.filter(entry=>!!entry.published).length,previousCount=document.entries.filter(entry=>!entry.published&&entry.queueState!=='queued').length;
  const scopeEntries=document.entries.filter(entry=>scope==='queue'?entry.queueState==='queued'&&!entry.published:scope==='customer'?entry.origin==='customer-link'&&!entry.published:scope==='published'?!!entry.published:scope==='previous'?!entry.published&&entry.queueState!=='queued':true);
  const dueEntryIds=new Set(dueCatalogEntries(document,refreshClock).map(entry=>entry.id));
 const filteredEntries=[...scopeEntries].filter(entry=>[entry.draft.name,entry.draft.brand,entry.draft.sourceUrl].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase())).filter(entry=>filter==='all'||(filter==='stale'&&dueEntryIds.has(entry.id))||(filter==='published'&&!!entry.published)||(filter==='draft'&&!entry.published)||(filter==='attention'&&catalogIssues(entry.draft).length>0)||(filter==='no-image'&&!entry.draft.image)||(filter==='no-variants'&&!entry.draft.variants.some(v=>v.available))).sort((a,b)=>Number(Boolean(catalogIssues(b.draft).length))-Number(Boolean(catalogIssues(a.draft).length))||(b.createdAt??0)-(a.createdAt??0));
 const matchingIds=filteredEntries.map(entry=>entry.id),allMatchingSelected=matchingIds.length>0&&matchingIds.every(id=>selected.includes(id)),selectedDraftIds=selected.filter(id=>{const entry=document.entries.find(item=>item.id===id);return !!entry&&!entry.published&&!isBundledCatalogEntry(id)});
  const importQueue=parseCatalogImportQueue(urls),importBatch=importQueue.links.slice(0,catalogAdminImportBatchSize),settledImports=importProgress.filter(item=>item.status!=='importing'&&item.status!=='queued').length,savedImports=importProgress.filter(item=>item.status==='saved'||item.status==='review').length;
  const reports=(document.availabilityReports??[]).filter(report=>!report.resolvedAt);
 const due=dueCatalogEntries(document,refreshClock).length;
 return <section className="catalog-workspace">
  <section className="surface catalog-importer"><div><span className="eyebrow">БЫСТРОЕ ДОБАВЛЕНИЕ</span><h2>Вставьте ссылки — товары попадут в каталог</h2><p>Список, текст из чата или таблицы — лишнее отбросится. Что прочиталось без сомнений, публикуется сразу; остальное ждёт вашей проверки.</p></div>
   <textarea aria-label="Ссылки товаров или коллекции" disabled={busy==='import'} value={urls} onChange={e=>{setUrls(e.target.value);setImportProgress([])}} placeholder={'https://магазин.com/products/товар-1\nhttps://магазин.com/products/товар-2'}/>
   <div className="catalog-import-queue-summary" aria-live="polite"><span>{importQueue.links.length} уникальных ссылок</span><span>За один запуск: до {catalogAdminImportBatchSize}</span>{importQueue.duplicates>0&&<span>Повторы пропущены: {importQueue.duplicates}</span>}{importQueue.invalid.length>0&&<span>Строк без ссылки: {importQueue.invalid.length}</span>}{importQueue.links.length>catalogAdminImportBatchSize&&<span>В очереди останется: {importQueue.links.length-catalogAdminImportBatchSize}</span>}</div>
   {importQueue.links.length>catalogAdminImportBatchSize&&<p className="catalog-import-hint">За один запуск обрабатывается до {catalogAdminImportBatchSize} ссылок. Остальные остаются в поле — вставлять их повторно не нужно.</p>}
   {importProgress.length>0&&<div className="catalog-import-progress" aria-live="polite"><div className="catalog-import-progress-head"><strong>Импорт: {settledImports} из {importProgress.length}</strong><span>Добавлено черновиков: {savedImports}</span></div><progress max={importProgress.length} value={settledImports}/><ul>{importProgress.map(item=><li key={item.url} className={`import-${item.status}`}><span>{hostLabel(item.url)}</span><small>{item.detail??(item.status==='importing'?'Читаем магазин…':item.status==='queued'?'В очереди':'')}</small></li>)}</ul></div>}
   <details className="catalog-import-options"><summary>Страна и подборки — по умолчанию подбираются сами</summary><label>Страна отправки<input value={country} maxLength={80} onChange={e=>setCountry(e.target.value)}/></label><fieldset><legend>Подборки</legend><div>{document.collections.map(c=><label key={c.id}><input type="checkbox" checked={collectionIds.includes(c.id)} onChange={e=>setCollectionIds(e.target.checked?[...collectionIds,c.id]:collectionIds.filter(id=>id!==c.id))}/>{c.name}</label>)}<button type="button" className="text-button" onClick={()=>setNewCollection({name:'',nameUz:'',nameEn:''})}><FolderPlus size={16}/>Новая подборка</button></div></fieldset></details>
   <div className="catalog-import-actions"><button className="btn primary" disabled={!!busy||!importBatch.length} onClick={()=>void importAll()}>{busy==='import'?<Loader2 className="spin"/>:<Link2/>}{busy==='import'?`Читаем ${importBatch.length} магазинов…`:`Добавить в каталог (${importBatch.length})`}</button><button className="btn secondary" disabled={!!busy||importQueue.links.length!==1} onClick={()=>void discover()}><RefreshCw/>Найти товары на странице коллекции</button></div>
  </section>
  <section className="surface admin-section"><div className="admin-section-head"><div><h2>Подборки на главной</h2><p>Используйте их для одежды, косметики, распродаж, брендов или сезонных предложений.</p></div><button className="btn secondary" onClick={()=>setNewCollection({name:'',nameUz:'',nameEn:''})}><FolderPlus/>Создать</button></div>
   <div className="catalog-collections">{document.collections.length?[...document.collections].sort((a,b)=>a.position-b.position).map(c=><CollectionRow key={`${c.id}:${document.revision}`} value={c} disabled={!!busy} onSave={collection=>void command({kind:'collection',collection},'Подборка сохранена')}/>):<p className="micro">Создайте первую подборку и выберите её при импорте.</p>}</div>
  </section>
  <section className="surface admin-section"><div className="admin-section-head"><div><h2>Каталог и новые товары</h2><p>Новые ссылки клиентов и импорты админа разделены; старые и скрытые карточки остаются доступными для проверки. После публикации кнопка заказа автоматически доступна на каждой карточке; перед корзиной цена и вариант проверяются.</p></div><div className="catalog-bulk-actions"><button className="btn secondary" disabled={!!busy||!due} onClick={()=>void refreshDue()}>{busy==='refresh-due'?<Loader2 className="spin"/>:<RefreshCw/>}Обновить источники ({due})</button><button className="btn primary" disabled={!!busy||!ready.length} onClick={()=>void command({kind:'publish',ids:ready},`Опубликовано: ${ready.length}`)}><Send/>Опубликовать готовые ({ready.length})</button>{soft.length>0&&<button className="btn secondary" disabled={!!busy} title="Вы сами проверили наличие в магазинах: карточки публикуются с отметкой оператора. Без фото и цены не публикуются." onClick={()=>void command({kind:'confirm',ids:soft},`Опубликовано с подтверждением оператора: ${soft.length}`)}><BadgeCheck/>Наличие проверил — опубликовать ещё {soft.length}</button>}</div></div>
   <p className="micro">Источники перепроверяются автоматически каждый час; товар скрывается, только если магазин подтвердил, что всё распродано.</p>
   <nav className="catalog-scope-tabs" aria-label="Разделы каталога">
    {[{id:'queue' as const,label:'Новые на проверку',count:newQueueCount},{id:'customer' as const,label:'Ссылки клиентов',count:customerQueueCount},{id:'published' as const,label:'В каталоге',count:publishedCount},{id:'previous' as const,label:'Старые и скрытые',count:previousCount},{id:'all' as const,label:'Все товары',count:document.entries.length}].map(tab=><button type="button" key={tab.id} className={scope===tab.id?'active':''} aria-pressed={scope===tab.id} onClick={()=>{setScope(tab.id);setSelected([]);setVisibleCount(24)}}>{tab.label}<span>{tab.count}</span></button>)}
   </nav>
   <div className="catalog-review-controls"><input type="search" aria-label="Поиск товаров" placeholder="Товар, бренд или магазин" value={search} onChange={e=>{setSearch(e.target.value);setSelected([]);setVisibleCount(24)}}/><select aria-label="Статус товаров" value={filter} onChange={e=>{setFilter(e.target.value);setSelected([]);setVisibleCount(24)}}><option value="all">Все статусы</option><option value="published">Опубликованы</option><option value="draft">Черновики</option><option value="attention">Требуют проверки</option><option value="stale">Просрочена проверка источника</option><option value="no-image">Без фото</option><option value="no-variants">Без доступных вариантов</option></select></div>
   <div className="catalog-selection-toolbar"><span>{selected.length?`Выбрано: ${selected.length}`:`Найдено: ${filteredEntries.length}`}</span><button type="button" className="btn secondary" disabled={!matchingIds.length||!!busy} onClick={()=>setSelected(current=>allMatchingSelected?current.filter(id=>!matchingIds.includes(id)):[...new Set([...current,...matchingIds])])}>{allMatchingSelected?'Снять выделение':`Выбрать все найденные (${matchingIds.length})`}</button>{selected.length>0&&<><button type="button" className="btn secondary" disabled={!!busy} onClick={()=>void recheck(selected)}>{busy==='recheck'?<Loader2 className="spin"/>:<RefreshCw/>}{busy==='recheck'?'Проверяем всю выборку…':`Проверить всё выбранное (${selected.length})`}</button><button type="button" className="btn secondary" disabled={!!busy} title="Вы сами проверили наличие в магазине: карточка публикуется с отметкой оператора без ответа магазина" onClick={()=>void command({kind:'confirm',ids:selected},`Опубликовано с подтверждением оператора: ${selected.length}`)}><BadgeCheck/>Подтвердить наличие и опубликовать ({selected.length})</button><button type="button" className="btn secondary" disabled={!!busy} onClick={()=>void command({kind:'hide',ids:selected},'Карточки убраны из показа и сохранены')}><EyeOff/>Убрать из показа ({selected.length})</button>{selectedDraftIds.length>0&&<button type="button" className="btn catalog-delete-action" disabled={!!busy} onClick={()=>setDeleteDraftIds(selectedDraftIds)}><Trash2/>Удалить черновики ({selectedDraftIds.length})</button>}</>}{selected.length>0&&<button type="button" className="text-button" onClick={()=>setSelected([])}>Снять выбор</button>}</div>
   <div className="catalog-drafts">{filteredEntries.slice(0,visibleCount).map(entry=>{const issues=catalogIssues(entry.draft),published=!!entry.published,entryReports=reports.filter(report=>report.productId===entry.id),expanded=open===entry.id,canDelete=!published&&!isBundledCatalogEntry(entry.id),status=issues.length?`Нужно проверить · ${issues.length}`:isWatchedCatalogEntry(entry)&&!published?'Скрыт: нет в наличии':entry.queueState==='archived'?'Скрыт':entry.queueState==='queued'?'Новая · очередь':published?'Опубликован':'Черновик';return <article id={`catalog-${entry.id}`} key={entry.id} className={`catalog-draft${expanded?' expanded':''}`}><label className="catalog-select"><input type="checkbox" aria-label={`Выбрать: ${entry.draft.name||'товар без названия'}`} checked={selected.includes(entry.id)} onChange={e=>setSelected(current=>e.target.checked?[...new Set([...current,entry.id])]:current.filter(id=>id!==entry.id))}/><span className={issues.length?'draft-review':published?'draft-live':entry.queueState==='queued'?'draft-new':'draft-ready'}>{issues.length?status:entryReports.length?`${entryReports.length} сообщений`:status}</span></label><button className="catalog-draft-summary" type="button" aria-expanded={expanded} aria-controls={`catalog-editor-${entry.id}`} onClick={()=>setOpen(expanded?null:entry.id)}>{entry.draft.image?<img src={entry.draft.image} alt="" loading="lazy"/>:<span><ImageIcon/></span>}<div><b>{entry.draft.name||'Без названия'}</b><small>{originLabel(entry.origin)} · {new URL(entry.draft.sourceUrl).hostname} · {entry.draft.price??'—'} {entry.draft.currency}</small><em>{catalogEntrySummary(entry,issues,entryReports)}</em>{entry.draft.confirmedAt!==undefined&&<span className="catalog-operator-confirmed"><BadgeCheck aria-hidden="true"/>{operatorConfirmedLabel(entry.draft.confirmedAt)}</span>}</div><ChevronDown className={expanded?'open':''}/></button>{expanded&&<DraftEditor id={`catalog-editor-${entry.id}`} entry={entry} collections={document.collections} disabled={!!busy} canDelete={canDelete} onDelete={()=>setDeleteDraftIds([entry.id])} onSave={draft=>void saveDraft(entry.id,draft)} onPublish={()=>void command({kind:'publish',ids:[entry.id]},'Товар опубликован')} onConfirm={()=>void command({kind:'confirm',ids:[entry.id]},'Опубликовано с подтверждением оператора: 1')} onHide={()=>void command({kind:'hide',ids:[entry.id]},'Товар убран из каталога')}/>}</article>})}</div>
   {!filteredEntries.length&&<p className="catalog-empty-state" role="status">{scope==='queue'&&!search&&filter==='all'?'В этом разделе пока нет карточек. Добавьте ссылки выше или выберите другой раздел.':`По вашему запросу товаров нет. Измените поиск или фильтр.`}</p>}
   {filteredEntries.length>visibleCount&&<button className="btn secondary" onClick={()=>setVisibleCount(n=>n+24)}>Показать ещё</button>}
  </section>
  <Modal open={newCollection!==null} onClose={()=>setNewCollection(null)} title="Новая подборка" description="Выберите готовый вариант — названия RU/UZ/EN заполнятся автоматически. Для своего названия достаточно RU; незаполненные языки покажут русское название.">
    <form className="collection-create-form" onSubmit={event=>{event.preventDefault();void addCollection()}}><fieldset className="collection-presets"><legend>Готовые подборки</legend><div>{collectionPresets.map(preset=><button key={preset.name} type="button" className="btn secondary" onClick={()=>setNewCollection(preset)}>{preset.name}</button>)}</div></fieldset>
      <label>Название · RU<input autoFocus maxLength={100} required value={newCollection?.name??''} onChange={event=>setNewCollection(value=>value?{...value,name:event.target.value}:value)}/></label>
      <label>Название · UZ<input maxLength={100} value={newCollection?.nameUz??''} onChange={event=>setNewCollection(value=>value?{...value,nameUz:event.target.value}:value)}/></label>
      <label>Название · EN<input maxLength={100} value={newCollection?.nameEn??''} onChange={event=>setNewCollection(value=>value?{...value,nameEn:event.target.value}:value)}/></label>
      <button className="btn primary" type="submit" disabled={!!busy||!newCollection?.name.trim()}>{busy?'Сохраняем…':'Создать подборку'}</button>
    </form>
  </Modal>
  <Modal open={deleteDraftIds.length>0} onClose={()=>setDeleteDraftIds([])} title="Удалить черновики?" description="Удалённые черновики нельзя восстановить. Заказы и сохранённые снимки товаров не изменятся; опубликованные и встроенные карточки здесь не удаляются.">
    <div className="catalog-delete-dialog-actions"><button className="btn secondary" type="button" onClick={()=>setDeleteDraftIds([])}>Отмена</button><button className="btn catalog-delete-action" type="button" disabled={!!busy} onClick={()=>void deleteDrafts(deleteDraftIds)}>{busy==='delete'?<Loader2 className="spin"/>:<Trash2/>}Удалить ({deleteDraftIds.length})</button></div>
  </Modal>
 </section>
}
function catalogEntrySummary(entry:CatalogEntry,issues:string[],reports:NonNullable<CatalogDocument['availabilityReports']>){
 const error=entry.refresh?.lastError??entry.draft.lastCheckError;
 if(error)return `Детали проверки: ${error}`;
 if(issues.length)return issues.join(' · ');
 if(reports.length)return reports.map(report=>(report.answer==='unavailable'?'Нет в наличии':'Есть в наличии')+(report.variant?' · '+report.variant:'')+' · '+new Date(report.createdAt).toLocaleDateString('ru-RU')).join(' / ');
 if(entry.refresh?.lastSuccessAt)return `Источник проверен: ${new Date(entry.refresh.lastSuccessAt).toLocaleString('ru-RU')}`;
 return `${entry.createdAt?`Добавлен ${new Date(entry.createdAt).toLocaleDateString('ru-RU')} · `:''}${entry.draft.variants.filter(variant=>variant.available).length} вариантов · ${entry.draft.images.length} фото`;
}
function catalogDate(value?:number){return typeof value==='number'&&Number.isFinite(value)?new Date(value).toLocaleString('ru-RU'):'Нет данных'}
function operatorConfirmedLabel(confirmedAt:number){return `Наличие подтверждено оператором ${new Date(confirmedAt).toLocaleDateString('ru-RU')}`}
function CatalogRefreshDiagnostics({entry}:{entry:CatalogEntry}){
 const {refresh,draft}=entry,autoRefreshEnabled=isWatchedCatalogEntry(entry),nextCheckAt=refresh?.nextCheckAt??(autoRefreshEnabled?catalogRefreshDueAt(entry):undefined),nextCheckLabel=!autoRefreshEnabled?'После публикации':typeof nextCheckAt!=='number'?'Не назначена':catalogDate(nextCheckAt),lastError=refresh?.lastError??draft.lastCheckError;
 const status=refresh?.status==='available'?'Источник проверен и карточка обновлена':refresh?.status==='sold-out'?'Магазин подтвердил отсутствие вариантов':refresh?.status==='unknown'?'Ответ получен, данных для обновления недостаточно':refresh?.status==='failed'?'Ошибка запроса или обработки ответа':'Автоматическая проверка ещё не запускалась';
 const statusClass=refresh?.status==='failed'?'failed':refresh?.status==='unknown'||refresh?.status==='sold-out'?'attention':refresh?.status==='available'?'success':'neutral';
 return <section className="catalog-refresh-diagnostics" aria-label="Диагностика проверки магазина">
  <div className="catalog-refresh-diagnostics-head"><div><h3>Проверка магазина</h3><p className={`catalog-refresh-status ${statusClass}`}>{status}</p></div>{(refresh?.consecutiveFailures??0)>0&&<span className="catalog-refresh-failure-count">Ошибок подряд: {refresh?.consecutiveFailures}</span>}</div>
  <dl><div><dt>Последняя попытка</dt><dd>{catalogDate(refresh?.lastAttemptAt)}</dd></div><div><dt>Последний успешный ответ</dt><dd>{catalogDate(refresh?.lastSuccessAt)}</dd></div><div><dt>Дата данных карточки</dt><dd>{catalogDate(draft.checkedAt)}</dd></div><div><dt>Следующая проверка / повтор</dt><dd>{nextCheckLabel}</dd></div></dl>
  {lastError?<p className="catalog-refresh-error" role="status"><strong>Детали последней проверки:</strong> {lastError}</p>:<p className="catalog-refresh-no-error">Подробностей ошибки нет.</p>}
  {refresh?.lastChange&&<p className="catalog-refresh-change"><strong>Изменения источника:</strong> {refresh.lastChange}</p>}
  {draft.confirmedAt!==undefined&&<p className="catalog-operator-confirmed"><BadgeCheck aria-hidden="true"/>{operatorConfirmedLabel(draft.confirmedAt)} · следующий успешный ответ магазина заменит эту отметку</p>}
 </section>
}
function CollectionRow({value,disabled,onSave}:{value:CatalogCollection;disabled:boolean;onSave:(v:CatalogCollection)=>void}){const [draft,setDraft]=useState(value);return <article><input aria-label="Название подборки" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/><input aria-label="Название на узбекском" placeholder="UZ" value={draft.nameUz} onChange={e=>setDraft({...draft,nameUz:e.target.value})}/><input aria-label="Название на английском" placeholder="EN" value={draft.nameEn} onChange={e=>setDraft({...draft,nameEn:e.target.value})}/><label><input type="checkbox" checked={draft.visible} onChange={e=>setDraft({...draft,visible:e.target.checked})}/>Показывать</label><button className="btn secondary" disabled={disabled||draft.name.trim().length<1} onClick={()=>onSave(draft)}><Check/>Сохранить</button></article>}
function DraftEditor({id,entry,collections,disabled,canDelete,onDelete,onSave,onPublish,onConfirm,onHide}:{id:string;entry:CatalogEntry;collections:CatalogCollection[];disabled:boolean;canDelete:boolean;onDelete:()=>void;onSave:(v:CatalogDraft)=>void;onPublish:()=>void;onConfirm:()=>void;onHide:()=>void}){
 const {draft}=entry;
 const [value,setValue]=useState<CatalogDraft>(()=>({...draft,description:cleanGeneratedCatalogDescription(draft.description)})),issues=catalogIssues(value),gallery=dedupeSafeImages(value.images,value.sourceUrl);
 return <div id={id} className="catalog-editor">
  <CatalogRefreshDiagnostics entry={entry}/>
  <div className="two-fields"><label>Название<input value={value.name} onChange={e=>setValue({...value,name:e.target.value})}/></label><label>Цена<input type="number" min="0" step=".01" value={value.price??''} onChange={e=>setValue({...value,price:e.target.value?Number(e.target.value):undefined})}/></label></div>
  <label>Главное фото<input type="url" value={value.image} onChange={e=>setValue({...value,image:e.target.value})}/></label>
  <VariantQuickRemove variants={value.variants} onChange={variants=>setValue({...value,variants})}/>
  <fieldset><legend>Подборки</legend><div>{collections.map(c=><label key={c.id}><input type="checkbox" checked={value.collectionIds.includes(c.id)} onChange={e=>setValue({...value,collectionIds:e.target.checked?[...value.collectionIds,c.id]:value.collectionIds.filter(id=>id!==c.id)})}/>{c.name}</label>)}</div></fieldset>
  {issues.length>0&&<p className="catalog-issues">Перед публикацией: {issues.join(', ')}</p>}
  <div className="catalog-editor-actions"><button className="btn secondary" disabled={disabled} onClick={()=>onSave(value)}><Check/>Сохранить</button><button className="btn primary" disabled={disabled||issues.length>0} onClick={onPublish}><Send/>Опубликовать</button><button className="btn secondary" disabled={disabled} title="Вы сами проверили наличие в магазине: карточка публикуется с отметкой оператора" onClick={onConfirm}><BadgeCheck/>Наличие проверил — опубликовать</button><button className="text-button" disabled={disabled} onClick={onHide}><EyeOff/>Убрать из показа</button>{canDelete&&<button className="btn catalog-delete-action" disabled={disabled} onClick={onDelete}><Trash2/>Удалить</button>}</div>
  <details className="catalog-editor-more"><summary>Дополнительно: бренд, вес, доставка, описание, варианты</summary>
  <div className="two-fields"><label>Бренд<input value={value.brand} onChange={e=>setValue({...value,brand:e.target.value})}/></label><label>Категория<select value={value.category} onChange={e=>setValue({...value,category:e.target.value as CatalogDraft['category']})}>{catalogCategories.map(c=><option key={c}>{c}</option>)}</select></label><label>Страна<input value={value.country} onChange={e=>setValue({...value,country:e.target.value})}/></label><label>Валюта<input maxLength={3} value={value.currency} onChange={e=>setValue({...value,currency:e.target.value.toUpperCase()})}/></label><label>Цена до скидки<input type="number" min="0" step=".01" value={value.referencePrice??''} onChange={e=>setValue({...value,referencePrice:e.target.value?Number(e.target.value):undefined})}/></label><label>Вес с коробкой, кг<input type="number" min=".01" max="49.5" step=".01" value={value.boxedWeight} onChange={e=>setValue({...value,boxedWeight:Number(e.target.value)})}/></label><label title="Меньше — выше на витрине; пусто — без позиции, карточка идёт после позиционированных">Позиция на витрине<input type="number" inputMode="numeric" min="0" max="1000" step="1" placeholder="без позиции" value={value.rank??''} onChange={e=>setValue({...value,rank:e.target.value===''?undefined:Math.min(1000,Math.max(0,Math.trunc(Number(e.target.value))||0))})}/></label></div>
  <div className="catalog-shipping-editor"><label>Доставка магазина до склада Atlas, USD<input type="number" min="0" max="10000" step=".01" value={value.sourceShippingUsd??10} onChange={e=>setValue({...value,sourceShippingUsd:e.target.value===''?0:Number(e.target.value)})}/></label><label className="catalog-shipping-estimate"><input type="checkbox" checked={value.sourceShippingEstimated!==false} onChange={e=>setValue({...value,sourceShippingEstimated:e.target.checked})}/>Предварительная сумма — оператор подтвердит её после заказа</label><small>Для подтверждённой бесплатной доставки укажите 0 и снимите отметку.</small></div>
  {!!gallery.length&&<div className="catalog-photo-gallery"><strong>Фото со страницы магазина · {gallery.length}</strong><div>{gallery.map((image,index)=><img key={`${image}:${index}`} src={image} alt={`Фото товара ${index+1}`} loading="lazy"/>)}</div></div>}
  <label>Описание<textarea value={value.description} onChange={e=>setValue({...value,description:e.target.value})}/></label>
  <CatalogVariantMatrix variants={value.variants} sourceUrl={value.sourceUrl} onChange={variants=>setValue({...value,variants})}/>
  </details>
 </div>
}
/** Colors and sizes found on the store page as chips: one tap on × drops every variant of that color or size. */
function VariantQuickRemove({variants,onChange}:{variants:CatalogDraft['variants'];onChange:(variants:CatalogDraft['variants'])=>void}){
 const colors=[...new Set(variants.map(item=>item.color).filter((x):x is string=>!!x))],sizes=[...new Set(variants.map(item=>item.size).filter((x):x is string=>!!x))];
 if(!variants.length)return <p className="catalog-variant-empty">Вариантов нет — добавьте вручную в «Дополнительно».</p>;
 const chips=(title:string,items:string[],key:'color'|'size')=>items.length>0&&<div className="catalog-chip-row"><strong>{title}</strong>{items.map(name=><button type="button" key={name} className="catalog-chip" title={`Убрать все варианты: ${name}`} onClick={()=>onChange(variants.filter(item=>item[key]!==name))}>{name} ×</button>)}</div>;
 return <section className="catalog-variant-quick" aria-label="Цвета и размеры">{chips('Цвета',colors,'color')}{chips('Размеры',sizes,'size')}<small>{variants.length} вариантов. Нажмите на лишний цвет или размер, чтобы убрать его целиком; потом «Сохранить».</small></section>
}
function CatalogVariantMatrix({variants,sourceUrl,onChange}:{variants:CatalogDraft['variants'];sourceUrl:string;onChange:(variants:CatalogDraft['variants'])=>void}){
 const colors=new Set(variants.map(item=>item.color).filter(Boolean)),sizes=new Set(variants.map(item=>item.size).filter(Boolean));
 const update=(index:number,change:Partial<CatalogDraft['variants'][number]>)=>onChange(variants.map((item,itemIndex)=>itemIndex===index?{...item,...change}:item));
 return <section className="catalog-variant-panel" aria-label="Варианты товара">
  <header><div><h3>Размеры, цвета и цены магазина</h3><p>{variants.length} вариантов{colors.size?` · ${colors.size} цветов`:''}{sizes.size?` · ${sizes.size} размеров`:''}</p></div><button type="button" className="btn secondary" disabled={variants.length>=250} onClick={()=>onChange([...variants,{id:crypto.randomUUID(),label:'',available:false,availabilityKnown:false}])}>Добавить вариант</button></header>
  {!variants.length?<p className="catalog-variant-empty">Магазин не отдал варианты. Добавьте проверенный вариант перед публикацией.</p>:<div className="catalog-variant-scroll"><table className="catalog-variant-table"><thead><tr><th>Фото</th><th>Вариант</th><th>Цвет</th><th>Размер</th><th>Цена</th><th>Наличие</th><th></th></tr></thead><tbody>{variants.map((item,index)=>{const image=safeImage(item.image,sourceUrl),availability=item.availabilityKnown===false?'unknown':item.available?'available':'unavailable';return <tr key={item.id??`${item.label}:${index}`}><td>{image?<img src={image} alt="" loading="lazy"/>:<span className="catalog-variant-no-image">—</span>}</td><td><input aria-label={`Название варианта ${index+1}`} value={item.label} onChange={event=>update(index,{label:event.target.value})}/>{item.id&&<small>Артикул варианта: {item.id}</small>}</td><td><input aria-label={`Цвет варианта ${index+1}`} value={item.color??''} onChange={event=>update(index,{color:event.target.value||undefined})}/></td><td><input aria-label={`Размер варианта ${index+1}`} value={item.size??''} onChange={event=>update(index,{size:event.target.value||undefined})}/></td><td><input aria-label={`Цена варианта ${index+1}`} type="number" min="0" step=".01" value={item.price??''} onChange={event=>update(index,{price:event.target.value?Number(event.target.value):undefined})}/></td><td><select aria-label={`Наличие варианта ${index+1}`} value={availability} onChange={event=>{const status=event.target.value;update(index,status==='unknown'?{available:false,availabilityKnown:false}:status==='available'?{available:true,availabilityKnown:true}:{available:false,availabilityKnown:true})}}><option value="unknown">Не подтверждено</option><option value="available">Есть в наличии</option><option value="unavailable">Нет в наличии</option></select></td><td><button type="button" className="text-button" aria-label={`Удалить вариант ${index+1}`} onClick={()=>onChange(variants.filter((_,itemIndex)=>itemIndex!==index))}>Удалить</button></td></tr>})}</tbody></table></div>}
 </section>
}
