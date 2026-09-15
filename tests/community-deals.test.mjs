import test from 'node:test';
import assert from 'node:assert/strict';
import {
  communityDeals,
  communityCatalogProducts,
  communityEstimatedWeight,
  communityFallbackOptions,
  communityProductCategory,
  hasSelectableDimensions,
} from '../lib/market/community-deals.ts';
import {findOrderUrl} from '../lib/market/catalog.ts';

test('every editorial deal has a usable cart fallback', () => {
  for (const deal of communityDeals) {
    assert.ok(deal.price > 0);
    assert.ok(communityEstimatedWeight(deal) > 0.5);
    assert.ok(communityFallbackOptions(deal).length > 0);
    assert.ok(communityProductCategory(deal));
  }
});

test('sized products expose choices while fixed products keep one variant', () => {
  const shoes = communityDeals.find(deal => deal.id === 'merrell-wrapt');
  const fixed = communityDeals.find(deal => deal.id === 'nyx-butter-gloss');
  assert.ok(shoes && communityFallbackOptions(shoes).some(option => option.size === 'US 10'));
  assert.deepEqual(fixed && communityFallbackOptions(fixed), [{ label: 'Указанный вариант' }]);
});

test('technical merchant variants do not count as size or colour choices', () => {
  assert.equal(hasSelectableDimensions([{ label: 'Default Title' }]), false);
  assert.equal(hasSelectableDimensions([{ label: 'US 10', size: 'US 10' }]), true);
});

test('editorial deals are ordinary catalog products with direct order intent', () => {
  assert.equal(communityCatalogProducts.length, communityDeals.length);
  for (const product of communityCatalogProducts) {
    assert.ok(product.sourceUrl && product.sourcePrice > 0 && product.image);
    const order = new URL(findOrderUrl(product), 'https://atlas.test');
    assert.equal(order.searchParams.get('url'), product.sourceUrl);
    assert.equal(order.searchParams.get('deal'), product.id);
  }
});
