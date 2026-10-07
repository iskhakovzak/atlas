import {dedupeSafeImages, inferProductCategory, safeImage, type Extracted, type ProductVariant} from './extract.ts';

/**
 * Victoria's Secret / PINK (US storefront). The product page is a client-side
 * shell without prices; the page itself loads one public, credential-free JSON
 * document from api.victoriassecret.com with every colour ("choice"), size,
 * price and stock status. Only that exact document is read, only for the US
 * storefront (prices are in USD), and only the colour the customer's link points to
 * becomes the selected variant.
 */
export const victoriasSecretApiHost = 'api.victoriassecret.com';
const imageBase = 'https://www.victoriassecret.com/p/760x1013/';
const MAX_IMAGES = 12;
const MAX_VARIANTS = 250;

type Rec = Record<string, unknown>;
const record = (value: unknown): Rec | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Rec : undefined;
const clean = (value: unknown, max = 180) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100_000 ? Math.round(value * 100) / 100 : undefined;

export type VictoriasSecretRequest = {api: URL; productId: string; choice?: string; genericId?: string};

/** The API document for a US product link, or undefined for anything else (other countries, category pages). */
export function victoriasSecretRequest(url: URL): VictoriasSecretRequest | undefined {
  if (url.hostname.toLowerCase().replace(/^www\./, '') !== 'victoriassecret.com') return undefined;
  const country = url.pathname.match(/^\/([a-z]{2})(?:\/|$)/i)?.[1]?.toUpperCase();
  if (country !== 'US') return undefined;
  const productId = url.pathname.match(/\/(\d{8,12})(?:\/|$)/)?.[1];
  if (!productId) return undefined;
  const api = new URL(`https://${victoriasSecretApiHost}/products/v38/page/${productId}`);
  api.searchParams.set('activeCountry', 'US');
  return {
    api,
    productId,
    choice: url.pathname.match(/-choice-([A-Z0-9]{2,8})(?:\/|$)/i)?.[1]?.toUpperCase(),
    genericId: url.pathname.match(/generic-(\d{4,12})-/i)?.[1],
  };
}

function sizeVariants(sizes: unknown, choiceId: string, color: string, available: boolean, image: string | undefined) {
  const entries = record(sizes) ?? {};
  const variants: ProductVariant[] = [];
  for (const [key, raw] of Object.entries(entries)) {
    const size = record(raw);
    if (!size) continue;
    // Prices arrive formatted ("$30.00") next to the number; anything not shown in dollars is not a USD price.
    const dollars = /^\$/.test(clean(size.salePrice)) || /^\$/.test(clean(size.originalPrice));
    const original = money(size.originalPriceNumerical);
    const sale = money(size.salePriceNumerical);
    const price = clean(size.priceType, 20).toLowerCase() === 'sale' && sale ? sale : (sale ?? original);
    if (!dollars || !price) continue;
    const label = clean(size.size1, 60) || clean(key, 60);
    if (!label) continue;
    const inStock = available && (size.isAvailable === true || clean(size.status, 20).toLowerCase() === 'available');
    const compareAtPrice = original && original > price ? original : undefined;
    variants.push({
      id: clean(size.variantId, 40) || `${choiceId}-${label}`,
      label: `${color} · ${label}`,
      size: label,
      sizeLabel: 'Размер',
      color,
      available: inStock,
      availabilityKnown: true,
      price,
      ...(compareAtPrice ? {compareAtPrice} : {}),
      ...(image ? {image} : {}),
    });
    if (variants.length >= MAX_VARIANTS) break;
  }
  return variants;
}

export function extractVictoriasSecret(payload: unknown, sourceUrl: string, selection: VictoriasSecretRequest): Extracted | undefined {
  const product = record(record(payload)?.product);
  if (!product || clean(product.id, 20) !== selection.productId) return undefined;
  const title = clean(product.shortDescription, 140);
  if (!title) return undefined;
  const brand = clean(product.brandName, 80) || "Victoria's Secret";
  const data = record(product.productData) ?? {};
  const featured = record(product.featuredChoice);
  const genericKeys = Object.keys(data);
  const genericId = selection.genericId && data[selection.genericId] ? selection.genericId
    : clean(featured?.genericId, 20) && data[clean(featured?.genericId, 20)] ? clean(featured?.genericId, 20)
    : genericKeys[0];
  const generic = record(data[genericId ?? '']);
  const choices = record(generic?.choices) ?? {};
  const choiceKeys = Object.keys(choices);
  const choiceId = selection.choice && choices[selection.choice] ? selection.choice
    : clean(featured?.choice, 20) && choices[clean(featured?.choice, 20)] ? clean(featured?.choice, 20)
    : choiceKeys[0];
  const choice = record(choices[choiceId ?? '']);
  if (!choiceId || !choice) return undefined;
  const color = clean(choice.label, 100) || clean(choice.color, 100) || choiceId;
  const images = dedupeSafeImages(
    (Array.isArray(choice.images) ? choice.images : [])
      .map(entry => clean(record(entry)?.image, 200))
      .filter(path => /^[a-z0-9/_.-]+$/i.test(path) && !path.includes('..'))
      .map(path => safeImage(`${imageBase}${path}.jpg`, sourceUrl))
      .filter((value): value is string => Boolean(value)),
    sourceUrl, MAX_IMAGES,
  );
  const sellable = product.isOutOfStock !== true && product.allRestricted !== true;
  const variants = [
    ...sizeVariants(choice.availableSizes, choiceId, color, sellable, images[0]),
    ...sizeVariants(choice.unavailableSizes, choiceId, color, false, images[0]),
  ];
  if (!variants.length) return undefined;
  const prices = new Set(variants.map(variant => variant.price));
  const price = prices.size === 1 ? variants[0].price : undefined;
  const compareAts = new Set(variants.map(variant => variant.compareAtPrice));
  const referencePrice = price !== undefined && compareAts.size === 1 ? variants[0].compareAtPrice : undefined;
  const category = inferProductCategory([title, clean(product.categoryDisplay, 80), clean(product.classDisplay, 80)].filter(Boolean).join(' '), brand);
  const otherColours = choiceKeys.length - 1;
  return {
    sku: `${selection.productId}-${genericId}-${choiceId}`,
    title,
    brand,
    category,
    image: images[0],
    images,
    ...(price !== undefined ? {price} : {}),
    ...(referencePrice !== undefined ? {referencePrice} : {}),
    currency: 'USD',
    variants,
    selectedVariantColor: color,
    country: 'США',
    warnings: [
      "Цена, цвет и размеры получены из публичного API витрины Victoria's Secret для США.",
      'Наличие размеров — по данным витрины на момент проверки; Atlas сверит цену и наличие перед выкупом.',
      ...(otherColours > 0 ? [`Другие цвета этой модели (${otherColours}) импортируются отдельной ссылкой с нужным цветом.`] : []),
    ],
    sourceUrl,
    method: "Victoria's Secret product API",
  };
}
