import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyticsStorageKeys,cookieAllowed,cookieConsentKey,cookieConsentVersion,effectiveCookieChoice,legacyConsentKeys,makeCookieChoice,parseCookieChoice,partnerCookieNames,readCookieChoice,writeCookieChoice} from '../lib/market/cookie-consent.ts';
import {actionSchema,applyAction} from '../lib/market/actions.ts';
import {blank,parseState} from '../lib/market/domain.ts';

const memory=(entries={})=>{const map=new Map(Object.entries(entries));return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};

test('no choice by default: optional categories stay off',()=>{
  const storage=memory();
  assert.equal(readCookieChoice(storage),null);
  assert.equal(readCookieChoice(null),null);
  assert.equal(cookieAllowed(null,'analytics'),false);
  assert.equal(cookieAllowed(null,'partners'),false);
  // The old one-button acceptance (Impact included) is not taken as consent to the new categories.
  assert.equal(readCookieChoice(memory({'atlas-consent-v1':'2026-10-13'})),null);
});

test('categories gate separately: necessary-only, analytics-only, accept all',()=>{
  const none=makeCookieChoice({analytics:false,partners:false},1);
  assert.equal(cookieAllowed(none,'analytics'),false);assert.equal(cookieAllowed(none,'partners'),false);
  const analytics=makeCookieChoice({analytics:true,partners:false},1);
  assert.equal(cookieAllowed(analytics,'analytics'),true);assert.equal(cookieAllowed(analytics,'partners'),false);
  const all=makeCookieChoice({analytics:true,partners:true},1);
  assert.equal(cookieAllowed(all,'analytics'),true);assert.equal(cookieAllowed(all,'partners'),true);
  // Anything but an explicit true is a no.
  assert.equal(makeCookieChoice({analytics:'yes',partners:1},1).analytics,false);
});

test('choice is versioned: another version or a malformed record means asking again',()=>{
  const storage=memory();
  assert.ok(writeCookieChoice(storage,makeCookieChoice({analytics:true,partners:false},5)));
  assert.deepEqual(readCookieChoice(storage),{version:cookieConsentVersion,analytics:true,partners:false,at:5});
  storage.setItem(cookieConsentKey,JSON.stringify({version:'2020-01-01',analytics:true,partners:true,at:5}));
  assert.equal(readCookieChoice(storage),null);
  for(const bad of ['nope','{}',JSON.stringify({version:cookieConsentVersion,analytics:true,partners:true}),JSON.stringify({version:cookieConsentVersion,analytics:1,partners:true,at:1})]){
    storage.setItem(cookieConsentKey,bad);assert.equal(readCookieChoice(storage),null);
  }
  assert.equal(parseCookieChoice({version:cookieConsentVersion,analytics:false,partners:false,at:1},'2099-01-01'),null);
});

test('withdrawing analytics removes its local data; any choice drops the old notice keys',()=>{
  const storage=memory({'atlas-consent-v1':'2026-10-13','atlas-storage-notice-v1':'dismissed',[analyticsStorageKeys[0]]:'[]'});
  writeCookieChoice(storage,makeCookieChoice({analytics:true,partners:true},1));
  for(const key of legacyConsentKeys)assert.equal(storage.getItem(key),null);
  assert.equal(storage.getItem(analyticsStorageKeys[0]),'[]');
  writeCookieChoice(storage,makeCookieChoice({analytics:false,partners:true},2));
  assert.equal(storage.getItem(analyticsStorageKeys[0]),null);
  assert.equal(readCookieChoice(storage).analytics,false);
  // Storage that throws never breaks the page.
  assert.equal(writeCookieChoice({getItem(){throw 1},setItem(){throw 1},removeItem(){throw 1}},makeCookieChoice({analytics:true,partners:true})),false);
});

test('device and account: the newer choice wins, each only at the current version',()=>{
  const device=makeCookieChoice({analytics:true,partners:true},100);
  const account={version:cookieConsentVersion,analytics:false,partners:false,at:200};
  assert.deepEqual(effectiveCookieChoice(device,account),account);
  assert.deepEqual(effectiveCookieChoice({...device,at:300},account),{...device,at:300});
  assert.deepEqual(effectiveCookieChoice(null,account),account);
  assert.deepEqual(effectiveCookieChoice(device,undefined),device);
  assert.deepEqual(effectiveCookieChoice(device,{...account,version:'2020-01-01',at:999}),device);
  assert.equal(effectiveCookieChoice(null,undefined),null);
});

test('Impact cookies are found for deletion; others are left alone',()=>{
  assert.deepEqual(partnerCookieNames('atlas-language=ru; IR_gbd=atlasmarket.uz; IR_20017=1; irclickid=abc; _ga=1'),['IR_gbd','IR_20017','irclickid']);
  assert.deepEqual(partnerCookieNames(''),[]);
});

test('account records the choice: action validated at the current version, withdrawal keeps the time of change',()=>{
  assert.ok(actionSchema.safeParse({type:'cookie-consent',version:cookieConsentVersion,analytics:true,partners:false}).success);
  assert.equal(actionSchema.safeParse({type:'cookie-consent',version:'2020-01-01',analytics:true,partners:false}).success,false);
  assert.equal(actionSchema.safeParse({type:'cookie-consent',version:cookieConsentVersion,analytics:'yes',partners:false}).success,false);
  let s=applyAction(blank(),{type:'cookie-consent',version:cookieConsentVersion,analytics:true,partners:true},false);
  assert.equal(s.cookieConsent.analytics,true);assert.equal(s.cookieConsent.partners,true);
  const same=applyAction(s,{type:'cookie-consent',version:cookieConsentVersion,analytics:true,partners:true},false);
  assert.equal(same.cookieConsent.at,s.cookieConsent.at);
  s=applyAction(s,{type:'cookie-consent',version:cookieConsentVersion,analytics:false,partners:false},false);
  assert.equal(s.cookieConsent.partners,false);
  assert.equal(parseState(JSON.stringify(s)).cookieConsent.analytics,false);
  // Older account JSON without the field still parses.
  assert.equal(parseState(JSON.stringify(blank())).cookieConsent,undefined);
});

test('the optional parts wait for consent in the page code',()=>{
  const impact=readFileSync(new URL('../app/impact-tracking.tsx',import.meta.url),'utf8');
  assert.match(impact,/cookieAllowed\(choice,'partners'\)/);
  assert.doesNotMatch(impact,/atlas-consent-v1/);
  const probe=readFileSync(new URL('../app/performance-probe.tsx',import.meta.url),'utf8');
  assert.match(probe,/withVitals && !vitalsSent && allowed\.current/);
  assert.match(probe,/if \(!allowed\.current\) return;/);
  const parts=readFileSync(new URL('../app/shell-extras-parts.tsx',import.meta.url),'utf8');
  assert.match(parts,/cookieAllowed\(choice,'analytics'\)/);
});
