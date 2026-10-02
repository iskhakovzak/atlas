import {z} from 'zod';
import {database,identity,operator,sameOrigin,requestJson,json,failure,HttpError,pricing} from '@/lib/market/server';
import {readCatalog,persistCatalog} from '@/lib/market/catalog-server';
import {catalogDraftSchema,collectionSchema,canonicalCatalogUrl,importDraft,manualFallbackCatalogDraft,recheckedDraft,changeCatalog,publicCatalog,catalogMaxEntries} from '@/lib/market/catalog-editor';
import type {CatalogDraft} from '@/lib/market/catalog-editor';
import {fetchProduct,fetchCollectionLinks,ManualEntryFallbackError} from '@/lib/importer/fetch';
import type {Extracted} from '@/lib/importer/extract';
import {refreshDueCatalog} from '@/lib/market/catalog-refresh';
import {merchantRequest} from '@/lib/importer/worker-fetch';
import {apiErrorMessage,requestLocale} from '@/lib/market/i18n';

const ids=z.array(z.string().min(1).max(100)).min(1).max(100);
const commandSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('import'),url:z.string().max(3000),collectionIds:z.array(z.string().max(80)).max(20),country:z.string().max(80)}),
  z.object({kind:z.literal('discover'),url:z.string().max(3000)}),
  z.object({kind:z.literal('recheck'),ids:z.array(z.string().min(1).max(100)).min(1).max(10)}),
  z.object({kind:z.literal('refresh-due')}),
  z.object({kind:z.literal('edit'),id:z.string().max(100),draft:catalogDraftSchema}),
  z.object({kind:z.literal('publish'),ids}),z.object({kind:z.literal('hide'),ids}),z.object({kind:z.literal('delete-drafts'),ids}),
  z.object({kind:z.literal('collection'),collection:collectionSchema}),
]);
export async function GET(request:Request){try{
  const admin=new URL(request.url).searchParams.get('admin')==='1';
  if(admin){const user=await identity();if(!operator(user.email))throw new HttpError(403, 'err_28');}
  const {document}=await readCatalog();
  const currentPricing=await pricing();
  return json(admin?{document}:{...publicCatalog(document,currentPricing),pricing:currentPricing});
}catch(error){return failure(error,request)}}
export async function POST(request:Request){try{
  sameOrigin(request);const user=await identity();if(!operator(user.email))throw new HttpError(403, 'err_29');
  const payload=z.object({revision:z.number().int().nonnegative(),command:commandSchema}).safeParse(await requestJson(request,200000));
  if(!payload.success)throw new HttpError(400, 'err_30');
  const {command,revision}=payload.data,{document,raw}=await readCatalog();
  if(document.revision!==revision)throw new HttpError(409, 'err_31');
  if(command.kind==='refresh-due'){
    const refreshResult=await refreshDueCatalog(Date.now(),merchantRequest),next=await readCatalog();
    return json({document:next.document,refreshResult});
  }
  if(command.kind==='recheck'){
    const results:string[]=[];
    for(const id of command.ids){const entry=document.entries.find(item=>item.id===id);if(!entry){results.push(`${id}: товар не найден`);continue}try{const data=await fetchProduct(entry.draft.sourceUrl,merchantRequest),fresh=importDraft(data,entry.draft.collectionIds,entry.draft.country,Date.now());entry.draft=recheckedDraft(entry.draft,fresh);document.availabilityReports=document.availabilityReports?.map(report=>report.productId===id&&!report.resolvedAt?{...report,resolvedAt:Date.now()}:report);results.push(`${entry.draft.name}: проверено`)}catch(error){entry.draft.lastCheckError=(error as Error).message.slice(0,500);entry.draft.importFailureReason=error instanceof ManualEntryFallbackError?error.reason:error instanceof Error&&error.name==='AbortError'?'timeout':undefined;const locale=requestLocale(request);results.push(`${entry.draft.name}: ${locale==='ru'?(error as Error).message:apiErrorMessage(422,locale)}`)}}
    document.revision++;await persistCatalog(document,raw,user,'catalog.recheck',{ids:command.ids});return json({document,recheckResults:results});
  }
  if(command.kind==='import'||command.kind==='discover'){
    const sourceUrl=canonicalCatalogUrl(command.url),now=Date.now(),db=database();
    const key=user.userId+':catalog-import:'+Math.floor(now/60000);
    const limit=await db.prepare('INSERT INTO market_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+120000).first<{count:number}>();
    if(!limit||limit.count>20)throw new HttpError(429, 'err_32');
    await db.prepare('DELETE FROM market_rate_limits WHERE expires_at < ?').bind(now).run();
    if(command.kind==='discover')return json({urls:await fetchCollectionLinks(sourceUrl,merchantRequest)});
    if(command.collectionIds.some(id=>!document.collections.some(c=>c.id===id)))throw new HttpError(400, 'err_33');
    let data:Extracted|undefined,sourceUnavailable=false,failureMessage='',failureReason:CatalogDraft['importFailureReason']='unknown';
    try{data=await fetchProduct(sourceUrl,merchantRequest)}catch(error){
      const canSaveManualDraft=error instanceof ManualEntryFallbackError||error instanceof Error&&error.name==='AbortError';
      if(!canSaveManualDraft)throw error;
      sourceUnavailable=true;
      failureMessage=error instanceof Error&&error.name!=='AbortError'?error.message:'Магазин не ответил вовремя. Повторите проверку позже.';
      failureReason=error instanceof ManualEntryFallbackError?error.reason:error instanceof Error&&error.name==='AbortError'?'timeout':'unknown';
      data=error instanceof ManualEntryFallbackError?error.partial:undefined;
    }
    const draft=sourceUnavailable
      ?manualFallbackCatalogDraft(data,sourceUrl,command.collectionIds,command.country,Date.now(),failureMessage,failureReason)
      :importDraft(data!,command.collectionIds,command.country,Date.now());
    const existing=document.entries.find(e=>canonicalCatalogUrl(e.draft.sourceUrl)===draft.sourceUrl||canonicalCatalogUrl(e.draft.sourceUrl)===sourceUrl);
    if(existing){const mergedCollections=[...new Set([...existing.draft.collectionIds,...command.collectionIds])];if(sourceUnavailable){existing.draft.lastCheckError=failureMessage.slice(0,500);existing.draft.importFailureReason=failureReason;}else{existing.draft=recheckedDraft(existing.draft,draft);if(!existing.published){existing.createdAt??=now;existing.origin??='operator-import';existing.queueState='queued';}}existing.draft.collectionIds=mergedCollections;}
    else{if(document.entries.length>=catalogMaxEntries)throw new HttpError(400,`В каталоге уже ${catalogMaxEntries} товаров.`);document.entries.push({id:'find-'+crypto.randomUUID(),draft,createdAt:now,origin:'operator-import',queueState:'queued'});}
    document.revision++;
    await persistCatalog(document,raw,user,'catalog.import');return json({document,importedId:existing?.id??document.entries.at(-1)!.id});
  }
  let next;try{next=changeCatalog(document,command,Date.now(),await pricing())}catch(error){throw new HttpError(400,(error as Error).message)}
  const auditDetails='ids' in command?{ids:command.ids}:undefined;
  await persistCatalog(next,raw,user,'catalog.'+command.kind,auditDetails);return json({document:next});
}catch(error){return failure(error,request)}}
