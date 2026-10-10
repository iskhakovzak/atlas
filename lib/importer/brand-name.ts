import {brandForHost} from '../market/store-brands.ts';

/**
 * A Shopify vendor or JSON-LD brand that is the store's internal handle ("beta-anker-us", "anker-us.myshopify.com")
 * rather than a name a customer would recognise. Real brands with a hyphen ("nude-project") are kept: only a
 * lowercase slug that carries a staging/region marker, a myshopify host or the page's own Shopify.shop handle counts.
 */
export function internalStoreHandle(value: string, shopHandle?: string) {
  const text = value.trim().toLowerCase();
  if (!text) return false;
  if (/myshopify/.test(text)) return true;
  const handle = shopHandle?.trim().toLowerCase().replace(/\.myshopify\.com$/, '');
  if (handle && (text === handle || text === handle + '.myshopify.com')) return true;
  return value.trim() === text && /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(text)
    && /(?:^|-)(?:beta|staging|stage|dev|test|prod|live)(?:-|$)|-(?:us|usa|uk|eu|ca|au|de|es|fr|it|intl|global|store|shop)$/.test(text);
}

/** A saved brand as the customer sees it: empty for an internal handle stored before the importer cleaned it up. */
export function shownBrand(value: string | undefined) {
  return value?.trim() && !internalStoreHandle(value) ? value.trim() : '';
}

/** The Shopify.shop handle a storefront page declares, without the myshopify domain. */
export function shopifyShopHandle(html: string) {
  return html.match(/Shopify\.shop\s*=\s*["']([a-z0-9-]+)(?:\.myshopify\.com)?["']/i)?.[1]
    ?? html.match(/["']myshopifyDomain["']\s*:\s*["']([a-z0-9-]+)\.myshopify\.com["']/i)?.[1];
}

/**
 * The brand shown for an imported product: the store's own value unless it is an internal handle, then the page's
 * og:site_name, then the Atlas store name for the host, then the host itself.
 */
export function readableBrand(value: string | undefined, sourceUrl: string, {siteName, shopHandle, fallback}: {siteName?: string; shopHandle?: string; fallback?: string} = {}) {
  const host = new URL(sourceUrl).hostname.toLowerCase();
  if (value?.trim() && !internalStoreHandle(value, shopHandle)) return value.trim();
  if (siteName?.trim() && !internalStoreHandle(siteName, shopHandle)) return siteName.trim().slice(0, 80);
  return fallback ?? brandForHost(host)?.name ?? host.replace(/^www\./, '');
}
