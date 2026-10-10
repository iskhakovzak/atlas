import {validateManualSourceUrl} from './fetch.ts';
import {isSupportedStoreHost} from './stores.ts';

/** Store short links shared from apps and messengers. A fixed list: no other host is ever followed. */
export const shortLinkHosts: ReadonlySet<string> = new Set(['a.co', 'amzn.to', 'amzn.eu', 'amzn.asia', 'ebay.us']);

export function isShortLink(url: URL) {
  return shortLinkHosts.has(url.hostname.toLowerCase());
}

/** m.<store> (a phone's share link) reads as www.<store> when that is a supported storefront. */
export function desktopStoreUrl(url: URL) {
  const host = url.hostname.toLowerCase();
  if (!host.startsWith('m.')) return url;
  const desktop = 'www.' + host.slice(2);
  if (!isSupportedStoreHost(desktop)) return url;
  const next = new URL(url.href);
  next.hostname = desktop;
  return next;
}

type ShortLinkFetch = (input: string, init: RequestInit) => Promise<Response>;

/**
 * The store page behind a short link: up to `maxHops` redirects read with redirect:'manual' (the page itself is never
 * downloaded), within `timeoutMs` in all. Every hop must be a public HTTPS URL; the result must be a supported store
 * that is not itself a short link. Anything else (no Location, a timeout, a page outside the allowlist) returns the
 * link as it was, so the import goes on exactly as before.
 */
export async function expandShortLink(url: URL, fetcher: ShortLinkFetch = fetch, {maxHops = 3, timeoutMs = 3_000}: {maxHops?: number; timeoutMs?: number} = {}): Promise<URL> {
  if (!isShortLink(url)) return url;
  const signal = AbortSignal.timeout(timeoutMs);
  let current = url;
  try {
    for (let hop = 0; hop < maxHops; hop++) {
      const response = await fetcher(current.href, {method: 'GET', redirect: 'manual', signal, headers: {accept: 'text/html'}});
      await response.body?.cancel().catch(() => undefined);
      const location = response.headers.get('location');
      if (response.status < 300 || response.status > 399 || !location) return url;
      const next = desktopStoreUrl(validateManualSourceUrl(new URL(location, current).href));
      if (!isShortLink(next)) return isSupportedStoreHost(next.hostname) ? next : url;
      current = next;
    }
  } catch {
    // A timeout, a refused hop or a malformed Location: the original link is imported as before.
  }
  return url;
}
