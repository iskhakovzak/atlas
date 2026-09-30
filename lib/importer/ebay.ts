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
};

export type EbayFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

type Marketplace = {id: string};
type EbayItem = Record<string, unknown>;

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

export class EbayListingUnavailableError extends Error {
  constructor(message = 'Объявление eBay больше недоступно. Проверьте ссылку или выберите другое объявление.') {
    super(message);
    this.name = 'EbayListingUnavailableError';
  }
}

export class EbayManualReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EbayManualReviewError';
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

async function readJson(response: Response, maxBytes = MAX_JSON_BYTES) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !/application\/json/i.test(contentType)) {
    await response.body?.cancel();
    throw new Error(`eBay Browse API returned ${response.status || 'an invalid response'}.`);
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
        throw new Error('eBay Browse API response exceeded the size limit.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  const parsed = JSON.parse(new TextDecoder().decode(merged));
  return record(parsed) ?? {};
}

function apiError(response: Response, definitive = false) {
  if (definitive && (response.status === 404 || response.status === 410)) {
    return new EbayListingUnavailableError('Магазин сообщил, что карточка товара не найдена. Проверьте ссылку.');
  }
  return new Error(`eBay Browse API returned ${response.status || 'an invalid response'}.`);
}

async function tokenFor(config: EbayBrowseConfig, base: string, fetcher: EbayFetch, signal: AbortSignal) {
  const clientId = config.clientId?.trim();
  const clientSecret = config.clientSecret;
  if (!clientId || !clientSecret) return undefined;
  const cacheKey = `${base}\n${clientId}`;
  if (tokenCache?.key === cacheKey && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const basic = btoa(`${clientId}:${clientSecret}`);
  const response = await fetcher(`${base}/identity/v1/oauth2/token`, {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
    headers: {Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
    body: new URLSearchParams({grant_type: 'client_credentials', scope: API_SCOPE}),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw apiError(response);
  }
  const payload = await readJson(response, 32_000);
  const token = clean(payload.access_token, 4096);
  const lifetime = typeof payload.expires_in === 'number' && Number.isFinite(payload.expires_in) ? payload.expires_in : 0;
  if (!token || lifetime < 120) throw new Error('eBay OAuth token response was incomplete.');
  tokenCache = {key: cacheKey, token, expiresAt: Date.now() + Math.min(lifetime, 86_400) * 1000};
  return token;
}

async function browseGet(path: string, token: string, marketplace: Marketplace, fetcher: EbayFetch, signal: AbortSignal, definitive = false) {
  const response = await fetcher(path, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': marketplace.id,
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw apiError(response, definitive);
  }
  return readJson(response);
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

function fixedPrice(item: EbayItem) {
  return Array.isArray(item.buyingOptions) && item.buyingOptions.includes('FIXED_PRICE');
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
    'Наличие проверено по данным объявления eBay; перед выкупом магазин может изменить цену или остаток.',
    ...(rejected ? ['Часть вариантов не удалось точно связать с этим объявлением; они не показаны.'] : []),
    ...(validItems.length > MAX_VARIANTS ? [`Показаны первые ${MAX_VARIANTS} вариантов объявления.`] : []),
  ];
  return {variants, warning: undefined as string | undefined, warnings};
}

function mapSingleItem(item: EbayItem, listingId: string, url: URL): Extracted {
  const itemId = clean(item.itemId, 100);
  if (!itemId.startsWith(`v1|${listingId}|`)) throw new Error('eBay item did not match the requested listing.');
  if (!fixedPrice(item)) throw new EbayManualReviewError('Это аукцион или предложение без фиксированной цены. Проверьте объявление вручную; текущая ставка не считается ценой покупки.');
  const price = priceFor(item);
  const title = clean(item.title, 140);
  const images = itemImages(item, url.href);
  const status = availability(item);
  if (status.known && !status.available) throw new EbayListingUnavailableError();
  if (!title || !price || !price.currency) throw new Error('eBay listing data was incomplete.');
  const brand = clean(item.brand, 80) || undefined;
  const category = inferCategory(item, title);
  const variant: ProductVariant = {
    id: variationId(item, listingId),
    label: clean(item.color, 100) || clean(item.size, 100) || 'Объявление eBay',
    available: status.available,
    availabilityKnown: status.known,
    price: price.amount,
    image: images[0],
  };
  const sizeAspect = [...aspectsFor(item)].find(([name]) => /size|width|length|waist|band|cup/i.test(name));
  if (sizeAspect) {
    variant.size = sizeAspect[1];
    variant.sizeLabel = sizeAspect[0].slice(0, 100);
    variant.label = [clean(item.color, 100), sizeAspect[1]].filter(Boolean).join(' · ');
  }
  const currency = price.currency;
  return {
    sku: itemId,
    title,
    brand,
    category,
    image: images[0],
    images,
    price: price.amount,
    currency,
    variants: [variant],
    country: itemCountry(item),
    warnings: [
      'Цена и вариант получены из eBay Browse API для точного объявления.',
      'Обозначения размера взяты у продавца eBay и не конвертированы в неподтверждённую сетку.',
      'Страна отправки берётся из места товара в объявлении; если продавец её не указал, уточните страну перед заказом.',
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

  const itemUrl = new URL(`${base}/buy/browse/v1/item/get_item_by_legacy_id`);
  itemUrl.searchParams.set('legacy_item_id', listingId);
  const selectedVariation = selectedLegacyVariation(url);
  if (selectedVariation) itemUrl.searchParams.set('legacy_variation_id', selectedVariation);
  const item = await browseGet(itemUrl, token, marketplace, fetcher, signal, true);
  const primaryGroup = record(item.primaryItemGroup);
  const groupId = clean(primaryGroup?.itemGroupId, 32);
  const groupType = clean(primaryGroup?.itemGroupType, 80);
  if (!groupId || groupType !== 'SELLER_DEFINED_VARIATIONS') return mapSingleItem(item, listingId, url);
  if (groupId !== listingId) throw new Error('eBay variation group did not match the requested listing.');

  const groupUrl = new URL(`${base}/buy/browse/v1/item/get_items_by_item_group`);
  groupUrl.searchParams.set('item_group_id', groupId);
  const group = await browseGet(groupUrl, token, marketplace, fetcher, signal);
  const items = Array.isArray(group.items) ? group.items.map(record).filter((value): value is EbayItem => Boolean(value)) : [];
  const parentPrice = priceFor(item);
  const groupPrice = items.map(priceFor).find((value): value is NonNullable<typeof value> => Boolean(value));
  const currency = groupPrice?.currency ?? parentPrice?.currency;
  const title = clean(primaryGroup.itemGroupTitle ?? item.title, 140);
  if (!title || !currency) throw new Error('eBay variation group data was incomplete.');
  const parsed = groupVariants(items, listingId, url.href, currency);
  if (parsed.warning) throw new EbayManualReviewError(parsed.warning);
  if (!parsed.variants.length) throw new EbayManualReviewError('eBay не вернул ни одного варианта с проверяемой ценой и размером. Откройте объявление и проверьте его вручную.');
  const selectedColor = clean(item.color, 120) || [...aspectsFor(item)].find(([name]) => /colou?r/i.test(name))?.[1] || undefined;
  const images = dedupeSafeImages([
    ...itemImages(primaryGroup, url.href),
    ...itemImages(item, url.href),
    ...items.flatMap(value => itemImages(value, url.href)),
  ], url.href, MAX_IMAGES);
  const category = inferCategory(item, title);
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
    selectedVariantColor: selectedColor,
    country: itemCountry(item),
    warnings: [...parsed.warnings, 'Страна отправки берётся из места товара в объявлении; если продавец её не указал, уточните страну перед заказом.'],
    sourceUrl: url.href,
    method: 'eBay Browse API · listing variations',
  } satisfies Extracted;
}

/** Clear cached OAuth data when credentials are deliberately rotated in a worker. */
export function clearEbayTokenCacheForTests() {
  tokenCache = undefined;
}
