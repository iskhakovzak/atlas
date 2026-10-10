import { isAmazonUsUrl, ManualEntryFallbackError } from '../importer/fetch.ts';
import type { Extracted } from '../importer/extract.ts';
import { manualFallbackAllowed, requiresMerchantSnapshot } from '../importer/manual-fallback.ts';
import { compareProductSnapshot } from '../importer/verify.ts';
import { canonicalProductUrl } from '../importer/source-identity.ts';
import type { CartItem, Pricing, Product } from './domain.ts';
import { toUsd } from './world.ts';

/** A cart line counts as checked for this long, so the checkout right after "Check out" does not fetch again. */
export const recentCheckMs = 2 * 60_000;
/** An unreachable store may still be ordered from when the price was confirmed this recently. */
export const unreachableGraceMs = 30 * 60_000;
/** A store that failed the check is asked again only after this pause. */
export const retryAfterMs = 30_000;

export type CartCheck = {
  cart: CartItem[];
  /** Lines whose store price or stated delivery changed; already updated and marked. */
  changed: string[];
  /** Lines the customer has to load again (currency, option or price not confirmed, or a store that never answered). */
  blocked: string[];
  /** Lines from a store that did not answer, accepted on an earlier recent check. */
  unreachable: string[];
};

const transient = (error: unknown) => error instanceof ManualEntryFallbackError
  || (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError' || error.name === 'TypeError'));

export type CartCheckOptions = {
  /** Lines whose store delivery is an Atlas catalog record (resolved by the server, never from the request). */
  editorial?: (product: Product) => boolean;
};

/**
 * Checks every cart line from a supported store against the live store, one request per product URL.
 * Prices are updated in place (and marked) instead of failing, so the customer sees the new total; the
 * caller reprices the cart. Lines checked within `freshWithinMs` and buyer-confirmed manual lines from
 * stores that hide their data are left as they are, as before. Store delivery follows the store: a stated delivery replaces a
 * claimed reserve or amount, and a claimed delivery the store does not state becomes Atlas's reserve, unless
 * `options.editorial` says the line's delivery is an Atlas catalog record.
 */
export async function checkCartSources(cart: CartItem[], fetchSource: (url: string) => Promise<Extracted>, pricing: Pricing, now = Date.now(), freshWithinMs = recentCheckMs, options: CartCheckOptions = {}): Promise<CartCheck> {
  const result: CartCheck = { cart: [...cart], changed: [], blocked: [], unreachable: [] };
  const groups = new Map<string, number[]>();
  cart.forEach((item, index) => {
    if (!item.product.sourceUrl) return;
    let needsCheck = false;
    try { needsCheck = requiresMerchantSnapshot(item.product, true); } catch { needsCheck = false; }
    if (!needsCheck) return;
    groups.set(item.product.sourceUrl, [...(groups.get(item.product.sourceUrl) ?? []), index]);
  });
  const update = (index: number, patch: Partial<CartItem>) => { result.cart[index] = { ...result.cart[index], ...patch }; };
  await Promise.all([...groups].map(async ([url, indexes]) => {
    if (indexes.every((index) => (cart[index].product.sourceCheckedAt ?? 0) >= now - freshWithinMs && !cart[index].sourceIssue)) return;
    // A store that just failed is not asked again on every tap; the earlier result stands for 30 s.
    if (indexes.some((index) => (cart[index].sourceIssue?.at ?? 0) >= now - retryAfterMs)) {
      for (const index of indexes) {
        const issue = cart[index].sourceIssue;
        if (!issue) continue;
        if (issue.kind === 'unreachable' && (cart[index].product.sourceCheckedAt ?? 0) >= now - unreachableGraceMs) result.unreachable.push(cart[index].id);
        else result.blocked.push(cart[index].id);
      }
      return;
    }
    let extracted: Extracted;
    try {
      extracted = await fetchSource(url);
    } catch (error) {
      for (const index of indexes) {
        const item = cart[index];
        let allowed = false;
        try { allowed = manualFallbackAllowed(item.product, item.variant, error); } catch {
          // The store answered in part, and what it showed no longer matches: load the product again.
          update(index, { sourceIssue: { kind: 'price', at: now } }); result.blocked.push(item.id); continue;
        }
        if (allowed) continue;
        update(index, { sourceIssue: { kind: 'unreachable', at: now } });
        if (transient(error) && (item.product.sourceCheckedAt ?? 0) >= now - unreachableGraceMs) result.unreachable.push(item.id);
        else result.blocked.push(item.id);
      }
      return;
    }
    for (const index of indexes) {
      const item = cart[index];
      const check = compareProductSnapshot(item.product, item.variant, extracted, now, { editorialShipping: options.editorial?.(item.product) ?? false });
      if (check.status === 'blocked') {
        update(index, { sourceIssue: { kind: check.kind, at: now } });
        result.blocked.push(item.id);
        continue;
      }
      const product = { ...check.product };
      product.usd = toUsd(product.sourcePrice!, product.sourceCurrency!, pricing.rates);
      if (product.sourceShipping !== undefined)
        product.sourceShippingUsd = toUsd(product.sourceShipping, product.sourceShippingCurrency ?? product.sourceCurrency!, pricing.rates);
      // The store now reports fewer units than the line asks for: the customer lowers the quantity first.
      if (product.stockQuantity !== undefined && item.quantity > product.stockQuantity) {
        update(index, { product, sourceIssue: { kind: 'stock', at: now } });
        result.blocked.push(item.id);
        continue;
      }
      if (check.status === 'changed') {
        update(index, { product, sourceIssue: undefined, priceChange: { ...check.change, at: now } });
        result.changed.push(item.id);
      } else update(index, { product, sourceIssue: undefined });
    }
  }));
  return result;
}

/** A row of market_import_cache: the store answer /api/import stored, as JSON, and when the server fetched it. */
export type RecentImport = { payload: string; updatedAt: number };

/** The store URL as the importer fetches and caches it; a value that is not a URL stays as it is. */
export function importCacheKey(url: string) {
  try { return canonicalProductUrl(url); } catch { return url; }
}

/** Only a payload with the shape fetchProduct returns counts; anything else is fetched live. */
function storedExtraction(payload: string): Extracted | undefined {
  let value: unknown;
  try { value = JSON.parse(payload); } catch { return undefined; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.sourceUrl !== 'string' || !Array.isArray(record.warnings)) return undefined;
  if (record.price !== undefined && (typeof record.price !== 'number' || !Number.isFinite(record.price))) return undefined;
  if (record.currency !== undefined && typeof record.currency !== 'string') return undefined;
  if (record.variants !== undefined && !Array.isArray(record.variants)) return undefined;
  return record as Extracted;
}

/**
 * Cart-add right after the product card was loaded: the store answer the server itself stored in
 * market_import_cache within `freshWithinMs` (the same window a checked cart line counts as checked) is used instead
 * of a second request to the store. Only rows the server wrote are read, never anything from the request; Amazon US
 * (a price that depends on the delivery location) is always asked live, as at checkout. `snapshotAt` gives the time
 * the reused answer was fetched, so the line records that time as its check, not the moment of the tap.
 */
export function withRecentImport(fetchSource: (url: string) => Promise<Extracted>, readRecent: (url: string, since: number) => Promise<RecentImport | undefined>, now = Date.now(), freshWithinMs = recentCheckMs) {
  const fetchedAt = new WeakMap<Extracted, number>();
  const fetchProduct = async (url: string) => {
    const key = importCacheKey(url);
    let live = false;
    try { live = isAmazonUsUrl(new URL(key)); } catch { live = true; }
    if (!live) {
      let row: RecentImport | undefined;
      try { row = await readRecent(key, now - freshWithinMs); } catch { row = undefined; }
      const value = row && row.updatedAt > now - freshWithinMs && row.updatedAt <= now ? storedExtraction(row.payload) : undefined;
      if (value) { fetchedAt.set(value, row!.updatedAt); return value; }
    }
    return fetchSource(key);
  };
  return { fetchProduct, snapshotAt: (value: Extracted) => fetchedAt.get(value) };
}
