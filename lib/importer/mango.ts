import type { Extracted, ProductCategory, ProductColorwayGallery, ProductVariant } from './extract.ts';

/**
 * Mango (shop.mango.com/<country>/<lang>/p/.../<reference>/<colour>/<look>). The page has
 * no JSON-LD; its React Server Components payload (`self.__next_f.push([1,"…"])`) carries
 * the product with every colour, its sizes with a definite `available` flag, the colour's
 * price and the photos of each look. The colour in the link is the selected one.
 */
type Rec = Record<string, unknown>;
type Helpers = {
  safeImage: (value: unknown, base: string) => string | undefined;
  inferCategory: (title: string, brand: string) => ProductCategory;
  declarationFor: (category: ProductCategory, title: string, brand: string) => string;
};

const record = (value: unknown): Rec | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Rec : undefined;
const text = (value: unknown, max = 160) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100_000 ? Math.round(value * 100) / 100 : undefined;
const MAX_VARIANTS = 120;
const storeCountry: Record<string, string> = { us: 'США', gb: 'Великобритания', de: 'Германия', fr: 'Франция', es: 'Испания', it: 'Италия', tr: 'Турция' };

/** The RSC payload as one string: each push carries a JSON string literal. */
function flightData(html: string) {
  let flight = '';
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try { flight += JSON.parse(match[1]); } catch { /* a malformed chunk only loses its own part */ }
  }
  return flight;
}

/** The JSON value starting at `start` (an object or array), honouring strings. */
function balanced(source: string, start: number) {
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === '{' || c === '[') depth++;
    else if ((c === '}' || c === ']') && --depth === 0) {
      try { return JSON.parse(source.slice(start, i + 1)) as unknown; } catch { return undefined; }
    }
  }
  return undefined;
}

/** The product object whose `reference` is the one in the link (not a recommendation). */
function productFor(flight: string, reference: string) {
  for (let at = flight.indexOf('"colors":[{'); at >= 0; at = flight.indexOf('"colors":[{', at + 1)) {
    let depth = 0, start = -1;
    for (let i = at; i >= 0; i--) {
      const c = flight[i];
      if (c === '}' || c === ']') depth++;
      else if (c === '{' || c === '[') { if (depth === 0) { start = i; break; } depth--; }
    }
    const product = start >= 0 ? record(balanced(flight, start)) : undefined;
    if (product && (text(product.reference, 20) === reference || text(product.id, 20) === reference) && Array.isArray(product.colors)) return product;
  }
  return undefined;
}

function colorImages(color: Rec, sourceUrl: string, helpers: Helpers) {
  const looks = record(color.looks) ?? {};
  const sources = Object.values(looks).flatMap(look => Array.isArray(record(look)?.media) ? record(look)!.media as unknown[] : [])
    .map(record).filter(media => media && (media.format === undefined || media.format === 'IMAGE')).map(media => media!.src);
  return [...new Set(sources.map(src => helpers.safeImage(src, sourceUrl)).filter((value): value is string => Boolean(value)))].slice(0, 12);
}

function colorPrice(color: Rec) {
  const price = record(record(color.prices)?.default);
  const amount = money(price?.price);
  const currency = text(price?.currency, 3).toUpperCase();
  return amount && /^[A-Z]{3}$/.test(currency) ? { amount, currency } : undefined;
}

export function extractMangoProduct(html: string, sourceUrl: string, helpers: Helpers): Extracted | undefined {
  const source = new URL(sourceUrl);
  if (!/^shop\.mango\.com$/i.test(source.hostname)) return undefined;
  const path = source.pathname.match(/^\/([a-z]{2})\/[a-z]{2}\/p\/(?:[^/]+\/)*?(\d{8})(?:\/(\d{2,3}))?(?:\/\d{2})?\/?$/i);
  if (!path) return undefined;
  const [, country, reference, pathColor] = path;
  const linkedColor = pathColor ?? source.searchParams.get('c')?.match(/^\d{2,3}$/)?.[0];
  const product = productFor(flightData(html), reference);
  if (!product) return undefined;
  const colors = (product.colors as unknown[]).map(record).filter((color): color is Rec => Boolean(color && text(color.id, 10)));
  const selected = linkedColor ? colors.find(color => text(color.id, 10) === linkedColor) : colors[0];
  // A link to a colour the product no longer has is not silently swapped for another colour.
  if (!selected) return undefined;
  const price = colorPrice(selected);
  const title = text(product.name, 140);
  if (!title || !price) return undefined;
  const variants: ProductVariant[] = [];
  const colorwayImages: ProductColorwayGallery[] = [];
  for (const color of colors) {
    const colorId = text(color.id, 10), colorName = text(color.label, 60);
    const images = colorImages(color, sourceUrl, helpers);
    if (colorName && images.length) colorwayImages.push({ color: colorName, colorId, images });
    const own = colorPrice(color);
    const sellable = color.isSellable !== false;
    for (const size of Array.isArray(color.sizes) ? color.sizes.map(record) : []) {
      const sizeId = text(size?.id, 10), sizeName = text(size?.label, 30) || text(size?.shortDescription, 30);
      if (!size || !sizeId || !sizeName) continue;
      variants.push({
        id: `${reference}-${colorId}-${sizeId}`,
        productId: reference,
        colorId,
        options: [{ name: 'Color', value: colorName }, { name: 'Size', value: sizeName }].filter(option => option.value),
        size: sizeName,
        color: colorName || undefined,
        label: [colorName, sizeName].filter(Boolean).join(' · '),
        available: sellable && size.available === true,
        availabilityKnown: typeof size.available === 'boolean',
        // Another currency on one colour would be a different storefront: leave its price unknown.
        price: own && own.currency === price.currency ? own.amount : undefined,
        image: images[0],
        images,
      });
    }
  }
  const images = colorImages(selected, sourceUrl, helpers);
  const brand = 'Mango';
  const category = helpers.inferCategory(title, brand);
  const selectedColor = text(selected.label, 60) || undefined;
  const warnings = [
    'Цена, размеры, наличие и фото — из данных страницы Mango на момент проверки.',
    'Доставка магазина не опубликована — указан изменяемый резерв $10.',
    'Вес с упаковкой нужно проверить.',
  ];
  if (!variants.some(variant => variant.available && variant.colorId === text(selected.id, 10))) warnings.push('Цвет из ссылки сейчас недоступен ни в одном размере. Выберите другой цвет.');
  return {
    variantScope: 'group',
    groupId: reference,
    variantsComplete: variants.length > 0 && variants.length <= MAX_VARIANTS && variants.every(variant => variant.availabilityKnown),
    sku: reference,
    title,
    brand,
    category,
    declarationDescription: helpers.declarationFor(category, title, brand),
    image: images[0],
    images,
    colorwayImages,
    ...(selectedColor ? { selectedVariantColor: selectedColor } : {}),
    price: price.amount,
    currency: price.currency,
    variants: variants.slice(0, MAX_VARIANTS),
    country: storeCountry[country.toLowerCase()],
    warnings,
    sourceUrl,
    method: 'Mango page data',
  };
}
