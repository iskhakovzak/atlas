import {createHmac} from 'node:crypto';
import {buildCatalogRefreshEndpoint,CatalogRefreshClientError} from './catalog-refresh-client.mjs';
const path='/api/internal/catalog-batch';
/** The caller sets a site URL and refresh secret in its own environment; no URLs or identities enter the request. */
export async function runCatalogBatch({environment=process.env,fetcher=fetch,now=Date.now}={}){
 const endpoint=buildCatalogRefreshEndpoint(environment);endpoint.pathname=path;
 const secret=environment.ATLAS_CATALOG_BATCH_SECRET;
 if(typeof secret!=='string'||!secret.trim())throw new CatalogRefreshClientError('batch_secret_missing');
 const timestamp=String(now()),signature=createHmac('sha256',secret).update(`${timestamp}\nPOST\n${path}`).digest('hex');
 let response;
 try{response=await fetcher(endpoint.href,{method:'POST',redirect:'error',signal:AbortSignal.timeout(180_000),headers:{'x-atlas-refresh-timestamp':timestamp,'x-atlas-refresh-signature':signature,accept:'application/json'}})}catch{throw new CatalogRefreshClientError('upstream_unavailable')}
 if(!response.ok)throw new CatalogRefreshClientError('upstream_http_error',response.status);
 const size=Number(response.headers.get('content-length'));if(Number.isFinite(size)&&size>16384)throw new CatalogRefreshClientError('upstream_invalid_response');
 let data;try{
  const reader=response.body?.getReader();if(!reader)throw Error('missing body');const decoder=new TextDecoder();let text='',bytes=0;
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16384){await reader.cancel();throw Error('too large')}text+=decoder.decode(value,{stream:true})}
  data=JSON.parse(text+decoder.decode());
 }catch{throw new CatalogRefreshClientError('upstream_invalid_response')}
 if(!data||data.ok!==true||!Number.isSafeInteger(data.processed)||data.processed<0||data.processed>10)throw new CatalogRefreshClientError('upstream_invalid_response');
 return {processed:data.processed};
}
