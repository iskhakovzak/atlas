import test from 'node:test';
import assert from 'node:assert/strict';
import {applyMerchantProfile, merchantProfileForUrl, priorityMerchants} from '../lib/importer/merchant-profiles.ts';
import {allowedUrl} from '../lib/importer/fetch.ts';

test('priority merchant registry contains the requested US and European launch groups', () => {
  const p1 = priorityMerchants(1).map(item => item.root);
  const p2 = priorityMerchants(2).map(item => item.root);
  assert.deepEqual([...p1].sort(), [
    'amazon.com', 'nike.com', 'adidas.com', 'macys.com', 'ebay.com', 'walmart.com', 'target.com', 'bestbuy.com',
    'sephora.com', 'footlocker.com', 'victoriassecret.com', 'nordstrom.com', 'ulta.com', 'apple.com', 'newbalance.com',
    'hm.com', 'puma.com', 'uniqlo.com', 'bershka.com', 'gap.com', 'converse.com', 'vans.com', 'skechers.com',
    'crocs.com', 'columbia.com', 'thenorthface.com', 'underarmour.com', 'levi.com', 'pullandbear.com', 'tommy.com',
    'ralphlauren.com', 'carters.com', 'shop.simon.com',
  ].sort());
  for (const root of ['amazon.com', 'nike.com', 'adidas.com', 'macys.com', 'ebay.com', 'walmart.com', 'target.com', 'bestbuy.com', 'sephora.com', 'footlocker.com', 'victoriassecret.com', 'nordstrom.com', 'ulta.com', 'apple.com', 'newbalance.com']) assert.ok(p1.includes(root), root);
  for (const root of ['zalando.com', 'asos.com', 'zara.com', 'mango.com', 'farfetch.com', 'primor.eu', 'druni.es', 'mediamarkt.de', 'pccomponentes.com']) assert.ok(p2.includes(root), root);
  for (const root of ['sephora.es', 'es.victoriassecret.com', 'footlocker.es']) assert.ok(p2.includes(root), root);
});

test('regional aliases resolve to a single merchant profile without changing the source URL', () => {
  assert.equal(merchantProfileForUrl('https://www.amazon.com/dp/B000000000')?.root, 'amazon.com');
  assert.equal(merchantProfileForUrl('https://www.ebay.de/itm/123')?.root, 'ebay.com');
  assert.equal(merchantProfileForUrl('https://www.zalando.es/articulo')?.root, 'zalando.es');
  assert.equal(merchantProfileForUrl('https://en.zalando.de/articulo')?.root, 'zalando.de');
  assert.equal(allowedUrl('https://en.zalando.de/articulo').hostname, 'en.zalando.de');
  assert.throws(() => allowedUrl('https://arbitrary.zalando.de/articulo'));
  assert.equal(merchantProfileForUrl('https://www.perfumeriasprimor.eu/p/producto')?.root, 'perfumeriasprimor.eu');
  assert.equal(merchantProfileForUrl('https://www.footlocker.es/producto')?.root, 'footlocker.es');
  assert.equal(merchantProfileForUrl('https://www.sephora.com/product/example-P123456')?.defaultCountry, 'США');
  assert.equal(merchantProfileForUrl('https://www.sephora.es/p/producto-P123456.html')?.defaultCountry, 'Испания');
  assert.equal(merchantProfileForUrl('https://es.victoriassecret.com/es/vs/bras-catalog/5000009803')?.defaultCountry, 'Испания');
  assert.equal(allowedUrl('https://es.victoriassecret.com/es/vs/bras-catalog/5000009803').hostname, 'es.victoriassecret.com');
  assert.equal(allowedUrl('https://www.sephora.es/p/producto').hostname, 'www.sephora.es');
  assert.throws(() => allowedUrl('https://evil.victoriassecret.com/es/vs/bras-catalog/5000009803'));
  assert.equal(merchantProfileForUrl('https://example.test/product'), undefined);
});

test('profile enrichment fills only missing metadata and never invents commerce fields', () => {
  const sourceUrl = 'https://www.nike.com/us/t/example-shoe/DM4044-108';
  const result = applyMerchantProfile({sourceUrl, method: 'JSON-LD', warnings: [], price: 76.97, currency: 'USD', variants: []}, sourceUrl);
  assert.equal(result.brand, 'Nike');
  assert.equal(result.category, 'Обувь');
  assert.equal(result.country, 'США');
  assert.equal(result.price, 76.97);
  assert.equal(result.currency, 'USD');
  assert.equal(result.variants?.length, 0);
  assert.match(result.method, /Nike/);
});

test('explicit source metadata wins over a broad store profile', () => {
  const sourceUrl = 'https://www.macys.com/shop/product/example';
  const result = applyMerchantProfile({sourceUrl, method: 'JSON-LD', warnings: [], brand: 'Acme', category: 'Красота и уход', country: 'Канада', price: 12, currency: 'CAD'}, sourceUrl);
  assert.equal(result.brand, 'Acme');
  assert.equal(result.category, 'Красота и уход');
  assert.equal(result.country, 'Канада');
  assert.equal(result.price, 12);
});

test('incomplete manual data can be enriched without inventing a parser method or price',()=>{
  const sourceUrl='https://www.nike.com/t/example/IB1881-500';
  const result=applyMerchantProfile({sourceUrl,warnings:[]},sourceUrl);
  assert.equal(result.method,undefined);
  assert.equal(result.price,undefined);
  assert.equal(result.brand,'Nike');
});
