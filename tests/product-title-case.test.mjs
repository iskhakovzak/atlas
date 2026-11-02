import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { displayCase, displayOptionValue, displayVariantLabel, productTitle, upperFirst, withoutRepeatedBrand } from '../lib/market/product-name.ts';
import { variantSummary } from '../lib/market/variant-label.ts';

// Names from the live catalog (atlasmarket.uz/api/catalog, 3 November 2026) and what the screens show.
const live = [
  ['adidas women ADIDAS CRAZY LITE AOP TANK Top', 'adidas Crazy Lite AOP Tank Top'],
  ['adidas men ULTIMATE365 JACQUARD POLO SHIRT', 'adidas Ultimate365 Jacquard Polo Shirt'],
  ['adidas men M C CUSHIONED 3 3-PACK QUARTER', 'adidas M C Cushioned 3 3-Pack Quarter'],
  ['adidas men WORKOUT ESSENTIALS BASE T-SHIRT', 'adidas Workout Essentials Base T-Shirt'],
  ['adidas kids SS CAP SLEEVE TEE', 'adidas SS Cap Sleeve Tee'],
  ['adidas kids SHARE THE LOVE TEE', 'adidas Share the Love Tee'],
  ['adidas kids LS HOODED SNOW HTHR TEE 26', 'adidas LS Hooded Snow HTHR Tee 26'],
  ['adidas kids ADIDAS DISNEY VILLAINS OVERSIZED WASHED GFX TEE', 'adidas Disney Villains Oversized Washed GFX Tee'],
  ['adidas men ADIDAS X COCA-COLA ADILETTE OG CF SLIDES', 'adidas X Coca-Cola Adilette OG CF Slides'],
  ['adidas women WHERE ARE MY SUPERSTARS WMNS TEE', 'adidas Where Are My Superstars WMNS Tee'],
  ['adidas men ULTIMATE365+ GO-TO PRINT POLO SHIRT', 'adidas Ultimate365+ Go-To Print Polo Shirt'],
  ['adidas men ADISTAR HRMY SHOES', 'adidas Adistar HRMY Shoes'],
  ['adidas women LIGHTBLAZE Shoes', 'adidas Lightblaze Shoes'],
  ['adidas men FIFA WORLD CUP 26™ GRAPHIC BUCKET HAT', 'adidas FIFA World Cup 26™ Graphic Bucket Hat'],
  ['adidas men ADIDAS Z.N.E. T-SHIRT', 'adidas Z.N.E. T-Shirt'],
  ['adidas women ADI365 Running Iconic High-Rise Shorts', 'adidas ADI365 Running Iconic High-Rise Shorts'],
  ['adidas men LOVB Nebraska Graphic T-Shirt', 'adidas LOVB Nebraska Graphic T-Shirt'],
  ['adidas men X_PLR Path Shoes', 'adidas X_PLR Path Shoes'],
  ['adidas men SL 72 RS SHOES', 'adidas SL 72 RS Shoes'],
  ['adidas men Adidas Basketball Crazy Warm Fleece Pants', 'adidas Basketball Crazy Warm Fleece Pants'],
  ['adidas women Optimé Essentials Stash Pocket Full-Length Leggings', 'adidas Optimé Essentials Stash Pocket Full-Length Leggings'],
  ['adidas men Men\'s Argentina Tournament 5-Panel', 'adidas Men\'s Argentina Tournament 5-Panel'],
];

test('live catalog names read as one style: brand once, shouting words recased, codes and acronyms kept', () => {
  for (const [name, shown] of live) assert.equal(productTitle(name, 'adidas'), shown, name);
});

test('the card title without the brand starts with a capital', () => {
  assert.equal(productTitle('adidas women ADIDAS CRAZY LITE AOP TANK Top', 'adidas', { withoutBrand: 'adidas' }), 'Crazy Lite AOP Tank Top');
  assert.equal(upperFirst('crazy lite shorts'), 'Crazy lite shorts');
  assert.equal(productTitle('Apple iPhone 15 Pro', 'Apple', { withoutBrand: 'Apple' }), 'iPhone 15 Pro');
});

test('all-lowercase and all-caps titles, brands in their own spelling, inner capitals untouched', () => {
  assert.equal(productTitle('nike air max 90 essential', 'Nike'), 'Nike Air Max 90 Essential');
  assert.equal(productTitle('NIKE DUNK LOW RETRO', 'Nike'), 'Nike Dunk Low Retro');
  assert.equal(productTitle('PUMA SUEDE CLASSIC XXI', 'PUMA'), 'PUMA Suede Classic XXI');
  assert.equal(productTitle('ugg classic mini boot', 'UGG'), 'UGG Classic Mini Boot');
  assert.equal(productTitle('lululemon align high-rise pant 25"', 'lululemon'), 'lululemon Align High-Rise Pant 25"');
  assert.equal(productTitle('apple iphone 15 pro max 256gb', 'Apple'), 'Apple iPhone 15 Pro Max 256GB');
  assert.equal(productTitle('eBay gift card', 'eBay'), 'eBay Gift Card');
  assert.equal(productTitle('Apple AirPods Pro (2nd generation)', 'Apple'), 'Apple AirPods Pro (2nd generation)');
  assert.equal(productTitle('SAMSUNG 65" OLED 4K SMART TV QN65S90D', 'Samsung'), 'Samsung 65" OLED 4K Smart TV QN65S90D');
  assert.equal(productTitle('LEGO STAR WARS MILLENNIUM FALCON 75192', 'LEGO'), 'LEGO Star Wars Millennium Falcon 75192');
  assert.equal(productTitle('USB-C CHARGING CABLE WITH LED', 'Anker'), 'USB-C Charging Cable with LED');
  assert.equal(displayCase("O'NEILL HYPERFREAK BOARDSHORTS"), "O'Neill Hyperfreak Boardshorts");
  assert.equal(displayCase("MEN'S T-SHIRT"), "Men's T-Shirt");
  assert.equal(displayCase('КРОССОВКИ БЕГОВЫЕ ДЛЯ ЗАЛА'), 'Кроссовки Беговые для Зала');
});

test('the brand repeated after itself leaves once; a brand alone is kept', () => {
  assert.equal(withoutRepeatedBrand('adidas ADIDAS Originals Tee', 'adidas'), 'adidas Originals Tee');
  assert.equal(withoutRepeatedBrand('adidas · adidas Z.N.E. Shorts', 'adidas'), 'adidas Z.N.E. Shorts');
  assert.equal(withoutRepeatedBrand('adidas adidas', 'adidas'), 'adidas adidas');
  assert.equal(withoutRepeatedBrand('Nike Nikeland Socks', 'Nike'), 'Nike Nikeland Socks');
});

test('option values: letter sizes in capitals, one size, colours per word, numbers and codes kept', () => {
  for (const [value, shown] of [['s', 'S'], ['xl', 'XL'], ['2xl', '2XL'], ['xxl', 'XXL'], ['s/m', 'S/M'], ['3XLT', '3XLT'], ['onesize', 'One size'], ['OS', 'One size'], ['one size', 'One size'], ['OSFA', 'One size'], ['10.5', '10.5'], ['34', '34'], ['12K', '12K']])
    assert.equal(displayOptionValue(value, 'size'), shown, value);
  assert.equal(displayOptionValue('OSFW', 'size'), 'OSFW');
  assert.equal(displayOptionValue('BLACK / WHITE', 'color'), 'Black / White');
  assert.equal(displayOptionValue('collegiate navy', 'color'), 'Collegiate Navy');
  assert.equal(displayOptionValue('Black /White', 'color'), 'Black / White');
  assert.equal(displayOptionValue('black and white', 'color'), 'Black and White');
  assert.equal(displayOptionValue('Core Black / Cloud White', 'color'), 'Core Black / Cloud White');
  assert.equal(displayOptionValue('White / Clear Onix', 'color'), 'White / Clear Onix');
  assert.equal(displayOptionValue('128GB'), '128GB');
  assert.equal(displayVariantLabel('BLACK / WHITE · xl'), 'Black / White · XL');
});

test('the shared variant label shows recased values; the stored options stay as the store wrote them', () => {
  const options = [{ name: 'Color', value: 'BLACK / WHITE' }, { name: 'Size', value: 'xl' }, { name: 'Department', value: 'women' }];
  assert.equal(variantSummary('BLACK / WHITE · xl', options), 'Black / White · XL');
  assert.equal(options[0].value, 'BLACK / WHITE');
  assert.equal(variantSummary('collegiate navy · m'), 'Collegiate Navy · M');
});

test('the cart line has no separate heart: «Отложить» moves the item to favourites, the bin removes it', () => {
  const cart = readFileSync(new URL('../app/shopping.tsx', import.meta.url), 'utf8');
  const keep = cart.slice(cart.indexOf('function keepActions'), cart.indexOf('function itemNotes'));
  assert.ok(keep.includes('basket-later'), 'save for later stays');
  assert.doesNotMatch(keep, /basket-fav|<Heart/);
  assert.doesNotMatch(cart, /className=\{"basket-fav/);
});

test('every customer screen shows the product name through productTitle', () => {
  for (const file of ['app/shopping.tsx', 'app/checkout-view.tsx', 'app/checkout-review.tsx', 'app/guest-cart-view.tsx', 'app/parcel-view.tsx', 'app/catalog-card.tsx', 'app/global-link-order.tsx']) {
    const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.match(source, /productTitle\(/, file);
    assert.doesNotMatch(source, /withoutDepartment\(/, file);
  }
});
