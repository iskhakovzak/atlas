import {declarationFor, dedupeSafeImages, inferProductCategory, type Extracted, type ProductVariant} from './extract.ts';
import {publicJsonStates} from './public-state.ts';
import {extractSkechersOptions} from './skechers.ts';
import {sameNorthFaceArticle, sourceProductIds} from './source-identity.ts';

type RecordData = Record<string, unknown>;
const object = (value: unknown): RecordData => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordData : {};
const clean = (value: unknown) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/gi, "'").trim() : '';
const attributes = (tag: string) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(match => [match[1].toLowerCase(), clean(match[2] ?? match[3])]));
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;

function gapOptions(html: string, source: URL, fallback: Extracted): Extracted {
  if (source.hostname.replace(/^www\./, '') !== 'gap.com' || !/\/browse\/product\.do$/i.test(source.pathname)) return fallback;
  const pid = source.searchParams.get('pid');
  if (!pid) return fallback;
  for (const script of [...html.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].slice(0, 32)) {
    if (script[1].length > 2_500_000) continue;
    let product: RecordData; try { product = object(JSON.parse(script[1])); } catch { continue; }
    if (product['@type'] !== 'Product' || !Array.isArray(product.offers)) continue;
    const offers = product.offers.map(object).filter(offer => {
      try { const target = new URL(clean(offer.url), source); return target.origin === source.origin && target.pathname === source.pathname
        && target.searchParams.get('pid') === offer.sku && String(offer.sku).startsWith(String(product.productID)); }
      catch { return false; }
    });
    const selected = offers.find(offer => offer.sku === pid);
    if (product.productID !== pid && !selected) continue;
    const currencies = [...new Set(offers.map(offer => clean(offer.priceCurrency)))];
    if (currencies.length !== 1 || !/^[A-Z]{3}$/.test(currencies[0])) return {...fallback, price: undefined, currency: undefined, variants: [],
      warnings: [...fallback.warnings, 'Gap не подтвердил единую валюту выбранного товара. Проверьте цену и валюту вручную.']};
    const prices = offers.map(offer => amount(Number(offer.price)));
    const commonPrice = prices.length && prices.every(price => price !== undefined && price === prices[0]) ? prices[0] : undefined;
    const price = selected ? amount(Number(selected.price)) : commonPrice;
    const color = clean(product.color);
    // Gap's parent image array spans other colours; offer images are exact.
    const images = dedupeSafeImages(offers.map(offer => offer.image), source.href);
    const colorControl = [...html.matchAll(/<div\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi)].find(tag => tag[1] === product.productID);
    const scope = colorControl ? html.slice(colorControl.index, colorControl.index + 60_000) : '';
    const variants: ProductVariant[] = [...scope.matchAll(/<input\b[^>]*>/gi)].map(tag => attributes(tag[0]))
      .filter(tag => tag.name === 'buybox-sizeDimension1' && tag.id?.startsWith('pdp_buybox_dimension_'))
      .slice(0, 80).map(tag => {
        const size = tag.id.slice('pdp_buybox_dimension_'.length), known = ['true','false'].includes(tag['aria-disabled']);
        return {size, color, label: [color, size].filter(Boolean).join(' · '), price: commonPrice, image: images[0],
          available: tag['aria-disabled'] !== 'true', availabilityKnown: known};
      });
    return {...fallback, sku: pid, title: clean(product.name) || fallback.title, brand: 'Gap', price, currency: currencies[0], images, image: images[0] ?? fallback.image,
      variants, selectedVariantColor: color || undefined, method: 'Gap product offers'};
  }
  return fallback;
}

/** Target may publish its exact product/gallery but intentionally omit prices. */
function targetOptions(html: string, source: URL, fallback: Extracted): Extracted {
  if (source.hostname.replace(/^www\./, '') !== 'target.com') return fallback;
  const tcin = source.pathname.match(/\/A-(\d+)\/?$/)?.[1];
  if (!tcin) return fallback;
  for (const root of publicJsonStates(html)) {
    const queries = object(object(root).props).dehydratedState;
    const entries = object(queries).queries;
    if (!Array.isArray(entries)) continue;
    for (const query of entries.slice(0, 32).map(object)) {
      const data = object(object(object(query.state).data).data);
      const modules = data.data_source_modules;
      if (!Array.isArray(modules)) continue;
      for (const productModule of modules.slice(0, 40).map(object)) {
        const product = object(object(object(productModule.module_data).data).product);
        const children = Array.isArray(product.children) ? product.children.map(object) : [product];
        const selected = children.find(child => child.tcin === tcin);
        if (!selected) continue;
        const item = object(selected.item), description = object(item.product_description), enrichment = object(item.enrichment), sourceImages = object(enrichment.images);
        const title = clean(description.title) || fallback.title;
        const gallery: unknown[] = [];
        const zones = object(data.layout).zones;
        if (Array.isArray(zones)) for (const zone of zones.slice(0, 16).map(object)) {
          if (!Array.isArray(zone.module_groups)) continue;
          for (const group of zone.module_groups.slice(0, 16).map(object)) {
            if (!Array.isArray(group.modules)) continue;
            for (const galleryModule of group.modules.slice(0, 32).map(object)) {
              const records = object(galleryModule.module_data).data_by_tcin;
              if (!Array.isArray(records)) continue;
              const assets = object(records.slice(0, 80).map(object).find(record => record.tcin === tcin)?.product_gallery).assets;
              if (Array.isArray(assets)) gallery.push(...assets.slice(0, 12).map(asset => object(asset).url));
            }
          }
        }
        const images = dedupeSafeImages([sourceImages.primary_image_url, ...gallery, ...(Array.isArray(sourceImages.alternate_image_urls) ? sourceImages.alternate_image_urls : [])], source.href);
        const variants: ProductVariant[] = Array.isArray(product.variation_hierarchy) ? product.variation_hierarchy.map(object)
          .filter(option => children.some(child => child.tcin === option.tcin) && clean(option.name) && clean(option.value)).slice(0, 80)
          .map(option => ({id: clean(option.tcin), size: option.name === 'Size' ? clean(option.value) : undefined, sizeLabel: option.name === 'Size' ? 'Size' : undefined,
            label: `${clean(option.name)}: ${clean(option.value)}`, image: dedupeSafeImages([option.primary_image_url], source.href)[0], available: true, availabilityKnown: false})) : [];
        return {...fallback, sku: tcin, title, image: images[0] ?? fallback.image, images: images.length ? images : fallback.images, variants,
          method: 'Target public product data', warnings: [...fallback.warnings, 'Target не подтвердил наличие по размерам. Цена и выбранный размер требуют проверки.']};
      }
    }
  }
  return fallback;
}

/** TNF ProductGroup children add size to the exact article/colour URL. */
function northFaceOptions(html: string, source: URL, fallback: Extracted): Extracted {
  if (source.hostname.replace(/^www\./, '') !== 'thenorthface.com') return fallback;
  const colorUrl = new URL(source); colorUrl.searchParams.delete('size');
  const matches = (value: unknown) => {
    if (typeof value !== 'string') return false;
    try { const candidate = new URL(value, source); candidate.searchParams.delete('size'); return sameNorthFaceArticle(candidate.href, colorUrl.href); }
    catch { return false; }
  };
  const nodes: RecordData[] = [];
  for (const script of [...html.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].slice(0, 32)) {
    if (script[1].length > 2_500_000) continue;
    try {
      const parsed = JSON.parse(script[1]);
      nodes.push(...(Array.isArray(parsed) ? parsed : Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed]).map(object));
    } catch { /* Keep the shared editable fallback. */ }
  }
  const group = nodes.find(node => node['@type'] === 'ProductGroup' && matches(node.url) && Array.isArray(node.hasVariant) && node.hasVariant.length);
  if (!group) return fallback;
  const children = (group.hasVariant as unknown[]).map(object).filter(child => {
    const offer = object(child.offers); return child['@type'] === 'Product' && matches(offer.url ?? child.url ?? child['@id']);
  }).slice(0, 80);
  const parent = nodes.find(node => node['@type'] === 'Product' && matches(node.url));
  const requestedSize = source.searchParams.get('size');
  const selected = requestedSize ? children.find(child => clean(child.size) === requestedSize) : undefined;
  if (requestedSize && !selected) return {...fallback, price: undefined, variants: [], warnings: [...fallback.warnings, 'The North Face не подтвердил размер из ссылки. Проверьте его вручную.']};
  const offer = object(selected?.offers ?? parent?.offers), currency = clean(offer.priceCurrency);
  if (!/^[A-Z]{3}$/.test(currency)) return fallback;
  const imageValues = (value: unknown) => (Array.isArray(value) ? value : [value]).map(image => typeof image === 'string' ? image : object(image).url ?? object(image).contentUrl);
  const images = dedupeSafeImages([...imageValues(parent?.image), ...imageValues(selected?.image), ...children.flatMap(child => imageValues(child.image))], source.href);
  const variants: ProductVariant[] = children.flatMap(child => {
    const childOffer = object(child.offers), size = clean(child.size), color = clean(child.color);
    if (!size || childOffer.priceCurrency !== currency) return [];
    const stock = clean(childOffer.availability).split('/').at(-1);
    return [{id: clean(child.sku) || undefined, size, color, label: [color, size].filter(Boolean).join(' · '), price: amount(childOffer.price),
      image: dedupeSafeImages(imageValues(child.image), source.href)[0], available: stock !== 'OutOfStock' && stock !== 'SoldOut' && stock !== 'Discontinued',
      availabilityKnown: ['InStock', 'OutOfStock', 'SoldOut', 'Discontinued', 'LimitedAvailability', 'PreOrder', 'BackOrder'].includes(stock ?? '')}];
  });
  return {...fallback, sku: clean(selected?.sku ?? parent?.sku) || fallback.sku, title: clean(parent?.name ?? group.name) || fallback.title, brand: 'The North Face', price: amount(offer.price), currency,
    image: images[0] ?? fallback.image, images: images.length ? images : fallback.images, variants,
    selectedVariantColor: clean(selected?.color ?? children[0]?.color) || undefined, method: 'The North Face product group'};
}

/** UNIQLO's exact PDP entity includes prices/gallery but may omit size stock. */
function uniqloOptions(html: string, source: URL, fallback: Extracted): Extracted {
  if (source.hostname.replace(/^www\./, '') !== 'uniqlo.com' || !source.pathname.startsWith('/us/en/products/')) return fallback;
  const requested = source.pathname.match(/\/products\/(E\d+-\d+)\/(\d+)/)?.slice(1);
  if (!requested) return fallback;
  const key = requested.join('-');
  for (const root of publicJsonStates(html)) {
    const state = object(root);
    if (object(state.pdp).product !== key) continue;
    const product = object(object(object(object(state.entity).pdpEntity)[key]).product);
    if (product.productId !== requested[0]) continue;
    const prices = object(product.prices), base = object(prices.base), promo = object(prices.promo);
    const currency = clean(object(base.currency).code);
    if (!/^[A-Z]{3}$/.test(currency)) return fallback;
    const price = object(promo.currency).code === currency ? amount(promo.value) ?? amount(base.value) : amount(base.value);
    const colors = Array.isArray(product.colors) ? product.colors.map(object).filter(c => clean(c.name) && clean(c.displayCode)) : [];
    const requestedColor = source.searchParams.get('colorDisplayCode');
    const selected = requestedColor ? colors.find(c => c.displayCode === requestedColor) : colors.find(c => c.displayCode === object(object(product.representative).color).displayCode);
    if (!selected || source.searchParams.getAll('colorDisplayCode').length > 1) return {...fallback, price: undefined, variants: [], image: undefined, images: [], colorwayImages: [], selectedVariantColor: undefined, warnings: [...fallback.warnings, 'UNIQLO не подтвердил цвет из ссылки. Проверьте его вручную.']};
    const images = object(product.images), main = object(images.main);
    const gallery = (color: RecordData) => dedupeSafeImages([object(main[clean(color.displayCode)]).image,
      ...(Array.isArray(images.sub) ? images.sub.map(object).filter(image => !image.colorCode || image.colorCode === color.displayCode).map(image => image.image) : [])], source.href);
    // Sizes are a product dictionary, not per-colour inventory. Keep that uncertainty.
    const sizes = Array.isArray(product.sizes) ? product.sizes.map(object).filter(size => clean(size.name)) : [];
    const requestedSize = source.searchParams.get('sizeDisplayCode');
    const selectedSize = requestedSize ? sizes.find(size => size.displayCode === requestedSize) : undefined;
    const missingSelectedSize = requestedSize !== null && (!selectedSize || source.searchParams.getAll('sizeDisplayCode').length !== 1);
    const variants: ProductVariant[] = colors.flatMap(color => sizes.map(size => ({
      id: `${color.displayCode}-${size.displayCode}`, color: clean(color.name), size: clean(size.name), sizeLabel: 'Size',
      label: `${clean(color.name)} · ${clean(size.name)}`, price: missingSelectedSize ? undefined : price, image: gallery(color)[0], available: true, availabilityKnown: false,
    }))).slice(0, 80);
    return {...fallback, sku: clean(product.productId), title: clean(product.name) || fallback.title, brand: 'UNIQLO',
      price: missingSelectedSize ? undefined : price, currency, country: 'США', image: gallery(selected)[0], images: gallery(selected), variants,
      selectedVariantId: selectedSize && !missingSelectedSize ? `${selected.displayCode}-${selectedSize.displayCode}` : undefined,
      colorwayImages: colors.slice(0, 80).map(color => ({color: clean(color.name), images: gallery(color)})), selectedVariantColor: clean(selected.name),
      method: 'UNIQLO public product data', warnings: [...fallback.warnings, ...(missingSelectedSize ? ['Размер из ссылки UNIQLO не найден. Проверьте его вручную.'] : []), 'UNIQLO не опубликовал наличие по размерам. Выбранный размер требует проверки.']};
  }
  return fallback;
}

/** Converse publishes scoped Product/Offer microdata and native size controls. */
function converseOptions(html: string, source: URL, fallback: Extracted): Extracted {
  if (source.hostname.replace(/^www\./, '') !== 'converse.com') return fallback;
  const safeHtml = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const wrapper = safeHtml.match(/<div\b[^>]*\bid=["']pdpMain["'][^>]*>/i);
  if (!wrapper || wrapper.index === undefined || !/\bitemtype=["']https?:\/\/schema\.org\/Product["']/i.test(wrapper[0])) return fallback;
  const bounded = safeHtml.slice(wrapper.index, wrapper.index + 600_000);
  let depth = 0, end = 0;
  for (const match of bounded.matchAll(/<div\b[^>]*>|<\/div\s*>/gi)) {
    depth += /^<\//.test(match[0]) ? -1 : 1;
    if (depth === 0) { end = match.index + match[0].length; break; }
  }
  if (!end) return fallback;
  const section = bounded.slice(0, end);
  const metas = [...section.matchAll(/<meta\b[^>]*>/gi)].map(match => attributes(match[0]));
  const identity = metas.find(meta => meta.itemprop === 'productID');
  const id = identity?.['data-product-id'], master = identity?.['data-masterid'];
  if (!id || !master || !sourceProductIds(source.href).has(id.toLowerCase())) return fallback;
  const meta = (key: string) => metas.find(tag => tag.itemprop === key)?.content;
  const price = amount(Number(meta('price'))), currency = meta('priceCurrency');
  if (!price || !currency || !/^[A-Z]{3}$/.test(currency)) return fallback;
  const color = meta('color');
  const title = clean(section.match(/<h1\b[^>]*\bitemprop=["']name["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || fallback.title;
  const gallery = dedupeSafeImages([...section.matchAll(/<img\b[^>]*>/gi)].map(match => attributes(match[0]))
    .filter(tag => /pdp-images(?:__primary-image__media|-gallery)/.test(tag.class ?? '') || tag.itemprop === 'image')
    .map(tag => tag['data-src'] || tag.src), source.href);
  const selector = section.match(/<select\b[^>]*\bid=["']variationDropdown-size["'][^>]*>([\s\S]*?)<\/select>/i)?.[1] ?? '';
  const variants: ProductVariant[] = [];
  for (const option of selector.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
    const tag = attributes(`<option ${option[1]}>`), size = clean(option[2]);
    try {
      const target = new URL(tag.value, source);
      if (target.origin !== source.origin || !target.pathname.endsWith('/Product-Variation') || target.searchParams.get('pid') !== master
        || target.searchParams.get('styleNo') !== id || !target.searchParams.get(`dwvar_${master}_size`)
        || target.searchParams.get(`dwvar_${master}_color`)?.toLowerCase() !== color?.toLowerCase() || !size) continue;
    } catch { continue; }
    const unavailable = /\bdisabled\b/i.test(option[1]) || /(?:^|\s)(?:unselectable|unavailable|disabled)(?:\s|$)/.test(tag.class ?? '');
    variants.push({size, sizeLabel: 'US', color, label: [color, size].filter(Boolean).join(' · '), price, image: gallery[0] ?? fallback.image,
      available: !unavailable, availabilityKnown: true});
    if (variants.length >= 80) break;
  }
  return {...fallback, sku: id, title, brand: 'Converse', price, currency, country: 'США', variants,
    image: gallery[0] ?? fallback.image, images: gallery.length ? gallery : fallback.images, selectedVariantColor: color, method: 'Converse product microdata'};
}

/** Read the exact product's native size controls, never recommendation cards. */
function tommyOptions(html: string, source: URL, fallback: Extracted): Extracted {
  if (source.hostname !== 'usa.tommy.com' || !fallback.sku || !fallback.currency) return fallback;
  const id = fallback.sku;
  const wrapper = [...html.matchAll(/<div\b[^>]*\bdata-pid\s*=\s*["'][^"']+["'][^>]*>/gi)].find(match => attributes(match[0])['data-pid'] === id);
  if (!wrapper || !sourceProductIds(source.href).has(id.toLowerCase())) return fallback;
  const section = html.slice(wrapper.index, wrapper.index + 100_000);
  const colorMatch = section.match(/<h3\b[^>]*id=["']pdp-attr-colorCode["'][^>]*>([\s\S]*?)<\/h3>/i);
  const color = clean(colorMatch?.[1].match(/<span\b[^>]*class=["'][^"']*variation__attr--value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);
  const variants: ProductVariant[] = [];
  for (const match of section.matchAll(/<input\b[^>]*>[\s\S]*?<label\b[^>]*>[\s\S]*?<\/label>/gi)) {
    const input = attributes(match[0].match(/<input\b[^>]*>/i)?.[0] ?? '');
    if (input['data-display-id'] !== 'size' || !input.id?.startsWith(`${id}_sizeitem`)) continue;
    const label = attributes(match[0].match(/<label\b[^>]*>/i)?.[0] ?? '');
    const size = input['data-attr-value'];
    if (!size || label.for !== input.id) continue;
    try {
      const target = new URL(input['data-url'], source);
      if (target.origin !== source.origin || target.searchParams.get('pid') !== id || !target.pathname.endsWith('/Product-Variation')) continue;
    } catch { continue; }
    const available = /(?:^|\s)size-enabled(?:\s|$)/.test(label.class ?? '');
    const unavailable = /(?:^|\s)(?:size-disabled|disabled|unavailable)(?:\s|$)/.test(`${label.class ?? ''} ${input.class ?? ''}`);
    variants.push({label: [color, size].filter(Boolean).join(' · '), color: color || undefined, size, sizeLabel: 'Size',
      price: fallback.price, image: fallback.image, available: !unavailable, availabilityKnown: available || unavailable});
    if (variants.length >= 80) break;
  }
  return variants.length ? {...fallback, variants, selectedVariantColor: color || undefined, method: 'Tommy Hilfiger product page'} : fallback;
}

/** PUMA serializes public GraphQL results as JSON strings inside urqlState. */
function pumaOptions(html: string, source: URL, fallback: Extracted): Extracted {
  if (source.hostname !== 'us.puma.com' || !fallback.currency) return fallback;
  for (const state of publicJsonStates(html)) {
    const urql = object(object(object(state).props).urqlState);
    for (const entry of Object.values(urql).slice(0, 32)) {
      const raw = object(entry).data;
      if (typeof raw !== 'string' || raw.length > 1_000_000) continue;
      let product: RecordData;
      try { product = object(object(JSON.parse(raw)).product); } catch { continue; }
      if (!sourceProductIds(source.href).has(String(product.id).toLowerCase()) || !Array.isArray(product.variations)) continue;
      const colors = product.variations.map(object).filter(color => color.masterId === product.id && clean(color.colorName));
      const selectedCode = source.searchParams.get('swatch');
      const selected = selectedCode ? colors.find(color => color.colorValue === selectedCode) : colors.find(color => color.colorName === fallback.variants?.[0]?.color) ?? colors[0];
      // A removed swatch may silently render the default colour in JSON-LD.
      if (!selected) return {...fallback, price: undefined, variants: [], warnings: [...fallback.warnings, 'Цвет из ссылки PUMA не найден. Проверьте выбранный цвет вручную.']};
      const gallery = (color: RecordData) => dedupeSafeImages([color.preview, ...(Array.isArray(color.images) ? color.images.map(image => object(image).href) : [])], source.href);
      const priceFor = (color: RecordData) => amount(color.salePrice) ?? amount(color.price);
      const variants: ProductVariant[] = colors.slice(0, 80).map(color => ({
        id: clean(color.variantId) || undefined, label: clean(color.colorName), color: clean(color.colorName), price: priceFor(color), image: gallery(color)[0],
        available: color.orderable !== false, availabilityKnown: false,
      }));
      return {...fallback, sku: String(product.id), brand: 'PUMA', price: priceFor(selected), images: gallery(selected), image: gallery(selected)[0] ?? fallback.image,
        variants, selectedVariantColor: clean(selected.colorName), colorwayImages: colors.slice(0, 80).map(color => ({color: clean(color.colorName), images: gallery(color)})),
        method: 'PUMA public product data', warnings: [...fallback.warnings, 'PUMA опубликовал цвета, но не наличие размеров. Размер нужно проверить и подтвердить вручную.']};
    }
  }
  return fallback;
}

/** The US Ralph Lauren PDP publishes native product/price/size attributes. */
function ralphLaurenOptions(html: string, source: URL, fallback: Extracted): Extracted {
  if (source.hostname.replace(/^www\./, '') !== 'ralphlauren.com') return fallback;
  const start = html.search(/\bid=["']pdpMain["']/i);
  if (start < 0) return fallback;
  const section = html.slice(start, Math.min(html.length, start + 160_000));
  const id = section.match(/\bdata-masterid=["']([^"']+)["']/i)?.[1];
  if (!id || !sourceProductIds(source.href).has(id.toLowerCase())) return fallback;
  const color = [...section.matchAll(/<a\b[^>]*\bdata-action=["']normalswatchescolor["'][^>]*>/gi)].map(match => attributes(match[0]))
    .find(tag => /^Selected\b/i.test(tag['aria-label'] ?? ''))?.['data-color'];
  const requestedColor = source.searchParams.get(`dwvar_${id}_colorname`);
  if (requestedColor && color !== requestedColor) return {...fallback, price: undefined, variants: [], warnings: [...fallback.warnings, 'Ralph Lauren не подтвердил цвет из ссылки. Проверьте его вручную.']};
  const priceTag = [...section.matchAll(/<input\b[^>]*>/gi)].map(match => attributes(match[0])).find(tag => tag.id === `master-${id}`);
  const cents = Number(priceTag?.['data-price-value']);
  // Fixed US storefront + its native US variation route + visible dollar
  // amount must agree. Do not copy a minimum/range or a promo percentage.
  const usPrice = /\/Sites-RalphLauren_US-Site\/en_US\//.test(section) && Number.isSafeInteger(cents) && cents > 0
    && section.includes(`$${(cents / 100).toFixed(2)}`) && Boolean(color);
  const price = usPrice ? cents / 100 : undefined;
  const title = clean(section.match(/<h1\b[^>]*class=["'][^"']*product-name[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || fallback.title;
  const variants: ProductVariant[] = [];
  for (const match of section.matchAll(/<li\b(?=[^>]*\bclass=["'][^"']*\bvariations-attribute\b)([^>]*)>([\s\S]*?)<\/li>/gi)) {
    const tag = match[2].match(/<a\b[^>]*\bdata-action=["']normalswatchessize["'][^>]*>/i)?.[0];
    if (!tag) continue;
    const a = attributes(tag), size = a['data-selected'];
    try {
      const target = new URL(a.href, source);
      if (target.origin !== source.origin || target.searchParams.get('pid') !== id || !target.pathname.endsWith('/Product-Variation')
        || target.searchParams.get(`dwvar_${id}_colorname`) !== color || !size) continue;
    } catch { continue; }
    const classes = attributes(`<li ${match[1]}>`).class ?? '';
    const available = /(?:^|\s)selectable(?:\s|$)/.test(classes);
    const unavailable = /(?:^|\s)(?:unselectable|unavailable|disabled)(?:\s|$)/.test(classes);
    variants.push({label: [color, size].filter(Boolean).join(' · '), size, sizeLabel: 'Size', color, price, image: fallback.image,
      available: !unavailable, availabilityKnown: available || unavailable});
    if (variants.length >= 80) break;
  }
  return {...fallback, sku: id, title, brand: 'Ralph Lauren', price, currency: price ? 'USD' : fallback.currency, variants,
    selectedVariantColor: color, method: 'Ralph Lauren product page'};
}

export function enrichMerchantOptions(html: string, sourceUrl: string, fallback: Extracted): Extracted {
  const source = new URL(sourceUrl);
  const native = targetOptions(html, source, gapOptions(html, source, northFaceOptions(html, source, converseOptions(html, source, uniqloOptions(html, source, ralphLaurenOptions(html, source, pumaOptions(html, source, tommyOptions(html, source, fallback))))))));
  const result = extractSkechersOptions(html, sourceUrl, native);
  if (result === fallback) return result;
  const category = result.category && result.category !== 'Другое' ? result.category : inferProductCategory(result.title ?? '', result.brand ?? '');
  return {...result, category, declarationDescription: declarationFor(category, result.title ?? '', result.brand ?? ''),
    warnings: result.price !== undefined ? result.warnings.filter(warning => !warning.startsWith('Цена не найдена:')) : result.warnings};
}
