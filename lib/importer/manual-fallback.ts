import type { Product } from '../market/domain.ts';
import { ManualEntryFallbackError, validateManualSourceUrl } from './fetch.ts';
import { verifyKnownSnapshotFields } from './verify.ts';
import { isManualEntryStoreHost, isSupportedStoreHost } from './stores.ts';

/**
 * Supported merchants must still be checked against the live source. For a
 * public HTTPS store outside the importer allowlist, or one Atlas cannot read
 * (manualEntryStoreRoots), no server fetch is made; a customer-reviewed manual
 * snapshot can continue through the ordinary server-side pricing and account checks.
 */
export function requiresMerchantSnapshot(product: Pick<Product, 'sourceUrl' | 'sourceManuallyConfirmed'>, allowLegacyManualSnapshot = false) {
  if (!product.sourceUrl) return false;
  const source = validateManualSourceUrl(product.sourceUrl);
  if (isSupportedStoreHost(source.hostname) && !isManualEntryStoreHost(source.hostname)) return true;
  if (product.sourceManuallyConfirmed || allowLegacyManualSnapshot) return false;
  throw Error('Проверьте и подтвердите цену и вариант товара вручную.');
}

/** A buyer-confirmed item may proceed if the merchant hides public data.
 * Any price or currency the merchant did return must still match the snapshot. */
export function manualFallbackAllowed(product: Product, variant: string, error: unknown) {
  if (!product.sourceManuallyConfirmed) return false;
  if (error instanceof ManualEntryFallbackError) {
    if (error.partial) verifyKnownSnapshotFields(product, variant, error.partial);
    return true;
  }
  return error instanceof Error && error.name === 'AbortError';
}
