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
    if(!path) await page.locator('.guest-intro').waitFor();
    await page.waitForTimeout(350);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow: ${path || '/'} at ${width}`);
    if(width===1440||width===390) await page.screenshot({path:`outputs/design-live/${path||'home'}-${width}.png`,fullPage:true});
  }
  if(process.env.ATLAS_CHECK_OPERATOR==='1') {
    await page.goto('http://localhost:5173/signin-with-chatgpt?return_to=%2Fadmin');
    await page.locator('.admin-tabs').waitFor();
    for(const width of [1440,800,390,360]) for(const tab of ['Обзор','Каталог','Клиенты','Поддержка','Финансы','Команда','Правила','Система','Журнал']) {
      await page.setViewportSize({width,height:950});
      await page.getByRole('button',{name:tab,exact:true}).click();
      await page.waitForTimeout(100);
      if((width===390||width===1440)&&['Обзор','Каталог','Команда'].includes(tab)) await page.screenshot({path:`outputs/design-live/operator-${tab}-${width}.png`,fullPage:true});
      const overflow=await page.evaluate(()=>({width:document.documentElement.scrollWidth,culprits:[...document.querySelectorAll('body *')].filter(element=>element.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(element=>({className:typeof element.className==='string'?element.className:'',tag:element.tagName,right:Math.round(element.getBoundingClientRect().right)}))}));
      assert(overflow.width<=width,`Operator overflow: ${tab} at ${width}: ${JSON.stringify(overflow)}`);
    }
    await page.getByRole('button',{name:'Каталог',exact:true}).click();
    await page.getByRole('button',{name:'Создать',exact:true}).click();
    await page.getByRole('dialog',{name:'Новая подборка'}).waitFor();
    assert(await page.getByRole('button',{name:'Создать подборку'}).isDisabled());
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${process.env.ATLAS_CHECK_OPERATOR==='1'?'52 customer/operator':'16 customer'} route/width render checks; no page errors or horizontal overflow.`);
} finally {await browser.close();}
