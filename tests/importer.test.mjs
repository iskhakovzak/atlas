import test from 'node:test';
import assert from 'node:assert/strict';
import {extractShopify, shopifyEndpoints} from '../lib/importer/shopify.ts';
import {extractProduct} from '../lib/importer/extract.ts';
import {fetchProduct, allowedUrl} from '../lib/importer/fetch.ts';

const url = 'https://www.allbirds.com/products/shoe';
const product = {handle:'shoe',title:'Wool shoes',vendor:'Allbirds',images:['//cdn.shopify.com/one.jpg','https://127.0.0.1/private','//cdn.shopify.com/two.jpg'],options:[{name:'Color'},{name:'Size'}],variants:[
  {id:1,title:'Black / 8',option1:'Black',option2:'8',price:11000,available:true,featured_image:{src:'//cdn.shopify.com/black.jpg'}},
  {id:2,title:'Black / 9',option1:'Black',option2:'9',price:12000,available:false},
  {id:3,title:'White / 8',option1:'White',option2:'8',price:13000,available:true},
]};
test('Shopify retains variant price, size, color, availability and safe gallery',()=>{
  const p=extractShopify(product,{currency:'USD'},url+'?variant=1');
  assert.equal(p.price,110);assert.equal(p.currency,'USD');assert.equal(p.image,'https://cdn.shopify.com/black.jpg');
  assert.equal(p.variants[0].size,'8');assert.equal(p.variants[0].color,'Black');assert.equal(p.variants[1].available,false);
  assert(!p.images.some(x=>x.includes('127.0.0.1')));assert.equal(p.shipping,undefined);
  assert.equal(extractShopify(product,{currency:'USD'},url).price,undefined);
  assert.throws(()=>extractShopify(product,{},url));
  assert.throws(()=>extractShopify({...product,handle:'other'},{currency:'USD'},url));
});
test('Shopify endpoints preserve locale but reject unapproved hosts and nonproducts',()=>{
  const e=shopifyEndpoints(new URL('https://kyliecosmetics.com/en-gb/collections/lips/products/lip-kit?variant=1'));
  assert.equal(e.product.href,'https://kyliecosmetics.com/en-gb/products/lip-kit.js');
  assert.equal(e.currency.pathname,'/en-gb/cart.js');
  assert.equal(shopifyEndpoints(new URL('https://evil.allbirds.com/products/shoe')),undefined);
  assert.throws(()=>allowedUrl('https://allbirds.com.evil.example/products/shoe'));
});
test('ProductGroup matches color with tracking and size variant query, not another color',()=>{
  const page='https://www.fashionnova.com/products/jeans?color=blue&variant=2&utm_source=test';
  const child=(id,color,price)=>({'@type':'Product',size:String(id),color,offers:{url:`https://www.fashionnova.com/products/jeans?color=${color}&variant=${id}`,price,priceCurrency:'USD',availability:'https://schema.org/InStock'}});
  const p=extractProduct(`<script type="application/ld+json">${JSON.stringify({'@type':'ProductGroup',name:'Jeans',hasVariant:[child(1,'red',90),child(2,'blue',20),child(3,'blue',25)]})}</script>`,page);
  assert.equal(p.price,20);assert.deepEqual(p.variants.map(v=>v.label),['blue · 2','blue · 3']);
});
test('generic importer deduplicates images and treats size and color as one variant',()=>{
  const p=extractProduct(`<script type="application/ld+json">${JSON.stringify({'@type':'Product',name:'Shoes',color:'Black',size:'42',image:['/a.jpg','/a.jpg','/b.jpg'],offers:{price:'1,299.95',priceCurrency:'USD'}})}</script>`,'https://nike.com/product');
  assert.equal(p.price,1299.95);assert.equal(p.images.length,2);assert.deepEqual(p.variants.map(v=>v.label),['Black · 42']);
});
test('public Ajax requests omit credentials and unsafe redirects fall back safely',async()=>{
  const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async(u,init)=>{calls.push([String(u),init]);if(String(u).endsWith('cart.js'))return Response.json({currency:'USD'});return Response.json(product);};
  try {
    assert.equal((await fetchProduct(url+'?variant=1')).price,110);
    assert.equal(calls.length,2);assert(calls.every(([,init])=>!init.headers.Cookie&&!init.headers.Authorization&&init.redirect==='manual'));
    globalThis.fetch=async(u)=>String(u).endsWith('.js')?new Response('',{status:302,headers:{Location:'http://169.254.169.254/'}}):new Response('<meta property="og:title" content="Shoes">',{headers:{'Content-Type':'text/html'}});
    assert.equal((await fetchProduct(url)).method,'Open Graph');
  } finally {globalThis.fetch=original;}
});
