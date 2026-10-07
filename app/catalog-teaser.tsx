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
import { DeliverySky, type Spark } from './delivery-sky';

const findsRoutes = ['M-40 130 C 300 -10, 760 30, 1240 170','M-40 640 C 380 520, 820 720, 1240 560','M180 -30 C 420 250, 800 290, 1080 -30'];
const findsSparks: Spark[] = [[3,12,8,0,false],[18,4,6,2.6,true],[47,6,7,4.2,false],[71,3,6,1.4,true],[96,14,8,3.4,false],[2,92,6,5.2,true],[38,97,7,1.9,false],[64,95,6,3.9,true],[97,90,7,.7,false]];

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
  const page = useCallback((direction: 1 | -1) => {
    const el = grid.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direction * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
  }, []);
  // Owner, 7.10.2026: ← / → page the picks while this sheet holds the middle of the window. Fields, sliders, tabs,
  // menus and open dialogs keep their own arrows.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      const el = grid.current, section = el?.closest('section');
      if (!el || !section || el.scrollWidth <= el.clientWidth + 1) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="slider"], [role="tablist"], [role="radiogroup"], [role="listbox"], [role="menu"], [role="menubar"], [role="grid"], dialog[open], [aria-modal="true"]')) return;
      if (document.querySelector('dialog[open], [aria-modal="true"]')) return;
      const box = section.getBoundingClientRect(), middle = window.innerHeight / 2;
      if (box.top > middle || box.bottom < middle) return;
      e.preventDefault();
      page(e.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page]);
  async function save(product: Product) {
    setSaving(product.id);
    try { await act({ type: 'favorite', id: product.id }); } finally { setSaving(null); }
  }
  return <TooltipProvider delayDuration={300}><section className="catalog-teaser finds-page" id="finds" data-chapter="finds" aria-labelledby="finds-title">
   {/* Owner, 7.10.2026: the delivery sky around the picks (app/delivery-sky.tsx). */}
   <DeliverySky className="home-finds-sky" viewBox="0 0 1200 700" routes={findsRoutes} sparks={findsSparks}/>
    <header><div><h2 id="finds-title">{cc.teaserTitle}</h2><p>{cc.teaserIntro}</p></div><div className="finds-actions"><Link className="btn secondary" href="/catalog">{items.length >= countFrom ? cc.viewAll(items.length) : cc.viewAllShort}<ArrowRight size={17} aria-hidden="true" /></Link>{edges.scrolls && <span className="finds-pager"><button type="button" className="icon-btn" aria-label={cc.teaserPrev} aria-controls={gridId} disabled={edges.start} onClick={() => page(-1)}><ChevronLeft size={20} aria-hidden="true" /></button><button type="button" className="icon-btn" aria-label={cc.teaserNext} aria-controls={gridId} disabled={edges.end} onClick={() => page(1)}><ChevronRight size={20} aria-hidden="true" /></button></span>}</div></header>
    <div className="finds-grid finds-grid-compact" id={gridId} ref={grid}>{shown.map((item) => <CatalogCard key={item.product.id} item={item} locale={locale} select={select} variant="compact" saved={state.favorites.includes(item.product.id)} canSave={ready} saving={saving !== null} onSave={() => void save(item.product)} />)}</div>
  </section></TooltipProvider>;
}
