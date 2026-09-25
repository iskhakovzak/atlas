import test from 'node:test';
import assert from 'node:assert/strict';
import {products,tariff,pricingSchema,quote,price,blank,parseState,addToCart,changeQuantity,cartSignature,checkoutCart as checkoutCore,advanceOrder,receiveOrder,approveExtra,cancelOrder,balanceOf,renewCart,validateSource,markNotificationsRead,confirmDemoPayment,updateCommunication,assignOrder,addStaffNote,setParcel,confirmIdentity,submitDeclarationPreview,clearIdentity,inspectWarehouseOrder,createChangeRequest,respondToChangeRequest,orderPayable,validateServiceCatalog} from '../lib/market/domain.ts';
import {applyAction} from '../lib/market/actions.ts';
import {defaultPolicy} from '../lib/market/policy.ts';
import {customsVersion} from '../lib/market/world.ts';
const checkoutCart=(s,key,sig,balance,now)=>checkoutCore(s,key,sig,balance,now,customsVersion);
const prepare=()=>{let s=addToCart(blank(),products[0],'US 9',1000);s=checkoutCart(s,'purchase-1',cartSignature(s.cart),false,1001);return confirmDemoPayment(s,s.orders[0].id,1002)};
const warehouse=()=>{let s=prepare();const id=s.orders[0].id;s=advanceOrder(s,id,0);s=advanceOrder(s,id,1);return inspectWarehouseOrder(s,id,{condition:'ok',quantityReceived:1,notes:'',services:['photo'],packageGroup:'BOX-1'},1200)};
test('pricing uses full delivered totals and validated quantities',()=>{
const p=price(99,2.1,2);assert.equal(p.total,p.merchandise+p.service+p.shipping+p.reserve);assert.equal(p.weight,4.2);assert.throws(()=>price(99,2.1,0));assert.throws(()=>price(99,2.1,11));assert.throws(()=>price(NaN,2));assert.throws(()=>price(1,Infinity));
assert.equal(price(10,.4).weight,1);assert.equal(price(10,.4).shipping,tariff.perKg);
const configured=price(100,1,1,5,{...tariff,buyoutFee:.03,conversionFee:.02,deliveryMargin:.1,optionalServices:7000});assert.equal(configured.shipping,90000);assert.equal(configured.deliveryMargin,9000);assert.equal(configured.total,configured.merchandise+configured.service+configured.buyout+configured.conversion+configured.shipping+configured.deliveryMargin+configured.optionalServices+configured.reserve+configured.sourceShipping);
});
test('legacy state retains old orders and credits while adding cart defaults',()=>{
const q=quote(99,2.1,1000);delete q.perKg;delete q.divisor;
const old={orders:[{id:'OLD',product:products[0],variant:'US 9',quote:q,status:0,createdAt:1000,history:[]}],entries:[{id:'e',orderId:'OLD',at:1000,amount:100000,debit:'shipping-reserve',credit:'customer-credit',description:'Возврат'}]};
const migrated=parseState(JSON.stringify(old));assert.equal(migrated.orders[0].id,'OLD');assert.equal(migrated.orders[0].quantity,1);assert.equal(balanceOf(migrated),100000);assert.deepEqual(migrated.cart,[]);assert.throws(()=>parseState('{bad'));assert.throws(()=>parseState(JSON.stringify({orders:[{}],entries:[]})));
});
test('cart merges the same variant, separates variants and preserves source URL',()=>{
let s=addToCart(blank(),products[0],'US 9',1000);s=addToCart(s,products[0],'US 9',1000);s=addToCart(s,products[0],'US 8',1000);assert.equal(s.cart.length,2);assert.equal(s.cart[0].quantity,2);
assert.throws(()=>changeQuantity(s,s.cart[0].id,11));
const p={...products[1],id:'source',sourceUrl:'https://example.com/product',shippingKnown:true};s=addToCart(s,p,p.variants[0],1000);s=checkoutCart(s,'multi',cartSignature(s.cart),false,1001);assert.equal(s.orders.length,3);assert.equal(s.orders[2].product.sourceUrl,p.sourceUrl);
});
test('checkout rejects expired or changed quotes and is idempotent',()=>{
let s=addToCart(blank(),products[0],'US 9',1000);const sig=cartSignature(s.cart);assert.throws(()=>checkoutCart(s,'a',sig,false,901000));const changed=changeQuantity(s,s.cart[0].id,2,1001);assert.throws(()=>checkoutCart(changed,'a',sig,false,1002));
s=renewCart(s,2000);s=checkoutCart(s,'a',cartSignature(s.cart),false,2001);assert.equal(s.cart.length,0);assert.equal(checkoutCart(s,'a',sig,false,2002).orders.length,1);
});
test('settlement keeps quote immutable, refunds once and holds its original tariff',()=>{
let s=warehouse();const id=s.orders[0].id;const original=JSON.stringify(s.orders[0].quote);const previous=tariff.perKg;tariff.perKg=120000;
try{s=receiveOrder(s,id,[1.8,30,20,15]);assert.equal(s.orders[0].settlement.shipping,162000);assert.equal(balanceOf(s),64800);assert.equal(JSON.stringify(s.orders[0].quote),original);const again=receiveOrder(s,id,[1.8,30,20,15]);assert.equal(again.entries.length,2);assert.equal(balanceOf(again),64800)}finally{tariff.perKg=previous}
});
test('dimensional weight dominates and extra payment blocks shipment until approved',()=>{
let s=warehouse();const id=s.orders[0].id;s=receiveOrder(s,id,[1,50,50,50]);assert.equal(s.orders[0].settlement.chargeableWeight,25);assert.equal(balanceOf(s),0);assert.throws(()=>advanceOrder(s,id,3));assert.throws(()=>approveExtra(s,id,1));
s=approveExtra(s,id,s.orders[0].settlement.extra);s=setParcel(s,id,'Atlas Cargo','ATLAS-001','WH-TAS-01');s=advanceOrder(s,id,3);assert.equal(s.orders[0].status,4);assert.throws(()=>advanceOrder(s,id,3));s=advanceOrder(s,id,4);assert.throws(()=>advanceOrder(s,id,5));
});
test('cancel returns full simulated payment once and credits fund future orders',()=>{
let s=prepare();const id=s.orders[0].id,full=s.orders[0].quote.total;s=cancelOrder(s,id);assert.equal(balanceOf(s),full);s=cancelOrder(s,id);assert.equal(s.entries.length,2);assert.equal(s.orders[0].payment.status,'refunded');assert.throws(()=>advanceOrder(s,id,0));s=addToCart(s,products[2],products[2].variants[0],2000);s=checkoutCart(s,'next',cartSignature(s.cart),true,2001);const next=s.orders[0];assert.equal(next.balanceUsed,next.quote.total);assert.equal(balanceOf(s),full-next.quote.total);s=cancelOrder(s,next.id);assert.equal(balanceOf(s),full);
let purchased=prepare();purchased=advanceOrder(purchased,purchased.orders[0].id,0);assert.throws(()=>cancelOrder(purchased,purchased.orders[0].id));
});
test('URLs reject unsafe schemes and credential-bearing source links',()=>{
assert.equal(validateSource('https://www.example.com/product'),'https://www.example.com/product');for(const url of ['javascript:alert(1)','http://example.com/x','https://user:pass@example.com/x','https://127.0.0.1/x','text'])assert.throws(()=>validateSource(url));
});
test('managed pricing affects new quotes while old orders stay immutable',()=>{
const managed={...tariff,fx:13000,perKg:100000,version:'managed-test',updatedAt:2000};let state=addToCart(blank(),products[0],'US 9',1000,managed);assert.equal(state.cart[0].quote.tariffVersion,'managed-test');assert.equal(state.cart[0].quote.fx,13000);state=checkoutCart(state,'managed',cartSignature(state.cart),false,1001);const original=JSON.stringify(state.orders[0].quote);managed.fx=14000;assert.equal(JSON.stringify(state.orders[0].quote),original);
});
test('dispatch-country service overrides affect new quote lines and old pricing records inherit base rates',()=>{
const legacy=pricingSchema.parse({...tariff,countryOverrides:undefined});assert.deepEqual(legacy.countryOverrides,{});
const managed={...tariff,perKg:90000,margin:.12,countryOverrides:{'США':{margin:.2,buyoutFee:.03,conversionFee:.01,deliveryMargin:.05,perKg:120000,reserve:.1,optionalServices:5000}}};
const us=addToCart(blank(),products[0],products[0].variants[0],1000,managed).cart[0].quote;
assert.equal(us.service,Math.round(us.merchandise*.2));assert.equal(us.buyout,Math.round(us.merchandise*.03));assert.equal(us.conversion,Math.round(us.merchandise*.01));assert.equal(us.shipping,Math.ceil(us.weight*120000));assert.equal(us.reserve,Math.ceil(us.shipping*.1));assert.equal(us.deliveryMargin,Math.round(us.shipping*.05));assert.equal(us.optionalServices,5000);
const de=addToCart(blank(),products[1],products[1].variants[0],1001,managed).cart[0].quote;
assert.equal(de.service,Math.round(de.merchandise*.12));assert.equal(de.shipping,90000);assert.equal(de.buyout,0);
});
test('warehouse service catalogue remains backward compatible and validates unsafe offers',()=>{
const legacy=pricingSchema.parse({...tariff,serviceCatalog:undefined});assert.ok(legacy.serviceCatalog.some(service=>service.id==='content-photo'));assert.equal(legacy.serviceCatalog.find(service=>service.id==='shipping-insurance').enabled,false);
const oldCartItem={id:'old-cart',product:products[0],variant:'US 9',quantity:1,quote:quote(99,2.1,1000)};const restored=parseState(JSON.stringify({orders:[],entries:[],cart:[oldCartItem]}));assert.deepEqual(restored.cart[0].requestedServiceIds,[]);
assert.throws(()=>validateServiceCatalog([{...legacy.serviceCatalog.find(service=>service.id==='content-photo'),enabled:true,pricingMode:'fixed',feeUzs:0}]),/положительный базовый тариф/);
assert.throws(()=>validateServiceCatalog(legacy.serviceCatalog.map(service=>service.id==='shipping-insurance'?{...service,enabled:true}:service)),/Страхование нельзя включить/);
});
test('checkout snapshots optional warehouse requests without adding a charge or blocking buyout',()=>{
const selected={...tariff.serviceCatalog.find(service=>service.id==='content-photo'),enabled:true,pricingMode:'fixed',feeUzs:25000};const config={...tariff,version:'services-1',serviceCatalog:[selected]};
let state=addToCart(blank(),products[0],'US 9',1000,config);const before=cartSignature(state.cart);state=applyAction(state,{type:'cart-services',id:state.cart[0].id,serviceIds:[selected.id]},false,config);assert.notEqual(cartSignature(state.cart),before);assert.throws(()=>applyAction(state,{type:'cart-services',id:state.cart[0].id,serviceIds:['unknown-service']},false,config),/больше недоступна/);
state=checkoutCore(state,'services-cart',cartSignature(state.cart),false,1001,customsVersion,undefined,undefined,undefined,config);const order=state.orders[0];assert.equal(order.warehouseServiceRequests[0].origin,'checkout');assert.equal(order.warehouseServiceRequests[0].status,'requested');assert.equal(orderPayable(order),order.quote.total);state=confirmDemoPayment(state,order.id,1002);state=advanceOrder(state,order.id,0,1003);assert.equal(state.orders[0].status,1);
});
test('warehouse services require operator price confirmation, customer approval and operator completion',()=>{
const fixed={...tariff.serviceCatalog.find(service=>service.id==='detailed-photos'),id:'extra-photos',requestStage:'warehouse',pricingMode:'fixed',feeUzs:10000,countryPrices:{'США':15000},enabled:true};const config={...tariff,serviceCatalog:[fixed]};
let state=addToCart(blank(),products[0],'US 9',1000,config);state=checkoutCore(state,'warehouse-service',cartSignature(state.cart),false,1001,customsVersion,undefined,undefined,undefined,config);let id=state.orders[0].id;state=confirmDemoPayment(state,id,1002);state=advanceOrder(state,id,0,1003);state=advanceOrder(state,id,1,1004);state=inspectWarehouseOrder(state,id,{condition:'ok',quantityReceived:1,notes:'',services:[],packageGroup:''},1005);
state=applyAction(state,{type:'warehouse-service-request',id,serviceId:fixed.id,units:2},false,config);let request=state.orders[0].warehouseServiceRequests[0];assert.equal(request.status,'requested');assert.equal(request.units,2);assert.equal(request.feeUzs,15000);assert.equal(state.orders[0].changeRequests,undefined);assert.throws(()=>applyAction(state,{type:'warehouse-service-complete',id,requestId:request.id},false,config),/только оператору/);assert.throws(()=>receiveOrder(state,id,[1.8,30,20,15]),/завершите или отклоните/);
assert.throws(()=>applyAction(state,{type:'change-request-create',id,kind:'warehouse-service',title:'Дополнительные фото',reason:'Услуга согласована',warehouseServiceRequestId:request.id,amountDelta:29999},true,config),/не совпадает/);
state=applyAction(state,{type:'change-request-create',id,kind:'warehouse-service',title:'Дополнительные фото',reason:'Оператор проверил выполнимость и тариф',warehouseServiceRequestId:request.id,amountDelta:30000},true,config);request=state.orders[0].warehouseServiceRequests[0];assert.equal(request.status,'quoted');const change=state.orders[0].changeRequests[0];state=applyAction(state,{type:'change-request-respond',id,requestId:change.id,decision:'approved',expectedAmountDelta:30000},false,config);assert.equal(state.orders[0].warehouseServiceRequests[0].status,'approved');assert.equal(orderPayable(state.orders[0]),state.orders[0].quote.total+30000);
state=applyAction(state,{type:'warehouse-service-complete',id,requestId:request.id},true,config);assert.equal(state.orders[0].warehouseServiceRequests[0].status,'completed');state=receiveOrder(state,id,[1.8,30,20,15]);assert.equal(state.orders[0].status,3);
});
test('quote-only warehouse service can be declined before the parcel is weighed',()=>{
const offer={...tariff.serviceCatalog.find(service=>service.id==='visual-inspection'),enabled:true};const config={...tariff,serviceCatalog:[offer]};let state=addToCart(blank(),products[0],'US 9',1000,config);state=checkoutCore(state,'warehouse-quote',cartSignature(state.cart),false,1001,customsVersion,undefined,undefined,undefined,config);const id=state.orders[0].id;state=confirmDemoPayment(state,id,1002);state=advanceOrder(state,id,0,1003);state=advanceOrder(state,id,1,1004);state=inspectWarehouseOrder(state,id,{condition:'ok',quantityReceived:1,notes:'',services:[],packageGroup:''},1005);state=applyAction(state,{type:'warehouse-service-request',id,serviceId:offer.id,units:1},false,config);const serviceRequest=state.orders[0].warehouseServiceRequests[0];state=applyAction(state,{type:'change-request-create',id,kind:'warehouse-service',title:offer.title.ru,reason:'Оператор проверил возможность услуги',warehouseServiceRequestId:serviceRequest.id,amountDelta:40000},true,config);const change=state.orders[0].changeRequests[0];state=applyAction(state,{type:'change-request-respond',id,requestId:change.id,decision:'declined',expectedAmountDelta:40000},false,config);assert.equal(state.orders[0].warehouseServiceRequests[0].status,'declined');state=receiveOrder(state,id,[1.8,30,20,15]);assert.equal(state.orders[0].status,3);
});
test('operator can report a warehouse service unavailable without charging or blocking weighing',()=>{
const offer={...tariff.serviceCatalog.find(service=>service.id==='repack'),enabled:true};const config={...tariff,serviceCatalog:[offer]};let state=addToCart(blank(),products[0],'US 9',1000,config);state=checkoutCore(state,'unavailable-service',cartSignature(state.cart),false,1001,customsVersion,undefined,undefined,undefined,config);const id=state.orders[0].id;state=confirmDemoPayment(state,id,1002);state=advanceOrder(state,id,0,1003);state=advanceOrder(state,id,1,1004);state=inspectWarehouseOrder(state,id,{condition:'ok',quantityReceived:1,notes:'',services:[],packageGroup:''},1005);state=applyAction(state,{type:'warehouse-service-request',id,serviceId:offer.id,units:1},false,config);const request=state.orders[0].warehouseServiceRequests[0];assert.throws(()=>applyAction(state,{type:'warehouse-service-decline',id,requestId:request.id,reason:'Нет доступа к складу'},false,config),/только оператору/);state=applyAction(state,{type:'warehouse-service-decline',id,requestId:request.id,reason:'Склад не выполняет этот вид упаковки'},true,config);assert.equal(state.orders[0].warehouseServiceRequests[0].status,'declined');assert.equal(orderPayable(state.orders[0]),state.orders[0].quote.total);state=receiveOrder(state,id,[1.8,30,20,15]);assert.equal(state.orders[0].status,3);
});
test('operator changes require an exact customer decision and preserve the original quote',()=>{
let s=prepare();const id=s.orders[0].id,original=JSON.stringify(s.orders[0].quote);s=createChangeRequest(s,id,{kind:'variant',title:'Другой размер',reason:'Выбранного размера нет',previousValue:'US 9',proposedValue:'US 10',amountDelta:25000},1300);const request=s.orders[0].changeRequests[0];assert.throws(()=>advanceOrder(s,id,0));assert.throws(()=>respondToChangeRequest(s,id,request.id,'approved',1));s=respondToChangeRequest(s,id,request.id,'approved',25000,1400);assert.equal(s.orders[0].variant,'US 10');assert.equal(orderPayable(s.orders[0]),s.orders[0].quote.total+25000);assert.equal(JSON.stringify(s.orders[0].quote),original);
});
test('operator progress creates customer notifications that can be marked read',()=>{
let state=prepare();const id=state.orders[0].id;state=advanceOrder(state,id,0,3000);assert.equal(state.notifications.length,2);assert.equal(state.notifications[0].orderId,id);assert.equal(state.notifications[0].read,false);state=markNotificationsRead(state);assert.equal(state.notifications[0].read,true);
});
test('pre-release checkout keeps delivery, payment, operations and message previews together',()=>{
const delivery={recipient:'Zakir',phone:'+998901234567',region:'Ташкент',city:'Ташкент',address:'ул. Амира Темура, 10',postalCode:'100000',comment:'Позвонить'};
let state=updateCommunication(blank(),{emailEnabled:true,smsEnabled:true,email:'zakir@example.com',phone:delivery.phone,language:'ru'});
state=addToCart(state,products[0],'US 9',1000);state=checkoutCore(state,'pre',cartSignature(state.cart),false,1001,customsVersion,delivery);const id=state.orders[0].id;
assert.equal(state.orders[0].delivery.city,'Ташкент');assert.equal(state.orders[0].payment.status,'pending');assert.throws(()=>advanceOrder(state,id,0));
state=confirmDemoPayment(state,id,1002);assert.equal(state.orders[0].payment.status,'paid');assert.equal(state.messageDeliveries.length,2);
state=assignOrder(state,id,'Закупки','Высокий',1003);state=addStaffNote(state,id,'Проверить размер','Оператор',1004);state=advanceOrder(state,id,0,1005);state=setParcel(state,id,'Atlas Cargo','ATLAS-001','WH-TAS-01',1006);
assert.equal(state.orders[0].assignment.priority,'Высокий');assert.equal(state.orders[0].staffNotes[0].text,'Проверить размер');assert.equal(state.orders[0].parcel.trackingNumber,'ATLAS-001');
});
test('confirmed passport data is masked and declaration is server-built from orders',()=>{
const delivery={recipient:'Anna Karimova',phone:'+998901234567',region:'Ташкент',city:'Ташкент',address:'ул. Навои, 10',postalCode:'100000',comment:''};
let state=addToCart(blank(),products[0],'US 9',1000);state=checkoutCore(state,'identity',cartSignature(state.cart),false,1001,customsVersion,delivery);const orderId=state.orders[0].id;
state=confirmIdentity(state,{documentId:'DOC-1',firstName:'ANNA',lastName:'KARIMOVA',birthDate:'1995-04-20',passportNumber:'AA1234567',nationality:'UZB'},Date.UTC(2026,8,10));
assert.equal(state.identityProfile.passportMasked,'•••• 4567');assert.equal(JSON.stringify(state).includes('AA1234567'),false);
state=submitDeclarationPreview(state,[orderId],2001);assert.equal(state.declarations[0].lines[0].orderId,orderId);assert.equal(state.declarations[0].delivery.city,'Ташкент');assert.equal(state.declarations[0].status,'submitted-preview');assert.equal(state.notifications[0].title,'Тестовая декларация подготовлена');
state=clearIdentity(state,'DOC-1');assert.equal(state.identityProfile,undefined);assert.throws(()=>submitDeclarationPreview(state,[orderId],2002));
});
test('managed restrictions reject blocked goods and oversized parties on the server',()=>{
const blocked={...defaultPolicy,blockedCategories:['Электроника']};assert.throws(()=>applyAction(blank(),{type:'cart-add',product:products[1],variant:products[1].variants[0]},false,tariff,blocked),/недоступна/);
let state=applyAction(blank(),{type:'cart-add',product:products[0],variant:products[0].variants[0]},false,tariff,{...defaultPolicy,maxCartLines:1});assert.throws(()=>applyAction(state,{type:'cart-add',product:products[2],variant:products[2].variants[0]},false,tariff,{...defaultPolicy,maxCartLines:1}),/до 1/);
assert.throws(()=>applyAction(blank(),{type:'cart-add',product:{...products[0],name:'Collectible weapon'},variant:products[0].variants[0]},false,tariff,defaultPolicy),/ручной проверки/);
});
