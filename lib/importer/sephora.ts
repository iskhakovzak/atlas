import type { Extracted, ProductCategory, ProductVariant } from './extract.ts';

/**
 * Sephora US. The product page carries its own state in `<script id="linkStore">`:
 * the product, the SKU the link selects (`currentSku`) and its sibling SKUs (sizes,
 * shades) with list and sale prices, stock and photos. Only that exact product
 * (its id is in the link) is read; prices are the US storefront's dollars.
 */
type Rec = Record<string, unknown>;
type Helpers = {
  safeImage: (value: unknown, base: string) => string | undefined;
  inferCategory: (title: string, brand: string) => ProductCategory;
  declarationFor: (category: ProductCategory, title: string, brand: string) => string;
};

const MAX_VARIANTS = 80;
const record = (value: unknown): Rec | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Rec : undefined;
const clean = (value: unknown, max = 180) => typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
/** "$122.50" → 122.5; anything not in dollars is not a US price. */
const dollars = (value: unknown) => {
  const match = clean(value, 40).match(/^\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)$/);
  if (!match) return undefined;
  const amount = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 && amount <= 100_000 ? Math.round(amount * 100) / 100 : undefined;
};

function linkStore(html: string): Rec | undefined {
  const match = html.match(/<script\b(?=[^>]*\bid\s*=\s*["']linkStore["'])[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return undefined;
  try { return record(JSON.parse(match[1])); } catch { return undefined; }
}

export function extractSephoraProduct(html: string, sourceUrl: string, helpers: Helpers): Extracted | undefined {
  let source: URL;
  try { source = new URL(sourceUrl); } catch { return undefined; }
  if (source.hostname.toLowerCase().replace(/^www\./, '') !== 'sephora.com') return undefined;
  const productId = source.pathname.match(/-(P\d+)\/?$/i)?.[1]?.toUpperCase();
  if (!productId) return undefined;
  const product = record(record(linkStore(html)?.page)?.product);
  if (!product || clean(product.productId, 20).toUpperCase() !== productId) return undefined;
  const details = record(product.productDetails) ?? {};
  const title = clean(details.displayName, 140);
  if (!title) return undefined;
  const brand = clean(record(details.brand)?.displayName, 80) || 'Sephora';
  const current = record(product.currentSku);
  const skus = new Map<string, Rec>();
  for (const sku of [current, ...[product.regularChildSkus, product.onSaleChildSkus].flatMap(list => Array.isArray(list) ? list : [])]) {
    const value = record(sku), id = clean(value?.skuId, 20);
    if (value && /^\d{4,12}$/.test(id) && !skus.has(id)) skus.set(id, value);
  }
  const axis = clean(product.variationTypeDisplayName ?? product.variationType, 60);
  const isColor = /colou?r|shade/i.test(axis) && !/size/i.test(axis);
  const variants: ProductVariant[] = [];
  for (const [id, sku] of skus) {
    const list = dollars(sku.listPrice), sale = dollars(sku.salePrice);
    const price = sale && (!list || sale < list) ? sale : list;
    if (!price) continue;
    const label = clean(sku.variationValue, 80) || clean(sku.size, 80) || id;
    const image = helpers.safeImage(record(sku.skuImages)?.imageUrl, sourceUrl);
    variants.push({
      id,
      sourceUrl: `https://www.sephora.com/product/${source.pathname.split('/').filter(Boolean).at(-1)}?skuId=${id}`,
      label,
      ...(isColor ? {color: label} : {size: clean(sku.size, 60) || label, sizeLabel: 'Объём'}),
      available: sku.isOutOfStock !== true,
      availabilityKnown: typeof sku.isOutOfStock === 'boolean',
      price,
      ...(list && list > price ? {compareAtPrice: list} : {}),
      ...(image ? {image, images: [image]} : {}),
    });
    if (variants.length >= MAX_VARIANTS) break;
  }
  if (!variants.length) return undefined;
  // The link's own SKU; a link without one opens the page's current SKU.
  const requested = source.searchParams.get('skuId')?.match(/^\d{4,12}$/)?.[0];
  const selected = variants.find(variant => variant.id === (requested ?? clean(current?.skuId, 20)));
  if (requested && !selected) return undefined;
  const images = [...new Set([selected?.image, ...variants.map(variant => variant.image)].filter((value): value is string => Boolean(value)))].slice(0, 12);
  const category = helpers.inferCategory([title, clean(record(product.parentCategory)?.displayName, 80)].filter(Boolean).join(' '), brand);
  return {
    sku: selected?.id,
    selectedVariantId: selected?.id,
    title,
    brand,
    category,
    declarationDescription: helpers.declarationFor(category, title, brand),
    image: images[0],
    images,
    ...(selected?.price !== undefined ? {price: selected.price} : {}),
    ...(selected?.compareAtPrice !== undefined ? {referencePrice: selected.compareAtPrice} : {}),
    currency: 'USD',
    variants,
    country: 'США',
    warnings: ['Цена, объём и наличие получены со страницы Sephora США; Atlas сверит их перед выкупом.'],
    sourceUrl,
    method: 'Sephora product state',
  };
}
