import Marketplace from './marketplace';
import { HomeCatalog } from './home-catalog';
import type { Metadata } from 'next';
import { pageLocale } from './page-locale';
import { publicMetadata } from './route-metadata';
// Rules split out of the layout CSS for the home page only: the build links them with the page's own CSS, in import
// order (tests/css-split.test.mjs).
import './styles/home-only.css';
// Home-only styles (every selector is scoped to html[data-view="catalog"], .catalog-home, .home-* or .hw-*): here they
// load with the home page instead of on every page. Same relative order as they had in the layout.
import './home-chapters.css';
import './tariffs.css';
import './home-wide-rail.css';
import './home-wide-content.css';
import './folio-outside.css';
import './home-bill.css';
import './home-trust.css';
import './home-wide-decor.css';
// Rules that need a width of 481px or more: on phones the file does not block the first paint.
import homeDesktopHref from './styles/home-desktop.css?url';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { lang } = await searchParams;
  return publicMetadata('home', typeof lang === 'string' ? lang : undefined, await pageLocale());
}

export default function Page(){return <><link rel="stylesheet" href={homeDesktopHref} media="(min-width: 481px)" precedence="vite-rsc/importer-resources"/><Marketplace view="catalog"><HomeCatalog/></Marketplace></>;}
