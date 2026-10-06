import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAppLink,isExternalHref,APP_LINK_PATHS} from '../lib/native/links.ts';
import {appleSiteAssociation,androidAssetLinks,certFingerprints} from '../lib/native/well-known.ts';
import {nativePlatform,isNative,onAppUrlOpen,onBackButton,appInfo,shareLink,openExternal,closeExternal,haptic,setStatusBarTheme,hideSplash,appleSignInNative} from '../lib/native/bridge.ts';
import {createPkceVerifier,pkceChallengeFor,rememberVerifier,takeVerifier,beginHandoff,HANDOFF_VERIFIER_KEY} from '../lib/native/pkce.ts';
import {pkceChallenge,verifyHandoffProof,isPkceValue} from '../lib/auth/core.ts';

test('handoff PKCE: the verifier is 43 base64url characters, its challenge matches the server and a stranger\'s does not',async()=>{
 const verifier=createPkceVerifier();
 assert.match(verifier,/^[A-Za-z0-9_-]{43}$/);
 assert.notEqual(createPkceVerifier(),verifier);
 const challenge=await pkceChallengeFor(verifier);
 assert.match(challenge,/^[A-Za-z0-9_-]{43}$/);
 assert.equal(challenge,await pkceChallenge(verifier));
 assert.equal(await pkceChallengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
 assert(await verifyHandoffProof({link:false,pkce:challenge},verifier));
 assert(!(await verifyHandoffProof({link:false,pkce:challenge},createPkceVerifier())));
 assert(!(await verifyHandoffProof({link:false,pkce:null},verifier)));
});

test('handoff PKCE: the verifier is kept once and taken once (memory without sessionStorage)',async()=>{
 assert.equal(typeof sessionStorage,'undefined');
 assert.equal(takeVerifier(),null);
 rememberVerifier('a'.repeat(43));
 assert.equal(takeVerifier(),'a'.repeat(43));
 assert.equal(takeVerifier(),null);
 const challenge=await beginHandoff();
 assert(isPkceValue(challenge));
 const verifier=takeVerifier();
 assert(isPkceValue(verifier));
 assert.equal(await pkceChallenge(verifier),challenge);
 assert.equal(takeVerifier(),null);
 assert.equal(HANDOFF_VERIFIER_KEY,'atlas.handoff.verifier');
});

const code='AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-';

test('parseAppLink: custom scheme with and without return_to',()=>{
 assert.deepEqual(parseAppLink(`uz.atlasmarket.app://auth?code=${code}&return_to=%2Forders%3Ftab%3Dactive`),{kind:'auth',code,returnTo:'/orders?tab=active'});
 assert.deepEqual(parseAppLink(`uz.atlasmarket.app://auth?code=${code}`),{kind:'auth',code,returnTo:null});
 assert.deepEqual(parseAppLink(`uz.atlasmarket.app:///auth?code=${code}`),{kind:'auth',code,returnTo:null});
 assert.equal(parseAppLink(`uz.atlasmarket.app://other?code=${code}`),null);
});

test('parseAppLink: unsafe return_to collapses to the home page',()=>{
 assert.deepEqual(parseAppLink(`uz.atlasmarket.app://auth?code=${code}&return_to=https%3A%2F%2Fevil.example%2F`),{kind:'auth',code,returnTo:'/'});
 assert.deepEqual(parseAppLink(`uz.atlasmarket.app://auth?code=${code}&return_to=%2F%2Fevil.example`),{kind:'auth',code,returnTo:'/'});
 assert.deepEqual(parseAppLink(`uz.atlasmarket.app://auth?code=${code}&return_to=%2Flogin`),{kind:'auth',code,returnTo:'/'});
});

test('parseAppLink: https auth/return universal link',()=>{
 assert.deepEqual(parseAppLink(`https://atlasmarket.uz/auth/return?code=${code}&return_to=%2Fcart`),{kind:'auth',code,returnTo:'/cart'});
 assert.deepEqual(parseAppLink(`https://www.atlasmarket.uz/auth/return?code=${code}`),{kind:'auth',code,returnTo:null});
 assert.equal(parseAppLink('https://atlasmarket.uz/auth/return'),null);
});

test('parseAppLink: https path keeps search and hash',()=>{
 assert.deepEqual(parseAppLink('https://atlasmarket.uz/order-by-link?url=https%3A%2F%2Fzara.com%2Fx#top'),{kind:'path',path:'/order-by-link?url=https%3A%2F%2Fzara.com%2Fx#top'});
 assert.deepEqual(parseAppLink('https://atlasmarket.uz/'),{kind:'path',path:'/'});
 assert.deepEqual(parseAppLink('https://atlasmarket.uz/catalog'),{kind:'path',path:'/catalog'});
 assert.equal(parseAppLink('https://atlasmarket.uz/api/account'),null);
 assert.equal(parseAppLink('https://atlasmarket.uz/_next/static/x.js'),null);
});

test('parseAppLink: other hosts, schemes and garbage are null',()=>{
 assert.equal(parseAppLink('https://evil.example/auth/return?code='+code),null);
 assert.equal(parseAppLink('http://atlasmarket.uz/catalog'),null);
 assert.equal(parseAppLink('javascript:alert(1)'),null);
 assert.equal(parseAppLink('uz.atlasmarket.app://auth?code=javascript:alert(1)'),null);
 assert.equal(parseAppLink('not a url'),null);
 assert.equal(parseAppLink(''),null);
 assert.equal(parseAppLink('x'.repeat(5000)),null);
 assert.equal(parseAppLink(123),null);
});

test('parseAppLink: code shape',()=>{
 assert.equal(parseAppLink('uz.atlasmarket.app://auth?code=short'),null);
 assert.equal(parseAppLink('uz.atlasmarket.app://auth?code='+'a'.repeat(300)),null);
 assert.equal(parseAppLink('uz.atlasmarket.app://auth?code='+'a'.repeat(20)+'%20x'),null);
 assert.equal(parseAppLink('uz.atlasmarket.app://auth?code='+'a'.repeat(16))?.kind,'auth');
 assert.equal(parseAppLink('uz.atlasmarket.app://auth?code='+'a'.repeat(256))?.kind,'auth');
});

test('isExternalHref',()=>{
 assert.equal(isExternalHref('https://www.zara.com/us/en/x','atlasmarket.uz'),true);
 assert.equal(isExternalHref('https://t.me/atlas','atlasmarket.uz'),true);
 assert.equal(isExternalHref('https://atlasmarket.uz/catalog','atlasmarket.uz'),false);
 assert.equal(isExternalHref('https://ATLASMARKET.uz/catalog','atlasmarket.uz'),false);
 assert.equal(isExternalHref('mailto:x@example.com','atlasmarket.uz'),false);
 assert.equal(isExternalHref('/catalog','atlasmarket.uz'),false);
});

test('appleSiteAssociation shape',()=>{
 assert.deepEqual(appleSiteAssociation(' TEAM1234 ','uz.atlasmarket.app'),{
  applinks:{apps:[],details:[{appID:'TEAM1234.uz.atlasmarket.app',paths:['/auth/return*','/order-by-link*','/catalog*','/orders*','/app']}]},
  webcredentials:{apps:['TEAM1234.uz.atlasmarket.app']},
 });
 assert.deepEqual([...APP_LINK_PATHS],['/auth/return','/order-by-link','/catalog','/orders','/app']);
});

test('androidAssetLinks shape and fingerprint normalisation',()=>{
 const fp='ab:cd:ef:01:23:45:67:89:ab:cd:ef:01:23:45:67:89:ab:cd:ef:01:23:45:67:89:ab:cd:ef:01:23:45:67:89';
 const upper=fp.toUpperCase();
 assert.deepEqual(androidAssetLinks('uz.atlasmarket.app',fp+', '+upper+',bad'),[{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'uz.atlasmarket.app',sha256_cert_fingerprints:[upper]}}]);
 assert.deepEqual(certFingerprints(upper.replaceAll(':','')),[upper]);
 assert.deepEqual(certFingerprints('nonsense'),[]);
 assert.deepEqual(certFingerprints([upper,'']),[upper]);
});

test('bridge is inert without a window',async()=>{
 assert.equal(typeof window,'undefined');
 assert.equal(nativePlatform(),null);
 assert.equal(isNative(),false);
 const off=onAppUrlOpen(()=>{});assert.equal(typeof off,'function');off();
 const offBack=onBackButton(()=>true);assert.equal(typeof offBack,'function');offBack();
 assert.equal(await appInfo(),null);
 assert.equal(await shareLink({title:'Atlas',url:'https://atlasmarket.uz/'}),false);
 assert.equal(await appleSignInNative({nonce:'n'}),null);
 await closeExternal();await haptic();await setStatusBarTheme('dark');await hideSplash();
 assert.equal(typeof openExternal,'function');
});
