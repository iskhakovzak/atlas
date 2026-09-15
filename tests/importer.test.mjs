import test from 'node:test';
import assert from 'node:assert/strict';
import {extractShopify, shopifyEndpoints} from '../lib/importer/shopify.ts';
import {featuredStoreGroups, supportedStoreCount} from '../lib/importer/stores.ts';
import {extractProduct} from '../lib/importer/extract.ts';
import {fetchProduct, allowedUrl} from '../lib/importer/fetch.ts';
import {verifyProductSnapshot} from '../lib/importer/verify.ts';

const url = 'https://www.allbirds.com/products/shoe';
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
    assert.equal((await fetchProduct(url)).method,'Open Graph');
  } finally {globalThis.fetch=original;}
});
test('fresh verification blocks changed prices and unavailable variants',()=>{
  const p={id:'p',name:'Shoe',brand:'Allbirds',category:'Обувь',usd:110,weight:1.5,image:'',variants:['Black / 8'],sourceUrl:url,sourceVariantId:'1',sourceCurrency:'USD',sourcePrice:110};
  const fresh=extractShopify(product,{currency:'USD'},url+'?variant=1');
  const checked=verifyProductSnapshot(p,'Black / 8',fresh,5000);
  assert.equal(checked.sourcePrice,110);assert.equal(checked.importedAt,5000);assert.equal(checked.sourceExpiresAt,605000);
  assert.throws(()=>verifyProductSnapshot({...p,sourcePrice:109},'Black / 8',fresh),/Цена изменилась/);
  assert.throws(()=>verifyProductSnapshot({...p,sourceVariantId:'2'},'Black / 9',fresh),/закончился/);
});
