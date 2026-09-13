import {declarationFor, inferProductCategory, safeImage, type Extracted, type ProductVariant} from './extract.ts';

// Public Ajax endpoints only; no customer session, admin token or checkout access.
export const shopifyStoreRoots = [
  'allbirds.com', 'kyliecosmetics.com', 'colourpop.com', 'fashionnova.com', 'stevemadden.com', 'bombas.com', 'anker.com', 'gymshark.com',
  'aloyoga.com', 'rarebeauty.com', 'rhodeskin.com', 'glossier.com', 'summerfridays.com', 'fentybeauty.com',
  'kith.com', 'cncpts.com', 'sneakersnstuff.com', 'satechi.com', 'satechi.net', 'spigen.com',
  '3ina.com', 'bluebananabrand.com', 'footdistrict.com', 'nakedcph.com', 'nude-project.com', 'pdpaola.com', 'saigucosmetics.com', 'scalperscompany.com',
  'representclo.com', 'tower28beauty.com', 'meritbeauty.com', 'goodamerican.com', 'kosas.com', 'fahertybrand.com',
] as const;

export const hasEnhancedStoreImport = (root: string) =>
  shopifyStoreRoots.some(store => store === root);

const categoryByStore: Record<string, ReturnType<typeof inferProductCategory>> = {
  'allbirds.com': 'Обувь', 'stevemadden.com': 'Обувь', 'kith.com': 'Обувь', 'cncpts.com': 'Обувь', 'sneakersnstuff.com': 'Обувь',
  'kyliecosmetics.com': 'Красота и уход', 'colourpop.com': 'Красота и уход', 'rarebeauty.com': 'Красота и уход', 'rhodeskin.com': 'Красота и уход',
  'glossier.com': 'Красота и уход', 'summerfridays.com': 'Красота и уход', 'fentybeauty.com': 'Красота и уход',
  'fashionnova.com': 'Одежда', 'bombas.com': 'Одежда', 'gymshark.com': 'Одежда', 'aloyoga.com': 'Одежда',
  'anker.com': 'Электроника', 'satechi.com': 'Электроника', 'satechi.net': 'Электроника', 'spigen.com': 'Электроника',
  'footdistrict.com': 'Обувь', 'nakedcph.com': 'Обувь',
  'nude-project.com': 'Одежда', 'scalperscompany.com': 'Одежда', 'bluebananabrand.com': 'Одежда', 'representclo.com': 'Одежда', 'goodamerican.com': 'Одежда', 'fahertybrand.com': 'Одежда',
  '3ina.com': 'Красота и уход', 'saigucosmetics.com': 'Красота и уход', 'tower28beauty.com': 'Красота и уход', 'meritbeauty.com': 'Красота и уход', 'kosas.com': 'Красота и уход',
  'pdpaola.com': 'Аксессуары',
};

const countryByStore: Record<string, {code: string; name: string}> = {
  '3ina.com': {code:'ES',name:'Испания'}, 'bluebananabrand.com': {code:'ES',name:'Испания'}, 'footdistrict.com': {code:'ES',name:'Испания'},
  'nude-project.com': {code:'ES',name:'Испания'}, 'pdpaola.com': {code:'ES',name:'Испания'}, 'saigucosmetics.com': {code:'ES',name:'Испания'}, 'scalperscompany.com': {code:'ES',name:'Испания'},
  'nakedcph.com': {code:'DK',name:'Дания'}, 'representclo.com': {code:'GB',name:'Великобритания'},
  'tower28beauty.com': {code:'US',name:'США'}, 'meritbeauty.com': {code:'US',name:'США'}, 'goodamerican.com': {code:'US',name:'США'}, 'kosas.com': {code:'US',name:'США'}, 'fahertybrand.com': {code:'US',name:'США'},
  'allbirds.com': {code:'US',name:'США'}, 'kyliecosmetics.com': {code:'US',name:'США'}, 'colourpop.com': {code:'US',name:'США'}, 'fashionnova.com': {code:'US',name:'США'},
  'stevemadden.com': {code:'US',name:'США'}, 'bombas.com': {code:'US',name:'США'}, 'anker.com': {code:'US',name:'США'}, 'gymshark.com': {code:'US',name:'США'},
  'aloyoga.com': {code:'US',name:'США'}, 'rarebeauty.com': {code:'US',name:'США'}, 'rhodeskin.com': {code:'US',name:'США'}, 'glossier.com': {code:'US',name:'США'},
  'summerfridays.com': {code:'US',name:'США'}, 'fentybeauty.com': {code:'US',name:'США'}, 'kith.com': {code:'US',name:'США'}, 'cncpts.com': {code:'US',name:'США'},
  'satechi.com': {code:'US',name:'США'}, 'satechi.net': {code:'US',name:'США'}, 'spigen.com': {code:'US',name:'США'},
};

const countryNames: Record<string, string> = {
  US:'США', GB:'Великобритания', ES:'Испания', DK:'Дания', DE:'Германия', FR:'Франция', IT:'Италия',
  CA:'Канада', AU:'Австралия', AE:'ОАЭ', TR:'Турция', JP:'Япония', KR:'Южная Корея', RO:'Румыния',
};

function storefrontCountry(source: URL) {
  const localeCode = source.pathname.match(/^\/[a-z]{2}-([a-z]{2})(?:\/|$)/i)?.[1].toUpperCase();
  if (localeCode && countryNames[localeCode]) return {code: localeCode, name: countryNames[localeCode]};
  return countryByStore[storeRoot(source.hostname)];
}

const storeRoot = (hostname: string) => hostname.toLowerCase().replace(/^www\./, '');

export function shopifyEndpoints(source: URL) {
  if (!shopifyStoreRoots.some(root => source.hostname === root || source.hostname === `www.${root}`)) return;
  const match = source.pathname.match(/^(\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?)(?:collections\/[^/]+\/)?products\/([^/]+)\/?$/i);
  if (!match || /\.(?:js|json)$/i.test(match[2])) return;
  const storefront = new URL(source);
  if (/^(?:www\.)?satechi\.net$/i.test(storefront.hostname)) storefront.hostname = 'satechi.com';
  const product = new URL(`${match[1]}products/${match[2]}.js`, storefront);
  const currency = new URL(`${match[1]}cart.js`, storefront);
  // Shopify can localize by server IP. Pin the public storefront country so the
  // product and cart endpoints agree with the regional URL chosen by the user.
  const country = storefrontCountry(source);
  if (country) { product.searchParams.set('country', country.code); currency.searchParams.set('country', country.code); }
  return {product, currency, handle: match[2]};
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
  const colorIndex = options.findIndex(name => /^(colou?r|shade|цвет)$/i.test(name));
  const choiceIndexes = options.map((_, index) => index).filter(index => index !== colorIndex);
  const variants: ProductVariant[] = product.variants.slice(0, 250).map(raw => {
    const v = object(raw), values = [v.option1, v.option2, v.option3].map(label);
    const chosenIndexes = choiceIndexes.filter(index => values[index] && !/^default title$/i.test(values[index]));
    return {id: v.id === undefined ? undefined : String(v.id), label: label(v.public_title ?? v.title) || 'Стандартный', available: v.available === true,
      price: amount(v.price), image: gallery([v.featured_image, product.featured_image])[0],
      size: chosenIndexes.map(index => values[index]).join(' / ') || undefined,
      sizeLabel: chosenIndexes.map(index => options[index]).join(' / ') || undefined,
      color: values[colorIndex] || undefined};
  });
  const selectedId = source.searchParams.get('variant');
  const selected = selectedId ? variants.find(v => v.id === selectedId) : undefined;
  // A range/minimum never becomes the quoted price of an unselected variant.
  const prices = [...new Set(variants.map(v => v.price).filter(v => v !== undefined))];
  const price = selected ? selected.price : prices.length === 1 ? prices[0] : undefined;
  const title = label(product.title), brand = label(product.vendor);
  const category = categoryByStore[storeRoot(source.hostname)] ?? inferProductCategory(`${title} ${label(product.type)}`, brand);
  const warnings = ['Доставка магазина не опубликована — добавлен изменяемый резерв $10.', 'Вес с упаковкой нужно проверить.'];
  if (price === undefined) warnings.push('Выберите вариант, чтобы получить его точную цену.');
  if (selected && !selected.available) warnings.push('Вариант из ссылки отсутствует в наличии. Выберите другой вариант.');
  if (selectedId && !selected) warnings.push('Вариант из ссылки не найден. Проверьте размер или цвет.');
  if (!variants.some(v => v.available)) warnings.push('Магазин не указал доступных вариантов этого товара.');
  return {title, brand, category, declarationDescription: declarationFor(category, title, brand), image: selected?.image ?? images[0], images: gallery([selected?.image, ...images]), price, currency, variants, warnings, sourceUrl, method: 'Shopify product API', country: storefrontCountry(source)?.name};
}
