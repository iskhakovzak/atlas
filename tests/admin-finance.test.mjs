import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeSavedQuotes} from '../lib/market/admin-finance.ts';

const order=(id,quote,payment,cancelled=false)=>({id,quote,payment,cancelled});

test('admin finance keeps saved quote components separate and excludes cancelled orders',()=>{
 const summary=summarizeSavedQuotes([
  order('active',{merchandise:100,service:10,buyout:2,conversion:3,sourceShipping:4,shipping:20,reserve:5,total:144},{status:'pending',amount:144}),
  order('legacy',{merchandise:50,service:0,shipping:0,reserve:0,total:50},undefined),
  order('cancelled',{merchandise:999,service:100,shipping:1,reserve:1,total:1101},{status:'refunded',amount:1101},true),
 ]);
 assert.equal(summary.includedCount,2);
 assert.equal(summary.cancelledCount,1);
 assert.equal(summary.quoteTotal,194);
 assert.equal(summary.atlasFees,15);
 assert.deepEqual(summary.lines.map(line=>line.amount),[150,10,2,3,4,20,5,0,0]);
 assert.deepEqual(summary.paymentStates.pending,{count:1,amount:144});
 assert.deepEqual(summary.paymentStates.unrecorded,{count:1,amount:0});
 assert.equal(summary.paymentStates.refunded.count,0);
});
