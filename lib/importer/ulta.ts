import type { Extracted, ProductCategory, ProductVariant } from './extract.ts';
import { publicJsonStates } from './public-state.ts';

/**
 * Ulta Beauty (www.ulta.com/p/<slug>-pimprod<id>[?sku=<sku>]). The page's Apollo state
 * (`window.__APOLLO_STATE__`) holds the product hero as CMS modules: `ProductPricing` for
 * the selected SKU (name, brand, list/sale price), `ProductVariant` with every shade or size
 * and a definite `unavailable`/`disabled` flag, and `MediaGallery` with the selected SKU's
 * photos. Only the selected option carries a price; the importer reads the others from their own `?sku=` pages.
 */
type Rec = Record<string, unknown>;
type Helpers = {
  safeImage: (value: unknown, base: string) => string | undefined;
  inferCategory: (title: string, brand: string) => ProductCategory;
  declarationFor: (category: ProductCategory, title: string, brand: string) => string;
};

const record = (value: unknown): Rec | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Rec : undefined;
const text = (value: unknown, max = 160) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const MAX_VARIANTS = 120;

/** "$12.00" → 12; a range or another currency is not a price for one option. */
function dollars(value: unknown) {
  const match = text(value, 40).match(/^\$\s?(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)$/);
  const amount = match ? Number(match[1].replace(/,/g, '')) : NaN;
  return Number.isFinite(amount) && amount > 0 && amount <= 100_000 ? Math.round(amount * 100) / 100 : undefined;
}

/** CMS modules of the product page, by name (first occurrence wins: recommendations come later). */
function heroModules(state: unknown, productId: string) {
  const found = new Map<string, Rec>();
  const seen = new Set<unknown>();
  let visited = 0;
  const walk = (value: unknown, depth: number) => {
    if (!value || typeof value !== 'object' || depth > 24 || seen.has(value) || ++visited > 60_000) return;
    seen.add(value);
    if (Array.isArray(value)) { for (const item of value) walk(item, depth + 1); return; }
    const node = value as Rec;
    const name = text(node.moduleName, 40);
    if (/^(?:ProductPricing|ProductVariant|MediaGallery|ProductInformation)$/.test(name) && !found.has(name)
      && (name !== 'ProductPricing' || text(node.productId, 40) === productId)) found.set(name, node);
    for (const child of Object.values(node)) walk(child, depth + 1);
  };
  walk(state, 0);
  return found;
}

/** The page prices only the selected option; the importer asks each option's own page (lib/importer/fetch.ts). */
export const ultaUnpricedWarning = (isShade: boolean) => `Ulta показывает цену только выбранного варианта${isShade ? '' : ' — у других объёмов она может отличаться'}. Откройте ссылку нужного варианта, чтобы проверить его цену.`;
const unpricedPrefix = 'Ulta показывает цену только выбранного варианта';
/** The merchant profile may append its name to the method ("Ulta page data · …"). */
export const isUltaExtraction = (product: Pick<Extracted, 'method'>) => product.method?.startsWith('Ulta page data') === true;

/**
 * Prices of the other shades and sizes from their own `?sku=` pages. `readOption` returns that page's extraction
 * (or undefined); only an answer for exactly the same product and SKU is used. Options that did not answer in time
 * stay unpriced with the warning; nothing is guessed from the selected option's price.
 */
export async function fillUltaVariantPrices(product: Extracted, readOption: (url: string) => Promise<Extracted | undefined>, {limit = 24, concurrency = 4} = {}): Promise<Extracted> {
  if (!isUltaExtraction(product) || !product.variants?.length) return product;
  const missing = product.variants.filter(variant => variant.price === undefined && variant.id && variant.sourceUrl).slice(0, limit);
  if (!missing.length) return product;
  const found = new Map<string, ProductVariant>();
  let next = 0;
  const worker = async () => {
    while (next < missing.length) {
      const variant = missing[next++];
      const page = await readOption(variant.sourceUrl!).catch(() => undefined);
      const own = page && isUltaExtraction(page) && page.groupId === product.groupId && page.selectedVariantId === variant.id
        ? page.variants?.find(item => item.id === variant.id) : undefined;
      if (own?.price !== undefined) found.set(variant.id!, own);
    }
  };
  await Promise.all(Array.from({length: Math.min(concurrency, missing.length)}, worker));
  if (!found.size) return product;
  const variants = product.variants.map(variant => {
    const own = variant.id ? found.get(variant.id) : undefined;
    if (!own) return variant;
    return {
      ...variant, price: own.price, ...(own.compareAtPrice ? {compareAtPrice: own.compareAtPrice} : {}),
      // The option's own page knows its stock and gallery better than the selected option's page.
      ...(own.availabilityKnown ? {available: own.available, availabilityKnown: true} : {}),
      ...(own.images?.length ? {images: own.images, image: own.images[0]} : {}),
    };
  });
  const isShade = variants.some(variant => variant.color);
  const warnings = product.warnings.filter(warning => !warning.startsWith(unpricedPrefix));
  if (variants.some(variant => variant.price === undefined)) warnings.push(ultaUnpricedWarning(isShade));
  return {...product, variants, warnings};
}

export function extractUltaProduct(html: string, sourceUrl: string, helpers: Helpers): Extracted | undefined {
  const source = new URL(sourceUrl);
  if (!/^(?:www\.)?ulta\.com$/i.test(source.hostname)) return undefined;
  const productId = source.pathname.match(/\/p\/[^/]*?-((?:pimprod|xlsImpprod)\d+)\/?$/i)?.[1];
  if (!productId) return undefined;
  const linkedSku = source.searchParams.get('sku')?.match(/^\d{4,12}$/)?.[0];
  const state = publicJsonStates(html).find(root => record(root)?.ROOT_QUERY);
  if (!state) return undefined;
  const modules = heroModules(state, productId);
  const pricing = modules.get('ProductPricing');
  if (!pricing) return undefined;
  const skuId = text(pricing.skuId, 20);
  // A link to a SKU the page did not select (discontinued, regional) is not silently swapped.
  if (!skuId || linkedSku && linkedSku !== skuId) return undefined;
  const title = text(pricing.productName, 140) || text(modules.get('ProductInformation')?.productName, 140);
  const brand = text(pricing.brandName, 80) || 'Ulta Beauty';
  const listPrice = dollars(pricing.listPrice ?? pricing.productListPrice);
  const salePrice = dollars(pricing.salePrice ?? pricing.productSalePrice);
  const price = salePrice ?? listPrice;
  if (!title || !price) return undefined;
  const referencePrice = salePrice && listPrice && listPrice > salePrice ? listPrice : undefined;

  const gallery = modules.get('MediaGallery');
  const galleryItems = Array.isArray(gallery?.items) ? gallery.items.map(record) : [];
  const images = [...new Set(galleryItems
    .filter(item => item && !item.videoUrl && record(item.metaData)?.isImage !== false)
    .map(item => helpers.safeImage(item!.imageUrl, sourceUrl))
    .filter((value): value is string => Boolean(value)))].slice(0, 12);
  const pricingImage = helpers.safeImage(record(pricing.image)?.imageUrl, sourceUrl);
  if (!images.length && pricingImage) images.push(pricingImage);

  const variantModule = modules.get('ProductVariant');
  const optionName = text(variantModule?.variantType, 30) || text(pricing.variantTypeLabel, 30) || 'Color';
  const isShade = /^(?:colou?r|shade)$/i.test(optionName);
  const variants: ProductVariant[] = [];
  const entries = Array.isArray(variantModule?.variants) ? variantModule.variants.map(record) : [];
  for (const entry of entries) {
    const id = text(entry?.skuId, 20), name = text(entry?.name, 80);
    if (!entry || !id || !name || text(entry.productId, 40) && text(entry.productId, 40) !== productId) continue;
    const own = dollars(entry.salePrice) ?? dollars(entry.listPrice) ?? (id === skuId ? price : undefined);
    const ownList = dollars(entry.listPrice);
    const image = helpers.safeImage(record(entry.mainImage)?.imageUrl, sourceUrl);
    const known = typeof entry.unavailable === 'boolean' || typeof entry.disabled === 'boolean';
    variants.push({
      id,
      productId,
      sourceUrl: `${source.origin}${source.pathname}?sku=${id}`,
      options: [{ name: isShade ? 'Color' : optionName, value: name }],
      ...(isShade ? { color: name } : { size: name }),
      label: name,
      available: entry.unavailable !== true && entry.disabled !== true,
      availabilityKnown: known,
      price: own,
      ...(own && ownList && ownList > own ? { compareAtPrice: ownList } : {}),
      image: image ?? (id === skuId ? images[0] : undefined),
      ...(id === skuId && images.length ? { images } : image ? { images: [image] } : {}),
    });
    if (variants.length >= MAX_VARIANTS) break;
  }
  // A single-option product has no variant module: the selected SKU is the only option.
  if (!variants.length) {
    const label = text(pricing.variantLabel, 80) || 'Стандартный';
    variants.push({
      id: skuId, productId, options: [{ name: 'Option', value: label }], label, price,
      available: pricing.unavailable !== true, availabilityKnown: typeof pricing.unavailable === 'boolean', image: images[0], images,
    });
  }
  const selected = variants.find(variant => variant.id === skuId);
  const categoryGuess = helpers.inferCategory(title, brand);
  const category: ProductCategory = categoryGuess === 'Другое' ? 'Красота и уход' : categoryGuess;
  const warnings = [
    'Цена, оттенки, наличие и фото — из данных страницы Ulta на момент проверки.',
    'Доставка магазина не опубликована — указан изменяемый резерв $10.',
    'Вес с упаковкой нужно проверить.',
  ];
  if (variants.some(variant => variant.price === undefined)) warnings.push(ultaUnpricedWarning(isShade));
  if (selected && !selected.available) warnings.push('Выбранный вариант сейчас недоступен. Выберите другой.');
  return {
    variantScope: 'group',
    groupId: productId,
    variantsComplete: variants.length > 0 && variants.length < MAX_VARIANTS && variants.every(variant => variant.availabilityKnown),
    sku: skuId,
    selectedVariantId: skuId,
    title,
    brand,
    category,
    declarationDescription: helpers.declarationFor(category, title, brand),
    image: images[0],
    images,
    ...(isShade && selected?.color ? { selectedVariantColor: selected.color } : {}),
    price,
    ...(referencePrice ? { referencePrice } : {}),
    currency: 'USD',
    variants,
    country: 'США',
    warnings,
    sourceUrl,
    method: 'Ulta page data',
  };
}
