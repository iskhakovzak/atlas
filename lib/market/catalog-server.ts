import {database,HttpError} from './server';
import {catalogDocumentSchema,initialCatalog,synchronizeBundledCatalog,type CatalogDocument,canonicalCatalogUrl,catalogMaxEntries,customerLinkDraft} from './catalog-editor';
import type {Product} from './domain';
import type {Extracted} from '../importer/extract';
import {prepareCatalogStorage,decodeCatalogStorage,catalogStorageChunkKeys,CatalogCapacityError} from './catalog-storage';

export async function readStoredCatalogDocument(value:string,db=database()){
  const keys=catalogStorageChunkKeys(value),chunks=new Map<string,string>();
  // D1 limits both bind parameters and Worker subrequests. Fetch a bounded set of immutable rows per RPC,
  // then let the decoder parse one logical chunk at a time from the cache.
  for(let start=0;start<keys.length;start+=80){
    const group=keys.slice(start,start+80),placeholders=group.map(()=>'?').join(',');
    const rows=await db.prepare(`SELECT key,value FROM market_settings WHERE key IN (${placeholders})`).bind(...group).all<{key:string;value:string}>();
    for(const row of rows.results??[])chunks.set(row.key,row.value);
  }
  return catalogDocumentSchema.parse(await decodeCatalogStorage(value,async key=>{const chunk=chunks.get(key);chunks.delete(key);return chunk}));
}
/** Immutable generations make staging invisible until the head CAS succeeds. Old generations live a day for readers. */
async function writeCatalog(next:CatalogDocument,previous:string|null,user:{userId:string;email:string},action?:string,details?:Record<string,unknown>){
  let prepared:Awaited<ReturnType<typeof prepareCatalogStorage>>;
  try{prepared=await prepareCatalogStorage(catalogDocumentSchema.parse(next));}
  catch(error){if(error instanceof CatalogCapacityError)throw new HttpError(413,error.message);throw error;}
  const now=Date.now(),db=database();
  for(let start=0;start<prepared.chunks.length;start+=80){
    await db.batch(prepared.chunks.slice(start,start+80).map(chunk=>db.prepare('INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES (?,?,?,?)').bind(chunk.key,chunk.value,now,user.userId)));
  }
  const head=db.prepare("INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES ('catalog',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE market_settings.value=?").bind(prepared.value,now,user.userId,previous??'');
  const statements=[head];
  if(action)statements.push(db.prepare("INSERT INTO market_audit_events (id,actor_id,actor_email,action,entity_type,entity_id,details,created_at) SELECT ?,?,?,?,'catalog',NULL,?,? WHERE changes()=1").bind(crypto.randomUUID(),user.userId,user.email,action,JSON.stringify({revision:next.revision,...details}),now));
  const previousChunks=previous?catalogStorageChunkKeys(previous):[];
  if(previousChunks.length){
    const generation=previousChunks[0].slice(0,previousChunks[0].lastIndexOf('.')+1);
    // Retirement, not creation, starts the grace period. This happens atomically with the successful head swap.
    statements.push(db.prepare('UPDATE market_settings SET updated_at=? WHERE key GLOB ? AND changes()=1').bind(now,generation+'*'));
  }
  const results=await db.batch(statements);
  if(!results[0].meta.changes){
    // Only this losing writer's unreferenced generation is removed; published generations are immutable.
    for(let start=0;start<prepared.chunks.length;start+=80)await db.batch(prepared.chunks.slice(start,start+80).map(chunk=>db.prepare('DELETE FROM market_settings WHERE key=?').bind(chunk.key)));
    return {changed:false,value:prepared.value};
  }
  // Bound orphan/retired generation cleanup. Exclude whatever the current head references, even if another writer won.
  // A reader holding the previous head has 24h to finish before its chunks become eligible.
  try{await db.prepare(`DELETE FROM market_settings WHERE key IN (
    SELECT old.key FROM market_settings old WHERE old.key GLOB 'catalog.chunk.[0-9a-f]*.[0-9]*' AND old.updated_at<?
    AND NOT EXISTS (SELECT 1 FROM json_each((SELECT CASE WHEN json_valid(value) THEN value ELSE '{"chunks":[]}' END FROM market_settings WHERE key='catalog'),'$.chunks') active WHERE active.value=old.key) LIMIT 50
  )`).bind(now-24*60*60*1000).run()}catch(error){console.error('Catalog retired chunk cleanup failed',error)}
  return {changed:true,value:prepared.value};
}

export async function readCatalog(){
  const db=database();
  for(let attempt=0;attempt<2;attempt++){
    const row=await db.prepare("SELECT value FROM market_settings WHERE key='catalog'").first<{value:string}>();
    const current=row?await readStoredCatalogDocument(row.value,db):initialCatalog();
    const synced=synchronizeBundledCatalog(current);
    if(row&&!synced.added&&!synced.updated)return {raw:row.value,document:synced.document};
    const result=await writeCatalog(synced.document,row?.value??null,{userId:'atlas.catalog.sync',email:''});
    if(result.changed)return {raw:result.value,document:synced.document};
  }
  const row=await db.prepare("SELECT value FROM market_settings WHERE key='catalog'").first<{value:string}>();
  if(!row)return {raw:null,document:initialCatalog()};
  return {raw:row.value,document:await readStoredCatalogDocument(row.value,db)};
}
export async function persistCatalog(next:CatalogDocument,previous:string|null,user:{userId:string;email:string},action:string,details?:Record<string,unknown>){
  const result=await writeCatalog(next,previous,user,action,details);
  if(!result.changed)throw new HttpError(409,'Каталог изменён в другой вкладке. Обновите список и повторите действие.');
}

/**
 * Preserve a successful customer link import as an operator-reviewable draft.
 * This is intentionally a narrow server-side side effect of cart-add: it can
 * never publish a card and it only accepts the already verified source/product
 * snapshot produced by the authenticated action route.
 */
export async function addCustomerLinkDraft(product:Product,source:Extracted,user:{userId:string;email:string},now=Date.now()){
  if(!product.sourceUrl)return {added:false as const};
  const sourceUrl=canonicalCatalogUrl(product.sourceUrl);
  for(let attempt=0;attempt<2;attempt++){
    const {document,raw}=await readCatalog();
    const existing=document.entries.find(entry=>{
      try{return canonicalCatalogUrl(entry.draft.sourceUrl)===sourceUrl}catch{return entry.draft.sourceUrl===sourceUrl}
    });
    if(existing)return {added:false as const,id:existing.id};
    if(document.entries.length>=catalogMaxEntries)return {added:false as const,reason:'limit' as const};
    const draft=customerLinkDraft({...product,sourceUrl},source,now),id='customer-'+crypto.randomUUID();
    const next=catalogDocumentSchema.parse({...document,revision:document.revision+1,entries:[...document.entries,{id,draft,createdAt:now,origin:'customer-link',queueState:'queued'}]});
    try{
      await persistCatalog(next,raw,user,'catalog.customer-link');
      return {added:true as const,id};
    }catch(error){
      if(error instanceof HttpError&&error.status===409&&attempt===0)continue;
      throw error;
    }
  }
  throw new HttpError(409,'Каталог изменился.');
}
