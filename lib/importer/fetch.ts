import {normalizeMerchantVariants} from './variant-normalization.ts';
import {declarationFor,dedupeSafeImages,extractAdidasProduct,extractProduct,inferProductCategory,safeImage,type Extracted} from './extract.ts';
import {extractTarget, targetRequest} from './target.ts';
import {extractShopify, shopifyEndpoints} from './shopify.ts';
import {extractVictoriasSecret, victoriasSecretRequest} from './victoriassecret.ts';
import {isEbayStoreHost,isManualEntryStoreHost,isSupportedStoreHost,supportedStoreCount} from './stores.ts';
import {applyMerchantProfile} from './merchant-profiles.ts';
import {isMerchantProductUrl, sameMerchantRedirect} from './source-identity.ts';
import {isMerchantChallengePage} from './challenge.ts';
import {EbayBrowseApiError, EbayListingUnavailableError, EbayManualReviewError, fetchEbayProduct, type EbayBrowseConfig} from './ebay.ts';
import {BrightDataApiError, BrightDataPendingError, brightDataStoreNames, brightDataTarget, fetchBrightDataProduct, type BrightDataRuntime} from './brightdata.ts';
export {supportedStoreCount};

/** HTTP status, bot-wall vendor and egress engine attempts behind a fallback. */
export type ImportDiagnostic = {status?: number; vendor?: string; engine?: string; attempts?: string};

/** The egress proxy reports the engine that answered and every attempt it made. */
function responseDiagnostic(response: Response, extra: ImportDiagnostic = {}): ImportDiagnostic {
  const engine = response.headers.get('x-atlas-engine') ?? undefined, attempts = response.headers.get('x-atlas-attempts') ?? undefined;
  return {status: response.status, ...(engine ? {engine} : {}), ...(attempts ? {attempts} : {}), ...extra};
}

/** Operator-facing summary, e.g. "HTTP 403 · защита akamai · fetch:403 impersonate:200". */
export function describeImportDiagnostic(diagnostic?: ImportDiagnostic) {
  if (!diagnostic) return '';
  return [diagnostic.status ? `HTTP ${diagnostic.status}` : '', diagnostic.vendor ? `защита ${diagnostic.vendor}` : '', diagnostic.attempts ?? diagnostic.engine ?? ''].filter(Boolean).join(' · ');
}

/** Logs carry the store, never the customer's product URL. */
function hostOf(value: string) {
  try { return new URL(value).hostname; } catch { return 'unknown'; }
}

function withDiagnostic<T extends ManualEntryFallbackError>(error: T, diagnostic: ImportDiagnostic): T {
  error.diagnostic = {...error.diagnostic, ...diagnostic};
  return error;
}

/** Recoverable import failure: the customer may review and explicitly confirm
 * manually entered details when a merchant does not expose a public response. */
export class ManualEntryFallbackError extends Error {
  readonly partial?: Extracted;
  /** 'pending': a Bright Data collection is still running; ask again after retryAfterMs (app/api/import answers 202).
   * 'manual': a store Atlas does not read at all (manualEntryStoreRoots); the customer fills in the details. */
  readonly reason: 'blocked' | 'network' | 'upstream' | 'response' | 'redirect' | 'timeout' | 'incomplete' | 'pending' | 'manual' | 'unknown';
  /** What the merchant answered, for logs and the operator; never shown to customers. */
  diagnostic?: ImportDiagnostic;
  retryAfterMs?: number;
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

/** A link outside the store allowlist; `code` is localized by serverError with {count} = supportedStoreCount. */
export class UnsupportedStoreError extends Error {
  readonly code = 'err_72';
  readonly supportedStoreCount: number;
  constructor(count = supportedStoreCount) {
    super('Этого магазина нет в списке поддерживаемых. Вставьте ссылку из одного из ' + count + ' магазинов или заполните товар вручную.');
    this.name = 'UnsupportedStoreError';
    this.supportedStoreCount = count;
  }
}

export function allowedUrl(value: string) {
  const u = validateManualSourceUrl(value);
  if (!isSupportedStoreHost(u.hostname)) throw new UnsupportedStoreError();
  return u;
}

function finalizeExtraction(extracted:Extracted,sourceUrl:string){
  const images=dedupeSafeImages([extracted.image,...(extracted.images??[])],sourceUrl);
  const result=normalizeMerchantVariants({...extracted,image:images[0]??extracted.image,images});
  const hasProductPrice=typeof result.price==='number'&&Number.isFinite(result.price)&&result.price>0;
  const hasVariantPrice=(result.variants??[]).some(variant=>typeof variant.price==='number'&&Number.isFinite(variant.price)&&variant.price>0);
  if(!result.title||(!hasProductPrice&&!hasVariantPrice)||!result.currency){
    const missing=[!result.title?'название':'',!hasProductPrice&&!hasVariantPrice?'цену':'',!result.currency?'валюту':''].filter(Boolean).join(', ');
    throw new ManualEntryFallbackError(/^ebay\./i.test(new URL(sourceUrl).hostname)
      ? 'eBay не предоставил полные публичные данные объявления. Проверьте карточку и подтвердите цену и вариант вручную.'
      : `Магазин отдал страницу без структурированных данных товара (не найдено: ${missing}). Заполните и подтвердите недостающие поля вручную.`,result,'incomplete');
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
  minimalApi?: boolean;
  referer?: string;
  userAgent?: string;
  /** Some public merchant APIs reject browser client-hint headers as bot signals. */
  clientHints?: boolean;
  /** Fixed same-merchant origins that may be used during a safe redirect. */
  allowedOrigins?: string[];
};
export type MerchantFetch = ((input: string | URL, init?: RequestInit) => Promise<Response>) & {
  ebayBrowseConfig?: () => EbayBrowseConfig;
  /** Bright Data for Walmart (lib/importer/brightdata.ts); undefined when the key or D1 is missing. */
  brightData?: () => Promise<BrightDataRuntime | undefined>;
};

/** Walmart through Bright Data when it is on for the link; undefined lets the importer continue with its own path. */
async function brightDataProduct(url: URL, fetcher: MerchantFetch) {
  const target = brightDataTarget(url);
  if (!target || !fetcher.brightData) return;
  let runtime: BrightDataRuntime | undefined;
  try { runtime = await fetcher.brightData(); } catch (error) { console.warn('[brightdata] stage=configuration ' + (error as Error).message.slice(0, 120)); return; }
  if (!runtime) return;
  try {
    const product = await fetchBrightDataProduct(url, runtime);
    return product ? finalizeExtraction(product, url.href) : undefined;
  } catch (error) {
    if (error instanceof BrightDataPendingError) {
      const pending = new ManualEntryFallbackError(`${brightDataStoreNames[error.store]} отдаёт данные через сервис сбора — это занимает до полуминуты. Atlas повторит запрос сам.`, {sourceUrl: url.href, brand: brightDataStoreNames[error.store], warnings: []}, 'pending');
      pending.retryAfterMs = error.retryAfterMs;
      pending.diagnostic = {engine: 'brightdata'};
      throw pending;
    }
    if (error instanceof ManualEntryFallbackError) throw withDiagnostic(error, {engine: 'brightdata'});
    // Logs carry the store and the stage, never the product URL or the key.
    console.warn('[brightdata] ' + JSON.stringify({store: target.store, stage: error instanceof BrightDataApiError ? error.stage : 'unknown', status: error instanceof BrightDataApiError ? error.status : undefined, error: (error as Error).name}));
  }
}

function requestHeaders(format: 'html' | 'json', cookie?: string, userAgent = browserUserAgent, referer?: string, options: Pick<PublicRequestOptions, 'clientHints'|'minimalApi'> = {}) {
  return {
    Accept: format === 'json' ? 'application/json, text/plain, */*' : 'text/html,application/xhtml+xml',
    'User-Agent': userAgent,
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    ...(referer ? {
      Referer: referer,
      Origin: new URL(referer).origin,
      ...(!options.minimalApi?{'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': format === 'json' ? 'cors' : 'navigate',
      'Sec-Fetch-Dest': format === 'json' ? 'empty' : 'document'}:{}),
      ...(format === 'json' && options.clientHints !== false && !options.minimalApi ? {
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
    console.error('Public merchant response rejected', {host: hostOf(response.url), status: response.status, contentType, format});
    await response.body?.cancel();
    const reason = !response.ok
      ? response.status === 401 || response.status === 403 || response.status === 429 ? 'blocked' : response.status >= 500 ? 'upstream' : 'response'
      : 'response';
    throw withDiagnostic(new ManualEntryFallbackError(undefined, undefined, reason), responseDiagnostic(response));
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

// Akamai's sensor-only interstitial (same pattern as the proxy's): a few KB, its challenge
// container or one obfuscated same-site script `/a/b/c/d?v=<uuid>`, and no product.
const akamaiInterstitial = /sec-if-cpt|_sec\/cp_challenge|sec-container|<script\b[^>]*\bsrc=["']\/(?:[\w-]+\/){3,}[\w-]+\?v=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}["']/i;

/**
 * Bot-management interstitials answer with HTTP 200 and a tiny page instead of
 * the product. Name the wall so the operator knows the link itself is fine.
 */
export function detectBotChallenge(html: string) {
  const head = html.slice(0, 60000);
  // A page that still carries its Product JSON-LD was served: vendor scripts and form reCAPTCHA on it are not a wall.
  if (/"@type"\s*:\s*"Product"/i.test(html)) return undefined;
  if (/bm-verify|_sec\/verify|akam-logo|ak_bmsc_challenge|<title>\s*Access Denied\s*<\/title>/i.test(head)) return 'Akamai';
  if (html.length < 12_000 && akamaiInterstitial.test(head)) return 'Akamai';
  // Walmart's served product pages carry PerimeterX's config (`_pxAppId`); only its captcha, or those markers on a small page, are a wall.
  if (/px-captcha/i.test(head) || html.length < 60_000 && /_pxhd|_pxAppId|PerimeterX|window\._pxUuid/i.test(head)) return 'PerimeterX';
  if (/cf-chl|cf_chl_opt|<title>\s*Just a moment/i.test(head)) return 'Cloudflare';
  if (/distil_r_captcha|datadome|dd\.captcha|geo\.captcha-delivery\.com/i.test(head)) return 'DataDome';
  const visibleHead = head.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/g?recaptcha/gi, '');
  if (/captcha|verify you are human|pardon our interruption|robot check|are you a human/i.test(visibleHead)) return 'CAPTCHA';
  if (html.length < 20000 && /<title>\s*Too many requests\s*<\/title>/i.test(head)) return 'лимит запросов';
  return undefined;
}

function botChallengeError(kind: string) {
  return new ManualEntryFallbackError(`Магазин закрыл страницу антибот-проверкой (${kind}) и не отдал данные товара. Ссылка верна; заполните и подтвердите цену, валюту и вариант вручную или повторите позже.`, undefined, 'blocked');
}

/** The egress proxy marks a direct retry so the import can warn about regional pricing. */
function directEgress(response: Response) {
  return response.headers.get('x-atlas-egress') === 'direct';
}
const directEgressWarning = 'Данные получены напрямую, без US-прокси (магазин ограничил его запросы): цена и валюта могут соответствовать другому региону — проверьте их.';

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
      throw withDiagnostic(new ManualEntryFallbackError(undefined, undefined, response.status>=500?'upstream':'blocked'), responseDiagnostic(response));
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || i === 3) throw withDiagnostic(new ManualEntryFallbackError('Магазин перенаправил запрос. Заполните данные вручную; адрес перенаправления не открывался.',undefined,'redirect'), responseDiagnostic(response));
      try { url = allowedUrl(new URL(location, url).href); }
      catch { throw new ManualEntryFallbackError('Магазин перенаправил запрос за пределы разрешённых страниц. Заполните данные вручную; новый адрес не открывался.',undefined,'redirect'); }
      // Walmart and others answer a bot with a same-site redirect to their block page.
      if (format === 'html' && /^\/(?:blocked|captcha|challenge)\b/i.test(url.pathname)) throw withDiagnostic(new ManualEntryFallbackError(undefined, undefined, 'blocked'), responseDiagnostic(response, {vendor: 'redirect-wall'}));
      if (format === 'html' && !sameMerchantRedirect(start, url)) throw new ManualEntryFallbackError('Магазин изменил витрину или регион. Проверьте ссылку и заполните данные вручную; другой адрес не открывался.', undefined, 'redirect');
      if (format === 'json' && url.origin !== start.origin && !options.allowedOrigins?.includes(url.origin)) throw new ManualEntryFallbackError('Магазин изменил регион API. Заполните данные вручную; новый адрес не открывался.',undefined,'redirect');
      continue;
    }
    const direct = directEgress(response);
    const text = await readBody(response, format);
    if (format === 'html') {
      const challenge = detectBotChallenge(text);
      if (challenge) throw withDiagnostic(botChallengeError(challenge), responseDiagnostic(response, {vendor: challenge}));
    }
    return {text, url, direct, diagnostic: responseDiagnostic(response)};
  }
  throw Error('Не удалось загрузить товар.');
}

/** Zara's product page answers `?ajax=true` with the view payload (and `clientAppConfig`) the HTML would embed. */
function zaraPayloadUrl(url: URL) {
  if (!/(^|\.)zara\.com$/i.test(url.hostname) || !/-p\d{8}\.html$/i.test(url.pathname)) return undefined;
  const ajax = new URL(url.href);
  ajax.searchParams.set('ajax', 'true');
  return ajax;
}

/** The two objects the Zara page assigns, so the existing Zara parser reads them exactly as on the page. */
function zaraDocument(payload: unknown) {
  const view = payload && typeof payload === 'object' ? payload as Record<string, unknown> : undefined;
  const config = view?.clientAppConfig;
  if (!view?.product || !config || typeof config !== 'object') return undefined;
  const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
  return `<script>window.zara.appConfig = ${json(config)};window.zara.viewPayload = ${json({product: view.product})};</script>`;
}

function withEgressWarning<T extends Extracted>(extracted: T, direct: boolean | undefined): T {
  return direct ? {...extracted, warnings: [...(extracted.warnings ?? []), directEgressWarning]} : extracted;
}

export const manualEntryStoreMessage = 'Этот магазин не отдаёт данные товара автоматически. Откройте товар на сайте магазина и впишите название, цену, вариант и доставку сами — оператор Atlas сверит их перед выкупом.';

async function fetchProductOnce(value: string, fetcher: MerchantFetch = fetch) {
  const manualUrl = validateManualSourceUrl(value);
  if (!isSupportedStoreHost(manualUrl.hostname)) {
    const partial: Extracted = {sourceUrl: manualUrl.href, brand: manualUrl.hostname.replace(/^www\./, ''), warnings: []};
    throw new ManualEntryFallbackError('Автоматическая загрузка этого магазина недоступна. Заполните данные товара вручную; сервер не обращается к этому магазину.', partial);
  }
  const url = allowedUrl(manualUrl.href);
  // A store that blocks every route is not asked at all: no request, no wait, straight to the customer's own entry.
  if (isManualEntryStoreHost(url.hostname)) throw new ManualEntryFallbackError(manualEntryStoreMessage, {sourceUrl: url.href, brand: url.hostname.replace(/^(?:www2?|shop)\./, ''), warnings: []}, 'manual');
  // Bright Data waits on its own budget (settings.waitSeconds) before the page path starts its 15 s timer.
  const collected = await brightDataProduct(url, fetcher);
  if (collected) return collected;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  // Why the official eBay path did not answer; carried into the manual-review draft so the operator sees it.
  let ebayApiNote: string | undefined;
  try {
    if (isEbayStoreHost(url.hostname)) {
      const config = fetcher.ebayBrowseConfig?.();
      if (!config?.clientId?.trim() || !config.clientSecret || !config.environment) {
        console.warn('[eBay import] stage=configuration status=missing');
        ebayApiNote = 'eBay Browse API не настроен на сервере (EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_ENV).';
      } else if (!/^\/itm\//i.test(url.pathname) || !/^\d{8,15}$/.test(url.pathname.split('/').filter(Boolean).at(-1) ?? '')) {
        ebayApiNote = 'Для eBay нужна ссылка на объявление вида ebay.com/itm/<номер>; страницы поиска, магазинов и категорий не импортируются.';
      } else {
        try {
          const ebayProduct = await fetchEbayProduct(url.href, config, fetcher, controller.signal);
          if (ebayProduct) return finalizeExtraction(ebayProduct, url.href);
          ebayApiNote = 'Площадка eBay этого домена не поддерживается Browse API Atlas.';
        } catch (error) {
          if (error instanceof EbayBrowseApiError || error instanceof EbayListingUnavailableError || error instanceof EbayManualReviewError) {
            console.warn(`[eBay import] stage=${error.stage} status=${error.status ?? 'network'}${error instanceof EbayBrowseApiError && error.errorId ? ` errorId=${error.errorId}` : ''}`);
          }
          if (error instanceof EbayBrowseApiError) ebayApiNote = error.describe();
          else if (error instanceof Error && error.name === 'AbortError') ebayApiNote = 'eBay Browse API не ответил вовремя.';
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
    const victoriasSecret = victoriasSecretRequest(url);
    if (victoriasSecret) {
      // The storefront page is an empty shell; its own public product document carries colour, sizes, prices and stock.
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]);
        const payload = await readPublic(victoriasSecret.api, signal, 'json', {referer: url.href}, fetcher);
        const extracted = extractVictoriasSecret(JSON.parse(payload.text), url.href, victoriasSecret);
        if (extracted) return finalizeExtraction(withEgressWarning(extracted, payload.direct), url.href);
      } catch (error) {
        if (controller.signal.aborted) throw new DOMException('Timed out', 'AbortError');
        if (error instanceof ManualEntryFallbackError && error.reason === 'blocked') throw error;
        // Otherwise the page shell still yields the title for a manual-review draft.
      }
    }
    const target = targetRequest(url);
    if (target) {
      // The page draws price and options in the browser from Target's own public product service.
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]);
        const payload = await readPublic(target.api, signal, 'json', {referer: url.href,minimalApi:true}, fetcher);
        const extracted = extractTarget(JSON.parse(payload.text), url.href, target.tcin, {safeImage, inferCategory: inferProductCategory, declarationFor});
        if (extracted) return finalizeExtraction(withEgressWarning(extracted, payload.direct), url.href);
      } catch (error) {
        if (controller.signal.aborted) throw new DOMException('Timed out', 'AbortError');
        if (error instanceof ManualEntryFallbackError && error.reason === 'blocked') throw error;
        if (error instanceof Error && /не найдена/.test(error.message)) throw error;
      }
    }
    const zara = zaraPayloadUrl(url);
    if (zara) {
      // The HTML sits behind Akamai; the same page answers `?ajax=true` with the view payload it would embed.
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]);
        const payload = await readPublic(zara, signal, 'json', {referer: url.href}, fetcher);
        const document = zaraDocument(JSON.parse(payload.text));
        if (document) return finalizeExtraction(withEgressWarning(applyMerchantProfile(extractProduct(document, url.href), url.href), payload.direct), url.href);
      } catch (error) {
        if (controller.signal.aborted) throw new DOMException('Timed out', 'AbortError');
        // A removed product is definitive; anything else falls through to the page itself.
        if (error instanceof Error && /не найдена/.test(error.message)) throw error;
      }
    }
    const endpoints = shopifyEndpoints(url);
    if (endpoints) {
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(6500)]);
        const [product, currency] = await Promise.all([
          readPublic(endpoints.product, signal, 'json', {}, fetcher), readPublic(endpoints.currency, signal, 'json', {}, fetcher),
        ]);
        const extracted = withEgressWarning(extractShopify(JSON.parse(product.text), JSON.parse(currency.text), url.href), product.direct || currency.direct);
        return finalizeExtraction(extracted,url.href);
      } catch {
        // The ordinary product page remains usable if a merchant disables Ajax.
        if (controller.signal.aborted) throw new DOMException('Timed out', 'AbortError');
      }
    }
    const page: {text: string; url: URL; direct?: boolean; diagnostic?: ImportDiagnostic} = isAmazonUsUrl(url) ? await readAmazonUs(url, controller.signal, fetcher) : await readPublic(url, controller.signal, 'html', {}, fetcher);
    if (/\/products\//.test(url.pathname) && !/\/products\//.test(page.url.pathname)) throw Error('Магазин убрал карточку товара. Укажите другую ссылку.');
    const challenge = detectBotChallenge(page.text);
    if (challenge) throw withDiagnostic(botChallengeError(challenge), {...page.diagnostic, vendor: challenge});
    if (isMerchantChallengePage(page.text))
      throw withDiagnostic(new ManualEntryFallbackError('Магазин ограничил автоматическую загрузку. Заполните и подтвердите данные товара вручную.',undefined,'blocked'), {...page.diagnostic, vendor: 'interstitial'});
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
    return finalizeExtraction(withEgressWarning(extracted, page.direct),page.url.href);
  } catch(error) {
    // eBay blocks or reshapes public listing responses often. Keep those links
    // in the manual-confirmation flow instead of stranding the customer on a
    // hard import error. A confirmed 404/410 is still definitive and must not
    // be converted into an orderable fallback.
    if (isEbayStoreHost(url.hostname)) {
      if (error instanceof EbayListingUnavailableError) throw error;
      if (error instanceof Error && /карточка товара не найдена/i.test(error.message)) throw error;
      if (error instanceof ManualEntryFallbackError && error.partial && !ebayApiNote) throw error;
      const pageMessage = error instanceof ManualEntryFallbackError
        ? error.message
        : 'eBay не предоставил данные объявления. Заполните и подтвердите цену, валюту и вариант вручную.';
      // The public page is a bot wall for servers; the API note is what the operator can act on.
      const message = ebayApiNote
        ? `${ebayApiNote} Публичная страница eBay тоже не отдала данные (${error instanceof ManualEntryFallbackError ? error.reason : 'ошибка'}). Проверьте объявление и заполните цену, валюту и вариант вручную.`
        : pageMessage;
      throw new ManualEntryFallbackError(message, {
        ...(error instanceof ManualEntryFallbackError ? error.partial : undefined),
        sourceUrl: url.href,
        brand: 'eBay',
        warnings: [],
      }, error instanceof ManualEntryFallbackError ? error.reason : error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'unknown');
    }
    throw error;
  } finally {clearTimeout(timer);}
}

/** One automatic retry for transient transport failures, within a shared budget.
 * A challenge, unsafe redirect, incomplete quote or definite missing listing is
 * not retried. Every attempt retains the ordinary allowlist/body/timeout gates. */
export async function fetchProduct(value: string, fetcher: MerchantFetch = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 24_000);
  const boundedFetch: MerchantFetch = Object.assign(async (input: string | URL, init?: RequestInit) => fetcher(input, {
    ...init,
    signal: init?.signal ? AbortSignal.any([controller.signal, init.signal]) : controller.signal,
  }), {ebayBrowseConfig: fetcher.ebayBrowseConfig, brightData: fetcher.brightData});
  try {
    for (let attempt = 0; ; attempt++) {
      try { return await fetchProductOnce(value, boundedFetch); }
      catch (error) {
        const transient = error instanceof ManualEntryFallbackError && ['network', 'upstream', 'timeout'].includes(error.reason)
          || error instanceof Error && error.name === 'AbortError';
        if (attempt === 1 || !transient || controller.signal.aborted) {
          // One line per failed import: which store, why, and what the egress engines saw.
          if (error instanceof ManualEntryFallbackError) console.warn('[import-fallback] ' + JSON.stringify({host: hostOf(value), reason: error.reason, ...error.diagnostic}));
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  } finally { clearTimeout(timer); }
}

export async function fetchCollectionLinks(value:string, fetcher:MerchantFetch = fetch){
  const start=allowedUrl(value),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const page=isAmazonUsUrl(start) ? await readAmazonUs(start,controller.signal,fetcher) : await readPublic(start,controller.signal,'html',{},fetcher);
    if(isMerchantChallengePage(page.text))throw new ManualEntryFallbackError('Магазин ограничил доступ к подборке. Вставьте ссылки на товары.',undefined,'blocked');
    const links=new Set<string>();
    for(const match of page.text.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)){
      try{const candidate=allowedUrl(new URL(match[1].replace(/&amp;/g,'&'),page.url).href);
        if (/[{}<>]|\$\{|\[\[/.test(decodeURIComponent(candidate.href))) continue;
        if(candidate.origin!==page.url.origin||!isMerchantProductUrl(candidate))continue;
        candidate.hash='';for(const key of [...candidate.searchParams.keys()])if(/^(utm_.+|_pos|_sid|_ss)$/i.test(key))candidate.searchParams.delete(key);
        links.add(candidate.href);if(links.size===10)break;
      }catch{}
    }
    if(!links.size)throw Error('Ссылки на товары не найдены. Вставьте прямые ссылки на карточки.');
    return [...links];
  }finally{clearTimeout(timer)}
}
