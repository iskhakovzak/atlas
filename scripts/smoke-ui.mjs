import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:8787/");
if (!/^https?:$/.test(baseUrl.protocol)) throw Error("Expected an HTTP URL");

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
  const { targetId } = await cdp.send("Target.createTarget", {
    url: baseUrl.href,
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
    "document.readyState === 'complete' && document.querySelector('main') !== null",
    "catalog load",
  );
  await evaluate(
    "[...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Обувь')?.click()",
  );
  await eventually(
    "document.querySelector('.finds-result [role=status]')?.textContent?.trim() === 'Найдено: 2'",
    "catalog category button",
  );
  await evaluate(
    "document.querySelector('button.find-photo')?.click()",
  );
  await eventually(
    "document.body.textContent.includes('Расчёт стоимости')",
    "product details button",
  );
  await evaluate(
    "document.querySelector('button[aria-label=\"Закрыть карточку\"]')?.click()",
  );
  const privateLinksHidden = await evaluate(
    "!document.querySelector('header a[href=\"/cart\"], header a[href=\"/orders\"], header a[href=\"/notifications\"]')",
  );
  if (!privateLinksHidden) throw Error("Guest header exposed private navigation");
  await evaluate("document.querySelector('a[href=\"/legal\"]')?.click()");
  await eventually("location.pathname === '/legal'", "legal navigation");
  await evaluate("document.querySelector('a.wordmark[href=\"/\"]')?.click()");
  await eventually("location.pathname === '/'", "home navigation");
  await evaluate("document.querySelector('a[href=\"/order-by-link\"]')?.click()");
  await eventually(
    "location.pathname === '/order-by-link' && document.body.textContent.includes('Войдите')",
    "protected order-by-link navigation",
  );
  if (cdp.errors.length)
    throw Error(`Browser exceptions: ${cdp.errors.join(" | ")}`);
  process.stdout.write(
    "UI smoke passed: public catalog, product details, guest navigation gates, legal and protected link order.\n",
  );
} finally {
  cdp?.close();
  browser.kill();
  await sleep(250);
  const resolvedProfile = resolve(profile);
  if (resolvedProfile.startsWith(resolve(tmpdir()) + sep))
    await rm(resolvedProfile, { recursive: true, force: true }).catch(() => {});
}
