// Sign in with Apple, the pure part: ID-token verification against Apple's JWKS, the ES256 client
// secret, the authorize URL and the token/revoke requests. Nothing here reads env or D1, so the
// unit tests feed it generated keys; lib/auth/server.ts wires it to the Worker.
import {base64Url,fromBase64Url,normalizeEmail} from './core.ts';

export const APPLE_ISSUER='https://appleid.apple.com';
export const APPLE_AUTHORIZE_URL='https://appleid.apple.com/auth/authorize';
export const APPLE_TOKEN_URL='https://appleid.apple.com/auth/token';
export const APPLE_REVOKE_URL='https://appleid.apple.com/auth/revoke';
export const APPLE_JWKS_URL='https://appleid.apple.com/auth/keys';
export const APPLE_CLIENT_SECRET_TTL_SECONDS=300;

export type AppleJwks={keys:JsonWebKey[]};
export type AppleIdentity={sub:string;email:string;isPrivateEmail:boolean};
export class AppleTokenError extends Error{
 reason:string;
 constructor(reason:string){super(reason);this.reason=reason}
}

const encoder=new TextEncoder();
const decoder=new TextDecoder();
const encodeJson=(value:unknown)=>base64Url(encoder.encode(JSON.stringify(value)));

function decodeSegment(segment:string):Record<string,unknown>|null{
 try{const value=JSON.parse(decoder.decode(fromBase64Url(segment)));return value&&typeof value==='object'&&!Array.isArray(value)?value:null}catch{return null}
}

/**
 * Verifies an Apple ID token (RS256) and returns the stable subject and verified email.
 * Throws AppleTokenError with a short reason; "unknown_kid" tells the caller to refresh the JWKS once.
 */
export async function verifyAppleIdToken(token:string,options:{audiences:string[];nonce?:string;nowSeconds?:number;jwks:AppleJwks}):Promise<AppleIdentity>{
 if(typeof token!=='string'||token.length>8192)throw new AppleTokenError('malformed');
 const parts=token.split('.');
 if(parts.length!==3)throw new AppleTokenError('malformed');
 const header=decodeSegment(parts[0]),payload=decodeSegment(parts[1]);
 if(!header||!payload)throw new AppleTokenError('malformed');
 if(header.alg!=='RS256'||typeof header.kid!=='string')throw new AppleTokenError('alg');
 const jwk=options.jwks.keys.find(key=>(key as {kid?:string}).kid===header.kid&&key.kty==='RSA');
 if(!jwk)throw new AppleTokenError('unknown_kid');
 let signature:Uint8Array;
 try{signature=fromBase64Url(parts[2])}catch{throw new AppleTokenError('malformed')}
 const key=await crypto.subtle.importKey('jwk',{...jwk,alg:'RS256',ext:true,key_ops:['verify']},{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,signature as BufferSource,encoder.encode(parts[0]+'.'+parts[1]));
 if(!valid)throw new AppleTokenError('signature');
 const now=options.nowSeconds??Math.floor(Date.now()/1000);
 if(payload.iss!==APPLE_ISSUER)throw new AppleTokenError('issuer');
 const audience=Array.isArray(payload.aud)?payload.aud:[payload.aud];
 if(!audience.some(value=>typeof value==='string'&&options.audiences.includes(value)))throw new AppleTokenError('audience');
 if(typeof payload.exp!=='number'||payload.exp<=now)throw new AppleTokenError('expired');
 if(options.nonce!==undefined&&payload.nonce!==options.nonce)throw new AppleTokenError('nonce');
 if(typeof payload.sub!=='string'||!payload.sub)throw new AppleTokenError('subject');
 // Apple sends email_verified as the string "true" in some tokens and as a boolean in others.
 const verified=payload.email_verified===true||payload.email_verified==='true';
 const email=normalizeEmail(payload.email);
 if(!verified||!email)throw new AppleTokenError('email');
 const isPrivateEmail=payload.is_private_email===true||payload.is_private_email==='true';
 return {sub:payload.sub,email,isPrivateEmail};
}

// Apple's signing keys change rarely; one fetch an hour is plenty, plus one more when a token names a key we lack.
let jwksCache:{value:AppleJwks;fetchedAt:number}|null=null;
const JWKS_TTL_MS=60*60*1000;
export async function fetchAppleJwks(force=false):Promise<AppleJwks>{
 if(!force&&jwksCache&&Date.now()-jwksCache.fetchedAt<JWKS_TTL_MS)return jwksCache.value;
 const response=await fetch(APPLE_JWKS_URL,{signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error(`Apple JWKS responded ${response.status}`);
 const value=await response.json() as AppleJwks;
 if(!value||!Array.isArray(value.keys))throw new Error('Apple JWKS malformed');
 jwksCache={value,fetchedAt:Date.now()};
 return value;
}
/** Verifies with the cached JWKS and retries once with fresh keys when the token names an unknown key. */
export async function verifyAppleIdTokenLive(token:string,options:{audiences:string[];nonce?:string}){
 try{return await verifyAppleIdToken(token,{...options,jwks:await fetchAppleJwks()})}
 catch(error){
  if(!(error instanceof AppleTokenError)||error.reason!=='unknown_kid')throw error;
  return verifyAppleIdToken(token,{...options,jwks:await fetchAppleJwks(true)});
 }
}

/** The .p8 from Apple, with "\n" sequences from an env var turned back into line breaks, as raw PKCS#8 bytes. */
export function pemToPkcs8(pem:string):Uint8Array{
 const body=pem.replace(/\\n/g,'\n').replace(/-----(BEGIN|END)[^-]*-----/g,'').replace(/\s+/g,'');
 const binary=atob(body);
 return Uint8Array.from(binary,char=>char.charCodeAt(0));
}

export type AppleSecretInput={teamId:string;keyId:string;privateKeyPem:string;clientId:string;nowSeconds?:number};
/** The client secret Apple expects at /auth/token and /auth/revoke: a five-minute ES256 JWT signed with the team key. */
export async function appleClientSecret(input:AppleSecretInput):Promise<string>{
 const iat=input.nowSeconds??Math.floor(Date.now()/1000);
 const header=encodeJson({alg:'ES256',kid:input.keyId,typ:'JWT'});
 const claims=encodeJson({iss:input.teamId,iat,exp:iat+APPLE_CLIENT_SECRET_TTL_SECONDS,aud:APPLE_ISSUER,sub:input.clientId});
 const key=await crypto.subtle.importKey('pkcs8',pemToPkcs8(input.privateKeyPem) as BufferSource,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 // WebCrypto ECDSA signatures are already r||s (the JOSE form), so no DER conversion is needed.
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,encoder.encode(header+'.'+claims));
 return header+'.'+claims+'.'+base64Url(new Uint8Array(signature));
}

export type AppleAuthorizeInput={clientId:string;redirectUri:string;state:string;nonce:string};
/** The authorize URL for the web flow: form_post is required because Apple returns the ID token with the name scope. */
export function appleAuthorizeUrl(input:AppleAuthorizeInput):string{
 const url=new URL(APPLE_AUTHORIZE_URL);
 url.search=new URLSearchParams({client_id:input.clientId,redirect_uri:input.redirectUri,response_type:'code id_token',response_mode:'form_post',scope:'name email',state:input.state,nonce:input.nonce}).toString();
 return url.href;
}

/** Apple's `user` form field (first authorization only): {"name":{"firstName":…,"lastName":…},"email":…}. */
export function appleUserName(user:unknown):string{
 let record:unknown=user;
 if(typeof user==='string'){try{record=JSON.parse(user)}catch{return ''}}
 const name=(record as {name?:{firstName?:unknown;lastName?:unknown}}|null)?.name;
 return [name?.firstName,name?.lastName].filter(value=>typeof value==='string'&&value.trim()).map(value=>(value as string).trim()).join(' ').slice(0,120);
}

/** Exchanges an authorization code for Apple's refresh token; null when Apple refuses (sign-in does not depend on it). */
export async function exchangeAppleCode(input:{code:string;clientId:string;clientSecret:string;redirectUri?:string}):Promise<string|null>{
 const body=new URLSearchParams({client_id:input.clientId,client_secret:input.clientSecret,code:input.code,grant_type:'authorization_code'});
 if(input.redirectUri)body.set('redirect_uri',input.redirectUri);
 const response=await fetch(APPLE_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(10000)});
 if(!response.ok)return null;
 const token=await response.json().catch(()=>null) as {refresh_token?:unknown}|null;
 return typeof token?.refresh_token==='string'?token.refresh_token:null;
}

/** Revokes a refresh token at Apple (required before an account is deleted). Resolves true when Apple answered 200. */
export async function revokeAppleToken(input:{token:string;clientId:string;clientSecret:string}):Promise<boolean>{
 const body=new URLSearchParams({client_id:input.clientId,client_secret:input.clientSecret,token:input.token,token_type_hint:'refresh_token'});
 const response=await fetch(APPLE_REVOKE_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(10000)});
 return response.ok;
}
