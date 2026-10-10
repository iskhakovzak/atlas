import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchProduct,ManualEntryFallbackError} from '../lib/importer/fetch.ts';
import {extractProduct} from '../lib/importer/extract.ts';
import {importDraft} from '../lib/market/catalog-editor.ts';
import {isSupportedStoreHost,supportedStoreHosts} from '../lib/importer/stores.ts';
import {fetchWithEngines,createEnginePlanner} from '../deploy/upcloud/merchant-engines.mjs';

const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8'}});
const html=(body,status=200)=>new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8'}});
const akamai='<!DOCTYPE html><html><head><meta http-equiv="refresh" content="5; URL=\'/x?bm-verify=AAQ\'"></head><body></body></html>';

// --- Zara: the page is an Akamai wall, `?ajax=true` returns the view payload -------------------------
const zaraUrl='https://www.zara.com/us/en/henley-t-shirt-p04090320.html?v1=575659879';
const zaraPayload={
  mkSpots:{ESpot_Copyright:{content:{content:'<span>© All rights reserved</span><script type="application/ld+json">{"@type":"Product","name":"Decoy"}</script>'}}},
  product:{name:'HENLEY T-SHIRT',detail:{colors:[
    {name:'Oyster-white',productId:575659879,price:5990,xmedia:[{extraInfo:{deliveryUrl:'https://static.zara.net/assets/henley-1.jpg'}}],sizes:[{id:2,sku:575658817,name:'S',availability:'in_stock',price:5990},{id:3,sku:575658818,name:'M',availability:'out_of_stock',price:5990}]},
    {name:'Black',productId:575659880,price:5990,xmedia:[{extraInfo:{deliveryUrl:'https://static.zara.net/assets/henley-2.jpg'}}],sizes:[{id:2,sku:575658900,name:'S',availability:'low_on_stock',price:5990}]},
  ]}},
  clientAppConfig:{formatterConfig:{currency:'USD',currencyDecimals:-2},storeCountryCode:'us'},
};

test('Zara is read from the page\'s own ?ajax=true payload when the HTML is behind Akamai',async()=>{
  const requested=[];
  const result=await fetchProduct(zaraUrl,async input=>{
    const url=new URL(String(input));requested.push(url.search);
    return url.searchParams.get('ajax')==='true'?json(zaraPayload):html(akamai);
  });
  assert.deepEqual(requested,['?v1=575659879&ajax=true']);
  assert.equal(result.title,'HENLEY T-SHIRT');
  assert.equal(result.price,59.9);
  assert.equal(result.currency,'USD');
  assert.equal(result.selectedVariantColor,'Oyster-white');
  assert.equal(result.variants.length,3);
  assert.equal(result.variants[0].id,'575658817');
  assert.equal(importDraft(result,[],'США').variants[0].id,'575658817');
  assert.deepEqual(result.variants.map(v=>[v.label,v.available]),[['Oyster-white · S',true],['Oyster-white · M',false],['Black · S',true]]);
  // HTML strings inside the payload never become page markup.
  assert.notEqual(result.title,'Decoy');
});

test('a removed Zara product stays removed; other payload failures fall back to the page',async()=>{
  const gone=await fetchProduct(zaraUrl,async input=>new URL(String(input)).searchParams.has('ajax')?json({product:{}},410):html(akamai)).catch(error=>error);
  assert.match(gone.message,/не найдена/);
  const walled=await fetchProduct(zaraUrl,async input=>new URL(String(input)).searchParams.has('ajax')?json({error:'x'},403):html(akamai)).catch(error=>error);
  assert.ok(walled instanceof ManualEntryFallbackError);
  assert.equal(walled.reason,'blocked');
});

// --- Mango: product data lives in the React Server Components payload ---------------------------------
const mangoUrl='https://shop.mango.com/us/en/p/men/shirts/check/100-cotton-slim-fit-shirt/37047934/50/00';
const look=(color)=>({'00':{media:[{type:'002',format:'IMAGE',src:`https://media.mango.com/is/image/punto/37047934-${color}-002`},{type:'001',format:'IMAGE',src:`https://media.mango.com/is/image/punto/37047934-${color}-001`}]}});
const mangoProduct={name:'100% cotton slim-fit shirt',reference:'37047934',id:'37047934',colors:[
  {id:'01',label:'White',isSellable:true,looks:look('01'),prices:{default:{price:79.99,currency:'USD'}},sizes:[{id:'19',label:'XS',available:true},{id:'20',label:'S',available:false}]},
  {id:'50',label:'Sky Blue',isSellable:true,looks:look('50'),prices:{default:{price:69.99,currency:'USD'}},sizes:[{id:'19',label:'XS',available:true},{id:'20',label:'S',available:true}]},
]};
const recommendation={name:'Linen shirt',reference:'99999999',id:'99999999',colors:[{id:'01',label:'Beige',prices:{default:{price:9.99,currency:'USD'}},sizes:[]}]};
function mangoPage(products){
  const flight=`1:["$","$L5",null,{"related":${JSON.stringify(products[1]??null)}}]\n19:["$","$L5b",null,{"product":${JSON.stringify(products[0])}}]`;
  const half=Math.floor(flight.length/2);
  return `<html><head><title>100% cotton slim-fit shirt - Men | MANGO USA</title></head><body><script>self.__next_f.push([1,${JSON.stringify(flight.slice(0,half))}])</script><script>self.__next_f.push([1,${JSON.stringify(flight.slice(half))}])</script></body></html>`;
}

test('Mango is read from the page\'s server-component payload: every colour, size, stock flag and photo',()=>{
  const result=extractProduct(mangoPage([mangoProduct,recommendation]),mangoUrl);
  assert.equal(result.method,'Mango page data');
  assert.equal(result.title,'100% cotton slim-fit shirt');
  assert.equal(result.brand,'Mango');
  // The colour in the link (50) sets the price, the photos and the selected colour.
  assert.equal(result.selectedVariantColor,'Sky Blue');
  assert.equal(result.price,69.99);
  assert.equal(result.currency,'USD');
  assert.equal(result.images[0],'https://media.mango.com/is/image/punto/37047934-50-002');
  assert.deepEqual(result.variants.map(v=>[v.id,v.available,v.price]),[['37047934-01-19',true,79.99],['37047934-01-20',false,79.99],['37047934-50-19',true,69.99],['37047934-50-20',true,69.99]]);
  assert.equal(result.variantsComplete,true);
  assert.deepEqual(result.colorwayImages.map(g=>g.color),['White','Sky Blue']);
});

test('a Mango link to a colour the product no longer has is not swapped for another colour',()=>{
  const result=extractProduct(mangoPage([mangoProduct]),mangoUrl.replace('/50/00','/77/00'));
  assert.notEqual(result.method,'Mango page data');
});

// --- Target: price and options come from redsky.target.com ---------------------------------------------
const targetUrl='https://www.target.com/p/hanes-premium-t-shirt-5pk/-/A-89003153';
const child=(tcin,price,reg=price)=>({tcin,price:{current_retail:price,reg_retail:reg},item:{enrichment:{image_info:{primary_image:{url:`https://target.scene7.com/is/image/Target/${tcin}`}}}}});
const targetPayload={data:{product:{tcin:'89115509',
  item:{primary_brand:{name:'Hanes Premium'},product_description:{title:'Hanes Premium Men&#39;s Crewneck T-Shirt 5pk'},enrichment:{image_info:{primary_image:{url:'https://target.scene7.com/is/image/Target/parent'}}}},
  price:{current_retail_min:24,reg_retail_max:27},
  variation_hierarchy:[
    {name:'Color',value:'White',variation_hierarchy:[
      {name:'Size',value:'S',tcin:'89003153',availability:{is_shipping_available:true,is_sold_out:false}},
      {name:'Size',value:'M',tcin:'89003154',availability:{is_shipping_available:false,is_sold_out:true}},
    ]},
    {name:'Color',value:'Black',variation_hierarchy:[{name:'Size',value:'S',tcin:'89003160',availability:{is_shipping_available:true,is_sold_out:false}}]},
  ],
  children:[child('89003153',24,27),child('89003154',27),child('89003160',27)],
}}};

test('Target is read from its public product service with the variation tree and shipping availability',async()=>{
  const requested=[];
  const result=await fetchProduct(targetUrl,async (input,init)=>{
    const url=new URL(String(input));requested.push(url.hostname+url.pathname);
    assert.equal(url.searchParams.get('tcin'),'89003153');
    assert.equal(new Headers(init.headers).has('x-requested-with'),false);
    assert.equal(new Headers(init.headers).has('sec-fetch-site'),false);
    assert.equal(new Headers(init.headers).get('origin'),'https://www.target.com');
    return json(targetPayload);
  });
  assert.deepEqual(requested,['redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1']);
  assert.equal(result.title,"Hanes Premium Men's Crewneck T-Shirt 5pk");
  assert.equal(result.brand,'Hanes Premium');
  assert.equal(result.price,24);
  assert.equal(result.referencePrice,27);
  assert.equal(result.currency,'USD');
  assert.equal(result.selectedVariantColor,'White');
  assert.equal(result.images[0],'https://target.scene7.com/is/image/Target/89003153');
  assert.deepEqual(result.variants.map(v=>[v.label,v.available,v.price]),[['White · S',true,24],['White · M',false,27],['Black · S',true,27]]);
  assert.equal(result.variantsComplete,true);
});

test('a Target answer about another product is not used',async()=>{
  const other={data:{product:{...targetPayload.data.product,tcin:'11111111',children:[child('11111112',5)],variation_hierarchy:[]}}};
  const result=await fetchProduct(targetUrl,async input=>new URL(String(input)).hostname==='redsky.target.com'?json(other):html('<html><title>Target</title></html>')).catch(error=>error);
  assert.ok(result instanceof Error);
});

test('the Target product service is an allowed source host, shared with the proxy',()=>{
  assert.ok(isSupportedStoreHost('redsky.target.com'));
  assert.ok(supportedStoreHosts.includes('redsky.target.com'));
});

// --- Proxy: when every engine fails, the caller still learns what each one ran into ---------------------
test('a total engine failure carries the attempts',async()=>{
  const failure=await fetchWithEngines({
    target:new URL('https://www.bestbuy.com/site/sku/1.p'),method:'GET',headers:{},mode:'auto',planner:createEnginePlanner(['fetch','impersonate']),deadlineMs:4000,
    engines:{fetch:async()=>{throw Object.assign(new Error('reset'),{name:'TypeError'})},impersonate:async()=>{throw Object.assign(new Error('h2'),{name:'HTTPError'})}},
  }).catch(error=>error);
  assert.deepEqual(failure.attempts,['fetch:error','impersonate:error']);
});

test('Target truncated option trees are never marked complete',async()=>{
 const p=structuredClone(targetPayload);const items=Array.from({length:121},(_,i)=>({name:'Size',value:'S'+i,tcin:String(89003153+i),availability:{is_shipping_available:true,is_sold_out:false}}));
 p.data.product.variation_hierarchy=items;p.data.product.children=items.map(item=>child(item.tcin,27));
 const result=await fetchProduct(targetUrl,async()=>json(p));assert.equal(result.variants.length,120);assert.equal(result.variantsComplete,false);
});

// --- PerimeterX: Walmart's served pages carry its config, which is not a wall ---------------------------
test('a served Walmart page with PerimeterX config is not mistaken for its captcha',async()=>{
  const {detectBotChallenge}=await import('../lib/importer/fetch.ts');
  const served=`<html><head><script>window._pxAppId='PXu6b0qd2S';</script></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pad:'x'.repeat(80_000)}})}</script></body></html>`;
  assert.equal(detectBotChallenge(served),undefined);
  assert.equal(detectBotChallenge(`<html><head><script>window._pxAppId='PXu6b0qd2S';</script></head><body><h1>Robot or human?</h1></body></html>`),'PerimeterX');
  assert.equal(detectBotChallenge(`<html><body><div id="px-captcha"></div>${'x'.repeat(80_000)}</body></html>`),'PerimeterX');
});
