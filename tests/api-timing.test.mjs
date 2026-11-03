import assert from 'node:assert/strict';
import test from 'node:test';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {apiTimings, createApiTimings, percentile, timeRouteHandler} from '../lib/market/api-timing.ts';
import {apiRoutePattern, wrapRouteHandlers} from '../build/api-timing-plugin.ts';

const minute = 60_000;
const start = Date.UTC(2026, 10, 3, 10, 0, 0);

test('percentile is nearest-rank over an ascending list', () => {
  const values = Array.from({length: 100}, (_, index) => index + 1);
  assert.equal(percentile(values, 0.5), 50);
  assert.equal(percentile(values, 0.95), 95);
  assert.equal(percentile([7], 0.95), 7);
  assert.equal(percentile([], 0.5), 0);
});

test('summary per method and route: exact count, 5xx and max; p50/p95 from samples', () => {
  const timings = createApiTimings({now: start});
  for (let index = 1; index <= 20; index++) timings.record('GET', '/api/account', index, 200, start + index);
  timings.record('GET', '/api/account', 900, 503, start + 30);
  timings.record('POST', '/api/account', 4, 200, start + 31);
  const {routes, since, windowMs} = timings.summary(start + 40);
  assert.equal(since, start);
  assert.equal(windowMs, 60 * minute);
  const get = routes.find(row => row.method === 'GET');
  assert.deepEqual(get, {route: '/api/account', method: 'GET', count: 21, errors: 1, p50: 11, p95: 20, max: 900, sampled: 21});
  assert.equal(routes.find(row => row.method === 'POST').count, 1);
  // Slowest p95 first.
  assert.equal(routes[0].method, 'GET');
});

test('the window rolls: old minutes and old samples drop out', () => {
  const timings = createApiTimings({windowMs: 5 * minute, now: start});
  timings.record('GET', '/api/catalog', 500, 200, start);
  timings.record('GET', '/api/catalog', 10, 200, start + 4 * minute);
  let [row] = timings.summary(start + 4 * minute).routes;
  assert.equal(row.count, 2);
  assert.equal(row.max, 500);
  [row] = timings.summary(start + 6 * minute).routes;
  assert.equal(row.count, 1);
  assert.equal(row.max, 10);
  assert.equal(row.p95, 10);
  assert.deepEqual(timings.summary(start + 20 * minute).routes, []);
  // A reused bucket slot starts from zero instead of adding to the minute it replaced.
  timings.record('GET', '/api/catalog', 3, 200, start + 20 * minute);
  [row] = timings.summary(start + 20 * minute).routes;
  assert.equal(row.count, 1);
  assert.equal(row.max, 3);
});

test('the sample ring keeps the latest values; the count stays exact', () => {
  const timings = createApiTimings({samples: 8, now: start});
  for (let index = 0; index < 100; index++) timings.record('POST', '/api/import', index < 92 ? 1000 : 1, 200, start + index);
  const [row] = timings.summary(start + 200).routes;
  assert.equal(row.count, 100);
  assert.equal(row.sampled, 8);
  assert.equal(row.p95, 1);
  assert.equal(row.max, 1000);
});

test('invalid durations are ignored and the number of series is capped', () => {
  const timings = createApiTimings({maxSeries: 2, now: start});
  timings.record('GET', '/api/a', Number.NaN, 200, start);
  timings.record('GET', '/api/a', -1, 200, start);
  timings.record('GET', '/api/a', 1, 200, start);
  timings.record('GET', '/api/b', 1, 200, start);
  timings.record('GET', '/api/c', 1, 200, start);
  assert.deepEqual(timings.summary(start).routes.map(row => [row.route, row.count]), [['/api/a', 1], ['/api/b', 1]]);
});

test('timeRouteHandler records status, thrown errors and redirects into the process aggregator', async () => {
  const route = '/api/test-' + Math.random().toString(36).slice(2);
  const ok = timeRouteHandler(route, 'GET', async () => new Response('ok', {status: 201}));
  assert.equal((await ok()).status, 201);
  const broken = timeRouteHandler(route, 'POST', async () => { throw new Error('boom'); });
  await assert.rejects(broken(), /boom/);
  const redirect = timeRouteHandler(route, 'DELETE', () => { throw Object.assign(new Error('NEXT_REDIRECT'), {digest: 'NEXT_REDIRECT;replace;/;307;'}); });
  await assert.rejects(redirect());
  const rows = apiTimings().summary().routes.filter(row => row.route === route);
  assert.deepEqual(rows.map(row => [row.method, row.count, row.errors]).sort(), [['DELETE', 1, 0], ['GET', 1, 0], ['POST', 1, 1]]);
});

test('route pattern comes from the file path, never from a request', () => {
  assert.equal(apiRoutePattern('C:/Users/WS/Desktop/atlas-r7/app/api/import/route.ts'), '/api/import');
  assert.equal(apiRoutePattern('C:\\srv\\app\\api\\auth\\google\\callback\\route.ts?v=1'), '/api/auth/google/callback');
  assert.equal(apiRoutePattern('/app/app/api/orders/[id]/route.ts'), '/api/orders/[id]');
  assert.equal(apiRoutePattern('/srv/atlas/app/(shop)/api/x/route.ts'), null);
  assert.equal(apiRoutePattern('/srv/atlas/app/api/(internal)/x/route.ts'), '/api/x');
  assert.equal(apiRoutePattern('/srv/atlas/app/catalog/page.tsx'), null);
  assert.equal(apiRoutePattern('/srv/atlas/lib/api/route.ts'), null);
});

test('the transform wraps each exported method once and leaves the rest of the module in place', () => {
  const code = 'import x from "y";\nexport async function GET(request) { return x(request); }\nexport function POST() {}\nfunction PUT() {}\nexport const config = 1;\n';
  const wrapped = wrapRouteHandlers(code, '/srv/atlas/app/api/promo/route.ts');
  assert.ok(wrapped.startsWith(code));
  assert.match(wrapped, /GET = __atlasTimeRoute\("\/api\/promo", "GET", GET\);/);
  assert.match(wrapped, /POST = __atlasTimeRoute\("\/api\/promo", "POST", POST\);/);
  assert.doesNotMatch(wrapped, /PUT = /);
  assert.equal(wrapRouteHandlers(code, '/srv/atlas/app/catalog/page.tsx'), null);
  assert.equal(wrapRouteHandlers('export const x = 1;', '/srv/atlas/app/api/promo/route.ts'), null);
});

test('every API route file exports its handlers in the form the transform wraps', () => {
  const root = path.resolve('app/api');
  const routes = readdirSync(root, {recursive: true}).map(String).filter(file => /(^|[\\/])route\.ts$/.test(file));
  assert.ok(routes.length > 20);
  for (const file of routes) {
    const code = readFileSync(path.join(root, file), 'utf8');
    const declared = [...code.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/gm)].map(match => match[1]);
    assert.ok(declared.length, file + ' exports no handler');
    const wrapped = wrapRouteHandlers(code, path.join(root, file));
    for (const method of declared) assert.match(wrapped ?? '', new RegExp(`^${method} = __atlasTimeRoute\\(`, 'm'), `${file}: ${method} is not timed`);
  }
});
