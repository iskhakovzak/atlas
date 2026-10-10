import type {Extracted, ProductCategory} from './extract.ts';

/**
 * Small, explicit profiles for the merchants that Atlas promises to support
 * first. Profiles never invent a price, variant or stock state. They only
 * provide stable metadata when a public page omits it and describe the
 * adapter tier used by the importer/monitoring UI.
 */
export type MerchantPriority = 1 | 2;
export type MerchantProfile = {
  root: string;
  name: string;
  priority: MerchantPriority;
  focus: 'Одежда' | 'Кроссовки' | 'Красота' | 'Техника' | 'Универмаг';
  defaultBrand?: string;
  defaultCategory?: ProductCategory;
  defaultCountry?: string;
  regions: string[];
  adapter: 'amazon-location' | 'adidas-json' | 'asos-page' | 'shopify-json' | 'json-ld' | 'embedded-json' | 'official-api-required';
};

const p = (profile: MerchantProfile) => profile;

/** The initial importer contract is intentionally explicit and reviewable. */
export const priorityMerchantProfiles: MerchantProfile[] = [
  p({root: 'amazon.com', name: 'Amazon US', priority: 1, focus: 'Универмаг', defaultCountry: 'США', regions: ['США'], adapter: 'amazon-location'}),
  p({root: 'nike.com', name: 'Nike', priority: 1, focus: 'Кроссовки', defaultBrand: 'Nike', defaultCategory: 'Обувь', defaultCountry: 'США', regions: ['США', 'Европа'], adapter: 'json-ld'}),
  p({root: 'adidas.com', name: 'adidas', priority: 1, focus: 'Кроссовки', defaultBrand: 'adidas', defaultCategory: 'Обувь', defaultCountry: 'США', regions: ['США', 'Европа'], adapter: 'adidas-json'}),
  p({root: 'macys.com', name: "Macy's", priority: 1, focus: 'Универмаг', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'ebay.com', name: 'eBay', priority: 1, focus: 'Универмаг', regions: ['США', 'Европа'], adapter: 'official-api-required'}),
  p({root: 'walmart.com', name: 'Walmart', priority: 1, focus: 'Универмаг', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'target.com', name: 'Target', priority: 1, focus: 'Универмаг', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'bestbuy.com', name: 'Best Buy', priority: 1, focus: 'Техника', defaultBrand: 'Best Buy', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'sephora.com', name: 'Sephora', priority: 1, focus: 'Красота', defaultCategory: 'Красота и уход', defaultCountry: 'США', regions: ['США', 'Европа'], adapter: 'embedded-json'}),
  p({root: 'footlocker.com', name: 'Foot Locker', priority: 1, focus: 'Кроссовки', defaultCategory: 'Обувь', defaultCountry: 'США', regions: ['США', 'Европа'], adapter: 'embedded-json'}),
  p({root: 'victoriassecret.com', name: "Victoria's Secret US", priority: 1, focus: 'Одежда', defaultBrand: "Victoria's Secret", defaultCategory: 'Одежда', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'nordstrom.com', name: 'Nordstrom', priority: 1, focus: 'Универмаг', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'ulta.com', name: 'Ulta Beauty', priority: 1, focus: 'Красота', defaultCategory: 'Красота и уход', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'apple.com', name: 'Apple US', priority: 1, focus: 'Техника', defaultBrand: 'Apple', defaultCategory: 'Электроника', defaultCountry: 'США', regions: ['США'], adapter: 'json-ld'}),
  p({root: 'newbalance.com', name: 'New Balance US', priority: 1, focus: 'Кроссовки', defaultBrand: 'New Balance', defaultCategory: 'Обувь', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'hm.com', name: 'H&M', priority: 1, focus: 'Одежда', defaultBrand: 'H&M', regions: ['США', 'Европа'], adapter: 'embedded-json'}),
  p({root: 'puma.com', name: 'PUMA', priority: 1, focus: 'Кроссовки', defaultBrand: 'PUMA', regions: ['США', 'Европа'], adapter: 'embedded-json'}),
  p({root: 'uniqlo.com', name: 'UNIQLO', priority: 1, focus: 'Одежда', defaultBrand: 'UNIQLO', regions: ['США', 'Европа'], adapter: 'embedded-json'}),
  p({root: 'bershka.com', name: 'Bershka', priority: 1, focus: 'Одежда', defaultBrand: 'Bershka', regions: ['США', 'Европа'], adapter: 'embedded-json'}),
  p({root: 'gap.com', name: 'Gap', priority: 1, focus: 'Одежда', defaultBrand: 'Gap', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'converse.com', name: 'Converse', priority: 1, focus: 'Кроссовки', defaultBrand: 'Converse', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'vans.com', name: 'Vans', priority: 1, focus: 'Кроссовки', defaultBrand: 'Vans', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'skechers.com', name: 'Skechers', priority: 1, focus: 'Кроссовки', defaultBrand: 'Skechers', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'crocs.com', name: 'Crocs', priority: 1, focus: 'Кроссовки', defaultBrand: 'Crocs', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'columbia.com', name: 'Columbia', priority: 1, focus: 'Одежда', defaultBrand: 'Columbia', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'thenorthface.com', name: 'The North Face', priority: 1, focus: 'Одежда', defaultBrand: 'The North Face', regions: ['США', 'Европа'], adapter: 'embedded-json'}),
  p({root: 'northface.com', name: 'The North Face', priority: 2, focus: 'Одежда', defaultBrand: 'The North Face', regions: ['США', 'Европа'], adapter: 'embedded-json'}),
  p({root: 'underarmour.com', name: 'Under Armour', priority: 1, focus: 'Одежда', defaultBrand: 'Under Armour', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'levi.com', name: 'Levi’s', priority: 1, focus: 'Одежда', defaultBrand: 'Levi’s', regions: ['США', 'Европа'], adapter: 'embedded-json'}),
  p({root: 'pullandbear.com', name: 'Pull&Bear', priority: 1, focus: 'Одежда', defaultBrand: 'Pull&Bear', regions: ['США', 'Европа'], adapter: 'embedded-json'}),
  p({root: 'tommy.com', name: 'Tommy Hilfiger', priority: 1, focus: 'Одежда', defaultBrand: 'Tommy Hilfiger', regions: ['США', 'Европа'], adapter: 'embedded-json'}),
  p({root: 'ralphlauren.com', name: 'Ralph Lauren', priority: 1, focus: 'Одежда', defaultBrand: 'Ralph Lauren', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'carters.com', name: 'Carter’s', priority: 1, focus: 'Одежда', defaultBrand: 'Carter’s', defaultCategory: 'Одежда', defaultCountry: 'США', regions: ['США'], adapter: 'embedded-json'}),
  p({root: 'shop.simon.com', name: 'ShopSimon', priority: 1, focus: 'Универмаг', defaultCountry: 'США', regions: ['США'], adapter: 'shopify-json'}),
  p({root: 'footlocker.es', name: 'Foot Locker España', priority: 2, focus: 'Кроссовки', defaultCategory: 'Обувь', defaultCountry: 'Испания', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'sephora.es', name: 'Sephora España', priority: 2, focus: 'Красота', defaultCategory: 'Красота и уход', defaultCountry: 'Испания', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'es.victoriassecret.com', name: "Victoria's Secret España", priority: 2, focus: 'Одежда', defaultBrand: "Victoria's Secret", defaultCategory: 'Одежда', defaultCountry: 'Испания', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'zalando.com', name: 'Zalando', priority: 2, focus: 'Одежда', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'zalando.de', name: 'Zalando Deutschland', priority: 2, focus: 'Одежда', defaultCountry: 'Германия', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'zalando.es', name: 'Zalando España', priority: 2, focus: 'Одежда', defaultCountry: 'Испания', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'zalando.fr', name: 'Zalando France', priority: 2, focus: 'Одежда', defaultCountry: 'Франция', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'zalando.it', name: 'Zalando Italia', priority: 2, focus: 'Одежда', defaultCountry: 'Италия', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'asos.com', name: 'ASOS', priority: 2, focus: 'Одежда', defaultCountry: 'Великобритания', regions: ['Европа'], adapter: 'asos-page'}),
  p({root: 'zara.com', name: 'Zara', priority: 2, focus: 'Одежда', defaultBrand: 'Zara', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'mango.com', name: 'Mango', priority: 2, focus: 'Одежда', defaultBrand: 'Mango', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'farfetch.com', name: 'Farfetch', priority: 2, focus: 'Одежда', regions: ['Европа', 'США'], adapter: 'embedded-json'}),
  p({root: 'primor.eu', name: 'Primor', priority: 2, focus: 'Красота', defaultCategory: 'Красота и уход', defaultCountry: 'Испания', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'perfumeriasprimor.eu', name: 'Primor', priority: 2, focus: 'Красота', defaultCategory: 'Красота и уход', defaultCountry: 'Испания', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'druni.es', name: 'Druni', priority: 2, focus: 'Красота', defaultCategory: 'Красота и уход', defaultCountry: 'Испания', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'mediamarkt.de', name: 'MediaMarkt Deutschland', priority: 2, focus: 'Техника', defaultCategory: 'Электроника', defaultCountry: 'Германия', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'mediamarkt.es', name: 'MediaMarkt España', priority: 2, focus: 'Техника', defaultCategory: 'Электроника', defaultCountry: 'Испания', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'mediamarkt.it', name: 'MediaMarkt Italia', priority: 2, focus: 'Техника', defaultCategory: 'Электроника', defaultCountry: 'Италия', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'pccomponentes.com', name: 'PcComponentes', priority: 2, focus: 'Техника', defaultCategory: 'Электроника', defaultCountry: 'Испания', regions: ['Европа'], adapter: 'embedded-json'}),
  p({root: 'decathlon.es', name: 'Decathlon España', priority: 2, focus: 'Техника', defaultCategory: 'Спорт', defaultCountry: 'Испания', regions: ['Европа'], adapter: 'embedded-json'}),
];

const profiles = new Map(priorityMerchantProfiles.map(profile => [profile.root, profile]));

function rootForHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www2?\./, '');
  if (profiles.has(host)) return host;
  // Regional eBay/Amazon/Zalando hosts share the same importer contract.
  for (const root of profiles.keys()) if (host.endsWith(`.${root}`)) return root;
  if (host.startsWith('amazon.')) return 'amazon.com';
  if (host.startsWith('ebay.')) return 'ebay.com';
  if (host.startsWith('zalando.')) return 'zalando.com';
  return undefined;
}

export function merchantProfileForUrl(value: string | URL) {
  const url = typeof value === 'string' ? new URL(value) : value;
  const root = rootForHost(url.hostname);
  return root ? profiles.get(root) : undefined;
}

export function priorityMerchants(priority?: MerchantPriority) {
  return priority ? priorityMerchantProfiles.filter(profile => profile.priority === priority) : [...priorityMerchantProfiles];
}

/**
 * Enrich only missing/ambiguous metadata. Source price, options, availability,
 * photos and shipping are deliberately untouched and must come from the page.
 */
export function applyMerchantProfile(extracted: Extracted, sourceUrl: string): Extracted {
  const profile = merchantProfileForUrl(sourceUrl);
  if (!profile) return extracted;
  const category = extracted.category && extracted.category !== 'Другое'
    ? extracted.category
    : profile.defaultCategory;
  return {
    ...extracted,
    brand: !extracted.brand || extracted.brand === new URL(sourceUrl).hostname.replace(/^www\./, '') ? profile.defaultBrand ?? extracted.brand : extracted.brand,
    category,
    country: extracted.country || profile.defaultCountry,
    method: extracted.method ? extracted.method.includes(profile.name) ? extracted.method : `${extracted.method} · ${profile.name}` : undefined,
  };
}
