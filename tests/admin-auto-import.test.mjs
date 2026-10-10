import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {applyAutomaticCatalogImport,applyScheduledCatalogRefresh,catalogDocumentSchema,changeCatalog,dueCatalogEntries,importDraft,publicCatalog} from '../lib/market/catalog-editor.ts';
import {tariff} from '../lib/market/domain.ts';
const now=1770000000000;
const source=(extra={})=>({sourceUrl:'https://www.ebay.com/itm/123456789012?var=111111',title:'Adidas shoes',brand:'adidas',category:'Обувь',country:'США',currency:'USD',groupId:'123456789012',variantScope:'group',variantsComplete:true,image:'https://i.ebayimg.com/images/g/red/s-l1600.jpg',images:['https://i.ebayimg.com/images/g/red/s-l1600.jpg'],variants:[{id:'111111',label:'Red · 11',color:'Red',size:'11',available:true,availabilityKnown:true,price:25,image:'https://i.ebayimg.com/images/g/red/s-l1600.jpg',sourceUrl:'https://www.ebay.com/itm/123456789012?var=111111',productId:'123456789012',sellerId:'seller-a',offerId:'offer-red',colorId:'red',options:[{name:'Width',value:'Wide'}],images:['https://i.ebayimg.com/images/g/red/s-l1600.jpg']},{id:'222222',label:'Blue · 11',color:'Blue',size:'11',available:true,availabilityKnown:true,price:32,image:'https://i.ebayimg.com/images/g/blue/s-l1600.jpg'}],warnings:[],...extra});
const draft=(extra={})=>importDraft(source(extra),[],'США',now);
const document=()=>({revision:0,entries:[],collections:[]});
test('admin auto import publishes exact available prices and preserves options through SQLite persistence and public read',async()=>{
 const doc=document();const outcome=applyAutomaticCatalogImport(doc,draft(),now);assert.equal(outcome.published,true);
 assert.equal(doc.entries[0].published.price,25);assert.deepEqual(doc.entries[0].published.variants.map(v=>v.price),[25,32]);
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE market_settings(key TEXT PRIMARY KEY,value TEXT,updated_at INTEGER,updated_by TEXT); CREATE TABLE market_audit_events(id TEXT,actor_id TEXT,actor_email TEXT,action TEXT,entity_type TEXT,entity_id TEXT,details TEXT,created_at INTEGER);');
 const statement=(sql,args=[])=>({bind:(...values)=>statement(sql,values),first:async()=>sqlite.prepare(sql).get(...args)??null,run:async()=>({meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}})});
 const db={prepare:sql=>statement(sql),batch:async statements=>{sqlite.exec('BEGIN');try{const results=[];for(const item of statements)results.push(await item.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 globalThis.__adminAutoTestDb=db;
 const stub='data:text/javascript,'+encodeURIComponent('export const database=()=>globalThis.__adminAutoTestDb; export class HttpError extends Error {constructor(status,message){super(message);this.status=status}}');
 let code=await readFile(new URL('../lib/market/catalog-server.ts',import.meta.url),'utf8');
 code=code.replace("'./server'",JSON.stringify(stub)).replace("'./catalog-editor'",JSON.stringify(new URL('../lib/market/catalog-editor.ts',import.meta.url).href));
 const server=await import('data:text/javascript,'+encodeURIComponent(stripTypeScriptTypes(code)));
 await server.persistCatalog(doc,null,{userId:'operator',email:'operator@example.test'},'catalog.import-batch');
 const read=await server.readCatalog();const persisted=read.document.entries.find(e=>e.id===outcome.id);assert.ok(persisted);
 const visible=publicCatalog({...doc,entries:[persisted]},tariff,now).products[0];assert.equal(visible.sourcePrice,25);assert.equal(visible.sourceGroupId,'123456789012');assert.equal(visible.sourceVariants[0].offerId,'offer-red');assert.deepEqual(visible.sourceVariants[0].options,[{name:'Width',value:'Wide'}]);assert.equal(visible.sourceVariants[1].price,32);
 await assert.rejects(server.persistCatalog(doc,'stale-value',{userId:'operator',email:'operator@example.test'},'catalog.import-batch'),e=>e.status===409);
 assert.equal(sqlite.prepare("SELECT count(*) AS count FROM market_audit_events WHERE action='catalog.import-batch'").get().count,1);sqlite.close();delete globalThis.__adminAutoTestDb;
});
test('admin automatic unknown or partial imports wait for retry and cannot be manually confirmed',()=>{
 for(const extra of [{variantsComplete:false},{variants:[{...source().variants[0],availabilityKnown:false}]},{variants:[{...source().variants[0],image:undefined,images:[]}]},{variants:[{...source().variants[0],price:undefined}]}]){
 const doc=document(),outcome=applyAutomaticCatalogImport(doc,draft(extra),now);assert.equal(outcome.published,false);assert.ok(outcome.note);assert.equal(dueCatalogEntries(doc,now+3600001).length,1);assert.throws(()=>changeCatalog(doc,{kind:'confirm',ids:[outcome.id]},now+1));
 }
});
test('admin automatic import excludes unavailable options and deduplicates exact group without erasing collections',()=>{
 const doc=document();doc.collections=[{id:'c',name:'Collection',nameEn:'',nameUz:'',description:'',visible:true,position:0}];
 const first=draft({variants:[...source().variants,{id:'gone',label:'Gone',available:false,availabilityKnown:true,price:1}]});first.collectionIds=['c'];applyAutomaticCatalogImport(doc,first,now);
 doc.entries[0].draft.description='Editorial';const next=draft({sourceUrl:'https://www.ebay.com/itm/123456789012?var=222222'});applyAutomaticCatalogImport(doc,next,now+1);
 assert.equal(doc.entries.length,1);assert.equal(doc.entries[0].published.variants.length,2);assert.equal(doc.entries[0].published.description,'Editorial');assert.deepEqual(doc.entries[0].published.collectionIds,['c']);
});
test('admin retry publishes recovered queued import while manual hide stays hidden',()=>{
 const doc=document(),result=applyAutomaticCatalogImport(doc,draft({variantsComplete:false}),now);
 const refreshed=applyScheduledCatalogRefresh(doc,result.id,draft(),now+3600001).document;assert.ok(refreshed.entries[0].published);assert.equal(refreshed.entries[0].queueState,'published');
 const hidden=changeCatalog(refreshed,{kind:'hide',ids:[result.id]},now+3600002);assert.equal(dueCatalogEntries(hidden,now+10*86400000).length,0);applyAutomaticCatalogImport(hidden,draft(),now+3600003);assert.equal(hidden.entries[0].published,undefined);
});
test('automatic evidence cannot be replaced by editor supplied stock and price',()=>{
 const doc=document(),result=applyAutomaticCatalogImport(doc,draft({variantsComplete:false}),now);const edited=changeCatalog(doc,{kind:'edit',id:result.id,draft:{...doc.entries[0].draft,variantsComplete:true,price:1,lastCheckError:undefined,description:'Allowed description'}},now+1);
 assert.equal(edited.entries[0].draft.variantsComplete,false);assert.equal(edited.entries[0].draft.description,'Allowed description');assert.throws(()=>changeCatalog(edited,{kind:'publish',ids:[result.id]},now+2));assert.doesNotThrow(()=>catalogDocumentSchema.parse(JSON.parse(JSON.stringify(edited))));
});
test('automatic reimport never replaces a published snapshot with a partial response and hides confirmed soldout',()=>{
 const doc=document();applyAutomaticCatalogImport(doc,draft(),now);const previous=structuredClone(doc.entries[0].published);
 applyAutomaticCatalogImport(doc,draft({variantsComplete:false,variants:[source().variants[0]]}),now+1);assert.deepEqual(doc.entries[0].published,previous);
 applyAutomaticCatalogImport(doc,draft({variants:source().variants.map(v=>({...v,available:false,quantity:0}))}),now+2);assert.equal(doc.entries[0].published,undefined);assert.equal(doc.entries[0].refresh.status,'sold-out');assert.ok(dueCatalogEntries(doc,now+3600003).length);
});
test('same URL refresh stays one entry after operator country edits and duplicate identities cannot publish',()=>{
 const doc=document();applyAutomaticCatalogImport(doc,draft(),now);doc.entries[0].draft.country='Испания';applyAutomaticCatalogImport(doc,draft(),now+1);assert.equal(doc.entries.length,1);
 const bad=document(),variant=source().variants[0];const result=applyAutomaticCatalogImport(bad,draft({variants:[variant,{...variant,label:'Other label'}]}),now);assert.equal(result.published,false);assert.match(result.note,/идентификаторы/);
});
