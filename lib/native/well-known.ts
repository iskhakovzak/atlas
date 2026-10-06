// Builders for the two app-association files the site serves from /.well-known/ (app/.well-known/*).
// Pure: the routes only add the environment values and the response headers.
import {APP_LINK_PATHS} from './links.ts';

/** Apple App Site Association: universal links and shared web credentials for the iOS app. */
export function appleSiteAssociation(teamId:string,bundleId:string){
 const appID=`${teamId.trim()}.${bundleId.trim()}`;
 // "/auth/return*" also matches "/auth/return?code=…"; "/app" is the store page and has no children.
 const paths=APP_LINK_PATHS.map(path=>path==='/app'?path:path+'*');
 return {applinks:{apps:[],details:[{appID,paths}]},webcredentials:{apps:[appID]}};
}

const fingerprintShape=/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
/** Normalizes "ab:cd:…" / "ABCD…" fingerprints (comma- or whitespace-separated) and drops malformed ones. */
export function certFingerprints(value:string|readonly string[]):string[]{
 const parts=Array.isArray(value)?value:String(value).split(/[,\s]+/);
 const seen=new Set<string>();
 for(const part of parts as string[]){
  const hex=part.replace(/[^0-9a-fA-F]/g,'').toUpperCase();
  if(hex.length!==64)continue;
  const fingerprint=hex.match(/.{2}/g)!.join(':');
  if(fingerprintShape.test(fingerprint))seen.add(fingerprint);
 }
 return [...seen];
}

/** Digital Asset Links: lets Android open https://atlasmarket.uz links in the app. */
export function androidAssetLinks(packageName:string,fingerprints:string|readonly string[]){
 return [{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:packageName.trim(),sha256_cert_fingerprints:certFingerprints(fingerprints)}}];
}
