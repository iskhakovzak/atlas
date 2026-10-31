import { quote, repriceCart, merchantParcelKey, type CartItem, type Pricing, type Product } from './domain.ts';
import { dealQuote } from './deals.ts';
import type { MerchantFind } from './catalog.ts';
import { brandForHost, storefrontLabel } from './store-brands.ts';
import { normalizeSearch, wordMatches } from './catalog-synonyms.ts';
import type { Locale } from './i18n.ts';
import { compareSizes, letterSizes } from './size-order.ts';
import type { CatalogFacets, FacetKey } from './catalog-facets.ts';

// Shared with the link-order page, which must not load the catalog: lib/market/size-order.ts.
export { compareSizes };

/** Catalog categories as stored in product snapshots, with the URL slug of each. */
export const categorySlugs: Record<string, string> = {
  'Обувь': 'shoes', 'Одежда': 'clothing', 'Электроника': 'electronics', 'Аксессуары': 'accessories',
  'Красота и уход': 'beauty', 'Дом и быт': 'home', 'Спорт': 'sport', 'Другое': 'other',
};
const categoryBySlug = new Map(Object.entries(categorySlugs).map(([value, slug]) => [slug, value]));
/** Sizes are offered only where a size means the same thing across products: shoes on one scale, clothes and accessories on another. */
export const sizedCategories = new Set(['Обувь', 'Одежда', 'Аксессуары']);
export type SizeGroup = 'shoes' | 'clothes';
/** Which size list a product's sizes belong to; none outside the sized categories (a phone's "128GB" is not a size). */
export const sizeGroupOf = (item: { product: { category: string } }): SizeGroup | undefined => item.product.category === 'Обувь' ? 'shoes' : sizedCategories.has(item.product.category) ? 'clothes' : undefined;
/** A chosen size carries its list (`shoes:10`, `clothes:M`): shoe size 10 and trouser size 10 are different filters. */
export const sizeKey = (group: SizeGroup, size: string) => group + ':' + size;
/** The list and size of a chosen value; an old unprefixed `?size=9` has no list and matches either. */
export function parseSizeKey(value: string): { group?: SizeGroup; size: string } {
  const match = /^(shoes|clothes):(.+)$/.exec(value);
  return match ? { group: match[1] as SizeGroup, size: match[2] } : { size: value };
}
/** The product lists one of the chosen sizes in its own list (`own`: every listed size, or those in stock). */
export function sizeMatches(item: { product: { category: string } }, own: string[], chosen: string[]) {
  const group = sizeGroupOf(item);
  return Boolean(group) && chosen.some((value) => { const key = parseSizeKey(value); return (!key.group || key.group === group) && own.includes(key.size); });
}
/** Whether a size chip of a list is on (an old unprefixed value counts for both lists). */
export const sizeChosen = (chosen: string[], group: SizeGroup, size: string) => chosen.includes(sizeKey(group, size)) || chosen.includes(size);
/** The chosen sizes with one chip of a list switched; an old unprefixed value is dropped rather than doubled. */
export function toggleSize(chosen: string[], group: SizeGroup, size: string) {
  const key = sizeKey(group, size);
  if (chosen.includes(key)) return chosen.filter((value) => value !== key);
  if (chosen.includes(size)) return chosen.filter((value) => value !== size);
  return [...chosen, key];
}

/** The old delivered-total bands (`?price=to-300k`): links that carry one open as the matching range. */
export const priceBands = [
  { id: 'to-300k', max: 300_000 },
  { id: '300k-600k', min: 300_000, max: 600_000 },
  { id: '600k-1m', min: 600_000, max: 1_000_000 },
  { id: '1m-2m', min: 1_000_000, max: 2_000_000 },
  { id: 'from-2m', min: 2_000_000 },
] as const;
export type PriceBand = (typeof priceBands)[number]['id'];

export type CatalogSort = 'best' | 'cheap' | 'expensive' | 'discount' | 'new';
const sorts = new Set<CatalogSort>(['best', 'cheap', 'expensive', 'discount', 'new']);
/** Attribute filters from the products' derived facets, as `?for=men&type=socks&color=black,white`. */
export const attrParams: Record<FacetKey, string> = { department: 'for', type: 'type', sport: 'sport', material: 'mat', fit: 'fit', closure: 'cl', sleeve: 'sl', pack: 'pack', storage: 'mem', volume: 'vol', color: 'color' };
export const attrKeys = Object.keys(attrParams) as FacetKey[];
export type AttrQuery = Partial<Record<FacetKey, string[]>>;
/** Discount thresholds: 1 is "any store discount", the rest are "at least N %". */
export const discountSteps = [1, 30, 50, 70] as const;
export const perPageOptions = [12, 24, 48, 96, 192] as const;
export const defaultPerPage = 24;
export type CatalogQuery = {
  q: string; categories: string[]; stores: string[]; brands: string[]; sizes: string[]; attrs: AttrQuery;
  /** Delivered total in soum, both ends inclusive; 0 is "no bound". */
  priceMin: number; priceMax: number;
  discount: number; duty: boolean; fresh: boolean;
  /** Only with a size chosen: that size is available at the store now. */
  stock: boolean;
  sort: CatalogSort; collection: string; page: number; per: number;
};
export const emptyCatalogQuery: CatalogQuery = { q: '', categories: [], stores: [], brands: [], sizes: [], attrs: {}, priceMin: 0, priceMax: 0, discount: 0, duty: false, fresh: false, stock: false, sort: 'best', collection: '', page: 1, per: defaultPerPage };

const list = (value: string | null, max: number) => [...new Set((value ?? '').split(',').map((item) => item.trim()).filter((item) => item && item.length <= 60))].slice(0, max);
const slugValue = /^[a-z0-9][a-z0-9.-]{0,39}$/;
const ownParams = ['q', 'cat', 'store', 'brand', 'price', 'size', 'off', 'duty', 'sale', 'fresh', 'stock', 'sort', 'set', 'page', 'per', ...Object.values(attrParams)];
const int = (value: string | null) => /^\d{1,10}$/.test(value ?? '') ? Number(value) : 0;

/** `?price=300000-600000`, an open end (`-300000`, `300000-`), or an old band id. */
function readPrice(value: string) {
  const band = priceBands.find((item) => item.id === value);
  if (band) return { min: 'min' in band ? band.min : 0, max: 'max' in band ? band.max : 0 };
  const match = /^(\d{0,10})-(\d{0,10})$/.exec(value);
  if (!match) return { min: 0, max: 0 };
  const min = Number(match[1] || 0), max = Number(match[2] || 0);
  return max && min > max ? { min: max, max: min } : { min, max };
}

/** Reads the catalog parameters (`ownParams`); unknown values are dropped. */
export function readCatalogQuery(input: URLSearchParams | string | Record<string, string | string[] | undefined>): CatalogQuery {
  const params = input instanceof URLSearchParams ? input : typeof input === 'string' ? new URLSearchParams(input) : new URLSearchParams(Object.entries(input).flatMap(([key, value]) => typeof value === 'string' ? [[key, value]] : Array.isArray(value) && value[0] !== undefined ? [[key, value[0]]] : []));
  const sort = params.get('sort') as CatalogSort | null;
  const collection = params.get('set') ?? '';
  const off = int(params.get('off'));
  const price = readPrice(params.get('price') ?? '');
  const sizes = list(params.get('size'), 12);
  const per = int(params.get('per'));
  const attrs: AttrQuery = {};
  for (const key of attrKeys) { const values = list(params.get(attrParams[key]), 12).map((value) => value.toLowerCase()).filter((value) => slugValue.test(value)); if (values.length) attrs[key] = values; }
  return {
    q: (params.get('q') ?? '').slice(0, 80),
    categories: [...new Set(list(params.get('cat'), 8).map((slug) => categoryBySlug.get(slug)).filter((category): category is string => Boolean(category)))],
    stores: list(params.get('store'), 12).map((store) => store.toLowerCase()),
    brands: list(params.get('brand'), 12).map((brand) => brand.toLowerCase()),
    sizes, attrs,
    priceMin: price.min, priceMax: price.max,
    discount: off > 1 && (discountSteps as readonly number[]).includes(off) ? off : params.get('sale') === '1' ? 1 : 0,
    duty: params.get('duty') === '1', fresh: params.get('fresh') === '1', stock: sizes.length > 0 && params.get('stock') === '1',
    sort: sort && sorts.has(sort) ? sort : 'best',
    collection: /^[\w-]{1,80}$/.test(collection) ? collection : '',
    page: Math.min(Math.max(1, int(params.get('page'))), 10_000),
    per: (perPageOptions as readonly number[]).includes(per) ? per : defaultPerPage,
  };
}

/** The query as URL parameters in a fixed order; defaults are omitted and other parameters (such as `lang`) kept. */
export function catalogQueryString(query: CatalogQuery, keep?: URLSearchParams) {
  const params = new URLSearchParams();
  for (const [key, value] of keep ?? []) if (!ownParams.includes(key)) params.set(key, value);
  if (query.q.trim()) params.set('q', query.q.trim());
  const cats = query.categories.map((category) => categorySlugs[category]).filter(Boolean);
  if (cats.length) params.set('cat', cats.join(','));
  if (query.stores.length) params.set('store', query.stores.join(','));
  if (query.brands.length) params.set('brand', query.brands.join(','));
  if (query.priceMin || query.priceMax) params.set('price', (query.priceMin || '') + '-' + (query.priceMax || ''));
  if (query.sizes.length) params.set('size', query.sizes.join(','));
  for (const key of attrKeys) if (query.attrs[key]?.length) params.set(attrParams[key], query.attrs[key]!.join(','));
  if (query.discount === 1) params.set('sale', '1'); else if (query.discount > 1) params.set('off', String(query.discount));
  if (query.duty) params.set('duty', '1');
  if (query.fresh) params.set('fresh', '1');
  if (query.stock && query.sizes.length) params.set('stock', '1');
  if (query.sort !== 'best') params.set('sort', query.sort);
  if (query.collection) params.set('set', query.collection);
  if (query.page > 1) params.set('page', String(query.page));
  if (query.per !== defaultPerPage) params.set('per', String(query.per));
  const text = params.toString();
  return text ? '?' + text : '';
}

/** Chosen filter values (every category, size, colour… counts once); the search, sort and page do not. */
export function activeFilterCount(query: CatalogQuery) {
  return activeFilters(query).filter((key) => key.kind !== 'q').length;
}

export function storeHost(product: Product & { store?: string }) {
  try { if (product.sourceUrl) return new URL(product.sourceUrl).hostname.toLowerCase().replace(/^www\./, ''); } catch { /* fall back to the label */ }
  return (product.store ?? '').toLowerCase();
}
/** A store URL as compared between the catalog and the cart: lower-case host without "www.", no hash, no tracking parameters, sorted query. */
export function catalogUrlKey(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    for (const key of [...url.searchParams.keys()]) if (/^(utm_.+|gclid|fbclid)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.href;
  } catch { return value.trim(); }
}
/**
 * The same store product in the cart and in the catalog. The link order keys a cart line by URL and
 * option (`<url>#<option>`), so the ids differ; the source URL is what both share.
 */
export function sameCatalogProduct(a: Pick<Product, 'id' | 'sourceUrl'>, b: Pick<Product, 'id' | 'sourceUrl'>) {
  if (a.id === b.id && (a.sourceUrl ?? '') === (b.sourceUrl ?? '')) return true;
  return Boolean(a.sourceUrl && b.sourceUrl) && catalogUrlKey(a.sourceUrl!) === catalogUrlKey(b.sourceUrl!);
}
/** The store's brand name ("Amazon", "Amazon · Germany" for another storefront), otherwise its domain. */
export function storeLabel(host: string, locale: Locale = 'ru') {
  return brandForHost(host) ? storefrontLabel(host, locale) : host;
}

/** "US 9" and "9" from different US stores are the same size; letter sizes are upper-cased. */
export function normalizeSize(raw: string | undefined) {
  const value = (raw ?? '').replace(/\s+/g, ' ').trim().replace(/^US\s*/i, '').replace(/^(\d+),(\d)$/, '$1.$2');
  if (!value || value.length > 24) return '';
  const [first, ...rest] = value.split(' ');
  return letterSizes.includes(first.toUpperCase()) ? [first.toUpperCase(), ...rest].join(' ') : value;
}
/** Sizes the store lists; a size the store marked unavailable is left out. */
export function productSizes(product: Product) {
  const sizes = (product.sourceVariants ?? [])
    .filter((variant) => variant.available || variant.availabilityKnown === false)
    .map((variant) => normalizeSize(variant.size))
    .filter(Boolean);
  return [...new Set(sizes)].sort(compareSizes);
}

/** Sizes the store reports as available now (a size of unknown availability is left out). */
export function productStockSizes(product: Product) {
  const sizes = (product.sourceVariants ?? [])
    .filter((variant) => variant.available && variant.availabilityKnown !== false && variant.quantity !== 0)
    .map((variant) => normalizeSize(variant.size))
    .filter(Boolean);
  return [...new Set(sizes)].sort(compareSizes);
}
const facetText = (value: unknown) => typeof value === 'string' && slugValue.test(value) ? [value] : [];
/** Filter values of a product from its derived facets (`product.facets`, set at import); none when it has no facets yet. */
export function productAttrs(product: Product): AttrQuery {
  const facets = (product as { facets?: Partial<CatalogFacets> }).facets;
  if (!facets || typeof facets !== 'object') return {};
  const attrs: AttrQuery = {};
  for (const key of attrKeys) {
    const raw = key === 'color' ? facets.colors : key === 'pack' ? (typeof facets.pack === 'number' && facets.pack >= 2 ? String(facets.pack) : undefined) : facets[key];
    const values = Array.isArray(raw) ? [...new Set(raw.flatMap(facetText))] : facetText(raw);
    if (values.length) attrs[key] = values;
  }
  return attrs;
}

/** A published catalog record priced for the storefront; `product` keeps the record's own fields (`rank`, `confirmedAt`, `sourceCheckedAt`). */
export type CatalogItem = Omit<ReturnType<typeof dealQuote>, 'product'> & {
  product: MerchantFind;
  /** Product price in USD for the duty-free check: the current price, or the last recorded one. */
  usd?: number;
  store: string; sizes: string[]; fresh: boolean; addedAt: number;
  /** Sizes available at the store now (for "size in stock"). */
  stockSizes: string[];
  /** The brand in lower case (the filter key); empty when unknown. */
  brand: string;
  /** Attribute filter values from the product's facets. */
  attrs: AttrQuery;
  /** The operator's position on the storefront (lower first); unranked products follow the ranked ones. */
  rank?: number;
  /** When the store last confirmed the snapshot (`sourceCheckedAt`), else the day it was observed. */
  checkedAt: number;
  /** «Топ-цена»: the server marked the product as one of the catalogue's best deals (lib/market/top-deal.ts). Set only when true. */
  topDeal?: true;
};

/**
 * Catalog items priced for the storefront. `records` are the records whose `referenceUsd` gives the
 * store discount: by default the products themselves, so an imported snapshot's discount shows too.
 */
export function catalogItems(products: MerchantFind[], pricing: Pricing, records: MerchantFind[] = products): CatalogItem[] {
  const items: CatalogItem[] = products.map((product) => {
    const deal = dealQuote(product, pricing, records);
    const usd = deal.costs ? deal.costs.merchandise / pricing.fx : undefined;
    const addedAt = product.addedAt ?? (Date.parse(product.observedOn ?? '') || 0);
    const checkedAt = product.sourceCheckedAt ?? (Date.parse(product.observedOn ?? '') || 0);
    // `rank` is spread in only when set, so items without a position compare deep-equal to the plain shape.
    return { ...deal, product, usd, store: storeHost(product), sizes: productSizes(product), stockSizes: productStockSizes(product), brand: (product.brand ?? '').trim().toLowerCase().slice(0, 60), attrs: productAttrs(product), fresh: !product.priceNeedsConfirmation, addedAt, checkedAt, ...(product.rank !== undefined ? { rank: product.rank } : {}), ...(product.topDeal === true ? { topDeal: true as const } : {}) };
  });
  return items;
}

export type CatalogContext = {
  /** USD the recipient can still import duty-free this month (the full allowance for guests). */
  dutyLimitUsd: number;
  collections?: { id: string; productIds: string[] }[];
  /** Extra searchable words for an item, such as its translated category. */
  words?: (item: CatalogItem) => string;
};
type Facet = 'category' | 'stores' | 'brands' | 'price' | 'sizes' | 'discount' | 'duty' | 'fresh' | 'stock' | 'collection' | `attr:${FacetKey}`;

export function fitsDutyFree(item: CatalogItem, limitUsd: number) {
  return item.usd !== undefined && item.usd <= limitUsd + 1e-9;
}
/** "Men" and "Women" include unisex products; every other value matches itself. */
function attrMatches(item: CatalogItem, key: FacetKey, wanted: string[]) {
  const own = item.attrs[key];
  if (!own) return false;
  return wanted.some((value) => own.includes(value) || (key === 'department' && (value === 'men' || value === 'women') && own.includes('unisex')));
}
const inPrice = (item: CatalogItem, query: CatalogQuery) => {
  if (!query.priceMin && !query.priceMax) return true;
  const total = item.costs?.total;
  return total !== undefined && total >= query.priceMin && (!query.priceMax || total <= query.priceMax);
};
function searchMatches(item: CatalogItem, search: string, context: CatalogContext) {
  if (!search) return true;
  const text = normalizeSearch([item.product.name, item.product.brand, item.product.category, item.product.country, item.store, storeLabel(item.store), context.words?.(item)].join(' '));
  return search.split(' ').every((word) => wordMatches(text, word));
}
/** Every filter except the search (applied once, before) and the one being counted (`skip`). */
function matches(item: CatalogItem, query: CatalogQuery, context: CatalogContext, skip?: Facet) {
  if (skip !== 'category' && query.categories.length && !query.categories.includes(item.product.category)) return false;
  if (skip !== 'stores' && query.stores.length && !query.stores.includes(item.store)) return false;
  if (skip !== 'brands' && query.brands.length && !query.brands.includes(item.brand)) return false;
  if (skip !== 'price' && !inPrice(item, query)) return false;
  if (skip !== 'sizes' && query.sizes.length && !sizeMatches(item, query.stock && skip !== 'stock' ? item.stockSizes : item.sizes, query.sizes)) return false;
  for (const key of attrKeys) if (skip !== `attr:${key}` && query.attrs[key]?.length && !attrMatches(item, key, query.attrs[key]!)) return false;
  if (skip !== 'discount' && query.discount && !(item.discount >= query.discount)) return false;
  if (skip !== 'duty' && query.duty && !fitsDutyFree(item, context.dutyLimitUsd)) return false;
  if (skip !== 'fresh' && query.fresh && !item.fresh) return false;
  if (skip !== 'collection' && query.collection && !context.collections?.find((set) => set.id === query.collection)?.productIds.includes(item.product.id)) return false;
  return true;
}
const searched = (items: CatalogItem[], query: CatalogQuery, context: CatalogContext) => {
  const search = normalizeSearch(query.q);
  return search ? items.filter((item) => searchMatches(item, search, context)) : items;
};

const byTotal = (a: CatalogItem, b: CatalogItem, direction: 1 | -1) => {
  if (!a.costs || !b.costs) return Number(!a.costs) - Number(!b.costs);
  return direction * (a.costs.total - b.costs.total);
};
/** Ranked products first, in rank order; unranked ones keep their place after them. */
const byRank = (a: CatalogItem, b: CatalogItem) => {
  if (a.rank === undefined || b.rank === undefined) return Number(a.rank === undefined) - Number(b.rank === undefined);
  return a.rank - b.rank;
};
/** "Recommended": the operator's storefront position, then a confirmed price, then the larger store discount, then the lower delivered total. */
function compare(sort: CatalogSort) {
  return (a: CatalogItem, b: CatalogItem) => {
    if (sort === 'cheap') return byTotal(a, b, 1);
    if (sort === 'expensive') return byTotal(a, b, -1);
    if (sort === 'discount') return b.discount - a.discount || byTotal(a, b, 1);
    if (sort === 'new' && a.addedAt !== b.addedAt) return b.addedAt - a.addedAt;
    return byRank(a, b) || Number(b.fresh) - Number(a.fresh) || b.discount - a.discount || byTotal(a, b, 1);
  };
}
export function applyCatalogQuery(items: CatalogItem[], query: CatalogQuery, context: CatalogContext) {
  return searched(items, query, context).filter((item) => matches(item, query, context)).sort(compare(query.sort));
}

/** One page of the result; a page past the end shows the last one. */
export function paginate<T>(list: T[], page: number, per: number) {
  const pages = Math.max(1, Math.ceil(list.length / per));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const start = (current - 1) * per;
  return { page: current, pages, start, end: Math.min(start + per, list.length), items: list.slice(start, start + per) };
}
/** Page links: the first, the last and two around the current one, with gaps ("‹ 1 … 4 5 6 … 26 ›"). */
export function pageNumbers(page: number, pages: number): (number | 'gap')[] {
  const shown = new Set([1, pages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= pages));
  // A gap of one page shows that page instead.
  for (const value of [...shown]) { if (shown.has(value + 2) && !shown.has(value + 1)) shown.add(value + 1); }
  const sorted = [...shown].sort((a, b) => a - b);
  return sorted.flatMap((value, index) => index && value - sorted[index - 1] > 1 ? ['gap' as const, value] : [value]);
}

const count = <T extends string | number>(values: T[]) => {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
};
/** A group shows when it splits its products (some value covers part of them) and at least this share has a value. */
export const facetMinCoverage = 0.2;
export type AttrFacet = { values: [string, number][]; covered: number; base: number; visible: boolean };
/** Hidden unless chosen: no value covers only part of the base, or under 20 % of the base has data for the group. */
export function facetGroupVisible(values: [string, number][], covered: number, base: number, chosen = 0) {
  if (chosen > 0) return true;
  if (!base || covered / base < facetMinCoverage) return false;
  return values.some(([, value]) => value > 0 && value < base);
}
/**
 * Option counts for every filter: each facet is counted with all other filters applied, so a
 * number always says how many products the catalog shows after choosing that option. The search
 * runs once; every group is one more pass over the searched products.
 */
export function catalogFacets(items: CatalogItem[], query: CatalogQuery, context: CatalogContext) {
  const pool = searched(items, query, context);
  const without = (facet: Facet) => pool.filter((item) => matches(item, query, context, facet));
  // Only products of the sized categories count: their sizes, and their share for the 20 % rule.
  const sizeBase = without('sizes').filter((item) => (!query.categories.length || query.categories.includes(item.product.category)) && sizeGroupOf(item));
  const sizeCounts = { shoes: new Map<string, number>(), clothes: new Map<string, number>() };
  for (const item of sizeBase) for (const size of query.stock ? item.stockSizes : item.sizes) { const map = sizeCounts[sizeGroupOf(item)!]; map.set(size, (map.get(size) ?? 0) + 1); }
  const sorted = (map: Map<string, number>) => [...map].sort((a, b) => compareSizes(a[0], b[0]));
  const brandNames = new Map<string, string>();
  for (const item of items) if (item.brand && !brandNames.has(item.brand)) brandNames.set(item.brand, (item.product.brand ?? '').trim());
  const priceBase = without('price').map((item) => item.costs?.total).filter((total): total is number => total !== undefined);
  const discountBase = without('discount');
  const attrs = {} as Record<FacetKey, AttrFacet>;
  for (const key of attrKeys) {
    const base = without(`attr:${key}`);
    const values = count(base.flatMap((item) => item.attrs[key] ?? []));
    // "Men"/"Women" count the unisex products they also show.
    if (key === 'department') { const unisex = values.get('unisex') ?? 0; for (const value of ['men', 'women']) if (values.has(value)) values.set(value, values.get(value)! + unisex); }
    const covered = base.filter((item) => item.attrs[key]?.length).length;
    const list = [...values].sort((a, b) => b[1] - a[1]);
    attrs[key] = { values: list, covered, base: base.length, visible: facetGroupVisible(list, covered, base.length, query.attrs[key]?.length ?? 0) };
  }
  const sizedItems = sizeBase.filter((item) => item.sizes.length).length;
  return {
    categories: count(without('category').map((item) => item.product.category)),
    stores: [...count(without('stores').map((item) => item.store))].sort((a, b) => b[1] - a[1] || storeLabel(a[0]).localeCompare(storeLabel(b[0]))),
    brands: [...count(without('brands').map((item) => item.brand).filter(Boolean))].map(([brand, value]) => [brand, brandNames.get(brand) || brand, value] as [string, string, number]).sort((a, b) => b[2] - a[2] || a[1].localeCompare(b[1])),
    sizes: { shoes: sorted(sizeCounts.shoes), clothes: sorted(sizeCounts.clothes), visible: query.sizes.length > 0 || (sizeBase.length > 0 && sizedItems / sizeBase.length >= facetMinCoverage && sizeCounts.shoes.size + sizeCounts.clothes.size > 0) },
    attrs,
    price: { min: priceBase.length ? Math.min(...priceBase) : 0, max: priceBase.length ? Math.max(...priceBase) : 0, count: priceBase.length },
    discounts: new Map(discountSteps.map((step) => [step, discountBase.filter((item) => item.discount >= step).length])),
    discountBase: discountBase.length,
    duty: without('duty').filter((item) => fitsDutyFree(item, context.dutyLimitUsd)).length,
    fresh: without('fresh').filter((item) => item.fresh).length,
    stock: query.sizes.length ? without('stock').filter((item) => sizeMatches(item, item.stockSizes, query.sizes)).length : 0,
    total: items.length,
  };
}
export type CatalogFacetCounts = ReturnType<typeof catalogFacets>;

/** Quick chips under the search: one tap sets one common filter. Shown only when it narrows the pool without emptying it. */
export type QuickChip =
  | { id: string; kind: 'category'; value: string; count: number }
  | { id: string; kind: 'attr'; key: FacetKey; value: string; count: number }
  | { id: string; kind: 'discount'; value: number; count: number }
  | { id: string; kind: 'priceMax'; value: number; count: number }
  | { id: string; kind: 'collection'; value: string; count: number };
export const quickPriceMax = 300_000;
export function quickChips(pool: CatalogItem[], context: CatalogContext): QuickChip[] {
  const total = pool.length;
  const categories = [...count(pool.map((item) => item.product.category))].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const chips: QuickChip[] = [
    ...categories.map(([value, n]) => ({ id: 'cat:' + value, kind: 'category' as const, value, count: n })),
    ...['men', 'women', 'kids'].map((value) => ({ id: 'for:' + value, kind: 'attr' as const, key: 'department' as const, value, count: pool.filter((item) => attrMatches(item, 'department', [value])).length })),
    { id: 'off:50', kind: 'discount', value: 50, count: pool.filter((item) => item.discount >= 50).length },
    { id: 'price', kind: 'priceMax', value: quickPriceMax, count: pool.filter((item) => item.costs && item.costs.total <= quickPriceMax).length },
    ...(context.collections ?? []).map((set) => ({ id: 'set:' + set.id, kind: 'collection' as const, value: set.id, count: pool.filter((item) => set.productIds.includes(item.product.id)).length })),
  ];
  return chips.filter((chip) => chip.count > 0 && chip.count < total);
}
export function quickChipActive(query: CatalogQuery, chip: QuickChip) {
  switch (chip.kind) {
    case 'category': return query.categories.includes(chip.value);
    case 'attr': return Boolean(query.attrs[chip.key]?.includes(chip.value));
    case 'discount': return query.discount === chip.value;
    case 'priceMax': return query.priceMax === chip.value && !query.priceMin;
    case 'collection': return query.collection === chip.value;
  }
}
const toggled = (list: string[], value: string) => list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
/** The query with the chip's value added or (when it is on) removed; other filters stay. */
export function toggleQuickChip(query: CatalogQuery, chip: QuickChip): CatalogQuery {
  const on = quickChipActive(query, chip);
  switch (chip.kind) {
    case 'category': return { ...query, categories: toggled(query.categories, chip.value) };
    case 'attr': return { ...query, attrs: { ...query.attrs, [chip.key]: toggled(query.attrs[chip.key] ?? [], chip.value) } };
    case 'discount': return { ...query, discount: on ? 0 : chip.value };
    case 'priceMax': return { ...query, priceMin: 0, priceMax: on ? 0 : chip.value };
    case 'collection': return { ...query, collection: on ? '' : chip.value };
  }
}

export type FilterKey =
  | { kind: 'category'; value: string } | { kind: 'store'; value: string } | { kind: 'brand'; value: string } | { kind: 'price' } | { kind: 'size'; value: string }
  | { kind: 'attr'; key: FacetKey; value: string } | { kind: 'discount' }
  | { kind: 'duty' } | { kind: 'fresh' } | { kind: 'stock' } | { kind: 'collection' } | { kind: 'q' };
export function withoutFilter(query: CatalogQuery, key: FilterKey): CatalogQuery {
  switch (key.kind) {
    // Sizes belong to the categories they were picked in: dropping a category drops them too.
    case 'category': return { ...query, categories: query.categories.filter((category) => category !== key.value), sizes: [], stock: false };
    case 'store': return { ...query, stores: query.stores.filter((store) => store !== key.value) };
    case 'brand': return { ...query, brands: query.brands.filter((brand) => brand !== key.value) };
    case 'price': return { ...query, priceMin: 0, priceMax: 0 };
    case 'size': { const sizes = query.sizes.filter((size) => size !== key.value); return { ...query, sizes, stock: query.stock && sizes.length > 0 }; }
    case 'attr': { const attrs = { ...query.attrs, [key.key]: (query.attrs[key.key] ?? []).filter((value) => value !== key.value) }; if (!attrs[key.key]!.length) delete attrs[key.key]; return { ...query, attrs }; }
    case 'discount': return { ...query, discount: 0 };
    case 'duty': return { ...query, duty: false };
    case 'fresh': return { ...query, fresh: false };
    case 'stock': return { ...query, stock: false };
    case 'collection': return { ...query, collection: '' };
    case 'q': return { ...query, q: '' };
  }
}
export function activeFilters(query: CatalogQuery): FilterKey[] {
  return [
    ...(query.q.trim() ? [{ kind: 'q' } as const] : []),
    ...(query.collection ? [{ kind: 'collection' } as const] : []),
    ...query.categories.map((value) => ({ kind: 'category', value } as const)),
    ...attrKeys.flatMap((key) => (query.attrs[key] ?? []).map((value) => ({ kind: 'attr', key, value } as const))),
    ...query.sizes.map((value) => ({ kind: 'size', value } as const)),
    ...(query.discount ? [{ kind: 'discount' } as const] : []),
    ...(query.priceMin || query.priceMax ? [{ kind: 'price' } as const] : []),
    ...query.brands.map((value) => ({ kind: 'brand', value } as const)),
    ...query.stores.map((value) => ({ kind: 'store', value } as const)),
    ...(query.duty ? [{ kind: 'duty' } as const] : []),
    ...(query.fresh ? [{ kind: 'fresh' } as const] : []),
    ...(query.stock && query.sizes.length ? [{ kind: 'stock' } as const] : []),
  ];
}
/** A stable key for a filter chip. */
export const filterId = (key: FilterKey) => key.kind + (key.kind === 'attr' ? ':' + key.key : '') + ('value' in key ? ':' + key.value : '');
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
