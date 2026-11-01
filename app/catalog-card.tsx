'use client';

import { useId, type MouseEvent } from 'react';
import { BadgeCheck, Check, Flame, Heart, Plus, ShoppingBag } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { price, storeShippingUsd, tariff, type DeliverySpeed, type Product } from '@/lib/market/domain';
import { catalogDeliverySpeed } from '@/lib/market/deals';
import { officialBadgeLabel, officialListing, officialStoreBrand, officialStoreText } from '@/lib/market/official-stores';
import { dealCopy } from '@/lib/market/deal-copy';
import { catalogCopy, shortDate } from '@/lib/market/catalog-copy';
import { storeLabel, type CatalogItem } from '@/lib/market/catalog-query';
import type { Signal } from '@/lib/market/catalog-signals';
import { formatPriceUsd, formatSum } from '@/lib/market/format';
import { browserStorage, productPath, rememberPendingFavorite } from '@/lib/market/catalog-links';
import { loginPath } from '@/lib/auth/return-to';
import type { Locale } from '@/lib/market/i18n';
import { brandForHost } from '@/lib/market/store-brands';
import { displayBrand, nameWithoutBrand } from '@/lib/market/product-name';
import { useMarket } from '@/lib/market/store';
import { ProductImage } from './market-ui';
import { Swatch } from './catalog-swatch';
import { Money } from './money';
import { StoreBadge, StoreLogo } from './store-logo';
import {uzText} from '@/lib/market/uz-cyrl';
import {isUzbek} from '@/lib/market/i18n';

type Costs = NonNullable<CatalogItem['costs']>;

export function catalogFormatter(locale: Locale) {
  const numberLocale = locale === 'ru' ? 'ru-RU' : isUzbek(locale) ? uzText(locale, 'uz-UZ') : 'en-US';
  // Dollars are written as on the rest of the site ("$69", "$6,79"); other store currencies keep Intl's form.
  const fmt = (value: number, currency = 'UZS') => currency === 'UZS'
    ? formatSum(value, locale)
    : currency === 'USD'
      ? formatPriceUsd(value, locale)
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
  /** International delivery speed the total is quoted at: the cart's speed when it has lines, standard otherwise. */
  speed?: DeliverySpeed;
  /** `compact`: photo, one-line name and the price pair; the whole card opens the product sheet (home teaser, shelves). */
  variant?: 'full' | 'compact';
  /** A guest sees the heart too: it leads to sign-in and the tapped product is saved on return. */
  guestSave?: boolean;
  /** The first cards of the catalog: the photo loads at once ('eager'), the first row asked first ('high'). */
  priority?: 'high' | 'eager';
};

/**
 * One catalog product. The whole card opens the product sheet (an unconfirmed price too: the sheet says so and the
 * order flow fetches the price again); "В корзину" on a computer and the round "+" on a phone go to the variant choice.
 */
export function CatalogCard({ item, locale, select, saved, canSave, saving, onSave, signals = [], inCart = false, speed = catalogDeliverySpeed, variant = 'full', guestSave = false, priority }: CatalogCardProps) {
  const { product, referenceUsd, discount } = item;
  const { pricing } = useMarket();
  const copy = dealCopy(locale), cc = catalogCopy[locale];
  const { fmt } = catalogFormatter(locale);
  const name = product.name;
  const needsPrice = product.priceNeedsConfirmation === true;
  const hasRecordedPrice = needsPrice && product.sourcePrice !== undefined && Boolean(product.sourceCurrency);
  const category = cc.categories[product.category] ?? product.category;
  const costs = costsAt(item, speed, pricing);
  const priceRange=new Set(product.sourceVariants?.filter(v=>v.available&&v.availabilityKnown!==false&&v.quantity!==0).map(v=>v.price).filter(v=>v!==undefined)).size>1;
  const from=locale==='ru'?'от ':locale==='en'?'from ':'';
  const storePriceText = needsPrice ? (hasRecordedPrice ? fmt(product.sourcePrice!, product.sourceCurrency!) : cc.checkPrice) : (priceRange?from:'')+fmt(item.usd ?? product.usd, 'USD')+(priceRange&&locale!=='ru'&&locale!=='en'?' dan':'');
  const open = () => select(product);
  // "+" and "В корзину" open the product page (colour, size and the sum are chosen there, redesign stage 5): the sheet
  // over the catalog, or the page itself where the link is opened in a new tab or without scripts.
  const productHref = productPath(product.id);
  const openFromLink = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open();
  };
  // The brand's own eBay store reads as such, not as "eBay" (owner, 30 October 2026); the eBay mark stays beside it.
  const official = officialStoreBrand({ ...product, store: item.store });
  const officialText = official ? officialStoreText(official, locale) : undefined;
  // Short ("✓ adidas") so a long title is not squeezed; the full "official store on eBay" is the tooltip and the spoken text.
  const storeName = officialText
    ? <Tooltip><TooltipTrigger asChild><span className="find-official" tabIndex={0}><BadgeCheck size={14} aria-hidden="true" /><span aria-hidden="true">{official}</span><span className="sr-only">{officialText.full}</span></span></TooltipTrigger><TooltipContent>{officialText.full}</TooltipContent></Tooltip>
    : storeLabel(item.store, locale) || product.brand || category;
  const priceId = useId(), usdId = useId();
  // The store on the photo, one plate on every card; the verified mark only for the brand's own store (owner, 2 November 2026).
  const storeBrand = brandForHost(item.store);
  const officialMark = officialListing({ ...product, store: item.store }, storeBrand);
  const officialLabel = officialBadgeLabel(locale);
  const storeText = officialText?.full ?? storeLabel(item.store, locale);
  const storeBadge = storeBrand ? <span className="pcard-store" title={officialMark ? `${storeText} · ${officialLabel}` : storeText}><StoreBadge brand={storeBrand} size={30} official={Boolean(officialMark)} officialLabel={officialLabel} /><span className="sr-only">{cc.storeOf(storeText)}{officialMark ? `. ${officialLabel}` : ''}</span></span> : null;
  // The new card draws its own heart (pcard-save); the compact card keeps the older one.
  const saveClass = variant === 'compact' ? 'find-save' : 'pcard-save';
  const save = canSave ? <Tooltip><TooltipTrigger asChild><button type="button" disabled={saving} className={saveClass + ' ' + (saved ? 'saved' : '')} aria-pressed={saved} aria-label={(saved ? copy.remove : copy.save) + ': ' + name} onClick={onSave}><Heart size={20} /></button></TooltipTrigger><TooltipContent>{saving ? copy.savingState : saved ? copy.remove : copy.save}</TooltipContent></Tooltip>
    // The address is read on the tap, not while rendering (the card renders on the server too): back to these filters.
    : guestSave ? <Tooltip><TooltipTrigger asChild><a className={saveClass} href={loginPath('/catalog')} rel="nofollow" aria-label={copy.signinToSave + ': ' + name} onClick={(event) => { rememberPendingFavorite(browserStorage(), product.id, Date.now()); event.currentTarget.href = loginPath(window.location.pathname + window.location.search); }}><Heart size={20} aria-hidden="true" /></a></TooltipTrigger><TooltipContent>{copy.signinToSave}</TooltipContent></Tooltip>
    : null;
  // The store discount shows on a dated price too, when that price is the recorded USD one (owner, 12 October 2026).
  const showDiscount = discount > 0 && (!needsPrice || (hasRecordedPrice && product.sourceCurrency === 'USD'));

  if (variant === 'compact') {
    // The whole card is one button (phrasing content only, so spans), with the heart beside it, not inside.
    return <article className="find-card find-card-compact" data-saved={saved || undefined}>
      <button type="button" className="find-compact" onClick={open} aria-label={cc.open(name)} aria-describedby={costs ? priceId : undefined}>
        <span className="find-visual"><span className="find-photo"><ProductImage product={product} decorative locale={locale} /></span>{storeBadge}{(item.topDeal || showDiscount) && <span className="find-photo-badges">{item.topDeal && <span className="find-top-deal"><Flame size={14} />{copy.topDeal}</span>}{showDiscount && <em className="find-discount">−{discount}&#x202F;%</em>}</span>}</span>
        <span className="find-content">
          {/* Plain text here: a focusable tooltip trigger inside the card's button would be nested interactive content. */}
          <span className="find-meta"><span className="find-store">{officialText ? <span className="find-official"><BadgeCheck size={14} aria-hidden="true" />{official}</span> : storeName}</span></span>
          <b className="find-compact-title">{name}</b>
          <span className="find-compact-price" id={priceId}>{costs ? <><span className="find-compact-store">{storePriceText}</span><span className="find-compact-arrow" aria-hidden="true"> → </span>{needsPrice && <span className="find-compact-approx" aria-hidden="true">≈ </span>}<Money value={costs.total} locale={locale} /></> : <span className="find-compact-store">{storePriceText}</span>}</span>
        </span>
      </button>
      {save}
    </article>;
  }

  const confirmedAt = product.confirmedAt;
  // The price keeps its date when it is older than the card looks: a stale snapshot, or stock the operator
  // confirmed without the store re-reading the price.
  const priceDated = item.checkedAt > 0 && (needsPrice ? hasRecordedPrice : confirmedAt !== undefined && item.checkedAt < confirmedAt);
  // Direction A (1 November 2026): the brand on its own grey line, the title without it, one big sum in soum. No brand
  // reads as the category, and so does a marketplace recorded as the brand ("Amazon" over a Sony headset): the store is
  // the mark on the photo. A single-brand store keeps its name (nike.com: "Nike").
  const brandName = official ?? (displayBrand(product.brand, storeLabel(item.store, locale), storeBrand?.focus === 'marketplace' ? storeBrand.name : undefined) || category);
  const title = nameWithoutBrand(nameWithoutBrand(name, official ?? product.brand), brandName);
  // Only the shared-parcel note stays on the card (neutral): the allowance lives in the banner above the grid, the
  // size count on the colour line, an unconfirmed price in the "≈" and its date.
  const parcel = signals.find((signal) => signal.kind === 'parcel');
  return <article className="pcard" data-stale={needsPrice || undefined} data-saved={saved || undefined}>
    <div className="pcard-visual">
      <span className="pcard-photo"><ProductImage product={product} decorative locale={locale} dims priority={priority} sizes={cardSizes} /></span>
      {(showDiscount || item.topDeal) && <span className="pcard-badges">
        {showDiscount && <em className="pcard-off" title={copy.compareHint}>−{discount}&#x202F;%</em>}
        {item.topDeal && <span className="pcard-top"><Flame size={14} aria-hidden="true" />{copy.topDeal}</span>}
      </span>}
      {storeBadge}
      {save}
      {/* Phones: no button row; the round "+" does what "В корзину" does on a computer (the variant choice). */}
      {inCart
        ? <a className="pcard-plus" data-in-cart="" href="/cart" aria-label={cc.inCart + ': ' + name}><Check size={18} strokeWidth={2.5} aria-hidden="true" /></a>
        : <a className="pcard-plus" href={productHref} onClick={openFromLink} aria-label={cc.choose(name)}><Plus size={20} strokeWidth={2.5} aria-hidden="true" /></a>}
    </div>
    <div className="pcard-body">
      <p className="pcard-brand">{brandName}</p>
      {/* The title link covers the whole card (::after), so a tap anywhere opens the product; the heart, "+", the store
         mark and "В корзину" sit above it. A link to /catalog/p/<id> (owner, 2 November 2026: crawlers follow the name),
         opened as the sheet over the catalog like the other two. */}
      <h3 className="pcard-title"><a href={productHref} onClick={openFromLink} aria-label={cc.open(name)} aria-describedby={priceId + ' ' + usdId}>{title}</a></h3>
      {costs
        ? <p className="pcard-sum" id={priceId}><strong>{needsPrice && <><span aria-hidden="true">≈&#x202F;</span><span className="sr-only">{cc.about} </span></>}<Money value={costs.total} locale={locale} /></strong> <span>{cc.toTashkent}</span></p>
        : <p className="pcard-sum pcard-sum-pending" id={priceId}>{cc.afterCheck}</p>}
      <p className="pcard-usd" id={usdId}>
        {/* Spaces between the parts: the line is also the title's spoken description ("$8, base price $27, as of 13 Sep"). */}
        <span>{storePriceText}</span>
        {showDiscount && <>{' '}<del title={copy.referenceLabel}><span className="sr-only">{copy.referenceLabel}: </span>{fmt(referenceUsd!, 'USD')}</del></>}
        {priceDated && <>{' '}<small>{cc.priceOn(shortDate(item.checkedAt, locale))}</small></>}
      </p>
      <Variants item={item} locale={locale} />
      {parcel && <p className="pcard-note" title={parcel.hint}>{parcel.text}{parcel.hint && <span className="sr-only">. {parcel.hint}</span>}</p>}
      <div className="pcard-buy">
        {inCart
          ? <a className="btn secondary" href="/cart"><Check size={18} aria-hidden="true" />{cc.inCart}</a>
          : <a className="btn primary" href={productHref} onClick={openFromLink}><ShoppingBag size={18} aria-hidden="true" />{cc.addToCart}</a>}
      </div>
    </div>
  </article>;
}

/** The card photo's width in the grid (catalog-pages.css: 2 columns, 3 from 761 px, 4 from 1280 px, 5 from 1600 px). */
const cardSizes = '(min-width: 1600px) 20vw, (min-width: 1280px) 25vw, (min-width: 761px) 33vw, 50vw';

/** The item's costs at the quoted speed: the catalog prices at standard; an express cart re-prices the same lines. */
function costsAt(item: CatalogItem, speed: DeliverySpeed, pricing = tariff): Costs | null {
  if (!item.costs) return null;
  if (speed === catalogDeliverySpeed || item.usd === undefined) return item.costs;
  try { return price(item.usd, item.product.weight, 1, storeShippingUsd(item.product), pricing, speed); } catch { return item.costs; }
}

/** Up to five colour dots and the number of sizes the store lists, on one line: what the card offers without opening it. */
function Variants({ item, locale }: { item: CatalogItem; locale: Locale }) {
  const cc = catalogCopy[locale];
  const colors = item.attrs.color ?? [], sizes = item.sizes.length;
  if (!colors.length && !sizes) return null;
  return <p className="pcard-variants">
    {colors.length > 0 && <span className="pcard-swatches" role="img" aria-label={cc.colorsCount(colors.length)}>{colors.slice(0, 5).map((color) => <Swatch key={color} family={color} />)}{colors.length > 5 && <small aria-hidden="true">+{colors.length - 5}</small>}</span>}
    {sizes > 0 && <span>{cc.sizesCount(sizes)}</span>}
  </p>;
}

/** Placeholder cards in the shape of the new card while the catalog loads, so the grid keeps its place. */
export function CatalogSkeleton({ count = 8, label }: { count?: number; label: string }) {
  return <div className="finds-grid catalog-skeleton" role="status" aria-label={label}>
    {Array.from({ length: count }, (_, index) => <div className="pcard pcard-skeleton" key={index} aria-hidden="true"><div className="pcard-visual" /><div className="pcard-body"><span /><span /><span /><span /></div></div>)}
  </div>;
}


/** Small brand icon next to a store name (the store filter); nothing for stores outside the directory. */
export function StoreMark({ host }: { host: string }) {
  const brand = brandForHost(host);
  return brand ? <StoreLogo brand={brand} size={18} /> : null;
}
