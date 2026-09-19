export const catalogRefreshPath='/api/internal/catalog-refresh';
const encoder=new TextEncoder();
const maxClockSkew=5*60*1000;

function hex(bytes:Uint8Array){
  return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
}

function bytes(value:string){
  if(!/^[a-f0-9]{64}$/i.test(value))return;
  const result=new Uint8Array(value.length/2);
  for(let index=0;index<result.length;index++)result[index]=Number.parseInt(value.slice(index*2,index*2+2),16);
  return result;
}

function equal(left:Uint8Array,right:Uint8Array){
  let difference=left.length^right.length;
  const length=Math.max(left.length,right.length);
  for(let index=0;index<length;index++)difference|=(left[index]??0)^(right[index]??0);
  return difference===0;
}

async function signature(secret:string,timestamp:string,method:string,path:string){
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=await crypto.subtle.sign('HMAC',key,encoder.encode(`${timestamp}\n${method.toUpperCase()}\n${path}`));
  return new Uint8Array(signed);
}

/** Used by the separate cron worker; the secret never enters browser code. */
export async function signCatalogRefreshRequest(secret:string,timestamp:string){
  return hex(await signature(secret,timestamp,'POST',catalogRefreshPath));
}

export async function isAuthorizedCatalogRefresh(request:Request,secret:string|undefined,now=Date.now()){
  if(!secret)return false;
  const timestamp=request.headers.get('x-atlas-refresh-timestamp')??'';
  const value=Number(timestamp);
  if(!/^\d{13}$/.test(timestamp)||!Number.isSafeInteger(value)||Math.abs(now-value)>maxClockSkew)return false;
  if(request.method!=='POST'||new URL(request.url).pathname!==catalogRefreshPath)return false;
  const supplied=bytes(request.headers.get('x-atlas-refresh-signature')??'');
  if(!supplied)return false;
  return equal(await signature(secret,timestamp,request.method,catalogRefreshPath),supplied);
}
