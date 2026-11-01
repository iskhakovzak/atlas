import Marketplace from '../marketplace';
import { DeliveryView } from '../delivery-view';
import type { Metadata } from 'next';
import { pageLocale } from '../page-locale';
import { publicMetadata } from '../route-metadata';
// The page's own rules: only this route uses them (tests/css-split.test.mjs).
import '../styles/delivery-page.css';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { lang } = await searchParams;
  return publicMetadata('delivery', typeof lang === 'string' ? lang : undefined, await pageLocale());
}

// Rates per dispatch country, the duty-free allowance and the delivery calculator (redesign stage 8, 1 November 2026).
// The header's «Доставка», the footer and the home rates block lead here.
export default function Page() {
  return <Marketplace view="delivery"><DeliveryView /></Marketplace>;
}
