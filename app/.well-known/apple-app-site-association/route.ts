import {env} from 'cloudflare:workers';
import {appleSiteAssociation} from '@/lib/native/well-known';

// Apple reads https://atlasmarket.uz/.well-known/apple-app-site-association (no extension, JSON body)
// to open universal links in the iOS app and to share passkeys/passwords with it. Served only once
// the owner has set the Team ID and the bundle ID, so an unconfigured site answers 404 like before.
export async function GET(){
 const teamId=env.APPLE_TEAM_ID?.trim(),bundleId=env.APPLE_APP_BUNDLE_ID?.trim();
 if(!teamId||!bundleId)return new Response('App association is not configured.',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 return new Response(JSON.stringify(appleSiteAssociation(teamId,bundleId)),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=3600'}});
}
