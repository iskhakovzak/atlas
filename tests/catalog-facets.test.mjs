import test from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogFacetsVersion, catalogFacetsSchema, deriveCatalogFacets, categoryFromFacets, weightForFacets, colorFamily, facetDefinitions, facetValueLabel,
} from '../lib/market/catalog-facets.ts';

const opt = (name, value) => ({ name, value });
const derive = (title, extra = {}) => deriveCatalogFacets({ title, category: 'Обувь', brand: 'adidas', ...extra });
const pick = (facets, ...keys) => Object.fromEntries(keys.map((key) => [key, facets[key]]));

test('adidas eBay listings from the prod snapshot: aspects first, title refines', () => {
  const socks = derive('adidas men M CUSHIONED X 4 3-PACK QUARTER SOCKS', { variants: [{ label: 'White / Clear Onix · L', options: [opt('Size', 'L')] }] });
  assert.deepEqual(pick(socks, 'v', 'type', 'department', 'pack', 'colors'), { v: catalogFacetsVersion, type: 'socks', department: 'men', pack: 3, colors: ['white'] });
  assert.equal(categoryFromFacets(socks, 'Обувь'), 'Одежда');

  const pairs = derive('adidas women Cushioned Quarter Socks 3 Pairs');
  assert.deepEqual(pick(pairs, 'type', 'department', 'pack'), { type: 'socks', department: 'women', pack: 3 });
  // "3 3-PACK QUARTER": the eBay Type names the item, the model number is not a pack.
  const quarter = derive('adidas men M C CUSHIONED 3 3-PACK QUARTER', { aspects: [opt('Department', 'men'), opt('Type', 'Socks'), opt('Material', 'see description')] });
  assert.deepEqual(pick(quarter, 'type', 'pack', 'material'), { type: 'socks', pack: 3, material: undefined });

  const jersey = derive('adidas kids Tabela 23 Jersey', { aspects: [opt('Department', 'Boys'), opt('Type', 'Jerseys')] });
  assert.deepEqual(pick(jersey, 'type', 'department', 'sport', 'sleeve'), { type: 'jerseys', department: 'kids', sport: 'football', sleeve: 'short' });

  const polo = derive('adidas women Ultimate365 Solid Sleeveless Polo Shirt', { aspects: [opt('Department', 'women'), opt('Type', 'Tank Tops')] });
  assert.deepEqual(pick(polo, 'type', 'sport', 'sleeve'), { type: 'tshirts', sport: 'golf', sleeve: 'sleeveless' });

  const leggings = derive('adidas women All Me 5-Inch Short Leggings', { aspects: [opt('Department', 'women'), opt('Style', 'Shorts')] });
  assert.equal(leggings.type, 'leggings');
  assert.equal(derive('adidas women Optimé Skort With Integrated Bike Shorts', { aspects: [opt('Type', 'Skirts & Dresses')] }).type, 'skirts');
  assert.equal(derive('adidas kids ADIDAS DISNEY MINNIE MOUSE T-SHIRT SET', { aspects: [opt('Type', 'Matching Set')] }).type, 'sets');
  assert.equal(derive('adidas men FIFA World Cup 26™ Match Ball Graphic T-Shirt').type, 'tshirts');
  assert.equal(derive('adidas men FIFA World Cup 26™ Trionda Training Foil Ball').type, 'balls');

  const shoes = derive('adidas men Daily 4.0 Shoes', {
    aspects: [opt('Department', 'men'), opt('Closure', 'Lace Up'), opt('Upper Material', '"see description"')],
    variants: [{ color: 'Clay / Core Black / Core White' }, { color: 'Core Black / Cloud White' }, { color: 'Core Black / Gum' }],
  });
  assert.deepEqual(pick(shoes, 'type', 'department', 'sport', 'closure', 'colors'), { type: 'sneakers', department: 'men', sport: 'lifestyle', closure: 'laces', colors: ['black', 'brown'] });
  assert.equal(categoryFromFacets(shoes, 'Обувь'), 'Обувь');
  // A shoe listing whose title names only the model: the shoe aspects decide.
  assert.equal(derive('adidas men Streettalk', { aspects: [opt('US Shoe Size', '9'), opt('Closure', 'Lace Up')] }).type, 'sneakers');
  assert.deepEqual(pick(derive('adidas women Duramo SL 2 Wide Running Shoes'), 'type', 'sport', 'fit'), { type: 'sneakers', sport: 'running', fit: 'wide' });
  assert.equal(derive('adidas kids Goletto IX Laceless Firm/Multi-Ground Soccer Cleats Kids', { aspects: [opt('Closure', 'Lace Up')] }).closure, 'slip-on');
  assert.equal(derive('adidas men Adilette Aqua Slides', { aspects: [opt('Closure', 'Lace Up')] }).closure, undefined);
  assert.equal(derive('adidas kids GALAXY 8 SHOES INFANT').department, 'baby');
  assert.equal(derive('adidas women Essentials 3-Stripes Slim Baby Tee').department, 'women');
});

test('department: eBay values, title words, explicit unisex', () => {
  assert.equal(derive('Tee', { aspects: [opt('Department', 'Unisex Adult')] }).department, 'unisex');
  assert.equal(derive('Tee', { aspects: [opt('Department', 'Girls')] }).department, 'kids');
  assert.equal(derive('Tee', { aspects: [opt('Department', 'Baby & Toddler')] }).department, 'baby');
  assert.equal(derive('Tee', { variants: [{ options: [opt('Department', 'men')] }, { options: [opt('Department', 'women')] }] }).department, 'unisex');
  assert.equal(derive('adidas men Dugout Short Sleeve Hoodie (Gender Neutral)', { aspects: [opt('Department', 'men')] }).department, 'unisex');
  assert.equal(derive('Youth Microfiber Boxer Briefs 4-Pack').department, 'kids');
  assert.equal(derive('Футболка женская хлопковая оверсайз').department, 'women');
  assert.equal(derive('Spider-Man Graphic Tee').department, undefined);
});

test('Big & Tall is a fit only when every size row is one', () => {
  const mixed = derive('adidas men Axis Training Tee', { variants: [{ options: [opt('Size Type', 'Regular')] }, { options: [opt('Size Type', 'Big & Tall')] }] });
  assert.equal(mixed.fit, undefined);
  assert.equal(derive('Training Tee', { variants: [{ options: [opt('Size Type', 'Big & Tall')] }] }).fit, 'plus');
  assert.equal(derive('adidas women Optime Workout 1/1 Leggings (Plus Size)').fit, 'plus');
  assert.equal(derive('adidas men Essentials Fleece Regular Tapered Pants').fit, 'regular');
});

test('electronics: type, storage, no clothing facets', () => {
  const phone = derive('Samsung Galaxy S24 Ultra 512GB Titanium Black', { category: 'Электроника' });
  assert.deepEqual(pick(phone, 'type', 'storage', 'department', 'sport'), { type: 'smartphones', storage: '512gb', department: undefined, sport: undefined });
  assert.equal(derive('adidas kids Galaxy 8 Junior Shoes').type, 'sneakers');
  assert.deepEqual(pick(derive('Apple MacBook Air 13" M3 8GB RAM 256GB SSD'), 'type', 'storage'), { type: 'laptops', storage: '256gb' });
  assert.deepEqual(pick(derive('PlayStation 5 Slim Console 1TB'), 'type', 'storage'), { type: 'consoles', storage: '1tb' });
  assert.equal(derive('Apple AirPods Pro 2 with MagSafe Charging Case').type, 'headphones');
  assert.equal(derive('iPhone 15 Silicone Case with MagSafe').type, 'tech-accessories');
  assert.equal(derive('Чехол для iPhone 15').type, 'tech-accessories');
  assert.equal(derive('Apple Watch Series 9 GPS 45mm').type, 'smartwatches');
  assert.equal(derive('Apple Watch Band Sport Loop').type, 'tech-accessories');
  assert.equal(derive('Casio G-Shock Watch').type, 'watches');
  assert.equal(derive('Смартфон Xiaomi Redmi Note 13 256 ГБ').storage, '256gb');
  assert.equal(derive('Wireless earbuds', { aspects: [opt('Type', 'Earbud (In Ear)')] }).type, 'headphones');
  assert.equal(categoryFromFacets(phone, 'Другое'), 'Электроника');
});

test('beauty: type and volume', () => {
  assert.deepEqual(pick(derive('Dior Sauvage Eau de Parfum 100ml for Men'), 'type', 'volume', 'department'), { type: 'fragrance', volume: '100ml', department: 'men' });
  assert.equal(derive('Chanel Coco Mademoiselle Eau de Parfum 3.4 fl oz').volume, '100ml');
  assert.deepEqual(pick(derive('The Ordinary Niacinamide 10% + Zinc 1% Serum 30ml'), 'type', 'volume'), { type: 'skincare', volume: '30ml' });
  assert.equal(derive('Maybelline Lash Sensational Mascara').type, 'makeup');
  assert.equal(derive('Крем для тела 200 мл').type, 'bodycare');
  assert.equal(derive('Гель для душа').type, 'bodycare');
  assert.equal(derive('OPI Nail Lacquer Big Apple Red').type, 'nails');
  assert.equal(derive('Dyson Airwrap Multi-Styler').type, 'haircare');
  const vitamins = derive('Nature Made Vitamin D3 2000 IU 100 Tablets');
  assert.deepEqual(pick(vitamins, 'type', 'pack'), { type: 'vitamins', pack: undefined });
  assert.equal(categoryFromFacets(vitamins, 'Другое'), 'Красота и уход');
  // A colour named "Cream" is not a skincare product.
  assert.equal(derive('adidas Samba OG Shoes Cream White').type, 'sneakers');
});

test('home and sport equipment', () => {
  assert.equal(derive('Dyson V15 Detect Cordless Vacuum').type, 'home-appliances');
  assert.equal(derive('Ninja Air Fryer 4 qt').type, 'kitchen');
  assert.equal(derive('LEGO Star Wars Millennium Falcon').type, 'toys');
  assert.deepEqual(pick(derive('Wilson Evolution Basketball'), 'type', 'sport'), { type: 'balls', sport: 'basketball' });
  assert.deepEqual(pick(derive('Nike Mercurial Vapor 15 Elite FG Football Boots'), 'type', 'sport'), { type: 'cleats', sport: 'football' });
  assert.equal(derive('North Face Nuptse Puffer Jacket Women').type, 'coats');
  const gloves = derive('Predator Goalkeeper Gloves');
  assert.equal(categoryFromFacets(gloves, 'Аксессуары'), 'Спорт');
  assert.equal(categoryFromFacets(derive('Knit Winter Gloves'), 'Аксессуары'), 'Аксессуары');
  assert.equal(categoryFromFacets(derive('Stanley Quencher Tumbler 40 oz'), 'Дом и быт'), 'Спорт');
});

test('colorFamily: store names, first colour wins, Russian', () => {
  const cases = {
    'Core Black / Cloud White': 'black', 'Cloud White / Core Black': 'white', 'Clear Onix': 'grey', 'Better Scarlet': 'red', 'Collegiate Navy': 'blue',
    'Legend Ink / White': 'blue', 'Putty Mauve / Core White / Gum': 'purple', 'Olive Strata / Black': 'green', 'Pure Tangerine Mel. / Lucid Tangerine': 'orange',
    'Team Navy Blue 2 / White': 'blue', 'Medium Grey Heather': 'grey', 'Stone Khaki': 'beige', 'Wonder Cargo / Clay': 'beige', 'Ash Green': 'green',
    'Silver Metallic': 'silver', 'Gold Metallic': 'gold', 'Multicolor / Medium Grey Heather': 'multi', 'Black White': 'black', 'Off White': 'white',
    'Чёрный': 'black', 'синий': 'blue', 'Серебристый': 'silver', 'Тёмно-зелёный': 'green', 'Бежевый': 'beige',
  };
  for (const [name, family] of Object.entries(cases)) assert.equal(colorFamily(name), family, name);
  assert.equal(colorFamily(''), undefined);
  assert.equal(colorFamily('Regular'), undefined);
});

test('weightForFacets: by type, pack and age', () => {
  assert.equal(weightForFacets({ v: 1, type: 'socks', pack: 3 }), 0.25);
  assert.equal(weightForFacets({ v: 1, type: 'socks', pack: 6 }), 0.4);
  assert.equal(weightForFacets({ v: 1, type: 'tshirts' }), 0.3);
  assert.equal(weightForFacets({ v: 1, type: 'shorts' }), 0.35);
  assert.equal(weightForFacets({ v: 1, type: 'hoodies' }), 0.8);
  assert.equal(weightForFacets({ v: 1, type: 'sneakers' }), 1.2);
  assert.ok(weightForFacets({ v: 1, type: 'sneakers', department: 'kids' }) < 1.2);
  assert.equal(weightForFacets({ v: 1, type: 'smartphones', department: 'kids' }), 0.6);
  assert.equal(weightForFacets({ v: 1, type: 'kitchen' }), undefined);
  assert.equal(weightForFacets({ v: 1 }), undefined);
});

test('categoryFromFacets keeps the current category when the type is unknown', () => {
  assert.equal(categoryFromFacets({ v: 1 }, 'Обувь'), 'Обувь');
  assert.equal(categoryFromFacets({ v: 1, type: 'caps' }, 'Обувь'), 'Аксессуары');
  assert.equal(categoryFromFacets({ v: 1, type: 'backpacks' }, 'Обувь'), 'Аксессуары');
  assert.equal(categoryFromFacets({ v: 1, type: 'balls' }, 'Обувь'), 'Спорт');
  assert.equal(categoryFromFacets({ v: 1, type: 'no-such-type' }, 'Другое'), 'Другое');
});

test('schema keeps valid facets and strips junk', () => {
  const parsed = catalogFacetsSchema.parse({
    v: 1, department: 'aliens', type: 'Sneakers', sport: '<script>', pack: 1, fit: 'x'.repeat(80), colors: ['black', 'black', 'plaid', 7], storage: '256gb', volume: '1.5l', extra: 'drop me',
  });
  assert.deepEqual(parsed, { v: 1, type: 'sneakers', colors: ['black'], storage: '256gb', volume: '1.5l' });
  assert.equal(catalogFacetsSchema.safeParse({ type: 'socks' }).success, false);
  const derived = derive('adidas men M CUSHIONED X 4 3-PACK QUARTER SOCKS');
  assert.deepEqual(catalogFacetsSchema.parse(derived), derived);
});

test('dictionary: every value has ru/uz/en labels, slugs are unique, labels fall back', () => {
  const keys = facetDefinitions.map((d) => d.key);
  assert.deepEqual(new Set(keys).size, keys.length);
  for (const definition of facetDefinitions) {
    for (const locale of ['ru', 'uz', 'en']) assert.ok(definition.label[locale], `${definition.key} ${locale}`);
    const slugs = definition.values.map((v) => v.slug);
    assert.equal(new Set(slugs).size, slugs.length, definition.key);
    for (const value of definition.values) for (const locale of ['ru', 'uz', 'en']) assert.ok(value.label[locale], `${definition.key}.${value.slug} ${locale}`);
  }
  assert.equal(facetValueLabel('type', 'sneakers', 'ru'), 'Кроссовки и кеды');
  assert.equal(facetValueLabel('type', 'socks', 'uz'), 'Paypoqlar');
  assert.equal(facetValueLabel('department', 'kids', 'en'), 'Kids');
  assert.equal(facetValueLabel('color', 'black', 'ru'), 'Чёрный');
  assert.equal(facetValueLabel('pack', '3', 'ru'), '3 шт. в наборе');
  assert.equal(facetValueLabel('storage', '256gb', 'ru'), '256 ГБ');
  assert.equal(facetValueLabel('storage', '1tb', 'en'), '1 TB');
  assert.equal(facetValueLabel('volume', '50ml', 'ru'), '50 мл');
  assert.equal(facetValueLabel('type', 'brand-new-kind', 'en'), 'Brand new kind');
  // Every type the derivation can emit is in the dictionary.
  const types = new Set(facetDefinitions.find((d) => d.key === 'type').values.map((v) => v.slug));
  for (const title of ['Socks', 'Shoes', 'iPhone 15', 'Perfume', 'Air Fryer', 'Lego', 'Ball', 'Yoga Mat']) assert.ok(types.has(derive(title).type), title);
});
