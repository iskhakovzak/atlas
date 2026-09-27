import test from 'node:test';
import assert from 'node:assert/strict';
import {declarationFor,dedupeSafeImages,extractProduct,inferProductCategory,parseWeight,safeImage} from '../lib/importer/extract.ts';
import {allowedUrl,fetchProduct,supportedStoreCount,ManualEntryFallbackError} from '../lib/importer/fetch.ts';
import {manualFallbackAllowed} from '../lib/importer/manual-fallback.ts';
import {customsVersion,paddedWeight,toUsd} from '../lib/market/world.ts';
import {applyAction} from '../lib/market/actions.ts';
import {blank,products,checkoutCart,addToCart,cartSignature,balanceOf,confirmDemoPayment,totalOf} from '../lib/market/domain.ts';
test('JSON-LD extracts title, image, price/currency, shipping and packaged weight',()=>{
const html=`<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Zapatos &amp; cosas","image":["https://i.ebayimg.com/image.jpg"],"shippingWeight":{"value":1500,"unitCode":"GRM"},"offers":{"@type":"Offer","price":"99.95","priceCurrency":"EUR","shippingDetails":{"shippingRate":{"value":4.5,"currency":"EUR"},"shippingDestination":{"addressCountry":"ES"}}}}</script>`;
const p=extractProduct(html,'https://www.ebay.es/itm/123');assert.equal(p.title,'Zapatos & cosas');assert.equal(p.price,99.95);assert.equal(p.currency,'EUR');assert.equal(p.shipping,4.5);assert.equal(p.shippingDestination,'ES');assert.equal(p.boxedWeight,1.5);assert.equal(p.weightKind,'shipping');assert.equal(p.country,'Испания');
});
test('supports a broad store list and prepares a conservative declaration draft',()=>{
assert(supportedStoreCount>=145);assert.equal(allowedUrl('https://www.on.com/en-us/products/cloud-6').hostname,'www.on.com');assert.equal(allowedUrl('https://www.zara.com/us/en/product-p000.html').hostname,'www.zara.com');assert.equal(allowedUrl('https://rarebeauty.com/products/blush').hostname,'rarebeauty.com');assert.equal(allowedUrl('https://kith.com/products/shoe').hostname,'kith.com');assert.equal(allowedUrl('https://ebay.us/short-link').hostname,'ebay.us');assert.equal(allowedUrl('https://www.ebay.nl/itm/123456789012').hostname,'www.ebay.nl');assert.throws(()=>allowedUrl('https://on.com.evil.example/product'));
assert.equal(extractProduct('<meta property="og:title" content="Cloud 6"><meta property="product:price:currency" content="USD">','https://www.on.com/en-us/products/cloud-6').country,'США');
assert.equal(inferProductCategory('Cloud 6 running shoes','On'),'Обувь');assert.match(declarationFor('Обувь','Cloud 6 running shoes','On'),/Обувь для личного пользования/);
});
test('Zara embedded product data provides selected price, photo, country, colors and sizes',()=>{
const html=`<meta property="og:image" content="https://static.zara.net/fallback.jpg"><script>window.zara.appConfig = {"formatterConfig":{"currency":"RON","currencyDecimals":-2},"storeCountryCode":"ro"};window.zara.viewPayload = {"product":{"name":"RELAXED FIT PADDED LEATHER JACKET","detail":{"colors":[{"name":"Ochre","productId":549815761,"price":105900,"xmedia":[{"extraInfo":{"deliveryUrl":"https://static.zara.net/jacket.jpg"}}],"sizes":[{"name":"S","availability":"in_stock","price":105900},{"name":"M","availability":"out_of_stock","price":105900},{"name":"L","availability":"in_stock","price":105900}]}]}}};</script>`;
const p=extractProduct(html,'https://www.zara.com/ro/en/jacket-p04416276.html?v1=549815761');assert.equal(p.title,'RELAXED FIT PADDED LEATHER JACKET');assert.equal(p.brand,'Zara');assert.equal(p.price,1059);assert.equal(p.currency,'RON');assert.equal(p.country,'Румыния');assert.equal(p.image,'https://static.zara.net/jacket.jpg');assert.deepEqual(p.variants?.map(v=>[v.label,v.available]),[['Ochre · S',true],['Ochre · M',false],['Ochre · L',true]]);assert.equal(p.category,'Одежда');
});
test('missing shipping remains unknown and aggregate lower bounds are not exact prices',()=>{const p=extractProduct('<script type="application/ld+json">{"@type":"Product","name":"Item","offers":{"@type":"AggregateOffer","lowPrice":10,"highPrice":100,"priceCurrency":"USD"}}</script>','https://ebay.com/itm/x');assert.equal(p.shipping,undefined);assert.equal(p.price,undefined);assert(p.warnings.length>0)});
test('OG fallback and escaped names render as text, never executable markup',()=>{const p=extractProduct(`<meta property='og:title' content='Product &amp; Shoes'><meta property='og:image' content='/image.jpg'><meta property='product:price:amount' content='12.50'><meta property='product:price:currency' content='USD'>`,'https://nike.com/item');assert.equal(p.title,'Product & Shoes');assert.equal(p.price,12.5);assert.equal(p.image,'https://nike.com/image.jpg');assert.equal(safeImage('javascript:alert(1)','https://nike.com'),undefined)});
test('units, one-kilo minimum and boxed weight margin are explicit',()=>{assert.equal(parseWeight({value:2,unitCode:'LBR'}),.908);assert.equal(parseWeight({value:2}),undefined);assert.equal(parseWeight({value:99999,unitCode:'KGM'}),undefined);assert.equal(paddedWeight(1.2),1.7);assert.equal(paddedWeight(.1),1);assert.throws(()=>paddedWeight(50));assert.equal(toUsd(100,'EUR'),110)});
test('same-store cart items share one parcel allowance and one-kilo minimum',()=>{
 const make=(id,path,boxed)=>({...products[0],id,sourceUrl:`https://apple.com/shop/${path}`,sourcePrice:20,sourceCurrency:'USD',sourceShipping:0,sourceShippingUsd:0,sourceShippingCurrency:'USD',sourceShippingEstimated:false,shippingKnown:true,boxedWeight:boxed,weight:paddedWeight(boxed),country:'США',usd:20,variants:['Один']});
 let state=addToCart(blank(),make('tag','tag',.2),'Один',1);
 assert.equal(state.cart[0].quote.weight,1);assert.equal(state.cart[0].quote.shipping,90000);
 state=addToCart(state,make('case','case',.3),'Один',2);
 assert.equal(state.cart.reduce((sum,item)=>sum+item.quote.weight,0),1);
 assert.equal(state.cart.reduce((sum,item)=>sum+item.quote.shipping,0),90000);
 assert.equal(state.cart.reduce((sum,item)=>sum+item.quote.reserve,0),18000);
 assert.equal(totalOf(state.cart),state.cart.reduce((sum,item)=>sum+item.quote.total,0));
});
test('storefront and product text infer Apple shipping country and AirTag category',()=>{const p=extractProduct('<script type="application/ld+json">{"@type":"Product","name":"AirTag 1 pack","category":"Bluetooth trackers","offers":{"price":29,"priceCurrency":"USD"}}</script>','https://www.apple.com/shop/buy-airtag/airtag/1-pack');assert.equal(p.country,'США');assert.equal(p.category,'Электроника')});
test('source fetch rejects private URLs, deceptive domains and foreign redirects',async()=>{for(const u of ['http://ebay.com/x','https://127.0.0.1','https://ebay.com.evil.com','https://evil.ebay.com','https://user:pw@ebay.com/x','https://ebay.com:8080'])assert.throws(()=>allowedUrl(u));const original=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:302,headers:{Location:'http://169.254.169.254/latest'}});try{await assert.rejects(()=>fetchProduct('https://ebay.com/itm/1'))}finally{globalThis.fetch=original}});
test('eBay keeps partial public data and allows manual review when a page is blocked or incomplete',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>new Response('<meta property="og:title" content="Vintage jacket"><meta property="og:image" content="https://i.ebayimg.com/images/g/a/s-l500.jpg">',{headers:{'Content-Type':'text/html'}});try{await assert.rejects(()=>fetchProduct('https://ebay.es/itm/1'),error=>error instanceof ManualEntryFallbackError&&error.partial?.title==='Vintage jacket'&&error.partial?.image==='https://i.ebayimg.com/images/g/a/s-l500.jpg');globalThis.fetch=async()=>{throw new TypeError('blocked by upstream')};await assert.rejects(()=>fetchProduct('https://ebay.es/itm/1'),ManualEntryFallbackError);globalThis.fetch=async()=>new Response('x'.repeat(3_000_001),{headers:{'Content-Type':'text/html'}});await assert.rejects(()=>fetchProduct('https://ebay.es/itm/1'),ManualEntryFallbackError)}finally{globalThis.fetch=original}});
test('eBay definite not-found responses are not treated as a temporary block',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>new Response('not found',{status:404,headers:{'Content-Type':'text/html'}});try{await assert.rejects(()=>fetchProduct('https://ebay.es/itm/12345'),error=>!(error instanceof ManualEntryFallbackError)&&/карточка товара не найдена/.test(error.message))}finally{globalThis.fetch=original}});
test('eBay locale pages can use exact listing-bound embedded item data',()=>{
 const item={url:'https://www.ebay.es/itm/123',itemId:'123',name:'Chaqueta vintage',price:24.5,currency:'EUR',image:'https://i.ebayimg.com/images/g/a/s-l500.jpg'};
 const recommendation={url:'https://www.ebay.es/itm/456',itemId:'456',name:'Unrelated recommendation',price:5,currency:'EUR',image:'https://i.ebayimg.com/images/g/b/s-l500.jpg'};
 const html=`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{recommendations:[recommendation],item}}})}</script>`;
 const parsed=extractProduct(html,item.url);
 assert.equal(parsed.title,'Chaqueta vintage');assert.equal(parsed.price,24.5);assert.equal(parsed.currency,'EUR');assert.equal(parsed.method,'ebay.es embedded product data');
});
test('eBay regional listing data is recognized on newly supported storefronts',()=>{
 const url='https://www.ebay.nl/itm/123456789012';
 const item={url,itemId:'123456789012',name:'Dutch listing',price:14.25,currency:'EUR',image:'https://i.ebayimg.com/images/g/a/s-l500.jpg'};
 const html=`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{item}}})}</script>`;
 const parsed=extractProduct(html,url);assert.equal(parsed.title,'Dutch listing');assert.equal(parsed.price,14.25);assert.equal(parsed.method,'ebay.nl embedded product data');
});
test('unsupported stores enter a no-network manual fallback while auto import stays allowlisted',async()=>{
 const original=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;throw Error('should not fetch an unsupported host')};
 try{
  await assert.rejects(()=>fetchProduct('https://shop.example.com/products/coat'),error=>error instanceof ManualEntryFallbackError&&error.partial?.sourceUrl==='https://shop.example.com/products/coat');
  assert.equal(requests,0);assert.throws(()=>allowedUrl('https://shop.example.com/products/coat'),/не в списке поддерживаемых/);
  await assert.rejects(()=>fetchProduct('https://localhost/products/coat'));
  await assert.rejects(()=>fetchProduct('https://shop.example.com:8443/products/coat'));
 }finally{globalThis.fetch=original}
});
test('a customer-confirmed unsupported-store listing can be ordered with server-recomputed pricing',async()=>{
 let failure;try{await fetchProduct('https://shop.example.com/products/coat')}catch(error){failure=error}
 const sourceUrl='https://shop.example.com/products/coat',product={...products[0],sourceUrl,sourceManuallyConfirmed:true,sourcePrice:20,sourceCurrency:'EUR',sourceShipping:3,sourceShippingCurrency:'EUR',sourceShippingUsd:1,shippingKnown:true,country:'Испания',boxedWeight:.8,weight:1.3};
 const selectedVariant=product.variants[0];assert(manualFallbackAllowed(product,selectedVariant,failure));assert(!manualFallbackAllowed({...product,sourceManuallyConfirmed:false},selectedVariant,failure));
 const state=applyAction(blank(),{type:'cart-add',product,variant:selectedVariant},false);
 assert.equal(state.cart[0].product.usd,toUsd(20,'EUR'));assert.equal(state.cart[0].product.sourceShippingUsd,toUsd(3,'EUR'));
});
test('image gallery collapses photo renditions but keeps different images and variants',()=>{
 const result=dedupeSafeImages([
  'https://i.ebayimg.com/images/g/a/s-l500.jpg',
  'https://i.ebayimg.com/images/g/a/s-l1600.jpg',
  'https://i.ebayimg.com/images/g/b/s-l500.jpg',
  'https://m.media-amazon.com/images/I/shoe._AC_SY500_.jpg',
  'https://m.media-amazon.com/images/I/shoe._AC_SY1200_.jpg',
  'https://m.media-amazon.com/images/I/shoe._red.jpg',
  'https://m.media-amazon.com/images/I/shoe._blue.jpg',
  'https://cdn.example.com/shoe.jpg?variant=blue',
  'https://cdn.example.com/shoe.jpg?variant=red',
  'https://cdn.example.com/shoe.jpg?color=blue',
  'https://cdn.example.com/shoe.jpg?color=red',
  'http://127.0.0.1/private.jpg',
 ],'https://ebay.com/itm/1');
 assert.equal(result.length,9);
 assert.equal(result[0],'https://i.ebayimg.com/images/g/a/s-l500.jpg');
 assert(result.some(url=>url.endsWith('shoe._red.jpg')));assert(result.some(url=>url.endsWith('shoe._blue.jpg')));
});
test('image gallery collapses common CDN and Shopify size renditions but keeps color-specific photos',()=>{
 const result=dedupeSafeImages([
  'https://cdn.example.com/products/coat.jpg?width=320&quality=70',
  'https://cdn.example.com/products/coat.jpg?quality=90&width=1600',
  'https://cdn.shopify.com/s/files/1/0001/products/coat_300x.jpg?v=42',
  'https://cdn.shopify.com/s/files/1/0001/products/coat_1200x1200.jpg?v=42',
  'https://cdn.shopify.com/s/files/1/0001/products/coat-red_300x.jpg?v=42',
  'https://cdn.shopify.com/s/files/1/0001/products/coat-blue_300x.jpg?v=42',
 ],'https://shop.example/products/coat');
 assert.equal(result.length,4);
 assert.equal(result[0],'https://cdn.example.com/products/coat.jpg?width=320&quality=70');
 assert.equal(result[1],'https://cdn.shopify.com/s/files/1/0001/products/coat_300x.jpg?v=42');
 assert(result.some(url=>url.includes('coat-red_300x.jpg')));
 assert(result.some(url=>url.includes('coat-blue_300x.jpg')));
});
test('official eBay short links may redirect only to an allowlisted eBay product page',async()=>{const original=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;if(requests===1)return new Response('',{status:302,headers:{Location:'https://www.ebay.com/itm/123'}});return new Response('<script type="application/ld+json">{"@type":"Product","name":"eBay item","image":"https://i.ebayimg.com/images/g/a/s-l500.jpg","offers":{"@type":"Offer","price":"18.50","priceCurrency":"USD"}}</script>',{headers:{'Content-Type':'text/html'}})};try{const item=await fetchProduct('https://ebay.us/abc123');assert.equal(item.title,'eBay item');assert.equal(item.price,18.5);assert.equal(item.currency,'USD')}finally{globalThis.fetch=original}});
test('server recomputes country currency, domestic shipping and padded weight',()=>{const p={...products[0],sourceUrl:'https://ebay.es/itm/12',sourcePrice:100,sourceCurrency:'EUR',sourceShipping:5,shippingKnown:true,boxedWeight:1.2,country:'Испания',weight:49,usd:1};const s=applyAction(blank(),{type:'cart-add',product:p,variant:p.variants[0]},false);assert.equal(s.cart[0].product.weight,1.7);assert.equal(s.cart[0].product.usd,110);assert.equal(s.cart[0].quote.sourceShipping,70400);assert.equal(s.cart[0].quote.weight,1.7);assert.equal(s.cart[0].quote.total,s.cart[0].quote.merchandise+s.cart[0].quote.service+s.cart[0].quote.shipping+s.cart[0].quote.reserve+70400)});
test('checkout needs recorded customs consent and warehouse actions require operator',()=>{let s=addToCart(blank(),products[0],products[0].variants[0]);assert.throws(()=>checkoutCart(s,'x',cartSignature(s.cart),false));s=checkoutCart(s,'x',cartSignature(s.cart),false,Date.now(),customsVersion);assert.equal(s.orders[0].customsConsent.version,customsVersion);assert.throws(()=>applyAction(s,{type:'advance',id:s.orders[0].id,expected:0},false));s=confirmDemoPayment(s,s.orders[0].id);const n=applyAction(s,{type:'advance',id:s.orders[0].id,expected:0},true);assert.equal(n.orders[0].status,1)});
test('adding a photo keeps the original order quote unchanged',()=>{let s=addToCart(blank(),{...products[0],sourceUrl:'https://ebay.com/itm/1',shippingKnown:true},products[0].variants[0]);s=checkoutCart(s,'x',cartSignature(s.cart),false,Date.now(),customsVersion);const before=JSON.stringify(s.orders[0].quote);s=applyAction(s,{type:'order-image',id:s.orders[0].id,image:'https://i.ebayimg.com/image.jpg'},false);assert.equal(s.orders[0].product.image,'https://i.ebayimg.com/image.jpg');assert.equal(JSON.stringify(s.orders[0].quote),before)});
test('manager confirms the $10 store-shipping reserve and refunds the difference',()=>{const p={...products[0],id:'reserve-item',sourceUrl:'https://zara.com/item',sourcePrice:100,sourceCurrency:'USD',sourceShipping:10,sourceShippingCurrency:'USD',sourceShippingUsd:10,sourceShippingEstimated:true,shippingKnown:true,boxedWeight:1,country:'Румыния'};let s=applyAction(blank(),{type:'cart-add',product:p,variant:p.variants[0]},false);s=checkoutCart(s,'ship',cartSignature(s.cart),false,Date.now(),customsVersion);const id=s.orders[0].id;assert.throws(()=>applyAction(s,{type:'advance',id,expected:0},true));s=applyAction(s,{type:'confirm-store-shipping',id,actualUsd:4},true);assert.equal(s.orders[0].storeShippingSettlement.actualUsd,4);assert.equal(s.orders[0].storeShippingSettlement.actual,51200);assert.equal(s.orders[0].storeShippingSettlement.refund,76800);assert.equal(balanceOf(s),76800);s=confirmDemoPayment(s,id);s=applyAction(s,{type:'advance',id,expected:0},true);assert.equal(s.orders[0].status,1)});
