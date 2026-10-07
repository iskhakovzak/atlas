import type { Locale } from './i18n.ts';
import type { StoreCountry } from './store-brands.ts';
import { deliveryRegions, deliveryDaysFor, type DeliveryRegion } from './site-content.ts';
import { deliveryPerKgUsdFor, type Pricing } from './domain.ts';
import { deliverySpeedCopy } from './delivery-speed.ts';
import { formatUsd } from './format.ts';

/**
 * Geography of a store country for the showcase: which Atlas dispatch region prices it (null when Atlas has no
 * route from there yet — the storefront never pretends to ship like the US) and the storefront's currency.
 */
export type StoreGeo = { region: DeliveryRegion | null; currency: string | null };

export const storeGeo: Record<StoreCountry, StoreGeo> = {
  us: { region: 'us', currency: 'USD' },
  uk: { region: 'uk', currency: 'GBP' },
  cn: { region: 'cn', currency: 'CNY' },
  de: { region: 'de', currency: 'EUR' },
  it: { region: 'it', currency: 'EUR' },
  es: { region: 'es', currency: 'EUR' },
  fr: { region: null, currency: 'EUR' },
  nl: { region: null, currency: 'EUR' },
  at: { region: null, currency: 'EUR' },
  be: { region: null, currency: 'EUR' },
  ie: { region: null, currency: 'EUR' },
  se: { region: null, currency: 'SEK' },
  dk: { region: null, currency: 'DKK' },
  pl: { region: null, currency: 'PLN' },
  ch: { region: null, currency: 'CHF' },
  cz: { region: null, currency: 'CZK' },
  ca: { region: null, currency: 'CAD' },
  au: { region: null, currency: 'AUD' },
  jp: { region: null, currency: 'JPY' },
  kr: { region: null, currency: 'KRW' },
  tr: { region: null, currency: 'TRY' },
  ae: { region: null, currency: 'AED' },
  ph: { region: null, currency: 'PHP' },
  hk: { region: null, currency: 'HKD' },
  my: { region: null, currency: 'MYR' },
  sg: { region: null, currency: 'SGD' },
  nz: { region: null, currency: 'NZD' },
  in: { region: null, currency: 'INR' },
  mx: { region: null, currency: 'MXN' },
  br: { region: null, currency: 'BRL' },
  ar: { region: null, currency: 'ARS' },
  tw: { region: null, currency: 'TWD' },
};

const regionCountries: Record<DeliveryRegion, StoreCountry> = { us: 'us', uk: 'uk', cn: 'cn', de: 'de', it: 'it', es: 'es' };

/** The store country behind a dispatch region: us → 'us', uk → 'uk', cn → 'cn', de → 'de', it → 'it', es → 'es'. */
export function regionCountryCode(region: DeliveryRegion): StoreCountry {
  return regionCountries[region];
}

/**
 * The dispatch region of a Product.country label ("США" → 'us'), or null for a label Atlas has no route for.
 * Unlike delivery-speed's regionForCountry it never falls back to the US: the catalog card shows no days then.
 */
export function regionForCountryLabel(label: string | undefined): DeliveryRegion | null {
  if (!label) return null;
  return deliveryRegions.find((region) => region.countries.includes(label))?.id ?? null;
}

/** The Product.country label the tariff keys its per-country overrides by. */
function regionLabel(region: DeliveryRegion): string | undefined {
  return deliveryRegions.find((entry) => entry.id === region)?.countries[0];
}

export type StoreCountryTerms = {
  region: DeliveryRegion | null;
  /** "5–9 раб. дней", or null without a region. */
  expressDays: string | null;
  /** "$15,98/кг", or null without a region. */
  expressPerKg: string | null;
  standardDays: string | null;
  standardPerKg: string | null;
  currency: string | null;
  /** Atlas has an FX rate for the storefront currency, so a price from it can be quoted. */
  currencySupported: boolean;
};

/** Delivery terms for a store country as the showcase prints them; every string is null when Atlas has no route from it. */
export function storeCountryTerms(pricing: Pricing, code: StoreCountry, locale: Locale): StoreCountryTerms {
  const { region, currency } = storeGeo[code];
  const copy = deliverySpeedCopy[locale];
  const currencySupported = Boolean(currency && pricing.rates[currency]);
  if (!region) return { region: null, expressDays: null, expressPerKg: null, standardDays: null, standardPerKg: null, currency, currencySupported };
  const label = regionLabel(region);
  const days = (speed: 'express' | 'standard') => {
    const range = deliveryDaysFor(pricing, region, speed);
    return range ? copy.days(range[0], range[1]) : null;
  };
  const perKg = (speed: 'express' | 'standard') => copy.perKg(formatUsd(deliveryPerKgUsdFor(pricing, label, speed), locale));
  return {
    region,
    expressDays: days('express'),
    expressPerKg: perKg('express'),
    standardDays: days('standard'),
    standardPerKg: perKg('standard'),
    currency,
    currencySupported,
  };
}
