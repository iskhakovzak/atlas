import {declarationFor, dedupeSafeImages, type Extracted, type ProductVariant} from './extract.ts';

type RecordData = Record<string, unknown>;
const record = (value: unknown): RecordData => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordData : {};
const clean = (value: unknown) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/gi, "'").trim() : '';
const attributes = (tag: string) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(match => [match[1].toLowerCase(), clean(match[2] ?? match[3])]));
const hasClass = (tag: Record<string, string>, name: string) => (tag.class ?? '').split(/\s+/).includes(name);

function productSection(html: string, start: number): string | undefined {
  const bounded = html.slice(start, start + 600_000);
  let depth = 0;
  for (const match of bounded.matchAll(/<\/?div\b[^>]*>/gi)) {
    depth += /^<\//.test(match[0]) ? -1 : 1;
    if (depth === 0) return bounded.slice(0, match.index + match[0].length);
  }
  return undefined;
}

function publicProduct(html: string, style: string, colorCode: string): RecordData | undefined {
  for (const match of [...html.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].slice(0, 32)) {
    if (match[1].length > 2_500_000) continue;
    let value: unknown; try {value = JSON.parse(match[1]);} catch {continue;}
    const roots = Array.isArray(value) ? value : [value, ...[record(value)['@graph']].flat()];
    const product = roots.slice(0, 200).map(record).find(item => item['@type'] === 'Product' && item.sku === style
      && item['@id'] === `${style}_${colorCode}` && item.inProductGroupWithID === style);
    if (product) return product;
  }
  return undefined;
}

/** Read native choices for the exact US style/color without guessing its width inventory. */
export function extractSkechersOptions(html: string, sourceUrl: string, fallback: Extracted): Extracted {
  let source: URL; try {source = new URL(sourceUrl);} catch {return fallback;}
  if (!['skechers.com', 'www.skechers.com'].includes(source.hostname) || source.protocol !== 'https:' || source.username || source.password || source.port) return fallback;
  const article = source.pathname.match(/\/(\d{5,8})(?:_([A-Z0-9]{2,8}))?\.html$/i);
  if (!article) return fallback;
  const style = article[1], sourceColor = article[2]?.toUpperCase();
  const markup = html.replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, '');
  const wrappers = [...markup.matchAll(/<div\b[^>]*>/gi)].filter(match => hasClass(attributes(match[0]), 'js-pdp-product-detail')).slice(0, 32);
  const wrapper = wrappers.find(match => {
    const tag = attributes(match[0]); return tag['data-pid'] === style && tag['data-stylecode'] === style;
  });
  const mismatch = () => ({...fallback, price: undefined, variants: [], image: undefined, images: [], selectedVariantColor: undefined,
    warnings: [...fallback.warnings, 'Skechers не подтвердил артикул или цвет из ссылки. Проверьте точную страницу товара.']});
  if (!wrapper) return wrappers.length ? mismatch() : fallback;
  const section = productSection(markup, wrapper.index);
  if (!section) return fallback;

  const variation = (value: string): URL | undefined => {
    try {
      const target = new URL(value, source);
      if (target.origin !== source.origin || target.username || target.password || target.port
        || target.pathname !== '/on/demandware.store/Sites-USSkechers-Site/en_US/Product-Variation'
        || target.searchParams.get('pid') !== style) return undefined;
      return target;
    } catch {return undefined;}
  };
  const buttons = [...section.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)].slice(0, 300).map(match => ({tag: attributes(`<button ${match[1]}>`), body: match[2], raw: match[1]}));
  const selectedColor = buttons.find(button => hasClass(button.tag, 'color-attribute') && hasClass(button.tag, 'selected'));
  const colorCode = selectedColor?.tag['data-style-id'];
  const colorTarget = selectedColor && variation(selectedColor.tag['data-url']);
  if (!colorCode || !colorTarget || colorTarget.searchParams.get(`dwvar_${style}_color`) !== colorCode
    || selectedColor?.tag.id !== `pdp-Color--${colorCode}` || sourceColor && sourceColor !== colorCode
    || source.searchParams.has(`dwvar_${style}_color`) && source.searchParams.get(`dwvar_${style}_color`) !== colorCode) return mismatch();
  const product = publicProduct(html, style, colorCode);
  const color = clean(product?.color);
  if (!product || !color || selectedColor?.tag['aria-label'] !== `Select Color ${color}`) return mismatch();
  const offer = record(product.offers), price = Number(offer.price), currency = clean(offer.priceCurrency);
  if (!Number.isFinite(price) || price <= 0 || currency !== 'USD') return fallback;
  try {
    const offerUrl = new URL(clean(offer.url), source);
    if (offerUrl.origin !== source.origin || offerUrl.username || offerUrl.password || offerUrl.port
      || !new RegExp(`/${style}(?:_${colorCode})?\\.html$`, 'i').test(offerUrl.pathname)) return mismatch();
  } catch {return mismatch();}

  const widths: string[] = [];
  let selectedWidth: string | undefined;
  const sizes: {name: string; unavailable: boolean}[] = [];
  for (const button of buttons) {
    const {tag, body} = button;
    const target = variation(tag['data-url']);
    const unavailable = /(?:^|\s)disabled(?:\s|=|$)/i.test(button.raw) || tag['aria-disabled'] === 'true' || hasClass(tag, 'c-product-attributes__item__selector--unselectable');
    const span = [...body.matchAll(/<span\b[^>]*>/gi)].map(match => attributes(match[0])).find(item => item['data-attr-value']);
    if (hasClass(tag, 'button-select-width')) {
      const width = target?.searchParams.get(`dwvar_${style}_width`);
      if (!width || width.length > 60 || target?.searchParams.get(`dwvar_${style}_color`) !== colorCode
        || tag.id !== `pdp-Width--${width}` || span?.['data-attr-value'] !== width) continue;
      if (!widths.includes(width) && widths.length < 8) widths.push(width);
      if (hasClass(tag, 'selected') || span && hasClass(span, 'selected')) selectedWidth = width;
    } else if (hasClass(tag, 'button-select-size')) {
      const size = tag['data-pdp-attr-value'];
      if (!size || size.length > 20 || !/^\d{1,2}(?:\.\d)?$/.test(size) || tag.id !== `pdp-Size--${size}` || span?.['data-attr-value'] !== size) continue;
      // Globally disabled controls have no variation URL. Their scoped ID and
      // value keep them visible; enabled controls must bind the style/color.
      if (unavailable ? tag['data-url'] !== 'null' && (!target || target.searchParams.get(`dwvar_${style}_color`) !== colorCode || target.searchParams.get(`dwvar_${style}_size`) !== size)
        : !target || target.searchParams.get(`dwvar_${style}_color`) !== colorCode || target.searchParams.get(`dwvar_${style}_size`) !== size) continue;
      if (!sizes.some(item => item.name === size) && sizes.length < 80) sizes.push({name: size, unavailable});
    }
  }
  if (buttons.some(button => hasClass(button.tag, 'button-select-width')) && !widths.length) return mismatch();
  const requestedWidth = source.searchParams.get(`dwvar_${style}_width`), requestedSize = source.searchParams.get(`dwvar_${style}_size`);
  if (requestedWidth && (!widths.includes(requestedWidth) || selectedWidth && selectedWidth !== requestedWidth) || requestedSize && !sizes.some(item => item.name === requestedSize)) return mismatch();
  const widthOptions = selectedWidth ? [selectedWidth] : requestedWidth ? [requestedWidth] : widths.length ? widths : [undefined];
  const images = dedupeSafeImages([product.image].flat().filter(value => typeof value === 'string'), sourceUrl);
  const variants: ProductVariant[] = sizes.flatMap(size => widthOptions.map(width => {
    const option = [size.name, width].filter(Boolean).join(' / ');
    return {size: option, sizeLabel: width ? 'US / Width' : 'US', color, label: `${color} · ${option}`, image: images[0],
      available: !size.unavailable, availabilityKnown: size.unavailable};
  })).slice(0, 250);
  const title = clean(product.name).slice(0, 140) || fallback.title;
  const shoe = [...section.matchAll(/<form\b[^>]*>/gi)].map(match => attributes(match[0])).some(tag => tag['data-masterproduct-id'] === style && tag['data-color-id'] === colorCode && tag['data-is-shoe'] === 'true');
  const category = shoe ? 'Обувь' : fallback.category;
  return {...fallback, sku: style, title, brand: 'Skechers', category, declarationDescription: category ? declarationFor(category, title ?? '', 'Skechers') : fallback.declarationDescription,
    price, currency, country: 'США', image: images[0] ?? fallback.image, images: images.length ? images : fallback.images,
    variants: variants.length ? variants : fallback.variants, selectedVariantColor: color, method: 'Skechers public product controls',
    warnings: [...fallback.warnings, 'Размеры и ширина показаны по странице Skechers. Цена и наличие каждой комбинации требуют проверки в магазине.']};
}
