import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogCopy } from '../lib/market/catalog-copy.ts';

// Owner decision of 2 November 2026: the duty-free allowance is shown in the profile only, not as a banner over shopping pages.
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('no allowance banner over the catalog and store pages; its copy and styles are gone', () => {
  const view = source('app/catalog-view.tsx');
  assert.doesNotMatch(view, /CompactBanner|catalog-banner|bannerLimit|allowanceShow/);
  for (const locale of ['ru', 'uz', 'oz', 'en']) for (const key of ['bannerLimit', 'bannerLimitSpent', 'allowanceLeft', 'allowanceSpent', 'allowanceShow', 'allowanceHow'])
    assert.equal(catalogCopy[locale][key], undefined, `${locale} ${key}`);
  for (const css of ['app/styles/catalog-pages.css', 'app/catalog.css']) assert.doesNotMatch(source(css), /\.catalog-banner/, css);
  // The «Без пошлины» filter and the duty lines of the bills are not the banner: they stay.
  assert.match(view, /const dutyHint = allowance && allowance\.usedUsd > 0 \? cc\.dutyMember/);
});

test('the profile keeps the allowance card per recipient', () => {
  const account = source('app/account-views.tsx');
  assert.match(account, /const allowance = monthlyAllowance\(state, pricing\.fx\);/);
  assert.match(account, /<CustomsAllowance groups=\{allowance\}/);
});
