import test from 'node:test';
import assert from 'node:assert/strict';
import {syncOrderLedger,planAutoLedger,isAutoEntry,autoBaseId,reconcile,cashPosition,taxCalendar,parseBankStatement,matchBankLines,invoiceData,fullBookCsv,shiftMonth,invoiceDisclaimer} from '../lib/market/finance-auto.ts';
import {orderFinance,monthSummary,yearSummary,obligations,ledgerKinds,entrySource,ledgerEntryInput} from '../lib/market/finance.ts';

const quote={id:'q',createdAt:0,expiresAt:0,merchandise:1_012_000,service:90_000,buyout:5_000,conversion:3_000,shipping:200_000,deliveryMargin:10_000,reserve:40_000,sourceShipping:0,optionalServices:0,total:1_360_000,weight:1.3,tariffVersion:'v',fx:12_144,fxMarkup:1.012};
const t0=Date.UTC(2026,9,10,7),t1=t0+86400_000*2,t2=t0+86400_000*5;
const order=(extra={})=>({id:'AT-1',product:{brand:'Nike',sourceUrl:'https://nike.com/x'},variant:'M',status:0,createdAt:t0-1000,cancelled:false,quote,quantity:1,balanceUsed:0,history:[{at:t0,text:'Статус оплаты отмечен в Atlas. Платёжный провайдер не подтвердил списание.'}],payment:{id:'p',status:'paid',method:'payment-link',amount:1_360_000,createdAt:t0-1000,updatedAt:t0},...extra});
const bought=(extra={})=>order({status:1,history:[...order().history,{at:t1,text:'Выкуплен'}],...extra});
const row=(entry,extra={})=>({createdBy:'system:auto',createdAt:1,...entry,...extra});
const byId=(entries)=>Object.fromEntries(entries.map((entry)=>[entry.id,entry]));

test('a paid order gives one payment entry; buying it adds the goods purchase on the day of the status event',()=>{
  const paid=syncOrderLedger(order(),'email:a@b.uz');
  assert.deepEqual(paid.map((entry)=>entry.id),['AUTO-AT-1-customer_payment']);
  assert.equal(paid[0].amountUzs,1_360_000);assert.equal(paid[0].occurredOn,'2026-10-10');assert.equal(paid[0].orderId,'AT-1');
  const entries=syncOrderLedger(bought(),'c');
  const goods=byId(entries)['AUTO-AT-1-goods_purchase'];
  assert.equal(goods.amountUzs,1_000_000,'goods without the fx markup');assert.equal(goods.occurredOn,'2026-10-12');assert.equal(goods.counterparty,'Nike');
  assert.equal(ledgerKinds[goods.kind].group,'transit');
  assert.deepEqual(syncOrderLedger(bought(),'c'),entries,'deterministic: the same order gives the same list');
});

test('balance payment, store delivery, customs and balance refunds; a cancelled order returns what Atlas held',()=>{
  const full=bought({balanceUsed:60_000,payment:{...order().payment,amount:1_300_000},
    storeShippingSettlement:{estimated:120_000,actual:100_000,actualUsd:8,refund:20_000,extra:0},
    customsSettlement:{estimated:50_000,actual:30_000,actualUsd:2.5,refund:20_000,extra:0,at:t2},
    settlement:{actualWeight:1,dimensionalWeight:1,chargeableWeight:1,shipping:150_000,refund:50_000,extra:0},
    history:[...bought().history,{at:t1,text:'Менеджер подтвердил доставку магазина. Возврат разницы: 20 000'},{at:t2,text:'Взвешивание завершено. Возврат остатка: 50 000'}]});
  const ids=byId(syncOrderLedger(full,'c'));
  assert.equal(ids['AUTO-AT-1-balance_payment'].amountUzs,60_000);
  assert.equal(ids['AUTO-AT-1-customer_payment'].amountUzs,1_300_000);
  assert.equal(ids['AUTO-AT-1-store_shipping'].amountUzs,100_000);
  assert.equal(ids['AUTO-AT-1-customs_paid'].amountUzs,30_000);assert.equal(ids['AUTO-AT-1-customs_paid'].occurredOn,'2026-10-15');
  assert.equal(ids['AUTO-AT-1-balance_refund-store-shipping'].amountUzs,20_000);
  assert.equal(ids['AUTO-AT-1-balance_refund-customs'].amountUzs,20_000);
  assert.equal(ids['AUTO-AT-1-balance_refund-settlement'].amountUzs,50_000);
  assert.equal(Object.keys(ids).length,8);
  // Extra above the estimate waits for the customer's consent: only the agreed part is booked.
  const pending=byId(syncOrderLedger(bought({storeShippingSettlement:{estimated:120_000,actual:150_000,actualUsd:12,refund:0,extra:30_000}}),'c'));
  assert.equal(pending['AUTO-AT-1-store_shipping'].amountUzs,120_000);
  const approved=byId(syncOrderLedger(bought({storeShippingSettlement:{estimated:120_000,actual:150_000,actualUsd:12,refund:0,extra:30_000},storeShippingExtraApproved:true}),'c'));
  assert.equal(approved['AUTO-AT-1-store_shipping'].amountUzs,150_000);
  // Cancelled after the payment mark: the payment stays in the books, the goods are gone, the money goes back to the balance.
  const cancelled=byId(syncOrderLedger(order({cancelled:true,balanceUsed:60_000,payment:{...order().payment,status:'refunded',amount:1_300_000,updatedAt:t2},history:[...order().history,{at:t2,text:'Заказ отменён до выкупа. Сумма учтена на внутреннем балансе Atlas; банковский перевод не выполнялся.'}]}),'c',{balanceEntries:[{id:'demo-payment:AT-1',orderId:'AT-1',at:t0,amount:1_300_000,debit:'demo-provider',credit:'order-funds',description:''}]}));
  assert.deepEqual(Object.keys(cancelled).sort(),['AUTO-AT-1-balance_payment','AUTO-AT-1-balance_refund-cancel','AUTO-AT-1-customer_payment']);
  assert.equal(cancelled['AUTO-AT-1-balance_refund-cancel'].amountUzs,1_360_000);assert.equal(cancelled['AUTO-AT-1-balance_refund-cancel'].occurredOn,'2026-10-15');
  assert.equal(cancelled['AUTO-AT-1-customer_payment'].occurredOn,'2026-10-10','the payment keeps its own day, not the refund day');
  // Cancelled while still unpaid: the balance entries show no payment, so nothing came in and nothing goes back.
  const unpaid=syncOrderLedger(order({cancelled:true,payment:{...order().payment,status:'refunded'},history:[]}),'c',{balanceEntries:[]});
  assert.deepEqual(unpaid,[]);
  for(const entry of [...Object.values(cancelled),...Object.values(ids)])assert.equal(ledgerEntryInput.safeParse(entry).success,true,'every auto entry validates as a ledger input');
});

test('planAutoLedger is idempotent, voids what disappeared, re-issues a changed entry, respects manual voids and closed months',()=>{
  const expected=syncOrderLedger(bought(),'c');
  const first=planAutoLedger(expected,[],{});
  assert.equal(first.insert.length,2);assert.equal(first.void.length,0);
  const stored=first.insert.map((entry)=>row(entry));
  const second=planAutoLedger(expected,stored,{});
  assert.deepEqual([second.insert.length,second.void.length,second.unchanged],[0,0,2],'nothing changes on a second run');
  // The order got cancelled: the goods purchase goes, the refund appears.
  const cancelled=syncOrderLedger(bought({cancelled:true,payment:{...order().payment,status:'refunded'}}),'c');
  const third=planAutoLedger(cancelled,stored,{});
  assert.deepEqual(third.void.map((item)=>item.id),['AUTO-AT-1-goods_purchase']);assert.match(third.void[0].reason,/^auto:/);
  assert.deepEqual(third.insert.map((entry)=>entry.id),['AUTO-AT-1-balance_refund-cancel']);
  // Approved price change: the goods amount differs, so the live row is voided and a "-2" row inserted.
  const changed=syncOrderLedger(bought({changeRequests:[{id:'c1',kind:'price',title:'Цена',reason:'r',amountDelta:50_000,status:'approved',createdAt:1}]}),'c');
  const fourth=planAutoLedger(changed,stored,{});
  assert.deepEqual(fourth.void.map((item)=>item.id),['AUTO-AT-1-goods_purchase']);
  assert.deepEqual(fourth.insert.map((entry)=>[entry.id,entry.amountUzs]),[['AUTO-AT-1-goods_purchase-2',1_050_000]]);
  assert.equal(autoBaseId('AUTO-AT-1-goods_purchase-2'),'AUTO-AT-1-goods_purchase');
  const fifth=planAutoLedger(changed,[...stored.map((item)=>item.id==='AUTO-AT-1-goods_purchase'?{...item,voidedAt:5,voidReason:fourth.void[0].reason}:item),row(fourth.insert[0])],{});
  assert.deepEqual([fifth.insert.length,fifth.void.length,fifth.unchanged],[0,0,2],'the re-issued row is now the live one');
  // A row the operator voided by hand is not re-created.
  const manual=planAutoLedger(expected,stored.map((item)=>item.id==='AUTO-AT-1-goods_purchase'?{...item,voidedAt:5,voidReason:'дубль'}:item),{});
  assert.deepEqual([manual.insert.length,manual.void.length],[0,0]);
  // Closed month: neither inserted nor voided, listed as skipped.
  const lockedPlan=planAutoLedger(cancelled,stored,{lockedThrough:'2026-10'},99);
  assert.deepEqual(lockedPlan.insert,[]);assert.deepEqual(lockedPlan.void,[]);
  assert.deepEqual(lockedPlan.skipped.map((item)=>[item.id,item.action]).sort(),[['AUTO-AT-1-balance_refund-cancel','insert'],['AUTO-AT-1-goods_purchase','void']]);
  assert.equal(lockedPlan.skipped[0].at,99);
  // Manual rows are never part of the plan.
  const withManual=planAutoLedger(expected,[...stored,row({id:'LED-x',kind:'goods_purchase',amountUzs:1,occurredOn:'2026-10-12',orderId:'AT-1'})],{});
  assert.deepEqual([withManual.insert.length,withManual.void.length],[0,0]);
  assert.equal(isAutoEntry({id:'LED-x'}),false);assert.equal(entrySource('BANK-1'),'bank');
});

test('reconcile explains what is off: payments, overpaid goods, stale buyouts, unknown orders, skipped autos',()=>{
  const paid=orderFinance(bought(),'c'),other=orderFinance(order({id:'AT-2'}),'c');
  const auto=syncOrderLedger(bought(),'c').map((entry)=>row(entry));
  const summary=monthSummary('2026-10',[paid,other],auto,0.15);
  const now=t0+86400_000*30;
  const clean=reconcile({month:'2026-10',orders:[paid,other],entries:auto,orderEntries:[...auto,row({id:'AUTO-AT-2-customer_payment',kind:'customer_payment',amountUzs:1_360_000,occurredOn:'2026-10-10',orderId:'AT-2'})],stages:{'AT-1':'1','AT-2':'0'},knownOrderIds:[],summary,settings:{lockedThrough:'2026-09'},now});
  assert.equal(clean.ok,true);
  const by=Object.fromEntries(clean.checks.map((check)=>[check.id,check]));
  assert.equal(by['payments-match'].severity,'ok');
  assert.equal(by['paid-not-bought'].severity,'warn','AT-2 paid 30 days ago and still waiting');assert.deepEqual(by['paid-not-bought'].orderIds,['AT-2']);
  assert.equal(by['unclosed-months'].severity,'ok','closed through September, the month before the threshold');
  assert.equal(by['negative-profit'].severity,'ok');
  const messy=reconcile({month:'2026-10',orders:[paid],entries:[...auto.filter((entry)=>entry.kind!=='customer_payment'),row({id:'LED-1',kind:'carrier',amountUzs:90_000,occurredOn:'2026-10-20'}),row({id:'LED-2',kind:'goods_purchase',amountUzs:5_000,occurredOn:'2026-10-20',orderId:'AT-1'}),row({id:'LED-3',kind:'rent',amountUzs:5_000_000,occurredOn:'2026-10-20',orderId:'AT-404'}),row({id:'AUTO-AT-9-customer_payment',kind:'customer_payment',amountUzs:5,occurredOn:'2026-10-02',orderId:'AT-9',voidedAt:3,voidReason:'ошибка'})],
    orderEntries:[...auto.filter((entry)=>entry.kind!=='customer_payment'),row({id:'LED-2',kind:'goods_purchase',amountUzs:5_000,occurredOn:'2026-10-20',orderId:'AT-1'})],stages:{'AT-1':'1'},knownOrderIds:['AT-9'],
    summary:monthSummary('2026-10',[paid],[row({id:'LED-3',kind:'rent',amountUzs:5_000_000,occurredOn:'2026-10-20'})],0.15),settings:{},skipped:[{id:'AUTO-AT-1-store_shipping',kind:'store_shipping',amountUzs:1,occurredOn:'2026-10-11',orderId:'AT-1',action:'insert',reason:'закрыт',at:1}],now});
  const m=Object.fromEntries(messy.checks.map((check)=>[check.id,check]));
  assert.equal(messy.ok,false);assert.equal(messy.errors,2);
  assert.equal(m['payments-match'].severity,'error');assert.deepEqual(m['payments-match'].orderIds,['AT-1']);
  assert.equal(m['goods-within-order'].severity,'warn','1 000 000 + 5 000 > goods');
  assert.equal(m['unknown-order'].severity,'warn');assert.deepEqual(m['unknown-order'].orderIds,['AT-404']);
  assert.equal(m['carrier-unlinked'].severity,'info');assert.equal(m['carrier-unlinked'].amount,90_000);
  assert.equal(m['income-vs-auto'].severity,'warn');assert.equal(m['income-vs-auto'].amount,1_360_000);
  assert.equal(m['negative-profit'].severity,'warn');
  assert.equal(m['unclosed-months'].severity,'info');assert.match(m['unclosed-months'].detail,/нет закрытых/);
  assert.equal(m['auto-skipped'].severity,'error');assert.match(m['auto-skipped'].detail,/Откройте месяц заново/);
  assert.equal(m['auto-voided-manually'].severity,'info');assert.equal(m['auto-voided-manually'].count,1);
  assert.equal(shiftMonth('2026-01',-3),'2025-10');assert.equal(shiftMonth('2026-11',2),'2027-01');
});

test('cash position adds the year up to the month: receivables, owed to stores, balances, tax due',()=>{
  const paid=orderFinance(bought(),'c'),pending=orderFinance(order({id:'AT-2',payment:undefined}),'c'),unbought=orderFinance(order({id:'AT-3'}),'c');
  const ob=obligations([paid,pending,unbought],{'AT-1':'1','AT-3':'0'},[25_000,-3,0]);
  const months=['2026-08','2026-09','2026-10','2026-11'].map((month)=>monthSummary(month,[paid],[{id:'t',kind:'tax_paid',amountUzs:10_000,occurredOn:'2026-09-15',createdBy:'o',createdAt:1}],0.15));
  const cash=cashPosition('2026-10',months,ob);
  assert.deepEqual(cash.receivable,{count:1,amount:1_360_000});
  assert.deepEqual(cash.owedToStores,{count:1,goods:1_000_000,storeShipping:0,total:1_000_000});
  assert.deepEqual(cash.customerBalances,{count:1,amount:25_000});
  assert.deepEqual(cash.tax,{accrued:48_000,paid:10_000,due:38_000},'October accrues 15% of 320 000; November is outside');
  assert.deepEqual(cash.ytd,{income:320_000,expenses:0,profit:320_000,net:272_000,orders:1});
  assert.match(cash.note,/симулируются/);
});

test('tax calendar: quarters with deadlines, cumulative accrual against payments, statuses',()=>{
  const paid=orderFinance(bought({payment:{...order().payment,updatedAt:Date.UTC(2026,1,10)}}),'c');
  const taxPaid=[{id:'t1',kind:'tax_paid',amountUzs:30_000,occurredOn:'2026-04-10',createdBy:'o',createdAt:1},{id:'t2',kind:'tax_paid',amountUzs:18_000,occurredOn:'2026-05-02',createdBy:'o',createdAt:1}];
  const summary=yearSummary(2026,[paid],taxPaid,0.15);
  const calendar=taxCalendar(summary,taxPaid,Date.UTC(2026,9,6));
  assert.match(calendar.note,/сверьте с бухгалтером/);
  const [q1,q2,q3,q4]=calendar.quarters;
  assert.deepEqual([q1.tax,q1.deadline,q1.periodEnd,q1.paidToDate,q1.due,q1.status],[48_000,'2026-04-20','2026-03-31',30_000,18_000,'overdue'],'only the April payment counts by the deadline');
  assert.deepEqual([q2.tax,q2.accruedToDate,q2.paidToDate,q2.due,q2.status],[0,48_000,48_000,0,'paid'],'the May payment settles the rest by the July deadline');
  assert.equal(q3.status,'paid');assert.equal(q3.deadline,'2026-10-20');
  assert.deepEqual([q4.status,q4.deadline],['current','2027-03-01']);
  assert.equal(taxCalendar(yearSummary(2027,[],[],0.15),[],Date.UTC(2026,9,6)).quarters[0].status,'upcoming');
  assert.equal(taxCalendar(yearSummary(2025,[],[],0.15),[],Date.UTC(2026,9,6)).quarters[3].status,'none','no tax, nothing due');
});

test('bank statement: parse dates and amounts, match order numbers, propose only what is not yet recorded',()=>{
  const parsed=parseBankStatement('﻿Дата;Сумма;Назначение\r\n2026-10-10;1 360 000,00;Оплата заказа AT-0000000A Иванов\r\n12.10.2026;"500000";Перевод at-0000000b (сверка)\r\n13.10.2026;-7;ошибка\r\n\r\nнет даты;5;x\r\n14.10.2026;10;без номера\r\n15.10.2026;77;Заказ AT-00000404\r\n16.10.2026;1360000;AT-0000000C отменён');
  assert.equal(parsed.errors.length,2);assert.deepEqual(parsed.errors.map((item)=>item.row),[4,6]);
  assert.deepEqual(parsed.lines.map((line)=>[line.row,line.date,line.amount,line.orderId]),[[2,'2026-10-10',1_360_000,'AT-0000000A'],[3,'2026-10-12',500_000,'AT-0000000B'],[7,'2026-10-14',10,undefined],[8,'2026-10-15',77,'AT-00000404'],[9,'2026-10-16',1_360_000,'AT-0000000C']]);
  assert.equal(parseBankStatement('2026-10-10\t5\tAT-0000000A tab').lines[0].orderId,'AT-0000000A');
  const orders={'AT-0000000A':orderFinance(bought({id:'AT-0000000A'}),'c'),'AT-0000000B':orderFinance(order({id:'AT-0000000B',payment:undefined}),'c'),'AT-0000000C':orderFinance(order({id:'AT-0000000C',cancelled:true}),'c')};
  const proposals=matchBankLines(parsed.lines,orders,{'AT-0000000A':1_360_000});
  assert.deepEqual(proposals.map((item)=>[item.row,item.action]),[[2,'skip'],[3,'propose'],[7,'skip'],[8,'skip'],[9,'skip']]);
  assert.match(proposals[0].reason,/уже записана/);assert.equal(proposals[0].alreadyRecorded,true);
  assert.match(proposals[1].reason,/отличается/);assert.equal(proposals[1].entry.kind,'customer_payment');assert.equal(proposals[1].entry.orderId,'AT-0000000B');assert.equal(proposals[1].entry.occurredOn,'2026-10-12');
  assert.equal(ledgerEntryInput.safeParse(proposals[1].entry).success,true);
  assert.match(proposals[2].reason,/нет номера/);assert.match(proposals[3].reason,/не найден/);assert.match(proposals[4].reason,/отменён/);
});

test('invoice data: lines from the fee lines, totals, never a fiscal document',()=>{
  const f=orderFinance(bought(),'c');
  const lines=[{kind:'item',label:'Товар',amount:1_012_000},{kind:'service',label:'Сервис Atlas',amount:90_000},{kind:'buyout',label:'Комиссия за выкуп',amount:5_000},{kind:'conversion',label:'Конвертация',amount:3_000},{kind:'merchant_shipping',label:'Доставка магазина',amount:0},{kind:'international_shipping',label:'Международная доставка',amount:200_000},{kind:'delivery_margin',label:'Маржа доставки',amount:10_000},{kind:'international_reserve',label:'Резерв доставки',amount:40_000},{kind:'adjustment_price',label:'Цена выросла',amount:50_000}];
  const invoice=invoiceData(f,lines,{id:'c',name:'Иван'},1_410_000,7);
  assert.equal(invoice.number,'AT-1');assert.equal(invoice.lines.length,8,'zero lines are dropped');
  assert.deepEqual([invoice.goods,invoice.services,invoice.delivery,invoice.total],[1_062_000,98_000,250_000,1_410_000]);
  assert.equal(invoice.statusRu,'оплата отмечена в Atlas');assert.equal(invoice.disclaimer,invoiceDisclaimer);assert.match(invoice.disclaimer,/Не фискальный документ/);
  assert.equal(invoiceData(f,lines,{id:'c'}).total,1_410_000,'without the record total: payable plus approved adjustments');
  assert.deepEqual(invoice.split,{transit:1_040_000,atlasIncome:320_000});
});

test('the full book of a month lists every ledger row with its source and the order rows',()=>{
  const f=orderFinance(bought(),'c');
  const entries=[...syncOrderLedger(bought(),'c').map((entry)=>row(entry)),row({id:'LED-1',kind:'carrier',amountUzs:90_000,occurredOn:'2026-10-20',voidedAt:t2,voidReason:'дубль'}),row({id:'BANK-1',kind:'customer_payment',amountUzs:1,occurredOn:'2026-10-21',orderId:'AT-7'})];
  const csv=fullBookCsv('2026-10',[f],entries,monthSummary('2026-10',[f],entries,0.15));
  assert(csv.startsWith('﻿Полная книга месяца;2026-10'));
  assert(csv.includes('AUTO-AT-1-goods_purchase;авто;2026-10-12;Оплата магазину за товар;транзит;расход;1000000;'));
  assert(csv.includes('LED-1;вручную;2026-10-20;Перевозчик'));assert(csv.includes(';2026-10-15;дубль'));
  assert(csv.includes('BANK-1;выписка;'));
  assert(csv.includes('\r\nЗаказы\r\nЗаказ;Клиент;'));assert(csv.includes('AT-1;c;2026-10-10;2026-10-10;оплачен;1000000;'));
});
