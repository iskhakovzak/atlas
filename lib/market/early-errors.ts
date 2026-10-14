// Script errors for the anonymous speed beacon (app/performance-probe.tsx, /api/telemetry).
// Since 14.10.2026 the beacon arrives in a chunk loaded after hydration (app/shell-extras.tsx), so the layout starts
// listening as soon as its code runs and hands what it caught to the beacon when that mounts. Same five-error cap.

export type ReportedError = { kind: 'error' | 'rejection'; message: string; source?: string; line?: number };

/** At most this many errors per page view reach the beacon. */
export const reportedErrorLimit = 5;

export function errorFromEvent(event: ErrorEvent): ReportedError {
  return { kind: 'error', message: (event.message || String(event.error ?? '')).slice(0, 500), ...(event.filename ? { source: event.filename.split(/[?#]/)[0].slice(0, 300) } : {}), ...(event.lineno ? { line: event.lineno } : {}) };
}

export function errorFromRejection(event: PromiseRejectionEvent): ReportedError {
  return { kind: 'rejection', message: (event.reason instanceof Error ? `${event.reason.name}: ${event.reason.message}` : String(event.reason ?? '')).slice(0, 500) };
}

let early: ReportedError[] = [];
let stopEarly: (() => void) | null = null;

/** Starts collecting errors before the beacon is mounted (browser only, once). */
export function listenEarlyErrors(): void {
  if (stopEarly || typeof window === 'undefined') return;
  const keep = (error: ReportedError) => { if (early.length < reportedErrorLimit && error.message.trim()) early.push(error); };
  const onError = (event: ErrorEvent) => keep(errorFromEvent(event));
  const onRejection = (event: PromiseRejectionEvent) => keep(errorFromRejection(event));
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  stopEarly = () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

/** The beacon listens from here on: stops the early listener and returns what it caught. */
export function takeEarlyErrors(): ReportedError[] {
  stopEarly?.();
  stopEarly = () => {};
  const caught = early;
  early = [];
  return caught;
}
