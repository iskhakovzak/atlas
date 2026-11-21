import test from 'node:test';
import assert from 'node:assert/strict';
import {languageSwitchHref,explicitLanguageReplacement} from '../lib/market/language-url.ts';

test('language selection preserves the import link, repeated filters and fragment',()=>{
 const source='https://www.ebay.com/itm/157817741627?var=459418063782&campid=1';
 const address='/order-by-link?url='+encodeURIComponent(source)+'&lang=ru&filter=a&filter=b#sizes';
 const result=new URL(languageSwitchHref(address,'en'),'https://atlas.local');
 assert.equal(result.pathname,'/order-by-link');
 assert.equal(result.searchParams.get('url'),source);
 assert.deepEqual(result.searchParams.getAll('filter'),['a','b']);
 assert.deepEqual(result.searchParams.getAll('lang'),['en']);
 assert.equal(result.hash,'#sizes');
});

test('language selection preserves checkout return and explicit pages stay changed on refresh',()=>{
 const destination='/cart/checkout?placed=order-1#payment';
 const href='https://atlasmarket.uz/login?return_to='+encodeURIComponent(destination)+'&lang=ru';
 const replaced=explicitLanguageReplacement(href,'uz');
 const query=new URL(replaced,'https://atlasmarket.uz').searchParams;
 assert.equal(query.get('return_to'),destination);
 assert.equal(query.get('lang'),'uz');
 assert.equal(explicitLanguageReplacement('/catalog?search=shoes#products','en'),null);
 assert.equal(languageSwitchHref('/catalog','oz'),'/catalog?lang=oz');
});
