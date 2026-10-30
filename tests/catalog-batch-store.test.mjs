import test from 'node:test';
import assert from 'node:assert/strict';
import {createBatchStore} from '../lib/market/catalog-batch-store.ts';
import {DatabaseSync} from 'node:sqlite';
import {publicBatchJob} from '../lib/market/catalog-batch.ts';

function fakeD1(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('CREATE TABLE market_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL,updated_by TEXT NOT NULL)');
 return {sqlite,prepare(sql){return {bind(...args){return {
  async first(){return sqlite.prepare(sql).get(...args)??null},
  async run(){const result=sqlite.prepare(sql).run(...args);return {meta:{changes:result.changes}}},
 }}}}};
}
const makeJob=(id)=>({id,status:'running',urls:['https://www.ebay.com/itm/12345678'],country:'USA',collectionIds:[],results:[],leaseUntil:0,updatedAt:0,principal:{email:'private@example.com',method:'email'}});
test('D1 CAS admits one creator, isolates owners and rejects stale updates',async()=>{
 const db=fakeD1(),store=createBatchStore(()=>db,()=>Error('too large'));
 assert.equal(await store.write('one',makeJob('one'),null),true);
 assert.equal(await store.write('one',makeJob('other'),null),false);
 assert.equal(await store.write('two',makeJob('two'),null),true);
 const one=await store.read('one'),two=await store.read('two');
 assert.equal(one.job.id,'one');assert.equal(two.job.id,'two');
 assert.equal(await store.write('one',{...one.job,leaseId:'first'},one.raw),true);
 assert.equal(await store.write('one',{...one.job,leaseId:'second'},one.raw),false);
 assert.equal((await store.read('one')).job.leaseId,'first');
 db.sqlite.prepare('DELETE FROM market_settings WHERE key=?').run('catalog-batch:one');
 assert.equal(await store.write('one',one.job,one.raw),false,'a stale update must never recreate a deleted row');
});
test('server identity is stripped from browser-visible jobs',()=>{
 assert.equal('principal' in publicBatchJob(makeJob('one')),false);
});
