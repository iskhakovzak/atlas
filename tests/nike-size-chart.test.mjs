import test from 'node:test';
import assert from 'node:assert/strict';
import {getNikeFootwearSizeRows,findNikeFootwearSizeRow,inferNikeFootwearSizeSystem} from '../lib/market/nike-size-chart.ts';
import {extractProduct} from '../lib/importer/extract.ts';

test('official Nike conversions keep women and men distinct and foot cm separate from CM/JP',()=>{
  assert.deepEqual(findNikeFootwearSizeRow('women','US 5'),{us:'5',uk:'2.5',eu:'35.5',cmLabel:'22',footLengthCm:22.1});
  assert.deepEqual(findNikeFootwearSizeRow('women','7.5'),{us:'7.5',uk:'5',eu:'38.5',cmLabel:'24.5',footLengthCm:24.1});
  assert.deepEqual(findNikeFootwearSizeRow('men','7.5'),{us:'7.5',uk:'6.5',eu:'40.5',cmLabel:'25.5',footLengthCm:24.9});
  assert.deepEqual(getNikeFootwearSizeRows('women',['5','US 7.5','12','garbage']).map(r=>r.us),['5','7.5','12']);
  assert.equal(findNikeFootwearSizeRow('women','XS'),undefined);
  const legacy={sourceUrl:'https://www.nike.com/t/pegasus/IB1881-500',currency:'USD',category:'Обувь',title:"Nike Pegasus 42 Women's Road Running Shoes"};
  assert.equal(inferNikeFootwearSizeSystem(legacy),'women');
  assert.equal(inferNikeFootwearSizeSystem({...legacy,currency:'EUR'}),undefined);
  assert.equal(inferNikeFootwearSizeSystem({...legacy,sourceUrl:'https://example.com/product'}),undefined);
});

test('Nike US footwear imports label gender but do not apply US chart to European sizes or apparel',()=>{
  const parse=(title,currency='USD',productType='FOOTWEAR')=>extractProduct(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{selectedProduct:{styleCode:'IB1881-500',brands:['Nike'],productType,productInfo:{fullTitle:title},prices:{currency,currentPrice:88.97},sizes:[{label:'5',status:'ACTIVE'}]}}}})}</script>`,'https://www.nike.com/t/pegasus/IB1881-500');
  assert.equal(parse("Nike Pegasus 42 Women's Road Running Shoes").variants[0].sizeLabel,'Nike US women');
  assert.equal(parse("Nike Gato Men's Shoes").variants[0].sizeLabel,'Nike US men');
  assert.equal(parse("Nike Pegasus Women's Shoes",'EUR').variants[0].sizeLabel,'Размер');
  assert.equal(parse("Nike Women's Cotton T-Shirt",'USD','APPAREL').variants[0].sizeLabel,'Размер');
});
