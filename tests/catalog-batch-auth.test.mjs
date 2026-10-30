import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogBatchPath,catalogRefreshPath,isAuthorizedCatalogRefresh,signCatalogRefreshRequest} from '../lib/market/catalog-refresh-auth.ts';
test('batch scheduler signature is time and path bound',async()=>{
 const secret='test-secret',now=Date.now(),timestamp=String(now),signature=await signCatalogRefreshRequest(secret,timestamp,catalogBatchPath);
 const request=path=>new Request('https://atlasmarket.uz'+path,{method:'POST',headers:{'x-atlas-refresh-timestamp':timestamp,'x-atlas-refresh-signature':signature}});
 assert.equal(await isAuthorizedCatalogRefresh(request(catalogBatchPath),secret,now,catalogBatchPath),true);
 assert.equal(await isAuthorizedCatalogRefresh(request(catalogRefreshPath),secret,now),false);
 assert.equal(await isAuthorizedCatalogRefresh(request(catalogBatchPath),secret,now+360001,catalogBatchPath),false);
 assert.equal(await isAuthorizedCatalogRefresh(request(catalogBatchPath),'wrong',now,catalogBatchPath),false);
});
