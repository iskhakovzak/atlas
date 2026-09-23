// Targeted visual check for the integrated Commerce direction.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.ATLAS_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true,...(process.env.ATLAS_CHROME?{executablePath:process.env.ATLAS_CHROME}:{})});
const errors=[];
const page=await browser.newPage();
page.on('pageerror',error=>errors.push(error.message));
await mkdir('outputs/design-live',{recursive:true});
try {
  for(const path of ['','order-by-link','cart','account']) for(const width of [1440,800,390,360]) {
    await page.setViewportSize({width,height:950});
    const response=await page.goto(`http://localhost:5173/${path}`,{waitUntil:'domcontentloaded'});
    assert(response?.ok(),`${path || '/'} returned ${response?.status()}`);
    await page.locator('main').first().waitFor();
    await page.waitForTimeout(350);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow: ${path || '/'} at ${width}`);
    if(width===1440||width===390) await page.screenshot({path:`outputs/design-live/${path||'home'}-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: 16 live route/width render checks; no page errors or horizontal overflow.');
} finally {await browser.close();}
