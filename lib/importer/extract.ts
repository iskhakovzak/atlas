import { extractMacysProduct } from './macys.ts';
import { extractCharlotteTilburyProduct } from './charlottetilbury.ts';
import { extractMangoProduct } from './mango.ts';
import { extractGapIncProduct } from './gapinc.ts';
import { extractUltaProduct } from './ulta.ts';
import { priorityMerchantProfiles } from './merchant-profiles.ts';
import { isEbayStoreHost } from './stores.ts';
import { inferNikeFootwearSizeSystem } from '../market/nike-size-chart.ts';
import { publicJsonStates } from './public-state.ts';
import { sameNorthFaceArticle, sourceProductIds } from './source-identity.ts';
import { enrichMerchantOptions } from './merchant-options.ts';
import { extractShopifyHtml } from './shopify.ts';
import { safeVariantSourceUrl } from './variant-normalization.ts';
import { extractZalandoProduct } from './zalando.ts';
export type ProductVariant = {
  id?: string;
  sourceUrl?: string;
  productId?: string;
  sellerId?: string;
  offerId?: string;
  colorId?: string;
  options?: {name:string;value:string}[];
  images?: string[];
  size?: string;
  sizeLabel?: string;
  sizeAlternates?: {system:string;value:string}[];
  color?: string;
  label: string;
  available: boolean;
  /** False means the merchant omitted a definitive stock signal. */
  availabilityKnown?: boolean;
  price?: number;
  /** The store's own "before the discount" price for this option (Shopify compare_at_price), only when above `price`. */
  compareAtPrice?: number;
  image?: string;
  /** Units left as the store itself reports them (eBay Browse API); never inferred from other signals. */
  quantity?: number;
  /** The store only says "more than N" (eBay hides exact stock above its threshold). */
  quantityMoreThan?: number;
};

export type ProductColorwayGallery = {
  colorId?: string;
  color: string;
  images: string[];
};

export type Extracted = {
  variantScope?: 'group'|'color'|'item';
  groupId?: string;
  variantsComplete?: boolean;
  /** Merchant identity from the selected structured product, never a guessed ID. */
  sku?: string;
  /** Exact option resolved from native URL controls; preview-only, not a stored SKU. */
  selectedVariantId?: string;
  title?: string;
  brand?: string;
  category?: ProductCategory;
  declarationDescription?: string;
  image?: string;
  images?: string[];
  /** Optional, short-lived galleries for exact sibling colorways in a merchant product group. */
  colorwayImages?: ProductColorwayGallery[];
  /** Color belonging to the exact article selected by the source URL. */
  selectedVariantColor?: string;
  price?: number;
  /** The store's "before the discount" price for `price`, in `currency`; display only. */
  referencePrice?: number;
  currency?: string;
  variants?: ProductVariant[];
  shipping?: number;
  shippingCurrency?: string;
  shippingDestination?: string;
  boxedWeight?: number;
  weightKind?: "shipping" | "net";
  country?: string;
  warnings: string[];
  sourceUrl: string;
  /** Parsing metadata may be absent in an incomplete manual-entry fallback. */
  method?: string;
};

export type ProductCategory =
  | "Обувь"
  | "Одежда"
  | "Электроника"
  | "Аксессуары"
  | "Красота и уход"
  | "Дом и быт"
  | "Спорт"
  | "Другое";

type EmbeddedRecord = Record<string, unknown>;

/**
 * A number of priority merchants render their product page from a bounded
 * public JSON state blob instead of JSON-LD.  This parser is deliberately
 * conservative: it only accepts a state object that can be tied back to the
 * exact source path/id, and it never treats a recommendation as the product.
 * It is a fallback for public data, not a browser/CAPTCHA workaround.
 */
function embeddedJson(html: string) {
  return publicJsonStates(html);
}

function embeddedText(value: unknown) {
  return typeof value === "string" ? clean(value) : "";
}

function embeddedIdentifier(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  return embeddedText(value);
}

function embeddedNumber(value: unknown) {
  if (value && typeof value === "object") {
    const record = value as EmbeddedRecord;
    return number(record.amount ?? record.value ?? record.current ?? record.price);
  }
  return number(value);
}

const embeddedObject = (value: unknown): EmbeddedRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as EmbeddedRecord : {};

/** Recognized public price shapes; ranges/minimums never become an exact price. */
function embeddedPrice(record: EmbeddedRecord) {
  const price = embeddedObject(record.price), info = embeddedObject(record.priceInfo);
  const sales = embeddedObject(price.sales), current = embeddedObject(info.currentPrice);
  return embeddedNumber(record.currentPrice ?? record.salePrice ?? record.finalPrice ?? sales.value ?? current.price ?? price.current_retail ?? record.price ?? record.amount);
}

function embeddedCurrency(record: EmbeddedRecord) {
  const price = embeddedObject(record.price), info = embeddedObject(record.priceInfo);
  const current = embeddedObject(info.currentPrice), sales = embeddedObject(price.sales);
  const currency = embeddedText(record.currency ?? record.currencyCode ?? record.priceCurrency ?? sales.currency ?? current.currencyUnit ?? price.currency ?? price.currency_code).toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : undefined;
}

function embeddedTitle(record: EmbeddedRecord) {
  const item = embeddedObject(record.item), description = embeddedObject(item.product_description);
  return embeddedText(record.name ?? record.title ?? record.productName ?? record.displayName ?? record.fullTitle ?? description.title);
}

function embeddedUrlMatches(value: unknown, sourceUrl: string) {
  if (sameNorthFaceArticle(value, sourceUrl)) return true;
  if (typeof value !== "string") return false;
  try {
    const candidate = new URL(value, sourceUrl), source = new URL(sourceUrl);
    if (candidate.protocol !== "https:" || candidate.username || candidate.password || candidate.port) return false;
    candidate.hostname = candidate.hostname.replace(/^www\./, "");
    source.hostname = source.hostname.replace(/^www\./, "");
    candidate.pathname = candidate.pathname.replace(/\/$/, "") || "/";
    source.pathname = source.pathname.replace(/\/$/, "") || "/";
    if (candidate.origin !== source.origin || candidate.pathname !== source.pathname) return false;
    // Tracking and a selected size do not identify a different listing.
    // A colour or another product-defining query value does.
    for (const url of [candidate, source]) {
      for (const key of [...url.searchParams.keys()]) {
        if (/^(utm_.+|gclid|fbclid|variant|size|sku)$/i.test(key)) url.searchParams.delete(key);
      }
      url.searchParams.sort();
    }
    return candidate.search === source.search;
  } catch { return false; }
}

function embeddedListingTokens(sourceUrl: string) {
  return sourceProductIds(sourceUrl);
}

function embeddedCandidateMatches(record: EmbeddedRecord, sourceUrl: string, tokens: Set<string>) {
  const urlFields = ['url', 'canonicalUrl', 'canonical', 'pdpUrl', 'productUrl', 'link', 'href', 'path'];
  const publishedUrls = urlFields.map(key => record[key]).filter(value => typeof value === 'string' && value.length > 0);
  if (publishedUrls.length) return publishedUrls.some(value => embeddedUrlMatches(value, sourceUrl));
  const idFields = ['itemId', 'productId', 'genericId', 'productCode', 'styleCode', 'articleNumber', 'tcin', 'sku', 'id'];
  return idFields.some(key => {
    const value = embeddedIdentifier(record[key]).toLowerCase();
    if (!value || value.length < 3) return false;
    // A numeric id must be long enough to be a real listing identifier. This
    // avoids matching a generic state key such as id=1 from a recommendation.
    if (/^\d+$/.test(value) && value.length < 5) return false;
    return tokens.has(value);
  });
}

function embeddedImages(record: EmbeddedRecord, sourceUrl: string) {
  const values: unknown[] = [];
  const imageInfo = embeddedObject(record.imageInfo), enrichment = embeddedObject(embeddedObject(record.item).enrichment);
  const targetImages = embeddedObject(enrichment.images);
  values.push(...(Array.isArray(imageInfo.allImages) ? imageInfo.allImages : []), imageInfo.thumbnailUrl,
    targetImages.primary_image_url, ...(Array.isArray(targetImages.alternate_image_urls) ? targetImages.alternate_image_urls : []));
  for (const key of ['image', 'images', 'gallery', 'media', 'pictures', 'photo', 'photos']) {
    const value = record[key];
    if (Array.isArray(value)) values.push(...value);
    else if (value !== undefined) values.push(value);
  }
  const urls = values.flatMap(value => {
    if (typeof value === 'string') return [value];
    if (!value || typeof value !== 'object') return [];
    const item = value as EmbeddedRecord;
    return [item.url, item.src, item.contentUrl, item.imageUrl, item.large, item.original];
  });
  return dedupeSafeImages(urls, sourceUrl);
}

function embeddedAvailability(record: EmbeddedRecord) {
  for (const key of ['available', 'isAvailable', 'inStock', 'availableForSale', 'orderable']) {
    if (typeof record[key] === 'boolean') return {available: record[key], availabilityKnown: true};
  }
  for (const key of ['quantity', 'stock', 'inventory', 'quantityAvailable']) {
    if (typeof record[key] === 'number') return {available: record[key] > 0, availabilityKnown: true};
    if (record[key] && typeof record[key] === 'object') {
      const amount = embeddedNumber(record[key]);
      if (amount !== undefined) return {available: amount > 0, availabilityKnown: true};
    }
  }
  const state = embeddedText(record.availability ?? record.availabilityStatus ?? record.stockStatus ?? record.status).toLowerCase();
  if (state) {
    if (/out.?of.?stock|sold.?out|unavailable|inactive|discontinued|not.?available/.test(state)) return {available: false, availabilityKnown: true};
    if (/^(?:https?:\/\/schema.org\/)?(?:in.?stock|available|active|buyable|orderable|in_stock)$/i.test(state)) return {available: true, availabilityKnown: true};
  }
  return {available: true, availabilityKnown: false};
}

function embeddedOptionEntries(record: EmbeddedRecord) {
  const entries: {name: string; value: string}[] = [];
  for (const key of ['optionValues', 'selectedOptions', 'additionalProperty', 'variationAttributes', 'variationValues', 'attributes', 'options']) {
    const raw = record[key];
    if (Array.isArray(raw)) {
      for (const value of raw) {
        if (!value || typeof value !== 'object') continue;
        const item = value as EmbeddedRecord;
        const name = embeddedText(item.name ?? item.label ?? item.propertyID ?? item.optionName ?? item.key);
        const rawValue = item.value ?? item.selectedValue ?? item.valueName ?? item.optionValue;
        const nested = rawValue && typeof rawValue === 'object' ? rawValue as EmbeddedRecord : undefined;
        const optionValue = embeddedText(nested?.name ?? nested?.label ?? nested?.value ?? rawValue);
        if (name && optionValue) entries.push({name, value: optionValue});
      }
    } else if (raw && typeof raw === 'object') {
      for (const [name, value] of Object.entries(raw as EmbeddedRecord)) {
        const nested = value && typeof value === 'object' ? value as EmbeddedRecord : undefined;
        const optionValue = embeddedText(nested?.value ?? nested?.label ?? nested?.name ?? value);
        if (name && optionValue) entries.push({name: clean(name), value: optionValue});
      }
    }
  }
  const seen = new Set<string>();
  return entries.filter(entry => {
    const key = `${entry.name.toLowerCase()}\u0000${entry.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function embeddedVariantAxes(record: EmbeddedRecord) {
  const options = embeddedOptionEntries(record);
  const option = (pattern: RegExp) => options.find(item => pattern.test(item.name));
  const color = embeddedText(record.color ?? record.colour ?? record.colorName ?? record.colourName ?? record.shade ?? record.shadeName ?? record.tone)
    || option(/color|colour|shade|tone|couleur|farbe|tono/i)?.value
    || '';
  const band = embeddedText(record.band ?? record.bandSize) || option(/^(?:band|band size|banda)$/i)?.value || '';
  const cup = embeddedText(record.cup ?? record.cupSize) || option(/^(?:cup|cup size|copa)$/i)?.value || '';
  const sizeEntry = option(/size|dimension|talla|tamaño|talle|taille|größe|groesse|format|volume/i);
  const size = embeddedText(record.size ?? record.sizeName ?? record.dimension ?? record.format ?? record.volume)
    || (band && cup ? `${band} ${cup}` : band || cup || sizeEntry?.value || '');
  const sourceSizeLabel = embeddedText(record.sizeLabel ?? record.sizeType ?? sizeEntry?.name);
  const sizeLabel = band && cup ? 'Band / cup' : sourceSizeLabel || (size ? 'Размер' : undefined);
  return {color, size, sizeLabel};
}

function embeddedOptionLabel(record: EmbeddedRecord) {
  const direct = embeddedText(record.label ?? record.title ?? record.name ?? record.displayName);
  const optionValues = record.optionValues ?? record.options ?? record.selectedOptions;
  const values = Array.isArray(optionValues)
    ? optionValues.flatMap(value => {
      if (typeof value === 'string') return [clean(value)];
      if (value && typeof value === 'object') {
        const item = value as EmbeddedRecord;
        return [embeddedText(item.value ?? item.label ?? item.name)];
      }
      return [];
    }).filter(Boolean)
    : [];
  const namedValues = embeddedOptionEntries(record).map(item => item.value);
  return direct || [...new Set([...values, ...namedValues])].join(' · ');
}

function embeddedVariants(record: EmbeddedRecord, sourceUrl: string): ProductVariant[] {
  const raw = ['variants', 'skus', 'children', 'offers', 'items', 'sizes'].flatMap(key => Array.isArray(record[key]) ? record[key] : []);
  const variants = raw.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const item = value as EmbeddedRecord;
    // Never attach an option's amount in another currency to the parent quote.
    if (embeddedCurrency(item) && embeddedCurrency(record) && embeddedCurrency(item) !== embeddedCurrency(record)) return [];
    const axes = embeddedVariantAxes(item);
    const label = embeddedOptionLabel(item);
    const color = axes.color;
    const size = axes.size;
    const variantLabel = [color, size].filter(Boolean).join(' · ') || label;
    if (!variantLabel) return [];
    const availability = embeddedAvailability(item);
    const id = embeddedIdentifier(item.sku ?? item.skuId ?? item.variantId ?? item.id ?? item.gtin ?? item.ean) || undefined;
    const image = embeddedImages(item, sourceUrl)[0];
    return [{
      id,
      sourceUrl: safeVariantSourceUrl(item.url ?? item.productUrl ?? item.pdpUrl,sourceUrl),
      productId: embeddedIdentifier(item.productId) || undefined,
      sellerId: embeddedIdentifier(item.sellerId) || undefined,
      offerId: embeddedIdentifier(item.offerId) || undefined,
      colorId: embeddedIdentifier(item.colorId ?? item.colourId) || undefined,
      options: embeddedOptionEntries(item),
      images: embeddedImages(item,sourceUrl),
      label: variantLabel.slice(0, 120),
      color: color || undefined,
      size: size || undefined,
      sizeLabel: axes.sizeLabel,
      price: embeddedPrice(item),
      image,
      ...availability,
    } satisfies ProductVariant];
  }).slice(0, 80);
  const counts = new Map<string, number>();
  const identity=(item:ProductVariant)=>[item.id,item.productId,item.sellerId,item.offerId].join('\u0000');
  for (const item of variants) if (item.id) counts.set(identity(item), (counts.get(identity(item)) ?? 0) + 1);
  for (const item of variants) if (item.id && counts.get(identity(item))! > 1) delete item.id;
  return variants;
}

function embeddedCandidateRecords(root: unknown, sourceUrl: string) {
  const tokens = embeddedListingTokens(sourceUrl), candidates: EmbeddedRecord[] = [];
  const visited = new WeakSet<object>();
  let visitedCount = 0;
  const visit = (value: unknown, depth = 0) => {
    if (depth > 14 || visitedCount >= 4000 || !value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    visitedCount++;
    if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1); return; }
    const record = value as EmbeddedRecord;
    if (embeddedCandidateMatches(record, sourceUrl, tokens)) {
      const title = embeddedTitle(record);
      const price = embeddedPrice(record);
      const variants = embeddedVariants(record, sourceUrl);
      if (title && (price !== undefined || variants.some(item => item.price !== undefined))) candidates.push(record);
    }
    for (const child of Object.values(record)) visit(child, depth + 1);
  };
  visit(root);
  return candidates;
}

function extractPriorityEmbedded(html: string, sourceUrl: string): Extracted | undefined {
  const source = new URL(sourceUrl);
  const priorityRoots = new Set(priorityMerchantProfiles.map(profile => profile.root));
  const hostname = source.hostname.toLowerCase().replace(/^www2?\./, '');
  const ebayRoot = isEbayStoreHost(hostname) ? hostname : undefined;
  const root = priorityRoots.has(hostname)
    ? hostname
    : [...priorityRoots].filter(value => hostname.endsWith(`.${value}`)).sort((a, b) => b.length - a.length)[0] ?? ebayRoot;
  if (!root) return;
  const candidate = embeddedJson(html).flatMap(value => embeddedCandidateRecords(value, sourceUrl))[0];
  if (!candidate) return;
  const variants = embeddedVariants(candidate, sourceUrl);
  const selectedId = new URL(sourceUrl).searchParams.get('variant') ?? new URL(sourceUrl).searchParams.get('skuId');
  const selected = selectedId ? variants.find(item => item.id === selectedId) : undefined;
  const price = selected ? selected.price ?? embeddedPrice(candidate) : embeddedPrice(candidate);
  const title = embeddedTitle(candidate).slice(0, 140) || undefined;
  const rawBrand = candidate.brand;
  const brand = (typeof rawBrand === 'object' && rawBrand ? embeddedText((rawBrand as EmbeddedRecord).name ?? (rawBrand as EmbeddedRecord).label) : embeddedText(rawBrand)) || undefined;
  const currency = embeddedCurrency(candidate);
  const images = dedupeSafeImages([selected?.image, ...embeddedImages(candidate, sourceUrl)], sourceUrl);
  const image = images[0];
  const category = inferProductCategory([title, embeddedText(candidate.category), embeddedText(candidate.productType), embeddedText(candidate.description)].filter(Boolean).join(' '), brand ?? '');
  const availability = embeddedAvailability(candidate);
  const baseVariant = variants.length ? variants : title ? [{label: 'Выбранный вариант', price, image, ...availability} satisfies ProductVariant] : [];
  if (!title && price === undefined && !images.length) return;
  const weight = parseWeight(candidate.shippingWeight ?? candidate.boxedWeight ?? candidate.weight);
  const shipping = embeddedNumber(candidate.shipping ?? candidate.shippingPrice ?? candidate.deliveryPrice);
  const warnings = ['Доставка магазина не опубликована — указан изменяемый резерв $10; для заказа из магазина от $50 его не берём.'];
  if (variants.length) warnings.push('Варианты получены из публичных данных магазина.');
  if (!variants.length) warnings.push('Магазин не отдал матрицу вариантов: выберите товар вручную, если он требует размера или цвета.');
  return {
    sku: embeddedText(candidate.sku ?? candidate.productId ?? candidate.itemId ?? candidate.styleCode) || undefined,
    title,
    brand,
    category,
    declarationDescription: declarationFor(category, title ?? '', brand),
    image,
    images,
    selectedVariantColor: selected?.color,
    price,
    currency,
    variants: baseVariant,
    shipping,
    shippingCurrency: currency,
    boxedWeight: weight,
    weightKind: weight ? 'shipping' : undefined,
    country: inferStorefrontCountry(sourceUrl, currency),
    warnings,
    sourceUrl,
    method: `${root} embedded product data`,
  };
}

/** ASOS publishes the product's size map and its public stock/price snapshot
 * separately in the product page. Join them only by the exact product and
 * variant IDs; a product-level in-stock flag is not enough to enable sizes. */
export function extractAsosProduct(html: string, sourceUrl: string, fallback: Extracted): Extracted | undefined {
  const source = new URL(sourceUrl);
  if (!/(^|\.)asos\.com$/i.test(source.hostname)) return;
  const requestedId = source.pathname.match(/\/prd\/(\d+)(?:\/|$)/i)?.[1];
  if (!requestedId) return;

  const marker = 'window.asos.pdp.config.product = ';
  let offset = html.lastIndexOf(marker), product: EmbeddedRecord | undefined;
  while (offset >= 0) {
    const start = offset + marker.length;
    const end = html.indexOf(';', start);
    if (end > start && end - start <= 500_000) {
      try {
        const candidate = JSON.parse(html.slice(start, end)) as EmbeddedRecord;
        if (String(candidate.id ?? '') === requestedId) { product = candidate; break; }
      } catch {}
    }
    offset = html.lastIndexOf(marker, offset - 1);
  }
  if (!product || !Array.isArray(product.variants)) return;

  const stockMarker = 'window.asos.pdp.config.stockPriceResponse = ';
  const stockStart = html.indexOf(stockMarker);
  let stockProduct: EmbeddedRecord | undefined;
  if (stockStart >= 0) {
    const start = stockStart + stockMarker.length;
    const end = html.indexOf(';', start);
    if (end > start && end - start <= 250_000) {
      try {
        const literal = html.slice(start, end).trim();
        const json = literal.startsWith("'") && literal.endsWith("'")
          ? literal.slice(1, -1).replaceAll(String.fromCharCode(92, 34), '"')
          : '';
        const records = JSON.parse(json) as EmbeddedRecord[];
        stockProduct = Array.isArray(records) ? records.find(record => String(record.productId ?? '') === requestedId) : undefined;
      } catch {}
    }
  }

  const stockById = new Map<string, EmbeddedRecord>();
  if (Array.isArray(stockProduct?.variants)) {
    for (const item of stockProduct.variants) {
      if (item && typeof item === 'object' && item.id !== undefined) stockById.set(String(item.id), item as EmbeddedRecord);
    }
  }
  const variants = product.variants.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const item = value as EmbeddedRecord;
    const rawId = item.variantId ?? item.id;
    const id = embeddedText(typeof rawId === 'number' ? String(rawId) : rawId);
    const size = embeddedText(item.size ?? item.brandSize);
    if (!id || !size) return [];
    const stock = stockById.get(id);
    const stockSignal = typeof stock?.isInStock === 'boolean' ? stock.isInStock : undefined;
    const productSignal = typeof item.isAvailable === 'boolean' ? item.isAvailable : undefined;
    const known = stockSignal !== undefined || productSignal !== undefined;
    const available = stockSignal ?? productSignal ?? true;
    const stockPrice = stock?.price && typeof stock.price === 'object' ? stock.price as EmbeddedRecord : undefined;
    const currentPrice = stockPrice?.current && typeof stockPrice.current === 'object' ? (stockPrice.current as EmbeddedRecord).value : undefined;
    return [{
      id,
      size,
      sizeLabel: 'Размер',
      color: embeddedText(item.colour ?? item.color) || undefined,
      label: [embeddedText(item.colour ?? item.color), size].filter(Boolean).join(' · '),
      available,
      availabilityKnown: known,
      price: embeddedNumber(currentPrice),
      image: fallback.image,
    } satisfies ProductVariant];
  }).slice(0, 80);
  if (!variants.length) return;

  const current = stockProduct?.productPrice && typeof stockProduct.productPrice === 'object'
    ? (stockProduct.productPrice as EmbeddedRecord).current
    : undefined;
  const currentRecord = current && typeof current === 'object' ? current as EmbeddedRecord : undefined;
  const category = inferProductCategory([embeddedText(product.name), embeddedText((product.productType as EmbeddedRecord | undefined)?.name)].filter(Boolean).join(' '), embeddedText(product.brandName));
  const warnings = [...fallback.warnings.filter(warning => !/Цена не найдена|подтверждённый статус наличия/i.test(warning))];
  warnings.push('Размеры и цена загружены из публичных данных ASOS.');
  return {
    ...fallback,
    sku: embeddedText(product.productCode) || fallback.sku,
    title: embeddedText(product.name).slice(0, 140) || fallback.title,
    brand: embeddedText(product.brandName) || fallback.brand,
    category,
    declarationDescription: declarationFor(category, embeddedText(product.name) || fallback.title || '', embeddedText(product.brandName) || fallback.brand),
    price: embeddedNumber(currentRecord?.value) ?? fallback.price,
    currency: embeddedText((stockProduct?.productPrice as EmbeddedRecord | undefined)?.currency).toUpperCase() || fallback.currency,
    variants,
    country: inferStorefrontCountry(sourceUrl, embeddedText((stockProduct?.productPrice as EmbeddedRecord | undefined)?.currency) || fallback.currency),
    warnings,
    method: 'ASOS product and stock data',
  };
}

const clean = (s: unknown) =>
  typeof s === "string"
    ? s
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#(\d+);/g, (_, n) =>
          String.fromCodePoint(Math.min(Number(n), 0x10ffff)),
        )
        .trim()
    : "";

const number = (v: unknown) => {
  if (typeof v === "number")
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  if (typeof v !== "string") return undefined;
  let text = v.trim().replace(/[\s\u00a0]/g, '');
  if (!text || !/^\d[\d.,]*$/.test(text)) return undefined;
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (text.includes(',')) text = /^\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, '') : text.replace(',', '.');
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function safeImage(value: unknown, base: string) {
  const s =
    typeof value === "string"
      ? value
      : typeof value === "object" && value
        ? String(
            (value as Record<string, unknown>).url ??
              (value as Record<string, unknown>).contentUrl ??
              "",
          )
        : "";
  try {
    const u = new URL(s, base);
    if (
      !s ||
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      !u.hostname.includes(".") ||
      /^[\d.:\[\]]+$/.test(u.hostname) ||
      u.hostname.endsWith(".local") ||
      u.hostname === "localhost"
    )
      return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}

/** Keep one representative for rendition URLs that point to the same source photo. */
export function dedupeSafeImages(values: unknown[], base: string, limit = 12) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const safe = safeImage(value, base);
    if (!safe) continue;
    try {
      const url = new URL(safe);
      url.hash = '';
      const host = url.hostname.toLowerCase();
      const amazonImages = host === 'm.media-amazon.com' || host.endsWith('.media-amazon.com') || host === 'images-na.ssl-images-amazon.com' || host === 'images-eu.ssl-images-amazon.com';
      const ebayImages = host === 'i.ebayimg.com';
      if (amazonImages) url.pathname = url.pathname.replace(/\._(?:AC|UX|SX|SL|SY|UL|SS|SR|CR|FM)(?:_[A-Z]{2}\d{2,4}(?:,\d{2,4})?)+(?:_[A-Z]{2}\d{1,3})*_?(?=\.[^./]+$)/i, '');
      if (ebayImages) url.pathname = url.pathname.replace(/\/s-l\d{2,4}(?=\.(?:jpe?g|png|webp)$)/i, '/s-lSIZE');
      // Most storefronts expose the same source photo through several CDN
      // sizes. These parameters only affect rendition, not the selected
      // product/color; remove them across hosts while preserving identity
      // parameters such as `variant`, `color` and version/cache keys.
      const renditionParams = new Set(['w', 'h', 'width', 'height', 'wid', 'hei', 'sw', 'sh', 'qlt', 'quality', 'fmt', 'format', 'fit', 'crop', 'resize', 'auto', 'sm']);
      for (const key of [...url.searchParams.keys()]) {
        if (/^(?:utm_.+|gclid|fbclid|dclid|msclkid|igshid)$/i.test(key) || renditionParams.has(key.toLowerCase())) url.searchParams.delete(key);
      }
      // Shopify encodes image size in the filename (`photo_300x.jpg`,
      // `photo_1200x1200.jpg`). Keep the original first URL for display, but
      // compare those variants by their shared source filename.
      if (host === 'cdn.shopify.com') {
        url.pathname = url.pathname.replace(/_(?:\d{1,5}x\d{0,5}|x\d{1,5})(?=\.[^./]+$)/i, '');
      }
      url.searchParams.sort();
      const key = url.href;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(safe);
      if (result.length >= limit) break;
    } catch {
      // safeImage already validated the URL; malformed values are ignored defensively.
    }
  }
  return result;
}

export function parseWeight(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const q = value as Record<string, unknown>;
  const n = number(q.value);
  if (n === undefined || n <= 0) return undefined;
  const unit = String(q.unitCode ?? q.unitText ?? "").toLowerCase();
  const factor = (
    {
      kg: 1,
      kilogram: 1,
      kilograms: 1,
      kgm: 1,
      g: 0.001,
      gram: 0.001,
      grams: 0.001,
      grm: 0.001,
      lb: 0.45359237,
      lbs: 0.45359237,
      lbr: 0.45359237,
      oz: 0.0283495231,
      onz: 0.0283495231,
    } as Record<string, number>
  )[unit];
  if (!factor) return undefined;
  const kilograms = Math.ceil(n * factor * 1000) / 1000;
  return kilograms > 0 && kilograms <= 49.5 ? kilograms : undefined;
}

const regionNames: Record<string, string> = {
  US: "США",
  ES: "Испания",
  DE: "Германия",
  GB: "Великобритания",
  FR: "Франция",
  IT: "Италия",
  RO: "Румыния",
  CN: "Китай",
  TR: "Турция",
  JP: "Япония",
  KR: "Южная Корея",
  AE: "ОАЭ",
  CA: "Канада",
  AU: "Австралия",
};

export function inferProductCategory(
  title: string,
  brand = "",
): ProductCategory {
  const text = (title + " " + brand).toLowerCase();
  if (
    /sneaker|shoe|boot|sandal|trainer|кроссов|обув|туфл|ботин|zapato|zapatilla/.test(
      text,
    )
  )
    return "Обувь";
  if (
    /phone|headphone|earbuds|laptop|tablet|camera|console|monitor|charger|adapter|power bank|keyboard|mouse|cable|hub|airtag|smart\s*tag|bluetooth\s*tracker|item\s*tracker|телефон|наушник|ноутбук|планшет|камера|приставк|заряд|адаптер|клавиатур|мышь|трекер|метк/.test(
      text,
    )
  )
    return "Электроника";
  if (
    /beauty|lipstick|lip gloss|lip oil|lip balm|blush|concealer|foundation|mascara|serum|cream|cleanser|moisturizer|perfume|makeup|skincare|крем|сыворот|духи|помад|космет|румян|тушь|бальзам/.test(
      text,
    )
  )
    return "Красота и уход";
  if (
    /bag|backpack|wallet|belt|watch|jewelry|рюкзак|сумк|кошел|ремень|час|украшен/.test(
      text,
    )
  )
    return "Аксессуары";
  if (
    /tent|dumbbell|yoga|running|football|ski|sport|палатк|гантел|йог|бег|спорт|лыж/.test(
      text,
    )
  )
    return "Спорт";
  if (
    /chair|table|lamp|kitchen|bedding|furniture|стул|стол|ламп|кухн|постель|мебел/.test(
      text,
    )
  )
    return "Дом и быт";
  if (
    /clothing|apparel|jersey|shirt|dress|jacket|coat|jeans|pants|hoodie|t-shirt|skirt|legging|bra|bralette|underwear|shorts|sweater|cardigan|blazer|jumpsuit|tracksuit|футбол|куртк|пальто|джинс|брюк|плать|юбк|легинс|белье|vestido|sujetador|lencer[ií]a|ropa\s+interior|bragas|bañador|pijama/.test(
      text,
    )
  )
    return "Одежда";
  return "Другое";
}

export function declarationFor(
  category: ProductCategory,
  title: string,
  brand = "",
) {
  const item = {
    Обувь: "Обувь для личного пользования",
    Одежда: "Одежда для личного пользования",
    Электроника: "Электронное устройство для личного пользования",
    Аксессуары: "Аксессуар для личного пользования",
    "Красота и уход": "Косметика или средства ухода для личного пользования",
    "Дом и быт": "Товар для дома и личного пользования",
    Спорт: "Спортивный товар для личного пользования",
    Другое: "Товар для личного пользования",
  }[category];
  const cleanTitle = clean(title).slice(0, 100);
  return `${brand ? clean(brand) + " — " : ""}${cleanTitle || item}. ${item}.`;
}

function assignedJson(html: string, name: string) {
  const marker = `window.zara.${name}`;
  const markerAt = html.indexOf(marker);
  if (markerAt < 0) return undefined;
  const start = html.indexOf("{", markerAt + marker.length);
  if (start < 0) return undefined;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1)) as Record<string, unknown>;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

type ZaraSize = { id?: number|string; sku?: string; name?: string; availability?: string; price?: number };
type ZaraMedia = {
  url?: string;
  extraInfo?: { deliveryUrl?: string };
};
type ZaraColor = {
  name?: string;
  productId?: number;
  price?: number;
  sizes?: ZaraSize[];
  xmedia?: ZaraMedia[];
};

function extractAnker(html: string, sourceUrl: string): Extracted | undefined {
  const source = new URL(sourceUrl);
  if (!/(^|\.)anker\.com$/i.test(source.hostname)) return;
  const match = html.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return;
  try {
    const root = JSON.parse(match[1]) as {props?:{pageProps?:{product?:Record<string, unknown>}}};
    const product = root.props?.pageProps?.product;
    const handle = clean(product?.handle);
    if (!product || !handle || !source.pathname.toLowerCase().includes(`/products/${handle.toLowerCase()}`) || !Array.isArray(product.variants)) return;
    const variants: ProductVariant[] = product.variants.slice(0, 250).map(raw => {
      const value = raw as Record<string, unknown>, name = clean(value.name), parts = name.split(/\s*\|\s*/, 2);
      const image = value.image as Record<string, unknown> | undefined;
      return {
        id: clean(value.id).match(/(\d+)$/)?.[1],
        color: parts[0] || undefined,
        size: parts[1] || undefined,
        label: name || 'Стандартный',
        available: value.availableForSale === true && value.currentlyNotInStock !== true && value.quantityAvailable !== 0,
        availabilityKnown: typeof value.availableForSale === 'boolean' || value.quantityAvailable !== undefined || value.currentlyNotInStock !== undefined,
        price: number(value.price),
        image: safeImage(image?.url, sourceUrl),
      };
    }).filter(variant => variant.label);
    const selectedId = source.searchParams.get('variant');
    const selected = selectedId ? variants.find(variant => variant.id === selectedId) : undefined;
    const prices = [...new Set(variants.map(variant => variant.price).filter(value => value !== undefined))];
    const images = [...new Set([selected?.image, ...[product.images].flat().map(value => safeImage((value as Record<string, unknown>)?.url ?? value, sourceUrl))].filter((value): value is string => Boolean(value)))].slice(0, 12);
    const title = clean(product.title ?? product.name).slice(0, 140), brand = clean(product.vendor) || 'Anker';
    const warnings = ['Доставка магазина не опубликована — указан изменяемый резерв $10; для заказа из магазина от $50 его не берём.', 'Вес с упаковкой нужно проверить.'];
    if (!selected && prices.length !== 1) warnings.push('Выберите вариант, чтобы получить его точную цену.');
    return {title,brand,category:'Электроника',declarationDescription:declarationFor('Электроника',title,brand),image:selected?.image??images[0],images,price:selected?.price??(prices.length===1?prices[0]:undefined),currency:'USD',variants,warnings,sourceUrl,method:'Anker product data',country:'США'};
  } catch { return; }
}

function extractAmazon(html: string, sourceUrl: string): Extracted | undefined {
  const source = new URL(sourceUrl);
  if (!/(^|\.)amazon\.com$/i.test(source.hostname)) return;
  const title = clean(html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\//i)?.[1] ?? html.match(/<meta\s+name=["']title["'][^>]*content=["']([^"']+)/i)?.[1]).slice(0, 140) || undefined;
  const coreStart = html.search(/id=["']corePrice_feature_div["']/i);
  const core = coreStart >= 0 ? html.slice(coreStart, coreStart + 20_000) : html;
  const priceMatch = core.match(/<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*([$€£])?\s*([\d][\d,\.\s]*)/i);
  const price = priceMatch ? number(priceMatch[2]) : undefined;
  const currency = priceMatch?.[1] === '€' ? 'EUR' : priceMatch?.[1] === '£' ? 'GBP' : price !== undefined ? 'USD' : undefined;
  const imageTag = html.match(/<img[^>]+id=["']landingImage["'][^>]*>/i)?.[0] ?? '';
  const imageAttr = (name: string) => imageTag.match(new RegExp(`${name}=["']([^"']+)`, 'i'))?.[1]
    ?.replace(/&quot;/g, '"').replace(/&#x3D;|&#61;/g, '=').replace(/&amp;/g, '&');
  const dynamic = imageAttr('data-a-dynamic-image');
  const dynamicImages = dynamic ? (() => { try { return Object.keys(JSON.parse(dynamic)); } catch { return []; } })() : [];
  const images = [...new Set([imageAttr('data-old-hires'), imageAttr('src'), ...dynamicImages]
    .map(value => safeImage(value, sourceUrl)).filter((value): value is string => Boolean(value)))].slice(0, 12);
  if (!title && price === undefined && !images.length) return;
  const byline = clean(html.match(/id=["']bylineInfo["'][^>]*>([\s\S]*?)<\//i)?.[1]);
  const brand = (byline.match(/(?:Visit|Shop)\s+the\s+(.+?)\s+Store/i)?.[1] ?? byline).slice(0, 80) || 'Amazon';
  const category = inferProductCategory(title ?? '', brand);
  const unavailable = /id=["']availability["'][\s\S]{0,1200}(?:out of stock|currently unavailable|unavailable)/i.test(html);
  const availabilityBlock = /id=["']availability["']/i.test(html);
  const variants: ProductVariant[] = title ? [{label: 'Выбранный вариант', available: !unavailable, availabilityKnown: availabilityBlock, price, image: images[0]}] : [];
  const warnings: string[] = ['Доставка магазина не опубликована — указан изменяемый резерв $10; для заказа из магазина от $50 его не берём.'];
  if (price === undefined) warnings.unshift('Цена не найдена в американском блоке Amazon: укажите её со страницы выбранного варианта.');
  if (unavailable) warnings.push('Amazon сообщает, что выбранный товар недоступен.');
  return {
    title,
    brand,
    category,
    declarationDescription: declarationFor(category, title ?? '', brand),
    image: images[0],
    images,
    price,
    currency,
    variants,
    warnings,
    sourceUrl,
    method: 'Amazon product data',
    country: 'США',
  };
}

/**
 * Nike product pages publish a bounded `__NEXT_DATA__` payload containing the
 * exact style code, gallery, price and size/SKU matrix. JSON-LD often omits
 * offer availability, so prefer this merchant-owned payload when it matches
 * the URL article code. No cookies or private Nike APIs are required.
 */
function extractNike(html: string, sourceUrl: string): Extracted | undefined {
  const source = new URL(sourceUrl);
  if (!/(^|\.)nike\.com$/i.test(source.hostname)) return;
  const match = html.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return;
  try {
    const root = JSON.parse(match[1]) as {props?: {pageProps?: Record<string, unknown>}};
    const page = root.props?.pageProps;
    const article = source.pathname.split('/').filter(Boolean).at(-1)?.replace(/\.html$/i, '').toUpperCase();
    const nikeImages = (candidate: Record<string, unknown>) => {
      const values = Array.isArray(candidate.contentImages) ? candidate.contentImages.map(value => {
        if (!value || typeof value !== 'object') return undefined;
        const properties = (value as Record<string, unknown>).properties;
        if (!properties || typeof properties !== 'object') return undefined;
        const record = properties as Record<string, unknown>;
        // Nike publishes several renditions for each gallery slot. Keep one
        // square image per slot rather than filling the carousel with repeats.
        return record.squarish ?? record.portrait;
      }) : [];
      return [...new Set(values.map(value => {
        if (!value || typeof value !== 'object') return undefined;
        return safeImage((value as Record<string, unknown>).url, sourceUrl);
      }).filter((value): value is string => Boolean(value)))].slice(0, 12);
    };
    const selected = page?.selectedProduct && typeof page.selectedProduct === 'object'
      ? page.selectedProduct as Record<string, unknown>
      : undefined;
    const groups = Array.isArray(page?.productGroups) ? page.productGroups : [];
    const groupedProducts = groups.map(group => {
      if (!group || typeof group !== 'object') return [];
      const values = (group as Record<string, unknown>).products;
      return values && typeof values === 'object' && !Array.isArray(values)
        ? Object.values(values as Record<string, unknown>).filter((value): value is Record<string, unknown> => Boolean(value && typeof value === 'object'))
        : [];
    });
    const products = groupedProducts.flat();
    const matchesArticle = (value: Record<string, unknown>) => {
      if (!article) return true;
      const styleCode = String(value.styleCode ?? '').trim().toUpperCase();
      const merchProductId = String(value.merchProductId ?? '').trim().toUpperCase();
      const rawPdpUrl = value.pdpUrl;
      const pdpCandidates = typeof rawPdpUrl === 'string'
        ? [rawPdpUrl]
        : rawPdpUrl && typeof rawPdpUrl === 'object'
          ? [
            (rawPdpUrl as Record<string, unknown>).url,
            (rawPdpUrl as Record<string, unknown>).path,
          ].filter((candidate): candidate is string => typeof candidate === 'string')
          : [];
      const pdpMatches = pdpCandidates.some(candidate => {
        try {
          const url = /^https:\/\//i.test(candidate)
            ? new URL(candidate)
            : candidate.startsWith('/') && !candidate.startsWith('//')
              ? new URL(candidate, source.origin)
              : undefined;
          if (!url || url.protocol !== 'https:' || url.username || url.password || url.port || !/(^|\.)nike\.com$/i.test(url.hostname)) return false;
          const pdpArticle = url.pathname.split('/').filter(Boolean).at(-1)?.replace(/\.html$/i, '').toUpperCase();
          return pdpArticle === article;
        } catch {
          return false;
        }
      });
      return styleCode === article || merchProductId === article || pdpMatches;
    };
    const product = selected && matchesArticle(selected)
      ? selected
      : products.find(matchesArticle);
    if (!product) return;
    const info = product.productInfo && typeof product.productInfo === 'object' ? product.productInfo as Record<string, unknown> : {};
    const title = clean(info.fullTitle ?? info.title ?? product.displayStyle ?? product.styleCode).slice(0, 140) || undefined;
    const brands = Array.isArray(product.brands) ? product.brands.map(clean).filter(Boolean) : [];
    const brand = brands[0] || 'Nike';
    const priceData = product.prices && typeof product.prices === 'object' ? product.prices as Record<string, unknown> : {};
    const price = number(priceData.currentPrice ?? priceData.price ?? priceData.initialPrice);
    const currency = clean(priceData.currency ?? (page?.locale && typeof page.locale === 'object' ? (page.locale as Record<string, unknown>).currency : undefined)).toUpperCase() || undefined;
    const category = inferProductCategory([title, clean(product.productType), ...(Array.isArray(product.taxonomyLabels) ? product.taxonomyLabels.map(clean) : [])].filter(Boolean).join(' '), brand);
    const images = nikeImages(product);
    const matchedGroup = article ? groupedProducts.find(items => items.some(matchesArticle)) : undefined;
    // Nike stores colorways as sibling products inside the matching product
    // group. Never borrow variants from another group (for example, recommendations).
    const colorways = (matchedGroup?.length
      ? [product, ...matchedGroup.filter(candidate => !matchesArticle(candidate))]
      : [product]).slice(0, 20);
    const imagesByColorway = new Map(colorways.map(colorway => [colorway, nikeImages(colorway)]));
    const galleriesByColor = new Map<string, string[]>();
    for (const colorway of colorways) {
      const color = clean(colorway.colorDescription ?? colorway.styleColor);
      const gallery = imagesByColorway.get(colorway) ?? [];
      if (!color || !gallery.length) continue;
      galleriesByColor.set(color, [...new Set([...(galleriesByColor.get(color) ?? []), ...gallery])].slice(0, 12));
    }
    const colorwayImages = [...galleriesByColor].map(([color, gallery]) => ({color, images: gallery}));
    const nikeUsSizeSystem = inferNikeFootwearSizeSystem({sourceUrl,currency,category,title});
    const sizeLabel = nikeUsSizeSystem ? `Nike US ${nikeUsSizeSystem}` : 'Размер';
    const variants: ProductVariant[] = colorways.flatMap(colorway => {
      const variantColor = clean(colorway.colorDescription ?? colorway.styleColor) || undefined;
      const variantPriceData = colorway.prices && typeof colorway.prices === 'object' ? colorway.prices as Record<string, unknown> : {};
      const selectedStyle = matchesArticle(colorway);
      const variantPrice = number(variantPriceData.currentPrice ?? variantPriceData.price ?? variantPriceData.initialPrice) ?? (selectedStyle ? price : undefined);
      const variantImages = imagesByColorway.get(colorway) ?? [];
      const variantImage = variantImages[0] ?? (selectedStyle ? images[0] : undefined);
      const rawSizes = Array.isArray(colorway.sizes) ? colorway.sizes.slice(0, 80) : [];
      return rawSizes.flatMap((raw): ProductVariant[] => {
        const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        const label = clean(value.label ?? value.localizedLabel);
        const gtins = Array.isArray(value.gtins) ? value.gtins : [];
        const id = clean(gtins[0] && typeof gtins[0] === 'object' ? (gtins[0] as Record<string, unknown>).gtin : value.merchSkuId) || undefined;
        const status = clean(value.status).toUpperCase();
        if (!label) return [];
        return [{
          ...(id ? {id} : {}),
          sourceUrl: safeVariantSourceUrl(typeof colorway.pdpUrl==='string'?colorway.pdpUrl:embeddedObject(colorway.pdpUrl).url??embeddedObject(colorway.pdpUrl).path,sourceUrl),
          productId: clean(colorway.merchProductId ?? colorway.styleCode)||undefined,
          colorId: clean(colorway.styleCode)||undefined,
          options: [{name:'Color',value:variantColor??''},{name:sizeLabel,value:label}].filter(o=>o.value),
          images: variantImages,
          size: label,
          sizeLabel,
          ...(variantColor ? {color: variantColor} : {}),
          label: [variantColor, label].filter(Boolean).join(' · '),
          available: status === 'ACTIVE' || status === 'BUYABLE_BUY',
          availabilityKnown: Boolean(status),
          ...(variantPrice !== undefined ? {price: variantPrice} : {}),
          ...(variantImage ? {image: variantImage} : {}),
        }];
      });
    });
    const seenOptions = new Set<string>();
    const boundedVariants = variants.filter(value => {
      const key = `${value.id ?? ''}\u0000${value.color ?? ''}\u0000${value.size ?? ''}`;
      if (seenOptions.has(key)) return false;
      seenOptions.add(key);
      return true;
    }).slice(0, 80);
    if (!boundedVariants.length) return;
    const warnings = ['Доставка магазина не опубликована — указан изменяемый резерв $10; для заказа из магазина от $50 его не берём.', 'Вес с упаковкой нужно проверить.'];
    if (price === undefined) warnings.unshift('Цена не найдена в данных Nike: выберите конкретный вариант на странице магазина.');
    if (!boundedVariants.some(value => value.available)) warnings.push('Nike не указал доступный размер в текущем снимке.');
    return {title, brand, category, declarationDescription: declarationFor(category, title ?? '', brand), image: images[0], images, colorwayImages, selectedVariantColor: clean(product.colorDescription ?? product.styleColor) || undefined, price, currency, variants: boundedVariants, country: inferStorefrontCountry(sourceUrl, currency), warnings, sourceUrl, variantScope: matchedGroup?.length ? 'group' : 'color', variantsComplete: false, method: 'Nike product data', sku: clean(product.styleCode) || undefined};
  } catch {
    return;
  }
}

type AdidasApiRecord = Record<string, unknown>;

function extractAdidasImage(value: unknown, sourceUrl: string) {
  if (typeof value === 'string') return safeImage(value, sourceUrl);
  if (!value || typeof value !== 'object') return undefined;
  const record = value as AdidasApiRecord;
  return safeImage(record.src ?? record.url ?? record.contentUrl, sourceUrl);
}

/**
 * Adidas serves an Akamai challenge for server-side HTML requests, while its
 * public product/search JSON still contains the merchant price, gallery and
 * currently available size list. Keep this parser separate from JSON-LD so a
 * challenge page can never be presented as a successful import.
 */
export function extractAdidasProduct(productValue: unknown, listingValue: unknown, sourceUrl: string): Extracted | undefined {
  if (!productValue || typeof productValue !== 'object') return;
  const product = productValue as AdidasApiRecord;
  const listing = listingValue && typeof listingValue === 'object' ? listingValue as AdidasApiRecord : undefined;
  const raw = listing?.raw as AdidasApiRecord | undefined;
  const itemList = raw?.itemList as AdidasApiRecord | undefined;
  const items = Array.isArray(itemList?.items) ? itemList.items.filter((value): value is AdidasApiRecord => Boolean(value && typeof value === 'object')) : [];
  const id = clean(product.id ?? product.productId);
  const article = new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1)?.replace(/\.html$/i, '');
  if (!article || !id || id.toUpperCase() !== article.toUpperCase()) return;
  const item = items.find(value => clean(value.productId ?? value.id) === id);
  if (!id && !item) return;
  const selected = item ?? product;
  const title = clean(product.name ?? selected.displayName ?? selected.altText).slice(0, 140) || undefined;
  const color = clean(product.color ?? selected.color) || undefined;
  const brand = 'adidas';
  const category = inferProductCategory([title, clean(product.category ?? selected.category), clean(selected.subTitle)].filter(Boolean).join(' '), brand);
  const imageValues = [product.image, product.pdpImage, product.secondImage, ...(Array.isArray(product.images) ? product.images : []), selected.image, selected.secondImage, ...(Array.isArray(selected.images) ? selected.images : [])];
  const images = [...new Set(imageValues.map(value => extractAdidasImage(value, sourceUrl)).filter((value): value is string => Boolean(value)))].slice(0, 12);
  const price = number(selected.salePrice ?? product.salePrice ?? selected.price ?? product.price);
  const locale = new URL(sourceUrl).pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? '';
  const currency = ({us: 'USD', ca: 'CAD', gb: 'GBP', uk: 'GBP', de: 'EUR', es: 'EUR', fr: 'EUR', it: 'EUR', nl: 'EUR', pl: 'PLN', se: 'SEK', dk: 'DKK', no: 'NOK', tr: 'TRY', au: 'AUD', jp: 'JPY', ae: 'AED', qa: 'QAR', bh: 'BHD', om: 'OMR'} as Record<string, string>)[locale];
  const availableSizes = [...new Set((Array.isArray(selected.availableSizes) ? selected.availableSizes : []).map(clean).filter(size => size && size.toLowerCase() !== 'hidden'))];
  const available = selected.orderable !== 0 && product.orderable !== 0;
  const availabilityKnown = Array.isArray(selected.availableSizes) || typeof selected.orderable === 'number' || typeof product.orderable === 'number';
  const variants: ProductVariant[] = availableSizes.map(size => ({
    size,
    sizeLabel: 'Размер',
    color,
    label: [color, size].filter(Boolean).join(' · '),
    available,
    availabilityKnown,
    price,
    image: images[0],
  }));
  if (!variants.length) variants.push({label: color ?? 'Выбранный вариант', color, available, availabilityKnown, price, image: images[0]});
  const warnings = ['Доставка магазина не опубликована — указан изменяемый резерв $10; для заказа из магазина от $50 его не берём.', 'Вес с упаковкой нужно проверить.'];
  if (!availableSizes.length) warnings.push('Adidas не отдал список размеров. Проверьте вариант на странице магазина.');
  if (price === undefined) warnings.unshift('Цена не найдена в данных Adidas: укажите её со страницы выбранного варианта.');
  if (!available) warnings.push('Adidas сообщает, что товар сейчас недоступен.');
  const country = inferStorefrontCountry(sourceUrl, currency);
  return {
    title,
    brand,
    category,
    declarationDescription: declarationFor(category, title ?? '', brand),
    image: images[0],
    images,
    price,
    currency,
    variants,
    country,
    warnings,
    sourceUrl,
    sku: id, variantScope: 'color', variantsComplete: false,
    method: 'Adidas product data',
  };
}

export function inferStorefrontCountry(sourceUrl: string, currency?: string) {
  const url = new URL(sourceUrl);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.toLowerCase();
  const locale = path.match(/^\/(?:[a-z]{2}[-_])?(us|es|de|gb|uk|fr|it|ro|cn|tr|jp|kr|ae|ca|au)(?:[-_/]|$)/)?.[1];
  const byCode: Record<string, string> = {
    us: "США", es: "Испания", de: "Германия", gb: "Великобритания", uk: "Великобритания",
    fr: "Франция", it: "Италия", ro: "Румыния", cn: "Китай", tr: "Турция",
    jp: "Япония", kr: "Южная Корея", ae: "ОАЭ", ca: "Канада", au: "Австралия",
  };
  if (locale) return byCode[locale];
  const suffix = Object.entries({
    ".co.uk": "Великобритания", ".com.au": "Австралия", ".co.jp": "Япония",
    ".es": "Испания", ".de": "Германия", ".fr": "Франция", ".it": "Италия",
    ".ro": "Румыния", ".cn": "Китай", ".com.tr": "Турция", ".kr": "Южная Корея",
    ".ae": "ОАЭ", ".ca": "Канада",
  }).find(([ending]) => host.endsWith(ending));
  if (suffix) return suffix[1];
  const usStores = new Set([
    "apple.com", "amazon.com", "ebay.com", "nike.com", "adidas.com", "bestbuy.com",
    "walmart.com", "target.com", "nordstrom.com", "nordstromrack.com", "macys.com",
    "sephora.com", "ulta.com", "bhphotovideo.com", "adorama.com", "newegg.com",
    "kith.com", "footlocker.com", "zappos.com", "allbirds.com", "satechi.com",
    "victoriassecret.com", "newbalance.com",
    "usa.tommy.com", "us.puma.com", "gap.com", "converse.com", "vans.com", "skechers.com",
    "crocs.com", "columbia.com", "underarmour.com", "ralphlauren.com", "carters.com", "shop.simon.com",
  ]);
  if (usStores.has(host)) return "США";
  if (currency === "RON") return "Румыния";
  return undefined;
}

/** Display-only size-region hint inferred from a known storefront locale. */
export function inferSizeRegion(sourceUrl: string, currency?: string): 'US' | 'UK' | 'EU' | undefined {
  let country: string | undefined;
  try {
    country = inferStorefrontCountry(sourceUrl, currency);
  } catch {
    return undefined;
  }
  if (country === 'США') return 'US';
  if (country === 'Великобритания') return 'UK';
  if (['Испания', 'Германия', 'Франция', 'Италия', 'Румыния'].includes(country ?? '')) return 'EU';
  return undefined;
}

export function isConfirmedUnavailableVariant(variant: Pick<ProductVariant, 'available' | 'availabilityKnown'>): boolean {
  return variant.availabilityKnown === true && !variant.available;
}

function extractZara(html: string, sourceUrl: string) {
  if (!/(^|\.)zara\.com$/i.test(new URL(sourceUrl).hostname)) return undefined;
  const config = assignedJson(html, "appConfig");
  const payload = assignedJson(html, "viewPayload");
  if (!config || !payload) return undefined;
  const product = payload.product as
    | { name?: string; detail?: { colors?: ZaraColor[] } }
    | undefined;
  const colors = product?.detail?.colors;
  if (!colors?.length) return undefined;
  const source = new URL(sourceUrl), selectedId = Number(source.searchParams.get("v1"));
  const linkedColor = colors.find((c) => c.productId === selectedId);
  const missingSelectedColor = source.searchParams.has('v1') && (!linkedColor || source.searchParams.getAll('v1').length !== 1);
  const selected: ZaraColor = missingSelectedColor ? {} : linkedColor ?? colors[0];
  const formatter = config.formatterConfig as
    | { currency?: string; currencyDecimals?: number }
    | undefined;
  const currency = clean(formatter?.currency).toUpperCase() || undefined;
  const decimals = formatter?.currencyDecimals ?? -2;
  const divisor = decimals < 0 ? 10 ** -decimals : 1;
  const rawPrice = selected.price ?? selected.sizes?.find((s) => s.price)?.price;
  const price = rawPrice === undefined ? undefined : rawPrice / divisor;
  const variants = missingSelectedColor ? [] : colors.flatMap((color) => {
    const colorMedia = color.xmedia?.find((m) =>
      Boolean(m.extraInfo?.deliveryUrl ?? m.url),
    );
    const colorImage = safeImage(
      colorMedia?.extraInfo?.deliveryUrl ??
        colorMedia?.url?.replace("{width}", "1024"),
      sourceUrl,
    );
      return (color.sizes?.length ? color.sizes : [{ name: "Стандартный" }]).map(
      (size) => ({
        id: size.sku ?? (size.id===undefined?undefined:String(size.id)),
        productId: color.productId===undefined?undefined:String(color.productId),
        colorId: color.productId===undefined?undefined:String(color.productId),
        options: [{name:'Color',value:clean(color.name)},{name:'Size',value:clean(size.name)}].filter(o=>o.value),
        images: (color.xmedia??[]).map(media=>safeImage(media.extraInfo?.deliveryUrl??media.url?.replace('{width}','1024'),sourceUrl)).filter((v):v is string=>Boolean(v)).slice(0,12),
        size: clean(size.name) || undefined,
        color: clean(color.name) || undefined,
        label: [clean(color.name), clean(size.name)].filter(Boolean).join(" · "),
        available: /^(?:in_stock|low_on_stock)$/i.test(size.availability ?? ""),
        availabilityKnown: /^(?:in_stock|low_on_stock|out_of_stock|coming_soon)$/i.test(size.availability ?? ''),
        price: size.price === undefined ? undefined : size.price / divisor,
        image: colorImage,
      }),
    );
  });
  const media = selected.xmedia?.find((m) =>
    Boolean(m.extraInfo?.deliveryUrl ?? m.url),
  );
  const rawImage =
    media?.extraInfo?.deliveryUrl ?? media?.url?.replace("{width}", "1024");
  const countryCode = clean(config.storeCountryCode).toUpperCase();
  return {
    title: clean(product?.name).slice(0, 140) || undefined,
    missingSelectedColor,
    brand: "Zara",
    image: safeImage(rawImage, sourceUrl),
    images: (selected.xmedia ?? []).map(media => safeImage(media.extraInfo?.deliveryUrl ?? media.url?.replace('{width}', '1024'), sourceUrl)).filter((value): value is string => Boolean(value)).slice(0, 12),
    price,
    currency,
    variants: variants.filter((v) => v.label).slice(0, 80),
    colorwayImages: colors.map(color=>({color:clean(color.name),colorId:color.productId===undefined?undefined:String(color.productId),images:(color.xmedia??[]).map(media=>safeImage(media.extraInfo?.deliveryUrl??media.url?.replace('{width}','1024'),sourceUrl)).filter((v):v is string=>Boolean(v)).slice(0,12)})).filter(gallery=>gallery.color&&gallery.images.length),
    selectedVariantColor: clean(selected.name) || undefined,
    country: regionNames[countryCode],
  };
}

export function extractProduct(html: string, sourceUrl: string): Extracted {
  const shopify = extractShopifyHtml(html, sourceUrl);
  if (shopify) return shopify;
  const zalando = extractZalandoProduct(html, sourceUrl);
  if (zalando) return zalando;
  const macys = extractMacysProduct(html, sourceUrl, { safeImage, inferCategory: inferProductCategory, declarationFor });
  if (macys) return macys;
  const charlotteTilbury = extractCharlotteTilburyProduct(html, sourceUrl, { safeImage, declarationFor });
  if (charlotteTilbury) return charlotteTilbury;
  const mango = extractMangoProduct(html, sourceUrl, { safeImage, inferCategory: inferProductCategory, declarationFor });
  if (mango) return mango;
  const gapInc = extractGapIncProduct(html, sourceUrl, { safeImage, inferCategory: inferProductCategory, declarationFor });
  if (gapInc) return gapInc;
  const ulta = extractUltaProduct(html, sourceUrl, { safeImage, inferCategory: inferProductCategory, declarationFor });
  if (ulta) return ulta;
  const anker = extractAnker(html, sourceUrl);
  if (anker) return anker;
  const amazon = extractAmazon(html, sourceUrl);
  if (amazon) return amazon;
  const nike = extractNike(html, sourceUrl);
  if (nike) return nike;
  const priorityEmbedded = extractPriorityEmbedded(html, sourceUrl);
  if (priorityEmbedded) return priorityEmbedded;
  const meta: Record<string, string> = {};
  const metaImages: string[] = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const a: Record<string, string> = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
      a[m[1].toLowerCase()] = clean(m[2] ?? m[3]);
    const key = a.property ?? a.name ?? a.itemprop;
    if (key && a.content) {
      meta[key.toLowerCase()] = a.content;
      if (/^(og:image(?::secure_url)?|twitter:image)$/i.test(key) && metaImages.length < 32) metaImages.push(a.content);
    }
  }

  // JSON-LD has no fixed shape; traversal is bounded by depth and node count.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodes: Record<string, any>[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (x: any, depth = 0) => {
    if (depth > 15 || nodes.length > 4000 || !x || typeof x !== "object") return;
    if (Array.isArray(x)) for (const y of x) walk(y, depth + 1);
    else {
      nodes.push(x);
      for (const y of Object.values(x)) walk(y, depth + 1);
    }
  };
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      walk(JSON.parse(match[1]));
    } catch {}
  }

  const sameListing = (value: unknown) => {
    if (sameNorthFaceArticle(value, sourceUrl)) return true;
    if (typeof value !== 'string') return false;
    try {
      const candidate = new URL(value, sourceUrl), source = new URL(sourceUrl);
      if (candidate.protocol !== 'https:' || candidate.username || candidate.password || candidate.port) return false;
      for (const u of [candidate, source]) {
        u.hostname = u.hostname.replace(/^www\./, '');
        u.pathname = u.pathname.replace(/\/$/, '') || '/';
        for (const key of [...u.searchParams.keys()]) if (/^(utm_.+|gclid|fbclid|variant)$/i.test(key)) u.searchParams.delete(key);
        u.searchParams.sort();
      }
      return candidate.origin === source.origin && candidate.pathname === source.pathname && candidate.search === source.search;
    } catch { return false; }
  };
  // Sephora US and Spain put product JSON-LD in a script without the usual
  // type attribute. Accept only these exact storefront hosts and the exact
  // listing URL; recommendations must never supply another item's price.
  const sourceHost = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, '');
  if (sourceHost === 'sephora.com' || sourceHost === 'sephora.es') {
    for (const match of html.matchAll(/<script\b(?=[^>]*\bid\s*=\s*["']linkJSON["'])[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const parsed = JSON.parse(match[1]);
        const candidates = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [parsed];
        for (const candidate of candidates) {
          if (!candidate || typeof candidate !== 'object' || ![candidate['@type']].flat().some((type: unknown) => type === 'Product' || type === 'ProductGroup')) continue;
          const offerUrls = [candidate.offers].flat().map((offer: unknown) => offer && typeof offer === 'object' ? (offer as Record<string, unknown>).url : undefined);
          if ([candidate.url, candidate['@id'], ...offerUrls].some(sameListing)) walk(candidate);
        }
      } catch { /* Keep editable Open Graph fallback. */ }
    }
  }
  const productNodes = nodes.filter(n => [n['@type']].flat().some(t => t === 'Product' || t === 'ProductGroup'));
  const offerUrls = (node: Record<string, unknown>) => [node.offers].flat().map(offer =>
    offer && typeof offer === 'object' ? (offer as Record<string, unknown>).url : undefined);
  const matchesNode = (node: Record<string, unknown>) =>
    sameListing(node.url) || sameListing(node['@id']) || offerUrls(node).some(sameListing);
  const hasListingUrl = (node: Record<string, unknown>) => Boolean(node.url || node['@id'] || offerUrls(node).some(Boolean));
  // Recommendation products can precede the actual product in JSON-LD. Keep a
  // matched parent group so its full option matrix survives the selection.
  const groupNode = productNodes.find(n => Array.isArray(n.hasVariant) && n.hasVariant.length > 0 && (matchesNode(n) || n.hasVariant.some((child: Record<string, unknown>) => child && matchesNode(child))))
    ?? productNodes.find(n => [n['@type']].flat().includes('Product') && matchesNode(n))
    ?? productNodes.find(matchesNode)
    ?? productNodes.find(n => !hasListingUrl(n) && (!Array.isArray(n.hasVariant) || !n.hasVariant.some((child: Record<string, unknown>) => child && hasListingUrl(child))));
  // Vans publishes the option matrix in ProductGroup and the base offer/gallery
  // in a separate exact-URL Product. Merge only that explicitly matching parent.
  const groupChildren = Array.isArray(groupNode?.hasVariant) ? groupNode.hasVariant : [];
  const exactParent = groupChildren.length ? productNodes.find(n => !groupChildren.includes(n) && [n['@type']].flat().includes('Product') && matchesNode(n)) : undefined;
  const quoteParent = groupNode && (matchesNode(groupNode) || !hasListingUrl(groupNode)) && groupNode.offers !== undefined ? groupNode : exactParent;
  const parentOffers = [quoteParent?.offers].flat().filter(offer => offer && typeof offer === 'object' && (!offer.url || sameListing(offer.url)));
  const group: typeof groupNode = groupNode && exactParent && exactParent !== groupNode
    ? {...exactParent, ...groupNode, offers: parentOffers, image: groupNode.image ?? exactParent.image, brand: groupNode.brand ?? exactParent.brand}
    : groupNode ? {...groupNode,offers:parentOffers} : undefined;
  // ProductGroup pages (including Nike) may put all price data on size/color children.
  // Only use children for the exact linked listing, never a different recommended color.
  const allChildren = Array.isArray(group?.hasVariant) ? group.hasVariant.filter((child: Record<string, unknown>) => child && typeof child === 'object') : [];
  const groupIdentifiesListing = Boolean(group && (matchesNode(group) || allChildren.some((child: Record<string, unknown>) => matchesNode(child))));
  const children = allChildren.filter((child: Record<string, unknown>) => {
    if (!child || typeof child !== 'object') return false;
    const childOffers = [child.offers].flat() as Record<string, unknown>[];
    const childHasExactUrl = sameListing(child.url) || sameListing(child['@id']) || childOffers.some(item => sameListing(item?.url));
    // ProductGroup children without individual URLs still belong to the
    // exact matched parent. Do not add siblings from an unrelated recommendation.
    return childHasExactUrl || groupIdentifiesListing && !hasListingUrl(child);
  });
  const requestedVariants = new URL(sourceUrl).searchParams.getAll('variant');
  const selectedVariantId = requestedVariants.length === 1 ? requestedVariants[0] : undefined;
  const childQuote = (child: Record<string, unknown>) => {
    const childOffer = [child.offers].flat()[0] as Record<string, unknown> | undefined;
    return {price: number(childOffer?.price), currency: clean(childOffer?.priceCurrency).toUpperCase()};
  };
  const firstQuote = children.length ? childQuote(children[0]) : undefined;
  const uniformChild = firstQuote?.price !== undefined && /^[A-Z]{3}$/.test(firstQuote.currency)
    && children.every((child: Record<string, unknown>) => {
      const quote = childQuote(child);return quote.price === firstQuote.price && quote.currency === firstQuote.currency;
    }) ? children[0] : undefined;
  const linkedChildren = children.filter((child: Record<string, unknown>) => [child.url, ...[child.offers].flat().map((o) => (o as Record<string, unknown>)?.url)].some(value => {
    try {
      if (!selectedVariantId || typeof value !== 'string') return false;
      const candidateVariants = new URL(value, sourceUrl).searchParams.getAll('variant');
      return candidateVariants.length === 1 && candidateVariants[0] === selectedVariantId;
    } catch { return false; }
  }));
  const missingRequestedVariant = allChildren.length > 0 && requestedVariants.length > 0 && linkedChildren.length !== 1;
  const selectedChild = requestedVariants.length > 0 ? linkedChildren.length === 1 ? linkedChildren[0] : undefined : children.length === 1 ? children[0] : uniformChild;
  const metadataChild = selectedChild ?? (missingRequestedVariant ? undefined : children[0]);
  const p = metadataChild ? { ...group, ...metadataChild, brand: metadataChild.brand ?? group?.brand } : group;
  const offers = selectedChild ? selectedChild.offers : group?.offers;
  const offer = Array.isArray(offers) ? offers[0] : offers;
  const details = offer?.shippingDetails;
  const ship = Array.isArray(details) ? details[0] : details;
  const rate = ship?.shippingRate;
  const shipping = number(rate?.value ?? rate?.price);
  const destination = ship?.shippingDestination?.addressCountry;
  const zara = extractZara(html, sourceUrl);
  const images = zara?.missingSelectedColor ? [] : dedupeSafeImages([zara?.image, ...(zara?.images ?? []), ...[exactParent?.image].flat(), ...[p?.image].flat(), ...metaImages], sourceUrl);
  const image = images[0];
  const price = zara?.missingSelectedColor || missingRequestedVariant ? undefined :
    zara?.price ??
    number(
      offer?.price ??
        offer?.priceSpecification?.price ??
        meta["product:price:amount"] ??
        meta["og:price:amount"],
    );
  const currency =
    zara?.currency ??
    (clean(
      offer?.priceCurrency ??
        offer?.priceSpecification?.priceCurrency ??
        meta["product:price:currency"] ??
        meta["og:price:currency"],
    ).toUpperCase() || (firstQuote && /^[A-Z]{3}$/.test(firstQuote.currency) && children.every((child: Record<string, unknown>) => childQuote(child).currency === firstQuote.currency) ? firstQuote.currency : undefined));
  // Douglas and some pharmacies put the pack size ("30 ML", "50 g") into the JSON-LD name; the page title names the product.
  const sizeOnlyName = /^\s*\d+(?:[.,]\d+)?\s*(?:ml|mL|cl|l|g|gr|kg|mg|oz|fl\.?\s?oz|мл|г|шт|uds?\.?|pcs?)\.?\s*$/i;
  const ldName = typeof p?.name === "string" && !sizeOnlyName.test(p.name) ? p.name : undefined;
  // When the structured name was only a size, the page heading beats the SEO <title> ("… ✔️ dulzura | DOUGLAS").
  const headingName = typeof p?.name === "string" && ldName === undefined ? html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] : undefined;
  const title =
    (zara?.title ??
      clean(
        ldName ??
          meta["og:title"] ??
          meta["twitter:title"] ??
          headingName ??
          html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
      ).slice(0, 140)) || undefined;
  const gross = parseWeight(p?.shippingWeight);
  const net = parseWeight(p?.weight);
  const loc =
    offer?.availableAtOrFrom?.address?.addressCountry ??
    p?.offers?.shippingOrigin?.addressCountry;
  const rawBrand = p?.brand;
  const brand =
    (zara?.brand ??
      clean(
        typeof rawBrand === "object" && rawBrand
          ? ((rawBrand as Record<string, unknown>).name ??
              (rawBrand as Record<string, unknown>).label)
          : rawBrand,
      ).slice(0, 80)) || new URL(sourceUrl).hostname.replace(/^www\./, "");
  const category = inferProductCategory(
    [title, clean(p?.category), clean(p?.description)].filter(Boolean).join(" "),
    brand,
  );
  const genericAxes = p ? embeddedVariantAxes(p as EmbeddedRecord) : {color: '', size: '', sizeLabel: undefined};
  const namedOptionValues = p ? embeddedOptionEntries(p as EmbeddedRecord).map(item => item.value) : [];
  const genericLabel = p
    ? [genericAxes.color, genericAxes.size].filter(Boolean).join(' · ')
      || embeddedText(p.variantLabel ?? p.selectedVariantLabel ?? p.optionLabel)
      || namedOptionValues.join(' · ')
    : '';
  const skuNode = children.length > 1 && requestedVariants.length === 0 ? group : p;
  const sku = embeddedIdentifier(skuNode?.sku ?? skuNode?.gtin ?? skuNode?.ean).slice(0, 120) || undefined;
  const genericVariants: ProductVariant[] = genericLabel
    ? [{ id: sku, label: genericLabel, ...embeddedAvailability({availability: offer?.availability}), size: genericAxes.size || undefined, sizeLabel: genericAxes.sizeLabel, color: genericAxes.color || undefined }]
    : [];
  const groupVariants: ProductVariant[] = allChildren.map((child: Record<string, unknown>) => {
    const childOffer = [child.offers].flat()[0] as Record<string, unknown> | undefined;
    const axes = embeddedVariantAxes(child);
    return {
      id: embeddedIdentifier(child.sku ?? child.skuId ?? child.gtin ?? child.ean).slice(0, 120) || undefined,
      sourceUrl:safeVariantSourceUrl(childOffer?.url??child.url,sourceUrl),
      productId:embeddedIdentifier(child.productID)||undefined,
      sellerId:embeddedIdentifier(embeddedObject(childOffer?.seller).identifier)||undefined,
      offerId:embeddedIdentifier(childOffer?.identifier)||undefined,
      options:embeddedOptionEntries(child),
      images:dedupeSafeImages(Array.isArray(child.image)?child.image:[child.image],sourceUrl),
      size: axes.size || undefined,
      sizeLabel: axes.sizeLabel,
      color: axes.color || undefined,
      label: [axes.color, axes.size].filter(Boolean).join(' · ') || embeddedOptionLabel(child),
      ...embeddedAvailability({availability: childOffer?.availability}),
      price: !missingRequestedVariant && currency && clean(childOffer?.priceCurrency ?? (childOffer?.priceSpecification as Record<string, unknown> | undefined)?.priceCurrency).toUpperCase() === currency
        ? number(childOffer?.price ?? (childOffer?.priceSpecification as Record<string, unknown> | undefined)?.price) : undefined,
      image: safeImage(Array.isArray(child.image) ? child.image[0] : child.image, sourceUrl),
    };
  }).filter((item: ProductVariant) => item.label).slice(0, 80);
  // Some stores repeat a parent SKU across sizes. Such IDs cannot identify a
  // selected combination: retain the existing exact-label verification path.
  const variantIdCounts = new Map<string, number>();
  for (const variant of groupVariants) if (variant.id) variantIdCounts.set(variant.id, (variantIdCounts.get(variant.id) ?? 0) + 1);
  for (const variant of groupVariants) if (variant.id && variantIdCounts.get(variant.id)! > 1) delete variant.id;
  const rawVariants = zara?.missingSelectedColor ? [] : zara?.variants?.length ? zara.variants : groupVariants.length ? groupVariants : genericVariants;
  const gymsharkColor = /(^|\.)gymshark\.com$/i.test(new URL(sourceUrl).hostname)
    ? clean(html.match(/aria-current=["']true["'][^>]*aria-label=["'][^"']+\s+in\s+([^"']+)/i)?.[1])
    : '';
  const variants = gymsharkColor ? rawVariants.map(variant => variant.color ? variant : {...variant,color:gymsharkColor,label:[gymsharkColor,variant.size??variant.label].filter(Boolean).join(' · ')}) : rawVariants;
  const country = zara?.country ?? regionNames[String(loc).toUpperCase()] ?? inferStorefrontCountry(sourceUrl, currency);
  const warnings: string[] = [];
  if (missingRequestedVariant) warnings.push('Вариант из ссылки не найден или неоднозначен. Выберите и подтвердите размер или цвет вручную.');
  if (zara?.missingSelectedColor) warnings.push('Цвет из ссылки Zara не найден. Проверьте и подтвердите вариант вручную.');
  if (groupVariants.length) warnings.push('Размеры получены со страницы магазина. Наличие и цена выбранного размера требуют подтверждения.');
  if (price === undefined)
    warnings.push("Цена не найдена: укажите её со страницы выбранного варианта.");
  if (shipping === undefined)
    warnings.push("Доставка магазина не опубликована — указан изменяемый резерв $10; для заказа из магазина от $50 его не берём.");
  if (!gross && !net)
    warnings.push("Вес не опубликован. Предложим приблизительный вес по категории.");
  if (net && !gross)
    warnings.push("Магазин указал вес товара; вес коробки может не входить. Проверьте поле веса.");
  if (Array.isArray(offers) && offers.length > 1)
    warnings.push("Найдено несколько предложений: показано первое. Проверьте вариант и цену.");
  if (offer?.["@type"] === "AggregateOffer")
    warnings.push("Указан диапазон цен. Нужна цена конкретного варианта.");
  const extracted: Extracted = {
    variantScope: zara ? 'group' : groupIdentifiesListing && groupVariants.length ? 'group' : undefined,
    groupId: zara ? undefined : groupIdentifiesListing ? embeddedIdentifier(group?.productGroupID ?? group?.productID)||undefined : undefined,
    variantsComplete: false,
    sku: missingRequestedVariant ? undefined : sku,
    colorwayImages:zara?.colorwayImages,
    title,
    brand,
    category,
    declarationDescription: declarationFor(category, title ?? "", brand),
    image,
    images,
    price,
    currency,
    variants,
    selectedVariantColor: missingRequestedVariant ? undefined : zara?.selectedVariantColor ?? (metadataChild && matchesNode(metadataChild) ? genericAxes.color || undefined : undefined),
    shipping,
    shippingCurrency: clean(rate?.currency) || currency,
    shippingDestination:
      typeof destination === "string" ? destination : undefined,
    boxedWeight: gross ?? net,
    weightKind: gross ? "shipping" : net ? "net" : undefined,
    country,
    warnings,
    sourceUrl,
    method: zara ? "Zara product data" : p ? "JSON-LD" : "Open Graph",
  };
  return enrichMerchantOptions(html, sourceUrl, extractAsosProduct(html, sourceUrl, extracted) ?? extracted);
}
