import { z } from 'zod';
import { fetchProduct, isAmazonUsUrl, ManualEntryFallbackError, UnsupportedStoreError, validateManualSourceUrl } from '@/lib/importer/fetch';
import { isBrowserStoreHost, isManualEntryStoreHost, isSupportedStoreHost } from '@/lib/importer/stores';
import { merchantRequest } from '@/lib/importer/worker-fetch';
import { database, sameOrigin, json, failure, HttpError, requestJson } from '@/lib/market/server';
import { currentUser } from '@/lib/auth/server';
import { importRateBuckets } from '@/lib/market/import-preview';
import { apiErrorMessage, importManualEntryMessage, importManualStoreMessage, importPendingMessage, requestLocale, serverError } from '@/lib/market/i18n';

const importRequestSchema = z.object({ url: z.string().max(3000), fresh: z.boolean().optional() });

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await currentUser();
    const payload = importRequestSchema.safeParse(await requestJson(request, 5000));
    if (!payload.success || !payload.data.url) throw new HttpError(400, 'err_19');

    let sourceUrl: string;
    try {
      sourceUrl = validateManualSourceUrl(payload.data.url).href;
    } catch (error) {
      throw new HttpError(400, (error as Error).message);
    }
    const autoImportSupported = isSupportedStoreHost(new URL(sourceUrl).hostname);

    const liveLocationRequired = isAmazonUsUrl(new URL(sourceUrl));
    const now = Date.now();
    const db = database();
    for (const bucket of await importRateBuckets(user?.userId, request.headers.get('cf-connecting-ip'), now)) {
      const row = await db.prepare('INSERT INTO market_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count')
        .bind(bucket.key, now + 120000).first<{ count: number }>();
      if (!row || row.count > bucket.limit) throw new HttpError(429, 'err_20');
    }
    await db.prepare('DELETE FROM market_rate_limits WHERE expires_at < ?').bind(now).run();

    // A site outside the store list, or a store Atlas cannot read, is not asked: the page opens the form for the
    // customer's own entry right away, with the confirmation checkbox, and the line can be ordered.
    if (!autoImportSupported || isManualEntryStoreHost(new URL(sourceUrl).hostname)) {
      const host = new URL(sourceUrl).hostname;
      return json({
        sourceUrl,
        brand: host.replace(/^(?:www2?|shop)\./, ''),
        warnings: [],
        error: importManualStoreMessage(requestLocale(request)),
        manualEntryAvailable: true,
        manualStore: true,
      }, 422);
    }

    const cached = liveLocationRequired ? undefined : await db.prepare('SELECT payload,expires_at,updated_at FROM market_import_cache WHERE url=? AND expires_at>?')
      .bind(sourceUrl, now).first<{ payload: string; expires_at: number; updated_at: number }>();
    if (cached && !payload.data.fresh) {
      try {
        return json({ ...JSON.parse(cached.payload), fetchedAt: cached.updated_at, expiresAt: cached.expires_at, cached: true });
      } catch {
        // Ignore malformed cache entries and fetch a fresh merchant response.
      }
    }

    try {
      const data = await fetchProduct(sourceUrl, merchantRequest);
      const fetchedAt = Date.now();
      const expiresAt = fetchedAt + 10 * 60_000;
      if (!liveLocationRequired) {
        await db.prepare('INSERT INTO market_import_cache (url,payload,expires_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(url) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at,updated_at=excluded.updated_at')
          .bind(sourceUrl, JSON.stringify(data), expiresAt, fetchedAt).run();
        await db.prepare('DELETE FROM market_import_cache WHERE expires_at < ?').bind(fetchedAt).run();
      }
      return json({ ...data, fetchedAt, expiresAt, cached: false });
    } catch (error) {
      const locale = requestLocale(request);
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
    }
  } catch (error) {
    return failure(error, request);
  }
}
