// PKCE for the native sign-in handoff (RFC 8252 §8.6). The app instance that opens a Google/Apple flow in
// the system browser makes a verifier, keeps it to itself and sends only its S256 challenge with the start
// request; the single-use handoff code is later traded together with the verifier, so a code that leaks
// through the URL scheme (another app claiming it, a copied link) is worthless on its own.
// Pure apart from sessionStorage, so the round trip is tested in node; WebCrypto exists in both.
import {base64Url,pkceChallenge} from '../auth/core.ts';

export const HANDOFF_VERIFIER_KEY='atlas.handoff.verifier';
let memoryVerifier:string|null=null;

/** 32 random bytes as 43 base64url characters. */
export function createPkceVerifier(){return base64Url(crypto.getRandomValues(new Uint8Array(32)))}
/** The S256 challenge of a verifier, base64url without padding (the server's pkceChallenge, same bytes). */
export const pkceChallengeFor=pkceChallenge;

function storage():Storage|null{
 try{return typeof sessionStorage==='undefined'?null:sessionStorage}catch{return null}
}
/** Keeps the verifier for the handoff that will come back; one at a time, the newest wins. */
export function rememberVerifier(verifier:string){
 memoryVerifier=verifier;
 try{storage()?.setItem(HANDOFF_VERIFIER_KEY,verifier)}catch{/* private mode or blocked storage: memory only */}
}
/** Takes the verifier out (single use); null when no flow was started from this instance. */
export function takeVerifier():string|null{
 let value:string|null=null;
 try{const store=storage();value=store?.getItem(HANDOFF_VERIFIER_KEY)??null;store?.removeItem(HANDOFF_VERIFIER_KEY)}catch{/* fall back to memory */}
 const result=value??memoryVerifier;
 memoryVerifier=null;
 return result;
}
/** Starts a handoff: makes and keeps a verifier, returns the challenge to append as ?pkce=. */
export async function beginHandoff(){
 const verifier=createPkceVerifier();
 rememberVerifier(verifier);
 return pkceChallengeFor(verifier);
}
