'use client';

import Link from '@/components/site-link';
import { ArrowRight } from 'lucide-react';
import type { Locale } from '@/lib/market/i18n';

const copy: Record<Locale, { label: string; title: string; description: string; allStores: string }> = {
  ru: {
    label: 'Поддерживаемые магазины',
    title: 'Популярные магазины',
    description: 'Цены и варианты загружаются автоматически, когда страница магазина передаёт эти данные.',
    allStores: 'Все магазины',
  },
  uz: {
    label: 'Do‘konlar',
    title: 'Mashhur do‘konlar',
    description: 'Do‘kon sahifasi taqdim etsa, narx va variantlar avtomatik yuklanadi.',
    allStores: 'Barcha do‘konlar',
  },
  en: {
    label: 'Supported stores',
    title: 'Popular stores',
    description: 'Prices and options load automatically when the store page provides them.',
    allStores: 'All stores',
  },
};

const stores = ['Zara', 'Nike', 'Adidas', 'Amazon', 'ASOS', 'H&M', 'Sephora', 'iHerb', 'Apple', 'eBay'];

export function SupportedStores({ locale }: { locale: Locale }) {
  const text = copy[locale];

  return (
    <section className="supported-stores" aria-labelledby="supported-stores-title">
      <div className="supported-stores-heading">
        <h2 id="supported-stores-title">{text.title}</h2>
        <p>{text.description}</p>
      </div>
      <ul className="supported-store-list" aria-label={text.label}>
        {stores.map((store) => <li key={store}><Link href={`/stores?q=${encodeURIComponent(store)}`}><span className="store-monogram" aria-hidden="true">{store[0]}</span>{store}</Link></li>)}
      </ul>
      <Link className="supported-stores-link" href="/stores">
        {text.allStores}<ArrowRight size={17} aria-hidden="true" />
      </Link>
    </section>
  );
}
