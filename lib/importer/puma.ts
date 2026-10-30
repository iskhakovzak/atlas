import type {Extracted, ProductVariant} from './extract.ts';

// PUMA US draws the size buttons in the browser: the page carries colours and prices, and the sizes with their stock come
// from the store's own GraphQL after a guest sign-in (29 October 2026). Two small POSTs to https://us.puma.com/api/graphql.
export const PUMA_GRAPHQL = 'https://us.puma.com/api/graphql';
const GUEST_LOGON = 'mutation GuestLogon { guestLogon { accessToken } }';
const SIZES = 'query LazyPDP($id: ID!) { product(id: $id) { id variations { id colorValue colorName sizeGroups { label sizes { label productId orderable } } } } }';

type RecordData = Record<string, unknown>;
const record = (value: unknown): RecordData => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordData : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** The master id of a us.puma.com product page (`/us/en/pd/<slug>/<id>`), or undefined for any other link. */
export function pumaProductId(url: URL) {
  if (url.hostname !== 'us.puma.com' || url.protocol !== 'https:') return undefined;
  return url.pathname.match(/^\/us\/en\/pd\/[^/]+\/(\d{5,8})\/?$/)?.[1];
}

export function pumaHeaders(token?: string): Record<string, string> {
  return {
    accept: 'application/graphql-response+json, application/json',
    'content-type': 'application/json',
    locale: 'en-US',
    'x-graphql-client-name': 'nitro-fe',
    origin: 'https://us.puma.com',
    referer: 'https://us.puma.com/us/en',
    ...(token ? {authorization: `Bearer ${token}`} : {}),
  };
}

export const pumaGuestLogonBody = () => JSON.stringify({operationName: 'GuestLogon', query: GUEST_LOGON, variables: {}});
export const pumaSizesBody = (id: string) => JSON.stringify({operationName: 'LazyPDP', query: SIZES, variables: {id}});

export function pumaGuestToken(payload: unknown) {
  const token = text(record(record(record(payload).data).guestLogon).accessToken);
  return /^[\w.-]{20,4000}$/.test(token) ? token : undefined;
}

/**
 * Turns the page's colour variants into colour × size variants with the store's own stock answer ("orderable").
 * Colours the GraphQL answer does not cover keep their colour-only variant; anything unexpected keeps the page result.
 */
export function applyPumaSizes(extracted: Extracted, payload: unknown, id: string): Extracted {
  const product = record(record(record(payload).data).product);
  if (String(product.id) !== id || !Array.isArray(product.variations) || !extracted.variants?.length) return extracted;
  const byColor = new Map<string, {size: string; productId?: string; orderable?: boolean}[]>();
  const ambiguousColors = new Set<string>();
  let incomplete = product.variations.length > 80;
  for (const variation of product.variations.slice(0, 80).map(record)) {
    const groups = Array.isArray(variation.sizeGroups) ? variation.sizeGroups.map(record) : [];
    if (groups.some(group => Array.isArray(group.sizes) && group.sizes.length > 80)) incomplete = true;
    // Two or more groups (e.g. "Men" and "Women") keep their label on the size; one group needs none.
    const named = groups.filter(group => text(group.label)).length > 1;
    const sizes = groups.flatMap(group => (Array.isArray(group.sizes) ? group.sizes : []).slice(0, 80).map(record).map(size => ({
      size: named ? `${text(group.label)} ${text(size.label)}` : text(size.label),
      productId: text(size.productId) || undefined, orderable: typeof size.orderable === 'boolean' ? size.orderable : undefined,
    }))).filter(size => size.size);
    const color = text(variation.colorName);
    if (color && sizes.length) {
      if (byColor.has(color)) ambiguousColors.add(color);
      else byColor.set(color, sizes);
    }
  }
  // A repeated display name can identify two distinct swatches; guessing would attach the wrong SKU, price and photo.
  for (const color of ambiguousColors) byColor.delete(color);
  const pageColorCounts = new Map<string, number>();
  for (const variant of extracted.variants) if (variant.color)
    pageColorCounts.set(variant.color, (pageColorCounts.get(variant.color) ?? 0) + 1);
  for (const [color, count] of pageColorCounts) if (count > 1) byColor.delete(color);
  if (!byColor.size) return extracted;
  const variants: ProductVariant[] = [];
  for (const variant of extracted.variants) {
    const sizes = variant.color ? byColor.get(variant.color) : undefined;
    if (!sizes) { variants.push(variant); incomplete = true; continue; }
    for (const size of sizes) {
      if (variants.length >= 250) { incomplete = true; break; }
      if (size.orderable === undefined) incomplete = true;
      variants.push({
      // us.puma.com sells in US sizes; the label says so instead of a bare "10.5".
      ...variant, id: size.productId ?? variant.id, productId: size.productId, size: size.size, sizeLabel: 'Size US', label: `${variant.color} / ${size.size}`,
      available: size.orderable === undefined ? variant.available : variant.available && size.orderable,
      availabilityKnown: size.orderable !== undefined,
    });
    }
    if (variants.length >= 250) { incomplete = true; break; }
  }
  return {...extracted, variants, method: 'PUMA public product data + sizes',
    variantsComplete: incomplete ? false : extracted.variantsComplete,
    warnings: incomplete ? extracted.warnings : extracted.warnings.filter(warning => !warning.startsWith('PUMA опубликовал цвета, но не наличие размеров'))};
}
