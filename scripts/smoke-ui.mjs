import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const baseUrl = new URL(args.find((value) => !value.startsWith("--")) ?? "http://127.0.0.1:8787/");
if (!/^https?:$/.test(baseUrl.protocol)) throw Error("Expected an HTTP URL");
// --a11y-only: just the accessibility and contrast pass (works on an empty local database).
const a11yOnly = args.includes("--a11y-only");
// ATLAS_A11Y_STRICT=1 also fails on "serious" findings (contrast among them); by default only "critical" ones fail.
const a11yStrict = process.env.ATLAS_A11Y_STRICT === "1";

// axe-core is not a dependency of its own: it comes with eslint-plugin-jsx-a11y (dev). Without it the pass is skipped.
const { createRequire } = await import("node:module");
const { readFileSync } = await import("node:fs");
let axeSource = null;
try {
  axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
} catch {
  process.stdout.write("Accessibility pass skipped: axe-core is not installed.\n");
}

const candidates = [
  process.env.ATLAS_BROWSER_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const { existsSync } = await import("node:fs");
const browserPath = candidates.find((value) => existsSync(value));
if (!browserPath)
  throw Error("Chrome or Edge was not found. Set ATLAS_BROWSER_PATH.");

const profile = await mkdtemp(join(tmpdir(), "atlas-ui-smoke-"));
const browser = spawn(
  browserPath,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"], windowsHide: true },
);

let stderr = "";
browser.stderr.setEncoding("utf8");
browser.stderr.on("data", (chunk) => (stderr += chunk));

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
async function waitForDevtools() {
  for (let attempt = 0; attempt < 80; attempt++) {
    const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (match) return match[1];
    if (browser.exitCode !== null)
      throw Error(`Browser exited before startup: ${stderr.slice(-500)}`);
    await sleep(100);
  }
  throw Error("Browser debugging endpoint did not start.");
}

class Cdp {
  constructor(url) {
    this.id = 0;
    this.pending = new Map();
    this.errors = [];
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolveReady, rejectReady) => {
      this.socket.addEventListener("open", resolveReady, { once: true });
      this.socket.addEventListener("error", rejectReady, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.method === "Runtime.exceptionThrown")
        this.errors.push(message.params.exceptionDetails.text);
      if (!message.id) return;
      const task = this.pending.get(message.id);
      if (!task) return;
      this.pending.delete(message.id);
      if (message.error) task.reject(Error(message.error.message));
      else task.resolve(message.result);
    });
  }
  async send(method, params = {}, sessionId) {
    await this.ready;
    const id = ++this.id;
    const result = new Promise((resolveResult, rejectResult) =>
      this.pending.set(id, { resolve: resolveResult, reject: rejectResult }),
    );
    this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    return result;
  }
  close() {
    this.socket.close();
  }
}

let cdp;
try {
  cdp = new Cdp(await waitForDevtools());
  // The checks below read Russian labels; ?lang=ru renders the page in Russian on the server too.
  const { targetId } = await cdp.send("Target.createTarget", {
    url: new URL("/?lang=ru", baseUrl).href,
  });
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Page.enable", {}, sessionId);

  async function evaluate(expression) {
    const result = await cdp.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async function eventually(expression, description) {
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        if (await evaluate(expression)) return;
      } catch {}
      await sleep(100);
    }
    throw Error(`Timed out: ${description}`);
  }

  await eventually(
    "document.readyState === 'complete' && document.documentElement.lang === 'ru' && document.querySelector('.home-hero h1') !== null",
    "home page in Russian",
  );
  let productPath = null;
  if (!a11yOnly) {
  if (!(await evaluate("!!document.querySelector('.home-hero input')")))
    throw Error("Home link calculator is missing");
  // Catalog filter: the count depends on the catalog, so only check that a category narrows it
  // and lands in the address.
  await evaluate("location.assign('/catalog?lang=ru')");
  const count = "document.querySelectorAll('.catalog-results :is(.pcard, .find-card):not(.pcard-skeleton):not(.catalog-skeleton-card)').length";
  await eventually(`location.pathname === '/catalog' && ${count} > 0`, "catalog products");
  const total = await evaluate(count);
  await evaluate(
    "[...document.querySelectorAll('.catalog-categories button')].find((item) => item.textContent?.trim().startsWith('Обувь'))?.click()",
  );
  await eventually(`new URLSearchParams(location.search).get('cat') === 'shoes' && ${count} > 0 && ${count} < ${total}`, "catalog category filter");
  // A card opens the product page as a sheet over the catalog, at the product's own address (redesign stage 5).
  if (await evaluate("!!document.querySelector('.pcard-title a')")) {
    productPath = await evaluate("document.querySelector('.pcard-title a').getAttribute('href')");
    await evaluate("document.querySelector('.pcard-title a').click()");
    await eventually("!!document.querySelector('.pd-sheet .pd') && location.pathname.startsWith('/catalog/p/')", "product sheet at its own address");
    await evaluate("document.querySelector('.pd-sheet-actions .sheet-close')?.click()");
    await eventually("location.pathname === '/catalog' && !document.querySelector('.pd-sheet')", "closing the sheet goes back to the catalog");
  } else if (!(await evaluate("!!document.querySelector('a.pcard-plus[href^=\"/catalog/p/\"]')"))) {
    throw Error("Catalog cards neither open the product sheet nor link to the product page");
  }
  const privateLinksHidden = await evaluate(
    "!document.querySelector('header a[href=\"/orders\"], header a[href=\"/notifications\"]')",
  );
  if (!privateLinksHidden) throw Error("Guest header exposed private navigation");
  // The cart is open to guests (redesign stage 6): its link is the cart itself, not the sign-in page.
  if (!(await evaluate("!!document.querySelector('header a.shell-cart[href=\"/cart\"]')"))) throw Error("Guest header cart does not open the cart");
  await evaluate("location.assign('/cart')");
  await eventually("location.pathname === '/cart' && !!document.querySelector('main h1')", "guest cart opens without sign-in");
  await evaluate("document.querySelector('footer a[href^=\"/legal\"]')?.click()");
  await eventually("location.pathname === '/legal' && document.querySelector('main h1') !== null", "legal navigation");
  await evaluate("document.querySelector('a.wordmark[href=\"/\"]')?.click()");
  await eventually("location.pathname === '/' && document.querySelector('.home-hero') !== null", "home navigation");
  await evaluate("location.assign('/order-by-link')");
  await eventually("location.pathname === '/order-by-link' && !!document.querySelector('main input')", "guest order-by-link: link field");
  // The guest note appears once there is a link to estimate (since 0db3f0f); a catalog item needs no network.
  const catalogLink = "/order-by-link?url=" + encodeURIComponent("https://www.target.com/p/nyx-professional-makeup-butter-lip-gloss-16-praline-0-27-fl-oz/-/A-51033539") + "&catalog=nyx-butter-gloss";
  await evaluate(`location.assign(${JSON.stringify(catalogLink)})`);
  await eventually(
    // The note's wording changed on 14.10.2026; what matters is the guest note plus a total shown before sign-in.
    "location.pathname === '/order-by-link' && !!document.querySelector('.lo-guest') && /\\d/.test(document.querySelector('.lo-sticky.guest')?.textContent ?? '')",
    "guest order-by-link: the estimate works without signing in",
  );
  await evaluate("location.assign('/e2e-missing-page')");
  await eventually("document.querySelector('main h1')?.textContent?.includes('Страница не найдена')", "localized 404 page");
  }

  // Accessibility (3 November 2026): axe-core (WCAG 2.1 A/AA rules) on the main pages, then the colour-contrast rule
  // alone with the dark theme on. "critical" findings fail the smoke; "serious" ones (contrast among them) are
  // printed, and fail too with ATLAS_A11Y_STRICT=1.
  const a11yFailures = [];
  if (axeSource) {
    const pages = [["/?lang=ru", "home"], ["/catalog?lang=ru", "catalog"], ...(productPath ? [[productPath, "product"]] : []), ["/cart?lang=ru", "cart"], ["/order-by-link?lang=ru", "order by link"], ["/legal?lang=ru", "legal"], ["/privacy?lang=ru", "privacy"]];
    const summary = [];
    for (const [path, label] of pages) {
      for (const theme of ["light", "dark"]) {
        // The theme the site keeps (next-themes, "atlas-theme"), set before the page loads: no colour transitions mid-scan.
        await evaluate(`localStorage.setItem("atlas-theme", ${JSON.stringify(theme)}), location.assign(${JSON.stringify(path)}), true`);
        await eventually(`document.readyState === 'complete' && document.documentElement.dataset.theme === ${JSON.stringify(theme)} && !!document.querySelector('main h1')`, `${label} (${theme}) for the accessibility pass`);
        await sleep(600); // hydration and late images settle before the scan
        // Runtime.evaluate is not bound by the page's CSP: no eval() in the page, no CSP report from the scan itself.
        if (!(await evaluate("!!window.axe"))) await evaluate(axeSource + ";true");
        const options = theme === "light"
          ? { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] }
          : { runOnly: { type: "rule", values: ["color-contrast"] }, resultTypes: ["violations"] };
        const violations = await evaluate(`axe.run(document, ${JSON.stringify(options)}).then((result) => result.violations.map((item) => ({ id: item.id, impact: item.impact, help: item.help, count: item.nodes.length, targets: item.nodes.slice(0, 3).map((node) => node.target.join(" ")) })))`);
        for (const item of violations) {
          const line = `${label} (${theme}): ${item.impact} ${item.id} ×${item.count} — ${item.help} [${item.targets.join(", ")}]`;
          summary.push(line);
          if (item.impact === "critical" || (a11yStrict && item.impact === "serious")) a11yFailures.push(line);
        }
      }
    }
    await evaluate("localStorage.removeItem('atlas-theme'), true");
    process.stdout.write(summary.length ? `Accessibility findings (${summary.length}):\n  ${summary.join("\n  ")}\n` : "Accessibility: no axe-core findings on the main pages, light and dark contrast included.\n");
  }
  if (cdp.errors.length)
    throw Error(`Browser exceptions: ${cdp.errors.join(" | ")}`);
  if (a11yFailures.length) throw Error(`Accessibility failures (${a11yFailures.length}):\n${a11yFailures.join("\n")}`);
  process.stdout.write(a11yOnly
    ? "Accessibility smoke passed.\n"
    : "UI smoke passed: Russian home and link calculator, catalog filter, guest navigation gates and cart, legal, guest link order, 404 and accessibility.\n",
  );
} finally {
  cdp?.close();
  browser.kill();
  await sleep(250);
  const resolvedProfile = resolve(profile);
  if (resolvedProfile.startsWith(resolve(tmpdir()) + sep))
    await rm(resolvedProfile, { recursive: true, force: true }).catch(() => {});
}
