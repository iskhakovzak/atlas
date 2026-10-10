import test from 'node:test';
import assert from 'node:assert/strict';
import {createRouteMemory,withMerchantRoutes} from '../lib/importer/route-ladder.ts';
test('merchant routes use Tashkent first and stop after valid data',async()=>{
 const calls=[];const f=withMerchantRoutes(['tashkent','us-vps','residential'].map(name=>({name,fetch:async()=>{calls.push(name);return new Response('<title>Product</title>',{headers:{'content-type':'text/html'}})}})));
 const r=await f('https://www.gap.com/');assert.deepEqual(calls,['tashkent']);assert.equal(r.headers.get('x-atlas-route'),'tashkent');assert.equal(await r.text(),'<title>Product</title>');
});
test('blocked and HTML challenge answers escalate to residential',async()=>{
 const calls=[];const f=withMerchantRoutes(['tashkent','us-vps','residential'].map((name,i)=>({name,fetch:async()=>{calls.push(name);return i===0?new Response('',{status:403}):i===1?new Response('<title>Access Denied</title>',{headers:{'content-type':'text/html'}}):new Response('{"product":true}',{headers:{'content-type':'application/json'}})}})));
 const r=await f('https://www.gap.com/');assert.deepEqual(calls,['tashkent','us-vps','residential']);assert.equal(r.headers.get('x-atlas-route'),'residential');assert.equal(await r.text(),'{"product":true}');
});
test('merchant routes preserve 404 and abort without trying another route',async()=>{
 let next=0;const second={name:'us-vps',fetch:async()=>{next++;return new Response('bad')}};
 const r=await withMerchantRoutes([{name:'tashkent',fetch:async()=>new Response('',{status:404})},second])('https://www.gap.com/');assert.equal(r.status,404);assert.equal(next,0);
 const c=new AbortController();c.abort();await assert.rejects(withMerchantRoutes([second])('https://www.gap.com/',{signal:c.signal}));assert.equal(next,0);
});
test('a stalled early route leaves time for the next route',async()=>{
 const f=withMerchantRoutes([{name:'tashkent',fetch:async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))},{name:'us-vps',fetch:async()=>new Response('product')}],20);
 const keepAlive=setTimeout(()=>{},1000);
 try{assert.equal(await (await f('https://www.gap.com/')).text(),'product');}finally{clearTimeout(keepAlive);}
});

test('challenge redirects escalate without following them; proxy authentication errors stop',async()=>{
 let hits=0;const fallback={name:'us-vps',fetch:async()=>{hits++;return new Response('ok')}};
 const f=withMerchantRoutes([{name:'tashkent',fetch:async()=>new Response('',{status:307,headers:{location:'/blocked?x=1'}})},fallback]);assert.equal(await(await f('https://www.gap.com/')).text(),'ok');assert.equal(hits,1);
 const bad=withMerchantRoutes([{name:'tashkent',fetch:async()=>{throw Error('Importer proxy rejected the request (401).')}},fallback]);await assert.rejects(bad('https://www.gap.com/'),/401/);assert.equal(hits,1);
});
test('a route that just refused a store is skipped for that store until the memory expires',async()=>{
 let clock=0;const memory=createRouteMemory({ttlMs:1000,now:()=>clock});
 const calls=[];
 const routes=[
  {name:'tashkent',fetch:async url=>{calls.push('tashkent');return String(url).includes('gap')?new Response('',{status:403}):new Response('<title>Product</title>',{headers:{'content-type':'text/html'}})}},
  {name:'us-vps',fetch:async()=>{calls.push('us-vps');return new Response('<title>Product</title>',{headers:{'content-type':'text/html'}})}},
 ];
 const f=withMerchantRoutes(routes,3000,memory);
 assert.equal((await f('https://www.gap.com/a')).headers.get('x-atlas-route'),'us-vps');
 assert.deepEqual(calls.splice(0),['tashkent','us-vps']);
 assert.equal((await f('https://www.gap.com/b')).headers.get('x-atlas-route'),'us-vps');
 assert.deepEqual(calls.splice(0),['us-vps'],'the remembered refusal is not asked again');
 await f('https://www.zara.com/c');
 assert.deepEqual(calls.splice(0),['tashkent'],'other stores keep the full ladder');
 clock=1001;
 await f('https://www.gap.com/d');
 assert.deepEqual(calls.splice(0),['tashkent','us-vps'],'the route is asked again after the memory expires');
 // The last route is always asked, even if it refused before.
 const last=withMerchantRoutes([{name:'tashkent',fetch:async()=>{calls.push('only');return new Response('',{status:403})}}],3000,memory);
 memory.failed('tashkent','www.gap.com');
 assert.equal((await last('https://www.gap.com/e')).status,403);
 assert.deepEqual(calls.splice(0),['only']);
});
