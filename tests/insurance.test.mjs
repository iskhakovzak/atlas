import test from 'node:test';
import assert from 'node:assert/strict';
import {products,blank,addToCart,cartSignature,checkoutCart,setCartServices,setCartSelection,renewCart,serviceFeesOf,insuredDeliveryOf,upgradePricing,pricingSchema,tariff,stateSchema} from '../lib/market/domain.ts';
import {applyAction} from '../lib/market/actions.ts';
import {serviceDescription} from '../lib/market/domain.ts';
import {orderFinance} from '../lib/market/finance.ts';
import {feeLines} from '../lib/market/projection.ts';
import {customsVersion} from '../lib/market/world.ts';

// Owner, 3.11.2026: the safe-arrival guarantee is 3.9% of the parcel's goods and delivery for every parcel, at least
// 25 000 soum per store parcel, chosen per store parcel in the cart and paid with the order.
const nike={...products[0],id:'nike-pegasus',name:'Pegasus',sourceUrl:'https://www.nike.com/t/pegasus',shippingKnown:true};
const zara={...products[2],id:'zara-coat',sourceUrl:'https://www.zara.com/coat',shippingKnown:true};
const insurance=tariff.serviceCatalog.find(service=>service.id==='shipping-insurance');
const withSizes=(count)=>{let s=blank();for(const size of nike.variants.slice(0,count))s=addToCart(s,nike,size,1000);return addToCart(s,zara,zara.variants[0],1000)};
const insure=(s,lines)=>lines.reduce((state,line)=>setCartServices(state,line.id,['shipping-insurance']),s);
const nikeLines=s=>s.cart.filter(line=>line.product.id===nike.id);

const fee=(line,rate)=>{const delivery=insuredDeliveryOf(line.quote);return {id:'shipping-insurance',amount:Math.round((line.quote.merchandise+delivery)*rate),rate,delivery}};

test('the guarantee is on by default: 3.9% of the parcel goods and delivery, at least 25 000 soum a parcel',()=>{
 assert.equal(insurance.enabled,true);assert.equal(insurance.pricingMode,'value-percent');
 assert.equal(insurance.valuePercent,0.039);assert.equal(insurance.valuePercentHigh,undefined);assert.equal(insurance.valueThresholdUsd,undefined);assert.equal(insurance.valueMinimumUzs,25000);
 // One size, $99 with its delivery: 3.9% of goods and delivery, well over the minimum.
 let s=withSizes(1);const before=s.cart[0].quote.total;
 s=insure(s,nikeLines(s));
 const line=s.cart[0];
 assert.ok(insuredDeliveryOf(line.quote)>0);
 assert.deepEqual(line.quote.serviceFees,[fee(line,0.039)]);assert.ok(serviceFeesOf(line.quote)>25000);
 assert.equal(line.quote.total,before+serviceFeesOf(line.quote));
 // Another store's parcel is not insured by this choice.
 assert.equal(s.cart.find(item=>item.product.id===zara.id).quote.serviceFees,undefined);
 // Three sizes: the same 3.9% on each line's own goods and delivery, however much the parcel is worth.
 const three=withSizes(3);
 // Ticking it on one size insures the whole parcel.
 const big=insure(three,[nikeLines(three)[0]]);
 for(const item of nikeLines(big))assert.deepEqual(item.quote.serviceFees,[fee(item,0.039)]);
});

test('a cheap parcel pays the 25 000 soum minimum, split over its lines by goods and delivery',()=>{
 const socks={...nike,id:'nike-socks',name:'Socks',sourceUrl:'https://www.nike.com/t/socks',usd:4,weight:0.1,boxedWeight:0.1};
 let s=blank();for(const size of socks.variants.slice(0,2))s=addToCart(s,socks,size,1000);
 s=insure(s,s.cart);
 const lines=s.cart;
 const bases=lines.map(line=>line.quote.merchandise+insuredDeliveryOf(line.quote));
 assert.ok(bases.reduce((sum,base)=>sum+Math.round(base*0.039),0)<25000,'3.9% alone is under the minimum');
 const fees=lines.map(line=>line.quote.serviceFees[0]);
 assert.equal(fees.reduce((sum,item)=>sum+item.amount,0),25000);
 for(const item of fees)assert.equal(item.rate,0.039);
 const total=bases[0]+bases[1];
 assert.equal(fees[0].amount,Math.round(25000*bases[0]/total));
 assert.equal(fees[1].amount,25000-fees[0].amount);
});

test('switching insurance off takes the fee out of the total; renewing the cart keeps the choice and its fee',()=>{
 let s=withSizes(1);const before=s.cart[0].quote.total;
 s=insure(s,nikeLines(s));
 const insured=s.cart[0].quote.total;assert.ok(insured>before);
 const renewed=renewCart(s,2000);
 assert.equal(renewed.cart[0].quote.total,insured);assert.equal(serviceFeesOf(renewed.cart[0].quote),serviceFeesOf(s.cart[0].quote));
 s=setCartServices(s,s.cart[0].id,[]);
 assert.equal(s.cart[0].quote.total,before);assert.equal(s.cart[0].quote.serviceFees,undefined);
});

test('a size left for later is its own parcel: the insured rate follows what is checked out',()=>{
 let s=withSizes(3);s=insure(s,nikeLines(s));
 const lines=nikeLines(s);
 s=setCartSelection(s,lines.slice(1).map(line=>line.id),false,1500);
 // The size checked out pays on its own goods and delivery; the sizes left for later are a parcel of their own.
 const out=nikeLines(s)[0];
 assert.deepEqual(out.quote.serviceFees,[fee(out,0.039)]);
});

test('the parcel action insures every size at once and the order carries the insurance paid with it',()=>{
 let s=withSizes(2);const ids=nikeLines(s).map(line=>line.id);
 s=applyAction(s,{type:'cart-services',id:ids[0],ids,serviceIds:['shipping-insurance']},false,tariff);
 const fees=nikeLines(s).reduce((sum,line)=>sum+serviceFeesOf(line.quote),0);
 assert.ok(fees>0);
 const total=s.cart.reduce((sum,line)=>sum+line.quote.total,0);
 s=checkoutCart(s,'insured',cartSignature(s.cart),false,1500,customsVersion);
 assert.equal(s.orders.reduce((sum,order)=>sum+order.quote.total,0),total);
 const requests=s.orders.flatMap(order=>order.warehouseServiceRequests??[]).filter(request=>request.serviceId==='shipping-insurance');
 assert.equal(requests.length,1,'one insurance record for the parcel, not one per size');
 assert.equal(requests[0].status,'completed');assert.equal(requests[0].quotedAmount,fees);assert.equal(requests[0].pricingMode,'value-percent');
 const insuredOrder=s.orders.find(order=>serviceFeesOf(order.quote)>0);
 assert.ok(insuredOrder.history.some(entry=>entry.code==='insured'));
 // In the books it is Atlas service income, and the projection has its own fee line.
 const finance=orderFinance(insuredOrder,'c1');
 assert.equal(finance.services,serviceFeesOf(insuredOrder.quote));
 assert.ok(feeLines(insuredOrder).some(([,kind,,amount])=>kind==='insurance'&&amount===serviceFeesOf(insuredOrder.quote)));
 // The saved state reads back with the fees.
 assert.deepEqual(stateSchema.parse(JSON.parse(JSON.stringify(s))).orders[0].quote.serviceFees,s.orders[0].quote.serviceFees);
});

test('checkout refuses a line whose insurance fee does not match the parcel',()=>{
 let s=withSizes(1);s=insure(s,nikeLines(s));
 const tampered={...s,cart:s.cart.map(line=>line.product.id===nike.id?{...line,quote:{...line.quote,total:line.quote.total-serviceFeesOf(line.quote),serviceFees:undefined}}:line)};
 assert.throws(()=>checkoutCart(tampered,'tampered',cartSignature(tampered.cart),false,1500,customsVersion),/Корзина пересчитана/);
});

test('a catalog saved while insurance was locked gets the owner terms; an operator choice is kept',()=>{
 const locked={...insurance,title:{ru:'Страхование отправления',uz:'Jo‘natmani sug‘urtalash',en:'Shipment insurance'},description:{ru:'Недоступно, пока не подтверждены страховщик, покрытие, исключения и порядок выплат.',uz:'x',en:'x'},requestStage:'warehouse',pricingMode:'operator-quote',enabled:false,valuePercent:undefined,valuePercentHigh:undefined,valueThresholdUsd:undefined};
 const saved=pricingSchema.parse({...tariff,serviceCatalog:[locked]});
 const upgraded=upgradePricing(saved).serviceCatalog.find(service=>service.id==='shipping-insurance');
 assert.equal(upgraded.enabled,true);assert.equal(upgraded.pricingMode,'value-percent');
 // Replaced rates saved before 3.11.2026 — the first 2% / 3% above $200 and the 10.10.2026 2.9% / 3.9% above $200 — become
 // 3.9% for every parcel with the 25 000 soum minimum; other rates stay.
 for(const saved of [{valuePercent:0.02,valuePercentHigh:0.03,valueThresholdUsd:200},{valuePercent:0.029,valuePercentHigh:0.039,valueThresholdUsd:200}]){
  const next=upgradePricing(pricingSchema.parse({...tariff,serviceCatalog:[{...insurance,...saved,valueMinimumUzs:undefined}]})).serviceCatalog[0];
  assert.deepEqual([next.valuePercent,next.valuePercentHigh,next.valueThresholdUsd,next.valueMinimumUzs],[0.039,undefined,undefined,25000]);
 }
 const own=upgradePricing(pricingSchema.parse({...tariff,serviceCatalog:[{...insurance,valuePercent:0.025,valuePercentHigh:0.035,valueThresholdUsd:200,valueMinimumUzs:undefined}]})).serviceCatalog[0];
 assert.deepEqual([own.valuePercent,own.valuePercentHigh,own.valueMinimumUzs],[0.025,0.035,undefined]);
 const switchedOff={...insurance,enabled:false};
 assert.equal(upgradePricing(pricingSchema.parse({...tariff,serviceCatalog:[switchedOff]})).serviceCatalog[0].enabled,false);
});

test('a saved "insurance" wording becomes the Atlas safe-arrival guarantee (13.10.2026); rates and switch stay',()=>{
 const old={...insurance,title:{ru:'Страхование посылки',uz:'Posilkani sug‘urtalash',en:'Parcel insurance'},description:{ru:'100 % возмещения. Без страховки: $15 за кг.',uz:'x',en:'x'},valuePercent:0.025,valuePercentHigh:0.035,enabled:false};
 const renamed=upgradePricing(pricingSchema.parse({...tariff,serviceCatalog:[old]})).serviceCatalog[0];
 assert.deepEqual(renamed.title,{ru:'Гарантия сохранности Atlas',uz:'Atlas saqlash kafolati',en:'Atlas safe-arrival guarantee'});
 assert.match(renamed.description.ru,/не страхование/);
 assert.deepEqual([renamed.valuePercent,renamed.valuePercentHigh,renamed.enabled],[0.025,0.035,false]);
 assert.equal(insurance.title.ru,'Гарантия сохранности Atlas');
});

test('a service description keeps a number on one line with its percent sign',()=>{
 const service={description:{ru:'100 % возмещения; 2,9 % от цены',uz:'shikastlanishda 100 % qoplanadi',en:'100% compensation'}};
 assert.equal(serviceDescription(service,'ru'),'100\u00a0% возмещения; 2,9\u00a0% от цены');
 assert.equal(serviceDescription(service,'uz'),'shikastlanishda 100\u00a0% qoplanadi');
 assert.equal(serviceDescription(service,'en'),'100% compensation');
});
