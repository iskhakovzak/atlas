import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMerchantVariants,safeVariantSourceUrl,isConfirmedVariantAvailable} from '../lib/importer/variant-normalization.ts';
import {extractShopify} from '../lib/importer/shopify.ts';
const sourceUrl='https://shop.simon.com/products/three-options';
const base={sourceUrl,warnings:[],currency:'USD',title:'Shoe'};
test('native option URLs require same merchant, secure URL and explicit regional match',()=>{
 assert.equal(safeVariantSourceUrl('/us/shoe/B.html','https://www.adidas.com/us/shoe/A.html'),'https://www.adidas.com/us/shoe/B.html');
 for(const url of ['https://www.adidas.com/es/shoe/B.html','https://www.adidas.com/shoe/B.html','https://www.adidas.com.evil.test/us/shoe/B.html','https://user@www.adidas.com/us/shoe/B.html','http://www.adidas.com/us/shoe/B.html','https://www.adidas.com:8080/us/shoe/B.html']) assert.equal(safeVariantSourceUrl(url,'https://www.adidas.com/us/shoe/A.html'),undefined);
});
test('normalization preserves exact independent widths and seller offers without multiplying combinations',()=>{
 const variants=[['a','Wide',25,'seller1'],['b','Narrow',32,'seller2']].map(([id,width,price,sellerId])=>({id,sellerId,label:'Red · 11',color:'Red',size:'11',price,available:true,availabilityKnown:true,options:[{name:'Color',value:'Red'},{name:'Size',value:'11'},{name:'Width',value:width}]}));
 const result=normalizeMerchantVariants({...base,variants});
 assert.equal(result.variants.length,2);assert.notEqual(result.variants[0].label,result.variants[1].label);
 assert.deepEqual(result.variants.map(v=>v.price),[25,32]);assert.deepEqual(result.variants.map(v=>v.options.at(-1).value),['Wide','Narrow']);
 assert.equal(result.variantScope,'item');assert.equal(result.variantsComplete,false);
});
test('stock normalization retains unavailable evidence and never upgrades unknown stock',()=>{
 const result=normalizeMerchantVariants({...base,variants:[{id:'a',label:'A',available:true},{id:'b',label:'B',available:true,availabilityKnown:true,quantity:0},{id:'c',label:'C',available:true,availabilityKnown:true}]});
 assert.equal(result.variants.length,3);assert.deepEqual(result.variants.map(isConfirmedVariantAvailable),[false,false,true]);assert.equal(result.variants[1].available,false);
});
test('Shopify keeps native group, all three axes, exact prices and variant-bound photo without cross-color fallback',()=>{
 const product={id:123,handle:'three-options',title:'Shoe',featured_image:'https://cdn.shopify.com/red.jpg',images:['https://cdn.shopify.com/red.jpg'],options:['Color','Size','Width'],variants:[{id:1,title:'Red / 11 / Wide',option1:'Red',option2:'11',option3:'Wide',price:2500,available:true,featured_image:{src:'https://cdn.shopify.com/red.jpg'},url:'/products/three-options?variant=1'},{id:2,title:'Blue / 11 / Narrow',option1:'Blue',option2:'11',option3:'Narrow',price:3400,available:true}]};
 const result=normalizeMerchantVariants(extractShopify(product,{currency:'USD'},sourceUrl));
 assert.equal(result.variantScope,'group');assert.equal(result.groupId,'123');assert.equal(result.variantsComplete,true);
 assert.equal(result.variants[0].sourceUrl,sourceUrl+'?variant=1');assert.equal(result.variants[1].sourceUrl,undefined);
 assert.equal(result.variants[1].image,undefined);assert.deepEqual(result.variants[1].images,[]);assert.deepEqual(result.variants.map(v=>v.price),[25,34]);assert.deepEqual(result.variants[0].options.map(o=>o.name),['Color','Size','Width']);
});
test('stock/price enrichment never changes an existing unambiguous option label',()=>{
 const original={id:'123',label:'Red · 11',available:true,availabilityKnown:true,options:[{name:'Color',value:'Red'},{name:'US Size',value:'11'},{name:'UK Size',value:'10.5'}]};
 assert.equal(normalizeMerchantVariants({...base,variants:[original]}).variants[0].label,original.label);
});
test('native Nike group retains distinct color prices, SKU photos and exact provider child URLs',async()=>{
 const {extractProduct}=await import('../lib/importer/extract.ts');
 const source='https://www.nike.com/us/t/shoe/AA1234-001';
 const product=(code,color,price)=>({styleCode:code,merchProductId:code,pdpUrl:'/us/t/shoe/'+code,colorDescription:color,productInfo:{title:'Shoe'},prices:{currentPrice:price,currency:'USD'},sizes:[{label:'11',merchSkuId:code+'-11',status:'ACTIVE'}],contentImages:[{properties:{squarish:{url:'https://static.nike.com/'+color+'.jpg'}}}]});
 const red=product('AA1234-001','Red',25),blue=product('AA1234-002','Blue',34);
 const html='<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:{selectedProduct:red,productGroups:[{products:{red,blue}}]}}})+'</script>';
 const result=normalizeMerchantVariants(extractProduct(html,source));
 assert.equal(result.variantScope,'group');assert.equal(result.variantsComplete,false);
 assert.deepEqual(result.variants.map(v=>v.price),[25,34]);assert.equal(result.variants[1].sourceUrl,'https://www.nike.com/us/t/shoe/AA1234-002');
 assert.equal(result.variants[1].images[0],'https://static.nike.com/Blue.jpg');assert.ok(result.variants.every(isConfirmedVariantAvailable));
});
test('Zara keeps native SKU, exact color galleries and unknown stock without promoting it',async()=>{
 const {extractProduct}=await import('../lib/importer/extract.ts');
 const config={formatterConfig:{currency:'RON',currencyDecimals:-2},storeCountryCode:'RO'};
 const payload={product:{name:'Shirt',detail:{colors:[{name:'Red',productId:123,price:10000,xmedia:[{url:'https://static.zara.net/red.jpg'}],sizes:[{id:111,name:'S',price:10000,availability:'in_stock'}]},{name:'Blue',productId:124,price:12000,xmedia:[{url:'https://static.zara.net/blue.jpg'}],sizes:[{id:112,name:'M',price:12000,availability:'unexpected'}]}]}}};
 const html='<script>window.zara.appConfig='+JSON.stringify(config)+';window.zara.viewPayload='+JSON.stringify(payload)+';</script>';
 const result=normalizeMerchantVariants(extractProduct(html,'https://www.zara.com/ro/en/shirt-p123.html?v1=123'));
 assert.equal(result.variantScope,'group');assert.equal(result.currency,'RON');assert.equal(result.variants[0].id,'111');assert.equal(result.variants[1].colorId,'124');
 assert.equal(result.colorwayImages[1].images[0],'https://static.zara.net/blue.jpg');assert.deepEqual(result.variants.map(isConfirmedVariantAvailable),[true,false]);
});
