import Marketplace from './marketplace';
import { HomeCatalog } from './home-catalog';
import type { Metadata } from 'next';
import { pageLocale } from './page-locale';
import { publicMetadata } from './route-metadata';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { lang } = await searchParams;
  return publicMetadata('home', typeof lang === 'string' ? lang : undefined, await pageLocale());
}

export default function Page(){return <Marketplace view="catalog"><HomeCatalog/></Marketplace>;}
