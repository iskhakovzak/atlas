import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogSaleJobSchema,createCatalogSaleRunner,publicSaleJob,saleDraftFromEvidence} from '../lib/market/catalog-sale.ts';
import {applyAutomaticCatalogImport} from '../lib/market/catalog-editor.ts';

const item=(id='123456789012')=>({url:`https://www.ebay.com/itm/${id}`,listingId:id,seller:'adidas_official',price:25,currency:'USD',referencePrice:50});
const input={sourceUrl:'https://www.ebay.com/str/adidas?_sacat=15709',country:'США',collectionIds:[]};
test('server-recorded principal is optional for old jobs and omitted from the browser response',async()=>{
 const {runner}=setup();let job=await runner.start('alice',input);assert.equal(job.principal,undefined);
 job=await runner.start('alice',input,{email:'operator@example.com',method:'google'});assert.equal(job.principal.email,'operator@example.com');assert.equal('principal' in publicSaleJob(job),false);
 job=await runner.control('alice',job.id,false);job=await runner.control('alice',job.id,true,{email:'new@example.com',method:'email'});assert.equal(job.principal.email,'new@example.com');
});
function setup(extra={}){
 const rows=new Map();let clock=10000,n=0;
 const store={async read(owner){const raw=rows.get(owner);return raw?{raw,job:catalogSaleJobSchema.parse(JSON.parse(raw))}:undefined;},async write(owner,job,old){if((rows.get(owner)??null)!==old)return false;rows.set(owner,JSON.stringify(catalogSaleJobSchema.parse(job)));return true;}};
 const runner=createCatalogSaleRunner({store,now:()=>clock,uuid:()=>`job-${++n}`,discover:async()=>({items:[item()],scanned:1,matched:1,limited:false}),importItem:async()=>({published:true}),...extra});
 return {runner,store,advance:()=>{clock+=120000}};
}
test('seller pages resume from durable progress, deduplicate native listings and stay scoped to the operator',async()=>{
 const seen=[];const {runner}=setup({discover:async(_,cursor)=>cursor?{items:[item(),item('123456789013')],scanned:2,matched:2,limited:false}:{items:[item()],scanned:1,matched:1,nextCursor:'next',limited:false},importItem:async i=>{seen.push(i.listingId);return {published:true}}});
 let job=await runner.start('alice',input);assert.equal((await runner.start('alice',input)).id,job.id);
 job=await runner.step('alice',job.id);assert.equal(job.status,'running');assert.equal(job.published,1);
 assert.equal(await runner.read('bob'),undefined);await assert.rejects(runner.control('bob',job.id,false));
 job=await runner.step('alice',job.id);assert.equal(job.status,'completed');assert.equal(job.published,2);assert.equal(job.scanned,3);assert.deepEqual(seen,['123456789012','123456789013']);
 assert.equal((await runner.step('alice',job.id)).processed,2);
});
test('two tabs cannot import under the same lease and pausing preserves completed progress',async()=>{
 let finish,entered;const gate=new Promise(resolve=>finish=resolve),ready=new Promise(resolve=>entered=resolve);let imports=0;
 const {runner}=setup({importItem:async()=>{imports++;entered();await gate;return {published:true}}});
 const job=await runner.start('alice',input),running=runner.step('alice',job.id);await ready;
 await runner.step('alice',job.id);assert.equal(imports,1);
 await runner.control('alice',job.id,false);finish();const result=await running;
 assert.equal(result.processed,1);assert.equal(result.published,1);assert.equal(result.pending.length,0);assert.equal(result.status,'completed');
});
test('a slow storefront step remains leased beyond the scheduler timeout',async()=>{
 let finish,entered;const gate=new Promise(resolve=>finish=resolve),ready=new Promise(resolve=>entered=resolve);let imports=0;
 const {runner,advance}=setup({importItem:async()=>{imports++;entered();await gate;return {published:true}}});
 const job=await runner.start('alice',input),running=runner.step('alice',job.id);await ready;advance();
 await runner.step('alice',job.id);assert.equal(imports,1);finish();await running;
});
test('failed saves retain the item and retry with backoff instead of reporting a false successful import',async()=>{
 let attempts=0;const {runner,advance}=setup({importItem:async()=>{if(++attempts<3)throw Error('database busy');return {published:true}}});
 let job=await runner.start('alice',input);job=await runner.step('alice',job.id);
 assert.equal(job.processed,0);assert.equal(job.pending.length,1);assert.equal(job.status,'running');assert.equal(job.failed,1);
 await runner.step('alice',job.id);assert.equal(attempts,1,'wait for the retry deadline');
 advance();job=await runner.step('alice',job.id);assert.equal(job.pending.length,1);
 advance();job=await runner.step('alice',job.id);assert.equal(job.status,'completed');assert.equal(job.published,1);assert.equal(job.failed,2);
});
test('three provider failures pause safely, and resuming keeps the pending item',async()=>{
 const {runner,advance}=setup({importItem:async()=>{throw Error('eBay quota');}});let job=await runner.start('alice',input);
 for(let i=0;i<3;i++){advance();job=await runner.step('alice',job.id);}
 assert.equal(job.status,'paused');assert.equal(job.pending.length,1);assert.equal(job.processed,0);
 job=await runner.control('alice',job.id,true);assert.equal(job.pending.length,1);assert.equal(job.status,'running');assert.equal(job.retryAt,0);
});
test('discount publication requires matching detailed price, currency, native listing and confirmed stock',()=>{
 const source={sourceUrl:item().url,title:'Adidas sale shoe',brand:'adidas',category:'Обувь',currency:'USD',variantScope:'item',variantsComplete:true,image:'https://i.ebayimg.com/images/g/test/s-l1600.jpg',images:[],variants:[{id:'exact',available:true,availabilityKnown:true,price:25,image:'https://i.ebayimg.com/images/g/test/s-l1600.jpg',label:'US 9'}],warnings:[]};
 const draft=saleDraftFromEvidence(item(),source,input);assert.equal(draft.referencePrice,50);
 for(const changed of [{currency:'EUR'},{sourceUrl:'https://www.ebay.com/itm/123456789099'},{variants:[{...source.variants[0],price:26}]},{variants:[{...source.variants[0],available:false}]}])assert.equal(saleDraftFromEvidence(item(),{...source,...changed},input),undefined);
 assert.equal(saleDraftFromEvidence({...item(),referencePrice:25,discountPercentage:50},source,input),undefined);
 assert.equal(saleDraftFromEvidence({...item(),referencePrice:undefined},source,input),undefined);
 const doc={revision:0,entries:[],collections:[]};assert.equal(applyAutomaticCatalogImport(doc,draft).published,true);
 assert.equal(applyAutomaticCatalogImport({revision:0,entries:[],collections:[]},{...draft,variantsComplete:false}).published,false,'partial groups must not auto-publish');
});
