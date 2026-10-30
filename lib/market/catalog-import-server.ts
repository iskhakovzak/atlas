import {storeCountryLabelForUrl} from '@/lib/market/store-brands';
import {desktopStoreUrl,expandShortLink} from '@/lib/importer/short-links';
import {mergeStoreHealth,storeHealthKey,type StoreHealth,type StoreReadOutcome} from '@/lib/market/store-health';
import {database,HttpError,pricing} from '@/lib/market/server';
import {persistCatalog} from '@/lib/market/catalog-server';
import {canonicalCatalogUrl,importDraft,manualFallbackCatalogDraft,isManualCatalogSource,applyAutomaticCatalogImport} from '@/lib/market/catalog-editor';
import type {CatalogDraft,CatalogDocument} from '@/lib/market/catalog-editor';
import {fetchProduct,ManualEntryFallbackError,describeImportDiagnostic} from '@/lib/importer/fetch';
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
export function handOverManual(document:{entries:{id:string;autoManaged?:boolean}[]},id:string){
  const entry=document.entries.find(item=>item.id===id);if(entry)entry.autoManaged=false;
}
export const manualNote='Ручной ввод: откройте карточку и заполните её со страницы магазина.';
/** A phone's share link (m.zara.com) or a store short link (a.co, amzn.to, ebay.us) reads as the store page, as for customers. */
export async function storePageUrl(value:string){
  try{return desktopStoreUrl(await expandShortLink(new URL(value.trim()))).href}catch{return value}
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

export async function processCatalogBatch(document:CatalogDocument,raw:string|null,user:{userId:string;email:string},command:{urls:string[];collectionIds:string[];country:string}){
      if(command.collectionIds.some(id=>!document.collections.some(c=>c.id===id)))throw new HttpError(400, 'err_33');
      const urls=[...new Set(command.urls.map(value=>value.trim()).filter(Boolean))];
      // Every store is read at the same time; the catalog is written once, so the operator sees one revision and one result list.
      const reads=await mapMerchantConcurrent(urls,async(url):Promise<ImportOutcome|{url:string;sourceUrl:string;read:Awaited<ReturnType<typeof readForImport>>;storeReadMs:number}>=>{
        let sourceUrl:string;
        try{sourceUrl=canonicalCatalogUrl(await storePageUrl(url))}catch(error){return {url,status:'failed',reason:invalidLinkText(error)}}
        const startedAt=Date.now();
        try{
          const read=await readForImport(sourceUrl,command.collectionIds,command.country);
          // A store that answered nothing usable leaves no empty card: the link stays in the field with the reason.
          if(read.sourceUnavailable&&!read.draft.name&&!read.manual)return {url,status:'failed',reason:read.failureMessage||'Магазин не отдал данные товара.',importFailureReason:read.failureReason,storeReadMs:Date.now()-startedAt};
          return {url,sourceUrl,read,storeReadMs:Date.now()-startedAt};
        }
        catch(error){return {url,status:'failed',reason:error instanceof HttpError?error.message:importFailureText(error),storeReadMs:Date.now()-startedAt}}
      });
      const currentPricing=await pricing();
      const results:ImportOutcome[]=[];let saved=0;
      for(const item of reads){
        if('status' in item){results.push(item);continue}
        try{
          const outcome=applyAutomaticCatalogImport(document,item.read.draft,Date.now(),currentPricing.rates);saved++;
          if(item.read.manual){handOverManual(document,outcome.id);results.push({url:item.url,storeReadMs:item.storeReadMs,status:'saved',id:outcome.id,published:false,note:manualNote,manual:true});continue}
          results.push({url:item.url,storeReadMs:item.storeReadMs,status:'saved',...outcome,...(item.read.sourceUnavailable?{importFailureReason:item.read.failureReason}:{})});
        }catch(error){results.push({url:item.url,storeReadMs:item.storeReadMs,status:'failed',reason:error instanceof HttpError?error.message:importFailureText(error)})}
      }
      if(saved){document.revision++;await persistCatalog(document,raw,user,'catalog.import-batch',{count:saved,failed:results.length-saved});}
      // Dead or malformed links say nothing about the store; only reads count (lib/market/store-health.ts).
      await recordStoreHealth(results.filter(item=>!item.manual).flatMap((item):(StoreReadOutcome & {durationMs?:number})[]=>item.status==='failed'
        ?(item.importFailureReason||item.storeReadMs!==undefined?[{url:item.url,result:'failed',reason:item.reason,durationMs:item.storeReadMs}]:[])
        :[{url:item.url,result:item.importFailureReason||(!item.published&&item.note)?'partial':'ok',reason:item.importFailureReason??item.note,durationMs:item.storeReadMs}]),user.userId);
      return {document,results};
}
