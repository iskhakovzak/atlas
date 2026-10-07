import Marketplace from './marketplace';
import { NotFoundView } from './not-found-view';
import type { Metadata } from 'next';
import { pageLocale } from './page-locale';
import { routeTitle } from '@/lib/market/i18n';

// One <title> in the head: the framework adds `noindex` to the 404 response itself.
export async function generateMetadata(): Promise<Metadata> {
  return { title: routeTitle(await pageLocale(), 'notfound') };
}

// Unknown addresses keep the header, footer and language of the site, with ways back to the main actions.
export default function NotFound() {
  return <Marketplace view="notfound"><NotFoundView /></Marketplace>;
}
