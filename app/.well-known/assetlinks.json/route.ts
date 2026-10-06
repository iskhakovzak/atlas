import {env} from 'cloudflare:workers';
import {androidAssetLinks} from '@/lib/native/well-known';

// Digital Asset Links: Android verifies https://atlasmarket.uz/.well-known/assetlinks.json before it
// opens site links in the app (android:autoVerify in mobile/android/app/src/main/AndroidManifest.xml).
// ANDROID_CERT_SHA256 holds the signing certificates' SHA-256 fingerprints, comma-separated
// (upload key and Play App Signing key); the file is served only when both values are set.
export async function GET(){
 const packageName=env.ANDROID_PACKAGE_NAME?.trim(),fingerprints=env.ANDROID_CERT_SHA256?.trim();
 const body=packageName&&fingerprints?androidAssetLinks(packageName,fingerprints):null;
 if(!body||!body[0].target.sha256_cert_fingerprints.length)return new Response('Asset links are not configured.',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 return new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=3600'}});
}
