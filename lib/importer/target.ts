import type { Extracted, ProductCategory, ProductVariant } from './extract.ts';

/**
 * Target (www.target.com/p/<slug>/-/A-<tcin>). The product page renders its price and
 * options in the browser from Target's own public product service (redsky.target.com,
 * `pdp_client_v1`), called with the web storefront's public key. That document has the
 * parent product, every child item with its price, and the variation tree with a
 * definite shipping availability per item.
 */
type Rec = Record<string, unknown>;
type Helpers = {
  safeImage: (value: unknown, base: string) => string | undefined;
  inferCategory: (title: string, brand: string) => ProductCategory;
  declarationFor: (category: ProductCategory, title: string, brand: string) => string;
};

export const targetApiHost = 'redsky.target.com';
// The key target.com itself sends from every visitor's browser; it identifies the web storefront, not an account.
const targetWebKey = '9f36aeafbe60771e321a7cc95a78140772ab3e96';
// Target prices online orders at a reference store; this is the one the product page uses without a chosen store.
const targetPricingStore = '3991';
const MAX_VARIANTS = 120;

const record = (value: unknown): Rec | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Rec : undefined;
const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100_000 ? Math.round(value * 100) / 100 : undefined;
const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
const text = (value: unknown, max = 160) => typeof value === 'string'
  ? value.replace(/&#(\d{1,5});/g, (_, code: string) => String.fromCharCode(Number(code))).replace(/&([a-z]+);/gi, (match, name: string) => entities[name.toLowerCase()] ?? match).replace(/\s+/g, ' ').trim().slice(0, max)
  : '';

export function targetRequest(url: URL) {
  if (url.hostname !== 'www.target.com') return undefined;
  const tcin = url.pathname.match(/^\/p\/(?:[^/]+\/)?-\/A-(\d{6,10})\/?$/)?.[1];
  if (!tcin) return undefined;
  const preselect = url.searchParams.get('preselect')?.match(/^\d{6,10}$/)?.[0];
  const api = new URL(`https://${targetApiHost}/redsky_aggregations/v1/web/pdp_client_v1`);
  api.search = new URLSearchParams({ key: targetWebKey, tcin, pricing_store_id: targetPricingStore, has_pricing_store_id: 'true' }).toString();
  return { api, tcin: preselect ?? tcin };
}

function imagesOf(item: Rec | undefined, sourceUrl: string, helpers: Helpers) {
  const info = record(record(item?.enrichment)?.image_info);
  const sources = [record(info?.primary_image)?.url, ...(Array.isArray(info?.alternate_images) ? info.alternate_images.map(image => record(image)?.url) : []),
    ...(Array.isArray(info?.content_labels) ? info.content_labels.map(label => record(label)?.image_url) : [])];
  return [...new Set(sources.map(src => helpers.safeImage(src, sourceUrl)).filter((value): value is string => Boolean(value)))].slice(0, 12);
}

type Leaf = { tcin: string; options: { name: string; value: string }[]; availability?: Rec; image?: unknown };
/** Every orderable item in the variation tree with the options that lead to it (Color → Size and so on). */
function leaves(nodes: unknown, path: { name: string; value: string }[] = [], out: Leaf[] = []) {
  for (const node of Array.isArray(nodes) ? nodes.map(record) : []) {
    if (!node || out.length > MAX_VARIANTS) continue;
    const option = { name: text(node.name, 30), value: text(node.value, 60) };
    const options = option.name && option.value ? [...path, option] : path;
    if (Array.isArray(node.variation_hierarchy) && node.variation_hierarchy.length) leaves(node.variation_hierarchy, options, out);
    else if (/^\d{6,10}$/.test(text(node.tcin, 12))) out.push({ tcin: text(node.tcin, 12), options, availability: record(node.availability) ?? record(node.fulfillment), image: node.primary_image_url });
  }
  return out;
}

function priceOf(value: unknown) {
  const price = record(value);
  const amount = money(price?.current_retail) ?? money(price?.current_retail_min);
  const before = money(price?.reg_retail) ?? money(price?.reg_retail_max);
  return amount ? { amount, before: before && before > amount ? before : undefined } : undefined;
}

export function extractTarget(payload: unknown, sourceUrl: string, selectedTcin: string, helpers: Helpers): Extracted | undefined {
  const product = record(record(record(payload)?.data)?.product);
  if (!product) return undefined;
  const children = new Map((Array.isArray(product.children) ? product.children.map(record) : [])
    .filter((child): child is Rec => Boolean(child && text(child.tcin, 12)))
    .map(child => [text(child.tcin, 12), child]));
  const parentTcin = text(product.tcin, 12);
  // The document must describe the linked item or its own parent, not a recommendation.
  if (selectedTcin !== parentTcin && !children.has(selectedTcin)) return undefined;
  const brand = text(record(record(product.item)?.primary_brand)?.name, 80) || 'Target';
  const title = text(record(record(product.item)?.product_description)?.title, 140);
  if (!title) return undefined;
  const allLeaves=leaves(product.variation_hierarchy);
  const variants: ProductVariant[] = allLeaves.slice(0, MAX_VARIANTS).map(leaf => {
    const child = children.get(leaf.tcin);
    const price = priceOf(child?.price);
    const shipping = leaf.availability?.is_shipping_available;
    const soldOut = leaf.availability?.is_sold_out === true;
    const color = leaf.options.find(option => /colou?r/i.test(option.name))?.value;
    const size = leaf.options.find(option => /size/i.test(option.name))?.value;
    const images = imagesOf(record(child?.item), sourceUrl, helpers);
    return {
      id: leaf.tcin,
      productId: parentTcin || undefined,
      options: leaf.options,
      ...(size ? { size } : {}),
      ...(color ? { color } : {}),
      label: leaf.options.map(option => option.value).join(' · ') || title,
      available: shipping === true && !soldOut,
      availabilityKnown: typeof shipping === 'boolean',
      price: price?.amount,
      ...(price?.before ? { compareAtPrice: price.before } : {}),
      image: images[0] ?? helpers.safeImage(leaf.image, sourceUrl),
      ...(images.length ? { images } : {}),
    };
  });
  const selected = variants.find(variant => variant.id === selectedTcin);
  const selectedChild = children.get(selectedTcin);
  const price = priceOf(selected ? selectedChild?.price : product.price) ?? priceOf(product.price);
  if (!price) return undefined;
  const images = imagesOf(record(selectedChild?.item), sourceUrl, helpers);
  const gallery = images.length ? images : imagesOf(record(product.item), sourceUrl, helpers);
  const category = helpers.inferCategory(title, brand);
  const warnings = [
    'Цена и наличие для доставки — из открытых данных Target на момент проверки; цена может отличаться в магазинах сети.',
    'Доставка магазина не опубликована — указан изменяемый резерв $10.',
    'Вес с упаковкой нужно проверить.',
  ];
  if (selected && !selected.available) warnings.push('Вариант из ссылки сейчас нельзя заказать с доставкой. Выберите другой вариант.');
  return {
    variantScope: variants.length > 1 ? 'group' : 'item',
    groupId: parentTcin || undefined,
    variantsComplete: variants.length > 0 && allLeaves.length <= MAX_VARIANTS && variants.every(variant => variant.availabilityKnown && variant.price !== undefined),
    sku: selectedTcin,
    ...(selected ? { selectedVariantId: selected.id } : {}),
    title,
    brand,
    category,
    declarationDescription: helpers.declarationFor(category, title, brand),
    image: gallery[0],
    images: gallery,
    ...(selected?.color ? { selectedVariantColor: selected.color } : {}),
    price: price.amount,
    ...(price.before ? { referencePrice: price.before } : {}),
    currency: 'USD',
    variants,
    country: 'США',
    warnings,
    sourceUrl,
    method: 'Target product data',
  };
}
