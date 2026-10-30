import {batchJobSchema,type CatalogBatchJob} from './catalog-batch.ts';

/** D1 compare-and-swap: an absent row and an existing revision are distinct cases. */
export function createBatchStore(db:()=>D1Database,tooLarge:()=>Error){
 const key=(owner:string)=>`catalog-batch:${owner}`;
 return {
  async read(owner:string){const row=await db().prepare('SELECT value FROM market_settings WHERE key=?').bind(key(owner)).first<{value:string}>();return row?{raw:row.value,job:batchJobSchema.parse(JSON.parse(row.value))}:undefined;},
  async write(owner:string,job:CatalogBatchJob,previous:string|null){
   const value=JSON.stringify(batchJobSchema.parse(job));if(new TextEncoder().encode(value).length>500_000)throw tooLarge();
   const stmt=previous===null
    ?db().prepare('INSERT INTO market_settings(key,value,updated_at,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO NOTHING').bind(key(owner),value,Date.now(),owner)
    :db().prepare('UPDATE market_settings SET value=?,updated_at=?,updated_by=? WHERE key=? AND value=?').bind(value,Date.now(),owner,key(owner),previous);
   const result=await stmt.run();return Boolean(result.meta.changes);
  },
 };
}
