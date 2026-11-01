import Marketplace from '../../marketplace';
import { CatalogView } from '../../catalog-view';
import { StoreAbout, StoreHead } from '../../store-page';
import { JsonLd } from '../../json-ld';
import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pageLocale, requestedPageLocale } from '../../page-locale';
import { storeMetadata } from '../../route-metadata';
import { CatalogSeed } from '@/lib/market/store';
import { storeCatalog } from '@/lib/market/initial-data';
import { readCatalogQuery } from '@/lib/market/catalog-query';
import { storeBySlug, storePageIndexable } from '@/lib/market/store-pages';
import { storeCountryTerms } from '@/lib/market/store-geo';
import { storesCopy } from '@/lib/market/stores-copy';
import { deliveryCopy } from '@/lib/market/delivery-copy';
import { tariff } from '@/lib/market/domain';
import { collectionPage } from '@/lib/seo/structured-data';
import { productPath, storePath } from '@/lib/seo/routes';
// Rules split out of the layout CSS for the routes that use them (tests/css-split.test.mjs): a store page is the catalog
// filtered by that store, so it takes the catalog's files.
import '../../styles/catalog-pages.css';
import '../../styles/catalog-cards.css';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** One catalog read per request: the title (generateMetadata) and the page need the same counts. */
const readStoreCatalog = cache((slug: string) => storeCatalog(slug));

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, { lang }, locale] = await Promise.all([params, searchParams, pageLocale()]);
  const brand = storeBySlug(slug);
  if (!brand) return { title: '404', robots: { index: false, follow: false } };
  const { pricing: read, counts } = await readStoreCatalog(brand.key);
  const count = counts?.get(brand.key) ?? 0;
  const pricing = read ?? tariff;
  const main = brand.storefronts[0];
  // A failed catalog read (counts null) keeps the page indexable: a store page must not flap to noindex for one bad read.
  const indexable = counts === null || storePageIndexable(brand, count);
  return storeMetadata({ slug: brand.key, name: brand.name, domain: main.root }, (shown) => {
    const range = storeCountryTerms(pricing, main.country, shown).expressRange;
    return { days: range ? deliveryCopy[shown].days(range[0], range[1]) : null, products: count ? storesCopy[shown].products(count) : null };
  }, indexable, typeof lang === 'string' ? lang : undefined, locale);
}

/**
 * A store's page (redesign stage 8, 1 November 2026): the catalog filtered by this store under a compact header with the
 * store's link field and delivery days; without catalog products only the header and how to order from it. 404 for a
 * slug outside the store list. BreadcrumbList Home → Магазины → store, and the products as a CollectionPage. The page gets
 * only this store's part of the catalog (scoped seed), so its products are in the HTML however large the catalog grows.
 * `/stores/NIKE` and an old `/stores?brand=nike` reach it by a 308 from middleware.ts (store-pages.ts storePageRedirect).
 */
export default async function Page({ params, searchParams }: Props) {
  const [{ slug }, query, requested] = await Promise.all([params, searchParams, requestedPageLocale()]);
  const brand = storeBySlug(slug);
  if (!brand) notFound();
  const { seed, counts, productIds } = await readStoreCatalog(brand.key);
  const count = counts ? counts.get(brand.key) ?? 0 : null;
  const lang = typeof query.lang === 'string' ? query.lang : undefined;
  // The products the page lists, as product page addresses (no prices: those are in each product's own Product data),
  // from the whole catalog: the list does not depend on whether this store's products fit into the HTML.
  const itemPaths = productIds.map(productPath);
  return <Marketplace view="stores" crumb={brand.name} crumbPath={storePath(brand.key)}>
    {itemPaths.length > 0 && <JsonLd data={collectionPage({ path: storePath(brand.key), requested, name: brand.name, itemPaths })} />}
    <CatalogSeed value={seed}>
      <CatalogView mode="catalog" initial={readCatalogQuery(query)} lang={lang}
        store={{ slug: brand.key, count, head: <StoreHead slug={brand.key} count={count} />, foot: <StoreAbout slug={brand.key} /> }} />
    </CatalogSeed>
  </Marketplace>;
}
