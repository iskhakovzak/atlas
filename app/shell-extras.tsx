'use client';
import {useSyncExternalStore} from 'react';
import {listenEarlyErrors} from '@/lib/market/early-errors';

// The consent sheet (StorageNotice), the speed and error beacon (PerformanceProbe) and Impact (ImpactTracking) render
// nothing until their own effects have run, so they come as one chunk requested right after hydration instead of
// before it (14.10.2026): five fewer requests on the first screen's critical path. The probe's speed metrics are
// observed with `buffered: true`, and script errors from before it mounts are kept by lib/market/early-errors.ts, so
// none are lost. PressFeedback, StaleBuildReload and NativeShell stay in the layout itself: the first touch, a stale
// chunk and the app shell need them from the start.
// A chunk that fails to arrive leaves this spot empty, as it was while loading: no error screen and no page reload
// without the visitor asking for one. It is not requested again: Chrome remembers a module that failed to load until the
// page itself is reloaded (Chrome 155, net::ERR_INTERNET_DISCONNECTED), so the parts come with the next full page load.
type Parts=typeof import('./shell-extras-parts');
let parts:Parts|null=null,requested=false;
const listeners=new Set<()=>void>();
listenEarlyErrors();

function load(){
  if(requested)return;
  requested=true;
  import('./shell-extras-parts').then(module=>{
    parts=module;
    listeners.forEach(notify=>notify());
  },()=>{});
}

// Subscribing happens after hydration (the server and the hydration render draw nothing here): the chunk is requested then.
const subscribe=(notify:()=>void)=>{listeners.add(notify);load();return()=>{listeners.delete(notify);};};

export function ShellExtras(){
  const loaded=useSyncExternalStore(subscribe,()=>parts,()=>null);
  return loaded?<loaded.ShellExtrasParts/>:null;
}
