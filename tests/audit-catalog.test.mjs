import test from 'node:test';
import assert from 'node:assert/strict';
import {applyScheduledCatalogRefresh,catalogDocumentSchema,changeCatalog,customerLinkDraft,dueCatalogEntries,importDraft,manualFallbackCatalogDraft,publicCatalog,recheckedDraft} from '../lib/market/catalog-editor.ts';
import {tariff} from '../lib/market/domain.ts';

const day=24*60*60*1000;
const extracted={sourceUrl:'https://kyliecosmetics.com/products/matte-lip-kit',title:'Matte Lip Kit',brand:'Kylie Cosmetics',category:'Красота и уход',image:'https://cdn.shopify.com/lip.jpg',images:['https://cdn.shopify.com/lip.jpg'],price:35,currency:'USD',variants:[{id:'bare-full',label:'Bare · Full size',color:'Bare',size:'Full size',available:true,price:35}],warnings:[],method:'Shopify'};
const freshAvailable=(now,extra={})=>importDraft({...extracted,title:'Matte Lip Kit 2026',brand:'Kylie',category:'Другое',image:'https://cdn.shopify.com/new.jpg',images:['https://cdn.shopify.com/new.jpg'],price:39,variants:[{...extracted.variants[0],label:'Bare · Travel',size:'Travel',price:39,available:true}],...extra},[],'Испания',now);
const soldOut=now=>importDraft({...extracted,variants:[{...extracted.variants[0],available:false}]},[],'США',now);

/** A published card the operator edited through the admin "edit" command. */
function editedDocument(now=1000){
  const draft=importDraft(extracted,['beauty'],'США',now);
  let doc=catalogDocumentSchema.parse({revision:0,collections:[{id:'beauty',name:'Красота',visible:true,position:0}],entries:[{id:'lip',draft,published:structuredClone(draft),publishedAt:now,queueState:'published'}]});
  const edited={...draft,boxedWeight:2.5,name:'Набор для губ Kylie',brand:'Kylie Cosmetics Official',category:'Аксессуары',country:'США',image:'https://cdn.shopify.com/editor.jpg',images:['https://cdn.shopify.com/editor.jpg'],weightBasis:'store'};
  doc=changeCatalog(doc,{kind:'edit',id:'lip',draft:edited},now+1,tariff);
  doc=changeCatalog(doc,{kind:'publish',ids:['lip']},now+2,tariff);
  return doc;
}
function assertEditorial(draft){
  assert.equal(draft.boxedWeight,2.5);assert.equal(draft.weightBasis,'operator');
  assert.equal(draft.name,'Набор для губ Kylie');assert.equal(draft.brand,'Kylie Cosmetics Official');
  assert.equal(draft.category,'Аксессуары');assert.equal(draft.country,'США');
  assert.equal(draft.image,'https://cdn.shopify.com/editor.jpg');assert.deepEqual(draft.images,['https://cdn.shopify.com/editor.jpg']);
}

test('operator edit marks a changed weight as the operator\'s and ignores a client-sent basis',()=>{
  const doc=editedDocument();
  assert.equal(doc.entries[0].draft.weightBasis,'operator');assert.equal(doc.entries[0].published.weightBasis,'operator');
  const draft=importDraft(extracted,[],'США',1000),plain=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'lip',draft}]});
  const renamed=changeCatalog(plain,{kind:'edit',id:'lip',draft:{...draft,name:'Другое имя',weightBasis:'store'}},1001,tariff);
  assert.equal(renamed.entries[0].draft.weightBasis,'estimate');
});

test('(a) scheduled refresh keeps operator-edited weight, name, brand, category and photos while price and variants refresh',()=>{
  const doc=editedDocument(),now=2000;
  const result=applyScheduledCatalogRefresh(doc,'lip',freshAvailable(now,{boxedWeight:.9}),now+1);
  assert.equal(result.outcome,'available');
  const entry=result.document.entries[0];
  for(const draft of [entry.draft,entry.published]){
    assertEditorial(draft);
    assert.equal(draft.price,39);assert.equal(draft.variants[0].label,'Bare · Travel');assert.equal(draft.checkedAt,now);
  }
  assert.match(entry.refresh.lastChange,/Название в магазине: Matte Lip Kit 2026/);
  assert.match(entry.refresh.lastChange,/Вес магазина: 2\.5 → 0\.9 кг/);
  const product=publicCatalog(result.document,tariff,now+2).products[0];
  assert.equal(product.name,'Набор для губ Kylie');assert.equal(product.boxedWeight,2.5);assert.equal(product.sourcePrice,39);
});

test('(b) «Проверить» keeps editorial fields and surfaces store differences for review',()=>{
  const previous=editedDocument().entries[0].draft;
  const checked=recheckedDraft(previous,freshAvailable(3000,{boxedWeight:.9}));
  assertEditorial(checked);
  assert.equal(checked.price,39);assert.equal(checked.variants[0].label,'Bare · Travel');
  assert(checked.reviewReasons.some(reason=>reason.startsWith('Цена:')));
  assert(checked.reviewReasons.includes('Название в магазине: Matte Lip Kit 2026'));
  assert(checked.reviewReasons.some(reason=>reason.startsWith('Вес магазина: 2.5 → 0.9 кг')));
  // A store without photos does not wipe the editor's photos; an empty draft takes the store's photos.
  const noPhotos=recheckedDraft(previous,{...freshAvailable(3000),image:'',images:[]});
  assert.equal(noPhotos.image,'https://cdn.shopify.com/editor.jpg');
  const empty=recheckedDraft({...previous,image:'',images:[]},freshAvailable(3000));
  assert.equal(empty.image,'https://cdn.shopify.com/new.jpg');assert.deepEqual(empty.images,['https://cdn.shopify.com/new.jpg']);
});

test('(c) a store-published weight updates an estimated draft the operator did not edit',()=>{
  const estimate=importDraft(extracted,[],'США',1000);
  assert.equal(estimate.weightBasis,'estimate');
  const fresh=importDraft({...extracted,boxedWeight:1.2},[],'США',2000);
  assert.equal(fresh.weightBasis,'store');
  const checked=recheckedDraft(estimate,fresh);
  assert.equal(checked.boxedWeight,1.2);assert.equal(checked.weightBasis,'store');
  assert(checked.reviewReasons.some(reason=>reason.startsWith('Вес магазина:')));
  // An estimate never replaces a store weight, and an unchanged store weight is not flagged.
  const again=recheckedDraft(checked,importDraft(extracted,[],'США',3000));
  assert.equal(again.boxedWeight,1.2);assert.equal(again.weightBasis,'store');
  assert(!again.reviewReasons.some(reason=>reason.startsWith('Вес магазина:')));
  // A store weight arriving for a stored-store draft refreshes it too.
  assert.equal(recheckedDraft(checked,importDraft({...extracted,boxedWeight:1.5},[],'США',3000)).boxedWeight,1.5);
});

test('(d) a legacy draft without weightBasis parses and keeps its weight',()=>{
  const legacy=importDraft(extracted,[],'США',1000);delete legacy.weightBasis;legacy.boxedWeight=1.7;
  const doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'lip',draft:legacy,published:structuredClone(legacy),publishedAt:1000}]});
  assert.equal(doc.entries[0].draft.weightBasis,undefined);
  const checked=recheckedDraft(doc.entries[0].draft,importDraft({...extracted,boxedWeight:.6},[],'США',2000));
  assert.equal(checked.boxedWeight,1.7);assert.equal(checked.weightBasis,undefined);
  const refreshed=applyScheduledCatalogRefresh(doc,'lip',importDraft({...extracted,boxedWeight:.6},[],'США',2000),2001).document.entries[0];
  assert.equal(refreshed.published.boxedWeight,1.7);
});

test('weight provenance is set where drafts are built',()=>{
  const fallback=manualFallbackCatalogDraft({...extracted,boxedWeight:3},extracted.sourceUrl,[],'США',1000);
  assert.equal(fallback.weightBasis,'estimate');
  const product={id:'kylie-link',name:'Matte Lip Kit',brand:'Kylie Cosmetics',category:'Красота и уход',usd:35,weight:1.3,boxedWeight:4,image:'https://cdn.shopify.com/lip.jpg',variants:['Bare · Full size'],sourceUrl:extracted.sourceUrl,sourceCurrency:'USD',sourcePrice:35,sourceShippingUsd:10,sourceShippingEstimated:true,country:'США'};
  assert.equal(customerLinkDraft({...product,weightBasis:'customer'},extracted,1000).weightBasis,'estimate');
  // Weight provenance is server-owned: a client-sent 'store' basis without a store weight stays an estimate.
  assert.equal(customerLinkDraft({...product,weightBasis:'store'},extracted,1000).weightBasis,'estimate');
  assert.equal(customerLinkDraft(product,{...extracted,boxedWeight:.7},1000).weightBasis,'store');
});

function autoHidden(){
  const draft=importDraft(extracted,[],'США',1000);
  const doc=catalogDocumentSchema.parse({revision:0,collections:[],entries:[{id:'lip',draft,published:structuredClone(draft),publishedAt:1000,queueState:'published'}]});
  const hidden=applyScheduledCatalogRefresh(doc,'lip',soldOut(2000),2001).document;
  assert.equal(hidden.entries[0].published,undefined);assert.equal(hidden.entries[0].autoHideReason,'source-sold-out');
  assert.notEqual(hidden.entries[0].queueState,'archived');
  return hidden;
}
function assertStaysHidden(doc){
  const later=2001+2*day;
  assert.equal(dueCatalogEntries(doc,later).length,0);
  const result=applyScheduledCatalogRefresh(doc,'lip',importDraft(extracted,[],'США',later),later+1);
  const entry=result.document.entries[0];
  assert.equal(entry.published,undefined);assert.equal(entry.queueState,'archived');
  assert.equal(entry.autoHiddenAt,undefined);assert.equal(entry.autoHideReason,undefined);
  assert.equal(entry.draft.checkedAt,later);
  assert.equal(publicCatalog(result.document,tariff,later+2).products.length,0);
  assert.equal(dueCatalogEntries(result.document,later+2*day).length,0);
}

test('(e) a manual hide after an auto-hide is final for the scheduler',()=>{
  const hidden=changeCatalog(autoHidden(),{kind:'hide',ids:['lip']},2002,tariff);
  assert.equal(hidden.entries[0].autoHiddenAt,undefined);assert.equal(hidden.entries[0].autoHideReason,undefined);
  assertStaysHidden(hidden);
});

test('(f) a legacy archived document with a leftover auto-hide marker is not republished',()=>{
  const legacy=structuredClone(autoHidden());legacy.entries[0].queueState='archived';
  assert(legacy.entries[0].autoHiddenAt);
  assertStaysHidden(catalogDocumentSchema.parse(legacy));
  const stillSoldOut=applyScheduledCatalogRefresh(catalogDocumentSchema.parse(legacy),'lip',soldOut(3000),3001).document.entries[0];
  assert.equal(stillSoldOut.published,undefined);assert.equal(stillSoldOut.autoHiddenAt,undefined);
});

test('(g) publishing after a recheck clears the auto-hide markers',()=>{
  let doc=autoHidden();
  doc.entries[0].draft=recheckedDraft(doc.entries[0].draft,importDraft(extracted,[],'США',3000));
  doc=changeCatalog(doc,{kind:'edit',id:'lip',draft:doc.entries[0].draft},3001,tariff);
  doc=changeCatalog(doc,{kind:'publish',ids:['lip']},3002,tariff);
  const entry=doc.entries[0];
  assert(entry.published);assert.equal(entry.queueState,'published');
  assert.equal(entry.autoHiddenAt,undefined);assert.equal(entry.autoHideReason,undefined);
});

test('(h) an auto-hidden card without a manual hide is republished when stock returns',()=>{
  const hidden=autoHidden(),later=2001+2*day;
  assert.equal(dueCatalogEntries(hidden,later).length,1);
  const result=applyScheduledCatalogRefresh(hidden,'lip',importDraft(extracted,[],'США',later),later+1);
  assert.equal(result.outcome,'available');
  const entry=result.document.entries[0];
  assert(entry.published);assert.equal(entry.autoHiddenAt,undefined);assert.equal(entry.autoHideReason,undefined);
  assert.equal(publicCatalog(result.document,tariff,later+2).products.length,1);
});

test('(i) re-importing a legacy archived card with a leftover auto-hide marker does not republish it',()=>{
  const legacy=structuredClone(autoHidden());legacy.entries[0].queueState='archived';
  const doc=catalogDocumentSchema.parse(legacy),later=2001+2*day;
  // Mirrors the re-import path in app/api/catalog/route.ts for an unpublished existing entry.
  const entry=doc.entries[0];entry.draft=recheckedDraft(entry.draft,importDraft(extracted,[],'США',later));entry.queueState='queued';
  assert(entry.autoHiddenAt);
  assert.equal(dueCatalogEntries(doc,later+2*day).length,0);
  const result=applyScheduledCatalogRefresh(doc,'lip',importDraft(extracted,[],'США',later),later+1);
  const after=result.document.entries[0];
  assert.equal(after.published,undefined);assert.equal(after.queueState,'queued');
  assert.equal(after.autoHiddenAt,undefined);assert.equal(after.autoHideReason,undefined);
  assert.equal(publicCatalog(result.document,tariff,later+2).products.length,0);
});
