import {database,requirePermission} from './server';
import {readCatalog} from './catalog-server';
import {claimBatch,finishBatch,readBatch,controlBatch} from './catalog-batch-server';
import {processCatalogBatch} from './catalog-import-server';

/** One bounded step, selected exclusively from server-owned records. No caller-provided user or URLs. */
export async function runOneScheduledBatch(){
 const rows=await database().prepare("SELECT key,updated_by FROM market_settings WHERE key='catalog-batch:' || updated_by AND json_valid(value) AND json_extract(value,'$.status')='running' AND json_type(value,'$.principal')='object' AND COALESCE(json_extract(value,'$.leaseUntil'),0)<=? ORDER BY updated_at ASC LIMIT 20").bind(Date.now()).all<{key:string;updated_by:string}>();
 for(const row of rows.results){
  const owner=row.key.slice('catalog-batch:'.length);
  if(!owner||row.updated_by!==owner)continue;
  let record:Awaited<ReturnType<typeof readBatch>>;try{record=await readBatch(owner)}catch{continue}const principal=record?.job.principal;
  // Jobs created before this feature have no server-recorded identity and cannot run unattended.
  if(!record||!principal)continue;
  try{await requirePermission(principal,'catalog.manage')}catch{await controlBatch(owner,record.job.id,false).catch(()=>{});continue}
  const claimed=await claimBatch(owner,record.job.id);
  if(!claimed.claim||!claimed.urls)continue;
  const user={userId:owner,email:principal.email};
  const {document,raw}=await readCatalog();
  const {results}=await processCatalogBatch(document,raw,user,{urls:claimed.urls,collectionIds:claimed.job.collectionIds,country:claimed.job.country});
  await finishBatch(owner,claimed.job.id,claimed.claim,results);
  return {processed:results.length};
 }
 return {processed:0};
}
