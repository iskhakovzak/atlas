import { customsPageCheckedOn } from '@/lib/market/customs';
import { buildSitemap, productEntries, publicPageEntries, type SitemapEntry } from '@/lib/seo/sitemap';
import { seoRoutes } from '@/lib/seo/routes';

// The sitemap, built per request from the public page list (lib/seo/locales.ts) instead of public/sitemap.xml.
// Product and store pages join it when their routes exist (lib/seo/routes.ts): until then nothing here reads the database.

async function productPages(): Promise<SitemapEntry[]> {
  if (!seoRoutes.productPages) return [];
  const [{ readCatalog }, { publicCatalog }, { pricing }] = await Promise.all([import('@/lib/market/catalog-server'), import('@/lib/market/catalog-editor'), import('@/lib/market/server')]);
  const [{ document }, currentPricing] = await Promise.all([readCatalog(), pricing()]);
  return productEntries(publicCatalog(document, currentPricing).products);
}

export async function GET() {
  // Store pages (stage 8) add `storeEntries(indexable stores)` here once the store list with slugs exists.
  const entries = [
    ...publicPageEntries({ '/customs': customsPageCheckedOn }, seoRoutes.deliveryPage ? ['/delivery'] : []),
    ...await productPages().catch(() => []),
  ];
  return new Response(buildSitemap(entries), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
