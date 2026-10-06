import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign,createVerify} from 'node:crypto';
import {verifyAppleIdToken,appleClientSecret,appleAuthorizeUrl,appleUserName,pemToPkcs8,AppleTokenError,APPLE_ISSUER} from '../lib/auth/apple.ts';
import {
 parseReviewAccounts,serializeAuthUser,parseAuthUser,sealToken,openToken,encodeChallengeMeta,decodeChallengeMeta,appAuthLink,cookie,APPLE_STATE_COOKIE,identityFor,randomToken,
 encodeHandoffSecret,decodeHandoffSecret,verifyHandoffProof,isPkceValue,pkceChallenge,
} from '../lib/auth/core.ts';
import {safeReturnTo} from '../lib/auth/return-to.ts';

const b64=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
const rsa=generateKeyPairSync('rsa',{modulusLength:2048});
const otherRsa=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...rsa.publicKey.export({format:'jwk'}),kid:'apple-key-1',use:'sig',alg:'RS256'};
const jwks={keys:[jwk]};
const now=1_800_000_000;

function sign(payload,{kid='apple-key-1',key=rsa.privateKey,alg='RS256'}={}){
 const head=b64({alg,kid}),body=b64(payload);
 const signer=createSign('RSA-SHA256');signer.update(head+'.'+body);
 return head+'.'+body+'.'+signer.sign(key).toString('base64url');
}
const claims=(extra={})=>({iss:APPLE_ISSUER,aud:'uz.atlasmarket.web',exp:now+600,iat:now,sub:'001234.abcdef',nonce:'nonce-1',email:'Relay@PrivateRelay.AppleID.com',email_verified:'true',is_private_email:'true',...extra});
const options={audiences:['uz.atlasmarket.web'],nonce:'nonce-1',nowSeconds:now,jwks};
async function reason(token,opts=options){
 try{await verifyAppleIdToken(token,opts);return 'ok'}
 catch(error){assert(error instanceof AppleTokenError);return error.reason}
}

test('a valid Apple ID token yields the subject and the normalized, verified email',async()=>{
 const identity=await verifyAppleIdToken(sign(claims()),options);
 assert.deepEqual(identity,{sub:'001234.abcdef',email:'relay@privaterelay.appleid.com',isPrivateEmail:true});
 // Apple sends email_verified as a boolean in some tokens.
 assert.equal((await verifyAppleIdToken(sign(claims({email_verified:true,is_private_email:false})),options)).isPrivateEmail,false);
 // An audience list and no nonce check are both fine.
 assert.equal((await verifyAppleIdToken(sign(claims({aud:['x','uz.atlasmarket.web']})),{...options,nonce:undefined})).sub,'001234.abcdef');
});

test('Apple ID tokens with the wrong audience, expiry, nonce, issuer or email are rejected',async()=>{
 assert.equal(await reason(sign(claims({aud:'uz.atlasmarket.app'}))),'audience');
 assert.equal(await reason(sign(claims({exp:now-1}))),'expired');
 assert.equal(await reason(sign(claims({nonce:'nonce-2'}))),'nonce');
 assert.equal(await reason(sign(claims({iss:'https://accounts.google.com'}))),'issuer');
 assert.equal(await reason(sign(claims({email_verified:'false'}))),'email');
 assert.equal(await reason(sign(claims({email:'not an email'}))),'email');
 assert.equal(await reason(sign(claims({sub:''}))),'subject');
});

test('Apple ID tokens must carry a valid RS256 signature from a known key',async()=>{
 const token=sign(claims());
 const [head,,signature]=token.split('.');
 assert.equal(await reason(head+'.'+b64(claims({email:'attacker@example.com'}))+'.'+signature),'signature');
 assert.equal(await reason(sign(claims(),{key:otherRsa.privateKey})),'signature');
 assert.equal(await reason(sign(claims(),{kid:'apple-key-2'})),'unknown_kid');
 assert.equal(await reason(sign(claims(),{alg:'HS256'})),'alg');
 assert.equal(await reason('not.a.jwt.at.all'),'malformed');
 assert.equal(await reason(''),'malformed');
});

test('the client secret is an ES256 JWT Apple accepts, signed with the .p8 key (also with literal \\n in the env value)',async()=>{
 const ec=generateKeyPairSync('ec',{namedCurve:'P-256'});
 const pem=ec.privateKey.export({type:'pkcs8',format:'pem'});
 const secret=await appleClientSecret({teamId:'TEAM123456',keyId:'KEY1234567',privateKeyPem:pem.replace(/\n/g,'\\n'),clientId:'uz.atlasmarket.web',nowSeconds:now});
 const [head,body,signature]=secret.split('.');
 assert.deepEqual(JSON.parse(Buffer.from(head,'base64url')),{alg:'ES256',kid:'KEY1234567',typ:'JWT'});
 assert.deepEqual(JSON.parse(Buffer.from(body,'base64url')),{iss:'TEAM123456',iat:now,exp:now+300,aud:APPLE_ISSUER,sub:'uz.atlasmarket.web'});
 const verifier=createVerify('SHA256');verifier.update(head+'.'+body);
 assert.equal(Buffer.from(signature,'base64url').length,64); // raw r||s, not DER
 assert(verifier.verify({key:ec.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')));
 assert.equal(pemToPkcs8(pem).length,pemToPkcs8(pem.replace(/\n/g,'\\n')).length);
});

test('the authorize URL asks Apple for a form_post with code and ID token, name and email',()=>{
 const url=new URL(appleAuthorizeUrl({clientId:'uz.atlasmarket.web',redirectUri:'https://atlasmarket.uz/api/auth/apple/callback',state:'st',nonce:'nn'}));
 assert.equal(url.origin+url.pathname,'https://appleid.apple.com/auth/authorize');
 assert.deepEqual(Object.fromEntries(url.searchParams),{client_id:'uz.atlasmarket.web',redirect_uri:'https://atlasmarket.uz/api/auth/apple/callback',response_type:'code id_token',response_mode:'form_post',scope:'name email',state:'st',nonce:'nn'});
});

test('the first-authorization user field gives a display name; anything else gives none',()=>{
 assert.equal(appleUserName('{"name":{"firstName":" Zafar ","lastName":"I."},"email":"x@y.uz"}'),'Zafar I.');
 assert.equal(appleUserName({name:{firstName:'Zafar'}}),'Zafar');
 for(const value of ['','{bad json',null,undefined,{name:{}},'[]'])assert.equal(appleUserName(value),'');
 assert.equal(identityFor('apple','relay@privaterelay.appleid.com',{name:'Zafar I.'}).userId,'email:relay@privaterelay.appleid.com');
});

test('reviewer accounts come only from exact email=six-digit-code pairs',()=>{
 const accounts=parseReviewAccounts(' Reviewer@Example.com=123456 ,bad=12345,nocode,=111111,second@example.com=000000,third@example.com=12345a');
 assert.deepEqual([...accounts],[['reviewer@example.com','123456'],['second@example.com','000000']]);
 assert.equal(parseReviewAccounts(undefined).size,0);
 assert.equal(parseReviewAccounts('').size,0);
});

test('a signed-in user survives the trip through a handoff row',()=>{
 const user={userId:'email:a@b.uz',email:'a@b.uz',displayName:'A',contact:'a@b.uz',method:'apple'};
 assert.deepEqual(parseAuthUser(serializeAuthUser(user)),user);
 assert.deepEqual(parseAuthUser(serializeAuthUser({...user,email:''})),{...user,email:''});
 for(const value of ['','{}','null','{"userId":"x"}','{"userId":"x","displayName":"d","contact":"c","method":"facebook"}',42])assert.equal(parseAuthUser(value),null);
});

test('refresh tokens are sealed with AES-GCM under the auth secret and open only with it',async()=>{
 const sealed=await sealToken('r0.refresh-token-value','secret-one');
 assert.match(sealed,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
 assert.notEqual(sealed,await sealToken('r0.refresh-token-value','secret-one')); // fresh IV each time
 assert.equal(await openToken(sealed,'secret-one'),'r0.refresh-token-value');
 assert.equal(await openToken(sealed,'secret-two'),null);
 assert.equal(await openToken('garbage','secret-one'),null);
 assert.equal(await openToken(sealed.slice(0,-2)+'AA','secret-one'),null);
});

test('challenge metadata keeps plain return paths for older rows and JSON for native and ticketed links',()=>{
 assert.equal(encodeChallengeMeta({returnTo:'/account'}),'/account');
 assert.deepEqual(decodeChallengeMeta('/account',safeReturnTo),{returnTo:'/account',native:false,linkUserId:null,pkce:null});
 assert.deepEqual(decodeChallengeMeta(null,safeReturnTo),{returnTo:'/',native:false,linkUserId:null,pkce:null});
 const encoded=encodeChallengeMeta({returnTo:'/orders',native:true,linkUserId:'phone:+998901234567'});
 assert(encoded.startsWith('{'));
 assert.deepEqual(decodeChallengeMeta(encoded,safeReturnTo),{returnTo:'/orders',native:true,linkUserId:'phone:+998901234567',pkce:null});
 assert.deepEqual(decodeChallengeMeta('{"returnTo":"https://evil.example/","native":true}',safeReturnTo),{returnTo:'/',native:true,linkUserId:null,pkce:null});
 assert.deepEqual(decodeChallengeMeta('{broken',safeReturnTo),{returnTo:'/',native:false,linkUserId:null,pkce:null});
 // The app instance's PKCE challenge rides along; anything that is not 43 base64url characters is dropped.
 const challenge='E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
 assert.deepEqual(decodeChallengeMeta(encodeChallengeMeta({returnTo:'/cart',native:true,pkce:challenge}),safeReturnTo),{returnTo:'/cart',native:true,linkUserId:null,pkce:challenge});
 assert.equal(decodeChallengeMeta(JSON.stringify({returnTo:'/cart',native:true,pkce:'short'}),safeReturnTo).pkce,null);
 assert.equal(decodeChallengeMeta(JSON.stringify({returnTo:'/cart',native:true,pkce:challenge+'='}),safeReturnTo).pkce,null);
});

test('handoff rows carry the link flag and the PKCE challenge; a claim needs the matching verifier',async()=>{
 const verifier='dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',challenge=await pkceChallenge(verifier);
 assert(isPkceValue(verifier));assert(isPkceValue(challenge));
 assert(!isPkceValue(verifier.slice(1)));assert(!isPkceValue(verifier+'a'));assert(!isPkceValue(verifier.replace('-','+')));assert(!isPkceValue(42));
 const secret=decodeHandoffSecret(encodeHandoffSecret({link:true,pkce:challenge}));
 assert.deepEqual(secret,{link:true,pkce:challenge});
 assert.deepEqual(decodeHandoffSecret(encodeHandoffSecret({link:false,pkce:challenge})),{link:false,pkce:challenge});
 assert(await verifyHandoffProof(secret,verifier));
 assert(!(await verifyHandoffProof(secret,'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXl')));
 assert(!(await verifyHandoffProof(secret,challenge)));
 assert(!(await verifyHandoffProof(secret,'')));
 assert(!(await verifyHandoffProof(secret,undefined)));
 // Rows written before PKCE ('' or 'link') and rows with a malformed challenge can never be claimed.
 assert.deepEqual(decodeHandoffSecret(''),{link:false,pkce:null});
 assert.deepEqual(decodeHandoffSecret('link'),{link:true,pkce:null});
 assert.deepEqual(decodeHandoffSecret('{"link":true,"pkce":"nope"}'),{link:true,pkce:null});
 assert.deepEqual(decodeHandoffSecret('{broken'),{link:false,pkce:null});
 assert(!(await verifyHandoffProof(decodeHandoffSecret('link'),verifier)));
 assert(!(await verifyHandoffProof(decodeHandoffSecret(''),verifier)));
});

test('the app link and the Apple state cookie are shaped for the handoff',()=>{
 const code=randomToken(18);
 assert.equal(appAuthLink(code,'/orders?x=1'),`uz.atlasmarket.app://auth?code=${code}&return_to=${encodeURIComponent('/orders?x=1')}`);
 assert.equal(cookie(APPLE_STATE_COOKIE,'st',600,'None'),'__Host-atlas_apple=st; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=None');
});
