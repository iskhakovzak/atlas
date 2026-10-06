import test from 'node:test';
import assert from 'node:assert/strict';
import {blank,parseState,acceptConsents} from '../lib/market/domain.ts';
import {actionSchema,applyAction} from '../lib/market/actions.ts';
import {consentVersion} from '../lib/market/account-delete.ts';

test('actionSchema accepts consent-accept with 1–2 known documents and rejects the rest',()=>{
 assert.ok(actionSchema.safeParse({type:'consent-accept',documents:['privacy','terms'],version:consentVersion}).success);
 assert.ok(actionSchema.safeParse({type:'consent-accept',documents:['terms'],version:'2026-01-01'}).success);
 assert.equal(actionSchema.safeParse({type:'consent-accept',documents:[],version:consentVersion}).success,false);
 assert.equal(actionSchema.safeParse({type:'consent-accept',documents:['privacy','terms','privacy'],version:consentVersion}).success,false);
 assert.equal(actionSchema.safeParse({type:'consent-accept',documents:['cookies'],version:consentVersion}).success,false);
 assert.equal(actionSchema.safeParse({type:'consent-accept',documents:['privacy'],version:''}).success,false);
 assert.equal(actionSchema.safeParse({type:'consent-accept',documents:['privacy'],version:'x'.repeat(41)}).success,false);
});

test('applyAction upserts one entry per document, latest version wins',()=>{
 let s=applyAction(blank(),{type:'consent-accept',documents:['privacy','terms'],version:'2026-01-01'},false);
 assert.equal(s.consents.length,2);
 assert.deepEqual(s.consents.map(c=>c.key).sort(),['privacy','terms']);
 assert.ok(s.consents.every(c=>c.version==='2026-01-01'&&typeof c.acceptedAt==='number'));
 s=applyAction(s,{type:'consent-accept',documents:['privacy'],version:consentVersion},false);
 assert.equal(s.consents.length,2);
 assert.equal(s.consents.find(c=>c.key==='privacy').version,consentVersion);
 assert.equal(s.consents.find(c=>c.key==='terms').version,'2026-01-01');
 // Accepting what is already held changes nothing.
 const again=acceptConsents(s,['privacy'],consentVersion,99);
 assert.equal(again,s);
 assert.equal(parseState(JSON.stringify(s)).consents.length,2);
});

test('older account JSON without consents still parses and leaves the field absent',()=>{
 const stored=JSON.parse(JSON.stringify(blank()));
 delete stored.consents;
 const s=parseState(JSON.stringify(stored));
 assert.equal(s.consents,undefined);
 assert.equal(blank().consents,undefined);
 assert.equal(parseState(JSON.stringify({...stored,consents:[{key:'privacy',version:consentVersion,acceptedAt:1}]})).consents.length,1);
 assert.throws(()=>parseState(JSON.stringify({...stored,consents:[{key:'nope',version:'1',acceptedAt:1}]})));
});
