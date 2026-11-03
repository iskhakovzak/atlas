import {database} from '@/lib/market/server';
import {mergeSiteContent,parseStoredSiteContent,siteContentStorageKey} from '@/lib/market/site-content-schema';
import {securityTxt} from '@/lib/seo/security-txt';

// https://atlasmarket.uz/.well-known/security.txt — the contact for security reports (lib/seo/security-txt.ts).
// The site content row is read per request; without a database the code defaults (no contacts) apply.
export async function GET(request:Request){
 let stored:string|null=null;
 try{stored=(await database().prepare('SELECT value FROM market_settings WHERE key=?').bind(siteContentStorageKey).first<{value:string}>())?.value??null}
 catch(error){console.error('security.txt: site content unavailable',String(error).slice(0,200))}
 const {contacts}=mergeSiteContent(parseStoredSiteContent(stored));
 return new Response(securityTxt({origin:new URL(request.url).origin,contacts,now:Date.now()}),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
