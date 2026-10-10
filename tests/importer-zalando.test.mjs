import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractZalandoProduct} from '../lib/importer/zalando.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/importer/zalando-public-group.json', import.meta.url), 'utf8'));
const ld = data => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
const source = fixture.sourceUrl;
const product = fixture.product;

test('captured Zalando group preserves exact colour, twenty size offers, currency and photos without a minimum quote', () => {
  const result = extractZalandoProduct(ld(product), source);
  assert.equal(result.method, 'Zalando public size offers');
  assert.equal(result.currency, 'EUR');
  assert.equal(result.country, 'Германия');
  assert.equal(result.selectedVariantColor, 'white');
  assert.equal(result.price, undefined);
  assert.equal(result.images.length, 7);
  assert.equal(result.variants.length, 20);
  assert.ok(result.variants.every(variant => variant.available && variant.availabilityKnown));
  assert.equal(result.variants.find(variant => variant.size === '50.5').price, 119.99);
  assert.equal(result.variants.find(variant => variant.size === '42').price, 95.95);
});

test('Zalando language-routing and verified article slug aliases preserve exact selected size price and identity', () => {
  const result = extractZalandoProduct(ld(product), `${fixture.originalUrl}?size=50.5&_rfl=de&utm_source=test`);
  assert.equal(result.price, 119.99);
  assert.equal(result.sku, 'NI112N022-A110160000');
  assert.equal(result.currency, 'EUR');
  assert.equal(result.variants.find(variant => variant.size === '42').price, 95.95);
  const uniform = structuredClone(product);
  uniform.hasVariant.forEach(child => { child.offers.price = '95.95'; });
  assert.equal(extractZalandoProduct(ld(uniform), source).price, 95.95);
});

test('Zalando rejects another article, colour query, regional root, unsafe URL or conflicting size query', () => {
  for (const url of [source.replace('ni112n022-a11', 'ni112n022-a12'), `${source}&color=red`, source.replace('en.zalando.de', 'www.zalando.fr'),
    source.replace('https:', 'http:'), source.replace('en.zalando.de', 'en.zalando.de.evil.example'), source.replace('en.zalando.de', 'www.en.zalando.de'),
    source.replace('en.zalando.de', 'user:secret@en.zalando.de'), source.replace('en.zalando.de', 'en.zalando.de:443'), `${source}&size=42&size=50.5`]) {
    assert.equal(extractZalandoProduct(ld(product), url), undefined, url);
  }
  const unrelated = structuredClone(product);
  unrelated.productGroupID = 'NI112N022-A12';
  assert.equal(extractZalandoProduct(ld(unrelated), source), undefined);
});

test('missing selected Zalando size leaves a safe manual partial with no other option price substituted', () => {
  const result = extractZalandoProduct(ld(product), `${source}&size=99`);
  assert.ok(result.title);
  assert.equal(result.price, undefined);
  assert.equal(result.currency, 'EUR');
  assert.ok(result.variants.every(variant => variant.price === undefined));
  assert.ok(result.warnings.some(warning => /Размер из ссылки не найден/.test(warning)));
});

test('mixed, missing and malformed child currencies cannot label prices with a parent currency', () => {
  for (const currency of ['USD', undefined, 'EURO']) {
    const changed = structuredClone(product);
    changed.hasVariant[1].offers.priceCurrency = currency;
    const result = extractZalandoProduct(ld(changed), `${source}&size=50.5`);
    assert.equal(result.currency, undefined);
    assert.equal(result.price, undefined);
    assert.ok(result.variants.every(variant => variant.price === undefined));
  }
});

test('Zalando keeps native stock uncertainty and does not import offers or pictures from unrelated children', () => {
  const changed = structuredClone(product);
  changed.hasVariant[0].offers.availability = 'https://schema.org/OutOfStock';
  delete changed.hasVariant[1].offers.availability;
  changed.hasVariant[2].url = changed.hasVariant[2].url.replace('ni112n022-a11', 'ni112n022-a12');
  changed.hasVariant[3].color = 'red';
  changed.hasVariant[4].image = ['https://127.0.0.1/private.jpg', 'http://images.example.com/unsafe.jpg'];
  const result = extractZalandoProduct(ld(changed), source);
  const out = result.variants.find(variant => variant.size === '38.5');
  assert.equal(out.available, false);
  assert.equal(out.availabilityKnown, true);
  assert.equal(result.variants.find(variant => variant.size === '39').availabilityKnown, false);
  assert.equal(result.variants.some(variant => variant.size === '40' || variant.size === '40.5'), false);
  assert.ok(result.images.every(image => !image.includes('127.0.0.1') && image.startsWith('https:')));
  assert.ok(result.variants.every(variant => !variant.image?.includes('127.0.0.1')));
});

test('ambiguous size offers and duplicated groups do not choose the first price or stock result', () => {
  const changed = structuredClone(product);
  changed.hasVariant[0].offers = [changed.hasVariant[0].offers, {...changed.hasVariant[0].offers, price:'1.00', availability:'https://schema.org/OutOfStock'}];
  let result = extractZalandoProduct(ld(changed), `${source}&size=38.5`);
  assert.equal(result.price, undefined);
  assert.equal(result.variants.find(variant => variant.size === '38.5').availabilityKnown, false);
  changed.hasVariant.push(structuredClone(changed.hasVariant[0]));
  result = extractZalandoProduct(ld(changed), `${source}&size=38.5`);
  assert.equal(result.price, undefined);
  assert.ok(result.variants.every(variant => variant.price === undefined));
  assert.equal(extractZalandoProduct(ld([product, structuredClone(product)]), source), undefined);
});

test('Zalando public-state parsing is bounded and never evaluates merchant expressions', () => {
  globalThis.atlasZalandoExecuted = false;
  assert.equal(extractZalandoProduct('<script type="application/ld+json">globalThis.atlasZalandoExecuted=true</script>', source), undefined);
  assert.equal(globalThis.atlasZalandoExecuted, false);
  assert.equal(extractZalandoProduct(ld({huge: 'x'.repeat(1_000_001), ...product}), source), undefined);
  assert.equal(extractZalandoProduct(ld({}).repeat(32) + ld(product), source), undefined);
  delete globalThis.atlasZalandoExecuted;
});

test('bounded Zalando option or offer truncation cannot manufacture a uniform parent quote', () => {
  const changed = structuredClone(product);
  changed.hasVariant = Array.from({length: 81}, (_, index) => ({...structuredClone(product.hasVariant[0]),
    size: String(index + 1), sku: `NI112N022-A11-${index}`, url: `${product.url}?size=${index + 1}`, '@id': `${product.url}?size=${index + 1}`,
    offers: {...product.hasVariant[0].offers, price: index === 80 ? '119.99' : '95.95'},
  }));
  const result = extractZalandoProduct(ld(changed), source);
  assert.equal(result.variants.length, 80);
  assert.equal(result.price, undefined);
  const offers = structuredClone(product);
  offers.hasVariant[0].offers = Array.from({length:17}, () => structuredClone(product.hasVariant[0].offers));
  const partial = extractZalandoProduct(ld(offers), `${source}&size=38.5`);
  assert.equal(partial.price, undefined);
  assert.equal(partial.currency, undefined);
});
