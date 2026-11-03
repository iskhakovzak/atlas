/**
 * The public catalog list (GET /api/catalog, the pages' catalog seeds) without the options, galleries and descriptions
 * (3 November 2026): 510 products were 4.6 MB of JSON, three quarters of it the options' photo lists. A list product
 * carries `listing: true` and, in place of its options, what the cards, filters, sorting and the official-store mark read
 * from them (lib/market/catalog-list.ts computes it on the server). The full product (options, gallery, description)
 * comes from GET /api/catalog/<id> when its sheet opens (lib/market/catalog-product-client.ts); the product page
 * /catalog/p/[id] renders the full one on the server. No imports: the card, the query and the deal helpers all read it.
 */
export type CatalogVariantSummary = {
  /** productSizes of the full product: the sizes the store lists, normalised and ordered. */
  sizes?: string[];
  /** productStockSizes of the full product: the sizes the store reports in stock now. */
  stockSizes?: string[];
  /** The lowest price, in the store's currency, of an option the store still sells (cheapestUsd converts it). */
  lowestPrice?: number;
  /** The options the store still sells have more than one price (the card writes «от»). */
  priceSpread?: true;
  /** The options' sellers, lower case (the official eBay store mark). */
  sellers?: string[];
};

/** The summary of a list product (an empty one when it has none); undefined for a full product, whose options are read. */
export function variantSummaryOf(product: object): CatalogVariantSummary | undefined {
  const value = product as { listing?: unknown; variantSummary?: CatalogVariantSummary };
  return value.listing === true ? value.variantSummary ?? {} : undefined;
}
