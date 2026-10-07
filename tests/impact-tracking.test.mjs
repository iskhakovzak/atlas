import test from 'node:test';
import assert from 'node:assert/strict';
import {impactScriptUrl,startImpactTracking} from '../lib/market/impact-tracking.ts';

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
