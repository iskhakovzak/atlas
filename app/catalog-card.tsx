'use client';

import { useId } from 'react';
import { ArrowRight, Flame, Heart, Info, ShoppingBag } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { price, storeShippingHoldUsd, storeShippingUsd, tariff, type DeliverySpeed, type Product } from '@/lib/market/domain';
import { findOrderUrl } from '@/lib/market/catalog';
import { dealCopy } from '@/lib/market/deal-copy';
import { catalogCopy, countryLabel, shortDate } from '@/lib/market/catalog-copy';
import { storeLabel, type CatalogItem } from '@/lib/market/catalog-query';
import type { Signal } from '@/lib/market/catalog-signals';
import { regionForCountryLabel } from '@/lib/market/store-geo';
import { deliveryDaysFor } from '@/lib/market/site-content';
import { deliverySpeedCopy } from '@/lib/market/delivery-speed';
import { atlasServiceBreakdown } from '@/lib/market/quote-presentation';
import { homeCopy } from '@/lib/market/home-copy';
import { formatKg, formatSum } from '@/lib/market/format';
import type { Locale } from '@/lib/market/i18n';
import { brandForHost } from '@/lib/market/store-brands';
import { useMarket } from '@/lib/market/store';
import { ProductImage } from './market-ui';
import { Money } from './money';
import { StoreLogo } from './store-logo';
import {withCyrillic,uzText} from '@/lib/market/uz-cyrl';
import {isUzbek} from '@/lib/market/i18n';

const breakdownCopy = /*@__PURE__*/withCyrillic({
  ru: { item: 'Товар', store: 'Доставка магазина до склада', storeReserve: 'Резерв доставки магазина (отдельно, не в итоге)', storeFree: 'бесплатно', international: 'Доставка в Узбекистан', kg: 'кг', service: 'Комиссия Atlas', fee: 'Общий сбор Atlas', reserve: 'Возвратный резерв',
    storeReserveNote: (amount: string, freeFrom: string) => `Магазин не указал цену доставки до склада: резерв ${amount} удерживается отдельно и в итог не входит — один на заказ из этого магазина. Больше чем на ${freeFrom} из магазина — доставка бесплатна.`,
    storeFreeNote: (freeFrom: string) => `Магазин не указал цену доставки до склада, но при заказе больше чем на ${freeFrom} она бесплатна. Если магазин всё же возьмёт плату, доплата — только с вашего согласия.`, reserveNote: 'Возвратный резерв — запас на случай, если посылка окажется тяжелее. Неиспользованная часть вернётся на баланс Atlas, а доплата сверх резерва — только с вашего согласия.',
    staleNote: 'Оценка по последней записанной цене магазина: Atlas сверит цену при добавлении в корзину.' },
  uz: { item: 'Tovar', store: 'Do‘kondan omborgacha yetkazish', storeReserve: 'Do‘kon yetkazishi zaxirasi (alohida, jamiga kirmaydi)', storeFree: 'bepul', international: 'O‘zbekistonga yetkazish', kg: 'kg', service: 'Atlas komissiyasi', fee: 'Atlas umumiy yig‘imi', reserve: 'Qaytariladigan zaxira',
    storeReserveNote: (amount: string, freeFrom: string) => `Do‘kon omborgacha yetkazish narxini ko‘rsatmagan: ${amount} zaxira alohida ushlab turiladi va jamiga kirmaydi — shu do‘kondan bitta buyurtmaga bir marta. Do‘kondan ${freeFrom} dan ortiq — yetkazish bepul.`,
    storeFreeNote: (freeFrom: string) => `Do‘kon omborgacha yetkazish narxini ko‘rsatmagan, lekin ${freeFrom} dan ortiq buyurtmada u bepul. Do‘kon baribir haq olsa, qo‘shimcha to‘lov — faqat roziligingiz bilan.`, reserveNote: 'Qaytariladigan zaxira — jo‘natma og‘irroq chiqsa, ehtiyot uchun. Ishlatilmagan qismi Atlas balansiga qaytadi, zaxiradan ortiq to‘lov — faqat roziligingiz bilan.',
    staleNote: 'Do‘konning oxirgi yozilgan narxi bo‘yicha baho: Atlas narxni savatga qo‘shishda tekshiradi.' },
  en: { item: 'Item', store: 'Store delivery to warehouse', storeReserve: 'Store-delivery reserve (separate, not in the total)', storeFree: 'free', international: 'Delivery to Uzbekistan', kg: 'kg', service: 'Atlas fee', fee: 'General Atlas fee', reserve: 'Refundable reserve',
    storeReserveNote: (amount: string, freeFrom: string) => `The store did not state delivery to our warehouse: a ${amount} reserve is held separately and is not in the total — once per order from this store. Over ${freeFrom} from the store, delivery is free.`,
    storeFreeNote: (freeFrom: string) => `The store did not state delivery to our warehouse, but orders over ${freeFrom} ship free. If the store still charges, any extra payment needs your consent.`, reserveNote: 'The refundable reserve covers a heavier-than-estimated parcel. Any unused part returns to your Atlas balance; anything above it needs your consent.',
    staleNote: 'An estimate at the last recorded store price: Atlas checks the price when you add the item to the cart.' },
});
type Breakdown = (typeof breakdownCopy)['ru'];
type Costs = NonNullable<CatalogItem['costs']>;

export function catalogFormatter(locale: Locale) {
  const numberLocale = locale === 'ru' ? 'ru-RU' : isUzbek(locale) ? uzText(locale, 'uz-UZ') : 'en-US';
  const fmt = (value: number, currency = 'UZS') => currency === 'UZS'
    ? formatSum(value, locale)
    : new Intl.NumberFormat(numberLocale, { style: 'currency', currency, minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value);
  return { fmt, numberLocale };
}

export type CatalogCardProps = {
  item: CatalogItem; locale: Locale; select: (product: Product) => void;
  saved: boolean; canSave: boolean; saving: boolean; onSave: () => void;
  /** Chips from `signalsFor` (at most two, at most one coloured); none on the home teaser. */
  signals?: Signal[];
  /** The same product (id and source URL) is already in the cart: the button opens the cart instead. */
  inCart?: boolean;
  /** International delivery speed the total is quoted at: the cart's speed for a customer, express otherwise. */
  speed?: DeliverySpeed;
  /** `compact`: photo, one-line name and the price pair; the whole card opens the product sheet (home teaser, shelves). */
  variant?: 'full' | 'compact';
};

/**
 * One catalog product. Photo and name always open the product sheet (an unconfirmed price too: the sheet
 * says so and the order flow fetches the price again); the button goes straight to the link order.
 */
export function CatalogCard({ item, locale, select, saved, canSave, saving, onSave, signals = [], inCart = false, speed = 'express', variant = 'full' }: CatalogCardProps) {
  const { product, referenceUsd, discount } = item;
  const { pricing } = useMarket();
  const copy = dealCopy(locale), cc = catalogCopy[locale], hc = homeCopy[locale];
  const { fmt, numberLocale } = catalogFormatter(locale);
  const name = product.name;
  const needsPrice = product.priceNeedsConfirmation === true;
  const hasRecordedPrice = needsPrice && product.sourcePrice !== undefined && Boolean(product.sourceCurrency);
  const orderUrl = findOrderUrl(product);
  const category = cc.categories[product.category] ?? product.category;
  const costs = costsAt(item, speed, pricing);
  const storePriceText = needsPrice ? (hasRecordedPrice ? fmt(product.sourcePrice!, product.sourceCurrency!) : cc.checkPrice) : fmt(product.usd, 'USD');
  const open = () => select(product);
  const priceId = useId();
  const save = canSave ? <Tooltip><TooltipTrigger asChild><button type="button" disabled={saving} className={'find-save ' + (saved ? 'saved' : '')} aria-pressed={saved} aria-label={(saved ? copy.remove : copy.save) + ': ' + name} onClick={onSave}><Heart size={20} /></button></TooltipTrigger><TooltipContent>{saving ? copy.savingState : saved ? copy.remove : copy.save}</TooltipContent></Tooltip> : null;

  if (variant === 'compact') {
    // The whole card is one button (phrasing content only, so spans), with the heart beside it, not inside.
    return <article className="find-card find-card-compact" data-saved={saved || undefined}>
      <button type="button" className="find-compact" onClick={open} aria-label={cc.open(name)} aria-describedby={costs ? priceId : undefined}>
        <span className="find-visual"><span className="find-photo"><ProductImage product={product} decorative locale={locale} /></span>{discount >= 40 && <span className="find-top-deal"><Flame size={14} />{copy.topDeal}</span>}</span>
        <span className="find-content">
          <span className="find-meta"><span className="find-store"><StoreMark host={item.store} />{storeLabel(item.store, locale) || product.brand || category}</span></span>
          <b className="find-compact-title">{name}</b>
          <span className="find-compact-price" id={priceId}>{costs ? <><span>{storePriceText}</span><span aria-hidden="true"> → </span>{needsPrice && <span aria-hidden="true">≈ </span>}<Money value={costs.total} locale={locale} /></> : <span>{storePriceText}</span>}</span>
        </span>
      </button>
      {save}
    </article>;
  }

  const confirmedAt = product.confirmedAt;
  // The price keeps its date when it is older than the card looks: a stale snapshot, or stock the operator
  // confirmed without the store re-reading the price.
  const priceDated = item.checkedAt > 0 && (needsPrice ? hasRecordedPrice : confirmedAt !== undefined && item.checkedAt < confirmedAt);
  // One mint element per card: the discount pill wins, so a mint chip next to it turns neutral.
  const hasDiscountPill = !needsPrice && discount > 0;
  const chips = signals.slice(0, 2).map((signal) => hasDiscountPill && signal.tone === 'mint' ? { ...signal, tone: 'neutral' as const } : signal);
  return <article className="find-card" data-stale={needsPrice || undefined} data-saved={saved || undefined}>
    <div className="find-visual">
      <button className="find-photo" type="button" onClick={open} aria-label={cc.open(name)}><ProductImage product={product} locale={locale} /></button>
      {discount >= 40 && <span className="find-top-deal"><Flame size={14} />{copy.topDeal}</span>}
      {save}
    </div>
    <div className="find-content">
      <div className="find-meta"><span className="find-store"><StoreMark host={item.store} />{storeLabel(item.store, locale) || product.brand || category}</span><span>{category}</span></div>
      <button type="button" className="find-title" onClick={open}>{name}</button>
      <div className={'find-store-price' + (needsPrice ? ' needs-confirmation' : '')}>
        <span>{priceDated ? cc.storePriceOn(shortDate(item.checkedAt, locale)) : cc.storePrice}</span>
        {' '}<b>{storePriceText}</b>
        {!needsPrice && discount > 0 && <>{' '}<del title={copy.referenceLabel}>{fmt(referenceUsd!, 'USD')}</del>{' '}<em className="find-discount" title={copy.compareHint}>−{discount}&#x202F;%</em></>}
      </div>
      {costs
        ? <FindPrice costs={costs} product={product} stale={needsPrice} speed={speed} label={needsPrice ? cc.totalStale : cc.total} breakdownLabel={cc.breakdown} fmt={fmt} numberLocale={numberLocale} locale={locale} note={confirmedAt ? cc.confirmedBy(shortDate(confirmedAt, locale)) : ''} />
        : <div className="find-total"><div className="find-total-head"><span>{cc.totalStale}</span></div><strong className="find-total-pending"><span>{cc.afterCheck}</span></strong><small className="find-total-note" /></div>}
      <Facts product={product} speed={speed} locale={locale} />
      <div className="find-chips">
        {/* The hint is a title for the pointer and hidden text for screen readers (a title alone is not read). */}
        {chips.map((signal) => <span key={signal.kind} className="find-chip" data-tone={signal.tone} data-kind={signal.kind} title={signal.hint}>{signal.text}{signal.hint && <span className="sr-only">. {signal.hint}</span>}</span>)}
      </div>
      <div className="find-purchase">
        {inCart
          ? <a className="btn secondary" href="/cart"><ShoppingBag size={17} aria-hidden="true" />{cc.inCart}</a>
          : <a className="btn primary" href={orderUrl}>{hc.catalog.order}<ArrowRight size={17} aria-hidden="true" /></a>}
      </div>
    </div>
  </article>;
}

/** The item's costs at the quoted speed: the catalog prices at express; a standard-speed cart re-prices the same lines. */
function costsAt(item: CatalogItem, speed: DeliverySpeed, pricing = tariff): Costs | null {
  if (!item.costs) return null;
  if (speed === 'express' || item.usd === undefined) return item.costs;
  try { return price(item.usd, item.product.weight, 1, storeShippingUsd(item.product), pricing, speed); } catch { return item.costs; }
}

/** Delivered total in soum with an in-flow "i" button that opens the line-by-line breakdown. */
function FindPrice({ costs, product, stale, speed, label, breakdownLabel, fmt, numberLocale, locale, note }: {
  costs: Costs; product: Product; stale: boolean; speed: DeliverySpeed; label: string; breakdownLabel: string;
  fmt: (n: number, currency?: string) => string; numberLocale: string; locale: Locale; note: string;
}) {
  const { pricing } = useMarket();
  const bd: Breakdown = breakdownCopy[locale];
  const parts = atlasServiceBreakdown(costs);
  const usd = costs.merchandise / pricing.fx;
  const estimated = product.sourceShippingEstimated === true && (product.sourceShippingUsd ?? 0) > 0;
  // Unknown store delivery is never in the total: a separate hold up to $50, free above it.
  const holdUsd = estimated ? storeShippingHoldUsd(product, usd, pricing) : 0;
  const storeReserve = estimated && holdUsd > 0, storeFree = estimated && holdUsd === 0;
  const freeFrom = fmt(pricing.storeShippingFreeFromUsd ?? 50, 'USD');
  return <div className="find-total">
    <div className="find-total-head">
      <span>{label}</span>
      <Popover>
        <PopoverTrigger asChild><button type="button" className="find-info" aria-label={breakdownLabel}><Info size={18} aria-hidden="true" /></button></PopoverTrigger>
        <PopoverContent className="find-breakdown-popover" align="end" sideOffset={6} collisionPadding={12}>
          <p className="find-breakdown-title">{breakdownLabel}</p>
          <dl>
            <div><dt>{bd.item}</dt><dd>{fmt(costs.merchandise)}</dd></div>
            {costs.sourceShipping > 0 && <div><dt>{bd.store}</dt><dd>{fmt(costs.sourceShipping)}</dd></div>}
            {storeReserve && <div><dt>{bd.storeReserve}</dt><dd>{fmt(Math.ceil(holdUsd * pricing.fx))}</dd></div>}
            {storeFree && <div><dt>{bd.store}</dt><dd>{bd.storeFree}</dd></div>}
            <div><dt>{bd.international}, {new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(costs.weight)} {bd.kg} · {deliverySpeedCopy[locale].short[speed]}</dt><dd>{fmt(parts.international)}</dd></div>
            {parts.service > 0 && <div><dt>{bd.service}</dt><dd>{fmt(parts.service)}</dd></div>}
            {costs.optionalServices > 0 && <div><dt>{bd.fee}</dt><dd>{fmt(costs.optionalServices)}</dd></div>}
            {costs.reserve > 0 && <div><dt>{bd.reserve}</dt><dd>{fmt(costs.reserve)}</dd></div>}
          </dl>
          {storeReserve && <p>{bd.storeReserveNote(fmt(product.sourceShippingUsd ?? 0, 'USD'), freeFrom)}</p>}
          {storeFree && <p>{bd.storeFreeNote(freeFrom)}</p>}
          {costs.reserve > 0 && <p>{bd.reserveNote}</p>}
          {stale && <p>{bd.staleNote}</p>}
        </PopoverContent>
      </Popover>
    </div>
    <strong><Money value={costs.total} locale={locale} /></strong>
    <small className="find-total-note" title={note || undefined}>{note}</small>
  </div>;
}

/** "США · 5–9 раб. дн · ≈ 1,2 кг": days only for a country Atlas dispatches from (never the US by default). */
function Facts({ product, speed, locale }: { product: Product; speed: DeliverySpeed; locale: Locale }) {
  const { pricing } = useMarket();
  const cc = catalogCopy[locale];
  const region = regionForCountryLabel(product.country);
  const range = region ? deliveryDaysFor(pricing, region, speed) : null;
  const parts = [countryLabel(product.country, locale), range ? cc.days(range[0], range[1]) : '', product.weight ? `≈ ${formatKg(product.weight, locale)} ${cc.kg}` : ''].filter(Boolean);
  const hint = `${cc.factsHint}; ${product.weightBasis === 'store' ? cc.weightStore : cc.weightEstimate}`;
  if (!parts.length) return <p className="find-facts" aria-hidden="true" />;
  return <p className="find-facts" title={hint}><span>{parts.join(' · ')}</span><span className="sr-only">. {hint}</span></p>;
}

/** Placeholder cards while the catalog loads, so the grid keeps its place. */
export function CatalogSkeleton({ count = 6, label }: { count?: number; label: string }) {
  return <div className="finds-grid catalog-skeleton" role="status" aria-label={label}>
    {Array.from({ length: count }, (_, index) => <div className="find-card catalog-skeleton-card" key={index} aria-hidden="true"><div className="find-visual" /><div className="find-content"><span /><span /><span /></div></div>)}
  </div>;
}

/** Small brand icon next to a store name; nothing for stores outside the directory. */
export function StoreMark({ host }: { host: string }) {
  const brand = brandForHost(host);
  return brand ? <StoreLogo brand={brand} size={18} /> : null;
}
