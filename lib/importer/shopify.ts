import {declarationFor, inferProductCategory, safeImage, type Extracted, type ProductVariant} from './extract.ts';

// Public Ajax endpoints only; no customer session, admin token or checkout access.
export const shopifyStoreRoots = ['allbirds.com', 'kyliecosmetics.com', 'colourpop.com', 'fashionnova.com', 'stevemadden.com', 'bombas.com', 'anker.com', 'gymshark.com'] as const;

export function shopifyEndpoints(source: URL) {
  if (!shopifyStoreRoots.some(root => source.hostname === root || source.hostname === `www.${root}`)) return;
  const match = source.pathname.match(/^(\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?)(?:collections\/[^/]+\/)?products\/([^/]+)\/?$/i);
  if (!match || /\.(?:js|json)$/i.test(match[2])) return;
  return {product: new URL(`${match[1]}products/${match[2]}.js`, source), currency: new URL(`${match[1]}cart.js`, source), handle: match[2]};
}

type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const label = (value: unknown) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim().slice(0, 140) : '';
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value / 100 : undefined;

export function extractShopify(data: unknown, currencyData: unknown, sourceUrl: string): Extracted {
  const source = new URL(sourceUrl), endpoints = shopifyEndpoints(source), product = object(data);
  if (!endpoints || product.handle !== endpoints.handle || !label(product.title) || !Array.isArray(product.variants)) throw Error('Не удалось определить товар магазина.');
  const currency = label(object(currencyData).currency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw Error('Магазин не подтвердил валюту цены.');
  const gallery = (values: unknown[]) => [...new Set(values.map(value => safeImage(typeof value === 'object' ? object(value).src : value, sourceUrl)).filter((value): value is string => Boolean(value)))].slice(0, 12);
  const images = gallery([product.featured_image, ...[product.images].flat()]);
  const options = Array.isArray(product.options) ? product.options.map(option => label(typeof option === 'string' ? option : object(option).name)) : [];
  const variants: ProductVariant[] = product.variants.slice(0, 250).map(raw => {
    const v = object(raw), values = [v.option1, v.option2, v.option3].map(label);
    return {id: String(v.id ?? ''), label: label(v.public_title ?? v.title) || 'Стандартный', available: v.available === true,
      price: amount(v.price), image: gallery([v.featured_image, product.featured_image])[0],
      size: values[options.findIndex(name => /^(size|shoe size|размер)$/i.test(name))] || undefined,
      color: values[options.findIndex(name => /^(colou?r|shade|цвет)$/i.test(name))] || undefined};
  });
  const selectedId = source.searchParams.get('variant');
  const selected = selectedId ? variants.find(v => v.id === selectedId) : undefined;
  // A range/minimum never becomes the quoted price of an unselected variant.
  const prices = [...new Set(variants.map(v => v.price).filter(v => v !== undefined))];
  const price = selected ? selected.price : prices.length === 1 ? prices[0] : undefined;
  const title = label(product.title), brand = label(product.vendor), category = inferProductCategory(`${title} ${label(product.type)}`, brand);
  const warnings = ['Доставка магазина не опубликована — добавлен изменяемый резерв $10.', 'Вес с упаковкой нужно проверить.'];
  if (price === undefined) warnings.push('Выберите вариант, чтобы получить его точную цену.');
  if (selected && !selected.available) warnings.push('Вариант из ссылки отсутствует в наличии. Выберите другой вариант.');
  if (selectedId && !selected) warnings.push('Вариант из ссылки не найден. Проверьте размер или цвет.');
  if (!variants.some(v => v.available)) warnings.push('Магазин не указал доступных вариантов этого товара.');
  return {title, brand, category, declarationDescription: declarationFor(category, title, brand), image: selected?.image ?? images[0], images: gallery([selected?.image, ...images]), price, currency, variants, warnings, sourceUrl, method: 'Shopify product API'};
}
