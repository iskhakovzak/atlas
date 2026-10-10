import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalProductUrl } from '../lib/importer/source-identity.ts';
import { normalizeCatalogImportLink } from '../lib/market/catalog-import-queue.ts';
import { extractProduct } from '../lib/importer/extract.ts';
import { extractShopify } from '../lib/importer/shopify.ts';
import { internalStoreHandle, readableBrand } from '../lib/importer/brand-name.ts';
import { fetchProduct, ManualEntryFallbackError, describeImportDiagnostic } from '../lib/importer/fetch.ts';

const ld = value => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

test('canonical product URL drops tracking keys and keeps product, variant and affiliate keys untouched', () => {
  assert.equal(canonicalProductUrl('https://WWW.Anker.com/products/a2147?variant=42089534750870&utm_source=x&fbclid=1#reviews'), 'https://www.anker.com/products/a2147?variant=42089534750870');
  assert.equal(canonicalProductUrl('https://www.ebay.com/itm/1?var=0&hash=item1dd4:g:abc&campid=5338&mkcid=1&_trkparms=x'.replace('&_trkparms=x', '&gclid=9')), 'https://www.ebay.com/itm/1?campid=5338&hash=item1dd4:g:abc&mkcid=1&var=0');
  assert.equal(canonicalProductUrl('https://www.amazon.com/dp/B0C1234567?th=1&psc=1&qid=17&sr=8-1&ref_=x&tag=aff-20&pd_rd_w=a'), 'https://www.amazon.com/dp/B0C1234567?psc=1&tag=aff-20&th=1');
  // qid/sr are only Amazon search context; elsewhere they may pick a product.
  assert.equal(canonicalProductUrl('https://www.zara.com/es/en/x-p1.html?v1=2&sr=1&utm_medium=a'), 'https://www.zara.com/es/en/x-p1.html?sr=1&v1=2');
  assert.equal(canonicalProductUrl('https://x.com/p?q=a%20b&srsltid=1'), 'https://x.com/p?q=a%20b');
  assert.equal(canonicalProductUrl(canonicalProductUrl('https://www.nike.com/t/a/CW2288-111?utm_campaign=1')), 'https://www.nike.com/t/a/CW2288-111');
  // The operator queue uses the same spelling, so a batch link hits the same cache row.
  assert.equal(normalizeCatalogImportLink('http://www.anker.com/products/a2147?utm_source=x&variant=1).'), 'https://www.anker.com/products/a2147?variant=1');
});

test('JSON-LD with unquoted type, comment wrappers, raw newlines and a priceSpecification list is read', () => {
  const html = `<script type=application/ld+json><!--\n{"@type":"Product","name":"Line\nbreak","offers":{"priceSpecification":[{"priceType":"https://schema.org/ListPrice","price":200,"priceCurrency":"EUR"},{"price":"129,99 €","priceCurrency":"EUR"}]}}\n--></script>`;
  const p = extractProduct(html, 'https://www.on.com/en-us/products/cloud-6');
  assert.equal(p.title, 'Line break'); assert.equal(p.price, 129.99); assert.equal(p.currency, 'EUR');
  const cdata = `<script type="application/ld+json">//<![CDATA[\n${JSON.stringify({'@type': 'Product', name: 'C', offers: {price: '$129.99', priceCurrency: 'USD'}})}\n//]]></script>`;
  assert.equal(extractProduct(cdata, 'https://www.on.com/en-us/products/c').price, 129.99);
});

test('AggregateOffer: one value is a price, a real range stays unquoted, listed offers are offers', () => {
  const url = 'https://www.on.com/en-us/products/cloud-6';
  const aggregate = offers => extractProduct(ld({'@type': 'Product', name: 'X', offers}), url);
  assert.equal(aggregate({'@type': 'AggregateOffer', lowPrice: 50, highPrice: 50, priceCurrency: 'USD'}).price, 50);
  assert.equal(aggregate({'@type': 'AggregateOffer', lowPrice: '50.00', highPrice: 80, offerCount: 1, priceCurrency: 'USD'}).price, 50);
  const range = aggregate({'@type': 'AggregateOffer', lowPrice: 10, highPrice: 100, priceCurrency: 'USD'});
  assert.equal(range.price, undefined); assert.ok(range.warnings.length);
  const nested = aggregate({'@type': 'AggregateOffer', lowPrice: 10, highPrice: 100, priceCurrency: 'CHF', offers: [{'@type': 'Offer', price: "1'299.00"}]});
  assert.equal(nested.price, 1299); assert.equal(nested.currency, 'CHF');
});

test('microdata price counts only for one Product scope that names the linked article', () => {
  const scope = (extra = '') => `<div itemscope itemtype="https://schema.org/Product"><h1 itemprop=name>Y</h1>${extra}<meta itemprop=price content=19.5><span itemprop="priceCurrency" content="GBP">£</span></div><meta property=og:title content=Y>`;
  const url = 'https://www.on.com/en-us/products/y-123456';
  const one = extractProduct(scope(), url);
  assert.equal(one.price, 19.5); assert.equal(one.currency, 'GBP');
  assert.equal(extractProduct(scope('<meta itemprop="productID" content="y-123456">'), url).price, 19.5);
  assert.equal(extractProduct(scope('<meta itemprop="productID" content="OTHER-999">'), url).price, undefined);
  assert.equal(extractProduct(scope() + '<div itemscope itemtype="https://schema.org/Product"><meta itemprop=price content=1></div>', url).price, undefined);
});

test('price text with symbols, ISO codes, apostrophes and narrow spaces is a number; unquoted meta is read', () => {
  const url = 'https://www.on.com/en-us/products/z';
  assert.equal(extractProduct('<meta property=og:title content=Z/><meta property=og:price:amount content="USD 12.00"/><meta property=og:price:currency content=USD />', url).price, 12);
  const price = value => extractProduct(ld({'@type': 'Product', name: 'Z', offers: {price: value, priceCurrency: 'EUR'}}), url).price;
  assert.equal(price('1 299,00 €'), 1299); assert.equal(price('€1.299,00'), 1299); assert.equal(price("CHF 1'299.50"), 1299.5); assert.equal(price('US$45'), 45);
});

test('an internal store handle is never shown as the store name', () => {
  assert.equal(internalStoreHandle('beta-anker-us'), true);
  assert.equal(internalStoreHandle('anker-us.myshopify.com'), true);
  assert.equal(internalStoreHandle('nude-project'), false);
  assert.equal(internalStoreHandle('Anker'), false);
  assert.equal(internalStoreHandle('acme', 'acme'), true);
  const url = 'https://www.anker.com/products/a2147?variant=42089534750870';
  assert.equal(readableBrand('beta-anker-us', url), 'Anker');
  assert.equal(readableBrand('beta-anker-us', url, {siteName: 'Anker US'}), 'Anker US');
  const anker = extractProduct(ld({'@type': 'Product', name: 'Charger', brand: {name: 'beta-anker-us'}, offers: {price: 5, priceCurrency: 'USD'}}), url);
  assert.equal(anker.brand, 'Anker');
  const shopify = extractShopify({handle: 'a2147', title: 'Charger', vendor: 'beta-anker-us', variants: [{id: 42089534750870, title: 'Default', price: 2999, available: true}]}, {currency: 'USD'}, url);
  assert.equal(shopify.brand, 'Anker');
  assert.equal(extractProduct(ld({'@type': 'Product', name: 'X', brand: 'nude-project', offers: {price: 5, priceCurrency: 'EUR'}}), 'https://nude-project.com/products/x').brand, 'nude-project');
});

test('a supported store on Shopify outside the root list fills price and options from /products/<handle>.js', async () => {
  const source = 'https://www.hoka.com/products/clifton-9?variant=2';
  const page = '<html><head><meta property="og:title" content="Clifton 9"><meta property="og:site_name" content="HOKA"><script src="https://cdn.shopify.com/s/files/theme.js"></script><script>Shopify.shop = "hoka-us.myshopify.com"; Shopify.currency = {"active":"EUR","rate":"1.0"};</script></head><body>Clifton</body></html>';
  const json = {handle: 'clifton-9', title: 'Clifton 9', vendor: 'hoka-us', images: ['//cdn.shopify.com/clifton.jpg'], options: [{name: 'Size'}], variants: [{id: 1, title: '8', option1: '8', price: 14500, available: true}, {id: 2, title: '9', option1: '9', price: 15000, available: true}]};
  const calls = [];
  const fetcher = async input => {
    const url = new URL(String(input instanceof Request ? input.url : input)); calls.push(url.pathname);
    if (url.pathname.endsWith('.js')) return new Response(JSON.stringify(json), {headers: {'content-type': 'application/json'}});
    return new Response(page, {headers: {'content-type': 'text/html'}});
  };
  const result = await fetchProduct(source, fetcher);
  assert.equal(result.method, 'Shopify public product JSON');
  assert.equal(result.currency, 'EUR'); assert.equal(result.price, 150); assert.equal(result.variants.length, 2);
  assert.equal(result.brand, 'HOKA');
  assert.ok(calls.includes('/products/clifton-9.js'));
  // No Shopify.currency: the extra request is not made and the page result stays as it was.
  calls.length = 0;
  await assert.rejects(fetchProduct(source, async input => { calls.push(String(input instanceof Request ? input.url : input)); return new Response(page.replace(/Shopify\.currency[^;]+;/, ''), {headers: {'content-type': 'text/html'}}); }), error => error instanceof ManualEntryFallbackError);
  assert.ok(!calls.some(url => url.endsWith('.js')));
});

test('a page over 6 MB is a response failure tagged oversize', async () => {
  const source = 'https://www.carters.com/p/item/V_1S739110';
  await assert.rejects(fetchProduct(source, async () => new Response('x'.repeat(6_000_001), {headers: {'content-type': 'text/html'}})), error => error instanceof ManualEntryFallbackError && error.reason === 'response' && error.diagnostic?.vendor === 'oversize');
  assert.equal(describeImportDiagnostic({vendor: 'oversize'}), 'страница больше 6 МБ');
});

test('Adidas asks the listing and product JSON at once, not one after the other', async () => {
  const product = {id: 'IF4492', name: 'Daily 4.0 Shoes', brand: 'Sportswear', category: 'Shoes', color: 'Black', price: 65, salePrice: 33, orderable: 1, image: {src: 'https://assets.adidas.com/primary.jpg'}};
  const listing = {raw: {itemList: {items: [{productId: 'IF4492', displayName: 'Daily 4.0 Shoes', availableSizes: ['5', '6'], orderable: 1, salePrice: 33}]}}};
  let inFlight = 0, peak = 0;
  const fetcher = async input => {
    const url = String(input instanceof Request ? input.url : input);
    if (!/\/api\//.test(url)) return new Response('<html>challenge</html>', {status: 403, headers: {'content-type': 'text/html'}});
    inFlight++; peak = Math.max(peak, inFlight);
    await new Promise(resolve => setTimeout(resolve, 30));
    inFlight--;
    return new Response(JSON.stringify(/\/plp\//.test(url) ? listing : product), {headers: {'content-type': 'application/json'}});
  };
  const result = await fetchProduct('https://www.adidas.com/us/daily-4.0-shoes/IF4492.html', fetcher);
  assert.equal(result.price, 33);
  assert.equal(peak, 2);
});

test('cart-add reuses the store answer the server stored in the last 2 minutes, never a stale, foreign or Amazon US one', async () => {
  const { withRecentImport, recentCheckMs } = await import('../lib/market/cart-check.ts');
  const now = 1_000_000_000;
  const stored = { sourceUrl: 'https://www.nike.com/t/a/CW2288-111', title: 'AF1', price: 115, currency: 'USD', variants: [], warnings: [] };
  const rows = new Map([['https://www.nike.com/t/a/CW2288-111', { payload: JSON.stringify(stored), updatedAt: now - 60_000 }]]);
  const reads = [], lives = [];
  const read = async (url, since) => { reads.push([url, since]); return rows.get(url); };
  const live = async url => { lives.push(url); return { ...stored, price: 120 }; };
  const source = withRecentImport(live, read, now, recentCheckMs);
  const reused = await source.fetchProduct('https://www.nike.com/t/a/CW2288-111?utm_source=mail');
  assert.equal(reused.price, 115); assert.equal(source.snapshotAt(reused), now - 60_000);
  assert.deepEqual(reads[0], ['https://www.nike.com/t/a/CW2288-111', now - recentCheckMs]); assert.equal(lives.length, 0);
  // Older than the window (the reader is trusted for nothing, the time is checked again), malformed, or a read error: live.
  rows.set('https://www.nike.com/t/b/1', { payload: JSON.stringify(stored), updatedAt: now - recentCheckMs - 1 });
  rows.set('https://www.nike.com/t/c/2', { payload: '{"price":"free"}', updatedAt: now - 1000 });
  for (const url of ['https://www.nike.com/t/b/1', 'https://www.nike.com/t/c/2']) assert.equal((await source.fetchProduct(url)).price, 120);
  assert.equal((await withRecentImport(live, async () => { throw Error('D1 down'); }, now).fetchProduct('https://www.nike.com/t/a/CW2288-111')).price, 120);
  // Amazon US is always asked live, as at checkout; the cache is not even read.
  reads.length = 0;
  const fresh = await source.fetchProduct('https://www.amazon.com/dp/B0C1234567?qid=1');
  assert.equal(fresh.price, 120); assert.equal(reads.length, 0); assert.equal(source.snapshotAt(fresh), undefined);
  assert.equal(lives.at(-1), 'https://www.amazon.com/dp/B0C1234567');
});

test('a reused answer records its own fetch time as the line check, not the tap', async () => {
  const { prepareAction } = await import('../lib/market/actions-server.ts');
  const { blank, products, tariff } = await import('../lib/market/domain.ts');
  const { defaultPolicy } = await import('../lib/market/policy.ts');
  const { withRecentImport, recentCheckMs } = await import('../lib/market/cart-check.ts');
  const now = Date.now(), url = 'https://www.nike.com/t/a/CW2288-111';
  const product = { ...products[0], id: 'n1', name: 'AF1', usd: 115, variants: ['Black · 9'], country: 'США', boxedWeight: 0.8, weight: 1.3, sourceUrl: url, sourcePrice: 115, sourceCurrency: 'USD', sourceVariantId: 'v9', sourceShipping: 10, sourceShippingUsd: 10, sourceShippingCurrency: 'USD', sourceShippingEstimated: true, shippingKnown: true };
  const stored = { sourceUrl: url, title: 'AF1', price: 115, currency: 'USD', variants: [{ id: 'v9', label: 'Black · 9', price: 115, available: true }], warnings: [] };
  const source = withRecentImport(async () => { throw Error('the store must not be asked'); }, async () => ({ payload: JSON.stringify(stored), updatedAt: now - 30_000 }), now);
  const result = await prepareAction(blank(), { type: 'cart-add', product, variant: 'Black · 9' }, { fetchProduct: source.fetchProduct, snapshotAt: source.snapshotAt, pricing: tariff, policy: defaultPolicy, operator: false, now, recentCheckMs });
  const added = result.next.cart.at(-1);
  assert.equal(added.product.sourceCheckedAt, now - 30_000);
  assert.equal(added.product.sourcePrice, 115);
});

test('a short store link is expanded through at most 3 redirects to a supported store, otherwise kept', async () => {
  const { expandShortLink, desktopStoreUrl, isShortLink } = await import('../lib/importer/short-links.ts');
  const hops = { 'https://amzn.to/3abc': 'https://a.co/d/xyz', 'https://a.co/d/xyz': 'https://www.amazon.com/dp/B0C1234567?ref_=x&th=1' };
  const seen = [];
  const fetcher = async (url, init) => { seen.push([url, init.redirect]); return new Response(null, { status: 301, headers: hops[url] ? { location: hops[url] } : {} }); };
  assert.equal((await expandShortLink(new URL('https://amzn.to/3abc'), fetcher)).href, 'https://www.amazon.com/dp/B0C1234567?ref_=x&th=1');
  assert.deepEqual(seen.map(([, redirect]) => redirect), ['manual', 'manual']);
  // ebay.us lands on an m. page: read as the www store.
  assert.equal((await expandShortLink(new URL('https://ebay.us/m/AbC'), async () => new Response(null, { status: 302, headers: { location: 'https://m.ebay.com/itm/128112073606' } }))).href, 'https://www.ebay.com/itm/128112073606');
  // Outside the allowlist, plain HTTP, a loop, no Location or a 200: the original link.
  const original = new URL('https://amzn.to/zzz');
  for (const location of ['https://evil.example/x', 'http://www.amazon.com/dp/B0C1234567', 'https://amzn.to/zzz', undefined])
    assert.equal(await expandShortLink(original, async () => new Response(null, { status: 302, headers: location ? { location } : {} })), original);
  assert.equal(await expandShortLink(original, async () => new Response('page', { status: 200 })), original);
  let loops = 0;
  assert.equal(await expandShortLink(original, async () => { loops++; return new Response(null, { status: 302, headers: { location: 'https://a.co/d/' + loops } }); }), original);
  assert.equal(loops, 3);
  // A slow shortener is given about 3 s, not the import's budget.
  const started = Date.now();
  assert.equal(await expandShortLink(original, (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))), { timeoutMs: 50 }), original);
  assert.ok(Date.now() - started < 1000);
  // Not a shortener: no request at all.
  const page = new URL('https://www.nike.com/t/a/CW2288-111');
  assert.equal(await expandShortLink(page, async () => { throw Error('must not fetch'); }), page);
  assert.equal(isShortLink(new URL('https://ebay.us/x')), true);
  assert.equal(desktopStoreUrl(new URL('https://m.zara.com/es/en/x-p1.html')).hostname, 'www.zara.com');
  assert.equal(desktopStoreUrl(new URL('https://m.example.com/x')).hostname, 'm.example.com');
});

test('one store request for the same page at once, and a recent wall is answered without asking the store', async () => {
  const { createImportFlights } = await import('../lib/importer/import-flight.ts');
  let clock = 0;
  const flights = createImportFlights({ clock: () => clock, followerWaitMs: 200 });
  let calls = 0, release;
  const load = () => { calls++; return new Promise(resolve => { release = () => resolve({ sourceUrl: 'u', price: 1, warnings: [] }); }); };
  const first = flights.run('u', load), second = flights.run('u', load);
  await new Promise(resolve => setTimeout(resolve, 5));
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1); assert.equal(a.leader, true); assert.equal(b.leader, false); assert.equal(b.outcome.data.price, 1);
  assert.equal(flights.size().inFlight, 0);
  // A wall is remembered for 90 s; a timeout or a network failure is not.
  await flights.run('w', async () => { throw new ManualEntryFallbackError(undefined, undefined, 'blocked'); });
  await flights.run('t', async () => { throw new ManualEntryFallbackError(undefined, undefined, 'timeout'); });
  assert.equal(flights.recentFailure('w')?.reason, 'blocked'); assert.equal(flights.recentFailure('t'), undefined);
  clock += 90_001;
  assert.equal(flights.recentFailure('w'), undefined);
  // A leader that hangs (its Worker request was cancelled) does not hold the follower: it fetches itself.
  const hung = flights.run('h', () => new Promise(() => {}));
  const own = await flights.run('h', async () => ({ sourceUrl: 'h', price: 2, warnings: [] }));
  assert.equal(own.leader, true); assert.equal(own.outcome.data.price, 2);
  void hung;
  // A leader's timeout is not shared: the follower asks on its own.
  let fail;
  const slow = flights.run('s', () => new Promise((_resolve, reject) => { fail = reject; }));
  const follower = flights.run('s', async () => ({ sourceUrl: 's', price: 3, warnings: [] }));
  fail(Object.assign(new Error('late'), { name: 'AbortError' }));
  assert.equal((await follower).outcome.data.price, 3);
  assert.equal((await slow).outcome.ok, false);
});

test('a proxy attempt carries the route deadline; engines share it, or the only useful engine gets all of it', async () => {
  const { withMerchantRoutes } = await import('../lib/importer/route-ladder.ts');
  const { createMerchantProxyFetch } = await import('../lib/importer/proxy-client.mjs');
  const { createEnginePlanner, fetchWithEngines } = await import('../deploy/upcloud/merchant-engines.mjs');
  const seen = [];
  const route = name => ({ name, fetch: async (_input, init) => { seen.push([name, init.deadlineMs]); return new Response('<html>ok</html>', { status: name === 'tashkent' ? 503 : 200, headers: { 'content-type': 'text/plain' } }); } });
  await withMerchantRoutes([{ ...route('tashkent'), attemptMs: () => 9_000 }, route('us-vps'), route('residential')], 3_000)('https://www.nike.com/t/a', {});
  assert.deepEqual(seen, [['tashkent', 8_700], ['us-vps', 2_700]]);
  // The client signs the deadline into the payload only within 1..30 s; an old proxy ignores it.
  const payloads = [];
  const client = createMerchantProxyFetch({ endpoint: 'https://85-9-196-196.sslip.io/v1/fetch', secret: 'd'.repeat(64), fetchImpl: async (_url, init) => { payloads.push(JSON.parse(init.body)); return Response.json({ version: 1, status: 200, headers: { contentType: 'text/html' }, body: '' }); } });
  await client('https://www.nike.com/t/a', { deadlineMs: 2_700 });
  await client('https://www.nike.com/t/a', { deadlineMs: 120_000 });
  await client('https://www.nike.com/t/a', {});
  assert.deepEqual(payloads.map(payload => payload.deadlineMs), [2_700, undefined, undefined]);
  // 2.7 s cannot be split so that the second engine gets 1.5 s: the first engine gets the whole deadline.
  const budgets = [];
  const engine = name => async (_target, init) => { budgets.push([name, init.deadline - Date.now()]); return new Response('<html><script type="application/ld+json">{"@type":"Product","name":"A","offers":{"price":1,"priceCurrency":"USD"}}</script></html>', { headers: { 'content-type': 'text/html' } }); };
  await fetchWithEngines({ target: new URL('https://www.nike.com/t/a'), method: 'GET', headers: {}, mode: 'auto', planner: createEnginePlanner(['fetch', 'impersonate']), deadlineMs: 2_700, engines: { fetch: engine('fetch'), impersonate: engine('impersonate') } });
  assert.equal(budgets[0][0], 'fetch'); assert.ok(budgets[0][1] > 2_000, String(budgets[0][1]));
});

test('the proxy stops its engines at the signed deadline and when the Worker hangs up', async t => {
  const { createHmac } = await import('node:crypto');
  const { createImporterProxyServer } = await import('../deploy/upcloud/importer-proxy-server.mjs');
  const secret = 'b'.repeat(64);
  let aborted = 0;
  const server = createImporterProxyServer({ secret, allowedHosts: new Set(['www.nike.com']), fetcher: (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => { aborted++; reject(init.signal.reason); })) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const endpoint = 'http://127.0.0.1:' + server.address().port + '/v1/fetch';
  const send = (payload, nonce, signal) => {
    const body = JSON.stringify(payload), timestamp = String(Date.now());
    const signature = createHmac('sha256', secret).update(timestamp + '\n' + nonce + '\n' + body).digest('hex');
    return fetch(endpoint, { method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-atlas-proxy-timestamp': timestamp, 'x-atlas-proxy-nonce': nonce, 'x-atlas-proxy-signature': signature }, body });
  };
  const started = Date.now();
  const answer = await (await send({ version: 1, url: 'https://www.nike.com/t/a', method: 'GET', headers: {}, engine: 'fetch', deadlineMs: 1_000 }, 'e'.repeat(32))).json();
  assert.equal(answer.status, 504); assert.ok(Date.now() - started < 3_000); assert.equal(aborted, 1);
  const controller = new AbortController();
  const pending = send({ version: 1, url: 'https://www.nike.com/t/b', method: 'GET', headers: {}, engine: 'fetch' }, 'f'.repeat(32), controller.signal).catch(error => error);
  await new Promise(resolve => setTimeout(resolve, 100));
  controller.abort();
  await pending;
  for (let i = 0; i < 50 && aborted < 2; i++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(aborted, 2);
});

test('review: a cancelled leader never leaves a stuck in-flight entry; the request that took over is waited for', async () => {
  const { createImportFlights } = await import('../lib/importer/import-flight.ts');
  let clock = 0;
  const flights = createImportFlights({ clock: () => clock, followerWaitMs: 1_000 });
  void flights.run('k', () => new Promise(() => {}));
  // The hung entry is older than followerWaitMs: the next request does not wait for it at all.
  clock += 1_000;
  let release;
  const taker = flights.run('k', () => new Promise(resolve => { release = () => resolve({ sourceUrl: 'k', price: 4, warnings: [] }); }));
  // A third request waits for the one that took over instead of asking the store again.
  let thirdCalls = 0;
  const third = flights.run('k', async () => { thirdCalls++; return { sourceUrl: 'k', price: 5, warnings: [] }; });
  await new Promise(resolve => setTimeout(resolve, 5));
  release();
  const [took, waited] = await Promise.all([taker, third]);
  assert.equal(took.leader, true); assert.equal(waited.leader, false); assert.equal(waited.outcome.data.price, 4); assert.equal(thirdCalls, 0);
  assert.equal(flights.size().inFlight, 0);
  // Hung entries of other pages are dropped once the map is full, so it never grows without bound.
  const bounded = createImportFlights({ clock: () => clock, followerWaitMs: 1_000, maxInFlight: 3 });
  for (const key of ['a', 'b', 'c']) void bounded.run(key, () => new Promise(() => {}));
  clock += 1_000;
  void bounded.run('d', () => new Promise(() => {}));
  assert.equal(bounded.size().inFlight, 1);
});

test('review: a unit price in priceSpecification is not the item price; dotted thousands in display text', () => {
  const url = 'https://www.on.com/en-us/products/cream';
  const product = offers => extractProduct(ld({ '@type': 'Product', name: 'Cream', offers }), url);
  const unitFirst = product({ priceSpecification: [
    { '@type': 'UnitPriceSpecification', price: 99.8, priceCurrency: 'EUR', referenceQuantity: { '@type': 'QuantitativeValue', value: 100, unitCode: 'MLT' } },
    { '@type': 'UnitPriceSpecification', price: 29.95, priceCurrency: 'EUR' },
  ] });
  assert.equal(unitFirst.price, 29.95); assert.equal(unitFirst.currency, 'EUR');
  assert.equal(product({ priceSpecification: { price: 99.8, priceCurrency: 'EUR', referenceQuantity: { value: 100, unitCode: 'GRM' } } }).price, undefined);
  assert.equal(product({ priceSpecification: { price: 12, priceCurrency: 'EUR', referenceQuantity: { value: 1 } } }).price, 12);
  const price = value => product({ price: value, priceCurrency: 'EUR' }).price;
  assert.equal(price('€1.299'), 1299); assert.equal(price('1.299 €'), 1299); assert.equal(price('$1.299.990'), 1299990);
  // A bare schema value keeps its decimal point.
  assert.equal(price('1.299'), 1.299); assert.equal(price('€12.50'), 12.5);
});

test('review: microdata lookup stays linear on a page full of unclosed "<a" (no distant ">" scan)', () => {
  const url = 'https://www.on.com/en-us/products/y-123456';
  const noise = '<script>' + 'if(a<b)x++;'.repeat(60_000) + '</script>';
  const html = `<div itemscope itemtype="https://schema.org/Product"><h1 itemprop=name>Y</h1>${noise}<meta itemprop=price content=19.5><meta itemprop=priceCurrency content=GBP></div><meta property=og:title content=Y>`;
  const started = Date.now();
  const p = extractProduct(html, url);
  assert.equal(p.price, 19.5); assert.equal(p.currency, 'GBP');
  assert.ok(Date.now() - started < 3_000, String(Date.now() - started));
});
