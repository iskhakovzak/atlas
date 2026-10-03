import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
import {normalizeEmail,normalizeUzPhone,randomCode,randomToken,hashCode,constantTimeEqual,identityFor,verifyTelegramAuth,pkceChallenge,decodeJwtPayload,googleIdentity,readCookie,cookie,SESSION_COOKIE} from '../lib/auth/core.ts';
import {safeReturnTo,loginPath} from '../lib/auth/return-to.ts';

test('emails are normalized and malformed addresses rejected',()=>{
 assert.equal(normalizeEmail('  Seedy@Example.UZ '),'seedy@example.uz');
 for(const value of ['','plain','a@b','a@@b.uz','a b@c.uz','<a@b.uz>',`${'x'.repeat(250)}@b.uz`,42,null])assert.equal(normalizeEmail(value),null);
});

test('phone sign-in accepts only Uzbekistan numbers in E.164 form',()=>{
 for(const value of ['+998 90 123 45 67','998901234567','90 123-45-67','(90) 1234567'])assert.equal(normalizeUzPhone(value),'+998901234567');
 for(const value of ['+7 912 345 67 89','+1 202 555 0100','12345','+998 90 123 45 6x','',undefined])assert.equal(normalizeUzPhone(value),null);
});

test('codes and tokens are well formed and code hashes are bound to their challenge',async()=>{
 for(let index=0;index<200;index++)assert.match(randomCode(),/^\d{6}$/);
 assert.match(randomToken(32),/^[A-Za-z0-9_-]{43}$/);
 assert.match(randomToken(18),/^[A-Za-z0-9_-]{24}$/);
 assert.notEqual(randomToken(),randomToken());
 const hash=await hashCode('challenge-a','123456','pepper');
 assert.equal(hash,await hashCode('challenge-a','123456','pepper'));
 assert.notEqual(hash,await hashCode('challenge-b','123456','pepper'));
 assert.notEqual(hash,await hashCode('challenge-a','123457','pepper'));
 assert.notEqual(hash,await hashCode('challenge-a','123456','other'));
 assert(constantTimeEqual('abc','abc'));
 assert(!constantTimeEqual('abc','abd'));
 assert(!constantTimeEqual('abc','abcd'));
});

test('email and Google identities keep the legacy email-keyed account; phone and Telegram never carry an email',()=>{
 assert.deepEqual(identityFor('email','seedy@example.uz'),{userId:'email:seedy@example.uz',email:'seedy@example.uz',displayName:'seedy@example.uz',contact:'seedy@example.uz',method:'email'});
 assert.equal(identityFor('google','seedy@example.uz',{name:'Seedy'}).userId,'email:seedy@example.uz');
 const phone=identityFor('phone','+998901234567');
 assert.equal(phone.userId,'phone:+998901234567');assert.equal(phone.email,'');
 const telegram=identityFor('telegram','123456',{name:'Ali Valiev'});
 assert.equal(telegram.userId,'tg:123456');assert.equal(telegram.email,'');assert.equal(telegram.displayName,'Ali Valiev');
});

function signTelegram(fields,botToken){
 const check=Object.keys(fields).sort().map(key=>`${key}=${fields[key]}`).join('\n');
 const secret=createHash('sha256').update(botToken).digest();
 return {...fields,hash:createHmac('sha256',secret).update(check).digest('hex')};
}

test('Telegram login data is accepted only with a valid, fresh signature',async()=>{
 const bot='123456:test-token',now=1790000000;
 const signed=signTelegram({id:987654321,first_name:'Ali',last_name:'Valiev',username:'ali',auth_date:now-30},bot);
 assert.deepEqual(await verifyTelegramAuth(signed,bot,now),{id:'987654321',name:'Ali Valiev'});
 assert.equal(await verifyTelegramAuth({...signed,first_name:'Eve'},bot,now),null,'tampered field');
 assert.equal(await verifyTelegramAuth(signed,'999:other-token',now),null,'other bot');
 assert.equal(await verifyTelegramAuth(signed,bot,now+11*60),null,'stale auth_date');
 assert.equal(await verifyTelegramAuth({...signed,hash:'0'.repeat(64)},bot,now),null,'wrong hash');
 assert.equal(await verifyTelegramAuth({...signed,hash:undefined},bot,now),null,'missing hash');
 assert.equal(await verifyTelegramAuth(signed,'',now),null,'unconfigured bot');
 const usernameOnly=signTelegram({id:5,username:'ali',auth_date:now},bot);
 assert.deepEqual(await verifyTelegramAuth(usernameOnly,bot,now),{id:'5',name:'@ali'});
});

test('PKCE challenge matches RFC 7636 example',async()=>{
 assert.equal(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('Google ID token claims must match issuer, audience, nonce, expiry and a verified email',()=>{
 const now=1790000000,base={iss:'https://accounts.google.com',aud:'client-1',exp:now+300,nonce:'n-1',email:'Seedy@Gmail.com',email_verified:true,name:'Seedy'};
 const token=payload=>['e30',Buffer.from(JSON.stringify(payload)).toString('base64url'),'sig'].join('.');
 const expected={clientId:'client-1',nonce:'n-1',nowSeconds:now};
 assert.deepEqual(googleIdentity(decodeJwtPayload(token(base)),expected),{email:'seedy@gmail.com',name:'Seedy'});
 for(const change of [{iss:'https://evil.test'},{aud:'other-client'},{exp:now-1},{nonce:'other'},{email_verified:false},{email_verified:'true'},{email:'not-an-email'}])
  assert.equal(googleIdentity(decodeJwtPayload(token({...base,...change})),expected),null,JSON.stringify(change));
 assert.equal(googleIdentity(decodeJwtPayload('garbage'),expected),null);
});

test('return destinations stay on this site and never loop back into sign-in',()=>{
 assert.equal(safeReturnTo('/cart?x=1#top'),'/cart?x=1#top');
 for(const value of [null,'','cart','https://evil.test','//evil.test','/\\evil.test','/login','/api/auth/otp','/signin-with-chatgpt','/callback'])assert.equal(safeReturnTo(value),'/');
 assert.equal(loginPath('/orders'),'/login?return_to=%2Forders');
});

test('session cookie is host-only, HttpOnly, Secure and SameSite=Lax',()=>{
 const value=cookie(SESSION_COOKIE,'token',60);
 assert(value.startsWith('__Host-atlas_session=token;'));
 for(const part of ['Path=/','Max-Age=60','HttpOnly','Secure','SameSite=Lax'])assert(value.includes(part),part);
 assert(!/Domain=/i.test(value));
 assert.equal(readCookie('a=1; __Host-atlas_session=abc; b=2',SESSION_COOKIE),'abc');
 assert.equal(readCookie('x__Host-atlas_session=abc',SESSION_COOKIE),null);
 assert.equal(readCookie(null,SESSION_COOKIE),null);
});
