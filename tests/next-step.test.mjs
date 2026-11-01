// "What waits for you" (owner, 1 November 2026): the home card, the profile's «Требует действия» and the toast after
// sign-in share one ranking — a decision (a доплата, then a change) > a payment > a recipient's passport > the cart —
// and one card language: plain words, the product by its name, the order number never in the main line.
import test from 'node:test';
import assert from 'node:assert/strict';
import {products,blank,addToCart,cartSignature,checkoutCart as checkoutCore,confirmDemoPayment,cancelOrder,saveDeliveryProfile} from '../lib/market/domain.ts';
import {customsVersion} from '../lib/market/world.ts';
import {nextStepOf,nextStepsOf,pendingApprovalOf,pendingPaymentOf} from '../lib/market/next-step.ts';
import {actionCopy,actionLines,actionToastOf,shortProductName} from '../lib/market/action-copy.ts';
import {groupOrders} from '../lib/market/order-groups.ts';

const profile={recipient:'Анна Каримова',phone:'+998 90 123 45 67',region:'Ташкент',city:'Ташкент',address:'ул. Навои, 15',postalCode:'100000',comment:''};
const checkoutCart=(s,key,sig,balance,now)=>checkoutCore(s,key,sig,balance,now,customsVersion,undefined,s.deliveryProfiles[0]?.id);
const nike={...products[0],id:'nike-am90',name:'Nike Air Max 90 Essential Men’s Shoes'};
// One checkout waiting for its payment (the request is placed, the payment is still "pending").
const requested=(product=nike)=>{const s=addToCart(saveDeliveryProfile(blank(),profile,'Дом'),product,product.variants[0],1000);return checkoutCart(s,'req-1',cartSignature(s.cart),false,1001)};
const withExtra=(s,id)=>({...s,orders:s.orders.map(o=>o.id===id?{...o,extraCharges:[{id:'x1',amount:45000,amountUsd:3.5,reason:'store shipping',status:'pending',requestedAt:1100}]}:o)});
const paidWaitingPassport=()=>{const s=requested();return confirmDemoPayment(s,s.orders[0].id,1002)};

test('nothing waits on an empty account',()=>{
 assert.equal(nextStepOf(blank()),null);
 assert.deepEqual(nextStepsOf(blank()),[]);
});

test('a cart alone is the next step, with its item count',()=>{
 let s=addToCart(blank(),products[0],products[0].variants[0],1000);
 s=addToCart(s,products[1],products[1].variants[0],1001);
 const items=s.cart.reduce((sum,item)=>sum+item.quantity,0);
 const step=nextStepOf(s);
 assert.equal(step.kind,'cart');
 assert.equal(step.items,items);
 assert.equal(step.href,'/cart');
 assert.equal(actionLines(step,'ru').button,'Оформить заказ');
});

test('a checkout waiting for payment comes before the cart, with its one amount',()=>{
 let s=requested();
 const order=s.orders[0];
 assert.equal(order.payment.status,'pending');
 s=addToCart(s,products[2],products[2].variants[0],1500);
 const step=nextStepOf(s);
 assert.equal(step.kind,'payment');
 assert.equal(step.orderId,order.id);
 assert.equal(step.product.name,order.product.name);
 assert.equal(step.href,'/orders#'+encodeURIComponent(order.id));
 assert.ok(step.amount>0);
 assert.equal(pendingPaymentOf(groupOrders(s.orders)).order.id,order.id);
 assert.deepEqual(nextStepsOf(s).map(item=>item.kind),['payment','cart']);
});

test('a доплата comes before the payment and its button names the amount',()=>{
 const base=requested();
 const s=withExtra(base,base.orders[0].id);
 assert.equal(pendingApprovalOf(s.orders).id,base.orders[0].id);
 const step=nextStepOf(s);
 assert.equal(step.kind,'extra');
 assert.equal(step.amount,45000);
 assert.equal(actionLines(step,'ru').button.replace(/\s/g,' '),'Доплатить 45 000 сум');
 assert.equal(actionLines(step,'ru').title,'Нужна доплата');
});

test('a paid order without the recipient’s passport: the passport card leads straight to the form',()=>{
 const s=paidWaitingPassport();
 const step=nextStepOf(s);
 assert.equal(step.kind,'passport');
 assert.equal(step.href,'/account/documents?recipient='+encodeURIComponent(s.deliveryProfiles[0].id));
 assert.equal(step.recipientName,'Анна Каримова');
 const lines=actionLines(step,'ru');
 assert.equal(lines.title,'Нужен паспорт получателя');
 assert.equal(lines.hint,'Для таможни — заказ «Nike Air Max 90 Essential», займёт минуту');
 assert.equal(lines.button,'Добавить паспорт');
 // The order number is never in the main lines (it is small and grey under them).
 for(const locale of ['ru','uz','oz','en'])for(const text of Object.values(actionLines(step,locale)))assert.ok(!text.includes(step.orderId),`${locale}: ${text}`);
 // The cart comes after the passport.
 const withCart=addToCart(s,products[1],products[1].variants[0],1500);
 assert.deepEqual(nextStepsOf(withCart).map(item=>item.kind),['passport','cart']);
});

test('«Позже» puts off that one step for the tab; the next one shows',()=>{
 const s=addToCart(paidWaitingPassport(),products[1],products[1].variants[0],1500);
 const first=nextStepOf(s);
 assert.equal(first.kind,'passport');
 assert.equal(nextStepOf(s,new Set([first.key])).kind,'cart');
 assert.equal(nextStepOf(s,new Set([first.key,'cart'])),null);
});

test('a paid order in progress with its passport needs nothing; a cancelled unpaid request is not a payment to finish',()=>{
 const fresh=requested();
 const paid=confirmDemoPayment(fresh,fresh.orders[0].id,1002);
 const withPassport={...paid,identityProfiles:[{recipientProfileId:paid.deliveryProfiles[0].id}]};
 assert.equal(nextStepOf(withPassport),null);
 const base=requested();
 const cancelled=cancelOrder(base,base.orders[0].id,1003);
 assert.ok(cancelled.orders[0].cancelled);
 assert.equal(pendingPaymentOf(groupOrders(cancelled.orders)),undefined);
 assert.equal(nextStepOf(cancelled),null);
});

test('the toast after sign-in: one sentence with the short product name and its action; never for the cart',()=>{
 const step=nextStepOf(paidWaitingPassport());
 assert.deepEqual(actionToastOf(step,'ru'),{text:'Добавьте паспорт для заказа «Nike Air Max 90» — нужно для таможни',action:'Добавить',href:step.href});
 assert.match(actionToastOf(step,'oz').text,/^Nike Air Max 90 буюртмаси учун паспорт қўшинг/,'oz is Cyrillic, the name stays Latin');
 assert.equal(actionToastOf(nextStepOf(addToCart(blank(),products[0],products[0].variants[0],1000)),'ru'),null);
 assert.equal(actionToastOf(null,'ru'),null);
});

test('every locale has every line of every kind',()=>{
 for(const locale of ['ru','uz','oz','en']){
  const t=actionCopy[locale];
  for(const kind of ['extra','change','payment','passport']){
   assert.ok(t.title[kind]&&t.toast[kind]('Nike')&&t.toastAction[kind],`${locale}.${kind}`);
   assert.ok(t.hint[kind]('Nike').includes('Nike'),`${locale}.${kind} names the product`);
   assert.ok(t.button[kind]('45 000 сум')&&t.button[kind](),`${locale}.${kind} button`);
  }
  assert.ok(t.title.cart(2)&&t.hint.cart('')&&t.button.cart()&&t.later,locale);
 }
 assert.equal(actionCopy.oz.later,'Кейинроқ');
});

test('short product names keep the first words',()=>{
 assert.equal(shortProductName('Nike Air Max 90 Essential Men’s Shoes'),'Nike Air Max 90');
 assert.equal(shortProductName('  Nike   Dunk  '),'Nike Dunk');
 assert.equal(shortProductName('Supercalifragilisticexpialidocious-sneaker-limited-edition').endsWith('…'),true);
});
