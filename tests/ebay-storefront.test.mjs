import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEbayStorefrontUrl,fetchEbayStorefrontSalePage} from '../lib/importer/ebay-storefront.ts';
import {clearEbayTokenCacheForTests,fetchEbaySellerSearchPage} from '../lib/importer/ebay.ts';
import {isFixedEbayApiRequest,createEbayAwareMerchantFetch} from '../lib/importer/ebay-transport.ts';

const source='https://www.ebay.com/str/adidas/Athletic-Shoes/_i.html?_sacat=15709&_sop=15&_tab=shop';
const config={clientId:'storefront-app',clientSecret:'secret',environment:'production'};
const summary=(id='123456789012',extra={})=>({legacyItemId:id,itemId:`v1|${id}|0`,seller:{username:'adidas_official'},price:{value:'25',currency:'USD'},marketingPrice:{originalPrice:{value:'100',currency:'USD'},discountPercentage:'75'},buyingOptions:['FIXED_PRICE'],...extra});
function mock(pages){clearEbayTokenCacheForTests();const calls=[];const fetcher=async(input,init)=>{const url=new URL(String(input));calls.push({url,init});if(url.pathname==='/identity/v1/oauth2/token')return Response.json({access_token:'storefront-token',expires_in:3600});return Response.json(typeof pages==='function'?pages(url):pages);};return{fetcher,calls};}

test('store slug uses the reviewed seller identity and category; arbitrary URLs never enter discovery',()=>{
  assert.deepEqual(parseEbayStorefrontUrl(source),{sourceUrl:'https://www.ebay.com/str/adidas?_sacat=15709',store:'adidas',seller:'adidas_official',categoryId:'15709'});
  assert.equal(parseEbayStorefrontUrl('https://www.ebay.com/str/some-other-shop?_sacat=15709')?.seller,undefined,'no seller username guessed from a slug');
  assert.equal(parseEbayStorefrontUrl('https://www.ebay.com/str/constructor?_sacat=15709')?.seller,undefined);
  for(const url of ['http://www.ebay.com/str/adidas?_sacat=15709','https://www.ebay.com:443/str/adidas?_sacat=15709','https://me@www.ebay.com/str/adidas?_sacat=15709','https://www.ebay.com.evil.test/str/adidas?_sacat=15709','https://www.ebay.com/itm/123456789012','https://www.ebay.com/str/adidas?_sacat=1&_sacat=2','https://www.ebay.com/str/adidas?_sacat=1,2'])assert.equal(parseEbayStorefrontUrl(url),undefined,url);
});

test('official seller search finds actual discounts only and canonicalizes variation listings',async()=>{
  const values=[summary(),summary('123456789013',{itemId:'v1|123456789013|9001',itemWebUrl:'https://attacker.test/not-followed'}),summary('123456789014',{marketingPrice:{discountPercentage:'20'}}),
    summary('123456789015',{marketingPrice:undefined}),summary('123456789016',{marketingPrice:{originalPrice:{value:'25',currency:'USD'}}}),summary('123456789017',{marketingPrice:{originalPrice:{value:'100',currency:'EUR'},discountPercentage:'75'}}),
    summary('123456789018',{seller:{username:'other'}}),summary('123456789019',{buyingOptions:['AUCTION']}),summary('123456789020',{itemEndDate:'2000-01-01T00:00:00Z'}),summary('123456789021',{estimatedAvailableQuantity:0}),summary('123456789022',{itemId:'v1|000000000000|0'}),summary('123456789023',{price:{value:'NaN',currency:'USD'}}),summary()];
  const {fetcher,calls}=mock({itemSummaries:values,total:values.length});
  const page=await fetchEbayStorefrontSalePage(source,config,fetcher);
  assert.deepEqual(page.urls,['https://www.ebay.com/itm/123456789012','https://www.ebay.com/itm/123456789013','https://www.ebay.com/itm/123456789014']);
  assert.equal(page.items[0].referencePrice,100);assert.equal(page.items[0].discountPercentage,75);assert.equal(page.items[2].referencePrice,undefined);
  assert.equal(page.scanned,values.length);assert.equal(page.matched,3);assert.equal(page.nextCursor,undefined);
  const request=calls[1];assert.equal(request.url.origin,'https://api.ebay.com');assert.equal(request.url.pathname,'/buy/browse/v1/item_summary/search');assert.equal(request.url.searchParams.get('filter'),'sellers:{adidas_official},buyingOptions:{FIXED_PRICE}');assert.equal(request.url.searchParams.get('category_ids'),'15709');assert.equal(request.url.searchParams.get('limit'),'50');assert.equal(request.init.headers['X-EBAY-C-MARKETPLACE-ID'],'EBAY_US');assert.equal(request.init.redirect,'manual');
});

test('pagination uses a source-bound bounded offset and never follows provider next URLs',async()=>{
  const {fetcher,calls}=mock(url=>Number(url.searchParams.get('offset'))===0?{itemSummaries:[summary()],total:51,next:'https://attacker.test/?token=private'}:{itemSummaries:[summary('123456789099')],total:51});
  const first=await fetchEbayStorefrontSalePage(source,config,fetcher);assert.ok(first.nextCursor);
  const second=await fetchEbayStorefrontSalePage(source,config,fetcher,first.nextCursor);assert.equal(second.offset,50);assert.equal(second.nextCursor,undefined);assert.equal(calls.at(-1).url.origin,'https://api.ebay.com');
  const count=calls.length;
  await assert.rejects(fetchEbayStorefrontSalePage(source.replace('15709','12345'),config,fetcher,first.nextCursor),/не относится/);
  for(const cursor of ['https://attacker.test','!bad',btoa(JSON.stringify({v:1,sourceUrl:parseEbayStorefrontUrl(source).sourceUrl,offset:10000})).replace(/=+$/,'')])await assert.rejects(fetchEbayStorefrontSalePage(source,config,fetcher,cursor));
  assert.equal(calls.length,count,'bad cursors trigger no upstream request');
});

test('discovery reports the official API search ceiling and refuses unreviewed stores or missing categories',async()=>{
  const {fetcher,calls}=mock({itemSummaries:[summary()],total:10001,next:'https://api.ebay.com/ignored'});
  const cursor=btoa(JSON.stringify({v:1,sourceUrl:parseEbayStorefrontUrl(source).sourceUrl,offset:9950})).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const last=await fetchEbayStorefrontSalePage(source,config,fetcher,cursor);assert.equal(last.limited,true);assert.equal(last.nextCursor,undefined);
  const count=calls.length;await assert.rejects(fetchEbayStorefrontSalePage('https://www.ebay.com/str/unknown?_sacat=15709',config,fetcher),/не подтверждён/);await assert.rejects(fetchEbayStorefrontSalePage('https://www.ebay.com/str/adidas',config,fetcher),/_sacat/);assert.equal(calls.length,count);
  await assert.rejects(fetchEbaySellerSearchPage(config,fetcher,{seller:'a},sellers:{evil',categoryId:'15709',offset:0}));
});

test('sparse pages continue from remaining totals and empty pages with next remain bounded',async()=>{
  const {fetcher,calls}=mock(url=>{
    const offset=Number(url.searchParams.get('offset'));
    if(offset===0)return{itemSummaries:[summary()],total:101};
    if(offset===50)return{itemSummaries:[],total:101,next:'https://attacker.test/same-link-forever'};
    if(offset===100)return{itemSummaries:[summary('123456789099')],total:101};
    return{itemSummaries:[],next:'https://attacker.test/same-link-forever'};
  });
  const first=await fetchEbayStorefrontSalePage(source,config,fetcher);assert.ok(first.nextCursor,'one summary does not mean the whole result set is finished');
  const empty=await fetchEbayStorefrontSalePage(source,config,fetcher,first.nextCursor);assert.equal(empty.scanned,0);assert.ok(empty.nextCursor,'an empty page with next must not claim all items imported');
  const last=await fetchEbayStorefrontSalePage(source,config,fetcher,empty.nextCursor);assert.equal(last.offset,100);assert.equal(last.nextCursor,undefined);assert.equal(last.urls.length,1);
  const atCeiling=btoa(JSON.stringify({v:1,sourceUrl:parseEbayStorefrontUrl(source).sourceUrl,offset:9950})).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const capped=await fetchEbayStorefrontSalePage(source,config,fetcher,atCeiling);assert.equal(capped.scanned,0);assert.equal(capped.limited,true);assert.equal(capped.nextCursor,undefined);
  assert.ok(calls.every(call=>call.url.origin==='https://api.ebay.com'));
});

test('seller search transport stays fixed to official API hosts and GET only',async()=>{
  assert.equal(isFixedEbayApiRequest('https://api.ebay.com/buy/browse/v1/item_summary/search'),true);
  assert.throws(()=>isFixedEbayApiRequest('https://api.ebay.com/buy/browse/v1/item_summary/search',{method:'POST'}));
  const seen=[];const fetcher=createEbayAwareMerchantFetch(async()=>{throw Error('page proxy must not see OAuth')},()=>config,async(input,init)=>{seen.push([String(input),init]);return Response.json({})});
  await fetcher('https://api.ebay.com/buy/browse/v1/item_summary/search?category_ids=15709');assert.equal(seen.length,1);
});
