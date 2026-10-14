import Marketplace from '../marketplace';
import { CatalogView } from '../catalog-view';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
import { readCatalogQuery } from '@/lib/market/catalog-query';
// Rules split out of the layout CSS for the routes that use them. Each is shared by several pages, so the build links it
// after this page's own CSS: a page rule that must beat one of its rules needs a more specific selector, not a later
// place (tests/css-split.test.mjs).
import '../styles/catalog-pages.css';
import '../styles/catalog-cards.css';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('favorites', await pageLocale()); }
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Marketplace view="favorites"><CatalogView mode="favorites" initial={readCatalogQuery(await searchParams)} /></Marketplace>;
}
