import {fetchProduct, allowedUrl} from '../lib/importer/fetch.ts';
import {merchantProfileForUrl} from '../lib/importer/merchant-profiles.ts';

const inputs = process.argv.slice(2);
if (!inputs.length || inputs.length > 30) {
  console.error('Usage: node scripts/check-merchant-imports.mjs URL [URL ...] (1–30 supported product URLs)');
  process.exitCode = 2;
} else {
  const urls = inputs.map(value => allowedUrl(value).href);
  const results = [];
  for (const url of urls) {
    const profile = merchantProfileForUrl(url);
    try {
      const product = await fetchProduct(url);
      const variants = product.variants ?? [];
      const available = variants.filter(variant => variant.available && variant.availabilityKnown !== false);
      results.push({
        store: new URL(url).hostname,
        priority: profile?.priority ?? null,
        status: product.title && product.price !== undefined && product.currency && product.image && available.length ? 'orderable' : 'partial',
        method: product.method,
        title: product.title ?? null,
        price: product.price ?? null,
        currency: product.currency ?? null,
        photos: product.images?.length ?? Number(Boolean(product.image)),
        variants: variants.length,
        confirmedAvailable: available.length,
      });
    } catch (error) {
      results.push({store: new URL(url).hostname, priority: profile?.priority ?? null, status: 'blocked', reason: error instanceof Error ? error.message : String(error)});
    }
  }
  console.log(JSON.stringify({checkedAt: new Date().toISOString(), results}, null, 2));
  if (results.some(result => result.status !== 'orderable')) process.exitCode = 1;
}
