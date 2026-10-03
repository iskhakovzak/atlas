// End-to-end check of the main customer path plus light/dark snapshots of every key page.
//
// Start a built Worker that allows dev sign-in codes and knows the operator, then run:
//   npm start -- --var ATLAS_AUTH_DEV_CODES:true --var ATLAS_OPERATOR_EMAIL:operator@atlas.local
//   npm run e2e -- http://127.0.0.1:8787/ [--compare outputs/e2e/<earlier run>]
//
// Each page is opened in both themes at 390 and 1280 px. The run fails on script errors,
// horizontal overflow, text below WCAG AA contrast, broken images, unnamed controls,
// duplicate ids or a missing/duplicated h1. Screenshots and a computed-style fingerprint
// of every page land in outputs/e2e/<time>/; --compare lists elements whose styles changed.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { products } from "../lib/market/domain.ts";

const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const base = new URL(args.find((value) => /^https?:\/\//.test(value)) ?? "http://127.0.0.1:8787/");
const outDir = resolve(option("--out") ?? join("outputs", "e2e", new Date().toISOString().replace(/[:.]/g, "-")));
const compareDir = option("--compare");
const operatorEmail = process.env.ATLAS_E2E_OPERATOR ?? "operator@atlas.local";
const customerEmail = `e2e-${Date.now()}@atlas.local`;
const themes = ["light", "dark"];
const widths = [390, 1280];

const browserPath = [
  process.env.ATLAS_BROWSER_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean).find((value) => existsSync(value));
if (!browserPath) throw Error("Chrome or Edge was not found. Set ATLAS_BROWSER_PATH.");

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const failures = [];
const fail = (where, message) => { failures.push(`${where}: ${message}`); };

// Runs inside every page: readiness, audit and style fingerprint.
const pageHelpers = String.raw`
window.__e2e = (() => {
  const parse = (value) => { const m = value && value.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return p.length < 3 ? null : { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const stops = (value) => (value.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const label = (el) => { const out = []; for (let n = el, i = 0; n && n.nodeType === 1 && i < 3; n = n.parentElement, i++) out.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + [...n.classList].slice(0, 2).map((c) => '.' + c).join('')); return out.join('>'); };
  function backgrounds(el) {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n), own = parse(cs.backgroundColor), root = n === document.documentElement || n === document.body;
      if (cs.backgroundImage !== 'none' && !root) {
        if (cs.backgroundImage.includes('url(')) return null;
        const colors = stops(cs.backgroundImage);
        if (colors.length) { layers.push(colors.map((c) => own && own.a > 0 ? over(c, own) : c)); if (own && own.a >= 1) break; continue; }
      }
      if (own && own.a > 0) { layers.push([own]); if (own.a >= 1) break; }
    }
    let result = [{ r: 255, g: 255, b: 255, a: 1 }];
    for (const n of [document.documentElement, document.body]) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) result = [over(c, result[0])]; }
    for (let i = layers.length - 1; i >= 0; i--) { const next = []; for (const top of layers[i]) for (const bottom of result) next.push(over(top, bottom)); next.sort((a, b) => lum(a) - lum(b)); result = next.length > 4 ? [next[0], next[Math.floor(next.length / 3)], next[Math.floor(2 * next.length / 3)], next[next.length - 1]] : next; }
    return result;
  }
  function name(el) {
    const aria = el.getAttribute('aria-label'); if (aria && aria.trim()) return aria.trim();
    const by = el.getAttribute('aria-labelledby'); if (by) { const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim(); if (t) return t; }
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l && l.textContent.trim()) return l.textContent.trim(); }
    const wrap = el.closest('label'); if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();
    const title = el.getAttribute('title'); if (title && title.trim()) return title.trim();
    if (/^(BUTTON|A|SUMMARY)$/.test(el.tagName) || el.getAttribute('role')) { const t = el.textContent.trim(); if (t) return t; const img = el.querySelector('img[alt]:not([alt=""])'); if (img) return img.alt; }
    return '';
  }
  const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); return cs.visibility === 'visible' && cs.display !== 'none'; };
  return {
    ready() { return document.readyState === 'complete' && !!document.querySelector('main, h1') && !document.querySelector('.access-spinner, [aria-busy="true"]'); },
    audit() {
      const width = document.documentElement.clientWidth, issues = [];
      const overflow = document.documentElement.scrollWidth - width; if (overflow > 1) issues.push('horizontal overflow ' + overflow + 'px');
      for (const el of document.body.querySelectorAll('*')) {
        if (/^(SCRIPT|STYLE|NOSCRIPT|OPTION|TEMPLATE|svg|path)$/i.test(el.tagName)) continue;
        const text = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
        if (!text || !visible(el) || el.closest('[aria-hidden="true"], :disabled, [aria-disabled="true"], [inert], .sr-only')) continue;
        const cs = getComputedStyle(el); if ((cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text')) continue;
        let opacity = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) opacity *= parseFloat(getComputedStyle(n).opacity); if (opacity < 0.3) continue;
        const fg = parse(cs.color), bgs = backgrounds(el); if (!fg || !bgs || fg.a === 0) continue;
        const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight) || 400, need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
        let worst = 99; for (const b of bgs) worst = Math.min(worst, ratio(fg.a < 1 ? over(fg, b) : fg, b));
        if (worst < need) issues.push('contrast ' + worst.toFixed(2) + ' < ' + need + ' "' + text.slice(0, 40) + '" ' + label(el));
      }
      for (const img of document.images) if (img.complete && img.getAttribute('src') && img.naturalWidth === 0) issues.push('broken image ' + img.getAttribute('src').slice(0, 80));
      for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea, button, a[href], [role=button], [role=checkbox], [role=tab], summary')) if (visible(el) && !name(el)) issues.push('unnamed control ' + label(el));
      const ids = {}; for (const el of document.querySelectorAll('[id]')) ids[el.id] = (ids[el.id] || 0) + 1; for (const [id, count] of Object.entries(ids)) if (count > 1) issues.push('duplicate id #' + id + ' x' + count);
      const h1 = [...document.querySelectorAll('h1')].filter(visible).length; if (h1 !== 1) issues.push(h1 + ' visible h1');
      return issues;
    },
    fingerprint() {
      const rows = [];
      for (const el of document.body.querySelectorAll('*')) {
        if (!visible(el) || /^(SCRIPT|STYLE|path)$/i.test(el.tagName)) continue;
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        rows.push([label(el), Math.round(r.width) + 'x' + Math.round(r.height), cs.color, cs.backgroundColor, cs.backgroundImage.slice(0, 60), cs.fontSize + '/' + cs.fontWeight, cs.borderTopColor + ' ' + cs.borderTopWidth, cs.opacity, cs.boxShadow.slice(0, 40)].join(' | '));
      }
      return rows;
    },
  };
})();`;

class Cdp {
  constructor(url) {
    this.id = 0; this.pending = new Map(); this.listeners = [];
    this.socket = new WebSocket(url);
    this.ready = new Promise((ok, no) => { this.socket.addEventListener("open", ok, { once: true }); this.socket.addEventListener("error", no, { once: true }); });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.method) for (const listener of this.listeners) listener(message);
      if (!message.id) return;
      const task = this.pending.get(message.id); if (!task) return;
      this.pending.delete(message.id);
      if (message.error) task.reject(Error(message.error.message)); else task.resolve(message.result);
    });
  }
  async send(method, params = {}, sessionId) {
    await this.ready;
    const id = ++this.id;
    const result = new Promise((ok, no) => this.pending.set(id, { resolve: ok, reject: no }));
    this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    return result;
  }
}

const profile = await mkdtemp(join(tmpdir(), "atlas-e2e-"));
const browser = spawn(browserPath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
let stderr = ""; browser.stderr.setEncoding("utf8"); browser.stderr.on("data", (chunk) => (stderr += chunk));

let exitCode = 0;
try {
  let devtools;
  for (let attempt = 0; attempt < 100 && !devtools; attempt++) { devtools = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1]; if (!devtools) await sleep(100); }
  if (!devtools) throw Error("Browser debugging endpoint did not start.");
  const cdp = new Cdp(devtools);
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  let pageErrors = [];
  // Requests still in flight: a page is only snapshotted once its data has arrived.
  const inFlight = new Set();
  cdp.listeners.push((message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === "Network.requestWillBeSent") inFlight.add(message.params.requestId);
    if (message.method === "Network.loadingFinished" || message.method === "Network.loadingFailed") inFlight.delete(message.params.requestId);
    if (message.method === "Runtime.exceptionThrown") pageErrors.push("exception: " + (message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text).split("\n")[0]);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") pageErrors.push("console.error: " + message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ").slice(0, 200));
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
      const { text, url = "" } = message.params.entry;
      // Guests always get 401 from /api/account, and the 404 check requests a missing page on purpose.
      if (/status of 401/.test(text) && url.includes("/api/account")) return;
      if (/status of 404/.test(text) && url.includes("/e2e-missing-page")) return;
      pageErrors.push("log: " + text.slice(0, 160) + " " + url.replace(base.origin, ""));
    }
  });
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable"); await send("Network.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: pageHelpers });

  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const eventually = async (expression, description, tries = 100) => {
    for (let attempt = 0; attempt < tries; attempt++) { try { if (await evaluate(expression)) return; } catch {} await sleep(100); }
    throw Error(`Timed out: ${description}`);
  };
  const networkIdle = async (quietMs = 500, maxMs = 15000) => {
    const started = Date.now();
    let quietSince = Date.now();
    while (Date.now() - started < maxMs) {
      if (inFlight.size) quietSince = Date.now();
      else if (Date.now() - quietSince >= quietMs) return;
      await sleep(50);
    }
  };
  const open = async (path) => {
    pageErrors = [];
    inFlight.clear();
    const loaded = new Promise((done) => { const listener = (message) => { if (message.sessionId === sessionId && message.method === "Page.loadEventFired") { cdp.listeners.splice(cdp.listeners.indexOf(listener), 1); done(); } }; cdp.listeners.push(listener); });
    await send("Page.navigate", { url: new URL(path, base).href });
    await Promise.race([loaded, sleep(20000)]);
    await eventually("window.__e2e && window.__e2e.ready()", `${path} ready`, 150);
    await networkIdle();
    await eventually("window.__e2e.ready()", `${path} ready after data`, 100);
    await evaluate("document.fonts.ready.then(() => true)");
    await sleep(300);
  };
  const setViewport = (width) => send("Emulation.setDeviceMetricsOverride", { width, height: width < 768 ? 844 : 900, deviceScaleFactor: 1, mobile: width < 768 });
  const setPreferences = async (theme) => { await evaluate(`localStorage.setItem('atlas-theme', ${JSON.stringify(theme)}); localStorage.setItem('atlas-language', 'ru'); document.cookie = 'atlas-language=ru; Path=/; SameSite=Lax'; true`); };
  const signIn = async (email) => evaluate(`(async () => {
    const post = (body) => fetch('/api/auth/otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json().then((data) => ({ status: r.status, data })));
    const start = await post({ step: 'start', channel: 'email', target: ${JSON.stringify(email)} });
    if (start.status === 429) throw Error('Sign-in rate limit reached for ' + ${JSON.stringify(email)} + ' (10 codes a day per address, 20 an hour per IP).');
    if (start.status !== 200) throw Error('Sign-in start failed: HTTP ' + start.status + ' ' + (start.data.error ?? ''));
    if (!start.data.devCode) throw Error('Dev sign-in codes are disabled: start the Worker with ATLAS_AUTH_DEV_CODES=true on a loopback URL.');
    const verify = await post({ step: 'verify', channel: 'email', challengeId: start.data.challengeId, code: start.data.devCode });
    if (verify.status !== 200) throw Error('Sign-in failed: ' + verify.status);
    return true;
  })()`);
  await mkdir(outDir, { recursive: true });
  const fingerprints = {};
  const snapshot = async (group, path) => {
    for (const theme of themes) for (const width of widths) {
      await setViewport(width); await setPreferences(theme); await open(path);
      const key = `${group}-${path === "/" ? "home" : path.slice(1).replace(/[^a-z0-9]+/gi, "-")}-${theme}-${width}`;
      const where = `${group} ${path} ${theme} ${width}px`;
      for (const issue of await evaluate("window.__e2e.audit()")) fail(where, issue);
      for (const error of pageErrors) fail(where, error);
      fingerprints[key] = await evaluate("window.__e2e.fingerprint()");
      const { contentSize } = await send("Page.getLayoutMetrics");
      const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.min(Math.ceil(contentSize.height), 8000), scale: 1 } });
      await writeFile(join(outDir, key + ".png"), Buffer.from(shot.data, "base64"));
      process.stdout.write(".");
    }
  };

  // 1. Guest: public pages, language versions and the link calculator.
  await setViewport(1280); await open("/"); await setPreferences("light");
  for (const path of ["/", "/catalog", "/catalog?cat=shoes&sort=cheap", "/stores", "/customs", "/legal", "/login", "/order-by-link", "/e2e-missing-page"]) await snapshot("guest", path);
  for (const [path, locale] of [["/?lang=uz", "uz"], ["/catalog?lang=en", "en"], ["/stores?lang=en", "en"], ["/customs?lang=ru", "ru"]]) {
    await open(path);
    const seen = await evaluate("({ lang: document.documentElement.lang, title: document.title, canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') })");
    if (seen.lang !== locale) fail(`guest ${path}`, `html lang is ${seen.lang}, expected ${locale}`);
    if (!seen.canonical?.endsWith(path)) fail(`guest ${path}`, `canonical ${seen.canonical} is not self-referencing`);
  }
  // Catalog filters: a category narrows the list and lands in the address; the address restores it.
  await open("/catalog?lang=ru");
  await eventually("document.querySelectorAll('.catalog-results .find-card:not(.catalog-skeleton-card)').length > 0", "catalog products");
  const catalogTotal = await evaluate("document.querySelectorAll('.catalog-results .find-card:not(.catalog-skeleton-card)').length");
  await evaluate("[...document.querySelectorAll('.catalog-categories button')].find((button) => button.getAttribute('aria-pressed') === 'false' && !button.dataset.empty)?.click(), true");
  await eventually("new URLSearchParams(location.search).has('cat') && new URLSearchParams(location.search).get('lang') === 'ru'", "category kept in the address with the language");
  const filtered = await evaluate("({ cat: new URLSearchParams(location.search).get('cat'), shown: document.querySelectorAll('.catalog-results .find-card:not(.catalog-skeleton-card)').length })");
  if (!(filtered.shown > 0 && filtered.shown <= catalogTotal)) fail("guest /catalog", `category ${filtered.cat} shows ${filtered.shown} of ${catalogTotal}`);
  await open(`/catalog?cat=${filtered.cat}`);
  await eventually(`document.querySelector('.catalog-categories [aria-pressed=true]') && document.querySelectorAll('.catalog-results .find-card:not(.catalog-skeleton-card)').length === ${filtered.shown}`, "category restored from the address");
  await open("/order-by-link");
  if (!(await evaluate("!!document.querySelector('main input')"))) fail("guest /order-by-link", "link field missing");

  // 2. Customer: sign in, cart, three-step checkout through the interface, order list.
  await setViewport(1280); await setPreferences("light"); await signIn(customerEmail);
  const added = await evaluate(`(async () => {
    const account = await fetch('/api/account').then((r) => r.json());
    const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: account.revision, action: { type: 'cart-add', product: ${JSON.stringify({ ...products[0], id: `e2e-${Date.now()}` })}, variant: ${JSON.stringify(products[0].variants[0])} } }) });
    return response.status;
  })()`);
  if (added !== 200) throw Error(`cart-add returned ${added}`);
  await snapshot("customer", "/cart");
  await setViewport(1280); await setPreferences("light"); await open("/cart");
  await evaluate("document.querySelector('.basket-cta').click(), true");
  await eventually("!!document.querySelector('form.basket-checkout #recipient')", "checkout form");
  await evaluate(`(() => {
    const set = (selector, value) => { const el = document.querySelector(selector); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };
    set('#recipient', 'Atlas E2E Customer');
    set('#recipient-phone', '90 123 45 67');
    const region = document.querySelector('#region'); set('#region', [...region.options].find((option) => option.value)?.value ?? '');
    return true;
  })()`);
  await sleep(150);
  await evaluate(`(() => { const el = document.querySelector('#delivery-address'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Amir Temur ko‘chasi, 10'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await evaluate("document.querySelector('form.basket-checkout button.btn.primary.full').click(), true");
  await eventually("!!document.querySelector('#checkout-consent')", "review step");
  await evaluate("document.querySelector('form.basket-checkout button.btn.primary.full').click(), true");
  await eventually("!!document.querySelector('#checkout-consent-error')", "consent is required before placing the order");
  await evaluate("document.querySelector('#checkout-consent').click(), true");
  await evaluate("document.querySelector('form.basket-checkout button.btn.primary.full').click(), true");
  await eventually("fetch('/api/account').then((r) => r.json()).then((a) => a.state.orders.length === 1)", "order placed", 200);
  const orderId = await evaluate("fetch('/api/account').then((r) => r.json()).then((a) => a.state.orders[0].id)");
  await open("/orders");
  await eventually(`document.querySelector('main').textContent.includes(${JSON.stringify(orderId)})`, "order shown in My orders");
  for (const path of ["/orders", "/account", "/notifications", "/balance", "/identity", "/declaration", "/favorites", "/catalog"]) await snapshot("customer", path);

  // 3. Operator pages.
  await setViewport(1280); await setPreferences("light"); await signIn(operatorEmail);
  await open("/admin");
  if (!(await evaluate("!document.querySelector('[data-access]')"))) throw Error(`Operator access denied: start the Worker with ATLAS_OPERATOR_EMAIL=${operatorEmail}.`);
  for (const path of ["/admin", "/operations", "/analytics"]) await snapshot("operator", path);
  await writeFile(join(outDir, "fingerprints.json"), JSON.stringify(fingerprints));

  // 4. Optional comparison with an earlier run: for element types present in both runs, report any
  // change of colour, background, font, border, opacity or shadow. Sizes and data-driven rows
  // (orders, counters) differ between runs and are ignored.
  if (compareDir) {
    const before = JSON.parse(await readFile(join(resolve(compareDir), "fingerprints.json"), "utf8"));
    const styles = (rows) => {
      const map = new Map();
      for (const row of rows) {
        const [label, , ...rest] = row.split(" | ");
        const key = label.replace(/#[^.>]+/g, ""); // React ids differ between runs
        if (!map.has(key)) map.set(key, new Set());
        map.get(key).add(rest.join(" | "));
      }
      return map;
    };
    let changed = 0;
    const lines = [];
    for (const [key, rows] of Object.entries(fingerprints)) {
      if (!before[key]) { lines.push(`${key}: not in the earlier run`); continue; }
      const a = styles(before[key]), b = styles(rows), diffs = [];
      for (const [label, set] of b) {
        const old = a.get(label);
        if (!old) continue;
        const gone = [...old].filter((value) => !set.has(value)), added = [...set].filter((value) => !old.has(value));
        if (gone.length && added.length) diffs.push(`  ${label}\n    - ${gone[0]}\n    + ${added[0]}`);
      }
      if (diffs.length) { changed++; lines.push(`${key}: ${diffs.length} element types restyled`, ...diffs); }
    }
    await writeFile(join(outDir, "compare.txt"), lines.join("\n"));
    process.stdout.write(`\nCompared with ${compareDir}: ${changed} of ${Object.keys(fingerprints).length} page snapshots restyled (details in compare.txt).\n`);
  }

  process.stdout.write(`\nE2E: main path passed (order ${orderId}); ${Object.keys(fingerprints).length} snapshots in ${outDir}.\n`);
} catch (error) {
  exitCode = 1;
  process.stdout.write(`\nE2E failed: ${error.message}\n`);
} finally {
  if (failures.length) {
    exitCode = 1;
    // The same problem usually repeats across themes and widths: print it once with where it was seen.
    const grouped = new Map();
    for (const line of failures) { const [where, ...rest] = line.split(": "); const issue = rest.join(": "); grouped.set(issue, [...(grouped.get(issue) ?? []), where]); }
    const summary = [...grouped].map(([issue, places]) => `  ${issue}\n      ${places.length}× — ${places.slice(0, 3).join("; ")}${places.length > 3 ? "; …" : ""}`);
    process.stdout.write(`${failures.length} problems, ${grouped.size} distinct:\n${summary.join("\n")}\n`);
    await mkdir(outDir, { recursive: true }).catch(() => {});
    await writeFile(join(outDir, "report.txt"), failures.join("\n")).catch(() => {});
  }
  browser.kill();
  await sleep(300);
  const resolvedProfile = resolve(profile);
  if (resolvedProfile.startsWith(resolve(tmpdir()) + sep)) await rm(resolvedProfile, { recursive: true, force: true }).catch(() => {});
}
process.exit(exitCode);
