import test from 'node:test';
import assert from 'node:assert/strict';
import { products, tariff, price, productSchema, blank } from '../lib/market/domain.ts';
import { merchantFinds, findOrderUrl } from '../lib/market/catalog.ts';
import { applyAction } from '../lib/market/actions.ts';
import { allowedUrl } from '../lib/importer/fetch.ts';
import { safeImage, extractProduct } from '../lib/importer/extract.ts';
import { dealQuote, filterDeals, defaultDealFilters } from '../lib/market/deals.ts';

test('merchant records retain unique identity, safe sources and unconfirmed shipping reserves', () => {
  assert.equal(new Set(merchantFinds.map(p => p.id)).size, merchantFinds.length);
  for (const p of merchantFinds) {
    assert(productSchema.safeParse(p).success);
    assert(allowedUrl(p.sourceUrl));
    assert.equal(safeImage(p.image, p.sourceUrl), p.image);
    assert.equal(p.sourcePrice, p.usd);
    assert.equal(p.shippingKnown, false);
    assert.equal(p.sourceShippingEstimated, true);
    assert.equal(p.sourceShippingUsd, 10);
    assert.equal(p.weight, Math.max(1, Math.round((p.boxedWeight + 0.5) * 100) / 100));
    assert.equal(new URL(findOrderUrl(p), 'https://atlas.test').searchParams.get('url'), p.sourceUrl);
    assert.throws(() => applyAction(blank(), {type:'cart-add',product:p,variant:p.variants[0]}, false), /доставку магазина/);
  }
});
test('merchant totals match checkout pricing and source-only discounts', () => {
  const p = merchantFinds.find(p => p.referenceUsd);
  const deal = dealQuote(p, tariff);
  assert.deepEqual(deal.costs, price(p.usd, p.weight, 1, 10, tariff));
  assert.equal(deal.savingsUsd, p.referenceUsd - p.usd);
  assert.equal(deal.discount, Math.round((p.referenceUsd - p.usd) / p.referenceUsd * 100));
  assert.equal(deal.costs.total, deal.costs.merchandise + deal.costs.service + deal.costs.sourceShipping + deal.costs.shipping + deal.costs.reserve);
  assert.equal(dealQuote(p, {...tariff, fx:14000}).discount, deal.discount);
});
test('reference prices never leak to legacy, changed or unrelated listings', () => {
  for (const p of products) assert.equal(dealQuote(p, tariff).discount, 0);
  const p = merchantFinds.find(p => p.referenceUsd);
  for (const changed of [{...p,usd:p.usd+1},{...p,sourceUrl:'https://nike.com/t/another'},{...p,id:'another'}])
    assert.equal(dealQuote(changed, tariff).referenceUsd, undefined);
});
test('merchant filters combine search, category, country and full delivered budget', () => {
  const p = merchantFinds.find(p => p.name === 'Nike Gato LV8');
  const quote = dealQuote(p, tariff);
  const filters = {...defaultDealFilters, search:' GATO ', category:'Обувь', country:'США', maxTotal:quote.costs.total};
  assert.deepEqual(filterDeals(merchantFinds, tariff, filters).map(x => x.product.id), [p.id]);
  assert.equal(filterDeals(merchantFinds, tariff, {...filters,maxTotal:quote.costs.total-1}).length, 0);
  assert.equal(filterDeals(merchantFinds, tariff, {...filters,country:'Испания'}).length, 0);
  const ascending = filterDeals(merchantFinds, tariff, {...defaultDealFilters,sort:'total-asc'});
  assert.deepEqual(ascending.map(x=>x.costs.total), ascending.map(x=>x.costs.total).sort((a,b)=>a-b));
});
test('ProductGroup selects linked color and retains size prices and availability', () => {
  const url='https://www.nike.com/t/shoe/BLUE';
  const child=(color,size,price,availability)=>({'@type':'Product',url:'https://www.nike.com/t/shoe/'+color,name:'Shoe '+color,color,size,image:'https://static.nike.com/'+color+'.jpg',offers:{url:'https://www.nike.com/t/shoe/'+color,price,priceCurrency:'USD',availability}});
  const html='<script type="application/ld+json">'+JSON.stringify({'@type':'ProductGroup',name:'Other default',brand:{name:'Nike'},hasVariant:[child('RED','8',10,'InStock'),child('BLUE','8',70,'InStock'),child('BLUE','9',75,'OutOfStock')]})+'</script>';
  const result=extractProduct(html,url);
  assert.equal(result.price,70); assert.equal(result.title,'Shoe BLUE'); assert.equal(result.brand,'Nike');
  assert.deepEqual(result.variants.map(v=>[v.label,v.price,v.available]),[['RED · 8',10,true],['BLUE · 8',70,true],['BLUE · 9',75,false]]);
  assert.equal(extractProduct(html,'https://www.nike.com/t/shoe/GREEN').price,undefined);
});
