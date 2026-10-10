import {declarationFor, dedupeSafeImages, inferProductCategory, type Extracted, type ProductVariant} from './extract.ts';

type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const text = (value: unknown, limit = 140) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim().slice(0, limit) : '';
const types = (value: unknown) => [object(value)['@type']].flat();
const countryByRoot: Record<string, string> = {'zalando.de': 'Германия', 'zalando.es': 'Испания', 'zalando.fr': 'Франция', 'zalando.it': 'Италия'};

function storefront(url: URL) {
  const host = url.hostname.toLowerCase();
  if (host === 'en.zalando.de') return 'zalando.de';
  return host.startsWith('www.') && countryByRoot[host.slice(4)] ? host.slice(4) : host;
}

function article(url: URL) {
  return url.pathname.match(/-([A-Z0-9]+-[A-Z0-9]+)\.html\/?$/i)?.[1].toUpperCase();
}

function query(url: URL) {
  const normalized = new URL(url);
  for (const key of [...normalized.searchParams.keys()]) {
    // `_rfl` is Zalando's language-routing flag. Size is checked separately;
    // any colour/product-defining query remains part of the identity.
    if (key === '_rfl' || key === 'size' || /^(?:utm_.+|gclid|fbclid)$/i.test(key)) normalized.searchParams.delete(key);
  }
  normalized.searchParams.sort();
  return normalized.search;
}

function sameArticle(value: unknown, source: URL, id: string) {
  if (typeof value !== 'string' || !value) return false;
  if (/^https:\/\/[^/?#]*:/i.test(value)) return false;
  try {
    const candidate = new URL(value, source);
    return candidate.protocol === 'https:' && !candidate.username && !candidate.password && !candidate.port
      && storefront(candidate) === storefront(source) && article(candidate) === id && query(candidate) === query(source);
  } catch { return false; }
}

function publishedUrls(record: Json) {
  return [record.url, record['@id'], ...[record.offers].flat().map(value => object(value).url)].filter(value => typeof value === 'string' && value);
}

function publicGroups(html: string) {
  const groups: Json[] = [];
  let scripts = 0, visited = 0;
  const walk = (value: unknown, depth = 0) => {
    if (depth > 10 || visited >= 4000 || groups.length >= 32 || !value || typeof value !== 'object') return;
    visited++;
    if (Array.isArray(value)) {
      for (const item of value) { if (visited >= 4000) break; walk(item, depth + 1); }
      return;
    }
    const record = object(value);
    if (types(record).includes('ProductGroup')) groups.push(record);
    for (const child of Object.values(record)) { if (visited >= 4000) break; walk(child, depth + 1); }
  };
  for (const match of html.slice(0, 3_000_000).matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    if (++scripts > 32 || visited >= 4000) break;
    if (match[1].length > 1_000_000) continue;
    try { walk(JSON.parse(match[1])); } catch { /* Public JSON only; never execute a merchant expression. */ }
  }
  return groups;
}

function amount(value: unknown) {
  if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value.trim())) return undefined;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : undefined;
  return parsed !== undefined && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function offerDetails(record: Json) {
  const offers = [record.offers].flat().filter(value => types(value).includes('Offer')).map(object);
  if (offers.length > 16) return {price: undefined, currency: undefined, available: true, availabilityKnown: false};
  const currencies = [...new Set(offers.map(value => text(value.priceCurrency, 80).toUpperCase()))];
  const currency = currencies.length === 1 && /^[A-Z]{3}$/.test(currencies[0]) ? currencies[0] : undefined;
  const prices = offers.map(value => amount(value.price));
  const price = currency && prices.length && prices.every(value => value !== undefined && value === prices[0]) ? prices[0] : undefined;
  const states = offers.map(value => text(value.availability, 100).replace(/^https?:\/\/schema\.org\//i, '').toLowerCase());
  const allAvailable = states.length > 0 && states.every(value => value === 'instock' || value === 'limitedavailability');
  const allUnavailable = states.length > 0 && states.every(value => ['outofstock', 'soldout', 'discontinued'].includes(value));
  return {price, currency, available: !allUnavailable, availabilityKnown: allAvailable || allUnavailable};
}

/** Exact public Zalando colour group and its own size offers, without a range quote. */
export function extractZalandoProduct(html: string, sourceUrl: string): Extracted | undefined {
  if (/^https:\/\/[^/?#]*:/i.test(sourceUrl)) return;
  let source: URL;
  try { source = new URL(sourceUrl); } catch { return; }
  const root = storefront(source), country = countryByRoot[root], id = article(source);
  if (!country || !id || source.protocol !== 'https:' || source.username || source.password || source.port) return;
  if (source.searchParams.getAll('size').length > 1) return;
  const matching = publicGroups(html).filter(group => text(group.productGroupID, 120).toUpperCase() === id
    && publishedUrls(group).some(value => sameArticle(value, source, id)) && Array.isArray(group.hasVariant));
  if (matching.length !== 1) return;
  const group = matching[0], title = text(group.name), color = text(group.color, 80) || undefined;
  if (!title) return;
  const raw = (group.hasVariant as unknown[]).slice(0, 80);
  const records = raw.flatMap(value => {
    const child = object(value), size = text(child.size, 80), urls = publishedUrls(child);
    if (!types(child).includes('Product') || !size || !urls.length || !urls.every(url => sameArticle(url, source, id))) return [];
    // The URL's published size must agree with the native size label.
    if (!urls.some(value => {
      try { const url = new URL(String(value), source); return url.searchParams.getAll('size').length === 1 && url.searchParams.get('size') === size; } catch { return false; }
    })) return [];
    if (urls.some(value => { try { const published = new URL(String(value), source).searchParams.get('size'); return published !== null && published !== size; } catch { return true; } })) return [];
    const childColor = text(child.color, 80);
    if (childColor && color && childColor !== color) return [];
    return [{child, size, details: offerDetails(child)}];
  });
  const duplicateSizes = new Set<string>();
  const seenSizes = new Set<string>();
  for (const record of records) { if (seenSizes.has(record.size)) duplicateSizes.add(record.size); seenSizes.add(record.size); }
  const sizes = records.filter(record => !duplicateSizes.has(record.size));
  const selectedSize = source.searchParams.get('size'), selected = selectedSize ? sizes.find(record => record.size === selectedSize) : undefined;
  const currencies = new Set(sizes.map(record => record.details.currency));
  const currency = sizes.length && currencies.size === 1 && !currencies.has(undefined) ? sizes[0].details.currency : undefined;
  const missingSelected = selectedSize !== null && !selected;
  const photos = dedupeSafeImages([...[selected?.child.image].flat(), ...[group.image].flat(), ...[sizes[0]?.child.image].flat()], sourceUrl);
  const variants: ProductVariant[] = sizes.map(record => ({
    id: text(record.child.sku, 120) || text(record.child.gtin, 120) || undefined,
    size: record.size, sizeLabel: 'Размер', color,
    label: [color, record.size].filter(Boolean).join(' · '),
    available: record.details.available, availabilityKnown: record.details.availabilityKnown,
    price: currency && !missingSelected ? record.details.price : undefined,
    image: dedupeSafeImages([record.child.image].flat(), sourceUrl)[0] ?? photos[0],
  }));
  const idCounts = new Map<string, number>();
  for (const variant of variants) if (variant.id) idCounts.set(variant.id, (idCounts.get(variant.id) ?? 0) + 1);
  for (const variant of variants) if (variant.id && idCounts.get(variant.id)! > 1) delete variant.id;
  const prices = variants.map(variant => variant.price);
  const completeOptions = raw.length === (group.hasVariant as unknown[]).length && sizes.length === raw.length;
  const sharedPrice = completeOptions && prices.length && prices.every(price => price !== undefined && price === prices[0]) ? prices[0] : undefined;
  const price = currency && !missingSelected ? selected ? selected.details.price : sharedPrice : undefined;
  const brand = text(object(group.brand).name, 80) || text(group.brand, 80) || 'Zalando';
  const category = inferProductCategory(title, brand);
  const warnings = ['Доставка магазина не опубликована — добавлен изменяемый резерв $10.', 'Вес с упаковкой нужно проверить.'];
  if (missingSelected) warnings.push('Размер из ссылки не найден в данных Zalando. Проверьте и подтвердите вариант вручную.');
  else if (!currency) warnings.push('Zalando не подтвердил единую валюту вариантов. Проверьте цену и валюту вручную.');
  else if (price === undefined) warnings.push('Выберите размер, чтобы получить его точную цену.');
  if (variants.some(variant => !variant.availabilityKnown)) warnings.push('Наличие отдельных размеров магазин не подтвердил.');
  return {sku: selected ? text(selected.child.sku, 120) || undefined : id, title, brand, category,
    declarationDescription: declarationFor(category, title, brand), image: photos[0], images: photos,
    selectedVariantColor: color, price, currency, variants, country, sourceUrl, warnings, method: 'Zalando public size offers'};
}
