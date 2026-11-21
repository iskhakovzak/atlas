import {publicBatchJob} from '@/lib/market/catalog-batch';
import {publicSaleJob} from '@/lib/market/catalog-sale';
import {importFailureText,invalidLinkText,readForImport,handOverManual,manualNote,storePageUrl,readStoreHealth,mapMerchantConcurrent,processCatalogBatch} from '@/lib/market/catalog-import-server';
import {readBatch,startBatch,controlBatch,claimBatch,finishBatch} from '@/lib/market/catalog-batch-server';
import {z} from 'zod';
import {identity,requirePermission,sameOrigin,requestJson,json,failure,HttpError,pricing,rateLimit} from '@/lib/market/server';
import {catalogSaleRunner,validatedSaleSource} from '@/lib/market/catalog-sale-server';
import {readCatalog,persistCatalog} from '@/lib/market/catalog-server';
import {catalogDraftSchema,collectionSchema,canonicalCatalogUrl,importDraft,recheckedDraft,changeCatalog,applyAutomaticCatalogImport,catalogRecheckBatchSize,markCatalogRefreshFailed} from '@/lib/market/catalog-editor';
import {fetchProduct,fetchCollectionLinks,ManualEntryFallbackError} from '@/lib/importer/fetch';
import {isConfirmedEbaySoldOut} from '@/lib/importer/ebay';
import {refreshDueCatalog} from '@/lib/market/catalog-refresh';
import {catalogMerchantRequest as merchantRequest} from '@/lib/importer/worker-fetch';
import {apiErrorMessage,requestLocale} from '@/lib/market/i18n';
import {publicCatalogCache} from '@/lib/market/catalog-list';
import {loadPublicCatalogList} from '@/lib/market/public-catalog-server';
import {homeCatalogPreview} from '@/lib/market/catalog-teaser';

const ids=z.array(z.string().min(1).max(100)).min(1).max(100);
/** Links per pasted batch; every link in it is read from its store at the same time. */
const catalogImportBatchMax=25;
const commandSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('batch-start'),urls:z.array(z.string().max(3000)).min(1).max(500),collectionIds:z.array(z.string().max(80)).max(20),country:z.string().max(80)}),
  z.object({kind:z.literal('batch-step'),id:z.string().min(1).max(100)}),
  z.object({kind:z.literal('batch-control'),id:z.string().min(1).max(100),resume:z.boolean()}),
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
  const params=new URL(request.url).searchParams;
  const admin=params.get('admin')==='1';
  if(admin){
    const user=await identity();
    await requirePermission(user,'catalog.manage');
    const [{document},saleJob,batchJob,storeHealth]=await Promise.all([
      readCatalog(),
      catalogSaleRunner(user).read(user.userId).then(publicSaleJob),
      readBatch(user.userId).then(row=>publicBatchJob(row?.job)),
      readStoreHealth(),
    ]);
    return json({document,saleJob,batchJob,catalogFormat:'chunks-v2',storeHealth});
  }
  if(params.get('view')==='home'){
    const {products,pricing}=await loadPublicCatalogList();
    return Response.json(homeCatalogPreview(products,pricing),{headers:{'Cache-Control':publicCatalogCache}});
  }
  // The public list is the same for every visitor (no session is read, nothing personal in it) and leaves the options,
  // galleries and descriptions to GET /api/catalog/<id> (lib/market/catalog-list.ts): browsers keep it a minute and
  // may show it for ten more while they ask again (3 November 2026).
  return Response.json(await loadPublicCatalogList(),{headers:{'Cache-Control':publicCatalogCache}});
}catch(error){return failure(error,request)}}
export async function POST(request:Request){try{
  sameOrigin(request);const user=await identity();await requirePermission(user,'catalog.manage');
  const payload=z.object({revision:z.number().int().nonnegative(),command:commandSchema}).safeParse(await requestJson(request,200000));
  if(!payload.success)throw new HttpError(400, 'err_30');
  let {command,revision}=payload.data;
  let batchClaim:{id:string;claim:string}|undefined;
  if(command.kind==='batch-start'){
    const {document}=await readCatalog();if(command.collectionIds.some(id=>!document.collections.some(c=>c.id===id)))throw new HttpError(400,'err_33');
    return json({batchJob:publicBatchJob(await startBatch(user.userId,command,{email:user.email,method:user.method}))});
  }
  if(command.kind==='batch-control')return json({batchJob:publicBatchJob(await controlBatch(user.userId,command.id,command.resume,{email:user.email,method:user.method}))});
  if(command.kind==='batch-step'){
    const claimed=await claimBatch(user.userId,command.id);
    if(!claimed.claim||!claimed.urls)return json({batchJob:publicBatchJob(claimed.job)});
    batchClaim={id:command.id,claim:claimed.claim};
    const {document}=await readCatalog();revision=document.revision;
    command={kind:'import-batch',urls:claimed.urls,collectionIds:claimed.job.collectionIds,country:claimed.job.country};
  }
  if(command.kind==='sale-start'||command.kind==='sale-step'||command.kind==='sale-control'){
    await rateLimit(user.userId+':catalog-sale',30,60000);
    const runner=catalogSaleRunner(user);
    if(command.kind==='sale-start'){
      const {document}=await readCatalog();if(command.collectionIds.some(id=>!document.collections.some(c=>c.id===id)))throw new HttpError(400,'err_33');
      return json({saleJob:publicSaleJob(await runner.start(user.userId,{sourceUrl:validatedSaleSource(command.url),country:command.country,collectionIds:command.collectionIds},{email:user.email,method:user.method}))});
    }
    if(command.kind==='sale-control')return json({saleJob:publicSaleJob(await runner.control(user.userId,command.id,command.resume,{email:user.email,method:user.method}))});
    const saleJob=await runner.step(user.userId,command.id);
    return json({saleJob:publicSaleJob(saleJob)});
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
    let updated=document;
    for(const [index,{id}] of targets.entries()){
      const entry=updated.entries.find(item=>item.id===id);
      if(!entry){results.push(`${id}: товар не найден`);continue}
      const now=Date.now();
      try{
        const read=fetched[index];
        if(!read)throw new Error('Нет ссылки на магазин');
        if('error' in read)throw read.error;
        const fresh=importDraft(read.data,entry.draft.collectionIds,entry.draft.country,now);
        if(entry.autoManaged)applyAutomaticCatalogImport(updated,fresh,now,currentPricing.rates);
        else entry.draft=recheckedDraft(entry.draft,fresh);
        updated.availabilityReports=updated.availabilityReports?.map(report=>report.productId===id&&!report.resolvedAt?{...report,resolvedAt:now}:report);
        results.push(`${entry.draft.name}: проверено`);
      }catch(error){
        if(isConfirmedEbaySoldOut(error))updated=markCatalogRefreshFailed(updated,id,error,now).document;
        else{
          entry.draft.lastCheckError=(error as Error).message.slice(0,500);
          entry.draft.importFailureReason=error instanceof ManualEntryFallbackError?error.reason:error instanceof Error&&error.name==='AbortError'?'timeout':undefined;
        }
        const locale=requestLocale(request);
        results.push(`${entry.draft.name}: ${locale==='ru'?(error as Error).message:apiErrorMessage(422,locale)}`);
      }
    }
    updated.revision++;
    await persistCatalog(updated,raw,user,'catalog.recheck',{ids:command.ids});
    return json({document:updated,recheckResults:results});
  }
  if(command.kind==='import'||command.kind==='discover'||command.kind==='import-batch'){
    // No per-minute cap on the operator (owner, 27 October 2026: a large batch should run through in one go). The stores
    // are protected by the reads themselves: at most two at a time per store and eight in all (mapMerchantConcurrent).
    if(command.kind==='import-batch'){
      const {results}=await processCatalogBatch(document,raw,user,command);
      const batchJob=batchClaim?await finishBatch(user.userId,batchClaim.id,batchClaim.claim,results):undefined;
      return json({document,results,batchJob:publicBatchJob(batchJob)});
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
    if(read.sourceUnavailable&&!read.draft.name&&!read.manual)throw new HttpError(422,read.failureMessage||'Магазин не отдал данные товара.');
    const outcome=applyAutomaticCatalogImport(document,read.draft,Date.now(),(await pricing()).rates),importedId=outcome.id;
    if(read.manual){handOverManual(document,importedId);document.revision++;await persistCatalog(document,raw,user,'catalog.import');return json({document,importedId,published:false,importNote:manualNote,manual:true})}
    document.revision++;
    await persistCatalog(document,raw,user,'catalog.import');
    return json({document,importedId,published:outcome.published,importNote:outcome.note,...(read.sourceUnavailable?{importNote:read.failureMessage.slice(0,500),importFailureReason:read.failureReason}:{})});
  }
  const report=command.kind==='publish'||command.kind==='confirm'?{published:0,skipped:[] as string[]}:undefined;
  let next;try{next=changeCatalog(document,command,Date.now(),await pricing(),report)}catch(error){throw new HttpError(400,(error as Error).message)}
  const auditDetails='ids' in command?{ids:command.ids}:undefined;
  await persistCatalog(next,raw,user,'catalog.'+command.kind,auditDetails);return json({document:next,...(report?{published:report.published,skipped:report.skipped}:{})});
}catch(error){return failure(error,request)}}
