import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCspReport, parseTelemetry, scrubMessage, summarizeVitals, telemetryRoute } from '../lib/market/telemetry.ts';

test('routes are fixed patterns: no query strings, ids or unknown paths', () => {
  assert.equal(telemetryRoute('/'), '/');
  assert.equal(telemetryRoute('/cart/'), '/cart');
  assert.equal(telemetryRoute('/stores?lang=ru'), '/stores');
  assert.equal(telemetryRoute('/order-by-link?url=https://shop.test/p/1#x'), '/order-by-link');
  assert.equal(telemetryRoute('/orders/AT-1234'), 'other');
  assert.equal(telemetryRoute('/some-old-link'), 'other');
});

test('messages lose emails, long numbers and URL parameters', () => {
  const scrubbed = scrubMessage('Failed for ivan@example.uz at https://atlasmarket.uz/cart?token=secret#x, phone +998 90 123 45 67, passport AA1234567');
  assert.doesNotMatch(scrubbed, /ivan@|secret|123 45|1234567/);
  assert.match(scrubbed, /\[email\]/);
  assert.match(scrubbed, /https:\/\/atlasmarket\.uz\/cart(?![?#])/);
  assert.match(scrubbed, /\[number\]/);
  assert.equal(scrubMessage('x'.repeat(400)).length, 300);
});

test('beacons are validated and anonymized', () => {
  const parsed = parseTelemetry({
    route: '/cart?coupon=1',
    errors: [{ kind: 'error', message: 'TypeError: a is undefined for me@mail.uz', source: 'https://atlasmarket.uz/_next/static/chunks/app.js?v=1', line: 12 }],
    vitals: { device: 'mobile', lcpMs: 2100.5, inpMs: 80, cls: 0.02, ttfbMs: 300 },
  });
  assert.equal(parsed.errors[0].route, '/cart');
  assert.match(parsed.errors[0].message, /\[email\]/);
  assert.equal(parsed.errors[0].source, 'https://atlasmarket.uz/_next/static/chunks/app.js');
  assert.deepEqual(parsed.vitals, { route: '/cart', device: 'mobile', lcpMs: 2100.5, inpMs: 80, cls: 0.02, ttfbMs: 300 });
  assert.equal(parseTelemetry({ route: '/', errors: Array.from({ length: 6 }, () => ({ kind: 'error', message: 'x' })) }), null, 'at most five errors');
  assert.equal(parseTelemetry({ route: '/', vitals: { device: 'tv' } }), null);
  assert.equal(parseTelemetry({ route: '/', vitals: { device: 'desktop', lcpMs: -1 } }), null);
  assert.equal(parseTelemetry('nonsense'), null);
  assert.deepEqual(parseTelemetry({ route: '/' }), { errors: [] });
});

test('CSP reports keep the directive, the blocked origin and the route only', () => {
  const report = parseCspReport({ 'csp-report': { 'document-uri': 'https://atlasmarket.uz/cart?x=1', 'effective-directive': 'img-src', 'blocked-uri': 'https://tracker.example/pixel.gif?id=42', 'source-file': 'https://atlasmarket.uz/_next/x.js?y=2' } });
  assert.deepEqual(report, { message: 'CSP img-src: https://tracker.example', route: '/cart', source: 'https://atlasmarket.uz/_next/x.js' });
  assert.equal(parseCspReport({ 'csp-report': { 'violated-directive': 'script-src-elem', 'document-uri': 'https://atlasmarket.uz/', 'blocked-uri': 'inline' } }).message, 'CSP script-src-elem: inline');
  assert.equal(parseCspReport({ nothing: true }), null);
});

test('field speed is summarized as p75 per route, busiest first', () => {
  const row = (route, device, lcp, inp = null) => ({ route, device, ttfb_ms: 200, fcp_ms: 900, lcp_ms: lcp, inp_ms: inp, cls: 0.01 });
  const summary = summarizeVitals([row('/', 'mobile', 1000), row('/', 'mobile', 2000), row('/', 'desktop', 3000), row('/', 'mobile', 4000, 120), row('/cart', 'desktop', 1500)]);
  assert.deepEqual(summary.map((item) => item.route), ['/', '/cart']);
  assert.equal(summary[0].samples, 4);
  assert.equal(summary[0].mobileShare, 75);
  assert.equal(summary[0].lcpMs, 3000);
  assert.equal(summary[0].inpMs, 120);
  assert.equal(summary[1].inpMs, undefined);
});
