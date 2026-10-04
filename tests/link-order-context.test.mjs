import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogLinkSeed, catalogLinkPrice, catalogLinkWeight} from '../lib/market/link-order-context.ts';

const stores=['amazon.com','ebay.com','zara.com','sephora.com','adidas.com','nike.com'];
const products=stores.map((host,index)=>({id:`catalog-${index}`,sourceUrl:`https://www.${host}/product/one`,name:'Atlas item',category:'Одежда',brand:'Brand',usd:20,weight:1.5,boxedWeight:1,image:'',variants:[],sourcePrice:20,sourceCurrency:'USD',priceNeedsConfirmation:true}));

test('a pasted URL remains editable even when the same listing is in the catalog, for every store',()=>{
  for(const product of products) assert.equal(catalogLinkSeed(products,'',product.sourceUrl),undefined);
});
test('catalog protection requires the exact product ID and source; changing the link releases it',()=>{
  for(const product of products){
    assert.equal(catalogLinkSeed(products,product.id,product.sourceUrl),product);
    assert.equal(catalogLinkSeed(products,'unknown',product.sourceUrl),undefined);
    assert.equal(catalogLinkSeed(products,product.id,product.sourceUrl,product.sourceUrl+'/other'),undefined);
    assert.equal(catalogLinkSeed(products,product.id,products.find(p=>p.id!==product.id).sourceUrl),undefined);
  }
});
test('dated catalog prices remain usable preliminary amounts, not blank locked inputs',()=>{
  for(const product of products) assert.deepEqual(catalogLinkPrice(product),{amount:20,currency:'USD'});
  for(const sourcePrice of [undefined,0,-1,NaN,Infinity]) assert.equal(catalogLinkPrice({...products[0],sourcePrice}),undefined);
  assert.equal(catalogLinkPrice({...products[0],sourceCurrency:undefined}),undefined);
  assert.equal(catalogLinkPrice(undefined),undefined);
});
test('legacy catalog weights cannot produce an empty or undefined locked field',()=>{
  assert.equal(catalogLinkWeight(products[0]),1);
  assert.equal(catalogLinkWeight({...products[0],boxedWeight:undefined}),1.2);
  assert.equal(catalogLinkWeight({...products[0],boxedWeight:undefined,weight:0}),0.6);
  assert.equal(catalogLinkWeight(undefined),undefined);
});
