import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createImporterProxyServer} from '../deploy/upcloud/importer-proxy-server.mjs';
import {blockedSignal,createEnginePlanner,fetchWithEngines} from '../deploy/upcloud/merchant-engines.mjs';
import {createMerchantProxyFetch} from '../lib/importer/proxy-client.mjs';
import {fetchProduct,ManualEntryFallbackError,describeImportDiagnostic,detectBotChallenge} from '../lib/importer/fetch.ts';

const secret='b'.repeat(64);
const now=1_797_000_000_000;
const product='<html><script type="application/ld+json">{"@type":"Product","name":"Shirt","image":"https://cdn.example.com/a.jpg","offers":{"price":"20","priceCurrency":"USD"}}</script></html>';
const html=(body,status=200)=>new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8'}});
let nonceCounter=0;

function signed(payload){
  const body=JSON.stringify(payload),timestamp=String(now),nonce=String(++nonceCounter).padStart(32,'e');
  const signature=createHmac('sha256',secret).update(`${timestamp}\n${nonce}\n${body}`).digest('hex');
  return {body,headers:{'content-type':'application/json','x-atlas-proxy-timestamp':timestamp,'x-atlas-proxy-nonce':nonce,'x-atlas-proxy-signature':signature}};
}

async function withProxy(t,{fetcher,impersonator,log}){
  const server=createImporterProxyServer({secret,allowedHosts:new Set(['www.sephora.com','www.amazon.com']),fetcher,impersonator,log,now:()=>now});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))});
  const endpoint=`http://127.0.0.1:${server.address().port}/v1/fetch`;
  return async payload=>{const request=signed(payload);const response=await fetch(endpoint,{method:'POST',headers:request.headers,body:request.body});return {status:response.status,json:await response.json()}};
}

test('blockedSignal names walls and lets product pages and ordinary redirects through',()=>{
  const bytes=value=>Buffer.from(value);
  assert.equal(blockedSignal(403,undefined,'text/html',bytes('')),'http-403');
  assert.equal(blockedSignal(307,'/blocked?url=abc','text/html',bytes('')),'redirect-wall');
  assert.equal(blockedSignal(301,'https://www.sephora.com/product/x','text/html',bytes('')),undefined);
  assert.equal(blockedSignal(200,undefined,'text/html',bytes('<meta http-equiv="refresh" bm-verify="1">')),'akamai');
  assert.equal(blockedSignal(200,undefined,'text/html',bytes('<div id="px-captcha"></div>')),'perimeterx');
  // A product page that also loads reCAPTCHA for its review form is not a wall.
  assert.equal(blockedSignal(200,undefined,'text/html',bytes(product+'<script src="recaptcha.js"></script>')),undefined);
  assert.equal(blockedSignal(200,undefined,'application/json',bytes('{"px-captcha":1}')),undefined);
});

test('auto mode escalates a walled answer to the Chrome fingerprint and remembers the winner per host',async t=>{
  const calls=[],lines=[];
  const call=await withProxy(t,{
    fetcher:async()=>{calls.push('fetch');return new Response('',{status:403})},
    impersonator:async(_target,init)=>{calls.push('impersonate:'+(init.headers['user-agent']??'chrome'));return html(product)},
    log:entry=>lines.push(entry),
  });
  const payload={version:1,url:'https://www.sephora.com/product/x',method:'GET',headers:{accept:'text/html'},engine:'auto'};
  const first=await call(payload);
  assert.equal(first.json.status,200);
  assert.equal(first.json.engine,'impersonate');
  assert.deepEqual(first.json.attempts,['fetch:403:http-403','impersonate:200']);
  const second=await call(payload);
  assert.deepEqual(second.json.attempts,['impersonate:200']);
  assert.deepEqual(calls,['fetch','impersonate:chrome','impersonate:chrome']);
  // The journal gets the store and the engine attempts, never the product URL.
  assert.deepEqual(lines.map(line=>Object.keys(line).sort()),[['attempts','host','ms'],['attempts','host','ms']]);
  assert.ok(lines.every(line=>!JSON.stringify(line).includes('/product/')));
});

test('clients without an engine keep the plain request; cookies and POSTs never escalate',async t=>{
  let impersonated=0;
  const call=await withProxy(t,{fetcher:async()=>new Response('',{status:403}),impersonator:async()=>{impersonated++;return html(product)}});
  const legacy=await call({version:1,url:'https://www.sephora.com/product/x',method:'GET',headers:{}});
  assert.equal(legacy.json.status,403);
  assert.equal(legacy.json.engine,'fetch');
  const withCookie=await call({version:1,url:'https://www.amazon.com/dp/X',method:'GET',headers:{cookie:'i18n-prefs=USD'},engine:'auto'});
  assert.deepEqual(withCookie.json.attempts,['fetch:403:http-403']);
  assert.equal(impersonated,0);
});

test('unknown or missing engines are refused before any merchant request',async t=>{
  let requested=0;
  const call=await withProxy(t,{fetcher:async()=>{requested++;return html(product)}});
  for(const engine of ['impersonate','constructor','browser']){
    const result=await call({version:1,url:'https://www.sephora.com/product/x',method:'GET',headers:{},engine});
    assert.equal(result.status,400);
  }
  assert.equal(requested,0);
  // Without the optional package, auto mode is the plain request alone.
  const auto=await call({version:1,url:'https://www.sephora.com/product/x',method:'GET',headers:{},engine:'auto'});
  assert.deepEqual(auto.json.attempts,['fetch:200']);
});

test('the engine ladder returns the last answer when every engine meets a wall',async()=>{
  const planner=createEnginePlanner(['fetch','impersonate']);
  const result=await fetchWithEngines({
    target:new URL('https://www.walmart.com/ip/1'),method:'GET',headers:{},mode:'auto',planner,
    engines:{fetch:async()=>new Response('',{status:403}),impersonate:async()=>new Response('',{status:307,headers:{location:'/blocked?x'}})},
  });
  assert.equal(result.status,307);
  assert.deepEqual(result.attempts,['fetch:403:http-403','impersonate:307:redirect-wall']);
  // A host with no success keeps the default order.
  assert.deepEqual(planner.order('www.walmart.com'),['fetch','impersonate']);
});

test('the Worker client asks for auto mode and the importer reports what the engines saw',async()=>{
  let payload;
  const fetcher=createMerchantProxyFetch({endpoint:'https://85-9-196-196.sslip.io/v1/fetch',secret,fetchImpl:async(_url,init)=>{
    payload=JSON.parse(init.body);
    return Response.json({version:1,status:403,engine:'impersonate',attempts:['fetch:403:http-403','impersonate:403:http-403'],headers:{contentType:'text/html'},body:''});
  }});
  const error=await fetchProduct('https://www.sephora.com/product/x',fetcher).catch(value=>value);
  assert.equal(payload.engine,'auto');
  assert.ok(error instanceof ManualEntryFallbackError);
  assert.equal(error.reason,'blocked');
  assert.deepEqual(error.diagnostic,{status:403,engine:'impersonate',attempts:'fetch:403:http-403 impersonate:403:http-403'});
  assert.equal(describeImportDiagnostic(error.diagnostic),'HTTP 403 · fetch:403:http-403 impersonate:403:http-403');
});

test('a same-site redirect to a block page stops the import without opening it',async()=>{
  const requested=[];
  const error=await fetchProduct('https://www.walmart.com/ip/719693356',async url=>{
    requested.push(new URL(String(url)).pathname);
    return new Response(null,{status:307,headers:{location:'/blocked?url=L2lw'}});
  }).catch(value=>value);
  assert.ok(error instanceof ManualEntryFallbackError);
  assert.equal(error.reason,'blocked');
  assert.equal(error.diagnostic.vendor,'redirect-wall');
  assert.deepEqual(requested,['/ip/719693356']);
});

test('a tiny Akamai sensor page with HTTP 200 is a wall for both the proxy and the importer',()=>{
  // Shape seen on levi.com / newbalance.com: a 2–3 KB page, one obfuscated same-site script, no product.
  const sensor='<!doctype html><html><head><title></title></head><body><script type="text/javascript" src="/h_PR/PQAi/lv/gV09/BI7A/Shf9LzS1?v=b32a42f8-996b-39d9-acad-75e17d0b172e" defer></script></body></html>';
  const container='<html><body><div id="sec-if-cpt-container"><iframe src="/_sec/cp_challenge/ak-challenge-4-3.htm"></iframe></div></body></html>';
  for(const page of [sensor,container]){
    assert.equal(blockedSignal(200,undefined,'text/html',Buffer.from(page)),'akamai');
    assert.equal(detectBotChallenge(page),'Akamai');
  }
  // The same sensor script on a full product page is just Bot Manager running alongside the page.
  const full=product.replace('</html>',sensor.slice(sensor.indexOf('<script'))+'<div>'+'x'.repeat(20_000)+'</div></html>');
  assert.equal(blockedSignal(200,undefined,'text/html',Buffer.from(full)),undefined);
  assert.equal(detectBotChallenge(full),undefined);
  const largeWithoutJsonLd='<html><body>'+'<p>catalog</p>'.repeat(2000)+sensor.slice(sensor.indexOf('<script'))+'</body></html>';
  assert.equal(blockedSignal(200,undefined,'text/html',Buffer.from(largeWithoutJsonLd)),undefined);
  assert.equal(detectBotChallenge(largeWithoutJsonLd),undefined);
});
