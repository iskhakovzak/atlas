import {database,HttpError} from './server';
import {catalogDocumentSchema,initialCatalog,synchronizeBundledCatalog,type CatalogDocument,canonicalCatalogUrl,catalogMaxEntries,customerLinkDraft} from './catalog-editor';
import type {Product} from './domain';
import type {Extracted} from '../importer/extract';

export async function readCatalog(){
  const db=database();
  for(let attempt=0;attempt<2;attempt++){
    const row=await db.prepare("SELECT value FROM market_settings WHERE key='catalog'").first<{value:string}>();
    const current=row?catalogDocumentSchema.parse(JSON.parse(row.value)):initialCatalog();
    const synced=synchronizeBundledCatalog(current),value=JSON.stringify(synced.document),now=Date.now();
    if(row&&!synced.added&&!synced.updated)return {raw:row.value,document:synced.document};
    const result=row
      ?await db.prepare("UPDATE market_settings SET value=?,updated_at=?,updated_by='atlas.catalog.sync' WHERE key='catalog' AND value=?").bind(value,now,row.value).run()
      :await db.prepare("INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES ('catalog',?,?, 'atlas.catalog.sync') ON CONFLICT(key) DO NOTHING").bind(value,now).run();
    if(result.meta.changes)return {raw:value,document:synced.document};
  }
  const row=await db.prepare("SELECT value FROM market_settings WHERE key='catalog'").first<{value:string}>();
  if(!row)return {raw:null,document:initialCatalog()};
  return {raw:row.value,document:catalogDocumentSchema.parse(JSON.parse(row.value))};
}
export async function persistCatalog(next:CatalogDocument,previous:string|null,user:{userId:string;email:string},action:string){
  const value=JSON.stringify(catalogDocumentSchema.parse(next));
  if(new TextEncoder().encode(value).length>1_500_000)throw new HttpError(413,'Каталог заполнен. Сократите количество черновиков.');
  const now=Date.now(),db=database();
  const results=await db.batch([
    db.prepare("INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES ('catalog',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE market_settings.value=?").bind(value,now,user.userId,previous??''),
    db.prepare("INSERT INTO market_audit_events (id,actor_id,actor_email,action,entity_type,entity_id,details,created_at) SELECT ?,?,?,?,'catalog',NULL,?,? WHERE changes()=1").bind(crypto.randomUUID(),user.userId,user.email,action,JSON.stringify({revision:next.revision}),now),
  ]);
  if(!results[0].meta.changes)throw new HttpError(409,'Каталог изменён в другой вкладке. Обновите список и повторите действие.');
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
    const next=catalogDocumentSchema.parse({...document,revision:document.revision+1,entries:[...document.entries,{id,draft}]});
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
