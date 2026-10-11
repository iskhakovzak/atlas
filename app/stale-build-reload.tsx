'use client';

import { useEffect } from 'react';
import { reloadForStaleBuild } from '@/lib/market/stale-build';

// The lazy parts use loadChunk themselves; this catches the rest: a script part of an older build that nobody
// handled (a client component from a page payload, a part React failed to render). See lib/market/stale-build.ts.
export function StaleBuildReload() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => { reloadForStaleBuild(event.error ?? event.message); };
    const onRejection = (event: PromiseRejectionEvent) => { if (reloadForStaleBuild(event.reason)) event.preventDefault(); };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
