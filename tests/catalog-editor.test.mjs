import test from 'node:test';
import assert from 'node:assert/strict';
import {applyScheduledCatalogRefresh,catalogDocumentSchema,catalogIssues,catalogLifetime,catalogRefreshInterval,catalogRecheckBatches,catalogRecheckBatchSize,changeCatalog,cleanGeneratedCatalogDescription,customerLinkDraft,dueCatalogEntries,importDraft,initialCatalog,isBundledCatalogEntry,manualFallbackCatalogDraft,markCatalogRefreshFailed,publicCatalog,recheckedDraft,reportCatalogAvailability,synchronizeBundledCatalog} from '../lib/market/catalog-editor.ts';
import {catalogRefreshPath,isAuthorizedCatalogRefresh,signCatalogRefreshRequest} from '../lib/market/catalog-refresh-auth.ts';
import {communityCatalogProducts} from '../lib/market/community-deals.ts';
import {catalogOrderVariants,keepCatalogVisible} from '../lib/market/catalog.ts';
import {productSchema,tariff} from '../lib/market/domain.ts';

const extracted={sourceUrl:'https://kyliecosmetics.com/products/matte-lip-kit?utm_source=mail',title:'Matte Lip Kit',brand:'Kylie Cosmetics',category:'Красота и уход',image:'https://cdn.shopify.com/lip.jpg',images:['https://cdn.shopify.com/lip.jpg'],price:35,currency:'USD',variants:[{id:'bare-full',label:'Bare · Full size',color:'Bare',size:'Full size',available:true,price:35}],warnings:['Доставка неизвестна'],method:'Shopify'};
test('catalog rechecks keep every selected id in stable server-sized batches',()=>{
 const ids=Array.from({length:23},(_,index)=>`item-${index}`);
 const batches=catalogRecheckBatches([...ids,ids[4]]);
 assert.deepEqual(batches.map(batch=>batch.length),[10,10,3]);
 assert.equal(catalogRecheckBatchSize,10);
 assert.deepEqual(batches.flat(),ids);
 assert(batches.every(batch=>batch.length<=catalogRecheckBatchSize));
});
test('customer link imports become reviewable drafts without public publication',()=>{
 const product={id:'kylie-link',name:'Matte Lip Kit',brand:'Kylie Cosmetics',category:'Красота и уход',usd:35,weight:1.3,boxedWeight:.8,image:'https://cdn.shopify.com/lip.jpg',variants:['Bare · Full size'],sourceUrl:'https://kyliecosmetics.com/products/matte-lip-kit?utm_source=mail',sourceVariantId:'bare-full',sourceCurrency:'USD',sourcePrice:35,sourceShipping:10,sourceShippingCurrency:'USD',sourceShippingUsd:10,sourceShippingEstimated:true,shippingKnown:true,country:'США',description:'Товар из каталога Atlas. Цена, выбранный вариант и наличие повторно проверяются в магазине перед добавлением в корзину.'};
 const draft=customerLinkDraft(product,extracted,1000);
 assert.equal(draft.sourceUrl,'https://kyliecosmetics.com/products/matte-lip-kit');
 assert.equal(draft.description,'');
 assert.equal(draft.variants[0].id,'bare-full');assert.equal(draft.variants[0].available,true);
 assert(draft.reviewReasons.some(value=>value.includes('запроса покупателя')));assert(catalogIssues(draft,1001).some(value=>value.includes('Добавлен после запроса покупателя')));
 const doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'customer-kylie',draft}]});
 assert.equal(publicCatalog(doc,tariff,1001).products.length,0);
});
test('generated catalog boilerplate is hidden without erasing real product descriptions',()=>{
 const now=Date.now(),base=importDraft(extracted,[],'США',now),legacy='Товар из каталога Atlas. Цена, выбранный вариант и наличие повторно проверяются в магазине перед добавлением в корзину.';
 assert.equal(cleanGeneratedCatalogDescription(legacy),'');
 assert.equal(cleanGeneratedCatalogDescription(`в${legacy}`),'');
 const doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'legacy-copy',draft:{...base,description:legacy},published:{...base,description:legacy}}]});
 assert.equal(publicCatalog(doc,tariff,now+1).products[0].description,'');
 const custom='Кожаная куртка с утеплённой подкладкой.';
 const customDoc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'custom-copy',draft:{...base,description:custom},published:{...base,description:custom}}]});
 assert.equal(publicCatalog(customDoc,tariff,now+1).products[0].description,custom);
});
test('admin import creates a reviewable draft without claiming store shipping',()=>{
 const draft=importDraft(extracted,[],'США',1000);
 assert.equal(draft.sourceUrl,'https://kyliecosmetics.com/products/matte-lip-kit');
 assert.equal(draft.category,'Красота и уход');assert.equal(draft.price,35);assert.equal(draft.boxedWeight,.4);
 assert.deepEqual(draft.variants[0],{id:'bare-full',label:'Bare · Full size',color:'Bare',size:'Full size',sizeLabel:undefined,available:true,price:35,image:undefined});
 assert.deepEqual(catalogIssues(draft,1001),[]);assert.equal(draft.warnings[0],'Доставка неизвестна');
});
test('blocked store imports stay as incomplete manual drafts without asserting price or stock',()=>{
 const partial={...extracted,sourceUrl:'https://www.amazon.com/dp/B09XS7JWHH',price:298,currency:'USD',variants:[{...extracted.variants[0],available:true}]};
 const draft=manualFallbackCatalogDraft(partial,partial.sourceUrl,[],'США',1000);
 assert.equal(draft.name,'Matte Lip Kit');assert.equal(draft.image,partial.image);
 assert.equal(draft.price,undefined);assert.equal(draft.currency,'');
 assert.equal(draft.variants[0].available,false);assert.equal(draft.variants[0].availabilityKnown,false);
 assert(catalogIssues(draft,1001).includes('Цена'));
 assert(catalogIssues(draft,1001).includes('Валюта'));
 assert(catalogIssues(draft,1001).includes('Наличие не подтверждено магазином'));
 assert(catalogIssues(draft,1001).some(value=>value.includes('ручная проверка')));
 const blank=manualFallbackCatalogDraft(undefined,'https://www.asos.com/asos-design/prd/123456789',[],'Великобритания',1000);
 assert.equal(blank.brand,'asos.com');assert.equal(blank.country,'Великобритания');
 assert(catalogIssues(blank,1001).includes('Доступный вариант'));
});
test('catalog review state is optional for legacy records and manual failures retain a reason',()=>{
 const base=importDraft(extracted,[],'США',1000);
 const legacy=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'legacy-entry',draft:base}]});
 assert.equal(legacy.entries[0].origin,undefined);assert.equal(legacy.entries[0].queueState,undefined);assert.equal(legacy.entries[0].createdAt,undefined);
 const manual=manualFallbackCatalogDraft(undefined,'https://www.amazon.com/dp/B09XS7JWHH',[],'США',1000,'Amazon blocked this request','blocked');
 assert.equal(manual.importFailureReason,'blocked');assert.match(manual.lastCheckError,/blocked/);
});
test('catalog queue supports deleting only unpublished imported drafts and keeps reports consistent',()=>{
 const doc=initialCatalog(),draft=importDraft(extracted,[],'США',1000);doc.entries.push({id:'queued-import',draft,createdAt:1000,origin:'operator-import',queueState:'queued'});
 doc.availabilityReports=[{id:'report-1',productId:'queued-import',sourceUrl:draft.sourceUrl,answer:'unavailable',reporterId:'customer-1',createdAt:1001}];
 const deleted=changeCatalog(doc,{kind:'delete-drafts',ids:['queued-import','queued-import']},1002,tariff);
 assert(!deleted.entries.some(entry=>entry.id==='queued-import'));assert.equal(deleted.availabilityReports.length,0);
 assert.throws(()=>changeCatalog(doc,{kind:'delete-drafts',ids:[doc.entries[0].id]},1002,tariff),/Опубликованный товар/);
 const bundled=structuredClone(doc);delete bundled.entries[0].published;
 assert.equal(isBundledCatalogEntry(bundled.entries[0].id),true);
 assert.throws(()=>changeCatalog(bundled,{kind:'delete-drafts',ids:[bundled.entries[0].id]},1002,tariff),/Встроенный товар/);
});
test('admin import deduplicates photos and chooses the first safe gallery image',()=>{
 const photo='https://cdn.shopify.com/product.jpg';
 const draft=importDraft({...extracted,image:undefined,images:[photo,photo,'http://unsafe.example/product.jpg']},[],'США',1000);
 assert.equal(draft.image,photo);assert.deepEqual(draft.images,[photo]);
});
test('publishing copies a reviewed snapshot while later edits remain drafts',()=>{
 let doc=initialCatalog();doc.collections=[{id:'beauty',name:'Красота',nameUz:'',nameEn:'Beauty',description:'',visible:true,position:0}];
 const draft=importDraft(extracted,['beauty'],'США',1000);doc.entries.push({id:'lip',draft});
 doc=changeCatalog(doc,{kind:'publish',ids:['lip']},1001,tariff);
 assert.equal(doc.entries.at(-1).published.name,'Matte Lip Kit');
 const edited={...doc.entries.at(-1).draft,name:'New title'};
 doc=changeCatalog(doc,{kind:'edit',id:'lip',draft:edited},1002,tariff);
 assert.equal(doc.entries.at(-1).draft.name,'New title');assert.equal(doc.entries.at(-1).published.name,'Matte Lip Kit');
 const feed=publicCatalog(doc,tariff,1002);assert.equal(feed.products.at(-1).name,'Matte Lip Kit');assert.equal(feed.collections[0].productIds.at(-1),'lip');
});
test('catalog rejects stale, sold-out and incomplete cards before publication',()=>{
 const base=importDraft(extracted,[],'США',1000),doc=initialCatalog();doc.entries.push({id:'bad',draft:{...base,image:'',soldOut:true}});
 assert.throws(()=>changeCatalog(doc,{kind:'publish',ids:['bad']},1001,tariff),/Фото.*Нет доступных вариантов/);
 assert(catalogIssues(base,1000+8*24*60*60*1000).includes('Обновите источник'));
});
test('catalog recheck queues price and availability changes for operator review',()=>{
 const before=importDraft(extracted,[],'США',1000);
 const after=importDraft({...extracted,price:39,variants:[{...extracted.variants[0],price:39,available:false}]},[],'США',2000);
 const checked=recheckedDraft(before,after);
 assert(checked.reviewReasons.some(value=>value.startsWith('Цена:')));
 assert(checked.reviewReasons.some(value=>value.startsWith('Доступные варианты:')));
 assert(catalogIssues(checked,2001).includes('Нет доступных вариантов'));
 const doc=initialCatalog();doc.entries.push({id:'review',draft:checked});
 assert.throws(()=>changeCatalog(doc,{kind:'publish',ids:['review']},2002,tariff),/Цена:/);
});
test('catalog store shipping keeps its reviewed amount through refresh and legacy rows use the reserve',()=>{
 const base=importDraft(extracted,[],'США',1000);
 assert.equal(base.sourceShippingUsd,10);assert.equal(base.sourceShippingEstimated,true);
 const reviewed={...base,sourceShippingUsd:6.5,sourceShippingEstimated:false};
 const fresh=importDraft(extracted,[],'США',2000);
 const checked=recheckedDraft(reviewed,fresh);
 assert.equal(checked.sourceShippingUsd,6.5);assert.equal(checked.sourceShippingEstimated,false);
 const doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'shipping',draft:checked,published:checked,publishedAt:2000}]});
 const product=publicCatalog(doc,tariff,2001).products[0];
 assert.equal(product.sourceShipping,6.5);assert.equal(product.sourceShippingUsd,6.5);
 assert.equal(product.sourceShippingEstimated,false);assert.equal(product.shippingKnown,true);
 const legacyDraft={...base};delete legacyDraft.sourceShippingUsd;delete legacyDraft.sourceShippingEstimated;
 const legacy=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'legacy-shipping',draft:legacyDraft,published:legacyDraft,publishedAt:1000}]});
 const legacyProduct=publicCatalog(legacy,tariff,1001).products[0];
 assert.equal(legacyProduct.sourceShippingUsd,10);assert.equal(legacyProduct.sourceShippingEstimated,true);assert.equal(legacyProduct.shippingKnown,false);
});
test('hiding removes a product from the public feed without deleting its draft',()=>{
 let doc=initialCatalog(),id=doc.entries[0].id;doc=changeCatalog(doc,{kind:'hide',ids:[id]},Date.parse('2026-09-12'),tariff);
 assert.equal(doc.entries[0].published,undefined);assert(doc.entries[0].draft);
 assert(!publicCatalog(doc,tariff,Date.parse('2026-09-12')).products.some(p=>p.id===id));
});
test('published catalog carries the complete safe option matrix and photo gallery',()=>{
 const sourceUrl='https://kyliecosmetics.com/products/matte-lip-kit';
 const matrix=[
  {id:'bare-full',label:'Bare · Full',color:'Bare',size:'Full size',sizeLabel:'Size',available:true,availabilityKnown:true,price:35,image:'https://cdn.shopify.com/bare.jpg'},
  {id:'bare-mini',label:'Bare · Mini',color:'Bare',size:'Mini',sizeLabel:'Size',available:true,availabilityKnown:true,price:19,image:'https://cdn.shopify.com/mini.jpg'},
  {id:'rose-full',label:'Rosé · Full',color:'Rosé',size:'Full size',sizeLabel:'Size',available:false,availabilityKnown:true,price:37,image:'http://unsafe.example/rose.jpg'},
 ];
 const draft=importDraft({...extracted,sourceUrl,image:'https://cdn.shopify.com/bare.jpg',images:['https://cdn.shopify.com/bare.jpg','https://cdn.shopify.com/mini.jpg','http://unsafe.example/gallery.jpg'],variants:matrix},[],'США',1000);
 const doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'lip-matrix',draft,published:structuredClone(draft),publishedAt:1000}]});
 const product=publicCatalog(doc,tariff,1001).products[0];
 assert.equal(product.sourceVariants.length,3);
 assert.deepEqual(product.sourceVariants.map(({id,color,size,sizeLabel,price})=>({id,color,size,sizeLabel,price})),matrix.map(({id,color,size,sizeLabel,price})=>({id,color,size,sizeLabel,price})));
 assert.equal(product.sourceVariants[2].image,undefined);
 assert.deepEqual(product.sourceImages,['https://cdn.shopify.com/bare.jpg','https://cdn.shopify.com/mini.jpg']);
 assert.deepEqual(product.variants,['Bare · Full','Bare · Mini']);
});
test('stale catalog retains its last recorded price for an estimate but strips stale stock',()=>{
 const draft=importDraft({...extracted,variants:[{id:'large-red',label:'Red · Large',color:'Red',size:'Large',available:true,availabilityKnown:true,price:45,image:'https://cdn.shopify.com/red.jpg'}]},[],'США',1000);
 const doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'stale-shirt',draft,published:structuredClone(draft),publishedAt:1000}]});
 const product=publicCatalog(doc,tariff,1000+7*24*60*60*1000).products[0];
 assert.equal(product.priceNeedsConfirmation,true);assert.equal(product.sourcePrice,35);assert.equal(product.sourceCurrency,'USD');assert.equal(product.usd,35);
 assert.deepEqual(product.variants,['Уточнить вариант в магазине']);
 assert.deepEqual(product.sourceVariants.map(({id,label,color,size,available,availabilityKnown,price})=>({id,label,color,size,available,availabilityKnown,price})),[{id:'large-red',label:'Red · Large',color:'Red',size:'Large',available:true,availabilityKnown:false,price:undefined}]);
});
test('legacy products without detailed source metadata continue to parse',()=>{
 const parsed=productSchema.parse({id:'legacy',name:'Legacy product',brand:'Shop',category:'Другое',usd:10,weight:1,image:'https://cdn.example/item.jpg',variants:['One size']});
 assert.equal(parsed.sourceVariants,undefined);assert.equal(parsed.sourceImages,undefined);
 assert.deepEqual(catalogOrderVariants(parsed),[{label:'One size',available:true}]);
});
test('link-order fallback keeps catalog color, size, price, id and photo metadata',()=>{
 const option={id:'navy-us-9',label:'Navy · US 9',color:'Navy',size:'US 9',sizeLabel:'Men size',available:true,availabilityKnown:true,price:59.5,image:'https://cdn.example/navy.jpg'};
 const product=productSchema.parse({id:'shoe',name:'Shoe',brand:'Shop',category:'Обувь',usd:59.5,weight:1,image:option.image,variants:[option.label],sourceVariants:[option],sourceImages:[option.image]});
 assert.deepEqual(catalogOrderVariants(product),[option]);
 assert.deepEqual(product.sourceImages,[option.image]);
});
test('empty live catalog falls back to direct links with prices marked as unconfirmed estimates',()=>{
 const fallback=keepCatalogVisible([],Date.parse('2026-09-27T12:00:00Z'));
 assert(fallback.length>0);
 assert(fallback.every(product=>product.priceNeedsConfirmation===true&&product.sourcePrice>0&&product.referenceUsd===undefined));
});
test('refresh failures keep stale published cards discoverable and clearly unconfirmed',()=>{
 const doc=initialCatalog(),entry=doc.entries[0];
 entry.draft.lastCheckError='temporary source error';
 const result=publicCatalog(doc,tariff,Date.parse('2026-09-27T12:00:00Z'));
 const item=result.products.find(product=>product.id===entry.id);
 assert(item);assert.equal(item.priceNeedsConfirmation,true);assert(item.sourcePrice>0);assert.equal(item.sourceCurrency,'USD');assert.deepEqual(item.variants,['Уточнить вариант в магазине']);
});
test('bundled products join existing catalogs without overwriting operator state',()=>{
 const complete=initialCatalog(),seed=communityCatalogProducts[0];
 const current=structuredClone(complete);
 current.entries=current.entries.filter(entry=>entry.id!==seed.id);
 delete current.entries[0].published;current.entries[0].draft.name='Название администратора';
 const synced=synchronizeBundledCatalog(current);
 assert.equal(synced.added,1);
 assert.equal(synced.document.revision,current.revision+1);
 assert.equal(synced.document.entries[0].draft.name,'Название администратора');
 assert.equal(synced.document.entries[0].published,undefined);
 assert(synced.document.entries.some(entry=>entry.id===seed.id&&entry.published));
});
test('catalog sync raises only unchanged legacy seed weights',()=>{
 const doc=initialCatalog(),airtag=doc.entries.find(entry=>entry.id==='apple-airtag-1pack-2026'),anker=doc.entries.find(entry=>entry.id==='anker-nano-a2147113'),merrell=doc.entries.find(entry=>entry.id==='merrell-wrapt');
 airtag.draft.boxedWeight=.15000000000000002;airtag.published.boxedWeight=.15000000000000002;
 anker.draft.boxedWeight=.3;anker.published.boxedWeight=.3;
 merrell.draft.boxedWeight=1.7000000000000002;merrell.published.boxedWeight=1.7000000000000002;
 const synced=synchronizeBundledCatalog(doc);
 assert.equal(airtag.draft.boxedWeight,.15000000000000002);
 assert.equal(synced.document.entries.find(entry=>entry.id===airtag.id).draft.boxedWeight,.25);
 assert.equal(synced.document.entries.find(entry=>entry.id===anker.id).draft.boxedWeight,.3);
 assert.equal(synced.document.entries.find(entry=>entry.id===merrell.id).draft.boxedWeight,1.7);
});
test('published catalog carries seeded size choices into the order flow',()=>{
 const shoe=communityCatalogProducts.find(product=>product.id==='merrell-wrapt');
 const feed=publicCatalog(initialCatalog(),tariff,Date.parse('2026-09-13T12:00:00Z'));
 assert.deepEqual(feed.products.find(product=>product.id===shoe.id).variants,shoe.variants);
});
test('customer availability reports flag a product without silently hiding it',()=>{
 const doc=initialCatalog(),entry=doc.entries[0];
 const reported=reportCatalogAvailability(doc,{productId:entry.id,sourceUrl:entry.draft.sourceUrl,answer:'unavailable',variant:'M',reporterId:'email:customer@example.com'},1234);
 assert.equal(reported.availabilityReports[0].answer,'unavailable');
 assert.match(reported.entries[0].draft.reviewReasons[0],/Покупатель сообщил/);
 assert(reported.entries[0].published);
 const hidden=changeCatalog(reported,{kind:'hide',ids:[entry.id]},1235,tariff);
 assert.equal(hidden.availabilityReports[0].resolvedAt,1235);
});
test('scheduled catalog work is due once per day and spreads one run across stores',()=>{
 const doc=initialCatalog();
 for(const entry of doc.entries){entry.draft.checkedAt=0;entry.published.checkedAt=0}
 const due=dueCatalogEntries(catalogDocumentSchema.parse(doc),catalogRefreshInterval+1);
 assert(due.length>0);assert(due.length<=5);
 assert.equal(new Set(due.map(entry=>new URL(entry.draft.sourceUrl).hostname.replace(/^www\./,''))).size,due.length);
});
test('scheduled source refresh updates available options but preserves editorial fields',()=>{
 const draft=importDraft(extracted,['beauty'],'США',1000);
 draft.description='Текст редактора';draft.referencePrice=45;
 const doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'lip',draft,published:structuredClone(draft),publishedAt:1000}]});
 const fresh=importDraft({...extracted,price:39,variants:[{...extracted.variants[0],label:'Bare · Travel',size:'Travel',price:39,available:true}]},['wrong'],'Испания',2000);
 const updated=applyScheduledCatalogRefresh(doc,'lip',fresh,2001);
 assert.equal(updated.outcome,'available');
 const entry=updated.document.entries[0];
 assert.equal(entry.draft.description,'Текст редактора');assert.equal(entry.draft.referencePrice,45);
 assert.equal(entry.published.price,39);assert.equal(entry.published.variants[0].label,'Bare · Travel');
 assert.equal(entry.refresh.status,'available');assert.equal(entry.refresh.availableVariantCount,1);
});
test('only a definitive all-sold-out matrix auto-hides a public card',()=>{
 const draft=importDraft(extracted,[],'США',1000),doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'lip',draft,published:structuredClone(draft),publishedAt:1000}]});
 const soldOut=importDraft({...extracted,variants:[{...extracted.variants[0],available:false}]},[],'США',2000);
 const hidden=applyScheduledCatalogRefresh(doc,'lip',soldOut,2001).document.entries[0];
 assert.equal(hidden.published,undefined);assert.equal(hidden.autoHideReason,'source-sold-out');assert.equal(hidden.refresh.status,'sold-out');
 const unknown=importDraft({...extracted,variants:[]},[],'США',2002);
 const retained=applyScheduledCatalogRefresh(doc,'lip',unknown,2003).document.entries[0];
 assert(retained.published);assert.equal(retained.refresh.status,'unknown');
 const failed=markCatalogRefreshFailed(doc,'lip',Error('timeout'),2004).document.entries[0];
 assert(failed.published);assert.equal(failed.refresh.status,'failed');assert.match(failed.refresh.lastError,/timeout/);
});
test('unknown merchant availability never republishes or auto-hides a card',()=>{
 const draft=importDraft(extracted,[],'США',1000),doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'lip',draft,published:structuredClone(draft),publishedAt:1000}]});
 const unknown=importDraft({...extracted,variants:[{...extracted.variants[0],available:true,availabilityKnown:false}]},[],'США',2000);
 const result=applyScheduledCatalogRefresh(doc,'lip',unknown,2001);
 assert.equal(result.outcome,'unknown');
 assert(result.document.entries[0].published);
 assert.equal(result.document.entries[0].refresh.status,'unknown');
 assert.match(result.document.entries[0].refresh.lastError,/не отдал подтверждённую матрицу наличия/);
});
test('the internal refresh endpoint signature expires and cannot be replayed as another path',async()=>{
 const secret='test-secret',now=Date.UTC(2026,8,19,12),timestamp=String(now),signature=await signCatalogRefreshRequest(secret,timestamp);
 const request=new Request(`https://atlas.test${catalogRefreshPath}`,{method:'POST',headers:{'x-atlas-refresh-timestamp':timestamp,'x-atlas-refresh-signature':signature}});
 assert(await isAuthorizedCatalogRefresh(request,secret,now));
 assert(!(await isAuthorizedCatalogRefresh(request,secret,now+6*60*1000)));
 const wrongPath=new Request('https://atlas.test/api/catalog',{method:'POST',headers:request.headers});
 assert(!(await isAuthorizedCatalogRefresh(wrongPath,secret,now)));
});
test('imported drafts keep the store’s own before-discount price and the public feed shows it as a discount',()=>{
 const draft=importDraft({...extracted,price:35,referencePrice:50},[],'США',1000);
 assert.equal(draft.referencePrice,50);
 assert.equal(importDraft({...extracted,price:35,referencePrice:35},[],'США',1000).referencePrice,undefined);
 assert.equal(importDraft({...extracted,price:35,referencePrice:20},[],'США',1000).referencePrice,undefined);
 assert.equal(importDraft({...extracted,price:undefined,referencePrice:50},[],'США',1000).referencePrice,undefined);
 const doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'sale',draft,published:structuredClone(draft),publishedAt:1000}]});
 const product=publicCatalog(doc,tariff,1001).products[0];
 assert.equal(product.referenceUsd,50);assert.equal(product.sourceCheckedAt,1000);
 // A recheck takes the store's current before-discount price and falls back to the recorded one.
 assert.equal(recheckedDraft(draft,importDraft({...extracted,price:30,referencePrice:45},[],'США',2000)).referencePrice,45);
 assert.equal(recheckedDraft(draft,importDraft(extracted,[],'США',2000)).referencePrice,50);
});
test('operator confirmation publishes a stale card with unconfirmed stock and resolves customer reports',()=>{
 const base=importDraft({...extracted,variants:[{...extracted.variants[0],available:true,availabilityKnown:false},{id:'rose',label:'Rosé',available:false,availabilityKnown:false}]},[],'США',1000);
 const now=1000+8*24*60*60*1000;
 const stale={...base,lastCheckError:'Магазин не ответил',importFailureReason:'timeout',reviewReasons:['Покупатель сообщил, что товар отсутствует']};
 assert(catalogIssues(stale,now).includes('Обновите источник'));assert(catalogIssues(stale,now).includes('Наличие не подтверждено магазином'));
 const doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'lip',draft:stale,queueState:'queued',autoHiddenAt:5,autoHideReason:'source-sold-out'}],availabilityReports:[{id:'r1',productId:'lip',sourceUrl:stale.sourceUrl,answer:'unavailable',reporterId:'c1',createdAt:999},{id:'r2',productId:'other',sourceUrl:stale.sourceUrl,answer:'unavailable',reporterId:'c2',createdAt:999}]});
 assert.throws(()=>changeCatalog(doc,{kind:'publish',ids:['lip']},now,tariff),/Обновите источник/);
 const confirmed=changeCatalog(doc,{kind:'confirm',ids:['lip']},now,tariff);
 const entry=confirmed.entries[0];
 assert.equal(entry.queueState,'published');assert.equal(entry.publishedAt,now);assert.equal(entry.autoHiddenAt,undefined);assert.equal(entry.autoHideReason,undefined);
 for(const draft of [entry.draft,entry.published]){
  // The price was not re-read: its date stays, the operator's mark carries the freshness.
  assert.equal(draft.checkedAt,base.checkedAt);assert.equal(draft.confirmedBy,'operator');assert.equal(draft.confirmedAt,now);
  assert.equal(draft.soldOut,false);assert.equal(draft.lastCheckError,undefined);assert.equal(draft.importFailureReason,undefined);assert.deepEqual(draft.reviewReasons,[]);
  assert.deepEqual(draft.variants.map(({available,availabilityKnown})=>({available,availabilityKnown})),[{available:true,availabilityKnown:true},{available:false,availabilityKnown:true}]);
 }
 assert.deepEqual(catalogIssues(entry.published,now+1),[]);
 // The confirmation lasts one catalog lifetime, like a store answer would.
 assert(catalogIssues(entry.published,now+catalogLifetime).includes('Обновите источник'));
 assert.equal(confirmed.availabilityReports[0].resolvedAt,now);assert.equal(confirmed.availabilityReports[1].resolvedAt,undefined);
 const product=publicCatalog(confirmed,tariff,now+1).products[0];
 assert.equal(product.priceNeedsConfirmation,false);assert.equal(product.confirmedAt,now);
 // The storefront keeps printing the price with its own date, while the card lives until the confirmation ages out.
 assert.equal(product.sourceCheckedAt,base.checkedAt);assert.equal(product.observedOn,new Date(base.checkedAt).toISOString().slice(0,10));assert.equal(product.sourceExpiresAt,now+catalogLifetime);
 assert.deepEqual(product.variants,['Bare · Full size']);
 // A draft whose variants the store never listed keeps that gap: confirmation does not invent an option.
 const noVariants=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'bare',draft:{...base,variants:[]}}]});
 assert.throws(()=>changeCatalog(noVariants,{kind:'confirm',ids:['bare']},now,tariff),/Доступный вариант/);
});
test('operator confirmation does not publish a card with other problems and leaves the document untouched',()=>{
 const base=importDraft(extracted,[],'США',1000),now=1000+8*24*60*60*1000;
 const doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'lip',draft:{...base,price:undefined,image:''}}]});
 assert.throws(()=>changeCatalog(doc,{kind:'confirm',ids:['lip']},now,tariff),error=>/Matte Lip Kit: /.test(error.message)&&/Фото/.test(error.message)&&/Цена/.test(error.message)&&!/Обновите источник/.test(error.message));
 assert.equal(doc.entries[0].draft.confirmedAt,undefined);assert.equal(doc.entries[0].published,undefined);
 assert.throws(()=>changeCatalog(doc,{kind:'confirm',ids:['missing']},now,tariff),/Товар не найден/);
});
test('showcase position travels from the draft through edits to the public feed',()=>{
 const base=importDraft(extracted,[],'США',1000);
 let doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'lip',draft:base}]});
 doc=changeCatalog(doc,{kind:'edit',id:'lip',draft:{...base,rank:3}},1001,tariff);
 assert.equal(doc.entries[0].draft.rank,3);
 doc=changeCatalog(doc,{kind:'publish',ids:['lip']},1002,tariff);
 assert.equal(publicCatalog(doc,tariff,1003).products[0].rank,3);
 // Ordering is not a product claim: a published card takes a new position without a republish.
 doc=changeCatalog(doc,{kind:'edit',id:'lip',draft:{...doc.entries[0].draft,rank:1,name:'Draft only'}},1004,tariff);
 const product=publicCatalog(doc,tariff,1005).products[0];
 assert.equal(product.rank,1);assert.equal(product.name,'Matte Lip Kit');
 doc=changeCatalog(doc,{kind:'edit',id:'lip',draft:{...doc.entries[0].draft,rank:undefined}},1006,tariff);
 assert.equal(doc.entries[0].published.rank,undefined);assert.equal('rank' in publicCatalog(doc,tariff,1007).products[0],false);
 assert.throws(()=>changeCatalog(doc,{kind:'edit',id:'lip',draft:{...doc.entries[0].draft,rank:1001}},1008,tariff));
 assert.throws(()=>changeCatalog(doc,{kind:'edit',id:'lip',draft:{...doc.entries[0].draft,rank:1.5}},1008,tariff));
 // A recheck keeps the operator's position.
 assert.equal(recheckedDraft({...base,rank:7},importDraft(extracted,[],'США',2000)).rank,7);
});
test('operator confirmation survives edits and failed checks but yields to a fresh store answer',()=>{
 const base=importDraft(extracted,[],'США',1000),now=1000+8*24*60*60*1000;
 let doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'lip',draft:base}]});
 doc=changeCatalog(doc,{kind:'confirm',ids:['lip']},now,tariff);
 // An edit neither grants nor removes the confirmation, whatever the client sends.
 doc=changeCatalog(doc,{kind:'edit',id:'lip',draft:{...doc.entries[0].draft,name:'Edited',confirmedBy:undefined,confirmedAt:undefined}},now+1,tariff);
 assert.equal(doc.entries[0].draft.confirmedBy,'operator');assert.equal(doc.entries[0].draft.confirmedAt,now);
 const plain=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'lip',draft:base}]});
 const claimed=changeCatalog(plain,{kind:'edit',id:'lip',draft:{...base,confirmedBy:'operator',confirmedAt:now}},now+1,tariff);
 assert.equal(claimed.entries[0].draft.confirmedBy,undefined);assert.equal(claimed.entries[0].draft.confirmedAt,undefined);
 // A failed scheduled check keeps the operator's mark; a successful store answer replaces it.
 const failed=markCatalogRefreshFailed(doc,'lip',Error('timeout'),now+2).document.entries[0];
 assert.equal(failed.draft.confirmedAt,now);assert(failed.published);
 const unknown=applyScheduledCatalogRefresh(doc,'lip',importDraft({...extracted,variants:[]},[],'США',now+3),now+4).document.entries[0];
 assert.equal(unknown.draft.confirmedAt,now);
 const refreshed=applyScheduledCatalogRefresh(doc,'lip',importDraft(extracted,[],'США',now+5),now+6);
 assert.equal(refreshed.outcome,'available');
 assert.equal(refreshed.document.entries[0].draft.confirmedBy,undefined);assert.equal(refreshed.document.entries[0].draft.confirmedAt,undefined);
 assert.equal(refreshed.document.entries[0].published.confirmedAt,undefined);
 const rechecked=recheckedDraft(doc.entries[0].draft,importDraft(extracted,[],'США',now+7));
 assert.equal(rechecked.confirmedBy,undefined);assert.equal(rechecked.confirmedAt,undefined);
 assert.equal('confirmedAt' in publicCatalog(refreshed.document,tariff,now+8).products[0],false);
});
test('bulk publish takes every card that passes review and reports the rest; a lone failure still throws',()=>{
 let doc=initialCatalog();
 const good=importDraft(extracted,[],'США',1000),bad={...good,image:'',name:'No photo'};
 doc.entries.push({id:'good',draft:good},{id:'bad',draft:bad});
 assert.throws(()=>changeCatalog(doc,{kind:'publish',ids:['good','bad']},1001,tariff),/No photo/);
 const report={published:0,skipped:[]};
 const next=changeCatalog(doc,{kind:'publish',ids:['good','bad']},1001,tariff,report);
 assert.equal(report.published,1);assert.equal(report.skipped.length,1);assert(report.skipped[0].startsWith('No photo'));
 assert(next.entries.find(e=>e.id==='good').published);assert(!next.entries.find(e=>e.id==='bad').published);
 const none={published:0,skipped:[]};
 assert.throws(()=>changeCatalog(doc,{kind:'publish',ids:['bad']},1001,tariff,none),/No photo/);
});
