import test from 'node:test';
import assert from 'node:assert/strict';
import {clearEbayTokenCacheForTests, fetchEbayProduct} from '../lib/importer/ebay.ts';
import {extractAdidasProduct, breadcrumbPath, boundedAspects} from '../lib/importer/extract.ts';
import {normalizeMerchantVariants} from '../lib/importer/variant-normalization.ts';
import {importDraft, recheckedDraft, changeCatalog, publicCatalog, catalogDraftSchema} from '../lib/market/catalog-editor.ts';
import {catalogFacetsVersion} from '../lib/market/catalog-facets.ts';
import {tariff} from '../lib/market/domain.ts';

const credentials = {clientId: 'app-client-id', clientSecret: 'private-cert-secret', environment: 'production'};
const json = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: {'Content-Type': 'application/json'}});

// Shaped like real eBay Browse items of the adidas_official store: the root path names shoes for everything,
// and Department / Type come after a long list of other specifics.
const filler = Array.from({length: 18}, (_, index) => ({type: 'STRING', name: `Feature ${index + 1}`, value: `Value ${index + 1}`}));
function browseItem({listingId, variationId = '0', title, categoryPath, aspects, color, size, amount = 12}) {
  return {
    itemId: `v1|${listingId}|${variationId}`, title, brand: 'adidas', categoryPath, categoryId: '11511',
    price: {value: String(amount), currency: 'USD'}, itemLocation: {country: 'US'},
    image: {imageUrl: 'https://i.ebayimg.com/images/g/main/s-l1600.jpg'},
    ...(color ? {color} : {}), ...(size ? {size} : {}),
    localizedAspects: aspects, seller: {username: 'adidas_official'},
    estimatedAvailabilities: [{estimatedAvailabilityStatus: 'IN_STOCK', estimatedAvailableQuantity: 8}],
    buyingOptions: ['FIXED_PRICE'],
  };
}
function browseApi({initialItem, items = []}) {
  return async input => {
    const url = new URL(String(input));
    if (url.pathname === '/identity/v1/oauth2/token') return json({access_token: 'test-access-token', expires_in: 3600});
    if (url.pathname === '/buy/browse/v1/item/get_item_by_legacy_id') return json(initialItem);
    if (url.pathname === '/buy/browse/v1/item/get_items_by_item_group') return json({items});
    throw new Error('Unexpected eBay API request: ' + url.pathname);
  };
}

test('a single eBay listing keeps its item specifics and category path; socks are clothes with a socks weight', async () => {
  clearEbayTokenCacheForTests();
  const listingId = '960071972638';
  const item = browseItem({
    listingId, title: 'adidas women Cushioned Quarter Socks 3 Pairs', color: 'White / Clear Onix', size: 'M',
    categoryPath: "Clothing, Shoes & Accessories|Women|Women's Intimates & Sleepwear|Socks",
    aspects: [{name: 'Size', value: 'M'}, {name: 'Brand', value: 'adidas'}, ...filler, {name: 'Department', value: 'Women'}, {name: 'Type', value: 'Socks'}, {name: 'Material', value: 'Polyester'}],
  });
  const extracted = normalizeMerchantVariants(await fetchEbayProduct(`https://www.ebay.com/itm/${listingId}`, credentials, browseApi({initialItem: item})));
  assert.equal(extracted.category, 'Одежда', 'the eBay root "Clothing, Shoes & Accessories" no longer makes socks shoes');
  assert.equal(extracted.categoryPath, "Clothing, Shoes & Accessories|Women|Women's Intimates & Sleepwear|Socks");
  assert.ok(extracted.aspects.length <= 40);
  for (const name of ['Department', 'Type', 'Material']) assert.ok(extracted.aspects.slice(0, 16).some(a => a.name === name), name + ' leads the item specifics');
  const options = extracted.variants[0].options;
  assert.ok(options.length <= 16);
  assert.deepEqual(options.slice(0, 2).map(o => o.name).sort(), ['Color', 'Size']);
  assert.ok(options.some(o => o.name === 'Department') && options.some(o => o.name === 'Type'), 'filter specifics survive the 16-option bound');

  const draft = importDraft(extracted, [], 'США', Date.parse('2026-10-31T00:00:00Z'));
  assert.equal(draft.category, 'Одежда');
  assert.equal(draft.facets.v, catalogFacetsVersion);
  assert.equal(draft.facets.type, 'socks');
  assert.equal(draft.facets.department, 'women');
  assert.equal(draft.facets.pack, 3);
  assert.deepEqual(draft.facets.colors, ['white']);
  assert.equal(draft.boxedWeight, 0.25, 'a three-pair pack of socks, not a 1.2 kg shoe box');
  assert.equal(draft.weightBasis, 'estimate');
  assert.ok(draft.aspects.length <= 24 && draft.aspects.some(a => a.name === 'Department'));
  assert.equal(draft.categoryPath, extracted.categoryPath);
});

test('an eBay variation group keeps Department, Type and Style on every option and on the listing', async () => {
  clearEbayTokenCacheForTests();
  const listingId = '960012345678';
  const aspects = (size, color) => [{name: 'Color', value: color}, {name: 'Size Type', value: 'Regular'}, {name: 'Size', value: size}, {name: 'Brand', value: 'adidas'}, ...filler, {name: 'Department', value: 'men'}, {name: 'Type', value: 'Jerseys'}, {name: 'Style', value: 'Jerseys'}, {name: 'Sleeve Length', value: 'Short Sleeve'}, {name: 'Material', value: 'see description'}];
  const child = (variationId, size, color) => browseItem({listingId, variationId, title: 'adidas men Tabela 23 Jersey', color, size, categoryPath: "Clothing, Shoes & Accessories|Men|Men's Clothing|Activewear|Activewear Tops", aspects: aspects(size, color), amount: 18});
  const items = [child('1', 'S', 'Team Navy Blue 2 / White'), child('2', 'M', 'Team Navy Blue 2 / White'), child('3', 'S', 'Team Power Red 2 / White')];
  const initialItem = {...items[0], primaryItemGroup: {itemGroupId: listingId, itemGroupType: 'SELLER_DEFINED_VARIATIONS', itemGroupTitle: 'adidas men Tabela 23 Jersey'}};
  const extracted = normalizeMerchantVariants(await fetchEbayProduct(`https://www.ebay.com/itm/${listingId}`, credentials, browseApi({initialItem, items})));
  assert.equal(extracted.category, 'Одежда');
  assert.equal(extracted.variants.length, 3);
  for (const variant of extracted.variants) {
    assert.ok(variant.options.length <= 16);
    for (const name of ['Department', 'Type', 'Style']) assert.ok(variant.options.some(o => o.name === name), name + ' kept on ' + variant.label);
  }
  const draft = importDraft(extracted, [], 'США');
  assert.equal(draft.facets.type, 'jerseys');
  assert.equal(draft.facets.department, 'men');
  assert.equal(draft.facets.sleeve, 'short');
  assert.deepEqual([...draft.facets.colors].sort(), ['blue', 'red']);
  assert.equal(draft.category, 'Одежда');
  assert.equal(draft.boxedWeight, 0.35);
});

test('eBay sneakers stay shoes and a store-published weight wins over the type estimate', async () => {
  clearEbayTokenCacheForTests();
  const listingId = '960099999999';
  const item = browseItem({listingId, title: 'adidas men Ultraboost 5 Running Shoes', color: 'Core Black', size: '10',
    categoryPath: "Clothing, Shoes & Accessories|Men|Men's Shoes|Athletic Shoes",
    aspects: [{name: 'US Shoe Size', value: '10'}, {name: 'Department', value: 'Men'}, {name: 'Type', value: 'Athletic'}, {name: 'Closure', value: 'Lace Up'}]});
  const extracted = await fetchEbayProduct(`https://www.ebay.com/itm/${listingId}`, credentials, browseApi({initialItem: item}));
  assert.equal(extracted.category, 'Обувь');
  const draft = importDraft(extracted, [], 'США');
  assert.equal(draft.facets.type, 'sneakers');
  assert.equal(draft.facets.sport, 'running');
  assert.equal(draft.boxedWeight, 1.2);
  const weighed = importDraft({...extracted, boxedWeight: 0.9}, [], 'США');
  assert.equal(weighed.boxedWeight, 0.9);assert.equal(weighed.weightBasis, 'store');
});

test('a store without item specifics still gets facets from the title and an item-type weight', () => {
  const draft = importDraft({sourceUrl: 'https://www.nike.com/t/club-hoodie/FN3859-657', title: "Nike Club Men's Pullover Fleece Hoodie", brand: 'Nike', category: 'Одежда', price: 50, currency: 'USD', variants: [{label: 'University Red · M', color: 'University Red', size: 'M', available: true, availabilityKnown: true, price: 50}], warnings: []}, [], 'США');
  assert.equal(draft.facets.type, 'hoodies');
  assert.equal(draft.facets.department, 'men');
  assert.deepEqual(draft.facets.colors, ['red']);
  assert.equal(draft.boxedWeight, 0.8);
  assert.equal(draft.aspects, undefined);
});

test('a recheck refreshes facets but keeps the editor category and weight', () => {
  const now = Date.parse('2026-10-31T00:00:00Z');
  const fresh = importDraft({sourceUrl: 'https://www.ebay.com/itm/960071972638', title: 'adidas women Cushioned Quarter Socks 3 Pairs', brand: 'adidas', category: 'Одежда', price: 6, currency: 'USD', aspects: [{name: 'Department', value: 'Women'}, {name: 'Type', value: 'Socks'}], variants: [{id: 'v1|960071972638|0', label: 'White · M', available: true, availabilityKnown: true, price: 6}], warnings: []}, [], 'США', now);
  const legacy = {...fresh, category: 'Обувь', boxedWeight: 1.2, weightBasis: 'estimate', facets: undefined, aspects: undefined};
  const updated = recheckedDraft(legacy, fresh);
  assert.equal(updated.category, 'Одежда', 'an inferred category follows the item type');
  assert.equal(updated.boxedWeight, 0.25, 'an estimate is replaced by the better estimate');
  assert.equal(updated.facets.type, 'socks');
  assert.deepEqual(updated.aspects, fresh.aspects);
  assert.deepEqual(updated.reviewReasons, [], 'facets, category and estimate are not review reasons');

  const edited = recheckedDraft({...legacy, category: 'Спорт', categoryBasis: 'operator', boxedWeight: 0.4, weightBasis: 'operator'}, fresh);
  assert.equal(edited.category, 'Спорт');assert.equal(edited.categoryBasis, 'operator');
  assert.equal(edited.boxedWeight, 0.4);assert.equal(edited.weightBasis, 'operator');
  assert.equal(edited.facets.type, 'socks');
});

test('editing marks a changed category as the editor\'s, re-derives facets and the public card carries them', () => {
  const now = Date.parse('2026-10-31T00:00:00Z');
  const draft = importDraft({sourceUrl: 'https://www.ebay.com/itm/960071972638', title: 'adidas women Cushioned Quarter Socks 3 Pairs', brand: 'adidas', category: 'Одежда', price: 6, currency: 'USD', aspects: [{name: 'Department', value: 'Women'}], variants: [{id: 'v1|960071972638|0', label: 'White · M', color: 'White', available: true, availabilityKnown: true, price: 6, image: 'https://i.ebayimg.com/images/g/a/s-l1600.jpg'}], image: 'https://i.ebayimg.com/images/g/a/s-l1600.jpg', warnings: []}, [], 'США', now);
  const document = {revision: 1, collections: [], entries: [{id: 'socks', draft, published: structuredClone(draft), publishedAt: now, queueState: 'published'}]};
  const sent = {...structuredClone(draft), category: 'Спорт', categoryBasis: undefined, facets: {v: 0, type: 'laptops'}, aspects: [{name: 'Injected', value: 'x'}]};
  const next = changeCatalog(document, {kind: 'edit', id: 'socks', draft: catalogDraftSchema.parse(sent)}, now);
  const entry = next.entries[0];
  assert.equal(entry.draft.category, 'Спорт');assert.equal(entry.draft.categoryBasis, 'operator');
  assert.equal(entry.draft.facets.type, 'socks', 'facets are the server\'s, not the browser\'s');
  assert.deepEqual(entry.draft.aspects, draft.aspects);
  const card = publicCatalog(next, tariff, now).products[0];
  assert.equal(card.facets.type, 'socks');assert.equal(card.facets.v, catalogFacetsVersion);
});

test('adidas product data names who the article is for and its kind', () => {
  const extracted = extractAdidasProduct({id: 'IF1234', name: 'Samba OG Shoes', color: 'Cloud White', price: 100, orderable: true, attribute_list: {gender: 'W', productType: ['Sneakers'], sport: ['Lifestyle'], category: 'Shoes', brand: 'Originals'}}, {itemList: {items: [{productId: 'IF1234', displayName: 'Samba OG Shoes', subTitle: "Women's Originals", availableSizes: ['7', '8'], price: 100, orderable: true}]}}, 'https://www.adidas.com/us/samba-og-shoes/IF1234.html');
  const byName = Object.fromEntries(extracted.aspects.map(a => [a.name, a.value]));
  assert.equal(byName.Department, 'Women');assert.equal(byName.Type, 'Sneakers');assert.equal(byName.Sport, 'Lifestyle');
  const draft = importDraft(extracted, [], 'США');
  assert.equal(draft.facets.department, 'women');assert.equal(draft.facets.type, 'sneakers');assert.equal(draft.category, 'Обувь');
});

test('breadcrumbs become a category path and aspects are bounded without repeats', () => {
  assert.equal(breadcrumbPath([{'@type': 'BreadcrumbList', itemListElement: [{position: 2, name: 'Women'}, {position: 1, name: 'Home'}, {position: 3, item: {name: 'Socks | Tights'}}]}]), 'Home|Women|Socks / Tights');
  const many = boundedAspects([{name: 'Color', value: 'Red'}, {name: 'color', value: 'Blue'}, {name: '', value: 'x'}, {name: 'Tags', value: ['a', 'b', 3]}, ...Array.from({length: 60}, (_, i) => ({name: 'N' + i, value: 'v'}))]);
  assert.equal(many.length, 40);
  assert.deepEqual(many.slice(0, 2), [{name: 'Color', value: 'Red'}, {name: 'Tags', value: 'a, b'}]);
});
