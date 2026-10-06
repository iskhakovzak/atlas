// Pure authentication helpers shared by the Worker routes and unit tests.
// Nothing here touches D1, cookies of a live request or provider APIs.
export type AuthMethod='email'|'phone'|'telegram'|'google'|'apple';
export type AuthUser={userId:string;email:string;displayName:string;contact:string;method:AuthMethod};
const authMethods:readonly string[]=['email','phone','telegram','google','apple'];
/** A sign-in failure with a stable machine code; the routes answer {error:code} with this status. */
export class AuthError extends Error{status:number;code:string;constructor(status:number,code:string){super(code);this.status=status;this.code=code}}

export const SESSION_COOKIE='__Host-atlas_session';
export const OAUTH_STATE_COOKIE='__Host-atlas_oauth';
// Apple posts its result cross-site, which only a SameSite=None cookie accompanies (the Lax one above would stay home).
export const APPLE_STATE_COOKIE='__Host-atlas_apple';
// A sign-in finished in the system browser is handed to the Atlas app through a two-minute single-use code.
export const HANDOFF_TTL_MS=2*60*1000;
export const LINK_TICKET_TTL_MS=2*60*1000;
/** Custom URL scheme of the Atlas apps (iOS and Android); /auth/return sends the browser back with it. */
export const APP_URL_SCHEME='uz.atlasmarket.app';
export function appAuthLink(code:string,returnTo:string){return `${APP_URL_SCHEME}://auth?code=${encodeURIComponent(code)}&return_to=${encodeURIComponent(returnTo)}`}
// A session lasts 60 days from the last visit: each use (at most once a day) moves the end forward.
export const SESSION_TTL_MS=60*24*60*60*1000;
export const SESSION_RENEW_MS=24*60*60*1000;
export const CODE_TTL_MS=10*60*1000;
export const OAUTH_TTL_MS=10*60*1000;
export const MAX_CODE_ATTEMPTS=5;
export const TELEGRAM_MAX_AGE_SECONDS=10*60;

const encoder=new TextEncoder();

export function normalizeEmail(input:unknown):string|null{
 if(typeof input!=='string')return null;
 const email=input.trim().toLowerCase();
 if(email.length>254||!/^[^\s@<>()[\]\\,;:"]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(email))return null;
 return email;
}

// Atlas delivers to Uzbekistan, so SMS sign-in accepts only +998 mobile numbers.
export function normalizeUzPhone(input:unknown):string|null{
 if(typeof input!=='string'||input.length>32)return null;
 const digits=input.replace(/[\s()+-]/g,'');
 if(!/^\d+$/.test(digits))return null;
 const local=digits.length===12&&digits.startsWith('998')?digits.slice(3):digits.length===9?digits:null;
 return local?'+998'+local:null;
}

export function base64Url(bytes:Uint8Array){
 let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function randomToken(bytes=32){return base64Url(crypto.getRandomValues(new Uint8Array(bytes)))}

// Uniform six-digit code: rejection sampling avoids modulo bias.
export function randomCode(){
 const limit=4294000000; // largest multiple of 1e6 below 2^32
 const value=new Uint32Array(1);
 do crypto.getRandomValues(value);while(value[0]>=limit);
 return String(value[0]%1000000).padStart(6,'0');
}

function hex(buffer:ArrayBuffer){return [...new Uint8Array(buffer)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
export async function sha256Hex(text:string){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)))}
async function hmac(key:ArrayBuffer|Uint8Array<ArrayBuffer>,text:string){
 const imported=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return crypto.subtle.sign('HMAC',imported,encoder.encode(text));
}
export async function hashCode(challengeId:string,code:string,pepper:string){
 return hex(await hmac(encoder.encode('atlas-otp:'+pepper),challengeId+':'+code));
}
export function constantTimeEqual(a:string,b:string){
 if(a.length!==b.length)return false;
 let diff=0;for(let index=0;index<a.length;index++)diff|=a.charCodeAt(index)^b.charCodeAt(index);
 return diff===0;
}

export function identityFor(method:AuthMethod,subject:string,profile:{name?:string}={}):AuthUser{
 const name=profile.name?.trim().slice(0,120);
 if(method==='email'||method==='google'||method==='apple'){
  // Email-keyed IDs match accounts created by the former ChatGPT sign-in; one address is one account
  // whichever of the three verified it (Apple's private relay addresses are stable per team).
  return {userId:'email:'+subject,email:subject,displayName:name||subject,contact:subject,method};
 }
 if(method==='phone')return {userId:'phone:'+subject,email:'',displayName:name||subject,contact:subject,method};
 return {userId:'tg:'+subject,email:'',displayName:name||'Telegram '+subject,contact:name?`${name} · Telegram`:'Telegram',method};
}

const accountKeys=['orders','entries','cart','favorites','deliveryProfiles','identityProfiles','declarations','supportTickets'];
/** Nothing in it yet: no orders, balance, cart, favorites, recipients, passports, declarations or support requests. */
export function emptyAccountState(serialized:string){
 try{const state=JSON.parse(serialized) as Record<string,unknown>;return accountKeys.every(key=>!Array.isArray(state[key])||!(state[key] as unknown[]).length)}catch{return false}
}
/** The method an account was created with, read from its user ID ("email:…", "phone:…", "tg:…"). */
export function ownMethod(userId:string):{method:AuthMethod;contact:string}{
 if(userId.startsWith('email:'))return {method:'email',contact:userId.slice(6)};
 if(userId.startsWith('phone:'))return {method:'phone',contact:userId.slice(6)};
 return {method:'telegram',contact:'Telegram'};
}

/**
 * Which sessions of an account a detached method leaves behind, by the columns market_auth_sessions has
 * (method, contact). identityFor gives email, Google and Apple one "email:" subject with the address as
 * contact; a phone's contact is the number. A Telegram session's contact is only a display name, so
 * detaching Telegram revokes every Telegram session of the account. Null for anything else.
 */
export type SessionRevocation={methods:AuthMethod[];contact?:string};
export function sessionRevocationFor(subject:string):SessionRevocation|null{
 if(subject.startsWith('email:')&&subject.length>6)return {methods:['email','google','apple'],contact:subject.slice(6)};
 if(subject.startsWith('phone:')&&subject.length>6)return {methods:['phone'],contact:subject.slice(6)};
 if(subject.startsWith('tg:')&&subject.length>3)return {methods:['telegram']};
 return null;
}
export function sessionMatchesRevocation(user:{method:string;contact:string},rule:SessionRevocation){
 return (rule.methods as string[]).includes(user.method)&&(rule.contact===undefined||user.contact===rule.contact);
}

export type TelegramFields=Record<string,string|number|undefined|null>;
export async function verifyTelegramAuth(fields:TelegramFields,botToken:string,nowSeconds=Math.floor(Date.now()/1000)){
 const hash=typeof fields.hash==='string'?fields.hash.toLowerCase():'';
 const id=String(fields.id??'');const authDate=Number(fields.auth_date);
 if(!botToken||!/^[0-9a-f]{64}$/.test(hash)||!/^\d{1,20}$/.test(id)||!Number.isFinite(authDate))return null;
 if(authDate>nowSeconds+60||nowSeconds-authDate>TELEGRAM_MAX_AGE_SECONDS)return null;
 const allowed=['auth_date','first_name','id','last_name','photo_url','username'];
 const check=allowed.filter(key=>fields[key]!==undefined&&fields[key]!==null&&fields[key]!=='').map(key=>`${key}=${fields[key]}`).join('\n');
 const secret=await crypto.subtle.digest('SHA-256',encoder.encode(botToken));
 if(!constantTimeEqual(hex(await hmac(secret,check)),hash))return null;
 const name=[fields.first_name,fields.last_name].filter(value=>typeof value==='string'&&value.trim()).join(' ');
 const username=typeof fields.username==='string'?fields.username:'';
 return {id,name:name||(username?'@'+username:'')};
}

export async function pkceChallenge(verifier:string){
 return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier))));
}
// A PKCE value (verifier from 32 random bytes, or the S256 challenge of one) is 43 base64url characters.
export const PKCE_SHAPE=/^[A-Za-z0-9_-]{43}$/;
export const isPkceValue=(value:unknown):value is string=>typeof value==='string'&&PKCE_SHAPE.test(value);

// A native handoff row (market_auth_challenges, kind "handoff") keeps in its secret column whether the
// flow was a link and the PKCE challenge of the app instance that started it (RFC 8252 §8.6): only that
// instance, holding the verifier, can trade the code. Older rows ('' or 'link') carry no challenge.
export type HandoffSecret={link:boolean;pkce:string|null};
export function encodeHandoffSecret(secret:HandoffSecret):string{return JSON.stringify({link:secret.link,pkce:secret.pkce})}
export function decodeHandoffSecret(value:string|null|undefined):HandoffSecret{
 if(value&&value.startsWith('{')){
  try{
   const record=JSON.parse(value) as Record<string,unknown>;
   return {link:record.link===true,pkce:isPkceValue(record.pkce)?record.pkce:null};
  }catch{/* fall through */}
 }
 return {link:value==='link',pkce:null};
}
/** True only when the row holds a challenge and the presented verifier hashes to it. */
export async function verifyHandoffProof(secret:HandoffSecret,verifier:unknown):Promise<boolean>{
 if(!secret.pkce||!isPkceValue(verifier))return false;
 return constantTimeEqual(await pkceChallenge(verifier),secret.pkce);
}

export function fromBase64Url(text:string){
 const binary=atob(text.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(text.length/4)*4,'='));
 return Uint8Array.from(binary,char=>char.charCodeAt(0));
}
export function decodeJwtPayload(token:string):Record<string,unknown>|null{
 const part=token.split('.')[1];
 if(!part)return null;
 try{
  const value=JSON.parse(new TextDecoder().decode(fromBase64Url(part)));
  return value&&typeof value==='object'?value:null;
 }catch{return null}
}

/** ATLAS_REVIEW_ACCOUNTS: "email=code,email=code" for app-store reviewers. Only exact pairs with a six-digit code count. */
export function parseReviewAccounts(value:unknown):Map<string,string>{
 const accounts=new Map<string,string>();
 if(typeof value!=='string')return accounts;
 for(const pair of value.split(',')){
  const index=pair.indexOf('=');
  if(index<0)continue;
  const email=normalizeEmail(pair.slice(0,index)),code=pair.slice(index+1).trim();
  if(email&&/^\d{6}$/.test(code))accounts.set(email,code);
 }
 return accounts;
}

// A signed-in user travels through D1 (handoff codes, link tickets, OAuth challenges) as JSON.
export function serializeAuthUser(user:AuthUser){return JSON.stringify({userId:user.userId,email:user.email,displayName:user.displayName,contact:user.contact,method:user.method})}
export function parseAuthUser(value:unknown):AuthUser|null{
 let record:Record<string,unknown>;
 try{record=typeof value==='string'?JSON.parse(value):value}catch{return null}
 if(!record||typeof record!=='object')return null;
 const text=(key:string)=>typeof record[key]==='string'?record[key] as string:null;
 const userId=text('userId'),displayName=text('displayName'),contact=text('contact'),method=text('method');
 if(!userId||displayName===null||contact===null||!method||!authMethods.includes(method))return null;
 return {userId,email:text('email')??'',displayName,contact,method:method as AuthMethod};
}

// An OAuth challenge's return_to column carries either a plain path (older rows) or JSON with the
// path plus how to finish: hand the result to the app, and which account a system-browser link joins.
// A native flow also carries the app instance's PKCE challenge, which ends up in the handoff row.
export type ChallengeMeta={returnTo:string;native:boolean;linkUserId:string|null;pkce:string|null};
export function encodeChallengeMeta(meta:{returnTo:string;native?:boolean;linkUserId?:string|null;pkce?:string|null}):string{
 if(!meta.native&&!meta.linkUserId&&!meta.pkce)return meta.returnTo;
 return JSON.stringify({returnTo:meta.returnTo,native:!!meta.native,linkUserId:meta.linkUserId??null,pkce:meta.pkce??null});
}
export function decodeChallengeMeta(value:string|null|undefined,safe:(path:string|null|undefined)=>string):ChallengeMeta{
 if(value&&value.startsWith('{')){
  try{
   const record=JSON.parse(value) as Record<string,unknown>;
   return {returnTo:safe(typeof record.returnTo==='string'?record.returnTo:null),native:record.native===true,linkUserId:typeof record.linkUserId==='string'?record.linkUserId:null,pkce:isPkceValue(record.pkce)?record.pkce:null};
  }catch{/* fall through to the plain path */}
 }
 return {returnTo:safe(value),native:false,linkUserId:null,pkce:null};
}

// Provider refresh tokens rest in D1 sealed with AES-GCM under a key derived from ATLAS_AUTH_SECRET.
async function tokenKey(secret:string,usage:'encrypt'|'decrypt'){
 const material=await crypto.subtle.digest('SHA-256',encoder.encode('atlas-token-key:'+secret));
 return crypto.subtle.importKey('raw',material,{name:'AES-GCM'},false,[usage]);
}
export async function sealToken(plain:string,secret:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv},await tokenKey(secret,'encrypt'),encoder.encode(plain));
 return base64Url(iv)+'.'+base64Url(new Uint8Array(sealed));
}
export async function openToken(sealed:string,secret:string):Promise<string|null>{
 const [iv,data]=sealed.split('.');
 if(!iv||!data)return null;
 try{return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64Url(iv)},await tokenKey(secret,'decrypt'),fromBase64Url(data)))}
 catch{return null}
}

// The ID token comes straight from Google's token endpoint over TLS, so OIDC
// allows relying on these claim checks instead of verifying the JWS signature.
export function googleIdentity(payload:Record<string,unknown>|null,expected:{clientId:string;nonce:string;nowSeconds?:number}){
 if(!payload)return null;
 const now=expected.nowSeconds??Math.floor(Date.now()/1000);
 const audience=Array.isArray(payload.aud)?payload.aud:[payload.aud];
 if(!['accounts.google.com','https://accounts.google.com'].includes(String(payload.iss)))return null;
 if(!audience.includes(expected.clientId)||typeof payload.exp!=='number'||payload.exp<now||payload.nonce!==expected.nonce)return null;
 if(payload.email_verified!==true)return null;
 const email=normalizeEmail(payload.email);
 if(!email)return null;
 return {email,name:typeof payload.name==='string'?payload.name:''};
}

export function readCookie(header:string|null,name:string){
 for(const part of (header??'').split(';')){
  const index=part.indexOf('=');
  if(index>0&&part.slice(0,index).trim()===name)return part.slice(index+1).trim();
 }
 return null;
}
export function cookie(name:string,value:string,maxAgeSeconds:number,sameSite:'Lax'|'None'='Lax'){
 return `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=${sameSite}`;
}
