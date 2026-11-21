import {storeCountryLabelForUrl} from '@/lib/market/store-brands';
import {desktopStoreUrl,expandShortLink} from '@/lib/importer/short-links';
import {mergeStoreHealth,storeHealthKey,type StoreHealth,type StoreReadOutcome} from '@/lib/market/store-health';
import {database,HttpError,pricing} from '@/lib/market/server';
import {readCatalog,persistCatalog} from '@/lib/market/catalog-server';
import {canonicalCatalogUrl,importDraft,manualFallbackCatalogDraft,isManualCatalogSource,applyAutomaticCatalogImport,sameCatalogGroup} from '@/lib/market/catalog-editor';
import type {CatalogDraft,CatalogDocument} from '@/lib/market/catalog-editor';
import type {Pricing} from '@/lib/market/domain';
import {fetchProduct,ManualEntryFallbackError,describeImportDiagnostic,validateManualSourceUrl} from '@/lib/importer/fetch';
import {canonicalProductUrl} from '@/lib/importer/source-identity';
import type {Extracted} from '@/lib/importer/extract';
import {catalogMerchantRequest as merchantRequest} from '@/lib/importer/worker-fetch';
const catalogImportConcurrency=8;
export function importFailureText(error:unknown){
  const message=error instanceof Error?error.message.trim():'';
  return (message&&/[А-Яа-яЁё]/.test(message)?message:'Не удалось загрузить страницу товара. Проверьте ссылку и повторите позже.').slice(0,500);
}
export function invalidLinkText(error:unknown){
  return error instanceof Error&&error.message.startsWith('Используйте')?error.message:'Это не ссылка на страницу товара. Нужна HTTPS-ссылка поддерживаемого магазина.';
}
type ImportOutcome={url:string;status:'saved'|'failed';manual?:boolean;id?:string;published?:boolean;note?:string;reason?:string;importFailureReason?:CatalogDraft['importFailureReason'];storeReadMs?:number};
type CatalogActor={userId:string;email:string};
type ImportRead=Awaited<ReturnType<typeof readForImport>>;
/** Read one store page; never throws for recoverable merchant failures — those become a reviewable draft. */
export async function readForImport(sourceUrl:string,collectionIds:string[],country:string){
  let data:Extracted|undefined,sourceUnavailable=false,failureMessage='',failureReason:CatalogDraft['importFailureReason']='unknown';
  try{data=await fetchProduct(sourceUrl,merchantRequest)}catch(error){
    const canSaveManualDraft=error instanceof ManualEntryFallbackError||error instanceof Error&&error.name==='AbortError';
    // A confirmed "not found"/ended listing or an unexpected importer error must not become a draft; tell the operator why instead of a generic 503.
    if(!canSaveManualDraft)throw new HttpError(422,importFailureText(error));
    sourceUnavailable=true;
    failureMessage=error instanceof Error&&error.name!=='AbortError'?error.message:'Магазин не ответил вовремя. Повторите проверку позже.';
    // The operator sees what the store answered; customers never get this detail.
    const detail=error instanceof ManualEntryFallbackError?describeImportDiagnostic(error.diagnostic):'';
    if(detail)failureMessage=`${failureMessage} (${detail})`;
    failureReason=error instanceof ManualEntryFallbackError?error.reason:error instanceof Error&&error.name==='AbortError'?'timeout':'unknown';
    data=error instanceof ManualEntryFallbackError?error.partial:undefined;
  }
  const now=Date.now();
  // Where it ships from: the store's own page first (importDraft), then the operator's choice, then the store list.
  const shipsFrom=country||storeCountryLabelForUrl(sourceUrl);
  const draft=sourceUnavailable
    ?manualFallbackCatalogDraft(data,sourceUrl,collectionIds,shipsFrom,now,failureMessage,failureReason)
    :importDraft(data!,collectionIds,shipsFrom,now);
  // Best Buy and the other stores Atlas does not read become a card for the operator to fill in, not a failure.
  const manual=sourceUnavailable&&isManualCatalogSource(sourceUrl);
  return {draft,sourceUnavailable,failureMessage,failureReason,manual};
}
/** A manual card is the operator's to fill in and publish: the scheduler and automatic publication leave it alone. */
function handOverManual(document:{entries:{id:string;autoManaged?:boolean}[]},id:string){
  const entry=document.entries.find(item=>item.id===id);if(entry)entry.autoManaged=false;
}
const manualNote='Ручной ввод: откройте карточку и заполните её со страницы магазина.';
/** A phone's share link (m.zara.com) or a store short link (a.co, amzn.to, ebay.us) reads as the store page, as for customers. */
export async function storePageUrl(value:string){
  const url=desktopStoreUrl(await expandShortLink(validateManualSourceUrl(value.trim())));
  return canonicalProductUrl(url.href);
}
export async function readStoreHealth():Promise<StoreHealth>{
  try{const row=await database().prepare('SELECT value FROM market_settings WHERE key=?').bind(storeHealthKey).first<{value:string}>();return row?JSON.parse(row.value) as StoreHealth:{}}catch{return {}}
}
/** One write per batch; a failed write never fails the import (the map is advice for the operator). */
export async function recordStoreHealth(outcomes:StoreReadOutcome[],userId:string){
  if(!outcomes.length)return;
  try{const now=Date.now(),next=mergeStoreHealth(await readStoreHealth(),outcomes,now);
    await database().prepare('INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by').bind(storeHealthKey,JSON.stringify(next),now,userId).run();
  }catch(error){console.error('Store health write failed',error)}
}
async function mapConcurrent<T,R>(items:T[],limit:number,task:(item:T,index:number)=>Promise<R>){
  const results:R[]=new Array(items.length);let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const index=next++;results[index]=await task(items[index],index)}}));
  return results;
}
/** Bound both the entire batch and each merchant; one slow source cannot serialize other stores. */
export async function mapMerchantConcurrent<T>(urls:string[],task:(url:string)=>Promise<T>){
 const groups=new Map<string,{url:string;index:number}[]>();
 urls.forEach((url,index)=>{let host:string;try{host=new URL(url).hostname.replace(/^www\./,'')}catch{host='invalid'};groups.set(host,[...(groups.get(host)??[]),{url,index}])});
 const results:T[]=new Array(urls.length);
 await mapConcurrent([...groups.values()],catalogImportConcurrency/2,group=>mapConcurrent(group,2,async item=>{results[item.index]=await task(item.url)}));
 return results;
}

function validateCollections(document:CatalogDocument,ids:string[]){
  if(ids.some(id=>!document.collections.some(collection=>collection.id===id)))throw new HttpError(400,'err_33');
}

// A merchant read can outlast an unrelated catalog update. Retry only the CAS, with the same store observation.
async function saveImport<T>(initial:CatalogDocument,user:CatalogActor,action:string,collectionIds:string[],apply:(document:CatalogDocument,removed:CatalogDraft[],rates:Pricing['rates'])=>{result:T;saved:number;failed?:number}){
  const {rates}=await pricing();
  for(let attempt=0;;attempt++){
    const {document,raw}=await readCatalog();
    validateCollections(document,collectionIds);
    const ids=new Set(document.entries.map(entry=>entry.id));
    const removed=initial.entries.filter(entry=>!ids.has(entry.id)).map(entry=>entry.draft);
    const {result,saved,failed}=apply(document,removed,rates);
    if(!saved)return {document,result};
    document.revision++;
    try{
      await persistCatalog(document,raw,user,action,failed===undefined?undefined:{count:saved,failed});
      return {document,result};
    }catch(error){
      if(!(error instanceof HttpError&&error.status===409)||attempt>=2)throw error;
    }
  }
}

function applyImportRead(document:CatalogDocument,removed:CatalogDraft[],read:ImportRead,rates:Pricing['rates']){
  const draft=read.draft;
  if(removed.some(previous=>sameCatalogGroup(previous,draft)))throw new HttpError(409,'Карточка удалена во время импорта. Добавьте ссылку заново, если её нужно восстановить.');
  const hasLaterCheck=document.entries.some(entry=>{
    const checkedAt=entry.refresh?.status==='sold-out'?Math.max(entry.draft.checkedAt,entry.refresh.lastSuccessAt??0):entry.draft.checkedAt;
    return checkedAt>draft.checkedAt&&sameCatalogGroup(entry.draft,draft);
  });
  if(hasLaterCheck)throw new HttpError(409,'Карточка уже получила более свежие данные магазина. Обновите каталог.');
  const outcome=applyAutomaticCatalogImport(document,draft,Date.now(),rates);
  if(read.manual){
    handOverManual(document,outcome.id);
    return {id:outcome.id,published:false,note:manualNote,manual:true};
  }
  return {...outcome,...(read.sourceUnavailable?{note:read.failureMessage.slice(0,500),importFailureReason:read.failureReason}:{})};
}

export function saveCatalogItem(initial:CatalogDocument,user:CatalogActor,read:ImportRead){
  return saveImport(initial,user,'catalog.import',read.draft.collectionIds,(document,removed,rates)=>({
    result:applyImportRead(document,removed,read,rates),saved:1,
  }));
}

export async function processCatalogBatch(initial:CatalogDocument,user:CatalogActor,command:{urls:string[];collectionIds:string[];country:string}){
  validateCollections(initial,command.collectionIds);
  const urls=[...new Set(command.urls.map(value=>value.trim()).filter(Boolean))];
  const bySource=new Map<string,Promise<ImportRead>>();
  const reads=await mapMerchantConcurrent(urls,async(url):Promise<ImportOutcome|{url:string;read:ImportRead;storeReadMs?:number}>=>{
    let sourceUrl:string;
    try{sourceUrl=canonicalCatalogUrl(await storePageUrl(url))}catch(error){return {url,status:'failed',reason:invalidLinkText(error)}}
    const startedAt=Date.now();
    const pending=bySource.get(sourceUrl);
    const reading=pending??readForImport(sourceUrl,command.collectionIds,command.country);
    if(!pending)bySource.set(sourceUrl,reading);
    const duration=()=>pending?undefined:Date.now()-startedAt;
    try{
      const read=await reading;
      // A source without usable product data leaves no blank draft, except for known manual-entry stores.
      if(read.sourceUnavailable&&!read.draft.name&&!read.manual)return {url,status:'failed',reason:read.failureMessage||'Магазин не отдал данные товара.',importFailureReason:read.failureReason,storeReadMs:duration()};
      return {url,read,storeReadMs:duration()};
    }catch(error){return {url,status:'failed',reason:error instanceof HttpError?error.message:importFailureText(error),storeReadMs:duration()}}
  });
  const {document,result:results}=await saveImport(initial,user,'catalog.import-batch',command.collectionIds,(current,removed,rates)=>{
    const applied=new Map<ImportRead,Omit<ImportOutcome,'url'|'storeReadMs'>>();
    let saved=0;
    const result=reads.map((item):ImportOutcome=>{
      if('status' in item)return item;
      let outcome=applied.get(item.read);
      if(!outcome){
        try{outcome={status:'saved',...applyImportRead(current,removed,item.read,rates)};saved++;}
        catch(error){outcome={status:'failed',reason:error instanceof HttpError?error.message:importFailureText(error)};}
        applied.set(item.read,outcome);
      }
      return {url:item.url,storeReadMs:item.storeReadMs,...outcome};
    });
    return {result,saved,failed:result.filter(item=>item.status==='failed').length};
  });
  // Only actual attempts count toward store health. A failed catalog save is not a failed store read.
  await recordStoreHealth(reads.flatMap((item,index):(StoreReadOutcome & {durationMs?:number})[]=>{
    if(item.storeReadMs===undefined)return [];
    if('status' in item)return [{url:item.url,result:'failed',reason:item.reason,durationMs:item.storeReadMs}];
    if(item.read.manual)return [];
    const outcome=results[index];
    return [{url:item.url,result:item.read.sourceUnavailable||(outcome.status==='saved'&&!outcome.published&&outcome.note)?'partial':'ok',reason:item.read.sourceUnavailable?item.read.failureReason:outcome.note,durationMs:item.storeReadMs}];
  }),user.userId);
  return {document,results};
}
