'use client';

import { useEffect } from 'react';
import {
  parsePerformanceSamples,
  performancePercentile,
  performanceRoute,
  performanceStorageKey,
  performanceUpdateEvent,
  upsertPerformanceSample,
  type PerformanceSample,
} from '@/lib/market/performance';

type TimedEntry = PerformanceEntry & {
  value?: number;
  hadRecentInput?: boolean;
  interactionId?: number;
};

export function PerformanceProbe() {
  useEffect(() => {
    let current: PerformanceSample = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      capturedAt: Date.now(),
      route: performanceRoute(window.location.pathname),
      apiCount: 0,
      apiSlowCount: 0,
      apiTotalMs: 0,
      apiMaxMs: 0,
    };
    let cls = 0;
    const apiEntries = new Set<string>();
    const interactions = new Map<number, number>();
    const observers: PerformanceObserver[] = [];

    const persist = () => {
      try {
        const samples = parsePerformanceSamples(window.localStorage.getItem(performanceStorageKey));
        const next = upsertPerformanceSample(samples, current);
        window.localStorage.setItem(performanceStorageKey, JSON.stringify(next));
        window.dispatchEvent(new Event(performanceUpdateEvent));
      } catch {
        // Private browsing or storage policy can disable local diagnostics; the app remains unaffected.
      }
    };

    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (navigation && navigation.responseStart >= navigation.requestStart) {
        current = {...current, ttfbMs: navigation.responseStart - navigation.requestStart};
      }
      const fcp = performance.getEntriesByName('first-contentful-paint').at(-1);
      if (fcp) current = {...current, fcpMs: fcp.startTime};
    } catch {
      // Performance APIs are optional and vary across browsers.
    }

    const observe = (type: string, callback: (entries: PerformanceEntry[]) => void, durationThreshold?: number) => {
      try {
        const observer = new PerformanceObserver((list) => callback(list.getEntries()));
        observer.observe({type, buffered: true, ...(durationThreshold ? {durationThreshold} : {})} as PerformanceObserverInit);
        observers.push(observer);
      } catch {
        // Unsupported entry type: this metric is simply absent from the local summary.
      }
    };

    observe('largest-contentful-paint', (entries) => {
      const latest = entries.at(-1);
      if (latest) {
        current = {...current, lcpMs: latest.startTime};
        persist();
      }
    });
    observe('layout-shift', (entries) => {
      for (const entry of entries as TimedEntry[]) if (!entry.hadRecentInput) cls += entry.value ?? 0;
      current = {...current, cls};
      persist();
    });
    observe('event', (entries) => {
      for (const entry of entries as TimedEntry[]) {
        if (entry.interactionId && entry.duration > 0) {
          interactions.set(entry.interactionId, Math.max(interactions.get(entry.interactionId) ?? 0, entry.duration));
        }
      }
      const inpMs = performancePercentile([...interactions.values()], 0.98);
      if (inpMs !== undefined) {
        current = {...current, inpMs};
        persist();
      }
    }, 40);
    observe('resource', (entries) => {
      for (const entry of entries) {
        try {
          const url = new URL(entry.name, window.location.href);
          const key = `${url.pathname}:${entry.startTime}`;
          if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/') || apiEntries.has(key)) continue;
          apiEntries.add(key);
          const duration = Math.max(0, entry.duration);
          current = {
            ...current,
            apiCount: (current.apiCount ?? 0) + 1,
            apiSlowCount: (current.apiSlowCount ?? 0) + (duration >= 1000 ? 1 : 0),
            apiTotalMs: (current.apiTotalMs ?? 0) + duration,
            apiMaxMs: Math.max(current.apiMaxMs ?? 0, duration),
          };
          persist();
        } catch {
          // Ignore malformed resource entries.
        }
      }
    });

    persist();
    const onPageHide = () => {
      persist();
      observers.forEach((observer) => observer.disconnect());
    };
    window.addEventListener('pagehide', onPageHide, {once: true});
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  return null;
}
