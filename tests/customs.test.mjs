import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateCourierCustoms as estimate, courierRule } from '../lib/market/customs.ts';
const input = {valueUsd:300,grossKg:1,date:'2026-09-11'};
test('courier allowance applies only once and unified payment does not add VAT',()=>{
 assert.equal(estimate(input).lowerUsd,30);
 assert.equal(estimate({...input,valueUsd:200}).upperUsd,0);
 assert.equal(estimate({...input,valueUsd:100,usedUsd:150}).lowerUsd,15);
 assert.equal(estimate({...input,usedUsd:300}).lowerUsd,90);
});
test('scheduled rate changes at arrival date, not earlier',()=>{
 assert.equal(courierRule('2026-12-31').rate,.3);
 assert.equal(estimate({...input,date:'2027-01-01'}).lowerUsd,20);
 assert.equal(courierRule('2027-01-01').minimumPerKg,2);
});
test('unknown dutiable weight is a range, not invented proportional weight',()=>{
 assert.deepEqual([estimate({...input,valueUsd:201,grossKg:10}).lowerUsd,estimate({...input,valueUsd:201,grossKg:10}).upperUsd],[.3,30]);
 assert.equal(estimate({...input,grossKg:undefined}).upperUsd,undefined);
});
test('reject invalid amounts, weights and calendar dates',()=>{
 for(const change of [{valueUsd:NaN},{valueUsd:-1},{usedUsd:-1},{grossKg:0},{grossKg:Infinity},{date:'2026-02-30'},{date:'2025-04-30'},{date:'invalid'}]) assert.equal(estimate({...input,...change}),null);
});
