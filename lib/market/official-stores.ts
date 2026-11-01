import type { Product } from './domain.ts';
import type { Locale } from './i18n.ts';
import { isUzbek } from './i18n.ts';
import { uzText } from './uz-cyrl.ts';

/**
 * eBay sellers that are the brand itself, each checked against the store's own contact page (never guessed from a
 * listing's brand: anyone can sell adidas on eBay). adidas: https://www.ebay.com/str/adidas → adidas_official,
 * 25 October 2026.
 */
export const officialEbaySellers: Record<string, string> = { adidas_official: 'adidas' };

/** The brand when every option of the listing is sold by its official eBay store; undefined otherwise. */
export function officialStoreBrand(product: { store?: string } & Pick<Product, 'sourceUrl' | 'sourceSellerId' | 'sourceVariants'>): string | undefined {
  let host = product.store ?? '';
  try { if (product.sourceUrl) host = new URL(product.sourceUrl).hostname; } catch { /* the store field stands */ }
  if (!/(^|\.)ebay\.[a-z.]+$/i.test(host.replace(/^www\./, ''))) return undefined;
  const sellers = new Set([product.sourceSellerId, ...(product.sourceVariants ?? []).map((variant) => variant.sellerId)].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase()));
  if (sellers.size !== 1) return undefined;
  return officialEbaySellers[[...sellers][0]];
}

/** Letters and digits only, lower case: «H&M» and «hm», «Kylie Cosmetics» and «kylie» compare as the same name. */
const letters = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * The brand whose own store this listing comes from (owner, 2 November 2026: the verified mark next to the store logo),
 * or undefined. Two cases only: the brand's verified store on a marketplace (officialStoreBrand, eBay adidas_official),
 * or the brand's own site — a store that is not a marketplace, selling a product of its own brand (nike.com selling Nike,
 * zara.com selling Zara). A retailer selling other brands (Sephora selling NYX), any marketplace seller and a product
 * without a brand get no mark: it is never guessed.
 */
export function officialListing(product: { store?: string; brand?: string } & Pick<Product, 'sourceUrl' | 'sourceSellerId' | 'sourceVariants'>, store: { name: string; focus: string } | undefined): string | undefined {
  const marketplace = officialStoreBrand(product);
  if (marketplace) return marketplace;
  if (!store || store.focus === 'marketplace') return undefined;
  const brand = letters(product.brand ?? ''), name = letters(store.name);
  if (brand.length < 2 || !name) return undefined;
  return brand === name || name.startsWith(brand) || brand.startsWith(name) ? store.name : undefined;
}

/** The label of the verified mark (its tooltip and spoken text). */
export function officialBadgeLabel(locale: Locale) {
  if (locale === 'ru') return 'Официальный магазин бренда';
  if (isUzbek(locale)) return uzText(locale, 'Brendning rasmiy do‘koni');
  return 'Official brand store';
}

/** "adidas official" for the store line: short enough for a phone card; the title says where. */
export function officialStoreText(brand: string, locale: Locale) {
  if (locale === 'ru') return { short: `Официальный ${brand}`, full: `Официальный магазин ${brand} на eBay` };
  if (isUzbek(locale)) return { short: uzText(locale, `${brand} rasmiy`), full: uzText(locale, `eBay’dagi rasmiy ${brand} do‘koni`) };
  return { short: `Official ${brand}`, full: `Official ${brand} store on eBay` };
}
