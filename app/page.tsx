import type { Metadata } from 'next';
import Marketplace from './marketplace';
import { homeMetadata } from './route-metadata';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { lang } = await searchParams;
  return homeMetadata(typeof lang === 'string' ? lang : undefined);
}

export default function Page(){return <Marketplace view="catalog"/>}
