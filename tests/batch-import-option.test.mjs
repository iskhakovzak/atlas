import test from 'node:test';
import assert from 'node:assert/strict';
import {batchCartProduct,batchOptionGallery,batchOptions} from '../lib/market/batch-import-option.ts';
import {compareProductSnapshot} from '../lib/importer/verify.ts';
import {tariff,unknownStoreShippingUsd} from '../lib/market/domain.ts';

const first={label:'US 9',id:'201',productId:'123456789012',sellerId:'seller-a',offerId:'red-offer',
  color:'Red',colorId:'red',options:[{name:'Width',value:'Regular'}],available:true,availabilityKnown:true,price:28};
const second={...first,id:'202',sellerId:'seller-b',offerId:'blue-offer',color:'Blue',colorId:'blue',
  options:[{name:'Width',value:'Wide'}],price:43};
const red='https://i.ebayimg.com/images/g/red/s-l960.jpg';
const blue='https://i.ebayimg.com/images/g/blue/s-l960.jpg';
const data={title:'Running shoes',brand:'Merchant',country:'США',price:28,currency:'EUR',variantScope:'group',
  sourceUrl:'https://www.ebay.com/itm/123456789012',warnings:[],image:red,selectedVariantColor:'Red',
  colorwayImages:[{color:'Blue',colorId:'blue',images:[blue]}],variants:[first,second]};

test('batch selection passes the exact second offer when variants share a visible label',()=>{
  const firstLine=batchCartProduct(data,0,tariff);
  const secondLine=batchCartProduct(data,1,tariff);
  assert.equal(firstLine.variant,secondLine.variant);
  assert.notEqual(firstLine.product.id,secondLine.product.id);
  const {product}=secondLine;
  assert.equal(product.sourceUrl,data.sourceUrl+'?var=202');
  assert.equal(product.sourceVariantId,'202');
  assert.equal(product.sourceSellerId,'seller-b');
  assert.equal(product.sourceOfferId,'blue-offer');
  assert.equal(product.sourceProductId,'123456789012');
  assert.equal(product.sourceColorId,'blue');
  assert.deepEqual(product.sourceOptions,[{name:'Width',value:'Wide'}]);
  assert.equal(product.sourcePrice,43);
  assert.equal(product.sourceCurrency,'EUR');
  assert.equal(product.image,blue);
  assert.deepEqual(product.sourceImages,[blue]);
  assert.equal(product.sourceShipping,unknownStoreShippingUsd);
  assert.equal(product.sourceShippingCurrency,'USD');
  assert.equal(product.sourceShippingUsd,unknownStoreShippingUsd);
  assert.equal(product.sourceShippingEstimated,true);
  assert.equal(compareProductSnapshot(product,secondLine.variant,data).status,'same');
});

test('a missing option, missing currency, and a sold-out offer block only their own cart selections',()=>{
  assert.deepEqual(batchCartProduct({...data,variants:[]},0,tariff),{error:'option'});
  assert.deepEqual(batchCartProduct(data,42,tariff),{error:'option'});
  assert.deepEqual(batchCartProduct({...data,currency:undefined},1,tariff),{error:'currency'});
  assert.deepEqual(batchCartProduct({...data,variants:[first,{...second,quantity:0}]},1,tariff),{error:'stock'});
  const unknown={...second,available:false,availabilityKnown:false};
  assert.equal(batchCartProduct({...data,variants:[first,unknown]},1,tariff).product.sourceVariantId,second.id);
});

test('group options keep their own prices and photos while a single item can use the listing price',()=>{
  const unknown={...second,price:undefined};
  assert.equal(batchOptions({...data,variants:[first,unknown]})[1].price,undefined);
  assert.deepEqual(batchCartProduct({...data,variants:[first,unknown]},1,tariff),{error:'price'});
  assert.deepEqual(batchCartProduct({...data,variants:[unknown]},0,tariff),{error:'price'});
  assert.deepEqual(batchOptionGallery({...data,colorwayImages:[]},second),[]);
  const item={...data,variantScope:'item',variants:[{...first,price:undefined}]};
  assert.equal(batchCartProduct(item,0,tariff).product.sourcePrice,data.price);
});
