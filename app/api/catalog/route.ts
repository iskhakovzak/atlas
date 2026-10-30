import {publicBatchJob} from '@/lib/market/catalog-batch';
import {publicSaleJob} from '@/lib/market/catalog-sale';
import {importFailureText,invalidLinkText,readForImport,handOverManual,manualNote,storePageUrl,readStoreHealth,mapMerchantConcurrent,processCatalogBatch} from '@/lib/market/catalog-import-server';
import {readBatch,startBatch,controlBatch,claimBatch,finishBatch} from '@/lib/market/catalog-batch-server';
import {withoutAuthor} from '@/lib/market/pricing-equal';
import {z} from 'zod';
import {identity,requirePermission,sameOrigin,requestJson,json,failure,HttpError,pricing,rateLimit} from '@/lib/market/server';
import {catalogSaleRunner,validatedSaleSource} from '@/lib/market/catalog-sale-server';
import {readCatalog,persistCatalog} from '@/lib/market/catalog-server';
import {catalogDraftSchema,collectionSchema,canonicalCatalogUrl,importDraft,recheckedDraft,changeCatalog,publicCatalog,applyAutomaticCatalogImport,catalogRecheckBatchSize} from '@/lib/market/catalog-editor';
import {fetchProduct,fetchCollectionLinks,ManualEntryFallbackError} from '@/lib/importer/fetch';
import {refreshDueCatalog} from '@/lib/market/catalog-refresh';
import {catalogMerchantRequest as merchantRequest} from '@/lib/importer/worker-fetch';
import {apiErrorMessage,requestLocale} from '@/lib/market/i18n';

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
  const admin=new URL(request.url).searchParams.get('admin')==='1';
  let saleJob,batchJob;
  if(admin){const user=await identity();await requirePermission(user,'catalog.manage');[saleJob,batchJob]=await Promise.all([catalogSaleRunner(user).read(user.userId).then(publicSaleJob),readBatch(user.userId).then(row=>publicBatchJob(row?.job))]);}
  const [{document},currentPricing]=await Promise.all([readCatalog(),pricing()]);
  return json(admin?{document,saleJob,batchJob,catalogFormat:'chunks-v2',storeHealth:await readStoreHealth()}:{...publicCatalog(document,currentPricing),pricing:withoutAuthor(currentPricing)});
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
    for(const [index,{id,entry}] of targets.entries()){if(!entry){results.push(`${id}: товар не найден`);continue}try{const read=fetched[index];if(!read)throw new Error('Нет ссылки на магазин');if('error' in read)throw read.error;const data=read.data,fresh=importDraft(data,entry.draft.collectionIds,entry.draft.country,Date.now());if(entry.autoManaged)applyAutomaticCatalogImport(document,fresh,Date.now(),currentPricing.rates);else entry.draft=recheckedDraft(entry.draft,fresh);document.availabilityReports=document.availabilityReports?.map(report=>report.productId===id&&!report.resolvedAt?{...report,resolvedAt:Date.now()}:report);results.push(`${entry.draft.name}: проверено`)}catch(error){entry.draft.lastCheckError=(error as Error).message.slice(0,500);entry.draft.importFailureReason=error instanceof ManualEntryFallbackError?error.reason:error instanceof Error&&error.name==='AbortError'?'timeout':undefined;const locale=requestLocale(request);results.push(`${entry.draft.name}: ${locale==='ru'?(error as Error).message:apiErrorMessage(422,locale)}`)}}
    document.revision++;await persistCatalog(document,raw,user,'catalog.recheck',{ids:command.ids});return json({document,recheckResults:results});
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
