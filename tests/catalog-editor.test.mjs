import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogIssues,changeCatalog,importDraft,initialCatalog,publicCatalog} from '../lib/market/catalog-editor.ts';
import {tariff} from '../lib/market/domain.ts';

const extracted={sourceUrl:'https://kyliecosmetics.com/products/matte-lip-kit?utm_source=mail',title:'Matte Lip Kit',brand:'Kylie Cosmetics',category:'Красота и уход',image:'https://cdn.shopify.com/lip.jpg',images:['https://cdn.shopify.com/lip.jpg'],price:35,currency:'USD',variants:[{label:'Bare',available:true,price:35}],warnings:['Доставка неизвестна'],method:'Shopify'};
test('admin import creates a reviewable draft without claiming store shipping',()=>{
 const draft=importDraft(extracted,[],'США',1000);
 assert.equal(draft.sourceUrl,'https://kyliecosmetics.com/products/matte-lip-kit');
 assert.equal(draft.category,'Красота и уход');assert.equal(draft.price,35);assert.equal(draft.boxedWeight,.6);
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
test('hiding removes a product from the public feed without deleting its draft',()=>{
 let doc=initialCatalog(),id=doc.entries[0].id;doc=changeCatalog(doc,{kind:'hide',ids:[id]},Date.parse('2026-09-12'),tariff);
 assert.equal(doc.entries[0].published,undefined);assert(doc.entries[0].draft);
 assert(!publicCatalog(doc,tariff,Date.parse('2026-09-12')).products.some(p=>p.id===id));
});
