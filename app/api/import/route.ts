import { z } from 'zod';
import { fetchProduct, isAmazonUsUrl, ManualEntryFallbackError, UnsupportedStoreError, validateManualSourceUrl } from '@/lib/importer/fetch';
import { isBrowserStoreHost, isManualEntryStoreHost, isSupportedStoreHost } from '@/lib/importer/stores';
import { merchantRequest } from '@/lib/importer/worker-fetch';
import { canonicalProductUrl } from '@/lib/importer/source-identity';
import { desktopStoreUrl, expandShortLink, isShortLink } from '@/lib/importer/short-links';
import { createImportFlights, freshRetryGapMs } from '@/lib/importer/import-flight';
import { database, sameOrigin, json, failure, HttpError, requestJson } from '@/lib/market/server';
import { currentUser } from '@/lib/auth/server';
import { importRateBuckets } from '@/lib/market/import-preview';
import { apiErrorMessage, importManualEntryMessage, importManualStoreMessage, importPendingMessage, requestLocale, serverError } from '@/lib/market/i18n';

const importRequestSchema = z.object({ url: z.string().max(3000), fresh: z.boolean().optional() });

// One isolate's in-flight imports and recent walls (lib/importer/import-flight.ts); D1 keeps the positive cache.
const flights = createImportFlights();
// Rate-limit keys carry their minute, so expired rows never count: they are cleared on about one request in 50
// (by chance, not by a per-isolate counter: a short-lived isolate may never reach its 50th request).

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await currentUser();
    const payload = importRequestSchema.safeParse(await requestJson(request, 5000));
    if (!payload.success || !payload.data.url) throw new HttpError(400, 'err_19');

    // One spelling per page (lib/importer/source-identity.ts): the cache key, the in-flight key and the URL fetched.
    let sourceUrl: string;
    try {
      sourceUrl = canonicalProductUrl(desktopStoreUrl(validateManualSourceUrl(payload.data.url)).href);
    } catch (error) {
      throw new HttpError(400, (error as Error).message);
    }
    const now = Date.now();
    const db = database();
    const fresh = Boolean(payload.data.fresh);
    const locale = requestLocale(request);

    const failed = (error: unknown) => {
      // Walmart through Bright Data: the collection is still running. The client asks again after retryAfterMs;
      // the same snapshot is polled, never collected (and paid for) twice.
      if (error instanceof ManualEntryFallbackError && error.reason === 'pending') {
        return json({ sourceUrl, pending: true, retryAfterMs: error.retryAfterMs ?? 4000, message: locale === 'ru' ? error.message : importPendingMessage(locale) }, 202);
      }
      const canManuallyEnter = error instanceof ManualEntryFallbackError || error instanceof Error && error.name === 'AbortError';
      // A store only the Tashkent gateway's Chrome reads, and the gateway did not answer (the computer is off, the page
      // timed out): the customer enters the details by hand, the same way as for a store Atlas never reads.
      const host = new URL(sourceUrl).hostname;
      if (canManuallyEnter && isBrowserStoreHost(host)) {
        const partial = error instanceof ManualEntryFallbackError ? error.partial : undefined;
        return json({ ...partial, sourceUrl, brand: partial?.brand ?? host.replace(/^(?:www2?|shop|api)\./, ''), warnings: partial?.warnings ?? [], error: importManualStoreMessage(locale), manualEntryAvailable: true, manualStore: true }, 422);
      }
      // A link outside the store list is answered in the customer's language, with the number of supported stores.
      const unsupported = error instanceof UnsupportedStoreError ? error : undefined;
      const message = canManuallyEnter
        ? importManualEntryMessage(locale)
        : unsupported ? serverError(locale, unsupported.code, { count: unsupported.supportedStoreCount })
        : locale === 'ru' ? (error as Error).message : apiErrorMessage(422, locale);
      const partial = error instanceof ManualEntryFallbackError ? error.partial : undefined;
      return json({ ...partial, error: message, ...(unsupported ? { errorCode: unsupported.code } : {}), manualEntryAvailable: canManuallyEnter }, 422);
    };

    // Answers that ask no store, so they are given before the rate limit: a wall or an incomplete page from the last
    // 90 s — with fresh (the link opened to order, or "Retry automatic import") only from the last 15 s, so a one-off
    // wall does not answer the customer's retry, yet the store gets at most one live attempt per 15 s for the link —
    // and the stored import unless fresh is asked. Amazon US prices depend on the delivery location and are never cached.
    const known = async () => {
      const host = new URL(sourceUrl).hostname;
      if (!isSupportedStoreHost(host) || isManualEntryStoreHost(host)) return undefined;
      const wall = flights.recentFailure(sourceUrl, fresh ? freshRetryGapMs : undefined);
      if (wall) return failed(wall);
      if (fresh || isAmazonUsUrl(new URL(sourceUrl))) return undefined;
      const cached = await db.prepare('SELECT payload,expires_at,updated_at FROM market_import_cache WHERE url=? AND expires_at>?')
        .bind(sourceUrl, Date.now()).first<{ payload: string; expires_at: number; updated_at: number }>();
      if (!cached) return undefined;
      try {
        return json({ ...JSON.parse(cached.payload), fetchedAt: cached.updated_at, expiresAt: cached.expires_at, cached: true });
      } catch {
        // Ignore malformed cache entries and fetch a fresh merchant response.
        return undefined;
      }
    };
    // A short link is not a page yet: it is expanded (a request) only after the rate limit is charged.
    const short = isShortLink(new URL(sourceUrl));
    if (!short) {
      const answer = await known();
      if (answer) return answer;
    }

    for (const bucket of await importRateBuckets(user?.userId, request.headers.get('cf-connecting-ip'), now)) {
      const row = await db.prepare('INSERT INTO market_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count')
        .bind(bucket.key, now + 120000).first<{ count: number }>();
      if (!row || row.count > bucket.limit) throw new HttpError(429, 'err_20');
    }
    if (Math.random() < 0.02) await db.prepare('DELETE FROM market_rate_limits WHERE expires_at < ?').bind(now).run();

    if (short) {
      // a.co, amzn.to, amzn.eu, amzn.asia, ebay.us: at most 3 redirects in about 3 s, and the result must be a
      // supported store; otherwise the link stays as it was and is handled as before.
      sourceUrl = canonicalProductUrl((await expandShortLink(new URL(sourceUrl))).href);
      if (!isShortLink(new URL(sourceUrl))) {
        const answer = await known();
        if (answer) return answer;
      }
    }
    const host = new URL(sourceUrl).hostname;
    const liveLocationRequired = isAmazonUsUrl(new URL(sourceUrl));

    // A site outside the store list, or a store Atlas cannot read, is not asked: the page opens the form for the
    // customer's own entry right away, with the confirmation checkbox, and the line can be ordered.
    if (!isSupportedStoreHost(host) || isManualEntryStoreHost(host)) {
      return json({
        sourceUrl,
        brand: host.replace(/^(?:www2?|shop)\./, ''),
        warnings: [],
        error: importManualStoreMessage(locale),
        manualEntryAvailable: true,
        manualStore: true,
      }, 422);
    }

    // The same page asked twice at once (a double tap, two tabs, the operator queue) is fetched once.
    const url = sourceUrl;
    const { outcome, leader } = await flights.run(url, () => fetchProduct(url, merchantRequest));
    if (!outcome.ok) return failed(outcome.error);
    const data = outcome.data;
    const fetchedAt = Date.now();
    const expiresAt = fetchedAt + 10 * 60_000;
    // Only the request that asked the store writes the cache; a follower got the same answer.
    if (leader && !liveLocationRequired) {
      await db.prepare('INSERT INTO market_import_cache (url,payload,expires_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(url) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at,updated_at=excluded.updated_at')
        .bind(url, JSON.stringify(data), expiresAt, fetchedAt).run();
      await db.prepare('DELETE FROM market_import_cache WHERE expires_at < ?').bind(fetchedAt).run();
    }
    return json({ ...data, fetchedAt, expiresAt, cached: false });
  } catch (error) {
    return failure(error, request);
  }
}
