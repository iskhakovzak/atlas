import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyKnownSnapshotFields, verifyProductSnapshot} from '../lib/importer/verify.ts';
import {manualFallbackAllowed} from '../lib/importer/manual-fallback.ts';
import {ManualEntryFallbackError} from '../lib/importer/fetch.ts';

const product={id:'p',name:'Sneakers',brand:'eBay',category:'Обувь',usd:19,weight:1,image:'',variants:['Black · US 9'],sourceUrl:'https://www.ebay.com/itm/157740212601',sourceVariantId:'black-9',sourceCurrency:'USD',sourcePrice:19,sourceManuallyConfirmed:true};
const fresh={sourceUrl:product.sourceUrl,currency:'USD',price:19,variants:[
  {id:'black-9',label:'Black · US 9',color:'Black',size:'US 9',available:true,price:19},
  {id:'white-85',label:'White · US 8.5',color:'White',size:'US 8.5',available:true,price:23},
],warnings:[]};

test('known option IDs cannot quote a different known label in fresh or partial responses',()=>{
  const contradicted={...product,variants:['White · US 8.5']};
  assert.throws(()=>verifyProductSnapshot(contradicted,contradicted.variants[0],fresh),/не совпадает с артикулом/);
  assert.throws(()=>verifyKnownSnapshotFields(contradicted,contradicted.variants[0],fresh),/не совпадает с артикулом/);
  assert.throws(()=>manualFallbackAllowed(contradicted,contradicted.variants[0],new ManualEntryFallbackError('Incomplete response',fresh,'incomplete')),/не совпадает с артикулом/);
});

test('contradicted option IDs are rejected even when both prices are equal',()=>{
  const samePrice={...fresh,variants:fresh.variants.map(item=>({...item,price:19}))};
  assert.throws(()=>verifyProductSnapshot(product,'White · US 8.5',samePrice),/не совпадает с артикулом/);
  assert.throws(()=>verifyKnownSnapshotFields(product,'White · US 8.5',samePrice),/не совпадает с артикулом/);
});

test('a correctly matched option keeps its own price and ID',()=>{
  const white={...product,variants:['White · US 8.5'],sourceVariantId:'white-85',sourcePrice:23};
  const verified=verifyProductSnapshot(white,white.variants[0],fresh,1000);
  assert.equal(verified.sourcePrice,23);assert.equal(verified.sourceVariantId,'white-85');
  assert.doesNotThrow(()=>verifyKnownSnapshotFields(white,white.variants[0],fresh));
  assert.throws(()=>verifyProductSnapshot({...white,sourcePrice:19},white.variants[0],fresh),/Цена изменилась/);
});

test('renamed labels and neutral legacy single-option labels remain compatible',()=>{
  const oldLabel={...product,variants:['Black, US 9 (legacy label)']};
  assert.equal(verifyProductSnapshot(oldLabel,oldLabel.variants[0],fresh).sourceVariantId,'black-9');
  assert.doesNotThrow(()=>verifyKnownSnapshotFields(oldLabel,oldLabel.variants[0],fresh));
  const neutral={...product,sourceVariantId:undefined,variants:['Указанный вариант'],sourceManuallyConfirmed:undefined};
  assert.equal(verifyProductSnapshot(neutral,neutral.variants[0],{...fresh,variants:[fresh.variants[0]]}).sourcePrice,19);
});

test('legacy omitted matrices stay readable but unknown stock blocks verification',()=>{
  const omitted={...fresh,variants:[]};
  assert.equal(verifyProductSnapshot(product,product.variants[0],omitted).sourcePrice,19);
  assert.doesNotThrow(()=>verifyKnownSnapshotFields(product,product.variants[0],omitted));
  const unknown={...fresh,variants:fresh.variants.map(item=>({...item,available:false,availabilityKnown:false}))};
  assert.throws(()=>verifyProductSnapshot(product,product.variants[0],unknown),/не подтвердил наличие/);
  assert.doesNotThrow(()=>verifyKnownSnapshotFields(product,product.variants[0],unknown));
});

test('duplicate labels do not contradict an ID whose own live label matches',()=>{
  const duplicate={...fresh,variants:fresh.variants.map(item=>({...item,label:'Standard'}))};
  const second={...product,variants:['Standard'],sourceVariantId:'white-85',sourcePrice:23};
  assert.equal(verifyProductSnapshot(second,'Standard',duplicate).sourcePrice,23);
  assert.doesNotThrow(()=>verifyKnownSnapshotFields(second,'Standard',duplicate));
});

test('same SKU offers require exact seller and offer identity',()=>{
 const variants=[{...fresh.variants[0],sellerId:'seller-a',offerId:'offer-a',price:19},{...fresh.variants[0],sellerId:'seller-b',offerId:'offer-b',price:23}];
 const snapshot={...fresh,variantScope:'group',variants};
 assert.throws(()=>verifyProductSnapshot({...product,sourceManuallyConfirmed:false},product.variants[0],snapshot),/сверить/);
 const selected={...product,sourceSellerId:'seller-b',sourceOfferId:'offer-b',sourcePrice:23};
 assert.equal(verifyProductSnapshot(selected,selected.variants[0],snapshot).sourcePrice,23);
 assert.throws(()=>verifyProductSnapshot({...selected,sourceManuallyConfirmed:false,sourceOfferId:'missing'},selected.variants[0],snapshot),/сверить/);
});
test('group summary price never substitutes an absent exact variant price',()=>{
 const snapshot={...fresh,variantScope:'group',variants:fresh.variants.map(v=>({...v,price:undefined}))};
 assert.throws(()=>verifyProductSnapshot(product,product.variants[0],snapshot),/не подтвердил цену/);
});
