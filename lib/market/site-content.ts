import type { TextLocale } from './i18n.ts';

// Business facts for the home page and footer. The owner fills them in the admin panel
// (app/site-content-admin.tsx → POST /api/site-content → market_settings 'site-content'); the
// constant below is the code default merged under the stored document (lib/market/site-content-schema.ts).
// An empty value hides its block in production builds (dev builds show a placeholder),
// so the site never shows invented contacts, reviews, delivery times or payment methods.
export type DeliveryRegion = 'us' | 'uk' | 'cn' | 'de' | 'it' | 'es';
export type PaymentMethod = 'click' | 'payme' | 'uzcard' | 'humo' | 'visa' | 'mastercard' | 'crypto';
export type Review = { name: string; city?: string; text: Record<TextLocale, string>; /** The customer agreed to publication (required by the admin form). */ consent?: true };
export type ParcelPhoto = { src: string; alt: Record<TextLocale, string> };

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
    /** Support mailbox shown on /support; null until the owner has one. */
    supportEmail: string | null;
    pickupAddress: Record<TextLocale, string> | null;
  };
  legal: { entityName: string | null; inn: string | null; address: Record<TextLocale, string> | null };
  /** Store listings of the Atlas apps; null until published, so /app never shows a dead store button. */
  apps: { appStoreUrl: string | null; playStoreUrl: string | null };
  /** Approximate express delivery in business days per dispatch region; null until confirmed with the carrier. */
  deliveryDays: Record<DeliveryRegion, readonly [number, number] | null>;
  /** Approximate standard (slower, cheaper) delivery in business days per dispatch region. */
  standardDeliveryDays: Record<DeliveryRegion, readonly [number, number] | null>;
  /** Only methods that are actually connected. Payments are simulated until a provider is live. */
  paymentMethods: PaymentMethod[];
  /** Real customer reviews only, with the customer's consent (`consent: true` is enforced on save). */
  reviews: Review[];
  /** Photos of real parcels; files go to public/. */
  parcelPhotos: ParcelPhoto[];
  /** Real count of delivered orders; simulated orders must not be counted. */
  completedOrders: number | null;
  /** Official list of goods prohibited for import, if one is published. */
  prohibitedListUrl: string | null;
};

/** Delivery days for a region and speed: the admin's setting (pricing.deliveryDays / standardDeliveryDays), else the value below. */
export function deliveryDaysFor(
  pricing: { deliveryDays?: Partial<Record<DeliveryRegion, readonly [number, number]>>; standardDeliveryDays?: Partial<Record<DeliveryRegion, readonly [number, number]>> },
  region: DeliveryRegion,
  speed: 'express' | 'standard' = 'express',
): readonly [number, number] | null {
  if (speed === 'standard') return pricing.standardDeliveryDays?.[region] ?? siteContent.standardDeliveryDays[region];
  return pricing.deliveryDays?.[region] ?? siteContent.deliveryDays[region];
}

/** Code defaults: nothing is filled here. Pages read the stored document through `useMarket().siteContent`. */
export const siteContent: SiteContent = {
  contacts: { telegramSupport: null, telegramChannel: null, phone: null, instagram: null, supportEmail: null, pickupAddress: null },
  legal: { entityName: null, inn: null, address: null },
  apps: { appStoreUrl: null, playStoreUrl: null },
  // Express routes and approximate times from the owner (6 October 2026): 5–9 business days from the US, 7–9 elsewhere,
  // $15.98 per kg; standard delivery is 9–14 business days at $13.98 per kg (lib/market/domain.ts).
  deliveryDays: { us: [5, 9], uk: [7, 9], cn: [7, 9], de: [7, 9], it: [7, 9], es: [7, 9] },
  standardDeliveryDays: { us: [9, 14], uk: [9, 14], cn: [9, 14], de: [9, 14], it: [9, 14], es: [9, 14] },
  paymentMethods: [],
  reviews: [],
  parcelPhotos: [],
  completedOrders: null,
  prohibitedListUrl: null,
};
export const defaultSiteContent = siteContent;

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
