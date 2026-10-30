import test from 'node:test';
import assert from 'node:assert/strict';
import {finalizeBatch} from '../lib/market/catalog-batch.ts';
const job=(count=12)=>({id:'id',status:'running',urls:Array.from({length:count},(_,i)=>`https://example.com/${i}`),collectionIds:[],country:'USA',results:[],leaseUntil:100,leaseId:'lease',updatedAt:0});
const result=url=>({url,status:'saved'});
test('batch progress advances exactly the claimed URLs and can resume',()=>{
 const original=job();const first=finalizeBatch(original,original.urls.slice(0,10).map(result),1);
 assert.equal(first.results.length,10);assert.equal(first.status,'running');assert.equal(first.leaseUntil,0);
 const last=finalizeBatch(first,first.urls.slice(10).map(result),2);
 assert.equal(last.status,'completed');assert.equal(last.results.length,12);
});
test('partial or out-of-order results cannot advance the queue',()=>{
 const original=job(2);
 assert.throws(()=>finalizeBatch(original,[result(original.urls[0])],1));
 assert.throws(()=>finalizeBatch(original,original.urls.slice().reverse().map(result),1));
 assert.equal(original.results.length,0);
});
test('pause remains in force after an in-flight step',()=>{
 const original={...job(2),status:'paused'};
 assert.equal(finalizeBatch(original,original.urls.map(result),1).status,'completed');
 const larger={...job(11),status:'paused'};
 assert.equal(finalizeBatch(larger,larger.urls.slice(0,10).map(result),1).status,'paused');
});
