'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
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
/** Below this many products the link reads "Full catalog" without a count that would only underline how few there are. */
const countFrom = 12;

/**
 * One horizontal row of up to 8 recommended products (compact cards: photo, name, store price → total)
 * on the home page with a link to the whole catalog. The order is the storefront's: the operator's position,
 * then a confirmed price, then the larger discount. Phones swipe the row; wider screens also get ‹ › buttons.
 */
export function CatalogTeaser({ select }: { select: (product: Product) => void }) {
  const { state, pricing, ready, act, catalogProducts } = useMarket();
  const locale = state.communication.language as Locale, cc = catalogCopy[locale];
  const [saving, setSaving] = useState<string | null>(null);
  const items = useMemo(() => applyCatalogQuery(catalogItems(catalogProducts, pricing), emptyCatalogQuery, { dutyLimitUsd: courierAllowanceUsd }), [catalogProducts, pricing]);
  const shown = items.slice(0, 8);
  const gridId = useId();
  const grid = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true, scrolls: false });
  const measure = useCallback(() => {
    const el = grid.current;
    if (!el) return;
    const scrolls = el.scrollWidth > el.clientWidth + 1;
    setEdges({ scrolls, start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  }, []);
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => { el.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
  }, [measure, shown.length]);
  function page(direction: 1 | -1) {
    const el = grid.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direction * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
  }
  async function save(product: Product) {
    setSaving(product.id);
    try { await act({ type: 'favorite', id: product.id }); } finally { setSaving(null); }
  }
  return <TooltipProvider delayDuration={300}><section className="catalog-teaser finds-page" id="finds" data-chapter="finds" aria-labelledby="finds-title">
    <header><div><h2 id="finds-title">{cc.teaserTitle}</h2><p>{cc.teaserIntro}</p></div><div className="finds-actions"><Link className="btn secondary" href="/catalog">{items.length >= countFrom ? cc.viewAll(items.length) : cc.viewAllShort}<ArrowRight size={17} aria-hidden="true" /></Link>{edges.scrolls && <span className="finds-pager"><button type="button" className="icon-btn" aria-label={cc.teaserPrev} aria-controls={gridId} disabled={edges.start} onClick={() => page(-1)}><ChevronLeft size={20} aria-hidden="true" /></button><button type="button" className="icon-btn" aria-label={cc.teaserNext} aria-controls={gridId} disabled={edges.end} onClick={() => page(1)}><ChevronRight size={20} aria-hidden="true" /></button></span>}</div></header>
    <div className="finds-grid finds-grid-compact" id={gridId} ref={grid}>{shown.map((item) => <CatalogCard key={item.product.id} item={item} locale={locale} select={select} variant="compact" saved={state.favorites.includes(item.product.id)} canSave={ready} saving={saving !== null} onSave={() => void save(item.product)} />)}</div>
  </section></TooltipProvider>;
}
