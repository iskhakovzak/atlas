import Marketplace from './marketplace';
import { HomeCatalog } from './home-catalog';
import type { Metadata } from 'next';
import { pageLocale } from './page-locale';
import { publicMetadata } from './route-metadata';
// Home-only styles (every selector is scoped to html[data-view="catalog"], .catalog-home, .home-* or .hw-*): here they
// load with the home page instead of on every page. Same relative order as they had in the layout.
import './home-chapters.css';
import './tariffs.css';
import './home-wide-rail.css';
import './home-wide-content.css';
import './folio-outside.css';
import './home-wide-decor.css';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { lang } = await searchParams;
  return publicMetadata('home', typeof lang === 'string' ? lang : undefined, await pageLocale());
}

export default function Page(){return <Marketplace view="catalog"><HomeCatalog/></Marketplace>;}
