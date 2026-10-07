import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {impactHeadScript,impactScriptUrl,startImpactTracking} from '../lib/market/impact-tracking.ts';

test('server head exposes the verification code but defers external loading until consent starts it',()=>{
  const scripts=[],target={};
  const first={parentNode:{insertBefore:script=>scripts.push(script)}};
  const page={getElementById:id=>scripts.find(script=>script.id===id),createElement:()=>({}),getElementsByTagName:()=>[first]};
  runInNewContext(impactHeadScript,{window:target,document:page});
  assert.ok(impactHeadScript.includes(impactScriptUrl));
  assert.equal(scripts.length,0);
  startImpactTracking(target,page);startImpactTracking(target,page);
  assert.equal(scripts.length,1);assert.equal(scripts[0].src,impactScriptUrl);
  assert.deepEqual(Array.from(target.impactStat.a,args=>Array.from(args)),[['transformLinks'],['trackImpression']]);
});

test('Impact bootstrap loads the exact async partner script once and queues both requested commands',()=>{
  const scripts=[],target={};
  const page={getElementById:id=>scripts.find(script=>script.id===id),createElement:tag=>{assert.equal(tag,'script');return {};},getElementsByTagName:()=>[],head:{appendChild:script=>scripts.push(script)}};
  startImpactTracking(target,page);startImpactTracking(target,page);
  assert.equal(scripts.length,1);assert.equal(scripts[0].src,impactScriptUrl);assert.equal(scripts[0].async,true);
  assert.equal(target.ire_o,'impactStat');assert.deepEqual(target.impactStat.a,[['transformLinks'],['trackImpression']]);
});

test('Impact bootstrap preserves an existing vendor function and supports insertion before a script',()=>{
  const calls=[],vendor=(...args)=>calls.push(args),target={impactStat:vendor};let inserted;
  const first={parentNode:{insertBefore:(script,reference)=>{assert.equal(reference,first);inserted=script;}}};
  const page={getElementById:()=>undefined,createElement:()=>({}),getElementsByTagName:()=>[first]};
  startImpactTracking(target,page);
  assert.equal(target.impactStat,vendor);assert.equal(inserted.src,impactScriptUrl);assert.deepEqual(calls,[['transformLinks'],['trackImpression']]);
});
