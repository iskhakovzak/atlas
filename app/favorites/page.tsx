import Marketplace from '../marketplace';
import { CatalogView } from '../catalog-view';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { privateMetadata } from '../route-metadata';
import { readCatalogQuery } from '@/lib/market/catalog-query';
export async function generateMetadata(): Promise<Metadata> { return privateMetadata('favorites', await pageLocale()); }
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Marketplace view="favorites"><CatalogView mode="favorites" initial={readCatalogQuery(await searchParams)} /></Marketplace>;
}
