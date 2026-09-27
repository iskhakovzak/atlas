import { z } from 'zod';
import { fetchProduct, isAmazonUsUrl, ManualEntryFallbackError, validateManualSourceUrl } from '@/lib/importer/fetch';
import { isSupportedStoreHost } from '@/lib/importer/stores';
import { database, identity, sameOrigin, json, failure, HttpError, requestJson } from '@/lib/market/server';
import { apiErrorMessage, importManualEntryMessage, requestLocale } from '@/lib/market/i18n';

const importRequestSchema = z.object({ url: z.string().max(3000), fresh: z.boolean().optional() });

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
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
    const minute = Math.floor(Date.now() / 60000);
    const key = `${user.userId}:import:${minute}`;
    const now = Date.now();
    const db = database();
    const row = await db.prepare('INSERT INTO market_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count')
      .bind(key, now + 120000).first<{ count: number }>();
    if (!row || row.count > 12) throw new HttpError(429, 'err_20');
    await db.prepare('DELETE FROM market_rate_limits WHERE expires_at < ?').bind(now).run();

    if (!autoImportSupported) {
      const locale = requestLocale(request);
      return json({
        sourceUrl,
        brand: new URL(sourceUrl).hostname.replace(/^www\./, ''),
        warnings: [],
        error: importManualEntryMessage(locale),
        manualEntryAvailable: true,
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
      const data = await fetchProduct(sourceUrl);
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
      const canManuallyEnter = error instanceof ManualEntryFallbackError || error instanceof Error && error.name === 'AbortError';
      const message = canManuallyEnter
        ? importManualEntryMessage(locale)
        : locale === 'ru' ? (error as Error).message : apiErrorMessage(422, locale);
      const partial = error instanceof ManualEntryFallbackError ? error.partial : undefined;
      return json({ ...partial, error: message, manualEntryAvailable: canManuallyEnter }, 422);
    }
  } catch (error) {
    return failure(error, request);
  }
}
