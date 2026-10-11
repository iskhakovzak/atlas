// A deploy replaces the hashed files under /_next/static and the old ones answer 404. A tab opened before the deploy
// still runs the old code, so the first part it loads lazily (the product sheet, the notifications, the home teaser)
// fails to arrive. One reload brings the page and its parts from the new build; the guard keeps a server that is
// really down from reloading the page in a loop.

/** Browser messages for a script part that failed to arrive: Chrome, Firefox, Safari, then Vite's own preload. */
const staleChunkPatterns=[/failed to fetch dynamically imported module/i,/error loading dynamically imported module/i,/importing a module script failed/i,/unable to preload css/i];
export const staleBuildStorageKey='atlas.staleBuildReloadAt';
/** A second failure within this time after a reload is a real outage, not an old tab: the error stays visible. */
export const staleBuildReloadPauseMs=60_000;

export function isStaleChunkError(reason:unknown):boolean{
  const message=reason instanceof Error?reason.message:typeof reason==='string'?reason:'';
  return staleChunkPatterns.some(pattern=>pattern.test(message));
}

export function staleBuildReloadAllowed(lastReloadAt:string|null,now:number):boolean{
  const last=Number(lastReloadAt);
  return !lastReloadAt||!Number.isFinite(last)||now-last>=staleBuildReloadPauseMs||now<last;
}

/** Reloads the page once when a script part of an older build is missing. True when the reload has started. */
export function reloadForStaleBuild(reason:unknown):boolean{
  if(typeof window==='undefined'||!isStaleChunkError(reason))return false;
  const now=Date.now();
  try{
    if(!staleBuildReloadAllowed(window.sessionStorage.getItem(staleBuildStorageKey),now))return false;
    window.sessionStorage.setItem(staleBuildStorageKey,String(now));
  }catch{return false;/* Without storage the loop guard cannot hold, so the error stays visible instead. */}
  window.location.reload();
  return true;
}

/** For lazy parts: a missing part of an older build reloads the page and keeps the Suspense fallback meanwhile;
 *  any other failure reaches the caller as before. */
export function loadChunk<T>(load:()=>Promise<T>):Promise<T>{
  return load().catch((error:unknown)=>reloadForStaleBuild(error)?new Promise<T>(()=>{}):Promise.reject(error));
}
