import {extractProduct} from './extract.ts';
import {extractShopify, shopifyEndpoints} from './shopify.ts';
import {isSupportedStoreHost,supportedStoreCount} from './stores.ts';
export {supportedStoreCount};

export function allowedUrl(value: string) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !isSupportedStoreHost(u.hostname))
    throw Error('Этот магазин пока не в списке поддерживаемых. Вставьте ссылку из одного из ' + supportedStoreCount + ' магазинов или заполните товар вручную.');
  return u;
}

async function readPublic(start: URL, signal: AbortSignal, format: 'html' | 'json') {
  let url = start;
  for (let i = 0; i < 4; i++) {
    const response = await fetch(url, {redirect: 'manual', signal, headers: {
      Accept: format === 'json' ? 'application/json' : 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9', 'Cache-Control': 'no-cache',
    }});
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || i === 3) throw Error('Магазин перенаправляет запрос. Используйте прямую ссылку на товар.');
      url = allowedUrl(new URL(location, url).href);
      if (format === 'json' && url.origin !== start.origin) throw Error('Магазин изменил регион. Используйте прямую ссылку нужного региона.');
      continue;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !(format === 'html' ? contentType.includes('text/html') : /json|javascript/i.test(contentType))) {
      await response.body?.cancel();
      throw Error('Магазин не разрешил загрузить данные. Заполните их вручную.');
    }
    const reader = response.body?.getReader();
    if (!reader) throw Error('Пустая страница');
    let size = 0, text = '';
    const decoder = new TextDecoder();
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > (format === 'html' ? 3_000_000 : 1_000_000)) {
        await reader.cancel();
        throw Error('Страница слишком большая для автозагрузки. Заполните данные вручную.');
      }
      text += decoder.decode(value, {stream: true});
    }
    return {text: text + decoder.decode(), url};
  }
  throw Error('Не удалось загрузить товар.');
}

export async function fetchProduct(value: string) {
  const url = allowedUrl(value), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const endpoints = shopifyEndpoints(url);
    if (endpoints) {
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(6500)]);
        const [product, currency] = await Promise.all([
          readPublic(endpoints.product, signal, 'json'), readPublic(endpoints.currency, signal, 'json'),
        ]);
        return extractShopify(JSON.parse(product.text), JSON.parse(currency.text), url.href);
      } catch {
        // The ordinary product page remains usable if a merchant disables Ajax.
        if (controller.signal.aborted) throw new DOMException('Timed out', 'AbortError');
      }
    }
    const page = await readPublic(url, controller.signal, 'html');
    if (/\/products\//.test(url.pathname) && !/\/products\//.test(page.url.pathname)) throw Error('Магазин убрал карточку товара. Укажите другую ссылку.');
    if (/captcha|verify you are human|pardon our interruption|robot check/i.test(page.text.slice(0, 60000)))
      throw Error('Магазин запросил проверку посетителя. Используйте ручной ввод.');
    return extractProduct(page.text, page.url.href);
  } finally {clearTimeout(timer);}
}

export async function fetchCollectionLinks(value:string){
  const start=allowedUrl(value),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const page=await readPublic(start,controller.signal,'html');
    if(/verify you are human|robot check|pardon our interruption/i.test(page.text.slice(0,60000)))throw Error('Магазин ограничил доступ к подборке. Вставьте ссылки на товары.');
    const links=new Set<string>();
    for(const match of page.text.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)){
      try{const candidate=allowedUrl(new URL(match[1].replace(/&amp;/g,'&'),page.url).href);
        if(candidate.origin!==page.url.origin||!/(?:\/products\/[^/]+|\/p\/[^/]+|\/t\/[^/]+|\/itm\/\d+|\/dp\/[A-Z0-9]+|\.html)$/i.test(candidate.pathname))continue;
        candidate.hash='';for(const key of [...candidate.searchParams.keys()])if(/^(utm_.+|_pos|_sid|_ss)$/i.test(key))candidate.searchParams.delete(key);
        links.add(candidate.href);if(links.size===10)break;
      }catch{}
    }
    if(!links.size)throw Error('Ссылки на товары не найдены. Вставьте прямые ссылки на карточки.');
    return [...links];
  }finally{clearTimeout(timer)}
}
