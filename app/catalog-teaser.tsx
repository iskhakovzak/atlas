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
import { preloadProductSheet } from './product-sheet-lazy';
// Styles of this lazily loaded part: they arrive with its chunk, before it renders.
import './styles/catalog-cards.css';

/** Below this many products the link reads "Full catalog" without a count that would only underline how few there are. */
const countFrom = 12;

/**
 * The home page's first-screen rail: up to 8 recommended products (compact cards: photo, name, the sum in soum with
 * delivery to Tashkent as the main number, the store price small under it) and a link to the whole catalog. The order
 * is the storefront's: the operator's position, then a confirmed price, then the larger discount. Phones swipe the row;
 * wider screens also get ‹ › buttons when it overflows.
 */
export function CatalogTeaser({ select }: { select: (product: Product) => void }) {
  const { state, pricing, ready, act, catalogProducts } = useMarket();
  const locale = state.communication.language as Locale, cc = catalogCopy[locale];
  const [saving] = useState<string | null>(null);
  const items = useMemo(() => applyCatalogQuery(catalogItems(catalogProducts, pricing), emptyCatalogQuery, { dutyLimitUsd: courierAllowanceUsd }), [catalogProducts, pricing]);
  const shown = items.slice(0, 8);
  const trackId = useId();
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true, scrolls: false });
  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const scrolls = el.scrollWidth > el.clientWidth + 1;
    setEdges({ scrolls, start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  }, []);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.addEventListener('scroll', measure, { passive: true });
    // Measured when the browser has laid the row out (and on every resize), not right after mounting: reading the
    // widths then forced a layout of the whole home page in the middle of opening it (10.10.2026).
    if (typeof ResizeObserver !== 'function') { measure(); return () => el.removeEventListener('scroll', measure); }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', measure); ro.disconnect(); };
  }, [measure, shown.length]);
  const page = useCallback((direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direction * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
  }, []);
  async function save(product: Product) {
    // Optimistic (lib/market/optimistic.ts): the heart changes at once and stays tappable; the request is queued.
    await act({ type: 'favorite', id: product.id });
  }
  return <TooltipProvider delayDuration={300}><section className="home-rail" id="finds" aria-labelledby="finds-title">
    <div className="home-rail-head">
      <div><h2 id="finds-title">{cc.teaserTitle}</h2><p>{cc.teaserIntro}</p></div>
      {edges.scrolls && <span className="home-rail-pager"><button type="button" className="icon-btn" aria-label={cc.teaserPrev} aria-controls={trackId} disabled={edges.start} onClick={() => page(-1)}><ChevronLeft size={20} aria-hidden="true" /></button><button type="button" className="icon-btn" aria-label={cc.teaserNext} aria-controls={trackId} disabled={edges.end} onClick={() => page(1)}><ChevronRight size={20} aria-hidden="true" /></button></span>}
      <Link className="home-rail-all" href="/catalog">{items.length >= countFrom ? cc.viewAll(items.length) : cc.viewAllShort}<ArrowRight size={16} aria-hidden="true" /></Link>
    </div>
    <div className="home-rail-track" id={trackId} ref={track} onPointerEnter={preloadProductSheet} onFocus={preloadProductSheet}>{shown.map((item) => <CatalogCard key={item.product.id} item={item} locale={locale} select={select} variant="compact" saved={state.favorites.includes(item.product.id)} canSave={ready} saving={saving !== null} onSave={() => void save(item.product)} />)}</div>
  </section></TooltipProvider>;
}
