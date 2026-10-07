import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCatalogImportLink, parseCatalogImportQueue, removeImportedCatalogLinks} from '../lib/market/catalog-import-queue.ts';
import {detectBotChallenge, fetchProduct, ManualEntryFallbackError} from '../lib/importer/fetch.ts';
import {directRetryAllowed, withDirectFallback} from '../lib/importer/egress.ts';
import {clearEbayTokenCacheForTests} from '../lib/importer/ebay.ts';

test('pasted text yields clean HTTPS links: several per line, surrounding words, punctuation and tracking stripped', () => {
  const parsed = parseCatalogImportQueue([
    'Смотри: https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr/CW2288-111?utm_source=tg&gclid=abc, и ещё http://www.adidas.com/us/samba-og-shoes/B75806.html.',
    'просто слова без ссылки',
    '',
    'https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr/CW2288-111#reviews',
    '(https://www.ebay.com/itm/128112073606?hash=item1dd4:g:abc&var=0)',
  ].join('\n'));
  assert.deepEqual(parsed.links, [
    'https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr/CW2288-111',
    'https://www.adidas.com/us/samba-og-shoes/B75806.html',
    'https://www.ebay.com/itm/128112073606?hash=item1dd4:g:abc&var=0',
  ]);
  assert.equal(parsed.duplicates, 1);
  assert.deepEqual(parsed.invalid, ['просто слова без ссылки']);
  assert.equal(normalizeCatalogImportLink('ftp://store.example/x'), undefined);
  assert.equal(normalizeCatalogImportLink('https://localhost/x'), undefined);
});

test('imported links disappear from the textarea while failed links and plain text stay', () => {
  const value = 'Партия 1\nhttps://a.example/saved — хит\nhttps://a.example/failed\nhttps://a.example/saved?utm_source=x https://a.example/next';
  assert.equal(removeImportedCatalogLinks(value, ['https://a.example/saved']), 'Партия 1\nhttps://a.example/failed\nhttps://a.example/next');
});

test('bot-management interstitials are recognised by vendor and reported as a block, not as missing data', async () => {
  assert.equal(detectBotChallenge('<html><head><title>&nbsp;</title></head><body><script>var j=1;function triggerInterstitialChallenge(){xhr.open("POST","/_sec/verify?provider=interstitial");xhr.send(JSON.stringify({"bm-verify":"AAQ"}))}</script></body></html>'), 'Akamai');
  assert.equal(detectBotChallenge('<html><head><title>Access Denied</title></head><body>Reference #18.abc</body></html>'), 'Akamai');
  assert.equal(detectBotChallenge('<html><body><div id="px-captcha"></div></body></html>'), 'PerimeterX');
  assert.equal(detectBotChallenge('<html><head><title>Just a moment...</title></head></html>'), 'Cloudflare');
  assert.equal(detectBotChallenge('<html><head><title>Too many requests</title></head><body><h1>Too many requests</h1></body></html>'), 'лимит запросов');
  assert.equal(detectBotChallenge('<html><head><title>Ribbed knit sweater | ZARA</title><script type="application/ld+json">{"@type":"Product"}</script></head></html>'), undefined);

  const challengePage = '<html><head><title>&nbsp;</title></head><body><script>"bm-verify"</script></body></html>';
  const fetcher = async () => new Response(challengePage, {status: 200, headers: {'Content-Type': 'text/html; charset=utf-8'}});
  await assert.rejects(fetchProduct('https://www.zara.com/us/en/ribbed-knit-sweater-p05536113.html', fetcher), error =>
    error instanceof ManualEntryFallbackError && error.reason === 'blocked' && /Akamai/.test(error.message) && !/&nbsp;/.test(error.message));
});

test('an eBay Browse API refusal reaches the operator with stage, status, errorId and eBay text, without the page wall hiding it', async () => {
  clearEbayTokenCacheForTests();
  const credentials = {clientId: 'app-client-id', clientSecret: 'private-cert-secret', environment: 'production'};
  const fetcher = Object.assign(async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/oauth2/token')) return Response.json({access_token: 'token', expires_in: 3600});
    if (url.pathname.startsWith('/buy/browse/')) return new Response(JSON.stringify({errors: [{errorId: 1100, domain: 'ACCESS', message: 'Access denied: insufficient permissions for the Browse API.'}]}), {status: 403, headers: {'Content-Type': 'application/json'}});
    return new Response('<html><head><title>Error Page | eBay</title></head><body>Pardon our interruption</body></html>', {status: 403, headers: {'Content-Type': 'text/html'}});
  }, {ebayBrowseConfig: () => credentials});
  const originalWarn = console.warn; console.warn = () => {};
  try {
    await assert.rejects(fetchProduct('https://www.ebay.com/itm/128112073606', fetcher), error =>
      error instanceof ManualEntryFallbackError
      && /eBay Browse API: запрос объявления, HTTP 403, errorId 1100 — Access denied/.test(error.message)
      && error.partial?.brand === 'eBay' && error.reason === 'blocked');
  } finally { console.warn = originalWarn; }

  // Without server keys the operator learns that the integration is off rather than "store did not answer".
  const noKeys = Object.assign(async () => new Response('', {status: 403, headers: {'Content-Type': 'text/html'}}), {ebayBrowseConfig: () => ({})});
  console.warn = () => {};
  try {
    await assert.rejects(fetchProduct('https://www.ebay.com/itm/128112073606', noKeys), error => /не настроен на сервере/.test(error.message));
    await assert.rejects(fetchProduct('https://www.ebay.com/sch/i.html?_nkw=nike', Object.assign(noKeys, {ebayBrowseConfig: () => credentials})), error => /ebay\.com\/itm/.test(error.message));
  } finally { console.warn = originalWarn; }
});

test('a proxy rate limit from a platform triggers one direct retry, marked for the import warning; location-bound stores never retry', async () => {
  const calls = [];
  const proxied = async input => { calls.push(['proxy', String(input)]); return new Response('Too many requests', {status: 429, headers: {'Content-Type': 'text/html'}}); };
  const direct = async input => { calls.push(['direct', String(input)]); return Response.json({product: {title: 'Tree Runner'}}); };
  const fetcher = withDirectFallback(proxied, direct);
  const shopify = await fetcher('https://www.allbirds.com/products/mens-tree-runners.js?country=US');
  assert.equal(shopify.status, 200);
  assert.equal(shopify.headers.get('x-atlas-egress'), 'direct');
  const amazon = await fetcher('https://www.amazon.com/dp/B0DFCH3C4W');
  assert.equal(amazon.status, 429);
  assert.equal(amazon.headers.get('x-atlas-egress'), null);
  assert.deepEqual(calls.map(([kind]) => kind), ['proxy', 'direct', 'proxy']);

  assert.equal(directRetryAllowed('https://kith.com/products/x', undefined, new Error('Importer proxy rejected the request (503).')), true);
  assert.equal(directRetryAllowed('https://kith.com/products/x', undefined, new Error('Importer proxy rejected the request (401).')), false);
  assert.equal(directRetryAllowed('https://www.target.com/p/x/-/A-1', new Response('', {status: 429})), false);

  // The marked response still carries the store's own currency warning path: an aborted request is not retried.
  const controller = new AbortController(); controller.abort();
  const aborted = withDirectFallback(async () => { throw new Error('Importer proxy rejected the request (429).'); }, direct);
  await assert.rejects(aborted('https://kith.com/products/x', {signal: controller.signal}), /rejected/);
});
