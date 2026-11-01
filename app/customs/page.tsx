import Marketplace from '../marketplace';
import { CustomsView } from '../customs-view';
import type { Metadata } from 'next';
import { pageLocale, requestedPageLocale } from '../page-locale';
import { JsonLd } from '../json-ld';
import { routeTitle } from '@/lib/market/i18n';
import { customsPageCheckedOn, customsReferences } from '@/lib/market/customs';
import { webPage } from '@/lib/seo/structured-data';
import { publicMetadata } from '../route-metadata';
// Rules split out of the layout CSS for the routes that use them. Each is shared by several pages, so the build links it
// after this page's own CSS: a page rule that must beat one of its rules needs a more specific selector, not a later
// place (tests/css-split.test.mjs).
import '../styles/link-pages.css';
import '../styles/member-pages.css';
import '../styles/catalog-cards.css';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { lang } = await searchParams;
  return publicMetadata('customs', typeof lang === 'string' ? lang : undefined, await pageLocale());
}
// The date the page shows as "checked on" and the lex.uz documents it cites, for search engines and AI answers.
export default async function Page(){
  const [locale, requested] = await Promise.all([pageLocale(), requestedPageLocale()]);
  const page = webPage({ path: '/customs', requested, locale, name: routeTitle(locale, 'customs'), dateModified: customsPageCheckedOn, citations: customsReferences.map((source) => source.url) });
  return <Marketplace view="customs"><JsonLd data={page}/><CustomsView/></Marketplace>;
}
