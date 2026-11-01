import Marketplace from '../marketplace';
import { CatalogView } from '../catalog-view';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { initialCatalogFirstPage } from '@/lib/market/initial-data';
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
// No whole-catalog seed here, unlike /stores (lib/market/catalog-seed.ts): inlining every product cost the mobile lab
// score (85 → 79, 14.10.2026). Only the first page's 24 cards are in the HTML (owner, 2 November 2026; the fields the card
// shows, lib/market/catalog-first-page.ts), so search engines read the products and the photos of the first row start at
// once; the browser still loads the catalog with one /api/catalog request and keeps the same cards in place.
export default async function Page({ searchParams }: Search) {
  const params = await searchParams;
  const initial = readCatalogQuery(params);
  const firstPage = await initialCatalogFirstPage(initial, await pageLocale());
  return <Marketplace view="products"><CatalogView mode="catalog" initial={initial} firstPage={firstPage} lang={typeof params.lang === 'string' ? params.lang : undefined} /></Marketplace>;
}
