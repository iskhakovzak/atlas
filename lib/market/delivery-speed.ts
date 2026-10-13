import type { Locale } from './i18n.ts';
import { formatSum, formatUsd } from './format.ts';
import { deliveryRegions, deliveryDaysFor, type DeliveryRegion } from './site-content.ts';
import { cartDeliverySpeed, deliveryPerKgUsdFor, deliverySpeeds, repriceCart, totalOf, type CartItem, type DeliverySpeed, type Pricing } from './domain.ts';
import {withCyrillic} from './uz-cyrl.ts';

/** Customer wording for the express / standard delivery choice (the cart switch and the link-order preview). */
export type DeliverySpeedCopy = {
  title: string;
  names: Record<DeliverySpeed, string>;
  short: Record<DeliverySpeed, string>;
  days: (from: number, to: number) => string;
  daysUnknown: string;
  perKg: (rate: string) => string;
  cheaperBy: (sum: string) => string;
  samePrice: string;
  /** On the card of the speed not chosen: what choosing it changes in the total. */
  deltaLess: (sum: string) => string;
  deltaMore: (sum: string) => string;
  deltaSame: string;
  appliesToCart: string;
  saving: string;
};

export const deliverySpeedCopy: Record<Locale, DeliverySpeedCopy> = /*@__PURE__*/withCyrillic({
  ru: {
    title: 'Скорость доставки в Ташкент',
    names: { express: 'Экспресс', standard: 'Обычная' },
    short: { express: 'экспресс', standard: 'обычная' },
    days: (from, to) => `${from}–${to} раб. дней`,
    daysUnknown: 'сроки уточняются',
    perKg: rate => `${rate}/кг`,
    cheaperBy: sum => `Обычная дешевле на ${sum}`,
    samePrice: 'Для этой посылки цена одинаковая',
    deltaLess: sum => `дешевле на ${sum}`,
    deltaMore: sum => `дороже на ${sum}`,
    deltaSame: 'та же цена',
    appliesToCart: 'Скорость одна на всю корзину: она применится ко всем посылкам.',
    saving: 'Сохраняем…',
  },
  uz: {
    title: 'Toshkentga yetkazish tezligi',
    names: { express: 'Ekspress', standard: 'Oddiy' },
    short: { express: 'ekspress', standard: 'oddiy' },
    days: (from, to) => `${from}–${to} ish kuni`,
    daysUnknown: 'muddat aniqlanmoqda',
    perKg: rate => `${rate}/kg`,
    cheaperBy: sum => `Oddiy yetkazish ${sum} ga arzon`,
    samePrice: 'Bu jo‘natma uchun narx bir xil',
    deltaLess: sum => `${sum}ga arzon`,
    deltaMore: sum => `${sum}ga qimmat`,
    deltaSame: 'narx bir xil',
    appliesToCart: 'Tezlik butun savat uchun bitta: u barcha jo‘natmalarga qo‘llanadi.',
    saving: 'Saqlanmoqda…',
  },
  en: {
    title: 'Delivery speed to Tashkent',
    names: { express: 'Express', standard: 'Standard' },
    short: { express: 'express', standard: 'standard' },
    days: (from, to) => `${from}–${to} business days`,
    daysUnknown: 'times to be confirmed',
    perKg: rate => `${rate}/kg`,
    cheaperBy: sum => `Standard is ${sum} cheaper`,
    samePrice: 'Same price for this parcel',
    deltaLess: sum => `${sum} less`,
    deltaMore: sum => `${sum} more`,
    deltaSame: 'same price',
    appliesToCart: 'One speed for the whole cart: it applies to every parcel.',
    saving: 'Saving…',
  },
});

/** The dispatch region of a Product.country label; unknown countries are priced like the US. */
export function regionForCountry(country?: string): DeliveryRegion {
  return deliveryRegions.find(region => region.countries.includes(country ?? 'США'))?.id ?? 'us';
}

/** Combined delivery window for several dispatch countries: the earliest "from" and the latest "to". */
export function daysRangeFor(pricing: Pricing, countries: readonly (string | undefined)[], speed: DeliverySpeed): readonly [number, number] | null {
  const regions = [...new Set((countries.length ? countries : [undefined]).map(regionForCountry))];
  const ranges = regions.map(region => deliveryDaysFor(pricing, region, speed)).filter((range): range is readonly [number, number] => Boolean(range));
  if (!ranges.length) return null;
  return [Math.min(...ranges.map(([from]) => from)), Math.max(...ranges.map(([, to]) => to))];
}

/** "$15.98/kg" or "$13.98–$17.50/kg" when the countries in the cart have different rates. */
export function rateTextFor(pricing: Pricing, countries: readonly (string | undefined)[], speed: DeliverySpeed, locale: Locale): string {
  const rates = [...new Set((countries.length ? countries : [undefined]).map(country => deliveryPerKgUsdFor(pricing, country, speed)))].sort((a, b) => a - b);
  const text = rates.length > 1 ? `${formatUsd(rates[0], locale)}–${formatUsd(rates[rates.length - 1], locale)}` : formatUsd(rates[0], locale);
  return deliverySpeedCopy[locale].perKg(text);
}

export type DeliverySpeedOption = { speed: DeliverySpeed; name: string; days: string; rate: string; label: string };

/** The two choices as shown: name, delivery window across the given countries and the per-kg rate. */
export function deliverySpeedOptions(pricing: Pricing, countries: readonly (string | undefined)[], locale: Locale): DeliverySpeedOption[] {
  const c = deliverySpeedCopy[locale];
  return deliverySpeeds.map(speed => {
    const range = daysRangeFor(pricing, countries, speed);
    const days = range ? c.days(range[0], range[1]) : c.daysUnknown;
    const rate = rateTextFor(pricing, countries, speed, locale);
    return { speed, name: c.names[speed], days, rate, label: `${c.names[speed]} · ${days} · ${rate}` };
  });
}

/** Cart totals at each speed, priced the way the server would (same parcels, same tariff). */
export function totalsBySpeed(items: CartItem[], pricing: Pricing, now = Date.now()): Record<DeliverySpeed, number> {
  const at = (speed: DeliverySpeed) => {
    try { return totalOf(repriceCart(items.map(item => ({ ...item, deliverySpeed: speed })), now, pricing)); }
    catch { return NaN; }
  };
  return { express: at('express'), standard: at('standard') };
}

/**
 * What each speed changes in the cart total against the chosen one (owner, 14.10.2026: the saving reads on the card
 * itself, not in a line under the switch): negative = cheaper. Null when the cart is empty or cannot be priced.
 */
export function speedDeltas(items: CartItem[], pricing: Pricing, chosen: DeliverySpeed, now = Date.now()): Record<DeliverySpeed, number> | null {
  if (!items.length) return null;
  const totals = totalsBySpeed(items, pricing, now);
  if (!Number.isFinite(totals.express) || !Number.isFinite(totals.standard)) return null;
  return { express: totals.express - totals[chosen], standard: totals.standard - totals[chosen] };
}

/** The card's line for a delta from speedDeltas: "cheaper by N", "N more" or "same price". */
export function speedDeltaText(delta: number, locale: Locale): string {
  const c = deliverySpeedCopy[locale];
  // The amount never breaks inside ("46 572 / сум" on two lines in the narrow card).
  const sum = (value: number) => formatSum(value, locale).replace(/\s/g, '\u00a0');
  return delta < 0 ? c.deltaLess(sum(-delta)) : delta > 0 ? c.deltaMore(sum(delta)) : c.deltaSame;
}

/** "Standard is N soum cheaper" for the cart, or the same-price note; empty when nothing can be priced. */
export function savingText(items: CartItem[], pricing: Pricing, locale: Locale, now = Date.now()): string {
  if (!items.length) return '';
  const totals = totalsBySpeed(items, pricing, now);
  if (!Number.isFinite(totals.express) || !Number.isFinite(totals.standard)) return '';
  const diff = totals.express - totals.standard;
  return diff > 0 ? deliverySpeedCopy[locale].cheaperBy(formatSum(diff, locale)) : deliverySpeedCopy[locale].samePrice;
}

export { cartDeliverySpeed };
