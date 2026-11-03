import test from 'node:test';
import assert from 'node:assert/strict';
import { products, blank, addToCart, cartSignature, checkoutCart } from '../lib/market/domain.ts';
import { actionSchema } from '../lib/market/actions.ts';
import { customsVersion } from '../lib/market/world.ts';
import nextConfig from '../next.config.ts';
import { applyCspRollback, contentSecurityPolicy, cspReportOnly, reportOnlyContentSecurityPolicy, rollbackContentSecurityPolicy } from '../lib/security/csp.ts';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

test('no customer action replaces the whole account document', () => {
  const forged = { ...blank(), entries: [{ id: 'x', orderId: 'AT-X', at: 1, amount: 50_000_000, debit: 'atlas-cash', credit: 'customer-credit', description: 'forged' }] };
  assert.equal(actionSchema.safeParse({ type: 'import-legacy', data: JSON.stringify(forged) }).success, false);
});

test('new order numbers carry 48 random bits', () => {
  let s = addToCart(blank(), products[0], 'US 9', 1000);
  s = checkoutCart(s, 'purchase-1', cartSignature(s.cart), false, 1001, customsVersion);
  assert.match(s.orders[0].id, /^AT-[0-9A-F]{12}$/);
});

test('every response enforces the CSP and refuses to be framed', async () => {
  const rules = await nextConfig.headers();
  assert.ok(rules.length >= 2);
  assert.deepEqual(rules.map((rule) => rule.source), ['/', '/:path*'], 'vinext /:path* misses the bare /');
  for (const rule of rules) {
    const headers = new Map(rule.headers.map(({ key, value }) => [key, value]));
    assert.equal(headers.get('X-Frame-Options'), 'DENY', rule.source);
    assert.equal(headers.get('Content-Security-Policy'), contentSecurityPolicy, rule.source);
    assert.equal(headers.has('Content-Security-Policy-Report-Only'), false, rule.source);
  }
});

test('the CSP lists exactly the sources Atlas pages use', () => {
  const directives = new Map(contentSecurityPolicy.split('; ').map((part) => { const [name, ...values] = part.split(' '); return [name, values]; }));
  assert.deepEqual(directives.get('default-src'), ["'self'"]);
  // Inline scripts: vinext's streamed RSC payload and the layout bootstraps (no nonces yet). Never eval.
  assert.deepEqual(directives.get('script-src'), ["'self'", "'unsafe-inline'", 'https://telegram.org', 'https://utt.impactcdn.com', 'https://*.impactradius-event.com']);
  assert.ok(!contentSecurityPolicy.includes("'unsafe-eval'"));
  // Merchant photos are hotlinked from many stores: any HTTPS image, never plain http.
  assert.deepEqual(directives.get('img-src'), ["'self'", 'data:', 'blob:', 'https:']);
  assert.deepEqual(directives.get('connect-src'), ["'self'", 'https://utt.impactcdn.com', 'https://*.impactradius-event.com']);
  assert.deepEqual(directives.get('frame-src'), ['https://oauth.telegram.org']);
  assert.deepEqual(directives.get('frame-ancestors'), ["'none'"]);
  assert.deepEqual(directives.get('form-action'), ["'self'", 'https://accounts.google.com', 'https://appleid.apple.com', 'https://oauth.telegram.org']);
  assert.deepEqual(directives.get('object-src'), ["'none'"]);
  assert.deepEqual(directives.get('base-uri'), ["'self'"]);
  assert.deepEqual(directives.get('report-uri'), ['/api/telemetry'], 'violations reach the operator error log');
  // Only images may use a bare scheme or a wildcard host beyond Impact's event hosts.
  for (const [name, values] of directives) for (const value of values) {
    if (value === 'https:' || value === 'http:' || value === '*') assert.equal(name, 'img-src', `${name} ${value}`);
    if (value.includes('*.')) assert.equal(value, 'https://*.impactradius-event.com', `${name} ${value}`);
  }
  // No other directive (a new worker-src, media-src … must be a deliberate change of this test).
  assert.deepEqual([...directives.keys()], ['default-src', 'script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'frame-src', 'frame-ancestors', 'form-action', 'base-uri', 'object-src', 'report-uri']);
});

test('the passport OCR stays unused while the CSP blocks WebAssembly', () => {
  // tesseract.js compiles WebAssembly in a blob: worker: both are blocked by the policy (lib/security/csp.ts).
  const root = new URL('../', import.meta.url);
  const users = [];
  for (const dir of ['app', 'lib', 'components', 'hooks'].filter((d) => existsSync(new URL(d + '/', root)))) {
    for (const file of readdirSync(new URL(dir + '/', root), { recursive: true })) {
      const path = dir + '/' + file.replace(/\\/g, '/');
      if (!/\.(ts|tsx)$/.test(path) || path === 'app/passport-ocr.ts') continue;
      // Imports only (static or lazy), not comments that name the module.
      if (/(?:from\s*|import\(\s*)['"][^'"]*(?:passport-ocr|tesseract\.js)['"]/.test(readFileSync(new URL(path, root), 'utf8'))) users.push(path);
    }
  }
  if (users.length) assert.match(contentSecurityPolicy, /'wasm-unsafe-eval'/, `OCR is used by ${users.join(', ')}: allow WebAssembly and its worker in the CSP`);
});

test('ATLAS_CSP_REPORT_ONLY rolls pages back to report-only at request time', () => {
  // environment.json is JSON: `"1"`, `1` and `true` all mean the same to the operator who writes it in an emergency.
  for (const on of ['1', 'true', 'TRUE', ' yes ', true, 1]) assert.equal(cspReportOnly(on), true, String(on));
  for (const off of [undefined, null, '', '0', 'false', 'no', 0, 2, false, {}]) assert.equal(cspReportOnly(off), false, String(off));
  const headers = new Headers();
  applyCspRollback(headers);
  // The same policy, only its reports are marked: WebKit sends no `disposition` (lib/market/telemetry.ts).
  assert.equal(headers.get('Content-Security-Policy-Report-Only'), reportOnlyContentSecurityPolicy);
  assert.equal(reportOnlyContentSecurityPolicy, contentSecurityPolicy.replace('report-uri /api/telemetry', 'report-uri /api/telemetry?csp=report-only'));
  // What stays enforced cannot break a page, and having the header stops vinext adding the build-time one.
  assert.equal(headers.get('Content-Security-Policy'), rollbackContentSecurityPolicy);
  assert.equal(rollbackContentSecurityPolicy, "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; report-uri /api/telemetry");
  const middleware = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
  assert.match(middleware, /return cspMode\(route\(request\)\);/, 'every middleware answer, redirects included, goes through the switch');
  assert.match(middleware, /cspReportOnly\(\(env as \{ ATLAS_CSP_REPORT_ONLY\?: unknown \}\)\.ATLAS_CSP_REPORT_ONLY\)/);
});
