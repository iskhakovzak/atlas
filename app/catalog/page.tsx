import Marketplace from '../marketplace';
import { CatalogView } from '../catalog-view';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { publicMetadata } from '../route-metadata';
import { readCatalogQuery } from '@/lib/market/catalog-query';

type Search = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Filtered addresses canonicalize to the catalog itself, so search engines index one page per language.
export async function generateMetadata({ searchParams }: Search): Promise<Metadata> {
  const { lang } = await searchParams;
  return publicMetadata('catalog', typeof lang === 'string' ? lang : undefined, await pageLocale());
}
export default async function Page({ searchParams }: Search) {
  return <Marketplace view="products"><CatalogView mode="catalog" initial={readCatalogQuery(await searchParams)} /></Marketplace>;
}
