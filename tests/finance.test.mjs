import test from 'node:test';
import assert from 'node:assert/strict';
import {orderFinance,monthSummary,ordersCsv,ledgerCsv,summaryCsv,ledgerEntryInput,monthsBetween,
  accountingSettingsSchema,isPeriodLocked,lockedPeriodMessage,convertToUzs,yearSummary,sumSummaries,yearMonths,orderMargin,orderMargins,obligations,
  filterLedger,paginate,entryDraftFrom,sparkline,orderMarginCsv,yearCsv} from '../lib/market/finance.ts';

const quote={id:'q',createdAt:0,expiresAt:0,merchandise:1_012_000,service:90_000,buyout:5_000,conversion:3_000,shipping:200_000,deliveryMargin:10_000,reserve:40_000,sourceShipping:0,optionalServices:0,total:1_360_000,weight:1.3,tariffVersion:'v',fx:12_144,fxMarkup:1.012};
const paidAt=Date.UTC(2026,9,10,7);
const order=(extra={})=>({id:'AT-1',status:2,createdAt:paidAt-1000,cancelled:false,quote,history:[],payment:{id:'p',status:'paid',method:'payment-link',amount:1_360_000,createdAt:paidAt,updatedAt:paidAt},...extra});
const entry=(kind,amountUzs,extra={})=>({id:kind+amountUzs+(extra.orderId??''),kind,amountUzs,occurredOn:'2026-10-12',createdBy:'op',createdAt:1,...extra});

test('an order splits into transit and Atlas income',()=>{
  const f=orderFinance(order(),'email:a@b.uz');
  assert.equal(f.fxGain,12_000,'1.2% markup inside the goods line: 1 012 000 × (1 − 1/1.012)');
  assert.equal(f.goods,1_000_000);
  assert.equal(f.commission,98_000,'service + buyout + conversion');
  assert.equal(f.delivery,210_000,'shipping + delivery margin');
  assert.equal(f.revenue,98_000+210_000+12_000);
  assert.deepEqual([f.status,f.month,f.reserve],['paid','2026-10',40_000]);
});

test('weighing replaces the estimated shipping; approved changes land in goods, store delivery or services',()=>{
  const f=orderFinance(order({settlement:{actualWeight:1.6,dimensionalWeight:1.6,chargeableWeight:1.6,shipping:260_000,refund:0,extra:20_000},changeRequests:[
    {id:'c1',kind:'price',title:'Цена',reason:'Магазин поднял цену',amountDelta:50_000,status:'approved',createdAt:1},
    {id:'c2',kind:'warehouse-service',title:'Фото',reason:'Фото товара',amountDelta:15_000,status:'approved',createdAt:1},
    {id:'c3',kind:'source-shipping',title:'Доставка',reason:'Магазин',amountDelta:30_000,status:'declined',createdAt:1},
  ]}),'c');
  assert.equal(f.delivery,270_000);assert.equal(f.reserve,0);
  assert.equal(f.goods,1_050_000);assert.equal(f.services,15_000);assert.equal(f.storeShipping,0,'a declined change does not count');
});

test('cancelled and unpaid orders bring no income',()=>{
  assert.equal(orderFinance(order({cancelled:true}),'c').status,'cancelled');
  assert.equal(orderFinance(order({payment:undefined}),'c').status,'pending');
});

test('a month: income minus expenses, profit tax at the set rate, voided entries ignored',()=>{
  const orders=[orderFinance(order(),'c'),orderFinance(order({id:'AT-2',cancelled:true}),'c')];
  const entries=[entry('carrier',150_000),entry('payment_fee',20_000),entry('goods_purchase',1_000_000),entry('customs_help_fee',30_000),entry('rent',500_000,{voidedAt:2,voidReason:'ошибка'}),entry('salary',10_000,{occurredOn:'2026-09-30'})];
  const m=monthSummary('2026-10',orders,entries,0.15);
  assert.equal(m.orders,1);
  assert.equal(m.income.total,320_000+30_000);
  assert.equal(m.expenses.total,170_000,'carrier + payment fee; goods are transit, the void and September are out');
  assert.equal(m.profit,180_000);assert.equal(m.tax,27_000);assert.equal(m.net,153_000);
  assert.equal(m.transit.out,1_000_000);
});

test('CSV opens in Excel: BOM, semicolons, quoted text with separators',()=>{
  const csv=ledgerCsv([{id:'1',kind:'carrier',amountUzs:150_000,occurredOn:'2026-10-12',counterparty:'Cargo; Express',note:'партия "октябрь"',createdBy:'op',createdAt:1}]);
  assert(csv.startsWith('﻿Дата;Вид;'));
  assert(csv.includes('"Cargo; Express"'));assert(csv.includes('"партия ""октябрь"""'));
  assert(ordersCsv([orderFinance(order(),'c')]).includes('AT-1;c;2026-10-10;2026-10-10;оплачен;1000000;'));
  assert(summaryCsv([monthSummary('2026-10',[],[],0.15)]).includes('2026-10;0;'));
});

test('ledger input is validated and months run across a year end',()=>{
  assert.equal(ledgerEntryInput.safeParse({kind:'carrier',amountUzs:-5,occurredOn:'2026-10-12'}).success,false);
  assert.equal(ledgerEntryInput.safeParse({kind:'unknown',amountUzs:5,occurredOn:'2026-10-12'}).success,false);
  assert.deepEqual(monthsBetween('2026-11','2027-02'),['2026-11','2026-12','2027-01','2027-02']);
});

// ---------- 6.10.2026: year, quarters, margin, lock, conversion, search, sparkline ----------

test('a year: twelve months, quarters add up the months, the tax is the sum of monthly taxes',()=>{
  const paid=(id,month,day=10)=>orderFinance(order({id,payment:{id:'p',status:'paid',method:'payment-link',amount:1,createdAt:0,updatedAt:Date.UTC(2026,month-1,day,7)}}),'c');
  const orders=[paid('AT-1',1),paid('AT-2',2),paid('AT-3',5),paid('AT-4',12),orderFinance(order({id:'AT-5',cancelled:true}),'c')];
  const entries=[entry('carrier',100_000,{occurredOn:'2026-01-15'}),entry('rent',1_000_000,{occurredOn:'2026-06-01'}),entry('tax_paid',40_000,{occurredOn:'2026-04-20'}),entry('carrier',5,{occurredOn:'2025-12-31'})];
  const y=yearSummary(2026,orders,entries,0.15);
  assert.equal(y.months.length,12);assert.equal(y.quarters.length,4);
  assert.deepEqual(y.months.map(m=>m.orders),[1,1,0,0,1,0,0,0,0,0,0,1]);
  assert.equal(y.quarters[0].orders,2);assert.equal(y.quarters[1].orders,1);assert.equal(y.quarters[3].orders,1);
  assert.equal(y.quarters[0].income.total,640_000);assert.equal(y.quarters[0].expenses.total,100_000);assert.equal(y.quarters[0].profit,540_000);
  assert.equal(y.quarters[0].tax,y.months[0].tax+y.months[1].tax+y.months[2].tax);
  assert.equal(y.quarters[1].profit,320_000-1_000_000,'June rent makes the quarter negative');
  assert.equal(y.quarters[1].tax,48_000,'May is taxed, June (a loss) is not; the quarter sums monthly tax without netting (a guide, not a filing)');
  assert.equal(y.quarters[1].taxPaid,40_000);
  assert.equal(y.total.orders,4);assert.equal(y.total.income.total,4*320_000);assert.equal(y.total.expenses.total,1_100_000);
  assert.equal(y.total.expenses.carrier,100_000,'December 2025 stays out');
  assert.deepEqual(y.total.months,yearMonths(2026));
  assert.equal(y.quarters[2].label,'3 кв. 2026');
  const empty=sumSummaries('x',[]);assert.deepEqual([empty.orders,empty.income.total,empty.profit,empty.net],[0,0,0,0]);
});

test('an order margin takes the linked expense entries, ignores voided ones, transit and other orders',()=>{
  const f=orderFinance(order(),'c');
  const entries=[entry('carrier',120_000,{orderId:'AT-1'}),entry('payment_fee',8_000,{orderId:'AT-1'}),entry('goods_purchase',1_000_000,{orderId:'AT-1'}),entry('customer_payment',1_360_000,{orderId:'AT-1'}),
    entry('carrier',999_999,{orderId:'AT-1',voidedAt:5,voidReason:'дубль'}),entry('carrier',50_000,{orderId:'AT-2'}),entry('rent',500_000)];
  const m=orderMargin(f,entries);
  assert.equal(m.revenue,320_000);assert.equal(m.linkedExpenses,128_000);assert.equal(m.margin,192_000);
  assert.equal(m.linkedTransitOut,1_000_000);assert.equal(m.linkedTransitIn,1_360_000);
  assert.equal(m.entries.length,4);
  assert.equal(orderMargin(f,[entry('carrier',400_000,{orderId:'AT-1'})]).margin,-80_000,'a loss shows as a negative margin');
  assert.equal(orderMargins([f],[]).length,1);
});

test('closing a period: the lock covers the month and everything before it, settings keep old documents',()=>{
  const settings=accountingSettingsSchema.parse({profitTaxRate:0.15,lockedThrough:'2026-09'});
  assert.equal(isPeriodLocked(settings,'2026-09-30'),true);
  assert.equal(isPeriodLocked(settings,'2026-01-05'),true);
  assert.equal(isPeriodLocked(settings,'2026-10-01'),false);
  assert.equal(isPeriodLocked(settings,'2026-09'),true);
  assert.equal(isPeriodLocked({},'2020-01-01'),false,'no lock by default');
  assert.equal(accountingSettingsSchema.parse({}).lockedThrough,undefined,'an old settings document still parses');
  assert.equal(accountingSettingsSchema.safeParse({lockedThrough:'2026-13'}).success,false);
  assert.equal(accountingSettingsSchema.safeParse({fxRates:{EUR:14_000,eur:1}}).success,false,'currency codes are upper-case');
  assert.match(lockedPeriodMessage('2026-09'),/2026-09/);
});

test('a foreign amount converts to soum: USD by the tariff rate, others by the ledger rates, unknown → null',()=>{
  assert.equal(convertToUzs(10,'USD',12_300),123_000);
  assert.equal(convertToUzs(10.5,'EUR',12_300,{EUR:13_400}),140_700);
  assert.equal(convertToUzs(10,'EUR',12_300),null,'no EUR rate set');
  assert.equal(convertToUzs(10,'GBP',12_300,{EUR:13_400}),null);
  assert.equal(convertToUzs(0,'USD',12_300),null);
  assert.equal(convertToUzs(5,'UZS',12_300),5);
  assert.equal(convertToUzs(1.005,'USD',1000),1005);
});

test('obligations: unpaid orders, positive customer balances, paid orders waiting for buyout',()=>{
  const paid=orderFinance(order(),'c'),paidBought=orderFinance(order({id:'AT-2'}),'c'),pending=orderFinance(order({id:'AT-3',payment:undefined}),'c'),cancelled=orderFinance(order({id:'AT-4',cancelled:true}),'c');
  const o=obligations([paid,paidBought,pending,cancelled],{'AT-1':'0','AT-2':'1','AT-3':'0'},[150_000,0,-20_000,50_000]);
  assert.deepEqual(o.pendingOrders,{count:1,amount:1_360_000});
  assert.deepEqual(o.customerBalances,{count:2,amount:200_000},'negative balances are not an obligation');
  assert.deepEqual(o.transitToStores,{count:1,goods:1_000_000,storeShipping:0,total:1_000_000},'AT-2 is already bought, AT-3 is not paid');
});

test('ledger search and paging: kind, order, counterparty, text, voided; 100 per page',()=>{
  const entries=[entry('carrier',1,{orderId:'AT-10',counterparty:'Cargo Express',note:'октябрь'}),entry('payment_fee',2,{orderId:'AT-11',counterparty:'Payme'}),entry('rent',3,{voidedAt:1,voidReason:'x'})];
  assert.equal(filterLedger(entries,{kind:'carrier'}).length,1);
  assert.equal(filterLedger(entries,{orderId:'at-1'}).length,2);
  assert.equal(filterLedger(entries,{counterparty:'cargo'}).length,1);
  assert.equal(filterLedger(entries,{text:'ОКТЯБРЬ'}).length,1);
  assert.equal(filterLedger(entries,{text:'аренда'}).length,1,'searches the kind name too');
  assert.equal(filterLedger(entries,{voided:'live'}).length,2);assert.equal(filterLedger(entries,{voided:'voided'}).length,1);
  assert.equal(filterLedger(entries,{}).length,3);
  const many=Array.from({length:250},(_,index)=>index);
  assert.deepEqual([paginate(many,1).items.length,paginate(many,3).items.length,paginate(many,3).pages,paginate(many,3).total],[100,50,3,250]);
  assert.equal(paginate(many,99).page,3,'a page past the end clamps to the last one');
  assert.equal(paginate(many,0).page,1);assert.equal(paginate([],1).pages,1);
  const draft=entryDraftFrom({...entries[0],originalAmount:12.5,originalCurrency:'USD'});
  assert.deepEqual(draft,{kind:'carrier',amountUzs:1,occurredOn:'2026-10-12',originalAmount:12.5,originalCurrency:'USD',orderId:'AT-10',counterparty:'Cargo Express',note:'октябрь'});
  assert.equal(ledgerEntryInput.safeParse(draft).success,true,'the copy is a valid input for the corrected entry');
});

test('sparkline: a path across the width, zero baseline inside the box, negatives below it',()=>{
  const line=sparkline([0,100,-50,100],100,50,0);
  assert.equal(line.points.length,4);
  assert.equal(line.points[0].x,0);assert.equal(line.points[3].x,100);
  assert.equal(line.points[1].y,0,'the maximum is at the top');
  assert.equal(line.points[2].y,50,'the minimum is at the bottom');
  assert(line.path.startsWith('M0 '));assert(line.area.endsWith('Z'));
  assert.deepEqual(sparkline([]),{path:'',area:'',points:[],min:0,max:0});
  assert.equal(sparkline([5]).area,'','one point draws no area');
  assert.equal(sparkline([0,0,0]).points[1].y,sparkline([0,0,0]).points[0].y,'a flat zero series does not divide by zero');
});

test('new CSVs: orders with margin and the year by months with quarter rows',()=>{
  const f=orderFinance(order(),'c');
  const margins=orderMarginCsv([f],[entry('carrier',120_000,{orderId:'AT-1'})]);
  assert(margins.startsWith('﻿Заказ;Клиент;'));
  assert(margins.includes('AT-1;c;2026-10-10;2026-10-10;оплачен;320000;98000;210000;12000;0;120000;200000;0;0;1000000;0;1'));
  const y=yearCsv(yearSummary(2026,[f],[],0.15));
  const lines=y.trim().split('\r\n');
  assert.equal(lines.length,1+12+4+1,'header, 12 months, 4 quarters, the year');
  assert(lines[0].includes('Налог на прибыль (15%, ориентир)'));
  assert(lines[4].startsWith('1 кв. 2026;0;'));
  assert(lines[13].startsWith('2026-10;1;98000;210000;12000;0;0;320000;0;320000;48000;272000;'));
  assert(lines[16].startsWith('4 кв. 2026;1;'));
  assert(lines[17].startsWith('2026 год;1;'));
});
