import {fetchProduct} from '../importer/fetch.ts';
import {
  applyScheduledCatalogRefresh,
  dueCatalogEntries,
  importDraft,
  markCatalogRefreshFailed,
  type CatalogDocument,
  type ScheduledRefreshOutcome,
} from './catalog-editor.ts';
import {readCatalog,persistCatalog} from './catalog-server.ts';
import {HttpError} from './server.ts';

const refreshActor={userId:'system:catalog-refresh',email:'system@atlas.invalid'};
const maxParallelFetches=2;

type SourceCheck={id:string;sourceUrl:string;data?:Awaited<ReturnType<typeof fetchProduct>>;error?:unknown};
export type CatalogRefreshResult={
  selected:number;checked:number;available:number;soldOut:number;unknown:number;failed:number;skipped:number;
};

function blankResult(selected=0):CatalogRefreshResult{
  return {selected,checked:0,available:0,soldOut:0,unknown:0,failed:0,skipped:0};
}

async function mapWithConcurrency<T,R>(items:T[],limit:number,task:(item:T)=>Promise<R>){
  const results=new Array<R>(items.length);let cursor=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(cursor<items.length){
      const index=cursor++;
      results[index]=await task(items[index]!);
    }
  }));
  return results;
}

function applyResult(document:CatalogDocument,result:SourceCheck,now:number){
  if(result.error!==undefined)return markCatalogRefreshFailed(document,result.id,result.error,now);
  const entry=document.entries.find(item=>item.id===result.id);
  if(!entry||!result.data)return {document,outcome:'skipped' as ScheduledRefreshOutcome};
  try{
    const fresh=importDraft(result.data,entry.draft.collectionIds,entry.draft.country,now);
    return applyScheduledCatalogRefresh(document,result.id,fresh,now);
  }catch(error){return markCatalogRefreshFailed(document,result.id,error,now)}
}

/**
 * Rechecks at most five due, distinct-store cards. It reads the catalog again
 * after network work, so an editor's changes win over an older worker view.
 */
export async function refreshDueCatalog(now=Date.now()):Promise<CatalogRefreshResult>{
  const source=await readCatalog();
  const candidates=dueCatalogEntries(source.document,now);
  if(!candidates.length)return blankResult();
  const checks=await mapWithConcurrency(candidates,maxParallelFetches,async entry=>{
    try{return {id:entry.id,sourceUrl:entry.draft.sourceUrl,data:await fetchProduct(entry.draft.sourceUrl)} satisfies SourceCheck}
    catch(error){return {id:entry.id,sourceUrl:entry.draft.sourceUrl,error} satisfies SourceCheck}
  });
  const summary=blankResult(candidates.length);
  for(let attempt=0;attempt<2;attempt++){
    const latest=await readCatalog();let document=latest.document;
    for(const check of checks){
      const entry=document.entries.find(item=>item.id===check.id);
      if(!entry||entry.draft.sourceUrl!==check.sourceUrl){summary.skipped++;continue}
      const applied=applyResult(document,check,now);document=applied.document;
      if(applied.outcome==='skipped'){summary.skipped++;continue}
      summary.checked++;
      if(applied.outcome==='sold-out')summary.soldOut++;
      else summary[applied.outcome]++;
    }
    if(document.revision===latest.document.revision)return summary;
    try{
      await persistCatalog(document,latest.raw,refreshActor,'catalog.refresh.scheduled');
      return summary;
    }catch(error){
      if(!(error instanceof HttpError)||error.status!==409||attempt===1)throw error;
      Object.assign(summary,blankResult(candidates.length));
    }
  }
  return summary;
}
