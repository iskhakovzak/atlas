import test from 'node:test';
import assert from 'node:assert/strict';
import {cartModelKey,cartColourOptions} from '../lib/market/domain.ts';

const product={id:'hoodie',name:'Club Hoodie',sourceUrl:'https://www.nike.com/t/club/FN3859-307',sourceColorId:'307'};

test('sizes of one colour share a display card, different colours remain separate',()=>{
  assert.equal(cartModelKey(product,'Green · M'),cartModelKey({...product,id:'hoodie-L'},'Green · L'));
  assert.notEqual(cartModelKey(product,'Green · M'),cartModelKey({...product,sourceColorId:'657'},'Red · M'));
});

test('eBay sizes group across exact variation links without merging listings or sellers',()=>{
  const ebay={...product,sourceUrl:'https://www.ebay.com/itm/157751149633?var=1&campid=123',sourceColorId:'white',sourceSellerId:'seller'};
  assert.equal(cartModelKey(ebay,'White · 7'),cartModelKey({...ebay,sourceUrl:'https://www.ebay.com/itm/157751149633?var=2'},'White · 8'));
  assert.equal(cartModelKey(ebay,'White · 7'),cartModelKey({...ebay,sourceUrl:'https://ebay.com/itm/shoe/157751149633?var=2'},'White · 8'));
  assert.notEqual(cartModelKey(ebay,'White · 7'),cartModelKey({...ebay,sourceUrl:'https://www.ebay.com/itm/157751149634?var=2'},'White · 8'));
  assert.notEqual(cartModelKey(ebay,'White · 7'),cartModelKey({...ebay,sourceSellerId:'other'},'White · 8'));
  const unknown={...ebay,sourceColorId:undefined};
  assert.notEqual(cartModelKey(unknown,'7'),cartModelKey({...unknown,sourceUrl:'https://www.ebay.com/itm/157751149633?var=2'},'8'));
});

test('merchant matrix and named colour options separate colour cards',()=>{
  const base={...product,sourceColorId:undefined,sourceVariants:[{id:'m',label:'M',color:'Green'},{id:'l',label:'L',color:'Green'},{id:'red',label:'Red M',color:'Red'}]};
  assert.equal(cartModelKey({...base,sourceVariantId:'m'},'M'),cartModelKey({...base,sourceVariantId:'l'},'L'));
  assert.notEqual(cartModelKey({...base,sourceVariantId:'m'},'M'),cartModelKey({...base,sourceVariantId:'red'},'Red M'));
  assert.equal(cartModelKey({...base,sourceVariantId:'old'},'M'),cartModelKey({...base,sourceVariantId:'l'},'L'));
  assert.notEqual(cartModelKey({...product,sourceColorId:undefined,sourceOptions:[{name:'Color',value:'Green'}]},'M'),cartModelKey({...product,sourceColorId:undefined,sourceOptions:[{name:'Color',value:'Red'}]},'M'));
});

test('legacy size-only products group without guessing colour from ambiguous option labels',()=>{
  const legacy={id:'catalog-item',name:'T-shirt'};
  assert.equal(cartModelKey(legacy,'M'),cartModelKey(legacy,'L'));
  assert.notEqual(cartModelKey(legacy,'Green · M'),cartModelKey(legacy,'Red · L'));
  assert.notEqual(cartModelKey(legacy,'M'),cartModelKey({...legacy,id:'another-item'},'M'));
});

test('compact rows omit the shared colour but preserve size and other independent options',()=>{
  assert.deepEqual(cartColourOptions({sourceOptions:[{name:'Color',value:'Green'},{name:'Размер',value:'M'},{name:'Width',value:'Wide'}]}),{color:'Green',label:'Размер: M · Width: Wide'});
  assert.deepEqual(cartColourOptions({sourceOptions:[{name:'Color',value:'Green'},{name:'Размер',value:'M'},{name:'Размер',value:'M'}]}),{color:'Green',label:'Размер: M'});
  assert.equal(cartColourOptions({}),undefined);
  assert.equal(cartColourOptions({sourceOptions:[{name:'Color',value:'Green'}]}),undefined);
});
