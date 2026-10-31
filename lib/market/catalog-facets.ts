import { z } from 'zod';

// Catalog filter facets derived from a product's store data (eBay aspects, title, category path).
// Derivation runs on the server at import; the labels below are read in the browser, so the rule
// tables are compiled lazily and the module imports nothing but zod.

export const catalogFacetsVersion = 1;

export type FacetDepartment = 'men' | 'women' | 'kids' | 'baby' | 'unisex';
export type CatalogFacets = { v: number; department?: FacetDepartment; type?: string; sport?: string; material?: string; pack?: number; fit?: string; closure?: string; sleeve?: string; storage?: string; volume?: string; colors?: string[] };
export type FacetKey = 'department' | 'type' | 'sport' | 'material' | 'pack' | 'fit' | 'closure' | 'sleeve' | 'storage' | 'volume' | 'color';
type Label = { ru: string; uz: string; en: string };
type FacetLocale = 'ru' | 'uz' | 'en';
type Pair = { name: string; value: string };
export type FacetInput = { title: string; category: string; brand?: string; categoryPath?: string; aspects?: Pair[]; variants?: { color?: string; label?: string; options?: Pair[] }[] };

const departments = ['men', 'women', 'kids', 'baby', 'unisex'] as const;
const colorFamilies = ['black', 'white', 'grey', 'beige', 'brown', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'silver', 'gold', 'multi'] as const;

const slug = z.string().trim().toLowerCase().max(40).regex(/^[a-z0-9][a-z0-9.-]*$/);
const loose = <T extends z.ZodTypeAny>(schema: T) => schema.optional().catch(undefined);
export const catalogFacetsSchema = z.object({
  v: z.number().int().min(0).max(10000),
  department: loose(z.enum(departments)),
  type: loose(slug), sport: loose(slug), material: loose(slug), fit: loose(slug), closure: loose(slug), sleeve: loose(slug), storage: loose(slug), volume: loose(slug),
  pack: loose(z.number().int().min(2).max(100)),
  colors: loose(z.array(z.unknown()).max(64).transform((list) => { const out = [...new Set(list.filter((c): c is string => typeof c === 'string' && (colorFamilies as readonly string[]).includes(c)))]; return out.length ? out : undefined; })),
}).transform((facets) => Object.fromEntries(Object.entries(facets).filter(([, value]) => value !== undefined)) as CatalogFacets);

// ---------- Dictionary (ordered as the filter panel shows it) ----------

const L = (ru: string, uz: string, en: string): Label => ({ ru, uz, en });
const ATLAS = { shoes: 'Обувь', clothes: 'Одежда', tech: 'Электроника', acc: 'Аксессуары', beauty: 'Красота и уход', home: 'Дом и быт', sport: 'Спорт', other: 'Другое' } as const;

// slug, label, Atlas category, boxed kg of one item (undefined = too varied to guess)
const typeTable: [string, Label, string, number | undefined][] = [
  ['sneakers', L('Кроссовки и кеды', 'Krossovka va kedlar', 'Sneakers'), ATLAS.shoes, 1.2],
  ['cleats', L('Бутсы', 'Butsalar', 'Cleats'), ATLAS.shoes, 1.1],
  ['slides', L('Шлёпанцы и сандалии', 'Shippak va sandallar', 'Slides & sandals'), ATLAS.shoes, 0.7],
  ['boots', L('Ботинки и сапоги', 'Botinka va etiklar', 'Boots'), ATLAS.shoes, 1.8],
  ['shoes', L('Туфли и балетки', 'Tufli va baletkalar', 'Dress shoes & flats'), ATLAS.shoes, 1],
  ['tshirts', L('Футболки и поло', 'Futbolka va polo', 'T-shirts & polos'), ATLAS.clothes, 0.3],
  ['tanks', L('Майки и топы', 'Mayka va toplar', 'Tank tops'), ATLAS.clothes, 0.25],
  ['shirts', L('Рубашки и лонгсливы', 'Ko‘ylak va longslivlar', 'Shirts & long sleeves'), ATLAS.clothes, 0.4],
  ['jerseys', L('Джерси и форма', 'Jersi va sport formasi', 'Jerseys'), ATLAS.clothes, 0.35],
  ['hoodies', L('Худи и свитшоты', 'Xudi va svitshotlar', 'Hoodies & sweatshirts'), ATLAS.clothes, 0.8],
  ['sweaters', L('Свитеры и кардиганы', 'Sviter va kardiganlar', 'Sweaters & cardigans'), ATLAS.clothes, 0.7],
  ['jackets', L('Куртки и олимпийки', 'Kurtka va olimpiykalar', 'Jackets'), ATLAS.clothes, 0.9],
  ['coats', L('Пальто и пуховики', 'Palto va puxoviklar', 'Coats & puffers'), ATLAS.clothes, 1.5],
  ['pants', L('Брюки и джоггеры', 'Shim va joggerlar', 'Pants & joggers'), ATLAS.clothes, 0.6],
  ['jeans', L('Джинсы', 'Jinsi shimlar', 'Jeans'), ATLAS.clothes, 0.8],
  ['shorts', L('Шорты', 'Shortilar', 'Shorts'), ATLAS.clothes, 0.35],
  ['leggings', L('Леггинсы и тайтсы', 'Leggins va taytslar', 'Leggings & tights'), ATLAS.clothes, 0.35],
  ['skirts', L('Юбки', 'Yubkalar', 'Skirts'), ATLAS.clothes, 0.4],
  ['dresses', L('Платья', 'Liboslar', 'Dresses'), ATLAS.clothes, 0.5],
  ['sets', L('Костюмы и комплекты', 'Kostyum va to‘plamlar', 'Sets & tracksuits'), ATLAS.clothes, 1],
  ['underwear', L('Нижнее бельё', 'Ichki kiyim', 'Underwear'), ATLAS.clothes, 0.2],
  ['bras', L('Спортивные топы и бра', 'Sport toplari va byustgalterlar', 'Sports bras'), ATLAS.clothes, 0.2],
  ['socks', L('Носки', 'Paypoqlar', 'Socks'), ATLAS.clothes, 0.15],
  ['swimwear', L('Купальники и плавки', 'Suzish kiyimlari', 'Swimwear'), ATLAS.clothes, 0.3],
  ['bags', L('Сумки', 'Sumkalar', 'Bags'), ATLAS.acc, 0.8],
  ['backpacks', L('Рюкзаки', 'Ryukzaklar', 'Backpacks'), ATLAS.acc, 1.2],
  ['caps', L('Кепки и панамы', 'Kepka va panamalar', 'Caps & hats'), ATLAS.acc, 0.3],
  ['beanies', L('Шапки', 'Shapkalar', 'Beanies'), ATLAS.acc, 0.2],
  ['gloves', L('Перчатки', 'Qo‘lqoplar', 'Gloves'), ATLAS.acc, 0.3],
  ['scarves', L('Шарфы', 'Sharflar', 'Scarves'), ATLAS.acc, 0.3],
  ['belts', L('Ремни', 'Kamarlar', 'Belts'), ATLAS.acc, 0.3],
  ['wallets', L('Кошельки', 'Hamyonlar', 'Wallets'), ATLAS.acc, 0.25],
  ['sunglasses', L('Очки', 'Ko‘zoynaklar', 'Sunglasses & eyewear'), ATLAS.acc, 0.3],
  ['watches', L('Часы', 'Soatlar', 'Watches'), ATLAS.acc, 0.4],
  ['jewelry', L('Украшения', 'Taqinchoqlar', 'Jewelry'), ATLAS.acc, 0.15],
  ['smartphones', L('Смартфоны', 'Smartfonlar', 'Smartphones'), ATLAS.tech, 0.6],
  ['laptops', L('Ноутбуки', 'Noutbuklar', 'Laptops'), ATLAS.tech, 2.8],
  ['tablets', L('Планшеты', 'Planshetlar', 'Tablets'), ATLAS.tech, 1.2],
  ['headphones', L('Наушники', 'Quloqchinlar', 'Headphones'), ATLAS.tech, 0.6],
  ['smartwatches', L('Смарт-часы и браслеты', 'Aqlli soat va bilaguzuklar', 'Smartwatches & trackers'), ATLAS.tech, 0.5],
  ['speakers', L('Колонки', 'Kolonkalar', 'Speakers'), ATLAS.tech, 1.5],
  ['consoles', L('Игровые приставки', 'O‘yin pristavkalari', 'Game consoles'), ATLAS.tech, 5],
  ['cameras', L('Камеры', 'Kameralar', 'Cameras'), ATLAS.tech, 1.2],
  ['monitors', L('Мониторы и телевизоры', 'Monitor va televizorlar', 'Monitors & TVs'), ATLAS.tech, 6],
  ['tech-accessories', L('Аксессуары для техники', 'Texnika aksessuarlari', 'Tech accessories'), ATLAS.tech, 0.3],
  ['skincare', L('Уход за лицом', 'Yuz parvarishi', 'Skincare'), ATLAS.beauty, 0.3],
  ['makeup', L('Макияж', 'Pardoz', 'Makeup'), ATLAS.beauty, 0.2],
  ['fragrance', L('Парфюмерия', 'Atirlar', 'Fragrance'), ATLAS.beauty, 0.5],
  ['haircare', L('Уход за волосами', 'Soch parvarishi', 'Hair care'), ATLAS.beauty, 0.6],
  ['bodycare', L('Уход за телом', 'Tana parvarishi', 'Body care'), ATLAS.beauty, 0.5],
  ['nails', L('Ногти', 'Tirnoq parvarishi', 'Nails'), ATLAS.beauty, 0.15],
  ['vitamins', L('Витамины и добавки', 'Vitamin va qo‘shimchalar', 'Vitamins & supplements'), ATLAS.beauty, 0.5],
  ['kitchen', L('Кухня', 'Oshxona', 'Kitchen'), ATLAS.home, undefined],
  ['home-textile', L('Текстиль для дома', 'Uy to‘qimachiligi', 'Home textiles'), ATLAS.home, 1.5],
  ['home-decor', L('Декор и свет', 'Dekor va yoritish', 'Decor & lighting'), ATLAS.home, undefined],
  ['home-appliances', L('Техника для дома', 'Maishiy texnika', 'Home appliances'), ATLAS.home, undefined],
  ['toys', L('Игрушки', 'O‘yinchoqlar', 'Toys'), ATLAS.other, undefined],
  ['balls', L('Мячи', 'To‘plar', 'Balls'), ATLAS.sport, 0.7],
  ['shin-guards', L('Щитки', 'Boldir himoyachilari', 'Shin guards'), ATLAS.sport, 0.4],
  ['bottles', L('Бутылки и шейкеры', 'Butilka va sheykerlar', 'Bottles & shakers'), ATLAS.sport, 0.4],
  ['rackets', L('Ракетки', 'Raketkalar', 'Rackets'), ATLAS.sport, 0.8],
  ['fitness', L('Инвентарь для фитнеса', 'Fitnes jihozlari', 'Fitness equipment'), ATLAS.sport, undefined],
];

const departmentTable: [string, Label][] = [
  ['men', L('Мужское', 'Erkaklar', 'Men')], ['women', L('Женское', 'Ayollar', 'Women')], ['kids', L('Детское', 'Bolalar', 'Kids')],
  ['baby', L('Для малышей', 'Chaqaloqlar', 'Baby')], ['unisex', L('Унисекс', 'Uniseks', 'Unisex')],
];
const sportTable: [string, Label][] = [
  ['running', L('Бег', 'Yugurish', 'Running')], ['football', L('Футбол', 'Futbol', 'Football')], ['training', L('Тренировки', 'Mashg‘ulotlar', 'Training')],
  ['basketball', L('Баскетбол', 'Basketbol', 'Basketball')], ['tennis', L('Теннис', 'Tennis', 'Tennis')], ['golf', L('Гольф', 'Golf', 'Golf')],
  ['volleyball', L('Волейбол', 'Voleybol', 'Volleyball')], ['swim', L('Плавание', 'Suzish', 'Swimming')], ['yoga', L('Йога', 'Yoga', 'Yoga')],
  ['outdoor', L('Туризм', 'Turizm', 'Outdoor')], ['cycling', L('Велоспорт', 'Velosport', 'Cycling')], ['skateboarding', L('Скейтбординг', 'Skeytbording', 'Skateboarding')],
  ['lifestyle', L('На каждый день', 'Har kungi', 'Lifestyle')],
];
const materialTable: [string, Label][] = [
  ['cotton', L('Хлопок', 'Paxta', 'Cotton')], ['polyester', L('Полиэстер', 'Poliester', 'Polyester')], ['nylon', L('Нейлон', 'Neylon', 'Nylon')],
  ['fleece', L('Флис', 'Flis', 'Fleece')], ['wool', L('Шерсть', 'Jun', 'Wool')], ['leather', L('Кожа', 'Teri', 'Leather')],
  ['synthetic', L('Синтетика', 'Sintetika', 'Synthetic')], ['mesh', L('Сетка', 'To‘r mato', 'Mesh')], ['denim', L('Деним', 'Denim', 'Denim')],
  ['linen', L('Лён', 'Zig‘ir', 'Linen')], ['silk', L('Шёлк', 'Ipak', 'Silk')],
];
const fitTable: [string, Label][] = [
  ['slim', L('Облегающая', 'Tor', 'Slim')], ['regular', L('Классическая', 'Klassik', 'Regular')], ['loose', L('Свободная', 'Erkin', 'Loose')],
  ['oversized', L('Оверсайз', 'Oversayz', 'Oversized')], ['compression', L('Компрессионная', 'Kompressiyali', 'Compression')],
  ['plus', L('Большие размеры', 'Katta o‘lchamlar', 'Plus & big sizes')], ['wide', L('Широкая колодка', 'Keng qolip', 'Wide fit')],
];
const closureTable: [string, Label][] = [
  ['laces', L('Шнурки', 'Bog‘ichli', 'Laces')], ['slip-on', L('Без шнурков', 'Bog‘ichsiz', 'Slip-on')], ['velcro', L('Липучки', 'Yopishqoq tasma', 'Hook & loop')],
  ['zip', L('Молния', 'Molniya', 'Zip')], ['buttons', L('Пуговицы', 'Tugmalar', 'Buttons')],
];
const sleeveTable: [string, Label][] = [
  ['short', L('Короткий рукав', 'Kalta yeng', 'Short sleeve')], ['long', L('Длинный рукав', 'Uzun yeng', 'Long sleeve')],
  ['sleeveless', L('Без рукавов', 'Yengsiz', 'Sleeveless')], ['three-quarter', L('Рукав 3/4', 'Yeng 3/4', '3/4 sleeve')],
];
const colorTable: [string, Label][] = [
  ['black', L('Чёрный', 'Qora', 'Black')], ['white', L('Белый', 'Oq', 'White')], ['grey', L('Серый', 'Kulrang', 'Grey')], ['beige', L('Бежевый', 'Bej', 'Beige')],
  ['brown', L('Коричневый', 'Jigarrang', 'Brown')], ['red', L('Красный', 'Qizil', 'Red')], ['pink', L('Розовый', 'Pushti', 'Pink')], ['orange', L('Оранжевый', 'To‘q sariq', 'Orange')],
  ['yellow', L('Жёлтый', 'Sariq', 'Yellow')], ['green', L('Зелёный', 'Yashil', 'Green')], ['blue', L('Синий', 'Ko‘k', 'Blue')], ['purple', L('Фиолетовый', 'Binafsha', 'Purple')],
  ['silver', L('Серебристый', 'Kumushrang', 'Silver')], ['gold', L('Золотистый', 'Oltinrang', 'Gold')], ['multi', L('Разноцветный', 'Rang-barang', 'Multicolour')],
];

const packLabel = (n: string, locale: FacetLocale) => locale === 'ru' ? `${n} шт. в наборе` : locale === 'uz' ? `To‘plamda ${n} dona` : `${n}-pack`;
const storageLabel = (value: string, locale: FacetLocale) => { const m = /^(\d+(?:\.\d+)?)(gb|tb)$/.exec(value); return m ? `${m[1]} ${locale === 'ru' ? (m[2] === 'gb' ? 'ГБ' : 'ТБ') : m[2].toUpperCase()}` : value; };
const volumeLabel = (value: string, locale: FacetLocale) => { const m = /^(\d+(?:\.\d+)?)(ml|l)$/.exec(value); return m ? `${m[1]} ${locale === 'ru' ? (m[2] === 'ml' ? 'мл' : 'л') : m[2]}` : value; };
const sized = (list: string[], label: (v: string, l: FacetLocale) => string) => list.map((v) => ({ slug: v, label: L(label(v, 'ru'), label(v, 'uz'), label(v, 'en')) }));
const plain = (table: [string, Label, ...unknown[]][]) => table.map(([s, label]) => ({ slug: s, label }));

export const facetDefinitions: { key: FacetKey; label: Label; values: { slug: string; label: Label }[]; categories?: string[] }[] = [
  { key: 'type', label: L('Тип товара', 'Mahsulot turi', 'Type'), values: plain(typeTable) },
  { key: 'department', label: L('Для кого', 'Kim uchun', 'Gender'), values: plain(departmentTable), categories: [ATLAS.shoes, ATLAS.clothes, ATLAS.acc, ATLAS.sport, ATLAS.beauty] },
  { key: 'sport', label: L('Вид спорта', 'Sport turi', 'Sport'), values: plain(sportTable), categories: [ATLAS.shoes, ATLAS.clothes, ATLAS.acc, ATLAS.sport] },
  { key: 'color', label: L('Цвет', 'Rang', 'Colour'), values: plain(colorTable) },
  { key: 'material', label: L('Материал', 'Material', 'Material'), values: plain(materialTable), categories: [ATLAS.shoes, ATLAS.clothes, ATLAS.acc, ATLAS.home] },
  { key: 'fit', label: L('Посадка', 'Bichim', 'Fit'), values: plain(fitTable), categories: [ATLAS.shoes, ATLAS.clothes] },
  { key: 'sleeve', label: L('Рукав', 'Yeng', 'Sleeve'), values: plain(sleeveTable), categories: [ATLAS.clothes] },
  { key: 'closure', label: L('Застёжка', 'Mahkamlash', 'Closure'), values: plain(closureTable), categories: [ATLAS.shoes, ATLAS.clothes] },
  { key: 'pack', label: L('В наборе', 'To‘plamda', 'Pack'), values: sized(['2', '3', '4', '5', '6', '8', '10', '12'], packLabel), categories: [ATLAS.clothes, ATLAS.shoes, ATLAS.acc, ATLAS.beauty, ATLAS.sport] },
  { key: 'storage', label: L('Память', 'Xotira', 'Storage'), values: sized(['32gb', '64gb', '128gb', '256gb', '512gb', '1tb', '2tb'], storageLabel), categories: [ATLAS.tech] },
  { key: 'volume', label: L('Объём', 'Hajm', 'Volume'), values: sized(['30ml', '50ml', '75ml', '100ml', '200ml', '500ml', '1l'], volumeLabel), categories: [ATLAS.beauty, ATLAS.sport, ATLAS.home] },
];

/** Shopper-facing label of a facet value; unknown slugs (new storage sizes, packs) are formatted, never blank. */
export function facetValueLabel(key: FacetKey, value: string, locale: FacetLocale): string {
  if (key === 'pack') return packLabel(value, locale);
  if (key === 'storage') return storageLabel(value, locale);
  if (key === 'volume') return volumeLabel(value, locale);
  const found = facetDefinitions.find((d) => d.key === key)?.values.find((v) => v.slug === value);
  if (found) return found.label[locale] ?? found.label.ru;
  const text = value.replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------- Derivation ----------

const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ');
const B = '(?<![\\p{L}\\p{N}])', E = '(?![\\p{L}\\p{N}])';
// "a|b~" -> each top-level alternative bounded on both sides; "~" is a stem ending (any letters, for Russian endings).
// Longer alternatives go first so "puffer jacket" wins over "puffer" at the same position.
function topLevel(alts: string): string[] {
  const out: string[] = []; let depth = 0, from = 0;
  for (let i = 0; i < alts.length; i++) {
    const c = alts[i];
    if (c === '\\') i++; else if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--; else if (c === '|' && depth === 0) { out.push(alts.slice(from, i)); from = i + 1; }
  }
  return [...out, alts.slice(from)];
}
const rx = (alts: string) => new RegExp(B + '(?:' + topLevel(norm(alts)).sort((a, b) => b.length - a.length)
  .map((a) => a.replace(/~/g, '\\p{L}*') + (a.endsWith('~') ? '' : E)).join('|') + ')', 'gu');
type Rule = [string, RegExp];
const rules = (list: [string, string][]): Rule[] => list.map(([s, alts]) => [s, rx(alts)]);

const typeRuleSource: [string, string][] = [
  // electronics and beauty first: their compounds ("phone case", "60 tablets") must beat the apparel words
  ['vitamins', '\\d+ (?:tablets|capsules|caps|softgels|gummies|veg(?:etarian)? ?caps(?:ules)?)|vitamins?|multivitamins?|supplements?|omega[- ]?3|fish oil|collagen|probiotics?|melatonin|magnesium|protein powder|whey protein|whey|creatine|витамин~|бады?|коллаген~|омега~|протеин~|креатин~|пробиотик~|мелатонин~|магний|магния'],
  ['smartphones', 'smartphones?|iphone(?: \\d+)?(?: pro| plus| max| mini| e)*|galaxy (?:s|a|note|z ?(?:fold|flip)) ?\\d+[a-z+]*|pixel \\d+a?(?: pro)?|redmi(?: note)?|poco|oneplus|cell ?phones?|mobile phones?|смартфон~|телефон~|айфон~'],
  ['laptops', 'laptops?|notebooks?|macbook(?: air| pro)?|chromebooks?|ultrabooks?|thinkpad|ноутбук~|макбук~'],
  ['tablets', 'tablets?|ipad(?: air| pro| mini)?|galaxy tab~|kindle|e-?readers?|планшет~'],
  ['headphones', 'headphones?|earbuds?|earphones?|headsets?|airpods(?: pro| max)?|galaxy buds~|buds\\d*(?: pro)?|наушник~|гарнитур~'],
  ['smartwatches', 'smart ?watch(?:es)?|apple watch(?: series \\d+| ultra| se)?|galaxy watch~|pixel watch|fitbit|garmin|amazfit|fitness trackers?|смарт-час~|умн~ час~|фитнес-браслет~'],
  ['speakers', 'speakers?|soundbars?|колонк~|саундбар~'],
  ['consoles', 'consoles?|playstation(?: \\d)?|ps[45](?: pro| slim)?|xbox(?: series [xs])?|nintendo switch(?: \\d| oled| lite)?|steam deck|приставк~|консол~'],
  ['cameras', 'cameras?|gopro|camcorders?|dslr|mirrorless|instax|webcams?|камер~|фотоаппарат~'],
  ['monitors', 'monitors?|tvs?|televisions?|монитор~|телевизор~'],
  ['tech-accessories', 'chargers?|charging (?:cable|pad|stand|case)s?|cables?|power ?banks?|adapters?|phone cases?|cases?|screen protectors?|controllers?|gamepads?|keyboards?|mouse|mice|usb hubs?|external ssd|portable ssd|flash drives?|memory cards?|sd cards?|watch bands?|watch straps?|stylus|apple pencil|magsafe|чехл~|чехол|зарядк~|кабел~|пауэрбанк~|клавиатур~|мышь|мышк~|джойстик~|адаптер~|переходник~'],
  ['skincare', 'serums?|moisturi[sz]ers?|moisturi[sz]ing (?:cream|lotion)|face cream|eye cream|night cream|day cream|hand cream|cleansers?|cleansing (?:foam|gel|oil|balm)|face wash|sunscreen|sun ?cream|spf ?\\d+|toners?|face masks?|sheet masks?|retinol|niacinamide|hyaluronic|skin ?care|exfoliants?|micellar|сыворотк~|крем|крем для лица|тоник~|умывани~|маск~ для лица|уход за кожей'],
  ['makeup', 'lipsticks?|lip gloss|lip ?liners?|lip tints?|mascaras?|foundations?|concealers?|eyeshadows?|eye ?shadow palettes?|eyeliners?|bronzers?|highlighters?|setting (?:spray|powder)|face powder|primers?|brow (?:pencil|gel)|make-?up|blush(?! pink)|помад~|тушь|тональн~|консилер~|тени для век|подводк~|румян~|пудр~|хайлайтер~|праймер~|макияж~|блеск для губ'],
  ['fragrance', 'perfumes?|parfum|eau de parfum|eau de toilette|eau de cologne|edp|edt|colognes?|fragrances?|body mists?|духи|парфюм~|туалетн~ вод~|парфюмерн~ вод~|одеколон~'],
  ['haircare', 'shampoos?|dry shampoo|hair (?:oil|mask|serum|spray|gel|cream|care|treatment|dye|colou?r)s?|hair ?dryers?|straighteners?|curling (?:iron|wand)s?|airwrap|flat irons?|шампун~|бальзам для волос|кондиционер для волос|маск~ для волос|фен|фены|выпрямител~|плойк~|стайлер~|уход за волосами|краск~ для волос'],
  ['bodycare', 'body (?:lotion|wash|butter|cream|oil|scrub)s?|shower gels?|lotions?|deodorants?|antiperspirants?|hand wash|bath bombs?|soaps?|гел~ для душа|лосьон~|дезодорант~|мыло|скраб~|крем для тела|антиперспирант~'],
  ['nails', 'nail (?:polish|lacquer|care|art|kit|file|gel)~|gel polish|top coat|base coat|press-on nails|лак~ для ногтей|гель-лак~|ногт~'],
  // footwear
  ['sneakers', 'shoes?|sneakers?|trainers?|running shoes?|ultraboost|samba(?: og)?|gazelle|superstar|stan smith|campus 00s|кроссовк~|кеды|кед'],
  ['cleats', 'cleats?|football boots?|soccer boots?|firm[ /-]ground|бутс~|сороконожк~'],
  ['slides', 'slides?|sandals?|flip[- ]?flops?|slippers?|adilette(?: aqua| comfort| 22)?|шлепан~|сланц~|сандал~|тапочк~|тапк~'],
  ['boots', 'boots?|ботин~|сапог~|сапоги|угги'],
  ['shoes', 'dress shoes?|loafers?|oxfords?|heels|pumps|flats|ballet flats|mules|туфл~|лофер~|балетк~'],
  // clothing
  ['tshirts', 't-?shirts?|tees?|polo shirts?|polos?|футболк~|поло'],
  ['tanks', 'tank tops?|tanks?|singlets?|camis?|crop tops?|y-tank(?: tops?)?|майк~|топ|топы'],
  ['shirts', 'shirts?|button[- ](?:up|down) shirts?|long ?sleeve (?:tees?|t-?shirts?)|longsleeves?|рубашк~|лонгслив~'],
  ['jerseys', 'jerseys?|джерси|футбольн~ форм~'],
  ['hoodies', 'hoodies?|hoody|hooded sweatshirts?|sweatshirts?|crewnecks?|pullovers?|half[- ]?zip|quarter[- ]?zip|1/4[- ]?zip|худи|толстовк~|свитшот~'],
  ['sweaters', 'sweaters?|cardigans?|jumpers?|свитер~|кардиган~|джемпер~'],
  ['jackets', 'jackets?|track ?tops?|windbreakers?|anoraks?|vests?|gilets?|bombers?|куртк~|ветровк~|олимпийк~|жилет~|бомбер~'],
  ['coats', 'coats?|parkas?|puffers?|puffer jackets?|down jackets?|пуховик~|пальто|парка|парки'],
  ['pants', 'pants|trousers|joggers?|sweatpants|track ?pants|chinos?|брюк~|штан~|джоггер~'],
  ['jeans', 'jeans|джинсы|джинс'],
  ['shorts', 'shorts?|short shorts|шорт~|бермуд~'],
  ['leggings', 'leggings?|tights|leggins|yoga pants|тайтс~|леггинс~|лосин~'],
  ['skirts', 'skirts?|skorts?|юбк~'],
  ['dresses', 'dress(?:es)?|sundress(?:es)?|плать~|сарафан~'],
  ['sets', '(?:t-?shirt|tee|jogger|pants|shorts?|hoodie|fleece|track|training|matching|outfit|clothing|baby|kids|sweat|2-piece|3-piece) ?sets?|track ?suits?|jumpsuits?|overalls|rompers?|onesies?|bodysuits?|костюм~|комбинезон~|комплект~'],
  ['underwear', 'underwear|boxers?|boxer briefs?|briefs|trunks|panties|thongs?|трусы|трусики|боксер~|нижнее белье'],
  ['bras', 'bras?|sports bras?|bralettes?|бюстгальтер~|топ-бра|спортивн~ топ~'],
  ['socks', 'socks?|no[- ]show|quarter|носк~|носоч~'],
  ['swimwear', 'swimsuits?|swimwear|bikinis?|swim trunks|swim shorts|boardshorts|купальник~|плавк~'],
  // accessories
  ['bags', 'bags?|duffel|duffle|totes?|waist packs?|fanny packs?|crossbody|handbags?|purses?|gym ?sacks?|pouch(?:es)?|сумк~|сумочк~|клатч~|бананк~'],
  ['backpacks', 'backpacks?|rucksacks?|рюкзак~'],
  ['caps', 'caps?|hats?|strapback|snapback|visors?|5-panel|bucket(?: hats?)?|boonies?|high crown|low crown|clubhouse|кепк~|бейсболк~|панам~|шляп~'],
  ['beanies', 'beanies?|knit hats?|winter hats?|шапк~'],
  ['gloves', 'gloves?|mittens?|перчатк~|варежк~'],
  ['scarves', 'scarf|scarves|шарф~'],
  ['belts', 'belts?|ремень|ремни|ремн~'],
  ['wallets', 'wallets?|card ?holders?|кошел~|портмоне|картхолдер~'],
  ['sunglasses', 'sunglasses|eyewear|glasses|солнцезащитн~ очк~|очки'],
  ['watches', 'watch(?:es)?|wristwatch(?:es)?|часы|наручн~ час~'],
  ['jewelry', 'jewelry|jewellery|necklaces?|bracelets?|earrings?|rings?|pendants?|украшени~|кольц~|серьг~|браслет~|цепочк~'],
  // home
  ['kitchen', 'cookware|frying pans?|skillets?|pans?|knife sets?|knives|kitchen~|blenders?|coffee (?:maker|machine|grinder)s?|espresso machines?|kettles?|toasters?|air fryers?|food processors?|mugs?|кухн~|сковород~|кастрюл~|блендер~|кофемашин~|чайник~|тостер~|аэрогрил~|кружк~|посуд~'],
  ['home-textile', 'bedding|bed sheets?|sheet sets?|duvets?|duvet covers?|comforters?|pillows?|pillowcases?|blankets?|towels?|постельн~|простын~|одеял~|подушк~|полотенц~|плед~'],
  ['home-decor', 'candles?|vases?|lamps?|led strips?|wall art|posters?|picture frames?|rugs?|carpets?|curtains?|home decor|diffusers?|свеч~|вазы|ваза|ламп~|светильник~|постер~|ковр~|ковер|штор~|декор~|диффузор~'],
  ['home-appliances', 'vacuums?|vacuum cleaners?|robot vacuums?|roomba|air purifiers?|humidifiers?|dehumidifiers?|air conditioners?|electric fans?|tower fans?|heaters?|steam irons?|garment steamers?|washing machines?|dishwashers?|refrigerators?|microwaves?|пылесос~|очистител~ воздуха|увлажнител~|обогревател~|утюг~|отпаривател~|вентилятор~|кондиционер~|микроволнов~|холодильник~'],
  ['toys', 'toys?|lego|dolls?|puzzles?|plush(?:ies)?|board games?|action figures?|building (?:blocks|sets?)|игрушк~|конструктор~|кукл~|пазл~|настольн~ игр~'],
  // sport equipment
  ['balls', 'balls?|footballs|basketballs?|volleyballs?|soccer balls?|мяч~'],
  ['shin-guards', 'shin ?guards?|щитк~'],
  ['bottles', 'bottles?|water bottles?|shakers?|tumblers?|flasks?|бутылк~|шейкер~|термос~|термокружк~'],
  ['rackets', 'rackets?|racquets?|paddles?|ракетк~'],
  ['fitness', 'yoga mats?|exercise mats?|dumbbells?|kettlebells?|resistance bands?|jump ropes?|skipping ropes?|foam rollers?|ab rollers?|treadmills?|exercise bikes?|golf clubs?|putters?|гантел~|гиря|гири|коврик~ для йоги|скакалк~|эспандер~|тренажер~'],
];

// eBay "Type"/"Style" aspect values that do not read as a title word.
const aspectTypeAliases: Record<string, string> = {
  'athletic & sneakers': 'sneakers', 'athletic shoes': 'sneakers', 'cleats': 'cleats', 'slides': 'slides', 'sandals': 'slides', 'flip flops': 'slides',
  'short sleeve shirts': 'tshirts', 't shirts': 'tshirts', 'long sleeve shirts': 'shirts', 'tank tops': 'tanks', 'jerseys': 'jerseys',
  'hoodies & sweatshirts': 'hoodies', 'sweatshirts & hoodies': 'hoodies', 'jackets': 'jackets', 'coats & jackets': 'jackets', 'coats, jackets & vests': 'jackets',
  'tights & leggings': 'leggings', 'skirts & dresses': 'skirts', 'matching set': 'sets', 'matching sets': 'sets', 'outfits & sets': 'sets', 'jumpsuits & overalls': 'sets',
  'sports bras': 'bras', 'bralette': 'bras', 'underwear': 'underwear', 'bags': 'bags', 'hats': 'caps', 'shin guards': 'shin-guards', 'belts': 'belts',
};
// Within a group the title is more specific than eBay's coarse type ("Short Leggings" filed under Shorts, "Polo" under Tank Tops).
const typeGroups: string[][] = [
  ['tshirts', 'tanks', 'shirts', 'jerseys'], ['pants', 'jeans', 'shorts', 'leggings', 'skirts', 'dresses'], ['hoodies', 'sweaters', 'jackets', 'coats'],
  ['sneakers', 'cleats', 'slides', 'boots', 'shoes'], ['bags', 'backpacks'], ['caps', 'beanies'], ['underwear', 'bras', 'swimwear'], ['sets', 'swimwear'],
];
const sameGroup = (a: string, b: string) => typeGroups.some((g) => g.includes(a) && g.includes(b));

const sportRuleSource: [string, string][] = [
  ['volleyball', 'volleyball|hilo|волейбол~'],
  ['basketball', 'basketball|nba|dame \\d+|harden vol|anthony edwards|ae 1|баскетбол~'],
  ['tennis', 'tennis|padel|barricade|courtjam|gamecourt|теннис~'],
  ['golf', 'golf|ultimate365|beyond the course|adipower|codechaos|tour360|s2g|гольф'],
  ['swim', 'swim~|swimming|adilette aqua|плаван~'],
  ['yoga', 'yoga|pilates|йог~|пилатес~'],
  ['cycling', 'cycling|велоспорт~|велосипедн~'],
  ['skateboarding', 'skate~|скейт~'],
  ['outdoor', 'terrex|hiking|trail|trekking|outdoor|camping|туризм~|поход~|треккинг~'],
  ['football', 'football|soccer|futsal|cleats|firm[ /-]ground|tiro ?\\d*|entrada ?\\d*|predator|copa|f50|crazyfast|goletto|squadra ?\\d*|condivo|tabela ?\\d*|estro ?\\d*|campeon ?\\d*|world cup|fifa|trionda|(?:home|away|third|pre[- ]?match|anthem|goalkeeper|authentic) jersey|\\d\\d (?:home|away|third)|pre[- ]match|shin ?guards?|goalkeeper|футбол|футбольн~|бутс~|' +
    'argentina|germany|mexico|france|spain|italy|scotland|colombia|japan|belgium|sweden|jamaica|chile|peru|south africa|nigeria|morocco|algeria|egypt|uzbekistan|wales|england|brazil|portugal|netherlands|arsenal|real madrid|bayern|juventus|manchester united|man utd|club america|la galaxy|inter miami|ajax|benfica|celtic|boca juniors|river plate|flamengo'],
  ['running', 'running|runner|marathon|adizero|ultraboost|supernova|adistar|duramo|solarglide|solarboost|boston \\d+|pureboost|galaxy \\d+|lite racer|response|own the run|бег|беговы~'],
  ['training', 'training|train|workout|gym|d4t|designed[- ]for[- ]training|crossfit|hiit|studio|optime|techfit|тренировоч~|тренировк~|фитнес~'],
  ['lifestyle', 'originals|trefoil|adicolor|samba|gazelle|superstar|stan smith|campus|forum (?:low|mid|high)|sl 72|firebird|spezial|run [678]0s|ny 90|grand court|vl court|breaknet|daily \\d|lifestyle|casual|sportswear|essentials|future icons|z\\.n\\.e|adilenium|повседневн~'],
];
const materialRuleSource: [string, string][] = [
  ['synthetic', 'synthetic|faux leather|vegan leather|pu leather|synthetic leather|polyurethane|синтети~|экокож~|искусственн~ кож~'],
  ['leather', 'leather|suede|nubuck|кожа|кожан~|замш~|нубук~'],
  ['denim', 'denim|джинсов~|деним'],
  ['fleece', 'fleece|flc|флис~'],
  ['wool', 'wool|merino|cashmere|шерст~|кашемир~|мерино~'],
  ['cotton', 'cotton|french terry|canvas|хлопок|хлопков~|хлопка'],
  ['linen', 'linen|льнян~|лен'],
  ['silk', 'silk|шелк~|шелков~'],
  ['mesh', 'mesh|сетк~|сетчат~'],
  ['nylon', 'nylon|нейлон~'],
  ['polyester', 'polyester|recycled polyester|полиэстер~'],
];
const fitRuleSource: [string, string][] = [
  ['plus', 'plus size|plus sizes|big (?:&|and) tall|больш~ размер~'],
  ['oversized', 'oversized?|boxy|оверсайз~'],
  ['loose', 'loose|relaxed|baggy|wide[- ]leg|свободн~'],
  ['compression', 'compression|компрессион~'],
  ['regular', 'regular fit|regular tapered|classic fit|straight fit|прям~ крой'],
  ['slim', 'slim|skinny|fitted|tapered|приталенн~|облегающ~'],
  ['wide', 'wide|wides|extra wide|wide width|широк~ колодк~'],
];
const closureRuleSource: [string, string][] = [
  ['slip-on', 'laceless|slip[- ]?ons?|pull[- ]on|без шнурков'],
  ['velcro', 'velcro|hook (?:and|&) loop|cf|el|липучк~'],
  ['zip', 'full[- ]?zip|half[- ]?zip|quarter[- ]?zip|1/4 zip|zip(?:ped|per)?|zip-up|на молнии'],
  ['buttons', 'button[- ]?(?:up|down)|buttons?|snaps?|на пуговицах'],
  ['laces', 'lace[- ]?up|laces|шнурк~|на шнуровке'],
];
const sleeveRuleSource: [string, string][] = [
  ['three-quarter', '3/4 sleeve|3/4-sleeve|рукав 3/4'],
  ['sleeveless', 'sleeveless|без рукавов|tank|tank tops?|майк~'],
  ['long', 'long[- ]?sleeves?|ls|longsleeve|длинн~ рукав~|лонгслив~'],
  ['short', 'short[- ]?sleeves?|ss|cap sleeve|коротк~ рукав~'],
];
const departmentRuleSource: [string, string][] = [
  ['baby', 'infants?|toddlers?|newborns?|baby (?:boys?|girls?)|babies|baby(?! tee)|младен~|малыш~|новорожденн~'],
  ['kids', 'kids?|kid\'s|youth|juniors?|boys?|girls?|children|childrens|child|детск~|для детей|мальчик~|девоч~|подрост~'],
  ['unisex', 'unisex|gender neutral|унисекс'],
  ['women', 'women|womens|woman|wmns|ladies|female|женск~|для женщин'],
  ['men', 'men|mens|male|мужск~|для мужчин'],
];

// Last word of a compound colour wins ("Putty Mauve" -> mauve, "Clear Onix" -> onix); the first colour of "A / B" is the main one.
const colorWords: [string, string][] = [
  ['black', 'black|noir|negro|nero|schwarz|onyx|jet|ebony|carbon|черн~|qora'],
  ['white', 'white|blanc|blanco|bianco|weiss|ivory|chalk|cloud|off-white|bone|pearl|снежн~|бел~|oq'],
  ['silver', 'silver|metallic silver|metallic|metalic|серебрист~|серебрян~|kumush'],
  ['gold', 'gold|golden|metallic gold|золот~|oltin'],
  ['grey', 'grey|gray|gris|grigio|onix|charcoal|heather|slate|graphite|ash|smoke|steel|stone grey|сер~|графит~|kulrang'],
  ['beige', 'beige|sand|sandstone|cargo|khaki|linen|cream|ecru|nude|taupe|putty|oat|oatmeal|alumina|magic beige|stone|tan|camel|беж~|песочн~|кремов~|bej'],
  ['brown', 'brown|chocolate|coffee|mocha|cognac|clay|earth|bronze|copper|gum|walnut|espresso|коричнев~|шоколадн~|jigarrang'],
  ['red', 'red|rouge|rojo|rosso|scarlet|crimson|burgundy|maroon|bordeaux|wine|ruby|cherry|cardinal|красн~|бордов~|qizil'],
  ['pink', 'pink|rosa|rose|fuchsia|magenta|blush|coral|bliss|розов~|pushti'],
  ['orange', 'orange|tangerine|peach|apricot|rust|amber|оранжев~|персиков~'],
  ['yellow', 'yellow|lemon|mustard|gelb|желт~|sariq'],
  ['green', 'green|vert|verde|olive|lime|mint|teal|emerald|sage|forest|jade|khaki green|зелен~|оливков~|мятн~|yashil'],
  ['blue', 'blue|bleu|azul|navy|indigo|royal|cobalt|denim|aqua|turquoise|cyan|sky|ink|ocean|marine|aquamarine|petrol|синий|синяя|синее|сини~|голуб~|бирюзов~|ko\'k'],
  ['purple', 'purple|violet|orchid|lilac|lavender|plum|mauve|grape|фиолетов~|сиренев~|лилов~|binafsha'],
  ['multi', 'multi|multicolou?r|multi-colou?r|rainbow|print|camo|разноцветн~|мульти~'],
];

const basicColors: Record<string, string> = { black: 'black', white: 'white', grey: 'grey', gray: 'grey', red: 'red', blue: 'blue', navy: 'blue', green: 'green', yellow: 'yellow', pink: 'pink', orange: 'orange', purple: 'purple', brown: 'brown', beige: 'beige', silver: 'silver', gold: 'gold' };

let compiled: { type: Rule[]; sport: Rule[]; material: Rule[]; fit: Rule[]; closure: Rule[]; sleeve: Rule[]; department: Rule[]; color: Rule[] } | undefined;
const tables = () => compiled ??= {
  type: rules(typeRuleSource), sport: rules(sportRuleSource), material: rules(materialRuleSource), fit: rules(fitRuleSource),
  closure: rules(closureRuleSource), sleeve: rules(sleeveRuleSource), department: rules(departmentRuleSource), color: rules(colorWords),
};

/** Head noun of a title: the match ending last (English puts the noun last), the longer match on a tie. */
function headMatch(list: Rule[], text: string, startsBefore = text.length): string | undefined {
  let best: { slug: string; start: number; end: number } | undefined;
  for (const [slugName, re] of list) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0, end = start + m[0].length;
      if (start >= startsBefore) continue;
      if (!best || end > best.end || (end === best.end && start < best.start)) best = { slug: slugName, start, end };
    }
  }
  return best?.slug;
}
/** First rule (by priority order) that matches anywhere. */
function firstMatch(list: Rule[], text: string): string | undefined {
  for (const [slugName, re] of list) { re.lastIndex = 0; if (re.test(text)) return slugName; }
  return undefined;
}

const junkValue = /^(?:"?see description"?|n\/?a|none|not applicable|does not apply|unbranded|other|-|\.)$/i;
type AspectMap = Map<string, string[]>;
function aspectMap(input: FacetInput): AspectMap {
  const map: AspectMap = new Map();
  const add = (list: Pair[] | undefined) => {
    for (const { name, value } of list ?? []) {
      const key = norm(String(name ?? '')).trim(), val = String(value ?? '').trim();
      if (!key || !val || junkValue.test(val.replace(/"/g, '').trim()) || val.length > 200) continue;
      const vals = map.get(key) ?? []; vals.push(val); map.set(key, vals);
    }
  };
  add(input.aspects);
  for (const variant of (input.variants ?? []).slice(0, 400)) add(variant.options);
  return map;
}
const firstAspect = (map: AspectMap, ...names: string[]) => { for (const n of names) { const v = map.get(n)?.[0]; if (v) return v; } return undefined; };
const allAspects = (map: AspectMap, ...names: string[]) => names.flatMap((n) => map.get(n) ?? []);

function typeFromAspect(value: string): string | undefined {
  const key = norm(value).trim();
  return aspectTypeAliases[key] ?? headMatch(tables().type, key);
}

function departmentOf(text: string): FacetDepartment | undefined {
  const found = new Set<string>();
  for (const [slugName, re] of tables().department) { re.lastIndex = 0; if (re.test(text)) found.add(slugName); }
  if (found.has('baby')) return 'baby';
  if (found.has('kids')) return 'kids';
  if (found.has('unisex') || (found.has('men') && found.has('women'))) return 'unisex';
  return found.has('women') ? 'women' : found.has('men') ? 'men' : undefined;
}
function departmentFromAspects(values: string[]): FacetDepartment | undefined {
  const counts = new Map<FacetDepartment, number>();
  for (const v of values) { const d = departmentOf(norm(v)); if (d) counts.set(d, (counts.get(d) ?? 0) + 1); }
  if (counts.has('men') && counts.has('women')) return 'unisex';
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

const packRe = /(?<![\p{L}\p{N}])(\d{1,2}) ?-? ?(?:pack|pk|pairs?|prs|pcs|шт|пар[аы]?)(?![\p{L}])|(?:pack|set|box) of (\d{1,2})(?![\p{N}])/u;
function packOf(map: AspectMap, title: string): number | undefined {
  const raw = firstAspect(map, 'number in pack', 'number of items', 'number of pairs', 'pack size', 'unit quantity', 'number of pieces');
  const fromAspect = raw ? Number.parseInt(raw, 10) : NaN;
  const m = packRe.exec(title);
  const n = Number.isFinite(fromAspect) && fromAspect > 0 ? fromAspect : m ? Number(m[1] ?? m[2]) : NaN;
  return Number.isInteger(n) && n >= 2 && n <= 100 ? n : undefined;
}

const storageRe = /(?<![\p{L}\p{N}.])(\d+(?:\.\d+)?) ?(gb|tb|гб|тб)(?![\p{L}])( ?(?:ram|ddr\d?|оперативн))?/gu;
function storageOf(map: AspectMap, title: string): string | undefined {
  const sources = [...allAspects(map, 'storage capacity', 'storage', 'hard drive capacity', 'ssd capacity', 'internal storage', 'capacity'), title];
  for (const source of sources) {
    let best = 0;
    for (const m of norm(source).matchAll(storageRe)) {
      if (m[3]) continue;
      const gb = Number(m[1]) * (m[2] === 'tb' || m[2] === 'тб' ? 1024 : 1);
      if (gb >= 8 && gb <= 65536 && gb > best) best = gb;
    }
    if (best) return best >= 1024 && best % 1024 === 0 ? `${best / 1024}tb` : `${Math.round(best)}gb`;
  }
  return undefined;
}

const volumeRe = /(?<![\p{L}\p{N}.,])(\d+(?:[.,]\d+)?) ?(ml|мл|fl\.? ?oz|l|л|liters?|litres?)(?![\p{L}])/u;
function volumeOf(map: AspectMap, title: string): string | undefined {
  for (const source of [...allAspects(map, 'volume', 'item volume', 'net volume', 'capacity', 'size'), title]) {
    const m = volumeRe.exec(norm(source));
    if (!m) continue;
    const n = Number(m[1].replace(',', '.')), unit = m[2];
    const ml = unit === 'ml' || unit === 'мл' ? n : unit.startsWith('fl') ? Math.round(n * 29.5735 / 5) * 5 : n * 1000;
    if (!(ml > 0 && ml <= 20000)) continue;
    return ml >= 1000 && ml % 100 === 0 ? `${ml / 1000}l` : `${Math.round(ml)}ml`;
  }
  return undefined;
}

/** Base colour family of a store colour name ("Core Black / Cloud White" -> black, "Better Scarlet" -> red, "Синий" -> blue). */
export function colorFamily(name: string): string | undefined {
  if (!name) return undefined;
  const first = norm(String(name)).split(/\s*(?:\/|,|\||&|\+| and | и | - )\s*/u).find((part) => part.trim());
  if (!first) return undefined;
  if (/multi|rainbow|разноцветн|мульти/u.test(first)) return 'multi';
  const words = first.replace(/[()[\].:;!]/g, ' ').split(/\s+/).filter(Boolean);
  const list = tables().color;
  // Two plain colours without a separator ("Black White"): the first one; otherwise the last word carries the hue.
  const basic = words.find((w) => basicColors[w]);
  if (basic) return basicColors[basic];
  for (let i = words.length - 1; i >= 0; i--) {
    for (const span of [words.slice(Math.max(0, i - 1), i + 1).join(' '), words[i]]) {
      for (const [family, re] of list) { re.lastIndex = 0; const m = re.exec(span); if (m && !span.slice(m.index + m[0].length).includes(' ')) return family; }
    }
  }
  return undefined;
}

const electronicsOrHome = new Set(typeTable.filter(([, , cat]) => cat === ATLAS.tech || cat === ATLAS.home).map(([s]) => s));
const apparel = new Set(typeTable.filter(([, , cat]) => cat === ATLAS.shoes || cat === ATLAS.clothes || cat === ATLAS.acc || cat === ATLAS.sport).map(([s]) => s));
const topTypes = new Set(['tshirts', 'tanks', 'shirts', 'jerseys', 'hoodies', 'sweaters', 'jackets', 'dresses', 'swimwear', 'sets']);
const shoeTypes = new Set(['sneakers', 'cleats', 'slides', 'boots', 'shoes']);
const beautyTypes = new Set(typeTable.filter(([, , cat]) => cat === ATLAS.beauty).map(([s]) => s));
const storageTypes = new Set(['smartphones', 'laptops', 'tablets', 'consoles', 'cameras', 'tech-accessories', 'smartwatches']);

export function deriveCatalogFacets(input: FacetInput): CatalogFacets {
  const t = tables();
  const map = aspectMap(input);
  // "Skort With Integrated Bike Shorts", "Чехол для iPhone": the product noun starts before "with"/"для".
  const title = norm(String(input.title ?? '')).slice(0, 400);
  const head = title.split(/ (?:with|w\/|для|с) /u)[0] || title;
  const path = norm(String(input.categoryPath ?? '')).split(/\s*(?:>|\/|\|)\s*/).filter((p) => p && !/^clothing, shoes & accessories$/.test(p)).reverse();
  const out: CatalogFacets = { v: catalogFacetsVersion };

  // Type: aspect first, a more specific title word in the same group refines it, then title, then category path (leaf first).
  const aspectType = allAspects(map, 'type', 'style', 'product type', 'item type').map(typeFromAspect).find(Boolean);
  const titleType = headMatch(t.type, title, head.length);
  let type = aspectType && titleType && sameGroup(aspectType, titleType) ? titleType : aspectType ?? titleType;
  for (const part of path) { if (type) break; type = headMatch(t.type, part); }
  if (!type && (map.has('us shoe size') || map.has('upper material') || map.has('shoe width') || /lace|hook/i.test(firstAspect(map, 'closure') ?? ''))) type = 'sneakers';
  if (type === 'boots' && /football|soccer|firm[ /-]ground|бутс/u.test(title)) type = 'cleats';
  if (type) out.type = type;

  if (!type || !electronicsOrHome.has(type)) {
    const titleDepartment = departmentOf(title);
    const department = titleDepartment === 'unisex' ? titleDepartment : departmentFromAspects(allAspects(map, 'department', 'gender', 'age group')) ?? titleDepartment ?? path.map(departmentOf).find(Boolean);
    if (department) out.department = department;
  }

  if (!type || apparel.has(type)) {
    const aspectSport = allAspects(map, 'sport', 'activity', 'sport/activity', 'performance/activity', 'product line', 'model', 'theme').map((v) => firstMatch(t.sport, norm(v))).find(Boolean);
    const sport = aspectSport ?? firstMatch(t.sport, title) ?? path.map((p) => firstMatch(t.sport, p)).find(Boolean);
    if (sport) out.sport = sport;
  }

  const material = allAspects(map, 'material', 'upper material', 'outer shell material', 'fabric type', 'exterior material', 'material composition').map((v) => firstMatch(t.material, norm(v))).find(Boolean) ?? firstMatch(t.material, title);
  if (material && (!type || !electronicsOrHome.has(type) || type === 'home-textile')) out.material = material;

  const pack = packOf(map, title);
  if (pack && type !== 'vitamins') out.pack = pack;

  if (!type || (!beautyTypes.has(type) && !electronicsOrHome.has(type))) {
    // "Big & Tall" counts only when every size row is one (a listing with Regular and Big & Tall is a regular fit).
    const sizeTypes = allAspects(map, 'size type').map(norm);
    const sizeType = sizeTypes.length && sizeTypes.every((v) => /big|tall|plus/.test(v)) ? sizeTypes[0] : '';
    const shoeWidth = norm(firstAspect(map, 'shoe width') ?? '');
    const fit = firstMatch(t.fit, norm(firstAspect(map, 'fit') ?? '')) ?? (/big|tall|plus/.test(sizeType) ? 'plus' : undefined) ?? (/wide|\b[2-4]?e\b|\bw\b/.test(shoeWidth) && !/medium|standard|regular/.test(shoeWidth) ? 'wide' : undefined) ?? firstMatch(t.fit, title);
    if (fit && (fit !== 'wide' || !type || shoeTypes.has(type))) out.fit = fit;
  }

  if (!type || shoeTypes.has(type) || topTypes.has(type) || type === 'bags' || type === 'backpacks') {
    const titleClosure = firstMatch(t.closure, title);
    const aspectClosure = allAspects(map, 'closure', 'fastening').map((v) => firstMatch(t.closure, norm(v)) ?? (/hook|strap|velcro/i.test(v) ? 'velcro' : undefined)).find(Boolean);
    const closure = titleClosure === 'slip-on' ? titleClosure : aspectClosure ?? titleClosure;
    if (closure && (closure !== 'laces' || !type || (shoeTypes.has(type) && type !== 'slides'))) out.closure = closure;
  }

  if (type && topTypes.has(type)) {
    const typeAspect = norm(allAspects(map, 'type', 'style').join(' | '));
    const sleeve = firstMatch(t.sleeve, norm(firstAspect(map, 'sleeve length', 'sleeve style', 'sleeve type') ?? '')) ?? firstMatch(t.sleeve, title) ?? firstMatch(t.sleeve, typeAspect)
      ?? (type === 'tanks' ? 'sleeveless' : type === 'tshirts' || type === 'jerseys' ? 'short' : undefined);
    if (sleeve) out.sleeve = sleeve;
  }

  if (!type || storageTypes.has(type)) { const storage = storageOf(map, title); if (storage && (type || firstAspect(map, 'storage capacity'))) out.storage = storage; }
  if (!type || beautyTypes.has(type) || type === 'bottles' || type === 'kitchen') { const volume = volumeOf(map, title); if (volume && type) out.volume = volume; }

  const counts = new Map<string, number>();
  // Colour: the variant's own colour, else its colour option, else the part of an import label before " · " ("White / Clear Onix · M").
  const colorNames = [...(input.variants ?? []).map((v) => v.color ?? v.options?.find((o) => /^(?:colou?r|exterior colou?r|цвет)$/i.test(o.name))?.value ?? (v.label?.includes(' · ') ? v.label.split(' · ')[0] : undefined)), ...allAspects(map, 'color', 'colour')];
  if (!colorNames.some(Boolean)) colorNames.push(...allAspects(map, 'exterior color', 'main color'));
  for (const name of colorNames) { const family = name ? colorFamily(name) : undefined; if (family) counts.set(family, (counts.get(family) ?? 0) + 1); }
  if (counts.size) out.colors = [...counts].sort((a, b) => b[1] - a[1]).map(([family]) => family).slice(0, colorFamilies.length);
  return out;
}

const typeInfo = (type: string | undefined) => type ? typeTable.find(([s]) => s === type) : undefined;

/** Atlas category implied by the derived type (socks are clothes, caps accessories); the current one when the type is unknown. */
export function categoryFromFacets(facets: CatalogFacets, current: string): string {
  const info = typeInfo(facets?.type);
  if (!info) return current;
  if (info[0] === 'gloves' && facets.sport && facets.sport !== 'lifestyle') return ATLAS.sport;
  return info[2];
}

/** Boxed weight of one listing (kg) by its type and pack size; undefined when the type is unknown or too varied. */
export function weightForFacets(facets: CatalogFacets): number | undefined {
  const info = typeInfo(facets?.type);
  if (!info || info[3] === undefined) return undefined;
  const pack = facets.pack && facets.pack >= 2 ? Math.min(facets.pack, 24) : 1;
  const kg = info[0] === 'socks' ? 0.1 + 0.05 * pack : info[0] === 'underwear' ? 0.12 + 0.08 * pack : info[3] * (1 + 0.8 * (pack - 1));
  // Children's clothes and shoes are smaller: kids about 80 %, baby about 60 % of the adult box (kept generous: the reserve covers less).
  const scale = info[2] === ATLAS.clothes || info[2] === ATLAS.shoes ? facets.department === 'baby' ? 0.6 : facets.department === 'kids' ? 0.8 : 1 : 1;
  return Math.round(kg * scale * 100) / 100;
}
