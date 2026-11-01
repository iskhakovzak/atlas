import Marketplace from '../../../marketplace';
import { ProductOrder } from '../../../global-link-order';
import { JsonLd } from '../../../json-ld';
import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pageLocale } from '../../../page-locale';
import { productMetadata } from '../../../route-metadata';
import { publicCatalogProduct } from '@/lib/market/initial-data';
import { dealQuote } from '@/lib/market/deals';
import { formatSum } from '@/lib/market/format';
import { supportedLocale } from '@/lib/market/i18n';
import { productLd } from '@/lib/seo/structured-data';
import { displayBrand } from '@/lib/market/product-name';
import { brandForHost } from '@/lib/market/store-brands';
import { productPath } from '@/lib/seo/routes';
// Rules split out of the layout CSS for the routes that use them, as /order-by-link imports them: the product page is the
// same component (tests/css-split.test.mjs).
import '../../../styles/stores-pages.css';
import '../../../styles/link-pages.css';
import '../../../styles/catalog-cards.css';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const decodedId = (raw: string) => { try { return decodeURIComponent(raw); } catch { return raw; } };
/** One catalog read per request: the title (generateMetadata) and the page ask for the same card. */
const findProduct = cache((id: string) => publicCatalogProduct(id));
/** The brand as the card and the page write it ("Kylie Cosmetics", not the slug "kylie-cosmetics"; no marketplace as the maker). */
const shownBrand = (product: { brand?: string; sourceUrl?: string }) => {
  let host = '';
  try { host = product.sourceUrl ? new URL(product.sourceUrl).hostname.replace(/^www\./, '') : ''; } catch { /* no store address */ }
  const store = brandForHost(host);
  return displayBrand(product.brand, store?.name ?? host, store?.focus === 'marketplace' ? store.name : undefined) || undefined;
};
/** The card's "to Tashkent" sum, as the catalog grid prices it (lib/market/deals.ts), for the title and search engines. */
const catalogSum = (found: NonNullable<Awaited<ReturnType<typeof publicCatalogProduct>>>) => dealQuote(found.product, found.pricing, [found.product]).costs?.total;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ id }, { lang }, locale] = await Promise.all([params, searchParams, pageLocale()]);
  const found = await findProduct(decodedId(id));
  if (!found) return { title: '404', robots: { index: false, follow: false } };
  const requested = supportedLocale(typeof lang === 'string' ? lang : undefined) ?? locale;
  const sum = catalogSum(found);
  return productMetadata({ ...found.product, brand: shownBrand(found.product) }, sum ? formatSum(sum, requested) : undefined, typeof lang === 'string' ? lang : undefined, locale);
}

/**
 * A catalog product on its own address (redesign stage 5, 1 November 2026): the same product page the catalog opens as
 * a sheet, rendered on the server with its real heading and sum, Product JSON-LD, and 404 for an id the catalog does
 * not publish. Colours, sizes and the add button work here as in the sheet; the server checks the store on add.
 */
export default async function Page({ params, searchParams }: Props) {
  const [{ id }, { lang }] = await Promise.all([params, searchParams]);
  const found = await findProduct(decodedId(id));
  if (!found) notFound();
  const { product } = found;
  // The JSON-LD address is the canonical one: `?lang=` only when the page was asked in a language (app/route-metadata.ts).
  const requested = supportedLocale(typeof lang === 'string' ? lang : undefined) ?? undefined;
  return <Marketplace view="products" crumb={product.name} crumbPath={productPath(product.id)}>
    <JsonLd data={productLd({ id: product.id, name: product.name, brand: shownBrand(product), description: product.description, category: product.category, images: [product.image, ...(product.sourceImages ?? [])].filter((image): image is string => Boolean(image?.startsWith('https://'))), totalSoum: catalogSum(found) }, requested)} />
    <ProductOrder mode="catalog" product={product} />
  </Marketplace>;
}
