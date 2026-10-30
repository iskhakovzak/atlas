import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{runBatchCron} from '../workers/catalog-batch/src/index.ts';
import {catalogBatchPath,isAuthorizedCatalogRefresh} from '../lib/market/catalog-refresh-auth.ts';
const now=Date.now(),env={ATLAS_SITE_URL:'https://atlas.example.test',ATLAS_CATALOG_BATCH_SECRET:'fake-test-key'};
test('worker signs at most two sequential calls with no request body',async()=>{
 const seen=[];
 const result=await runBatchCron(env,async(url,init)=>{seen.push({url,init});return Response.json({ok:true,processed:10})},()=>now);
 assert.deepEqual(result,{calls:2,processed:20});
 assert.notEqual(seen[0].init.headers['x-atlas-refresh-timestamp'],seen[1].init.headers['x-atlas-refresh-timestamp']);
 for(const item of seen){assert.equal(new URL(item.url).pathname,catalogBatchPath);assert.equal(item.init.redirect,'manual');assert.equal(item.init.body,undefined);assert.equal(await isAuthorizedCatalogRefresh(new Request(item.url,item.init),env.ATLAS_CATALOG_BATCH_SECRET,now,catalogBatchPath),true)}
});
test('worker stops immediately when no work is eligible',async()=>{
 let calls=0;const result=await runBatchCron(env,async()=>{calls++;return Response.json({ok:true,processed:0})},()=>now);
 assert.deepEqual(result,{calls:1,processed:0});assert.equal(calls,1);
});
test('worker does not begin another batch after its start deadline',async()=>{
 let clock=now,calls=0;const result=await runBatchCron(env,async()=>{calls++;clock+=30000;return Response.json({ok:true,processed:10})},()=>clock);
 assert.equal(calls,1);assert.equal(result.processed,10);
});
test('worker refuses unsafe site origins and missing secrets',async()=>{
 for(const url of ['http://atlas.example.test','https://atlas.example.test:1234','https://atlas.example.test/path','https://atlas.example.test/?x=1'])await assert.rejects(()=>runBatchCron({...env,ATLAS_SITE_URL:url}));
 await assert.rejects(()=>runBatchCron({...env,ATLAS_CATALOG_BATCH_SECRET:undefined}));
});
test('worker rejects malformed or oversized responses without exposing its secret',async()=>{
 for(const response of [Response.json({ok:true,processed:11}),new Response('x'.repeat(17000)),new Response('bad'),new Response('',{status:403})]){
  await assert.rejects(()=>runBatchCron(env,async()=>response),error=>!String(error).includes(env.ATLAS_CATALOG_BATCH_SECRET));
 }
});
test('worker diagnoses timeouts and redirects without logging private error messages',async()=>{
 for(const [error,code] of [[new DOMException('hidden detail','TimeoutError'),'upstream_timeout'],[new TypeError('redirect hidden detail'),'upstream_redirect'],[new Error('hidden detail'),'upstream_unreachable']]){
  await assert.rejects(()=>runBatchCron(env,async()=>{throw error}),e=>e.reasonCode===code&&!String(e).includes('hidden detail'));
 }
});
test('redirects are not followed and only a safe destination category is reported',async()=>{
 let calls=0;await assert.rejects(()=>runBatchCron(env,async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://login.example.test/?token=private'}})}),e=>e.reasonCode==='upstream_redirect_other'&&!String(e).includes('private'));assert.equal(calls,1);
});
test('worker has no public HTTP controls',async()=>{const response=await worker.fetch();assert.equal(response.status,404)});
