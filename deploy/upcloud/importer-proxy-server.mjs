import {createServer} from 'node:http';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const requestHeaderNames=new Set([
  'accept','accept-language','anti-csrftoken-a2z','cache-control','content-type','cookie','origin','referer',
  'sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-platform','sec-fetch-dest','sec-fetch-mode','sec-fetch-site','user-agent','x-requested-with',
]);
const maxRequestBytes=32_768;
const maxResponseBytes=6_000_000;
const maxConcurrent=16;
const maxPerMinute=240;

export function safeMerchantTarget(value,allowedHosts){
  let url;
  try{url=new URL(value)}catch{return undefined}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!allowedHosts.has(url.hostname.toLowerCase()))return undefined;
  return url;
}

function readBody(stream,limit){
  return new Promise((resolve,reject)=>{
    const chunks=[];let size=0;
    stream.on('data',chunk=>{
      size+=chunk.length;
      if(size>limit){reject(Object.assign(new Error('body_limit'),{status:413}));stream.destroy();return}
      chunks.push(chunk);
    });
    stream.on('end',()=>resolve(Buffer.concat(chunks,size)));
    stream.on('error',error=>reject(error));
  });
}

async function readUpstream(response,limit){
  if(!response.body)return Buffer.alloc(0);
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>limit){await reader.cancel();throw Object.assign(new Error('response_limit'),{status:502})}
      chunks.push(Buffer.from(value));
    }
  }finally{reader.releaseLock()}
  return Buffer.concat(chunks,size);
}

function send(res,status,body){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','connection':'close'});
  res.end(JSON.stringify(body));
}

function validateHeaders(raw,target,body,method,allowedHosts){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return undefined;
  const result={};let total=0;
  for(const [name,value] of Object.entries(raw)){
    const key=name.toLowerCase();
    if(!requestHeaderNames.has(key)||typeof value!=='string'||value.length>4096||/[\r\n\0]/.test(value))return undefined;
    total+=key.length+value.length;
    if(total>8192)return undefined;
    if(key==='cookie'&&target.hostname!=='www.amazon.com'&&target.hostname!=='amazon.com')return undefined;
    if(key==='referer'||key==='origin'){
      let referenced;
      try{referenced=new URL(value)}catch{return undefined}
      if(referenced.protocol!=='https:'||referenced.username||referenced.password||referenced.port||
        referenced.hostname.toLowerCase()!==target.hostname.toLowerCase()||!allowedHosts.has(referenced.hostname.toLowerCase()))return undefined;
      if(key==='origin'&&referenced.origin!==value)return undefined;
    }
    result[key]=value;
  }
  if(method==='GET'&&body!==undefined)return undefined;
  if(method==='POST'){
    if(target.hostname!=='www.amazon.com'||target.pathname!=='/gp/delivery/ajax/address-change.html'||target.search||typeof body!=='string'||body.length>8192||
      !String(result['content-type']??'').toLowerCase().startsWith('application/x-www-form-urlencoded'))return undefined;
  }
  return result;
}

export function createImporterProxyServer({secret,allowedHosts,fetcher=fetch,now=Date.now}){
  if(typeof secret!=='string'||!/^[a-f0-9]{64,}$/i.test(secret))throw new Error('ATLAS_IMPORT_PROXY_SECRET must be a random 32-byte hex value.');
  if(!(allowedHosts instanceof Set)||!allowedHosts.size)throw new Error('Importer proxy store-host allowlist is empty.');
  const nonces=new Map(),recent=[];let active=0,requests=0;
  const handler=async(req,res)=>{
    if(req.method!=='POST'||req.url!=='/v1/fetch')return send(res,404,{error:'not_found'});
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))return send(res,415,{error:'unsupported_media_type'});
    const length=Number(req.headers['content-length']??0);
    if(!Number.isFinite(length)||length<0||length>maxRequestBytes)return send(res,413,{error:'request_too_large'});
    let raw;
    try{raw=(await readBody(req,maxRequestBytes)).toString('utf8')}catch(error){return send(res,error.status??400,{error:'invalid_request'})}
    const timestamp=req.headers['x-atlas-proxy-timestamp'],nonce=req.headers['x-atlas-proxy-nonce'],signature=req.headers['x-atlas-proxy-signature'];
    if(typeof timestamp!=='string'||!/^\d{13}$/.test(timestamp)||Math.abs(now()-Number(timestamp))>60_000||
       typeof nonce!=='string'||! /^[a-f0-9]{32}$/i.test(nonce)||typeof signature!=='string'||! /^[a-f0-9]{64}$/i.test(signature))return send(res,401,{error:'unauthorized'});
    const expected=createHmac('sha256',secret).update(`${timestamp}\n${nonce}\n${raw}`).digest();
    const supplied=Buffer.from(signature,'hex');
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return send(res,401,{error:'unauthorized'});
    if(nonces.has(nonce))return send(res,409,{error:'replayed_request'});
    nonces.set(nonce,now()+120_000);
    requests++;
    if(requests%100===0){for(const [key,until] of nonces)if(until<now())nonces.delete(key)}
    while(recent.length&&recent[0]<now()-60_000)recent.shift();
    recent.push(now());
    if(recent.length>maxPerMinute)return send(res,429,{error:'rate_limited'});
    if(active>=maxConcurrent)return send(res,503,{error:'busy'});
    let payload;
    try{payload=JSON.parse(raw)}catch{return send(res,400,{error:'invalid_request'})}
    const target=payload?.version===1?safeMerchantTarget(payload.url,allowedHosts):undefined;
    const method=payload?.method;
    const body=payload?.body;
    const headers=target&&(method==='GET'||method==='POST')?validateHeaders(payload.headers,target,body,method,allowedHosts):undefined;
    if(!target||!headers||body!==undefined&&typeof body!=='string'||body!==undefined&&body.length>16_384)return send(res,400,{error:'invalid_target_or_headers'});
    active++;
    try{
      const upstream=await fetcher(target,{method,headers,redirect:'manual',signal:AbortSignal.timeout(14_000),...(body!==undefined?{body}:{})});
      const bytes=await readUpstream(upstream,maxResponseBytes);
      const setCookie=typeof upstream.headers.getSetCookie==='function'?upstream.headers.getSetCookie():[];
      const responseHeaders={
        ...(upstream.headers.get('content-type')?{contentType:upstream.headers.get('content-type').slice(0,256)}:{}),
        ...(upstream.headers.get('location')?{location:upstream.headers.get('location').slice(0,4096)}:{}),
        setCookie:setCookie.slice(0,20).map(value=>value.slice(0,4096)),
      };
      return send(res,200,{version:1,status:upstream.status,headers:responseHeaders,body:bytes.toString('base64')});
    }catch(error){
      const status=error?.name==='TimeoutError'||error?.name==='AbortError'?504:error.status??502;
      return send(res,200,{version:1,status,headers:{contentType:'text/plain'},body:''});
    }finally{active--}
  };
  return createServer((req,res)=>{void handler(req,res).catch(()=>{if(!res.headersSent)send(res,500,{error:'internal_error'});else res.destroy()})});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const secret=process.env.ATLAS_IMPORT_PROXY_SECRET??'';
  const hosts=JSON.parse(readFileSync(new URL('./supported-store-hosts.json',import.meta.url),'utf8'));
  const allowedHosts=new Set(hosts);
  const port=Number(process.env.ATLAS_IMPORT_PROXY_PORT??8787);
  const server=createImporterProxyServer({secret,allowedHosts});
  server.listen(port,'127.0.0.1',()=>process.stdout.write('atlas importer proxy ready\n'));
}
