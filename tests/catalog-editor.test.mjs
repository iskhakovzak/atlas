import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogIssues,changeCatalog,importDraft,initialCatalog,publicCatalog,recheckedDraft,reportCatalogAvailability,synchronizeBundledCatalog} from '../lib/market/catalog-editor.ts';
import {communityCatalogProducts} from '../lib/market/community-deals.ts';
import {tariff} from '../lib/market/domain.ts';

const extracted={sourceUrl:'https://kyliecosmetics.com/products/matte-lip-kit?utm_source=mail',title:'Matte Lip Kit',brand:'Kylie Cosmetics',category:'Красота и уход',image:'https://cdn.shopify.com/lip.jpg',images:['https://cdn.shopify.com/lip.jpg'],price:35,currency:'USD',variants:[{id:'bare-full',label:'Bare · Full size',color:'Bare',size:'Full size',available:true,price:35}],warnings:['Доставка неизвестна'],method:'Shopify'};
test('admin import creates a reviewable draft without claiming store shipping',()=>{
 const draft=importDraft(extracted,[],'США',1000);
 assert.equal(draft.sourceUrl,'https://kyliecosmetics.com/products/matte-lip-kit');
 assert.equal(draft.category,'Красота и уход');assert.equal(draft.price,35);assert.equal(draft.boxedWeight,.8);
 assert.deepEqual(draft.variants[0],{id:'bare-full',label:'Bare · Full size',color:'Bare',size:'Full size',sizeLabel:undefined,available:true,price:35,image:undefined});
 assert.deepEqual(catalogIssues(draft,1001),[]);assert.equal(draft.warnings[0],'Доставка неизвестна');
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
test('hiding removes a product from the public feed without deleting its draft',()=>{
 let doc=initialCatalog(),id=doc.entries[0].id;doc=changeCatalog(doc,{kind:'hide',ids:[id]},Date.parse('2026-09-12'),tariff);
 assert.equal(doc.entries[0].published,undefined);assert(doc.entries[0].draft);
 assert(!publicCatalog(doc,tariff,Date.parse('2026-09-12')).products.some(p=>p.id===id));
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
