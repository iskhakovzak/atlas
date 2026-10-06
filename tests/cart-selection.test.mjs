import test from 'node:test';
import assert from 'node:assert/strict';
import {products,blank,addToCart,cartSignature,checkoutCart as checkoutCore,setCartSelection,setCartNote,setCartServices,storeParcelKey,parcelServiceUnits,checkoutLines,tariff} from '../lib/market/domain.ts';
import {actionSchema,applyAction} from '../lib/market/actions.ts';
import {customsVersion} from '../lib/market/world.ts';
const checkoutCart=(s,key,now)=>checkoutCore(s,key,cartSignature(s.cart),false,now,customsVersion);
const nike={...products[0],id:'nike-pegasus',name:'Pegasus',sourceUrl:'https://www.nike.com/t/pegasus',shippingKnown:true};
const other={...products[2],id:'zara-coat',sourceUrl:'https://www.zara.com/coat',shippingKnown:true};
// Three sizes of one model and one more product of the same store, plus a different store.
const cart=()=>{let s=blank();for(const size of nike.variants.slice(0,3))s=addToCart(s,nike,size,1000);return addToCart(s,other,other.variants[0],1000)};

test('a line left for later stays in the cart and the checkout takes only the ticked lines',()=>{
 let s=cart();const later=s.cart[2].id;
 s=setCartSelection(s,[later],false,1001);
 assert.equal(s.cart.find(i=>i.id===later).selected,false);
 assert.equal(checkoutLines(s.cart).length,3);
 s=checkoutCart(s,'part',1002);
 assert.equal(s.orders.length,3);
 assert.deepEqual(s.cart.map(i=>i.id),[later]);
 assert.ok(s.orders.every(o=>o.product.id!==later));
 // What was left for later is the next checkout: ticked again, not an empty selection.
 assert.equal(checkoutLines(s.cart).length,1);
});

test('nothing ticked: checkout is refused with a hint and the cart is kept',()=>{
 let s=cart();s=setCartSelection(s,s.cart.map(i=>i.id),false,1001);
 assert.throws(()=>checkoutCart(s,'none',1002),e=>e.code==='err_74');
 assert.equal(setCartSelection(s,[s.cart[0].id],false,1003),s,'an unchanged selection saves nothing');
});

test('the parcel being checked out is priced without the lines left for later',()=>{
 const all=cart();const nikeIds=all.cart.filter(i=>i.product.id===nike.id).map(i=>i.id);
 const alone=addToCart(blank(),nike,nike.variants[0],1000);
 const s=setCartSelection(all,nikeIds.slice(1),false,1001);
 // The first size now carries the parcel's shipping alone, as a cart with only it would.
 assert.equal(s.cart[0].quote.total,alone.cart[0].quote.total);
});

test('checkout services are asked once per store parcel, not per size',()=>{
 let s=cart();
 const nikeLines=s.cart.filter(i=>i.product.id===nike.id);
 for(const line of nikeLines)s=setCartServices(s,line.id,['content-photo','detailed-photos'],tariff,{'detailed-photos':4});
 s=checkoutCart(s,'svc',1002);
 const nikeOrders=s.orders.filter(o=>o.product.id===nike.id);
 const requests=nikeOrders.flatMap(o=>o.warehouseServiceRequests??[]);
 assert.equal(requests.filter(r=>r.serviceId==='content-photo').length,1);
 assert.equal(requests.find(r=>r.serviceId==='content-photo').units,1);
 assert.equal(requests.find(r=>r.serviceId==='detailed-photos').units,4);
 assert.deepEqual([...requests[0].parcelOrderIds].sort(),nikeOrders.map(o=>o.id).sort());
 assert.equal(s.orders.filter(o=>o.product.id===other.id).flatMap(o=>o.warehouseServiceRequests??[]).length,0);
});

test('a new size added to the parcel takes the parcel services',()=>{
 let s=addToCart(blank(),nike,nike.variants[0],1000);
 s=setCartServices(s,s.cart[0].id,['content-photo']);
 s=addToCart(s,nike,nike.variants[1],1001);
 assert.deepEqual(s.cart[1].requestedServiceIds,['content-photo']);
 assert.equal(storeParcelKey(s.cart[0]),storeParcelKey(s.cart[1]));
});

test('parcel service units: package once, item per piece, photos as typed',()=>{
 const lines=[{quantity:2,requestedServiceUnits:{photos:3}},{quantity:1}];
 assert.equal(parcelServiceUnits({id:'p',unit:'package'},lines),1);
 assert.equal(parcelServiceUnits({id:'i',unit:'item'},lines),3);
 assert.equal(parcelServiceUnits({id:'photos',unit:'photo'},lines),3);
});

test('cart-select action is validated and applied',()=>{
 const s=cart();
 const action=actionSchema.parse({type:'cart-select',ids:[s.cart[3].id],selected:false});
 const next=applyAction(s,action,false);
 assert.equal(checkoutLines(next.cart).length,3);
 assert.equal(actionSchema.safeParse({type:'cart-select',ids:[],selected:true}).success,false);
});

test('each size keeps its own note; a new size starts without one and joins the parcel services',()=>{
 let s=blank();for(const size of nike.variants.slice(0,2))s=addToCart(s,nike,size,1000);
 s=setCartNote(s,s.cart[0].id,'A');s=setCartNote(s,s.cart[1].id,'B');
 s=setCartServices(s,s.cart[0].id,['detailed-photos'],tariff,{'detailed-photos':3});
 s=addToCart(s,nike,nike.variants[2],1001);
 assert.equal(s.cart[2].note,undefined,'the new size has no note of its own');
 assert.deepEqual(s.cart[2].requestedServiceIds,s.cart[0].requestedServiceIds,'but gets the parcel services');
 s=checkoutCart(s,'notes',1002);
 assert.deepEqual(s.orders.map(o=>o.note),['A','B',undefined],'notes are not merged');
 const requests=s.orders.flatMap(o=>o.warehouseServiceRequests??[]).filter(r=>r.serviceId==='detailed-photos');
 assert.equal(requests.length,1,'one request for the parcel');
});
