'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import { ArrowRight, ChevronDown, ClipboardPaste, Link2, Search, X } from 'lucide-react';
import { useMarket } from '@/lib/market/store';
import { homeCopy } from '@/lib/market/home-copy';
import { storesCopy } from '@/lib/market/stores-copy';
import { catalogItems, storeHost, type CatalogItem } from '@/lib/market/catalog-query';
import { brandAliases, normalizeSearch, wordMatches } from '@/lib/market/catalog-synonyms';
import { deliveryDaysFor, deliveryRegions, type DeliveryRegion } from '@/lib/market/site-content';
import { deliverySpeedCopy } from '@/lib/market/delivery-speed';
import { regionCountryCode, storeCountryTerms, storeGeo } from '@/lib/market/store-geo';
import {
  brandForHost, brandRegions, popularBrandKeys, storeBrands, storeCountryNames, storeFocusNames, storeFocusOrder, storeRegionOrder,
  type StoreBrand, type StoreCountry, type StoreFocus, type StoreRegion,
} from '@/lib/market/store-brands';
import type { Locale } from '@/lib/market/i18n';
import { Money } from './money';
import { CountryFlag } from './flags';
import { StoreLogo } from './store-logo';
import { StoreDialog, byRank, goToLinkOrder, type BrandCatalog, type Copy, type CountryTerms, type PersonalMark, type TermsByCountry } from './store-dialog';

type CatalogByBrand = Map<string, BrandCatalog>;
const focusKeys = new Set<string>(storeFocusOrder);
const regionKeys = new Set<string>(storeRegionOrder);
const countryCodes = Object.keys(storeGeo) as StoreCountry[];
const countryKeys = new Set<string>(countryCodes);
const popular = popularBrandKeys.map((key) => storeBrands.find((brand) => brand.key === key)).filter((brand): brand is StoreBrand => !!brand);
/** A collapsed group shows this many stores: two rows on phones, two rows of five on wide screens (CSS hides the rest). */
const collapsedCount = 6;
/** The storefront shelf appears once this many brands have products in the catalog. */
const showcaseMin = 3;
/** Collapsed, the shelf is two rows on wide screens: six cards at three per row (CSS shows eight at four per row; phones scroll them all). */
const showcaseCollapsed = 6;
/** Storefront order inside one brand: the operator's position, then current prices, then the bigger discount, then the cheaper total. */
const byShowcase = (a: CatalogItem, b: CatalogItem) =>
  (a.rank ?? Infinity) - (b.rank ?? Infinity) || Number(b.fresh) - Number(a.fresh) || b.discount - a.discount || (a.costs?.total ?? Infinity) - (b.costs?.total ?? Infinity);

/**
 * Store directory: brands with logos (country storefronts of one store grouped), delivery terms per country,
 * storefronts with catalog products, search, type / region / country filters kept in the address, and a
 * store card (deep-linked as ?brand=) that explains how to order from the store.
 */
export function StoresDirectory() {
  const { state, pricing, catalogProducts, loadCatalog } = useMarket();
  const locale = state.communication.language as Locale;
  const c = storesCopy[locale];
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<StoreFocus | ''>('');
  const [region, setRegion] = useState<StoreRegion | ''>('');
  const [country, setCountry] = useState<StoreCountry | ''>('');
  const [open, setOpen] = useState<StoreBrand | null>(null);
  const [expanded, setExpanded] = useState<StoreFocus[]>([]);
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  // The address is written only after it has been read: the mount render must not wipe a deep link first.
  const hydrated = useRef(false);
  useEffect(() => { void loadCatalog(); }, [loadCatalog]);
  // Home store chips and shared links arrive as ?q=, ?focus=, ?region=, ?country= and ?brand=; read them after hydration.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      setQuery((params.get('q') ?? '').slice(0, 80));
      const f = params.get('focus'), r = params.get('region'), k = params.get('country'), b = params.get('brand');
      if (f && focusKeys.has(f)) setFocus(f as StoreFocus);
      if (r && regionKeys.has(r)) setRegion(r as StoreRegion);
      if (k && countryKeys.has(k)) setCountry(k as StoreCountry);
      const brand = b ? storeBrands.find((entry) => entry.key === b) : undefined;
      if (brand) setOpen(brand);
      hydrated.current = true;
    });
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of [['q', query.trim()], ['focus', focus], ['region', region], ['country', country], ['brand', open?.key ?? '']] as const) { if (value) params.set(key, value); else params.delete(key); }
    const search = params.toString();
    const next = window.location.pathname + (search ? '?' + search : '') + window.location.hash;
    if (next !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, '', next);
  }, [query, focus, region, country, open]);

  // Delivery terms per store country at the current tariff, with the short day ranges the tiles print.
  const terms = useMemo<TermsByCountry>(() => {
    const short = (region: DeliveryRegion, speed: 'express' | 'standard') => { const range = deliveryDaysFor(pricing, region, speed); return range ? c.daysShort(range[0], range[1]) : null; };
    const entries = countryCodes.map((code): [StoreCountry, CountryTerms] => {
      const base = storeCountryTerms(pricing, code, locale);
      return [code, { ...base, expressShort: base.region ? short(base.region, 'express') : null, standardShort: base.region ? short(base.region, 'standard') : null }];
    });
    return Object.fromEntries(entries) as TermsByCountry;
  }, [pricing, locale, c]);
  // Catalog products priced for the storefront, grouped by brand (the cheapest total gives "from N soum").
  const catalogByBrand = useMemo(() => {
    const map: CatalogByBrand = new Map();
    for (const item of catalogItems(catalogProducts, pricing)) {
      const brand = brandForHost(item.store);
      if (!brand) continue;
      const entry = map.get(brand.key) ?? { count: 0, hosts: new Set<string>(), items: [], minTotal: null, stale: false };
      entry.count++; entry.hosts.add(item.store); entry.items.push(item);
      if (item.costs) entry.minTotal = entry.minTotal === null ? item.costs.total : Math.min(entry.minTotal, item.costs.total);
      if (!item.fresh) entry.stale = true;
      map.set(brand.key, entry);
    }
    for (const entry of map.values()) entry.items.sort(byShowcase);
    return map;
  }, [catalogProducts, pricing]);
  // Storefronts: the brands with the most products first, then by name.
  const showcase = useMemo(() => storeBrands.filter((brand) => (catalogByBrand.get(brand.key)?.count ?? 0) > 0)
    .sort((a, b) => (catalogByBrand.get(b.key)?.count ?? 0) - (catalogByBrand.get(a.key)?.count ?? 0) || a.name.localeCompare(b.name)), [catalogByBrand]);
  // Stores from the cart and earlier orders, the latest first: the quickest way back to a store.
  const mine = useMemo(() => {
    const products = [...state.cart.map((item) => item.product), ...[...state.orders].sort((a, b) => b.createdAt - a.createdAt).map((order) => order.product)];
    const brands: StoreBrand[] = [];
    for (const product of products) {
      const brand = brandForHost(storeHost(product));
      if (brand && !brands.includes(brand)) brands.push(brand);
    }
    return brands.slice(0, 12);
  }, [state.cart, state.orders]);
  // A parcel in the cart outranks an earlier order as the mark next to a store's logo.
  const marks = useMemo(() => {
    const map = new Map<string, PersonalMark>();
    for (const order of state.orders) { const brand = brandForHost(storeHost(order.product)); if (brand) map.set(brand.key, 'orders'); }
    for (const item of state.cart) { const brand = brandForHost(storeHost(item.product)); if (brand) map.set(brand.key, 'cart'); }
    return map;
  }, [state.cart, state.orders]);
  // The six dispatch regions as country cards: terms and how many brands have a storefront there.
  const regionCards = deliveryRegions.map((entry) => {
    const code = regionCountryCode(entry.id);
    return { code, terms: terms[code], stores: storeBrands.filter((brand) => brand.storefronts.some((front) => front.country === code)).length };
  });

  // The same understanding as the catalog search: "ё" as "е", a Cyrillic query transliterated, and the Russian spellings of brands ("найк", "зара").
  const search = normalizeSearch(query);
  const matchesSearch = (brand: StoreBrand) => {
    if (!search) return true;
    const text = normalizeSearch([brand.name, brand.key, storeFocusNames[brand.focus][locale], ...brand.storefronts.flatMap((s) => [s.root, storeCountryNames[s.country][locale]])].join(' '));
    return wordMatches(text, search) || brandAliases.some(([cyrillic, latin]) => cyrillic.startsWith(search) && text.includes(latin));
  };
  const searched = storeBrands.filter(matchesSearch);
  const inRegion = (brand: StoreBrand) => !region || brandRegions(brand).has(region);
  const inCountry = (brand: StoreBrand) => !country || brand.storefronts.some((front) => front.country === country);
  const list = searched.filter((brand) => (!focus || brand.focus === focus) && inRegion(brand) && inCountry(brand)).sort((a, b) => a.name.localeCompare(b.name));
  const focusCount = (key: StoreFocus) => searched.filter((brand) => brand.focus === key && inRegion(brand) && inCountry(brand)).length;
  const regionCount = (key: StoreRegion) => searched.filter((brand) => (!focus || brand.focus === focus) && brandRegions(brand).has(key) && inCountry(brand)).length;
  const grouped = !search && !focus;
  const speed = deliverySpeedCopy[locale];
  const gridProps = { locale, c, catalog: catalogByBrand, marks, terms, onOpen: setOpen };

  return <div className="stores-page">
    <header className="stores-hero">
      <div className="stores-hero-main">
        <h1>{c.title(storeBrands.length)}</h1>
        <p className="stores-intro">{c.intro}</p>
        <StoresLinkForm c={c} locale={locale} field={field} />
        <details className="stores-howto">
          <summary>{c.howtoTitle}<ChevronDown size={18} aria-hidden="true" /></summary>
          <ul>{c.howto.map(([device, hint]) => <li key={device}><b>{device}</b><span>{hint}</span></li>)}</ul>
        </details>
      </div>
      <div className="stores-hero-aside">
        <div className="stores-regions-cards" role="group" aria-label={c.regionsTitle}>
          {regionCards.map(({ code, terms: t, stores }) => <button type="button" key={code} className="stores-region-card" aria-pressed={country === code} onClick={() => setCountry(country === code ? '' : code)}>
            {/* A name over ten letters ("Великобритания") is set a step smaller and may wrap, never ending in an ellipsis. */}
            <span className="stores-region-head"><CountryFlag code={code} /><b data-long={(c.countryShort[code] ?? storeCountryNames[code][locale]).length > 10 || undefined}>{c.countryShort[code] ?? storeCountryNames[code][locale]}</b><span>{c.count(stores)}</span></span>
            <span className="stores-region-line"><span>{speed.short.express} {t.expressShort ?? c.pendingTerms}</span>{t.expressPerKg && <b>{t.expressPerKg}</b>}</span>
            <span className="stores-region-line"><span>{speed.short.standard} {t.standardShort ?? c.pendingTerms}</span>{t.standardPerKg && <b>{t.standardPerKg}</b>}</span>
          </button>)}
        </div>
        <p className="stores-terms-note">{c.termsNote}</p>
      </div>
    </header>

    {mine.length > 0 && <section className="stores-shelf stores-mine" aria-labelledby="stores-mine-title">
      <h2 id="stores-mine-title">{c.mine}</h2>
      <ul>{mine.map((brand) => <li key={brand.key}><button type="button" onClick={() => setOpen(brand)}><StoreLogo brand={brand} size={44} loading="eager" /><span>{brand.name}</span></button></li>)}</ul>
    </section>}

    {showcase.length >= showcaseMin && <section className={'stores-showcase' + (showcaseOpen ? ' open' : '') + (showcase.length <= 8 ? ' le8' : '')} aria-labelledby="stores-showcase-title">
      <h2 id="stores-showcase-title">{c.showcase}</h2>
      <ul className="stores-showcase-list" id="stores-showcase-list">{showcase.map((brand) => {
        const entry = catalogByBrand.get(brand.key);
        if (!entry) return null;
        const main = brand.storefronts[0], t = terms[main.country], photos = entry.items.slice(0, 3);
        return <li key={brand.key}><article className="store-showcase-card" aria-labelledby={'stores-showcase-' + brand.key}>
          <header>
            <StoreLogo brand={brand} size={36} />
            <div><b id={'stores-showcase-' + brand.key}>{brand.name}</b><small><CountryFlag code={main.country} /><span>{storeCountryNames[main.country][locale]}</span></small></div>
            <span>{c.products(entry.count)}</span>
          </header>
          {/* As many slots as photos (up to three): one photo fills the stage; the logo stands in only for one that fails to load. */}
          <div className="store-showcase-photos" data-count={photos.length} aria-hidden="true">{photos.map((item) => <ShowcasePhoto key={item.product.id} src={item.product.image} brand={brand} />)}</div>
          <p className="store-showcase-total">
            {/* One span per line: the paragraph is a grid, and bare text runs would become rows of their own. */}
            <span>{entry.minTotal !== null ? <>{c.fromTotal} <Money value={entry.minTotal} locale={locale} />{c.withDelivery}</> : c.pendingTerms}</span>
            {entry.stale && entry.minTotal !== null && <small>{c.lastPrices}</small>}
          </p>
          <p className="store-showcase-terms">{t.region ? `${t.expressShort ?? c.pendingTerms} · ${t.expressPerKg}` : c.pendingTerms}</p>
          <button type="button" className="btn secondary" onClick={() => setOpen(brand)}>{c.showStore}<ArrowRight size={16} aria-hidden="true" /></button>
        </article></li>;
      })}</ul>
      {/* Wide screens fold the shelf to two rows (le8: everything fits at four per row); phones scroll the whole row, so CSS hides the button there. */}
      {showcase.length > showcaseCollapsed && <button type="button" className="stores-more" aria-expanded={showcaseOpen} aria-controls="stores-showcase-list" onClick={() => setShowcaseOpen(!showcaseOpen)}>
        {showcaseOpen ? c.showLess : c.showAll(showcase.length)}<ChevronDown size={18} aria-hidden="true" />
      </button>}
    </section>}

    <section className="stores-shelf stores-popular" aria-labelledby="stores-popular-title">
      <h2 id="stores-popular-title">{c.popular}</h2>
      <ul>{popular.map((brand) => <li key={brand.key}><button type="button" onClick={() => setOpen(brand)}><StoreLogo brand={brand} size={44} loading="eager" /><span>{brand.name}</span></button></li>)}</ul>
    </section>

    <section className="stores-browse" aria-labelledby="stores-browse-title">
      <div className="stores-browse-head"><h2 id="stores-browse-title">{c.directory}</h2><span role="status">{c.count(list.length)}</span></div>
      <label className="stores-search"><Search size={20} aria-hidden="true" /><span className="sr-only">{c.search}</span><input type="search" value={query} maxLength={80} placeholder={c.search} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" className="icon-btn" aria-label={c.clear} onClick={() => setQuery('')}><X size={18} /></button>}</label>
      <div className="stores-chips" role="group" aria-label={c.directory}>
        <button type="button" aria-pressed={!focus} onClick={() => setFocus('')}>{c.all}<span>{searched.filter((brand) => inRegion(brand) && inCountry(brand)).length}</span></button>
        {storeFocusOrder.map((key) => <button type="button" key={key} aria-pressed={focus === key} onClick={() => setFocus(focus === key ? '' : key)}>{storeFocusNames[key][locale]}<span>{focusCount(key)}</span></button>)}
      </div>
      <div className="stores-chips stores-regions" role="group" aria-label={c.regionLabel}>
        <button type="button" aria-pressed={!region} onClick={() => setRegion('')}>{c.regionLabel}: {c.all.toLocaleLowerCase()}</button>
        {storeRegionOrder.map((key) => <button type="button" key={key} aria-pressed={region === key} onClick={() => setRegion(region === key ? '' : key)}>{c.regions[key]}<span>{regionCount(key)}</span></button>)}
        {country && <button type="button" className="stores-country-chip" aria-pressed="true" onClick={() => setCountry('')}><CountryFlag code={country} />{storeCountryNames[country][locale]}<X size={14} aria-hidden="true" /><span className="sr-only">{c.clear}</span></button>}
      </div>
      {!list.length ? <div className="stores-empty" role="status"><p>{c.noResults}</p><button type="button" className="btn primary" onClick={() => { setQuery(''); setFocus(''); setRegion(''); setCountry(''); field.current?.focus(); }}><Link2 size={18} aria-hidden="true" />{c.pasteLabel}</button></div>
        : grouped ? storeFocusOrder.map((key) => {
          // Without a search or a type filter each type is a short shelf, popular stores first, opened on demand.
          const items = list.filter((brand) => brand.focus === key).sort(byRank);
          const isOpen = expanded.includes(key);
          // le8/le9/le10: everything fits in the collapsed rows of that breakpoint, so no "show all" there.
          const fits = [8, 9, 10].filter((limit) => items.length <= limit).map((limit) => ' le' + limit).join('');
          return items.length ? <section className={'stores-group' + (isOpen ? ' open' : '') + fits} key={key} aria-labelledby={'stores-' + key}>
            <h3 id={'stores-' + key}>{storeFocusNames[key][locale]}<span>{items.length}</span></h3>
            <StoreGrid items={items} {...gridProps} />
            {items.length > collapsedCount && <button type="button" className="stores-more" aria-expanded={isOpen} aria-controls={'stores-grid-' + key} onClick={() => setExpanded(isOpen ? expanded.filter((value) => value !== key) : [...expanded, key])}>
              {isOpen ? c.showLess : c.showAll(items.length)}<ChevronDown size={18} aria-hidden="true" />
            </button>}
          </section> : null;
        })
        : <StoreGrid items={list} {...gridProps} />}
      {list.length > 0 && <p className="stores-terms-note">{c.termsNote}</p>}
      <div className="stores-missing">
        <div><h3>{c.missingTitle}</h3><p>{c.missingText}</p></div>
        <button type="button" className="btn secondary" onClick={() => { field.current?.scrollIntoView({ block: 'center' }); field.current?.focus(); }}><Link2 size={18} aria-hidden="true" />{c.missingAction}</button>
      </div>
      <p className="stores-note">{c.note}</p>
    </section>
    <StoreDialog brand={open} c={c} locale={locale} pricing={pricing} terms={terms} catalog={open ? catalogByBrand.get(open.key) : undefined} mark={open ? marks.get(open.key) : undefined} onOpen={setOpen} onClose={() => setOpen(null)} />
  </div>;
}

function StoreGrid({ items, locale, c, catalog, marks, terms, onOpen }: { items: StoreBrand[]; locale: Locale; c: Copy; catalog: CatalogByBrand; marks: Map<string, PersonalMark>; terms: TermsByCountry; onOpen: (brand: StoreBrand) => void }) {
  return <ul className="stores-grid" id={items[0] ? 'stores-grid-' + items[0].focus : undefined}>{items.map((brand) => {
    const main = brand.storefronts[0], t = terms[main.country], mark = marks.get(brand.key);
    const countries = new Set(brand.storefronts.map((s) => s.country)).size, inCatalog = catalog.get(brand.key)?.count ?? 0;
    return <li key={brand.key}><button type="button" className="store-tile" onClick={() => onOpen(brand)}>
      <span className="store-tile-logo"><StoreLogo brand={brand} size={36} />{mark && <i className="store-tile-mark" title={mark === 'cart' ? c.inCartMark : c.youOrdered}><span className="sr-only">{mark === 'cart' ? c.inCartMark : c.youOrdered}</span></i>}</span>
      <span className="store-tile-text">
        <span className="store-tile-row"><b>{brand.name}</b>{inCatalog > 0 && <em className="store-tile-count">{c.products(inCatalog)}</em>}</span>
        <small className="store-tile-geo">
          <CountryFlag code={main.country} /><span>{storeCountryNames[main.country][locale]}</span>
          {t.region ? <><span>{t.expressShort ?? c.pendingTerms}</span>{t.expressPerKg && <span className="store-tile-rate">{t.expressPerKg}</span>}</> : <span>{c.pendingTerms}</span>}
          {countries > 1 && <span className="store-tile-more">{c.moreCountries(countries - 1)}</span>}
        </small>
      </span>
    </button></li>;
  })}</ul>;
}

/** A product photo on the storefront card; the store's logo stands in when the photo fails to load. */
function ShowcasePhoto({ src, brand }: { src: string; brand: StoreBrand }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="store-showcase-photo"><StoreLogo brand={brand} size={40} /></span>;
  // Dynamic store images are displayed without proxying or optimization.
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="store-showcase-photo"><img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} /></span>;
}

function StoresLinkForm({ c, locale, field }: { c: Copy; locale: Locale; field: RefObject<HTMLInputElement | null> }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [canPaste, setCanPaste] = useState(false);
  useEffect(() => { queueMicrotask(() => setCanPaste(typeof navigator !== 'undefined' && !!navigator.clipboard?.readText)); }, []);
  function go(value: string) {
    try { goToLinkOrder(value); }
    catch { setError(homeCopy[locale].hero.invalid); }
  }
  function submit(event: FormEvent) { event.preventDefault(); go(url); }
  // Reading the clipboard needs a tap; iPhone shows its own "Paste" confirmation.
  async function paste() {
    try { const text = (await navigator.clipboard.readText()).trim(); if (text) { setUrl(text); setError(''); go(text); return; } } catch { /* denied: type or paste by hand */ }
    field.current?.focus();
  }
  return <form className="stores-link" onSubmit={submit} noValidate>
    <label className="sr-only" htmlFor="stores-link-url">{c.pasteLabel}</label>
    <span className="stores-link-field"><Link2 size={20} aria-hidden="true" /><input ref={field} id="stores-link-url" type="url" inputMode="url" autoComplete="off" spellCheck={false} enterKeyHint="go" value={url} placeholder={c.pastePlaceholder} aria-invalid={!!error} aria-describedby={error ? 'stores-link-error' : undefined} onChange={(event) => { setUrl(event.target.value); setError(''); }} />
      {canPaste && !url && <button type="button" className="icon-btn" aria-label={c.paste} onClick={() => void paste()}><ClipboardPaste size={19} /></button>}</span>
    <button type="submit" className="btn primary">{c.calculate}<ArrowRight size={18} aria-hidden="true" /></button>
    {error && <p id="stores-link-error" className="stores-link-error" role="alert">{error}</p>}
  </form>;
}
