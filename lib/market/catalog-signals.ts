import { storeShippingHoldUsd, tariff, type Pricing } from './domain.ts';
import { formatSum, formatUsd, ruPlural } from './format.ts';
import { storeLabel, type CatalogItem } from './catalog-query.ts';
import type { Locale } from './i18n.ts';
import {withCyrillic} from './uz-cyrl.ts';

/**
 * The chips of a catalog card: at most two, at most one of them coloured (mint for a win, amber
 * for a warning), the other neutral. Amber displaces mint. Pure: the card only renders the result.
 */
export type Signal = {
  kind: 'parcel' | 'limit' | 'free-shipping' | 'stale' | 'cart' | 'sizes' | 'stock' | 'over-limit';
  tone: 'mint' | 'neutral' | 'amber';
  text: string;
  hint?: string;
};

export type SignalContext = {
  locale: Locale;
  pricing: Pricing;
  /** What the product adds to a parcel of its store already in the cart (`parcelExtra`), null without one. */
  parcel: { store: string; extra: number } | null;
  /** The product (same id and source URL) is already in the cart. */
  inCart: boolean;
  /** A signed-in customer whose allowance Atlas can count. */
  member: boolean;
  /** USD the member can still import duty-free this month after counted orders (and the cart, when the caller subtracts it); null for a guest. */
  remainingUsd: number | null;
  /** The full monthly duty-free allowance ($200): the guest limit and the figure in "within the $200 allowance". */
  dutyLimitUsd: number;
};

const copy = /*@__PURE__*/withCyrillic({
  ru: {
    parcel: (extra: string, store: string) => `+${extra} к посылке ${store}`,
    parcelHint: (alone: string) => `Посчитано, как в корзине: одна посылка на магазин, минимум 1 кг. Отдельной посылкой — ${alone}.`,
    limit: (limit: string) => `В лимите ${limit}`,
    limitHint: 'По вашим заказам в Atlas за этот месяц; оценка, пошлину считает таможня при ввозе.',
    freeShipping: 'Доставка магазина бесплатна',
    freeShippingHint: (freeFrom: string) => `Магазин не указал цену доставки до склада, но при заказе больше чем на ${freeFrom} из этого магазина она бесплатна. Если магазин всё же возьмёт плату — доплата только с вашего согласия.`,
    overLimit: (limit: string) => `Дороже лимита ${limit}`,
    overLimitBy: (excess: string) => `Дороже лимита на ${excess}`,
    overLimitHint: 'Цена товара выше беспошлинного лимита: с превышения при ввозе платится пошлина. Оценка; кто её оплатит — Atlas или вы, — выберете в корзине.',
    cart: 'Уже в корзине',
    stale: 'Сверим перед заказом',
    staleHint: 'Цена на дату снимка',
    stock: (count: number) => `Осталось ${count} шт. · eBay`,
    stockHint: 'Остаток по данным магазина на момент проверки.',
    sizes: (count: number) => `${count} ${ruPlural(count, ['размер', 'размера', 'размеров'])}`,
    sizesHint: 'По списку размеров магазина; выбранный размер Atlas сверит при добавлении в корзину.',
  },
  uz: {
    parcel: (extra: string, store: string) => `${store} posilkasiga +${extra}`,
    parcelHint: (alone: string) => `Savatdagidek hisoblangan: har bir do‘konga bitta posilka, kamida 1 kg. Alohida posilkada — ${alone}.`,
    limit: (limit: string) => `${limit} limit ichida`,
    limitHint: 'Shu oydagi Atlas buyurtmalaringiz bo‘yicha; taxminiy, bojni olib kirishda bojxona hisoblaydi.',
    freeShipping: 'Do‘kon yetkazishi bepul',
    freeShippingHint: (freeFrom: string) => `Do‘kon omborgacha yetkazish narxini ko‘rsatmagan, lekin shu do‘kondan ${freeFrom} dan ortiq buyurtmada u bepul. Do‘kon baribir haq olsa — qo‘shimcha to‘lov faqat roziligingiz bilan.`,
    overLimit: (limit: string) => `${limit} limitdan qimmat`,
    overLimitBy: (excess: string) => `Limitdan ${excess} ga qimmat`,
    overLimitHint: 'Tovar narxi bojsiz limitdan yuqori: olib kirishda ortiqcha qismga boj to‘lanadi. Taxminiy; uni Atlas yoki o‘zingiz to‘lashingizni savatda tanlaysiz.',
    cart: 'Savatda bor',
    stale: 'Buyurtmadan oldin tekshiramiz',
    staleHint: 'Narx snapshot sanasiga',
    stock: (count: number) => `${count} dona qoldi · eBay`,
    stockHint: 'Qoldiq — tekshiruv paytidagi do‘kon ma’lumoti.',
    sizes: (count: number) => `${count} ta o‘lcham`,
    sizesHint: 'Do‘kon o‘lchamlari ro‘yxati bo‘yicha; tanlangan o‘lchamni Atlas savatga qo‘shishda tekshiradi.',
  },
  en: {
    parcel: (extra: string, store: string) => `+${extra} to your ${store} parcel`,
    parcelHint: (alone: string) => `Priced like the cart: one parcel per store, at least 1 kg. As a separate parcel: ${alone}.`,
    limit: (limit: string) => `Within the ${limit} allowance`,
    limitHint: 'Based on your Atlas orders this month; an estimate, customs assesses duty on import.',
    freeShipping: 'Free store delivery',
    freeShippingHint: (freeFrom: string) => `The store did not state delivery to our warehouse, but orders over ${freeFrom} from this store ship free. If the store still charges, any extra payment needs your consent.`,
    overLimit: (limit: string) => `Above the ${limit} allowance`,
    overLimitBy: (excess: string) => `${excess} above your allowance`,
    overLimitHint: 'The product price is above the duty-free allowance: duty applies to the excess on import. An estimate; you choose in the cart whether Atlas pays it or you do.',
    cart: 'Already in your cart',
    stale: 'Checked before you order',
    staleHint: 'Price as of the snapshot date',
    stock: (count: number) => `${count} left · eBay`,
    stockHint: 'Stock as the store reported it at the last check.',
    sizes: (count: number) => `${count} sizes`,
    sizesHint: 'From the store’s size list; Atlas checks the chosen size when you add it to the cart.',
  },
}) satisfies Record<Locale, unknown>;

/** Whole dollars for a chip: $45,20 over the allowance reads as "$46". */
const wholeUsd = (amount: number, locale: Locale) => formatUsd(Math.ceil(amount - 1e-9), locale);

/**
 * One coloured chip at most (amber wins over mint), then one neutral chip; never more than two.
 * Mint priority: the shared parcel, the allowance, free store delivery. Neutral priority: in the
 * cart, an unconfirmed price, eBay stock, the number of sizes.
 */
export function signalsFor(item: CatalogItem, ctx: SignalContext): Signal[] {
  const c = copy[ctx.locale];
  const { product, usd } = item;
  const fmt = (sum: number) => formatSum(sum, ctx.locale);
  const member = ctx.member && ctx.remainingUsd !== null;
  let coloured: Signal | null = null;

  if (usd !== undefined) {
    if (member && usd > ctx.remainingUsd! + 1e-9) {
      coloured = { kind: 'over-limit', tone: 'amber', text: c.overLimitBy(wholeUsd(usd - ctx.remainingUsd!, ctx.locale)), hint: c.overLimitHint };
    } else if (!member && usd > ctx.dutyLimitUsd + 1e-9) {
      coloured = { kind: 'over-limit', tone: 'amber', text: c.overLimit(formatUsd(ctx.dutyLimitUsd, ctx.locale)), hint: c.overLimitHint };
    }
  }
  if (!coloured && ctx.parcel && item.costs && Number.isFinite(ctx.parcel.extra)) {
    coloured = { kind: 'parcel', tone: 'mint', text: c.parcel(fmt(Math.max(0, ctx.parcel.extra)), storeLabel(ctx.parcel.store, ctx.locale)), hint: c.parcelHint(fmt(item.costs.total)) };
  }
  if (!coloured && member && usd !== undefined && item.fresh && usd <= ctx.remainingUsd! + 1e-9) {
    coloured = { kind: 'limit', tone: 'mint', text: c.limit(formatUsd(ctx.dutyLimitUsd, ctx.locale)), hint: c.limitHint };
  }
  if (!coloured && usd !== undefined && product.sourceShippingEstimated && (product.sourceShippingUsd ?? 0) > 0 && storeShippingHoldUsd(product, usd, ctx.pricing) === 0) {
    const freeFrom = formatUsd(ctx.pricing.storeShippingFreeFromUsd ?? tariff.storeShippingFreeFromUsd, ctx.locale);
    coloured = { kind: 'free-shipping', tone: 'mint', text: c.freeShipping, hint: c.freeShippingHint(freeFrom) };
  }

  const neutral: Signal[] = [];
  if (ctx.inCart) neutral.push({ kind: 'cart', tone: 'neutral', text: c.cart });
  if (!item.fresh) neutral.push({ kind: 'stale', tone: 'neutral', text: c.stale, hint: c.staleHint });
  if (product.stockSource === 'ebay' && product.stockQuantity !== undefined && product.stockQuantity > 0 && product.stockQuantity <= 10) {
    neutral.push({ kind: 'stock', tone: 'neutral', text: c.stock(product.stockQuantity), hint: c.stockHint });
  }
  if (item.fresh && item.sizes.length >= 2) neutral.push({ kind: 'sizes', tone: 'neutral', text: c.sizes(item.sizes.length), hint: c.sizesHint });

  return coloured ? [coloured, ...neutral.slice(0, 1)] : neutral.slice(0, 2);
}
