import type { Locale } from './i18n.ts';
import { brandForHost, storefrontLabel } from './store-brands.ts';

/**
 * Catalog search in the customer's own words: category synonyms in Russian, Uzbek and English,
 * Russian spellings of brand and store names ("найк" → Nike) and a plain Cyrillic → Latin
 * transliteration for everything the dictionary does not list ("пума" → "puma").
 * Pure; the catalog query passes the extra words through `CatalogContext.words`.
 */

/** Words customers type for a catalog category, in all three languages (lower case). */
export const categorySynonyms: Record<string, string[]> = {
  'Обувь': ['обувь', 'кроссовки', 'кеды', 'ботинки', 'sneakers', 'shoes', 'poyabzal', 'krossovka'],
  'Одежда': ['одежда', 'худи', 'футболка', 'джинсы', 'clothing', 'hoodie', 'kiyim'],
  'Электроника': ['техника', 'электроника', 'гаджет', 'electronics', 'telefon', 'texnika'],
  'Красота и уход': ['косметика', 'уход', 'парфюм', 'beauty', 'cosmetics', 'kosmetika'],
  'Дом и быт': ['дом', 'кухня', 'home'],
  'Аксессуары': ['аксессуары', 'сумка', 'accessories'],
  'Спорт': ['спорт', 'sport'],
};

/** Russian spellings of brand and store names → the Latin name as the store writes it (lower case). */
export const brandAliases: [cyrillic: string, latin: string][] = [
  ['найк', 'nike'], ['адидас', 'adidas'], ['зара', 'zara'], ['эпл', 'apple'], ['эппл', 'apple'], ['самсунг', 'samsung'],
  ['нью бэланс', 'new balance'], ['нью баланс', 'new balance'], ['виктория сикрет', "victoria's secret"],
  ['амазон', 'amazon'], ['ибей', 'ebay'], ['ебей', 'ebay'], ['таргет', 'target'], ['волмарт', 'walmart'], ['сефора', 'sephora'],
  ['айхерб', 'iherb'], ['манго', 'mango'], ['юникло', 'uniqlo'], ['пума', 'puma'], ['рибок', 'reebok'], ['конверс', 'converse'],
  ['ванс', 'vans'], ['левис', "levi's"], ['лего', 'lego'], ['анкер', 'anker'], ['меррелл', 'merrell'], ['брукс', 'brooks'],
  ['асикс', 'asics'], ['хока', 'hoka'], ['крокс', 'crocs'], ['угг', 'ugg'], ['тимберленд', 'timberland'], ['саломон', 'salomon'],
  ['скечерс', 'skechers'], ['сони', 'sony'], ['дайсон', 'dyson'], ['сяоми', 'xiaomi'], ['икея', 'ikea'], ['лакост', 'lacoste'],
  ['гуччи', 'gucci'], ['прада', 'prada'], ['диор', 'dior'], ['шанель', 'chanel'], ['луи виттон', 'louis vuitton'],
  ['гэп', 'gap'], ['колумбия', 'columbia'], ['патагония', 'patagonia'], ['андер армор', 'under armour'],
];

const cyrillicToLatin: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

/** A search string as compared: lower case, "ё" as "е", one kind of apostrophe, single spaces. */
export function normalizeSearch(q: string): string {
  return q.toLocaleLowerCase().replace(/ё/g, 'е').replace(/[’‘ʼ`´]/g, "'").replace(/\s+/g, ' ').trim();
}

/** Plain Cyrillic → Latin transliteration of a normalized string; Latin letters and digits pass through. */
export function transliterate(ru: string): string {
  return normalizeSearch(ru).replace(/[а-яёўқғҳ]/g, (letter) => cyrillicToLatin[letter] ?? letter);
}

/** Letters and digits only, so the host "victoriassecret.com" matches "victoria's secret". */
const squash = (text: string) => text.replace(/[^a-z0-9а-яё]+/g, '');
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The Latin name as whole words in the text: "gap" never matches "megapixel", "ugg" never "rugged". */
const hasWord = (text: string, word: string) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}(?![a-z0-9])`).test(text);

/**
 * Extra words the search should match for a product: category synonyms, the Russian spellings of
 * its brand and store, and the localized store label ("Amazon · Germany"). Lower case, space separated.
 */
export function searchWords(item: { product: { name: string; brand: string; category: string }; store: string }, locale: Locale = 'ru'): string {
  const label = brandForHost(item.store) ? storefrontLabel(item.store, locale) : '';
  const own = normalizeSearch([item.product.name, item.product.brand, label].join(' '));
  // The store host has no word breaks ("newbalance.com"), so it is compared squashed; the text by whole words.
  const host = squash(normalizeSearch(item.store));
  const words = [...(categorySynonyms[item.product.category] ?? [])];
  for (const [cyrillic, latin] of brandAliases) {
    if (hasWord(own, latin) || host.includes(squash(latin))) words.push(cyrillic);
  }
  if (label) words.push(normalizeSearch(label));
  return [...new Set(words)].join(' ');
}

/** Whether one normalized query word occurs in the normalized text, as typed or (from three letters) transliterated. */
export function wordMatches(text: string, word: string): boolean {
  if (text.includes(word)) return true;
  if (word.length < 3) return false;
  const latin = transliterate(word);
  return latin !== word && text.includes(latin);
}
