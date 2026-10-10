import test from 'node:test';
import assert from 'node:assert/strict';
import {products,blank,addToCart,cartSignature,checkoutCart,setCartServices,setCartSelection,renewCart,serviceFeesOf,upgradePricing,pricingSchema,tariff,stateSchema} from '../lib/market/domain.ts';
import {applyAction} from '../lib/market/actions.ts';
import {orderFinance} from '../lib/market/finance.ts';
import {feeLines} from '../lib/market/projection.ts';
import {customsVersion} from '../lib/market/world.ts';

// Owner, 10.10.2026: parcel insurance is 2% of the parcel's goods, 3% once the parcel is worth more than $200,
// chosen per store parcel in the cart and paid with the order.
const nike={...products[0],id:'nike-pegasus',name:'Pegasus',sourceUrl:'https://www.nike.com/t/pegasus',shippingKnown:true};
const zara={...products[2],id:'zara-coat',sourceUrl:'https://www.zara.com/coat',shippingKnown:true};
const insurance=tariff.serviceCatalog.find(service=>service.id==='shipping-insurance');
const withSizes=(count)=>{let s=blank();for(const size of nike.variants.slice(0,count))s=addToCart(s,nike,size,1000);return addToCart(s,zara,zara.variants[0],1000)};
const insure=(s,lines)=>lines.reduce((state,line)=>setCartServices(state,line.id,['shipping-insurance']),s);
const nikeLines=s=>s.cart.filter(line=>line.product.id===nike.id);

test('insurance is on by default: 2% of the parcel goods, 3% when the parcel is worth more than $200',()=>{
 assert.equal(insurance.enabled,true);assert.equal(insurance.pricingMode,'value-percent');
 assert.equal(insurance.valuePercent,0.02);assert.equal(insurance.valuePercentHigh,0.03);assert.equal(insurance.valueThresholdUsd,200);
 // One size, $99: 2%.
 let s=withSizes(1);const before=s.cart[0].quote.total;
 s=insure(s,nikeLines(s));
 const line=s.cart[0];
 assert.deepEqual(line.quote.serviceFees,[{id:'shipping-insurance',amount:Math.round(line.quote.merchandise*0.02),rate:0.02}]);
 assert.equal(line.quote.total,before+serviceFeesOf(line.quote));
 // Another store's parcel is not insured by this choice.
 assert.equal(s.cart.find(item=>item.product.id===zara.id).quote.serviceFees,undefined);
 // Three sizes, $297: the whole parcel takes 3%, each line on its own goods.
 const three=withSizes(3);
 // Ticking it on one size insures the whole parcel.
 const big=insure(three,[nikeLines(three)[0]]);
 for(const item of nikeLines(big))assert.deepEqual(item.quote.serviceFees,[{id:'shipping-insurance',amount:Math.round(item.quote.merchandise*0.03),rate:0.03}]);
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
 // $99 checked out: 2%, not the 3% of the whole $297 model.
 assert.equal(nikeLines(s)[0].quote.serviceFees[0].rate,0.02);
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
 const switchedOff={...insurance,enabled:false};
 assert.equal(upgradePricing(pricingSchema.parse({...tariff,serviceCatalog:[switchedOff]})).serviceCatalog[0].enabled,false);
});
