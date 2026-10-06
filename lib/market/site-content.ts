import type { Locale } from './i18n.ts';

// Business facts for the home page and footer. Fill these only with verified data:
// an empty value hides its block in production builds (dev builds show a placeholder),
// so the site never shows invented contacts, reviews, delivery times or payment methods.
export type DeliveryRegion = 'us' | 'uk' | 'cn' | 'de' | 'it' | 'es';
export type PaymentMethod = 'click' | 'payme' | 'uzcard' | 'humo' | 'visa' | 'mastercard' | 'crypto';
export type Review = { name: string; city?: string; text: Record<Locale, string> };
export type ParcelPhoto = { src: string; alt: Record<Locale, string> };

export type SiteContent = {
  contacts: {
    /** Support bot username without @ (not the login bot). */
    telegramSupport: string | null;
    /** Channel username without @. */
    telegramChannel: string | null;
    /** Phone in international format, e.g. +998901234567. */
    phone: string | null;
    /** Instagram username without @. */
    instagram: string | null;
    pickupAddress: Record<Locale, string> | null;
  };
  legal: { entityName: string | null; inn: string | null; address: Record<Locale, string> | null };
  /** Approximate express delivery in business days per dispatch region; null until confirmed with the carrier. */
  deliveryDays: Record<DeliveryRegion, readonly [number, number] | null>;
  /** Only methods that are actually connected. Payments are simulated until a provider is live. */
  paymentMethods: PaymentMethod[];
  /** Real customer reviews only, with the customer's consent. */
  reviews: Review[];
  /** Photos of real parcels; files go to public/. */
  parcelPhotos: ParcelPhoto[];
  /** Real count of delivered orders; simulated orders must not be counted. */
  completedOrders: number | null;
  /** Official list of goods prohibited for import, if one is published. */
  prohibitedListUrl: string | null;
};

/** Delivery days for a region: the admin's setting (pricing.deliveryDays), else the value below. */
export function deliveryDaysFor(pricing: { deliveryDays?: Partial<Record<DeliveryRegion, readonly [number, number]>> }, region: DeliveryRegion): readonly [number, number] | null {
  return pricing.deliveryDays?.[region] ?? siteContent.deliveryDays[region];
}

export const siteContent: SiteContent = {
  contacts: { telegramSupport: null, telegramChannel: null, phone: null, instagram: null, pickupAddress: null },
  legal: { entityName: null, inn: null, address: null },
  // Express routes and approximate times from the owner (4 October 2026); the price is the tariff's $14.98 per kg.
  deliveryDays: { us: [5, 10], uk: [7, 10], cn: [7, 12], de: [7, 9], it: [7, 9], es: [7, 9] },
  paymentMethods: [],
  reviews: [],
  parcelPhotos: [],
  completedOrders: null,
  prohibitedListUrl: null,
};

export const paymentLabels: Record<PaymentMethod, string> = {
  click: 'Click', payme: 'Payme', uzcard: 'Uzcard', humo: 'Humo', visa: 'Visa', mastercard: 'Mastercard', crypto: 'Crypto',
};

/** Dispatch regions in table order, with the Product.country labels used by pricing overrides. */
export const deliveryRegions: { id: DeliveryRegion; countries: string[] }[] = [
  { id: 'us', countries: ['США'] },
  { id: 'uk', countries: ['Великобритания'] },
  { id: 'cn', countries: ['Китай'] },
  { id: 'de', countries: ['Германия'] },
  { id: 'it', countries: ['Италия'] },
  { id: 'es', countries: ['Испания'] },
];
