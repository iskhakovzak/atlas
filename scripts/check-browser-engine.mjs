#!/usr/bin/env node
/**
 * Does the `browser` engine (deploy/upcloud/browser-engine.mjs) read product pages from this machine's address?
 * Opens each link in the installed Chrome through the proxy's engine ladder, then runs the importer on the answer.
 * Prints the store host, the result and the time only — no links, no page text.
 *
 *   ATLAS_BROWSER_EXECUTABLE=/usr/bin/google-chrome-stable \
 *     node --experimental-strip-types scripts/check-browser-engine.mjs <product-url>...
 *
 * On a server without a screen run it under `xvfb-run -a`. MODE=auto tries fetch and impersonate first (as the
 * gateway does); MODE=browser goes straight to Chrome. The Chrome profile is a fresh folder in the temp directory.
 */
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadBrowserEngine} from '../deploy/upcloud/browser-engine.mjs';
import {createLocalEngineFetch} from '../deploy/upcloud/merchant-engines.mjs';
import {fetchProduct} from '../lib/importer/fetch.ts';

const urls = process.argv.slice(2);
if (!urls.length) throw new Error('Pass one or more product links.');
const executable = process.env.ATLAS_BROWSER_EXECUTABLE;
if (!executable) throw new Error('Set ATLAS_BROWSER_EXECUTABLE to the installed Chrome.');
const profileDir = mkdtempSync(join(tmpdir(), 'atlas-browser-check-'));
const port = Number(process.env.ATLAS_BROWSER_PORT ?? 9349);
const browser = loadBrowserEngine({executable, profileDir, port, allowedHosts: new Set(urls.map(url => new URL(url).hostname.toLowerCase()))});
if (!browser) throw new Error('Chrome was not found at ATLAS_BROWSER_EXECUTABLE.');
const engines = await createLocalEngineFetch({mode: process.env.MODE === 'auto' ? 'auto' : 'browser', browser});
let attempts = '';
const fetcher = async (input, init) => {
  const response = await engines(input, init);
  attempts = response.headers.get('x-atlas-attempts') ?? attempts;
  return response;
};

for (const url of urls) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const started = Date.now();
  attempts = '';
  try {
    const product = await fetchProduct(url, fetcher);
    const variants = product.variants?.length ?? 0;
    console.log(`OK    ${host}  ${Date.now() - started} ms  price ${product.price ?? '—'} ${product.currency ?? ''}  variants ${variants}  ${attempts}`);
  } catch (error) {
    const reason = error?.reason ?? error?.name ?? 'error';
    const vendor = error?.diagnostic?.vendor ? ` ${error.diagnostic.vendor}` : '';
    console.log(`FAIL  ${host}  ${Date.now() - started} ms  ${reason}${vendor}  ${attempts}`);
  }
}
// Close the Chrome this check started (DevTools Browser.close), then drop its profile.
try {
  const {webSocketDebuggerUrl} = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise(resolve => { socket.onopen = () => { socket.send(JSON.stringify({id: 1, method: 'Browser.close'})); setTimeout(resolve, 1500); }; socket.onerror = resolve; });
} catch { /* Chrome never started */ }
try { rmSync(profileDir, {recursive: true, force: true, maxRetries: 10, retryDelay: 300}); } catch { /* Chrome still holds a file on Windows: the temp folder stays */ }
process.exit(0);
