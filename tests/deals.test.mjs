import test from 'node:test';
import assert from 'node:assert/strict';
import { products, tariff, price } from '../lib/market/domain.ts';
import { dealQuote, filterDeals, defaultDealFilters } from '../lib/market/deals.ts';

test('deal totals match checkout pricing and discount compares merchandise only', () => {
  const deal = dealQuote(products[0], tariff);
  assert.deepEqual(deal.costs, price(products[0].usd, products[0].weight, 1, 0, tariff));
  assert.equal(deal.savingsUsd, 60);
  assert.equal(deal.discount, Math.round(60 / 159 * 100));
  assert.equal(deal.costs.total, deal.costs.merchandise + deal.costs.service + deal.costs.sourceShipping + deal.costs.shipping + deal.costs.reserve);
  const changedTariff = { ...tariff, perKg: tariff.perKg * 2, fx: 14000 };
  assert.equal(dealQuote(products[0], changedTariff).discount, deal.discount);
  assert.notEqual(dealQuote(products[0], changedTariff).costs.total, deal.costs.total);
});

test('illustrative comparison never becomes a claimed merchant discount', () => {
  const imported = { ...products[0], sourceUrl: 'https://www.nike.com/t/example', sourceShippingUsd: 10 };
  const deal = dealQuote(imported, tariff);
  assert.equal(deal.referenceUsd, undefined);
  assert.equal(deal.discount, 0);
  assert.equal(deal.costs.sourceShipping, 10 * tariff.fx);
  assert.equal(dealQuote({ ...products[0], usd: 200 }, tariff).discount, 0);
});

test('find filters combine country, category and delivered budget; sorting uses full cost', () => {
  const quote = dealQuote(products[0], tariff);
  assert.equal(filterDeals(products, tariff, { ...defaultDealFilters, category: 'Обувь', maxTotal: quote.costs.total - 1 }).length, 0);
  const selected = filterDeals(products, tariff, { ...defaultDealFilters, search: ' КРОССОВКИ ', country: 'США', category: 'Обувь', maxTotal: quote.costs.total });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].product.id, 'sneaker');
  assert.equal(filterDeals(products, tariff, { ...defaultDealFilters, category: 'Обувь', country: 'Испания' }).length, 0);
  const ascending = filterDeals(products, tariff, { ...defaultDealFilters, sort: 'total-asc' });
  assert.deepEqual(ascending.map(x => x.costs.total), ascending.map(x => x.costs.total).sort((a, b) => a - b));
  const descending = filterDeals(products, tariff, { ...defaultDealFilters, sort: 'total-desc' });
  assert.deepEqual(descending.map(x => x.product.id), ascending.map(x => x.product.id).reverse());
});
