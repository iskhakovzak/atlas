import {storeCountryLabelForUrl} from '@/lib/market/store-brands';
import {desktopStoreUrl,expandShortLink} from '@/lib/importer/short-links';
import {mergeStoreHealth,storeHealthKey,type StoreHealth,type StoreReadOutcome} from '@/lib/market/store-health';
import {withoutAuthor} from '@/lib/market/pricing-equal';
import {z} from 'zod';
import {database,identity,requirePermission,sameOrigin,requestJson,json,failure,HttpError,pricing,rateLimit} from '@/lib/market/server';
import {catalogSaleRunner,validatedSaleSource} from '@/lib/market/catalog-sale-server';
import {readCatalog,persistCatalog} from '@/lib/market/catalog-server';
import {catalogDraftSchema,collectionSchema,canonicalCatalogUrl,importDraft,manualFallbackCatalogDraft,recheckedDraft,changeCatalog,publicCatalog,applyAutomaticCatalogImport,catalogRecheckBatchSize} from '@/lib/market/catalog-editor';
import type {CatalogDraft} from '@/lib/market/catalog-editor';
import {fetchProduct,fetchCollectionLinks,ManualEntryFallbackError,describeImportDiagnostic} from '@/lib/importer/fetch';
import type {Extracted} from '@/lib/importer/extract';
import {refreshDueCatalog} from '@/lib/market/catalog-refresh';
import {catalogMerchantRequest as merchantRequest} from '@/lib/importer/worker-fetch';
import {apiErrorMessage,requestLocale} from '@/lib/market/i18n';

const ids=z.array(z.string().min(1).max(100)).min(1).max(100);
/** Links per pasted batch; every link in it is read from its store at the same time. */
const catalogImportBatchMax=25;
/** How many stores one batch reads concurrently (each read is bounded to 15 s). */
const catalogImportConcurrency=8;
function importFailureText(error:unknown){
  const message=error instanceof Error?error.message.trim():'';
  return (message&&/[А-Яа-яЁё]/.test(message)?message:'Не удалось загрузить страницу товара. Проверьте ссылку и повторите позже.').slice(0,500);
}
function invalidLinkText(error:unknown){
  return error instanceof Error&&error.message.startsWith('Используйте')?error.message:'Это не ссылка на страницу товара. Нужна HTTPS-ссылка поддерживаемого магазина.';
}
type ImportOutcome={url:string;status:'saved'|'failed';id?:string;published?:boolean;note?:string;reason?:string;importFailureReason?:CatalogDraft['importFailureReason']};
/** Read one store page; never throws for recoverable merchant failures — those become a reviewable draft. */
async function readForImport(sourceUrl:string,collectionIds:string[],country:string){
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
  return {draft,sourceUnavailable,failureMessage,failureReason};
}
/** A phone's share link (m.zara.com) or a store short link (a.co, amzn.to, ebay.us) reads as the store page, as for customers. */
async function storePageUrl(value:string){
  try{return desktopStoreUrl(await expandShortLink(new URL(value.trim()))).href}catch{return value}
}
async function readStoreHealth():Promise<StoreHealth>{
  try{const row=await database().prepare('SELECT value FROM market_settings WHERE key=?').bind(storeHealthKey).first<{value:string}>();return row?JSON.parse(row.value) as StoreHealth:{}}catch{return {}}
}
/** One write per batch; a failed write never fails the import (the map is advice for the operator). */
async function recordStoreHealth(outcomes:StoreReadOutcome[],userId:string){
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
async function mapMerchantConcurrent<T>(urls:string[],task:(url:string)=>Promise<T>){
 const groups=new Map<string,{url:string;index:number}[]>();
 urls.forEach((url,index)=>{let host:string;try{host=new URL(url).hostname.replace(/^www\./,'')}catch{host='invalid'};groups.set(host,[...(groups.get(host)??[]),{url,index}])});
 const results:T[]=new Array(urls.length);
 await mapConcurrent([...groups.values()],catalogImportConcurrency/2,group=>mapConcurrent(group,2,async item=>{results[item.index]=await task(item.url)}));
 return results;
}
const commandSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('sale-start'),url:z.string().max(3000),collectionIds:z.array(z.string().max(80)).max(20),country:z.string().max(80)}),
  z.object({kind:z.literal('sale-step'),id:z.string().min(1).max(100)}),
  z.object({kind:z.literal('sale-control'),id:z.string().min(1).max(100),resume:z.boolean()}),
  z.object({kind:z.literal('import'),url:z.string().max(3000),collectionIds:z.array(z.string().max(80)).max(20),country:z.string().max(80)}),
  z.object({kind:z.literal('import-batch'),urls:z.array(z.string().max(3000)).min(1).max(catalogImportBatchMax),collectionIds:z.array(z.string().max(80)).max(20),country:z.string().max(80)}),
  z.object({kind:z.literal('discover'),url:z.string().max(3000)}),
  z.object({kind:z.literal('recheck'),ids:z.array(z.string().min(1).max(100)).min(1).max(catalogRecheckBatchSize)}),
  z.object({kind:z.literal('refresh-due')}),
  z.object({kind:z.literal('edit'),id:z.string().max(100),draft:catalogDraftSchema}),
  z.object({kind:z.literal('publish'),ids}),z.object({kind:z.literal('confirm'),ids}),z.object({kind:z.literal('hide'),ids}),z.object({kind:z.literal('delete-drafts'),ids}),
  z.object({kind:z.literal('collection'),collection:collectionSchema}),
]);
export async function GET(request:Request){try{
  const admin=new URL(request.url).searchParams.get('admin')==='1';
  let saleJob;
  if(admin){const user=await identity();await requirePermission(user,'catalog.manage');saleJob=await catalogSaleRunner(user).read(user.userId);}
  const [{document},currentPricing]=await Promise.all([readCatalog(),pricing()]);
  return json(admin?{document,saleJob,catalogFormat:'chunks-v2',storeHealth:await readStoreHealth()}:{...publicCatalog(document,currentPricing),pricing:withoutAuthor(currentPricing)});
}catch(error){return failure(error,request)}}
export async function POST(request:Request){try{
  sameOrigin(request);const user=await identity();await requirePermission(user,'catalog.manage');
  const payload=z.object({revision:z.number().int().nonnegative(),command:commandSchema}).safeParse(await requestJson(request,200000));
  if(!payload.success)throw new HttpError(400, 'err_30');
  const {command,revision}=payload.data;
  if(command.kind==='sale-start'||command.kind==='sale-step'||command.kind==='sale-control'){
    await rateLimit(user.userId+':catalog-sale',30,60000);
    const runner=catalogSaleRunner(user);
    if(command.kind==='sale-start'){
      const {document}=await readCatalog();if(command.collectionIds.some(id=>!document.collections.some(c=>c.id===id)))throw new HttpError(400,'err_33');
      return json({saleJob:await runner.start(user.userId,{sourceUrl:validatedSaleSource(command.url),country:command.country,collectionIds:command.collectionIds})});
    }
    if(command.kind==='sale-control')return json({saleJob:await runner.control(user.userId,command.id,command.resume)});
    const saleJob=await runner.step(user.userId,command.id);
    return json({saleJob});
  }
  const {document,raw}=await readCatalog();
  if(document.revision!==revision)throw new HttpError(409, 'err_31');
  if(command.kind==='refresh-due'){
    const refreshResult=await refreshDueCatalog(Date.now(),merchantRequest),next=await readCatalog();
    return json({document:next.document,refreshResult});
  }
  if(command.kind==='recheck'){
    // Stores are read together (bounded per merchant, like a batch import); the catalog is then changed in order, one entry at a time.
    const targets=command.ids.map(id=>({id,entry:document.entries.find(item=>item.id===id)}));
    const [fetched,currentPricing]=await Promise.all([
      mapMerchantConcurrent(targets.map(item=>item.entry?.draft.sourceUrl??''),url=>url?fetchProduct(url,merchantRequest).then(data=>({data}),(error:unknown)=>({error})):Promise.resolve(undefined)),
      pricing(),
    ]);
    const results:string[]=[];
    for(const [index,{id,entry}] of targets.entries()){if(!entry){results.push(`${id}: товар не найден`);continue}try{const read=fetched[index];if(!read)throw new Error('Нет ссылки на магазин');if('error' in read)throw read.error;const data=read.data,fresh=importDraft(data,entry.draft.collectionIds,entry.draft.country,Date.now());if(entry.autoManaged)applyAutomaticCatalogImport(document,fresh,Date.now(),currentPricing.rates);else entry.draft=recheckedDraft(entry.draft,fresh);document.availabilityReports=document.availabilityReports?.map(report=>report.productId===id&&!report.resolvedAt?{...report,resolvedAt:Date.now()}:report);results.push(`${entry.draft.name}: проверено`)}catch(error){entry.draft.lastCheckError=(error as Error).message.slice(0,500);entry.draft.importFailureReason=error instanceof ManualEntryFallbackError?error.reason:error instanceof Error&&error.name==='AbortError'?'timeout':undefined;const locale=requestLocale(request);results.push(`${entry.draft.name}: ${locale==='ru'?(error as Error).message:apiErrorMessage(422,locale)}`)}}
    document.revision++;await persistCatalog(document,raw,user,'catalog.recheck',{ids:command.ids});return json({document,recheckResults:results});
  }
  if(command.kind==='import'||command.kind==='discover'||command.kind==='import-batch'){
    // No per-minute cap on the operator (owner, 27 October 2026: a large batch should run through in one go). The stores
    // are protected by the reads themselves: at most two at a time per store and eight in all (mapMerchantConcurrent).
    if(command.kind==='import-batch'){
      if(command.collectionIds.some(id=>!document.collections.some(c=>c.id===id)))throw new HttpError(400, 'err_33');
      const urls=[...new Set(command.urls.map(value=>value.trim()).filter(Boolean))];
      // Every store is read at the same time; the catalog is written once, so the operator sees one revision and one result list.
      const reads=await mapMerchantConcurrent(urls,async(url):Promise<ImportOutcome|{url:string;sourceUrl:string;read:Awaited<ReturnType<typeof readForImport>>}>=>{
        let sourceUrl:string;
        try{sourceUrl=canonicalCatalogUrl(await storePageUrl(url))}catch(error){return {url,status:'failed',reason:invalidLinkText(error)}}
        try{
          const read=await readForImport(sourceUrl,command.collectionIds,command.country);
          // A store that answered nothing usable leaves no empty card: the link stays in the field with the reason.
          if(read.sourceUnavailable&&!read.draft.name)return {url,status:'failed',reason:read.failureMessage||'Магазин не отдал данные товара.',importFailureReason:read.failureReason};
          return {url,sourceUrl,read};
        }
        catch(error){return {url,status:'failed',reason:error instanceof HttpError?error.message:importFailureText(error)}}
      });
      const currentPricing=await pricing();
      const results:ImportOutcome[]=[];let saved=0;
      for(const item of reads){
        if('status' in item){results.push(item);continue}
        try{
          const outcome=applyAutomaticCatalogImport(document,item.read.draft,Date.now(),currentPricing.rates);saved++;
          results.push({url:item.url,status:'saved',...outcome,...(item.read.sourceUnavailable?{importFailureReason:item.read.failureReason}:{})});
        }catch(error){results.push({url:item.url,status:'failed',reason:error instanceof HttpError?error.message:importFailureText(error)})}
      }
      if(saved){document.revision++;await persistCatalog(document,raw,user,'catalog.import-batch',{count:saved,failed:results.length-saved});}
      // Dead or malformed links say nothing about the store; only reads count (lib/market/store-health.ts).
      await recordStoreHealth(results.flatMap((item):StoreReadOutcome[]=>item.status==='failed'
        ?(item.importFailureReason?[{url:item.url,result:'failed',reason:item.reason}]:[])
        :[{url:item.url,result:item.importFailureReason||(!item.published&&item.note)?'partial':'ok',reason:item.importFailureReason??item.note}]),user.userId);
      return json({document,results});
    }
    // A link outside the store list or a malformed line is the operator's input error, not a service failure.
    let sourceUrl:string;
    try{sourceUrl=canonicalCatalogUrl(await storePageUrl(command.url))}catch(error){throw new HttpError(400,invalidLinkText(error))}
    if(command.kind==='discover'){
      try{return json({urls:await fetchCollectionLinks(sourceUrl,merchantRequest)})}
      catch(error){throw new HttpError(422,importFailureText(error))}
    }
    if(command.collectionIds.some(id=>!document.collections.some(c=>c.id===id)))throw new HttpError(400, 'err_33');
    const read=await readForImport(sourceUrl,command.collectionIds,command.country);
    if(read.sourceUnavailable&&!read.draft.name)throw new HttpError(422,read.failureMessage||'Магазин не отдал данные товара.');
    const outcome=applyAutomaticCatalogImport(document,read.draft,Date.now(),(await pricing()).rates),importedId=outcome.id;
    document.revision++;
    await persistCatalog(document,raw,user,'catalog.import');
    return json({document,importedId,published:outcome.published,importNote:outcome.note,...(read.sourceUnavailable?{importNote:read.failureMessage.slice(0,500),importFailureReason:read.failureReason}:{})});
  }
  const report=command.kind==='publish'||command.kind==='confirm'?{published:0,skipped:[] as string[]}:undefined;
  let next;try{next=changeCatalog(document,command,Date.now(),await pricing(),report)}catch(error){throw new HttpError(400,(error as Error).message)}
  const auditDetails='ids' in command?{ids:command.ids}:undefined;
  await persistCatalog(next,raw,user,'catalog.'+command.kind,auditDetails);return json({document:next,...(report?{published:report.published,skipped:report.skipped}:{})});
}catch(error){return failure(error,request)}}
