import test from 'node:test';
import assert from 'node:assert/strict';
import {extractShopify, shopifyEndpoints} from '../lib/importer/shopify.ts';
import {featuredStoreGroups, supportedStoreCount} from '../lib/importer/stores.ts';
import {extractAdidasProduct,extractProduct} from '../lib/importer/extract.ts';
import {fetchProduct, allowedUrl, isAmazonUsUrl, ManualEntryFallbackError} from '../lib/importer/fetch.ts';
import {verifyKnownSnapshotFields,verifyProductSnapshot} from '../lib/importer/verify.ts';
import {manualFallbackAllowed} from '../lib/importer/manual-fallback.ts';

const url = 'https://www.allbirds.com/products/shoe';
test('ShopSimon uses exact approved storefront and US Shopify endpoints',()=>{
  const source='https://shop.simon.com/products/superstar?variant=123';
  assert.equal(allowedUrl(source).href,source);
  const endpoints=shopifyEndpoints(new URL(source));
  assert.equal(endpoints.product.href,'https://shop.simon.com/products/superstar.js?country=US');
  assert.equal(endpoints.currency.href,'https://shop.simon.com/cart.js?country=US');
  for(const host of ['simon.com','evil.simon.com','www.shop.simon.com','shop.simon.com.evil.example'])
    assert.throws(()=>allowedUrl(`https://${host}/products/superstar`));
  assert.ok(featuredStoreGroups.find(group=>group.region==='США').stores.some(store=>store.root==='shop.simon.com'));
});
test('ShopSimon preserves shoe sizes, colorways, selected price and availability',()=>{
  const data={handle:'superstar',title:'Women\'s adidas SUPERSTAR II SHOES',vendor:'adidas',type:'women/shoes/athletic',images:['//shop.simon.com/cdn/shop/files/shoe.jpg'],options:[{name:'Shoe Size'},{name:'Color'}],variants:[
    {id:123,title:'US 8 / off white / carbon',option1:'US 8',option2:'off white / carbon',price:7100,available:true},
    {id:124,title:'US 9 / night indigo',option1:'US 9',option2:'night indigo',price:6900,available:false},
  ]};
  const result=extractShopify(data,{currency:'USD'},'https://shop.simon.com/products/superstar?variant=123');
  assert.equal(result.price,71);assert.equal(result.currency,'USD');assert.equal(result.country,'США');assert.equal(result.category,'Обувь');
  assert.equal(result.images[0],'https://shop.simon.com/cdn/shop/files/shoe.jpg');
  assert.deepEqual(result.variants.map(v=>[v.id,v.size,v.sizeLabel,v.color,v.price,v.available,v.availabilityKnown]),[
    ['123','US 8','Shoe Size','off white / carbon',71,true,true],['124','US 9','Shoe Size','night indigo',69,false,true],
  ]);
  assert.equal(result.shipping,undefined);
  assert.equal(extractShopify(data,{currency:'USD'},'https://shop.simon.com/products/superstar').price,undefined);
});
const product = {handle:'shoe',title:'Wool shoes',vendor:'Allbirds',images:['//cdn.shopify.com/one.jpg','https://127.0.0.1/private','//cdn.shopify.com/two.jpg'],options:[{name:'Color'},{name:'Size'}],variants:[
  {id:1,title:'Black / 8',option1:'Black',option2:'8',price:11000,available:true,featured_image:{src:'//cdn.shopify.com/black.jpg'}},
  {id:2,title:'Black / 9',option1:'Black',option2:'9',price:12000,available:false},
  {id:3,title:'White / 8',option1:'White',option2:'8',price:13000,available:true},
]};
test('Shopify retains variant price, size, color, availability and safe gallery',()=>{
  const p=extractShopify(product,{currency:'USD'},url+'?variant=1');
  assert.equal(p.price,110);assert.equal(p.currency,'USD');assert.equal(p.image,'https://cdn.shopify.com/black.jpg');
  assert.equal(p.variants[0].size,'8');assert.equal(p.variants[0].sizeLabel,'Size');assert.equal(p.variants[0].color,'Black');assert.equal(p.variants[1].available,false);
  assert(!p.images.some(x=>x.includes('127.0.0.1')));assert.equal(p.shipping,undefined);
  assert.equal(extractShopify(product,{currency:'USD'},url).price,undefined);
  assert.throws(()=>extractShopify(product,{},url));
  assert.throws(()=>extractShopify({...product,handle:'other'},{currency:'USD'},url));
});
test('Shopify products with variant-specific prices remain importable without a guessed base price',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(input)=>String(input).endsWith('/cart.js?country=US')?Response.json({currency:'USD'}):Response.json({...product,variants:product.variants.map((variant,index)=>({...variant,price:(11000+index*1000)}))});
 try{
  const result=await fetchProduct(url);
  assert.equal(result.price,undefined);
  assert.deepEqual(result.variants.map(item=>item.price),[110,120,130]);
  assert.match(result.warnings.join(' '),/Выберите вариант/);
 }finally{globalThis.fetch=original;}
});
test('XHTML product pages are parsed as supported HTML documents',async()=>{
 const original=globalThis.fetch,markup=`<script type="application/ld+json">${JSON.stringify({'@type':'Product',name:'Example running shoe',image:['https://static.nike.com/a.jpg'],offers:{price:'79.99',priceCurrency:'USD',availability:'https://schema.org/InStock'}})}</script>`;
 globalThis.fetch=async()=>new Response(markup,{headers:{'Content-Type':'application/xhtml+xml; charset=utf-8'}});
 try{const result=await fetchProduct('https://www.nike.com/t/example-running-shoe/DM4044-108');assert.equal(result.title,'Example running shoe');assert.equal(result.price,79.99)}finally{globalThis.fetch=original;}
});
test('unsafe merchant redirects preserve a manual-entry path without following the target',async()=>{
 const original=globalThis.fetch;let requests=0;
 globalThis.fetch=async()=>{requests++;return new Response('',{status:302,headers:{Location:'https://untrusted.example/item'}})};
 try{await assert.rejects(fetchProduct('https://www.nike.com/t/example/DM4044-108'),error=>error instanceof ManualEntryFallbackError&&error.reason==='redirect');assert.equal(requests,1)}finally{globalThis.fetch=original;}
});
test('Shopify endpoints preserve locale but reject unapproved hosts and nonproducts',()=>{
  const e=shopifyEndpoints(new URL('https://kyliecosmetics.com/en-gb/collections/lips/products/lip-kit?variant=1'));
  assert.equal(e.product.href,'https://kyliecosmetics.com/en-gb/products/lip-kit.js?country=GB');
  assert.equal(e.currency.href,'https://kyliecosmetics.com/en-gb/cart.js?country=GB');
  const satechi=shopifyEndpoints(new URL('https://satechi.net/products/usb-c-hub'));
  assert.equal(satechi.product.href,'https://satechi.com/products/usb-c-hub.js?country=US');
  const kith=shopifyEndpoints(new URL('https://kith.com/products/aaji2663'));
  assert.equal(kith.product.href,'https://kith.com/products/aaji2663.js?country=US');
  assert.equal(kith.currency.href,'https://kith.com/cart.js?country=US');
  assert.equal(shopifyEndpoints(new URL('https://evil.allbirds.com/products/shoe')),undefined);
  assert.throws(()=>allowedUrl('https://allbirds.com.evil.example/products/shoe'));
});
test('Shopify store profiles classify ambiguous beauty and sneaker names',()=>{
  const basic={handle:'item',title:'The Full Kit',vendor:'Rhode',images:[],options:['Title'],variants:[{id:1,title:'Default Title',option1:'Default Title',price:11700,available:true}]};
  assert.equal(extractShopify(basic,{currency:'USD'},'https://rhodeskin.com/products/item').category,'Красота и уход');
  assert.equal(extractShopify({...basic,title:'Norvan LD 4',vendor:"Arc'teryx"},{currency:'USD'},'https://cncpts.com/products/item').category,'Обувь');
  const spanish=extractShopify({...basic,title:'Sudadera',vendor:'Nude Project'},{currency:'EUR'},'https://nude-project.com/products/item');
  assert.equal(spanish.category,'Одежда');assert.equal(spanish.country,'Испания');
});
test('store directory covers regional Spain, Europe and US shortlists',()=>{
  assert.ok(supportedStoreCount>=200);
  assert.deepEqual(featuredStoreGroups.map(group=>group.region),['Испания','Европа','США']);
  assert.ok(featuredStoreGroups.find(group=>group.region==='Испания').stores.some(store=>store.root==='footdistrict.com'));
});
test('Shopify combines every non-colour option into the second choice axis',()=>{
  const tech={handle:'case',title:'Phone Case',vendor:'Spigen',images:['//cdn.shopify.com/case.jpg'],options:[{name:'Device'},{name:'Color'},{name:'Finish'}],variants:[
    {id:1,title:'iPhone 17 / Black / Matte',option1:'iPhone 17',option2:'Black',option3:'Matte',price:2999,available:true},
    {id:2,title:'iPhone 17 Pro / Black / Clear',option1:'iPhone 17 Pro',option2:'Black',option3:'Clear',price:3499,available:false},
  ]};
  const p=extractShopify(tech,{currency:'USD'},'https://spigen.com/products/case');
  assert.deepEqual(p.variants.map(v=>[v.color,v.size,v.sizeLabel,v.price,v.available]),[
    ['Black','iPhone 17 / Matte','Device / Finish',29.99,true],['Black','iPhone 17 Pro / Clear','Device / Finish',34.99,false],
  ]);
});
test('ProductGroup matches color with tracking and size variant query, not another color',()=>{
  const page='https://www.fashionnova.com/products/jeans?color=blue&variant=2&utm_source=test';
  const child=(id,color,price)=>({'@type':'Product',size:String(id),color,offers:{url:`https://www.fashionnova.com/products/jeans?color=${color}&variant=${id}`,price,priceCurrency:'USD',availability:'https://schema.org/InStock'}});
  const p=extractProduct(`<script type="application/ld+json">${JSON.stringify({'@type':'ProductGroup',name:'Jeans',hasVariant:[child(1,'red',90),child(2,'blue',20),child(3,'blue',25)]})}</script>`,page);
  assert.equal(p.price,20);assert.deepEqual(p.variants.map(v=>v.label),['red · 1','blue · 2','blue · 3']);
});
test('Gymshark turns the active colour and sizes into one option matrix',()=>{
  const group={'@type':'ProductGroup',name:'Shorts',hasVariant:[
    {'@type':'Product',size:'S',offers:{url:'https://www.gymshark.com/products/shorts',price:32,priceCurrency:'USD',availability:'https://schema.org/InStock'}},
    {'@type':'Product',size:'M',offers:{url:'https://www.gymshark.com/products/shorts',price:34,priceCurrency:'USD',availability:'https://schema.org/OutOfStock'}},
  ]};
  const html=`<a aria-current="true" aria-label="Shorts in Smokey Grey"></a><script type="application/ld+json">${JSON.stringify(group)}</script>`;
  const p=extractProduct(html,'https://www.gymshark.com/products/shorts');
  assert.deepEqual(p.variants.map(v=>[v.color,v.size,v.price,v.available]),[['Smokey Grey','S',32,true],['Smokey Grey','M',34,false]]);
});
test('Anker embedded product data retains choice, price, photo and stock',()=>{
  const product={handle:'charger',title:'Nano Charger',vendor:'Anker',images:[{url:'https://cdn.shopify.com/main.jpg'}],variants:[
    {id:'gid://shopify/ProductVariant/11',name:'White | 1-Pack',price:29.99,availableForSale:true,quantityAvailable:3,image:{url:'https://cdn.shopify.com/white.jpg'}},
    {id:'gid://shopify/ProductVariant/12',name:'Black | 2-Pack',price:49.99,availableForSale:false,quantityAvailable:0,image:{url:'https://cdn.shopify.com/black.jpg'}},
  ]};
  const html=`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{product}}})}</script>`;
  const p=extractProduct(html,'https://www.anker.com/products/charger?variant=11');
  assert.equal(p.method,'Anker product data');assert.equal(p.price,29.99);assert.equal(p.image,'https://cdn.shopify.com/white.jpg');
  assert.deepEqual(p.variants.map(v=>[v.id,v.color,v.size,v.available]),[['11','White','1-Pack',true],['12','Black','2-Pack',false]]);
});
test('Macy product data is scoped to its host and keeps unknown stock out of customer copy',()=>{
  const sourceUrl='https://www.macys.com/shop/product/example';
  const state={product:{productDetail:{product:{detail:{name:"Women's Running Sneakers"},pricing:{price:{tieredPrice:[{values:[{value:'$89.99'}]}]}},traits:{colors:{colorMap:{blue:{name:'Blue'}}},sizes:{sizeMap:{six:{name:'6'},seven:{name:'7'}}}},imagery:{images:[{filePath:'123/456/shoe.jpg'}]}}}}};
  const html=`<script>window.__PRELOADED_STATE__ = ${JSON.stringify(state)};</script>`;
  const parsed=extractProduct(html,sourceUrl);
  assert.equal(parsed.method,"Macy's product data");assert.equal(parsed.price,89.99);assert.equal(parsed.currency,'USD');assert.equal(parsed.country,'США');assert.equal(parsed.category,'Обувь');
  assert.deepEqual(parsed.variants.map(value=>value.label),['Blue · 6','Blue · 7']);
  assert(parsed.variants.every(value=>value.available&&value.availabilityKnown===false));
  assert.equal(parsed.image,'https://slimages.macysassets.com/is/image/MCY/products/123/456/shoe.jpg');
  assert.doesNotMatch(parsed.warnings.join(' '),/наличие выбранного сочетания нужно подтвердить/);
  assert.notEqual(extractProduct(html,'https://macys.com.evil.example/shop/product/example').method,"Macy's product data");
});
test('Sephora linkJSON uses only the exact listing and keeps stock unverified when absent',()=>{
  const source='https://www.sephora.com/product/example-P123';
  const product=(url,price)=>({'@type':'Product',url,name:'Cream',brand:{name:'Sephora Collection'},image:['https://www.sephora.com/photo.jpg'],offers:{price,priceCurrency:'USD'}});
  const html=`<script id="linkJSON">${JSON.stringify([product('https://www.sephora.com/product/other-P999',999),product(source,29)])}</script>`;
  const parsed=extractProduct(html,source);
  assert.equal(parsed.price,29);assert.equal(parsed.currency,'USD');assert.equal(parsed.title,'Cream');
  assert.equal(parsed.image,'https://www.sephora.com/photo.jpg');
  assert.equal(parsed.variants.length,0);
  assert.equal(extractProduct(html,'https://www.sephora.com/product/unrelated-P321').price,undefined);
  assert.equal(extractProduct(html,'https://sephora.com.evil.example/product/example-P123').price,undefined);
});
test('Adidas public product data retains sale price, available sizes and gallery',()=>{
  const product={id:'IF4492',name:'Daily 4.0 Shoes',brand:'Sportswear',category:'Shoes',color:'Core Black / Cloud White / Gum',price:65,salePrice:33,orderable:1,image:{src:'https://assets.adidas.com/primary.jpg'},images:[{src:'https://assets.adidas.com/one.jpg'},{src:'https://assets.adidas.com/two.jpg'}]};
  const listing={raw:{itemList:{items:[{productId:'IF4492',displayName:'Daily 4.0 Shoes',availableSizes:['hidden','5','6','8'],orderable:1,salePrice:33,images:[{src:'https://assets.adidas.com/three.jpg'}]}]}}};
  const p=extractAdidasProduct(product,listing,'https://www.adidas.com/us/daily-4.0-shoes/IF4492.html');
  assert.equal(p.method,'Adidas product data');assert.equal(p.price,33);assert.equal(p.currency,'USD');assert.equal(p.country,'США');assert.equal(p.category,'Обувь');assert.equal(p.variants.length,3);assert.deepEqual(p.variants.map(v=>[v.color,v.size,v.price,v.available]),[['Core Black / Cloud White / Gum','5',33,true],['Core Black / Cloud White / Gum','6',33,true],['Core Black / Cloud White / Gum','8',33,true]]);assert.equal(p.images.length,4);
});
test('Adidas malformed public JSON falls back to editable manual entry',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response('<html>challenge</html>',{headers:{'Content-Type':'application/json'}});
  try { await assert.rejects(fetchProduct('https://www.adidas.com/us/daily-4.0-shoes/IF4492.html'),error=>error instanceof ManualEntryFallbackError); }
  finally { globalThis.fetch=original; }
});
test('Adidas clothing JSON classifies jerseys and keeps the full gallery',()=>{
  const product={id:'JZ6941',name:'Germany Away Jersey 1994',brand:'Performance',category:'Clothing',color:'Power Green',price:110,salePrice:44,orderable:1,image:{src:'https://assets.adidas.com/primary.jpg'},secondImage:{src:'https://assets.adidas.com/second.jpg'},images:Array.from({length:12},(_,index)=>({src:`https://assets.adidas.com/gallery-${index}.jpg`}))};
  const listing={raw:{itemList:{items:[{productId:'JZ6941',displayName:'Germany Away Jersey 1994',subTitle:"Men's Lifestyle",availableSizes:['S','M','L','XL'],orderable:1,salePrice:44,images:[{src:'https://assets.adidas.com/listing.jpg'}]}]}}};
  const p=extractAdidasProduct(product,listing,'https://www.adidas.com/us/germany-away-jersey-1994/JZ6941.html');
  assert.equal(p.category,'Одежда');assert.equal(p.price,44);assert.equal(p.images.length,12);assert.deepEqual(p.variants.map(v=>v.size),['S','M','L','XL']);
});
test('Adidas link import uses public JSON routes when HTML is an Akamai challenge',async()=>{
  const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async(input,init={})=>{calls.push([String(input),init]);const u=new URL(String(input));if(u.pathname==='/api/search/product/IF4492')return Response.json({id:'IF4492',name:'Daily 4.0 Shoes',brand:'Sportswear',category:'Shoes',color:'Black',price:65,salePrice:33,orderable:1,image:{src:'https://assets.adidas.com/main.jpg'}});if(u.pathname==='/api/plp/content-engine')return Response.json({raw:{itemList:{items:[{productId:'IF4492',availableSizes:['5','7'],orderable:1,salePrice:33,images:[{src:'https://assets.adidas.com/gallery.jpg'}]}]}}});return new Response('not found',{status:404,headers:{'Content-Type':'text/html'}})};
  try {const p=await fetchProduct('https://www.adidas.com/us/daily-4.0-shoes/IF4492.html');assert.equal(calls.length,2);assert(calls.every(([url])=>url.startsWith('https://www.adidas.com/api/')));assert(calls.every(([,init])=>!init.headers['X-Requested-With']&&!init.headers['Sec-CH-UA']));assert.equal(p.price,33);assert.deepEqual(p.variants.map(v=>v.size),['5','7']);assert.equal(p.images.length,2)} finally {globalThis.fetch=original}
});
test('Adidas listing data remains importable when product JSON is rate-limited',async()=>{
  const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async(input)=>{calls.push(String(input));const u=new URL(String(input));if(u.pathname==='/api/plp/content-engine')return Response.json({raw:{itemList:{items:[{productId:'IF4492',displayName:'Daily 4.0 Shoes',category:'shoes',availableSizes:['5','7'],orderable:1,salePrice:33,image:{src:'https://assets.adidas.com/gallery.jpg'},images:[{src:'https://assets.adidas.com/gallery.jpg'}]}]}}});return new Response('rate limited',{status:429,headers:{'Content-Type':'text/html'}})};
  try {const p=await fetchProduct('https://www.adidas.com/us/daily-4.0-shoes/IF4492.html');assert.equal(p.price,33);assert.deepEqual(p.variants.map(v=>v.size),['5','7']);assert.equal(p.images.length,1);assert(calls.some(url=>url.includes('/api/plp/content-engine')))} finally {globalThis.fetch=original}
});
test('Adidas API challenges and malformed payloads allow editable manual fallback',async()=>{
  const original=globalThis.fetch,originalError=console.error;
  try {
    console.error=()=>{};
    globalThis.fetch=async()=>new Response('Akamai challenge',{status:429,headers:{'Content-Type':'text/html'}});
    await assert.rejects(fetchProduct('https://www.adidas.com/us/daily-4.0-shoes/IF4492.html'),error=>error instanceof ManualEntryFallbackError&&/вручную/.test(error.message)&&/подтвердите цену, валюту и выбранный вариант/.test(error.message));
    globalThis.fetch=async()=>new Response('{invalid json',{headers:{'Content-Type':'application/json'}});
    await assert.rejects(fetchProduct('https://www.adidas.com/us/daily-4.0-shoes/IF4492.html'),ManualEntryFallbackError);
  } finally {globalThis.fetch=original;console.error=originalError;}
});
test('generic importer deduplicates images and treats size and color as one variant',()=>{
  const p=extractProduct(`<script type="application/ld+json">${JSON.stringify({'@type':'Product',name:'Shoes',color:'Black',size:'42',image:['/a.jpg','/a.jpg','/b.jpg'],offers:{price:'1,299.95',priceCurrency:'USD'}})}</script>`,'https://nike.com/product');
  assert.equal(p.price,1299.95);assert.equal(p.images.length,2);assert.deepEqual(p.variants.map(v=>v.label),['Black · 42']);
});
test('public Ajax requests omit credentials and unsafe redirects fall back safely',async()=>{
  const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async(u,init)=>{calls.push([String(u),init]);if(new URL(String(u)).pathname.endsWith('/cart.js'))return Response.json({currency:'USD'});return Response.json(product);};
  try {
    assert.equal((await fetchProduct(url+'?variant=1')).price,110);
    assert.equal(calls.length,2);assert(calls.every(([,init])=>!init.headers.Cookie&&!init.headers.Authorization&&init.redirect==='manual'));
    globalThis.fetch=async(u)=>String(u).endsWith('.js')?new Response('',{status:302,headers:{Location:'http://169.254.169.254/'}}):new Response('<meta property="og:title" content="Shoes">',{headers:{'Content-Type':'text/html'}});
    await assert.rejects(fetchProduct(url),error=>error instanceof ManualEntryFallbackError&&error.partial?.title==='Shoes');
  } finally {globalThis.fetch=original;}
});

test('Amazon checks pin the anonymous session to US ZIP 19701 before parsing',async()=>{
  assert(isAmazonUsUrl(new URL('https://www.amazon.com/dp/TEST')));
  assert(!isAmazonUsUrl(new URL('https://www.amazon.co.uk/dp/TEST')));
  const original=globalThis.fetch;const calls=[];
  const amazonHtml=`<span data-a-modal='{"ajaxHeaders":{"anti-csrftoken-a2z":"token"},"url":"/portal-migration/hz/glow/get-rendered-address-selections"}'></span><script type="application/ld+json">${JSON.stringify({'@type':'Product',name:'US listing',image:['https://images.example.com/item.jpg'],offers:{price:'55.99',priceCurrency:'USD',availability:'https://schema.org/InStock'}})}</script>`;
  globalThis.fetch=async(input,init={})=>{
    calls.push([String(input),init]);
    if(String(input).includes('/gp/delivery/ajax/address-change.html')) return new Response(JSON.stringify({isValidAddress:1,address:{countryCode:'US',zipCode:'19701'}}),{headers:{'Content-Type':'application/json','set-cookie':'zip-code=19701; Path=/'}});
    return new Response(amazonHtml,{headers:{'Content-Type':'text/html','set-cookie':'session-id=anon; Path=/, i18n-prefs=UZS; Path=/'}});
  };
  try {
    const result=await fetchProduct('https://www.amazon.com/dp/TEST');
    assert.equal(result.price,55.99);
    assert.equal(calls.length,3);
    const post=calls[1];
    assert.equal(new URL(post[0]).pathname,'/gp/delivery/ajax/address-change.html');
    assert.equal(post[1].method,'POST');
    assert.match(post[1].headers.Cookie,/i18n-prefs=USD/);
    assert.match(post[1].headers.Cookie,/lc-main=en_US/);
    assert.equal(new URLSearchParams(post[1].body).get('countryCode'),'US');
    assert.equal(new URLSearchParams(post[1].body).get('zipCode'),'19701');
    assert.match(calls[2][1].headers.Cookie,/zip-code=19701/);
  } finally {globalThis.fetch=original;}
});
test('Amazon still rejects location API responses that do not confirm US ZIP 19701',async()=>{
  const original=globalThis.fetch;
  const page=`<span data-a-modal='{"ajaxHeaders":{"anti-csrftoken-a2z":"token"},"url":"/portal-migration/hz/glow/get-rendered-address-selections"}'></span>`;
  globalThis.fetch=async(input)=>String(input).includes('/gp/delivery/ajax/address-change.html')
    ? Response.json({isValidAddress:1,address:{countryCode:'US',zipCode:'90210'}})
    : new Response(page,{headers:{'Content-Type':'text/html'}});
  try {
    await assert.rejects(fetchProduct('https://www.amazon.com/dp/TEST'),error=>error instanceof ManualEntryFallbackError);
  } finally {globalThis.fetch=original;}
});

test('fresh verification checks exact price, identity and merchant-confirmed sold-out stock',()=>{
  const p={id:'p',name:'Shoe',brand:'Allbirds',category:'Обувь',usd:110,weight:1.5,image:'',variants:['Black / 8'],sourceUrl:url,sourceVariantId:'1',sourceCurrency:'USD',sourcePrice:110};
  const fresh=extractShopify(product,{currency:'USD'},url+'?variant=1');
  const checked=verifyProductSnapshot(p,'Black / 8',fresh,5000);
  assert.equal(checked.sourcePrice,110);assert.equal(checked.importedAt,5000);assert.equal(checked.sourceExpiresAt,605000);
  assert.throws(()=>verifyProductSnapshot({...p,sourcePrice:109},'Black / 8',fresh),/Цена изменилась/);
  assert.throws(()=>verifyProductSnapshot({...p,sourceVariantId:'missing-id'},'Black / 8',fresh),/не удалось сверить/);
  const soldOut=extractShopify({...product,variants:product.variants.map(variant=>({...variant,available:false}))},{currency:'USD'},url+'?variant=1');
  assert.throws(()=>verifyProductSnapshot(p,'Black / 8',soldOut),/нет в наличии/);
  const confirmed={...p,sourceManuallyConfirmed:true};
  assert.equal(verifyProductSnapshot(confirmed,'Black / 8',fresh).sourceManuallyConfirmed,true);
  const optionsOmitted={...fresh,variants:[]};
  const verifiedBase=verifyProductSnapshot(confirmed,'Black / 8',optionsOmitted,6000);
  assert.equal(verifiedBase.sourcePrice,110);assert.equal(verifiedBase.sourceVariantId,'1');
  assert.equal(verifiedBase.importedAt,6000);
  assert.doesNotThrow(()=>verifyKnownSnapshotFields(confirmed,'Black / 8',{currency:'USD',price:110,variants:[{label:'Black / 8',available:false,price:110}]}));
  assert.throws(()=>verifyKnownSnapshotFields(confirmed,'Black / 8',{currency:'USD',price:111}),/Цена изменилась/);
  assert.throws(()=>verifyKnownSnapshotFields(confirmed,'Black / 8',{currency:'EUR',price:110}),/валюту витрины/);
  assert.throws(()=>verifyProductSnapshot(p,'Black / 8',{...fresh,currency:'EUR'}),/валюту витрины/);
  assert.equal(manualFallbackAllowed(confirmed,'Black / 8',new ManualEntryFallbackError()),true);
  assert.equal(manualFallbackAllowed(p,'Black / 8',new ManualEntryFallbackError()),false);
  assert.equal(manualFallbackAllowed(confirmed,'Black / 8',new Error('Price changed')),false);
  assert.throws(()=>manualFallbackAllowed(confirmed,'Black / 8',new ManualEntryFallbackError('fallback',{currency:'EUR',price:110,variants:[],warnings:[],sourceUrl:url,method:'partial'})),/валюту витрины/);
  assert.throws(()=>manualFallbackAllowed(confirmed,'Black / 8',new ManualEntryFallbackError('fallback',{currency:'USD',price:111,variants:[],warnings:[],sourceUrl:url,method:'partial'})),/Цена изменилась/);
  assert.throws(()=>manualFallbackAllowed(confirmed,'Black / 8',new ManualEntryFallbackError('fallback',{price:111,variants:[],warnings:[],sourceUrl:url,method:'partial'})),/без валюты/);
});
test('fresh verification normalizes a catalog label for a single live option',()=>{
  const p={id:'p',name:'Toy',brand:'Amazon',category:'Дом и быт',usd:12.79,weight:1.4,image:'',variants:['Указанный вариант'],sourceUrl:'https://www.amazon.com/dp/B0CGY4LZQ3',country:'США',sourceCurrency:'USD',sourcePrice:12.79,sourceShipping:10,sourceShippingCurrency:'USD',sourceShippingUsd:10,shippingKnown:true,boxedWeight:.4};
  const fresh={sourceUrl:p.sourceUrl,currency:'USD',price:12.79,variants:[{label:'Выбранный вариант',available:true,price:12.79}],warnings:[],method:'Amazon product data'};
  const checked=verifyProductSnapshot(p,'Указанный вариант',fresh,5000);
  assert.equal(checked.sourcePrice,12.79);assert.equal(checked.importedAt,5000);
});
test('fresh verification accepts a matching variant when the merchant omits stock status',()=>{
  const p={id:'p',name:'Shoe',brand:'Nike',category:'Обувь',usd:76.97,weight:1.5,image:'',variants:['White · 6'],sourceUrl:'https://www.nike.com/t/example/DM4044-108',sourceVariantId:'00197600816527',sourceCurrency:'USD',sourcePrice:76.97};
  const fresh={sourceUrl:p.sourceUrl,currency:'USD',price:76.97,variants:[{id:'00197600816527',label:'White · 6',available:true,availabilityKnown:false,price:76.97}],warnings:[],method:'JSON-LD'};
  assert.equal(verifyProductSnapshot(p,'White · 6',fresh,5000).sourcePrice,76.97);
});

test('Shopify keeps the store\'s "before the discount" price only when it is above the price',()=>{
  const sale={...product,variants:[
    {id:1,title:'Black / 8',option1:'Black',option2:'8',price:7397,compare_at_price:12500,available:true},
    {id:2,title:'Black / 9',option1:'Black',option2:'9',price:7397,compare_at_price:7397,available:true},
  ]};
  const chosen=extractShopify(sale,{currency:'USD'},url+'?variant=1');
  assert.equal(chosen.price,73.97);assert.equal(chosen.referencePrice,125);assert.equal(chosen.variants[0].compareAtPrice,125);
  assert.equal(chosen.variants[1].compareAtPrice,undefined,'a compare price equal to the price is no discount');
  assert.equal(extractShopify(sale,{currency:'USD'},url+'?variant=2').referencePrice,undefined);
});
