import type { Extracted, ProductCategory, ProductColorwayGallery, ProductVariant } from './extract.ts';

/**
 * Gap Inc. storefronts (Old Navy, Gap, Banana Republic, Athleta: `<brand>.gap.com/browse/product.do?pid=…`).
 * The React Server Components payload (`self.__next_f.push([1,"…"])`) carries the product as one
 * object: `customer_choices` (every colour with its name and photos), `variants` per fit (Regular,
 * Tall, Petite…) whose colours list each SKU with its size, a definite inventory status and the
 * effective and regular price, and `styles` with the product name. `pid` is a colour (9–10 digits),
 * a SKU (13–14 digits) or the style; repeated values are RSC references (`$78:…:data:<path>`).
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
const MAX_VARIANTS = 250;
const brands: Record<string, string> = { 'gap.com': 'Gap', 'oldnavy.gap.com': 'Old Navy', 'bananarepublic.gap.com': 'Banana Republic', 'athleta.gap.com': 'Athleta' };

/** The RSC payload as one string: each push carries a JSON string literal. */
function flightData(html: string) {
  let flight = '';
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try { flight += JSON.parse(match[1]); } catch { /* a malformed chunk only loses its own part */ }
  }
  return flight;
}

/** The JSON object or array starting at `start`, honouring strings, with its end offset. */
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
      try { return { value: JSON.parse(source.slice(start, i + 1)) as unknown, end: i + 1 }; } catch { return { value: undefined, end: i + 1 }; }
    }
  }
  return undefined;
}

/** The product object: the one holding `customer_choices` and the per-fit `variants`. */
function productRoots(flight: string) {
  const roots: Rec[] = [];
  let parsedUntil = -1, parses = 0;
  for (let at = flight.indexOf('"customer_choices":{'); at >= 0 && parses < 8; at = flight.indexOf('"customer_choices":{', at + 1)) {
    if (at < parsedUntil) continue;
    let depth = 0, start = -1;
    for (let i = at; i >= 0; i--) {
      const c = flight[i];
      if (c === '}' || c === ']') depth++;
      else if (c === '{' || c === '[') { if (depth === 0) { start = i; break; } depth--; }
    }
    if (start < 0) continue;
    parses++;
    const parsed = balanced(flight, start);
    if (!parsed) continue;
    parsedUntil = parsed.end;
    const root = record(parsed.value);
    if (root && record(root.customer_choices) && record(root.variants)) roots.push(root);
  }
  return roots;
}

/** Follows an RSC reference into the same product object; other values are returned as is. */
function deref(root: Rec, value: unknown): unknown {
  if (typeof value !== 'string' || !value.startsWith('$')) return value;
  const path = value.match(/:data:(.+)$/)?.[1];
  if (!path) return undefined;
  let node: unknown = root;
  for (const key of path.split(':')) node = record(node)?.[key];
  return node;
}

function colorImages(root: Rec, choice: Rec | undefined, sourceUrl: string, helpers: Helpers) {
  const media = deref(root, choice?.images);
  const list = Array.isArray(media) ? media.map(record).filter((image): image is Rec => Boolean(image)) : [];
  list.sort((a, b) => (Number(a.sequence_number) || 0) - (Number(b.sequence_number) || 0));
  const urls = list.map(image => {
    const crops = Array.isArray(image.crops) ? image.crops.map(record) : [];
    return crops.find(crop => crop?.type === 'ZOOM')?.absolute_url ?? image.absolute_url;
  });
  return [...new Set(urls.map(url => helpers.safeImage(url, sourceUrl)).filter((value): value is string => Boolean(value)))].slice(0, 12);
}

function skuStock(sku: Rec) {
  const status = text(record(sku.inventory_status)?.status, 30).toUpperCase();
  if (/^(?:IN_STOCK|LOW_STOCK)$/.test(status)) return { available: true, known: true };
  if (status === 'OUT_OF_STOCK') return { available: false, known: true };
  if (typeof sku.isInstock === 'boolean') return { available: sku.isInstock || sku.isLowStock === true, known: true };
  return { available: false, known: false };
}

function skuPrice(sku: Rec) {
  const price = record(sku.price);
  return { amount: money(price?.effective_price), regular: money(record(price?.price_details)?.regular_price), currency: text(price?.currency, 3).toUpperCase() };
}

export function extractGapIncProduct(html: string, sourceUrl: string, helpers: Helpers): Extracted | undefined {
  const source = new URL(sourceUrl);
  const host = source.hostname.toLowerCase().replace(/^www\./, '');
  const brand = brands[host];
  if (!brand || !/^\/browse\/product\.do$/i.test(source.pathname)) return undefined;
  const pid = source.searchParams.get('pid')?.match(/^\d{5,16}$/)?.[0];
  if (!pid) return undefined;
  const flight = flightData(html);
  if (!flight) return undefined;

  for (const root of productRoots(flight)) {
    const choices = record(root.customer_choices)!;
    const fits = Object.entries(record(root.variants)!).map(([key, fit]) => [key, record(fit)] as const).filter((entry): entry is readonly [string, Rec] => Boolean(entry[1]));
    const fitNames = new Map<string, string>();
    const definition = Array.isArray(root.variant_definition) ? record(root.variant_definition[0]) : undefined;
    for (const value of Array.isArray(definition?.values) ? definition.values.map(record) : []) {
      if (text(value?.id, 30)) fitNames.set(text(value!.id, 30), text(value!.name, 30) || text(value!.id, 30));
    }
    const fitLabel = text(definition?.name, 30) || 'Fit';
    const multiFit = fits.length > 1;

    // Resolve which colour (and SKU) the link names before building the matrix.
    let selectedChoice: string | undefined, selectedSku: string | undefined, selectedFit: string | undefined;
    for (const [key, fit] of fits) {
      const fitChoices = record(fit.customer_choices) ?? {};
      if (!selectedChoice && fitChoices[pid]) { selectedChoice = pid; selectedFit = key; }
      for (const [choiceId, choice] of Object.entries(fitChoices)) {
        const skus = deref(root, record(choice)?.skus);
        if (Array.isArray(skus) && skus.some(sku => text(record(sku)?.sku_id, 20) === pid)) { selectedChoice = choiceId; selectedSku = pid; selectedFit = key; }
      }
      if (selectedSku) break;
    }
    if (!selectedChoice && text(root.input_id, 20) === pid) {
      const fallback = text(record(deref(root, root.selectedCustomerChoice))?.customer_choice_id, 20);
      const preferred = text(root.selectedMultiVariantKey, 30);
      const ordered = [...fits].sort(([a], [b]) => Number(b === preferred) - Number(a === preferred));
      const holder = ordered.find(([, fit]) => record(fit.customer_choices)?.[fallback]);
      if (holder) { selectedChoice = fallback; selectedFit = holder[0]; }
    }
    if (!selectedChoice || !selectedFit) continue;
    // Prefer the page's own fit when the colour exists in several.
    const pageFit = text(root.selectedMultiVariantKey, 30);
    if (!selectedSku && pageFit && record(record(record(root.variants)![pageFit])?.customer_choices)?.[selectedChoice]) selectedFit = pageFit;

    const variants: ProductVariant[] = [];
    const colorwayImages: ProductColorwayGallery[] = [];
    const galleries = new Map<string, string[]>();
    const seen = new Set<string>();
    const selectedFitChoice = record(record(record(record(root.variants)![selectedFit])?.customer_choices)?.[selectedChoice]);
    const selectedFitSkus = deref(root, selectedFitChoice?.skus);
    const linkedSku = selectedSku && Array.isArray(selectedFitSkus) ? selectedFitSkus.map(record).find(item => text(item?.sku_id, 20) === selectedSku) : undefined;
    const currency = (linkedSku ? skuPrice(linkedSku).currency : '') || text(record(selectedFitChoice?.price)?.currency, 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return undefined;

    for (const [fitKey, fit] of fits) {
      const fitName = fitNames.get(fitKey) ?? fitKey.charAt(0) + fitKey.slice(1).toLowerCase();
      const sizeLabel = text(fit.size_dimension1_label, 30) || 'Size';
      const secondLabel = text(fit.size_dimension2_label, 30);
      for (const [choiceId, rawChoice] of Object.entries(record(fit.customer_choices) ?? {})) {
        const fitChoice = record(rawChoice);
        const choice = record(choices[choiceId]);
        const color = text(deref(root, choice?.description), 60) || text(deref(root, fitChoice?.description), 60);
        if (!galleries.has(choiceId)) {
          const images = colorImages(root, choice, sourceUrl, helpers);
          galleries.set(choiceId, images);
          if (color && images.length) colorwayImages.push({ color, colorId: choiceId, images });
        }
        const images = galleries.get(choiceId)!;
        const skus = deref(root, fitChoice?.skus);
        for (const sku of Array.isArray(skus) ? skus.map(record) : []) {
          const id = text(sku?.sku_id, 20);
          if (!sku || !id || seen.has(id)) continue;
          const first = text(sku.size_dimension1, 30) || text(sku.description, 30);
          const second = text(sku.size_dimension2, 30);
          if (!first) continue;
          seen.add(id);
          const size = second ? `${first} × ${second}` : first;
          const stock = skuStock(sku);
          const price = skuPrice(sku);
          const sameCurrency = price.currency === currency;
          variants.push({
            id,
            productId: text(fitChoice?.style_id, 20) || text(choice?.style_id, 20) || undefined,
            colorId: choiceId,
            sourceUrl: `${source.origin}${source.pathname}?pid=${id}`,
            options: [
              { name: 'Color', value: color },
              { name: sizeLabel, value: first },
              ...(second ? [{ name: secondLabel || 'Size 2', value: second }] : []),
              ...(multiFit ? [{ name: fitLabel, value: fitName }] : []),
            ].filter(option => option.value),
            size: multiFit ? `${size} ${fitName}` : size,
            color: color || undefined,
            label: [color, size, multiFit ? fitName : ''].filter(Boolean).join(' · '),
            available: stock.available,
            availabilityKnown: stock.known,
            // Another currency on one SKU would be a different storefront: leave its price unknown.
            price: sameCurrency ? price.amount : undefined,
            ...(sameCurrency && price.amount && price.regular && price.regular > price.amount ? { compareAtPrice: price.regular } : {}),
            image: images[0],
            images,
          });
        }
      }
    }
    if (!variants.length) continue;

    const selectedVariants = variants.filter(variant => variant.colorId === selectedChoice);
    const selectedVariant = selectedSku ? variants.find(variant => variant.id === selectedSku) : undefined;
    const choicePrice = record(selectedFitChoice?.price);
    const minPrice = money(choicePrice?.min_effective_price), maxPrice = money(choicePrice?.max_effective_price);
    const ownPrices = selectedVariants.map(variant => variant.price).filter((value): value is number => value !== undefined);
    const price = selectedVariant?.price ?? minPrice ?? (ownPrices.length ? Math.min(...ownPrices) : undefined);
    const styles = record(root.styles) ?? {};
    const style = record(styles[text(record(choices[selectedChoice])?.style_id, 20)]) ?? Object.values(styles).map(record).find(Boolean);
    const title = text(style?.description, 140);
    if (!title || !price) return undefined;
    const minRegular = money(choicePrice?.min_regular_price), maxRegular = money(choicePrice?.max_regular_price);
    const referencePrice = selectedVariant
      ? selectedVariant.compareAtPrice
      : minRegular && minRegular === maxRegular && minRegular > price ? minRegular : undefined;
    const images = galleries.get(selectedChoice) ?? [];
    const selectedColor = text(deref(root, record(choices[selectedChoice])?.description), 60) || selectedVariants[0]?.color;
    const category = helpers.inferCategory(title, brand);
    const warnings = [
      `Цена, размеры, наличие и фото — из данных страницы ${brand} на момент проверки.`,
      'Доставка магазина не опубликована — указан изменяемый резерв $10.',
      'Вес с упаковкой нужно проверить.',
    ];
    if (!selectedVariant && minPrice && maxPrice && maxPrice > minPrice) warnings.push('Цена этого цвета зависит от размера — указана минимальная. Выберите размер, чтобы увидеть точную цену.');
    if (!selectedVariants.some(variant => variant.available)) warnings.push('Цвет из ссылки сейчас недоступен ни в одном размере. Выберите другой цвет.');
    else if (selectedVariant && !selectedVariant.available) warnings.push('Выбранный размер сейчас недоступен. Выберите другой.');
    const limited = variants.slice(0, MAX_VARIANTS);
    return {
      variantScope: 'group',
      groupId: text(style?.primary_style_id, 20) || text(style?.style_id, 20) || undefined,
      variantsComplete: variants.length <= MAX_VARIANTS && variants.every(variant => variant.availabilityKnown),
      sku: selectedSku ?? selectedChoice,
      ...(selectedSku ? { selectedVariantId: selectedSku } : {}),
      title,
      brand,
      category,
      declarationDescription: helpers.declarationFor(category, title, brand),
      image: images[0],
      images,
      colorwayImages,
      ...(selectedColor ? { selectedVariantColor: selectedColor } : {}),
      price,
      ...(referencePrice ? { referencePrice } : {}),
      currency,
      variants: limited,
      country: 'США',
      warnings,
      sourceUrl,
      method: `${brand} page data`,
    };
  }
  return undefined;
}
