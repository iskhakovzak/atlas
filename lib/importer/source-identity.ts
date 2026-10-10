import {isEbayStoreHost} from './stores.ts';

/** Fixed merchant URL forms; tracking values and category names are never IDs. */
export function sourceProductIds(value: string): Set<string> {
  const url = new URL(value), host = url.hostname.replace(/^www2?\./, '').toLowerCase();
  const path = url.pathname;
  const patterns: Record<string, RegExp> = {
    'amazon.com': /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i,
    'walmart.com': /\/ip\/(?:[^/]+\/)?(\d+)(?:\/|$)/i,
    'target.com': /\/A-(\d+)(?:\/|$)/i,
    'hm.com': /productpage\.(\d+)\.html$/i,
    'uniqlo.com': /\/products\/(E\d+)(?:-|\/|$)/i,
    'thenorthface.com': /-(NF[A-Z0-9]+)\/?$/i,
    'vans.com': /-(VN[A-Z0-9]+)\/?$/i,
    'carters.com': /\/(V_[A-Z0-9]+)\/?$/i,
    'bershka.com': /c\d+p(\d+)\.html$/i,
    'pullandbear.com': /-l(\d+)\.html$/i,
    'sephora.com': /-(P\d+)\/?$/i,
    'sephora.es': /-(P\d+)\.html$/i,
    'zalando.de': /-([A-Z0-9]+-[A-Z0-9]+)\.html$/i,
    'zalando.es': /-([A-Z0-9]+-[A-Z0-9]+)\.html$/i,
    'zalando.fr': /-([A-Z0-9]+-[A-Z0-9]+)\.html$/i,
    'zalando.it': /-([A-Z0-9]+-[A-Z0-9]+)\.html$/i,
  };
  const ids = new Set<string>();
  const add = (id?: string | null) => { if (id && id.length >= 3) ids.add(id.toLowerCase()); };
  add(path.match(patterns[host] ?? /$^/)?.[1]);
  if (host === 'shop.mango.com' || host === 'mango.com') {
    add(path.match(/_(\d+)\/?$/)?.[1] ?? path.match(/\/(\d{8})(?:\/|$)/)?.[1]);
  }
  if (host === 'bestbuy.com') add(url.searchParams.get('skuId'));
  if (host === 'gap.com' && /\/browse\/product\.do$/i.test(path)) add(url.searchParams.get('pid'));
  // Legacy storefronts and explicit synthetic contracts have a terminal ID.
  // Split composite terminal article names, but never every path/query word.
  const terminal = path.split('/').filter(Boolean).at(-1)?.replace(/\.(?:html|p)$/i, '');
  if (terminal && (/\d/.test(terminal) || /^[A-Z0-9_-]+$/.test(terminal))) add(terminal);
  return ids;
}

/** Never silently import a different merchant or regional storefront. */
export function sameMerchantRedirect(source: URL, target: URL) {
  const root = (url: URL) => {
    const host = url.hostname.toLowerCase().replace(/^www2?\./, '');
    if (host === 'northface.com') return 'thenorthface.com';
    if (host === 'satechi.net') return 'satechi.com';
    if (host === 'us.puma.com') return 'puma.com';
    if (host === 'usa.tommy.com') return 'tommy.com';
    if (host === 'en.zalando.de') return 'zalando.de';
    // US storefront subdomains (lib/importer/stores.ts localizedHosts) belong to the brand's root.
    const subdomain = host.match(/^(?:en|us|usa|store|shop|electronics|www\.usa)\.((?:aboutyou\.de|burberry\.com|google\.com|lululemon\.com|louisvuitton\.com|nothing\.tech|pandora\.net|philips\.com|sony\.com))$/)?.[1];
    if (subdomain) return subdomain;
    if (['shop.mango.com', 'shop.hm.com', 'shop.uniqlo.com', 'shop.nike.com', 'shop.adidas.com'].includes(host)) return host.slice(5);
    return host;
  };
  if (source.hostname === 'ebay.us' && isEbayStoreHost(target.hostname)) return true;
  if (root(source) !== root(target)) return false;
  const locale = (url: URL) => url.pathname.match(/^\/(?:[a-z]{2}[-_])?(us|es|de|gb|uk|fr|it|ro|cn|tr|jp|kr|ae|ca|au)(?:[-_/]|$)/i)?.[1].toLowerCase().replace(/^uk$/, 'gb')
    ?? (/^(?:us\.puma\.com|usa\.tommy\.com|us\.burberry\.com|us\.louisvuitton\.com|us\.nothing\.tech|us\.pandora\.net|www\.usa\.philips\.com)$/.test(url.hostname.toLowerCase()) ? 'us' : undefined);
  return !locale(source) || !locale(target) || locale(source) === locale(target);
}

/** Product discovery for operator collections; do not enqueue category pages. */
export function isMerchantProductUrl(url: URL) {
  const host = url.hostname.replace(/^www2?\./, '').replace(/^shop\./, ''), path = url.pathname;
  if (isEbayStoreHost(host)) return /\/itm\/(?:[^/]+\/)?\d{5,}\/?$/i.test(path);
  if (/^amazon\./.test(host)) return /\/(?:dp|gp\/product)\/[A-Z0-9]{10}(?:\/|$)/i.test(path);
  if (host === 'walmart.com') return /\/ip\/(?:[^/]+\/)?\d{5,}\/?$/.test(path);
  if (host === 'target.com') return /\/p\/.*\/A-\d+\/?$/.test(path);
  if (host === 'bestbuy.com') return /\.p$/i.test(path) && /^\d{5,}$/.test(url.searchParams.get('skuId') ?? path.match(/\/(\d+)\.p$/)?.[1] ?? '');
  if (host === 'gap.com') return /\/browse\/product\.do$/i.test(path) && /^\d{5,}$/.test(url.searchParams.get('pid') ?? '');
  if (host === 'zara.com') return /-p\d+\.html$/i.test(path);
  if (host === 'hm.com') return /productpage\.\d+\.html$/i.test(path);
  if (host === 'uniqlo.com') return /\/products\/E\d+-\d+\//i.test(path);
  if (host === 'mango.com') return /\/p\//.test(path) && /(?:_\d{8}|\/\d{8}(?:\/\d+)*)\/?$/.test(path);
  if (host === 'bershka.com') return /c\d+p\d+\.html$/i.test(path);
  if (host === 'pullandbear.com') return /-l\d+\.html$/i.test(path);
  if (host === 'carters.com') return /\/p\/.*\/V_[A-Z0-9]+\/?$/i.test(path);
  if (host === 'ralphlauren.com') return /\/[A-Z0-9_-]*\d[A-Z0-9_-]*\.html$/i.test(path);
  if (host === 'usa.tommy.com') return /\/[A-Z0-9_-]*\d[A-Z0-9_-]*\.html$/i.test(path);
  if (host === 'thenorthface.com') return /\/p\/.*-NF[A-Z0-9]+\/?$/i.test(path);
  if (host === 'us.puma.com') return /\/pd\/.*\/\d{5,}\/?$/.test(path);
  if (host === 'nike.com') return /\/t\/[^/]+\/[A-Z0-9-]*\d[A-Z0-9-]*\/?$/i.test(path);
  if (host === 'adidas.com') return /\/[A-Z0-9_-]*\d[A-Z0-9_-]*\.html$/i.test(path);
  if (host === 'converse.com') return /\/shop\/p\/[^/]+\/[A-Z0-9_-]+\.html$/i.test(path);
  if (host === 'newbalance.com') return /\/pd\/[^/]+\/[A-Z0-9_-]+\.html$/i.test(path);
  if (host === 'skechers.com') return /\/[A-Z0-9_-]*\d[A-Z0-9_-]{4,}\.html$/i.test(path);
  if (host === 'crocs.com') return /\/p\/[^/]+\/\d{5,}\.html$/i.test(path);
  if (host === 'columbia.com') return /-[0-9]{5,}(?:_[A-Z0-9]+)?\.html$/i.test(path);
  if (host === 'underarmour.com') return /\/p\/[^/]+\/\d{5,}\.html$/i.test(path);
  if (host === 'sephora.com') return /\/product\/[^/]+-P\d+\/?$/i.test(path);
  if (host === 'ulta.com') return /\/p\/[^/]+-(?:pimprod|xlsImpprod)\d+\/?$/i.test(path);
  if (host === 'levi.com') return /\/p\/[A-Z0-9]{5,}\/?$/i.test(path);
  if (host === 'victoriassecret.com') return /\/(?:[^/]*-catalog|product)\/\d+\/?$/i.test(path);
  if (host === 'vans.com') return /(?:\/p\/|\/p[a-z0-9_-]*\/|\/.*-VN[A-Z0-9]+\/?$)/i.test(path);
  if (/^zalando\./.test(host)) return /-[A-Z0-9]+-[A-Z0-9]+\.html$/i.test(path);
  // The existing explicit-store boundary still applies to every discovered URL.
  return /(?:\/products\/[^/]+|\/p\/[^/]+|\/t\/[^/]+|\/itm\/\d+|\/dp\/[A-Z0-9]+|\.html)$/i.test(path);
}

/** The North Face changes category/slug while retaining the same exact article. */
export function sameNorthFaceArticle(candidateValue: unknown, sourceValue: string): boolean {
  if (typeof candidateValue !== 'string') return false;
  try {
    const source = new URL(sourceValue), candidate = new URL(candidateValue, source);
    if (candidate.protocol !== 'https:' || candidate.username || candidate.password || candidate.port) return false;
    if (source.hostname.replace(/^www\./, '') !== 'thenorthface.com' || candidate.hostname.replace(/^www\./, '') !== 'thenorthface.com') return false;
    const locale = (url: URL) => url.pathname.match(/^\/(en-[a-z]{2})\/p\//i)?.[1].toLowerCase();
    if (!locale(source) || locale(source) !== locale(candidate)) return false;
    const article = (url: URL) => url.pathname.match(/-(NF[A-Z0-9]+)\/?$/i)?.[1].toLowerCase();
    if (!article(source) || article(source) !== article(candidate)) return false;
    for (const url of [candidate, source]) {
      for (const key of [...url.searchParams.keys()]) if (/^(utm_.+|gclid|fbclid)$/i.test(key)) url.searchParams.delete(key);
      url.searchParams.sort();
    }
    return source.search === candidate.search;
  } catch { return false; }
}
