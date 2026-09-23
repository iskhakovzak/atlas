export type ProductVariant = {
  id?: string;
  size?: string;
  sizeLabel?: string;
  color?: string;
  label: string;
  available: boolean;
  /** False means the merchant omitted a definitive stock signal. */
  availabilityKnown?: boolean;
  price?: number;
  image?: string;
};

export type Extracted = {
  /** Merchant identity from the selected structured product, never a guessed ID. */
  sku?: string;
  title?: string;
  brand?: string;
  category?: ProductCategory;
  declarationDescription?: string;
  image?: string;
  images?: string[];
  price?: number;
  currency?: string;
  variants?: ProductVariant[];
  shipping?: number;
  shippingCurrency?: string;
  shippingDestination?: string;
  boxedWeight?: number;
  weightKind?: "shipping" | "net";
  country?: string;
  warnings: string[];
  sourceUrl: string;
  method: string;
};

export type ProductCategory =
  | "Обувь"
  | "Одежда"
  | "Электроника"
  | "Аксессуары"
  | "Красота и уход"
  | "Дом и быт"
  | "Спорт"
  | "Другое";

type EmbeddedRecord = Record<string, unknown>;

/**
 * A number of priority merchants render their product page from a bounded
 * public JSON state blob instead of JSON-LD.  This parser is deliberately
 * conservative: it only accepts a state object that can be tied back to the
 * exact source path/id, and it never treats a recommendation as the product.
 * It is a fallback for public data, not a browser/CAPTCHA workaround.
 */
function embeddedJson(html: string) {
  const roots: unknown[] = [];
  const patterns = [
    /<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    /<script\b[^>]*id=["']__PRELOADED_STATE__["'][^>]*>([\s\S]*?)<\/script>/i,
    /<script\b[^>]*id=["']__INITIAL_STATE__["'][^>]*>([\s\S]*?)<\/script>/i,
    /<script\b[^>]*id=["']__APOLLO_STATE__["'][^>]*>([\s\S]*?)<\/script>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match || match[1].length > 2_500_000) continue;
    try { roots.push(JSON.parse(match[1])); } catch {}
  }
  return roots;
}

function embeddedText(value: unknown) {
  return typeof value === "string" ? clean(value) : "";
}

function embeddedNumber(value: unknown) {
  if (value && typeof value === "object") {
    const record = value as EmbeddedRecord;
    return number(record.amount ?? record.value ?? record.current ?? record.price);
  }
  return number(value);
}

function embeddedUrlMatches(value: unknown, sourceUrl: string) {
  if (typeof value !== "string") return false;
  try {
    const candidate = new URL(value, sourceUrl), source = new URL(sourceUrl);
    if (candidate.protocol !== "https:" || candidate.username || candidate.password || candidate.port) return false;
    candidate.hostname = candidate.hostname.replace(/^www\./, "");
    source.hostname = source.hostname.replace(/^www\./, "");
    candidate.pathname = candidate.pathname.replace(/\/$/, "") || "/";
    source.pathname = source.pathname.replace(/\/$/, "") || "/";
    if (candidate.origin !== source.origin || candidate.pathname !== source.pathname) return false;
    // Tracking and a selected size do not identify a different listing.
    // A colour or another product-defining query value does.
    for (const url of [candidate, source]) {
      for (const key of [...url.searchParams.keys()]) {
        if (/^(utm_.+|gclid|fbclid|variant|size|sku)$/i.test(key)) url.searchParams.delete(key);
      }
      url.searchParams.sort();
    }
    return candidate.search === source.search;
  } catch { return false; }
}

function embeddedListingTokens(sourceUrl: string) {
  const source = new URL(sourceUrl);
  const pathTokens = source.pathname.split(/[^a-z0-9]+/i).map(token => token.toLowerCase()).filter(token => token.length >= 3);
  const queryTokens = [...source.searchParams.values()].flatMap(value => value.split(/[^a-z0-9]+/i)).map(token => token.toLowerCase()).filter(token => token.length >= 3);
  const terminal = source.pathname.split('/').filter(Boolean).at(-1)?.replace(/\.html$/i, '').toLowerCase();
  return new Set([...pathTokens, ...queryTokens, ...(terminal ? [terminal] : [])]);
}

function embeddedCandidateMatches(record: EmbeddedRecord, sourceUrl: string, tokens: Set<string>) {
  const urlFields = ['url', 'canonicalUrl', 'canonical', 'pdpUrl', 'productUrl', 'link', 'href', 'path'];
  const publishedUrls = urlFields.map(key => record[key]).filter(value => typeof value === 'string' && value.length > 0);
  if (publishedUrls.length) return publishedUrls.some(value => embeddedUrlMatches(value, sourceUrl));
  const idFields = ['itemId', 'productId', 'styleCode', 'articleNumber', 'offerId', 'variantId', 'sku', 'id'];
  return idFields.some(key => {
    const value = embeddedText(record[key]).toLowerCase();
    if (!value || value.length < 3) return false;
    // A numeric id must be long enough to be a real listing identifier. This
    // avoids matching a generic state key such as id=1 from a recommendation.
    if (/^\d+$/.test(value) && value.length < 5) return false;
    return tokens.has(value);
  });
}

function embeddedImages(record: EmbeddedRecord, sourceUrl: string) {
  const values: unknown[] = [];
  for (const key of ['image', 'images', 'gallery', 'media', 'pictures', 'photo', 'photos']) {
    const value = record[key];
    if (Array.isArray(value)) values.push(...value);
    else if (value !== undefined) values.push(value);
  }
  const urls = values.flatMap(value => {
    if (typeof value === 'string') return [value];
    if (!value || typeof value !== 'object') return [];
    const item = value as EmbeddedRecord;
    return [item.url, item.src, item.contentUrl, item.imageUrl, item.large, item.original];
  });
  return [...new Set(urls.map(value => safeImage(value, sourceUrl)).filter((value): value is string => Boolean(value)))].slice(0, 12);
}

function embeddedAvailability(record: EmbeddedRecord) {
  for (const key of ['available', 'isAvailable', 'inStock', 'availableForSale']) {
    if (typeof record[key] === 'boolean') return {available: record[key], availabilityKnown: true};
  }
  for (const key of ['quantity', 'stock', 'inventory', 'quantityAvailable']) {
    if (typeof record[key] === 'number') return {available: record[key] > 0, availabilityKnown: true};
    if (record[key] && typeof record[key] === 'object') {
      const amount = embeddedNumber(record[key]);
      if (amount !== undefined) return {available: amount > 0, availabilityKnown: true};
    }
  }
  const state = embeddedText(record.availability ?? record.availabilityStatus ?? record.status).toLowerCase();
  if (state) {
    if (/out.?of.?stock|sold.?out|unavailable|inactive|discontinued|not.?available/.test(state)) return {available: false, availabilityKnown: true};
    if (/in.?stock|available|active|buyable|orderable/.test(state)) return {available: true, availabilityKnown: true};
  }
  return {available: true, availabilityKnown: false};
}

function embeddedOptionLabel(record: EmbeddedRecord) {
  const direct = embeddedText(record.label ?? record.title ?? record.name ?? record.displayName);
  const optionValues = record.optionValues ?? record.options ?? record.selectedOptions;
  const values = Array.isArray(optionValues)
    ? optionValues.flatMap(value => {
      if (typeof value === 'string') return [clean(value)];
      if (value && typeof value === 'object') {
        const item = value as EmbeddedRecord;
        return [embeddedText(item.value ?? item.label ?? item.name)];
      }
      return [];
    }).filter(Boolean)
    : [];
  return direct || values.join(' · ');
}

function embeddedVariants(record: EmbeddedRecord, sourceUrl: string): ProductVariant[] {
  const raw = ['variants', 'skus', 'children', 'offers', 'items', 'sizes'].flatMap(key => Array.isArray(record[key]) ? record[key] : []);
  const variants = raw.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const item = value as EmbeddedRecord;
    const label = embeddedOptionLabel(item);
    const color = embeddedText(item.color ?? item.colour ?? item.colorName);
    const size = embeddedText(item.size ?? item.sizeName ?? item.dimension);
    const variantLabel = label || [color, size].filter(Boolean).join(' · ');
    if (!variantLabel) return [];
    const availability = embeddedAvailability(item);
    const id = embeddedText(item.sku ?? item.variantId ?? item.id ?? item.gtin ?? item.ean) || undefined;
    const image = embeddedImages(item, sourceUrl)[0];
    return [{
      id,
      label: variantLabel.slice(0, 120),
      color: color || undefined,
      size: size || undefined,
      sizeLabel: size ? 'Размер' : undefined,
      price: embeddedNumber(item.price ?? item.currentPrice ?? item.salePrice ?? item.finalPrice ?? item.amount),
      image,
      ...availability,
    } satisfies ProductVariant];
  }).slice(0, 80);
  const counts = new Map<string, number>();
  for (const item of variants) if (item.id) counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  for (const item of variants) if (item.id && counts.get(item.id)! > 1) delete item.id;
  return variants;
}

function embeddedCandidateRecords(root: unknown, sourceUrl: string) {
  const tokens = embeddedListingTokens(sourceUrl), candidates: EmbeddedRecord[] = [];
  const visited = new WeakSet<object>();
  let visitedCount = 0;
  const visit = (value: unknown, depth = 0) => {
    if (depth > 14 || visitedCount >= 4000 || !value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    visitedCount++;
    if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1); return; }
    const record = value as EmbeddedRecord;
    if (embeddedCandidateMatches(record, sourceUrl, tokens)) {
      const title = embeddedText(record.name ?? record.title ?? record.productName ?? record.displayName ?? record.fullTitle);
      const price = embeddedNumber(record.price ?? record.currentPrice ?? record.salePrice ?? record.finalPrice ?? record.amount);
      const variants = embeddedVariants(record, sourceUrl);
      if (title && (price !== undefined || variants.some(item => item.price !== undefined))) candidates.push(record);
    }
    for (const child of Object.values(record)) visit(child, depth + 1);
  };
  visit(root);
  return candidates;
}

function extractPriorityEmbedded(html: string, sourceUrl: string): Extracted | undefined {
  const source = new URL(sourceUrl);
  const priorityRoots = new Set([
    'macys.com', 'ebay.com', 'walmart.com', 'target.com', 'bestbuy.com', 'sephora.com', 'footlocker.com',
    'zalando.com', 'zalando.de', 'zalando.es', 'zalando.fr', 'zalando.it', 'asos.com', 'zara.com', 'mango.com', 'farfetch.com', 'primor.eu', 'perfumeriasprimor.eu', 'druni.es',
    'mediamarkt.de', 'mediamarkt.es', 'mediamarkt.it', 'pccomponentes.com', 'decathlon.es', 'footlocker.es',
  ]);
  const hostname = source.hostname.toLowerCase().replace(/^www\./, '');
  const root = [...priorityRoots].find(value => hostname === value || hostname.endsWith(`.${value}`));
  if (!root) return;
  const candidate = embeddedJson(html).flatMap(value => embeddedCandidateRecords(value, sourceUrl))[0];
  if (!candidate) return;
  const variants = embeddedVariants(candidate, sourceUrl);
  const price = embeddedNumber(candidate.price ?? candidate.currentPrice ?? candidate.salePrice ?? candidate.finalPrice ?? candidate.amount)
    ?? variants.find(item => item.price !== undefined)?.price;
  const title = embeddedText(candidate.name ?? candidate.title ?? candidate.productName ?? candidate.displayName ?? candidate.fullTitle).slice(0, 140) || undefined;
  const rawBrand = candidate.brand;
  const brand = (typeof rawBrand === 'object' && rawBrand ? embeddedText((rawBrand as EmbeddedRecord).name ?? (rawBrand as EmbeddedRecord).label) : embeddedText(rawBrand)) || undefined;
  const currency = embeddedText(candidate.currency ?? candidate.currencyCode ?? candidate.priceCurrency).toUpperCase() || undefined;
  const image = embeddedImages(candidate, sourceUrl)[0];
  const images = embeddedImages(candidate, sourceUrl);
  const category = inferProductCategory([title, embeddedText(candidate.category), embeddedText(candidate.productType), embeddedText(candidate.description)].filter(Boolean).join(' '), brand ?? '');
  const availability = embeddedAvailability(candidate);
  const baseVariant = variants.length ? variants : title ? [{label: 'Выбранный вариант', price, image, ...availability} satisfies ProductVariant] : [];
  if (!title && price === undefined && !images.length) return;
  const weight = parseWeight(candidate.shippingWeight ?? candidate.boxedWeight ?? candidate.weight);
  const shipping = embeddedNumber(candidate.shipping ?? candidate.shippingPrice ?? candidate.deliveryPrice);
  const warnings = ['Доставка магазина не опубликована — добавлен изменяемый резерв $10.'];
  if (variants.length) warnings.push('Варианты получены из публичных данных магазина и будут перепроверены перед корзиной.');
  if (!variants.length) warnings.push('Магазин не отдал матрицу вариантов: выберите товар вручную, если он требует размера или цвета.');
  if (variants.some(item => item.availabilityKnown === false)) warnings.push('Магазин не отдал подтверждённый статус наличия — перед корзиной Atlas проверит его ещё раз.');
  return {
    sku: embeddedText(candidate.sku ?? candidate.productId ?? candidate.itemId ?? candidate.styleCode) || undefined,
    title,
    brand,
    category,
    declarationDescription: declarationFor(category, title ?? '', brand),
    image,
    images,
    price,
    currency,
    variants: baseVariant,
    shipping,
    shippingCurrency: currency,
    boxedWeight: weight,
    weightKind: weight ? 'shipping' : undefined,
    country: inferStorefrontCountry(sourceUrl, currency),
    warnings,
    sourceUrl,
    method: `${root} embedded product data`,
  };
}

const clean = (s: unknown) =>
  typeof s === "string"
    ? s
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#(\d+);/g, (_, n) =>
          String.fromCodePoint(Math.min(Number(n), 0x10ffff)),
        )
        .trim()
    : "";

const number = (v: unknown) => {
  if (typeof v === "number")
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  if (typeof v !== "string") return undefined;
  let text = v.trim().replace(/[\s\u00a0]/g, '');
  if (!text || !/^\d[\d.,]*$/.test(text)) return undefined;
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (text.includes(',')) text = /^\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, '') : text.replace(',', '.');
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function safeImage(value: unknown, base: string) {
  const s =
    typeof value === "string"
      ? value
      : typeof value === "object" && value
        ? String(
            (value as Record<string, unknown>).url ??
              (value as Record<string, unknown>).contentUrl ??
              "",
          )
        : "";
  try {
    const u = new URL(s, base);
    if (
      !s ||
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      !u.hostname.includes(".") ||
      /^[\d.:\[\]]+$/.test(u.hostname) ||
      u.hostname.endsWith(".local") ||
      u.hostname === "localhost"
    )
      return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}

export function parseWeight(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const q = value as Record<string, unknown>;
  const n = number(q.value);
  if (n === undefined || n <= 0) return undefined;
  const unit = String(q.unitCode ?? q.unitText ?? "").toLowerCase();
  const factor = (
    {
      kg: 1,
      kilogram: 1,
      kilograms: 1,
      kgm: 1,
      g: 0.001,
      gram: 0.001,
      grams: 0.001,
      grm: 0.001,
      lb: 0.45359237,
      lbs: 0.45359237,
      lbr: 0.45359237,
      oz: 0.0283495231,
      onz: 0.0283495231,
    } as Record<string, number>
  )[unit];
  if (!factor) return undefined;
  const kilograms = Math.ceil(n * factor * 1000) / 1000;
  return kilograms > 0 && kilograms <= 49.5 ? kilograms : undefined;
}

const regionNames: Record<string, string> = {
  US: "США",
  ES: "Испания",
  DE: "Германия",
  GB: "Великобритания",
  FR: "Франция",
  IT: "Италия",
  RO: "Румыния",
  CN: "Китай",
  TR: "Турция",
  JP: "Япония",
  KR: "Южная Корея",
  AE: "ОАЭ",
  CA: "Канада",
  AU: "Австралия",
};

export function inferProductCategory(
  title: string,
  brand = "",
): ProductCategory {
  const text = (title + " " + brand).toLowerCase();
  if (
    /sneaker|shoe|boot|sandal|trainer|кроссов|обув|туфл|ботин|zapato|zapatilla/.test(
      text,
    )
  )
    return "Обувь";
  if (
    /phone|headphone|earbuds|laptop|tablet|camera|console|monitor|charger|adapter|power bank|keyboard|mouse|cable|hub|airtag|smart\s*tag|bluetooth\s*tracker|item\s*tracker|телефон|наушник|ноутбук|планшет|камера|приставк|заряд|адаптер|клавиатур|мышь|трекер|метк/.test(
      text,
    )
  )
    return "Электроника";
  if (
    /beauty|lipstick|lip gloss|lip oil|lip balm|blush|concealer|foundation|mascara|serum|cream|cleanser|moisturizer|perfume|makeup|skincare|крем|сыворот|духи|помад|космет|румян|тушь|бальзам/.test(
      text,
    )
  )
    return "Красота и уход";
  if (
    /bag|backpack|wallet|belt|watch|jewelry|рюкзак|сумк|кошел|ремень|час|украшен/.test(
      text,
    )
  )
    return "Аксессуары";
  if (
    /tent|dumbbell|yoga|running|football|ski|sport|палатк|гантел|йог|бег|спорт|лыж/.test(
      text,
    )
  )
    return "Спорт";
  if (
    /chair|table|lamp|kitchen|bedding|furniture|стул|стол|ламп|кухн|постель|мебел/.test(
      text,
    )
  )
    return "Дом и быт";
  if (
    /clothing|apparel|jersey|shirt|dress|jacket|coat|jeans|pants|hoodie|t-shirt|skirt|legging|bra|bralette|underwear|shorts|sweater|cardigan|blazer|jumpsuit|tracksuit|футбол|куртк|пальто|джинс|брюк|плать|юбк|легинс|белье|vestido/.test(
      text,
    )
  )
    return "Одежда";
  return "Другое";
}

export function declarationFor(
  category: ProductCategory,
  title: string,
  brand = "",
) {
  const item = {
    Обувь: "Обувь для личного пользования",
    Одежда: "Одежда для личного пользования",
    Электроника: "Электронное устройство для личного пользования",
    Аксессуары: "Аксессуар для личного пользования",
    "Красота и уход": "Косметика или средства ухода для личного пользования",
    "Дом и быт": "Товар для дома и личного пользования",
    Спорт: "Спортивный товар для личного пользования",
    Другое: "Товар для личного пользования",
  }[category];
  const cleanTitle = clean(title).slice(0, 100);
  return `${brand ? clean(brand) + " — " : ""}${cleanTitle || item}. ${item}.`;
}

function assignedJson(html: string, name: string) {
  const marker = `window.zara.${name}`;
  const markerAt = html.indexOf(marker);
  if (markerAt < 0) return undefined;
  const start = html.indexOf("{", markerAt + marker.length);
  if (start < 0) return undefined;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1)) as Record<string, unknown>;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

type ZaraSize = { name?: string; availability?: string; price?: number };
type ZaraMedia = {
  url?: string;
  extraInfo?: { deliveryUrl?: string };
};
type ZaraColor = {
  name?: string;
  productId?: number;
  price?: number;
  sizes?: ZaraSize[];
  xmedia?: ZaraMedia[];
};

function extractAnker(html: string, sourceUrl: string): Extracted | undefined {
  const source = new URL(sourceUrl);
  if (!/(^|\.)anker\.com$/i.test(source.hostname)) return;
  const match = html.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return;
  try {
    const root = JSON.parse(match[1]) as {props?:{pageProps?:{product?:Record<string, unknown>}}};
    const product = root.props?.pageProps?.product;
    const handle = clean(product?.handle);
    if (!product || !handle || !source.pathname.toLowerCase().includes(`/products/${handle.toLowerCase()}`) || !Array.isArray(product.variants)) return;
    const variants: ProductVariant[] = product.variants.slice(0, 250).map(raw => {
      const value = raw as Record<string, unknown>, name = clean(value.name), parts = name.split(/\s*\|\s*/, 2);
      const image = value.image as Record<string, unknown> | undefined;
      return {
        id: clean(value.id).match(/(\d+)$/)?.[1],
        color: parts[0] || undefined,
        size: parts[1] || undefined,
        label: name || 'Стандартный',
        available: value.availableForSale === true && value.currentlyNotInStock !== true && value.quantityAvailable !== 0,
        availabilityKnown: typeof value.availableForSale === 'boolean' || value.quantityAvailable !== undefined || value.currentlyNotInStock !== undefined,
        price: number(value.price),
        image: safeImage(image?.url, sourceUrl),
      };
    }).filter(variant => variant.label);
    const selectedId = source.searchParams.get('variant');
    const selected = selectedId ? variants.find(variant => variant.id === selectedId) : undefined;
    const prices = [...new Set(variants.map(variant => variant.price).filter(value => value !== undefined))];
    const images = [...new Set([selected?.image, ...[product.images].flat().map(value => safeImage((value as Record<string, unknown>)?.url ?? value, sourceUrl))].filter((value): value is string => Boolean(value)))].slice(0, 12);
    const title = clean(product.title ?? product.name).slice(0, 140), brand = clean(product.vendor) || 'Anker';
    const warnings = ['Доставка магазина не опубликована — добавлен изменяемый резерв $10.', 'Вес с упаковкой нужно проверить.'];
    if (!selected && prices.length !== 1) warnings.push('Выберите вариант, чтобы получить его точную цену.');
    return {title,brand,category:'Электроника',declarationDescription:declarationFor('Электроника',title,brand),image:selected?.image??images[0],images,price:selected?.price??(prices.length===1?prices[0]:undefined),currency:'USD',variants,warnings,sourceUrl,method:'Anker product data',country:'США'};
  } catch { return; }
}

function extractAmazon(html: string, sourceUrl: string): Extracted | undefined {
  const source = new URL(sourceUrl);
  if (!/(^|\.)amazon\.com$/i.test(source.hostname)) return;
  const title = clean(html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\//i)?.[1] ?? html.match(/<meta\s+name=["']title["'][^>]*content=["']([^"']+)/i)?.[1]).slice(0, 140) || undefined;
  const coreStart = html.search(/id=["']corePrice_feature_div["']/i);
  const core = coreStart >= 0 ? html.slice(coreStart, coreStart + 20_000) : html;
  const priceMatch = core.match(/<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*([$€£])?\s*([\d][\d,\.\s]*)/i);
  const price = priceMatch ? number(priceMatch[2]) : undefined;
  const currency = priceMatch?.[1] === '€' ? 'EUR' : priceMatch?.[1] === '£' ? 'GBP' : price !== undefined ? 'USD' : undefined;
  const imageTag = html.match(/<img[^>]+id=["']landingImage["'][^>]*>/i)?.[0] ?? '';
  const imageAttr = (name: string) => imageTag.match(new RegExp(`${name}=["']([^"']+)`, 'i'))?.[1]
    ?.replace(/&quot;/g, '"').replace(/&#x3D;|&#61;/g, '=').replace(/&amp;/g, '&');
  const dynamic = imageAttr('data-a-dynamic-image');
  const dynamicImages = dynamic ? (() => { try { return Object.keys(JSON.parse(dynamic)); } catch { return []; } })() : [];
  const images = [...new Set([imageAttr('data-old-hires'), imageAttr('src'), ...dynamicImages]
    .map(value => safeImage(value, sourceUrl)).filter((value): value is string => Boolean(value)))].slice(0, 12);
  if (!title && price === undefined && !images.length) return;
  const byline = clean(html.match(/id=["']bylineInfo["'][^>]*>([\s\S]*?)<\//i)?.[1]);
  const brand = (byline.match(/(?:Visit|Shop)\s+the\s+(.+?)\s+Store/i)?.[1] ?? byline).slice(0, 80) || 'Amazon';
  const category = inferProductCategory(title ?? '', brand);
  const unavailable = /id=["']availability["'][\s\S]{0,1200}(?:out of stock|currently unavailable|unavailable)/i.test(html);
  const availabilityBlock = /id=["']availability["']/i.test(html);
  const variants: ProductVariant[] = title ? [{label: 'Выбранный вариант', available: !unavailable, availabilityKnown: availabilityBlock, price, image: images[0]}] : [];
  const warnings: string[] = ['Доставка магазина не опубликована — добавлен изменяемый резерв $10.'];
  if (price === undefined) warnings.unshift('Цена не найдена в американском блоке Amazon: укажите её со страницы выбранного варианта.');
  if (unavailable) warnings.push('Amazon сообщает, что выбранный товар недоступен.');
  return {
    title,
    brand,
    category,
    declarationDescription: declarationFor(category, title ?? '', brand),
    image: images[0],
    images,
    price,
    currency,
    variants,
    warnings,
    sourceUrl,
    method: 'Amazon product data',
    country: 'США',
  };
}

/**
 * Nike product pages publish a bounded `__NEXT_DATA__` payload containing the
 * exact style code, gallery, price and size/SKU matrix. JSON-LD often omits
 * offer availability, so prefer this merchant-owned payload when it matches
 * the URL article code. No cookies or private Nike APIs are required.
 */
function extractNike(html: string, sourceUrl: string): Extracted | undefined {
  const source = new URL(sourceUrl);
  if (!/(^|\.)nike\.com$/i.test(source.hostname)) return;
  const match = html.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return;
  try {
    const root = JSON.parse(match[1]) as {props?: {pageProps?: Record<string, unknown>}};
    const page = root.props?.pageProps;
    const article = source.pathname.split('/').filter(Boolean).at(-1)?.replace(/\.html$/i, '').toUpperCase();
    const selected = page?.selectedProduct && typeof page.selectedProduct === 'object'
      ? page.selectedProduct as Record<string, unknown>
      : undefined;
    const groups = Array.isArray(page?.productGroups) ? page.productGroups : [];
    const products = groups.flatMap(group => {
      if (!group || typeof group !== 'object') return [];
      const values = (group as Record<string, unknown>).products;
      return values && typeof values === 'object' && !Array.isArray(values) ? Object.values(values as Record<string, unknown>) : [];
    }).filter((value): value is Record<string, unknown> => Boolean(value && typeof value === 'object'));
    const product = selected && (!article || [selected.styleCode, selected.styleColor, selected.pdpUrl].some(value => String(value ?? '').toUpperCase().includes(article ?? '')))
      ? selected
      : products.find(value => String(value.styleCode ?? value.merchProductId ?? '').toUpperCase() === article || String(value.pdpUrl ?? '').includes(`/${article}`));
    if (!product) return;
    const info = product.productInfo && typeof product.productInfo === 'object' ? product.productInfo as Record<string, unknown> : {};
    const title = clean(info.fullTitle ?? info.title ?? product.displayStyle ?? product.styleCode).slice(0, 140) || undefined;
    const brands = Array.isArray(product.brands) ? product.brands.map(clean).filter(Boolean) : [];
    const brand = brands[0] || 'Nike';
    const color = clean(product.colorDescription ?? product.styleColor) || undefined;
    const priceData = product.prices && typeof product.prices === 'object' ? product.prices as Record<string, unknown> : {};
    const price = number(priceData.currentPrice ?? priceData.price ?? priceData.initialPrice);
    const currency = clean(priceData.currency ?? (page?.locale && typeof page.locale === 'object' ? (page.locale as Record<string, unknown>).currency : undefined)).toUpperCase() || undefined;
    const imageValues = Array.isArray(product.contentImages) ? product.contentImages.flatMap(value => {
      if (!value || typeof value !== 'object') return [];
      const properties = (value as Record<string, unknown>).properties;
      if (!properties || typeof properties !== 'object') return [];
      const record = properties as Record<string, unknown>;
      return [record.portrait, record.squarish];
    }) : [];
    const images = [...new Set(imageValues.map(value => {
      if (!value || typeof value !== 'object') return undefined;
      return safeImage((value as Record<string, unknown>).url, sourceUrl);
    }).filter((value): value is string => Boolean(value)))].slice(0, 12);
    const rawSizes = Array.isArray(product.sizes) ? product.sizes : [];
    const variants: ProductVariant[] = rawSizes.map(raw => {
      const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
      const label = clean(value.label ?? value.localizedLabel);
      const gtins = Array.isArray(value.gtins) ? value.gtins : [];
      const id = clean(gtins[0] && typeof gtins[0] === 'object' ? (gtins[0] as Record<string, unknown>).gtin : value.merchSkuId) || undefined;
      const status = clean(value.status).toUpperCase();
      return {id, size: label || undefined, sizeLabel: 'Размер', color, label: [color, label].filter(Boolean).join(' · '), available: status === 'ACTIVE' || status === 'BUYABLE_BUY', availabilityKnown: Boolean(status), price, image: images[0]};
    }).filter(value => value.label).slice(0, 80);
    if (!variants.length) return;
    const category = inferProductCategory([title, clean(product.productType), ...(Array.isArray(product.taxonomyLabels) ? product.taxonomyLabels.map(clean) : [])].filter(Boolean).join(' '), brand);
    const warnings = ['Доставка магазина не опубликована — добавлен изменяемый резерв $10.', 'Вес с упаковкой нужно проверить.'];
    if (price === undefined) warnings.unshift('Цена не найдена в данных Nike: выберите конкретный вариант на странице магазина.');
    if (!variants.some(value => value.available)) warnings.push('Nike не указал доступный размер в текущем снимке.');
    return {title, brand, category, declarationDescription: declarationFor(category, title ?? '', brand), image: images[0], images, price, currency, variants, country: inferStorefrontCountry(sourceUrl, currency), warnings, sourceUrl, method: 'Nike product data', sku: clean(product.styleCode) || undefined};
  } catch {
    return;
  }
}

type AdidasApiRecord = Record<string, unknown>;

function extractAdidasImage(value: unknown, sourceUrl: string) {
  if (typeof value === 'string') return safeImage(value, sourceUrl);
  if (!value || typeof value !== 'object') return undefined;
  const record = value as AdidasApiRecord;
  return safeImage(record.src ?? record.url ?? record.contentUrl, sourceUrl);
}

/**
 * Adidas serves an Akamai challenge for server-side HTML requests, while its
 * public product/search JSON still contains the merchant price, gallery and
 * currently available size list. Keep this parser separate from JSON-LD so a
 * challenge page can never be presented as a successful import.
 */
export function extractAdidasProduct(productValue: unknown, listingValue: unknown, sourceUrl: string): Extracted | undefined {
  if (!productValue || typeof productValue !== 'object') return;
  const product = productValue as AdidasApiRecord;
  const listing = listingValue && typeof listingValue === 'object' ? listingValue as AdidasApiRecord : undefined;
  const raw = listing?.raw as AdidasApiRecord | undefined;
  const itemList = raw?.itemList as AdidasApiRecord | undefined;
  const items = Array.isArray(itemList?.items) ? itemList.items.filter((value): value is AdidasApiRecord => Boolean(value && typeof value === 'object')) : [];
  const id = clean(product.id ?? product.productId);
  const article = new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1)?.replace(/\.html$/i, '');
  if (!article || !id || id.toUpperCase() !== article.toUpperCase()) return;
  const item = items.find(value => clean(value.productId ?? value.id) === id);
  if (!id && !item) return;
  const selected = item ?? product;
  const title = clean(product.name ?? selected.displayName ?? selected.altText).slice(0, 140) || undefined;
  const color = clean(product.color ?? selected.color) || undefined;
  const brand = 'adidas';
  const category = inferProductCategory([title, clean(product.category ?? selected.category), clean(selected.subTitle)].filter(Boolean).join(' '), brand);
  const imageValues = [product.image, product.pdpImage, product.secondImage, ...(Array.isArray(product.images) ? product.images : []), selected.image, selected.secondImage, ...(Array.isArray(selected.images) ? selected.images : [])];
  const images = [...new Set(imageValues.map(value => extractAdidasImage(value, sourceUrl)).filter((value): value is string => Boolean(value)))].slice(0, 12);
  const price = number(selected.salePrice ?? product.salePrice ?? selected.price ?? product.price);
  const locale = new URL(sourceUrl).pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? '';
  const currency = ({us: 'USD', ca: 'CAD', gb: 'GBP', uk: 'GBP', de: 'EUR', es: 'EUR', fr: 'EUR', it: 'EUR', nl: 'EUR', pl: 'PLN', se: 'SEK', dk: 'DKK', no: 'NOK', tr: 'TRY', au: 'AUD', jp: 'JPY', ae: 'AED', qa: 'QAR', bh: 'BHD', om: 'OMR'} as Record<string, string>)[locale];
  const availableSizes = [...new Set((Array.isArray(selected.availableSizes) ? selected.availableSizes : []).map(clean).filter(size => size && size.toLowerCase() !== 'hidden'))];
  const available = selected.orderable !== 0 && product.orderable !== 0;
  const availabilityKnown = Array.isArray(selected.availableSizes) || typeof selected.orderable === 'number' || typeof product.orderable === 'number';
  const variants: ProductVariant[] = availableSizes.map(size => ({
    size,
    sizeLabel: 'Размер',
    color,
    label: [color, size].filter(Boolean).join(' · '),
    available,
    availabilityKnown,
    price,
    image: images[0],
  }));
  if (!variants.length) variants.push({label: color ?? 'Выбранный вариант', color, available, availabilityKnown, price, image: images[0]});
  const warnings = ['Доставка магазина не опубликована — добавлен изменяемый резерв $10.', 'Вес с упаковкой нужно проверить.'];
  if (!availableSizes.length) warnings.push('Adidas не отдал список размеров. Проверьте вариант на странице магазина.');
  if (price === undefined) warnings.unshift('Цена не найдена в данных Adidas: укажите её со страницы выбранного варианта.');
  if (!available) warnings.push('Adidas сообщает, что товар сейчас недоступен.');
  const country = inferStorefrontCountry(sourceUrl, currency);
  return {
    title,
    brand,
    category,
    declarationDescription: declarationFor(category, title ?? '', brand),
    image: images[0],
    images,
    price,
    currency,
    variants,
    country,
    warnings,
    sourceUrl,
    method: 'Adidas product data',
  };
}

export function inferStorefrontCountry(sourceUrl: string, currency?: string) {
  const url = new URL(sourceUrl);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.toLowerCase();
  const locale = path.match(/^\/(?:[a-z]{2}[-_])?(us|es|de|gb|uk|fr|it|ro|cn|tr|jp|kr|ae|ca|au)(?:[-_/]|$)/)?.[1];
  const byCode: Record<string, string> = {
    us: "США", es: "Испания", de: "Германия", gb: "Великобритания", uk: "Великобритания",
    fr: "Франция", it: "Италия", ro: "Румыния", cn: "Китай", tr: "Турция",
    jp: "Япония", kr: "Южная Корея", ae: "ОАЭ", ca: "Канада", au: "Австралия",
  };
  if (locale) return byCode[locale];
  const suffix = Object.entries({
    ".co.uk": "Великобритания", ".com.au": "Австралия", ".co.jp": "Япония",
    ".es": "Испания", ".de": "Германия", ".fr": "Франция", ".it": "Италия",
    ".ro": "Румыния", ".cn": "Китай", ".com.tr": "Турция", ".kr": "Южная Корея",
    ".ae": "ОАЭ", ".ca": "Канада",
  }).find(([ending]) => host.endsWith(ending));
  if (suffix) return suffix[1];
  const usStores = new Set([
    "apple.com", "amazon.com", "ebay.com", "nike.com", "adidas.com", "bestbuy.com",
    "walmart.com", "target.com", "nordstrom.com", "nordstromrack.com", "macys.com",
    "sephora.com", "ulta.com", "bhphotovideo.com", "adorama.com", "newegg.com",
    "kith.com", "footlocker.com", "zappos.com", "allbirds.com", "satechi.com",
  ]);
  if (usStores.has(host)) return "США";
  if (currency === "RON") return "Румыния";
  return undefined;
}

function extractZara(html: string, sourceUrl: string) {
  if (!/(^|\.)zara\.com$/i.test(new URL(sourceUrl).hostname)) return undefined;
  const config = assignedJson(html, "appConfig");
  const payload = assignedJson(html, "viewPayload");
  if (!config || !payload) return undefined;
  const product = payload.product as
    | { name?: string; detail?: { colors?: ZaraColor[] } }
    | undefined;
  const colors = product?.detail?.colors;
  if (!colors?.length) return undefined;
  const selectedId = Number(new URL(sourceUrl).searchParams.get("v1"));
  const selected = colors.find((c) => c.productId === selectedId) ?? colors[0];
  const formatter = config.formatterConfig as
    | { currency?: string; currencyDecimals?: number }
    | undefined;
  const currency = clean(formatter?.currency).toUpperCase() || undefined;
  const decimals = formatter?.currencyDecimals ?? -2;
  const divisor = decimals < 0 ? 10 ** -decimals : 1;
  const rawPrice = selected.price ?? selected.sizes?.find((s) => s.price)?.price;
  const price = rawPrice === undefined ? undefined : rawPrice / divisor;
  const variants = colors.flatMap((color) => {
    const colorMedia = color.xmedia?.find((m) =>
      Boolean(m.extraInfo?.deliveryUrl ?? m.url),
    );
    const colorImage = safeImage(
      colorMedia?.extraInfo?.deliveryUrl ??
        colorMedia?.url?.replace("{width}", "1024"),
      sourceUrl,
    );
      return (color.sizes?.length ? color.sizes : [{ name: "Стандартный" }]).map(
      (size) => ({
        size: clean(size.name) || undefined,
        color: clean(color.name) || undefined,
        label: [clean(color.name), clean(size.name)].filter(Boolean).join(" · "),
        available: !/out_of_stock|coming_soon/i.test(size.availability ?? ""),
        availabilityKnown: typeof size.availability === 'string' && size.availability.trim().length > 0,
        price: size.price === undefined ? undefined : size.price / divisor,
        image: colorImage,
      }),
    );
  });
  const media = selected.xmedia?.find((m) =>
    Boolean(m.extraInfo?.deliveryUrl ?? m.url),
  );
  const rawImage =
    media?.extraInfo?.deliveryUrl ?? media?.url?.replace("{width}", "1024");
  const countryCode = clean(config.storeCountryCode).toUpperCase();
  return {
    title: clean(product?.name).slice(0, 140) || undefined,
    brand: "Zara",
    image: safeImage(rawImage, sourceUrl),
    images: (selected.xmedia ?? []).map(media => safeImage(media.extraInfo?.deliveryUrl ?? media.url?.replace('{width}', '1024'), sourceUrl)).filter((value): value is string => Boolean(value)).slice(0, 12),
    price,
    currency,
    variants: variants.filter((v) => v.label).slice(0, 80),
    country: regionNames[countryCode],
  };
}

export function extractProduct(html: string, sourceUrl: string): Extracted {
  const anker = extractAnker(html, sourceUrl);
  if (anker) return anker;
  const amazon = extractAmazon(html, sourceUrl);
  if (amazon) return amazon;
  const nike = extractNike(html, sourceUrl);
  if (nike) return nike;
  const priorityEmbedded = extractPriorityEmbedded(html, sourceUrl);
  if (priorityEmbedded) return priorityEmbedded;
  const meta: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const a: Record<string, string> = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
      a[m[1].toLowerCase()] = clean(m[2] ?? m[3]);
    const key = a.property ?? a.name ?? a.itemprop;
    if (key && a.content) meta[key.toLowerCase()] = a.content;
  }

  // JSON-LD has no fixed shape; traversal is bounded by depth and node count.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodes: Record<string, any>[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (x: any, depth = 0) => {
    if (depth > 15 || nodes.length > 4000 || !x || typeof x !== "object") return;
    if (Array.isArray(x)) for (const y of x) walk(y, depth + 1);
    else {
      nodes.push(x);
      for (const y of Object.values(x)) walk(y, depth + 1);
    }
  };
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      walk(JSON.parse(match[1]));
    } catch {}
  }

  const sameListing = (value: unknown) => {
    if (typeof value !== 'string') return false;
    try {
      const candidate = new URL(value, sourceUrl), source = new URL(sourceUrl);
      if (candidate.protocol !== 'https:' || candidate.username || candidate.password || candidate.port) return false;
      for (const u of [candidate, source]) {
        u.hostname = u.hostname.replace(/^www\./, '');
        u.pathname = u.pathname.replace(/\/$/, '') || '/';
        for (const key of [...u.searchParams.keys()]) if (/^(utm_.+|gclid|fbclid|variant)$/i.test(key)) u.searchParams.delete(key);
        u.searchParams.sort();
      }
      return candidate.origin === source.origin && candidate.pathname === source.pathname && candidate.search === source.search;
    } catch { return false; }
  };
  const productNodes = nodes.filter(n => [n['@type']].flat().some(t => t === 'Product' || t === 'ProductGroup'));
  const offerUrls = (node: Record<string, unknown>) => [node.offers].flat().map(offer =>
    offer && typeof offer === 'object' ? (offer as Record<string, unknown>).url : undefined);
  const matchesNode = (node: Record<string, unknown>) =>
    sameListing(node.url) || sameListing(node['@id']) || offerUrls(node).some(sameListing);
  const hasListingUrl = (node: Record<string, unknown>) => Boolean(node.url || node['@id'] || offerUrls(node).some(Boolean));
  // Recommendation products can precede the actual product in JSON-LD. Keep a
  // matched parent group so its full option matrix survives the selection.
  const group = productNodes.find(n => Array.isArray(n.hasVariant) && (matchesNode(n) || n.hasVariant.some((child: Record<string, unknown>) => child && matchesNode(child))))
    ?? productNodes.find(matchesNode)
    ?? productNodes.find(n => !hasListingUrl(n) && (!Array.isArray(n.hasVariant) || !n.hasVariant.some((child: Record<string, unknown>) => child && hasListingUrl(child))));
  // ProductGroup pages (including Nike) may put all price data on size/color children.
  // Only use children for the exact linked listing, never a different recommended color.
  const allChildren = Array.isArray(group?.hasVariant) ? group.hasVariant.filter((child: Record<string, unknown>) => child && typeof child === 'object') : [];
  const children = allChildren.filter((child: Record<string, unknown>) => {
    if (!child || typeof child !== 'object') return false;
    const childOffers = [child.offers].flat() as Record<string, unknown>[];
    return sameListing(child.url) || sameListing(child['@id']) || childOffers.some(item => sameListing(item?.url));
  });
  const selectedVariantId = new URL(sourceUrl).searchParams.get('variant');
  const selectedChild = children.find((child: Record<string, unknown>) => [child.url, ...[child.offers].flat().map((o) => (o as Record<string, unknown>)?.url)].some(value => {
    try { return selectedVariantId && typeof value === 'string' && new URL(value, sourceUrl).searchParams.get('variant') === selectedVariantId; } catch { return false; }
  })) ?? children[0];
  const p = selectedChild ? { ...group, ...selectedChild, brand: selectedChild.brand ?? group?.brand } : group;
  const offers = p?.offers;
  const offer = Array.isArray(offers) ? offers[0] : offers;
  const details = offer?.shippingDetails;
  const ship = Array.isArray(details) ? details[0] : details;
  const rate = ship?.shippingRate;
  const shipping = number(rate?.value ?? rate?.price);
  const destination = ship?.shippingDestination?.addressCountry;
  const zara = extractZara(html, sourceUrl);
  const image =
    zara?.image ??
    safeImage(
      Array.isArray(p?.image)
        ? p.image[0]
        : (p?.image ?? meta["og:image"] ?? meta["twitter:image"]),
      sourceUrl,
    );
  const images = [...new Set([image, ...(zara?.images ?? []), ...[p?.image].flat(), meta["og:image"], meta["twitter:image"]]
    .map((value) => safeImage(value, sourceUrl)).filter((value): value is string => Boolean(value)))].slice(0, 12);
  const price =
    zara?.price ??
    number(
      offer?.price ??
        offer?.priceSpecification?.price ??
        meta["product:price:amount"] ??
        meta["og:price:amount"],
    );
  const currency =
    zara?.currency ??
    (clean(
      offer?.priceCurrency ??
        offer?.priceSpecification?.priceCurrency ??
        meta["product:price:currency"] ??
        meta["og:price:currency"],
    ).toUpperCase() || undefined);
  const title =
    (zara?.title ??
      clean(
        p?.name ??
          meta["og:title"] ??
          meta["twitter:title"] ??
          html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
      ).slice(0, 140)) || undefined;
  const gross = parseWeight(p?.shippingWeight);
  const net = parseWeight(p?.weight);
  const loc =
    offer?.availableAtOrFrom?.address?.addressCountry ??
    p?.offers?.shippingOrigin?.addressCountry;
  const rawBrand = p?.brand;
  const brand =
    (zara?.brand ??
      clean(
        typeof rawBrand === "object" && rawBrand
          ? ((rawBrand as Record<string, unknown>).name ??
              (rawBrand as Record<string, unknown>)["@id"])
          : rawBrand,
      ).slice(0, 80)) || new URL(sourceUrl).hostname.replace(/^www\./, "");
  const category = inferProductCategory(
    [title, clean(p?.category), clean(p?.description)].filter(Boolean).join(" "),
    brand,
  );
  const genericLabel = [p?.color, p?.size].map(clean).filter(Boolean).join(' · ');
  const sku = clean(typeof p?.sku === 'number' ? String(p.sku) : p?.sku).slice(0, 120) || undefined;
  const genericVariants: ProductVariant[] = genericLabel
    ? [{ id: sku, label: genericLabel, available: !/OutOfStock|Discontinued|SoldOut/i.test(String(offer?.availability ?? '')), availabilityKnown: typeof offer?.availability === 'string' && offer.availability.trim().length > 0, size: clean(p?.size) || undefined, color: clean(p?.color) || undefined }]
    : [];
  const groupVariants: ProductVariant[] = allChildren.map((child: Record<string, unknown>) => {
    const childOffer = [child.offers].flat()[0] as Record<string, unknown> | undefined;
    return {
      id: clean(typeof child.sku === 'number' ? String(child.sku) : child.sku ?? child.gtin).slice(0, 120) || undefined,
      size: clean(child.size) || undefined,
      color: clean(child.color) || undefined,
      label: [child.color, child.size].filter(Boolean).map(clean).join(' · '),
      available: !/OutOfStock|Discontinued|SoldOut/i.test(String(childOffer?.availability ?? '')),
      availabilityKnown: typeof childOffer?.availability === 'string' && String(childOffer.availability).trim().length > 0,
      price: number(childOffer?.price ?? (childOffer?.priceSpecification as Record<string, unknown> | undefined)?.price),
      image: safeImage(Array.isArray(child.image) ? child.image[0] : child.image, sourceUrl),
    };
  }).filter((item: ProductVariant) => item.label).slice(0, 80);
  // Some stores repeat a parent SKU across sizes. Such IDs cannot identify a
  // selected combination: retain the existing exact-label verification path.
  const variantIdCounts = new Map<string, number>();
  for (const variant of groupVariants) if (variant.id) variantIdCounts.set(variant.id, (variantIdCounts.get(variant.id) ?? 0) + 1);
  for (const variant of groupVariants) if (variant.id && variantIdCounts.get(variant.id)! > 1) delete variant.id;
  const rawVariants = zara?.variants?.length ? zara.variants : groupVariants.length ? groupVariants : genericVariants;
  const gymsharkColor = /(^|\.)gymshark\.com$/i.test(new URL(sourceUrl).hostname)
    ? clean(html.match(/aria-current=["']true["'][^>]*aria-label=["'][^"']+\s+in\s+([^"']+)/i)?.[1])
    : '';
  const variants = gymsharkColor ? rawVariants.map(variant => variant.color ? variant : {...variant,color:gymsharkColor,label:[gymsharkColor,variant.size??variant.label].filter(Boolean).join(' · ')}) : rawVariants;
  const country = zara?.country ?? regionNames[String(loc).toUpperCase()] ?? inferStorefrontCountry(sourceUrl, currency);
  const warnings: string[] = [];
  if (groupVariants.length) warnings.push('Размеры получены со страницы магазина. Наличие и цена выбранного размера требуют подтверждения.');
  if (price === undefined)
    warnings.push("Цена не найдена: укажите её со страницы выбранного варианта.");
  if (shipping === undefined)
    warnings.push("Доставка магазина не опубликована — добавлен изменяемый резерв $10.");
  if (!gross && !net)
    warnings.push("Вес не опубликован. Предложим приблизительный вес по категории.");
  if (net && !gross)
    warnings.push("Магазин указал вес товара; вес коробки может не входить. Проверьте поле веса.");
  if (Array.isArray(offers) && offers.length > 1)
    warnings.push("Найдено несколько предложений: показано первое. Проверьте вариант и цену.");
  if (offer?.["@type"] === "AggregateOffer")
    warnings.push("Указан диапазон цен. Нужна цена конкретного варианта.");
  if (variants.some((v) => !v.available))
    warnings.push("Недоступные размеры скрыты из выбора.");
  if (variants.some((v) => v.availabilityKnown === false))
    warnings.push("Магазин не отдал подтверждённый статус наличия — перед корзиной Atlas проверит его ещё раз.");
  return {
    sku,
    title,
    brand,
    category,
    declarationDescription: declarationFor(category, title ?? "", brand),
    image,
    images,
    price,
    currency,
    variants,
    shipping,
    shippingCurrency: clean(rate?.currency) || currency,
    shippingDestination:
      typeof destination === "string" ? destination : undefined,
    boxedWeight: gross ?? net,
    weightKind: gross ? "shipping" : net ? "net" : undefined,
    country,
    warnings,
    sourceUrl,
    method: zara ? "Zara product data" : p ? "JSON-LD" : "Open Graph",
  };
}
