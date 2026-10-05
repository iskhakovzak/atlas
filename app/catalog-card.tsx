'use client';

import { useId, useState } from 'react';
import { ArrowRight, Flame, Heart, Info, PackageCheck, TriangleAlert } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { storeShippingHoldUsd, type Product } from '@/lib/market/domain';
import { findOrderUrl } from '@/lib/market/catalog';
import { dealCopy } from '@/lib/market/deal-copy';
import { catalogCopy } from '@/lib/market/catalog-copy';
import { storeLabel, type CatalogItem } from '@/lib/market/catalog-query';
import { atlasServiceBreakdown } from '@/lib/market/quote-presentation';
import { formatSum, homeCopy } from '@/lib/market/home-copy';
import type { Locale } from '@/lib/market/i18n';
import { ProductImage } from './market-ui';
import { StoreLogo } from './store-logo';

import { brandForHost } from '@/lib/market/store-brands';
import { useMarket } from '@/lib/market/store';

const breakdownCopy = {
  ru: { item: 'Товар', store: 'Доставка магазина до склада', storeReserve: 'Резерв доставки магазина (отдельно, не в итоге)', storeFree: 'бесплатно', international: 'Доставка в Узбекистан', kg: 'кг', service: 'Комиссия Atlas', fee: 'Общий сбор Atlas', reserve: 'Возвратный резерв',
    storeReserveNote: (amount: string, freeFrom: string) => `Магазин не указал цену доставки до склада: резерв ${amount} удерживается отдельно и в итог не входит — один на заказ из этого магазина. Больше чем на ${freeFrom} из магазина — доставка бесплатна.`,
    storeFreeNote: (freeFrom: string) => `Магазин не указал цену доставки до склада, но при заказе больше чем на ${freeFrom} она бесплатна. Если магазин всё же возьмёт плату, сначала спросим вас.`, reserveNote: 'Возвратный резерв — запас на случай, если посылка окажется тяжелее. Неиспользованная часть вернётся на баланс Atlas, а доплату сверх резерва согласуем с вами заранее.' },
  uz: { item: 'Tovar', store: 'Do‘kondan omborgacha yetkazish', storeReserve: 'Do‘kon yetkazishi zaxirasi (alohida, jamiga kirmaydi)', storeFree: 'bepul', international: 'O‘zbekistonga yetkazish', kg: 'kg', service: 'Atlas komissiyasi', fee: 'Atlas umumiy yig‘imi', reserve: 'Qaytariladigan zaxira',
    storeReserveNote: (amount: string, freeFrom: string) => `Do‘kon omborgacha yetkazish narxini ko‘rsatmagan: ${amount} zaxira alohida ushlab turiladi va jamiga kirmaydi — shu do‘kondan bitta buyurtmaga bir marta. Do‘kondan ${freeFrom} dan ortiq — yetkazish bepul.`,
    storeFreeNote: (freeFrom: string) => `Do‘kon omborgacha yetkazish narxini ko‘rsatmagan, lekin ${freeFrom} dan ortiq buyurtmada u bepul. Do‘kon baribir haq olsa, avval sizdan so‘raymiz.`, reserveNote: 'Qaytariladigan zaxira — jo‘natma og‘irroq chiqsa, ehtiyot uchun. Ishlatilmagan qismi Atlas balansiga qaytadi, zaxiradan ortiq to‘lov siz bilan oldindan kelishiladi.' },
  en: { item: 'Item', store: 'Store delivery to warehouse', storeReserve: 'Store-delivery reserve (separate, not in the total)', storeFree: 'free', international: 'Delivery to Uzbekistan', kg: 'kg', service: 'Atlas fee', fee: 'General Atlas fee', reserve: 'Refundable reserve',
    storeReserveNote: (amount: string, freeFrom: string) => `The store did not state delivery to our warehouse: a ${amount} reserve is held separately and is not in the total — once per order from this store. Over ${freeFrom} from the store, delivery is free.`,
    storeFreeNote: (freeFrom: string) => `The store did not state delivery to our warehouse, but orders over ${freeFrom} ship free. If the store still charges, we ask you first.`, reserveNote: 'The refundable reserve covers a heavier-than-estimated parcel. Any unused part returns to your Atlas balance; anything above it is agreed with you first.' },
};
type Breakdown = (typeof breakdownCopy)['ru'];
type Costs = NonNullable<CatalogItem['costs']>;

export function catalogFormatter(locale: Locale) {
  const numberLocale = locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-US';
  const fmt = (value: number, currency = 'UZS') => currency === 'UZS'
    ? formatSum(value, locale)
    : new Intl.NumberFormat(numberLocale, { style: 'currency', currency, minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value);
  return { fmt, numberLocale };
}

/**
 * One catalog product. A current price opens the product sheet; an unconfirmed one goes
 * straight to the link order, which fetches the price again before anything is added.
 */
export function CatalogCard({ item, locale, select, saved, canSave, saving, onSave, parcel, overLimit }: {
  item: CatalogItem; locale: Locale; select: (product: Product) => void;
  saved: boolean; canSave: boolean; saving: boolean; onSave: () => void;
  parcel?: { store: string; extra: number } | null; overLimit?: boolean;
}) {
  const { product, costs, referenceUsd, discount } = item;
  const copy = dealCopy(locale), cc = catalogCopy[locale], hc = homeCopy[locale];
  const { fmt, numberLocale } = catalogFormatter(locale);
  const name = product.name;
  const needsPrice = product.priceNeedsConfirmation === true;
  const hasRecordedPrice = needsPrice && product.sourcePrice !== undefined && Boolean(product.sourceCurrency);
  const orderUrl = findOrderUrl(product);
  const category = cc.categories[product.category] ?? product.category;
  const label = (ru: string, uz: string, en: string) => locale === 'ru' ? ru : locale === 'uz' ? uz : en;
  return <article className="find-card">
    <div className="find-visual">
      {needsPrice
        ? <a className="find-photo" href={orderUrl} aria-label={name}><ProductImage product={product} /></a>
        : <button className="find-photo" type="button" onClick={() => select(product)} aria-label={name}><ProductImage product={product} /></button>}
      {discount >= 40 && <span className="find-top-deal"><Flame size={14} />{copy.topDeal}</span>}
      {canSave && <Tooltip><TooltipTrigger asChild><button type="button" disabled={saving} className={'find-save ' + (saved ? 'saved' : '')} aria-pressed={saved} aria-label={(saved ? copy.remove : copy.save) + ': ' + name} onClick={onSave}><Heart size={20} /></button></TooltipTrigger><TooltipContent>{saving ? copy.savingState : saved ? copy.remove : copy.save}</TooltipContent></Tooltip>}
    </div>
    <div className="find-content">
      <div className="find-meta"><span className="find-store"><StoreMark host={item.store} />{storeLabel(item.store, locale) || product.brand || category}</span><span>{category}</span></div>
      {needsPrice ? <a className="find-title" href={orderUrl}>{name}</a> : <button type="button" className="find-title" onClick={() => select(product)}>{name}</button>}
      <div className={'find-store-price' + (needsPrice ? ' needs-confirmation' : '')}>
        <span>{needsPrice ? (hasRecordedPrice ? label('Последняя цена магазина', 'Do‘kondagi oxirgi narx', 'Last recorded store price') : label('Цена в магазине', 'Do‘kondagi narx', 'Store price')) : copy.productPrice}</span>
        <div><b>{needsPrice ? (hasRecordedPrice ? fmt(product.sourcePrice!, product.sourceCurrency!) : label('Уточнить цену', 'Narxni aniqlash', 'Check current price')) : fmt(product.usd, 'USD')}</b>{!needsPrice && discount > 0 && <del title={copy.referenceLabel}>{fmt(referenceUsd!, 'USD')}</del>}</div>
        {!needsPrice && discount > 0 && <span className="find-discount" title={copy.compareHint}>−{discount}%</span>}
      </div>
      {costs
        ? <FindPrice costs={costs} product={product} label={needsPrice && hasRecordedPrice ? label('Ориентир с доставкой', 'Yetkazish bilan taxmin', 'Delivery estimate') : hc.catalog.total} breakdownLabel={hc.catalog.breakdown} fmt={fmt} numberLocale={numberLocale} bd={breakdownCopy[locale]} />
        : <div className="find-total"><span>{label('Расчёт после проверки цены', 'Narx tekshirilgach hisob', 'Estimate after price check')}</span><strong>{label('Рассчитаем после проверки цены', 'Narx tekshirilgach hisoblaymiz', 'Calculated after price check')}</strong></div>}
      {parcel && costs && <p className="find-parcel" title={cc.parcelHint(fmt(costs.total))}><PackageCheck size={16} aria-hidden="true" /><span>{cc.parcelLine(storeLabel(parcel.store, locale))}</span><b>+{fmt(parcel.extra)}</b></p>}
      {overLimit && <p className="find-limit" title={cc.overLimitHint}><TriangleAlert size={15} aria-hidden="true" />{cc.overLimit}</p>}
      {/* No merchant link on the card: it would send customers away from the order flow. */}
      <div className="find-purchase"><a className="btn primary" href={orderUrl}>{hc.catalog.order}<ArrowRight size={17} aria-hidden="true" /></a></div>
    </div>
  </article>;
}

/** Delivered total in soum with an "i" toggle that opens the line-by-line breakdown. */
function FindPrice({ costs, product, label, breakdownLabel, fmt, numberLocale, bd }: { costs: Costs; product: Product; label: string; breakdownLabel: string; fmt: (n: number, currency?: string) => string; numberLocale: string; bd: Breakdown }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { pricing } = useMarket();
  const parts = atlasServiceBreakdown(costs);
  const estimated = product.sourceShippingEstimated === true && (product.sourceShippingUsd ?? 0) > 0;
  // Unknown store delivery is never in the total: a separate hold up to $50, free above it.
  const holdUsd = estimated ? storeShippingHoldUsd(product, product.usd, pricing) : 0;
  const storeReserve = estimated && holdUsd > 0, storeFree = estimated && holdUsd === 0;
  const freeFrom = fmt(pricing.storeShippingFreeFromUsd ?? 50, 'USD');
  return <>
    <div className="find-total"><span>{label}</span><strong>{fmt(costs.total)}</strong><button type="button" className="find-info" aria-label={breakdownLabel} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}><Info size={18} aria-hidden="true" /></button></div>
    {open && <div id={id} className="find-breakdown"><dl>
      <div><dt>{bd.item}</dt><dd>{fmt(costs.merchandise)}</dd></div>
      {costs.sourceShipping > 0 && <div><dt>{bd.store}</dt><dd>{fmt(costs.sourceShipping)}</dd></div>}
      {storeReserve && <div><dt>{bd.storeReserve}</dt><dd>{fmt(Math.ceil(holdUsd * pricing.fx))}</dd></div>}
      {storeFree && <div><dt>{bd.store}</dt><dd>{bd.storeFree}</dd></div>}
      <div><dt>{bd.international}, {new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(costs.weight)} {bd.kg}</dt><dd>{fmt(parts.international)}</dd></div>
      {parts.service > 0 && <div><dt>{bd.service}</dt><dd>{fmt(parts.service)}</dd></div>}
      {costs.optionalServices > 0 && <div><dt>{bd.fee}</dt><dd>{fmt(costs.optionalServices)}</dd></div>}
      {costs.reserve > 0 && <div><dt>{bd.reserve}</dt><dd>{fmt(costs.reserve)}</dd></div>}
    </dl>{storeReserve && <p>{bd.storeReserveNote(fmt(product.sourceShippingUsd ?? 0, 'USD'), freeFrom)}</p>}{storeFree && <p>{bd.storeFreeNote(freeFrom)}</p>}{costs.reserve > 0 && <p>{bd.reserveNote}</p>}</div>}
  </>;
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
