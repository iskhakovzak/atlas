import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isStaleChunkError, loadChunk, reloadForStaleBuild, staleBuildReloadAllowed, staleBuildReloadPauseMs, staleBuildStorageKey } from '../lib/market/stale-build.ts';

const chrome = new TypeError('Failed to fetch dynamically imported module: https://atlas.example/_next/static/chunks/product-sheet-Abc123.js');

test('stale chunk errors are recognised in every browser, other errors are not', () => {
  assert.equal(isStaleChunkError(chrome), true);
  assert.equal(isStaleChunkError(new TypeError('error loading dynamically imported module: https://atlas.example/a.js')), true);
  assert.equal(isStaleChunkError(new TypeError('Importing a module script failed.')), true);
  assert.equal(isStaleChunkError(new Error('Unable to preload CSS for /_next/static/css/sheet.css')), true);
  assert.equal(isStaleChunkError('Uncaught TypeError: Failed to fetch dynamically imported module: /x.js'), true);
  assert.equal(isStaleChunkError(new TypeError('Failed to fetch')), false);
  assert.equal(isStaleChunkError(new Error('err_12')), false);
  assert.equal(isStaleChunkError(undefined), false);
});

test('a reload is allowed once per pause, so a server outage does not loop', () => {
  const now = 1_000_000;
  assert.equal(staleBuildReloadAllowed(null, now), true);
  assert.equal(staleBuildReloadAllowed('garbage', now), true);
  assert.equal(staleBuildReloadAllowed(String(now - 5_000), now), false);
  assert.equal(staleBuildReloadAllowed(String(now - staleBuildReloadPauseMs), now), true);
  assert.equal(staleBuildReloadAllowed(String(now + 5_000), now), true);
});

function fakeWindow() {
  const store = new Map();
  const win = { reloads: 0, location: { reload() { win.reloads++; } }, sessionStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) } };
  return win;
}

test('the first stale chunk reloads the page, a second one right after leaves the error visible', async (t) => {
  const win = fakeWindow();
  globalThis.window = win;
  t.after(() => { delete globalThis.window; });
  assert.equal(reloadForStaleBuild(new Error('err_12')), false);
  assert.equal(reloadForStaleBuild(chrome), true);
  assert.equal(win.reloads, 1);
  assert.ok(win.sessionStorage.getItem(staleBuildStorageKey));
  assert.equal(reloadForStaleBuild(chrome), false);
  assert.equal(win.reloads, 1);
  await assert.rejects(loadChunk(() => Promise.reject(chrome)), chrome);
  await assert.rejects(loadChunk(() => Promise.reject(new Error('boom'))), /boom/);
  assert.equal(await loadChunk(() => Promise.resolve(7)), 7);
});

test('a stale chunk keeps the lazy part pending while the page reloads', async (t) => {
  const win = fakeWindow();
  globalThis.window = win;
  t.after(() => { delete globalThis.window; });
  const outcome = await Promise.race([loadChunk(() => Promise.reject(chrome)).then(() => 'resolved', () => 'rejected'), new Promise((resolve) => setTimeout(() => resolve('pending'), 20))]);
  assert.equal(outcome, 'pending');
  assert.equal(win.reloads, 1);
});

test('lazy parts and the layout use the stale build guard; preloads never reload', () => {
  for (const file of ['app/product-sheet-lazy.tsx', 'app/notifications-panel.tsx', 'app/home-catalog.tsx', 'app/marketplace.tsx']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /lazy\(\(\)=>loadChunk\(/, file);
    assert.doesNotMatch(source, /void load\(\)/, file);
  }
  assert.match(readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8'), /<StaleBuildReload \/>/);
});
