import { brandForHost, popularBrandKeys, storeBrands, type StoreBrand } from './store-brands.ts';
import { storePath } from '../seo/routes.ts';

// Store pages (/stores/[slug], redesign stage 8, 1 November 2026): the slug is the brand key of the store directory
// (lib/market/store-brands.ts), so amazon.com, amazon.de and amazon.co.jp share /stores/amazon.

const bySlug = new Map(storeBrands.map((brand) => [brand.key, brand]));

/** The store behind a page address, or undefined (the page answers 404). Case and stray spaces are forgiven. */
export function storeBySlug(slug: string): StoreBrand | undefined {
  let value = slug;
  try { value = decodeURIComponent(slug); } catch { /* a malformed escape is just an unknown slug */ }
  return bySlug.get(value.trim().toLowerCase());
}

/** The brand key a catalog item's store host belongs to ("www.nike.com" → "nike"), or '' for a host outside the list. */
export function storeSlugOfHost(host: string): string {
  return brandForHost(host)?.key ?? '';
}

/**
 * Whether a store page is offered to search engines. A page with Atlas catalog products has its own content; a page of a
 * popular store has its delivery terms, storefronts and how-to (people search "zara доставка в Ташкент"). The other ~200
 * stores would be near-identical pages with only a link field: they stay reachable and `noindex, follow`, out of the
 * sitemap, so they never read as doorway pages (Google spam policies). They join once their products are in the catalog.
 */
export function storePageIndexable(brand: Pick<StoreBrand, 'key'>, catalogCount: number): boolean {
  return catalogCount > 0 || popularBrandKeys.includes(brand.key);
}

/** How many published catalog products each store has, by slug (hosts outside the store list are left out). */
export function catalogCountsBySlug(products: readonly { sourceUrl?: string; store?: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const product of products) {
    const slug = productStoreSlug(product);
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return counts;
}

/** The store a published product belongs to, by slug ('' for a host outside the store list). */
export function productStoreSlug(product: { sourceUrl?: string; store?: string }): string {
  return storeSlugOfHost(productHost(product));
}

/**
 * The ids of one store's published products, in catalog order: the store page's CollectionPage lists them from the whole
 * catalog, so it does not depend on whether the catalog fits into the HTML (review of stage 8, 1 November 2026).
 */
export function storeProductIds(products: readonly { id: string; sourceUrl?: string; store?: string }[], slug: string): string[] {
  return products.filter((product) => productStoreSlug(product) === slug).map((product) => product.id);
}

/**
 * The one address of a store page, for a request that reaches it another way (middleware.ts answers 308): an old
 * `/stores?brand=nike` link (the store card it opened is now the page; `?lang` is kept, the directory's own filters are
 * not) and a slug in another case or with stray characters (`/stores/NIKE`, a duplicate of `/stores/nike`). Null when the
 * address is already the page's own or names no store (the page answers 404 itself).
 */
export function storePageRedirect(pathname: string, search: URLSearchParams): string | null {
  if (pathname === '/stores') {
    const named = search.get('brand');
    const brand = named ? storeBySlug(named) : undefined;
    if (!brand) return null;
    const lang = search.get('lang');
    return storePath(brand.key) + (lang ? '?lang=' + encodeURIComponent(lang) : '');
  }
  const match = /^\/stores\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  const brand = storeBySlug(match[1]);
  if (!brand || match[1] === brand.key) return null;
  const query = search.toString();
  return storePath(brand.key) + (query ? '?' + query : '');
}

/** The store host of a published product, as the catalog reads it (catalog-query.ts storeHost: the link's host, else `store`). */
function productHost(product: { sourceUrl?: string; store?: string }): string {
  try { if (product.sourceUrl) return new URL(product.sourceUrl).hostname.toLowerCase().replace(/^www\./, ''); } catch { /* fall back to the label */ }
  return (product.store ?? '').toLowerCase();
}
