import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {products,blank,addToCart,cartSignature,checkoutCart as checkoutCore,confirmDemoPayment,advanceOrder,cancelOrder,balanceOf} from '../lib/market/domain.ts';
import {customsVersion} from '../lib/market/world.ts';
import {deletionBlockers,autoCancelledOrders,deletionSummary,pseudonym,isPseudonym,paidOrder,missingConsents,consentVersion} from '../lib/market/account-delete.ts';

const checkoutCart=(s,key,sig,balance,now)=>checkoutCore(s,key,sig,balance,now,customsVersion);
const requested=()=>{let s=addToCart(blank(),products[0],'US 9',1000);return checkoutCart(s,'req-1',cartSignature(s.cart),false,1001)};
const paid=()=>{const s=requested();return confirmDemoPayment(s,s.orders[0].id,1002)};

test('an unpaid request neither blocks deletion nor survives it',()=>{
 const s=requested();
 assert.equal(s.orders[0].payment.status,'pending');
 assert.equal(paidOrder(s.orders[0]),false);
 assert.deepEqual(deletionBlockers(s),[]);
 assert.deepEqual(autoCancelledOrders(s).map(o=>o.id),[s.orders[0].id]);
});

test('a paid order in progress blocks deletion until delivered or cancelled',()=>{
 let s=paid();const id=s.orders[0].id;
 assert.equal(deletionBlockers(s).length,1);
 assert.deepEqual(autoCancelledOrders(s),[]);
 s=advanceOrder(s,id,0,2000);
 assert.equal(s.orders[0].status,1);
 // Later stages need weighing, parcel and settlement data; the rule only looks at status, so set it directly.
 const at=status=>({...s,orders:s.orders.map(o=>({...o,status}))});
 for(let status=1;status<5;status++)assert.equal(deletionBlockers(at(status)).length,1,`status ${status}`);
 assert.deepEqual(deletionBlockers(at(5)),[]);
 const fresh=paid();const cancelled=cancelOrder(fresh,fresh.orders[0].id,4000);
 assert.deepEqual(deletionBlockers(cancelled),[]);
 assert.deepEqual(autoCancelledOrders(cancelled),[]);
});

test('an order settled from the balance counts as paid',()=>{
 const fresh=paid();let s=cancelOrder(fresh,fresh.orders[0].id,1500);
 assert.ok(balanceOf(s)>0);
 s=addToCart(s,products[2],products[2].variants[0],2000);
 s=checkoutCart(s,'next',cartSignature(s.cart),true,2001);
 const next=s.orders[0];
 assert.equal(next.payment.status,'paid');
 assert.deepEqual(deletionBlockers(s).map(o=>o.id),[next.id]);
});

test('deletionSummary counts everything the confirmation dialog shows',()=>{
 let s=paid();
 s=addToCart(s,products[1],products[1].variants[0],3000);
 s={...s,favorites:[products[0].id],deliveryProfiles:[{id:'r1',label:'Дом',primary:true,recipient:'Ирина',phone:'+998901112233',region:'Tashkent',city:'Tashkent',address:'ул. 1',postalCode:'100000'}],supportTickets:[{id:'t1',subject:'x',status:'open',createdAt:1,updatedAt:1,replies:[]}]};
 const summary=deletionSummary(s);
 assert.equal(summary.orders.total,1);assert.equal(summary.orders.active,1);assert.equal(summary.orders.blocked,1);assert.equal(summary.orders.autoCancel,0);
 assert.equal(summary.recipients,1);assert.equal(summary.passports,0);assert.equal(summary.declarations,0);assert.equal(summary.tickets,1);assert.equal(summary.favorites,1);
 assert.equal(summary.cartItems,1);assert.equal(summary.balance,balanceOf(s));
 const empty=deletionSummary(blank());
 assert.deepEqual(empty,{orders:{total:0,active:0,blocked:0,autoCancel:0},recipients:0,passports:0,declarations:0,tickets:0,favorites:0,cartItems:0,notifications:0,balance:0});
});

test('pseudonym is deleted: + 16 hex chars of HMAC-SHA-256 under the server secret and stable',async()=>{
 const id='email:someone@example.com',secret='test-secret';
 const alias=await pseudonym(id,secret);
 assert.equal(alias,'deleted:'+createHmac('sha256',secret).update(id).digest('hex').slice(0,16));
 assert.equal(alias,await pseudonym(id,secret));
 assert.ok(isPseudonym(alias));
 assert.notEqual(alias,await pseudonym('email:other@example.com',secret));
 // Another key gives another alias: without the secret the alias cannot be matched by enumerating IDs.
 assert.notEqual(alias,await pseudonym(id,'other-secret'));
 assert.notEqual(alias,'deleted:'+createHash('sha256').update(id).digest('hex').slice(0,16));
 await assert.rejects(()=>pseudonym(id,''),/ATLAS_AUTH_SECRET/);
 assert.equal(isPseudonym(id),false);
});

test('missingConsents reports the documents not held at the current version',()=>{
 assert.deepEqual(missingConsents(blank()),['privacy','terms']);
 assert.deepEqual(missingConsents({consents:[{key:'privacy',version:consentVersion,acceptedAt:1}]}),['terms']);
 assert.deepEqual(missingConsents({consents:[{key:'privacy',version:'old',acceptedAt:1},{key:'terms',version:consentVersion,acceptedAt:1}]}),['privacy']);
 assert.deepEqual(missingConsents({consents:[{key:'privacy',version:consentVersion,acceptedAt:1},{key:'terms',version:consentVersion,acceptedAt:1}]}),[]);
});
