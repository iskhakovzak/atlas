import test from 'node:test';
import assert from 'node:assert/strict';
import {
 buildInvestorSnapshot,clampAssumptions,compareKpis,compareValue,defaultAssumptions,filterSnapshot,growthModel,hostOf,investorCsv,investorFunnel,investorKpis,investorReport,isTestAccount,
 lastMonths,monthlySeries,observedGrowth,periodRange,regionOf,retentionCohorts,shareTable,summaryText,unitEconomics,
} from '../lib/market/investor-metrics.ts';
import {operationsQueryPermissions} from '../lib/market/access.ts';

const day=86_400_000,now=Date.parse('2026-10-06T12:00:00+05:00');
const at=(daysAgo)=>now-daysAgo*day;
/** A row as market_order_finance stores it (lib/market/finance.ts OrderFinance). */
function finance(orderId,customerId,patch={}){
 const base={orderId,customerId,status:'paid',createdAt:at(10),paidAt:at(9),goods:900_000,storeShipping:0,reserve:0,payable:1_200_000,commission:100_000,delivery:150_000,fxGain:10_000,services:40_000,revenue:300_000};
 const row={...base,...patch};
 if(row.status!=='paid'){delete row.paidAt}
 return row;
}
const snapshotOf=(rows,extra={})=>buildInvestorSnapshot({finance:rows,records:{},customers:[],linkedExpenses:{},deliveredAt:{},orderMeta:{},cartLines:{},accountsRead:0,now,...extra});

test('test accounts: the e2e domains and e2e-* names, on the email and on the account id',()=>{
 assert.equal(isTestAccount({email:'e2e-1759000000@atlas.local'}),true);
 assert.equal(isTestAccount({email:'someone@sites.test'}),true);
 assert.equal(isTestAccount({id:'email:operator@atlas.local'}),true);
 assert.equal(isTestAccount({id:'e2e-user'}),true);
 assert.equal(isTestAccount({email:'E2E-smoke@example.com'}),true,'the e2e- prefix of the local part counts');
 assert.equal(isTestAccount({email:'client@gmail.com',id:'email:client@gmail.com'}),false);
 assert.equal(isTestAccount({id:'phone:+998901234567'}),false);
 assert.equal(isTestAccount({}),false);
 assert.equal(operationsQueryPermissions.investor,'finance.read');
});

test('snapshot: customers become c1, c2… by first order, no emails leave; stage, host, delivered date and linked expenses attach to orders',()=>{
 const snapshot=buildInvestorSnapshot({
  finance:[finance('AT-2','email:b@gmail.com',{createdAt:at(5)}),finance('AT-1','email:a@atlas.local',{createdAt:at(30),status:'pending'}),finance('AT-3','email:b@gmail.com',{createdAt:at(2),status:'cancelled'})],
  records:{'AT-2':{status:'5',sourceUrl:'https://www.nike.com/t/x',sourceStore:'Nike'},'AT-1':{status:'0',sourceUrl:null,sourceStore:null}},
  customers:[{id:'email:a@atlas.local',email:'a@atlas.local',createdAt:at(40)},{id:'email:b@gmail.com',email:'b@gmail.com',createdAt:at(6)}],
  linkedExpenses:{'AT-2':50_000},deliveredAt:{'AT-2':at(1)},orderMeta:{'AT-2':{country:'США',category:'Обувь'}},cartLines:{'email:b@gmail.com':2},accountsRead:2,now,
 });
 assert.deepEqual(snapshot.customers.map(c=>[c.key,c.isTest,c.cartLines]),[['c1',true,0],['c2',false,2]]);
 assert.equal(JSON.stringify(snapshot).includes('@'),false,'no email in the snapshot');
 assert.deepEqual(snapshot.orders.map(o=>o.id),['AT-1','AT-2','AT-3'],'sorted by creation');
 const second=snapshot.orders[1];
 assert.equal(second.customer,'c2');assert.equal(second.stage,5);assert.equal(second.host,'nike.com');assert.equal(second.country,'США');assert.equal(second.category,'Обувь');
 assert.equal(second.deliveredAt,at(1));assert.equal(second.linkedExpenses,50_000);
 assert.equal(snapshot.orders[2].stage,'cancelled');
 assert.equal(snapshot.orders[0].stage,0);
 assert.deepEqual(snapshot.coverage,{financeRows:3,recordRows:2,customerRows:2,accountsRead:2,ordersWithCountry:1,deliveredDates:1,ledgerLinked:1});
 assert.equal(hostOf('not a url'),undefined);
 assert.equal(hostOf('https://WWW.Zara.com/es/'),'zara.com');
});

test('filters: paid only keeps the paid marks; without test accounts drops their orders and customers',()=>{
 const snapshot=buildInvestorSnapshot({finance:[finance('A','email:t@atlas.local'),finance('B','email:u@mail.uz',{status:'pending'}),finance('C','email:u@mail.uz')],records:{},customers:[{id:'email:t@atlas.local',email:'t@atlas.local',createdAt:at(50)}],linkedExpenses:{},deliveredAt:{},orderMeta:{},cartLines:{},accountsRead:0,now});
 assert.deepEqual(filterSnapshot(snapshot,{}).orders.map(o=>o.id),['A','B','C']);
 assert.deepEqual(filterSnapshot(snapshot,{paidOnly:true}).orders.map(o=>o.id),['A','C']);
 const noTest=filterSnapshot(snapshot,{excludeTest:true});
 assert.deepEqual(noTest.orders.map(o=>o.id),['B','C']);
 assert.equal(noTest.customers.length,1);
});

test('periods: rolling windows with an equal previous window; "all" starts at the earliest order and has no previous',()=>{
 const three=periodRange('3m',now);
 assert.equal(three.to,now);
 assert.equal(three.previous.to,three.from-1);
 assert.equal(three.to-three.from,three.previous.to-three.previous.from,'equal lengths');
 assert.ok(Math.abs((now-three.from)/day-91.3)<0.5);
 const twelve=periodRange('12m',now);
 assert.ok(Math.abs((now-twelve.from)/day-365.25)<0.5);
 const all=periodRange('all',now,at(400));
 assert.equal(all.from,at(400));assert.equal(all.previous,null);assert.equal(all.label,'Всё время');
 assert.equal(periodRange('all',now).from,now,'no orders: an empty window');
});

test('KPIs: GMV over non-cancelled orders, revenue over paid marks, take rate, repeat rate, new customers and the comparison',()=>{
 const rows=[
  finance('P1','c-a',{createdAt:at(10)}),finance('P2','c-a',{createdAt:at(20),payable:800_000,revenue:200_000}),
  finance('U1','c-b',{createdAt:at(15),status:'pending',payable:500_000,revenue:100_000}),finance('X1','c-c',{createdAt:at(12),status:'cancelled'}),
  finance('O1','c-b',{createdAt:at(120),payable:2_000_000,revenue:400_000}),finance('O2','c-d',{createdAt:at(150),status:'pending'}),
 ];
 const snapshot=snapshotOf(rows,{linkedExpenses:{P1:30_000}});
 const range=periodRange('3m',now);
 const k=investorKpis(snapshot.orders,range);
 assert.equal(k.orders,3);assert.equal(k.paidOrders,2);
 assert.equal(k.gmv,2_500_000);assert.equal(k.gmvPaid,2_000_000);assert.equal(k.revenue,500_000);
 assert.equal(k.takeRate,0.25);
 assert.equal(k.grossMargin,(500_000-30_000)/500_000);assert.equal(k.linkedExpenses,30_000);
 assert.equal(k.activeCustomers,2);assert.equal(k.repeatRate,0.5);
 assert.equal(k.averageCheck,Math.round(2_500_000/3));assert.equal(k.revenuePerOrder,250_000);
 assert.equal(k.newCustomers,1,'c-a is new; c-b first ordered 120 days ago; c-c only cancelled');
 const comparison=compareKpis(snapshot.orders,range);
 assert.equal(comparison.previous.orders,2);
 assert.equal(comparison.change.orders,0.5);
 assert.equal(comparison.change.gmv,(2_500_000-3_200_000)/3_200_000);
 assert.equal(compareKpis(snapshot.orders,periodRange('all',now,at(150))).previous,null);
 assert.equal(compareValue(5,0),null);assert.equal(compareValue(5,null),null);assert.equal(compareValue(150,100),0.5);assert.equal(compareValue(50,-100),1.5);
 const empty=investorKpis([],range);
 assert.equal(empty.takeRate,0);assert.equal(empty.grossMargin,0);assert.equal(empty.averageCheck,0);assert.equal(empty.repeatRate,0);
});

test('months: the last twelve calendar months in Tashkent time, series by order month, observed growth is the median of recent rates',()=>{
 const months=lastMonths(now,12);
 assert.equal(months.length,12);assert.equal(months[0],'2025-11');assert.equal(months[11],'2026-10');
 assert.deepEqual(lastMonths(Date.parse('2026-01-15T00:00:00+05:00'),3),['2025-11','2025-12','2026-01']);
 const rows=[
  finance('A','c1',{createdAt:Date.parse('2026-08-03T10:00:00+05:00')}),finance('B','c2',{createdAt:Date.parse('2026-08-20T10:00:00+05:00'),status:'pending'}),
  finance('C','c1',{createdAt:Date.parse('2026-09-01T00:30:00+05:00')}),finance('D','c3',{createdAt:Date.parse('2026-09-10T10:00:00+05:00'),status:'cancelled'}),
 ];
 const series=monthlySeries(snapshotOf(rows).orders,months);
 const august=series.find(p=>p.month==='2026-08'),september=series.find(p=>p.month==='2026-09');
 assert.deepEqual([august.orders,august.paidOrders,august.gmv,august.revenue,august.newCustomers],[2,1,2_400_000,300_000,2]);
 assert.deepEqual([september.orders,september.paidOrders,september.newCustomers],[1,1,0],'C is a repeat order; D is cancelled');
 assert.equal(observedGrowth([{orders:0},{orders:0}].map(o=>({month:'',paidOrders:0,gmv:0,revenue:0,newCustomers:0,...o}))),0);
 const points=[10,12,15,30].map(orders=>({month:'',orders,paidOrders:0,gmv:0,revenue:0,newCustomers:0}));
 assert.equal(observedGrowth(points),0.25,'median of 0.2, 0.25 and 1');
 assert.equal(observedGrowth([{orders:1},{orders:10}].map(o=>({month:'',paidOrders:0,gmv:0,revenue:0,newCustomers:0,...o}))),1,'clamped to +100 %');
});

test('unit economics: averages over paid orders, or over quotes when nothing is marked paid',()=>{
 const range=periodRange('12m',now);
 const paid=unitEconomics(snapshotOf([finance('A','c1',{commission:100_000,revenue:300_000}),finance('B','c2',{commission:200_000,revenue:400_000,status:'pending'}),finance('C','c3',{commission:300_000,revenue:500_000})],{linkedExpenses:{A:20_000}}).orders,range);
 assert.equal(paid.basis,'paid');assert.equal(paid.count,2);assert.equal(paid.commission,200_000);assert.equal(paid.revenue,400_000);assert.equal(paid.linkedExpenses,10_000);assert.equal(paid.contribution,390_000);
 const quoted=unitEconomics(snapshotOf([finance('A','c1',{status:'pending'}),finance('X','c2',{status:'cancelled'})]).orders,range);
 assert.equal(quoted.basis,'quoted');assert.equal(quoted.count,1);assert.equal(quoted.goods,900_000);
 assert.equal(unitEconomics([],range).count,0);
});

test('funnel: customers per step, carts from the documents, the average days to «Доставлен» only from dated orders',()=>{
 const range=periodRange('12m',now);
 const snapshot=buildInvestorSnapshot({
  finance:[finance('A','u1',{createdAt:at(20)}),finance('B','u2',{createdAt:at(15),status:'pending'}),finance('C','u3',{createdAt:at(30)}),finance('D','u4',{createdAt:at(9),status:'cancelled'}),finance('E','u1',{createdAt:at(40)})],
  records:{A:{status:'5'},B:{status:'0'},C:{status:'2'},E:{status:'5'}},customers:[{id:'u5',email:'x@mail.uz',createdAt:at(3)}],linkedExpenses:{},deliveredAt:{A:at(13)},orderMeta:{},cartLines:{u5:1,u1:3},accountsRead:0,now,
 });
 const funnel=investorFunnel(snapshot.orders,snapshot.customers,range);
 assert.deepEqual(funnel.steps.map(s=>s.count),[4,3,2,2,1],'u5 has a cart only; u1 has a cart and orders, counted once');
 assert.equal(funnel.averageDeliveryDays,7,'E reached stage 5 without an event date and is left out');
 assert.equal(funnel.deliveredWithDates,1);assert.equal(funnel.cancelled,1);
 assert.equal(investorFunnel([],[],range).averageDeliveryDays,null);
});

test('shares: by region, host and category with «Остальные» after the limit; unknown values get the fallback label',()=>{
 const range=periodRange('12m',now);
 const list=[['A','США'],['B','США'],['C','Испания'],['D','Германия'],['E',undefined],['F','Китай']];
 const snapshot=snapshotOf(list.map(([id])=>finance(id,'c'+id)),{orderMeta:Object.fromEntries(list.filter(([,country])=>country).map(([id,country])=>[id,{country}]))});
 const regions=shareTable(snapshot.orders,range,o=>regionOf(o.country),'Страна не указана');
 assert.deepEqual(regions.map(r=>[r.label,r.orders,r.share]),[['Европа',2,2/6],['США',2,2/6],['Китай',1,1/6],['Страна не указана',1,1/6]],'ties sort by orders, then GMV, then name');
 assert.equal(regions[0].gmv,2_400_000);
 const many=shareTable(snapshot.orders,range,o=>o.id,'—',3);
 assert.equal(many.length,3);assert.equal(many[2].label,'Остальные');assert.equal(many[2].orders,4);
 assert.equal(regionOf(undefined),undefined);assert.equal(regionOf('Турция'),'Турция');
 assert.deepEqual(shareTable([],range,o=>o.host),[]);
});

test('cohorts: share of a month\'s new customers who ordered again within 1 / 2 / 3 months; horizons not yet elapsed are null',()=>{
 const m=(month,dayOfMonth)=>Date.parse(`${month}-${String(dayOfMonth).padStart(2,'0')}T10:00:00+05:00`);
 const rows=[
  finance('A1','a',{createdAt:m('2026-06',5)}),finance('A2','a',{createdAt:m('2026-07',5)}),
  finance('B1','b',{createdAt:m('2026-06',9)}),finance('B2','b',{createdAt:m('2026-09',1)}),
  finance('C1','c',{createdAt:m('2026-06',12)}),finance('C2','c',{createdAt:m('2026-06',20)}),
  finance('D1','d',{createdAt:m('2026-06',15),status:'cancelled'}),finance('D2','d',{createdAt:m('2026-08',15)}),
  finance('E1','e',{createdAt:m('2026-09',15)}),finance('E2','e',{createdAt:m('2026-10',2)}),
 ];
 const cohorts=retentionCohorts(snapshotOf(rows).orders,lastMonths(now,12),[1,2,3],now);
 const june=cohorts.find(c=>c.month==='2026-06'),august=cohorts.find(c=>c.month==='2026-08'),september=cohorts.find(c=>c.month==='2026-09'),october=cohorts.find(c=>c.month==='2026-10');
 assert.equal(june.customers,3,'d\'s first live order is in August');
 assert.deepEqual(june.retained,[1/3,1/3,2/3],'a came back in July (1), b in September (3); c ordered twice in June only');
 assert.equal(august.customers,1);assert.deepEqual(august.retained,[0,0,null],'three months after August have not passed on 6 October');
 assert.deepEqual(september.retained,[1,null,null]);
 assert.equal(october.customers,0);assert.deepEqual(october.retained,[null,null,null]);
});

test('growth model: compounding on clamped assumptions; defaults come from the facts',()=>{
 const model=growthModel({ordersPerMonth:100,growthPct:10,averageCheck:1_000_000,takeRate:0.2},3);
 assert.deepEqual(model.rows.map(r=>r.orders),[110,121,133.1]);
 assert.equal(model.rows[0].gmv,110_000_000);assert.equal(model.rows[0].revenue,22_000_000);
 assert.equal(model.totalGmv,364_100_000);assert.equal(model.totalOrders,364);
 assert.deepEqual(clampAssumptions({growthPct:500,takeRate:3,ordersPerMonth:-5,averageCheck:Number.NaN}),{ordersPerMonth:0,growthPct:100,averageCheck:0,takeRate:1});
 assert.equal(growthModel({},12).totalGmv,0);
 const series=[2,4,6,8,10].map((orders,i)=>({month:`2026-0${i+5}`,orders,paidOrders:orders,gmv:orders*1_000_000,revenue:orders*200_000,newCustomers:1}));
 const defaults=defaultAssumptions(series,{averageCheck:1_000_000,takeRate:0.2,orders:0,paidOrders:0,gmv:0,gmvPaid:0,revenue:0,grossMargin:0,linkedExpenses:0,activeCustomers:0,repeatRate:0,revenuePerOrder:0,newCustomers:0});
 assert.equal(defaults.ordersPerMonth,6,'average of the three full months before the current one: 4, 6, 8');
 assert.equal(defaults.averageCheck,1_000_000);assert.equal(defaults.takeRate,0.2);
 assert.ok(defaults.growthPct>0&&defaults.growthPct<=100);
});

test('report, text summary and CSV carry the honesty note, the period and the filters',()=>{
 const snapshot=buildInvestorSnapshot({finance:[finance('A','email:t@atlas.local'),finance('B','email:u@mail.uz',{createdAt:at(3)})],records:{A:{status:'1'},B:{status:'0'}},customers:[{id:'email:t@atlas.local',email:'t@atlas.local',createdAt:at(50)}],linkedExpenses:{},deliveredAt:{},orderMeta:{},cartLines:{},accountsRead:0,now});
 const report=investorReport(snapshot,'6m',{paidOnly:true,excludeTest:true});
 assert.equal(report.kpis.current.orders,1);assert.equal(report.testCustomers,1);assert.equal(report.months.length,12);assert.equal(report.period.label,'6 мес');
 const text=summaryText(report);
 assert.match(text,/Платежи симулируются/);assert.match(text,/GMV: 1 200 000 сум/);assert.match(text,/только оплаченные, без тестовых аккаунтов/);assert.match(text,/данные Atlas на 2026-10-06/);
 const csv=investorCsv(report);
 assert.ok(csv.startsWith('﻿'));
 assert.match(csv,/Atlas — витрина для инвестора;период: 6 мес/);
 assert.match(csv,/GMV, сум;1200000;0;/);
 assert.match(csv,/\r\n2026-10;1;1;1200000;300000;1\r\n/);
 assert.match(csv,/Когорта \(месяц первого заказа\)/);
 const all=investorReport(snapshot,'all',{});
 assert.equal(all.kpis.previous,null);assert.equal(all.kpis.current.orders,2);
});
