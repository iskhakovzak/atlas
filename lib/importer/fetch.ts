import {dedupeSafeImages,extractAdidasProduct,extractProduct,type Extracted} from './extract.ts';
import {extractShopify, shopifyEndpoints} from './shopify.ts';
import {isEbayStoreHost,isSupportedStoreHost,supportedStoreCount} from './stores.ts';
import {applyMerchantProfile} from './merchant-profiles.ts';
import {EbayListingUnavailableError, EbayManualReviewError, fetchEbayProduct, type EbayBrowseConfig} from './ebay.ts';
export {supportedStoreCount};

/** Recoverable import failure: the customer may review and explicitly confirm
 * manually entered details when a merchant does not expose a public response. */
export class ManualEntryFallbackError extends Error {
  readonly partial?: Extracted;
  readonly reason: 'blocked' | 'network' | 'upstream' | 'response' | 'redirect' | 'timeout' | 'incomplete' | 'unknown';
  constructor(message = 'Магазин временно не отдал данные товара. Заполните и подтвердите цену, валюту и выбранный вариант вручную; Atlas сверит цену и валюту, если получит ответ.', partial?: Extracted, reason: ManualEntryFallbackError['reason'] = 'unknown') {
    super(message);
    this.name = 'ManualEntryFallbackError';
    this.partial = partial;
    this.reason = reason;
  }
}

/** Validate a user-supplied public merchant URL without making a request. */
export function validateManualSourceUrl(value: string) {
  const u = new URL(value);
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  const labels = host.split('.');
  const validDnsHost = host.length <= 253 && labels.length >= 2 && labels.every(label =>
    label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
  );
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !validDnsHost ||
      /^\d[\d.]*$/.test(host) || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(host))
    throw Error('Нужна публичная HTTPS-ссылка на страницу товара.');
  u.hostname = host;
  u.hash = '';
  return u;
}

export function allowedUrl(value: string) {
  const u = validateManualSourceUrl(value);
  if (!isSupportedStoreHost(u.hostname))
    throw Error('Этот магазин пока не в списке поддерживаемых. Вставьте ссылку из одного из ' + supportedStoreCount + ' магазинов или заполните товар вручную.');
  return u;
}

function finalizeExtraction(extracted:Extracted,sourceUrl:string){
  const images=dedupeSafeImages([extracted.image,...(extracted.images??[])],sourceUrl);
  const result={...extracted,image:images[0]??extracted.image,images};
  const hasProductPrice=typeof result.price==='number'&&Number.isFinite(result.price)&&result.price>0;
  const hasVariantPrice=(result.variants??[]).some(variant=>typeof variant.price==='number'&&Number.isFinite(variant.price)&&variant.price>0);
  if(!result.title||(!hasProductPrice&&!hasVariantPrice)||!result.currency){
    throw new ManualEntryFallbackError(/^ebay\./i.test(new URL(sourceUrl).hostname)
      ? 'eBay не предоставил полные публичные данные объявления. Проверьте карточку и подтвердите цену и вариант вручную.'
      : 'Магазин не отдал полные данные товара. Заполните и подтвердите недостающие поля вручную.',result,'incomplete');
  }
  return result;
}

const AMAZON_US_POSTAL_CODE = '19701';
const AMAZON_US_HOST = 'amazon.com';
const browserUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const adidasUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
// Amazon's anonymous product endpoint serves a bot-check shell to the generic
// Node/Chrome signature. Keep this public browser profile isolated to Amazon;
// it is not an authentication credential or a customer session.
const amazonUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';

export function isAmazonUsUrl(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, '') === AMAZON_US_HOST;
}

function adidasProductApiUrls(start: URL) {
  if (start.hostname.toLowerCase().replace(/^www\./, '') !== 'adidas.com') return;
  const segments = start.pathname.split('/').filter(Boolean);
  const id = segments.at(-1)?.replace(/\.html$/i, '');
  const slug = segments.at(-2);
  const locale = segments[0]?.match(/^[a-z]{2}(?:[-_][a-z]{2})?$/i)?.[0].toLowerCase() ?? 'us';
  if (!id || !slug || !/^[a-z0-9][a-z0-9_-]{2,31}$/i.test(id) || !/^[a-z0-9][a-z0-9_.-]{1,100}$/i.test(slug)) return;
  const product = new URL(`https://www.adidas.com/api/search/product/${encodeURIComponent(id)}`);
  product.searchParams.set('sitePath', locale);
  const listing = new URL('https://www.adidas.com/api/plp/content-engine');
  listing.searchParams.set('sitePath', locale);
  listing.searchParams.set('query', slug);
  // adidas.com and www.adidas.com are served by different edge routes. A
  // server-side request can be rate-limited on the www route while the same
  // public JSON remains available on the apex route; both are fixed,
  // credential-free Adidas origins.
  const fallbackProduct = new URL(product.href.replace('https://www.adidas.com/', 'https://adidas.com/'));
  const fallbackListing = new URL(listing.href.replace('https://www.adidas.com/', 'https://adidas.com/'));
  return {product, listing, fallbackProduct, fallbackListing};
}

type PublicRequestOptions = {
  referer?: string;
  userAgent?: string;
  /** Some public merchant APIs reject browser client-hint headers as bot signals. */
  clientHints?: boolean;
  /** Fixed same-merchant origins that may be used during a safe redirect. */
  allowedOrigins?: string[];
};
export type MerchantFetch = ((input: string | URL, init?: RequestInit) => Promise<Response>) & {
  ebayBrowseConfig?: () => EbayBrowseConfig;
};

function requestHeaders(format: 'html' | 'json', cookie?: string, userAgent = browserUserAgent, referer?: string, options: Pick<PublicRequestOptions, 'clientHints'> = {}) {
  return {
    Accept: format === 'json' ? 'application/json, text/plain, */*' : 'text/html,application/xhtml+xml',
    'User-Agent': userAgent,
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    ...(referer ? {
      Referer: referer,
      Origin: new URL(referer).origin,
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': format === 'json' ? 'cors' : 'navigate',
      'Sec-Fetch-Dest': format === 'json' ? 'empty' : 'document',
      ...(format === 'json' && options.clientHints !== false ? {
        'X-Requested-With': 'XMLHttpRequest',
        'Sec-CH-UA': '"Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
      } : {}),
    } : {}),
    ...(cookie ? {Cookie: cookie} : {}),
  };
}

async function readBody(response: Response, format: 'html' | 'json', maxBytes = format === 'html' ? 3_000_000 : 1_000_000) {
  const contentType = response.headers.get('content-type') ?? '';
  const validType = format === 'html' ? /(?:text\/html|application\/xhtml\+xml)/i.test(contentType) : /json|javascript/i.test(contentType);
  if (!response.ok || !validType) {
    console.error('Public merchant response rejected', {url: response.url, status: response.status, contentType, format});
    await response.body?.cancel();
    const reason = !response.ok
      ? response.status === 401 || response.status === 403 || response.status === 429 ? 'blocked' : response.status >= 500 ? 'upstream' : 'response'
      : 'response';
    throw new ManualEntryFallbackError(undefined, undefined, reason);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ManualEntryFallbackError(undefined, undefined, 'response');
  let size = 0, text = '';
  const decoder = new TextDecoder();
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new ManualEntryFallbackError(undefined, undefined, 'response');
    }
    text += decoder.decode(value, {stream: true});
  }
  return text + decoder.decode();
}

/** Network failures are not evidence that a listing is unavailable. */
async function merchantFetch(input: string | URL, init: RequestInit, fetcher: MerchantFetch = fetch) {
  try {
    return await fetcher(input, init);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ManualEntryFallbackError(undefined, undefined, 'network');
  }
}

function responseCookies(response: Response) {
  const headers = response.headers as Headers & {getSetCookie?: () => string[]};
  const raw = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : (headers.get('set-cookie') ?? '').split(/,(?=\s*[^;,=\s]+=[^;,]*)/);
  return raw.map(line => line.match(/^\s*([^=;,\s]+)=([^;]*)/)?.slice(1) as [string, string] | undefined).filter((pair): pair is [string, string] => Boolean(pair));
}

function cookieHeader(jar: Map<string, string>) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

function mergeCookies(jar: Map<string, string>, response: Response) {
  for (const [name, value] of responseCookies(response)) {
    if (!value || value.toLowerCase() === 'delete') jar.delete(name);
    else jar.set(name, value);
  }
}

function decodeHtmlAttribute(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&#x3D;|&#61;/g, '=').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'");
}

function amazonLocationToken(html: string) {
  const raw = html.match(/data-a-modal\s*=\s*'([^']*get-rendered-address-selections[^']*)'/i)?.[1]
    ?? html.match(/data-a-modal\s*=\s*"([^"]*get-rendered-address-selections[^"]*)"/i)?.[1];
  if (!raw) return undefined;
  try {
    const modal = JSON.parse(decodeHtmlAttribute(raw)) as {ajaxHeaders?: {'anti-csrftoken-a2z'?: string}};
    return modal.ajaxHeaders?.['anti-csrftoken-a2z'];
  } catch {
    return undefined;
  }
}

/**
 * Amazon renders delivery, price and availability from the anonymous session's
 * delivery location. Set a deterministic US context before parsing instead of
 * letting an Uzbekistan IP select an ineligible international destination.
 * The cookie jar is request-scoped and never persisted or accepted from a user.
 */
async function readAmazonUs(start: URL, signal: AbortSignal, fetcher: MerchantFetch = fetch) {
  const jar = new Map<string, string>([['i18n-prefs', 'USD'], ['lc-main', 'en_US']]);
  let url = start;
  for (let i = 0; i < 4; i++) {
    const response = await merchantFetch(url, {redirect: 'manual', signal, headers: requestHeaders('html', cookieHeader(jar), amazonUserAgent)}, fetcher);
    mergeCookies(jar, response);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || i === 3) throw new ManualEntryFallbackError('Amazon перенаправил запрос. Заполните данные вручную; адрес перенаправления не открывался.',undefined,'redirect');
      try { url = allowedUrl(new URL(location, url).href); }
      catch { throw new ManualEntryFallbackError('Amazon изменил адрес страницы. Заполните данные вручную; новый адрес не открывался.',undefined,'redirect'); }
      if (!isAmazonUsUrl(url)) throw new ManualEntryFallbackError('Amazon изменил регион. Заполните данные вручную; другой региональный адрес не открывался.',undefined,'redirect');
      continue;
    }
    if (response.status === 404 || response.status === 410) {
      await response.body?.cancel();
      throw Error('Магазин сообщил, что карточка товара не найдена. Проверьте ссылку.');
    }
    // Amazon product pages carry a large client-side state payload. Keep a
    // separate, still bounded ceiling for this allowlisted host so a valid
    // post-location page is not mistaken for an unusable import.
    const html = await readBody(response, 'html', 6_000_000);
    const token = amazonLocationToken(html);
    if (!token) throw new ManualEntryFallbackError();

    // Amazon's public location endpoint is the same action triggered by the
    // "Deliver to" dialog. It accepts an anonymous session; no account login
    // or customer cookies are involved.
    jar.set('i18n-prefs', 'USD');
    jar.set('lc-main', 'en_US');
    const locationResponse = await merchantFetch('https://www.amazon.com/gp/delivery/ajax/address-change.html', {
      method: 'POST', redirect: 'manual', signal,
      headers: {
        ...requestHeaders('json', cookieHeader(jar), amazonUserAgent),
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: 'https://www.amazon.com',
        Referer: url.href,
        'anti-csrftoken-a2z': token,
      },
      body: new URLSearchParams({locationType: 'LOCATION_INPUT', countryCode: 'US', zipCode: AMAZON_US_POSTAL_CODE, storeContext: 'generic', deviceType: 'web', pageType: 'Gateway', actionSource: 'glow', almBrandId: 'undefined'}),
    }, fetcher);
    mergeCookies(jar, locationResponse);
    const locationText = await readBody(locationResponse, 'json');
    let locationData: {isValidAddress?: number; address?: {countryCode?: string; zipCode?: string}};
    try { locationData = JSON.parse(locationText) as typeof locationData; }
    catch { throw new ManualEntryFallbackError(undefined, undefined, 'response'); }
    if (locationData.isValidAddress !== 1 || locationData.address?.countryCode !== 'US' || locationData.address.zipCode !== AMAZON_US_POSTAL_CODE)
      throw new ManualEntryFallbackError(undefined, undefined, 'response');

    jar.set('i18n-prefs', 'USD');
    jar.set('lc-main', 'en_US');
    const refreshed = await merchantFetch(url, {redirect: 'manual', signal, headers: requestHeaders('html', cookieHeader(jar), amazonUserAgent)}, fetcher);
    mergeCookies(jar, refreshed);
    if (refreshed.status >= 300 && refreshed.status < 400) throw new ManualEntryFallbackError('Amazon изменил адрес карточки после выбора региона. Заполните данные вручную; новый адрес не открывался.',undefined,'redirect');
    const refreshedHtml = await readBody(refreshed, 'html', 6_000_000);
    // Location validation is already done by verifying the locationData response
    // from the address-change endpoint above. The HTML representation of the ZIP
    // may change or be hidden behind JS.
    return {text: refreshedHtml, url};
  }
  throw Error('Не удалось проверить регион Amazon.');
}

async function readPublic(start: URL, signal: AbortSignal, format: 'html' | 'json', options: PublicRequestOptions = {}, fetcher: MerchantFetch = fetch) {
  let url = start;
  for (let i = 0; i < 4; i++) {
    const response = await merchantFetch(url, {redirect: 'manual', signal, headers: requestHeaders(format, undefined, options.userAgent, options.referer, options)}, fetcher);
    if (response.status === 404 || response.status === 410) {
      await response.body?.cancel();
      throw Error('Магазин сообщил, что карточка товара не найдена. Проверьте ссылку.');
    }
    if (response.status === 401 || response.status === 403 || response.status === 429 || response.status >= 500) {
      await response.body?.cancel();
      throw new ManualEntryFallbackError(undefined, undefined, response.status>=500?'upstream':'blocked');
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || i === 3) throw new ManualEntryFallbackError('Магазин перенаправил запрос. Заполните данные вручную; адрес перенаправления не открывался.',undefined,'redirect');
      try { url = allowedUrl(new URL(location, url).href); }
      catch { throw new ManualEntryFallbackError('Магазин перенаправил запрос за пределы разрешённых страниц. Заполните данные вручную; новый адрес не открывался.',undefined,'redirect'); }
      if (format === 'json' && url.origin !== start.origin && !options.allowedOrigins?.includes(url.origin)) throw new ManualEntryFallbackError('Магазин изменил регион API. Заполните данные вручную; новый адрес не открывался.',undefined,'redirect');
      continue;
    }
    return {text: await readBody(response, format), url};
  }
  throw Error('Не удалось загрузить товар.');
}

export async function fetchProduct(value: string, fetcher: MerchantFetch = fetch) {
  const manualUrl = validateManualSourceUrl(value);
  if (!isSupportedStoreHost(manualUrl.hostname)) {
    const partial: Extracted = {sourceUrl: manualUrl.href, brand: manualUrl.hostname.replace(/^www\./, ''), warnings: []};
    throw new ManualEntryFallbackError('Автоматическая загрузка этого магазина недоступна. Заполните данные товара вручную; сервер не обращается к этому магазину.', partial);
  }
  const url = allowedUrl(manualUrl.href), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    if (isEbayStoreHost(url.hostname)) {
      const config = fetcher.ebayBrowseConfig?.();
      if (config?.clientId?.trim() && config.clientSecret) {
        try {
          const ebayProduct = await fetchEbayProduct(url.href, config, fetcher, controller.signal);
          if (ebayProduct) return finalizeExtraction(ebayProduct, url.href);
        } catch (error) {
          if (error instanceof EbayListingUnavailableError || error instanceof ManualEntryFallbackError) throw error;
          if (error instanceof EbayManualReviewError) {
            throw new ManualEntryFallbackError(error.message, {
              sourceUrl: url.href,
              brand: 'eBay',
              warnings: [],
            }, 'incomplete');
          }
          // An unavailable/unauthorized API should not strand existing links:
          // continue through the current exact-page parser and manual fallback.
        }
      }
    }
    const adidas = adidasProductApiUrls(url);
    if (adidas) {
      // Adidas treats Chromium client hints and X-Requested-With as bot signals
      // and answers with a 429 challenge. Keep this public request minimal;
      // it still carries the exact product-page referrer but no session data.
      const adidasRequest = {
        referer: url.href,
        userAgent: adidasUserAgent,
        clientHints: false,
        allowedOrigins: ['https://www.adidas.com', 'https://adidas.com'],
      };
      // The PLP JSON includes the canonical card, price, gallery and size
      // matrix. Fetch it first so a product endpoint rate limit does not make
      // an otherwise complete public listing unusable.
      let listingResponse: {text: string; url: URL} | undefined;
      for (const endpoint of [adidas.listing, adidas.fallbackListing]) {
        try {
          listingResponse = await readPublic(endpoint, controller.signal, 'json', adidasRequest, fetcher);
          break;
        } catch {
          if (controller.signal.aborted) throw new DOMException('Timed out', 'AbortError');
        }
      }
      let productResponse: {text: string; url: URL} | undefined;
      let productError: unknown;
      for (const endpoint of [adidas.product, adidas.fallbackProduct]) {
        try {
          productResponse = await readPublic(endpoint, controller.signal, 'json', adidasRequest, fetcher);
          break;
        } catch (error) {
          productError = error;
          if (controller.signal.aborted) throw error;
        }
      }
      let productData: unknown, listingData: unknown;
      try { listingData = listingResponse ? JSON.parse(listingResponse.text) : undefined; }
      catch { /* The exact product endpoint may still provide usable data. */ }
      try { productData = productResponse ? JSON.parse(productResponse.text) : undefined; }
      catch { /* Fall back to the matching listing record, then manual entry. */ }
      if (!productData && listingData && typeof listingData === 'object') {
        const items = (listingData as {raw?: {itemList?: {items?: unknown[]}}}).raw?.itemList?.items;
        const id = url.pathname.split('/').filter(Boolean).at(-1)?.replace(/\.html$/i, '');
        const item = Array.isArray(items) ? items.find(value => value && typeof value === 'object' && String((value as Record<string, unknown>).productId ?? '') === id) as Record<string, unknown> | undefined : undefined;
        if (item) {
          productData = {id, name: item.displayName ?? item.altText, category: item.category, price: item.price, salePrice: item.salePrice, orderable: item.orderable, image: item.image, secondImage: item.secondImage, images: item.images};
        }
      }
      if (!productData) {
        // API blocks, challenges and malformed JSON are temporary import
        // failures, not proof that the link points to a different product.
        // Preserve the manual form while the cart flow continues to require a
        // fresh, verified price, currency and selected option.
        throw new ManualEntryFallbackError(productError instanceof Error && productError.name === 'AbortError'
          ? 'Adidas не ответил вовремя. Данные можно заполнить вручную; Atlas должен подтвердить цену, валюту и выбранный вариант перед добавлением.'
          : undefined);
      }
      const extracted = extractAdidasProduct(productData, listingData, url.href);
      if (!extracted) { const e = new Error('Adidas не вернул карточку товара. Проверьте ссылку и повторите проверку.'); e.name = 'AbortError'; throw e; }
      return finalizeExtraction(extracted,url.href);
    }
    const endpoints = shopifyEndpoints(url);
    if (endpoints) {
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(6500)]);
        const [product, currency] = await Promise.all([
          readPublic(endpoints.product, signal, 'json', {}, fetcher), readPublic(endpoints.currency, signal, 'json', {}, fetcher),
        ]);
        const extracted = extractShopify(JSON.parse(product.text), JSON.parse(currency.text), url.href);
        return finalizeExtraction(extracted,url.href);
      } catch {
        // The ordinary product page remains usable if a merchant disables Ajax.
        if (controller.signal.aborted) throw new DOMException('Timed out', 'AbortError');
      }
    }
    const page = isAmazonUsUrl(url) ? await readAmazonUs(url, controller.signal, fetcher) : await readPublic(url, controller.signal, 'html', {}, fetcher);
    if (/\/products\//.test(url.pathname) && !/\/products\//.test(page.url.pathname)) throw Error('Магазин убрал карточку товара. Укажите другую ссылку.');
    if (/captcha|verify you are human|pardon our interruption|robot check/i.test(page.text.slice(0, 60000)))
      throw new ManualEntryFallbackError('Магазин ограничил автоматическую загрузку. Заполните и подтвердите данные товара вручную.');
    let extracted:Extracted;
    try {
      extracted = applyMerchantProfile(extractProduct(page.text, page.url.href), page.url.href);
    } catch (error) {
      if (error instanceof ManualEntryFallbackError || error instanceof Error && error.name === 'AbortError') throw error;
      const isEbay=/^ebay\./i.test(page.url.hostname);
      throw new ManualEntryFallbackError(isEbay
        ? 'eBay не предоставил данные объявления в доступном формате. Проверьте и подтвердите цену и вариант вручную.'
        : 'Страница магазина не предоставила данные товара в доступном формате. Проверьте и подтвердите цену и вариант вручную.');
    }
    return finalizeExtraction(extracted,page.url.href);
  } catch(error) {
    // eBay blocks or reshapes public listing responses often. Keep those links
    // in the manual-confirmation flow instead of stranding the customer on a
    // hard import error. A confirmed 404/410 is still definitive and must not
    // be converted into an orderable fallback.
    if (isEbayStoreHost(url.hostname)) {
      if (error instanceof EbayListingUnavailableError) throw error;
      if (error instanceof Error && /карточка товара не найдена/i.test(error.message)) throw error;
      if (error instanceof ManualEntryFallbackError && error.partial) throw error;
      const message = error instanceof ManualEntryFallbackError
        ? error.message
        : 'eBay не предоставил данные объявления. Заполните и подтвердите цену, валюту и вариант вручную.';
      throw new ManualEntryFallbackError(message, {
        sourceUrl: url.href,
        brand: 'eBay',
        warnings: [],
      });
    }
    throw error;
  } finally {clearTimeout(timer);}
}

export async function fetchCollectionLinks(value:string, fetcher:MerchantFetch = fetch){
  const start=allowedUrl(value),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const page=isAmazonUsUrl(start) ? await readAmazonUs(start,controller.signal,fetcher) : await readPublic(start,controller.signal,'html',{},fetcher);
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
