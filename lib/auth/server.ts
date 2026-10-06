import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {
 APPLE_STATE_COOKIE,CODE_TTL_MS,HANDOFF_TTL_MS,LINK_TICKET_TTL_MS,MAX_CODE_ATTEMPTS,OAUTH_STATE_COOKIE,OAUTH_TTL_MS,SESSION_COOKIE,SESSION_RENEW_MS,SESSION_TTL_MS,
 constantTimeEqual,cookie,decodeChallengeMeta,decodeHandoffSecret,decodeJwtPayload,encodeChallengeMeta,encodeHandoffSecret,googleIdentity,hashCode,identityFor,isPkceValue,normalizeEmail,normalizeUzPhone,
 emptyAccountState,openToken,ownMethod,parseAuthUser,parseReviewAccounts,pkceChallenge,randomCode,randomToken,readCookie,sealToken,serializeAuthUser,sha256Hex,verifyHandoffProof,verifyTelegramAuth,
 type AuthMethod,type AuthUser,type ChallengeMeta,type TelegramFields,
} from './core';
import {appleAuthorizeUrl,appleClientSecret,appleUserName,exchangeAppleCode,revokeAppleToken,verifyAppleIdTokenLive} from './apple';
import {loginPath,safeReturnTo} from './return-to';
import {TG_ANIMATION_SETTING,TG_BOT_SETTING,TG_CHALLENGE_KINDS,TG_WELCOME_ANIMATION,TG_LOGIN_COOKIE,TG_LOGIN_TTL_MS,botLinks,botText,parseBotUpdate,validStartToken,type TgChallengeKind} from './telegram-bot';

export class AuthError extends Error{constructor(public status:number,public code:string){super(code)}}
export type OtpChannel='email'|'phone';

function db(){if(!env.DB)throw new AuthError(503,'unavailable');return env.DB}
const pepper=()=>env.ATLAS_AUTH_SECRET??'';
const configured={
 email:()=>!!(env.RESEND_API_KEY&&env.ATLAS_AUTH_EMAIL_FROM),
 phone:()=>!!(env.ESKIZ_EMAIL&&env.ESKIZ_PASSWORD),
 telegram:()=>!!(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_BOT_USERNAME),
 google:()=>!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET),
 // The web flow needs the Services ID and the team key (client secret). The native sheet needs the bundle ID
 // and the same key material plus the sealing secret: Apple requires the refresh token to be revoked when the
 // account is deleted, so the sheet is only offered when Atlas can obtain, keep and revoke that token.
 apple:()=>!!(env.APPLE_SERVICES_ID&&appleKey()),
 appleNative:()=>!!(env.APPLE_APP_BUNDLE_ID&&appleKey()&&env.ATLAS_AUTH_SECRET),
};
function appleKey(){
 return env.APPLE_TEAM_ID&&env.APPLE_KEY_ID&&env.APPLE_PRIVATE_KEY?{teamId:env.APPLE_TEAM_ID,keyId:env.APPLE_KEY_ID,privateKeyPem:env.APPLE_PRIVATE_KEY}:null;
}

// Codes are shown on screen only for loopback development requests, never on a public host.
function devCodes(request:Request){
 const dev=(import.meta as {env?:{DEV?:boolean}}).env?.DEV===true||env.ATLAS_AUTH_DEV_CODES==='true';
 const host=new URL(request.url).hostname.replace(/^\[|\]$/g,'');
 return dev&&['localhost','127.0.0.1','::1'].includes(host);
}

export async function authMethods(request:Request){
 const dev=devCodes(request);
 return {
  email:configured.email()||dev,phone:configured.phone()||dev,
  telegram:configured.telegram()?env.TELEGRAM_BOT_USERNAME!:null,
  // The bot sign-in replaces the widget once the operator has connected the bot's webhook.
  telegramBot:configured.telegram()&&await telegramBotReady(request),
  google:configured.google(),
  apple:configured.apple(),appleNative:configured.appleNative(),devCodes:dev,
 };
}

async function limit(name:string,max:number,windowMs:number){
 const now=Date.now(),key=`auth:${name}:${Math.floor(now/windowMs)}`;
 const row=await db().prepare('INSERT INTO market_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+windowMs).first<{count:number}>();
 if(!row||row.count>max)throw new AuthError(429,'too_many_requests');
}
async function clientKey(request:Request){return (await sha256Hex('ip:'+(request.headers.get('cf-connecting-ip')?.trim().slice(0,80)||'unknown'))).slice(0,32)}

async function cleanup(){
 const now=Date.now();
 await db().batch([
  db().prepare('DELETE FROM market_auth_challenges WHERE expires_at < ?').bind(now),
  db().prepare('DELETE FROM market_auth_sessions WHERE expires_at < ?').bind(now),
  db().prepare('DELETE FROM market_rate_limits WHERE expires_at < ?').bind(now),
 ]);
}

// A method attached to another account (market_auth_links) opens that account. Before migration 0008
// the table may be missing: then everyone signs in to their own method's account, as before.
async function resolveAccount(user:AuthUser):Promise<AuthUser>{
 try{
  const row=await db().prepare('SELECT user_id FROM market_auth_links WHERE subject=?').bind(user.userId).first<{user_id:string}>();
  return row?{...user,userId:row.user_id}:user;
 }catch{return user}
}

export async function createSession(signedIn:AuthUser){
 const user=await resolveAccount(signedIn),token=randomToken(32),now=Date.now();
 await db().prepare('INSERT INTO market_auth_sessions (id,user_id,method,email,display_name,contact,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)')
  .bind(await sha256Hex(token),user.userId,user.method,user.email||null,user.displayName,user.contact,now,now+SESSION_TTL_MS).run();
 return cookie(SESSION_COOKIE,token,SESSION_TTL_MS/1000);
}

// ---------- Several sign-in methods, one account ----------
// The account's own method is its user ID ("email:…", "phone:…", "tg:…"); more methods are rows in market_auth_links.
export type LinkedMethod={subject:string;method:AuthMethod;contact:string;createdAt:number};
async function signedInUser(){const user=await currentUser();if(!user)throw new AuthError(401,'signed_out');return user}

function sessionToken(cookieHeader:string|null){
 const token=readCookie(cookieHeader,SESSION_COOKIE);
 return token&&/^[A-Za-z0-9_-]{43}$/.test(token)?token:null;
}

export async function currentUser():Promise<AuthUser|null>{
 const token=sessionToken((await headers()).get('cookie'));
 if(!token||!env.DB)return null;
 const row=await env.DB.prepare('SELECT user_id,method,email,display_name,contact FROM market_auth_sessions WHERE id=? AND expires_at>?')
  .bind(await sha256Hex(token),Date.now()).first<{user_id:string;method:AuthMethod;email:string|null;display_name:string;contact:string}>();
 return row?{userId:row.user_id,method:row.method,email:row.email??'',displayName:row.display_name,contact:row.contact}:null;
}

/**
 * Slides a session that is in use: once a day its end moves to 60 days from now and the cookie is set again.
 * Returns the Set-Cookie value, or null when nothing changed (no session, or renewed within the last day).
 */
export async function renewSession(request:Request){
 const token=sessionToken(request.headers.get('cookie'));
 if(!token||!env.DB)return null;
 const now=Date.now();
 const row=await env.DB.prepare('UPDATE market_auth_sessions SET expires_at=? WHERE id=? AND expires_at>? AND expires_at<? RETURNING id')
  .bind(now+SESSION_TTL_MS,await sha256Hex(token),now,now+SESSION_TTL_MS-SESSION_RENEW_MS).first();
 return row?cookie(SESSION_COOKIE,token,SESSION_TTL_MS/1000):null;
}

/** Attaches a verified method to the signed-in account. Refused when that method already has data of its own. */
async function attachMethod(current:AuthUser,added:AuthUser){
 const subject=added.userId;
 if(subject===current.userId)throw new AuthError(409,'link_same');
 const existing=await db().prepare('SELECT user_id FROM market_auth_links WHERE subject=?').bind(subject).first<{user_id:string}>();
 if(existing)throw new AuthError(409,existing.user_id===current.userId?'link_same':'link_taken');
 // The method's own account must hold nothing, and no other method may already lead to it: either would be orphaned.
 const own=await db().prepare('SELECT state FROM market_accounts WHERE user_id=?').bind(subject).first<{state:string}>();
 const dependents=await db().prepare('SELECT 1 AS found FROM market_auth_links WHERE user_id=? LIMIT 1').bind(subject).first();
 if((own&&!emptyAccountState(own.state))||dependents)throw new AuthError(409,'link_has_account');
 await db().batch([
  db().prepare('INSERT INTO market_auth_links (subject,user_id,method,contact,created_at) VALUES (?,?,?,?,?)').bind(subject,current.userId,added.method,added.contact,Date.now()),
  // Anyone signed in to the method's own empty account elsewhere now sees this account.
  db().prepare('UPDATE market_auth_sessions SET user_id=? WHERE user_id=?').bind(current.userId,subject),
 ]);
}

export async function linkedMethods(){
 const user=await signedInUser();
 let linked:LinkedMethod[]=[];
 try{
  const result=await db().prepare('SELECT subject,method,contact,created_at FROM market_auth_links WHERE user_id=? ORDER BY created_at').bind(user.userId).all<{subject:string;method:AuthMethod;contact:string;created_at:number}>();
  linked=result.results.map(row=>({subject:row.subject,method:row.method,contact:row.contact,createdAt:row.created_at}));
 }catch{/* migration 0008 not applied yet: only the account's own method */}
 return {own:ownMethod(user.userId),linked,current:user.method};
}

export async function detachMethod(subject:string){
 const user=await signedInUser();
 await db().prepare('DELETE FROM market_auth_links WHERE subject=? AND user_id=?').bind(subject,user.userId).run();
 return linkedMethods();
}

// ---------- Provider tokens (market_auth_tokens, migration 0010) ----------
// Apple hands out a refresh token at sign-in; Apple requires it to be revoked when the account is deleted.
// Tokens rest sealed with a key derived from ATLAS_AUTH_SECRET; without the secret or the table nothing is kept.
// The subject (one Apple ID) belongs to the user who just proved it: the previous row, whoever held it, goes.
async function storeProviderToken(subject:string,userId:string,provider:string,clientId:string,token:string){
 const secret=env.ATLAS_AUTH_SECRET;
 if(!secret)return;
 try{
  const sealed=await sealToken(token,secret);
  await db().batch([
   db().prepare('DELETE FROM market_auth_tokens WHERE subject=?').bind(subject),
   db().prepare('INSERT INTO market_auth_tokens (subject,user_id,provider,client_id,token,created_at) VALUES (?,?,?,?,?,?)').bind(subject,userId,provider,clientId,sealed,Date.now()),
  ]);
 }catch(error){console.warn('Provider token not stored',String(error).slice(0,200))}
}
/**
 * Best effort after an Apple sign-in: trade the authorization code for the refresh token and keep it for
 * revocation. Called only once the identity really signed in to, or was attached to, `userId`.
 */
async function keepAppleToken(sub:string,userId:string,clientId:string,code:string|null|undefined,redirectUri?:string){
 const key=appleKey();
 if(!code||!key)return;
 try{
  const refreshToken=await exchangeAppleCode({code,clientId,clientSecret:await appleClientSecret({...key,clientId}),redirectUri});
  if(refreshToken)await storeProviderToken('apple:'+sub,userId,'apple',clientId,refreshToken);
 }catch(error){console.warn('Apple token exchange failed',String(error).slice(0,200))}
}

/** A problem the operator must see (admin monitor, market_operational_errors). Never throws; details hold no token. */
async function recordAuthProblem(message:string,details:Record<string,unknown>){
 console.error(message,JSON.stringify(details).slice(0,300));
 try{
  await db().prepare('INSERT INTO market_operational_errors (id,area,message,details,created_at) VALUES (?,?,?,?,?)')
   .bind(crypto.randomUUID(),'auth',message,JSON.stringify(details).slice(0,1800),Date.now()).run();
 }catch(error){console.error('Auth problem not recorded',String(error).slice(0,200))}
}

/**
 * Account deletion: revokes tokens Atlas holds at sign-in providers (Sign in with Apple requires it) and
 * forgets them. Best effort: never throws, so a provider outage cannot keep an account from being deleted.
 * A row goes only after Apple confirmed the revocation (HTTP 200) or when no secret exists to ever open it;
 * anything else stays in the table and is reported to the operator, who can revoke by hand.
 */
export async function revokeProviderTokens(userId:string):Promise<void>{
 try{
  const secret=env.ATLAS_AUTH_SECRET,key=appleKey();
  const rows=await db().prepare('SELECT subject,provider,client_id,token FROM market_auth_tokens WHERE user_id=?').bind(userId).all<{subject:string;provider:string;client_id:string;token:string}>();
  for(const row of rows.results){
   const subject=row.subject.slice(0,80);
   const report=(reason:string,extra:Record<string,unknown>={})=>recordAuthProblem('Apple token revocation failed',{reason,subject,provider:row.provider,clientId:row.client_id,userId,...extra});
   let forget=false;
   try{
    if(!secret){
     // Sealed under a secret that is gone: nobody can ever read it, keeping the row serves no one.
     await report('no_secret_to_open');
     forget=true;
    }else{
     let token:string|null=null;
     try{token=await openToken(row.token,secret)}catch(error){await report('decrypt_failed',{error:String(error).slice(0,120)})}
     if(token&&row.provider==='apple'&&key){
      const revoked=await revokeAppleToken({token,clientId:row.client_id,clientSecret:await appleClientSecret({...key,clientId:row.client_id})});
      if(revoked)forget=true;else await report('apple_refused');
     }else if(token)await report(row.provider==='apple'?'apple_key_missing':'provider_unknown');
    }
   }catch(error){await report('exception',{error:String(error).slice(0,120)})}
   if(forget)await db().prepare('DELETE FROM market_auth_tokens WHERE subject=? AND user_id=?').bind(row.subject,userId).run();
  }
 }catch(error){console.error('Provider tokens not revoked',String(error).slice(0,200))}
}

export async function endSession(request:Request){
 const token=sessionToken(request.headers.get('cookie'));
 if(token)await db().prepare('DELETE FROM market_auth_sessions WHERE id=?').bind(await sha256Hex(token)).run();
 return cookie(SESSION_COOKIE,'',0);
}

export async function startOtp(channel:OtpChannel,rawTarget:unknown,request:Request){
 const target=channel==='email'?normalizeEmail(rawTarget):normalizeUzPhone(rawTarget);
 if(!target)throw new AuthError(400,channel==='email'?'invalid_email':'invalid_phone');
 const dev=devCodes(request);
 // App-store reviewers sign in with a fixed code from ATLAS_REVIEW_ACCOUNTS: nothing is sent and nothing is revealed.
 const reviewCode=channel==='email'?parseReviewAccounts(env.ATLAS_REVIEW_ACCOUNTS).get(target):undefined;
 if(!configured[channel]()&&!dev&&!reviewCode)throw new AuthError(503,'method_unavailable');
 const targetKey=(await sha256Hex(channel+':'+target)).slice(0,32);
 await limit(`send:${targetKey}:10m`,3,10*60*1000);
 await limit(`send:${targetKey}:day`,10,24*60*60*1000);
 await limit(`send-ip:${await clientKey(request)}`,20,60*60*1000);
 await cleanup();
 const id=randomToken(18),code=reviewCode??randomCode(),now=Date.now();
 await db().prepare('INSERT INTO market_auth_challenges (id,kind,target,secret,attempts,created_at,expires_at) VALUES (?,?,?,?,0,?,?)')
  .bind(id,channel,target,await hashCode(id,code,pepper()),now,now+CODE_TTL_MS).run();
 if(reviewCode)return {challengeId:id};
 if(configured[channel]()){
  try{await (channel==='email'?sendEmail(target,code):sendSms(target,code))}
  catch(error){
   console.error('Sign-in code delivery failed',error);
   await db().prepare('DELETE FROM market_auth_challenges WHERE id=?').bind(id).run();
   throw new AuthError(502,'delivery_failed');
  }
  return {challengeId:id};
 }
 console.info(`[atlas dev sign-in] ${channel} code for ${target}: ${code}`);
 return {challengeId:id,devCode:code};
}

export async function verifyOtp(channel:OtpChannel,challengeId:unknown,code:unknown,request:Request){
 return createSession(identityFor(channel,await consumeOtp(channel,challengeId,code,request)));
}
/** Checks the code while signed in and attaches that email or phone to the current account. */
export async function linkOtp(channel:OtpChannel,challengeId:unknown,code:unknown,request:Request){
 const current=await signedInUser();
 await attachMethod(current,identityFor(channel,await consumeOtp(channel,challengeId,code,request)));
}

async function consumeOtp(channel:OtpChannel,challengeId:unknown,code:unknown,request:Request){
 if(typeof challengeId!=='string'||!/^[A-Za-z0-9_-]{24}$/.test(challengeId))throw new AuthError(400,'code_expired');
 if(typeof code!=='string'||!/^\d{6}$/.test(code))throw new AuthError(400,'invalid_code');
 await limit(`verify-ip:${await clientKey(request)}`,60,60*60*1000);
 const row=await db().prepare('UPDATE market_auth_challenges SET attempts=attempts+1 WHERE id=? AND kind=? AND expires_at>? AND attempts<? RETURNING target,secret')
  .bind(challengeId,channel,Date.now(),MAX_CODE_ATTEMPTS).first<{target:string;secret:string}>();
 if(!row)throw new AuthError(400,'code_expired');
 if(!constantTimeEqual(await hashCode(challengeId,code,pepper()),row.secret))throw new AuthError(400,'invalid_code');
 // Deleting with RETURNING makes the code single-use even under concurrent submissions.
 const used=await db().prepare('DELETE FROM market_auth_challenges WHERE id=? RETURNING id').bind(challengeId).first();
 if(!used)throw new AuthError(400,'code_expired');
 return row.target;
}

async function telegramUser(fields:TelegramFields,request:Request){
 if(!configured.telegram())throw new AuthError(503,'method_unavailable');
 await limit(`telegram-ip:${await clientKey(request)}`,30,60*60*1000);
 const verified=await verifyTelegramAuth(fields,env.TELEGRAM_BOT_TOKEN!);
 if(!verified)throw new AuthError(400,'telegram_invalid');
 return identityFor('telegram',verified.id,{name:verified.name});
}
export async function signInWithTelegram(fields:TelegramFields,request:Request){return createSession(await telegramUser(fields,request))}
export async function linkTelegram(fields:TelegramFields,request:Request){const current=await signedInUser();await attachMethod(current,await telegramUser(fields,request))}

// ---------- OAuth in the browser (Google, Apple), also on behalf of the apps ----------
// The apps open these flows in the system browser (?native=1): Google refuses embedded web views and Apple
// prefers Safari. That browser holds no Atlas session, so a link started from the app carries a short
// ticket naming the account to join, and the result travels back through a single-use handoff code.

/** Who starts an OAuth flow and where it must end; read from the start request's query. */
async function oauthIntent(request:Request):Promise<ChallengeMeta&{link:boolean}>{
 const params=new URL(request.url).searchParams;
 const link=params.get('link')==='1',native=params.get('native')==='1';
 const returnTo=safeReturnTo(params.get('return_to'));
 // A flow for the app must carry the PKCE challenge of the instance that opened it (RFC 8252 §8.6).
 const pkce=params.get('pkce');
 if(native&&!isPkceValue(pkce))throw new AuthError(400,'bad_request');
 let linkUserId:string|null=null;
 if(link&&native)linkUserId=await consumeLinkTicket(params.get('ticket'));
 else if(link)linkUserId=(await signedInUser()).userId;
 return {returnTo,native,linkUserId,pkce:native?pkce:null,link};
}

/** The signed-in web view asks for a ticket before opening a link flow in the system browser. */
export async function issueLinkTicket(request:Request){
 const user=await signedInUser();
 await limit(`ticket-ip:${await clientKey(request)}`,30,60*60*1000);
 const id=randomToken(18),now=Date.now();
 await db().prepare('INSERT INTO market_auth_challenges (id,kind,target,secret,attempts,created_at,expires_at) VALUES (?,?,?,?,0,?,?)')
  .bind(id,'link-ticket',serializeAuthUser(user),'',now,now+LINK_TICKET_TTL_MS).run();
 return {ticket:id};
}
async function consumeLinkTicket(ticket:string|null){
 if(!ticket||!/^[A-Za-z0-9_-]{24}$/.test(ticket))throw new AuthError(401,'signed_out');
 const row=await db().prepare("DELETE FROM market_auth_challenges WHERE id=? AND kind='link-ticket' AND expires_at>? RETURNING target").bind(ticket,Date.now()).first<{target:string}>();
 const user=row?parseAuthUser(row.target):null;
 if(!user)throw new AuthError(401,'signed_out');
 return user.userId;
}

/**
 * Finishes a flow started for the app: a handoff code on /auth/return, which the app trades for the session.
 * The row keeps the app instance's PKCE challenge (RFC 8252 §8.6); a flow without one cannot be handed off.
 */
async function handoffToApp(user:AuthUser,returnTo:string,pkce:string|null,cookies:string[],link=false){
 if(!pkce)throw new AuthError(400,'bad_request');
 const id=randomToken(18),now=Date.now();
 await db().prepare('INSERT INTO market_auth_challenges (id,kind,target,secret,attempts,return_to,created_at,expires_at) VALUES (?,?,?,?,0,?,?,?)')
  .bind(id,'handoff',serializeAuthUser(user),encodeHandoffSecret({link,pkce}),returnTo,now,now+HANDOFF_TTL_MS).run();
 return redirect('/auth/return?code='+encodeURIComponent(id)+'&return_to='+encodeURIComponent(returnTo),cookies);
}
/**
 * The app's web view presents the handoff code with the PKCE verifier it kept: single use, two minutes,
 * and only the instance whose challenge the row holds gets the session (code_expired for a used or unknown
 * code, handoff_invalid when the proof does not match or the row carries no challenge).
 */
export async function claimHandoff(input:{code:unknown;verifier:unknown},request:Request):Promise<{body:{ok:true;returnTo:string;linked?:true};cookie?:string}>{
 const {code,verifier}=input;
 if(typeof code!=='string'||!/^[A-Za-z0-9_-]{24}$/.test(code))throw new AuthError(400,'code_expired');
 if(!isPkceValue(verifier))throw new AuthError(400,'handoff_invalid');
 await limit(`handoff-ip:${await clientKey(request)}`,60,60*60*1000);
 const row=await db().prepare("DELETE FROM market_auth_challenges WHERE id=? AND kind='handoff' AND expires_at>? RETURNING target,secret,return_to").bind(code,Date.now()).first<{target:string;secret:string;return_to:string|null}>();
 const user=row?parseAuthUser(row.target):null;
 if(!row||!user)throw new AuthError(400,'code_expired');
 const secret=decodeHandoffSecret(row.secret);
 if(!(await verifyHandoffProof(secret,verifier)))throw new AuthError(400,'handoff_invalid');
 const returnTo=safeReturnTo(row.return_to);
 if(secret.link)return {body:{ok:true,returnTo,linked:true}};
 return {body:{ok:true,returnTo},cookie:await createSession(user)};
}

/**
 * Shared ending of the Google and Apple web flows: attach, or sign in; in the browser, or back to the app.
 * `ownerId` names the account the identity now opens (signed in, or attached to); null when nothing changed
 * (a refused link), so callers never keep provider tokens for an account the identity does not belong to.
 */
async function finishOAuth(provider:'google'|'apple',verified:AuthUser,kind:string,meta:ChallengeMeta,clearState:string,fail:(returnTo:string)=>Response):Promise<{response:Response;ownerId:string|null}>{
 const {returnTo}=meta;
 if(kind.endsWith('-link')){
  const result=(code:string)=>returnTo+(returnTo.includes('?')?'&':'?')+code;
  // In the browser the account signed in there (same state cookie) gets the method; from the app, the ticketed one.
  const current=meta.linkUserId?{...verified,userId:meta.linkUserId}:await currentUser();
  if(!current)return {response:fail(returnTo),ownerId:null};
  let outcome:string,ownerId:string|null=null;
  try{await attachMethod(current,verified);outcome='linked='+provider;ownerId=current.userId}
  catch(error){if(error instanceof AuthError)outcome='link_error='+error.code;else throw error}
  const response=meta.native?await handoffToApp(current,result(outcome),meta.pkce,[clearState],true):redirect(result(outcome),[clearState]);
  return {response,ownerId};
 }
 const account=await resolveAccount(verified);
 if(meta.native)return {response:await handoffToApp(account,returnTo,meta.pkce,[clearState]),ownerId:account.userId};
 return {response:redirect(returnTo,[clearState,await createSession(verified)]),ownerId:account.userId};
}

const googleRedirect=(request:Request)=>new URL('/api/auth/google/callback',request.url).href;

export async function startGoogle(request:Request){
 if(!configured.google())throw new AuthError(503,'method_unavailable');
 await limit(`google-ip:${await clientKey(request)}`,30,60*60*1000);
 // ?link=1 attaches the Google address to the signed-in account instead of signing in.
 const intent=await oauthIntent(request);
 await cleanup();
 const state=randomToken(24),verifier=randomToken(48),nonce=randomToken(18),now=Date.now();
 await db().prepare('INSERT INTO market_auth_challenges (id,kind,target,secret,attempts,return_to,created_at,expires_at) VALUES (?,?,?,?,0,?,?,?)')
  .bind(state,intent.link?'google-link':'google',nonce,verifier,encodeChallengeMeta(intent),now,now+OAUTH_TTL_MS).run();
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,redirect_uri:googleRedirect(request),response_type:'code',scope:'openid email profile',state,nonce,code_challenge:await pkceChallenge(verifier),code_challenge_method:'S256',prompt:'select_account'}).toString();
 return redirect(url.href,[cookie(OAUTH_STATE_COOKIE,state,OAUTH_TTL_MS/1000)]);
}

export async function finishGoogle(request:Request){
 const params=new URL(request.url).searchParams,state=params.get('state')??'',code=params.get('code');
 const expected=readCookie(request.headers.get('cookie'),OAUTH_STATE_COOKIE)??'';
 const clearState=cookie(OAUTH_STATE_COOKIE,'',0);
 const fail=(returnTo='/')=>redirect(loginPath(returnTo)+'&error=google',[clearState]);
 // The state must match the cookie set for this browser, which blocks login CSRF.
 if(!configured.google()||!state||!constantTimeEqual(state,expected))return fail();
 const row=await db().prepare("DELETE FROM market_auth_challenges WHERE id=? AND kind IN ('google','google-link') AND expires_at>? RETURNING kind,target,secret,return_to")
  .bind(state,Date.now()).first<{kind:string;target:string;secret:string;return_to:string|null}>();
 if(!row)return fail();
 const meta=decodeChallengeMeta(row.return_to,safeReturnTo),returnTo=meta.returnTo;
 if(!code||params.get('error'))return fail(returnTo);
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(10000),
  body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,redirect_uri:googleRedirect(request),grant_type:'authorization_code',code_verifier:row.secret})});
 const token=response.ok?await response.json().catch(()=>null) as {id_token?:unknown}|null:null;
 const identity=typeof token?.id_token==='string'?googleIdentity(decodeJwtPayload(token.id_token),{clientId:env.GOOGLE_CLIENT_ID!,nonce:row.target}):null;
 if(!identity){console.error('Google sign-in rejected',response.status);return fail(returnTo)}
 return (await finishOAuth('google',identityFor('google',identity.email,{name:identity.name}),row.kind,meta,clearState,fail)).response;
}

const appleRedirect=(request:Request)=>new URL('/api/auth/apple/callback',request.url).href;

/** GET /api/auth/apple: the Services ID flow in a browser (also the one the apps open in the system browser). */
export async function startApple(request:Request){
 if(!configured.apple())throw new AuthError(503,'method_unavailable');
 await limit(`apple-ip:${await clientKey(request)}`,30,60*60*1000);
 const intent=await oauthIntent(request);
 await cleanup();
 const state=randomToken(24),nonce=randomToken(18),now=Date.now();
 await db().prepare('INSERT INTO market_auth_challenges (id,kind,target,secret,attempts,return_to,created_at,expires_at) VALUES (?,?,?,?,0,?,?,?)')
  .bind(state,intent.link?'apple-link':'apple',nonce,'',encodeChallengeMeta(intent),now,now+OAUTH_TTL_MS).run();
 // Apple posts the result cross-site, so only a SameSite=None cookie comes back with it.
 return redirect(appleAuthorizeUrl({clientId:env.APPLE_SERVICES_ID!,redirectUri:appleRedirect(request),state,nonce}),[cookie(APPLE_STATE_COOKIE,state,OAUTH_TTL_MS/1000,'None')]);
}

/** POST /api/auth/apple/callback (form_post from appleid.apple.com). */
export async function finishApple(request:Request){
 const form=await request.formData().catch(()=>null);
 const field=(name:string)=>{const value=form?.get(name);return typeof value==='string'?value:''};
 const state=field('state'),code=field('code'),idToken=field('id_token');
 const expected=readCookie(request.headers.get('cookie'),APPLE_STATE_COOKIE)??'';
 const clearState=cookie(APPLE_STATE_COOKIE,'',0,'None');
 const fail=(returnTo='/')=>redirect(loginPath(returnTo)+'&error=apple',[clearState]);
 if(!configured.apple()||!state||!constantTimeEqual(state,expected))return fail();
 const row=await db().prepare("DELETE FROM market_auth_challenges WHERE id=? AND kind IN ('apple','apple-link') AND expires_at>? RETURNING kind,target,return_to")
  .bind(state,Date.now()).first<{kind:string;target:string;return_to:string|null}>();
 if(!row)return fail();
 const meta=decodeChallengeMeta(row.return_to,safeReturnTo),returnTo=meta.returnTo;
 if(!idToken||field('error'))return fail(returnTo);
 let identity;
 try{identity=await verifyAppleIdTokenLive(idToken,{audiences:[env.APPLE_SERVICES_ID!],nonce:row.target})}
 catch(error){console.error('Apple sign-in rejected',String(error).slice(0,200));return fail(returnTo)}
 const apple=identityFor('apple',identity.email,{name:appleUserName(field('user'))});
 const {response,ownerId}=await finishOAuth('apple',apple,row.kind,meta,clearState,fail);
 // The refresh token is only for revocation on account deletion; failing to get it never fails the sign-in.
 // It is kept only for the account the Apple ID really signed in to or joined: a refused link keeps nothing.
 if(ownerId)await keepAppleToken(identity.sub,ownerId,env.APPLE_SERVICES_ID!,code,appleRedirect(request));
 return response;
}

// ---------- Sign in with Apple inside the iOS app (the system sheet) ----------
export async function startAppleNative(request:Request){
 if(!configured.appleNative())throw new AuthError(503,'method_unavailable');
 await limit(`apple-ip:${await clientKey(request)}`,30,60*60*1000);
 await cleanup();
 const id=randomToken(18),nonce=randomToken(24),now=Date.now();
 await db().prepare('INSERT INTO market_auth_challenges (id,kind,target,secret,attempts,created_at,expires_at) VALUES (?,?,?,?,0,?,?)')
  .bind(id,'apple-native',nonce,'',now,now+OAUTH_TTL_MS).run();
 return {challengeId:id,nonce};
}
export type AppleNativeInput={challengeId:unknown;identityToken:unknown;authorizationCode?:unknown;user?:{givenName?:unknown;familyName?:unknown}|null;link?:boolean};
/** Verifies the sheet's identity token against the stored nonce and the app's bundle ID; signs in or attaches. */
export async function verifyAppleNative(input:AppleNativeInput,request:Request){
 if(!configured.appleNative())throw new AuthError(503,'method_unavailable');
 if(typeof input.challengeId!=='string'||!/^[A-Za-z0-9_-]{24}$/.test(input.challengeId)||typeof input.identityToken!=='string')throw new AuthError(400,'code_expired');
 await limit(`verify-ip:${await clientKey(request)}`,60,60*60*1000);
 const current=input.link?await signedInUser():null;
 const row=await db().prepare("DELETE FROM market_auth_challenges WHERE id=? AND kind='apple-native' AND expires_at>? RETURNING target").bind(input.challengeId,Date.now()).first<{target:string}>();
 if(!row)throw new AuthError(400,'code_expired');
 let identity;
 try{identity=await verifyAppleIdTokenLive(input.identityToken,{audiences:[env.APPLE_APP_BUNDLE_ID!],nonce:row.target})}
 catch(error){console.error('Apple native sign-in rejected',String(error).slice(0,200));throw new AuthError(400,'apple')}
 const name=[input.user?.givenName,input.user?.familyName].filter(value=>typeof value==='string'&&value.trim()).join(' ');
 const apple=identityFor('apple',identity.email,{name});
 const code=typeof input.authorizationCode==='string'?input.authorizationCode:null;
 if(current){
  await attachMethod(current,apple);
  await keepAppleToken(identity.sub,current.userId,env.APPLE_APP_BUNDLE_ID!,code);
  return {body:{ok:true as const,linked:true as const}};
 }
 const sessionCookie=await createSession(apple);
 await keepAppleToken(identity.sub,(await resolveAccount(apple)).userId,env.APPLE_APP_BUNDLE_ID!,code);
 return {body:{ok:true as const},cookie:sessionCookie};
}

function redirect(location:string,cookies:string[]){
 const response=new Response(null,{status:303,headers:{Location:location,'Cache-Control':'no-store'}});
 for(const value of cookies)response.headers.append('Set-Cookie',value);
 return response;
}

async function sendEmail(to:string,code:string){
 const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),
  headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},
  body:JSON.stringify({from:env.ATLAS_AUTH_EMAIL_FROM,to:[to],subject:`Код входа в Atlas: ${code}`,
   text:`Ваш код для входа в Atlas: ${code}\nКод действует 10 минут. Никому его не сообщайте.\nЕсли вы не запрашивали вход, просто проигнорируйте это письмо.`})});
 if(!response.ok)throw new Error(`Resend responded ${response.status}`);
}

let eskizToken:{value:string;expiresAt:number}|null=null;
async function eskiz(path:string,form:Record<string,string>,authorized=true):Promise<Response>{
 const body=new FormData();for(const [key,value] of Object.entries(form))body.set(key,value);
 return fetch('https://notify.eskiz.uz/api/'+path,{method:'POST',body,signal:AbortSignal.timeout(10000),headers:authorized&&eskizToken?{Authorization:`Bearer ${eskizToken.value}`}:{}});
}
async function eskizLogin(){
 const login=await eskiz('auth/login',{email:env.ESKIZ_EMAIL!,password:env.ESKIZ_PASSWORD!},false);
 const token=login.ok?(await login.json() as {data?:{token?:string}}).data?.token:undefined;
 if(!token)throw new Error(`Eskiz login responded ${login.status}`);
 eskizToken={value:token,expiresAt:Date.now()+20*24*60*60*1000};
}
async function sendSms(phone:string,code:string){
 if(!eskizToken||eskizToken.expiresAt<Date.now())await eskizLogin();
 const message=(env.ATLAS_SMS_TEMPLATE??'Kod dlya vhoda v Atlas: {code}').replace('{code}',code);
 const send=()=>eskiz('message/sms/send',{mobile_phone:phone.slice(1),message,from:env.ESKIZ_FROM??'4546'});
 let response=await send();
 // Eskiz revokes tokens on its side too: sign in again once and resend instead of failing the customer's code.
 if(response.status===401){eskizToken=null;await eskizLogin();response=await send()}
 if(!response.ok)throw new Error(`Eskiz responded ${response.status}`);
}

// ---------- Telegram bot sign-in (lib/auth/telegram-bot.ts) ----------
async function telegramBotConnected(){
 try{return !!(await db().prepare('SELECT 1 AS found FROM market_settings WHERE key=?').bind(TG_BOT_SETTING).first())}catch{return false}
}
/** The public site connects the bot by itself the first time its sign-in page asks, so no admin step is needed. */
const publicHosts=['atlasmarket.uz','www.atlasmarket.uz'];
async function telegramBotReady(request:Request){
 if(await telegramBotConnected())return true;
 const url=new URL(request.url);
 if(url.protocol!=='https:'||!publicHosts.includes(url.hostname))return false;
 try{await connectTelegramBot('https://atlasmarket.uz','auto');return true}
 catch(error){console.error('Telegram bot auto-connect failed',error);return false}
}
async function webhookSecret(){return (await sha256Hex('telegram-webhook:'+pepper()+':'+(env.TELEGRAM_BOT_TOKEN??''))).slice(0,48)}
async function botApi(method:string,body:Record<string,unknown>){
 const response=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 const data=await response.json().catch(()=>({})) as {ok?:boolean;description?:string;result?:{animation?:{file_id?:string};document?:{file_id?:string}}};
 if(!response.ok||!data.ok)throw Error(`Telegram ${method}: ${data.description??response.status}`);
 return data;
}
function browserSecret(request:Request){
 const value=readCookie(request.headers.get('cookie'),TG_LOGIN_COOKIE);
 return value&&/^[A-Za-z0-9_-]{43}$/.test(value)?value:null;
}

/** A one-time start token for this browser; the links open the Telegram app with it. */
export async function startTelegramBot(request:Request,link:boolean){
 if(!configured.telegram())throw new AuthError(503,'method_unavailable');
 if(link)await signedInUser();
 await limit(`telegram-bot-start:${await clientKey(request)}`,60,60*60*1000);
 const token=randomToken(24),secret=browserSecret(request)??randomToken(32),now=Date.now();
 const kind:TgChallengeKind=link?'telegram-link':'telegram-bot';
 await db().prepare('INSERT INTO market_auth_challenges (id,kind,target,secret,attempts,return_to,created_at,expires_at) VALUES (?,?,?,?,0,NULL,?,?)')
  .bind(await sha256Hex(token),kind,'',await sha256Hex(secret),now,now+TG_LOGIN_TTL_MS).run();
 if(Math.random()<0.05)await cleanup();
 return {body:{token,expiresAt:now+TG_LOGIN_TTL_MS,links:botLinks(env.TELEGRAM_BOT_USERNAME!,token)},cookie:cookie(TG_LOGIN_COOKIE,secret,TG_LOGIN_TTL_MS/1000*6)};
}

/** The page asks whether the bot confirmed its token; once it has, this browser signs in (or attaches Telegram). */
export async function checkTelegramBot(request:Request,token:unknown):Promise<{status:'pending'|'expired'|'linked'}|{status:'done';cookie:string}>{
 if(!validStartToken(token))throw new AuthError(400,'telegram_invalid');
 await limit(`telegram-bot-check:${await clientKey(request)}`,900,10*60*1000);
 const id=await sha256Hex(token);
 const row=await db().prepare(`SELECT kind,target,secret,expires_at FROM market_auth_challenges WHERE id=? AND kind IN (${TG_CHALLENGE_KINDS.map(()=>'?').join(',')})`)
  .bind(id,...TG_CHALLENGE_KINDS).first<{kind:TgChallengeKind;target:string;secret:string;expires_at:number}>();
 if(!row||row.expires_at<Date.now())return {status:'expired'};
 const secret=browserSecret(request);
 if(!secret||!constantTimeEqual(await sha256Hex(secret),row.secret))throw new AuthError(403,'telegram_invalid');
 if(!row.target)return {status:'pending'};
 // Used once: the first check that deletes the confirmed row signs in.
 const used=await db().prepare('DELETE FROM market_auth_challenges WHERE id=? AND target=?').bind(id,row.target).run();
 if(!used.meta.changes)return {status:'expired'};
 const confirmed=JSON.parse(row.target) as {id:string;name?:string};
 const user=identityFor('telegram',confirmed.id,{name:confirmed.name});
 if(row.kind==='telegram-link'){await attachMethod(await signedInUser(),user);return {status:'linked'}}
 return {status:'done',cookie:await createSession(user)};
}

/** Telegram posts the bot's updates here; only requests carrying the webhook secret are read. */
/**
 * The first message after Start: the welcome animation with the text and buttons as its caption. The first
 * send passes the site's file URL; Telegram's file_id is kept and reused, so later sends are instant.
 */
async function sendWelcome(chatId:number,caption:string,replyMarkup:unknown,site:string){
 let cached:string|undefined;
 try{cached=(await db().prepare('SELECT value FROM market_settings WHERE key=?').bind(TG_ANIMATION_SETTING).first<{value:string}>())?.value}catch{/* no cache */}
 try{
  const sent=await botApi('sendAnimation',{chat_id:chatId,animation:cached??site+TG_WELCOME_ANIMATION,caption,parse_mode:'HTML',reply_markup:replyMarkup});
  const fileId=sent.result?.animation?.file_id??sent.result?.document?.file_id;
  if(fileId&&fileId!==cached)await db().prepare('INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(TG_ANIMATION_SETTING,fileId,Date.now(),'telegram-bot').run();
 }catch(error){
  // A stale file_id (new bot token) or an unreachable file: forget it and send the text alone.
  console.error('Telegram welcome animation failed',error);
  if(cached)await db().prepare('DELETE FROM market_settings WHERE key=?').bind(TG_ANIMATION_SETTING).run().catch(()=>undefined);
  await botApi('sendMessage',{chat_id:chatId,text:caption,parse_mode:'HTML',reply_markup:replyMarkup});
 }
}

export async function telegramWebhook(request:Request){
 if(!configured.telegram())throw new AuthError(503,'method_unavailable');
 if(!constantTimeEqual(request.headers.get('x-telegram-bot-api-secret-token')??'',await webhookSecret()))throw new AuthError(403,'forbidden_origin');
 const update=parseBotUpdate(await request.json().catch(()=>null));
 if(!update)return;
 const t=botText[update.lang],site=new URL(request.url).origin,openSite={inline_keyboard:[[{text:t.open,url:site}]]};
 const pending=async(token:string)=>{
  const row=await db().prepare(`SELECT kind,target,expires_at FROM market_auth_challenges WHERE id=? AND kind IN (${TG_CHALLENGE_KINDS.map(()=>'?').join(',')})`)
   .bind(await sha256Hex(token),...TG_CHALLENGE_KINDS).first<{kind:TgChallengeKind;target:string;expires_at:number}>();
  return row&&!row.target&&row.expires_at>=Date.now()?row:null;
 };
 if(update.kind==='start'){
  const row=update.token?await pending(update.token):null;
  if(!row){
   if(update.token)await botApi('sendMessage',{chat_id:update.chatId,text:t.expired,reply_markup:openSite});
   else await sendWelcome(update.chatId,t.hello,openSite,site);
   return;
  }
  const isLink=row.kind==='telegram-link';
  await sendWelcome(update.chatId,isLink?t.linkConfirm:t.confirm,{inline_keyboard:[[{text:isLink?t.linkButton:t.confirmButton,callback_data:'ok:'+update.token}]]},site);
  return;
 }
 await limit(`telegram-bot-confirm:${update.user.id}`,30,60*60*1000);
 const row=await pending(update.token);
 const saved=row?await db().prepare("UPDATE market_auth_challenges SET target=? WHERE id=? AND target=''").bind(JSON.stringify(update.user),await sha256Hex(update.token)).run():null;
 const ok=!!saved?.meta.changes;
 await botApi('answerCallbackQuery',{callback_query_id:update.callbackId,text:ok?t.toast:t.expired.split('.')[0]});
 const result=ok?(row?.kind==='telegram-link'?t.linked:t.done):t.expired;
 await botApi(update.media?'editMessageCaption':'editMessageText',{chat_id:update.chatId,message_id:update.messageId,...(update.media?{caption:result}:{text:result}),parse_mode:'HTML',reply_markup:openSite});
}

/** Operator: point the bot at this site's webhook. After that the sign-in button opens the bot instead of the widget. */
export async function connectTelegramBot(origin:string,operatorEmail:string){
 if(!configured.telegram())throw new AuthError(503,'method_unavailable');
 const url=origin+'/api/auth/telegram/webhook';
 await botApi('setWebhook',{url,secret_token:await webhookSecret(),allowed_updates:['message','callback_query'],drop_pending_updates:true});
 await db().prepare('INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by')
  .bind(TG_BOT_SETTING,JSON.stringify({url}),Date.now(),operatorEmail).run();
 return {url};
}
export async function telegramBotStatus(){
 if(!configured.telegram())return {configured:false,connected:false};
 return {configured:true,connected:await telegramBotConnected()};
}
