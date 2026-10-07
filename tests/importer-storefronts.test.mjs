import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractProduct} from '../lib/importer/extract.ts';
import {fetchProduct, fetchCollectionLinks, allowedUrl, ManualEntryFallbackError} from '../lib/importer/fetch.ts';
import {isMerchantChallengePage} from '../lib/importer/challenge.ts';
import {isMerchantProductUrl, sameMerchantRedirect, sourceProductIds} from '../lib/importer/source-identity.ts';
import {linkImportStorefronts, isSupportedStoreHost} from '../lib/importer/stores.ts';
import {applyMerchantProfile, merchantProfileForUrl} from '../lib/importer/merchant-profiles.ts';
import {publicJsonStates} from '../lib/importer/public-state.ts';
import {extractShopify} from '../lib/importer/shopify.ts';
import {importDraft, catalogIssues} from '../lib/market/catalog-editor.ts';
import {variantsForSourceColor} from '../lib/importer/link-selection.ts';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/importer/${name}.json`, import.meta.url), 'utf8'));
const ld = data => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
const state = data => `<script type="application/json" id="__NEXT_DATA__">${JSON.stringify(data)}</script>`;
const product = (sourceUrl, price=24.5) => ({url:sourceUrl, name:'Cotton Shirt', price, currency:'USD', image:'https://cdn.example.net/shirt.jpg', variants:[
  {id:'shirt-M', size:'M', color:'Navy', price, available:true}, {id:'shirt-L', size:'L', color:'Navy', price:29.5, available:false},
]});

test('ShopSimon HTML fallback retains all published secure Open Graph photos without upgrading unsafe URLs', () => {
  const source='https://shop.simon.com/products/nvlt-women-s-embroidered-trim-top';
  const html='<meta property="og:title" content="NVLT Top"><meta property="product:price:amount" content="23"><meta property="product:price:currency" content="USD">'
    +[1,2,3].map(n=>`<meta property="og:image" content="http://shop.simon.com/cdn/shop/files/top-${n}.jpg"><meta content="https://shop.simon.com/cdn/shop/files/top-${n}.jpg" property="og:image:secure_url">`).join('')
    +'<meta property="og:image:secure_url" content="https://127.0.0.1/private.jpg"><meta property="og:image:secure_url" content="http://example.com/insecure.jpg">';
  const result=extractProduct(html,source);
  assert.equal(result.price,23);assert.equal(result.currency,'USD');
  assert.equal(result.image,'https://shop.simon.com/cdn/shop/files/top-1.jpg');
  assert.deepEqual(result.images,[1,2,3].map(n=>`https://shop.simon.com/cdn/shop/files/top-${n}.jpg`));
});

test('ShopSimon native HTML product JSON preserves size stock and individual cents prices when Ajax is blocked', () => {
  const f=fixture('shopsimon-public-product');
  const html=`<script>Shopify.currency=${JSON.stringify(f.currency)};window.productObject=${JSON.stringify(f.product)};globalThis.atlasShopifyExecuted=true;</script>`;
  const result=extractProduct(html,f.sourceUrl);
  assert.equal(result.method,'Shopify public product JSON');assert.equal(result.currency,'USD');
  assert.equal(result.price,undefined);assert.equal(result.variants.length,6);
  assert.ok(result.variants.every(v=>!v.available&&v.availabilityKnown));assert.equal(result.images.length,5);
  assert.equal(result.variants[0].price,f.product.variants[0].price/100);
  assert.equal(globalThis.atlasShopifyExecuted,undefined);
  const chosen=extractProduct(html,`${f.sourceUrl}?variant=${f.product.variants[0].id}`);
  assert.equal(chosen.price,f.product.variants[0].price/100);
  assert.notEqual(extractProduct(html,f.sourceUrl.replace('mens-adidas-advantage-shoes','unrelated-product')).method,'Shopify public product JSON');
  assert.notEqual(extractProduct(html.replace('"active":"USD"','"active":"bad"'),f.sourceUrl).method,'Shopify public product JSON');
});

test('Vans exact parent offer and gallery complement its separately published size group', () => {
  const f=fixture('vans-public-group');
  const result=applyMerchantProfile(extractProduct(ld({'@graph':f.products}),f.sourceUrl),f.sourceUrl);
  assert.equal(result.price,55);assert.equal(result.currency,'USD');assert.equal(result.brand,'Vans');
  assert.equal(result.variants.length,8);assert.ok(result.variants.some(v=>v.size==='7'&&v.available&&v.availabilityKnown));
  assert.ok(result.images.length>=4);
  const changed=structuredClone(f.products);changed[1].url=changed[1]['@id']='https://www.vans.com/en-us/p/another-shoe-VN999OTHER';
  assert.equal(extractProduct(ld({'@graph':changed}),f.sourceUrl).price,undefined);
  const selected=extractProduct(ld({'@graph':f.products}),`${f.sourceUrl}?size=7.0%20Kids`);
  assert.equal(selected.price,55);assert.equal(selected.currency,'USD');
});

test('unselected JSON-LD size ranges do not quote the first size and uniform exact offers remain compatible', () => {
  const source='https://www.gymshark.com/products/shorts';
  const child=price=>({'@type':'Product',size:String(price),offers:{url:source,price,priceCurrency:'USD'}});
  assert.equal(extractProduct(ld({'@type':'ProductGroup',url:source,name:'Shorts',hasVariant:[child(32),child(34)]}),source).price,undefined);
  assert.equal(extractProduct(ld({'@type':'ProductGroup',url:source,name:'Shorts',hasVariant:[child(32),child(32)]}),source).price,32);
});

test('missing or ambiguous explicit JSON-LD option never substitutes an equal-price size', () => {
  const source='https://www.gymshark.com/products/shorts';
  const child=(id,size)=>({'@type':'Product',url:`${source}?variant=${id}`,sku:id,color:'Blue',size,name:`Shorts ${size}`,offers:{url:`${source}?variant=${id}`,price:32,priceCurrency:'USD'}});
  for (const hasVariant of [[child('small','S'),child('large','L')],[child('small','S')]]) {
    const markup=ld({'@type':'ProductGroup',url:source,name:'Shorts',hasVariant})+'<meta property="product:price:amount" content="32"><meta property="product:price:currency" content="USD">';
    assert.equal(extractProduct(markup,`${source}?variant=small`).sku,'small');
    for (const query of ['?variant=removed','?variant=','?variant=small&variant=large']) {
      const result=extractProduct(markup,source+query);
      assert.equal(result.price,undefined);assert.equal(result.sku,undefined);assert.equal(result.selectedVariantColor,undefined);
      assert.ok(result.variants.every(v=>v.price===undefined));assert.equal(result.currency,'USD');
      assert.ok(result.warnings.some(w=>/Вариант из ссылки не найден/.test(w)));
    }
  }
});

test('a group selected only through its exact child cannot quote an unrelated parent offer', () => {
  const source='https://www.gymshark.com/products/shorts';
  const children=[32,34].map((price,index)=>({'@type':'Product',url:source,sku:`size-${index}`,size:String(index),name:'Actual Shorts',offers:{url:source,price,priceCurrency:'USD'}}));
  const result=extractProduct(ld({'@type':'ProductGroup',url:'https://www.gymshark.com/products/other',offers:{url:'https://www.gymshark.com/products/other',price:99,priceCurrency:'USD'},hasVariant:children}),source);
  assert.equal(result.price,undefined);assert.equal(result.sku,undefined);assert.equal(result.currency,'USD');
  assert.deepEqual(result.variants.map(v=>v.price),[32,34]);
});

test('a malformed merchant child variant query never selects a size and unselected groups keep parent identity', () => {
  const source='https://www.gymshark.com/products/shorts';
  const child={'@type':'Product',url:`${source}?variant=1&variant=2`,sku:'size-S',size:'S',offers:{url:`${source}?variant=1&variant=2`,price:32,priceCurrency:'USD'}};
  const result=extractProduct(ld({'@type':'ProductGroup',url:source,name:'Shorts',hasVariant:[child]}),source+'?variant=1');
  assert.equal(result.price,undefined);assert.equal(result.sku,undefined);assert.ok(result.variants.every(v=>v.price===undefined));
  const group={'@type':'ProductGroup',url:source,name:'Shorts',hasVariant:[{...child,url:source,offers:{price:32,priceCurrency:'USD'}},{...child,url:source,sku:'size-L',size:'L',offers:{price:32,priceCurrency:'USD'}}]};
  const unselected=extractProduct(ld(group),source);
  assert.equal(unselected.price,32);assert.equal(unselected.sku,undefined);
});

test('missing or ambiguous Shopify option never uses its uniform parent quote', () => {
  const source='https://shop.simon.com/products/shirt';
  const product={handle:'shirt',title:'Shirt',options:['Size'],variants:[{id:1,title:'S',option1:'S',price:3200,available:true},{id:2,title:'L',option1:'L',price:3200,available:true}]};
  assert.equal(extractShopify(product,{currency:'USD'},source).price,32);
  assert.equal(extractShopify(product,{currency:'USD'},source+'?variant=1').price,32);
  for(const query of ['?variant=removed','?variant=','?variant=1&variant=2']) {
    const result=extractShopify(product,{currency:'USD'},source+query);
    assert.equal(result.price,undefined);assert.ok(result.variants.every(v=>v.price===undefined));
    assert.ok(result.warnings.some(w=>/Вариант из ссылки не найден/.test(w)));
  }
});

test('a missing or ambiguous Zara URL colour never substitutes another colour price or gallery', () => {
  const source='https://www.zara.com/ro/en/jacket-p04416276.html';
  const config={formatterConfig:{currency:'RON',currencyDecimals:-2},storeCountryCode:'ro'};
  const payload={product:{name:'Leather Jacket',detail:{colors:[{name:'Ochre',productId:549815761,price:105900,xmedia:[{url:'https://static.zara.net/ochre.jpg'}],sizes:[{name:'S',price:105900,availability:'in_stock'}]}]}}};
  const html=`<meta property="product:price:amount" content="1"><meta property="product:price:currency" content="USD"><meta property="og:image" content="https://static.zara.net/unrelated.jpg"><script>window.zara.appConfig=${JSON.stringify(config)};window.zara.viewPayload=${JSON.stringify(payload)};</script>`;
  const good=extractProduct(html,`${source}?v1=549815761`);
  assert.equal(good.price,1059);assert.equal(good.currency,'RON');assert.equal(good.selectedVariantColor,'Ochre');
  for(const query of ['?v1=999999999','?v1=bad','?v1=549815761&v1=999999999']) {
    const result=extractProduct(html,source+query);
    assert.equal(result.price,undefined);assert.equal(result.currency,'RON');assert.deepEqual(result.variants,[]);assert.deepEqual(result.images,[]);
    assert.equal(result.selectedVariantColor,undefined);assert.ok(result.warnings.some(warning=>/Цвет из ссылки Zara не найден/.test(warning)));
  }
});

test('all requested 33 storefronts have an exact approved host and importer profile', () => {
  assert.equal(linkImportStorefronts.length, 33);
  for (const store of linkImportStorefronts) {
    assert.equal(allowedUrl(store.url).href,new URL(store.url).href,store.name);
    assert.ok(merchantProfileForUrl(store.url),store.name);
  }
  for (const host of ['carters.com','www.carters.com','usa.tommy.com','www.ralphlauren.com','www.thenorthface.com','us.puma.com','www2.hm.com']) assert.equal(isSupportedStoreHost(host),true,host);
  for (const host of ['evil.carters.com','ca.tommy.com','us.puma.com.evil.example','www.usa.tommy.com','thenorthface.com.evil.example']) assert.equal(isSupportedStoreHost(host),false,host);
});

test('33 storefront contracts retain per-option price, currency, photos and stock in admin drafts and customer selections', () => {
  for (const [index,store] of linkImportStorefronts.entries()) {
    const source = `${store.url}/product/ATLAS${10000+index}`;
    const currency = store.name === 'Zara Spain' || store.name === 'Zalando' ? 'EUR' : 'USD';
    const record = {...product(source),currency};
    const result = applyMerchantProfile(extractProduct(state({product:record,recommendation:product(`${store.url}/product/OTHER99999`,1)}),source),source);
    assert.equal(result.title,'Cotton Shirt',store.name);
    assert.equal(result.currency,currency,store.name);
    assert.equal(result.price,24.5,store.name);
    assert.equal(result.image,record.image,store.name);
    assert.deepEqual(result.variants.map(v=>[v.size,v.price,v.available,v.availabilityKnown]),[['M',24.5,true,true],['L',29.5,false,true]],store.name);
    const draft=importDraft(result,[],result.country??'',1000);
    assert.equal(draft.sourceShippingUsd,10,store.name);
    assert.equal(draft.sourceShippingEstimated,true,store.name);
    assert.deepEqual(draft.variants.map(v=>[v.id,v.price,v.available]),result.variants.map(v=>[v.id,v.price,v.available]),store.name);
    assert.deepEqual(variantsForSourceColor(result.variants,'Navy'),result.variants,store.name);
  }
});

test('public JSON scripts and state assignments parse without evaluating merchant code', () => {
  globalThis.atlasMerchantExecuted=false;
  const text=`<script>window.__INITIAL_STATE__=${JSON.stringify({product:{name:'A } brace',price:10}})};globalThis.atlasMerchantExecuted=true</script>`;
  assert.equal(publicJsonStates(text)[0].product.name,'A } brace');
  assert.equal(globalThis.atlasMerchantExecuted,false);
  assert.deepEqual(publicJsonStates('<script>window.__INITIAL_STATE__=JSON.parse("{}");</script>'),[]);
  assert.equal(publicJsonStates(`<script type="application/json">${' '.repeat(2_500_001)}</script>`).length,0);
  assert.equal(publicJsonStates(Array.from({length:100},()=>'<script type="application/json">{}</script>').join('')).length,32);
  assert.deepEqual(publicJsonStates('window.__INITIAL_STATE__={broken};'.repeat(32)+'window.__INITIAL_STATE__={"valid":true};'),[]);
  delete globalThis.atlasMerchantExecuted;
});

test('New York Gap offers retain exact colour, native sizes and size-specific prices without a range guess', () => {
  const f=fixture('gap-offers'),result=extractProduct(ld(f.product)+f.optionsHtml,f.sourceUrl);
  assert.equal(result.price,15);assert.equal(result.currency,'USD');assert.equal(result.selectedVariantColor,'True black');
  assert.deepEqual(result.variants.map(v=>v.size),['XS','S','M','L','XL','XXL','XXXL']);
  assert.ok(result.variants.every(v=>v.price===15&&v.available&&v.availabilityKnown));
  const changed=structuredClone(f.product);changed.offers[1].price='20.00';
  assert.equal(extractProduct(ld(changed)+f.optionsHtml,f.sourceUrl).price,undefined);
  const selected=extractProduct(ld(changed)+f.optionsHtml,f.sourceUrl.replace('440775022',changed.offers[1].sku));
  assert.equal(selected.price,20);assert.ok(selected.variants.every(v=>v.price===undefined));
  assert.equal(extractProduct(ld(f.product)+f.optionsHtml,f.sourceUrl.replace('440775022','OTHER99999')).price,undefined);
  changed.offers[1].priceCurrency='EUR';
  assert.equal(extractProduct(ld(changed)+f.optionsHtml,f.sourceUrl).price,undefined);
});

test('New York Target no-price response retains exact title/gallery/options as a manual draft without inventing price or stock', async () => {
  const f=fixture('target-no-price'),html=state(f.state),result=extractProduct(html,f.sourceUrl);
  assert.ok(result.title.includes("Hanes Premium Men's"));
  assert.equal(result.price,undefined);assert.equal(result.currency,undefined);
  assert.equal(result.images.length,4);assert.equal(result.variants.length,5);
  assert.ok(result.variants.every(v=>v.price===undefined&&v.availabilityKnown===false));
  assert.equal(extractProduct(html,f.sourceUrl.replace('89003153','99999999')).variants.length,0);
  await assert.rejects(fetchProduct(f.sourceUrl,async()=>new Response(html,{headers:{'content-type':'text/html'}})),error=>error instanceof ManualEntryFallbackError&&error.reason==='incomplete'&&error.partial.images.length===4);
});

test('captured UNIQLO PDP preserves the URL colour and its gallery without inventing size stock', () => {
  const captured=fixture('uniqlo-state');
  const html=`<script>window.__PRELOADED_STATE__=${JSON.stringify(captured.state)};</script>`;
  const result=extractProduct(html,captured.sourceUrl);
  assert.equal(result.title,'AIRism Cotton T-Shirt');
  assert.equal(result.price,14.9);
  assert.equal(result.currency,'USD');
  assert.equal(result.selectedVariantColor,'WHITE');
  assert.equal(result.selectedVariantId,'00-004');
  assert.match(result.image,/goods_00_474244/);
  assert.equal(result.variants.length,35);
  assert.ok(result.variants.every(v=>v.availabilityKnown===false));
  assert.ok(variantsForSourceColor(result.variants,'WHITE').every(v=>v.image.includes('goods_00_474244')));
  assert.equal(extractProduct(html,captured.sourceUrl.replace('colorDisplayCode=00','colorDisplayCode=99')).price,undefined);
  const missingSize=extractProduct(html,captured.sourceUrl.replace('sizeDisplayCode=004','sizeDisplayCode=999'));
  assert.equal(missingSize.price,undefined);assert.equal(missingSize.selectedVariantId,undefined);assert.ok(missingSize.variants.every(v=>v.price===undefined));
  assert.equal(extractProduct(html,captured.sourceUrl.replace('E474244','E999999')).price,undefined);
  assert.equal(extractProduct(html,captured.sourceUrl.replace('/us/en/','/ca/en/')).price,undefined);
});

test('captured Converse native microdata scopes price, selected colour, photos and sizes to its article', () => {
  const captured=fixture('converse-native');
  const result=extractProduct(captured.html,captured.sourceUrl);
  assert.equal(result.title,'Chuck Taylor All Star Classic');
  assert.equal(result.price,60);
  assert.equal(result.currency,'USD');
  assert.equal(result.selectedVariantColor,'Black Monochrome');
  assert.equal(result.variants.length,23);
  assert.ok(result.variants.every(v=>v.availabilityKnown===true));
  assert.ok(result.variants[0].size.startsWith("Men's 3 / Women's 5"));
  assert.ok(result.images.length>=7);
  assert.match(result.image,/sw=964/);
  assert.equal(extractProduct(captured.html,captured.sourceUrl.replace('M5039.html','OTHER9999.html')).price,undefined);
  const outside=captured.html.replace(/<meta itemprop="price"[^>]*>/g,'')+'<div itemscope itemtype="http://schema.org/Product"><meta itemprop="price" content="1"></div>';
  assert.equal(extractProduct(outside,captured.sourceUrl).price,undefined);
  const blocked=captured.html.replace('class=""\n','class="unselectable" disabled\n');
  assert.equal(extractProduct(blocked,captured.sourceUrl).variants[0].available,false);
});

test('nested Walmart, Target and SFCC prices retain exact item identity and currency', () => {
  const cases=[
    ['https://www.walmart.com/ip/shirt/123456789',{id:'123456789',name:'Cotton Shirt',priceInfo:{currentPrice:{price:19.99,currencyUnit:'USD'}},imageInfo:{allImages:[{url:'https://i5.walmartimages.com/shirt.jpg'}]}}],
    ['https://www.target.com/p/shirt/-/A-12345678',{tcin:'12345678',item:{product_description:{title:'Cotton Shirt'},enrichment:{images:{primary_image_url:'https://target.scene7.com/shirt.jpg'}}},price:{current_retail:19.99,currency_code:'USD'}}],
    ['https://www.newbalance.com/pd/shoe/MR530.html',{id:'MR530',productName:'Cotton Shirt',price:{sales:{value:19.99,currency:'USD'}},images:['https://nb.scene7.com/shirt.jpg'],variants:[{id:'MR530-M',variationValues:{size:'M',color:'Navy'},orderable:true}]}],
  ];
  for (const [url,record] of cases) {
    const result=extractProduct(state({product:record}),url);
    assert.equal(result.title,'Cotton Shirt');assert.equal(result.price,19.99);assert.equal(result.currency,'USD');assert.ok(result.image);
  }
});

test('query/tracking/category words and unrelated offers cannot masquerade as a product id', () => {
  for(const source of ['https://www.walmart.com/ip/shoes/123456789?utm_source=999999999','https://www.target.com/p/item/-/A-12345678?offer=999999999']) {
    const result=extractProduct(state({recommendation:{...product(undefined,1),id:'999999999'}}),source);
    assert.equal(result.price,undefined);assert.equal(result.title,undefined);
  }
});

test('embedded price uses the requested sku and never a range minimum or another currency', () => {
  const source='https://www.sephora.com/product/fragrance-P123456?skuId=sku-large';
  const record={...product(source),price:undefined,variants:[
    {skuId:'sku-small',size:'30 ml',price:50,currency:'USD',available:true},
    {skuId:'sku-large',size:'100 ml',price:100,currency:'USD',available:true},
    {skuId:'foreign',size:'200 ml',price:1,currency:'EUR',available:true},
  ]};
  const selected=extractProduct(state({product:record}),source);
  assert.equal(selected.price,100);assert.equal(selected.variants.length,2);
  const noSelection=extractProduct(state({product:{...record,url:source.split('?')[0]}}),source.split('?')[0]);
  assert.equal(noSelection.price,undefined);assert.deepEqual(noSelection.variants.map(v=>v.price),[50,100]);
  const range=extractProduct(state({product:{...product(source),price:{min:10,max:20},variants:[]}}),source);
  assert.equal(range.price,undefined);
});

test('captured Tommy page imports the current colour and six native sizes', () => {
  const f=fixture('tommy-native'),result=extractProduct(ld(f.product)+f.optionsHtml,f.sourceUrl);
  assert.equal(result.price,53.7);assert.equal(result.currency,'USD');assert.equal(result.selectedVariantColor,'Copenhagen Blue');
  assert.deepEqual(result.variants.map(v=>v.size),['XS','S','M','L','XL','XXL']);
  assert.ok(result.variants.every(v=>v.color==='Copenhagen Blue'&&v.availabilityKnown===true));
  const wrong=f.optionsHtml.replaceAll('78JB396-C39','OTHER9999');
  assert.equal(extractProduct(ld(f.product)+wrong,f.sourceUrl).variants.length,0);
});

test('captured Ralph Lauren native fields retain US price and the current colour sizes', () => {
  const f=fixture('ralph-native'),markup=`<meta property="og:image" content="${f.image}">`+f.optionsHtml;
  const result=extractProduct(markup,f.sourceUrl);
  assert.equal(result.price,118);assert.equal(result.currency,'USD');assert.equal(result.selectedVariantColor,'Polo Black');
  assert.deepEqual(result.variants.map(v=>v.size),['XS','S','M','L','XL','XXL']);
  const wrongColor=extractProduct(markup,f.sourceUrl+'?dwvar_401482_colorname=Blue');
  assert.equal(wrongColor.price,undefined);assert.deepEqual(wrongColor.variants,[]);
  assert.equal(extractProduct(markup.replaceAll('401482','999999'),f.sourceUrl).price,undefined);
});

test('captured North Face canonical category alias retains price without an empty group shadowing the product', () => {
  const f=fixture('northface-canonical'),result=extractProduct(ld(f.products),f.sourceUrl);
  assert.equal(result.price,190);assert.equal(result.currency,'USD');assert.ok(result.image.startsWith('https://assets.thenorthface.com/'));
  assert.deepEqual(result.variants,[]);
  assert.equal(extractProduct(ld(f.products),f.sourceUrl.replace('NF0A8BND','NF0OTHER')).price,undefined);
  assert.equal(extractProduct(ld(f.products),f.sourceUrl.replace('en-us','en-gb')).price,undefined);
  assert.equal(extractProduct(ld(f.products),f.sourceUrl+'?color=JK3').price,undefined);
});

test('New York North Face ProductGroup keeps exact colour sizes, stock and four object-shaped photos', () => {
  const f=fixture('northface-sizes'),markup=ld(f.products),result=extractProduct(markup,f.sourceUrl);
  assert.equal(result.price,150);assert.equal(result.currency,'USD');
  assert.equal(result.selectedVariantColor,'Endless Dusk/Grounded Plum');
  assert.equal(result.images.length,4);assert.equal(result.variants.length,7);
  assert.equal(result.variants.find(v=>v.size==='3XL').available,false);
  assert.ok(result.variants.every(v=>v.availabilityKnown===true&&v.price===150));
  assert.equal(extractProduct(markup,f.sourceUrl+'&size=M').price,150);
  assert.equal(extractProduct(markup,f.sourceUrl+'&size=4XL').price,undefined);
  assert.equal(extractProduct(markup,f.sourceUrl.replace('color=S1B','color=JK3')).price,undefined);
  assert.equal(extractProduct(markup,f.sourceUrl.replace('NF0A8EUZ','NF0OTHER')).price,undefined);
  assert.ok(!result.warnings.some(warning=>warning.startsWith('Цена не найдена:')));
});

test('captured PUMA urql state keeps selected swatch, its own price/photo and unverified sizes', () => {
  const f=fixture('puma-urql'),publicState=state({props:{urqlState:{fixture:{data:JSON.stringify({product:f.product})}}}});
  const markup=ld({...f.schema,offers:{...f.schema.offers,url:f.sourceUrl}})+publicState;
  const result=extractProduct(markup,f.sourceUrl);
  assert.equal(result.price,90);assert.equal(result.currency,'USD');assert.equal(result.selectedVariantColor,'Cast Iron-PUMA White');
  assert.ok(result.image.includes('/399781/06/'));assert.equal(result.variants.length,2);
  assert.ok(result.variants.every(v=>v.availabilityKnown===false&&!v.size));
  assert.ok(catalogIssues(importDraft(result,[],'США',1000),1001).length>0);
  const missingUrl=f.sourceUrl.replace('swatch=06','swatch=18');
  const missing=extractProduct(ld({...f.schema,offers:{...f.schema.offers,url:missingUrl}})+publicState,missingUrl);
  assert.equal(missing.price,undefined);assert.deepEqual(missing.variants,[]);
});

test('shared fetch blocks cross-merchant/regional redirects before a second request', async () => {
  for(const target of ['https://www.amazon.com/dp/B000000000','https://www.nike.com/es/t/shoe/DM4044-108']) {
    let calls=0;
    await assert.rejects(fetchProduct('https://www.nike.com/us/t/shoe/DM4044-108',async()=>{calls++;return new Response('',{status:302,headers:{location:target}});}),error=>error instanceof ManualEntryFallbackError&&error.reason==='redirect');
    assert.equal(calls,1);
  }
  for (const [from,to] of [['https://www.puma.com/','https://us.puma.com/us/en'],['https://www.tommy.com/','https://usa.tommy.com/'],['https://satechi.net/products/example','https://satechi.com/products/example']]) assert.equal(sameMerchantRedirect(new URL(from),new URL(to)),true);
  assert.equal(sameMerchantRedirect(new URL('https://www.tommy.com/gb/en'),new URL('https://usa.tommy.com/')),false);
  assert.equal(sameMerchantRedirect(new URL('https://www.puma.com/de/en'),new URL('https://us.puma.com/us/en')),false);
  assert.deepEqual([...sourceProductIds('https://www.gap.com/browse/product.do?pid=440775022&utm_source=OTHER99999')],['440775022']);
});

test('blocked, malformed, oversized and not-found pages retain distinct outcomes', async () => {
  const source='https://www.carters.com/p/item/V_1S739110';
  for(const status of [403,429,503]) await assert.rejects(fetchProduct(source,async()=>new Response('',{status})),error=>error instanceof ManualEntryFallbackError);
  for(const status of [404,410]) await assert.rejects(fetchProduct(source,async()=>new Response('',{status})),error=>!(error instanceof ManualEntryFallbackError));
  await assert.rejects(fetchProduct(source,async()=>new Response('x'.repeat(3_000_001),{headers:{'content-type':'text/html'}})),error=>error instanceof ManualEntryFallbackError&&error.reason==='response');
  await assert.rejects(fetchProduct(source,async()=>new Response('<html>Nothing here</html>',{headers:{'content-type':'text/html'}})),error=>error instanceof ManualEntryFallbackError&&error.reason==='incomplete');
});

test('a merchant challenge stays blocked while a CAPTCHA library on a valid product does not break import', async () => {
  assert.equal(isMerchantChallengePage('<title>Robot Check</title>'),true);
  assert.equal(isMerchantChallengePage('<form action="/errors/validateCaptcha"></form>'),true);
  assert.equal(isMerchantChallengePage('<h1>Verify you are human</h1>'),true);
  assert.equal(isMerchantChallengePage('<meta http-equiv="refresh" content="5; URL=/product?bm-verify=challenge"><iframe src="/interstitial/ic.html"></iframe>'),true);
  const url='https://www.carters.com/p/item/V_1S739110';
  const page='<script src="https://example.net/recaptcha.js"></script><script>const message="verify you are human";</script>'+state({product:product(url)});
  assert.equal(isMerchantChallengePage(page),false);
  assert.equal((await fetchProduct(url,async()=>new Response(page,{headers:{'content-type':'text/html'}}))).price,24.5);
});

test('operator collection import recognizes native product routes and skips categories, templates and foreign hosts', async () => {
  for(const url of ['https://www.hm.com/en_us/productpage.1261215001.html','https://www.gap.com/browse/product.do?pid=123456789',
    'https://www.uniqlo.com/us/en/products/E474244-000/00','https://www.nike.com/t/shoe/DM4044-108','https://www.adidas.com/us/shoe/IF4492.html']) assert.equal(isMerchantProductUrl(new URL(url)),true,url);
  assert.equal(isMerchantProductUrl(new URL('https://www.hm.com/en_us/men/shirts.html')),false);
  assert.equal(isMerchantProductUrl(new URL('https://www.skechers.com/store-locator.html')),false);
  const page='<a href="/products/${product.handle}">Template</a><a href="https://evil.example/products/other">Wrong</a><a href="/products/real?variant=123&utm_source=mail">Product</a>';
  assert.deepEqual(await fetchCollectionLinks('https://shop.simon.com',async()=>new Response(page,{headers:{'content-type':'text/html'}})),['https://shop.simon.com/products/real?variant=123']);
});
