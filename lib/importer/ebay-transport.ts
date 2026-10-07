import type {EbayBrowseConfig, EbayFetch} from './ebay.ts';

const ebayApiHosts = new Set(['api.ebay.com', 'api.sandbox.ebay.com']);

/** Only fixed official OAuth/Browse requests may bypass merchant egress. */
export function isFixedEbayApiRequest(input: string | URL, init?: RequestInit) {
  let target: URL;
  try { target = new URL(input instanceof URL ? input.href : String(input)); } catch { return false; }
  if (!ebayApiHosts.has(target.hostname.toLowerCase())) return false;
  const method = String(init?.method ?? 'GET').toUpperCase();
  if (target.protocol !== 'https:' || target.username || target.password || target.port || target.hash) {
    throw new Error('Unsafe eBay API target.');
  }
  if (target.pathname === '/identity/v1/oauth2/token' && method === 'POST') return true;
  if (target.pathname === '/buy/browse/v1/item/get_item_by_legacy_id' && method === 'GET') return true;
  if (target.pathname === '/buy/browse/v1/item/get_items_by_item_group' && method === 'GET') return true;
  throw new Error('Unsupported eBay API request.');
}

/** OAuth credentials and API tokens go directly to eBay, never the page proxy. */
export function createEbayAwareMerchantFetch(merchantFetch: EbayFetch, config: () => EbayBrowseConfig, apiFetch: EbayFetch = fetch) {
  return Object.assign(
    async (input: string | URL, init?: RequestInit) => isFixedEbayApiRequest(input, init)
      ? apiFetch(input, init)
      : merchantFetch(input, init),
    {ebayBrowseConfig: config},
  );
}
