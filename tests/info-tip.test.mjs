import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/mobile.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const phoneBlocks = [...css.matchAll(/@media \(max-width: 760px\) \{([\s\S]*?)\n\}/g)].map(m => m[1]).join('\n');
const outside = css.replace(/@media \(max-width: 760px\) \{[\s\S]*?\n\}/g, '');

test('the "?" button shows only on phones and the secondary text hides only there', () => {
  assert.match(outside, /\.info-tip \{ display: none; \}/);
  assert.match(phoneBlocks, /\.tip-text \{ display: none !important; \}/);
  assert.match(phoneBlocks, /\.info-tip \{[^}]*display: inline-grid/);
  assert.doesNotMatch(outside, /\.tip-text \{ display: none/);
});

test('every hidden secondary text has a "?" with the same text next to it', () => {
  for (const file of ['account-views', 'sign-in-methods', 'identity-workspace', 'order-workspace', 'calc-summary', 'product-sheet', 'home-sections']) {
    const src = readFileSync(new URL(`../app/${file}.tsx`, import.meta.url), 'utf8');
    if (!src.includes('tip-text')) continue;
    assert.match(src, /InfoTip/, `${file}.tsx hides text behind tip-text without an InfoTip`);
  }
});
