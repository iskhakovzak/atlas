'use client';

import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Flame, Heart, Link2, Search, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import Link from '@/components/site-link';
import { validateSource, type Product } from '@/lib/market/domain';
import { findOrderUrl, catalogFreshness } from '@/lib/market/catalog';
import { defaultDealFilters, filterDeals, type DealFilters } from '@/lib/market/deals';
import { dealCopy } from '@/lib/market/deal-copy';
import { useMarket } from '@/lib/market/store';
import { signInPath } from '@/lib/market/access';
import { Choice, Empty, ProductImage } from './market-ui';

export function DealsFeed({ favorites, select }: { favorites: boolean; select: (product: Product) => void }) {
  const { state, pricing, ready, status, act,catalogProducts,collections,catalogError } = useMarket();
  const [collectionId,setCollectionId]=useState('');
  const [filters, setFilters] = useState<DealFilters>(defaultDealFilters);
  const [saving, setSaving] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const locale = state.communication.language;
  const copy = dealCopy(locale);
  const products = catalogProducts;
  const merchantRecord=(product:Product)=>products.find(p=>p.id===product.id);
  const fmt = (n: number, currency = 'UZS') => new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US', { style: 'currency', currency, maximumFractionDigits: currency === 'UZS' ? 0 : 2 }).format(n);
  const categories = [{ value: '', label: copy.all }, { value: 'Обувь', label: copy.footwear }, { value: 'Одежда', label: copy.clothing }, { value: 'Электроника', label: copy.electronics },{value:'Красота и уход',label:locale==='ru'?'Красота и уход':locale==='uz'?'Go‘zallik va parvarish':'Beauty & care'},...['Аксессуары','Дом и быт','Спорт','Другое'].filter(value=>products.some(p=>p.category===value)).map(value=>({value,label:value}))];
  const countries = [{ value: '', label: copy.allCountries }, ...[...new Set(['США',...products.map(p=>p.country??'США')])].map(value=>({value,label:value==='США'?copy.us:value}))];
  const budgets = [{ value: 0, label: copy.anyBudget }, { value: 1000000, label: copy.budget1 }, { value: 1500000, label: copy.budget15 }, { value: 2000000, label: copy.budget2 }];
  const sorts: { value: DealFilters['sort']; label: string }[] = [{ value: 'discount', label: copy.discountSort }, { value: 'total-asc', label: copy.lowSort }, { value: 'total-desc', label: copy.highSort }];
  const titles: Record<string, string> = {};
  const candidates = products.filter(product => (!favorites || state.favorites.includes(product.id))&&(!collectionId||collections.find(c=>c.id===collectionId)?.productIds.includes(product.id)));
  // Match localised labels without changing the product snapshots used at checkout.
  const search = filters.search.trim().toLocaleLowerCase();
  const matching = candidates.filter(product => [product.name, titles[product.id], product.brand, product.category, product.country, categories.find(c => c.value === product.category)?.label, countries.find(c => c.value === product.country)?.label].join(' ').toLocaleLowerCase().includes(search));
  const list = filterDeals(matching, pricing, { ...filters, search: '' },products);
  const hasFilters = !!(filters.search || filters.category || filters.country || filters.maxTotal);

  async function favorite(product: Product) {
    setSaving(product.id);
    try { await act({ type: 'favorite', id: product.id }); } finally { setSaving(null); }
  }

  return <div className="finds-page" id="finds">
    <section className="finds-heading">
      <div><span className="eyebrow">{copy.overline}</span>{status==='guest'?<h2>{copy.catalog}</h2>:<h1>{favorites ? copy.savedTitle : copy.title}</h1>}<p>{favorites ? copy.savedIntro : copy.intro}</p></div>
      {ready&&<Link className="btn secondary" href={favorites ? '/' : '/favorites'}><Heart size={17}/>{favorites ? copy.catalog : copy.saved}<span className="finds-count">{favorites ? products.length : state.favorites.filter(id => products.some(product => product.id === id)).length}</span></Link>}
    </section>
    {catalogError&&<p role="alert">{catalogError}</p>}
    {!!collections.length&&<nav className="find-collections" aria-label={locale==='ru'?'Подборки':locale==='uz'?'To‘plamlar':'Collections'}>
      <button type="button" className={!collectionId?'active':''} onClick={()=>setCollectionId('')}>{copy.all}</button>
      {collections.map(collection=><button type="button" key={collection.id} className={collectionId===collection.id?'active':''} onClick={()=>setCollectionId(collection.id)}><b>{locale==='en'?collection.nameEn||collection.name:locale==='uz'?collection.nameUz||collection.name:collection.name}</b><span>{collection.productIds.length}</span></button>)}
    </nav>}
    {(!favorites || candidates.length > 0) && <section className="finds-controls" aria-label={copy.search}>
      <div className="finds-search"><Search size={21}/><input type="search" aria-label={copy.search} placeholder={copy.searchPlaceholder} value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })}/>{filters.search && <button type="button" className="icon-btn" aria-label={copy.clear} onClick={() => setFilters({ ...filters, search: '' })}><X size={18}/></button>}</div>
      <div className="finds-categories">{categories.map(category => <button type="button" key={category.value} aria-pressed={filters.category === category.value} className={filters.category === category.value ? 'active' : ''} onClick={() => setFilters({ ...filters, category: category.value })}>{category.label}</button>)}</div>
      <details className="catalog-filter-disclosure"><summary><SlidersHorizontal size={18} aria-hidden="true"/>{locale==='ru'?'Фильтры и сортировка':locale==='uz'?'Filtrlar va saralash':'Filters & sorting'}{(filters.country||filters.maxTotal||filters.sort!=='discount')&&<span> · {locale==='ru'?'настроены':locale==='uz'?'tanlangan':'applied'}</span>}</summary><div className="finds-filter-row">
        <label><span>{copy.country}</span><Choice label={copy.country} value={countries.find(c => c.value === filters.country)!.label} options={countries.map(c => c.label)} onChange={label => setFilters({ ...filters, country: countries.find(c => c.label === label)!.value })}/></label>
        <label><span>{copy.budget}</span><Choice label={copy.budget} value={budgets.find(b => b.value === filters.maxTotal)!.label} options={budgets.map(b => b.label)} onChange={label => setFilters({ ...filters, maxTotal: budgets.find(b => b.label === label)!.value })}/></label>
        <label><span>{copy.sort}</span><Choice label={copy.sort} value={sorts.find(s => s.value === filters.sort)!.label} options={sorts.map(s => s.label)} onChange={label => setFilters({ ...filters, sort: sorts.find(s => s.label === label)!.value })}/></label>
      </div></details>
    </section>}
    {(!favorites || candidates.length > 0) && <div className="finds-result"><span role="status">{copy.results}: <b>{list.length}</b></span><span className="catalog-customs-note">{copy.excluded} <Link href="/customs" aria-label={locale==='ru'?'Таможенные условия':locale==='uz'?'Bojxona shartlari':'Customs information'}>ⓘ</Link></span>{hasFilters && <button type="button" className="text-button" onClick={() => setFilters(defaultDealFilters)}>{copy.reset}<X size={14}/></button>}</div>}
    <section className="finds-grid" aria-label={favorites ? copy.saved : copy.catalog}>
      {list.map(({ product, costs, referenceUsd, discount }) => {
        const isSaved = state.favorites.includes(product.id);
        const name = product.sourceUrl ? product.name : titles[product.id] ?? product.name;
        return <article className="find-card" key={product.id}>
          <div className="find-visual"><button className="find-photo" type="button" onClick={() => select(product)} aria-label={name}><ProductImage product={{ ...product, name }} /></button>
            <span className="find-merchant">{merchantRecord(product)?.store}</span>{catalogFreshness(product)!=='fresh'&&<span className={`find-freshness ${catalogFreshness(product)}`}>{locale==='ru'?'Данные на':locale==='uz'?'Ma’lumot sanasi':'As of'} · {merchantRecord(product)?.observedOn}</span>}
            {discount >= 40 && <span className="find-top-deal"><Flame size={14}/>{copy.topDeal}</span>}
            {ready&&<button type="button" disabled={saving !== null} className={'find-save ' + (isSaved ? 'saved' : '')} aria-pressed={isSaved} aria-label={(isSaved ? copy.remove : copy.save) + ': ' + name} title={!ready ? copy.signin : saving === product.id ? copy.savingState : isSaved ? copy.remove : copy.save} onClick={() => void favorite(product)}><Heart size={20}/></button>}
          </div>
          <div className="find-content"><div className="find-meta"><span>{categories.find(c => c.value === product.category)?.label ?? product.category}</span><span>{countries.find(c => c.value === product.country)?.label ?? product.country}</span></div>
            <button type="button" className="find-title" onClick={() => select(product)}>{name}</button>
            <div className="find-store-price"><span>{copy.productPrice}</span><div><b>{fmt(product.usd, 'USD')}</b>{discount > 0 && <del title={copy.referenceLabel}>{fmt(referenceUsd!, 'USD')}</del>}</div>{discount > 0 && <span className="find-discount" title={copy.compareHint}>−{discount}%</span>}</div>
            <div className="find-total"><span>{copy.delivered}</span><strong>{fmt(costs.total)}</strong><button type="button" className="price-info" aria-label={copy.breakdown} onClick={() => select(product)}>ⓘ</button></div>
            <div className="find-origin"><a href={product.sourceUrl} target="_blank" rel="noopener noreferrer">{merchantRecord(product)?.store} · {copy.sourceOpen}<ArrowUpRight size={14}/></a></div>
            <div className="find-purchase"><a className="btn primary" href={status==='guest'?signInPath(findOrderUrl(product)):findOrderUrl(product)} target={status==='guest'?'_top':undefined}>{copy.buy}<ArrowRight size={17}/></a></div>
          </div>
        </article>;
      })}
    </section>
    {!list.length && <Empty title={favorites && !candidates.length ? copy.emptySaved : copy.empty} description={favorites && !candidates.length ? copy.emptySavedHint : copy.emptyHint} href={favorites && !candidates.length ? '/' : undefined} label={copy.catalog}>{hasFilters && <button type="button" className="btn secondary" onClick={() => setFilters(defaultDealFilters)}>{copy.reset}</button>}</Empty>}
    {!!list.length && <p className="finds-price-note">{copy.priceNote}</p>}
    {status==='guest' && <p className="finds-signin"><Link href="/account"><Heart size={15}/>{copy.signin}<ArrowUpRight size={15}/></Link></p>}
    {!favorites && <><section className="finds-own-link"><div><Link2 size={25}/><div><h2>{copy.linkTitle}</h2><p>{copy.linkHint}</p></div></div><form onSubmit={event => { event.preventDefault(); try { const target = validateSource(url); setUrlError(''); window.location.assign('/order-by-link?url=' + encodeURIComponent(target)); } catch (error) { setUrlError((error as Error).message); toast.error((error as Error).message); } }}><label className="sr-only" htmlFor="finds-product-url">{copy.linkLabel}</label><input id="finds-product-url" type="url" required value={url} aria-invalid={!!urlError} aria-describedby={urlError ? 'finds-url-error' : undefined} placeholder="https://..." onChange={event => { setUrl(event.target.value); setUrlError(''); }}/><button className="btn light">{copy.calculate}<ArrowUpRight size={18}/></button></form>{urlError && <p id="finds-url-error" role="alert">{urlError}</p>}<Link href="/batch-import">{copy.batch}<ArrowRight size={15}/></Link></section>
      <section className="finds-steps"><h2>{copy.stepsTitle}</h2><ol>{[[copy.step1, copy.step1hint], [copy.step2, copy.step2hint], [copy.step3, copy.step3hint], [copy.step4, copy.step4hint]].map(([heading, hint], index) => <li key={heading}><span>0{index + 1}</span><div><h3>{heading}</h3><p>{hint}</p></div></li>)}</ol></section></>}
  </div>;
}
