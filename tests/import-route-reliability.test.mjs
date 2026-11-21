import test from 'node:test';
import assert from 'node:assert/strict';
import {routeHarness} from './support/route-harness.mjs';
import {createImportFlights, freshRetryGapMs} from '../lib/importer/import-flight.ts';
import {ManualEntryFallbackError} from '../lib/importer/fetch.ts';
import {EbayListingUnavailableError} from '../lib/importer/ebay.ts';

const importPath = 'app/api/import/route.ts';
const shopperImport = (h, POST, body) => h.call(POST, {method: 'POST', url: '/api/import', body});

function mockMerchant(t, link) {
  const source = new URL(link);
  const handle = source.pathname.split('/').at(-1);
  const page = '<html><head><meta property="og:title" content="Import reliability fixture"><script src="https://cdn.shopify.com/s/files/theme.js"></script><script>Shopify.shop = "hoka-us.myshopify.com"; Shopify.currency = {"active":"USD","rate":"1.0"};</script></head></html>';
  const requested = [];
  t.mock.method(globalThis, 'fetch', async input => {
    const url = input instanceof Request ? input.url : String(input);
    requested.push(url);
    if (url === link + '.js') {
      return Response.json({
        handle,
        title: 'Import reliability fixture',
        vendor: 'HOKA',
        options: [{name: 'Size'}],
        images: ['//cdn.shopify.com/example.jpg'],
        variants: [{id: 1, title: '8', option1: '8', price: 4200, available: true}],
      });
    }
    assert.equal(url, link);
    return new Response(page, {headers: {'Content-Type': 'text/html'}});
  });
  return requested;
}

test('a valid live merchant snapshot still reaches the customer if its cache write fails', async t => {
  const h = routeHarness(), {POST} = await h.route(importPath);
  t.after(() => h.db.sqlite.close());
  t.mock.method(console, 'error', () => {});
  const url = 'https://www.hoka.com/products/cache-write-regression';
  const requested = mockMerchant(t, url);
  h.db.sqlite.exec(`CREATE TRIGGER reject_import_cache_write BEFORE INSERT ON market_import_cache
    BEGIN SELECT RAISE(ABORT, 'fixture cache unavailable'); END;`);

  const response = await shopperImport(h, POST, {url, fresh: true});
  assert.equal(response.status, 200);
  const product = await response.json();
  assert.equal(product.title, 'Import reliability fixture');
  assert.equal(product.price, 42);
  assert.equal(product.cached, false);
  assert.match(response.headers.get('server-timing') ?? '', /merchant;dur=\d+/);
  assert.equal(h.db.sqlite.prepare('SELECT count(*) AS count FROM market_import_cache').get().count, 0);
  assert.deepEqual(requested, [url, url + '.js']);
  await h.settle();
});

test('an unavailable cache is a miss for previews and ordinary imports', async t => {
  const h = routeHarness(), {POST} = await h.route(importPath);
  t.after(() => h.db.sqlite.close());
  t.mock.method(console, 'error', () => {});
  const url = 'https://www.hoka.com/products/cache-read-regression';
  const requested = mockMerchant(t, url);
  h.db.sqlite.exec('DROP TABLE market_import_cache');

  const preview = await shopperImport(h, POST, {url, cacheOnly: true});
  assert.equal(preview.status, 204);
  assert.deepEqual(requested, []);

  const response = await shopperImport(h, POST, {url});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).cached, false);
  assert.deepEqual(requested, [url, url + '.js']);
  await h.settle();
});

test('cache cleanup cannot delay a verified response or its cart snapshot', {timeout: 3000}, async t => {
  const h = routeHarness(), {POST} = await h.route(importPath);
  t.after(() => h.db.sqlite.close());
  const url = 'https://www.hoka.com/products/cache-cleanup-regression';
  mockMerchant(t, url);
  const originalPrepare = h.db.prepare;
  let release, notifyStarted, cleanupStarted = false;
  const cleanup = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { notifyStarted = resolve; });
  h.db.prepare = sql => {
    const statement = originalPrepare(sql);
    if (!/^DELETE FROM market_import_cache/.test(sql)) return statement;
    const bind = statement.bind;
    return {...statement, bind: (...args) => {
      const bound = bind(...args);
      return {...bound, run: async () => {
        cleanupStarted = true;
        notifyStarted();
        await cleanup;
        return bound.run();
      }};
    }};
  };
  try {
    const result = await shopperImport(h, POST, {url, fresh: true});
    assert.equal(result.status, 200);
    assert.equal(cleanupStarted, false, 'the slow cleanup begins after the response');
    const cached = h.db.sqlite.prepare('SELECT payload FROM market_import_cache WHERE url=?').get(url);
    assert.equal(JSON.parse(cached.payload).price, 42);
    await started;
  } finally {
    release();
    await h.settle();
  }
});

test('a successful fresh import clears the wall and a superseded failure cannot restore it', async () => {
  let now = 1000;
  const flights = createImportFlights({clock: () => now});
  const blocked = () => new ManualEntryFallbackError(undefined, undefined, 'blocked');
  const loadProduct = async () => ({sourceUrl: 'page', price: 42, warnings: []});
  await flights.run('page', async () => { throw blocked(); });
  now += freshRetryGapMs;
  assert.equal(flights.recentFailure('page')?.reason, 'blocked');
  assert.equal(flights.recentFailure('page', freshRetryGapMs), undefined);
  await flights.run('page', loadProduct);
  assert.equal(flights.recentFailure('page'), undefined);

  let rejectDelayed;
  const delayed = flights.run('page', () => new Promise((_resolve, reject) => { rejectDelayed = reject; }));
  now += 26_000;
  await flights.run('page', loadProduct);
  rejectDelayed(blocked());
  await delayed;
  assert.equal(flights.recentFailure('page'), undefined);
});

test('simultaneous imports share the store answer for an unavailable eBay listing', async () => {
  const flights = createImportFlights();
  const unavailable = new EbayListingUnavailableError(undefined, 'item_data', 404);
  let calls = 0;
  const load = async () => { calls++; throw unavailable; };
  const answers = await Promise.all([flights.run('listing', load), flights.run('listing', load)]);
  assert.equal(calls, 1);
  assert.deepEqual(answers.map(answer => answer.leader), [true, false]);
  assert.deepEqual(answers.map(answer => answer.outcome), [
    {ok: false, error: unavailable},
    {ok: false, error: unavailable},
  ]);
});
