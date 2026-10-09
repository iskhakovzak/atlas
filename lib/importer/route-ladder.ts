import {isMerchantChallengePage} from './challenge.ts';
import type {EgressFetch} from './egress.ts';

export type MerchantRoute = {
  name: 'tashkent' | 'us-vps' | 'residential';
  fetch: EgressFetch;
  /** This route's turn for one request before the next route is asked; the default applies otherwise. */
  attemptMs?: (target: URL) => number | undefined;
};

/** Only configured server-owned routes; each attempt shares the caller's deadline. */
export function withMerchantRoutes(routes: MerchantRoute[], attemptMs = 3_000): EgressFetch {
  return async (input, init) => {
    let failure: unknown;
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      if (init?.signal?.aborted) throw init.signal.reason;
      try {
        const attempt = i < routes.length - 1 ? AbortSignal.timeout(route.attemptMs?.(new URL(String(input))) ?? attemptMs) : undefined;
        const signal = attempt ? (init?.signal ? AbortSignal.any([init.signal, attempt]) : attempt) : init?.signal;
        const response = await route.fetch(input, {...init, signal});
        let retry = [403, 408, 429, 500, 502, 503, 504].includes(response.status);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          try { retry = /^\/(?:blocked|captcha|challenge)\b/i.test(new URL(response.headers.get('location') ?? '', String(input)).pathname); } catch { /* Let the importer reject invalid redirects. */ }
        }
        if (response.ok && /text\/html/i.test(response.headers.get('content-type') ?? '')) {
          // Inspect a bounded prefix; never consume or copy the full merchant body.
          const clone = response.clone();
          const reader = clone.body?.getReader();
          if (reader) {
            const decoder = new TextDecoder();
            let head = '';
            try {
              while (head.length < 120_000) {
                const part = await reader.read();
                if (part.done) break;
                head += decoder.decode(part.value.subarray(0, 120_000 - head.length), {stream: true});
              }
              retry = isMerchantChallengePage(head);
            } finally { void reader.cancel().catch(() => {}); }
          }
        }
        if (retry && i < routes.length - 1) { await response.body?.cancel(); continue; }
        const headers = new Headers(response.headers);
        headers.set('x-atlas-route', route.name);
        if (route.name === 'tashkent') headers.set('x-atlas-egress', 'direct');
        return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
      } catch (error) {
        if (init?.signal?.aborted) throw error;
        if (error instanceof Error && /proxy rejected the request \((?:400|401|403)\)/i.test(error.message)) throw error;
        failure = error;
      }
    }
    throw failure ?? new Error('No merchant route is configured.');
  };
}
