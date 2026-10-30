import test from 'node:test';
import assert from 'node:assert/strict';
import { officialStoreBrand, officialStoreText } from '../lib/market/official-stores.ts';

const listing = (sellers, url = 'https://www.ebay.com/itm/158007867936') => ({ store: 'ebay.com', sourceUrl: url, sourceVariants: sellers.map((sellerId, index) => ({ label: String(index), available: true, ...(sellerId ? { sellerId } : {}) })) });

test('only the reviewed brand seller makes an eBay listing "official"', () => {
  assert.equal(officialStoreBrand(listing(['adidas_official', 'adidas_official'])), 'adidas');
  assert.equal(officialStoreBrand(listing(['ADIDAS_OFFICIAL'])), 'adidas');
  assert.equal(officialStoreBrand(listing(['sneaker_reseller'])), undefined, 'an adidas listing from anyone else is not official');
  assert.equal(officialStoreBrand(listing([undefined])), undefined, 'no seller recorded: nothing claimed');
  assert.equal(officialStoreBrand(listing(['adidas_official', 'other'])), undefined);
  assert.equal(officialStoreBrand(listing(['adidas_official'], 'https://www.adidas.com/us/x.html')), undefined, 'only on eBay');
  assert.deepEqual(officialStoreText('adidas', 'ru'), { short: 'Официальный adidas', full: 'Официальный магазин adidas на eBay' });
});
