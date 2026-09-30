import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createMerchantProxyFetch} from '../lib/importer/proxy-client.mjs';

const secret='a'.repeat(64);
const endpoint='https://85-9-196-196.sslip.io/v1/fetch';
const encoder=new TextEncoder();

test('merchant proxy signs the exact bounded request and strips credentials',async()=>{
  let outgoing;
  const fetcher=createMerchantProxyFetch({endpoint,secret,now:()=>1_797_000_000_000,nonce:()=> 'b'.repeat(32),fetchImpl:async(url,init)=>{
    outgoing={url,init};
    return Response.json({version:1,status:200,headers:{contentType:'text/html; charset=utf-8'},body:Buffer.from('<title>Product</title>').toString('base64')});
  }});
  const response=await fetcher('https://www.nike.com/t/example?color=blue',{method:'GET',redirect:'manual',headers:{Accept:'text/html','User-Agent':'Atlas test',Authorization:'Bearer must-not-leave','X-Not-Allowed':'ignore'}});
  assert.equal(await response.text(),'<title>Product</title>');
  assert.equal(outgoing.url,endpoint);
  const payload=JSON.parse(outgoing.init.body);
  assert.equal(payload.url,'https://www.nike.com/t/example?color=blue');
  assert.deepEqual(payload.headers,{accept:'text/html','user-agent':'Atlas test'});
  assert.equal(outgoing.init.redirect,'manual');
  const key=await webcrypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const message=encoder.encode(`${outgoing.init.headers['x-atlas-proxy-timestamp']}\n${outgoing.init.headers['x-atlas-proxy-nonce']}\n${outgoing.init.body}`);
  const signature=Uint8Array.from(outgoing.init.headers['x-atlas-proxy-signature'].match(/../g),value=>parseInt(value,16));
  assert.equal(await webcrypto.subtle.verify('HMAC',key,signature,message),true);
});

test('merchant proxy preserves manual redirects and anonymous Amazon cookies',async()=>{
  const fetcher=createMerchantProxyFetch({endpoint,secret,fetchImpl:async(_url,init)=>{
    const payload=JSON.parse(init.body);
    assert.equal(payload.method,'GET');
    assert.equal(payload.headers.cookie,'i18n-prefs=USD');
    return Response.json({version:1,status:302,headers:{location:'https://www.nike.com/item'},body:''});
  }});
  const response=await fetcher('https://www.amazon.com/dp/TEST',{headers:{Cookie:'i18n-prefs=USD'},redirect:'manual'});
  assert.equal(response.status,302);
  assert.equal(response.headers.get('location'),'https://www.nike.com/item');
});

test('merchant proxy rejects unsafe endpoint, target, method and request body',async()=>{
  assert.throws(()=>createMerchantProxyFetch({endpoint:'http://85-9-196-196.sslip.io/v1/fetch',secret}));
  const fetcher=createMerchantProxyFetch({endpoint,secret,fetchImpl:async()=>{throw new Error('must not send');}});
  await assert.rejects(fetcher('https://www.nike.com:8443/item'),/Unsafe importer target/);
  await assert.rejects(fetcher('https://127.0.0.1/item'),/Unsafe importer target/);
  await assert.rejects(fetcher('https://www.nike.com/item',{method:'PUT'}),/Unsupported importer request method/);
  await assert.rejects(fetcher('https://www.nike.com/item',{method:'POST',body:new Blob(['not supported'])}),/bounded text/);
});
