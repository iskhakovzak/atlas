'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import { ArrowRight, ArrowUpRight, ClipboardPaste, Link2, Search, X } from 'lucide-react';
import Link from '@/components/site-link';
import { validateSource } from '@/lib/market/domain';
import { useMarket } from '@/lib/market/store';
import { homeCopy } from '@/lib/market/home-copy';
import { storesCopy } from '@/lib/market/stores-copy';
import { storeHost } from '@/lib/market/catalog-query';
import {
  brandForHost, brandRegions, popularBrandKeys, storeBrands, storeCountryNames, storeFocusNames, storeFocusOrder, storeRegionOrder,
  type StoreBrand, type StoreFocus, type StoreRegion,
} from '@/lib/market/store-brands';
import type { Locale } from '@/lib/market/i18n';
import { StoreLogo } from './store-logo';

type Copy = (typeof storesCopy)['ru'];
const focusKeys = new Set<string>(storeFocusOrder);
const regionKeys = new Set<string>(storeRegionOrder);
const popular = popularBrandKeys.map((key) => storeBrands.find((brand) => brand.key === key)).filter((brand): brand is StoreBrand => !!brand);

/**
 * Store directory: brands with logos (country storefronts of one store grouped), search, type and
 * region filters kept in the address, and a store card that explains how to order from it.
 */
export function StoresDirectory() {
  const { state, catalogProducts, loadCatalog } = useMarket();
  const locale = state.communication.language as Locale;
  const c = storesCopy[locale];
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<StoreFocus | ''>('');
  const [region, setRegion] = useState<StoreRegion | ''>('');
  const [open, setOpen] = useState<StoreBrand | null>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { void loadCatalog(); }, [loadCatalog]);
  // Home store chips and shared links arrive as ?q=, ?focus= and ?region=; read them after hydration.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      setQuery((params.get('q') ?? '').slice(0, 80));
      const f = params.get('focus'), r = params.get('region');
      if (f && focusKeys.has(f)) setFocus(f as StoreFocus);
      if (r && regionKeys.has(r)) setRegion(r as StoreRegion);
    });
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of [['q', query.trim()], ['focus', focus], ['region', region]] as const) { if (value) params.set(key, value); else params.delete(key); }
    const search = params.toString();
    const next = window.location.pathname + (search ? '?' + search : '') + window.location.hash;
    if (next !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, '', next);
  }, [query, focus, region]);

  const catalogByBrand = useMemo(() => {
    const map = new Map<string, { count: number; hosts: Set<string> }>();
    for (const product of catalogProducts) {
      const host = storeHost(product), brand = brandForHost(host);
      if (!brand) continue;
      const entry = map.get(brand.key) ?? { count: 0, hosts: new Set<string>() };
      entry.count++; entry.hosts.add(host); map.set(brand.key, entry);
    }
    return map;
  }, [catalogProducts]);

  const search = query.trim().toLocaleLowerCase();
  const matchesSearch = (brand: StoreBrand) => !search || [brand.name, brand.key, storeFocusNames[brand.focus][locale], ...brand.storefronts.flatMap((s) => [s.root, storeCountryNames[s.country][locale]])].join(' ').toLocaleLowerCase().includes(search);
  const searched = storeBrands.filter(matchesSearch);
  const inRegion = (brand: StoreBrand) => !region || brandRegions(brand).has(region);
  const list = searched.filter((brand) => (!focus || brand.focus === focus) && inRegion(brand)).sort((a, b) => a.name.localeCompare(b.name));
  const focusCount = (key: StoreFocus) => searched.filter((brand) => brand.focus === key && inRegion(brand)).length;
  const regionCount = (key: StoreRegion) => searched.filter((brand) => (!focus || brand.focus === focus) && brandRegions(brand).has(key)).length;
  const grouped = !search && !focus;

  return <div className="stores-page">
    <header className="stores-hero">
      <p className="stores-overline">{c.overline}</p>
      <h1>{c.title(storeBrands.length)}</h1>
      <p className="stores-intro">{c.intro}</p>
      <StoresLinkForm c={c} locale={locale} field={field} />
      <ol className="stores-steps">{c.steps.map(([title, hint], index) => <li key={title}><span aria-hidden="true">{index + 1}</span><div><b>{title}</b><small>{hint}</small></div></li>)}</ol>
    </header>

    <section className="stores-popular" aria-labelledby="stores-popular-title">
      <h2 id="stores-popular-title">{c.popular}</h2>
      <ul>{popular.map((brand) => <li key={brand.key}><button type="button" onClick={() => setOpen(brand)}><StoreLogo brand={brand} size={52} /><span>{brand.name}</span></button></li>)}</ul>
    </section>

    <section className="stores-browse" aria-labelledby="stores-browse-title">
      <div className="stores-browse-head"><h2 id="stores-browse-title">{c.directory}</h2><span role="status">{c.count(list.length)}</span></div>
      <label className="stores-search"><Search size={20} aria-hidden="true" /><span className="sr-only">{c.search}</span><input type="search" value={query} maxLength={80} placeholder={c.search} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" className="icon-btn" aria-label={c.clear} onClick={() => setQuery('')}><X size={18} /></button>}</label>
      <div className="stores-chips" role="group" aria-label={c.directory}>
        <button type="button" aria-pressed={!focus} onClick={() => setFocus('')}>{c.all}<span>{searched.filter(inRegion).length}</span></button>
        {storeFocusOrder.map((key) => <button type="button" key={key} aria-pressed={focus === key} onClick={() => setFocus(focus === key ? '' : key)}>{storeFocusNames[key][locale]}<span>{focusCount(key)}</span></button>)}
      </div>
      <div className="stores-chips stores-regions" role="group" aria-label={c.regionLabel}>
        <button type="button" aria-pressed={!region} onClick={() => setRegion('')}>{c.regionLabel}: {c.all.toLocaleLowerCase()}</button>
        {storeRegionOrder.map((key) => <button type="button" key={key} aria-pressed={region === key} onClick={() => setRegion(region === key ? '' : key)}>{c.regions[key]}<span>{regionCount(key)}</span></button>)}
      </div>
      {!list.length ? <div className="stores-empty" role="status"><p>{c.noResults}</p><button type="button" className="btn primary" onClick={() => { setQuery(''); setFocus(''); setRegion(''); field.current?.focus(); }}><Link2 size={18} aria-hidden="true" />{c.pasteLabel}</button></div>
        : grouped ? storeFocusOrder.map((key) => {
          const items = list.filter((brand) => brand.focus === key);
          return items.length ? <section className="stores-group" key={key} aria-labelledby={'stores-' + key}><h3 id={'stores-' + key}>{storeFocusNames[key][locale]}<span>{items.length}</span></h3><StoreGrid items={items} locale={locale} c={c} onOpen={setOpen} /></section> : null;
        })
        : <StoreGrid items={list} locale={locale} c={c} onOpen={setOpen} />}
      <p className="stores-note">{c.note}</p>
    </section>
    <StoreDialog brand={open} c={c} locale={locale} catalog={open ? catalogByBrand.get(open.key) : undefined} onClose={() => setOpen(null)} onPaste={() => { setOpen(null); field.current?.scrollIntoView({ block: 'center' }); field.current?.focus(); }} />
  </div>;
}

function StoreGrid({ items, locale, c, onOpen }: { items: StoreBrand[]; locale: Locale; c: Copy; onOpen: (brand: StoreBrand) => void }) {
  return <ul className="stores-grid">{items.map((brand) => <li key={brand.key}><button type="button" className="store-tile" onClick={() => onOpen(brand)}>
    <StoreLogo brand={brand} size={44} />
    <span className="store-tile-text"><b>{brand.name}</b><small>{storeCountryNames[brand.storefronts[0].country][locale]}{brand.storefronts.length > 1 && <> · {c.countries(new Set(brand.storefronts.map((s) => s.country)).size)}</>}</small></span>
  </button></li>)}</ul>;
}

/** Native modal dialog: a sheet from the bottom on phones, a centred card on larger screens. */
function StoreDialog({ brand, c, locale, catalog, onClose, onPaste }: { brand: StoreBrand | null; c: Copy; locale: Locale; catalog?: { count: number; hosts: Set<string> }; onClose: () => void; onPaste: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (brand && !dialog.open) dialog.showModal();
    if (!brand && dialog.open) dialog.close();
  }, [brand]);
  const main = brand?.storefronts[0];
  return <dialog ref={ref} className="store-dialog" aria-labelledby="store-dialog-title" onClose={onClose} onClick={(event) => { if (event.target === ref.current) ref.current?.close(); }}>
    {brand && main && <div className="store-dialog-body">
      <button type="button" className="icon-btn store-dialog-close" aria-label={c.close} onClick={() => ref.current?.close()}><X size={20} /></button>
      <div className="store-dialog-head"><StoreLogo brand={brand} size={60} /><div><h2 id="store-dialog-title">{brand.name}</h2><p>{storeFocusNames[brand.focus][locale]} · {storeCountryNames[main.country][locale]}</p></div></div>
      <a className="btn primary store-dialog-open" href={`https://${main.root}`} target="_blank" rel="noopener noreferrer">{c.open(main.root)}<ArrowUpRight size={18} aria-hidden="true" /><span className="sr-only"> ({c.newTab})</span></a>
      {brand.storefronts.length > 1 && <div className="store-dialog-section"><h3>{c.storefronts}</h3><ul className="store-dialog-fronts">{brand.storefronts.map((front) => <li key={front.root}><a href={`https://${front.root}`} target="_blank" rel="noopener noreferrer"><span>{storeCountryNames[front.country][locale]}</span><small>{front.root}</small><ArrowUpRight size={16} aria-hidden="true" /></a></li>)}</ul></div>}
      {catalog && catalog.count > 0 && <Link className="store-dialog-catalog" href={'/catalog?store=' + [...catalog.hosts].join(',')}><span>{c.inCatalog(catalog.count)}</span><b>{c.viewCatalog}<ArrowRight size={16} aria-hidden="true" /></b></Link>}
      <div className="store-dialog-section"><h3>{c.howTitle}</h3><ol className="store-dialog-steps">{c.steps.map(([title, hint]) => <li key={title}><b>{title}</b><small>{hint}</small></li>)}</ol></div>
      <button type="button" className="btn secondary store-dialog-paste" onClick={onPaste}><Link2 size={18} aria-hidden="true" />{c.pastePlaceholder}</button>
    </div>}
  </dialog>;
}

function StoresLinkForm({ c, locale, field }: { c: Copy; locale: Locale; field: RefObject<HTMLInputElement | null> }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [canPaste, setCanPaste] = useState(false);
  useEffect(() => { queueMicrotask(() => setCanPaste(typeof navigator !== 'undefined' && !!navigator.clipboard?.readText)); }, []);
  function go(value: string) {
    try { window.location.assign('/order-by-link?url=' + encodeURIComponent(validateSource(value.trim()))); }
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
