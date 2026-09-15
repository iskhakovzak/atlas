import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:8787/");
if (!/^https?:$/.test(baseUrl.protocol) || !["localhost","127.0.0.1"].includes(baseUrl.hostname)) throw Error("This audit runs only against a local test server.");

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


  await cdp.send("Network.enable", {}, sessionId);
  const checks=[];
  async function check(expression,label){await eventually(expression,label);checks.push(label)}
  async function visit(path){await cdp.send("Page.navigate",{url:new URL(path,baseUrl).href},sessionId);await check("document.readyState==='complete' && !!document.querySelector('main')","loads "+path)}
  async function snapshot(name){await mkdir('outputs/ui-audit',{recursive:true});const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);await writeFile('outputs/ui-audit/'+name+'.png',Buffer.from(shot.data,'base64'))}
  async function auditPage(label){
    const issues=await evaluate("(()=>{const issues=[];const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);if(new Set(ids).size!==ids.length)issues.push('duplicate IDs');for(const el of document.querySelectorAll('button,a[href],input:not([type=hidden]):not([aria-hidden=true]),select,textarea')){const name=(el.getAttribute('aria-label')||el.textContent||el.getAttribute('placeholder')||'').trim();if(!name&&!el.labels?.length&&!(el instanceof HTMLInputElement&&el.type==='file'))issues.push('unnamed '+el.tagName)}for(const a of document.querySelectorAll('a[target=_blank]')){if(!a.rel.includes('noopener'))issues.push('unsafe blank link')}if(Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth+1){const wide=[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1&&!el.closest('.import-gallery')).slice(0,4).map(el=>{const box=el.getBoundingClientRect();return `${el.tagName}.${typeof el.className==='string'?el.className:''}:${Math.round(box.left)}-${Math.round(box.right)}`});issues.push('horizontal overflow '+wide.join('|'))}return [...new Set(issues)]})()");
    if(issues.length)throw Error(label+': '+issues.join(', '));
    checks.push('interface semantics '+label);
  }
  const hiddenPrivate="!document.querySelector('header a[href=\"/balance\"]') && !document.querySelector('header a[href=\"/notifications\"]') && !document.querySelector('header a[href=\"/cart\"]')";
  await visit('/');
  await check("!!document.querySelector('.guest-intro') && !document.querySelector('.account-error')","guest home without false server error");
  await check(hiddenPrivate,"private header controls hidden");
  await check("document.querySelectorAll('.find-card .find-total strong').length>0","catalog shows delivered estimates");
  await check("document.querySelector('.find-purchase a.btn.primary')?.getAttribute('href')?.startsWith('/signin-with-chatgpt?return_to=')","guest catalog order requires sign-in");
  await check("document.querySelectorAll('.find-origin a').length>0 && [...document.querySelectorAll('.find-origin a')].every(a=>!a.href.includes('slickdeals'))","catalog links directly to merchants");
  await auditPage('guest home');
  await evaluate("[...document.querySelectorAll('.finds-categories button')].find(b=>b.textContent.trim()==='Обувь').click()");
  await check("document.querySelectorAll('.find-card').length>0 && [...document.querySelectorAll('.find-card .find-meta')].every(el=>el.textContent.includes('Обувь'))","category filtering");
  await evaluate("document.querySelector('.find-photo').click()");
  await check("!!document.querySelector('.product-sheet') && !!document.querySelector('.sheet-total a[href^=\"/signin-with-chatgpt\"]')","guest product asks for sign-in");
  await evaluate("document.querySelector('button[aria-label=\"Закрыть карточку\"]').click()");
  await evaluate("(()=>{const el=document.querySelector('.locale-select');el.value='en';el.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await check("document.documentElement.lang==='en' && document.querySelector('.guest-intro').textContent.includes('Find better value')","guest language works without saving an account");
  await visit('/');
  await check("document.documentElement.lang==='en'","guest language survives reload");
  await evaluate("(()=>{const el=document.querySelector('.locale-select');el.value='ru';el.dispatchEvent(new Event('change',{bubbles:true}))})()");
  const protectedRoutes=['account','favorites','cart','orders','balance','notifications','identity','declaration','batch-import','order-by-link','admin','operations','analytics'];
  for(const route of protectedRoutes){
    await visit('/'+route);
    await check("document.querySelector('[data-access=signin]')!==null && !document.querySelector('main input,main textarea,main input[type=file]')","guest gate /"+route);
    await check("new URL(document.querySelector('[data-access=signin] a.btn.primary').href).searchParams.get('return_to')===location.pathname","return destination /"+route);
  }
  for(const route of ['legal','customs']){await visit('/'+route);await check("!document.querySelector('[data-access]') && !!document.querySelector('h1')","public "+route);await auditPage('public '+route)}
  await visit('/order-by-link?url=https%3A%2F%2Fwww.nike.com%2Ft%2Fshoe');
  await check("new URL(document.querySelector('[data-access=signin] a.btn.primary').href).searchParams.get('return_to')===location.pathname+location.search","sign-in retains source URL");
  const signInUrl=await evaluate("document.querySelector(\'[data-access=signin] a.btn.primary\').href");
  await cdp.send("Page.navigate",{url:signInUrl},sessionId);
  await check("fetch(\'/api/account\',{cache:\'no-store\'}).then(r=>r.status===200)","real local sign-in creates an authenticated session");
  await visit("/order-by-link");
  await check("!!document.querySelector(\'#source-url\') && !document.querySelector(\'#source-url\').disabled","authenticated product form opens");
  await visit('/');
  await check("!document.querySelector('.guest-intro') && !!document.querySelector('.find-save') && !!document.querySelector('header a[href=\"/cart\"]')","member home differs from guest");
  if (process.env.ATLAS_AUDIT_IMPORT === '1') {
    await visit('/order-by-link?url='+encodeURIComponent('https://www.stevemadden.com/products/possession-black'));
    await check("!!document.querySelector('#source-url') && !document.querySelector('#source-url').disabled",'import ready');
    await evaluate("document.querySelector('#source-url').closest('form').requestSubmit()");
    await check("document.querySelectorAll('.import-gallery button').length>1",'real merchant gallery loaded');
    await check("document.querySelector('.quote-preview').textContent.includes('POSSESSION BLACK')",'real merchant title loaded');
    await evaluate("document.querySelectorAll('.import-gallery button')[1].click()");
    await check("document.querySelectorAll('.import-gallery button')[1].getAttribute('aria-pressed')==='true'",'gallery switches photo');
    await check("document.querySelectorAll('.variant-options.sizes button:not(:disabled)').length>0",'available merchant sizes shown');
    await evaluate("document.querySelector('.variant-options.sizes button:not(:disabled)').click()");
    await check("document.querySelector('#variant').value.includes('BLACK')",'color and size selection retained');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false},sessionId);
    await check('innerWidth===390','import viewport is 390 pixels');
    await evaluate("document.querySelector('.import-gallery').scrollIntoView({block:'center',behavior:'instant'})");
    await check("[...document.querySelectorAll('.import-gallery img')].slice(0,2).every(img=>img.complete&&img.naturalWidth>0)",'merchant photos render');
    await auditPage('mobile imported product');
    await snapshot('import-390');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:800,height:900,deviceScaleFactor:1,mobile:false},sessionId);
  }
  // Use real local account APIs to prove server rejects non-admin reads and writes.
  const apiChecks=await evaluate("(async()=>{const results=[];for(const method of ['GET','POST']){const r=await fetch('/api/operations',{method,headers:method==='POST'?{'Content-Type':'application/json'}:undefined,body:method==='POST'?JSON.stringify({kind:'policy',value:{}}):undefined});results.push(r.status)}return results})()");
  if(apiChecks.some(status=>status!==403))throw Error('Customer could access operator API');
  checks.push('server rejects customer operator GET and POST');
  for(const route of ['admin','operations','analytics']){
   await visit('/'+route);
   await check("!!document.querySelector('[data-access=forbidden]') && !document.querySelector('main input,main textarea')","customer denied /"+route);
   if(route==='admin')await snapshot('admin-denied-800');
  }
  for(const route of ['account','favorites','cart','orders','balance','notifications','identity','declaration','batch-import','order-by-link']){
   await visit('/'+route);
   await check("!document.querySelector('[data-access]') && !!document.querySelector('h1')","member page /"+route);
   await check("!document.querySelector('a[href=\"/admin\"]') && !document.querySelector('a[href=\"/operations\"]')","no staff navigation /"+route);
   await auditPage('member /'+route);
   if(route==='account')await snapshot('account-800');
  }
  await visit('/legal#passport-consent');
  await check("document.getElementById('passport-consent')?.open === true",'consent link opens the exact legal section');
  await visit('/notifications');
  await check("!document.querySelector('.notification-list') || document.querySelectorAll('.notice-filters button').length===3",'populated notifications expose filters; empty inbox stays simple');
  await visit('/account');
  await check("document.querySelectorAll('.account-stats a').length===4 && document.querySelectorAll('.account-service-grid>a,.account-service-grid>button').length===6",'account dashboard prioritises four signals and six services');
  await check("document.querySelector('.account-profile-compact details')?.open === false",'secondary profile settings start collapsed');
  await evaluate("document.querySelectorAll('.account-detail>summary')[0].click();document.querySelectorAll('.account-detail>summary')[1].click()");
  await check("document.querySelectorAll('.account-detail[open]').length===1 && document.querySelectorAll('.account-detail')[1].open",'account detail panels open independently as one accordion');
  await visit('/identity');
  await check("[...document.querySelectorAll('.identity-upload button')].find(b=>b.textContent.includes('Распознать')).disabled","passport submit needs file and consent");
  await visit('/batch-import');
  await check("!!document.querySelector('.batch-import button:disabled')","batch submit needs links");
  await visit('/account');
  await check("!!document.querySelector('a[href*=\"signout-with-chatgpt\"]')","member can sign out");
  const signOutUrl=await evaluate("document.querySelector('a[href*=\"signout-with-chatgpt\"]').href");
  await cdp.send("Page.navigate",{url:signOutUrl},sessionId);
  await check("!!document.querySelector('[data-access=signin]')","local sign-out clears protected screen");
  await check(hiddenPrivate,"sign-out clears private navigation");
  // Controlled response fixtures cover loading, connectivity failure and expiration.
  const fixtureScript=await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__auditMode='error';
    const realFetch=window.fetch.bind(window);
    window.fetch=async(input,init)=>{const path=new URL(typeof input==='string'?input:input.url,location.href).pathname;
      if(path==='/api/account'&&window.__auditMode==='error')return new Response(JSON.stringify({error:'Connection test'}),{status:503,headers:{'Content-Type':'application/json'}});
      if(path==='/api/account'&&window.__auditMode==='guest')return new Response(JSON.stringify({error:'Signed out'}),{status:401,headers:{'Content-Type':'application/json'}});
      return realFetch(input,init)};
  `},sessionId);
  await visit('/admin');
  await check("!!document.querySelector('[data-access=error]') && !document.querySelector('#max-lines')","failed session never exposes admin form");
  await evaluate("window.__auditMode='guest';document.querySelector('[data-access=error] button').click()");
  await check("!!document.querySelector('[data-access=signin]')","retry recovers to guest");
  await cdp.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixtureScript.identifier},sessionId);
  await visit('/');
  for(const width of [1440,390]){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600},sessionId);
   await visit('/');
   await check("!!document.querySelector('.guest-intro')","responsive guest "+width);
   await check("document.documentElement.scrollWidth<=innerWidth+1","no horizontal overflow "+width);
   await mkdir('outputs/ui-audit',{recursive:true});
   const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);
   await writeFile('outputs/ui-audit/guest-'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  if(cdp.errors.length)throw Error('Browser exceptions: '+cdp.errors.join(' | '));
  await mkdir('outputs/ui-audit',{recursive:true});
  await writeFile('outputs/ui-audit/report.json',JSON.stringify({checks,passed:checks.length},null,2));
  process.stdout.write('UI audit passed: '+checks.length+' checks, real guest/customer sessions, permission denials, errors, desktop/mobile screenshots.\\n');

} finally {
  cdp?.close();
  browser.kill();
  await sleep(250);
  const resolvedProfile = resolve(profile);
  if (resolvedProfile.startsWith(resolve(tmpdir()) + sep))
    await rm(resolvedProfile, { recursive: true, force: true }).catch(() => {});
}
