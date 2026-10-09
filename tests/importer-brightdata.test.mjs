import test from 'node:test';
import assert from 'node:assert/strict';
import {BrightDataPendingError, brightDataTarget, defaultBrightDataSettings, fetchBrightDataProduct, mapHmRecord, mapWalmartRecord, paidRecordsByDay, parseBrightDataSettings} from '../lib/importer/brightdata.ts';
import {fetchProduct, ManualEntryFallbackError} from '../lib/importer/fetch.ts';
import {brightDataLedgerPrefix, planBrightDataLedger} from '../lib/market/provider-ledger.ts';
import {requestImport} from '../lib/market/import-client.ts';

// Synthetic records shaped like Bright Data's Walmart and H&M scrapers (field names as the API returns them).
const walmartUrl = 'https://www.walmart.com/ip/Crew-Tee-Short-Sleeve/1134943499?athbdg=L1600&from=/search';
const walmartRecord = {
  url: 'https://www.walmart.com/ip/Crew-Tee-Short-Sleeve/1134943499', product_id: '1134943499', sku: '1134943499', variant_id: '22CUMF3V6I7H',
  product_name: "Men's Crewneck T-Shirt with Short Sleeves", brand: 'George', final_price: 1.43, initial_price: 5.98, currency: 'USD',
  main_image: 'https://i5.walmartimages.com/seo/tee.jpeg', image_urls: ['https://i5.walmartimages.com/seo/tee.jpeg', 'https://i5.walmartimages.com/asr/back.jpeg'],
  is_available: true, availability: 'in_stock', listing_has_variations: true, seller: 'Walmart.com',
  breadcrumb_text: 'Clothing > Mens Clothing > Mens Shirts',
  variant_attributes: [{name: 'Color', value: 'Dark Navy'}, {name: 'Clothing Size', value: 'XL'}],
  variants: [{id: '22CUMF3V6I7H', us_item_id: '1134943499', in_stock: true, price: {value: 1.43, currency: 'USD'}}],
};
const hmUrl = 'https://www2.hm.com/en_us/productpage.1245444006.html';
const hmRecord = {
  url: hmUrl, item_id: '1245444', variant_id: '1245444006', group_id: '1245444', title: 'Wide Jeans', brand: 'H&M', product_category: 'Women>Jeans',
  image_url: 'https://image.hm.com/assets/hm/5b/26/front.jpg', additional_image_urls: ['https://image.hm.com/assets/hm/79/26/back.jpg'],
  price: '$54.99', sale_price: '$43.99', availability: 'in_stock',
  variant_attributes: [{name: 'color', value: 'Light denim blue'}],
  variants: [
    {variant_type: 'color', variant_options: [
      {option_id: '1245444005', option_name: 'Dark gray', option_price: 37.99, in_stock: true, image: 'https://image.hm.com/assets/hm/36/a3/gray.jpg'},
      {option_id: '1245444006', option_name: 'Light denim blue', option_price: 43.99, in_stock: true, image: 'https://image.hm.com/assets/hm/5b/26/front.jpg'},
    ]},
    {variant_type: 'size', variant_options: [
      {option_id: '1245444006002', option_name: 'XS', option_price: 43.99, in_stock: true, image: null},
      {option_id: '1245444006003', option_name: 'S', option_price: 43.99, in_stock: false, image: null},
    ]},
  ],
};

function memoryJobs() {
  const jobs = [];
  return {
    jobs,
    async latest(key, since) { return jobs.filter(job => job.key === key && job.createdAt >= since).sort((a, b) => b.createdAt - a.createdAt)[0]; },
    async used() { return jobs.reduce((sum, job) => sum + (job.status === 'running' ? 1 : job.records), 0); },
    async start(job) { jobs.push({...job, status: 'running', records: 0}); },
    async finish(snapshotId, status, records, at) { const job = jobs.find(item => item.snapshotId === snapshotId && item.status === 'running'); if (job) Object.assign(job, {status, records, finishedAt: at}); },
  };
}
/** A fake Bright Data API: `readyAfter` progress calls answer "running", then "ready". */
function fakeApi(record, {readyAfter = 1} = {}) {
  const calls = [];
  let progress = 0, snapshots = 0;
  const api = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({path: url.pathname, method: init.method ?? 'GET', auth: init.headers?.Authorization, body: init.body});
    if (url.pathname === '/datasets/v3/trigger') return Response.json({snapshot_id: 'sd_test' + (++snapshots)});
    if (url.pathname.startsWith('/datasets/v3/progress/')) return Response.json(++progress > readyAfter ? {status: 'ready', records: 1, errors: 0} : {status: 'running'});
    if (url.pathname.startsWith('/datasets/v3/snapshot/')) return Response.json([record]);
    return new Response('not found', {status: 404});
  };
  return {api, calls};
}
function runtime(overrides = {}) {
  let clock = Date.UTC(2026, 9, 9, 12);
  return {apiKey: 'test-key', settings: defaultBrightDataSettings(), jobs: memoryJobs(), purpose: 'customer', now: () => clock, sleep: async ms => { clock += ms; }, advance: ms => { clock += ms; }, ...overrides};
}

test('Bright Data handles only exact Walmart product pages and US H&M product pages', () => {
  assert.deepEqual(brightDataTarget(walmartUrl), {store: 'walmart', key: 'walmart:1134943499', url: 'https://www.walmart.com/ip/Crew-Tee-Short-Sleeve/1134943499'});
  assert.equal(brightDataTarget('https://www.walmart.com/ip/1134943499')?.key, 'walmart:1134943499');
  assert.deepEqual(brightDataTarget(hmUrl), {store: 'hm', key: 'hm:1245444006', url: hmUrl});
  for (const other of ['https://www.walmart.com/search?q=tee', 'https://www.walmart.ca/ip/tee/1134943499', 'https://www2.hm.com/de_de/productpage.1245444006.html', 'https://www.target.com/p/-/A-1', 'http://www.walmart.com/ip/x/1134943499'])
    assert.equal(brightDataTarget(other), undefined, other);
});

test('Walmart record keeps exactly the variant from the link with its own price, stock and the regular price', () => {
  const product = mapWalmartRecord(walmartRecord, walmartUrl);
  assert.equal(product.title, walmartRecord.product_name);
  assert.equal(product.brand, 'George');
  assert.equal(product.price, 1.43);
  assert.equal(product.referencePrice, 5.98);
  assert.equal(product.currency, 'USD');
  assert.equal(product.country, 'США');
  assert.equal(product.variantScope, 'item');
  assert.equal(product.variantsComplete, false);
  assert.equal(product.selectedVariantColor, 'Dark Navy');
  assert.equal(product.variants.length, 1);
  assert.equal(product.variants[0].label, 'Dark Navy · XL');
  assert.equal(product.variants[0].available, true);
  assert.equal(product.variants[0].availabilityKnown, true);
  assert.equal(product.variants[0].compareAtPrice, 5.98);
  assert.equal(product.images.length, 2);
  assert.match(product.warnings.join(' '), /своя ссылка/);
  assert.equal(product.method, 'Bright Data · Walmart');
});

test('Walmart marketplace seller and out-of-stock variant are called out', () => {
  const product = mapWalmartRecord({...walmartRecord, seller: 'Gadget Hub LLC', is_available: false, availability: 'out_of_stock', listing_has_variations: false, variant_attributes: []}, walmartUrl);
  assert.equal(product.variants[0].available, false);
  assert.equal(product.variants[0].label, 'Как в ссылке');
  assert.equal(product.variantsComplete, true);
  assert.match(product.warnings.join(' '), /Gadget Hub LLC/);
  assert.match(product.warnings.join(' '), /не в наличии/);
});

test('H&M record offers the sizes of the colour from the link with sale and regular price', () => {
  const product = mapHmRecord(hmRecord, hmUrl);
  assert.equal(product.title, 'Wide Jeans');
  assert.equal(product.price, 43.99);
  assert.equal(product.referencePrice, 54.99);
  assert.equal(product.currency, 'USD');
  assert.equal(product.variantScope, 'color');
  assert.equal(product.variantsComplete, true);
  assert.equal(product.selectedVariantColor, 'Light denim blue');
  assert.equal(product.sku, '1245444006');
  assert.deepEqual(product.variants.map(variant => [variant.label, variant.available, variant.price]), [['Light denim blue · XS', true, 43.99], ['Light denim blue · S', false, 43.99]]);
  assert.equal(product.images.length, 2);
  assert.match(product.warnings.join(' '), /ещё 1 цвет/);
});

test('a fast collection is triggered once, polled and recorded with its billed records', async () => {
  const {api, calls} = fakeApi(walmartRecord, {readyAfter: 2});
  const rt = runtime({api});
  const product = await fetchBrightDataProduct(walmartUrl, rt);
  assert.equal(product.price, 1.43);
  assert.equal(calls.filter(call => call.path === '/datasets/v3/trigger').length, 1);
  const trigger = calls.find(call => call.path === '/datasets/v3/trigger');
  assert.equal(trigger.method, 'POST');
  assert.equal(trigger.auth, 'Bearer test-key');
  assert.deepEqual(JSON.parse(trigger.body), [{url: 'https://www.walmart.com/ip/Crew-Tee-Short-Sleeve/1134943499'}]);
  assert.deepEqual(rt.jobs.jobs.map(job => [job.store, job.status, job.records, job.purpose]), [['walmart', 'ready', 1, 'customer']]);
});

test('a slow collection answers "pending" and the next request polls the same snapshot instead of paying again', async () => {
  const {api, calls} = fakeApi(hmRecord, {readyAfter: 1000});
  const rt = runtime({api});
  await assert.rejects(fetchBrightDataProduct(hmUrl, rt), error => error instanceof BrightDataPendingError && error.store === 'hm' && error.retryAfterMs > 0);
  await assert.rejects(fetchBrightDataProduct(hmUrl, rt), BrightDataPendingError);
  assert.equal(calls.filter(call => call.path === '/datasets/v3/trigger').length, 1);
  assert.equal(rt.jobs.jobs.length, 1);
  assert.equal(rt.jobs.jobs[0].status, 'running');
});

test('a finished collection is reused within reuseMinutes without a new trigger', async () => {
  const {api, calls} = fakeApi(walmartRecord);
  const rt = runtime({api});
  await fetchBrightDataProduct(walmartUrl, rt);
  rt.advance(10 * 60_000);
  const again = await fetchBrightDataProduct(walmartUrl, rt);
  assert.equal(again.title, walmartRecord.product_name);
  assert.equal(calls.filter(call => call.path === '/datasets/v3/trigger').length, 1);
});

test('the monthly limit, a switched-off store and catalog use without the setting skip Bright Data', async () => {
  const {api, calls} = fakeApi(walmartRecord);
  const limited = runtime({api, settings: {...defaultBrightDataSettings(), monthlyRecordLimit: 0}});
  assert.equal(await fetchBrightDataProduct(walmartUrl, limited), undefined);
  const off = runtime({api, settings: {...defaultBrightDataSettings(), stores: {walmart: false, hm: true}}});
  assert.equal(await fetchBrightDataProduct(walmartUrl, off), undefined);
  const catalog = runtime({api, purpose: 'catalog'});
  assert.equal(await fetchBrightDataProduct(walmartUrl, catalog), undefined);
  const noKey = runtime({api, apiKey: ' '});
  assert.equal(await fetchBrightDataProduct(walmartUrl, noKey), undefined);
  assert.equal(calls.length, 0);
});

test('settings fall back to safe defaults on broken JSON', () => {
  assert.deepEqual(parseBrightDataSettings('{broken'), defaultBrightDataSettings());
  assert.equal(parseBrightDataSettings(JSON.stringify({pricePer1kUsd: 2, stores: {walmart: false}})).stores.hm, true);
});

test('fetchProduct turns a running collection into a pending manual-entry error without touching the store page', async () => {
  const {api} = fakeApi(hmRecord, {readyAfter: 1000});
  const rt = runtime({api, settings: {...defaultBrightDataSettings(), waitSeconds: 3}});
  let pageRequests = 0;
  const fetcher = Object.assign(async () => { pageRequests++; return new Response('blocked', {status: 403}); }, {brightData: async () => rt});
  await assert.rejects(fetchProduct(hmUrl, fetcher), error => error instanceof ManualEntryFallbackError && error.reason === 'pending' && error.retryAfterMs > 0 && error.partial?.brand === 'H&M');
  assert.equal(pageRequests, 0);
});

test('fetchProduct returns the Bright Data product when the collection finishes in time', async () => {
  const {api} = fakeApi(walmartRecord);
  const fetcher = Object.assign(async () => new Response('blocked', {status: 403}), {brightData: async () => runtime({api})});
  const product = await fetchProduct(walmartUrl, fetcher);
  assert.equal(product.price, 1.43);
  assert.equal(product.method, 'Bright Data · Walmart');
});

test('paid records start after the monthly free allowance and restart each month', () => {
  const charges = paidRecordsByDay([{day: '2026-10-02', records: 20}, {day: '2026-10-01', records: 4990}, {day: '2026-11-01', records: 30}], 5000, 1.5);
  assert.deepEqual(charges.map(charge => [charge.day, charge.paidRecords, charge.usd]), [['2026-10-01', 0, 0], ['2026-10-02', 10, 0.015], ['2026-11-01', 0, 0]]);
});

test('the books get one software expense per finished paid day, never for today, a closed month or an existing entry', () => {
  const days = [{day: '2026-09-30', records: 6000}, {day: '2026-10-01', records: 4990}, {day: '2026-10-02', records: 1010}, {day: '2026-10-03', records: 1000}, {day: '2026-10-09', records: 500}];
  const settings = {freeRecordsPerMonth: 5000, pricePer1kUsd: 1.5, ledger: true};
  const plan = planBrightDataLedger(days, settings, {today: '2026-10-09', usdRate: 12_700, accounting: {lockedThrough: '2026-09'}, existingIds: new Set([brightDataLedgerPrefix + '2026-10-03']), stores: {'2026-10-02': {Walmart: 1000, 'H&M': 10}}});
  assert.deepEqual(plan.insert.map(entry => [entry.id, entry.kind, entry.amountUzs, entry.originalAmount, entry.originalCurrency, entry.counterparty]), [[brightDataLedgerPrefix + '2026-10-02', 'software', 19_050, 1.5, 'USD', 'Bright Data']]);
  assert.match(plan.insert[0].note, /Walmart 1000, H&M 10/);
  assert.deepEqual(plan.skipped, [{day: '2026-09-30', reason: 'период закрыт'}]);
  assert.deepEqual(planBrightDataLedger(days, {...settings, ledger: false}, {today: '2026-10-09', usdRate: 12_700, accounting: {}, existingIds: new Set()}).insert, []);
});

test('the client asks again while the server answers 202 and gives up with a manual-entry answer', async () => {
  const answers = [Response.json({pending: true, retryAfterMs: 3000, message: 'ждём'}, {status: 202}), Response.json({title: 'Wide Jeans'}, {status: 200})];
  const seen = [];
  const response = await requestImport({url: hmUrl}, {fetcher: async () => answers.shift(), sleep: async () => {}, onPending: pending => seen.push(pending.message)});
  assert.equal(response.status, 200);
  assert.deepEqual(seen, ['ждём']);
  const slow = await requestImport({url: hmUrl}, {fetcher: async () => Response.json({pending: true, message: 'ждём'}, {status: 202}), sleep: async () => {}, maxWaitMs: 0});
  assert.equal(slow.status, 422);
  const body = await slow.json();
  assert.equal(body.manualEntryAvailable, true);
  assert.equal(body.error, 'ждём');
});
