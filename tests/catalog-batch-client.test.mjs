import test from 'node:test';
import assert from 'node:assert/strict';
import {runCatalogBatch} from '../lib/market/catalog-batch-client.mjs';
import {catalogBatchPath,isAuthorizedCatalogRefresh} from '../lib/market/catalog-refresh-auth.ts';
test('batch caller sends a signed, redirect-protected request with no user or URLs',async()=>{
 const now=Date.now();let captured;
 const result=await runCatalogBatch({environment:{ATLAS_SITE_URL:'https://atlasmarket.uz',ATLAS_CATALOG_BATCH_SECRET:'secret'},now:()=>now,fetcher:async(url,init)=>{captured={url,init};return Response.json({ok:true,processed:3})}});
 assert.equal(new URL(captured.url).pathname,catalogBatchPath);assert.equal(captured.init.redirect,'error');assert.equal(captured.init.body,undefined);
 assert.equal(await isAuthorizedCatalogRefresh(new Request(captured.url,captured.init),'secret',now,catalogBatchPath),true);assert.deepEqual(result,{processed:3});
});
test('batch caller rejects insecure origins',async()=>{
 await assert.rejects(()=>runCatalogBatch({environment:{ATLAS_SITE_URL:'http://atlasmarket.uz',ATLAS_CATALOG_BATCH_SECRET:'secret'}}));
});
