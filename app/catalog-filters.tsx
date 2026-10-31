'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { facetDefinitions, facetValueLabel, type FacetKey } from '@/lib/market/catalog-facets';
import { catalogCopy } from '@/lib/market/catalog-copy';
import {
  activeFilters, categorySlugs, discountSteps, emptyCatalogQuery, filterId, parseSizeKey, sizeChosen, storeLabel, toggleSize, withoutFilter,
  type CatalogFacetCounts, type CatalogQuery, type FilterKey,
} from '@/lib/market/catalog-query';
import { isUzbek, type Locale } from '@/lib/market/i18n';
import { uzText } from '@/lib/market/uz-cyrl';
import { StoreMark } from './catalog-card';
import { Swatch } from './catalog-swatch';

type Copy = (typeof catalogCopy)['ru'];
export type Collection = { id: string; name: string; nameUz?: string; nameEn?: string; productIds: string[] };

export const collectionName = (set: { name: string; nameUz?: string; nameEn?: string }, locale: Locale) => locale === 'en' ? set.nameEn || set.name : isUzbek(locale) ? uzText(locale, set.nameUz || set.name) : set.name;
const facetLocale = (locale: Locale) => locale === 'en' ? 'en' as const : isUzbek(locale) ? 'uz' as const : 'ru' as const;
/** A facet value in the page language (Uzbek Cyrillic is the Latin label transliterated). */
export function attrLabel(key: FacetKey, slug: string, locale: Locale) {
  const text = facetValueLabel(key, slug, facetLocale(locale));
  return isUzbek(locale) ? uzText(locale, text) : text;
}
function groupLabel(key: FacetKey, locale: Locale) {
  const label = facetDefinitions.find((item) => item.key === key)?.label;
  if (!label) return key;
  const text = label[facetLocale(locale)];
  return isUzbek(locale) ? uzText(locale, text) : text;
}
const groupsKey = 'atlas.catalog.groups';
const openByDefault = new Set(['category', 'department', 'type', 'size', 'color', 'discount', 'price']);
/** Which groups are open: the first ones by default; what the shopper opened or closed is kept for this tab. */
function useOpenGroups() {
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  useEffect(() => {
    queueMicrotask(() => {
      try { const value = JSON.parse(window.sessionStorage.getItem(groupsKey) ?? '{}'); if (value && typeof value === 'object') setSaved(value as Record<string, boolean>); } catch { /* storage blocked: defaults */ }
    });
  }, []);
  const isOpen = (id: string, chosen: number) => saved[id] ?? (chosen > 0 || openByDefault.has(id));
  const toggle = (id: string, open: boolean) => setSaved((current) => {
    if (current[id] === open) return current;
    const next = { ...current, [id]: open };
    try { window.sessionStorage.setItem(groupsKey, JSON.stringify(next)); } catch { /* not kept */ }
    return next;
  });
  return { isOpen, toggle };
}

function Group({ id, title, chosen, open, onToggle, cc, children }: { id: string; title: string; chosen: number; open: boolean; onToggle: (id: string, open: boolean) => void; cc: Copy; children: ReactNode }) {
  return <details className="catalog-group" data-group={id} open={open} onToggle={(event) => onToggle(id, event.currentTarget.open)}>
    <summary><span>{title}</span>{chosen > 0 && <b aria-label={cc.selected(chosen)}>{chosen}</b>}<ChevronDown size={18} aria-hidden="true" /></summary>
    <fieldset><legend className="sr-only">{title}</legend>{children}</fieldset>
  </details>;
}

type Option = { value: string; label: ReactNode; text: string; count: number; mark?: ReactNode };
/** Checkboxes, six at first and "N more" for the rest; a chosen value stays in view. */
function CheckList({ options, chosen, onToggle, cc, limit = 6 }: { options: Option[]; chosen: string[]; onToggle: (value: string) => void; cc: Copy; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? options : options.filter((option, index) => index < limit || chosen.includes(option.value));
  return <>
    {shown.map((option) => <label key={option.value} className="catalog-check" data-empty={option.count === 0 || undefined}>
      <input type="checkbox" checked={chosen.includes(option.value)} onChange={() => onToggle(option.value)} />
      {option.mark}<span>{option.label}</span><span className="catalog-count">{option.count}</span>
    </label>)}
    {options.length > limit && <button type="button" className="text-button" aria-expanded={all} onClick={() => setAll(!all)}>{all ? cc.storesLess : cc.storesMore(options.length - shown.length)}</button>}
  </>;
}

/** Packs, memory and volume read in size order: "3", "128gb" < "1tb", "50ml" < "1l". */
const measured = new Set<FacetKey>(['pack', 'storage', 'volume']);
const measure = (slug: string) => (parseFloat(slug) || 0) * (/tb$|\dl$/.test(slug) ? 1000 : 1);
const toggled = (list: string[], value: string) => list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/**
 * The filter groups in panel order. A group shows only when it splits the products the other filters leave
 * (and, for product attributes, when at least a fifth of them have that attribute); a chosen one always stays.
 */
export function FilterPanel({ query, setQuery, facets, cc, pool, dutyHint, locale, categories }: {
  query: CatalogQuery; setQuery: (query: CatalogQuery) => void; facets: CatalogFacetCounts; cc: Copy; pool: number; dutyHint: string; locale: Locale;
  /** Categories of the page's products, in the catalog's order. */
  categories: string[];
}) {
  const id = useId();
  const { isOpen, toggle } = useOpenGroups();
  if (!pool) return null;
  const group = (key: string, title: string, chosen: number, children: ReactNode) => <Group key={key} id={key} title={title} chosen={chosen} open={isOpen(key, chosen)} onToggle={toggle} cc={cc}>{children}</Group>;
  const setAttr = (key: FacetKey, value: string) => { const values = toggled(query.attrs[key] ?? [], value); const attrs = { ...query.attrs, [key]: values }; if (!values.length) delete attrs[key]; setQuery({ ...query, attrs }); };
  const attrGroup = (key: FacetKey) => {
    const facet = facets.attrs[key], chosen = query.attrs[key] ?? [];
    if (!facet.visible) return null;
    const known = facetDefinitions.find((item) => item.key === key)?.values.map((value) => value.slug) ?? [];
    // Dictionary order for named values (sizes of a scale read better in order); counts decide for the rest.
    const values = [...facet.values.filter(([, count]) => count > 0), ...chosen.filter((value) => !facet.values.some(([slug, count]) => slug === value && count > 0)).map((value) => [value, 0] as [string, number])]
      .sort((a, b) => measured.has(key) ? measure(a[0]) - measure(b[0]) : key === 'type' || key === 'color' ? b[1] - a[1] : (known.indexOf(a[0]) + 1 || 99) - (known.indexOf(b[0]) + 1 || 99));
    const options: Option[] = values.map(([value, count]) => { const text = attrLabel(key, value, locale); return { value, text, label: text, count, mark: key === 'color' ? <Swatch family={value} /> : undefined }; });
    return group(key, groupLabel(key, locale), chosen.length, <div><CheckList options={options} chosen={chosen} onToggle={(value) => setAttr(key, value)} cc={cc} limit={key === 'color' ? 15 : 6} /></div>);
  };
  // Every category of the page stays listed with its count under the other filters, so the chosen one never disappears.
  const categoryOptions: Option[] = categories.map((category) => { const text = cc.categories[category] ?? category; return { value: category, text, label: text, count: facets.categories.get(category) ?? 0 }; });
  const categoryBase = [...facets.categories.values()].reduce((sum, value) => sum + value, 0);
  const categorySplits = categoryOptions.some((option) => option.count > 0 && option.count < categoryBase);
  const sizeGroups = [['shoes', cc.sizeShoes, facets.sizes.shoes], ['clothes', cc.sizeClothes, facets.sizes.clothes]] as const;
  const sizeLists = sizeGroups.filter(([, , list]) => list.length > 0);
  const discountOptions = discountSteps.filter((step) => { const count = facets.discounts.get(step) ?? 0; return query.discount === step || (count > 0 && count < facets.discountBase); });
  // Shown while some threshold narrows the list (on an all-discounted catalogue "any discount" does not, "50 % or more" does).
  const showDiscount = query.discount > 0 || [...facets.discounts.values()].some((count) => count > 0 && count < facets.discountBase);
  const showPrice = Boolean(query.priceMin || query.priceMax) || (facets.price.count > 1 && facets.price.max > facets.price.min);
  const stores = facets.stores.filter(([store, count]) => count > 0 || query.stores.includes(store));
  const brands = facets.brands.filter(([brand, , count]) => count > 0 || query.brands.includes(brand));
  const second: FacetKey[] = ['sport', 'material', 'fit', 'sleeve', 'closure', 'pack', 'storage', 'volume'];
  return <div className="catalog-facets">
    {(categorySplits || query.categories.length > 0) && categoryOptions.length > 1 && group('category', cc.category, query.categories.length,
      <CheckList options={categoryOptions} chosen={query.categories} onToggle={(value) => setQuery({ ...query, categories: toggled(query.categories, value), sizes: [], stock: false })} cc={cc} limit={8} />)}
    {attrGroup('department')}
    {attrGroup('type')}
    {(facets.sizes.visible || query.sizes.length > 0) && group('size', cc.size, query.sizes.length, <>
      {sizeLists.map(([kind, title, list]) => <div key={kind} className="catalog-size-group">
        {sizeLists.length > 1 && <p className="catalog-subhead">{title}</p>}
        <SizeChips sizes={list} chosen={(size) => sizeChosen(query.sizes, kind, size)} cc={cc} onToggle={(size) => { const sizes = toggleSize(query.sizes, kind, size); setQuery({ ...query, sizes, stock: query.stock && sizes.length > 0 }); }} />
      </div>)}
      <p className="catalog-note">{cc.sizeNote}</p>
    </>)}
    {attrGroup('color')}
    {showDiscount && group('discount', cc.discount, Number(query.discount > 0), <div role="radiogroup" aria-label={cc.discount}>
      {[0, ...discountOptions].map((step) => <label key={step} className="catalog-check catalog-radio">
        <input type="radio" name={id + 'discount'} checked={query.discount === step} onChange={() => setQuery({ ...query, discount: step })} />
        <span>{step === 0 ? cc.discountAny : step === 1 ? cc.discountSome : cc.discountFrom(step)}</span>
        {step > 0 && <span className="catalog-count">{facets.discounts.get(step as (typeof discountSteps)[number]) ?? 0}</span>}
      </label>)}
    </div>)}
    {showPrice && group('price', cc.price, Number(Boolean(query.priceMin || query.priceMax)),
      <PriceRange key={`${query.priceMin}-${query.priceMax}-${facets.price.min}-${facets.price.max}`} min={facets.price.min} max={facets.price.max} from={query.priceMin} to={query.priceMax} cc={cc} locale={locale}
        onCommit={(priceMin, priceMax) => { if (priceMin !== query.priceMin || priceMax !== query.priceMax) setQuery({ ...query, priceMin, priceMax }); }} />)}
    {second.map((key) => attrGroup(key))}
    {brands.length > 1 && group('brand', cc.brand, query.brands.length,
      <CheckList options={brands.map(([brand, name, count]) => ({ value: brand, text: name, label: name, count }))} chosen={query.brands} onToggle={(value) => setQuery({ ...query, brands: toggled(query.brands, value) })} cc={cc} />)}
    {stores.length > 1 && group('store', cc.store, query.stores.length,
      <CheckList options={stores.map(([store, count]) => { const text = storeLabel(store, locale); return { value: store, text, label: text, count, mark: <StoreMark host={store} /> }; })} chosen={query.stores} onToggle={(value) => setQuery({ ...query, stores: toggled(query.stores, value) })} cc={cc} />)}
    {/* The conditions stay in place; one that shows nothing is disabled with its zero, not hidden. */}
    {group('special', cc.special, Number(query.duty) + Number(query.fresh) + Number(query.stock && query.sizes.length > 0), <>
      <Switch id={id + 'duty'} checked={query.duty} onChange={(duty) => setQuery({ ...query, duty })} title={cc.duty} hint={dutyHint} count={facets.duty} />
      <Switch id={id + 'fresh'} checked={query.fresh} onChange={(fresh) => setQuery({ ...query, fresh })} title={cc.fresh} hint={cc.freshHint} count={facets.fresh} />
      {query.sizes.length > 0 && <Switch id={id + 'stock'} checked={query.stock} onChange={(stock) => setQuery({ ...query, stock })} title={cc.stock} hint={cc.stockHint} count={facets.stock} />}
    </>)}
  </div>;
}

/** Size chips are real checkboxes (keyboard and screen readers), drawn as chips; long scales show the first 18. */
function SizeChips({ sizes, chosen, onToggle, cc }: { sizes: [string, number][]; chosen: (size: string) => boolean; onToggle: (size: string) => void; cc: Copy }) {
  const [all, setAll] = useState(false);
  const limit = 18;
  const shown = all ? sizes : sizes.filter(([size], index) => index < limit || chosen(size));
  return <div className="catalog-size-chips">
    {shown.map(([size, count]) => <label key={size} className="catalog-size-chip">
      <input type="checkbox" checked={chosen(size)} onChange={() => onToggle(size)} />
      <span>{size}</span><small className="catalog-count">{count}</small>
    </label>)}
    {sizes.length > limit && <button type="button" className="text-button" aria-expanded={all} onClick={() => setAll(!all)}>{all ? cc.storesLess : cc.storesMore(sizes.length - shown.length)}</button>}
  </div>;
}

const digits = (text: string) => Number(text.replace(/\D/g, '').slice(0, 10)) || 0;
const niceStep = (span: number) => [1_000, 5_000, 10_000, 50_000, 100_000, 500_000].find((step) => span / step <= 200) ?? 1_000_000;
/**
 * Delivered total from–to in soum: two fields and a two-thumb slider over the products the other filters leave.
 * The value is applied when a thumb is released or a field is left, so dragging does not re-filter on every step.
 * A bound at the edge of the range is no bound.
 */
function PriceRange({ min, max, from, to, cc, locale, onCommit }: { min: number; max: number; from: number; to: number; cc: Copy; locale: Locale; onCommit: (min: number, max: number) => void }) {
  const step = niceStep(Math.max(1, max - min));
  const low = Math.floor(Math.min(min, from || min) / step) * step, high = Math.ceil(Math.max(max, to || max) / step) * step;
  const [lo, setLo] = useState(from ? Math.max(low, from) : low), [hi, setHi] = useState(to ? Math.min(high, to) : high);
  const [loText, setLoText] = useState(''), [hiText, setHiText] = useState('');
  const format = (value: number) => new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU').format(value);
  const commit = (nextLo = lo, nextHi = hi) => {
    const [a, b] = nextLo <= nextHi ? [nextLo, nextHi] : [nextHi, nextLo];
    // A bound already in the query stays even at the edge (the edge was widened to show it); a new one at the edge is none.
    onCommit(a > low || (from > 0 && a === from) ? a : 0, b < high || (to > 0 && b === to) ? b : 0);
  };
  const field = (value: number, text: string, setText: (text: string) => void, apply: (value: number) => void, label: string, prefix: string) => <label className="catalog-price-field">
    <span aria-hidden="true">{prefix}</span>
    <input type="text" inputMode="numeric" autoComplete="off" aria-label={label} value={text || format(value)}
      onFocus={(event) => { setText(String(value)); event.currentTarget.select(); }}
      onChange={(event) => setText(event.target.value.replace(/[^\d\s]/g, ''))}
      onBlur={() => { if (text) apply(digits(text)); setText(''); }}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
  </label>;
  const percent = (value: number) => high > low ? ((value - low) / (high - low)) * 100 : 0;
  return <div className="catalog-price">
    <div className="catalog-price-fields">
      {field(lo, loText, setLoText, (value) => { const next = Math.min(Math.max(low, value), hi); setLo(next); commit(next, hi); }, cc.priceMinLabel, cc.priceFrom)}
      {field(hi, hiText, setHiText, (value) => { const next = Math.max(Math.min(high, value || high), lo); setHi(next); commit(lo, next); }, cc.priceMaxLabel, cc.priceTo)}
    </div>
    <div className="catalog-range" style={{ ['--lo' as string]: percent(lo) + '%', ['--hi' as string]: percent(hi) + '%' }}>
      <input type="range" min={low} max={high} step={step} value={lo} aria-label={cc.priceMinLabel} aria-valuetext={format(lo)}
        onChange={(event) => setLo(Math.min(Number(event.target.value), hi))} onPointerUp={() => commit()} onKeyUp={() => commit()} onBlur={() => commit()} />
      <input type="range" min={low} max={high} step={step} value={hi} aria-label={cc.priceMaxLabel} aria-valuetext={format(hi)}
        onChange={(event) => setHi(Math.max(Number(event.target.value), lo))} onPointerUp={() => commit()} onKeyUp={() => commit()} onBlur={() => commit()} />
    </div>
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

export function filterLabel(key: FilterKey, query: CatalogQuery, cc: Copy, collections: Collection[], locale: Locale, brands?: CatalogFacetCounts['brands']) {
  switch (key.kind) {
    case 'q': return `${cc.chip.search}: ${query.q.trim()}`;
    case 'collection': { const set = collections.find((item) => item.id === query.collection); return set ? collectionName(set, locale) : cc.chip.collection; }
    case 'category': return cc.categories[key.value] ?? key.value;
    case 'attr': return attrLabel(key.key, key.value, locale);
    case 'store': return storeLabel(key.value, locale);
    case 'brand': return brands?.find(([brand]) => brand === key.value)?.[1] || key.value;
    case 'price': return cc.priceChip(query.priceMin, query.priceMax);
    case 'size': return `${cc.chip.size} ${parseSizeKey(key.value).size}`;
    case 'discount': return cc.chip.discount(query.discount);
    case 'duty': return cc.duty;
    case 'fresh': return cc.fresh;
    case 'stock': return cc.stock;
  }
}

/** The chosen filters above the grid, each removable, with "Clear all" once there are two. */
export function ActiveFilters({ query, setQuery, cc, collections, locale, brands }: { query: CatalogQuery; setQuery: (query: CatalogQuery) => void; cc: Copy; collections: Collection[]; locale: Locale; brands?: CatalogFacetCounts['brands'] }) {
  const keys = activeFilters(query).filter((key) => key.kind !== 'q');
  if (!keys.length) return null;
  return <div className="catalog-active">
    {keys.map((key) => { const label = filterLabel(key, query, cc, collections, locale, brands); return <button type="button" key={filterId(key)} aria-label={`${cc.remove}: ${label}`} onClick={() => setQuery(withoutFilter(query, key))}>{key.kind === 'attr' && key.key === 'color' && <Swatch family={key.value} />}<span>{label}</span><X size={14} aria-hidden="true" /></button>; })}
    {keys.length > 1 && <button type="button" className="text-button" onClick={() => setQuery(clearedQuery(query))}>{cc.resetAll}</button>}
  </div>;
}
/** Every filter off; the search, sort and page size stay. */
export const clearedQuery = (query: CatalogQuery): CatalogQuery => ({ ...emptyCatalogQuery, q: query.q, sort: query.sort, per: query.per });

/** Categories present among the products, in the catalog's order. */
export const presentCategories = (categories: Iterable<string>) => { const set = new Set(categories); return Object.keys(categorySlugs).filter((category) => set.has(category)); };
