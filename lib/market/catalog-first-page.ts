import { applyCatalogQuery, catalogItems, paginate, type CatalogItem, type CatalogQuery } from './catalog-query.ts';
import { catalogCopy } from './catalog-copy.ts';
import { searchWords } from './catalog-synonyms.ts';
import { courierAllowanceUsd } from './customs.ts';
import type { CatalogCollection } from './catalog-editor.ts';
import type { MerchantFind } from './catalog.ts';
import type { Pricing } from './domain.ts';
import type { Locale } from './i18n.ts';

/**
 * The first page of /catalog in the server HTML (owner, 2 November 2026): the 24 cards a guest sees first — name, brand,
 * the sum in soum, the link to /catalog/p/<id> and the photo — so search engines read products, not a skeleton. The page
 * renders them with the same CatalogCard the browser uses, sorted and filtered by the same functions with a guest's
 * context, so the client catalog (one /api/catalog request, as before) takes over the same cards in place: no second
 * request for the page, no swap, no layout shift. The whole catalog is not inlined (that cost the mobile lab score,
 * 14.10.2026); each card carries only the fields the card shows.
 */

/** Cards whose photo loads at once (the first row of the widest common grid, four columns from 1280 px); the rest lazily. */
export const firstPageEager = 4;
/** Of those, the ones asked first (the first row on a phone, two columns). */
export const firstPageHigh = 2;

/** What CatalogCard reads from an item, nothing else: the card is replaced by the full one when the catalog arrives. */
export function slimCatalogItem(item: CatalogItem): CatalogItem {
  const p = item.product;
  const product = {
    id: p.id, name: p.name, brand: p.brand, category: p.category, image: p.image, usd: p.usd, weight: p.weight, country: p.country,
    ...(p.sourceUrl ? { sourceUrl: p.sourceUrl } : {}),
    ...(p.priceNeedsConfirmation ? { priceNeedsConfirmation: true } : {}),
    ...(p.sourcePrice !== undefined ? { sourcePrice: p.sourcePrice } : {}),
    ...(p.sourceCurrency ? { sourceCurrency: p.sourceCurrency } : {}),
    ...(p.confirmedAt !== undefined ? { confirmedAt: p.confirmedAt } : {}),
    ...(p.sourceSellerId ? { sourceSellerId: p.sourceSellerId } : {}),
    // The «from» price and the official eBay store read the options' prices, stock and seller only.
    ...(p.sourceVariants?.length ? { sourceVariants: p.sourceVariants.map((variant) => ({
      label: variant.label, available: variant.available,
      ...(variant.availabilityKnown !== undefined ? { availabilityKnown: variant.availabilityKnown } : {}),
      ...(variant.quantity !== undefined ? { quantity: variant.quantity } : {}),
      ...(variant.price !== undefined ? { price: variant.price } : {}),
      ...(variant.sellerId ? { sellerId: variant.sellerId } : {}),
    })) } : {}),
  } as MerchantFind;
  return {
    product, store: item.store, usd: item.usd, referenceUsd: item.referenceUsd, discount: item.discount, savingsUsd: item.savingsUsd, holdUsd: item.holdUsd,
    costs: item.costs ? { total: item.costs.total } as NonNullable<CatalogItem['costs']> : null,
    sizes: item.sizes, stockSizes: [], fresh: item.fresh, addedAt: item.addedAt, brand: item.brand, checkedAt: item.checkedAt,
    attrs: item.attrs.color ? { color: item.attrs.color } : {},
    ...(item.topDeal ? { topDeal: true as const } : {}),
  };
}

/**
 * The first page as a guest's browser orders it for this address (`?cat=…&sort=…`): page 1 only (a phone opened at
 * `?page=3` shows pages 1–3 and keeps its skeleton until the catalog arrives). Null when there is nothing to show.
 */
export function catalogFirstPage(products: MerchantFind[], collections: Array<CatalogCollection & { productIds: string[] }>, pricing: Pricing, query: CatalogQuery, locale: Locale): CatalogItem[] | null {
  if (query.page !== 1 || !products.length) return null;
  const context = { dutyLimitUsd: courierAllowanceUsd, collections, words: (item: CatalogItem) => [catalogCopy[locale].categories[item.product.category] ?? '', searchWords(item, locale)].join(' ') };
  const items = paginate(applyCatalogQuery(catalogItems(products, pricing), query, context), 1, query.per).items;
  return items.length ? items.map(slimCatalogItem) : null;
}
