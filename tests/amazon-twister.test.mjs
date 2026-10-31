import test from 'node:test';
import assert from 'node:assert/strict';
import {extractProduct} from '../lib/importer/extract.ts';
import {mergeLoadedVariants, priceLoadable} from '../lib/importer/link-selection.ts';

const asins = {'4|Black': 'B0AAAAAAA1', '5|Black': 'B0AAAAAAA2', '4|Red\/White': 'B0AAAAAAA3', '5|Red\/White': 'B0AAAAAAA4'};
const display = Object.fromEntries(Object.entries(asins).map(([key, asin]) => [asin, key.split('|')]));
const page = (current) => `<html><div id="bylineInfo_feature_div" data-csa-c-content-id="bylineInfo"><style>.premium-logoByLine-brand-logo { max-height: 36px; }</style><a id="brandLogoBylineLink" href="/stores/adidas"><img alt="adidas" class="premium-logoByLine-brand-logo" id="brandLogoHiResByline" title="Visit the adidas Store"/></a></div><span id="productTitle">adidas Men's Slide</span>
<div id="corePrice_feature_div"><span class="a-offscreen">$60.00</span></div>
<div id="availability">In Stock</div>
<script>var data = {"currentAsin" : "${current}", "parentAsin" : "B0PARENT01",
 "variationValues" : {"size_name":["4","5"],"color_name":["Black","Red\/White"]},
 "dimensions" : ["size_name","color_name"],
 "dimensionValuesDisplayData" : ${JSON.stringify(display)}};</script>
<ul><li data-asin="B0AAAAAAA1" data-initiallyUnavailable="false" class="x"></li><li data-asin="B0AAAAAAA2" data-initiallyUnavailable="true" class="x"></li></ul>
<script>P.when('A').register('ImageBlockATF', function(A){ var data = {"landingAsinColor":"Black","colorImages":{"Black":[{"hiRes":"https://m.media-amazon.com/images/I/black1._AC_SL1500_.jpg","large":"https://m.media-amazon.com/images/I/black1._AC_.jpg"}],"Red\/White":[{"hiRes":null,"large":"https://m.media-amazon.com/images/I/red1._AC_.jpg"}]}}; });</script></html>`;

test('Amazon twister: every child ASIN as an option, the open one priced, the rest loadable', async () => {
  const result = await extractProduct(page('B0AAAAAAA1'), 'https://www.amazon.com/dp/B0AAAAAAA1?th=1&psc=1');
  assert.equal(result.variantScope, 'group');
  assert.equal(result.brand, 'adidas');
  assert.equal(result.selectedVariantId, 'B0AAAAAAA1');
  assert.equal(result.selectedVariantColor, 'Black');
  assert.deepEqual(result.variants.map(v => v.label), ['4 · Black', '5 · Black', '4 · Red/White', '5 · Red/White']);
  const [open, sold, other] = result.variants;
  assert.equal(open.price, 60);
  assert.equal(open.id, 'B0AAAAAAA1');
  assert.equal(sold.available, false);
  assert.equal(sold.availabilityKnown, true);
  assert.equal(other.price, undefined);
  assert.equal(other.availabilityKnown, false);
  assert.equal(other.sourceUrl, 'https://www.amazon.com/dp/B0AAAAAAA3?th=1&psc=1');
  assert.equal(other.color, 'Red/White');
  assert.ok(priceLoadable(other, 'https://www.amazon.com/dp/B0AAAAAAA1'));
  assert.ok(!priceLoadable(open));
  assert.deepEqual(result.colorwayImages.map(g => g.color), ['Black', 'Red/White']);
  assert.match(other.image, /red1/);
});

test('A sibling page fills in the price it knows and never forgets a known one', async () => {
  const first = await extractProduct(page('B0AAAAAAA1'), 'https://www.amazon.com/dp/B0AAAAAAA1?th=1&psc=1');
  const second = await extractProduct(page('B0AAAAAAA3'), 'https://www.amazon.com/dp/B0AAAAAAA3?th=1&psc=1');
  const merged = mergeLoadedVariants(first.variants, second.variants);
  assert.equal(merged.length, 4);
  assert.equal(merged.find(v => v.id === 'B0AAAAAAA3').price, 60);
  assert.equal(merged.find(v => v.id === 'B0AAAAAAA1').price, 60);
  // The second page did not see B0AAAAAAA2's swatch: the known "sold out" stays.
  assert.equal(merged.find(v => v.id === 'B0AAAAAAA2').available, false);
  const added = mergeLoadedVariants(first.variants.slice(0, 3), second.variants);
  assert.deepEqual(added.map(v => v.label), ['4 · Black', '5 · Black', '4 · Red/White', '5 · Red/White']);
});
