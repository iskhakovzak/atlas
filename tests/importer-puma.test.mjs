import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPumaSizes, pumaGuestToken, pumaProductId} from '../lib/importer/puma.ts';

const page = {name: 'FAST-RB NITRO Elite 2', price: 350, currency: 'USD', warnings: ['PUMA опубликовал цвета, но не наличие размеров. Размер нужно проверить и подтвердить вручную.'], method: 'PUMA public product data',
  variants: [{label: 'PUMA Black-Lime Squeeze', color: 'PUMA Black-Lime Squeeze', price: 350, available: true, availabilityKnown: false}, {label: 'White', color: 'White', price: 300, available: true, availabilityKnown: false}]};
const answer = {data: {product: {id: '314984', variations: [{id: '314984_04', colorName: 'PUMA Black-Lime Squeeze', sizeGroups: [{label: null, sizes: [
  {label: '7', productId: '199264510148', orderable: false}, {label: '7.5', productId: '199264510186', orderable: true}]}]}]}}};

test('PUMA product ids come only from us.puma.com product pages', () => {
  assert.equal(pumaProductId(new URL('https://us.puma.com/us/en/pd/fast-rb-nitro-elite-2-mens-laced-running-shoes/314984?swatch=04')), '314984');
  assert.equal(pumaProductId(new URL('https://us.puma.com/us/en/women')), undefined);
  assert.equal(pumaProductId(new URL('https://eu.puma.com/us/en/pd/x/314984')), undefined);
});

test('PUMA sizes become colour × size options with the store stock; other colours stay', () => {
  const result = applyPumaSizes(page, answer, '314984');
  assert.deepEqual(result.variants.map(v => [v.label, v.size, v.available, v.availabilityKnown]), [
    ['PUMA Black-Lime Squeeze / 7', '7', false, true], ['PUMA Black-Lime Squeeze / 7.5', '7.5', true, true], ['White', undefined, true, false]]);
  assert.equal(result.variants[1].id, '199264510186');
  assert.equal(result.variants[1].sizeLabel, 'Size US');
  assert.ok(result.warnings.some(w => w.startsWith('PUMA опубликовал цвета')));
  assert.equal(result.variantsComplete, false);
  // Another product's answer changes nothing.
  assert.equal(applyPumaSizes(page, answer, '999999'), page);
});

test('PUMA does not invent stock answers or cross-wire repeated colour names', () => {
  const partial = {data:{product:{id:'314984',variations:[
    {colorName:'PUMA Black-Lime Squeeze',sizeGroups:[{sizes:[{label:'9',productId:'sku9'}]}]},
    {colorName:'White',sizeGroups:[{sizes:[{label:'8',productId:'wrong-a',orderable:true}]}]},
    {colorName:'White',sizeGroups:[{sizes:[{label:'9',productId:'wrong-b',orderable:true}]}]},
  ]}}};
  const result=applyPumaSizes(page,partial,'314984');
  assert.deepEqual(result.variants.map(v=>[v.color,v.size,v.availabilityKnown,v.id]),[
    ['PUMA Black-Lime Squeeze','9',false,'sku9'],['White',undefined,false,undefined],
  ]);
  assert.equal(result.variants[0].price,350);
  assert.equal(result.variants[1].price,300);
  assert.equal(result.variantsComplete,false);
  assert.ok(result.warnings.length);
});

test('the guest token is read only when it looks like one', () => {
  assert.equal(pumaGuestToken({data: {guestLogon: {accessToken: 'eyJ' + 'x'.repeat(40)}}}), 'eyJ' + 'x'.repeat(40));
  assert.equal(pumaGuestToken({data: {guestLogon: {accessToken: 'bad token'}}}), undefined);
  assert.equal(pumaGuestToken({errors: []}), undefined);
});
