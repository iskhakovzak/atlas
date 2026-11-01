import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDraft, serializeDraft, restoreMode } from '../lib/market/link-order-draft.ts';
import { productPath } from '../lib/market/catalog-links.ts';
import { productLd } from '../lib/seo/structured-data.ts';
import { productMetadata } from '../app/route-metadata.ts';
import { productDetailCopy } from '../lib/market/product-detail-copy.ts';

// Redesign stage 5 (1 November 2026): one product page for the catalog sheet, /catalog/p/[id] and /order-by-link.
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const now = 1_790_000_000_000;
const link = 'https://kyliecosmetics.com/products/matte-lip-kit';

test('a catalog card shown from its stored data keeps that status in its draft and is always applied again as a choice', () => {
  const raw = serializeDraft({
    done: false, owner: '', pageUrl: link, catalogId: 'find-1', dealId: '', url: link, source: link, name: 'Matte Lip Kit', brand: 'kylie', declaration: '',
    currency: 'USD', amount: '35', shipping: '10', shippingCurrency: 'USD', shippingEstimated: true, foundShipping: null, weight: '0.3', weightBasis: 'catalog',
    weightOrigin: 'Atlas', country: 'США', otherCountry: '', category: 'Красота и уход', variant: 'bare', variants: [{ label: 'bare', available: true, price: 35, color: 'bare' }],
    selectedColor: 'bare', selectedSize: '', image: '', images: [], showSourceForm: false, note: '', verified: false, sourceCheckStatus: 'catalog',
    importedAt: now - 60_000, sourceExpiresAt: undefined, picked: { bare: 1 }, manualQuantity: 1, comment: '',
  }, now);
  const draft = parseDraft(raw, now);
  assert.equal(draft?.sourceCheckStatus, 'catalog');
  assert.equal(restoreMode(draft, now), 'choices', 'a catalog card is never restored as a finished store check');
});

test('the product page address, its metadata and its JSON-LD', () => {
  assert.equal(productPath('find-1'), '/catalog/p/find-1');
  assert.equal(productPath('a b/c', 'en'), '/catalog/p/a%20b%2Fc?lang=en');
  const meta = productMetadata({ id: 'find-1', name: 'Matte Lip Kit', brand: 'Kylie', image: 'https://cdn.example/lip.jpg' }, '649 196 сум', 'ru', 'uz');
  assert.equal(meta.alternates.canonical, '/catalog/p/find-1?lang=ru');
  assert.equal(meta.alternates.languages['x-default'], '/catalog/p/find-1');
  assert.equal(meta.title, 'Kylie Matte Lip Kit');
  assert.match(meta.description, /649 196 сум до Ташкента/);
  assert.deepEqual(meta.robots.index, true);
  assert.equal(meta.openGraph.images[0].url, 'https://cdn.example/lip.jpg');
  const ld = productLd({ id: 'find-1', name: 'Matte Lip Kit', brand: 'Kylie', images: ['https://cdn.example/lip.jpg'], totalSoum: 649196 }, 'ru');
  assert.equal(ld['@type'], 'Product');
  assert.equal(ld.url, 'https://atlasmarket.uz/catalog/p/find-1?lang=ru');
  assert.equal(ld.offers.priceCurrency, 'UZS');
  assert.equal(ld.offers.price, 649196);
  assert.equal(ld.offers.availability, undefined, 'stock is never promised');
  assert.equal(ld.aggregateRating, undefined);
  assert.equal(productLd({ id: 'x', name: 'X', images: [] }, 'uz').offers, undefined);
  // Without a requested language the address is the canonical one, without ?lang; a photo is listed once.
  const plain = productLd({ id: 'find-1', name: 'Matte Lip Kit', images: ['https://cdn.example/a.jpg', 'https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'], totalSoum: 1 });
  assert.equal(plain['@id'], 'https://atlasmarket.uz/catalog/p/find-1');
  assert.equal(plain.offers.url, 'https://atlasmarket.uz/catalog/p/find-1');
  assert.deepEqual(plain.image, ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg']);
});

test('the product page copy exists in every language, Uzbek "dan" after the sum', () => {
  for (const locale of ['ru', 'uz', 'oz', 'en']) {
    const t = productDetailCopy[locale];
    for (const key of ['toTashkent', 'breakdown', 'item', 'service', 'total', 'about', 'deliveryTitle', 'checkout', 'checkPrice']) assert.ok(t[key], `${locale}.${key}`);
    assert.ok(t.noDuty('$200').includes('$200'));
  }
  assert.equal(productDetailCopy.uz.from, '');
  assert.equal(productDetailCopy.uz.fromAfter, 'dan');
  assert.match(productDetailCopy.oz.toTashkent, /[А-Яа-яЎўҚқҒғҲҳ]/, 'oz is Cyrillic');
});

test('wiring: the catalog opens the shared product page in place, without asking the store on opening', () => {
  const engine = source('app/global-link-order.tsx');
  assert.match(engine, /export function ProductOrder\(\{ mode = "link", product, inSheet = false \}/);
  assert.match(engine, /export function GlobalLinkOrder\(\) \{\n  return <ProductOrder \/>;/);
  // A current card is ready from its stored options; a dated one waits for a tap ("Сверить цену").
  assert.match(engine, /if\(seedReady\)\{\n      automaticallyLoaded\.current=loadKey;/);
  assert.match(engine, /if\(datedCatalog\)\{automaticallyLoaded\.current=loadKey;return\}/);
  assert.match(engine, /useClipboardLink\(requestedUrl, !catalogMode\)/, 'the sheet never reads the clipboard');
  // A changed store price still reloads the product with the customer's choice.
  assert.match(engine, /lastActionError\(\)\?\.code === "err_34"\) \{ reapply\.current = currentChoices\(\); void load\(requestedUrl \|\| source\); \}/);
  // After adding: a toast with "Оформить", the page stays (no jump to the cart).
  assert.match(engine, /toast\.success\(message, \{ action: \{ label: pd\.checkout, onClick: \(\) => router\.push\("\/cart"\) \} \}\);/);
  assert.doesNotMatch(engine, /\n    router\.push\("\/cart"\);/);
  // No tabs: "Из чего сумма" open, "О товаре" and "Доставка" stacked.
  assert.match(engine, /<SumBreakdown sums=\{previewSums\}/);
  assert.match(engine, /<DetailSection title=\{pd\.about\}/);
  assert.match(engine, /<DetailSection title=\{pd\.deliveryTitle\}/);
  assert.match(source('app/product-detail.tsx'), /<details className="pd-breakdown" open>/);
  const sheet = source('app/product-sheet.tsx');
  assert.match(sheet, /<ProductOrder key=\{[^}]+\} mode="catalog" product=\{product as MerchantFind\} inSheet\/>/);
  assert.doesNotMatch(sheet, /Tabs/);
  const card = source('app/catalog-card.tsx');
  assert.doesNotMatch(card, /findOrderUrl/, 'the card no longer sends "+" and "В корзину" to /order-by-link');
  assert.match(card, /href=\{productHref\} onClick=\{openFromLink\}/);
  const view = source('app/catalog-view.tsx');
  assert.match(view, /window\.history\.pushState\(window\.history\.state, '', productPath\(product\.id, language\)\)/);
  assert.match(view, /if \(pushedItem\.current\) \{ pushedItem\.current = false; window\.history\.back\(\); \}/);
  const page = source('app/catalog/p/[id]/page.tsx');
  assert.match(page, /if \(!found\) notFound\(\);/);
  assert.match(page, /<ProductOrder mode="catalog" product=\{product\} \/>/);
});

test('review fixes: a browsed catalog card leaves no draft, the dated sum is an estimate, the brand is clean, a guest can save', () => {
  const engine = source('app/global-link-order.tsx');
  // A catalog card's draft is written only after an add was tried (or one was left by an earlier try).
  assert.match(engine, /if\(catalogMode&&addTriedFor!==draftKey&&!draftRestored\.current\)return;/);
  assert.match(engine, /if \(catalogMode\) setAddTriedFor\(draftKey\);/);
  // The bottom bar names a dated sum as an estimate, with "≈".
  assert.match(engine, /datedSums \? pd\.approxTotal : heroFrom/);
  assert.match(engine, /\(datedSums \? "≈ " : ""\) \+ formatSum\(heroTotal, lang\)/);
  // The brand line goes through displayBrand, as on the catalog card.
  assert.match(engine, /displayBrand\(brand, storeName,/);
  assert.match(engine, /<p className="pd-brand">\{brandLine\}<\/p>/);
  // A guest's heart signs in and saves the card afterwards.
  assert.match(engine, /rememberPendingFavorite\(catalogStorage\(\), guestFavoriteId, Date\.now\(\)\)/);
  assert.match(engine, /loginPath\(catalogItemHref\("\/catalog", guestFavoriteId\)\)/);
  const css = source('app/styles/link-pages.css');
  assert.match(css, /\.pd-dated \{ display: grid;/);
  assert.match(css, /\.pd-in-sheet \.pd-dated \.btn \{ display: none; \}/);
  for (const locale of ['ru', 'uz', 'oz', 'en']) assert.ok(productDetailCopy[locale].approxTotal, locale);
  const page = source('app/catalog/p/[id]/page.tsx');
  assert.match(page, /const findProduct = cache\(/, 'one catalog read per request');
  assert.match(page, /<Marketplace view="products" crumb=\{product\.name\} crumbPath=\{productPath\(product\.id\)\}>/);
});

test('owner decision 2 November 2026: the bar button has one look on every width, no arrow on the page or in the sheet', () => {
  const engine = source('app/global-link-order.tsx');
  const bar = engine.split('\n').find((line) => line.includes('{awaitingCheck ? <button type="button" className="btn primary" onClick={checkDated}>'));
  assert.ok(bar, 'the pinned bar');
  assert.doesNotMatch(bar, /ArrowRight/, 'no arrow in the bar (check price, choose, add)');
  assert.match(engine, /onClick=\{focusChoice\}>\{nextChoiceText\}<\/button>/, 'the choose button has no arrow in the form either');
  const css = source('app/styles/link-pages.css');
  assert.doesNotMatch(css, /\.(lo-sticky|pd-bar-sheet)[^{]*\.btn > svg:last-child \{ display: none; \}/, 'no width hides an arrow any more');
  assert.match(css, /\.basket-sticky:not\(\.pd-bar\) \.btn > svg \{ display: none; \}/, 'the product bar keeps its spinner on narrow phones');
});
