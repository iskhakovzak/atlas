// Run with ATLAS_PLAYWRIGHT_MODULE pointing to an installed Playwright module.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.ATLAS_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true, ...(process.env.ATLAS_CHROME ? {executablePath:process.env.ATLAS_CHROME}: {})});
const page = await browser.newPage();
const errors=[];
page.on('pageerror', error=>errors.push(error.message));
await mkdir('outputs/design-review',{recursive:true});
let checked=0;
try {
  for(const theme of ['commerce','editorial','refined']) for(const screen of ['catalog','product','cart','account']) for(const lang of ['ru','uz','en']) for(const width of [1440,800,390,360]) {
    await page.setViewportSize({width,height:1000});
    await page.goto(`http://127.0.0.1:4318/screen.html?theme=${theme}&screen=${screen}&lang=${lang}`);
    await page.locator('h1').waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow: ${theme}/${screen}/${lang}/${width}`);
    await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
    if(lang==='ru' && (width===1440 || width===390)) await page.screenshot({path:`outputs/design-review/${theme}-${screen}-${width}.png`,fullPage:true});
    checked++;
  }
  await page.goto('http://127.0.0.1:4318/');
  const frame=page.frameLocator('#preview');
  await page.locator('[data-screen="product"]').click();
  await frame.locator('[data-size="41"]').click();
  await page.locator('#locale').selectOption('uz');
  assert.equal(await frame.locator('[data-size="41"]').getAttribute('aria-pressed'),'true');
  await frame.locator('[data-action="add"]').click();
  assert(await frame.locator('[data-action="checkout"]').isDisabled());
  await frame.locator('#consent').check();
  await frame.locator('[data-action="checkout"]').click();
  await frame.locator('[data-action="checkout"]').click();
  await frame.locator('#announcement.visible').waitFor();
  await page.locator('[data-screen="account"]').click();
  await frame.locator('.account-disclosure [data-section="addresses"]').click();
  assert(await frame.locator('#panel-addresses').isVisible());
  assert(await frame.locator('#panel-documents').isHidden());
  for(const state of ['empty','loading','error']) { await page.locator('#state').selectOption(state); await frame.locator('.state-panel').waitFor(); }
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${checked} responsive screen/language combinations, images, size persistence, cart consent, isolated accordion and preview states.`);
} finally { await browser.close(); }
