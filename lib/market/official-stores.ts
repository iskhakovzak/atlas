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

/** "adidas official" for the store line: short enough for a phone card; the title says where. */
export function officialStoreText(brand: string, locale: Locale) {
  if (locale === 'ru') return { short: `Официальный ${brand}`, full: `Официальный магазин ${brand} на eBay` };
  if (isUzbek(locale)) return { short: uzText(locale, `${brand} rasmiy`), full: uzText(locale, `eBay’dagi rasmiy ${brand} do‘koni`) };
  return { short: `Official ${brand}`, full: `Official ${brand} store on eBay` };
}
