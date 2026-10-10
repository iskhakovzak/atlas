/**
 * The `browser` engine: the merchant page opened in the machine's own installed
 * Chrome, the way a person on that computer would open it.
 *
 * Some stores (Sephora, H&M, Macy's, New Balance, Levi's) refuse every server
 * client — Node, a Chrome TLS fingerprint, headless Chrome — yet serve the page
 * to an ordinary desktop browser. This engine starts the installed Chrome once,
 * in a normal (not headless) window placed off-screen, with its own profile, and
 * drives it over the DevTools protocol on 127.0.0.1. Every request opens one tab,
 * waits for the product data, hands back the store's own response and closes the
 * tab. No stealth patches, no CAPTCHA solving: a store that still shows a wall
 * gets that wall back and the importer falls back to manual entry.
 *
 * Only for a gateway on a desktop with Chrome (the Tashkent gateway): it is off
 * unless ATLAS_BROWSER_EXECUTABLE points at chrome.exe.
 */
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync} from 'node:fs';
import {blockedSignal} from './merchant-engines.mjs';

const maxBodyBytes = 6_000_000;
// Product data the importer reads. The store's own response is returned as-is when it already carries it:
// a state blob (Sephora's linkStore, Next.js data) or structured product data with a price.
const productState = /id=["'](?:linkStore|__NEXT_DATA__)["']/i;
const productData = /"@type"\s*:\s*"(?:Product|ProductGroup)"/i;
const priced = /"price"\s*:/i;
const carriesProduct = text => productState.test(text) || productData.test(text) && priced.test(text);
// Stores that add their product data with scripts (Levi's, New Balance): the page as the browser drew it, once it has it.
const renderedProduct = `(() => {
  const data = [...document.querySelectorAll('script[type="application/ld+json"]')].some(node => /"@type"\\s*:\\s*"(?:Product|ProductGroup)"/.test(node.textContent) && /"price"/.test(node.textContent));
  return data ? '<!DOCTYPE html>' + document.documentElement.outerHTML : '';
})()`;
// Pictures, fonts and video are not read; leaving them out makes a page load in a fraction of the time.
const skippedResources = ['*.jpg', '*.jpeg', '*.png', '*.gif', '*.webp', '*.avif', '*.svg', '*.ico', '*.woff', '*.woff2', '*.ttf', '*.otf', '*.mp4', '*.webm', '*.m3u8'];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** One DevTools WebSocket session to a page target. */
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('devtools_connect')); });
  let id = 0;
  const pending = new Map(), listeners = new Set();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); return; }
    for (const listener of listeners) listener(message);
  };
  ws.onclose = () => { for (const resolve of pending.values()) resolve({error: {message: 'closed'}}); pending.clear(); };
  return {
    send(method, params = {}) {
      return new Promise(resolve => { const key = ++id; pending.set(key, resolve); ws.send(JSON.stringify({id: key, method, params})); });
    },
    on(listener) { listeners.add(listener); },
    close() { try { ws.close(); } catch { /* already closed */ } },
  };
}

/**
 * Returns the engine function, or `undefined` when no Chrome is configured.
 * `allowedHosts` is the gateway's store allowlist: a page that ends up on any
 * other host is not returned.
 */
export function loadBrowserEngine({
  executable = process.env.ATLAS_BROWSER_EXECUTABLE,
  profileDir = process.env.ATLAS_BROWSER_PROFILE,
  port = Number(process.env.ATLAS_BROWSER_PORT ?? 9339),
  maxTabs = 3,
  allowedHosts,
  spawnProcess = spawn,
  log = () => {},
} = {}) {
  if (!executable || !existsSync(executable)) return undefined;
  if (!profileDir) throw new Error('ATLAS_BROWSER_PROFILE must name a dedicated Chrome profile folder.');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('ATLAS_BROWSER_PORT is invalid.');
  mkdirSync(profileDir, {recursive: true});
  const devtools = `http://127.0.0.1:${port}`;
  let child, starting;
  let active = 0;
  const waiting = [];

  async function alive() {
    try { return (await fetch(`${devtools}/json/version`, {signal: AbortSignal.timeout(800)})).ok; } catch { return false; }
  }

  async function ensureChrome() {
    if (child && child.exitCode === null && await alive()) return;
    starting ??= (async () => {
      if (await alive()) return; // A Chrome left from a previous gateway run on the same profile.
      child = spawnProcess(executable, [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir}`,
        '--no-first-run', '--no-default-browser-check', '--mute-audio',
        '--disable-features=Translate,MediaRouter',
        // A normal window, kept off the visible desktop.
        '--window-position=-32000,-32000', '--window-size=1280,900',
        'about:blank',
      ], {stdio: 'ignore', windowsHide: false});
      child.on('exit', code => log({browser: 'exit', code}));
      for (let i = 0; i < 60; i++) { if (await alive()) { log({browser: 'ready'}); return; } await sleep(100); }
      throw new Error('browser_start');
    })().finally(() => { starting = undefined; });
    await starting;
  }

  async function slot(signal) {
    while (active >= maxTabs) {
      if (signal?.aborted) throw signal.reason ?? new Error('aborted');
      await new Promise(resolve => waiting.push(resolve));
    }
    active++;
    return () => { active--; waiting.shift()?.(); };
  }

  async function open(target, signal, deadline) {
    const tab = await (await fetch(`${devtools}/json/new?about:blank`, {method: 'PUT', signal})).json();
    const session = await connect(tab.webSocketDebuggerUrl);
    const documents = new Map();
    let latest, loaded = false;
    session.on(message => {
      const params = message.params ?? {};
      if (message.method === 'Network.responseReceived' && params.type === 'Document' && params.frameId === tab.id) {
        latest = params.requestId;
        loaded = false;
        documents.set(params.requestId, {status: params.response.status, mimeType: params.response.mimeType, url: params.response.url, finished: false});
      } else if (message.method === 'Network.loadingFinished' && documents.has(params.requestId)) {
        documents.get(params.requestId).finished = true;
      } else if (message.method === 'Page.domContentEventFired') {
        loaded = true;
      }
    });
    try {
      await session.send('Page.enable');
      await session.send('Network.enable', {maxResourceBufferSize: maxBodyBytes, maxTotalBufferSize: maxBodyBytes * 2});
      await session.send('Network.setBlockedURLs', {urls: skippedResources});
      await session.send('Page.setDownloadBehavior', {behavior: 'deny'});
      await session.send('Page.navigate', {url: target.href});
      let answer, rendered;
      while (Date.now() < deadline && !signal?.aborted) {
        await sleep(150);
        const document = latest && documents.get(latest);
        if (!document?.finished || !loaded) continue;
        if (!document.body) {
          const result = await session.send('Network.getResponseBody', {requestId: latest});
          // Chrome may drop the body of a page that replaced itself; the drawn page below still has the data.
          document.body = result.error ? Buffer.alloc(0) : Buffer.from(result.result.body, result.result.base64Encoded ? 'base64' : 'utf8');
        }
        answer = document;
        // JSON and other non-pages are complete as soon as they arrive.
        if (!/html/i.test(document.mimeType)) break;
        // Walmart and others embed bot-wall scripts on real pages too: data first, the wall only without it.
        if (carriesProduct(document.body.toString('utf8'))) break;
        // A wall may clear itself and reload the page (Akamai's sensor); keep waiting for the next document.
        if (blockedSignal(document.status, undefined, 'text/html', document.body)) continue;
        const drawn = await session.send('Runtime.evaluate', {expression: renderedProduct, returnByValue: true});
        const html = drawn.result?.result?.value;
        if (typeof html === 'string' && html && html.length <= maxBodyBytes) { rendered = Buffer.from(html, 'utf8'); break; }
      }
      if (answer && rendered) return {...answer, body: rendered};
      if (!answer) throw Object.assign(new Error('browser_timeout'), {name: 'TimeoutError'});
      return answer;
    } finally {
      session.close();
      fetch(`${devtools}/json/close/${tab.id}`).catch(() => {});
    }
  }

  async function browserEngine(target, {method, headers = {}, signal, deadline}) {
    // Requests carrying a session (Amazon's delivery address) stay on the engine that built them.
    if (method !== 'GET' || headers.cookie) throw Object.assign(new Error('browser_get_only'), {status: 400});
    const until = Math.min(deadline ?? Infinity, Date.now() + 12_000) - 300;
    const release = await slot(signal);
    try {
      await ensureChrome();
      const page = await open(target, signal, until);
      let finalUrl;
      try { finalUrl = new URL(page.url); } catch { throw Object.assign(new Error('browser_url'), {status: 502}); }
      if (finalUrl.protocol !== 'https:' || allowedHosts && !allowedHosts.has(finalUrl.hostname.toLowerCase())) throw Object.assign(new Error('browser_left_store'), {status: 502});
      // The page moved (a removed product sent to a listing): report it as a redirect so the importer checks the new address itself.
      if (finalUrl.origin !== target.origin || finalUrl.pathname.replace(/\/$/, '') !== target.pathname.replace(/\/$/, '')) {
        return new Response(null, {status: 302, headers: {location: finalUrl.href}});
      }
      return new Response(page.body, {status: page.status, headers: {'content-type': page.mimeType === 'text/html' ? 'text/html; charset=utf-8' : page.mimeType}});
    } finally { release(); }
  }
  /** Starts Chrome ahead of the first request (the gateway calls it on start). */
  browserEngine.warm = ensureChrome;
  return browserEngine;
}
