import Marketplace from '../marketplace';
import { DeleteAccountView } from '../support-view';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { publicMetadata } from '../route-metadata';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { lang } = await searchParams;
  return publicMetadata('delete-account', typeof lang === 'string' ? lang : undefined, await pageLocale());
}
export const dynamic = "force-dynamic";
export default function Page() { return <Marketplace view="delete-account"><DeleteAccountView/></Marketplace>; }
