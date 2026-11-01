'use client';

import { useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, Clock3, Info, Link2 } from 'lucide-react';
import Link from '@/components/site-link';
import { PasteButton } from '@/components/paste-button';
import { useMarket } from '@/lib/market/store';
import { tariff, unknownStoreShippingUsd, validateSource, type Pricing } from '@/lib/market/domain';
import { customsParams } from '@/lib/market/customs';
import { deliverySpeedCopy } from '@/lib/market/delivery-speed';
import { formatUsd } from '@/lib/market/format';
import { tashkentDay } from '@/lib/market/world';
import { storesCopy } from '@/lib/market/stores-copy';
import { storeNote } from '@/lib/market/store-notes';
import { storeCountryTerms } from '@/lib/market/store-geo';
import { popularBrandKeys, storeBrands, storeCountryNames, storeFocusNames, storefrontUrl, type StoreBrand } from '@/lib/market/store-brands';
import { storeBySlug } from '@/lib/market/store-pages';
import type { Locale } from '@/lib/market/i18n';
import { withCyrillic } from '@/lib/market/uz-cyrl';
import { CountryFlag } from './flags';
import { StoreLogo } from './store-logo';

/** Popular stores first, then the bigger ones (more country storefronts), then by name. */
const byRank = (a: StoreBrand, b: StoreBrand) => {
  const pa = popularBrandKeys.indexOf(a.key), pb = popularBrandKeys.indexOf(b.key);
  if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
  return b.storefronts.length - a.storefronts.length || a.name.localeCompare(b.name);
};

/** The duty-free allowance of the Tashkent calendar day, as the rest of the customs copy counts it. */
const allowanceToday = (pricing: Pricing) => customsParams(pricing, tashkentDay(Date.now())).allowanceUsd;

/** The link-order page for a pasted product link; throws the validation error for a bad one. */
export function goToLinkOrder(value: string) {
  window.location.assign('/order-by-link?url=' + encodeURIComponent(validateSource(value.trim())));
}

/**
 * The top of a store's page (/stores/[slug], 1 November 2026): logo, name, country and delivery days from it, then the
 * compact «Нет нужного товара? Скопируйте ссылку на <domain> и вставьте» with the link field. `count` is the store's
 * catalog products as the server counted them (null when it could not): without products the field is the whole page.
 */
export function StoreHead({ slug, count }: { slug: string; count: number | null }) {
  const { state, pricing } = useMarket();
  const locale = state.communication.language as Locale;
  const brand = storeBySlug(slug);
  if (!brand) return null;
  const c = storesCopy[locale], speed = deliverySpeedCopy[locale];
  const main = brand.storefronts[0];
  const terms = storeCountryTerms(pricing, main.country, locale);
  const domain = main.root;
  return <header className="store-head">
    <div className="store-head-id">
      <StoreLogo brand={brand} size={64} loading="eager" />
      <div>
        <h1>{c.pageTitle(brand.name)}</h1>
        <p className="store-head-meta"><CountryFlag code={main.country} /><span>{storeCountryNames[main.country][locale]}</span><span aria-hidden="true">·</span><span>{storeFocusNames[brand.focus][locale]}</span></p>
      </div>
    </div>
    <p className="store-head-lead">{c.pageLead(count ?? 0)}</p>
    <ul className="store-head-terms" aria-label={c.pageDelivery}>
      {terms.region ? <>
        <li><Clock3 size={16} aria-hidden="true" /><span><b>{speed.names.express}</b> {terms.expressDays ?? c.pendingTerms}</span><span className="store-head-rate">{terms.expressPerKg}</span></li>
        <li><Clock3 size={16} aria-hidden="true" /><span><b>{speed.names.standard}</b> {terms.standardDays ?? c.pendingTerms}</span><span className="store-head-rate">{terms.standardPerKg}</span></li>
      </> : <li><Clock3 size={16} aria-hidden="true" /><span>{c.termsPending}</span></li>}
    </ul>
    <StoreLinkBox slug={brand.key} domain={domain} label={count === 0 ? c.pageEmpty(domain) : c.pageMissing(domain)} />
  </header>;
}

/** «Нет нужного товара?»: the store's own field for a product link, its calculation and a way to open the store. */
function StoreLinkBox({ slug, domain, label }: { slug: string; domain: string; label: string }) {
  const { state } = useMarket();
  const locale = state.communication.language as Locale;
  const c = storesCopy[locale];
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const id = 'store-link-' + slug;
  function submit(event: FormEvent) {
    event.preventDefault();
    try { goToLinkOrder(url); } catch { setError(c.invalidLink); }
  }
  return <form className="store-link" onSubmit={submit} noValidate>
    <label htmlFor={id} className="store-link-label">{label}</label>
    <div className="store-link-row">
      <span className="store-link-field"><Link2 size={20} aria-hidden="true" />
        <input id={id} type="url" inputMode="url" autoComplete="off" spellCheck={false} enterKeyHint="go" value={url} placeholder={c.dialogPaste(domain)} aria-invalid={!!error} aria-describedby={error ? id + '-error' : undefined} onChange={(event) => { setUrl(event.target.value); setError(''); }} />
        <PasteButton targetId={id} locale={state.communication.language} onPaste={(text) => { setUrl(text); setError(''); }} />
      </span>
      <button type="submit" className="btn primary"><span className="store-link-go">{c.calculate}</span><ArrowRight size={18} aria-hidden="true" /></button>
    </div>
    {error && <p id={id + '-error'} className="store-link-error" role="alert">{error}</p>}
    <a className="store-link-open" href={storefrontUrl(domain)} target="_blank" rel="noopener noreferrer">{c.open(domain)}<ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only"> ({c.newTab})</span></a>
  </form>;
}

/**
 * Under the products: how ordering from this store works — delivery terms from its country, its country storefronts, a
 * note where the store deserves one, how to copy a link and similar stores (each a link to its own page).
 */
export function StoreAbout({ slug }: { slug: string }) {
  const { state, pricing } = useMarket();
  const locale = state.communication.language as Locale;
  const brand = storeBySlug(slug);
  if (!brand) return null;
  const c = storesCopy[locale], speed = deliverySpeedCopy[locale];
  const main = brand.storefronts[0];
  const t = storeCountryTerms(pricing, main.country, locale);
  const allowanceUsd = allowanceToday(pricing);
  const freeFromUsd = pricing.storeShippingFreeFromUsd ?? tariff.storeShippingFreeFromUsd;
  const note = storeNote(brand.key, locale, { days: t.expressDays, limit: formatUsd(allowanceUsd, locale) });
  const similar = storeBrands.filter((other) => other.focus === brand.focus && other.key !== brand.key)
    .sort((a, b) => Number(b.country === brand.country) - Number(a.country === brand.country) || byRank(a, b)).slice(0, 8);
  return <section className="store-about" aria-labelledby="store-about-title">
    <h2 id="store-about-title">{c.pageAbout(brand.name)}</h2>
    <div className="store-about-grid">
      <div className="store-about-card">
        <h3>{t.region ? c.termsTitle(c.fromCountry[t.region]) : c.termsGeneric}</h3>
        {t.region ? <dl>
          <div><dt>{speed.names.express}</dt><dd>{t.expressDays ?? c.pendingTerms} · {t.expressPerKg}</dd></div>
          <div><dt>{speed.names.standard}</dt><dd>{t.standardDays ?? c.pendingTerms} · {t.standardPerKg}</dd></div>
          <div><dt>{c.termsLabels.weight}</dt><dd>{c.minParcel}</dd></div>
          <div><dt>{c.termsLabels.storeShipping}</dt><dd>{c.storeShippingRule(formatUsd(freeFromUsd, locale), formatUsd(unknownStoreShippingUsd, locale))}</dd></div>
          <div><dt>{c.termsLabels.customs}</dt><dd>{c.dutyLimit(formatUsd(allowanceUsd, locale))}</dd></div>
        </dl> : <p>{c.termsPending}</p>}
        {!t.currencySupported && t.currency && <p className="store-about-warn">{c.currencyUnsupported(t.currency)}</p>}
        <Link className="text-link" href="/delivery">{routeDelivery(locale)}<ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      <div className="store-about-card">
        {brand.storefronts.length > 1 && <>
          <h3>{c.storefronts}</h3>
          <ul className="store-about-fronts">{brand.storefronts.map((front) => <li key={front.root}>
            <a href={storefrontUrl(front.root)} target="_blank" rel="noopener noreferrer"><CountryFlag code={front.country} /><span>{storeCountryNames[front.country][locale]}</span><small>{front.root}</small><ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only"> ({c.newTab})</span></a>
          </li>)}</ul>
        </>}
        {note && <p className="store-about-note"><Info size={18} aria-hidden="true" /><span>{note}</span></p>}
        <details className="store-about-howto"><summary>{c.howtoTitle}<ChevronDown size={18} aria-hidden="true" /></summary>
          <ul>{c.howto.map(([device, hint]) => <li key={device}><b>{device}</b><span>{hint}</span></li>)}</ul>
        </details>
      </div>
    </div>
    {similar.length > 0 && <nav className="store-about-similar" aria-labelledby="store-similar-title">
      <h3 id="store-similar-title">{c.similar}</h3>
      <ul>{similar.map((other) => <li key={other.key}><Link href={'/stores/' + other.key}><StoreLogo brand={other} size={40} /><span>{other.name}</span></Link></li>)}</ul>
      <Link className="text-link" href="/stores">{c.allStores}<ArrowRight size={16} aria-hidden="true" /></Link>
    </nav>}
    <p className="store-about-legal">{c.note}</p>
  </section>;
}

const deliveryLinks: Record<Locale, string> = /*@__PURE__*/withCyrillic({ ru: 'Тарифы по странам и калькулятор', uz: 'Mamlakatlar bo‘yicha tariflar va kalkulyator', en: 'Rates by country and calculator' });
const routeDelivery = (locale: Locale) => deliveryLinks[locale];
