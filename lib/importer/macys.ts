import type { Extracted, ProductCategory, ProductVariant } from './extract.ts';

type RecordValue = Record<string, unknown>;
type MacyHelpers = {
  safeImage: (value: unknown, base: string) => string | undefined;
  inferCategory: (title: string, brand: string) => ProductCategory;
  declarationFor: (category: ProductCategory, title: string, brand: string) => string;
};

function record(value: unknown): RecordValue | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue
    : undefined;
}

function preloadedState(html: string): RecordValue | undefined {
  const assignment = /window\.__PRELOADED_STATE__\s*=\s*/.exec(html);
  if (!assignment) return;
  const start = html.indexOf('{', assignment.index + assignment[0].length);
  if (start < 0) return;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < html.length; index++) {
    const character = html[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === '{') depth++;
    else if (character === '}' && --depth === 0) {
      try {
        return record(JSON.parse(html.slice(start, index + 1)));
      } catch {
        return;
      }
    }
  }
}

function priceNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : undefined;
  if (typeof value !== 'string') return;
  const cleaned = value.trim().replace(/[^\d.,-]/g, '');
  if (!cleaned || cleaned.startsWith('-')) return;
  const normalized = cleaned.includes(',') && cleaned.includes('.')
    ? cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
    : cleaned.includes(',')
      ? /^\d{1,3}(,\d{3})+$/.test(cleaned) ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.')
      : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function namesFromMap(value: unknown): string[] {
  const source = record(value);
  if (!source) return [];
  return Object.values(source).flatMap((entry) => {
    const name = record(entry)?.name;
    return typeof name === 'string' && name.trim() ? [name.trim().slice(0, 80)] : [];
  }).slice(0, 80);
}

export function extractMacysProduct(html: string, sourceUrl: string, helpers: MacyHelpers): Extracted | undefined {
  let source: URL;
  try { source = new URL(sourceUrl); } catch { return; }
  const host = source.hostname.toLowerCase();
  if (host !== 'macys.com' && host !== 'www.macys.com') return;

  try {
    const state = preloadedState(html);
    const product = record(record(record(state?.product)?.productDetail)?.product);
    if (!product) return;
    const detail = record(product.detail);
    const title = typeof detail?.name === 'string' ? detail.name.trim().slice(0, 140) : '';
    if (!title) return;
    const pricing = record(product.pricing);
    const priceData = record(pricing?.price);
    const tier = record((priceData?.tieredPrice as unknown[] | undefined)?.[0]);
    const tierValue = record((tier?.values as unknown[] | undefined)?.[0]);
    const regular = record(priceData?.regularPrice);
    const regularValue = record((regular?.values as unknown[] | undefined)?.[0]);
    const price = priceNumber(tierValue?.value ?? regularValue?.value);

    const traits = record(product.traits);
    const colors = namesFromMap(record(traits?.colors)?.colorMap);
    const sizes = namesFromMap(record(traits?.sizes)?.sizeMap);
    const variants: ProductVariant[] = [];
    if (colors.length && sizes.length) {
      for (const color of colors) for (const size of sizes) {
        variants.push({ label: `${color} · ${size}`, color, size, available: true, availabilityKnown: false });
      }
    } else {
      for (const value of colors.length ? colors : sizes) {
        variants.push({ label: value, ...(colors.length ? { color: value } : { size: value }), available: true, availabilityKnown: false });
      }
    }

    const imagery = record(product.imagery);
    const rawImages = Array.isArray(imagery?.images) ? imagery.images : [];
    const images = rawImages.flatMap((value) => {
      const filePath = record(value)?.filePath;
      if (typeof filePath !== 'string' || !filePath || filePath.split('/').some(part => part === '..') || !/^[\w./-]+$/.test(filePath)) return [];
      const image = helpers.safeImage(`https://slimages.macysassets.com/is/image/MCY/products/${filePath}`, sourceUrl);
      return image ? [image] : [];
    }).filter((value, index, all) => all.indexOf(value) === index).slice(0, 12);
    const brand = "Macy's";
    const category = helpers.inferCategory(title, brand);
    const warnings = ['Цена и варианты взяты из страницы магазина; наличие выбранного сочетания нужно подтвердить перед добавлением.'];
    if (price === undefined) warnings.push('Цена не распознана — укажите её со страницы выбранного варианта.');

    return {
      title,
      brand,
      category,
      declarationDescription: helpers.declarationFor(category, title, brand),
      price,
      currency: 'USD',
      country: 'США',
      image: images[0],
      images,
      variants: variants.length ? variants : undefined,
      warnings,
      sourceUrl,
      method: "Macy's product data",
    };
  } catch {
    return;
  }
}
