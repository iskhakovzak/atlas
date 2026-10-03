'use client';

import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Link from '@/components/site-link';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Product } from '@/lib/market/domain';
import { useMarket } from '@/lib/market/store';
import { catalogCopy } from '@/lib/market/catalog-copy';
import { applyCatalogQuery, catalogItems, emptyCatalogQuery } from '@/lib/market/catalog-query';
import { courierAllowanceUsd } from '@/lib/market/customs';
import type { Locale } from '@/lib/market/i18n';
import { CatalogCard } from './catalog-card';

/** The home page shows a teaser from this many catalog products; the full list lives on /catalog. */
export const teaserMinimum = 4;

/** A row (or two) of recommended products on the home page with a link to the whole catalog. */
export function CatalogTeaser({ select }: { select: (product: Product) => void }) {
  const { state, pricing, ready, act, catalogProducts } = useMarket();
  const locale = state.communication.language as Locale, cc = catalogCopy[locale];
  const [saving, setSaving] = useState<string | null>(null);
  const items = useMemo(() => applyCatalogQuery(catalogItems(catalogProducts, pricing), emptyCatalogQuery, { dutyLimitUsd: courierAllowanceUsd }), [catalogProducts, pricing]);
  const shown = items.slice(0, items.length >= 8 ? 8 : teaserMinimum);
  async function save(product: Product) {
    setSaving(product.id);
    try { await act({ type: 'favorite', id: product.id }); } finally { setSaving(null); }
  }
  return <TooltipProvider delayDuration={300}><section className="catalog-teaser finds-page" id="finds" aria-labelledby="finds-title">
    <header><div><h2 id="finds-title">{cc.teaserTitle}</h2><p>{cc.teaserIntro}</p></div><Link className="btn secondary" href="/catalog">{cc.viewAll(items.length)}<ArrowRight size={17} aria-hidden="true" /></Link></header>
    <div className="finds-grid">{shown.map((item) => <CatalogCard key={item.product.id} item={item} locale={locale} select={select} saved={state.favorites.includes(item.product.id)} canSave={ready} saving={saving !== null} onSave={() => void save(item.product)} />)}</div>
  </section></TooltipProvider>;
}
