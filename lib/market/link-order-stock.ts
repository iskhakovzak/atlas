import type {ProductVariant} from '../importer/extract.ts';
import {isConfirmedVariantAvailable} from '../importer/variant-normalization.ts';

type Stock = Pick<ProductVariant, 'available' | 'availabilityKnown' | 'quantity'>;

/**
 * What the options of a product leave to choose on the order-by-link page.
 * - 'none': the store listed no options (the customer types one, or the product has none);
 * - 'open': at least one option is confirmed as on sale and can be chosen;
 * - 'sold-out': every listed option is sold out by the store's own answer (out of stock, or 0 left):
 *   the page says «Нет в наличии в магазине» and its button stays inactive instead of leading to an empty choice;
 * - 'unconfirmed': options are listed, none is confirmed as on sale and some have no stock answer at all:
 *   nothing can be chosen either, but "sold out" would be a guess, so the page does not say it.
 */
export type OptionStock = 'none' | 'open' | 'sold-out' | 'unconfirmed';

/** A store's explicit "not on sale": a stock count of 0, or a known availability that is false. */
function soldOut(variant: Stock): boolean {
  return variant.quantity === 0 || (variant.availabilityKnown === true && variant.available === false);
}

export function optionStock(variants: readonly Stock[]): OptionStock {
  if (!variants.length) return 'none';
  if (variants.some(isConfirmedVariantAvailable)) return 'open';
  return variants.every(soldOut) ? 'sold-out' : 'unconfirmed';
}
