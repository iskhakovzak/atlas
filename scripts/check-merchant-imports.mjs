import {fetchProduct, fetchCollectionLinks, allowedUrl, ManualEntryFallbackError} from '../lib/importer/fetch.ts';
import {merchantProfileForUrl} from '../lib/importer/merchant-profiles.ts';
import {linkImportStorefronts} from '../lib/importer/stores.ts';
import {writeFile} from 'node:fs/promises';
import {createMerchantProxyFetch} from '../lib/importer/proxy-client.mjs';
import {createEbayAwareMerchantFetch} from '../lib/importer/ebay-transport.ts';
import {createLocalEngineFetch} from '../deploy/upcloud/merchant-engines.mjs';

const args = process.argv.slice(2);
const requireProxy = args.includes('--proxy');
if (requireProxy) args.splice(args.indexOf('--proxy'), 1);
// --engines: run the proxy's engine ladder in-process (this machine's egress, not the US VM).
const localEngines = args.includes('--engines');
if (localEngines) args.splice(args.indexOf('--engines'), 1);
const endpoint = process.env.ATLAS_IMPORT_PROXY_URL?.trim() ?? '';
const secret = process.env.ATLAS_IMPORT_PROXY_SECRET ?? '';
if ((endpoint || secret || requireProxy) && (!endpoint || !secret)) throw new Error('US proxy check requires both ATLAS_IMPORT_PROXY_URL and ATLAS_IMPORT_PROXY_SECRET; direct fallback is disabled.');
if (localEngines && endpoint) throw new Error('--engines runs locally; unset ATLAS_IMPORT_PROXY_URL to use it.');
const ebayEnvironment = process.env.EBAY_ENV?.trim().toLowerCase();
const ebayConfig = {
  clientId: process.env.EBAY_CLIENT_ID?.trim(),
  clientSecret: process.env.EBAY_CLIENT_SECRET,
  environment: ebayEnvironment === 'sandbox' || ebayEnvironment === 'production' ? ebayEnvironment : undefined,
};
const fetcher = createEbayAwareMerchantFetch(endpoint ? createMerchantProxyFetch({endpoint, secret}) : localEngines ? await createLocalEngineFetch() : fetch, () => ebayConfig);
// --concurrency N: stores checked at once (default 4, 1 for the old one-by-one run). Each store host still gets one
// request at a time, so a store never sees parallel requests from this check.
const concurrencyIndex = args.indexOf('--concurrency');
const concurrency = concurrencyIndex < 0 ? 4 : Math.max(1, Math.min(8, Number(args.splice(concurrencyIndex, 2)[1]) || 1));
const reportIndex = args.indexOf('--report');
const reportPath = reportIndex < 0 ? undefined : args.splice(reportIndex, 2)[1];
const discover = args.length === 1 && args[0] === '--storefronts';
const inputs = discover ? linkImportStorefronts.map(store => store.url) : args;
if (!inputs.length || inputs.length > 100 || (reportIndex >= 0 && !reportPath)) {
  console.error('Usage: npm run importer:check -- URL [URL ...] | --storefronts [--proxy] [--concurrency 4] [--report outputs/report.json] (1–100 URLs; storefront discovery checks all 33 requested stores)');
  process.exitCode = 2;
} else {
  const urls = inputs.map(value => allowedUrl(value).href);
  const results = new Array(urls.length);
  const busyHosts = new Map();
  const checkOne = async (url, index) => {
    const profile = merchantProfileForUrl(url);
    const name = discover ? linkImportStorefronts[index].name : profile?.name;
    let productUrl = url;
    if (discover) {
      try { productUrl = (await fetchCollectionLinks(url, fetcher))[0]; }
      catch (error) {
        return {store:new URL(url).hostname, name, sourceUrl:url, status:'discovery-unavailable', reason:error instanceof Error?error.message:String(error)};
      }
    }
    try {
      const product = await fetchProduct(productUrl, fetcher);
      const variants = product.variants ?? [];
      const available = variants.filter(variant => variant.available && variant.availabilityKnown !== false);
      return {
        store: new URL(url).hostname,
        name,
        sourceUrl: productUrl,
        priority: profile?.priority ?? null,
        status: product.title && (product.price !== undefined || variants.some(item=>item.price>0)) && product.currency && product.image ? 'details-imported' : 'partial',
        method: product.method,
        title: product.title ?? null,
        price: product.price ?? null,
        currency: product.currency ?? null,
        photos: product.images?.length ?? Number(Boolean(product.image)),
        variants: variants.length,
        confirmedAvailable: available.length,
        unknownAvailability: variants.filter(variant=>variant.availabilityKnown===false).length,
        selectedColor: product.selectedVariantColor ?? null,
      };
    } catch (error) {
      return {store: new URL(url).hostname, name, sourceUrl:productUrl, priority: profile?.priority ?? null, status: error instanceof ManualEntryFallbackError ? 'manual-review' : 'failed', failureReason:error instanceof ManualEntryFallbackError?error.reason:undefined, diagnostic:error instanceof ManualEntryFallbackError?error.diagnostic:undefined, reason: error instanceof Error ? error.message : String(error)};
    }
  };
  let next = 0;
  await Promise.all(Array.from({length: Math.min(concurrency, urls.length)}, async () => {
    while (next < urls.length) {
      const index = next++;
      const host = new URL(urls[index]).hostname;
      // Same store: wait for its previous check (results keep the input order either way).
      const previous = busyHosts.get(host) ?? Promise.resolve();
      const run = previous.then(() => checkOne(urls[index], index));
      busyHosts.set(host, run.catch(() => {}));
      results[index] = await run;
    }
  }));
  const report=JSON.stringify({checkedAt: new Date().toISOString(), transport:endpoint ? 'configured signed merchant proxy; egress location must match its deployment' : localEngines ? 'local engine ladder (fetch → Chrome TLS); this machine\'s egress, US proxy not verified' : 'local direct public fetch; US proxy not verified', results}, null, 2);
  if(reportPath)await writeFile(reportPath,report+'\n','utf8');
  console.log(report);
  if (results.some(result => result.status !== 'details-imported')) process.exitCode = 1;
}
