import test from 'node:test';
import assert from 'node:assert/strict';
import {orderFinance,monthSummary,ordersCsv,ledgerCsv,summaryCsv,ledgerEntryInput,monthsBetween} from '../lib/market/finance.ts';

const quote={id:'q',createdAt:0,expiresAt:0,merchandise:1_012_000,service:90_000,buyout:5_000,conversion:3_000,shipping:200_000,deliveryMargin:10_000,reserve:40_000,sourceShipping:0,optionalServices:0,total:1_360_000,weight:1.3,tariffVersion:'v',fx:12_144,fxMarkup:1.012};
const paidAt=Date.UTC(2026,9,10,7);
const order=(extra={})=>({id:'AT-1',status:2,createdAt:paidAt-1000,cancelled:false,quote,history:[],payment:{id:'p',status:'paid',method:'payment-link',amount:1_360_000,createdAt:paidAt,updatedAt:paidAt},...extra});

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
  const entry=(kind,amountUzs,extra={})=>({id:kind+amountUzs,kind,amountUzs,occurredOn:'2026-10-12',createdBy:'op',createdAt:1,...extra});
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
