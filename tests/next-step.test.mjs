import test from 'node:test';
import assert from 'node:assert/strict';
import {products,blank,addToCart,cartSignature,checkoutCart as checkoutCore,confirmDemoPayment,cancelOrder} from '../lib/market/domain.ts';
import {customsVersion} from '../lib/market/world.ts';
import {nextStepOf,pendingApprovalOf,pendingPaymentOf} from '../lib/market/next-step.ts';
import {groupOrders} from '../lib/market/order-groups.ts';

const checkoutCart=(s,key,sig,balance,now)=>checkoutCore(s,key,sig,balance,now,customsVersion);
// One checkout waiting for its payment (the request is placed, the payment is still "pending").
const requested=()=>{const s=addToCart(blank(),products[0],products[0].variants[0],1000);return checkoutCart(s,'req-1',cartSignature(s.cart),false,1001)};
const withExtra=(s,id)=>({...s,orders:s.orders.map(o=>o.id===id?{...o,extraCharges:[{id:'x1',amount:50000,reason:'store shipping',status:'pending',createdAt:1100}]}:o)});

test('nothing waits on an empty account',()=>{
 assert.equal(nextStepOf(blank()),null);
});

test('a cart alone is the next step, with its item count',()=>{
 let s=addToCart(blank(),products[0],products[0].variants[0],1000);
 s=addToCart(s,products[1],products[1].variants[0],1001);
 const items=s.cart.reduce((sum,item)=>sum+item.quantity,0);
 assert.deepEqual(nextStepOf(s),{kind:'cart',items});
});

test('a checkout waiting for payment comes before the cart',()=>{
 let s=requested();
 const order=s.orders[0];
 assert.equal(order.payment.status,'pending');
 s=addToCart(s,products[2],products[2].variants[0],1500);
 const step=nextStepOf(s);
 assert.equal(step.kind,'payment');
 assert.equal(step.orderId,order.id);
 assert.equal(step.name,order.product.name);
 assert.equal(step.items,order.quantity);
 assert.equal(pendingPaymentOf(groupOrders(s.orders)).order.id,order.id);
});

test('a decision on an extra charge comes before the payment',()=>{
 const base=requested();
 const s=withExtra(base,base.orders[0].id);
 assert.equal(pendingApprovalOf(s.orders).id,base.orders[0].id);
 const step=nextStepOf(s);
 assert.equal(step.kind,'approval');
 assert.equal(step.orderId,base.orders[0].id);
});

test('a paid order in progress needs nothing; a cancelled unpaid request is not a payment to finish',()=>{
 const fresh=requested();
 const paid=confirmDemoPayment(fresh,fresh.orders[0].id,1002);
 assert.equal(nextStepOf(paid),null);
 const base=requested();
 const cancelled=cancelOrder(base,base.orders[0].id,1003);
 assert.ok(cancelled.orders[0].cancelled);
 assert.equal(pendingPaymentOf(groupOrders(cancelled.orders)),undefined);
 assert.equal(nextStepOf(cancelled),null);
});
