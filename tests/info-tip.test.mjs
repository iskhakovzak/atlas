import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/mobile.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const phoneBlocks = [...css.matchAll(/@media \(max-width: 760px\) \{([\s\S]*?)\n\}/g)].map(m => m[1]).join('\n');
const outside = css.replace(/@media \(max-width: 760px\) \{[\s\S]*?\n\}/g, '');

test('the "?" shows on phones and in the crowded panels; the text hides only where the "?" shows', () => {
  assert.match(outside, /^\.info-tip \{[^}]*display: none;/m);
  assert.ok(phoneBlocks.includes('.tip-text { display: none !important; }'));
  assert.ok(phoneBlocks.includes('.info-tip { display: inline-grid; }'));
  assert.ok(outside.includes(':is(.product-sheet, .basket-summary) .info-tip { display: inline-grid; }'));
  assert.ok(outside.includes(':is(.product-sheet, .basket-summary) .tip-text { display: none !important; }'));
  assert.doesNotMatch(outside, /^\.tip-text \{ display: none/m);
});

test('every hidden secondary text has a "?" with the same text next to it', () => {
  for (const file of ['account-views', 'sign-in-methods', 'identity-workspace', 'order-workspace', 'calc-summary', 'product-sheet', 'home-sections', 'shopping']) {
    const src = readFileSync(new URL(`../app/${file}.tsx`, import.meta.url), 'utf8');
    if (!src.includes('tip-text')) continue;
    assert.match(src, /InfoTip/, `${file}.tsx hides text behind tip-text without an InfoTip`);
  }
});
