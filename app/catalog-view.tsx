'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronDown, Heart, Link2, PackageCheck, Search, ShieldCheck, SlidersHorizontal, Store, X, type LucideIcon } from 'lucide-react';
import Link from '@/components/site-link';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cartDeliverySpeed, type Product } from '@/lib/market/domain';
import { useMarket } from '@/lib/market/store';
import { dealCopy } from '@/lib/market/deal-copy';
import { catalogCopy, allowanceMonth } from '@/lib/market/catalog-copy';
import { catalogAllowance } from '@/lib/market/allowance';
import { courierAllowanceUsd } from '@/lib/market/customs';
import { storeBrands } from '@/lib/market/store-brands';
import { signalsFor } from '@/lib/market/catalog-signals';
import { searchWords } from '@/lib/market/catalog-synonyms';
import {
  activeFilterCount, activeFilters, applyCatalogQuery, catalogFacets, catalogItems, catalogQueryString, cartParcelStores,
  categorySlugs, emptyCatalogQuery, parcelExtra, priceBands, readCatalogQuery, relaxations, sameCatalogProduct, sizedCategories, storeLabel, withoutFilter,
  type CatalogContext, type CatalogItem, type CatalogQuery, type CatalogSort, type FilterKey,
} from '@/lib/market/catalog-query';
import type { Locale } from '@/lib/market/i18n';
import { CatalogCard, CatalogSkeleton, StoreMark } from './catalog-card';
import { LazyProductSheet, preloadProductSheet } from './product-sheet-lazy';
import { useSheetSide } from './use-sheet-side';
import {uzText} from '@/lib/market/uz-cyrl';
import {isUzbek} from '@/lib/market/i18n';

const pageSize = 12;
// Stores as the directory counts them: brands, with their country storefronts as one store.
const storeCount = storeBrands.length;
const thirtyDays = 30 * 24 * 60 * 60 * 1000;
// The monthly duty-free allowance the page counts with: the same figure `catalogAllowance` subtracts orders from.
const limitUsd = courierAllowanceUsd;
type Copy = (typeof catalogCopy)['ru'];
type Facets = ReturnType<typeof catalogFacets>;
type Collection = { id: string; name: string; nameUz?: string; nameEn?: string; productIds: string[] };
/** A set on the strip: a query preset with the products it shows (covers come from the first four). */
type CatalogSet = { id: string; name: string; patch: Partial<CatalogQuery>; items: CatalogItem[] };

const collectionName = (set: { name: string; nameUz?: string; nameEn?: string }, locale: Locale) => locale === 'en' ? set.nameEn || set.name : isUzbek(locale) ? uzText(locale, set.nameUz || set.name) : set.name;

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
  const context: CatalogContext = { dutyLimitUsd: allowance?.remainingUsd ?? courierAllowanceUsd, collections, words: (item) => [cc.categories[item.product.category] ?? '', searchWords(item, locale)].join(' ') };
  const list = applyCatalogQuery(pool, query, context);
  const facets = catalogFacets(pool, query, context);
  const visible = list.slice(0, limit);
  const parcels = useMemo(() => ready ? cartParcelStores(state.cart).filter((store) => items.some((item) => item.store === store)) : [], [ready, state.cart, items]);
  // What each product of a store with a parcel in the cart adds to it: priced like the cart, so memoised per catalog and cart.
  const parcelExtras = useMemo(() => {
    const map = new Map<string, { store: string; extra: number } | null>();
    for (const item of items) if (parcels.includes(item.store)) map.set(item.product.id, parcelExtra(state.cart, item.product, item.usd, pricing));
    return map;
  }, [items, parcels, state.cart, pricing]);
  const speed = ready ? cartDeliverySpeed(state.cart) : 'express';
  // A cart line made by the link order carries its own id (`<url>#<option>`): the source URL says it is this product.
  const inCart = (product: Product) => ready && state.cart.some((line) => sameCatalogProduct(line.product, product));
  const signalsOf = (item: CatalogItem) => signalsFor(item, { locale, pricing, parcel: parcelExtras.get(item.product.id) ?? null, inCart: inCart(item.product), member: Boolean(allowance), remainingUsd: allowance ? allowance.remainingUsd : null, dutyLimitUsd: limitUsd });
  const filterCount = activeFilterCount(query) - Number(Boolean(query.category)) - Number(Boolean(query.collection));
  const storesInCatalog = new Set(items.map((item) => item.store)).size;
  const sets = mode === 'catalog' ? buildSets(pool, context, collections, Boolean(allowance && allowance.remainingUsd > 0), cc, locale) : [];

  async function save(product: Product) {
    setSaving(product.id);
    try { await act({ type: 'favorite', id: product.id }); } finally { setSaving(null); }
  }
  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try { await loadCatalog(true); } finally { setRetrying(false); }
  }
  // A set is a preset: it replaces the filters (the search stays); the active one toggles off, clearing only its own keys.
  function toggleSet(set: CatalogSet) {
    if (!setActive(query, set.patch)) { setQuery({ ...emptyCatalogQuery, q: query.q, ...set.patch }); return; }
    const cleared = Object.fromEntries((Object.keys(set.patch) as (keyof CatalogQuery)[]).map((key) => [key, emptyCatalogQuery[key]]));
    setQuery({ ...query, ...cleared });
  }

  // Every category of this page stays visible (with its count under the other filters), so the current one never disappears.
  const categoryEntries = Object.keys(categorySlugs).filter((category) => pool.some((item) => item.product.category === category)).map((category) => [category, facets.categories.get(category) ?? 0] as const);
  const categoryAll = [...facets.categories.values()].reduce((sum, count) => sum + count, 0);
  const showControls = pool.length > 0 || activeFilterCount(query) > 0 || Boolean(query.q);
  const dutyHint = allowance && allowance.usedUsd > 0 ? cc.dutyMember(allowance.remainingUsd, allowance.name) : cc.dutyGuest(limitUsd);

  return <TooltipProvider delayDuration={300}><div className="catalog-page finds-page" data-mode={mode}>
    <header className="catalog-head">
      <div><h1>{mode === 'favorites' ? copy.savedTitle : cc.title}</h1><p>{mode === 'favorites' ? copy.savedIntro : cc.intro}</p></div>
      {mode === 'catalog' && catalogReady && items.length > 0 && <div className="catalog-head-side"><p className="catalog-stats"><Store size={16} aria-hidden="true" />{cc.stats(items.length, storesInCatalog)}</p>{ready && <Link className="catalog-saved" href="/favorites"><Heart size={16} aria-hidden="true" />{copy.saved}<b>{state.favorites.filter((id) => items.some((item) => item.product.id === id)).length}</b></Link>}</div>}
    </header>
    {catalogError && <div className="notice catalog-fallback-message" role="status"><span>{catalogError}</span><button type="button" className="text-button catalog-retry" disabled={retrying} onClick={() => void retry()}>{retrying ? (locale === 'ru' ? 'Обновляем…' : isUzbek(locale) ? uzText(locale, 'Yangilanmoqda…') : 'Refreshing…') : (locale === 'ru' ? 'Повторить' : isUzbek(locale) ? uzText(locale, 'Qayta urinish') : 'Retry')}</button></div>}
    {mode === 'catalog' && allowance && allowance.usedUsd > 0 && <CompactBanner tone={allowance.remainingUsd > 0 ? 'ok' : 'warn'} icon={ShieldCheck} cc={cc}
      short={allowance.remainingUsd > 0 ? cc.bannerLimit(allowance.remainingUsd, limitUsd) : cc.bannerLimitSpent}
      detail={allowance.remainingUsd > 0 ? cc.allowanceLeft(allowance.remainingUsd, allowance.name, allowanceMonth(locale), limitUsd) : cc.allowanceSpent(allowance.name, allowanceMonth(locale))}
      action={allowance.remainingUsd > 0 && !query.duty ? <button type="button" className="text-button" onClick={() => setQuery({ ...query, duty: true })}>{cc.allowanceShow}</button> : null}
      more={<Link className="text-link" href="/customs">{cc.allowanceHow}</Link>} />}
    {mode === 'catalog' && parcels.length > 0 && <CompactBanner tone="parcel" icon={PackageCheck} cc={cc}
      short={cc.bannerParcel(parcels.map((store) => storeLabel(store, locale)).join(', '))}
      detail={cc.parcelBanner(parcels.map((store) => storeLabel(store, locale)).join(', '))}
      action={query.stores.join() !== parcels.join() ? <button type="button" className="text-button" onClick={() => setQuery({ ...query, stores: parcels })}>{cc.parcelShow}</button> : null} />}
    {sets.length > 0 && <nav className="catalog-sets" aria-label={cc.collections}>
      {sets.map((set) => <button type="button" key={set.id} className="catalog-set" aria-pressed={setActive(query, set.patch)} onClick={() => toggleSet(set)}>
        <SetCover images={set.items.slice(0, 4).map((item) => item.product.image).filter(Boolean)} />
        <b>{set.name}</b><span>{cc.setCount(set.items.length)}</span>
      </button>)}
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
      {showControls && <aside className="catalog-sidebar" aria-label={cc.filtersTitle}><FilterPanel query={query} setQuery={setQuery} facets={facets} cc={cc} pool={pool.length} locale={locale} dutyHint={dutyHint} /></aside>}
      <section className="catalog-results" aria-label={mode === 'favorites' ? copy.saved : cc.title}>
        {!catalogReady ? <CatalogSkeleton label={cc.loading} /> : visible.length > 0 ? <div className="finds-grid" onPointerEnter={preloadProductSheet} onFocus={preloadProductSheet}>
          {visible.map((item) => <CatalogCard key={item.product.id} item={item} locale={locale} select={setSelected}
            saved={state.favorites.includes(item.product.id)} canSave={ready} saving={saving !== null} onSave={() => void save(item.product)}
            signals={signalsOf(item)} inCart={inCart(item.product)} speed={speed} />)}
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
        <div className="catalog-sheet-scroll"><FilterPanel query={query} setQuery={setQuery} facets={facets} cc={cc} pool={pool.length} locale={locale} dutyHint={dutyHint} /></div>
        <footer>{filterCount > 0 && <button type="button" className="btn secondary" onClick={() => setQuery({ ...emptyCatalogQuery, q: query.q, category: query.category, sort: query.sort, collection: query.collection })}>{cc.reset}</button>}<button type="button" className="btn primary" onClick={() => setFiltersOpen(false)}>{cc.show(list.length)}</button></footer>
      </SheetContent>
    </Sheet>
    <LazyProductSheet product={selected} onClose={() => setSelected(null)} />
  </div></TooltipProvider>;
}

/** The query matches a set's preset: every patched key has the preset's value (lists compared as a whole). */
function setActive(query: CatalogQuery, patch: Partial<CatalogQuery>) {
  return (Object.keys(patch) as (keyof CatalogQuery)[]).every((key) => {
    const current = query[key], wanted = patch[key];
    return Array.isArray(current) && Array.isArray(wanted) ? current.join() === wanted.join() : current === wanted;
  });
}

/**
 * The sets strip: the operator's collections first, then presets on the existing filters (the allowance
 * for a customer with a known remainder, under 300k, on sale, newest first while something was added in
 * the last 30 days, the stores with the most products). A set needs at least three products to show, and
 * its count is what the preset shows.
 */
function buildSets(pool: CatalogItem[], context: CatalogContext, collections: Collection[], withAllowance: boolean, cc: Copy, locale: Locale): CatalogSet[] {
  const now = Date.now();
  const of = (patch: Partial<CatalogQuery>) => applyCatalogQuery(pool, { ...emptyCatalogQuery, ...patch }, context);
  const storeCounts = new Map<string, number>();
  for (const item of pool) storeCounts.set(item.store, (storeCounts.get(item.store) ?? 0) + 1);
  const topStores = [...storeCounts].filter(([, count]) => count >= 3).sort((a, b) => b[1] - a[1] || storeLabel(a[0], locale).localeCompare(storeLabel(b[0], locale))).slice(0, 4);
  const hasRecent = pool.some((item) => item.addedAt >= now - thirtyDays);
  const sets: CatalogSet[] = [
    ...collections.map((set) => ({ id: 'set:' + set.id, name: collectionName(set, locale), patch: { collection: set.id }, items: of({ collection: set.id }) })),
    ...(withAllowance ? [{ id: 'limit', name: cc.sets.limit(limitUsd), patch: { duty: true }, items: of({ duty: true }) }] : []),
    { id: 'cheap', name: cc.sets.cheap, patch: { price: 'to-300k' as const }, items: of({ price: 'to-300k' }) },
    { id: 'sale', name: cc.sets.sale, patch: { sale: true }, items: of({ sale: true }) },
    ...(hasRecent ? [{ id: 'new', name: cc.sets.new, patch: { sort: 'new' as const }, items: of({ sort: 'new' }) }] : []),
    ...topStores.map(([store]) => ({ id: 'store:' + store, name: cc.sets.from(storeLabel(store, locale)), patch: { stores: [store] }, items: of({ stores: [store] }) })),
  ];
  return sets.filter((set) => set.items.length >= 3);
}

/** A 2×2 collage of the set's first four photos on a white stage; fewer than four (a failed one dropped) shows the first large. */
function SetCover({ images }: { images: string[] }) {
  const [failed, setFailed] = useState<string[]>([]);
  const live = images.filter((src) => !failed.includes(src));
  const single = live.length < 4;
  return <span className="catalog-set-cover" data-single={single || undefined} aria-hidden="true">
    {/* Merchant photos stay direct public URLs, like everywhere on the storefront; a photo the store no longer serves leaves the collage. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {(single ? live.slice(0, 1) : live).map((src, index) => <img key={src + index} src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed((list) => list.includes(src) ? list : [...list, src])} />)}
  </span>;
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
    {/* All three conditions stay in place; one that shows nothing is disabled with its zero, not hidden. */}
    <fieldset><legend>{cc.special}</legend>
      <Switch id={id + 'duty'} checked={query.duty} onChange={(duty) => setQuery({ ...query, duty })} title={cc.duty} hint={dutyHint} count={facets.duty} />
      <Switch id={id + 'sale'} checked={query.sale} onChange={(sale) => setQuery({ ...query, sale })} title={cc.sale} hint={cc.saleHint} count={facets.sale} />
      <Switch id={id + 'fresh'} checked={query.fresh} onChange={(fresh) => setQuery({ ...query, fresh })} title={cc.fresh} hint={cc.freshHint} count={facets.fresh} />
    </fieldset>
  </div>;
}

function Switch({ id, checked, onChange, title, hint, count }: { id: string; checked: boolean; onChange: (value: boolean) => void; title: string; hint: string; count: number }) {
  const disabled = count === 0 && !checked;
  return <label className="catalog-switch" htmlFor={id} data-disabled={disabled || undefined}>
    <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} aria-describedby={id + '-hint'} onChange={(event) => onChange(event.target.checked)} />
    <span className="catalog-switch-track" aria-hidden="true" />
    <span className="catalog-switch-text"><b>{title}</b><small id={id + '-hint'}>{hint}</small></span>
    <span className="catalog-count">{count}</span>
  </label>;
}

function filterLabel(key: FilterKey, query: CatalogQuery, cc: Copy, collections: Collection[], locale: Locale) {
  switch (key.kind) {
    case 'q': return `${cc.chip.search}: ${query.q.trim()}`;
    case 'collection': { const set = collections.find((item) => item.id === query.collection); return set ? collectionName(set, locale) : cc.chip.collection; }
    case 'category': return cc.categories[query.category] ?? query.category;
    case 'store': return storeLabel(key.value, locale);
    case 'price': return query.price ? cc.bands[query.price] : cc.chip.price;
    case 'size': return `${cc.chip.size} ${key.value}`;
    case 'duty': return cc.duty;
    case 'sale': return cc.sale;
    case 'fresh': return cc.fresh;
  }
}

function ActiveFilters({ query, setQuery, cc, collections, locale }: { query: CatalogQuery; setQuery: (query: CatalogQuery) => void; cc: Copy; collections: Collection[]; locale: Locale }) {
  const keys = activeFilters(query).filter((key) => key.kind !== 'q' && key.kind !== 'category');
  if (!keys.length) return null;
  return <div className="catalog-active">
    {keys.map((key) => { const label = filterLabel(key, query, cc, collections, locale); return <button type="button" key={key.kind + ('value' in key ? key.value : '')} aria-label={`${cc.remove}: ${label}`} onClick={() => setQuery(withoutFilter(query, key))}><span>{label}</span><X size={14} aria-hidden="true" /></button>; })}
    {keys.length > 1 && <button type="button" className="text-button" onClick={() => setQuery({ ...emptyCatalogQuery, q: query.q, category: query.category, sort: query.sort })}>{cc.resetAll}</button>}
  </div>;
}

function EmptyResult({ mode, empty, query, setQuery, cc, copy, options, collections, locale }: { mode: 'catalog' | 'favorites'; empty: boolean; query: CatalogQuery; setQuery: (query: CatalogQuery) => void; cc: Copy; copy: ReturnType<typeof dealCopy>; options: ReturnType<typeof relaxations>; collections: Collection[]; locale: Locale }) {
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
