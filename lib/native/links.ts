// Deep links the Atlas apps receive: the custom scheme (uz.atlasmarket.app://auth?code=…) and
// universal/app links on https://atlasmarket.uz. Pure, so the parser is tested in node and never
// trusts the URL: a sign-in handoff code must look like one, a return path must stay on the site.
import {safeReturnTo} from '../auth/return-to.ts';

export const APP_SCHEME='uz.atlasmarket.app';
export const SITE_HOST='atlasmarket.uz';
/** Universal/app link paths the apps claim (also listed in the AASA, assetlinks and both manifests). */
export const APP_LINK_PATHS=['/auth/return','/order-by-link','/catalog','/orders','/app'] as const;

export type AppLink=
 |{kind:'auth';code:string;returnTo:string|null}
 |{kind:'path';path:string};

// Handoff codes are base64url tokens (lib/auth/core.ts randomToken); anything else is noise.
const codeShape=/^[A-Za-z0-9._-]{16,256}$/;
const siteHosts=new Set([SITE_HOST,'www.'+SITE_HOST]);

function auth(params:URLSearchParams):AppLink|null{
 const code=params.get('code')?.trim()??'';
 if(!codeShape.test(code))return null;
 const returnTo=params.get('return_to');
 return {kind:'auth',code,returnTo:returnTo?safeReturnTo(returnTo):null};
}

/** Classifies a URL delivered to the app; null for anything that is not an Atlas link. */
export function parseAppLink(raw:string):AppLink|null{
 if(typeof raw!=='string'||raw.length>4096)return null;
 let url:URL;
 try{url=new URL(raw.trim())}catch{return null}
 if(url.protocol===APP_SCHEME+':'){
  // uz.atlasmarket.app://auth?code=… parses with host "auth"; uz.atlasmarket.app:///auth with pathname "/auth".
  const target=(url.host||url.pathname).replace(/^\/+|\/+$/g,'').toLowerCase();
  return target==='auth'?auth(url.searchParams):null;
 }
 if(url.protocol!=='https:'||!siteHosts.has(url.hostname.toLowerCase()))return null;
 if(url.pathname==='/auth/return')return auth(url.searchParams);
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/_next/'))return null;
 return {kind:'path',path:url.pathname+url.search+url.hash};
}

/** True for links that leave the site (another host, or a non-page scheme the system should handle). */
export function isExternalHref(href:string,currentHost:string):boolean{
 let url:URL;
 try{url=new URL(href)}catch{return false}
 if(url.protocol!=='http:'&&url.protocol!=='https:')return false;
 return url.host.toLowerCase()!==currentHost.toLowerCase();
}
