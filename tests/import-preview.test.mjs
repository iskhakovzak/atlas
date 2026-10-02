import test from 'node:test';
import assert from 'node:assert/strict';
import {importRateBuckets} from '../lib/market/import-preview.ts';
test('member imports retain their existing per-account ceiling',async()=>{
 assert.deepEqual(await importRateBuckets('email:member@example.test',null,120000),[{key:'email:member@example.test:import:2',limit:12}]);
});
test('guest previews have shared and hashed edge-IP ceilings without storing raw IPs',async()=>{
 const a=await importRateBuckets(undefined,'192.0.2.1',120000);
 assert.equal(a[0].limit,60);assert.equal(a[1].limit,6);
 assert.equal(a[0].key,'guest:import:global:2');
 assert.ok(!a[1].key.includes('192.0.2.1'));
 assert.deepEqual(a,await importRateBuckets(undefined,'192.0.2.1',120001));
 assert.notEqual(a[1].key,(await importRateBuckets(undefined,'192.0.2.2',120000))[1].key);
 assert.deepEqual(await importRateBuckets(undefined,null,120000),await importRateBuckets(undefined,'',120000));
});
