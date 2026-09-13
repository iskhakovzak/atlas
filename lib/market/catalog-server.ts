import {database,HttpError} from './server';
import {catalogDocumentSchema,initialCatalog,synchronizeBundledCatalog,type CatalogDocument} from './catalog-editor';

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
