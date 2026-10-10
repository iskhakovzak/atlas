import Marketplace from '../marketplace';
import { SupportView } from '../support-view';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { publicMetadata } from '../route-metadata';
// Static page blocks (support, app, legal links); not needed by other pages.
import '../pages.css';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { lang } = await searchParams;
  return publicMetadata('support', typeof lang === 'string' ? lang : undefined, await pageLocale());
}
export const dynamic = "force-dynamic";
export default function Page() { return <Marketplace view="support"><SupportView/></Marketplace>; }
