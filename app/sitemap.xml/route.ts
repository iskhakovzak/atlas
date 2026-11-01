import { customsPageCheckedOn } from '@/lib/market/customs';
import { buildSitemap, productEntries, publicPageEntries, storeEntries, type SitemapEntry } from '@/lib/seo/sitemap';
import { seoRoutes } from '@/lib/seo/routes';
import { catalogCountsBySlug, storePageIndexable } from '@/lib/market/store-pages';
import { storeBrands } from '@/lib/market/store-brands';

// The sitemap, built per request from the public page list (lib/seo/locales.ts) instead of public/sitemap.xml.
// Product and store pages join it when their routes exist (lib/seo/routes.ts); both come from one catalog read.

async function catalogPages(): Promise<SitemapEntry[]> {
  if (!seoRoutes.productPages && !seoRoutes.storePages) return [];
  const [{ readCatalog }, { publicCatalog }, { pricing }] = await Promise.all([import('@/lib/market/catalog-server'), import('@/lib/market/catalog-editor'), import('@/lib/market/server')]);
  const [{ document }, currentPricing] = await Promise.all([readCatalog(), pricing()]);
  const products = publicCatalog(document, currentPricing).products;
  const counts = catalogCountsBySlug(products);
  // Only the store pages that are indexed (lib/market/store-pages.ts): the others answer `noindex` and stay out.
  const stores = seoRoutes.storePages ? storeBrands.filter((brand) => storePageIndexable(brand, counts.get(brand.key) ?? 0)).map((brand) => ({ slug: brand.key })) : [];
  return [...(seoRoutes.productPages ? productEntries(products) : []), ...storeEntries(stores)];
}

export async function GET() {
  const entries = [
    ...publicPageEntries({ '/customs': customsPageCheckedOn }),
    ...await catalogPages().catch(() => storePagesWithoutCatalog()),
  ];
  return new Response(buildSitemap(entries), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

/** A failed catalog read still lists the popular stores' pages: they are indexed with or without catalog products. */
function storePagesWithoutCatalog(): SitemapEntry[] {
  return seoRoutes.storePages ? storeEntries(storeBrands.filter((brand) => storePageIndexable(brand, 0)).map((brand) => ({ slug: brand.key }))) : [];
}
