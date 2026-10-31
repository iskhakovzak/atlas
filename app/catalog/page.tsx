import Marketplace from '../marketplace';
import { CatalogView } from '../catalog-view';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { publicMetadata } from '../route-metadata';
import { readCatalogQuery } from '@/lib/market/catalog-query';
// Rules split out of the layout CSS for the routes that use them. Each is shared by several pages, so the build links it
// after this page's own CSS: a page rule that must beat one of its rules needs a more specific selector, not a later
// place (tests/css-split.test.mjs).
import '../styles/catalog-pages.css';
import '../styles/catalog-cards.css';

type Search = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Filtered addresses canonicalize to the catalog itself, so search engines index one page per language.
export async function generateMetadata({ searchParams }: Search): Promise<Metadata> {
  const { lang } = await searchParams;
  return publicMetadata('catalog', typeof lang === 'string' ? lang : undefined, await pageLocale());
}
// No catalog seed here, unlike /stores (lib/market/catalog-seed.ts): the full grid in the first paint made Lighthouse's
// mobile simulation count more script before first paint (85 → 79, 14.10.2026), while the skeleton's shift (CLS 0.038
// phone, 0.078 desktop) is already in the good range and costs no score.
export default async function Page({ searchParams }: Search) {
  const params = await searchParams;
  return <Marketplace view="products"><CatalogView mode="catalog" initial={readCatalogQuery(params)} lang={typeof params.lang === 'string' ? params.lang : undefined} /></Marketplace>;
}
