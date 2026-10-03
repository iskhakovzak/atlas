'use client';

import { useEffect } from 'react';
import { parsePerformanceSamples, performancePercentile, performanceRoute, performanceStorageKey, performanceUpdateEvent, telemetryPath, upsertPerformanceSample, type PerformanceSample } from '@/lib/market/performance';

type TimedEntry = PerformanceEntry & { value?: number; hadRecentInput?: boolean; interactionId?: number };
type ReportedError = { kind: 'error' | 'rejection'; message: string; source?: string; line?: number };

// Besides the local summary for the operator's own browser, each page view sends one anonymous
// beacon to /api/telemetry: page speed when the page is hidden, and up to five script errors.
// It carries the path and device class only; the server keeps fixed route names and scrubs messages.
export function PerformanceProbe() {
  useEffect(() => {
    let current: PerformanceSample = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      capturedAt: Date.now(), route: performanceRoute(window.location.pathname), apiCount: 0, apiSlowCount: 0, apiTotalMs: 0, apiMaxMs: 0,
    };
    const path = window.location.pathname;
    const device = window.matchMedia('(max-width: 760px)').matches ? 'mobile' : 'desktop';
    const pending: ReportedError[] = [];
    let reported = 0, vitalsSent = false, flushTimer: number | undefined;
    const send = (withVitals: boolean) => {
      const vitals = withVitals && !vitalsSent;
      if (!pending.length && !vitals) return;
      if (vitals) vitalsSent = true;
      const body = JSON.stringify({
        route: path, errors: pending.splice(0),
        ...(vitals ? { vitals: { device, ttfbMs: current.ttfbMs, fcpMs: current.fcpMs, lcpMs: current.lcpMs, inpMs: current.inpMs, cls: current.cls, apiSlow: current.apiSlowCount } } : {}),
      });
      try { if (!navigator.sendBeacon?.(telemetryPath, body)) void fetch(telemetryPath, { method: 'POST', body, keepalive: true }).catch(() => undefined); } catch { /* Monitoring is optional. */ }
    };
    const report = (error: ReportedError) => {
      if (reported >= 5 || !error.message.trim()) return;
      reported++;
      pending.push(error);
      window.clearTimeout(flushTimer);
      flushTimer = window.setTimeout(() => send(false), 2000);
    };
    const onError = (event: ErrorEvent) => report({ kind: 'error', message: (event.message || String(event.error ?? '')).slice(0, 500), ...(event.filename ? { source: event.filename.split(/[?#]/)[0].slice(0, 300) } : {}), ...(event.lineno ? { line: event.lineno } : {}) });
    const onRejection = (event: PromiseRejectionEvent) => report({ kind: 'rejection', message: (event.reason instanceof Error ? `${event.reason.name}: ${event.reason.message}` : String(event.reason ?? '')).slice(0, 500) });
    const onHidden = () => { if (document.visibilityState === 'hidden') send(true); };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    document.addEventListener('visibilitychange', onHidden);
    let cls = 0;
    const apiEntries = new Set<string>();
    const interactions = new Map<number, number>();
    const observers: PerformanceObserver[] = [];
    const persist = () => {
      try {
        const next = upsertPerformanceSample(parsePerformanceSamples(window.localStorage.getItem(performanceStorageKey)), current);
        window.localStorage.setItem(performanceStorageKey, JSON.stringify(next));
        window.dispatchEvent(new Event(performanceUpdateEvent));
      } catch { /* Browser storage can be disabled; diagnostics stay optional. */ }
    };
    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (navigation && navigation.responseStart >= navigation.requestStart) current = {...current, ttfbMs: navigation.responseStart - navigation.requestStart};
      const fcp = performance.getEntriesByName('first-contentful-paint').at(-1);
      if (fcp) current = {...current, fcpMs: fcp.startTime};
    } catch { /* Optional browser performance APIs. */ }
    const observe = (type: string, callback: (entries: PerformanceEntry[]) => void, durationThreshold?: number) => {
      try {
        const observer = new PerformanceObserver((list) => callback(list.getEntries()));
        observer.observe({type, buffered: true, ...(durationThreshold ? {durationThreshold} : {})} as PerformanceObserverInit);
        observers.push(observer);
      } catch { /* Unsupported metric: omit it from this local summary. */ }
    };
    observe('largest-contentful-paint', (entries) => {
      const latest = entries.at(-1);
      if (latest) { current = {...current, lcpMs: latest.startTime}; persist(); }
    });
    observe('layout-shift', (entries) => {
      for (const entry of entries as TimedEntry[]) if (!entry.hadRecentInput) cls += entry.value ?? 0;
      current = {...current, cls}; persist();
    });
    observe('event', (entries) => {
      for (const entry of entries as TimedEntry[]) if (entry.interactionId && entry.duration > 0) interactions.set(entry.interactionId, Math.max(interactions.get(entry.interactionId) ?? 0, entry.duration));
      const inpMs = performancePercentile([...interactions.values()], 0.98);
      if (inpMs !== undefined) { current = {...current, inpMs}; persist(); }
    }, 40);
    observe('resource', (entries) => {
      for (const entry of entries) {
        try {
          const url = new URL(entry.name, window.location.href);
          const key = `${url.pathname}:${entry.startTime}`;
          if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/') || apiEntries.has(key)) continue;
          apiEntries.add(key);
          const duration = Math.max(0, entry.duration);
          current = {...current, apiCount: (current.apiCount ?? 0) + 1, apiSlowCount: (current.apiSlowCount ?? 0) + (duration >= 1000 ? 1 : 0), apiTotalMs: (current.apiTotalMs ?? 0) + duration, apiMaxMs: Math.max(current.apiMaxMs ?? 0, duration)};
          persist();
        } catch { /* Ignore malformed browser resource entries. */ }
      }
    });
    persist();
    const onPageHide = () => { persist(); send(true); observers.forEach((observer) => observer.disconnect()); };
    window.addEventListener('pagehide', onPageHide, {once: true});
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      document.removeEventListener('visibilitychange', onHidden);
      window.clearTimeout(flushTimer);
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);
  return null;
}
