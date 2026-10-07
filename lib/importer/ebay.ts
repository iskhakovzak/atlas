import {
  dedupeSafeImages,
  inferProductCategory,
  safeImage,
  type Extracted,
  type ProductVariant,
} from './extract.ts';

export type EbayBrowseConfig = {
  clientId?: string;
  clientSecret?: string;
  environment?: 'production' | 'sandbox';
  /** Where the seller must ship: the Atlas forwarding warehouse. eBay prices `shippingOptions` for this address (X-EBAY-C-ENDUSERCTX). */
  shipToCountry?: string;
  shipToPostalCode?: string;
};

export type EbayFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

type Marketplace = {id: string};
type EbayItem = Record<string, unknown>;
export type EbayImportStage = 'configuration' | 'oauth' | 'browse_item' | 'browse_variants' | 'item_data' | 'variation_group' | 'variant_data';

const MARKETPLACES: Record<string, Marketplace> = {
  'ebay.com': {id: 'EBAY_US'},
  'ebay.us': {id: 'EBAY_US'},
  'ebay.ca': {id: 'EBAY_CA'},
  'ebay.co.uk': {id: 'EBAY_GB'},
  'ebay.com.au': {id: 'EBAY_AU'},
  'ebay.de': {id: 'EBAY_DE'},
  'ebay.es': {id: 'EBAY_ES'},
  'ebay.fr': {id: 'EBAY_FR'},
  'ebay.it': {id: 'EBAY_IT'},
  'ebay.at': {id: 'EBAY_AT'},
  'ebay.be': {id: 'EBAY_BE'},
  'ebay.ch': {id: 'EBAY_CH'},
  'ebay.ie': {id: 'EBAY_IE'},
  'ebay.nl': {id: 'EBAY_NL'},
  'ebay.pl': {id: 'EBAY_PL'},
  'ebay.com.hk': {id: 'EBAY_HK'},
  'ebay.com.sg': {id: 'EBAY_SG'},
};

const API_SCOPE = 'https://api.ebay.com/oauth/api_scope';
const MAX_JSON_BYTES = 1_000_000;
const MAX_VARIANTS = 250;
const MAX_IMAGES = 12;

let tokenCache: {key: string; token: string; expiresAt: number} | undefined;

/**
 * What eBay's error ids mean for this integration (Browse API error reference and the common
 * OAuth/ACCESS codes from "Handling error messages"). Shown to the operator next to eBay's text.
 */
const EBAY_ERROR_HINTS: Record<number, string> = {
  1001: 'токен приложения отклонён: проверьте EBAY_CLIENT_ID, EBAY_CLIENT_SECRET и что EBAY_ENV совпадает со средой keyset',
  1002: 'запрос ушёл без токена',
  1100: 'у этого keyset нет прав на Buy API в production. Browse API в проде eBay открывает только партнёрам: заявка Buy API Application через eBay Partner Network, затем тикет Developer Support «Buy API Production Access»; до одобрения работает только sandbox',
  2001: 'лимит запросов eBay API исчерпан, повторите позже',
  2003: 'внутренняя ошибка eBay, повторите позже',
  2004: 'eBay счёл запрос неверным (параметры или заголовки)',
  11000: 'внутренняя ошибка eBay, повторите позже',
  12000: 'внутренняя ошибка eBay, повторите позже',
  11001: 'объявление с таким номером не найдено (снято, завершено или продавец в отпуске)',
  11003: 'объявление с таким номером не найдено (снято, завершено или продавец в отпуске)',
  11002: 'группа вариантов не найдена',
  11004: 'объявление временно недоступно для покупки (продавец его редактирует) — повторите через несколько минут',
  11008: 'группа вариантов временно недоступна — повторите через несколько минут',
  11006: 'это объявление с вариантами: нужна ссылка с ?var=<номер варианта> или чтение группы вариантов',
  11011: 'эта площадка eBay не поддерживается Browse API',
  12019: 'эта площадка eBay не поддерживается Browse API',
};

/** `X-EBAY-C-ENDUSERCTX` value: eBay then returns `shippingOptions` priced for the Atlas warehouse address. */
export function ebayEndUserContext(config: EbayBrowseConfig) {
  const country = (config.shipToCountry?.trim().toUpperCase() || 'US');
  if (!/^[A-Z]{2}$/.test(country)) return undefined;
  const zip = config.shipToPostalCode?.trim() ?? '';
  const location = `country=${country}${/^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/.test(zip) ? `,zip=${zip}` : ''}`;
  return {country, header: `contextualLocation=${encodeURIComponent(location)}`};
}

export class EbayListingUnavailableError extends Error {
  readonly stage: EbayImportStage;
  readonly status?: number;

  constructor(message = 'Объявление eBay больше недоступно. Проверьте ссылку или выберите другое объявление.', stage: EbayImportStage = 'item_data', status?: number) {
    super(message);
    this.name = 'EbayListingUnavailableError';
    this.stage = stage;
    this.status = status;
  }
}

export class EbayManualReviewError extends Error {
  readonly stage: EbayImportStage;
  readonly status?: number;

  constructor(message: string, stage: EbayImportStage = 'item_data', status?: number) {
    super(message);
    this.name = 'EbayManualReviewError';
    this.stage = stage;
    this.status = status;
  }
}

export class EbayBrowseApiError extends Error {
  readonly stage: EbayImportStage;
  readonly status?: number;
  readonly errorId?: number;
  /** eBay's own error text (bounded), so the operator sees why the API refused the listing. */
  readonly detail?: string;

  constructor(stage: EbayImportStage, status?: number, errorId?: number, detail?: string) {
    super('eBay Browse API request failed.');
    this.name = 'EbayBrowseApiError';
    this.stage = stage;
    this.status = status;
    this.errorId = errorId;
    this.detail = detail;
  }

  /** Russian operator-facing summary: stage, HTTP status, eBay error id, eBay's message and what the code means for Atlas. */
  describe() {
    const stageLabel: Record<EbayImportStage, string> = {
      configuration: 'ключи не настроены', oauth: 'получение токена', browse_item: 'запрос объявления',
      browse_variants: 'запрос вариантов', item_data: 'данные объявления', variation_group: 'группа вариантов', variant_data: 'данные вариантов',
    };
    const parts = [stageLabel[this.stage], this.status ? `HTTP ${this.status}` : 'нет ответа сети', this.errorId ? `errorId ${this.errorId}` : ''].filter(Boolean);
    const hint = this.errorId !== undefined ? EBAY_ERROR_HINTS[this.errorId] : this.status === 429 ? EBAY_ERROR_HINTS[2001] : undefined;
    return `eBay Browse API: ${parts.join(', ')}${this.detail ? ` — ${this.detail}` : ''}${hint ? ` · ${hint}` : ''}`;
  }
}

function clean(value: unknown, max = 180) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function record(value: unknown): EbayItem | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as EbayItem : undefined;
}

function positiveAmount(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+(?:\.\d{1,4})?$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : undefined;
}

function priceFor(item: EbayItem) {
  const value = record(item.price);
  const amount = positiveAmount(value?.value);
  const currency = clean(value?.currency, 8).toUpperCase();
  return amount && /^[A-Z]{3}$/.test(currency) ? {amount, currency} : undefined;
}

function safeEbayImage(value: unknown, sourceUrl: string) {
  if (typeof value !== 'string') return undefined;
  try {
    const image = new URL(value, sourceUrl);
    if (image.hostname.toLowerCase() !== 'i.ebayimg.com' || image.username || image.password || image.port || !['https:', 'http:'].includes(image.protocol)) return undefined;
    image.protocol = 'https:';
    return safeImage(image.href, sourceUrl);
  } catch {
    return undefined;
  }
}

function itemImages(item: EbayItem, sourceUrl: string) {
  const image = record(item.image);
  const additional = Array.isArray(item.additionalImages) ? item.additionalImages : [];
  const urls = [image?.imageUrl, ...additional.slice(0, MAX_IMAGES).map(value => record(value)?.imageUrl)]
    .map(value => safeEbayImage(value, sourceUrl))
    .filter((value): value is string => Boolean(value));
  return dedupeSafeImages(urls, sourceUrl, MAX_IMAGES);
}

function marketplaceFor(url: URL) {
  return MARKETPLACES[url.hostname.toLowerCase().replace(/^www\./, '')];
}

function listingIdFor(url: URL) {
  if (!/^\/itm\//i.test(url.pathname)) return undefined;
  const tail = url.pathname.split('/').filter(Boolean).at(-1) ?? '';
  return /^\d{8,15}$/.test(tail) ? tail : undefined;
}

function selectedLegacyVariation(url: URL) {
  const value = url.searchParams.get('var');
  return value && /^\d{1,20}$/.test(value) ? value : undefined;
}

async function readJson(response: Response, maxBytes: number, stage: EbayImportStage) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !/application\/json/i.test(contentType)) {
    await response.body?.cancel();
    throw new EbayBrowseApiError(stage, response.status || undefined);
  }
  const reader = response.body?.getReader();
  if (!reader) return {} as Record<string, unknown>;
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new EbayBrowseApiError(stage, response.status || undefined);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(merged)); }
  catch { throw new EbayBrowseApiError(stage, response.status || undefined); }
  return record(parsed) ?? {};
}

async function errorDetailsFrom(response: Response): Promise<{errorId?: number; detail?: string}> {
  const reader = response.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 32_000) {
        await reader.cancel();
        return {};
      }
      chunks.push(value);
    }
  } catch {
    return {};
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(merged);
  try {
    const raw = JSON.parse(text) as {errors?: unknown; error?: unknown; error_description?: unknown};
    const errors = Array.isArray(raw.errors) ? raw.errors : [];
    const first = (errors[0] ?? {}) as {errorId?: unknown; message?: unknown; longMessage?: unknown};
    const id = first.errorId;
    // OAuth failures use {error, error_description}; Browse failures use {errors:[{errorId,message}]}.
    const detail = clean(first.longMessage ?? first.message ?? raw.error_description ?? raw.error, 240) || undefined;
    return {errorId: typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : undefined, detail};
  } catch {
    // A non-JSON gateway answer still tells the operator something ("Bad Request", HTML title).
    const title = clean(text.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? text.replace(/<[^>]*>/g, ' '), 120) || undefined;
    return {detail: title};
  }
}

async function apiError(response: Response, stage: EbayImportStage, definitive = false) {
  const {errorId, detail} = await errorDetailsFrom(response);
  if (definitive && (response.status === 404 || response.status === 410)) {
    return new EbayListingUnavailableError('Магазин сообщил, что карточка товара не найдена. Проверьте ссылку.', stage, response.status);
  }
  return new EbayBrowseApiError(stage, response.status || undefined, errorId, detail);
}

async function tokenFor(config: EbayBrowseConfig, base: string, fetcher: EbayFetch, signal: AbortSignal) {
  const clientId = config.clientId?.trim();
  const clientSecret = config.clientSecret;
  if (!clientId || !clientSecret) return undefined;
  const cacheKey = `${base}\n${clientId}`;
  if (tokenCache?.key === cacheKey && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const basic = btoa(`${clientId}:${clientSecret}`);
  let response: Response;
  try {
    response = await fetcher(`${base}/identity/v1/oauth2/token`, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
      headers: {Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
      body: new URLSearchParams({grant_type: 'client_credentials', scope: API_SCOPE}),
    });
  } catch {
    throw new EbayBrowseApiError('oauth');
  }
  if (!response.ok) {
    throw await apiError(response, 'oauth');
  }
  const payload = await readJson(response, 32_000, 'oauth');
  const token = clean(payload.access_token, 4096);
  const lifetime = typeof payload.expires_in === 'number' && Number.isFinite(payload.expires_in) ? payload.expires_in : 0;
  if (!token || lifetime < 120) throw new EbayBrowseApiError('oauth', response.status);
  tokenCache = {key: cacheKey, token, expiresAt: Date.now() + Math.min(lifetime, 86_400) * 1000};
  return token;
}

async function browseGet(path: string | URL, token: string, marketplace: Marketplace, fetcher: EbayFetch, signal: AbortSignal, stage: EbayImportStage, definitive = false, endUserContext?: string) {
  let response: Response;
  try {
    response = await fetcher(path, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': marketplace.id,
        ...(endUserContext ? {'X-EBAY-C-ENDUSERCTX': endUserContext} : {}),
      },
    });
  } catch {
    throw new EbayBrowseApiError(stage);
  }
  if (!response.ok) {
    throw await apiError(response, stage, definitive);
  }
  return readJson(response, MAX_JSON_BYTES, stage);
}

function aspectsFor(item: EbayItem) {
  const aspects = new Map<string, string>();
  if (Array.isArray(item.localizedAspects)) {
    for (const raw of item.localizedAspects.slice(0, 80)) {
      const aspect = record(raw);
      const name = clean(aspect?.name, 80);
      const value = clean(aspect?.value, 120);
      if (name && value && !aspects.has(name)) aspects.set(name, value);
    }
  }
  const color = clean(item.color, 120);
  const size = clean(item.size, 120);
  if (color && ![...aspects.keys()].some(key => /colou?r/i.test(key))) aspects.set('Color', color);
  if (size && ![...aspects.keys()].some(key => /size/i.test(key))) aspects.set('Size', size);
  return aspects;
}

function variationId(item: EbayItem, listingId: string) {
  const match = clean(item.itemId, 100).match(/^v1\|([^|]+)\|([^|]+)$/);
  if (!match || match[1] !== listingId) return undefined;
  return match[2] === '0' ? undefined : match[2];
}

function availability(item: EbayItem) {
  const end = typeof item.itemEndDate === 'string' ? Date.parse(item.itemEndDate) : NaN;
  if (Number.isFinite(end) && end <= Date.now()) return {known: true, available: false};
  const estimates = Array.isArray(item.estimatedAvailabilities) ? item.estimatedAvailabilities : [];
  const statuses = estimates.map(value => clean(record(value)?.estimatedAvailabilityStatus, 40).toUpperCase()).filter(Boolean);
  if (statuses.some(value => value === 'IN_STOCK' || value === 'LIMITED_STOCK')) return {known: true, available: true};
  if (statuses.length && statuses.every(value => value === 'OUT_OF_STOCK')) return {known: true, available: false};
  return {known: false, available: true};
}

/**
 * Units left as eBay reports them (Browse API `estimatedAvailabilities`): an exact estimated count, or only
 * "more than N" when the seller hides it. Nothing is derived from other fields.
 */
export function ebayStock(item: EbayItem): { quantity?: number; quantityMoreThan?: number } {
  const estimates = Array.isArray(item.estimatedAvailabilities) ? item.estimatedAvailabilities.map(record).filter(Boolean) : [];
  const count = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000 ? value : undefined;
  for (const estimate of estimates) {
    const type = clean(estimate?.availabilityThresholdType, 20).toUpperCase();
    const threshold = count(estimate?.availabilityThreshold);
    if (type === 'MORE_THAN' && threshold !== undefined) return { quantityMoreThan: threshold };
    const quantity = count(estimate?.estimatedAvailableQuantity);
    if (quantity !== undefined) return { quantity };
  }
  return {};
}

function fixedPrice(item: EbayItem) {
  return Array.isArray(item.buyingOptions) && item.buyingOptions.includes('FIXED_PRICE');
}

/**
 * The cheapest seller shipping option eBay priced for the warehouse country (`shippingOptions`,
 * present when the request carried X-EBAY-C-ENDUSERCTX). 0 means the seller ships free.
 */
export function ebaySellerShipping(item: EbayItem, country: string) {
  const options = Array.isArray(item.shippingOptions) ? item.shippingOptions.map(record).filter((value): value is EbayItem => Boolean(value)) : [];
  let best: {amount: number; currency: string} | undefined;
  for (const option of options) {
    const cost = record(option.shippingCost);
    const raw = cost?.value;
    const amount = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+(?:\.\d{1,4})?$/.test(raw.trim()) ? Number(raw) : NaN;
    const currency = clean(cost?.currency, 8).toUpperCase();
    if (!Number.isFinite(amount) || amount < 0 || amount > 100_000 || !/^[A-Z]{3}$/.test(currency)) continue;
    const usedCountry = clean(record(option.shipToLocationUsedForEstimate)?.country, 2).toUpperCase();
    if (usedCountry && usedCountry !== country) continue;
    if (!best || amount < best.amount) best = {amount, currency};
  }
  return best;
}

/** The seller's "was" price (`marketingPrice.originalPrice`), kept only when it is really above the price; display only. */
function referencePriceFor(item: EbayItem, price: {amount: number; currency: string} | undefined) {
  const original = record(record(item.marketingPrice)?.originalPrice);
  const amount = positiveAmount(original?.value);
  const currency = clean(original?.currency, 8).toUpperCase();
  return price && amount && currency === price.currency && amount > price.amount && amount <= price.amount * 10 ? amount : undefined;
}

/** Anything but eBay condition 1000 "New" is said out loud: the customer may be buying used or refurbished goods. */
export function ebayConditionNote(item: EbayItem) {
  const condition = clean(item.condition, 80);
  const id = clean(item.conditionId, 10);
  if (!condition && !id) return undefined;
  const isNew = id ? id === '1000' : /^(brand )?new$/i.test(condition);
  if (isNew) return undefined;
  return `Состояние по объявлению eBay: ${condition || `код ${id}`}. Это не новый товар в заводской упаковке — учитывайте при заказе.`;
}

/** Whether the seller's `shipToLocations` allow the warehouse country; undefined when eBay did not say. */
export function ebayShipsTo(item: EbayItem, country: string) {
  const locations = record(item.shipToLocations);
  if (!locations) return undefined;
  const ids = (value: unknown) => Array.isArray(value) ? value.map(record).map(entry => clean(entry?.regionId, 40).toUpperCase()).filter(Boolean) : [];
  const excluded = ids(locations.regionExcluded);
  const included = ids(locations.regionIncluded);
  if (excluded.includes(country)) return false;
  if (!included.length) return undefined;
  const regions = country === 'US' ? ['US', 'WORLDWIDE', 'NORTH_AMERICA', 'AMERICAS'] : country === 'CA' ? ['CA', 'WORLDWIDE', 'NORTH_AMERICA', 'AMERICAS'] : [country, 'WORLDWIDE'];
  return included.some(id => regions.includes(id));
}

function sellerNote(item: EbayItem) {
  const seller = record(item.seller);
  const name = clean(seller?.username, 60);
  if (!name) return undefined;
  const rawPercent = seller?.feedbackPercentage;
  const percent = typeof rawPercent === 'number' ? rawPercent : typeof rawPercent === 'string' ? Number(rawPercent) : NaN;
  const score = typeof seller?.feedbackScore === 'number' && Number.isFinite(seller.feedbackScore) ? seller.feedbackScore : undefined;
  const parts = [`Продавец eBay: ${name}`];
  if (Number.isFinite(percent)) parts.push(`положительных отзывов ${percent.toLocaleString('ru-RU', {maximumFractionDigits: 1})} %`);
  if (score !== undefined) parts.push(`всего отзывов ${score}`);
  if (item.topRatedBuyingExperience === true) parts.push('статус Top Rated');
  return `${parts.join(', ')}.`;
}

const notShippedNote = (country: string) => country === 'US'
  ? 'Продавец eBay не отправляет этот товар в США, куда приходит посылка на склад Atlas. Выберите другое объявление или уточните у продавца.'
  : `Продавец eBay не отправляет этот товар в страну склада (${country}). Выберите другое объявление или уточните у продавца.`;

/** Fields shared by a single listing and a variation group: seller shipping to the warehouse, condition and seller notes. */
function listingContext(item: EbayItem, country: string) {
  if (ebayShipsTo(item, country) === false) throw new EbayManualReviewError(notShippedNote(country), 'item_data', 200);
  const shipping = ebaySellerShipping(item, country);
  const notes = [ebayConditionNote(item), sellerNote(item)].filter((value): value is string => Boolean(value));
  if (shipping) notes.push(shipping.amount === 0
    ? 'Продавец доставляет до склада Atlas бесплатно — по расчёту eBay для адреса склада.'
    : 'Доставка продавца до склада Atlas взята из расчёта eBay для адреса склада; оператор сверит её при выкупе.');
  return {
    fields: shipping ? {shipping: shipping.amount, shippingCurrency: shipping.currency, shippingDestination: country} : {},
    notes,
  };
}

function itemCountry(item: EbayItem) {
  const code = clean(record(item.itemLocation)?.country, 8).toUpperCase();
  const countryByCode: Record<string, string> = {
    US: 'США', CA: 'Канада', GB: 'Великобритания', UK: 'Великобритания', AU: 'Австралия',
    DE: 'Германия', ES: 'Испания', FR: 'Франция', IT: 'Италия',
    RO: 'Румыния', CN: 'Китай', TR: 'Турция', JP: 'Япония', KR: 'Южная Корея', AE: 'ОАЭ',
  };
  return countryByCode[code] ?? 'Другая страна';
}

function inferCategory(item: EbayItem, title: string) {
  const category = clean(item.categoryPath, 300);
  return inferProductCategory([title, category].filter(Boolean).join(' '), clean(item.brand, 80));
}

function groupVariants(items: EbayItem[], listingId: string, sourceUrl: string, expectedCurrency: string) {
  const validItems = items.filter(item => variationId(item, listingId) !== undefined);
  const aspectMaps = validItems.map(aspectsFor);
  const allKeys = [...new Set(aspectMaps.flatMap(map => [...map.keys()]))];
  const varyingKeys = allKeys.filter(key => new Set(aspectMaps.map(map => map.get(key)).filter(Boolean)).size > 1);
  const colorKey = varyingKeys.find(key => /colou?r/i.test(key));
  const sizeKey = varyingKeys.find(key => /size|width|length|waist|band|cup/i.test(key) && key !== colorKey);
  const unknownKeys = varyingKeys.filter(key => key !== colorKey && key !== sizeKey);
  // The customer UI has a real color/size matrix. If a seller adds a third
  // independent axis (e.g. width or storage), keep each exact option intact
  // in a flat selector rather than silently merging combinations.
  const matrixSafe = unknownKeys.length === 0 && !(colorKey && sizeKey && varyingKeys.length > 2);
  const variants: ProductVariant[] = [];
  const rejected = items.length - validItems.length;
  for (const item of validItems.slice(0, MAX_VARIANTS)) {
    if (!fixedPrice(item)) continue;
    const state = availability(item);
    if (state.known && !state.available) continue;
    const price = priceFor(item);
    if (!price || price.currency !== expectedCurrency) continue;
    const aspects = aspectsFor(item);
    const color = matrixSafe && colorKey ? aspects.get(colorKey) : undefined;
    const size = matrixSafe && sizeKey ? aspects.get(sizeKey) : undefined;
    const dimensionValues = varyingKeys.map(key => {
      const value = aspects.get(key);
      return value ? `${key}: ${value}` : '';
    }).filter(Boolean);
    const label = matrixSafe
      ? [color, size].filter(Boolean).join(' · ') || clean(item.title, 140)
      : dimensionValues.join(' · ');
    if (!label) continue;
    const images = itemImages(item, sourceUrl);
    variants.push({
      id: variationId(item, listingId),
      label: label.slice(0, 140),
      ...(size ? {size, sizeLabel: sizeKey?.slice(0, 100)} : {}),
      ...(color ? {color} : {}),
      available: state.available,
      availabilityKnown: state.known,
      price: price.amount,
      image: images[0],
      ...ebayStock(item),
    });
  }
  const distinctLabels = new Set(variants.map(value => value.label));
  if (variants.length > 1 && distinctLabels.size !== variants.length) {
    // Duplicate seller aspects can conceal different underlying choices.
    // Keep the listing reviewable, but don't present an ambiguous selector.
    return {variants: [] as ProductVariant[], warning: 'eBay не различил некоторые варианты объявления. Проверьте точный вариант вручную.', warnings: [] as string[]};
  }
  const warnings = [
    'Размер и обозначения вариантов приведены продавцом eBay; Atlas не преобразует их в неподтверждённую официальную сетку.',
    'Наличие проверено по данным объявления eBay; цену и остаток Atlas сверит с eBay перед выкупом.',
    ...(rejected ? ['Часть вариантов не удалось точно связать с этим объявлением; они не показаны.'] : []),
    ...(validItems.length > MAX_VARIANTS ? [`Показаны первые ${MAX_VARIANTS} вариантов объявления.`] : []),
  ];
  return {variants, warning: undefined as string | undefined, warnings};
}

function mapSingleItem(item: EbayItem, listingId: string, url: URL, shipToCountry: string): Extracted {
  const itemId = clean(item.itemId, 100);
  if (!itemId.startsWith(`v1|${listingId}|`)) throw new Error('eBay item did not match the requested listing.');
  if (!fixedPrice(item)) throw new EbayManualReviewError('Это аукцион или предложение без фиксированной цены. Проверьте объявление вручную; текущая ставка не считается ценой покупки.', 'item_data', 200);
  const price = priceFor(item);
  const title = clean(item.title, 140);
  const images = itemImages(item, url.href);
  const status = availability(item);
  if (status.known && !status.available) throw new EbayListingUnavailableError(undefined, 'item_data', 200);
  if (!title || !price || !price.currency) throw new EbayManualReviewError('eBay не вернул полные данные объявления.', 'item_data', 200);
  const brand = clean(item.brand, 80) || undefined;
  const category = inferCategory(item, title);
  const variant: ProductVariant = {
    id: variationId(item, listingId),
    label: clean(item.color, 100) || clean(item.size, 100) || 'Объявление eBay',
    available: status.available,
    availabilityKnown: status.known,
    price: price.amount,
    image: images[0],
    ...ebayStock(item),
  };
  const sizeAspect = [...aspectsFor(item)].find(([name]) => /size|width|length|waist|band|cup/i.test(name));
  if (sizeAspect) {
    variant.size = sizeAspect[1];
    variant.sizeLabel = sizeAspect[0].slice(0, 100);
    variant.label = [clean(item.color, 100), sizeAspect[1]].filter(Boolean).join(' · ');
  }
  const currency = price.currency;
  const context = listingContext(item, shipToCountry);
  const referencePrice = referencePriceFor(item, price);
  return {
    sku: itemId,
    title,
    brand,
    category,
    image: images[0],
    images,
    price: price.amount,
    ...(referencePrice !== undefined ? {referencePrice} : {}),
    currency,
    variants: [variant],
    ...context.fields,
    country: itemCountry(item),
    warnings: [
      'Цена и вариант получены из eBay Browse API для точного объявления.',
      'Обозначения размера взяты у продавца eBay и не конвертированы в неподтверждённую сетку.',
      'Страна отправки берётся из места товара в объявлении; если продавец её не указал, уточните страну перед заказом.',
      ...context.notes,
    ],
    sourceUrl: url.href,
    method: 'eBay Browse API',
  };
}

/**
 * Read one exact eBay listing using the official Browse API. When credentials,
 * a supported marketplace, or a numeric listing URL are absent, return
 * undefined so the existing safe HTML/manual-review flow remains in charge.
 */
export async function fetchEbayProduct(sourceUrl: string, config: EbayBrowseConfig, fetcher: EbayFetch = fetch, signal = AbortSignal.timeout(15_000)) {
  const url = new URL(sourceUrl);
  const marketplace = marketplaceFor(url);
  const listingId = listingIdFor(url);
  if (!config.clientId?.trim() || !config.clientSecret || !config.environment || !marketplace || !listingId) return undefined;
  const environment = config.environment;
  const base = environment === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
  const token = await tokenFor(config, base, fetcher, signal);
  if (!token) return undefined;
  const endUser = ebayEndUserContext(config);
  const shipToCountry = endUser?.country ?? 'US';

  const itemUrl = new URL(`${base}/buy/browse/v1/item/get_item_by_legacy_id`);
  itemUrl.searchParams.set('legacy_item_id', listingId);
  const selectedVariation = selectedLegacyVariation(url);
  if (selectedVariation) itemUrl.searchParams.set('legacy_variation_id', selectedVariation);
  let item: EbayItem;
  let group: EbayItem | undefined;
  try {
    item = await browseGet(itemUrl, token, marketplace, fetcher, signal, 'browse_item', true, endUser?.header);
  } catch (error) {
    // A parent listing URL has no child variation ID. eBay rejects that
    // legacy-item request with 400; its exact group endpoint accepts the
    // parent ID and returns the individually priced seller variations.
    // 11006 = "legacy_variation_id or legacy_variation_sku is required" for a multi-variation parent;
    // any other 400 is also retried through the group endpoint, which accepts the parent ID directly.
    if (!(error instanceof EbayBrowseApiError) || error.status !== 400) throw error;
    if (selectedVariation && error.errorId !== undefined && error.errorId !== 11006 && error.errorId !== 11005) throw error;
    const groupUrl = new URL(`${base}/buy/browse/v1/item/get_items_by_item_group`);
    groupUrl.searchParams.set('item_group_id', listingId);
    group = await browseGet(groupUrl, token, marketplace, fetcher, signal, 'browse_variants', false, endUser?.header);
    const groupItems = Array.isArray(group.items) ? group.items.map(record).filter((value): value is EbayItem => Boolean(value) && variationId(value!, listingId) !== undefined) : [];
    const exactItem = (selectedVariation ? groupItems.find(value => variationId(value, listingId) === selectedVariation) : undefined) ?? groupItems[0];
    if (!exactItem) throw new EbayManualReviewError('eBay не вернул варианты запрошенного объявления.', 'variation_group', 200);
    item = exactItem;
  }
  if (selectedVariation && variationId(item, listingId) !== selectedVariation) {
    throw new EbayManualReviewError('eBay не подтвердил запрошенный вариант объявления. Проверьте точный вариант по ссылке вручную.', 'variant_data', 200);
  }
  const primaryGroup = record(item.primaryItemGroup);
  const groupId = group ? listingId : clean(primaryGroup?.itemGroupId, 32);
  const groupType = group ? 'SELLER_DEFINED_VARIATIONS' : clean(primaryGroup?.itemGroupType, 80);
  if (!groupId || groupType !== 'SELLER_DEFINED_VARIATIONS') return mapSingleItem(item, listingId, url, shipToCountry);
  if (groupId !== listingId) throw new EbayManualReviewError('Не удалось подтвердить, что варианты относятся к этому объявлению eBay.', 'variation_group', 200);

  const groupUrl = new URL(`${base}/buy/browse/v1/item/get_items_by_item_group`);
  groupUrl.searchParams.set('item_group_id', groupId);
  const recoveredParent = Boolean(group);
  group ??= await browseGet(groupUrl, token, marketplace, fetcher, signal, 'browse_variants', false, endUser?.header);
  const items = Array.isArray(group.items) ? group.items.map(record).filter((value): value is EbayItem => Boolean(value)) : [];
  const exactItems = items.filter(value => variationId(value, listingId) !== undefined);
  if (exactItems.length && exactItems.every(value => {
    const state = availability(value);
    return state.known && !state.available;
  })) throw new EbayListingUnavailableError(undefined, 'variation_group', 200);
  const parentPrice = priceFor(item);
  const groupPrice = exactItems.map(priceFor).find((value): value is NonNullable<typeof value> => Boolean(value));
  const currency = groupPrice?.currency ?? parentPrice?.currency;
  const title = clean(primaryGroup?.itemGroupTitle ?? item.title, 140);
  if (!title || !currency) throw new EbayManualReviewError('eBay не вернул полные данные вариантов.', 'variation_group', 200);
  const parsed = groupVariants(items, listingId, url.href, currency);
  if (parsed.warning) throw new EbayManualReviewError(parsed.warning, 'variant_data', 200);
  if (!parsed.variants.length) throw new EbayManualReviewError('eBay не вернул ни одного варианта с проверяемой ценой и размером. Откройте объявление и проверьте его вручную.', 'variant_data', 200);
  const selectedColor = recoveredParent ? undefined : clean(item.color, 120) || [...aspectsFor(item)].find(([name]) => /colou?r/i.test(name))?.[1] || undefined;
  const images = dedupeSafeImages([
    ...itemImages(primaryGroup ?? {}, url.href),
    ...itemImages(item, url.href),
    ...exactItems.flatMap(value => itemImages(value, url.href)),
  ], url.href, MAX_IMAGES);
  const category = inferCategory(item, title);
  const context = listingContext(item, shipToCountry);
  return {
    sku: listingId,
    title,
    brand: clean(item.brand, 80) || undefined,
    category,
    image: images[0],
    images,
    // A group can have different prices by size/color. Leave the form price
    // unset and carry the authoritative amount on each selectable variant.
    variants: parsed.variants,
    currency,
    ...context.fields,
    selectedVariantColor: selectedColor,
    country: itemCountry(item),
    warnings: [...parsed.warnings, 'Страна отправки берётся из места товара в объявлении; если продавец её не указал, уточните страну перед заказом.', ...context.notes],
    sourceUrl: url.href,
    method: 'eBay Browse API · listing variations',
  } satisfies Extracted;
}

/** Clear cached OAuth data when credentials are deliberately rotated in a worker. */
export function clearEbayTokenCacheForTests() {
  tokenCache = undefined;
}
