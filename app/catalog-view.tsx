'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Heart, Link2, PackageCheck, Search, ShieldCheck, SlidersHorizontal, Store, X } from 'lucide-react';
import Link from '@/components/site-link';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Product } from '@/lib/market/domain';
import { useMarket } from '@/lib/market/store';
import { dealCopy } from '@/lib/market/deal-copy';
import { catalogCopy, allowanceMonth } from '@/lib/market/catalog-copy';
import { catalogAllowance } from '@/lib/market/allowance';
import { courierAllowanceUsd } from '@/lib/market/customs';
import { storeBrands } from '@/lib/market/store-brands';
import {
  activeFilterCount, activeFilters, applyCatalogQuery, catalogFacets, catalogItems, catalogQueryString, cartParcelStores,
  categorySlugs, emptyCatalogQuery, fitsDutyFree, parcelExtra, priceBands, readCatalogQuery, relaxations, sizedCategories, storeLabel, withoutFilter,
  type CatalogContext, type CatalogQuery, type CatalogSort, type FilterKey,
} from '@/lib/market/catalog-query';
import type { Locale } from '@/lib/market/i18n';
import { CatalogCard, CatalogSkeleton, StoreMark } from './catalog-card';
import { ProductSheet } from './product-sheet';

const pageSize = 12;
// Stores as the directory counts them: brands, with their country storefronts as one store.
const storeCount = storeBrands.length;
type Copy = (typeof catalogCopy)['ru'];
type Facets = ReturnType<typeof catalogFacets>;

/**
 * The catalog and the saved-products page. Filters live in the URL (`?cat=shoes&size=9`), so a
 * selection can be shared and survives a reload; counts next to every option say what it shows.
 */
export function CatalogView({ mode, initial }: { mode: 'catalog' | 'favorites'; initial?: CatalogQuery }) {
  const { state, pricing, ready, status, act, catalogProducts, catalogReady, collections, catalogError, loadCatalog } = useMarket();
  const locale = state.communication.language as Locale;
  const cc = catalogCopy[locale], copy = dealCopy(locale);
  const [query, setQueryState] = useState<CatalogQuery>(initial ?? emptyCatalogQuery);
  const [limit, setLimit] = useState(pageSize);
  const [selected, setSelected] = useState<Product | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const side = useSheetSide();
  useEffect(() => { void loadCatalog(); }, [loadCatalog]);
  // Pages rendered without a server query (or opened from history) take it from the address.
  useEffect(() => { if (!initial) queueMicrotask(() => setQueryState(readCatalogQuery(window.location.search))); }, [initial]);
  useEffect(() => {
    const next = window.location.pathname + catalogQueryString(query, new URLSearchParams(window.location.search)) + window.location.hash;
    if (next !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, '', next);
  }, [query]);
  const setQuery = (next: CatalogQuery) => { setQueryState(next); setLimit(pageSize); };

  const items = useMemo(() => catalogItems(catalogProducts, pricing), [catalogProducts, pricing]);
  const pool = mode === 'favorites' ? items.filter((item) => state.favorites.includes(item.product.id)) : items;
  const allowance = ready ? catalogAllowance(state, pricing.fx) : null;
  const context: CatalogContext = { dutyLimitUsd: allowance?.remainingUsd ?? courierAllowanceUsd, collections, words: (item) => cc.categories[item.product.category] ?? '' };
  const list = applyCatalogQuery(pool, query, context);
  const facets = catalogFacets(pool, query, context);
  const visible = list.slice(0, limit);
  const parcels = ready ? cartParcelStores(state.cart).filter((store) => items.some((item) => item.store === store)) : [];
  const filterCount = activeFilterCount(query) - Number(Boolean(query.category)) - Number(Boolean(query.collection));
  const storesInCatalog = new Set(items.map((item) => item.store)).size;

  async function save(product: Product) {
    setSaving(product.id);
    try { await act({ type: 'favorite', id: product.id }); } finally { setSaving(null); }
  }
  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try { await loadCatalog(true); } finally { setRetrying(false); }
  }

  // Every category of this page stays visible (with its count under the other filters), so the current one never disappears.
  const categoryEntries = Object.keys(categorySlugs).filter((category) => pool.some((item) => item.product.category === category)).map((category) => [category, facets.categories.get(category) ?? 0] as const);
  const categoryAll = [...facets.categories.values()].reduce((sum, count) => sum + count, 0);
  const showControls = pool.length > 0 || activeFilterCount(query) > 0 || Boolean(query.q);

  return <TooltipProvider delayDuration={300}><div className="catalog-page finds-page" data-mode={mode}>
    <header className="catalog-head">
      <div><h1>{mode === 'favorites' ? copy.savedTitle : cc.title}</h1><p>{mode === 'favorites' ? copy.savedIntro : cc.intro}</p></div>
      {mode === 'catalog' && catalogReady && items.length > 0 && <div className="catalog-head-side"><p className="catalog-stats"><Store size={16} aria-hidden="true" />{cc.stats(items.length, storesInCatalog)}</p>{ready && <Link className="catalog-saved" href="/favorites"><Heart size={16} aria-hidden="true" />{copy.saved}<b>{state.favorites.filter((id) => items.some((item) => item.product.id === id)).length}</b></Link>}</div>}
    </header>
    {catalogError && <div className="notice catalog-fallback-message" role="status"><span>{catalogError}</span><button type="button" className="text-button catalog-retry" disabled={retrying} onClick={() => void retry()}>{retrying ? (locale === 'ru' ? 'Обновляем…' : locale === 'uz' ? 'Yangilanmoqda…' : 'Refreshing…') : (locale === 'ru' ? 'Повторить' : locale === 'uz' ? 'Qayta urinish' : 'Retry')}</button></div>}
    {mode === 'catalog' && allowance && allowance.usedUsd > 0 && <div className={'catalog-banner' + (allowance.remainingUsd > 0 ? '' : ' catalog-banner-warn')}>
      <ShieldCheck size={20} aria-hidden="true" />
      <p>{allowance.remainingUsd > 0 ? cc.allowanceLeft(allowance.remainingUsd, allowance.name, allowanceMonth(locale)) : cc.allowanceSpent(allowance.name, allowanceMonth(locale))}</p>
      <div>{allowance.remainingUsd > 0 && !query.duty && <button type="button" className="text-button" onClick={() => setQuery({ ...query, duty: true })}>{cc.allowanceShow}</button>}<Link className="text-link" href="/customs">{cc.allowanceHow}</Link></div>
    </div>}
    {mode === 'catalog' && parcels.length > 0 && <div className="catalog-banner catalog-banner-parcel">
      <PackageCheck size={20} aria-hidden="true" />
      <p>{cc.parcelBanner(parcels.map((store) => storeLabel(store, locale)).join(', '))}</p>
      {query.stores.join() !== parcels.join() && <div><button type="button" className="text-button" onClick={() => setQuery({ ...query, stores: parcels })}>{cc.parcelShow}</button></div>}
    </div>}
    {mode === 'catalog' && collections.length > 0 && <nav className="catalog-sets" aria-label={cc.collections}>
      {collections.map((collection) => <button type="button" key={collection.id} aria-pressed={query.collection === collection.id} onClick={() => setQuery({ ...query, collection: query.collection === collection.id ? '' : collection.id })}><b>{locale === 'en' ? collection.nameEn || collection.name : locale === 'uz' ? collection.nameUz || collection.name : collection.name}</b><span>{collection.productIds.length}</span></button>)}
    </nav>}
    {showControls && <section className="catalog-bar" aria-label={cc.search}>
      <label className="catalog-search"><Search size={20} aria-hidden="true" /><span className="sr-only">{cc.search}</span><input type="search" value={query.q} maxLength={80} placeholder={cc.searchPlaceholder} onChange={(event) => setQuery({ ...query, q: event.target.value })} />{query.q && <button type="button" className="icon-btn" aria-label={cc.clearSearch} onClick={() => setQuery({ ...query, q: '' })}><X size={18} /></button>}</label>
      {categoryEntries.length > 1 && <div className="catalog-categories" role="group" aria-label={cc.categoriesLabel}>
        <button type="button" aria-pressed={!query.category} onClick={() => setQuery({ ...query, category: '', sizes: [] })}>{cc.all}<span>{categoryAll}</span></button>
        {categoryEntries.map(([category, count]) => <button type="button" key={category} data-empty={count === 0 || undefined} aria-pressed={query.category === category} onClick={() => setQuery({ ...query, category: query.category === category ? '' : category, sizes: [] })}>{cc.categories[category] ?? category}<span>{count}</span></button>)}
      </div>}
      <div className="catalog-bar-row">
        <button type="button" className="catalog-facets-button" aria-haspopup="dialog" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={18} aria-hidden="true" />{cc.filters}{filterCount > 0 && <b aria-label={String(filterCount)}>{filterCount}</b>}</button>
        <span className="catalog-found" role="status">{catalogReady ? cc.found(list.length, pool.length) : cc.loading}</span>
        <label className="catalog-sort"><span>{cc.sort}</span><select value={query.sort} onChange={(event) => setQuery({ ...query, sort: event.target.value as CatalogSort })}>{(Object.keys(cc.sorts) as CatalogSort[]).map((sort) => <option key={sort} value={sort}>{cc.sorts[sort]}</option>)}</select></label>
      </div>
      <ActiveFilters query={query} setQuery={setQuery} cc={cc} collections={collections} locale={locale} />
    </section>}
    <div className={'catalog-layout' + (showControls ? '' : ' catalog-layout-plain')}>
      {showControls && <aside className="catalog-sidebar" aria-label={cc.filtersTitle}><FilterPanel query={query} setQuery={setQuery} facets={facets} cc={cc} pool={pool.length} locale={locale} dutyHint={allowance && allowance.usedUsd > 0 ? cc.dutyMember(allowance.remainingUsd, allowance.name) : cc.dutyGuest} /></aside>}
      <section className="catalog-results" aria-label={mode === 'favorites' ? copy.saved : cc.title}>
        {!catalogReady ? <CatalogSkeleton label={cc.loading} /> : visible.length > 0 ? <div className="finds-grid">
          {visible.map((item) => <CatalogCard key={item.product.id} item={item} locale={locale} select={setSelected}
            saved={state.favorites.includes(item.product.id)} canSave={ready} saving={saving !== null} onSave={() => void save(item.product)}
            parcel={parcels.includes(item.store) ? parcelExtra(state.cart, item.product, item.usd, pricing) : null}
            overLimit={item.usd !== undefined && !fitsDutyFree(item, context.dutyLimitUsd)} />)}
        </div> : <EmptyResult mode={mode} empty={!pool.length} query={query} setQuery={setQuery} cc={cc} copy={copy} options={relaxations(pool, query, context)} collections={collections} locale={locale} />}
        {visible.length < list.length && <div className="finds-pagination"><span role="status">{cc.showing(visible.length, list.length)}</span><button type="button" className="btn secondary" onClick={() => setLimit(limit + pageSize)}>{cc.more}<ArrowRight size={17} /></button></div>}
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
        <div className="catalog-sheet-scroll"><FilterPanel query={query} setQuery={setQuery} facets={facets} cc={cc} pool={pool.length} locale={locale} dutyHint={allowance && allowance.usedUsd > 0 ? cc.dutyMember(allowance.remainingUsd, allowance.name) : cc.dutyGuest} /></div>
        <footer>{filterCount > 0 && <button type="button" className="btn secondary" onClick={() => setQuery({ ...emptyCatalogQuery, q: query.q, category: query.category, sort: query.sort, collection: query.collection })}>{cc.reset}</button>}<button type="button" className="btn primary" onClick={() => setFiltersOpen(false)}>{cc.show(list.length)}</button></footer>
      </SheetContent>
    </Sheet>
    <ProductSheet product={selected} onClose={() => setSelected(null)} />
  </div></TooltipProvider>;
}

function FilterPanel({ query, setQuery, facets, cc, pool, dutyHint, locale }: { query: CatalogQuery; setQuery: (query: CatalogQuery) => void; facets: Facets; cc: Copy; pool: number; dutyHint: string; locale: Locale }) {
  const id = useId();
  const [allStores, setAllStores] = useState(false);
  const stores = facets.stores.filter(([store, count]) => count > 0 || query.stores.includes(store));
  const shownStores = allStores ? stores : stores.slice(0, 6);
  const toggle = (list: string[], value: string) => list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  const sized = sizedCategories.has(query.category);
  const anySized = facets.sizes.length > 0;
  if (!pool) return null;
  return <div className="catalog-facets">
    {stores.length > 1 && <fieldset><legend>{cc.store}</legend>
      {shownStores.map(([store, count]) => <label key={store} className="catalog-check"><input type="checkbox" checked={query.stores.includes(store)} onChange={() => setQuery({ ...query, stores: toggle(query.stores, store) })} /><StoreMark host={store} /><span>{storeLabel(store, locale)}</span><span className="catalog-count">{count}</span></label>)}
      {stores.length > 6 && <button type="button" className="text-button" aria-expanded={allStores} onClick={() => setAllStores(!allStores)}>{allStores ? cc.storesLess : cc.storesMore(stores.length - 6)}</button>}
    </fieldset>}
    <fieldset><legend>{cc.price}</legend><div className="catalog-chips">
      {priceBands.map((band) => { const count = facets.prices.get(band.id) ?? 0; if (!count && query.price !== band.id) return null; return <button type="button" key={band.id} aria-pressed={query.price === band.id} onClick={() => setQuery({ ...query, price: query.price === band.id ? '' : band.id })}>{cc.bands[band.id]}<span>{count}</span></button>; })}
    </div></fieldset>
    {(anySized || query.sizes.length > 0) && <fieldset><legend>{cc.size}</legend>
      {sized ? <><div className="catalog-chips catalog-sizes">{facets.sizes.map(([size, count]) => <button type="button" key={size} aria-pressed={query.sizes.includes(size)} onClick={() => setQuery({ ...query, sizes: toggle(query.sizes, size) })}>{size}<span>{count}</span></button>)}</div><p className="catalog-note">{cc.sizeNote}</p></> : <p className="catalog-note">{cc.sizeHint}</p>}
    </fieldset>}
    <fieldset><legend>{cc.special}</legend>
      <Switch id={id + 'duty'} checked={query.duty} onChange={(duty) => setQuery({ ...query, duty })} title={cc.duty} hint={dutyHint} count={facets.duty} />
      {(facets.sale > 0 || query.sale) && <Switch id={id + 'sale'} checked={query.sale} onChange={(sale) => setQuery({ ...query, sale })} title={cc.sale} hint={cc.saleHint} count={facets.sale} />}
      {(facets.fresh > 0 || query.fresh) && <Switch id={id + 'fresh'} checked={query.fresh} onChange={(fresh) => setQuery({ ...query, fresh })} title={cc.fresh} hint={cc.freshHint} count={facets.fresh} />}
    </fieldset>
  </div>;
}

function Switch({ id, checked, onChange, title, hint, count }: { id: string; checked: boolean; onChange: (value: boolean) => void; title: string; hint: string; count: number }) {
  return <label className="catalog-switch" htmlFor={id}>
    <input id={id} type="checkbox" role="switch" checked={checked} aria-describedby={id + '-hint'} onChange={(event) => onChange(event.target.checked)} />
    <span className="catalog-switch-track" aria-hidden="true" />
    <span className="catalog-switch-text"><b>{title}</b><small id={id + '-hint'}>{hint}</small></span>
    <span className="catalog-count">{count}</span>
  </label>;
}

function filterLabel(key: FilterKey, query: CatalogQuery, cc: Copy, collections: { id: string; name: string; nameUz?: string; nameEn?: string }[], locale: Locale) {
  switch (key.kind) {
    case 'q': return `${cc.chip.search}: ${query.q.trim()}`;
    case 'collection': { const set = collections.find((item) => item.id === query.collection); return set ? (locale === 'en' ? set.nameEn || set.name : locale === 'uz' ? set.nameUz || set.name : set.name) : cc.chip.collection; }
    case 'category': return cc.categories[query.category] ?? query.category;
    case 'store': return storeLabel(key.value, locale);
    case 'price': return query.price ? cc.bands[query.price] : cc.chip.price;
    case 'size': return `${cc.chip.size} ${key.value}`;
    case 'duty': return cc.duty;
    case 'sale': return cc.sale;
    case 'fresh': return cc.fresh;
  }
}

function ActiveFilters({ query, setQuery, cc, collections, locale }: { query: CatalogQuery; setQuery: (query: CatalogQuery) => void; cc: Copy; collections: { id: string; name: string; nameUz?: string; nameEn?: string }[]; locale: Locale }) {
  const keys = activeFilters(query).filter((key) => key.kind !== 'q' && key.kind !== 'category');
  if (!keys.length) return null;
  return <div className="catalog-active">
    {keys.map((key) => { const label = filterLabel(key, query, cc, collections, locale); return <button type="button" key={key.kind + ('value' in key ? key.value : '')} aria-label={`${cc.remove}: ${label}`} onClick={() => setQuery(withoutFilter(query, key))}><span>{label}</span><X size={14} aria-hidden="true" /></button>; })}
    {keys.length > 1 && <button type="button" className="text-button" onClick={() => setQuery({ ...emptyCatalogQuery, q: query.q, category: query.category, sort: query.sort })}>{cc.resetAll}</button>}
  </div>;
}

function EmptyResult({ mode, empty, query, setQuery, cc, copy, options, collections, locale }: { mode: 'catalog' | 'favorites'; empty: boolean; query: CatalogQuery; setQuery: (query: CatalogQuery) => void; cc: Copy; copy: ReturnType<typeof dealCopy>; options: ReturnType<typeof relaxations>; collections: { id: string; name: string; nameUz?: string; nameEn?: string }[]; locale: Locale }) {
  if (mode === 'favorites' && empty) return <Panel title={copy.emptySaved} text={copy.emptySavedHint}><Link className="btn primary" href="/catalog">{copy.catalog}<ArrowRight size={17} /></Link></Panel>;
  return <Panel title={cc.emptyTitle} text={cc.emptyHint}>
    {options.map(({ key, count }) => <button type="button" className="btn secondary" key={key.kind + ('value' in key ? key.value : '')} onClick={() => setQuery(withoutFilter(query, key))}>{cc.without(filterLabel(key, query, cc, collections, locale), count)}</button>)}
    {activeFilterCount(query) + Number(Boolean(query.q.trim())) > 1 && <button type="button" className="btn secondary" onClick={() => setQuery({ ...emptyCatalogQuery, sort: query.sort })}>{cc.resetAll}</button>}
    {mode === 'catalog' && <Link className="btn primary" href="/order-by-link">{cc.endLink}<ArrowRight size={17} /></Link>}
  </Panel>;
}

function Panel({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return <div className="catalog-empty" role="status"><h2>{title}</h2><p>{text}</p><div>{children}</div></div>;
}

/** Filters slide up from the bottom on phones and in from the right elsewhere. */
function useSheetSide() {
  const [side, setSide] = useState<'bottom' | 'right'>('right');
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => setSide(media.matches ? 'bottom' : 'right');
    queueMicrotask(update);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return side;
}
