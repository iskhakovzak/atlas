import { supportedStoreRoots } from '../importer/stores.ts';
import type { Locale } from './i18n.ts';
import { storeLogoKeys } from './store-logos.ts';
import {withCyrillic} from './uz-cyrl.ts';

export type StoreFocus = 'clothing' | 'shoes' | 'beauty' | 'tech' | 'home' | 'marketplace';
export type StoreCountry = 'us' | 'uk' | 'es' | 'de' | 'fr' | 'it' | 'nl' | 'se' | 'dk' | 'pl' | 'ch' | 'cz' | 'ca' | 'au' | 'jp' | 'kr' | 'tr' | 'ae' | 'cn'
  | 'at' | 'be' | 'ie' | 'ph' | 'hk' | 'my' | 'sg' | 'nz' | 'in' | 'mx' | 'br' | 'ar' | 'tw';

// Brand name, what it sells and the country of its main (.com) storefront. Other storefronts
// take their country from the domain. The list must cover every allowed store root (tested).
const rows: [key: string, name: string, focus: StoreFocus, country: StoreCountry][] = [
  ['amazon', 'Amazon', 'marketplace', 'us'], ['ebay', 'eBay', 'marketplace', 'us'], ['walmart', 'Walmart', 'marketplace', 'us'], ['target', 'Target', 'marketplace', 'us'],
  ['aliexpress', 'AliExpress', 'marketplace', 'cn'], ['etsy', 'Etsy', 'marketplace', 'us'], ['costco', 'Costco', 'marketplace', 'us'], ['macys', 'Macy’s', 'marketplace', 'us'],
  ['bloomingdales', 'Bloomingdale’s', 'marketplace', 'us'], ['simon', 'ShopSimon', 'marketplace', 'us'], ['kohls', 'Kohl’s', 'marketplace', 'us'], ['jcpenney', 'JCPenney', 'marketplace', 'us'],
  ['saksfifthavenue', 'Saks Fifth Avenue', 'marketplace', 'us'], ['neimanmarcus', 'Neiman Marcus', 'marketplace', 'us'], ['elcorteingles', 'El Corte Inglés', 'marketplace', 'es'],
  ['fnac', 'Fnac', 'marketplace', 'fr'], ['carrefour', 'Carrefour', 'marketplace', 'es'], ['laredoute', 'La Redoute', 'marketplace', 'fr'], ['otto', 'OTTO', 'marketplace', 'de'],
  ['galaxus', 'Galaxus', 'marketplace', 'de'], ['iherb', 'iHerb', 'beauty', 'us'],

  ['nike', 'Nike', 'shoes', 'us'], ['adidas', 'adidas', 'shoes', 'us'], ['newbalance', 'New Balance', 'shoes', 'us'], ['asics', 'ASICS', 'shoes', 'us'], ['puma', 'PUMA', 'shoes', 'us'],
  ['reebok', 'Reebok', 'shoes', 'us'], ['converse', 'Converse', 'shoes', 'us'], ['vans', 'Vans', 'shoes', 'us'], ['hoka', 'HOKA', 'shoes', 'us'], ['on', 'On', 'shoes', 'us'],
  ['brooksrunning', 'Brooks Running', 'shoes', 'us'], ['salomon', 'Salomon', 'shoes', 'us'], ['merrell', 'Merrell', 'shoes', 'us'], ['skechers', 'Skechers', 'shoes', 'us'],
  ['crocs', 'Crocs', 'shoes', 'us'], ['ugg', 'UGG', 'shoes', 'us'], ['timberland', 'Timberland', 'shoes', 'us'], ['drmartens', 'Dr. Martens', 'shoes', 'us'],
  ['birkenstock', 'Birkenstock', 'shoes', 'us'], ['allbirds', 'Allbirds', 'shoes', 'us'], ['stevemadden', 'Steve Madden', 'shoes', 'us'], ['dsw', 'DSW', 'shoes', 'us'],
  ['zappos', 'Zappos', 'shoes', 'us'], ['footlocker', 'Foot Locker', 'shoes', 'us'], ['champssports', 'Champs Sports', 'shoes', 'us'], ['finishline', 'Finish Line', 'shoes', 'us'],
  ['jdsports', 'JD Sports', 'shoes', 'us'], ['goat', 'GOAT', 'shoes', 'us'], ['stockx', 'StockX', 'shoes', 'us'], ['kith', 'Kith', 'shoes', 'us'], ['cncpts', 'Concepts', 'shoes', 'us'],
  ['sneakersnstuff', 'Sneakersnstuff', 'shoes', 'se'], ['nakedcph', 'NAKED Copenhagen', 'shoes', 'dk'], ['endclothing', 'END.', 'shoes', 'uk'], ['footdistrict', 'FOOTDISTRICT', 'shoes', 'es'],
  ['sivasdescalzo', 'SVD', 'shoes', 'es'], ['slamjam', 'Slam Jam', 'shoes', 'it'],

  ['zara', 'Zara', 'clothing', 'es'], ['mango', 'Mango', 'clothing', 'es'], ['bershka', 'Bershka', 'clothing', 'es'], ['pullandbear', 'Pull&Bear', 'clothing', 'es'],
  ['massimodutti', 'Massimo Dutti', 'clothing', 'es'], ['stradivarius', 'Stradivarius', 'clothing', 'es'], ['oysho', 'Oysho', 'clothing', 'es'], ['lefties', 'Lefties', 'clothing', 'es'],
  ['desigual', 'Desigual', 'clothing', 'es'], ['bimbaylola', 'Bimba y Lola', 'clothing', 'es'], ['bluebananabrand', 'Blue Banana', 'clothing', 'es'], ['cortefiel', 'Cortefiel', 'clothing', 'es'],
  ['springfield', 'Springfield', 'clothing', 'es'], ['womensecret', 'women’secret', 'clothing', 'es'], ['scalperscompany', 'Scalpers', 'clothing', 'es'], ['nude-project', 'Nude Project', 'clothing', 'es'],
  ['pdpaola', 'PDPAOLA', 'clothing', 'es'], ['hm', 'H&M', 'clothing', 'us'], ['uniqlo', 'UNIQLO', 'clothing', 'us'], ['cos', 'COS', 'clothing', 'us'], ['arket', 'ARKET', 'clothing', 'se'],
  ['asos', 'ASOS', 'clothing', 'uk'], ['boohoo', 'boohoo', 'clothing', 'uk'], ['next', 'Next', 'clothing', 'uk'], ['marksandspencer', 'Marks & Spencer', 'clothing', 'uk'],
  ['ohpolly', 'Oh Polly', 'clothing', 'uk'], ['representclo', 'Represent', 'clothing', 'uk'], ['lounge', 'Lounge', 'clothing', 'uk'], ['farfetch', 'FARFETCH', 'clothing', 'uk'],
  ['burberry', 'Burberry', 'clothing', 'us'], ['gymshark', 'Gymshark', 'clothing', 'us'], ['zalando', 'Zalando', 'clothing', 'de'], ['aboutyou', 'ABOUT YOU', 'clothing', 'de'],
  ['breuninger', 'Breuninger', 'clothing', 'de'], ['mytheresa', 'Mytheresa', 'clothing', 'de'], ['reserved', 'Reserved', 'clothing', 'pl'], ['kiabi', 'Kiabi', 'clothing', 'es'],
  ['luisaviaroma', 'LUISAVIAROMA', 'clothing', 'it'], ['yoox', 'YOOX', 'clothing', 'it'], ['ssense', 'SSENSE', 'clothing', 'ca'], ['aritzia', 'Aritzia', 'clothing', 'us'],
  ['lululemon', 'lululemon', 'clothing', 'us'], ['aloyoga', 'Alo Yoga', 'clothing', 'us'], ['abercrombie', 'Abercrombie & Fitch', 'clothing', 'us'], ['hollisterco', 'Hollister', 'clothing', 'us'],
  ['ae', 'American Eagle', 'clothing', 'us'], ['aeropostale', 'Aéropostale', 'clothing', 'us'], ['gap', 'Gap', 'clothing', 'us'], ['oldnavy', 'Old Navy', 'clothing', 'us'],
  ['bananarepublic', 'Banana Republic', 'clothing', 'us'], ['jcrew', 'J.Crew', 'clothing', 'us'], ['madewell', 'Madewell', 'clothing', 'us'], ['levi', 'Levi’s', 'clothing', 'us'],
  ['calvinklein', 'Calvin Klein', 'clothing', 'us'], ['carhartt', 'Carhartt', 'clothing', 'us'], ['columbia', 'Columbia', 'clothing', 'us'], ['northface', 'The North Face', 'clothing', 'us'],
  ['carters', 'Carter’s', 'clothing', 'us'], ['tommy', 'Tommy Hilfiger', 'clothing', 'us'], ['ralphlauren', 'Ralph Lauren', 'clothing', 'us'],
  ['patagonia', 'Patagonia', 'clothing', 'us'], ['underarmour', 'Under Armour', 'clothing', 'us'], ['fashionnova', 'Fashion Nova', 'clothing', 'us'], ['goodamerican', 'Good American', 'clothing', 'us'],
  ['fahertybrand', 'Faherty', 'clothing', 'us'], ['bombas', 'Bombas', 'clothing', 'us'], ['anthropologie', 'Anthropologie', 'clothing', 'us'], ['freepeople', 'Free People', 'clothing', 'us'],
  ['urbanoutfitters', 'Urban Outfitters', 'clothing', 'us'], ['revolve', 'REVOLVE', 'clothing', 'us'], ['shopbop', 'Shopbop', 'clothing', 'us'], ['nordstrom', 'Nordstrom', 'clothing', 'us'],
  ['nordstromrack', 'Nordstrom Rack', 'clothing', 'us'], ['victoriassecret', 'Victoria’s Secret', 'clothing', 'us'], ['lacoste', 'Lacoste', 'clothing', 'us'],
  ['gucci', 'Gucci', 'clothing', 'us'], ['prada', 'Prada', 'clothing', 'us'], ['dior', 'Dior', 'clothing', 'us'], ['chanel', 'Chanel', 'clothing', 'us'], ['louisvuitton', 'Louis Vuitton', 'clothing', 'us'],
  ['valentino', 'Valentino', 'clothing', 'us'], ['moncler', 'Moncler', 'clothing', 'us'], ['tiffany', 'Tiffany & Co.', 'clothing', 'us'], ['swarovski', 'Swarovski', 'clothing', 'us'],
  ['pandora', 'Pandora', 'clothing', 'us'],

  ['sephora', 'Sephora', 'beauty', 'us'], ['ulta', 'Ulta Beauty', 'beauty', 'us'], ['dermstore', 'Dermstore', 'beauty', 'us'], ['beautylish', 'Beautylish', 'beauty', 'us'],
  ['credobeauty', 'Credo Beauty', 'beauty', 'us'], ['glossier', 'Glossier', 'beauty', 'us'], ['fentybeauty', 'Fenty Beauty', 'beauty', 'us'], ['rarebeauty', 'Rare Beauty', 'beauty', 'us'],
  ['rhodeskin', 'rhode', 'beauty', 'us'], ['kyliecosmetics', 'Kylie Cosmetics', 'beauty', 'us'], ['colourpop', 'ColourPop', 'beauty', 'us'], ['summerfridays', 'Summer Fridays', 'beauty', 'us'],
  ['tartecosmetics', 'tarte', 'beauty', 'us'], ['maccosmetics', 'MAC Cosmetics', 'beauty', 'us'], ['elfcosmetics', 'e.l.f. Cosmetics', 'beauty', 'us'], ['morphe', 'Morphe', 'beauty', 'us'], ['charlottetilbury', 'Charlotte Tilbury', 'beauty', 'us'], ['kosas', 'Kosas', 'beauty', 'us'], ['meritbeauty', 'Merit', 'beauty', 'us'], ['milkmakeup', 'Milk Makeup', 'beauty', 'us'],
  ['patrickta', 'Patrick Ta', 'beauty', 'us'], ['tower28beauty', 'Tower 28', 'beauty', 'us'], ['cultbeauty', 'Cult Beauty', 'beauty', 'uk'], ['lookfantastic', 'LOOKFANTASTIC', 'beauty', 'uk'],
  ['spacenk', 'Space NK', 'beauty', 'uk'], ['douglas', 'Douglas', 'beauty', 'de'], ['notino', 'Notino', 'beauty', 'cz'], ['druni', 'Druni', 'beauty', 'es'], ['arenal', 'Perfumerías Arenal', 'beauty', 'es'], ['primor', 'Primor', 'beauty', 'es'],
  ['3ina', '3INA', 'beauty', 'es'], ['saigucosmetics', 'Saigu', 'beauty', 'es'], ['kikomilano', 'KIKO Milano', 'beauty', 'it'],

  ['apple', 'Apple', 'tech', 'us'], ['samsung', 'Samsung', 'tech', 'us'], ['google', 'Google Store', 'tech', 'us'], ['microsoft', 'Microsoft Store', 'tech', 'us'], ['sony', 'Sony', 'tech', 'us'],
  ['xiaomi', 'Xiaomi', 'tech', 'cn'], ['oneplus', 'OnePlus', 'tech', 'us'], ['nothing', 'Nothing', 'tech', 'uk'], ['lg', 'LG', 'tech', 'us'], ['dell', 'Dell', 'tech', 'us'], ['hp', 'HP', 'tech', 'us'],
  ['lenovo', 'Lenovo', 'tech', 'us'], ['razer', 'Razer', 'tech', 'us'], ['logitech', 'Logitech', 'tech', 'us'], ['bose', 'Bose', 'tech', 'us'], ['jbl', 'JBL', 'tech', 'us'], ['gopro', 'GoPro', 'tech', 'us'],
  ['nikon', 'Nikon', 'tech', 'us'], ['anker', 'Anker', 'tech', 'us'], ['satechi', 'Satechi', 'tech', 'us'], ['spigen', 'Spigen', 'tech', 'us'], ['dyson', 'Dyson', 'tech', 'us'], ['philips', 'Philips', 'tech', 'us'],
  ['bestbuy', 'Best Buy', 'tech', 'us'], ['bhphotovideo', 'B&H Photo', 'tech', 'us'], ['adorama', 'Adorama', 'tech', 'us'], ['newegg', 'Newegg', 'tech', 'us'], ['microcenter', 'Micro Center', 'tech', 'us'],
  ['monoprice', 'Monoprice', 'tech', 'us'], ['gamestop', 'GameStop', 'tech', 'us'], ['backmarket', 'Back Market', 'tech', 'us'], ['mediamarkt', 'MediaMarkt', 'tech', 'de'], ['saturn', 'Saturn', 'tech', 'de'],
  ['pccomponentes', 'PcComponentes', 'tech', 'es'], ['coolblue', 'Coolblue', 'tech', 'nl'],

  ['ikea', 'IKEA', 'home', 'us'], ['wayfair', 'Wayfair', 'home', 'us'], ['zarahome', 'Zara Home', 'home', 'es'], ['decathlon', 'Decathlon', 'home', 'fr'],
];

/** Shown first: the stores customers ask for most. */
export const popularBrandKeys = ['amazon', 'nike', 'zara', 'apple', 'iherb', 'adidas', 'hm', 'sephora', 'ebay', 'newbalance', 'mango', 'uniqlo'];

const domainCountry: [suffix: string, country: StoreCountry][] = [
  ['.com.au', 'au'], ['.com.tr', 'tr'], ['.co.jp', 'jp'], ['.co.uk', 'uk'], ['.com.hk', 'hk'], ['.com.my', 'my'], ['.com.sg', 'sg'], ['.co.nz', 'nz'], ['.co.in', 'in'],
  ['.com.mx', 'mx'], ['.com.br', 'br'], ['.com.ar', 'ar'], ['.com.tw', 'tw'], ['.de', 'de'], ['.es', 'es'], ['.fr', 'fr'], ['.it', 'it'], ['.nl', 'nl'], ['.ca', 'ca'],
  ['.ae', 'ae'], ['.at', 'at'], ['.be', 'be'], ['.ch', 'ch'], ['.ie', 'ie'], ['.pl', 'pl'], ['.ph', 'ph'], ['.us', 'us'],
];
const genericSuffixes = ['.com', '.net', '.tech', '.eu'];

/** Groups country storefronts of one store ("amazon.de", "amazon.co.jp") under one key. */
export function brandKey(root: string) {
  const host = root.toLowerCase().replace(/^www\./, '').replace(/^(shop|es)\./, '').replace(/\.gap\.com$/, '.com');
  for (const [suffix] of domainCountry) if (host.endsWith(suffix)) return normalizeKey(host.slice(0, -suffix.length));
  for (const suffix of genericSuffixes) if (host.endsWith(suffix)) return normalizeKey(host.slice(0, -suffix.length));
  return normalizeKey(host);
}
const normalizeKey = (key: string) => key === 'mi' ? 'xiaomi' : key === 'thenorthface' ? 'northface' : key.replace(/^perfumerias/, '');

function storefrontCountry(root: string, fallback: StoreCountry): StoreCountry {
  if (root.startsWith('es.')) return 'es';
  return domainCountry.find(([suffix]) => root.endsWith(suffix))?.[1] ?? fallback;
}

export type StoreBrand = {
  key: string; name: string; focus: StoreFocus; country: StoreCountry;
  /** Country storefronts, the main one first. */
  storefronts: { root: string; country: StoreCountry }[];
  logo: boolean; popular: boolean;
};
const order = new Map(rows.map(([key], index) => [key, index]));
const grouped = new Map<string, string[]>();
for (const root of new Set<string>(supportedStoreRoots)) {
  const key = brandKey(root);
  grouped.set(key, [...(grouped.get(key) ?? []), root]);
}
const logos = new Set<string>(storeLogoKeys);
export const storeBrands: StoreBrand[] = rows.filter(([key]) => grouped.has(key)).map(([key, name, focus, country]) => {
  const roots = grouped.get(key)!;
  const storefronts = roots.map((root) => ({ root, country: storefrontCountry(root, country) }))
    .sort((a, b) => Number(b.root.endsWith('.com') && b.country === country) - Number(a.root.endsWith('.com') && a.country === country) || a.root.localeCompare(b.root));
  return { key, name, focus, country, storefronts, logo: logos.has(key), popular: popularBrandKeys.includes(key) };
}).sort((a, b) => order.get(a.key)! - order.get(b.key)!);
/** Roots without a brand row; a test keeps this empty. */
export const unlistedStoreRoots = [...grouped.entries()].filter(([key]) => !order.has(key)).flatMap(([, roots]) => roots);

const byKey = new Map(storeBrands.map((brand) => [brand.key, brand]));
export function brandForHost(host: string) {
  return byKey.get(brandKey(host));
}

export const storeCountryNames: Record<StoreCountry, Record<Locale, string>> = {
  us: /*@__PURE__*/withCyrillic({ ru: 'США', uz: 'AQSh', en: 'USA' }), uk: /*@__PURE__*/withCyrillic({ ru: 'Великобритания', uz: 'Buyuk Britaniya', en: 'United Kingdom' }), es: /*@__PURE__*/withCyrillic({ ru: 'Испания', uz: 'Ispaniya', en: 'Spain' }),
  de: /*@__PURE__*/withCyrillic({ ru: 'Германия', uz: 'Germaniya', en: 'Germany' }), fr: /*@__PURE__*/withCyrillic({ ru: 'Франция', uz: 'Fransiya', en: 'France' }), it: /*@__PURE__*/withCyrillic({ ru: 'Италия', uz: 'Italiya', en: 'Italy' }),
  nl: /*@__PURE__*/withCyrillic({ ru: 'Нидерланды', uz: 'Niderlandiya', en: 'Netherlands' }), se: /*@__PURE__*/withCyrillic({ ru: 'Швеция', uz: 'Shvetsiya', en: 'Sweden' }), dk: /*@__PURE__*/withCyrillic({ ru: 'Дания', uz: 'Daniya', en: 'Denmark' }),
  pl: /*@__PURE__*/withCyrillic({ ru: 'Польша', uz: 'Polsha', en: 'Poland' }), ch: /*@__PURE__*/withCyrillic({ ru: 'Швейцария', uz: 'Shveytsariya', en: 'Switzerland' }), cz: /*@__PURE__*/withCyrillic({ ru: 'Чехия', uz: 'Chexiya', en: 'Czechia' }),
  ca: /*@__PURE__*/withCyrillic({ ru: 'Канада', uz: 'Kanada', en: 'Canada' }), au: /*@__PURE__*/withCyrillic({ ru: 'Австралия', uz: 'Avstraliya', en: 'Australia' }), jp: /*@__PURE__*/withCyrillic({ ru: 'Япония', uz: 'Yaponiya', en: 'Japan' }),
  kr: /*@__PURE__*/withCyrillic({ ru: 'Южная Корея', uz: 'Janubiy Koreya', en: 'South Korea' }), tr: /*@__PURE__*/withCyrillic({ ru: 'Турция', uz: 'Turkiya', en: 'Turkey' }), ae: /*@__PURE__*/withCyrillic({ ru: 'ОАЭ', uz: 'BAA', en: 'UAE' }),
  cn: /*@__PURE__*/withCyrillic({ ru: 'Китай', uz: 'Xitoy', en: 'China' }), at: /*@__PURE__*/withCyrillic({ ru: 'Австрия', uz: 'Avstriya', en: 'Austria' }), be: /*@__PURE__*/withCyrillic({ ru: 'Бельгия', uz: 'Belgiya', en: 'Belgium' }),
  ie: /*@__PURE__*/withCyrillic({ ru: 'Ирландия', uz: 'Irlandiya', en: 'Ireland' }), ph: /*@__PURE__*/withCyrillic({ ru: 'Филиппины', uz: 'Filippin', en: 'Philippines' }), hk: /*@__PURE__*/withCyrillic({ ru: 'Гонконг', uz: 'Gonkong', en: 'Hong Kong' }),
  my: /*@__PURE__*/withCyrillic({ ru: 'Малайзия', uz: 'Malayziya', en: 'Malaysia' }), sg: /*@__PURE__*/withCyrillic({ ru: 'Сингапур', uz: 'Singapur', en: 'Singapore' }), nz: /*@__PURE__*/withCyrillic({ ru: 'Новая Зеландия', uz: 'Yangi Zelandiya', en: 'New Zealand' }),
  in: /*@__PURE__*/withCyrillic({ ru: 'Индия', uz: 'Hindiston', en: 'India' }), mx: /*@__PURE__*/withCyrillic({ ru: 'Мексика', uz: 'Meksika', en: 'Mexico' }), br: /*@__PURE__*/withCyrillic({ ru: 'Бразилия', uz: 'Braziliya', en: 'Brazil' }),
  ar: /*@__PURE__*/withCyrillic({ ru: 'Аргентина', uz: 'Argentina', en: 'Argentina' }), tw: /*@__PURE__*/withCyrillic({ ru: 'Тайвань', uz: 'Tayvan', en: 'Taiwan' }),
};
export const storeFocusNames: Record<StoreFocus, Record<Locale, string>> = {
  clothing: /*@__PURE__*/withCyrillic({ ru: 'Одежда и аксессуары', uz: 'Kiyim va aksessuarlar', en: 'Clothing & accessories' }),
  shoes: /*@__PURE__*/withCyrillic({ ru: 'Обувь и кроссовки', uz: 'Poyabzal va krossovkalar', en: 'Shoes & sneakers' }),
  beauty: /*@__PURE__*/withCyrillic({ ru: 'Красота и здоровье', uz: 'Go‘zallik va salomatlik', en: 'Beauty & health' }),
  tech: /*@__PURE__*/withCyrillic({ ru: 'Техника', uz: 'Texnika', en: 'Electronics' }),
  home: /*@__PURE__*/withCyrillic({ ru: 'Дом и спорт', uz: 'Uy va sport', en: 'Home & sport' }),
  marketplace: /*@__PURE__*/withCyrillic({ ru: 'Маркетплейсы и универмаги', uz: 'Marketpleyslar va univermaglar', en: 'Marketplaces & department stores' }),
};
export const storeFocusOrder: StoreFocus[] = ['marketplace', 'clothing', 'shoes', 'beauty', 'tech', 'home'];

/** "Amazon", or "Amazon · Germany" for a storefront outside the brand's main country. */
export function storefrontLabel(host: string, locale: Locale) {
  const brand = brandForHost(host);
  if (!brand) return host;
  const country = storefrontCountry(host.replace(/^www\./, ''), brand.country);
  return country === brand.country ? brand.name : `${brand.name} · ${storeCountryNames[country][locale]}`;
}

export type StoreRegion = 'us' | 'eu' | 'asia' | 'other';
const regions: Record<StoreCountry, StoreRegion> = {
  us: 'us', uk: 'eu', es: 'eu', de: 'eu', fr: 'eu', it: 'eu', nl: 'eu', se: 'eu', dk: 'eu', pl: 'eu', ch: 'eu', cz: 'eu', at: 'eu', be: 'eu', ie: 'eu',
  cn: 'asia', jp: 'asia', kr: 'asia', hk: 'asia', my: 'asia', sg: 'asia', tw: 'asia', in: 'asia', ph: 'asia',
  ca: 'other', au: 'other', nz: 'other', mx: 'other', br: 'other', ar: 'other', tr: 'other', ae: 'other',
};
export const storeRegionOrder: StoreRegion[] = ['us', 'eu', 'asia', 'other'];
/** Regions where the brand has a storefront. */
export function brandRegions(brand: StoreBrand) {
  return new Set(brand.storefronts.map((storefront) => regions[storefront.country]));
}
