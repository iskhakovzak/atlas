import Marketplace from './marketplace';
import { HomeCatalog } from './home-catalog';
import type { Metadata } from 'next';
import { pageLocale } from './page-locale';
import { publicMetadata } from './route-metadata';
// The home page's own styles (app/styles/home-only.css): the build links them with the page's CSS, so other pages do
// not load them (tests/css-split.test.mjs).
import './styles/home-only.css';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { lang } = await searchParams;
  return publicMetadata('home', typeof lang === 'string' ? lang : undefined, await pageLocale());
}

export default function Page(){return <Marketplace view="catalog"><HomeCatalog/></Marketplace>;}
