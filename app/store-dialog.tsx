'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, Info, Link2, X } from 'lucide-react';
import Link from '@/components/site-link';
import { tariff, unknownStoreShippingUsd, validateSource, type Pricing } from '@/lib/market/domain';
import { customsParams } from '@/lib/market/customs';
import { deliverySpeedCopy } from '@/lib/market/delivery-speed';
import { homeCopy } from '@/lib/market/home-copy';
import { formatUsd } from '@/lib/market/format';
import { tashkentDay } from '@/lib/market/world';
import type { storesCopy } from '@/lib/market/stores-copy';
import { storeNote } from '@/lib/market/store-notes';
import type { StoreCountryTerms } from '@/lib/market/store-geo';
import { popularBrandKeys, storeBrands, storeCountryNames, storeFocusNames, type StoreBrand, type StoreCountry } from '@/lib/market/store-brands';
import type { CatalogItem } from '@/lib/market/catalog-query';
import type { Locale } from '@/lib/market/i18n';
import { Money } from './money';
import { CountryFlag } from './flags';
import { StoreLogo } from './store-logo';
import { ProductImage } from './market-ui';

export type Copy = (typeof storesCopy)['ru'];
/** storeCountryTerms plus the short day ranges the storefront prints ("5–9 раб. дн"). */
export type CountryTerms = StoreCountryTerms & { expressShort: string | null; standardShort: string | null };
export type TermsByCountry = Record<StoreCountry, CountryTerms>;
/** The catalog products of one brand, priced; `items` sorted as the storefront shows them. */
export type BrandCatalog = { count: number; hosts: Set<string>; items: CatalogItem[]; minTotal: number | null; stale: boolean };
/** The visitor's own link to a store: a parcel from it in the cart, or an earlier order. */
export type PersonalMark = 'cart' | 'orders';

/** Popular brands first, then the bigger ones (more country storefronts), then by name. */
export const byRank = (a: StoreBrand, b: StoreBrand) => {
  const pa = popularBrandKeys.indexOf(a.key), pb = popularBrandKeys.indexOf(b.key);
  if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
  return b.storefronts.length - a.storefronts.length || a.name.localeCompare(b.name);
};

/** The link-order page for a pasted product link; throws the validation error for a bad one. */
export function goToLinkOrder(value: string) {
  window.location.assign('/order-by-link?url=' + encodeURIComponent(validateSource(value.trim())));
}

const shelfSize = 6;
/** The duty-free allowance of the Tashkent calendar day, as the rest of the customs copy counts it. */
const allowanceToday = (pricing: Pricing) => customsParams(pricing, tashkentDay(Date.now())).allowanceUsd;

/**
 * Store card: a native modal dialog — a sheet from the bottom on phones with a sticky "Calculate" button,
 * a centred card on larger screens. Shows the store's own link, Atlas delivery terms from its country, its
 * products in the catalog, its country storefronts, a note when the store deserves one and similar stores.
 */
export function StoreDialog({ brand, c, locale, pricing, terms, catalog, mark, onOpen, onClose }: {
  brand: StoreBrand | null; c: Copy; locale: Locale; pricing: Pricing; terms: TermsByCountry; catalog?: BrandCatalog; mark?: PersonalMark;
  onOpen: (brand: StoreBrand) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (brand && !dialog.open) dialog.showModal();
    if (!brand && dialog.open) dialog.close();
    // Another store opened from "similar stores": back to the top of the card.
    dialog.querySelector('.store-dialog-body')?.scrollTo({ top: 0 });
  }, [brand]);
  const main = brand?.storefronts[0];
  const speed = deliverySpeedCopy[locale];
  const t = main ? terms[main.country] : null;
  // Same type of store, popular first and preferably from the same part of the world.
  const similar = brand ? storeBrands.filter((other) => other.focus === brand.focus && other.key !== brand.key)
    .sort((a, b) => Number(b.country === brand.country) - Number(a.country === brand.country) || byRank(a, b)).slice(0, 6) : [];
  const freeFromUsd = pricing.storeShippingFreeFromUsd ?? tariff.storeShippingFreeFromUsd;
  const allowanceUsd = allowanceToday(pricing);
  const note = brand ? storeNote(brand.key, locale, { days: t?.expressDays ?? null, limit: formatUsd(allowanceUsd, locale) }) : undefined;
  const catalogHref = catalog ? '/catalog?store=' + [...catalog.hosts].join(',') : '/catalog';
  return <dialog ref={ref} className="store-dialog" aria-labelledby="store-dialog-title" onClose={onClose} onClick={(event) => { if (event.target === ref.current) ref.current?.close(); }}>
    {brand && main && t && <>
      <div className="store-dialog-body">
        <span className="store-dialog-handle" aria-hidden="true" />
        <button type="button" className="icon-btn store-dialog-close" aria-label={c.close} onClick={() => ref.current?.close()}><X size={20} /></button>
        <div className="store-dialog-head">
          <StoreLogo brand={brand} size={60} loading="eager" />
          <div>
            <h2 id="store-dialog-title">{brand.name}</h2>
            <p>{storeFocusNames[brand.focus][locale]}<span aria-hidden="true"> · </span><CountryFlag code={main.country} /><span>{storeCountryNames[main.country][locale]}</span></p>
            {mark && <span className="store-dialog-mark">{mark === 'cart' ? c.inCartMark : c.youOrdered}</span>}
          </div>
        </div>

        {/* Keyed by store: another store opened from "similar stores" starts with a clean field. */}
        <DialogLinkForm key={brand.key} c={c} locale={locale} domain={main.root} />
        <a className="btn secondary store-dialog-open" href={`https://${main.root}`} target="_blank" rel="noopener noreferrer">{c.open(main.root)}<ArrowUpRight size={18} aria-hidden="true" /><span className="sr-only"> ({c.newTab})</span></a>

        <section className="store-dialog-terms" aria-labelledby="store-dialog-terms-title">
          <h3 id="store-dialog-terms-title">{t.region ? c.termsTitle(c.fromCountry[t.region]) : c.termsGeneric}</h3>
          {t.region ? <dl>
            <div><dt>{speed.names.express}</dt><dd>{t.expressDays ?? c.pendingTerms} · {t.expressPerKg}</dd></div>
            <div><dt>{speed.names.standard}</dt><dd>{t.standardDays ?? c.pendingTerms} · {t.standardPerKg}</dd></div>
            <div><dt>{c.termsLabels.weight}</dt><dd>{c.minParcel}</dd></div>
            <div><dt>{c.termsLabels.storeShipping}</dt><dd>{c.storeShippingRule(formatUsd(freeFromUsd, locale), formatUsd(unknownStoreShippingUsd, locale))}</dd></div>
            <div><dt>{c.termsLabels.customs}</dt><dd>{c.dutyLimit(formatUsd(allowanceUsd, locale))}</dd></div>
          </dl> : <p>{c.termsPending}</p>}
          {!t.currencySupported && t.currency && <p className="store-dialog-currency">{c.currencyUnsupported(t.currency)}</p>}
          <small>{c.termsNote}</small>
        </section>

        {catalog && catalog.count > 0 && <section className="store-dialog-section store-dialog-shelf" aria-labelledby="store-dialog-shelf-title">
          <h3 id="store-dialog-shelf-title">{c.catalogShelf(catalog.count)}</h3>
          <ul className="store-dialog-products">{catalog.items.slice(0, shelfSize).map((item) => <li key={item.product.id}>
            <Link href={catalogHref}><span className="store-dialog-photo"><ProductImage product={item.product} decorative locale={locale} /></span><span className="store-dialog-product-name">{item.product.name}</span>{item.costs && <Money value={item.costs.total} locale={locale} />}</Link>
          </li>)}</ul>
          {catalog.count > shelfSize && <Link className="store-dialog-all" href={catalogHref}>{c.allProducts(catalog.count)}<ArrowRight size={16} aria-hidden="true" /></Link>}
        </section>}

        {(brand.storefronts.length > 1 || !t.currencySupported) && <section className="store-dialog-section" aria-labelledby="store-dialog-fronts-title">
          <h3 id="store-dialog-fronts-title">{c.storefronts}</h3>
          <ul className="store-dialog-fronts">{brand.storefronts.map((front) => {
            const ft = terms[front.country];
            return <li key={front.root}><a href={`https://${front.root}`} target="_blank" rel="noopener noreferrer">
              <CountryFlag code={front.country} />
              <span className="store-dialog-front-main"><span>{storeCountryNames[front.country][locale]}</span><small>{front.root}</small><span className="sr-only"> ({c.newTab})</span></span>
              <ArrowUpRight size={16} aria-hidden="true" />
              <span className="store-dialog-front-meta">{ft.currency && <span>{ft.currency}</span>}<span>{ft.expressShort ?? c.pendingTerms}</span>{!ft.currencySupported && ft.currency && <em>{c.currencyUnsupported(ft.currency)}</em>}</span>
            </a></li>;
          })}</ul>
        </section>}

        {note && <p className="store-dialog-note"><Info size={18} aria-hidden="true" /><span>{note}</span></p>}

        <details className="store-dialog-howto"><summary>{c.howTitle}<ChevronDown size={18} aria-hidden="true" /></summary>
          <ul>{c.howto.map(([device, hint]) => <li key={device}><b>{device}</b><span>{hint}</span></li>)}</ul>
        </details>

        {similar.length > 0 && <section className="store-dialog-section" aria-labelledby="store-dialog-similar-title">
          <h3 id="store-dialog-similar-title">{c.similar}</h3>
          <ul className="store-dialog-similar">{similar.map((other) => <li key={other.key}><button type="button" onClick={() => onOpen(other)}><StoreLogo brand={other} size={32} /><span>{other.name}</span></button></li>)}</ul>
        </section>}
      </div>
      {/* Phones: the calculate button stays at the bottom of the sheet while the card scrolls. */}
      <div className="store-dialog-foot"><button type="submit" form="store-dialog-link" className="btn primary">{c.calculate}<ArrowRight size={18} aria-hidden="true" /></button></div>
    </>}
  </dialog>;
}

/** The link field of the store card: the same link-order route as the hero form, the validation error under the field. */
function DialogLinkForm({ c, locale, domain }: { c: Copy; locale: Locale; domain: string }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    try { goToLinkOrder(url); } catch { setError(homeCopy[locale].hero.invalid); }
  }
  return <form id="store-dialog-link" className="store-dialog-link" onSubmit={submit} noValidate>
    <label className="sr-only" htmlFor="store-dialog-url">{c.dialogPaste(domain)}</label>
    <span className="stores-link-field"><Link2 size={20} aria-hidden="true" />
      <input id="store-dialog-url" type="url" inputMode="url" autoComplete="off" spellCheck={false} enterKeyHint="go" value={url} placeholder={c.dialogPaste(domain)} aria-invalid={!!error} aria-describedby={error ? 'store-dialog-error' : undefined} onChange={(event) => { setUrl(event.target.value); setError(''); }} />
    </span>
    <button type="submit" className="btn primary store-dialog-calc">{c.calculate}<ArrowRight size={18} aria-hidden="true" /></button>
    {error && <p id="store-dialog-error" className="stores-link-error" role="alert">{error}</p>}
  </form>;
}
