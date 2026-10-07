/**
 * Store requests normally leave through the US egress proxy so prices and
 * availability are the US storefront's. Some platforms (Shopify in particular)
 * rate-limit that single datacenter address for every store they host and
 * answer "429 Too many requests" before the product is read. A direct request
 * from the Worker is the same public, credential-free call the importer makes
 * when no proxy is configured at all; the response is marked so the import can
 * warn that the price may be regional.
 */
export type EgressFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

/** Hosts whose answers depend on a US location; a direct retry would quietly change what the customer is quoted. */
const locationBound = /(^|\.)(amazon\.com|target\.com|walmart\.com|bestbuy\.com)$/i;

export function directRetryAllowed(input: string | URL, response: Response | undefined, failure?: unknown) {
  let host = '';
  try { host = new URL(input instanceof URL ? input.href : String(input)).hostname.toLowerCase().replace(/^www\./, ''); } catch { return false; }
  if (!host || locationBound.test(host)) return false;
  if (response) return response.status === 429;
  // The proxy itself refused or is saturated (its own 429/503) — the store was never asked.
  return failure instanceof Error && /\((429|503)\)/.test(failure.message);
}

export function markDirectEgress(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('x-atlas-egress', 'direct');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** Proxy first; one direct retry when the proxy path is rate-limited for a store that does not price by location. */
export function withDirectFallback(proxied: EgressFetch, direct: EgressFetch): EgressFetch {
  return async (input, init) => {
    let response: Response | undefined;
    try {
      response = await proxied(input, init);
    } catch (error) {
      if (init?.signal?.aborted || !directRetryAllowed(input, undefined, error)) throw error;
      return markDirectEgress(await direct(input, init));
    }
    if (!directRetryAllowed(input, response)) return response;
    await response.body?.cancel();
    return markDirectEgress(await direct(input, init));
  };
}
