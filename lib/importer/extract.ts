export type ProductVariant = {
  id?: string;
  size?: string;
  sizeLabel?: string;
  color?: string;
  label: string;
  available: boolean;
  price?: number;
  image?: string;
};

export type Extracted = {
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
    /shirt|dress|jacket|coat|jeans|pants|hoodie|t-shirt|skirt|legging|bra|bralette|underwear|shorts|футбол|куртк|пальто|джинс|брюк|плать|юбк|легинс|белье|vestido/.test(
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

  const group = nodes.find((n) =>
    [n["@type"]].flat().some((t) => t === "Product" || t === "ProductGroup"),
  );
  const sameListing = (value: unknown) => {
    if (typeof value !== 'string') return false;
    try {
      const candidate = new URL(value, sourceUrl), source = new URL(sourceUrl);
      for (const u of [candidate, source]) {
        for (const key of [...u.searchParams.keys()]) if (/^(utm_.+|gclid|fbclid|variant)$/i.test(key)) u.searchParams.delete(key);
        u.searchParams.sort();
      }
      return candidate.origin === source.origin && candidate.pathname === source.pathname && candidate.search === source.search;
    } catch { return false; }
  };
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
  const genericVariants: ProductVariant[] = genericLabel
    ? [{ label: genericLabel, available: !/OutOfStock|Discontinued|SoldOut/i.test(String(offer?.availability ?? '')), size: clean(p?.size) || undefined, color: clean(p?.color) || undefined }]
    : [];
  const groupVariants: ProductVariant[] = allChildren.map((child: Record<string, unknown>) => {
    const childOffer = [child.offers].flat()[0] as Record<string, unknown> | undefined;
    return {
      size: clean(child.size) || undefined,
      color: clean(child.color) || undefined,
      label: [child.color, child.size].filter(Boolean).map(clean).join(' · '),
      available: !/OutOfStock|Discontinued|SoldOut/i.test(String(childOffer?.availability ?? '')),
      price: number(childOffer?.price ?? (childOffer?.priceSpecification as Record<string, unknown> | undefined)?.price),
      image: safeImage(Array.isArray(child.image) ? child.image[0] : child.image, sourceUrl),
    };
  }).filter((item: ProductVariant) => item.label);
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
  return {
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
