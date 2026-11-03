import type { MerchantFind } from './catalog.ts';
import type { CatalogCollection } from './catalog-editor.ts';
import type { CatalogVariantSummary } from './catalog-summary.ts';
import { catalogPriceSpread, productSizes, productStockSizes } from './catalog-query.ts';

/**
 * The public catalog list (3 November 2026, lib/market/catalog-summary.ts): every published product without its options,
 * galleries and description, with a small summary of the options in their place. Built from the full public catalog
 * (catalog-editor.ts publicCatalog), so a list card shows exactly what the full one would: the same sizes, «N размеров»,
 * the cheapest option's price and «от», the official-store mark. Colours, filters and «Топ-цена» come from fields the
 * list keeps (facets, topDeal). GET /api/catalog and the pages' catalog seeds serve it; the full product is
 * GET /api/catalog/<id>, the product page and the sitemap read the full catalog on the server.
 */
export type PublicCatalog = { products: MerchantFind[]; collections: Array<CatalogCollection & { productIds: string[] }> };

/** Fields of a full product that the list leaves out: what only the product page and its sheet read. */
const fullOnly = ['sourceVariants', 'sourceImages', 'sourceColorwayImages', 'description', 'sourceGroupId', 'sourceVariantScope', 'sourceVariantsComplete'] as const;

export function catalogVariantSummary(product: MerchantFind): CatalogVariantSummary {
  const options = product.sourceVariants ?? [];
  if (!options.length) return {};
  const sizes = productSizes(product), stockSizes = productStockSizes(product);
  const prices = options
    .filter((variant) => variant.available && variant.availabilityKnown !== false && variant.quantity !== 0 && variant.price !== undefined && variant.price > 0)
    .map((variant) => variant.price!);
  const sellers = [...new Set(options.map((variant) => variant.sellerId?.toLowerCase()).filter((value): value is string => Boolean(value)))];
  return {
    ...(sizes.length ? { sizes } : {}),
    ...(stockSizes.length ? { stockSizes } : {}),
    ...(prices.length ? { lowestPrice: Math.min(...prices) } : {}),
    ...(catalogPriceSpread(product) ? { priceSpread: true as const } : {}),
    ...(sellers.length ? { sellers: sellers.slice(0, 20) } : {}),
  };
}

/** One list entry: the product without the full-only fields, marked `listing`, with its options' summary. */
export function catalogListProduct(product: MerchantFind): MerchantFind {
  if (product.listing) return product;
  const summary = catalogVariantSummary(product);
  const entry: Record<string, unknown> = { ...product };
  for (const key of fullOnly) delete entry[key];
  return { ...entry, listing: true, ...(Object.keys(summary).length ? { variantSummary: summary } : {}) } as MerchantFind;
}

/** Cache-Control of the public catalog answers (the list and one product): the same for everyone, a minute fresh. */
export const publicCatalogCache = 'public, max-age=60, stale-while-revalidate=600';

export function publicCatalogList(catalog: PublicCatalog): PublicCatalog {
  return { products: catalog.products.map(catalogListProduct), collections: catalog.collections };
}
