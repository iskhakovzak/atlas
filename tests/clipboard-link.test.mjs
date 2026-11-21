import test from 'node:test';
import assert from 'node:assert/strict';
import { orderLinkIn, storeLinkIn } from '../lib/market/clipboard-link.ts';

test('a copied store link is offered; other text, other sites and unsafe links are not', () => {
  assert.equal(storeLinkIn('Look at this https://www.nike.com/t/club-hoodie/FN3859-657 via Nike'), 'https://www.nike.com/t/club-hoodie/FN3859-657');
  assert.equal(storeLinkIn('www.amazon.com/dp/B0CT2NQ7WG'), 'https://www.amazon.com/dp/B0CT2NQ7WG');
  assert.equal(storeLinkIn('my password 123'), '');
  assert.equal(storeLinkIn('https://example.org/item'), '');
  assert.equal(storeLinkIn('https://user:pass@www.nike.com/t/x'), '');
  assert.equal(storeLinkIn(''), '');
});

test('all order entry points accept a shared URL and keep the exact parameters of a pasted product URL', () => {
  const eBay = 'https://www.ebay.com/itm/157751149633?var=459304625551&customid=promo.';
  assert.equal(orderLinkIn(eBay), eBay);
  assert.equal(orderLinkIn(eBay.replace('https:', 'http:')), eBay);
  assert.equal(orderLinkIn('Модель: http://www.nike.com/t/club-hoodie/FN3859-657 далее'), 'https://www.nike.com/t/club-hoodie/FN3859-657');
  assert.equal(orderLinkIn('www.zara.com/es/es/prenda-p1.html?colorId=800'), 'https://www.zara.com/es/es/prenda-p1.html?colorId=800');
  assert.equal(orderLinkIn('https://example.org/item'), 'https://example.org/item', 'manual entry can use another public host');
  assert.equal(orderLinkIn('https://user:pass@www.nike.com/t/x'), '');
  assert.equal(orderLinkIn('https://www.nike.com:8443/t/x'), '');
  assert.equal(orderLinkIn('javascript:alert(1)'), '');
  const tracked = eBay + '&tracking=' + 'a'.repeat(2200);
  assert.equal(orderLinkIn(tracked), tracked, 'a standalone product link is not clipped at the share-text limit');
});
