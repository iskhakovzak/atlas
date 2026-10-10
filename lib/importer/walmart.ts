import type { Extracted, ProductCategory, ProductVariant } from './extract.ts';

/**
 * Walmart US. The product page carries its own Next.js state (`__NEXT_DATA__` → initialData.data.product): the
 * product, its colour and size criteria and `variantsMap`, where every combination is its own /ip/ item with its
 * price and stock. Only the item from the link (its id is the last path segment) is read; prices are dollars.
 * Checked 10 October 2026: an ordinary request from a home address gets the full page (the Tashkent gateway),
 * a data-centre address gets PerimeterX's wall.
 */
type Rec = Record<string, unknown>;
type Helpers = {
  safeImage: (value: unknown, base: string) => string | undefined;
  inferCategory: (title: string, brand: string) => ProductCategory;
  declarationFor: (category: ProductCategory, title: string, brand: string) => string;
};

const MAX_VARIANTS = 250;
const record = (value: unknown): Rec | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Rec : undefined;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const clean = (value: unknown, max = 180) => typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
const dollars = (value: unknown) => {
  const price = record(value);
  if (!price || clean(price.currencyUnit, 3).toUpperCase() !== 'USD') return undefined;
  const amount = typeof price.price === 'number' ? price.price : Number(price.price);
  return Number.isFinite(amount) && amount > 0 && amount <= 100_000 ? Math.round(amount * 100) / 100 : undefined;
};
const itemIdFrom = (value: unknown) => clean(value, 40).match(/^\d{4,20}$/)?.[0];

function nextData(html: string): Rec | undefined {
  const match = html.match(/<script\b(?=[^>]*\bid\s*=\s*["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return undefined;
  try { return record(JSON.parse(match[1])); } catch { return undefined; }
}

export function extractWalmartProduct(html: string, sourceUrl: string, helpers: Helpers): Extracted | undefined {
  let source: URL;
  try { source = new URL(sourceUrl); } catch { return undefined; }
  if (source.hostname.toLowerCase().replace(/^www\./, '') !== 'walmart.com' || !/^\/ip\//i.test(source.pathname)) return undefined;
  const linked = itemIdFrom(source.pathname.split('/').filter(Boolean).at(-1));
  if (!linked) return undefined;
  const product = record(record(record(record(record(nextData(html)?.props)?.pageProps)?.initialData)?.data)?.product);
  if (!product) return undefined;
  const title = clean(product.name, 300);
  if (!title) return undefined;
  const brand = clean(product.brand, 120) || 'Walmart';

  // Criteria values: "actual_color-blacksoot" → {axis: "Color", name: "Black Soot"}.
  const values = new Map<string, {axis: string; name: string}>();
  for (const criterion of list(product.variantCriteria).map(record)) {
    const axis = clean(criterion?.name, 60);
    if (!criterion || !axis) continue;
    for (const value of list(criterion.variantList).map(record)) {
      const id = clean(value?.id, 120), name = clean(value?.name, 80);
      if (id && name) values.set(id, {axis, name});
    }
  }
  const isColor = (axis: string) => /colou?r/i.test(axis);
  const isSize = (axis: string) => /size/i.test(axis);

  const variants: ProductVariant[] = [];
  const entries = Object.values(record(product.variantsMap) ?? {}).map(record).filter((entry): entry is Rec => Boolean(entry));
  for (const entry of entries) {
    const id = itemIdFrom(entry.usItemId);
    const price = dollars(record(entry.priceInfo)?.currentPrice);
    if (!id || !price) continue;
    const chosen = list(entry.variants).map(value => values.get(clean(value, 120))).filter((value): value is {axis: string; name: string} => Boolean(value));
    if (!chosen.length) continue;
    const color = chosen.find(value => isColor(value.axis))?.name, size = chosen.find(value => isSize(value.axis))?.name;
    const image = helpers.safeImage(record(list(record(entry.imageInfo)?.allImages)[0])?.url ?? record(entry.imageInfo)?.thumbnailUrl, sourceUrl);
    const status = clean(entry.availabilityStatus, 40);
    const path = clean(entry.productUrl, 400);
    variants.push({
      id,
      productId: id,
      sourceUrl: /^\/ip\//.test(path) ? `https://www.walmart.com${path}` : `https://www.walmart.com/ip/${id}`,
      options: chosen.map(value => ({name: value.axis, value: value.name})),
      label: chosen.map(value => value.name).join(' · '),
      ...(color ? {color} : {}),
      ...(size ? {size, sizeLabel: 'Размер'} : {}),
      available: status === 'IN_STOCK',
      availabilityKnown: /^(IN_STOCK|OUT_OF_STOCK)$/.test(status),
      price,
      ...(image ? {image, images: [image]} : {}),
    });
  }
  const tooMany = variants.length > MAX_VARIANTS;
  // The linked item first, so it survives the cap.
  variants.sort((a, b) => Number(b.id === linked) - Number(a.id === linked));
  if (tooMany) variants.length = MAX_VARIANTS;

  const ownId = itemIdFrom(product.usItemId);
  const selectedVariant = variants.find(variant => variant.id === linked);
  // A product without options is the linked item itself; a product with options must list the linked one.
  if (!selectedVariant && (variants.length || ownId !== linked)) return undefined;
  const ownPrice = dollars(record(product.priceInfo)?.currentPrice);
  const price = selectedVariant?.price ?? ownPrice;
  if (!price) return undefined;
  const wasPrice = dollars(record(product.priceInfo)?.wasPrice);
  const status = clean(product.availabilityStatus, 40);
  const images = [...new Set([
    selectedVariant?.image,
    ...list(record(product.imageInfo)?.allImages).map(image => helpers.safeImage(record(image)?.url, sourceUrl)),
  ].filter((value): value is string => Boolean(value)))].slice(0, 12);
  const available = selectedVariant ? selectedVariant.available : status === 'IN_STOCK';
  const path = list(record(product.category)?.path).map(step => clean(record(step)?.name, 60)).filter(Boolean).join(' ');
  const category = helpers.inferCategory([title, path].filter(Boolean).join(' '), brand);
  const seller = clean(product.sellerDisplayName ?? product.sellerName, 120);
  const warnings = ['Цена и наличие получены со страницы Walmart; Atlas сверит их перед выкупом.'];
  if (!available) warnings.push('Вариант из ссылки сейчас не в наличии на Walmart.');
  if (seller && !/^walmart(\.com)?$/i.test(seller)) warnings.push(`Продаёт сторонний продавец на Walmart (${seller}): сроки, доставка и возврат — по его правилам.`);
  if (tooMany) warnings.push(`У товара больше ${MAX_VARIANTS} вариантов: показаны первые ${MAX_VARIANTS}.`);
  const single: ProductVariant = {id: linked, productId: linked, sourceUrl, label: 'Как в ссылке', available, availabilityKnown: /^(IN_STOCK|OUT_OF_STOCK)$/.test(status), price, ...(images[0] ? {image: images[0]} : {})};
  return {
    variantScope: variants.length ? 'group' : 'item',
    groupId: clean(product.primaryProductId ?? product.id, 40) || undefined,
    variantsComplete: !tooMany && (variants.length ? entries.length === variants.length : true),
    sku: linked,
    selectedVariantId: linked,
    title,
    brand,
    category,
    declarationDescription: helpers.declarationFor(category, title, brand),
    image: images[0],
    images,
    ...(selectedVariant?.color ? {selectedVariantColor: selectedVariant.color} : {}),
    price,
    ...(wasPrice && wasPrice > price ? {referencePrice: wasPrice} : {}),
    currency: 'USD',
    variants: variants.length ? variants : [single],
    country: 'США',
    warnings,
    sourceUrl,
    method: 'Walmart product state',
  };
}
