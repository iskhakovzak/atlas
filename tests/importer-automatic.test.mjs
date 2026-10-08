import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchProduct,ManualEntryFallbackError} from '../lib/importer/fetch.ts';
import {verifyProductSnapshot} from '../lib/importer/verify.ts';
import {manualFallbackAllowed} from '../lib/importer/manual-fallback.ts';
import {ActionError,prepareAction} from '../lib/market/actions-server.ts';
import {blank,products,tariff} from '../lib/market/domain.ts';
import {defaultPolicy} from '../lib/market/policy.ts';

const source='https://www.nike.com/t/test/DM4044-108';
const markup='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',url:source,name:'Shoes',sku:'black-9',size:'9',color:'Black',image:'https://static.nike.com/shoes.jpg',offers:{price:25,priceCurrency:'USD',availability:'https://schema.org/InStock'}})+'</script>';
const ok=()=>new Response(markup,{headers:{'content-type':'text/html'}});

test('shared automatic importer recovers once from upstream failure with abort limits retained',async()=>{
  const signals=[];let calls=0;
  const result=await fetchProduct(source,async(input,init)=>{assert.equal(String(input),source);signals.push(init.signal);return ++calls===1?new Response('',{status:503}):ok();});
  assert.equal(calls,2);assert.equal(result.price,25);assert.equal(result.currency,'USD');
  assert.ok(signals.every(signal=>signal instanceof AbortSignal));
});

test('shared automatic importer recovers once from a network error and stops after two failures',async()=>{
  let calls=0;
  const recovered=await fetchProduct(source,async()=>{if(++calls===1)throw new TypeError('Temporary network error');return ok();});
  assert.equal(recovered.price,25);assert.equal(calls,2);
  calls=0;
  await assert.rejects(fetchProduct(source,async()=>{calls++;return new Response('',{status:502});}),error=>error instanceof ManualEntryFallbackError&&error.reason==='upstream');
  assert.equal(calls,2);
});

test('automatic importer does not repeat blocked, rate-limited, incomplete, missing or unsafe targets',async()=>{
  for(const response of [()=>new Response('',{status:403}),()=>new Response('',{status:429}),()=>new Response('',{status:404}),()=>new Response('<html>No price</html>',{headers:{'content-type':'text/html'}}),()=>new Response('',{status:302,headers:{location:'https://127.0.0.1/private'}})]){
    let calls=0;
    await assert.rejects(fetchProduct(source,async()=>{calls++;return response();}));
    assert.equal(calls,1);
  }
  let calls=0;
  await assert.rejects(fetchProduct('http://www.nike.com/t/test',async()=>{calls++;return ok();}));
  assert.equal(calls,0);
});

test('automatic cart snapshot verifies exact merchant data without buyer confirmation and cannot use manual fallback',async()=>{
  const fresh=await fetchProduct(source,async()=>ok());
  const product={id:'test',name:'Shoes',brand:'Nike',category:'Обувь',usd:25,weight:1,image:fresh.image,variants:['Black · 9'],sourceUrl:source,sourceVariantId:'black-9',sourceCurrency:'USD',sourcePrice:25,sourceManuallyConfirmed:false};
  const checked=verifyProductSnapshot(product,product.variants[0],fresh);
  assert.equal(checked.sourcePrice,25);assert.equal(checked.sourceManuallyConfirmed,false);
  assert.equal(manualFallbackAllowed(product,product.variants[0],new ManualEntryFallbackError()),false);
  assert.throws(()=>verifyProductSnapshot({...product,sourcePrice:1},product.variants[0],fresh),/Цена изменилась/);
});

test('automatic cart addition rejects an unavailable source with the localized retry code and writes no cart',async()=>{
  const state=blank(),product={...products[0],sourceUrl:source,sourceCurrency:'USD',sourcePrice:25,sourceManuallyConfirmed:false};
  await assert.rejects(prepareAction(state,{type:'cart-add',product,variant:product.variants[0]},{fetchProduct:async()=>{throw new ManualEntryFallbackError('blocked',undefined,'blocked');},pricing:tariff,policy:defaultPolicy,operator:false,now:Date.now(),recentCheckMs:60000}),error=>error instanceof ActionError&&error.status===503&&error.code==='err_38');
  assert.equal(state.cart.length,0);
});
