import test from 'node:test';
import assert from 'node:assert/strict';
import {detectBotChallenge, fetchProduct, ManualEntryFallbackError} from '../lib/importer/fetch.ts';
import {extractProduct} from '../lib/importer/extract.ts';
import {extractVictoriasSecret, victoriasSecretRequest} from '../lib/importer/victoriassecret.ts';
import {isSupportedStoreHost, supportedStoreHosts} from '../lib/importer/stores.ts';
import {shopifyEndpoints} from '../lib/importer/shopify.ts';

const vsUrl = 'https://www.victoriassecret.com/us/pink/bras-catalog/5000010533/-/a/generic-11275561-choice-6AZK/marshmallow-push-up-wireless-comfy-bra-print';

function size(variantId, size1, original, sale) {
  return sale === undefined
    ? {variantId, size1, originalPrice: `$${original.toFixed(2)}`, originalPriceNumerical: original, priceType: 'regular', status: 'available', isAvailable: true}
    : {variantId, size1, originalPrice: `$${original.toFixed(2)}`, originalPriceNumerical: original, priceType: 'sale', salePrice: `$${sale.toFixed(2)}`, salePriceNumerical: sale, status: 'available', isAvailable: true};
}

const vsPayload = {
  storyComponents: [],
  product: {
    id: '5000010533', brandName: 'PINK', shortDescription: 'Marshmallow Push-Up Wireless Comfy Bra', categoryDisplay: 'Bras', classDisplay: 'Bras',
    isOutOfStock: false, allRestricted: false, featuredChoice: {choice: '71NR', genericId: '11275561'},
    productData: {
      '11275561': {
        choices: {
          '71NR': {label: 'Ganache', color: 'Brown', images: [{type: 'onModelFront', image: 'png/zz/26/07/02/00/1127556171NR_OM_F'}], availableSizes: {M: size('1', 'M', 46.95)}},
          '6AZK': {
            label: 'Black', color: 'Black',
            images: [{type: 'onModelFront', image: 'png/zz/26/06/12/01/112755616AZK_OM_F'}, {type: 'onModelBack', image: 'png/zz/26/06/12/01/112755616AZK_OM_B'}, {type: 'bad', image: '../evil'}],
            availableSizes: {L: size('27336516', 'L', 46.95, 30), M: size('27336515', 'M', 46.95, 30)},
            unavailableSizes: {XXL: {...size('27336520', 'XXL', 46.95, 30), status: 'unavailable', isAvailable: false}},
          },
        },
      },
    },
  },
};

test("a Victoria's Secret US link reads the storefront's own product document: selected colour, sizes with sale prices, photos", async () => {
  const request = victoriasSecretRequest(new URL(vsUrl));
  assert.equal(request.api.href, 'https://api.victoriassecret.com/products/v38/page/5000010533?activeCountry=US');
  assert.deepEqual([request.productId, request.choice, request.genericId], ['5000010533', '6AZK', '11275561']);
  const shared = victoriasSecretRequest(new URL('https://www.victoriassecret.com/us/vs/sleepwear-and-lingerie-catalog/5000010438?choice=73mp&genericId=11251019'));
  assert.deepEqual([shared.productId, shared.choice, shared.genericId], ['5000010438', '73MP', '11251019'], 'the colour also travels as query parameters');
  assert.equal(victoriasSecretRequest(new URL('https://www.victoriassecret.com/uz/pink/bras-catalog/5000010533')), undefined, 'only the US storefront prices in USD');
  assert.equal(victoriasSecretRequest(new URL('https://www.victoriassecret.com/us/pink/bras')), undefined);

  const calls = [];
  const fetcher = async input => {
    const url = new URL(String(input));
    calls.push(url.href);
    if (url.hostname === 'api.victoriassecret.com') return new Response(JSON.stringify(vsPayload), {status: 200, headers: {'Content-Type': 'application/json'}});
    return new Response('<html><head><title>Buy Marshmallow Bra - PINK US</title></head><body></body></html>', {status: 200, headers: {'Content-Type': 'text/html'}});
  };
  const product = await fetchProduct(vsUrl, fetcher);
  assert.equal(calls.length, 1, 'the page shell is not fetched when the document answers');
  assert.equal(product.method, "Victoria's Secret product API");
  assert.equal(product.title, 'Marshmallow Push-Up Wireless Comfy Bra');
  assert.equal(product.brand, 'PINK');
  assert.equal(product.currency, 'USD');
  assert.equal(product.price, 30);
  assert.equal(product.referencePrice, 46.95);
  assert.equal(product.selectedVariantColor, 'Black');
  assert.equal(product.country, 'США');
  assert.deepEqual(product.images, ['https://www.victoriassecret.com/p/760x1013/png/zz/26/06/12/01/112755616AZK_OM_F.jpg', 'https://www.victoriassecret.com/p/760x1013/png/zz/26/06/12/01/112755616AZK_OM_B.jpg']);
  assert.deepEqual(product.variants.map(v => [v.id, v.size, v.price, v.compareAtPrice, v.available]), [
    ['27336516', 'L', 30, 46.95, true], ['27336515', 'M', 30, 46.95, true], ['27336520', 'XXL', 30, 46.95, false],
  ]);
  assert.ok(product.variants.every(v => v.color === 'Black' && v.availabilityKnown === true));
  assert.ok(product.warnings.some(text => /Другие цвета этой модели \(1\)/.test(text)));

  // Without a colour in the link the featured colour is used; mismatched product ids are rejected.
  const featured = extractVictoriasSecret(vsPayload, 'https://www.victoriassecret.com/us/pink/bras-catalog/5000010533', {productId: '5000010533'});
  assert.equal(featured.selectedVariantColor, 'Ganache');
  assert.equal(featured.price, 46.95);
  assert.equal(featured.referencePrice, undefined);
  assert.equal(extractVictoriasSecret(vsPayload, vsUrl, {productId: '1'}), undefined);

  // A refused document leaves a manual-review draft with a clear block reason rather than a silent empty import.
  const blocked = async () => new Response('', {status: 403, headers: {'Content-Type': 'application/json'}});
  await assert.rejects(fetchProduct(vsUrl, blocked), error => error instanceof ManualEntryFallbackError && error.reason === 'blocked');
});

test('reCAPTCHA widgets and vendor scripts on a served product page are not a bot wall (Druni), real walls still are', () => {
  const druni = '<html><head><title>Perfume 100 ml | DRUNI</title><script src="https://www.google.com/recaptcha/api.js"></script><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Perfume","offers":{"@type":"Offer","price":"45.95","priceCurrency":"EUR"}}</script></head><body><div class="g-recaptcha" data-sitekey="x"></div><script>grecaptcha.ready(function(){});</script></body></html>';
  assert.equal(detectBotChallenge(druni), undefined);
  assert.equal(detectBotChallenge('<html><head><script src="/recaptcha/api.js"></script></head><body>Please complete the CAPTCHA to continue</body></html>'), 'CAPTCHA');
  assert.equal(detectBotChallenge('<html><head><title>Access Denied</title></head><body>Reference #18.abc</body></html>'), 'Akamai');
});

test('a JSON-LD name that is only a pack size (Douglas "30 ML") yields to the page title', () => {
  const html = '<html><head><title>Lancôme La Vie Est Belle Eau de Parfum | Douglas</title><meta property="og:title" content="Lancôme La Vie Est Belle Eau de Parfum"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"30 ML","image":"https://media.douglas.es/medias/x.jpg","offers":{"@type":"Offer","price":"93.89","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}</script></head><body></body></html>';
  const product = extractProduct(html, 'https://www.douglas.es/es/p/5010884091');
  assert.equal(product.title, 'Lancôme La Vie Est Belle Eau de Parfum');
  assert.equal(product.price, 93.89);
  assert.equal(product.currency, 'EUR');
  const named = extractProduct(html.replace('"name":"30 ML"', '"name":"La Vie Est Belle 30 ml"'), 'https://www.douglas.es/es/p/5010884091');
  assert.equal(named.title, 'La Vie Est Belle 30 ml');
  // Without og:title the page heading is used instead of the SEO <title> with marketing and the store suffix.
  const heading = extractProduct(html.replace(/<meta property="og:title"[^>]*>/, '').replace('<body></body>', '<body><h1 class="x">Prada Candy Eau de Parfum</h1></body>').replace('<title>Lancôme La Vie Est Belle Eau de Parfum | Douglas</title>', '<title>Prada Candy perfume ✔️ dulzura y feminidad atrevida | DOUGLAS</title>'), 'https://www.douglas.es/es/p/3000047020');
  assert.equal(heading.title, 'Prada Candy Eau de Parfum');
});

test("Charlotte Tilbury pages are read from their Next.js state: the linked shade is selected, siblings become options", () => {
  const ctItem = (title, subtitle, sku, href, value, available = 'AVAILABLE', listing = value) => ({
    title, subtitle, sku, href, availability: available, availableStock: available === 'AVAILABLE' ? 12 : 0, swatchVariant: 'SHADE',
    price: {purchasePrice: {value, currencyCode: 'USD'}, listingPrice: {value: listing, currencyCode: 'USD'}},
    image: {imageSrc: `//images.ctfassets.net/x/${sku}/open.png`}, images: [{imageSrc: `//images.ctfassets.net/x/${sku}/open.png`}, {imageSrc: `//images.ctfassets.net/x/${sku}/model.png`}],
  });
  const product = {...ctItem('PILLOW TALK AIRBRUSH FLAWLESS BLUSH BLUR', 'NAUGHTY TALK', 'FABBXX8X9RDU', 'airbrush-flawless-blush-blur-naughty-talk-1', 43, 'AVAILABLE', 48), category: 'Makeup/Face/Blush'};
  const siblings = [
    ctItem('PILLOW TALK AIRBRUSH FLAWLESS BLUSH BLUR', 'PILLOW TALK', 'FABBXX810RDU', 'airbrush-flawless-blush-blur-pillow-talk-1', 43, 'OUT_OF_STOCK'),
    ctItem('AIRBRUSH FLAWLESS FINISH', '1 FAIR', 'FPDRXX8X1R', 'airbrush-flawless-finish-1-fair', 50),
  ];
  const state = {props: {initialState: {page: {model: {product, siblings}}}, siblings}, query: {store: 'us', slug: product.href}};
  const html = `<html><head><title>Naughty Talk | Charlotte Tilbury</title></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(state)}</script></body></html>`;
  const url = 'https://www.charlottetilbury.com/us/product/airbrush-flawless-blush-blur-naughty-talk-1';
  const extracted = extractProduct(html, url);
  assert.equal(extracted.method, 'Charlotte Tilbury page data');
  assert.equal(extracted.title, 'Pillow Talk Airbrush Flawless Blush Blur');
  assert.equal(extracted.brand, 'Charlotte Tilbury');
  assert.equal(extracted.category, 'Красота и уход');
  assert.deepEqual([extracted.price, extracted.referencePrice, extracted.currency, extracted.country], [43, 48, 'USD', 'США']);
  assert.equal(extracted.selectedVariantColor, 'Naughty Talk');
  assert.deepEqual(extracted.images, ['https://images.ctfassets.net/x/FABBXX8X9RDU/open.png', 'https://images.ctfassets.net/x/FABBXX8X9RDU/model.png']);
  assert.deepEqual(extracted.variants.map(v => [v.id, v.color, v.price, v.compareAtPrice, v.available, v.availabilityKnown]), [
    ['FABBXX8X9RDU', 'Naughty Talk', 43, 48, true, true], ['FABBXX810RDU', 'Pillow Talk', 43, undefined, false, true],
  ], 'a different product in the sibling list is not an option of this one');
  assert.ok(extracted.warnings.some(text => /Другие оттенки этой модели \(1\)/.test(text)));
  // A state describing another slug than the link is rejected and the page falls through to the generic parser.
  let other;
  try { other = extractProduct(html, 'https://www.charlottetilbury.com/us/product/other-product'); } catch { other = undefined; }
  assert.notEqual(other?.method, 'Charlotte Tilbury page data');
  assert.equal(other?.price, undefined, 'no price is taken from a state that describes another product');
});

test('cosmetics storefronts confirmed live are allowlisted; MAC, Morphe and Tarte use the Shopify product document', () => {
  for (const host of ['www.arenal.com', 'www.elfcosmetics.com', 'www.maccosmetics.com', 'www.morphe.com', 'www.charlottetilbury.com', 'api.victoriassecret.com']) assert.ok(isSupportedStoreHost(host), host);
  assert.ok(supportedStoreHosts.includes('api.victoriassecret.com'));
  assert.ok(!isSupportedStoreHost('api2.victoriassecret.com'));
  for (const url of ['https://www.maccosmetics.com/products/ruby-woo-lipstick', 'https://www.morphe.com/products/x', 'https://tartecosmetics.com/products/bb-blur-tinted-moisturizer-spf-30']) {
    assert.ok(shopifyEndpoints(new URL(url)), url);
  }
});
