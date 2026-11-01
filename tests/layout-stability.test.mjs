import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkoutCopy } from '../lib/market/checkout-copy.ts';

// Owner decisions of 2 November 2026: the last layout shifts (checkout on phones ~0.08, admin at 1440 px ~0.15).
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('checkout: the price check keeps one fixed row from the first paint to the answer, nothing below it moves', () => {
  const view = source('app/checkout-view.tsx');
  // The row stands while there is anything to check, whatever the state: running, done or failed.
  assert.match(view, /\{signedIn && \(lines\.length > 0 \|\| merging \|\| waitingGuest\) && \(check === "failed"/);
  assert.match(view, /<p className=\{"co-checking" \+ \(check === "done" && !merging && !waitingGuest \? " is-done" : ""\)\} role="status">/);
  assert.match(view, /<p className="co-checking co-notice warn" role="alert">/);
  const css = source('app/checkout.css');
  assert.match(css, /\.co-checking \{[^}]*height: 44px;[^}]*overflow: hidden;/);
  assert.doesNotMatch(css, /co-checking-late/, 'the line no longer appears late and vanishes again');
  for (const locale of ['ru', 'uz', 'oz', 'en']) {
    const check = checkoutCopy[locale].checkout.check;
    assert.ok(check.done && check.done !== check.running, locale);
    assert.ok(check.done.length <= 40 && check.running.length <= 40, `${locale}: one line at 390 px`);
  }
});

test('admin: the loading box is a screen tall, so the footer does not jump when the tables arrive', () => {
  assert.match(source('app/admin-view.tsx'), /if\(!data\)return <section className="surface admin-loading" role="status">/);
  assert.match(source('app/styles/operator.css'), /\.admin-loading \{ min-height: 100vh; min-height: 100dvh; \}/);
});
