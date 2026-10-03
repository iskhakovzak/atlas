import Marketplace from "../marketplace";
import { LegalDocuments } from '../legal-documents';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { publicMetadata } from '../route-metadata';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { lang } = await searchParams;
  return publicMetadata('legal', typeof lang === 'string' ? lang : undefined, await pageLocale());
}
export const dynamic = "force-dynamic";
export default function Page() { return <Marketplace view="legal"><LegalDocuments/></Marketplace>; }
