import test from 'node:test';
import assert from 'node:assert/strict';
import { extractProduct } from '../lib/importer/extract.ts';
import { blockedSignal } from '../deploy/upcloud/merchant-engines.mjs';

// Shaped like Walmart's own page state (__NEXT_DATA__ → initialData.data.product), trimmed to what the importer reads.
const usd = (price) => ({ currentPrice: { price, currencyUnit: 'USD' } });
const image = (name) => ({ allImages: [{ url: `https://i5.walmartimages.com/asr/${name}.jpeg` }] });
const product = {
  usItemId: '19593716881', id: '6C2I6U9AV8LK', name: "George Men's Classic Fit Crewneck Tee", brand: 'George', availabilityStatus: 'IN_STOCK',
  category: { path: [{ name: 'Clothing' }, { name: 'Mens T-Shirts' }] }, sellerDisplayName: 'Walmart.com',
  priceInfo: { ...usd(5.98), wasPrice: { price: 7.5, currencyUnit: 'USD' } }, imageInfo: image('tee'),
  variantCriteria: [
    { name: 'Color', variantList: [{ id: 'actual_color-blue', name: 'Work Shirt Blue' }, { id: 'actual_color-black', name: 'Black Soot' }] },
    { name: 'Clothing Size', variantList: [{ id: 'clothing_size-l', name: 'L' }, { id: 'clothing_size-xl', name: 'XL' }] },
  ],
  variantsMap: {
    A: { usItemId: '19593716881', productUrl: '/ip/GE-SOLID-CREW-TEE/19593716881', variants: ['actual_color-blue', 'clothing_size-l'], priceInfo: usd(5.98), availabilityStatus: 'IN_STOCK', imageInfo: image('blue') },
    B: { usItemId: '19593716882', productUrl: '/ip/GE-SOLID-CREW-TEE/19593716882', variants: ['actual_color-blue', 'clothing_size-xl'], priceInfo: usd(6.48), availabilityStatus: 'OUT_OF_STOCK', imageInfo: image('blue') },
    C: { usItemId: '19593716883', productUrl: '/ip/GE-SOLID-CREW-TEE/19593716883', variants: ['actual_color-black', 'clothing_size-l'], priceInfo: usd(5.98), availabilityStatus: 'IN_STOCK', imageInfo: image('black') },
  },
};
const page = (data, padding = 0) => `<!DOCTYPE html><html><head><script>window._pxAppId='PXu6b0qd2S';</script></head><body>${' '.repeat(padding)}<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { initialData: { data: { product: data } } } } })}</script></body></html>`;
const url = 'https://www.walmart.com/ip/GE-SOLID-CREW-TEE/19593716881';

test('Walmart page state gives every colour and size with its own link, price and stock; the linked item is selected', () => {
  const p = extractProduct(page(product), url);
  assert.equal(p.method, 'Walmart product state');
  assert.equal(p.title, "George Men's Classic Fit Crewneck Tee");
  assert.equal(p.price, 5.98);
  assert.equal(p.referencePrice, 7.5);
  assert.equal(p.currency, 'USD');
  assert.equal(p.selectedVariantId, '19593716881');
  assert.equal(p.selectedVariantColor, 'Work Shirt Blue');
  assert.equal(p.variantsComplete, true);
  assert.deepEqual(p.variants.map((v) => [v.label, v.color, v.size, v.price, v.available, v.sourceUrl]), [
    ['Work Shirt Blue · L', 'Work Shirt Blue', 'L', 5.98, true, url],
    ['Work Shirt Blue · XL', 'Work Shirt Blue', 'XL', 6.48, false, 'https://www.walmart.com/ip/GE-SOLID-CREW-TEE/19593716882'],
    ['Black Soot · L', 'Black Soot', 'L', 5.98, true, 'https://www.walmart.com/ip/GE-SOLID-CREW-TEE/19593716883'],
  ]);
});

test('a Walmart product without options is the linked item; another item on the page is not taken for it', () => {
  const plain = { ...product, variantCriteria: [], variantsMap: {} };
  const p = extractProduct(page(plain), url);
  assert.equal(p.method, 'Walmart product state');
  assert.deepEqual(p.variants.map((v) => [v.id, v.price, v.available]), [['19593716881', 5.98, true]]);
  const other = extractProduct(page(plain), 'https://www.walmart.com/ip/Other/1111111111');
  assert.notEqual(other?.method, 'Walmart product state');
  const marketplace = extractProduct(page({ ...plain, sellerDisplayName: 'Gadget Hub LLC' }), url);
  assert.match(marketplace.warnings.join(' '), /сторонний продавец/);
});

test('the proxy keeps a full Walmart page with PerimeterX config; a small PerimeterX page is still a wall', () => {
  assert.equal(blockedSignal(200, undefined, 'text/html', Buffer.from(page(product, 70_000))), undefined);
  assert.equal(blockedSignal(200, undefined, 'text/html', Buffer.from('<html><script>window._pxUuid="x"</script>PerimeterX</html>')), 'perimeterx');
  assert.equal(blockedSignal(200, undefined, 'text/html', Buffer.from('<div id="px-captcha"></div>' + ' '.repeat(70_000))), 'perimeterx');
});
