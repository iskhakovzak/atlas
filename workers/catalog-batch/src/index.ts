/** Separate Cron Worker; it never accepts product URLs or an operator identity. */
export interface Env {ATLAS_SITE_URL?:string;ATLAS_CATALOG_BATCH_SECRET?:string}
const path='/api/internal/catalog-batch';
const encoder=new TextEncoder();
const maxCalls=2;
const nextCallDeadlineMs=30_000;
const requestTimeoutMs=85_000;
const maxResponseBytes=16_384;
class BatchWorkerError extends Error{
 readonly reasonCode:string;readonly status?:number;
 constructor(reasonCode:string,status?:number){super(reasonCode);this.reasonCode=reasonCode;this.status=status}
}
function siteOrigin(value:string|undefined){
 if(!value||value!==value.trim())throw new BatchWorkerError('site_url_invalid');
 let url:URL;try{url=new URL(value)}catch{throw new BatchWorkerError('site_url_invalid')}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash)throw new BatchWorkerError('site_origin_required');
 return url.origin;
}
async function signature(secret:string,timestamp:string){
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=await crypto.subtle.sign('HMAC',key,encoder.encode(`${timestamp}\nPOST\n${path}`));
 return [...new Uint8Array(signed)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
async function responseBody(response:Response){
 if(Number(response.headers.get('content-length'))>maxResponseBytes)throw new BatchWorkerError('invalid_response');
 const reader=response.body?.getReader();if(!reader)throw new BatchWorkerError('invalid_response');
 const decoder=new TextDecoder();let text='',bytes=0;
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxResponseBytes){await reader.cancel();throw new BatchWorkerError('invalid_response')}text+=decoder.decode(value,{stream:true})}
 try{return JSON.parse(text+decoder.decode()) as unknown}catch{throw new BatchWorkerError('invalid_response')}
}
/** Every call advances at most one ten-link slice; no unbounded drain or parallel calls. */
export async function runBatchCron(env:Env,fetcher:typeof fetch=fetch,now:()=>number=Date.now){
 const origin=siteOrigin(env.ATLAS_SITE_URL),secret=env.ATLAS_CATALOG_BATCH_SECRET;
 if(typeof secret!=='string'||!secret.trim())throw new BatchWorkerError('batch_secret_missing');
 const started=now();let processed=0,calls=0,lastTimestamp=0;
 while(calls<maxCalls&&(calls===0||now()-started<nextCallDeadlineMs)){
  const timestamp=Math.max(now(),lastTimestamp+1);lastTimestamp=timestamp;
  let response:Response;
  try{response=await fetcher(origin+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(requestTimeoutMs),headers:{'x-atlas-refresh-timestamp':String(timestamp),'x-atlas-refresh-signature':await signature(secret,String(timestamp)),accept:'application/json'}})}catch{throw new BatchWorkerError('upstream_unreachable')}
  if(!response.ok)throw new BatchWorkerError('upstream_rejected',response.status);
  const body=await responseBody(response);if(!body||typeof body!=='object'||Array.isArray(body))throw new BatchWorkerError('invalid_response');
  const result=body as {ok?:unknown;processed?:unknown};
  if(result.ok!==true||!Number.isSafeInteger(result.processed)||typeof result.processed!=='number'||result.processed<0||result.processed>10)throw new BatchWorkerError('invalid_response');
  calls++;processed+=result.processed;if(result.processed===0)break;
 }
 return {calls,processed};
}
const worker={
 async scheduled(_event:ScheduledController,env:Env,ctx:ExecutionContext){
  ctx.waitUntil((async()=>{try{const result=await runBatchCron(env);console.log(JSON.stringify({event:'atlas_catalog_batch',outcome:'success',...result}))}
   catch(error){const known=error instanceof BatchWorkerError?error:undefined;console.error(JSON.stringify({event:'atlas_catalog_batch',outcome:'failure',reasonCode:known?.reasonCode??'unexpected_failure',...(known?.status?{status:known.status}:{})}))}})());
 },
 async fetch(){return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}})},
};
export default worker;
