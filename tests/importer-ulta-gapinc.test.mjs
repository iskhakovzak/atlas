import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchProduct} from '../lib/importer/fetch.ts';
import {extractProduct} from '../lib/importer/extract.ts';

const html=(body,status=200)=>new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8'}});

// --- Gap Inc.: the product rides in the RSC flight, one object per page --------------------------------
const image=(id)=>({sequence_number:1,absolute_url:`https://content.gapinc.com/b/${id}.png`,crops:[
  {type:'VIEW LARGE IMAGE',absolute_url:`https://content.gapinc.com/b/${id}.png?width=520`},
  {type:'ZOOM',absolute_url:`https://content.gapinc.com/b/${id}.png?width=1500`}]});
const sku=(id,size,status,effective,regular=24.99)=>({sku_id:id,description:size,size_dimension1:size,size_dimension2:null,
  inventory_status:{status},isInstock:status!=='OUT_OF_STOCK',
  price:{currency:'USD',effective_price:effective,price_details:{regular_price:regular}}});
const ref=path=>`$78:props:children:props:data:${path}`;
const gapData={
  brand:'on',input_id:'866414102',input_type:'CC',selectedMultiVariantKey:'REGULAR',
  selectedCustomerChoice:{customer_choice_id:'866414102',images:ref('customer_choices:866414102:images')},
  variant_definition:[{name:'Fit',values:[{id:'REGULAR',name:'Regular'},{id:'TALL',name:'Tall'}]}],
  styles:{866414:{style_id:'866414',primary_style_id:'866414',description:'Garment-Dyed Heavyweight Cropped T-Shirt'}},
  customer_choices:{
    866414102:{customer_choice_id:'866414102',description:'Lakeshore',style_id:'866414',images:[image('lake-1'),{...image('lake-2'),sequence_number:2}]},
    // RSC de-duplicates repeated values into references to the first copy.
    866414032:{customer_choice_id:'866414032',description:ref('variants:REGULAR:customer_choices:866414032:description'),style_id:'866414',images:[image('black-1')]},
  },
  variants:{
    REGULAR:{size_dimension1_label:'Size',customer_choices:{
      866414102:{customer_choice_id:'866414102',style_id:'866414',description:'Lakeshore',
        price:{currency:'USD',min_effective_price:14.99,max_effective_price:14.99,min_regular_price:24.99,max_regular_price:24.99},
        skus:[sku('8664141020001','S','OUT_OF_STOCK',14.99),sku('8664141020002','M','IN_STOCK',14.99)]},
      866414032:{customer_choice_id:'866414032',style_id:'866414',description:'BlackJack',
        price:{currency:'USD',min_effective_price:12.49,max_effective_price:12.49,min_regular_price:24.99,max_regular_price:24.99},
        skus:[sku('8664140320002','M','LOW_STOCK',12.49)]},
    }},
    TALL:{size_dimension1_label:'Size',customer_choices:{
      866414102:{customer_choice_id:'866414102',style_id:'866414',
        price:{currency:'USD',min_effective_price:16.99,max_effective_price:16.99,min_regular_price:26.99,max_regular_price:26.99},
        skus:[sku('8664141020101','L','IN_STOCK',16.99,26.99)]},
    }},
  },
};
// A recommendation rail later in the flight must never be read as the product.
const decoy={customer_choices:{111111111:{description:'Decoy'}},variants:{REGULAR:{customer_choices:{111111111:{skus:[sku('1111111110001','S','IN_STOCK',1)]}}}}};
function gapPage(data){
  const flight=`78:{"props":{"children":{"props":{"data":${JSON.stringify(data)}}}}}\n79:${JSON.stringify(decoy)}\n`;
  const half=Math.floor(flight.length/2);
  return `<html><head><title>Old Navy</title></head><body>${[flight.slice(0,half),flight.slice(half)].map(part=>`<script>self.__next_f.push([1,${JSON.stringify(part)}])</script>`).join('')}</body></html>`;
}

test('Old Navy reads every colour, size, fit, stock flag and price from the page flight',()=>{
  const result=extractProduct(gapPage(gapData),'https://oldnavy.gap.com/browse/product.do?pid=866414102');
  assert.equal(result.method,'Old Navy page data');
  assert.equal(result.brand,'Old Navy');
  assert.equal(result.title,'Garment-Dyed Heavyweight Cropped T-Shirt');
  assert.equal(result.price,14.99);
  assert.equal(result.referencePrice,24.99);
  assert.equal(result.currency,'USD');
  assert.equal(result.country,'США');
  assert.equal(result.selectedVariantColor,'Lakeshore');
  assert.equal(result.variantsComplete,true);
  assert.deepEqual(result.images,['https://content.gapinc.com/b/lake-1.png?width=1500','https://content.gapinc.com/b/lake-2.png?width=1500']);
  assert.deepEqual(result.variants.map(v=>[v.id,v.label,v.available,v.price,v.compareAtPrice]),[
    ['8664140320002','BlackJack · M · Regular',true,12.49,24.99],
    ['8664141020001','Lakeshore · S · Regular',false,14.99,24.99],
    ['8664141020002','Lakeshore · M · Regular',true,14.99,24.99],
    ['8664141020101','Lakeshore · L · Tall',true,16.99,26.99],
  ]);
  assert.deepEqual(result.variants[3].options,[{name:'Color',value:'Lakeshore'},{name:'Size',value:'L'},{name:'Fit',value:'Tall'}]);
  assert.equal(result.variants[1].sourceUrl,'https://oldnavy.gap.com/browse/product.do?pid=8664141020001');
  assert.deepEqual(result.colorwayImages.map(g=>g.color),['BlackJack','Lakeshore']);
  assert.ok(!result.variants.some(v=>v.label.includes('Decoy')));
});

test('a Gap Inc. SKU link selects that size; an unknown pid is not swapped for another colour',()=>{
  const bySku=extractProduct(gapPage(gapData),'https://oldnavy.gap.com/browse/product.do?pid=8664141020101');
  assert.equal(bySku.selectedVariantId,'8664141020101');
  assert.equal(bySku.price,16.99);
  assert.equal(bySku.referencePrice,26.99);
  const sibling=extractProduct(gapPage(gapData),'https://oldnavy.gap.com/browse/product.do?pid=866414032');
  assert.equal(sibling.selectedVariantColor,'BlackJack');
  assert.equal(sibling.price,12.49);
  const unknown=extractProduct(gapPage(gapData),'https://oldnavy.gap.com/browse/product.do?pid=999999999');
  assert.notEqual(unknown.method,'Old Navy page data');
  assert.equal(unknown.price,undefined);
});

test('the same reader serves Gap and Banana Republic, and reports a colour sold out in every size',()=>{
  const soldOut=structuredClone(gapData);
  for(const s of soldOut.variants.REGULAR.customer_choices['866414102'].skus)s.inventory_status.status='OUT_OF_STOCK';
  soldOut.variants.TALL.customer_choices['866414102'].skus[0].inventory_status.status='OUT_OF_STOCK';
  const gap=extractProduct(gapPage(soldOut),'https://www.gap.com/browse/product.do?pid=866414102');
  assert.equal(gap.brand,'Gap');
  assert.ok(gap.warnings.some(w=>w.includes('недоступен ни в одном размере')));
  const br=extractProduct(gapPage(gapData),'https://bananarepublic.gap.com/browse/product.do?pid=866414102');
  assert.equal(br.method,'Banana Republic page data');
});

test('Old Navy is fetched as a plain page and imported without the generic fallback',async()=>{
  const result=await fetchProduct('https://oldnavy.gap.com/browse/product.do?pid=866414102',async()=>html(gapPage(gapData)));
  assert.match(result.method,/^Old Navy page data/);
  assert.equal(result.brand,'Old Navy');
  assert.equal(result.variants.length,4);
});

// --- Ulta: Apollo state with CMS modules -------------------------------------------------------------
const ultaVariant=(skuId,name,{selected=false,unavailable=false,listPrice=null}={})=>({productId:'pimprod2046714',skuId,name,selected,disabled:false,unavailable,
  listPrice,salePrice:null,mainImage:{imageUrl:`https://media.ultainc.com/i/ulta/${skuId}`}});
function ultaPage({skuId='2621074',variantLabel='Chocolate Brown',listPrice='$12.00',salePrice=null,variants}={}){
  const hero={moduleName:'ProductHero',modules:[
    {moduleName:'MediaGallery',skuId,items:[{imageUrl:`https://media.ulta.com/i/ulta/${skuId}`,metaData:{isImage:true}},{imageUrl:`https://media.ulta.com/i/ulta/${skuId}_alt1`,metaData:{isImage:true}},{videoUrl:'https://v.example/x.mp4',imageUrl:'https://media.ulta.com/i/ulta/video'}]},
    {moduleName:'ProductInformation',productName:'New Heights Lifting Mascara'},
    {moduleName:'ProductPricing',productId:'pimprod2046714',skuId,productName:'New Heights Lifting Mascara',brandName:'ULTA Beauty Collection',
      variantLabel,variantTypeLabel:'Color',listPrice,salePrice,unavailable:false,image:{imageUrl:`https://media.ultainc.com/i/ulta/${skuId}`}},
    {moduleName:'ProductVariant',variantType:'Color',variants:variants??[
      ultaVariant('2621074','Chocolate Brown',{selected:skuId==='2621074',listPrice:skuId==='2621074'?listPrice:null}),
      ultaVariant('2618503','Jet Black',{selected:skuId==='2618503',unavailable:true})]},
  ]};
  // A recommendation rail with another product's pricing comes after the hero.
  const rail={moduleName:'RecommendationProductRail',modules:[{moduleName:'ProductPricing',productId:'pimprod9999',skuId:'1',productName:'Decoy',listPrice:'$1.00'}]};
  const state={ROOT_QUERY:{'Page({"url":{"path":"/p/new-heights-lifting-mascara-pimprod2046714"}})':{content:{modules:[{moduleName:'MainWrapper',modules:[hero,rail]}]}}}};
  return `<html><head><title>Ulta</title></head><body><script>window.__APOLLO_STATE__ = ${JSON.stringify(state)};</script></body></html>`;
}
const ultaUrl='https://www.ulta.com/p/new-heights-lifting-mascara-pimprod2046714';

test('Ulta reads the selected shade price, every shade with stock, and the gallery from Apollo state',()=>{
  const result=extractProduct(ultaPage(),ultaUrl);
  assert.equal(result.method,'Ulta page data');
  assert.equal(result.title,'New Heights Lifting Mascara');
  assert.equal(result.brand,'ULTA Beauty Collection');
  assert.equal(result.category,'Красота и уход');
  assert.equal(result.price,12);
  assert.equal(result.currency,'USD');
  assert.equal(result.selectedVariantId,'2621074');
  assert.equal(result.selectedVariantColor,'Chocolate Brown');
  assert.deepEqual(result.images,['https://media.ulta.com/i/ulta/2621074','https://media.ulta.com/i/ulta/2621074_alt1']);
  assert.deepEqual(result.variants.map(v=>[v.id,v.color,v.available,v.availabilityKnown,v.price]),[
    ['2621074','Chocolate Brown',true,true,12],
    ['2618503','Jet Black',false,true,undefined],
  ]);
  assert.equal(result.variants[1].sourceUrl,`${ultaUrl}?sku=2618503`);
  assert.ok(result.warnings.some(w=>w.includes('цену только выбранного варианта')));
});

test('an Ulta sale keeps the list price as reference; a ?sku= the page did not select falls back',()=>{
  const sale=extractProduct(ultaPage({listPrice:'$12.00',salePrice:'$8.40'}),ultaUrl);
  assert.equal(sale.price,8.4);
  assert.equal(sale.referencePrice,12);
  const mismatch=extractProduct(ultaPage(),`${ultaUrl}?sku=2618503`);
  assert.notEqual(mismatch.method,'Ulta page data');
  const linked=extractProduct(ultaPage({skuId:'2618503',variantLabel:'Jet Black'}),`${ultaUrl}?sku=2618503`);
  assert.equal(linked.selectedVariantColor,'Jet Black');
  assert.ok(linked.warnings.some(w=>w.includes('Выбранный вариант сейчас недоступен')));
});

test('an Ulta size product names its option and warns that other sizes may cost more',()=>{
  const page=ultaPage({variantLabel:'1.0 oz',variants:[ultaVariant('2621074','1.0 oz',{selected:true,listPrice:'$12.00'}),ultaVariant('2621075','3.4 oz')]})
    .replace('"variantType":"Color"','"variantType":"Size"');
  const result=extractProduct(page,ultaUrl);
  assert.deepEqual(result.variants.map(v=>[v.size,v.options[0].name]),[['1.0 oz','Size'],['3.4 oz','Size']]);
  assert.equal(result.selectedVariantColor,undefined);
  assert.ok(result.warnings.some(w=>w.includes('у других объёмов она может отличаться')));
});

test('Ulta: the other sizes are priced from their own ?sku= pages; a page that does not answer stays unpriced',async()=>{
  const sizes=[ultaVariant('2621074','1.0 oz',{selected:true,listPrice:'$12.00'}),ultaVariant('2621075','3.4 oz'),ultaVariant('2621076','6.7 oz')];
  const sizePage=(skuId,label,price)=>ultaPage({skuId,variantLabel:label,listPrice:price,variants:sizes.map(v=>({...v,selected:v.skuId===skuId,listPrice:v.skuId===skuId?price:null}))}).replace('"variantType":"Color"','"variantType":"Size"');
  const asked=[];
  const fetcher=async input=>{
    const url=new URL(String(input)),sku=url.searchParams.get('sku');
    asked.push(sku);
    if(!sku)return html(sizePage('2621074','1.0 oz','$12.00'));
    if(sku==='2621075')return html(sizePage('2621075','3.4 oz','$29.00'));
    return html('gone',404);
  };
  const result=await fetchProduct(ultaUrl,fetcher);
  assert.equal(result.price,12);
  assert.deepEqual(result.variants.map(v=>[v.size,v.price]),[['1.0 oz',12],['3.4 oz',29],['6.7 oz',undefined]]);
  assert.ok(result.warnings.some(w=>w.includes('цену только выбранного варианта')));
  assert.ok(!asked.includes('2621074'),'the selected size is not asked twice');

  // Every option answered: the warning goes away.
  const all=await fetchProduct(ultaUrl,async input=>{
    const sku=new URL(String(input)).searchParams.get('sku');
    return html(sku?sizePage(sku,sku==='2621075'?'3.4 oz':'6.7 oz',sku==='2621075'?'$29.00':'$45.00'):sizePage('2621074','1.0 oz','$12.00'));
  });
  assert.deepEqual(all.variants.map(v=>v.price),[12,29,45]);
  assert.ok(!all.warnings.some(w=>w.includes('цену только выбранного варианта')));
});
