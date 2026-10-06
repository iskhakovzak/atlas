'use client';
import {Suspense,lazy,useCallback,useSyncExternalStore,type ComponentType} from 'react';
import {homeWideMedia} from '@/lib/market/home-wide';

// Slots for the home page's wide-screen parts (lib/market/home-wide.ts): the chapter rail from 1680px and the decor from
// 1440 x 820 are separate chunks, imported only once their media query matches, so phones and laptops never load them.
// Both render nothing on the server and in the first client render (no hydration mismatch); when the query stops
// matching the slot renders null and the part removes everything it added in its own cleanup.

/** Whether a media query matches; false on the server and during hydration. */
export function useMedia(query:string){
 const subscribe=useCallback((onChange:()=>void)=>{
  const list=window.matchMedia(query);
  list.addEventListener('change',onChange);
  return ()=>list.removeEventListener('change',onChange);
 },[query]);
 return useSyncExternalStore(subscribe,()=>window.matchMedia(query).matches,()=>false);
}

// A chunk that fails to load renders nothing: the page stays as on a laptop (the old next-chapter cue stays too).
const Nothing:ComponentType=()=>null;
const lazyPart=(load:()=>Promise<ComponentType>)=>lazy(()=>load().then(Part=>({default:Part}),()=>({default:Nothing})));
const HomeRail=lazyPart(()=>import('./home-rail').then(module=>module.HomeRail));
const HomeDecor=lazyPart(()=>import('./home-decor').then(module=>module.HomeDecor));

/** The chapter rail (app/home-rail.tsx), right after the header so Tab goes header → rail → main. */
export function HomeRailSlot(){
 return useMedia(homeWideMedia.rail)?<Suspense fallback={null}><HomeRail/></Suspense>:null;
}

/** The decor behind the sheets (app/home-decor.tsx), the last child of main.catalog-home. */
export function HomeDecorSlot(){
 return useMedia(homeWideMedia.wide)?<Suspense fallback={null}><HomeDecor/></Suspense>:null;
}
