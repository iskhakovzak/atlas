import test from 'node:test';
import assert from 'node:assert/strict';
import {
 adminSettingsSchema,attentionFor,attentionItems,attentionKindPermissions,auditCsv,auditDetails,customerRow,customersCsv,dashboardKpis,dayEnd,dayStart,defaultAdminSettings,
 filterAudit,filterStaff,groupAttention,inviteText,orderFunnel,pageOf,parseAdminSettings,pendingTopup,policyErrors,policyHistory,pricingSnapshot,searchCustomers,searchWithTab,staffDeactivationError,tabFromSearch,
} from '../lib/market/admin-dashboard.ts';
import {operationsKindPermissions,operationsQueryPermissions,permissions,adminTabPermissions} from '../lib/market/access.ts';
import {blank,tariff} from '../lib/market/domain.ts';

const day=86_400_000,now=Date.parse('2026-10-06T12:00:00+05:00');
const quote=(total,extra={})=>({id:'q',merchandise:total,service:0,shipping:0,reserve:0,total,fx:12800,weight:1,createdAt:now-10*day,expiresAt:now+day,...extra});
function order(id,patch={}){
 return {id,product:{id:'p',name:'Кроссовки',brand:'Nike',sourceUrl:'https://www.nike.com/t/x',category:'Обувь',country:'США',variants:['42'],image:'',images:[],weight:1,price:100,currency:'USD',description:''},variant:'42',quote:quote(1_000_000),status:0,createdAt:now-10*day,history:[{at:now-10*day,text:'Оформлен'}],quantity:1,cancelled:false,balanceUsed:0,...patch};
}
const account=(id,patch={})=>({id,name:id.replace('email:',''),revision:1,updatedAt:now-day,state:{...blank(),communication:{emailEnabled:false,smsEnabled:false,email:id.replace('email:',''),phone:'+998901234567',language:'ru'},...patch}});

test('admin settings: defaults, partial rows and junk all parse',()=>{
 assert.deepEqual(defaultAdminSettings.attention,{pendingPaymentDays:2,paidNotBoughtDays:3,warehouseDays:7,topupDays:1,ticketDays:1,fxStaleHours:24});
 assert.equal(parseAdminSettings('{"attention":{"warehouseDays":10}}').attention.warehouseDays,10);
 assert.equal(parseAdminSettings('{"attention":{"warehouseDays":10}}').attention.ticketDays,1);
 assert.deepEqual(parseAdminSettings('not json'),defaultAdminSettings);
 assert.deepEqual(parseAdminSettings(null),defaultAdminSettings);
 assert.equal(adminSettingsSchema.safeParse({attention:{pendingPaymentDays:-1}}).success,false);
 assert.equal(adminSettingsSchema.safeParse({attention:{fxStaleHours:0}}).success,false);
});

test('KPIs count new orders, paid marks and payable per period; conversion is accounts with orders over engaged accounts',()=>{
 const accounts=[
  account('email:a@x.uz',{orders:[order('AT-1',{createdAt:now-2*3600_000,history:[]}),order('AT-2',{createdAt:now-3*day,payment:{id:'p',status:'paid',method:'payment-link',amount:1_000_000,createdAt:now-3*day,updatedAt:now-2*day}})]}),
  account('email:b@x.uz',{cart:[{id:'c',product:{},variant:'',quantity:1,requestedServiceIds:[],quote:quote(1)}],orders:[]}),
  account('email:c@x.uz',{orders:[order('AT-3',{createdAt:now-20*day,cancelled:true})]}),
  account('email:d@x.uz',{orders:[order('AT-4',{createdAt:now-100*day})]}),
 ];
 const kpis=dashboardKpis(accounts,now);
 assert.equal(kpis.today.newOrders,1);
 assert.equal(kpis.week.newOrders,2);
 assert.equal(kpis.month.newOrders,3);
 assert.equal(kpis.week.paidMarks,1);
 assert.equal(kpis.week.payable,2_000_000);
 assert.equal(kpis.week.averageCheck,1_000_000);
 assert.equal(kpis.month.payable,2_000_000,'cancelled orders carry no money');
 assert.equal(kpis.week.convertedAccounts,1);
 assert.equal(kpis.week.engagedAccounts,2);
 assert.equal(kpis.week.conversion,0.5);
 assert.equal(dashboardKpis([],now).today.conversion,0);
});

test('funnel: one counter per stage plus cancelled',()=>{
 const accounts=[account('email:a@x.uz',{orders:[order('1'),order('2',{status:2}),order('3',{status:5}),order('4',{status:1,cancelled:true})]})];
 const funnel=orderFunnel(accounts);
 assert.deepEqual(funnel.map(stage=>stage.count),[1,0,1,0,0,1,1]);
 assert.equal(funnel[0].label,'Ожидает выкупа');
 assert.equal(funnel.at(-1).status,'cancelled');
});

test('attention: thresholds pick orders, tickets, carts, the rate, the catalog and invited staff',()=>{
 const paid={id:'p',status:'paid',method:'payment-link',amount:1,createdAt:now-5*day,updatedAt:now-5*day};
 const accounts=[account('email:a@x.uz',{
  orders:[
   order('AT-PENDING',{payment:{...paid,status:'pending'},createdAt:now-3*day}),
   order('AT-FRESH',{payment:{...paid,status:'pending'},createdAt:now-day}),
   order('AT-PAID',{payment:paid}),
   order('AT-WH',{status:2,history:[{at:now-9*day,text:'На складе'}]}),
   order('AT-TOPUP',{status:3,settlement:{actualWeight:2,dimensionalWeight:1,chargeableWeight:2,shipping:1,refund:0,extra:50_000},history:[{at:now-2*day,text:'Взвешен'}]}),
   order('AT-CANCELLED',{cancelled:true,payment:{...paid,status:'pending'},createdAt:now-30*day}),
  ],
  supportTickets:[{id:'t1',subject:'Где посылка',status:'open',createdAt:now-3*day,updatedAt:now-2*day,replies:[]},{id:'t2',subject:'Спасибо',status:'answered',createdAt:now-3*day,updatedAt:now-3*day,replies:[]}],
  cart:[{id:'c',product:{name:'Куртка'},variant:'',quantity:1,requestedServiceIds:[],quote:quote(1),priceChange:{previousPrice:100,price:120,currency:'USD',at:now-3600_000}}],
 })];
 const items=attentionItems({accounts,pricing:{fxSource:'cbu',fxUpdatedAt:now-30*3600_000,fxCbuDate:'2026-10-05'},catalogErrors:[{id:'e',name:'Товар',error:'HTTP 503',at:now-day}],staff:[{email:'new@x.uz',displayName:'Новый',status:'invited',updatedAt:now-4*day},{email:'old@x.uz',displayName:'Старый',status:'active',updatedAt:now}],now});
 const kinds=items.map(item=>item.kind);
 assert.deepEqual([...new Set(kinds)].sort(),['cart-price-change','catalog-error','fx-stale','paid-not-bought','pending-payment','staff-invited','ticket-open','topup-unanswered','warehouse-stale']);
 assert.equal(items.filter(item=>item.kind==='pending-payment').length,1,'the fresh and the cancelled orders are not listed');
 assert.equal(items.find(item=>item.kind==='pending-payment').href,'/operations#AT-PENDING');
 assert.equal(items.find(item=>item.kind==='topup-unanswered').detail.includes('доплата за вес'),true);
 assert.equal(items.filter(item=>item.kind==='ticket-open').length,1);
 assert.equal(items.find(item=>item.kind==='staff-invited').title,'Новый');
 // Sorted oldest first, so the longest waiting item is at the top.
 for(let i=1;i<items.length;i++)assert.ok(items[i-1].at<=items[i].at);
 // Looser thresholds hide items; a manual rate never goes stale.
 const loose=attentionItems({accounts,settings:parseAdminSettings({attention:{pendingPaymentDays:10,warehouseDays:30,topupDays:5,ticketDays:5}}),pricing:{fxSource:'manual'},now});
 assert.deepEqual([...new Set(loose.map(item=>item.kind))],['paid-not-bought','cart-price-change']);
 // Rights cut the list: support sees tickets and orders but not the rate or staff.
 const support=attentionFor(items,permission=>['operations.read','support.reply'].includes(permission));
 assert.ok(support.some(item=>item.kind==='ticket-open'));
 assert.ok(!support.some(item=>item.kind==='fx-stale'||item.kind==='staff-invited'||item.kind==='catalog-error'));
 for(const kind of Object.keys(attentionKindPermissions))assert.ok(permissions.includes(attentionKindPermissions[kind]),kind);
 const groups=groupAttention(items);
 assert.equal(groups.reduce((sum,group)=>sum+group.items.length,0),items.length);
 assert.equal(pendingTopup(order('x',{changeRequests:[{id:'r',kind:'price',title:'Цена выросла',reason:'...',amountDelta:1,status:'pending',createdAt:now}]})),'запрос «Цена выросла»');
 assert.equal(pendingTopup(order('x')),null);
});

test('customers: rows, search by name / phone / email / order, CSV without passport data',()=>{
 const a=account('email:anna@x.uz',{orders:[order('AT-ABC123'),order('AT-OLD',{status:5,cancelled:true})],entries:[{id:'e',orderId:'AT-ABC123',at:now,amount:50_000,debit:'atlas',credit:'customer-credit',description:'возврат'}],identityProfile:{fullName:'Secret Passport',documentNumber:'AA1234567'}});
 const b=account('email:bob@x.uz',{communication:{emailEnabled:false,smsEnabled:false,email:'bob@x.uz',phone:'+998 (97) 765-43-21',language:'uz'}});
 const row=customerRow(a,'review');
 assert.equal(row.orders,2);assert.equal(row.activeOrders,1);assert.equal(row.payable,1_000_000);assert.equal(row.balance,50_000);assert.equal(row.status,'review');
 assert.deepEqual(searchCustomers([a,b],'anna').map(item=>item.id),['email:anna@x.uz']);
 assert.deepEqual(searchCustomers([a,b],'977654').map(item=>item.id),['email:bob@x.uz']);
 assert.deepEqual(searchCustomers([a,b],'at-abc').map(item=>item.id),['email:anna@x.uz']);
 assert.deepEqual(searchCustomers([a,b],'BOB@X').map(item=>item.id),['email:bob@x.uz']);
 assert.equal(searchCustomers([a,b],'  ').length,2);
 const csv=customersCsv([row,customerRow(b)]);
 assert.ok(csv.startsWith('﻿id;Имя;Email'));
 assert.ok(csv.includes('anna@x.uz;+998901234567;ru;review;2;1;1000000;50000'));
 assert.ok(!csv.includes('AA1234567')&&!csv.includes('Secret Passport'),'no passport data in the export');
});

test('audit: filters by actor, entity, day range and text; pages; CSV; details; policy history',()=>{
 const events=[
  {id:'1',actorEmail:'a@x.uz',action:'policy.update',entityType:'settings',entityId:'policy',details:'{"version":"policy-1"}',createdAt:Date.parse('2026-10-01T10:00:00')},
  {id:'2',actorEmail:'b@x.uz',action:'order.advance',entityType:'order',entityId:'AT-1',details:'{"accountId":"email:c@x.uz"}',createdAt:Date.parse('2026-10-03T10:00:00')},
  {id:'3',actorEmail:'a@x.uz',action:'staff.deactivate',entityType:'staff',entityId:'z@x.uz',details:'{"reason":"уволен"}',createdAt:Date.parse('2026-10-05T10:00:00')},
  {id:'4',actorEmail:'a@x.uz',action:'policy.update',entityType:'settings',entityId:'policy',details:'not json',createdAt:Date.parse('2026-10-06T10:00:00')},
 ];
 assert.deepEqual(filterAudit(events,{actor:'b@x.uz'}).map(event=>event.id),['2']);
 assert.deepEqual(filterAudit(events,{entity:'settings'}).map(event=>event.id),['1','4']);
 assert.deepEqual(filterAudit(events,{from:'2026-10-03',to:'2026-10-05'}).map(event=>event.id),['2','3']);
 assert.deepEqual(filterAudit(events,{q:'уволен'}).map(event=>event.id),['3']);
 assert.deepEqual(filterAudit(events,{actor:'all',entity:'all'}).length,4);
 assert.equal(dayStart('2026-13-01'),null);assert.equal(dayEnd('junk'),null);assert.equal(dayEnd('2026-10-03')-dayStart('2026-10-03'),day-1);
 const page=pageOf(events,2,3);
 assert.deepEqual({page:page.page,pages:page.pages,total:page.total,ids:page.items.map(e=>e.id)},{page:2,pages:2,total:4,ids:['4']});
 assert.equal(pageOf(events,99,3).page,2);
 const csv=auditCsv(events.slice(0,1));
 assert.ok(csv.includes('a@x.uz;policy.update;settings;policy;"{""version"":""policy-1""}"'));
 assert.deepEqual(auditDetails(events[0]).fields,[['version','policy-1']]);
 assert.equal(auditDetails(events[3]).pretty,'not json');
 assert.deepEqual(auditDetails({}).fields,[]);
 const history=policyHistory(events);
 assert.deepEqual(history.map(item=>item.id),['4','1']);
 assert.equal(history[1].fields[0][1],'policy-1');
});

test('team: filters, the deactivation guard and the invitation text',()=>{
 const members=[{email:'a@x.uz',displayName:'Анна',role:'support',status:'active',updatedAt:1},{email:'b@x.uz',displayName:'Борис',role:'finance',status:'invited',updatedAt:2},{email:'c@x.uz',displayName:'Ceo',role:'admin',status:'disabled',updatedAt:3}];
 assert.deepEqual(filterStaff(members,{role:'finance'}).map(m=>m.email),['b@x.uz']);
 assert.deepEqual(filterStaff(members,{status:'active'}).map(m=>m.email),['a@x.uz']);
 assert.deepEqual(filterStaff(members,{q:'бор'}).map(m=>m.email),['b@x.uz']);
 assert.equal(filterStaff(members,{role:'all',status:'all'}).length,3);
 assert.equal(staffDeactivationError({targetEmail:'Me@X.uz',actorEmail:'me@x.uz',operatorEmail:'owner@x.uz'}),'err_55');
 assert.equal(staffDeactivationError({targetEmail:'OWNER@x.uz',actorEmail:'me@x.uz',operatorEmail:'owner@x.uz'}),'err_56');
 assert.equal(staffDeactivationError({targetEmail:'other@x.uz',actorEmail:'me@x.uz',operatorEmail:null}),null);
 assert.ok(inviteText('New@X.uz','https://atlas.uz').includes('new@x.uz'));
 assert.ok(inviteText('new@x.uz').includes('«Управление»'));
});

test('rules: field validation mirrors the policy schema',()=>{
 const ok={maxCartLines:10,maxCartWeightKg:30,maxMerchandiseUsd:2000,blockedCategories:[],restrictedTerms:['weapon']};
 assert.deepEqual(policyErrors(ok),{});
 const bad=policyErrors({maxCartLines:0,maxCartWeightKg:NaN,maxMerchandiseUsd:60_000,blockedCategories:['x'.repeat(81)],restrictedTerms:['a']});
 assert.deepEqual(Object.keys(bad).sort(),['blockedCategories','maxCartLines','maxCartWeightKg','maxMerchandiseUsd','restrictedTerms']);
});

test('tariff snapshot reads the rates in force; tabs round-trip through ?tab=',()=>{
 const s=pricingSnapshot({...tariff,fxSource:'cbu',fxCbuDate:'2026-10-06',updatedAt:now,version:'managed-1'});
 assert.equal(s.expressPerKgUsd,15.98);assert.equal(s.standardPerKgUsd,13.98);assert.equal(s.marginPercent,9.98);assert.equal(s.customsHelpPercent,4.98);assert.ok(s.fxSource.startsWith('ЦБ'));
 assert.equal(tabFromSearch('?tab=staff'),'staff');
 assert.equal(tabFromSearch('?tab=nope'),'overview');
 assert.equal(tabFromSearch(''),'overview');
 assert.equal(searchWithTab('?tab=staff&customer=x','audit'),'?tab=audit');
 assert.equal(searchWithTab('?tab=staff','overview'),'');
 assert.equal(adminTabPermissions.content,'content.manage');
 for(const kind of ['customer-note','staff-deactivate','admin-settings'])assert.ok(permissions.includes(operationsKindPermissions[kind]),kind);
 assert.equal(operationsKindPermissions['customer-note'],'customers.manage');
 assert.equal(operationsKindPermissions['staff-deactivate'],'staff.manage');
 assert.equal(operationsKindPermissions['admin-settings'],'system.manage');
 assert.equal(operationsQueryPermissions.customers,'customers.manage');
 assert.equal(operationsQueryPermissions.audit,'audit.read');
 assert.equal(operationsQueryPermissions.system,'system.manage');
});
