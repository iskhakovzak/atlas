import {database,requirePermission} from './server';
import {readCatalog} from './catalog-server';
import {claimBatch,finishBatch,readBatch,controlBatch} from './catalog-batch-server';
import {processCatalogBatch} from './catalog-import-server';
import {catalogSaleRunner} from './catalog-sale-server';

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
 // Storefront discovery has its own leased job; only server-recorded, currently authorized owners run unattended.
 const sales=await database().prepare("SELECT key,updated_by FROM market_settings WHERE key='catalog-sale:' || updated_by AND json_valid(value) AND json_extract(value,'$.status')='running' AND json_type(value,'$.principal')='object' AND COALESCE(json_extract(value,'$.leaseUntil'),0)<=? AND COALESCE(json_extract(value,'$.retryAt'),0)<=? ORDER BY updated_at ASC LIMIT 20").bind(Date.now(),Date.now()).all<{key:string;updated_by:string}>();
 for(const row of sales.results){
  const owner=row.key.slice('catalog-sale:'.length);if(!owner||owner!==row.updated_by)continue;
  // The persisted principal was recorded at an authenticated start/resume, not supplied by the scheduler.
  const stored=await database().prepare('SELECT value FROM market_settings WHERE key=?').bind(row.key).first<{value:string}>();
  if(!stored)continue;
  let parsed:unknown;try{parsed=JSON.parse(stored.value)}catch{continue}
  const principal=typeof parsed==='object'&&parsed!==null?'principal' in parsed?parsed.principal:undefined:undefined;
  if(!principal||typeof principal!=='object'||!('email' in principal)||typeof principal.email!=='string'||!('method' in principal)||typeof principal.method!=='string')continue;
  const user={userId:owner,email:principal.email,method:principal.method};
  const runner=catalogSaleRunner(user);let before:Awaited<ReturnType<typeof runner.read>>;try{before=await runner.read(owner)}catch{continue}if(!before||before.principal?.email!==user.email||before.principal.method!==user.method)continue;
  try{await requirePermission(user,'catalog.manage')}catch{await runner.control(owner,before.id,false).catch(()=>{});continue}
  const after=await runner.step(owner,before.id);
  return {processed:Math.max(0,(after?.processed??before.processed)-before.processed)};
 }
 return {processed:0};
}
