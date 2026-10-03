// Pure authentication helpers shared by the Worker routes and unit tests.
// Nothing here touches D1, cookies of a live request or provider APIs.
export type AuthMethod='email'|'phone'|'telegram'|'google';
export type AuthUser={userId:string;email:string;displayName:string;contact:string;method:AuthMethod};

export const SESSION_COOKIE='__Host-atlas_session';
export const OAUTH_STATE_COOKIE='__Host-atlas_oauth';
export const SESSION_TTL_MS=30*24*60*60*1000;
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
 if(method==='email'||method==='google'){
  // Email-keyed IDs match accounts created by the former ChatGPT sign-in.
  return {userId:'email:'+subject,email:subject,displayName:name||subject,contact:subject,method};
 }
 if(method==='phone')return {userId:'phone:'+subject,email:'',displayName:name||subject,contact:subject,method};
 return {userId:'tg:'+subject,email:'',displayName:name||'Telegram '+subject,contact:name?`${name} · Telegram`:'Telegram',method};
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

export function decodeJwtPayload(token:string):Record<string,unknown>|null{
 const part=token.split('.')[1];
 if(!part)return null;
 try{
  const binary=atob(part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'='));
  const value=JSON.parse(new TextDecoder().decode(Uint8Array.from(binary,char=>char.charCodeAt(0))));
  return value&&typeof value==='object'?value:null;
 }catch{return null}
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
export function cookie(name:string,value:string,maxAgeSeconds:number){
 return `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}
