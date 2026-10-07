import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractSkechersOptions} from '../lib/importer/skechers.ts';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/importer/skechers-native.json',import.meta.url),'utf8'));
const markup=(product=fixture.product,options=fixture.optionsHtml)=>`<script type="application/ld+json">${JSON.stringify(product)}</script>${options}`;
const fallback={sourceUrl:fixture.sourceUrl,sku:'233400',title:fixture.product.name,brand:'Skechers',category:'Спорт',price:115,currency:'USD',image:fixture.product.image[0],images:fixture.product.image,variants:[{label:'WHITE / NAVY',color:'WHITE / NAVY',available:true,availabilityKnown:false}],warnings:[]};
const extract=(html=markup(),url=fixture.sourceUrl)=>extractSkechersOptions(html,url,{...fallback,sourceUrl:url});

test('Skechers keeps the exact color, gallery, shoe category and complete size/width dictionary',()=>{
  const result=extract();
  assert.equal(result.price,115);assert.equal(result.currency,'USD');assert.equal(result.category,'Обувь');
  assert.equal(result.selectedVariantColor,'WHITE / NAVY');assert.equal(result.images.length,5);
  assert.equal(result.variants.length,28);
  assert.equal(result.variants.filter(option=>option.availabilityKnown).length,4);
  assert.equal(result.variants.filter(option=>option.available&&!option.availabilityKnown).length,24);
  assert.deepEqual(result.variants.filter(option=>!option.available).map(option=>option.size),['6.5 / Medium','6.5 / Extra Wide','14.0 / Medium','14.0 / Extra Wide']);
  assert.ok(result.variants.every(option=>option.id===undefined&&option.price===undefined&&option.color==='WHITE / NAVY'));
  assert.ok(result.variants.some(option=>option.size==='8.5 / Medium'));
  assert.ok(result.warnings.some(warning=>warning.includes('каждой комбинации')));
});

test('Skechers rejects another article or color rather than borrowing the captured price',()=>{
  for(const url of [fixture.sourceUrl.replace('233400_WNV','999999_WNV'),fixture.sourceUrl.replace('_WNV','_BBK'),fixture.sourceUrl+'?dwvar_233400_color=BBK']){
    const result=extract(markup(),url);assert.equal(result.price,undefined);assert.deepEqual(result.variants,[]);assert.deepEqual(result.images,[]);
  }
  assert.equal(extract(markup({...fixture.product,'@id':'999999_WNV'})).price,undefined);
  assert.equal(extract(markup({...fixture.product,color:'BLACK'})).price,undefined);
  assert.equal(extract(markup({...fixture.product,offers:{...fixture.product.offers,url:fixture.product.offers.url.replace('https://','https://username:password@')}})).price,undefined);
});

test('Skechers recommendation controls outside the exact product and inline scripts are ignored',()=>{
  const extra='<button class="button-select-size" id="pdp-Size--99" data-pdp-attr-value="99" data-url="https://www.skechers.com/on/demandware.store/Sites-USSkechers-Site/en_US/Product-Variation?pid=233400&amp;dwvar_233400_color=WNV&amp;dwvar_233400_size=99"><span data-attr-value="99">99</span></button>';
  const result=extract(markup()+`<div data-pid="999999">${extra}</div><script>${extra}</script>`);
  assert.equal(result.variants.length,28);assert.ok(result.variants.every(option=>!option.size.startsWith('99')));
});

test('Skechers native controls must match the style, current color and exact US action',()=>{
  for(const changed of [
    fixture.optionsHtml.replace('dwvar_233400_size=7.0&amp;pid=233400','dwvar_233400_size=7.0&amp;pid=999999'),
    fixture.optionsHtml.replace('dwvar_233400_color=WNV&amp;dwvar_233400_size=7.0','dwvar_233400_color=BBK&amp;dwvar_233400_size=7.0'),
    fixture.optionsHtml.replace('en_US/Product-Variation?dwvar_233400_color=WNV&amp;dwvar_233400_size=7.0','en_GB/Product-Variation?dwvar_233400_color=WNV&amp;dwvar_233400_size=7.0'),
    fixture.optionsHtml.replace('dwvar_233400_size=7.0','dwvar_233400_size=8.0'),
  ]){
    const result=extract(markup(fixture.product,changed));
    assert.equal(result.variants.length,26);assert.ok(result.variants.every(option=>!option.size.startsWith('7.0 /')));
  }
});

test('Skechers retains explicitly disabled controls and does not confuse aria-disabled false',()=>{
  const disabled=fixture.optionsHtml.replace('id="pdp-Size--7.0"','disabled id="pdp-Size--7.0"');
  const result=extract(markup(fixture.product,disabled));
  assert.ok(result.variants.filter(option=>option.size.startsWith('7.0 /')).every(option=>!option.available&&option.availabilityKnown));
  const enabled=fixture.optionsHtml.replace('id="pdp-Size--7.0"','aria-disabled="false" id="pdp-Size--7.0"');
  assert.ok(extract(markup(fixture.product,enabled)).variants.filter(option=>option.size.startsWith('7.0 /')).every(option=>option.available&&!option.availabilityKnown));
});

test('Skechers requested width stays exact and unsupported choices require manual review',()=>{
  const medium=extract(markup(),fixture.sourceUrl+'?dwvar_233400_width=Medium');
  assert.equal(medium.variants.length,14);assert.ok(medium.variants.every(option=>option.size.endsWith(' / Medium')));
  for(const query of ['dwvar_233400_width=Narrow','dwvar_233400_size=99'])assert.equal(extract(markup(),fixture.sourceUrl+'?'+query).price,undefined);
  const wrongWidths=fixture.optionsHtml.replaceAll('dwvar_233400_color=WNV&amp;dwvar_233400_width=','dwvar_233400_color=BBK&amp;dwvar_233400_width=');
  assert.deepEqual(extract(markup(fixture.product,wrongWidths)).variants,[]);
});

test('Skechers safe images and product-only shoe evidence do not borrow another product',()=>{
  const unsafe={...fixture.product,image:['https://127.0.0.1/private','http://images.skechers.com/unsafe',...fixture.product.image]};
  assert.deepEqual(extract(markup(unsafe)).images,fixture.product.image);
  const wrongShoe=fixture.optionsHtml.replace('data-masterproduct-id="233400"','data-masterproduct-id="999999"');
  assert.equal(extract(markup(fixture.product,wrongShoe)).category,'Спорт');
  assert.equal(extractSkechersOptions(markup(),'https://untrusted.example/233400_WNV.html',fallback),fallback);
});
