import type { Product } from '../market/domain.ts';
import { ManualEntryFallbackError } from './fetch.ts';
import { verifyKnownSnapshotFields } from './verify.ts';

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
