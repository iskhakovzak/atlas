import { quote, repriceCart, merchantParcelKey, type CartItem, type Pricing, type Product } from './domain.ts';
import { dealQuote } from './deals.ts';
import { bundledMerchantFinds, type MerchantFind } from './catalog.ts';
import { brandForHost, storefrontLabel } from './store-brands.ts';
import type { Locale } from './i18n.ts';

/** Catalog categories as stored in product snapshots, with the URL slug of each. */
export const categorySlugs: Record<string, string> = {
  'Обувь': 'shoes', 'Одежда': 'clothing', 'Электроника': 'electronics', 'Аксессуары': 'accessories',
  'Красота и уход': 'beauty', 'Дом и быт': 'home', 'Спорт': 'sport', 'Другое': 'other',
};
const categoryBySlug = new Map(Object.entries(categorySlugs).map(([value, slug]) => [slug, value]));
/** Sizes are offered only where a size means the same thing across products. */
export const sizedCategories = new Set(['Обувь', 'Одежда']);

/** Delivered-total bands in soum: lower bound inclusive, upper bound exclusive. */
export const priceBands = [
  { id: 'to-300k', max: 300_000 },
  { id: '300k-600k', min: 300_000, max: 600_000 },
  { id: '600k-1m', min: 600_000, max: 1_000_000 },
  { id: '1m-2m', min: 1_000_000, max: 2_000_000 },
  { id: 'from-2m', min: 2_000_000 },
] as const;
export type PriceBand = (typeof priceBands)[number]['id'];
const bandIds = new Set<string>(priceBands.map((band) => band.id));

export type CatalogSort = 'best' | 'cheap' | 'expensive' | 'new';
const sorts = new Set<CatalogSort>(['best', 'cheap', 'expensive', 'new']);
export type CatalogQuery = {
  q: string; category: string; stores: string[]; price: PriceBand | ''; sizes: string[];
  duty: boolean; sale: boolean; fresh: boolean; sort: CatalogSort; collection: string;
};
export const emptyCatalogQuery: CatalogQuery = { q: '', category: '', stores: [], price: '', sizes: [], duty: false, sale: false, fresh: false, sort: 'best', collection: '' };

const list = (value: string | null, max: number) => [...new Set((value ?? '').split(',').map((item) => item.trim()).filter((item) => item && item.length <= 60))].slice(0, max);

/** Reads `?q=&cat=&store=&price=&size=&duty=1&sale=1&fresh=1&sort=&set=`; unknown values are dropped. */
export function readCatalogQuery(input: URLSearchParams | string | Record<string, string | string[] | undefined>): CatalogQuery {
  const params = input instanceof URLSearchParams ? input : typeof input === 'string' ? new URLSearchParams(input) : new URLSearchParams(Object.entries(input).flatMap(([key, value]) => typeof value === 'string' ? [[key, value]] : Array.isArray(value) && value[0] !== undefined ? [[key, value[0]]] : []));
  const price = params.get('price') ?? '';
  const sort = params.get('sort') as CatalogSort | null;
  const collection = params.get('set') ?? '';
  return {
    q: (params.get('q') ?? '').slice(0, 80),
    category: categoryBySlug.get(params.get('cat') ?? '') ?? '',
    stores: list(params.get('store'), 12).map((store) => store.toLowerCase()),
    price: bandIds.has(price) ? price as PriceBand : '',
    sizes: list(params.get('size'), 12),
    duty: params.get('duty') === '1', sale: params.get('sale') === '1', fresh: params.get('fresh') === '1',
    sort: sort && sorts.has(sort) ? sort : 'best',
    collection: /^[\w-]{1,80}$/.test(collection) ? collection : '',
  };
}

/** The query as URL parameters in a fixed order; defaults are omitted and other parameters (such as `lang`) kept. */
export function catalogQueryString(query: CatalogQuery, keep?: URLSearchParams) {
  const params = new URLSearchParams();
  for (const [key, value] of keep ?? []) if (!['q', 'cat', 'store', 'price', 'size', 'duty', 'sale', 'fresh', 'sort', 'set'].includes(key)) params.set(key, value);
  if (query.q.trim()) params.set('q', query.q.trim());
  if (query.category && categorySlugs[query.category]) params.set('cat', categorySlugs[query.category]);
  if (query.stores.length) params.set('store', query.stores.join(','));
  if (query.price) params.set('price', query.price);
  if (query.sizes.length) params.set('size', query.sizes.join(','));
  if (query.duty) params.set('duty', '1');
  if (query.sale) params.set('sale', '1');
  if (query.fresh) params.set('fresh', '1');
  if (query.sort !== 'best') params.set('sort', query.sort);
  if (query.collection) params.set('set', query.collection);
  const text = params.toString();
  return text ? '?' + text : '';
}

export function activeFilterCount(query: CatalogQuery) {
  return Number(Boolean(query.category)) + query.stores.length + Number(Boolean(query.price)) + query.sizes.length + Number(query.duty) + Number(query.sale) + Number(query.fresh) + Number(Boolean(query.collection));
}


export function storeHost(product: Product & { store?: string }) {
  try { if (product.sourceUrl) return new URL(product.sourceUrl).hostname.toLowerCase().replace(/^www\./, ''); } catch { /* fall back to the label */ }
  return (product.store ?? '').toLowerCase();
}
/** The store's brand name ("Amazon", "Amazon · Germany" for another storefront), otherwise its domain. */
export function storeLabel(host: string, locale: Locale = 'ru') {
  return brandForHost(host) ? storefrontLabel(host, locale) : host;
}

const letterSizes = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL'];
/** "US 9" and "9" from different US stores are the same size; letter sizes are upper-cased. */
export function normalizeSize(raw: string | undefined) {
  const value = (raw ?? '').replace(/\s+/g, ' ').trim().replace(/^US\s*/i, '').replace(/^(\d+),(\d)$/, '$1.$2');
  if (!value || value.length > 24) return '';
  const [first, ...rest] = value.split(' ');
  return letterSizes.includes(first.toUpperCase()) ? [first.toUpperCase(), ...rest].join(' ') : value;
}
export function compareSizes(a: string, b: string) {
  const na = Number(a), nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  if (Number.isFinite(na) !== Number.isFinite(nb)) return Number.isFinite(na) ? -1 : 1;
  const la = letterSizes.indexOf(a.split(' ')[0]), lb = letterSizes.indexOf(b.split(' ')[0]);
  if (la >= 0 && lb >= 0 && la !== lb) return la - lb;
  if ((la >= 0) !== (lb >= 0)) return la >= 0 ? -1 : 1;
  return a.localeCompare(b);
}
/** Sizes the store lists; a size the store marked unavailable is left out. */
export function productSizes(product: Product) {
  const sizes = (product.sourceVariants ?? [])
    .filter((variant) => variant.available || variant.availabilityKnown === false)
    .map((variant) => normalizeSize(variant.size))
    .filter(Boolean);
  return [...new Set(sizes)].sort(compareSizes);
}

export type CatalogItem = ReturnType<typeof dealQuote> & {
  /** Product price in USD for the duty-free check: the current price, or the last recorded one. */
  usd?: number;
  store: string; sizes: string[]; fresh: boolean; addedAt: number;
};
export function catalogItems(products: MerchantFind[], pricing: Pricing, records: MerchantFind[] = bundledMerchantFinds): CatalogItem[] {
  return products.map((product) => {
    const deal = dealQuote(product, pricing, records);
    const usd = deal.costs ? deal.costs.merchandise / pricing.fx : undefined;
    const addedAt = product.addedAt ?? (Date.parse(product.observedOn ?? '') || 0);
    return { ...deal, usd, store: storeHost(product), sizes: productSizes(product), fresh: !product.priceNeedsConfirmation, addedAt };
  });
}

export type CatalogContext = {
  /** USD the recipient can still import duty-free this month (the full allowance for guests). */
  dutyLimitUsd: number;
  collections?: { id: string; productIds: string[] }[];
  /** Extra searchable words for an item, such as its translated category. */
  words?: (item: CatalogItem) => string;
};
type Facet = 'category' | 'stores' | 'price' | 'sizes' | 'duty' | 'sale' | 'fresh' | 'collection';

function inBand(total: number | undefined, id: PriceBand | '') {
  if (!id) return true;
  const band = priceBands.find((item) => item.id === id)!;
  return total !== undefined && total >= ('min' in band ? band.min : 0) && ('max' in band ? total < band.max : true);
}
export function fitsDutyFree(item: CatalogItem, limitUsd: number) {
  return item.usd !== undefined && item.usd <= limitUsd + 1e-9;
}
function matches(item: CatalogItem, query: CatalogQuery, context: CatalogContext, skip?: Facet) {
  const search = query.q.trim().toLocaleLowerCase();
  if (search) {
    const text = [item.product.name, item.product.brand, item.product.category, item.product.country, item.store, storeLabel(item.store), context.words?.(item)].join(' ').toLocaleLowerCase();
    if (!search.split(/\s+/).every((word) => text.includes(word))) return false;
  }
  if (skip !== 'category' && query.category && item.product.category !== query.category) return false;
  if (skip !== 'stores' && query.stores.length && !query.stores.includes(item.store)) return false;
  if (skip !== 'price' && !inBand(item.costs?.total, query.price)) return false;
  if (skip !== 'sizes' && query.sizes.length && !item.sizes.some((size) => query.sizes.includes(size))) return false;
  if (skip !== 'duty' && query.duty && !fitsDutyFree(item, context.dutyLimitUsd)) return false;
  if (skip !== 'sale' && query.sale && !(item.discount > 0)) return false;
  if (skip !== 'fresh' && query.fresh && !item.fresh) return false;
  if (skip !== 'collection' && query.collection && !context.collections?.find((set) => set.id === query.collection)?.productIds.includes(item.product.id)) return false;
  return true;
}

const byTotal = (a: CatalogItem, b: CatalogItem, direction: 1 | -1) => {
  if (!a.costs || !b.costs) return Number(!a.costs) - Number(!b.costs);
  return direction * (a.costs.total - b.costs.total);
};
/** "Recommended": a confirmed price first, then the larger store discount, then the lower delivered total. */
function compare(sort: CatalogSort) {
  return (a: CatalogItem, b: CatalogItem) => {
    if (sort === 'cheap') return byTotal(a, b, 1);
    if (sort === 'expensive') return byTotal(a, b, -1);
    if (sort === 'new' && a.addedAt !== b.addedAt) return b.addedAt - a.addedAt;
    return Number(b.fresh) - Number(a.fresh) || b.discount - a.discount || byTotal(a, b, 1);
  };
}
export function applyCatalogQuery(items: CatalogItem[], query: CatalogQuery, context: CatalogContext) {
  return items.filter((item) => matches(item, query, context)).sort(compare(query.sort));
}

const count = <T extends string>(values: T[]) => {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
};
/**
 * Option counts for every filter: each facet is counted with all other filters applied, so a
 * number always says how many products the catalog shows after choosing that option.
 */
export function catalogFacets(items: CatalogItem[], query: CatalogQuery, context: CatalogContext) {
  const without = (facet: Facet) => items.filter((item) => matches(item, query, context, facet));
  const sizeBase = without('sizes').filter((item) => !query.category || item.product.category === query.category);
  return {
    categories: count(without('category').map((item) => item.product.category)),
    stores: [...count(without('stores').map((item) => item.store))].sort((a, b) => b[1] - a[1] || storeLabel(a[0]).localeCompare(storeLabel(b[0]))),
    prices: count(without('price').flatMap((item) => priceBands.filter((band) => inBand(item.costs?.total, band.id)).map((band) => band.id))),
    sizes: [...count(sizeBase.flatMap((item) => item.sizes))].sort((a, b) => compareSizes(a[0], b[0])),
    duty: without('duty').filter((item) => fitsDutyFree(item, context.dutyLimitUsd)).length,
    sale: without('sale').filter((item) => item.discount > 0).length,
    fresh: without('fresh').filter((item) => item.fresh).length,
    total: items.length,
  };
}

export type FilterKey =
  | { kind: 'category' } | { kind: 'store'; value: string } | { kind: 'price' } | { kind: 'size'; value: string }
  | { kind: 'duty' } | { kind: 'sale' } | { kind: 'fresh' } | { kind: 'collection' } | { kind: 'q' };
export function withoutFilter(query: CatalogQuery, key: FilterKey): CatalogQuery {
  switch (key.kind) {
    case 'category': return { ...query, category: '', sizes: [] };
    case 'store': return { ...query, stores: query.stores.filter((store) => store !== key.value) };
    case 'price': return { ...query, price: '' };
    case 'size': return { ...query, sizes: query.sizes.filter((size) => size !== key.value) };
    case 'duty': return { ...query, duty: false };
    case 'sale': return { ...query, sale: false };
    case 'fresh': return { ...query, fresh: false };
    case 'collection': return { ...query, collection: '' };
    case 'q': return { ...query, q: '' };
  }
}
export function activeFilters(query: CatalogQuery): FilterKey[] {
  return [
    ...(query.q.trim() ? [{ kind: 'q' } as const] : []),
    ...(query.collection ? [{ kind: 'collection' } as const] : []),
    ...(query.category ? [{ kind: 'category' } as const] : []),
    ...query.stores.map((value) => ({ kind: 'store', value } as const)),
    ...(query.price ? [{ kind: 'price' } as const] : []),
    ...query.sizes.map((value) => ({ kind: 'size', value } as const)),
    ...(query.duty ? [{ kind: 'duty' } as const] : []),
    ...(query.sale ? [{ kind: 'sale' } as const] : []),
    ...(query.fresh ? [{ kind: 'fresh' } as const] : []),
  ];
}
/** For an empty result: which single filter to drop, and how many products that brings back (best first). */
export function relaxations(items: CatalogItem[], query: CatalogQuery, context: CatalogContext, limit = 3) {
  return activeFilters(query)
    .map((key) => ({ key, count: applyCatalogQuery(items, withoutFilter(query, key), context).length }))
    .filter((option) => option.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * What this product would add to the cart when its store already has a parcel there: the
 * difference of the cart total with and without it, priced exactly like the cart (one
 * international shipment per store parcel, at least 1 kg). Null when no parcel is shared.
 */
export function parcelExtra(cart: CartItem[], product: Product, usd: number | undefined, pricing: Pricing, now = Date.now()) {
  if (!cart.length || usd === undefined || !(usd > 0) || !product.sourceUrl || product.boxedWeight === undefined) return null;
  const snapshot = { ...product, usd };
  const candidate: CartItem = { id: 'catalog-preview', product: snapshot, variant: product.variants[0] ?? '', quantity: 1, requestedServiceIds: [], quote: quote(usd, product.weight, now, 1, product.sourceShippingUsd ?? 0, pricing) };
  const key = merchantParcelKey(candidate);
  if (!key.startsWith('store:') || !cart.some((item) => merchantParcelKey(item) === key)) return null;
  const total = (items: CartItem[]) => repriceCart(items, now, pricing).reduce((sum, item) => sum + item.quote.total, 0);
  return { store: key.split(':')[1], extra: total([...cart, candidate]) - total(cart) };
}
/** Stores that already have a parcel in the cart. */
export function cartParcelStores(cart: CartItem[]) {
  return [...new Set(cart.map(merchantParcelKey).filter((key) => key.startsWith('store:')).map((key) => key.split(':')[1]))];
}
