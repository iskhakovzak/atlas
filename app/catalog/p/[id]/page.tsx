import Marketplace from '../../../marketplace';
import { ProductOrder } from '../../../global-link-order';
import { JsonLd } from '../../../json-ld';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pageLocale } from '../../../page-locale';
import { productMetadata } from '../../../route-metadata';
import { publicCatalogProduct } from '@/lib/market/initial-data';
import { dealQuote } from '@/lib/market/deals';
import { formatSum } from '@/lib/market/format';
import { supportedLocale } from '@/lib/market/i18n';
import { productLd } from '@/lib/seo/structured-data';
// Rules split out of the layout CSS for the routes that use them, as /order-by-link imports them: the product page is the
// same component (tests/css-split.test.mjs).
import '../../../styles/stores-pages.css';
import '../../../styles/link-pages.css';
import '../../../styles/catalog-cards.css';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const decodedId = (raw: string) => { try { return decodeURIComponent(raw); } catch { return raw; } };
/** The card's "to Tashkent" sum, as the catalog grid prices it (lib/market/deals.ts), for the title and search engines. */
const catalogSum = (found: NonNullable<Awaited<ReturnType<typeof publicCatalogProduct>>>) => dealQuote(found.product, found.pricing, [found.product]).costs?.total;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ id }, { lang }, locale] = await Promise.all([params, searchParams, pageLocale()]);
  const found = await publicCatalogProduct(decodedId(id));
  if (!found) return { title: '404', robots: { index: false, follow: false } };
  const requested = supportedLocale(typeof lang === 'string' ? lang : undefined) ?? locale;
  const sum = catalogSum(found);
  return productMetadata(found.product, sum ? formatSum(sum, requested) : undefined, typeof lang === 'string' ? lang : undefined, locale);
}

/**
 * A catalog product on its own address (redesign stage 5, 1 November 2026): the same product page the catalog opens as
 * a sheet, rendered on the server with its real heading and sum, Product JSON-LD, and 404 for an id the catalog does
 * not publish. Colours, sizes and the add button work here as in the sheet; the server checks the store on add.
 */
export default async function Page({ params }: Props) {
  const [{ id }, locale] = await Promise.all([params, pageLocale()]);
  const found = await publicCatalogProduct(decodedId(id));
  if (!found) notFound();
  const { product } = found;
  return <Marketplace view="products">
    <JsonLd data={productLd({ id: product.id, name: product.name, brand: product.brand, description: product.description, category: product.category, images: [product.image, ...(product.sourceImages ?? [])].filter((image): image is string => Boolean(image?.startsWith('https://'))), totalSoum: catalogSum(found) }, locale)} />
    <ProductOrder mode="catalog" product={product} />
  </Marketplace>;
}
