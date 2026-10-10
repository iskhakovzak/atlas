import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createImporterProxyServer} from '../deploy/upcloud/importer-proxy-server.mjs';

const secret='b'.repeat(64);
const nonce='c'.repeat(32);
const now=1_797_000_000_000;

function signedHeaders(payload,requestNonce=nonce){
  const body=JSON.stringify(payload);
  const timestamp=String(now);
  const signature=createHmac('sha256',secret).update(`${timestamp}\n${requestNonce}\n${body}`).digest('hex');
  return {
    body,
    headers:{
      'content-type':'application/json',
      'x-atlas-proxy-timestamp':timestamp,
      'x-atlas-proxy-nonce':requestNonce,
      'x-atlas-proxy-signature':signature,
    },
  };
}

async function withProxy(t,fetcher){
  const server=createImporterProxyServer({secret,allowedHosts:new Set(['www.nike.com']),fetcher,now:()=>now});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  });
  const address=server.address();
  return `http://127.0.0.1:${address.port}/v1/fetch`;
}

test('importer proxy accepts a fresh signed allowlisted fetch and rejects a replay',async t=>{
  let received;
  const endpoint=await withProxy(t,async(url,init)=>{
    received={url:String(url),init};
    return new Response('<title>Product</title>',{status:200,headers:{'content-type':'text/html'}});
  });
  const payload={version:1,url:'https://www.nike.com/t/example',method:'GET',headers:{accept:'text/html'}};
  const request=signedHeaders(payload);
  const first=await fetch(endpoint,{method:'POST',headers:request.headers,body:request.body});
  assert.equal(first.status,200);
  assert.equal((await first.json()).status,200);
  assert.equal(received.url,payload.url);
  assert.equal(received.init.redirect,'manual');

  const replay=await fetch(endpoint,{method:'POST',headers:request.headers,body:request.body});
  assert.equal(replay.status,409);
});

test('importer proxy requires exact versioned payload and same allowed-origin headers',async t=>{
  const endpoint=await withProxy(t,async()=>new Response('unexpected'));
  const cases=[
    {version:2,url:'https://www.nike.com/t/example',method:'GET',headers:{}},
    {version:1,url:'https://127.0.0.1/latest',method:'GET',headers:{}},
    {version:1,url:'https://www.nike.com/t/example',method:'GET',headers:{referer:'https://www.amazon.com/' }},
  ];
  for(let index=0;index<cases.length;index++){
    const request=signedHeaders(cases[index],String(index+1).padStart(32,'d'));
    const response=await fetch(endpoint,{method:'POST',headers:request.headers,body:request.body});
    assert.equal(response.status,400);
  }
});

test('signed native API referers accept exact merchant pairs only',async t=>{
 const hosts=['redsky.target.com','www.target.com','api.victoriassecret.com','www.victoriassecret.com','www.nike.com'];
 const server=createImporterProxyServer({secret,allowedHosts:new Set(hosts),fetcher:async()=>new Response('{}',{headers:{'content-type':'application/json'}}),now:()=>now});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const endpoint='http://127.0.0.1:'+server.address().port+'/v1/fetch';
 const cases=[['redsky.target.com','referer','https://www.target.com/p/-/A-12345678',200],['api.victoriassecret.com','referer','https://www.victoriassecret.com/us/',200],['redsky.target.com','referer','https://www.nike.com/',400],['redsky.target.com','origin','https://www.target.com',200],['redsky.target.com','origin','https://www.nike.com',400],['redsky.target.com','referer','http://www.target.com/',400],['redsky.target.com','referer','https://user@www.target.com/',400]];
 for(const [i,[host,key,value,status]] of cases.entries()){const req=signedHeaders({version:1,url:'https://'+host+'/product',method:'GET',headers:{[key]:value}},String(i+10).padStart(32,'e'));assert.equal((await fetch(endpoint,{method:'POST',...req})).status,status);}
});
