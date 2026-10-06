import {z} from 'zod';
import {siteContent as defaultSiteContent, paymentLabels, type SiteContent, type PaymentMethod, type Review, type ParcelPhoto} from './site-content.ts';

// The editable business facts of the site (contacts, legal entity, payment methods, reviews, parcel photos…)
// stored in market_settings under key 'site-content' as one JSON document with a CAS revision.
// Everything is optional in the stored shape so that an empty or older document still parses; the
// merged result (`mergeSiteContent`) always has the full `SiteContent` shape with the code defaults.
// Delivery days are not part of the document: the tariff form (pricing.deliveryDays) already edits them.

export const siteContentTextMax = 500;
export const siteContentMaxReviews = 30;
export const siteContentMaxPhotos = 24;
export const siteContentStorageKey = 'site-content';

const localeKeys = ['ru','uz','en'] as const;
const text = z.string().trim().max(siteContentTextMax);
/** All three languages required once the block is filled; whitespace-only is treated as empty. */
const localizedText = z.object({ru:text, uz:text, en:text});
const localizedFilled = localizedText.refine(value => localeKeys.every(key => value[key].length > 0), {message: 'Заполните текст на трёх языках (ru, uz, en)'});
/** Empty everywhere → null; filled → all three languages required. */
const localizedOrNull = z.union([z.null(), localizedText]).transform((value, ctx) => {
  if (!value) return null;
  const filled = localeKeys.filter(key => value[key].length > 0);
  if (filled.length === 0) return null;
  if (filled.length < localeKeys.length) { ctx.addIssue({code: z.ZodIssueCode.custom, message: 'Заполните текст на трёх языках (ru, uz, en) или оставьте все поля пустыми'}); return z.NEVER; }
  return value;
});
/** A short optional string: '' and whitespace become null. */
const shortOrNull = (max: number, pattern?: RegExp, message?: string) => z.union([z.null(), z.string().trim().max(max)]).transform((value, ctx) => {
  if (!value) return null;
  if (pattern && !pattern.test(value)) { ctx.addIssue({code: z.ZodIssueCode.custom, message: message ?? 'Недопустимое значение'}); return z.NEVER; }
  return value;
});

export const phonePattern = /^\+998\d{9}$/;
/** Telegram and Instagram usernames: letters, digits, underscore (and dots for Instagram), without @. */
const usernamePattern = /^[A-Za-z0-9_]{3,32}$/;
const instagramPattern = /^[A-Za-z0-9_.]{1,30}$/;
const innPattern = /^\d{9}$/;

export function normalizePhone(value: string): string { return value.replace(/[\s\-()]/g, ''); }
export function isHttpsUrl(value: string): boolean { try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname; } catch { return false; } }
/** Parcel photo paths: a file under public/, e.g. /parcels/2026-10-01.jpg; no scheme, no `..`, no query. */
export function isPublicImagePath(value: string): boolean {
  return /^\/(?!\/)[A-Za-z0-9_\-./]{1,300}$/.test(value) && !value.includes('..') && /\.(jpe?g|png|webp|avif|gif)$/i.test(value);
}

const paymentMethodSchema = z.custom<PaymentMethod>(value => typeof value === 'string' && value in paymentLabels, {message: 'Неизвестный способ оплаты'});

export const reviewSchema = z.object({
  name: z.string().trim().min(1, 'Укажите имя клиента').max(80),
  city: shortOrNull(80).optional(),
  text: localizedFilled,
  /** The customer agreed to publication; a review without consent is refused, never silently hidden. */
  consent: z.literal(true, {errorMap: () => ({message: 'Отзыв публикуется только с согласия клиента'})}),
});
export const parcelPhotoSchema = z.object({
  src: z.string().trim().refine(isPublicImagePath, 'Путь к фото: файл из public/, например /parcels/2026-10.jpg'),
  alt: localizedFilled,
});

export const siteContentDocumentSchema = z.object({
  revision: z.number().int().nonnegative().default(0),
  updatedAt: z.number().int().nonnegative().optional(),
  contacts: z.object({
    telegramSupport: shortOrNull(32, usernamePattern, 'Имя бота поддержки: 3–32 латинских символа без @'),
    telegramChannel: shortOrNull(32, usernamePattern, 'Имя канала: 3–32 латинских символа без @'),
    phone: z.union([z.null(), z.string().trim().max(32)]).transform((value, ctx) => {
      if (!value) return null;
      const normalized = normalizePhone(value);
      if (!phonePattern.test(normalized)) { ctx.addIssue({code: z.ZodIssueCode.custom, message: 'Телефон: +998 и 9 цифр, например +998901234567'}); return z.NEVER; }
      return normalized;
    }),
    instagram: shortOrNull(30, instagramPattern, 'Instagram: до 30 латинских символов без @'),
    supportEmail: shortOrNull(254, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Почта поддержки: адрес вида support@atlasmarket.uz'),
    pickupAddress: localizedOrNull,
  }).partial().default({}),
  legal: z.object({
    entityName: shortOrNull(200),
    inn: shortOrNull(9, innPattern, 'ИНН: 9 цифр'),
    address: localizedOrNull,
  }).partial().default({}),
  paymentMethods: z.array(paymentMethodSchema).max(Object.keys(paymentLabels).length).default([]).transform(list => [...new Set(list)]),
  reviews: z.array(reviewSchema).max(siteContentMaxReviews, `Не больше ${siteContentMaxReviews} отзывов`).default([]),
  parcelPhotos: z.array(parcelPhotoSchema).max(siteContentMaxPhotos, `Не больше ${siteContentMaxPhotos} фото`).default([]),
  completedOrders: z.union([z.null(), z.number().int().nonnegative().max(10_000_000)]).default(null),
  prohibitedListUrl: z.union([z.null(), z.string().trim().max(500)]).transform((value, ctx) => {
    if (!value) return null;
    if (!isHttpsUrl(value)) { ctx.addIssue({code: z.ZodIssueCode.custom, message: 'Ссылка на перечень: только https://'}); return z.NEVER; }
    return value;
  }).default(null),
});
export type SiteContentDocumentInput = z.input<typeof siteContentDocumentSchema>;
export type SiteContentDocument = z.output<typeof siteContentDocumentSchema>;
/** What the site renders: the stored document merged with the code defaults plus its revision. */
export type SiteContentView = SiteContent & {revision: number; updatedAt?: number};

/** The stored document → the full shape the pages render; missing blocks keep the code defaults. */
export function mergeSiteContent(document: Partial<SiteContentDocument> | null | undefined): SiteContentView {
  const base = defaultSiteContent;
  const contacts = document?.contacts ?? {};
  const legal = document?.legal ?? {};
  return {
    contacts: {
      telegramSupport: contacts.telegramSupport ?? base.contacts.telegramSupport,
      telegramChannel: contacts.telegramChannel ?? base.contacts.telegramChannel,
      phone: contacts.phone ?? base.contacts.phone,
      instagram: contacts.instagram ?? base.contacts.instagram,
      supportEmail: contacts.supportEmail ?? base.contacts.supportEmail,
      pickupAddress: contacts.pickupAddress ?? base.contacts.pickupAddress,
    },
    legal: {entityName: legal.entityName ?? base.legal.entityName, inn: legal.inn ?? base.legal.inn, address: legal.address ?? base.legal.address},
    // Store links of the apps are code data (MOBILE.md), not part of the editable document.
    apps: base.apps,
    deliveryDays: base.deliveryDays,
    standardDeliveryDays: base.standardDeliveryDays,
    paymentMethods: document?.paymentMethods ?? base.paymentMethods,
    reviews: (document?.reviews ?? base.reviews).map(review => ({name: review.name, ...(review.city ? {city: review.city} : {}), text: review.text, consent: true}) as Review & {consent: true}),
    parcelPhotos: (document?.parcelPhotos ?? base.parcelPhotos) as ParcelPhoto[],
    completedOrders: document?.completedOrders ?? base.completedOrders,
    prohibitedListUrl: document?.prohibitedListUrl ?? base.prohibitedListUrl,
    revision: document?.revision ?? 0,
    ...(document?.updatedAt ? {updatedAt: document.updatedAt} : {}),
  };
}

/** The empty document (revision 0): what the site shows before the owner fills anything. */
export function emptySiteContentDocument(): SiteContentDocument { return siteContentDocumentSchema.parse({}); }

/** A stored JSON value → document; invalid or missing storage falls back to the empty document (never throws). */
export function parseStoredSiteContent(value: string | null | undefined): SiteContentDocument {
  if (!value) return emptySiteContentDocument();
  try { const parsed = siteContentDocumentSchema.safeParse(JSON.parse(value)); return parsed.success ? parsed.data : emptySiteContentDocument(); } catch { return emptySiteContentDocument(); }
}

/** Validation issues as short Russian lines for the admin form: "contacts.phone: …". */
export function siteContentIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 20).map(issue => (issue.path.length ? issue.path.join('.') + ': ' : '') + issue.message);
}

/** The view → the editable document (what the admin form submits); strips the delivery tables and consent flags stay. */
export function siteContentToDocument(view: SiteContentView): SiteContentDocument {
  return siteContentDocumentSchema.parse({
    revision: view.revision, updatedAt: view.updatedAt,
    contacts: view.contacts, legal: view.legal, paymentMethods: view.paymentMethods,
    reviews: view.reviews.map(review => ({...review, consent: true})),
    parcelPhotos: view.parcelPhotos, completedOrders: view.completedOrders, prohibitedListUrl: view.prohibitedListUrl,
  });
}
