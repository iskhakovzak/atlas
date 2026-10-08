import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchEbayProduct,clearEbayTokenCacheForTests} from '../lib/importer/ebay.ts';
import {ebayVariantSourceUrl,variantsForSourceColor} from '../lib/importer/link-selection.ts';
import {adidasMenSize} from '../lib/market/adidas-size-chart.ts';

test('eBay colour galleries use each exact child image, including thumbnail fields',async()=>{
 clearEbayTokenCacheForTests();
 const id='157751149633';const make=(child,color,size)=>({itemId:`v1|${id}|${child}`,title:'adidas men shoes',brand:'adidas',price:{value:'25',currency:'USD'},buyingOptions:['FIXED_PRICE'],estimatedAvailabilities:[{estimatedAvailabilityStatus:'IN_STOCK'}],color,localizedAspects:[{name:'Color',value:color},{name:'US Shoe Size',value:size}],thumbnailImages:[{imageUrl:`https://i.ebayimg.com/images/g/${color}/s-l500.jpg`}],primaryItemGroup:{itemGroupId:id,itemGroupType:'SELLER_DEFINED_VARIATIONS'}});
 const items=[make('9001','Red','8'),make('9002','Red','9'),make('9003','White','8')];
 const fetcher=async input=>new Response(JSON.stringify(String(input).includes('oauth2')?{access_token:'test',expires_in:3600}:String(input).includes('get_items_by_item_group')?{items}:items[0]),{headers:{'content-type':'application/json'}});
 const data=await fetchEbayProduct(`https://www.ebay.com/itm/${id}?var=9001`,{clientId:'test',clientSecret:'test',environment:'production'},fetcher);
 assert.equal(data.colorwayImages.length,2);
 assert.ok(data.colorwayImages.find(v=>v.color==='Red').images.every(url=>url.includes('/Red/')));
 assert.ok(data.colorwayImages.find(v=>v.color==='White').images.every(url=>url.includes('/White/')));
 assert.equal(variantsForSourceColor(data.colorwayImages,'Red',data.sourceUrl).length,2);
 assert.ok(data.variants.find(v=>v.id==='9003').image.includes('/White/'));
});
test('chosen eBay child rewrites its var while preserving affiliate attribution',()=>{
 const url=new URL(ebayVariantSourceUrl('https://www.ebay.com/itm/157751149633?var=9001&campid=123','9003'));
 assert.equal(url.searchParams.get('var'),'9003');assert.equal(url.searchParams.get('campid'),'123');
 assert.equal(ebayVariantSourceUrl('https://ebay.com.attacker.test/itm/157751149633?var=9001','9003'),'https://ebay.com.attacker.test/itm/157751149633?var=9001');
});
test('official adidas image CDN is accepted without accepting lookalike hosts',async()=>{
 clearEbayTokenCacheForTests();
 const item={itemId:'v1|157751149633|9001',title:'adidas men shoes',price:{value:'25',currency:'USD'},buyingOptions:['FIXED_PRICE'],image:{imageUrl:'https://assets.adidas.com/images/official.jpg'},additionalImages:[{imageUrl:'https://assets.adidas.com.attacker.test/wrong.jpg'},{imageUrl:'https://user:password@assets.adidas.com/wrong.jpg'}]};
 const fetcher=async input=>new Response(JSON.stringify(String(input).includes('oauth2')?{access_token:'test',expires_in:3600}:item),{headers:{'content-type':'application/json'}});
 const result=await fetchEbayProduct('https://www.ebay.com/itm/157751149633?var=9001',{clientId:'test',clientSecret:'test',environment:'production'},fetcher);
 assert.deepEqual(result.images,['https://assets.adidas.com/images/official.jpg']);
});
test('adidas size formats preserve exact US size and do not apply another brand or gender chart',()=>{
 assert.deepEqual(adidasMenSize('adidas','adidas men VL Court 3.0 Shoes','11'),{us:'11',uk:'10.5',eu:'45 1/3',cm:'28.0'});
 assert.equal(adidasMenSize('Nike','Nike men shoes','11'),undefined);
 assert.equal(adidasMenSize('adidas','adidas women shoes','11'),undefined);
 assert.equal(adidasMenSize('adidas','adidas men shoes','EU 45'),undefined);
});
import {importDraft} from '../lib/market/catalog-editor.ts';
test('dependent US/UK sizes keep one selectable matrix and persist colour galleries in admin',async()=>{
 clearEbayTokenCacheForTests();
 const id='157751149633';const make=(child,us,uk)=>({itemId:`v1|${id}|${child}`,title:'adidas men shoes',brand:'adidas',price:{value:'25',currency:'USD'},buyingOptions:['FIXED_PRICE'],estimatedAvailabilities:[{estimatedAvailabilityStatus:'IN_STOCK',estimatedAvailableQuantity:2}],image:{imageUrl:`https://assets.adidas.com/${child}.jpg`},localizedAspects:[{name:'Color',value:'Red'},{name:'US Shoe Size',value:us},{name:'UK Shoe Size',value:uk}],primaryItemGroup:{itemGroupId:id,itemGroupType:'SELLER_DEFINED_VARIATIONS'}});
 const items=[make('9001','11','10.5'),make('9002','12','11.5')];
 const fetcher=async input=>new Response(JSON.stringify(String(input).includes('oauth2')?{access_token:'test',expires_in:3600}:String(input).includes('get_items_by_item_group')?{items}:items[0]),{headers:{'content-type':'application/json'}});
 const data=await fetchEbayProduct(`https://www.ebay.com/itm/${id}?var=9001`,{clientId:'test',clientSecret:'test',environment:'production'},fetcher);
 assert.deepEqual(data.variants.map(v=>v.size),['11','12']);
 assert.deepEqual(data.variants[0].sizeAlternates,[{system:'US',value:'11'},{system:'UK',value:'10.5'}]);
 const draft=importDraft(data,[],'США');assert.deepEqual(draft.colorwayImages,data.colorwayImages);assert.equal(draft.variants[0].quantity,2);assert.deepEqual(draft.variants[0].sizeAlternates,data.variants[0].sizeAlternates);
});
import {variantDisplayPrices} from '../lib/importer/link-selection.ts';
test('browsed colour and exact size price do not inherit another colour price',()=>{
 const options=[{color:'Red',size:'11',price:25,available:true},{color:'Grey',size:'7',price:24,available:true},{color:'Cargo',size:'11',price:32,available:true},{color:'Cargo',size:'12',price:33,available:true},{color:'White',size:'11',price:34,available:true},{color:'Grey',size:'8',price:1,available:false}];
 assert.deepEqual(variantDisplayPrices(options,'Grey'),[24]);assert.deepEqual(variantDisplayPrices(options,'Cargo'),[32,33]);assert.deepEqual(variantDisplayPrices(options,'Cargo','11'),[32]);assert.deepEqual(variantDisplayPrices(options,'White','11'),[34]);
});
