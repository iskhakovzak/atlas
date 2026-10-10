import {ManualEntryFallbackError} from './fetch.ts';
import type {Extracted} from './extract.ts';

export type ImportOutcome = {ok: true; data: Extracted} | {ok: false; error: unknown};

/** Store answers worth repeating for a short while: a wall or a page without the product data. */
const negativeReasons = new Set(['blocked', 'incomplete']);

/**
 * Per-isolate bookkeeping for /api/import, keyed by the canonical product URL.
 * - In flight: a second request for a URL that is being fetched waits for that answer instead of asking the store
 *   again. It waits at most until the first request is `followerWaitMs` old (a Worker may cancel the first request
 *   with its client), then fetches itself and is the one later requests wait for. Only a store answer is shared (the product, or a ManualEntryFallbackError); a timeout or a network error
 *   of the first request is not, the follower then asks on its own.
 * - Negative: a store that answered with a wall or an incomplete page is not asked again for `negativeTtlMs`.
 * Nothing here is shared between isolates or persisted; D1 keeps the positive cache.
 */
export function createImportFlights({followerWaitMs = 26_000, negativeTtlMs = 90_000, maxNegative = 500, maxInFlight = 200, clock = Date.now}: {followerWaitMs?: number; negativeTtlMs?: number; maxNegative?: number; maxInFlight?: number; clock?: () => number} = {}) {
  // `started` lets a request tell a live fetch from one whose Worker request was cancelled (its promise never settles
  // and its `finally` never runs): an entry older than followerWaitMs is not waited for, and is replaced.
  const inFlight = new Map<string, {promise: Promise<ImportOutcome>; started: number}>();
  const negative = new Map<string, {until: number; error: ManualEntryFallbackError}>();
  const remember = (key: string, outcome: ImportOutcome) => {
    if (outcome.ok || !(outcome.error instanceof ManualEntryFallbackError) || !negativeReasons.has(outcome.error.reason ?? '')) return;
    if (negative.size >= maxNegative) {
      const now = clock();
      for (const [stored, entry] of negative) if (entry.until <= now) negative.delete(stored);
      while (negative.size >= maxNegative) negative.delete(negative.keys().next().value!);
    }
    negative.set(key, {until: clock() + negativeTtlMs, error: outcome.error});
  };
  const settle = (load: () => Promise<Extracted>) => load().then((data): ImportOutcome => ({ok: true, data}), (error): ImportOutcome => ({ok: false, error}));
  /** This request asks the store itself; later requests for the key wait for it. */
  const lead = async (key: string, load: () => Promise<Extracted>) => {
    if (inFlight.size >= maxInFlight) {
      const now = clock();
      for (const [stored, entry] of inFlight) if (now - entry.started >= followerWaitMs) inFlight.delete(stored);
    }
    const entry = {promise: settle(load), started: clock()};
    inFlight.set(key, entry);
    try {
      const outcome = await entry.promise;
      remember(key, outcome);
      return {outcome, leader: true};
    } finally {
      if (inFlight.get(key) === entry) inFlight.delete(key);
    }
  };
  return {
    /** The recent wall or incomplete answer for this URL, if it is younger than negativeTtlMs. */
    recentFailure(key: string) {
      const entry = negative.get(key);
      if (!entry) return undefined;
      if (entry.until > clock()) return entry.error;
      negative.delete(key);
      return undefined;
    },
    /** `leader` is true when this call asked the store itself (and so should write the D1 cache). */
    async run(key: string, load: () => Promise<Extracted>): Promise<{outcome: ImportOutcome; leader: boolean}> {
      const running = inFlight.get(key);
      const waitMs = running ? followerWaitMs - (clock() - running.started) : 0;
      if (running && waitMs > 0) {
        let timer: number | undefined;
        const waited = await Promise.race([running.promise, new Promise<undefined>(resolve => { timer = setTimeout(resolve, waitMs) as unknown as number; })]);
        clearTimeout(timer);
        if (waited && (waited.ok || waited.error instanceof ManualEntryFallbackError && !['timeout', 'network'].includes(waited.error.reason))) return {outcome: waited, leader: false};
      }
      return lead(key, load);
    },
    /** For tests and diagnostics. */
    size: () => ({inFlight: inFlight.size, negative: negative.size}),
  };
}
