import {z} from 'zod';
import {declarationFor, dedupeSafeImages, inferProductCategory, type Extracted, type ProductVariant} from './extract.ts';

/**
 * Bright Data Web Scraper API (datasets v3) for Walmart, whose pages answer servers with a bot wall (PerimeterX).
 * Bright Data collects the page on its side and returns structured JSON; Atlas never solves a challenge itself.
 * A collection takes 5–25 s, so a request that does not finish within `waitSeconds` becomes a pending job: the
 * client asks again and the same snapshot is polled — never triggered twice. One record = one credit; Bright Data bills successful records only.
 * Usage is kept in D1 (market_provider_jobs) and the paid part goes to the books (lib/market/provider-usage.ts).
 */
export type BrightDataStore = 'walmart';
export const brightDataStores: BrightDataStore[] = ['walmart'];
export const brightDataStoreNames: Record<BrightDataStore, string> = {walmart: 'Walmart'};
/** Ready-made Bright Data scrapers ("collect by URL"); one product URL = one record. */
export const brightDataDatasets: Record<BrightDataStore, string> = {walmart: 'gd_l95fol7l1ru6rlo116'};
export const brightDataApiOrigin = 'https://api.brightdata.com';
export const brightDataSettingsKey = 'importer.brightdata';

export const brightDataSettingsSchema = z.object({
  /** Master switch; without BRIGHTDATA_API_KEY on the server nothing runs anyway. */
  enabled: z.boolean().default(true),
  stores: z.object({walmart: z.boolean().default(true)}).default({walmart: true}),
  /** Catalog imports and the hourly catalog refresh also go through Bright Data (off: only customer links and the cart check). */
  catalog: z.boolean().default(false),
  /** Pay-as-you-go price, USD per 1000 records. */
  pricePer1kUsd: z.number().min(0).max(100).default(1.5),
  /** Free records each calendar month (Bright Data resets them on the 1st). */
  freeRecordsPerMonth: z.number().int().min(0).max(1_000_000).default(5000),
  /** Atlas stops starting new collections once this many records were used this month (0 = no new collections). */
  monthlyRecordLimit: z.number().int().min(0).max(1_000_000).default(10000),
  /** How long one import request waits for a collection before answering "still loading". */
  waitSeconds: z.number().int().min(3).max(20).default(12),
  /** A finished collection of the same product is reused for this long instead of paying again. */
  reuseMinutes: z.number().int().min(5).max(1440).default(60),
  /** Post the paid part of each finished day to the books as a "Сервисы и хостинг" expense. */
  ledger: z.boolean().default(true),
});
export type BrightDataSettings = z.infer<typeof brightDataSettingsSchema>;
export const defaultBrightDataSettings = (): BrightDataSettings => brightDataSettingsSchema.parse({});
export function parseBrightDataSettings(value: string | null | undefined): BrightDataSettings {
  try { return brightDataSettingsSchema.parse(value ? JSON.parse(value) : {}); } catch { return defaultBrightDataSettings(); }
}

export type BrightDataTarget = {store: BrightDataStore; key: string; url: string};
/** Only exact product pages: walmart.com/ip/…/<id>. */
export function brightDataTarget(value: URL | string): BrightDataTarget | undefined {
  let url: URL;
  try { url = new URL(String(value)); } catch { return; }
  if (url.protocol !== 'https:') return;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'walmart.com' || host === 'www.walmart.com') {
    const match = url.pathname.match(/^\/ip\/(?:([^/]{1,300})\/)?(\d{5,15})\/?$/i);
    if (!match) return;
    return {store: 'walmart', key: `walmart:${match[2]}`, url: `https://www.walmart.com/ip/${match[1] ? match[1] + '/' : ''}${match[2]}`};
  }
}

/** The collection is still running; the client should ask again after `retryAfterMs`. */
export class BrightDataPendingError extends Error {
  readonly store: BrightDataStore;
  readonly retryAfterMs: number;
  readonly startedAt: number;
  constructor(store: BrightDataStore, startedAt: number, retryAfterMs = 3000) {
    super(`${brightDataStoreNames[store]}: данные товара ещё собираются.`);
    this.name = 'BrightDataPendingError';
    this.store = store;
    this.startedAt = startedAt;
    this.retryAfterMs = retryAfterMs;
  }
}
/** Bright Data refused or failed; the importer falls back to its own path. `status` only, never the key or the URL. */
export class BrightDataApiError extends Error {
  readonly stage: 'trigger' | 'progress' | 'snapshot' | 'collection';
  readonly status?: number;
  constructor(stage: BrightDataApiError['stage'], status?: number, detail = '') {
    super(`Bright Data ${stage}${status ? ' HTTP ' + status : ''}${detail ? ': ' + detail : ''}`);
    this.name = 'BrightDataApiError';
    this.stage = stage;
    this.status = status;
  }
}

export type BrightDataJobStatus = 'running' | 'ready' | 'failed' | 'empty';
export type BrightDataJob = {snapshotId: string; store: BrightDataStore; key: string; status: BrightDataJobStatus; records: number; createdAt: number; finishedAt?: number};
/** Persistence for collections (D1 in the Worker, memory in tests). */
export type BrightDataJobs = {
  /** The newest job for this product started at or after `since`. */
  latest(key: string, since: number): Promise<BrightDataJob | undefined>;
  /** Records used in a Tashkent month ("YYYY-MM"): finished records plus one for each running job. */
  used(month: string): Promise<number>;
  start(job: {snapshotId: string; store: BrightDataStore; dataset: string; key: string; url: string; purpose: BrightDataPurpose; createdAt: number}): Promise<void>;
  /** Idempotent: only a running job changes. */
  finish(snapshotId: string, status: Exclude<BrightDataJobStatus, 'running'>, records: number, at: number, error?: string): Promise<void>;
};
export type BrightDataPurpose = 'customer' | 'catalog';
export type BrightDataRuntime = {
  apiKey: string;
  settings: BrightDataSettings;
  jobs: BrightDataJobs;
  purpose: BrightDataPurpose;
  api?: (input: string, init?: RequestInit) => Promise<Response>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export const tashkentMonth = (at: number) => new Date(at + 5 * 3600_000).toISOString().slice(0, 7);
/** A running collection older than this is treated as lost (Bright Data's own limit is far shorter for one URL). */
const staleRunningMs = 30 * 60_000;
/** After a failed collection the same product is not retried through Bright Data for this long. */
const failedCooldownMs = 10 * 60_000;

export function brightDataAllowed(target: BrightDataTarget, runtime: Pick<BrightDataRuntime, 'apiKey' | 'settings' | 'purpose'>) {
  const {settings} = runtime;
  return Boolean(runtime.apiKey.trim()) && settings.enabled && settings.stores[target.store] && (runtime.purpose === 'customer' || settings.catalog);
}

/**
 * Structured product data for a Walmart link through Bright Data, or undefined when Bright Data is off for it,
 * over the monthly limit, or recently failed (the importer then continues with its own path).
 * Throws BrightDataPendingError while the collection runs and BrightDataApiError when Bright Data refuses.
 */
export async function fetchBrightDataProduct(value: URL | string, runtime: BrightDataRuntime): Promise<Extracted | undefined> {
  const target = brightDataTarget(value);
  if (!target || !brightDataAllowed(target, runtime)) return;
  const api = runtime.api ?? ((input: string, init?: RequestInit) => fetch(input, init));
  const now = runtime.now ?? Date.now, sleep = runtime.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const {settings, jobs} = runtime, started = now();
  const headers = {Authorization: `Bearer ${runtime.apiKey.trim()}`};
  const call = (path: string, init?: RequestInit) => api(brightDataApiOrigin + path, {...init, headers: {...headers, ...init?.headers}, signal: AbortSignal.timeout(10_000)});

  const previous = await jobs.latest(target.key, started - Math.max(settings.reuseMinutes * 60_000, staleRunningMs));
  let job: {snapshotId: string; createdAt: number} | undefined;
  if (previous?.status === 'ready' && previous.createdAt >= started - settings.reuseMinutes * 60_000) {
    // Already paid for: download the same snapshot again (downloads are not billed).
    const reused = await downloadSnapshot(call, previous.snapshotId).catch(() => undefined);
    if (reused?.length) return mapBrightDataRecord(target, reused[0], String(value));
  } else if (previous?.status === 'running' && previous.createdAt >= started - staleRunningMs) {
    job = previous;
  } else if ((previous?.status === 'failed' || previous?.status === 'empty') && (previous.finishedAt ?? previous.createdAt) >= started - failedCooldownMs) {
    return;
  }

  if (!job) {
    const used = await jobs.used(tashkentMonth(started));
    if (used >= settings.monthlyRecordLimit) {
      console.warn('[brightdata] ' + JSON.stringify({store: target.store, stage: 'limit', used, limit: settings.monthlyRecordLimit}));
      return;
    }
    const response = await call(`/datasets/v3/trigger?dataset_id=${brightDataDatasets[target.store]}&format=json&include_errors=true`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify([{url: target.url}]),
    });
    const body = await response.json().catch(() => ({})) as {snapshot_id?: unknown};
    if (!response.ok || typeof body.snapshot_id !== 'string' || !/^[\w-]{4,80}$/.test(body.snapshot_id)) throw new BrightDataApiError('trigger', response.status);
    job = {snapshotId: body.snapshot_id, createdAt: started};
    await jobs.start({snapshotId: job.snapshotId, store: target.store, dataset: brightDataDatasets[target.store], key: target.key, url: target.url, purpose: runtime.purpose, createdAt: started});
  }

  const deadline = started + settings.waitSeconds * 1000;
  for (let poll = 0; ; poll++) {
    const response = await call(`/datasets/v3/progress/${job.snapshotId}`);
    const progress = await response.json().catch(() => ({})) as {status?: unknown; records?: unknown; errors?: unknown};
    if (!response.ok) throw new BrightDataApiError('progress', response.status);
    if (progress.status === 'failed') {
      await jobs.finish(job.snapshotId, 'failed', 0, now(), 'collection failed');
      throw new BrightDataApiError('collection', undefined, 'failed');
    }
    if (progress.status === 'ready') {
      const records = Math.max(0, Math.floor(Number(progress.records) || 0));
      const rows = await downloadSnapshot(call, job.snapshotId);
      if (!rows) throw new BrightDataPendingError(target.store, job.createdAt);
      const product = rows.find(row => !isErrorRecord(row));
      await jobs.finish(job.snapshotId, product ? 'ready' : 'empty', records, now(), product ? undefined : errorCode(rows[0]));
      if (!product) throw new BrightDataApiError('collection', undefined, errorCode(rows[0]) || 'empty');
      return mapBrightDataRecord(target, product, String(value));
    }
    // Walmart usually finishes in 5–25 s: poll often at first, then calmly.
    const wait = poll < 4 ? 1500 : 2500;
    if (now() + wait >= deadline) throw new BrightDataPendingError(target.store, job.createdAt, 3000);
    await sleep(wait);
  }
}

type Row = Record<string, unknown>;
async function downloadSnapshot(call: (path: string, init?: RequestInit) => Promise<Response>, snapshotId: string): Promise<Row[] | undefined> {
  const response = await call(`/datasets/v3/snapshot/${snapshotId}?format=json`);
  if (response.status === 202) return;
  if (!response.ok) throw new BrightDataApiError('snapshot', response.status);
  const text = await response.text();
  if (text.length > 4_000_000) throw new BrightDataApiError('snapshot', response.status, 'too large');
  const data = JSON.parse(text) as unknown;
  const rows = (Array.isArray(data) ? data : [data]).filter((row): row is Row => !!row && typeof row === 'object');
  return rows;
}
const isErrorRecord = (row: Row) => !row.product_name && !row.title && Boolean(row.error || row.error_code || row.warning);
const errorCode = (row: Row | undefined) => typeof row?.error_code === 'string' ? row.error_code.slice(0, 60) : typeof row?.error === 'string' ? row.error.slice(0, 60) : '';

export function mapBrightDataRecord(_target: Pick<BrightDataTarget, 'store'>, row: Row, sourceUrl: string): Extracted {
  return mapWalmartRecord(row, sourceUrl);
}

const text = (value: unknown, max = 300) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const amount = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : undefined;
  if (typeof value !== 'string') return;
  const cleaned = value.replace(/[^\d.,]/g, '').replace(/,(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const number = Number(cleaned);
  return cleaned && Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : undefined;
};
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const attributes = (value: unknown) => (Array.isArray(value) ? value : [])
  .map(item => item && typeof item === 'object' ? {name: text((item as Row).name, 100), value: text((item as Row).value, 140)} : undefined)
  .filter((item): item is {name: string; value: string} => !!item?.name && !!item.value);

/** Walmart: every colour and size is its own /ip/ page, and the scraper gives no colour × size matrix, so Atlas keeps
 * exactly the variant from the link (its own price and stock) and asks for another link for another option. */
export function mapWalmartRecord(row: Row, sourceUrl: string): Extracted {
  const title = text(row.product_name ?? row.title, 300);
  const brand = text(row.brand, 120) || 'Walmart';
  const price = amount(row.final_price) ?? amount(row.sale_price) ?? amount(row.initial_price) ?? amount(row.price);
  const regular = amount(row.initial_price) ?? amount(row.price);
  const currency = /^[A-Z]{3}$/.test(text(row.currency, 3)) ? text(row.currency, 3) : 'USD';
  const images = dedupeSafeImages([text(row.main_image, 2000), ...strings(row.image_urls)], sourceUrl, 12);
  const available = typeof row.is_available === 'boolean' ? row.is_available : row.availability === 'in_stock' ? true : row.availability === 'out_of_stock' ? false : undefined;
  const options = attributes(row.variant_attributes);
  const color = options.find(option => /colou?r/i.test(option.name))?.value;
  const size = options.find(option => /size/i.test(option.name))?.value;
  const itemId = text(row.product_id ?? row.sku, 20);
  const variant: ProductVariant = {
    id: text(row.variant_id, 40) || itemId || undefined,
    productId: itemId || undefined,
    sourceUrl,
    options,
    ...(color ? {color} : {}),
    ...(size ? {size} : {}),
    label: options.map(option => option.value).join(' · ') || 'Как в ссылке',
    available: available === true,
    availabilityKnown: available !== undefined,
    price,
    ...(price && regular && regular > price ? {compareAtPrice: regular} : {}),
    image: images[0],
  };
  const hasVariations = row.listing_has_variations === true;
  const seller = text(row.seller, 120);
  const warnings: string[] = [];
  if (hasVariations) warnings.push(`У Walmart у каждого цвета и размера своя ссылка. Загружен вариант из ссылки${variant.label !== 'Как в ссылке' ? ` (${variant.label})` : ''}; для другого варианта вставьте ссылку на него.`);
  if (available === false) warnings.push('Вариант из ссылки сейчас не в наличии на Walmart.');
  if (seller && !/^walmart(\.com)?$/i.test(seller)) warnings.push(`Продаёт сторонний продавец на Walmart (${seller}): сроки, доставка и возврат — по его правилам.`);
  const category = inferProductCategory(`${title} ${text(row.breadcrumb_text ?? row.category_name, 200)}`, brand);
  return {
    variantScope: 'item', variantsComplete: !hasVariations, ...(itemId ? {sku: itemId} : {}), ...(variant.id ? {selectedVariantId: variant.id} : {}),
    title: title || undefined, brand, category, declarationDescription: declarationFor(category, title, brand),
    image: images[0], images, ...(color ? {selectedVariantColor: color} : {}),
    price, ...(price && regular && regular > price ? {referencePrice: regular} : {}), currency,
    variants: [variant], country: 'США', warnings, sourceUrl, method: 'Bright Data · Walmart',
  };
}

/** Records that went over the free allowance, day by day: what the books post as an expense. */
export type ProviderDay = {day: string; records: number};
export type ProviderCharge = {day: string; records: number; paidRecords: number; usd: number};
export function paidRecordsByDay(days: ProviderDay[], freeRecordsPerMonth: number, pricePer1kUsd: number): ProviderCharge[] {
  const used = new Map<string, number>();
  return [...days].sort((a, b) => a.day.localeCompare(b.day)).map(({day, records}) => {
    const month = day.slice(0, 7), before = used.get(month) ?? 0, after = before + Math.max(0, records);
    used.set(month, after);
    const paidRecords = Math.max(0, after - freeRecordsPerMonth) - Math.max(0, before - freeRecordsPerMonth);
    return {day, records, paidRecords, usd: Math.round(paidRecords * pricePer1kUsd / 1000 * 10_000) / 10_000};
  });
}
