import test from 'node:test';
import assert from 'node:assert/strict';
import {products,tariff,quote,price,settle,blank,parseState,addToCart,changeQuantity,cartSignature,checkoutCart,advanceOrder,receiveOrder,approveExtra,cancelOrder,balanceOf,renewCart,validateSource} from '../lib/market/domain.ts';
const prepare=()=>{const s=addToCart(blank(),products[0],'US 9',1000);return checkoutCart(s,'purchase-1',cartSignature(s.cart),false,1001)};
const warehouse=()=>{let s=prepare();const id=s.orders[0].id;s=advanceOrder(s,id,0);return advanceOrder(s,id,1)};
test('pricing uses full delivered totals and validated quantities',()=>{
const p=price(99,2.1,2);assert.equal(p.total,p.merchandise+p.service+p.shipping+p.reserve);assert.equal(p.weight,4.2);assert.throws(()=>price(99,2.1,0));assert.throws(()=>price(99,2.1,11));assert.throws(()=>price(NaN,2));assert.throws(()=>price(1,Infinity));
});
test('legacy state retains old orders and credits while adding cart defaults',()=>{
const q=quote(99,2.1,1000);delete q.perKg;delete q.divisor;
const old={orders:[{id:'OLD',product:products[0],variant:'US 9',quote:q,status:0,createdAt:1000,history:[]}],entries:[{id:'e',orderId:'OLD',at:1000,amount:100000,debit:'shipping-reserve',credit:'customer-credit',description:'Возврат'}]};
const migrated=parseState(JSON.stringify(old));assert.equal(migrated.orders[0].id,'OLD');assert.equal(migrated.orders[0].quantity,1);assert.equal(balanceOf(migrated),100000);assert.deepEqual(migrated.cart,[]);assert.throws(()=>parseState('{bad'));assert.throws(()=>parseState(JSON.stringify({orders:[{}],entries:[]})));
});
test('cart merges the same variant, separates variants and preserves source URL',()=>{
let s=addToCart(blank(),products[0],'US 9',1000);s=addToCart(s,products[0],'US 9',1000);s=addToCart(s,products[0],'US 8',1000);assert.equal(s.cart.length,2);assert.equal(s.cart[0].quantity,2);
assert.throws(()=>changeQuantity(s,s.cart[0].id,11));
const p={...products[1],id:'source',sourceUrl:'https://example.com/product'};s=addToCart(s,p,p.variants[0],1000);s=checkoutCart(s,'multi',cartSignature(s.cart),false,1001);assert.equal(s.orders.length,3);assert.equal(s.orders[2].product.sourceUrl,p.sourceUrl);
});
test('checkout rejects expired or changed quotes and is idempotent',()=>{
let s=addToCart(blank(),products[0],'US 9',1000);const sig=cartSignature(s.cart);assert.throws(()=>checkoutCart(s,'a',sig,false,901000));const changed=changeQuantity(s,s.cart[0].id,2,1001);assert.throws(()=>checkoutCart(changed,'a',sig,false,1002));
s=renewCart(s,2000);s=checkoutCart(s,'a',cartSignature(s.cart),false,2001);assert.equal(s.cart.length,0);assert.equal(checkoutCart(s,'a',sig,false,2002).orders.length,1);
});
test('settlement keeps quote immutable, refunds once and holds its original tariff',()=>{
let s=warehouse();const id=s.orders[0].id;const original=JSON.stringify(s.orders[0].quote);const previous=tariff.perKg;tariff.perKg=120000;
try{s=receiveOrder(s,id,[1.8,30,20,15]);assert.equal(s.orders[0].settlement.shipping,162000);assert.equal(balanceOf(s),64800);assert.equal(JSON.stringify(s.orders[0].quote),original);const again=receiveOrder(s,id,[1.8,30,20,15]);assert.equal(again.entries.length,1);assert.equal(balanceOf(again),64800)}finally{tariff.perKg=previous}
});
test('dimensional weight dominates and extra payment blocks shipment until approved',()=>{
let s=warehouse();const id=s.orders[0].id;s=receiveOrder(s,id,[1,50,50,50]);assert.equal(s.orders[0].settlement.chargeableWeight,25);assert.equal(balanceOf(s),0);assert.throws(()=>advanceOrder(s,id,3));assert.throws(()=>approveExtra(s,id,1));
s=approveExtra(s,id,s.orders[0].settlement.extra);s=advanceOrder(s,id,3);assert.equal(s.orders[0].status,4);assert.throws(()=>advanceOrder(s,id,3));s=advanceOrder(s,id,4);assert.throws(()=>advanceOrder(s,id,5));
});
test('cancel returns full simulated payment once and credits fund future orders',()=>{
let s=prepare();const id=s.orders[0].id,full=s.orders[0].quote.total;s=cancelOrder(s,id);assert.equal(balanceOf(s),full);s=cancelOrder(s,id);assert.equal(s.entries.length,1);assert.throws(()=>advanceOrder(s,id,0));s=addToCart(s,products[2],products[2].variants[0],2000);s=checkoutCart(s,'next',cartSignature(s.cart),true,2001);const next=s.orders[0];assert.equal(next.balanceUsed,next.quote.total);assert.equal(balanceOf(s),full-next.quote.total);s=cancelOrder(s,next.id);assert.equal(balanceOf(s),full);
let purchased=prepare();purchased=advanceOrder(purchased,purchased.orders[0].id,0);assert.throws(()=>cancelOrder(purchased,purchased.orders[0].id));
});
test('URLs reject unsafe schemes and credential-bearing source links',()=>{
assert.equal(validateSource('https://www.example.com/product'),'https://www.example.com/product');for(const url of ['javascript:alert(1)','http://example.com/x','https://user:pass@example.com/x','https://127.0.0.1/x','text'])assert.throws(()=>validateSource(url));
});
