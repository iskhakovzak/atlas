'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDownUp, ArrowRight, ChevronDown, Heart, Link2, Search, ShieldCheck, SlidersHorizontal, Store, X, type LucideIcon } from 'lucide-react';
import Link from '@/components/site-link';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { type Product } from '@/lib/market/domain';
import { catalogDeliverySpeed, catalogQuoteSpeed } from '@/lib/market/deals';
import { useMarket } from '@/lib/market/store';
import { useRowAtStart } from '@/lib/market/row-start';
import { dealCopy } from '@/lib/market/deal-copy';
import { catalogCopy, allowanceMonth } from '@/lib/market/catalog-copy';
import { catalogAllowance } from '@/lib/market/allowance';
import { courierAllowanceUsd } from '@/lib/market/customs';
import { storeBrands } from '@/lib/market/store-brands';
import { signalsFor } from '@/lib/market/catalog-signals';
import { searchWords } from '@/lib/market/catalog-synonyms';
import { browserStorage, clearRecentProducts, readRecentProducts, rememberRecentProduct, itemParam, pendingFavoriteToSave, takePendingFavorite, withoutItemParam } from '@/lib/market/catalog-links';
import { toast } from '@/lib/market/toast';
import { focusSearchKey } from '@/lib/market/shell-search';
import {
  activeFilterCount, applyCatalogQuery, catalogFacets, catalogItems, catalogQueryString, cartParcelStores, emptyCatalogQuery, filterId,
  paginate, parcelExtra, quickChipActive, quickChips, readCatalogQuery, relaxations, sameCatalogProduct, toggleQuickChip, withoutFilter,
  type CatalogContext, type CatalogItem, type CatalogQuery, type CatalogSort, type QuickChip,
} from '@/lib/market/catalog-query';
import type { Locale } from '@/lib/market/i18n';
import { CatalogCard, CatalogSkeleton } from './catalog-card';
import { ActiveFilters, attrLabel, clearedQuery, collectionName, FilterPanel, filterLabel, presentCategories, type Collection } from './catalog-filters';
import { CatalogMore, CatalogPagination } from './catalog-pagination';
import { LazyProductSheet, preloadProductSheet } from './product-sheet-lazy';
import { useSheetSide } from './use-sheet-side';
import {uzText} from '@/lib/market/uz-cyrl';
import {isUzbek} from '@/lib/market/i18n';

// Stores as the directory counts them: brands, with their country storefronts as one store.
const storeCount = storeBrands.length;
// The monthly duty-free allowance the page counts with: the same figure `catalogAllowance` subtracts orders from.
const limitUsd = courierAllowanceUsd;
type Copy = (typeof catalogCopy)['ru'];

/** Drops `?item=` from the address once its sheet is closed (or its product is gone); the filters stay. */
function dropItemParam() {
  const next = withoutItemParam(window.location.href);
  if (next !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, '', next);
}

function quickLabel(chip: QuickChip, cc: Copy, collections: Collection[], locale: Locale) {
  switch (chip.kind) {
    case 'category': return cc.categories[chip.value] ?? chip.value;
    case 'attr': return attrLabel(chip.key, chip.value, locale);
    case 'discount': return cc.quickOff(chip.value);
    case 'priceMax': return cc.quickPrice(chip.value);
    case 'collection': { const set = collections.find((item) => item.id === chip.value); return set ? collectionName(set, locale) : cc.chip.collection; }
  }
}

function QuickChipButton({ chip, query, setQuery, cc, collections, locale }: { chip: QuickChip; query: CatalogQuery; setQuery: (query: CatalogQuery) => void; cc: Copy; collections: Collection[]; locale: Locale }) {
  return <button type="button" aria-pressed={quickChipActive(query, chip)} onClick={() => setQuery(toggleQuickChip(query, chip))}>{quickLabel(chip, cc, collections, locale)}</button>;
}

/**
 * The catalog and the saved-products page. Filters, sort and page live in the URL (`?cat=shoes&size=9&page=2`), so a
 * selection can be shared and survives a reload; counts next to every option say what it shows.
 */
export function CatalogView({ mode, initial, lang }: { mode: 'catalog' | 'favorites'; initial?: CatalogQuery; lang?: string }) {
  const { state, pricing, ready, status, act, catalogProducts, catalogReady, collections, catalogError, loadCatalog } = useMarket();
  const locale = state.communication.language as Locale;
  const cc = catalogCopy[locale], copy = dealCopy(locale);
  const [query, setQueryState] = useState<CatalogQuery>(initial ?? emptyCatalogQuery);
  const [selected, setSelected] = useState<Product | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const gridRef = useRef<HTMLElement>(null);
  const side = useSheetSide();
  // "Recently viewed": ids kept on this device, read after hydration so the first render matches the server's.
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => { queueMicrotask(() => setRecentIds(readRecentProducts(browserStorage()))); }, []);
  const select = (product: Product) => { setSelected(product); setRecentIds(rememberRecentProduct(browserStorage(), product.id)); };
  useEffect(() => { void loadCatalog(); }, [loadCatalog]);
  // The header's search icon led here (app/marketplace.tsx): the search field takes the focus once.
  useEffect(() => {
    let asked = false;
    try { asked = sessionStorage.getItem(focusSearchKey) === '1'; sessionStorage.removeItem(focusSearchKey); } catch { /* private mode */ }
    if (asked) document.getElementById('catalog-search-input')?.focus({ preventScroll: false });
  }, []);
  // Pages rendered without a server query (or opened from history) take it from the address.
  useEffect(() => { if (!initial) queueMicrotask(() => setQueryState(readCatalogQuery(window.location.search))); }, [initial]);
  useEffect(() => {
    const next = window.location.pathname + catalogQueryString(query, new URLSearchParams(window.location.search)) + window.location.hash;
    if (next !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, '', next);
  }, [query]);
  // Any change of filters, sort or page size starts again at page 1; only the pager keeps the page.
  const setQuery = (next: CatalogQuery) => setQueryState({ ...next, page: 1 });
  const setPage = (page: number) => {
    setQueryState({ ...query, page });
    requestAnimationFrame(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      gridRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  };
  // Page links keep the language address (`?lang=en`, the hreflang version); the server passes it so both renders agree.
  const langParam = lang && /^[a-z]{2}(-[a-z]{2,4})?$/i.test(lang) ? lang : undefined;
  const pageHref = (page: number) => catalogQueryString({ ...query, page }, langParam ? new URLSearchParams({ lang: langParam }) : undefined) || '?';

  const items = useMemo(() => catalogItems(catalogProducts, pricing), [catalogProducts, pricing]);
  // `?item=<id>` (a product row of a store card) opens that product's sheet once the catalog is in; the sheet drops it on close.
  const itemOpened = useRef(false);
  useEffect(() => {
    if (itemOpened.current || !catalogReady) return;
    itemOpened.current = true;
    const id = itemParam(window.location.search);
    if (!id) return;
    const found = items.find((item) => item.product.id === id);
    // The address is the external system here: it is read once, after the catalog has arrived.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (found) setSelected(found.product); else dropItemParam();
  }, [catalogReady, items]);
  // A guest who tapped a heart and signed in comes back to that product saved: once, only a fresh note, only if not saved yet.
  const pendingChecked = useRef(false);
  useEffect(() => {
    if (pendingChecked.current || !ready || !catalogReady || !items.length) return;
    pendingChecked.current = true;
    const id = pendingFavoriteToSave(takePendingFavorite(browserStorage()), { now: Date.now(), catalogIds: new Set(items.map((item) => item.product.id)), favorites: state.favorites });
    if (id) void act({ type: 'favorite', id }).then((ok) => { if (ok) toast.success(copy.savedAfterLogin); });
  }, [ready, catalogReady, items, state.favorites, act, copy.savedAfterLogin]);

  const favorites = state.favorites;
  const allowance = ready ? catalogAllowance(state, pricing.fx) : null;
  const dutyLimitUsd = allowance?.remainingUsd ?? courierAllowanceUsd;
  // Everything that walks the products sits in one memo (a few thousand products, one pass per filter group): it reruns
  // when the products, the favourites, the query or the allowance change, not on every render. The context stays inside
  // it, so nothing outside can change what the memo was built from.
  const { pool, list, facets, chips, categories, suggest, options } = useMemo(() => {
    const pool = mode === 'favorites' ? items.filter((item) => favorites.includes(item.product.id)) : items;
    const context: CatalogContext = { dutyLimitUsd, collections, words: (item) => [catalogCopy[locale].categories[item.product.category] ?? '', searchWords(item, locale)].join(' ') };
    const list = applyCatalogQuery(pool, query, context);
    return {
      pool, list, facets: catalogFacets(pool, query, context),
      chips: mode === 'catalog' ? quickChips(pool, context) : [],
      categories: presentCategories(pool.map((item) => item.product.category)),
      // An empty "Saved" is not a dead end: the catalog's discounted products, ready to save.
      suggest: mode === 'favorites' && catalogReady && pool.length === 0 ? applyCatalogQuery(items, { ...emptyCatalogQuery, discount: 1 }, { ...context, collections: [] }).slice(0, 4) : [],
      options: list.length === 0 && pool.length > 0 ? relaxations(pool, query, context) : [],
    };
  // The build does not run the React Compiler, so this memo is what keeps the passes off every render; the lint rule only
  // reports that the compiler would skip the component (the results are never mutated).
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [mode, items, favorites, dutyLimitUsd, collections, locale, query, catalogReady]);
  const paged = paginate(list, query.page, query.per);
  // Phones add the next page under the grid ("Показать ещё 24"): `?page=3` there means the first three pages, so a
  // reload or a shared link shows the same products. Computers keep page numbers and the page size.
  const phone = side === 'bottom';
  const visible = phone ? list.slice(0, paged.end) : paged.items;
  // A phone opened at `?page=N` (a reload, a shared link) shows pages 1..N once it knows it is a phone: it scrolls once to
  // the first product of page N, so the reader lands where the address points, not at the top of the longer list. After
  // "Показать ещё" the focus moves to the first product added (the button it was on has moved below the new cards).
  const cardsRef = useRef<HTMLDivElement>(null);
  const landed = useRef(false), focusFrom = useRef<number | null>(null);
  useEffect(() => {
    const cards = cardsRef.current;
    if (!phone || !catalogReady || !cards) return;
    const at = focusFrom.current;
    if (at !== null) {
      focusFrom.current = null;
      cards.children[at]?.querySelector<HTMLElement>('.pcard-title > button')?.focus();
      return;
    }
    if (landed.current) return;
    landed.current = true;
    if (paged.page > 1 && window.scrollY < 8) cards.children[paged.start]?.scrollIntoView({ block: 'start' });
  }, [phone, catalogReady, paged.page, paged.start, visible.length]);
  const parcels = useMemo(() => ready ? cartParcelStores(state.cart).filter((store) => items.some((item) => item.store === store)) : [], [ready, state.cart, items]);
  // What each product of a store with a parcel in the cart adds to it: priced like the cart, so memoised per catalog and cart.
  const parcelExtras = useMemo(() => {
    const map = new Map<string, { store: string; extra: number } | null>();
    for (const item of items) if (parcels.includes(item.store)) map.set(item.product.id, parcelExtra(state.cart, item.product, item.usd, pricing));
    return map;
  }, [items, parcels, state.cart, pricing]);
  const speed = ready ? catalogQuoteSpeed(state.cart) : catalogDeliverySpeed;
  // A cart line made by the link order carries its own id (`<url>#<option>`): the source URL says it is this product.
  const inCart = (product: Product) => ready && state.cart.some((line) => sameCatalogProduct(line.product, product));
  const signalsOf = (item: CatalogItem) => signalsFor(item, { locale, pricing, parcel: parcelExtras.get(item.product.id) ?? null, inCart: inCart(item.product), member: Boolean(allowance), remainingUsd: allowance ? allowance.remainingUsd : null, dutyLimitUsd: limitUsd });
  const filterCount = activeFilterCount(query);
  const storesInCatalog = useMemo(() => new Set(items.map((item) => item.store)).size, [items]);
  // An empty "Saved" is not a dead end: the catalog's discounted products, ready to save.
  const chipsRow = useRowAtStart<HTMLDivElement>(chips.map((chip) => chip.id).join(' '));
  // Shown on the unfiltered catalog once two or more opened products are still in it; the one open now waits for the next visit.
  const recent = mode === 'catalog' && catalogReady && filterCount === 0 && !query.q && query.page === 1 ? recentIds.filter((id) => id !== selected?.id).map((id) => items.find((item) => item.product.id === id)).filter((item): item is CatalogItem => Boolean(item)).slice(0, 8) : [];

  async function save(product: Product) {
    setSaving(product.id);
    try { await act({ type: 'favorite', id: product.id }); } finally { setSaving(null); }
  }
  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try { await loadCatalog(true); } finally { setRetrying(false); }
  }

  const showControls = pool.length > 0 || filterCount > 0 || Boolean(query.q);
  // The phone's search row sticks to the top while the grid scrolls; once it does, it gets a hairline and a shadow.
  const stuckProbe = useRef<HTMLSpanElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const probe = stuckProbe.current;
    if (!probe || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(probe);
    return () => observer.disconnect();
  }, [showControls]);
  const dutyHint = allowance && allowance.usedUsd > 0 ? cc.dutyMember(allowance.remainingUsd, allowance.name) : cc.dutyGuest(limitUsd);
  const filtered = list.length !== pool.length;
  const panel = <FilterPanel query={query} setQuery={setQuery} facets={facets} cc={cc} pool={pool.length} locale={locale} dutyHint={dutyHint} categories={categories} />;

  return <TooltipProvider delayDuration={300}><div className="catalog-page finds-page" data-mode={mode}>
    <header className="catalog-head">
      <div><h1>{mode === 'favorites' ? copy.savedTitle : cc.title}</h1><p>{mode === 'favorites' ? copy.savedIntro : cc.intro}</p></div>
      {/* The row is there from the first paint (empty until the catalog arrives), so the search below
         does not move down 40 px when the stats appear (mobile CLS, 26 October 2026). */}
      {mode === 'catalog' && <div className="catalog-head-side">{catalogReady && items.length > 0 && <><p className="catalog-stats"><Store size={16} aria-hidden="true" />{cc.stats(items.length, storesInCatalog)}</p>{ready && <Link className="catalog-saved" href="/favorites"><Heart size={16} aria-hidden="true" /><span className="catalog-saved-label">{copy.saved}</span><b>{state.favorites.filter((id) => items.some((item) => item.product.id === id)).length}</b></Link>}</>}</div>}
    </header>
    {catalogError && <div className="notice catalog-fallback-message" role="status"><span>{catalogError}</span><button type="button" className="text-button catalog-retry" disabled={retrying} onClick={() => void retry()}>{retrying ? (locale === 'ru' ? 'Обновляем…' : isUzbek(locale) ? uzText(locale, 'Yangilanmoqda…') : 'Refreshing…') : (locale === 'ru' ? 'Повторить' : isUzbek(locale) ? uzText(locale, 'Qayta urinish') : 'Retry')}</button></div>}
    {mode === 'catalog' && allowance && allowance.usedUsd > 0 && <CompactBanner tone={allowance.remainingUsd > 0 ? 'ok' : 'warn'} icon={ShieldCheck} cc={cc}
      short={allowance.remainingUsd > 0 ? cc.bannerLimit(allowance.remainingUsd, limitUsd) : cc.bannerLimitSpent}
      detail={allowance.remainingUsd > 0 ? cc.allowanceLeft(allowance.remainingUsd, allowance.name, allowanceMonth(locale), limitUsd) : cc.allowanceSpent(allowance.name, allowanceMonth(locale))}
      action={allowance.remainingUsd > 0 && !query.duty ? <button type="button" className="text-button" onClick={() => setQuery({ ...query, duty: true })}>{cc.allowanceShow}</button> : null}
      more={<Link className="text-link" href="/customs">{cc.allowanceHow}</Link>} />}
    {showControls && <span ref={stuckProbe} className="catalog-sticky-probe" aria-hidden="true" />}
    {/* One row: search, "Фильтры (N)" (a sheet below 1024 px) and the sort. Sticky on phones (app/styles/catalog-pages.css):
       a sibling of the page's blocks, not inside the toolbar section, so it stays stuck over the whole grid. */}
    {showControls && <div className="catalog-sticky" role="search" aria-label={cc.search} data-stuck={stuck || undefined}>
        <label className="catalog-search"><Search size={20} aria-hidden="true" /><span className="sr-only">{cc.search}</span><input id="catalog-search-input" type="search" aria-label={cc.search} value={query.q} maxLength={80} placeholder={side === 'bottom' ? cc.searchPlaceholderShort : cc.searchPlaceholder} onChange={(event) => setQuery({ ...query, q: event.target.value })} />{query.q && <button type="button" className="icon-btn" aria-label={cc.clearSearch} onClick={() => setQuery({ ...query, q: '' })}><X size={18} /></button>}</label>
        <button type="button" className="catalog-facets-button" aria-haspopup="dialog" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={18} aria-hidden="true" /><span>{cc.filters}</span>{filterCount > 0 && <b aria-label={String(filterCount)}>{filterCount}</b>}</button>
        {/* A phone shows the sort as an icon over the native picker (the picker names the chosen order); a dot marks a changed one. */}
        <label className="catalog-sort" data-changed={query.sort !== 'best' || undefined}><span>{cc.sort}</span><ArrowDownUp size={18} aria-hidden="true" /><select value={query.sort} onChange={(event) => setQuery({ ...query, sort: event.target.value as CatalogSort })}>{(Object.keys(cc.sorts) as CatalogSort[]).map((sort) => <option key={sort} value={sort}>{cc.sorts[sort]}</option>)}</select></label>
    </div>}
    {showControls && <section className="catalog-bar" aria-label={cc.filtersTitle}>
      {/* One row of common filters: scrolls sideways on a phone, wraps on a wide screen. */}
      {chips.length > 0 && <div {...chipsRow} className="catalog-categories catalog-quick" role="group" aria-label={cc.quickLabel}>
        {chips.map((chip) => <QuickChipButton key={chip.id} chip={chip} query={query} setQuery={setQuery} cc={cc} collections={collections} locale={locale} />)}
      </div>}
      {/* The header already says how many products there are: unfiltered, the count is only announced. */}
      <span className={'catalog-found' + (filtered ? '' : ' catalog-found-quiet')} role="status">{catalogReady ? filtered ? cc.found(list.length, pool.length) : <span className="sr-only">{cc.found(list.length, pool.length)}</span> : cc.loading}</span>
      <ActiveFilters query={query} setQuery={setQuery} cc={cc} collections={collections} locale={locale} brands={facets.brands} />
    </section>}
    <div className={'catalog-layout' + (showControls ? '' : ' catalog-layout-plain')}>
      {showControls && <aside className="catalog-sidebar" aria-label={cc.filtersTitle}>{panel}</aside>}
      <section ref={gridRef} className="catalog-results" aria-label={mode === 'favorites' ? copy.saved : cc.title}>
        {/* The cards' titles are h3: the grid gets the h2 between them and the page's h1. */}
        <h2 className="sr-only">{mode === 'favorites' ? copy.saved : cc.results}</h2>
        {recent.length >= 2 && <section className="catalog-recent" aria-labelledby="catalog-recent-title">
          <div className="favorites-suggest-head"><h2 id="catalog-recent-title">{cc.recentTitle}</h2><button type="button" className="text-button" onClick={() => { clearRecentProducts(browserStorage()); setRecentIds([]); }}>{cc.recentClear}</button></div>
          <div className="finds-grid finds-grid-compact catalog-recent-row" onPointerEnter={preloadProductSheet} onFocus={preloadProductSheet}>
            {recent.map((item) => <CatalogCard key={item.product.id} variant="compact" item={item} locale={locale} select={select}
              saved={state.favorites.includes(item.product.id)} canSave={ready} guestSave={status === 'guest'} saving={saving !== null} onSave={() => void save(item.product)} speed={speed} />)}
          </div>
        </section>}
        {!catalogReady ? <CatalogSkeleton label={cc.loading} /> : visible.length > 0 ? <div ref={cardsRef} className="finds-grid" onPointerEnter={preloadProductSheet} onFocus={preloadProductSheet}>
          {visible.map((item) => <CatalogCard key={item.product.id} item={item} locale={locale} select={select}
            saved={state.favorites.includes(item.product.id)} canSave={ready} guestSave={status === 'guest'} saving={saving !== null} onSave={() => void save(item.product)}
            signals={signalsOf(item)} inCart={inCart(item.product)} speed={speed} />)}
        </div> : <EmptyResult mode={mode} empty={!pool.length} query={query} setQuery={setQuery} cc={cc} copy={copy} options={options} collections={collections} locale={locale} />}
        {suggest.length > 0 && <section className="favorites-suggest" aria-labelledby="favorites-suggest-title">
          <div className="favorites-suggest-head"><h2 id="favorites-suggest-title">{copy.suggestTitle}</h2><Link className="text-link" href="/catalog?sale=1">{copy.suggestAll}<ArrowRight size={16} aria-hidden="true" /></Link></div>
          <div className="finds-grid finds-grid-compact" onPointerEnter={preloadProductSheet} onFocus={preloadProductSheet}>
            {suggest.map((item) => <CatalogCard key={item.product.id} variant="compact" item={item} locale={locale} select={select}
              saved={state.favorites.includes(item.product.id)} canSave={ready} guestSave={status === 'guest'} saving={saving !== null} onSave={() => void save(item.product)} speed={speed} />)}
          </div>
        </section>}
        {catalogReady && visible.length > 0 && (phone
          ? <CatalogMore shown={visible.length} total={list.length} per={query.per} href={pageHref(paged.page + 1)} onMore={() => { focusFrom.current = visible.length; setQueryState({ ...query, page: paged.page + 1 }); }} cc={cc} />
          : <CatalogPagination page={paged.page} pages={paged.pages} start={paged.start} end={paged.end} total={list.length} per={query.per} href={pageHref} onPage={setPage} onPer={(per) => setQuery({ ...query, per })} cc={cc} />)}
        {visible.length > 0 && <p className="finds-price-note">{copy.priceNote}</p>}
        {status === 'guest' && mode === 'catalog' && <p className="finds-signin"><Link href="/login?return_to=%2Fcatalog"><Heart size={15} />{copy.signin}</Link></p>}
        {mode === 'catalog' && catalogReady && <section className="catalog-end">
          <div><h2>{cc.endTitle}</h2><p>{cc.endText(storeCount)}</p></div>
          <div><Link className="btn primary" href="/order-by-link"><Link2 size={18} aria-hidden="true" />{cc.endLink}</Link><Link className="btn secondary" href="/stores"><Store size={18} aria-hidden="true" />{cc.endStores}</Link></div>
        </section>}
      </section>
    </div>
    <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
      <SheetContent side={side} showCloseButton={false} className={'catalog-sheet catalog-sheet-' + side}>
        <header><SheetTitle>{cc.filtersTitle}</SheetTitle><SheetDescription className="sr-only">{cc.found(list.length, pool.length)}</SheetDescription><button type="button" className="icon-btn" aria-label={cc.close} onClick={() => setFiltersOpen(false)}><X size={20} /></button></header>
        <div className="catalog-sheet-scroll">{panel}</div>
        <footer>{filterCount > 0 && <button type="button" className="btn secondary" onClick={() => setQuery(clearedQuery(query))}>{cc.reset}</button>}<button type="button" className="btn primary" onClick={() => setFiltersOpen(false)}>{cc.show(list.length)}</button></footer>
      </SheetContent>
    </Sheet>
    <LazyProductSheet product={selected} onClose={() => { setSelected(null); dropItemParam(); }} />
  </div></TooltipProvider>;
}

/** One line (icon, short text, action); the full sentence and the "how it works" link open on tap. */
function CompactBanner({ tone, icon: Icon, short, detail, action, more, cc }: { tone: 'ok' | 'warn' | 'parcel'; icon: LucideIcon; short: string; detail: string; action?: ReactNode; more?: ReactNode; cc: Copy }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className={'catalog-banner' + (tone === 'warn' ? ' catalog-banner-warn' : tone === 'parcel' ? ' catalog-banner-parcel' : '')}>
    <div className="catalog-banner-row">
      <Icon size={18} aria-hidden="true" />
      <button type="button" className="catalog-banner-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}><span>{short}</span><ChevronDown size={16} aria-hidden="true" /><span className="sr-only">{open ? cc.collapse : cc.details}</span></button>
      {action}
    </div>
    <div id={id} className="catalog-banner-detail" hidden={!open}><p>{detail}</p>{more}</div>
  </div>;
}

function EmptyResult({ mode, empty, query, setQuery, cc, copy, options, collections, locale }: { mode: 'catalog' | 'favorites'; empty: boolean; query: CatalogQuery; setQuery: (query: CatalogQuery) => void; cc: Copy; copy: ReturnType<typeof dealCopy>; options: ReturnType<typeof relaxations>; collections: Collection[]; locale: Locale }) {
  if (mode === 'favorites' && empty) return <Panel title={copy.emptySaved} text={copy.emptySavedHint}><Link className="btn primary" href="/catalog">{copy.catalog}<ArrowRight size={17} /></Link></Panel>;
  // Nothing published yet (a fresh launch): no filters to relax, only the link order.
  if (mode === 'catalog' && empty) return <Panel title={cc.catalogEmptyTitle} text={cc.catalogEmptyHint}><Link className="btn primary" href="/order-by-link">{cc.endLink}<ArrowRight size={17} /></Link></Panel>;
  return <Panel title={cc.emptyTitle} text={cc.emptyHint}>
    {options.map(({ key, count }) => <button type="button" className="btn secondary" key={filterId(key)} onClick={() => setQuery(withoutFilter(query, key))}>{cc.without(filterLabel(key, query, cc, collections, locale), count)}</button>)}
    {activeFilterCount(query) + Number(Boolean(query.q.trim())) > 1 && <button type="button" className="btn secondary" onClick={() => setQuery({ ...clearedQuery(query), q: '' })}>{cc.resetAll}</button>}
    {mode === 'catalog' && <Link className="btn primary" href="/order-by-link">{cc.endLink}<ArrowRight size={17} /></Link>}
  </Panel>;
}

function Panel({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return <div className="catalog-empty" role="status"><h2>{title}</h2><p>{text}</p><div>{children}</div></div>;
}
