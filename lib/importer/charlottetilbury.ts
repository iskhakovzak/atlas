import type { Extracted, ProductCategory, ProductVariant } from './extract.ts';

/**
 * Charlotte Tilbury (charlottetilbury.com/<store>/product/<slug>). The page is a
 * Next.js document without JSON-LD; the exact product the link points to is in the
 * `__NEXT_DATA__` state with its own SKU, price, stock and photos. Other shades and
 * sizes of the same product ("siblings") each live at their own URL and are offered
 * as options; the page's own product is the selected one.
 */
type Rec = Record<string, unknown>;
type Helpers = {
  safeImage: (value: unknown, base: string) => string | undefined;
  declarationFor: (category: ProductCategory, title: string, brand: string) => string;
};

const record = (value: unknown): Rec | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Rec : undefined;
const text = (value: unknown, max = 160) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100_000 ? Math.round(value * 100) / 100 : undefined;
const MAX_SIBLINGS = 60;
const storeCountry: Record<string, string> = { us: 'США', uk: 'Великобритания', de: 'Германия', fr: 'Франция', es: 'Испания', it: 'Италия', ca: 'Канада', au: 'Австралия' };

/** The storefront writes names in capitals; show them as a product name, keeping sizes ("100 ML") and short codes as written. */
export function charlotteTilburyName(value: string) {
  if (value !== value.toUpperCase()) return value;
  return value.toLowerCase().replace(/[^\s/&-]+/g, (word, offset: number) => {
    const original = value.slice(offset, offset + word.length);
    if (/\d/.test(word) || word.length <= 2) return original;
    return word[0].toUpperCase() + word.slice(1);
  });
}

function priceOf(value: unknown) {
  const price = record(value);
  const purchase = record(price?.purchasePrice);
  const listing = record(price?.listingPrice);
  const amount = money(purchase?.value);
  const currency = text(purchase?.currencyCode, 3).toUpperCase();
  if (!amount || !/^[A-Z]{3}$/.test(currency)) return undefined;
  const before = money(listing?.value);
  return { amount, currency, before: before && before > amount && text(listing?.currencyCode, 3).toUpperCase() === currency ? before : undefined };
}

function imagesOf(product: Rec, sourceUrl: string, helpers: Helpers) {
  const sources = [record(product.image)?.imageSrc, ...(Array.isArray(product.images) ? product.images.map(entry => record(entry)?.imageSrc) : [])];
  return [...new Set(sources.map(src => typeof src === 'string' && /^(?:https:)?\/\/[a-z0-9.-]+\//i.test(src) ? helpers.safeImage(src, sourceUrl) : undefined).filter((value): value is string => Boolean(value)))].slice(0, 12);
}

function variantOf(item: Rec, kind: string, sourceUrl: string, helpers: Helpers): ProductVariant | undefined {
  const sku = text(item.sku, 40);
  const price = priceOf(item.price);
  if (!sku || !price) return undefined;
  const option = text(item.subtitle, 80);
  const availability = text(item.availability, 30).toUpperCase();
  const label = charlotteTilburyName(option) || 'Стандартный';
  return {
    id: sku,
    label,
    ...(kind === 'SHADE' && option ? { color: label } : {}),
    ...(kind !== 'SHADE' && option ? { size: label, sizeLabel: 'Вариант' } : {}),
    available: availability === 'AVAILABLE',
    availabilityKnown: Boolean(availability),
    price: price.amount,
    ...(price.before ? { compareAtPrice: price.before } : {}),
    image: imagesOf(item, sourceUrl, helpers)[0],
  };
}

export function extractCharlotteTilburyProduct(html: string, sourceUrl: string, helpers: Helpers): Extracted | undefined {
  const source = new URL(sourceUrl);
  if (!/^(?:www\.)?charlottetilbury\.com$/i.test(source.hostname)) return undefined;
  const path = source.pathname.match(/^\/([a-z]{2})\/product\/([a-z0-9-]+)\/?$/i);
  if (!path) return undefined;
  const script = html.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!script) return undefined;
  let data: Rec | undefined;
  try { data = record(JSON.parse(script)); } catch { return undefined; }
  const props = record(data?.props);
  const model = record(record(record(props?.initialState)?.page)?.model);
  const product = record(model?.product);
  if (!product) return undefined;
  // The state must describe the linked product, not a recommendation widget.
  if (text(product.href, 200).toLowerCase() !== path[2].toLowerCase()) return undefined;
  const rawTitle = text(product.title, 140);
  const price = priceOf(product.price);
  if (!rawTitle || !price) return undefined;
  const kind = text(product.swatchVariant, 20).toUpperCase();
  const selected = variantOf(product, kind, sourceUrl, helpers);
  if (!selected) return undefined;
  const siblings = (Array.isArray(props?.siblings) ? props.siblings : Array.isArray(model?.siblings) ? model.siblings : [])
    .map(record)
    .filter((item): item is Rec => Boolean(item) && text(item!.title, 140) === rawTitle && text(item!.sku, 40) !== selected.id)
    .slice(0, MAX_SIBLINGS)
    .map(item => variantOf(item, kind, sourceUrl, helpers))
    .filter((item): item is ProductVariant => Boolean(item));
  const variants = [selected, ...siblings];
  const title = charlotteTilburyName(rawTitle);
  const brand = 'Charlotte Tilbury';
  const category: ProductCategory = 'Красота и уход';
  const images = imagesOf(product, sourceUrl, helpers);
  const warnings = [
    'Цена, наличие и фото — из данных страницы Charlotte Tilbury для выбранного оттенка или объёма.',
    'Доставка магазина не опубликована — указан изменяемый резерв $10; для заказа из магазина от $50 его не берём.',
    'Вес с упаковкой нужно проверить.',
  ];
  if (!selected.available) warnings.push('Вариант из ссылки отсутствует в наличии. Выберите другой вариант.');
  if (siblings.length) warnings.push(`Другие ${kind === 'SHADE' ? 'оттенки' : 'варианты'} этой модели (${siblings.length}) показаны как опции; у каждого в магазине своя страница.`);
  return {
    sku: selected.id,
    title,
    brand,
    category,
    declarationDescription: helpers.declarationFor(category, title, brand),
    image: images[0],
    images,
    price: price.amount,
    ...(price.before ? { referencePrice: price.before } : {}),
    currency: price.currency,
    variants,
    ...(kind === 'SHADE' && selected.color ? { selectedVariantColor: selected.color } : {}),
    country: storeCountry[path[1].toLowerCase()],
    warnings,
    sourceUrl,
    method: 'Charlotte Tilbury page data',
  };
}
