import { storeBrands } from './store-brands.ts';

/**
 * A catalog card prints the brand on its own line, so the title does not start with it again: "Nike Club · Fleece Hoodie"
 * under "Nike" reads "Club · Fleece Hoodie" (direction A, 1 November 2026). Display only: the stored name, the search,
 * the product sheet, the cart and the order keep the full name.
 */
const separators = /^[\s·•|:,–—\-®™]+/u;
export function nameWithoutBrand(name: string, brand: string | undefined) {
  const full = name.trim(), mark = (brand ?? '').trim();
  if (!mark || full.length <= mark.length) return full;
  if (full.slice(0, mark.length).toLocaleLowerCase() !== mark.toLocaleLowerCase()) return full;
  const after = full.slice(mark.length);
  // "Nikeland Socks" is not "Nike" + "land Socks": the brand must end at a word boundary.
  if (/^[\p{L}\p{N}]/u.test(after)) return full;
  const rest = after.replace(separators, '');
  // What is left must still name something ("Apple" + " 2" says nothing on its own).
  if (rest.length < 3 || !/\p{L}/u.test(rest)) return full;
  // Kept as the store wrote it: "iPhone 15" must not become "IPhone 15".
  return rest;
}

const letters = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
/**
 * The brand line of a card. Imported brands are sometimes the store's raw field ("Brand: TONY'S TEXTILES") or a slug
 * ("kylie-cosmetics"): the label drops the "Brand:" prefix and, when it names the store, takes the store's own spelling.
 * A marketplace is not the maker: the importer often records the marketplace itself as the brand ("Amazon" over a Sony
 * headset, "eBay" over an HP laptop), so with `marketplace` (that store's own name) such a brand is an empty label, and
 * so is no brand at all; the card then shows the category (the store is the mark on the photo).
 */
export function displayBrand(brand: string | undefined, store: string, marketplace?: string) {
  const text = (brand ?? '').trim().replace(/^(brand|бренд|marka)\s*:\s*/iu, '').trim();
  if (!text) return '';
  if (marketplace && [store, marketplace].some((name) => name && letters(text) === letters(name))) return '';
  return store && letters(text) === letters(store) ? store : text;
}

const departmentWords = /^(?:(men|man|mens|men's|male)|(women|woman|womens|women's|ladies|female)|(kids|kid's|kids'|youth|boys|boy's|girls|girl's|junior|juniors)|(baby|babies|infant|infants|toddler|toddlers)|(unisex))(?=[\s·•|:,–—\-]|$)[\s·•|:,–—\-]*/iu;
const departmentKeys = ['men', 'women', 'kids', 'baby', 'unisex'] as const;
export type NameDepartment = typeof departmentKeys[number];

/**
 * Store titles often start with who the item is for ("adidas men Core Pants", "Women's Swift Run"): the card says it as a
 * small label instead (owner, 2 November 2026), so the word leaves the shown title — at the start or right after the
 * brand. Display only: the stored name and the search keep it.
 */
export function withoutDepartment(name: string, brand?: string) {
  const full = name.trim(), mark = (brand ?? '').trim();
  const strip = (text: string) => { const rest = text.replace(departmentWords, ''); return rest.length >= 3 && /\p{L}/u.test(rest) ? rest : text; };
  if (mark && full.slice(0, mark.length).toLocaleLowerCase() === mark.toLocaleLowerCase() && /^\s/.test(full.slice(mark.length))) {
    const after = full.slice(mark.length).trimStart(), rest = strip(after);
    return rest === after ? full : `${full.slice(0, mark.length)} ${rest}`;
  }
  return strip(full);
}

/** Who the item is for, read from the start of its title (or right after the brand) when the facets do not say it. */
export function departmentInName(name: string, brand?: string): NameDepartment | undefined {
  let text = name.trim();
  const mark = (brand ?? '').trim();
  if (mark && text.slice(0, mark.length).toLocaleLowerCase() === mark.toLocaleLowerCase()) text = text.slice(mark.length).trimStart();
  const match = departmentWords.exec(text);
  if (!match) return undefined;
  const index = match.slice(1).findIndex(Boolean);
  return index >= 0 ? departmentKeys[index] : undefined;
}

const departmentText: Record<NameDepartment, { ru: string; uz: string; en: string }> = {
  men: { ru: 'Мужское', uz: 'Erkaklar uchun', en: 'Men' },
  women: { ru: 'Женское', uz: 'Ayollar uchun', en: 'Women' },
  kids: { ru: 'Детское', uz: 'Bolalar uchun', en: 'Kids' },
  baby: { ru: 'Для малышей', uz: 'Chaqaloqlar uchun', en: 'Baby' },
  unisex: { ru: 'Унисекс', uz: 'Uniseks', en: 'Unisex' },
};
/** The card's small "who it is for" label: the facets' department, else the word read from the title. Latin uz; the caller converts for oz. */
export function departmentLabel(product: { name: string; brand?: string; facets?: { department?: string } }, locale: 'ru' | 'uz' | 'en'): string {
  const key = (product.facets?.department ?? departmentInName(product.name, product.brand)) as NameDepartment | undefined;
  return key && departmentText[key] ? departmentText[key][locale] : '';
}

/* ------------------------------------------------------------------------------------------------------------------
 * Display casing (owner, 3 November 2026: «Названия при импорте — часть капсом, часть маленькими, так же и размеры.
 * Везде нормализуй красиво»). Stores write "adidas ADIDAS CRAZY LITE AOP TANK Top" or "nike air max 90"; the screens
 * show "adidas Crazy Lite AOP Tank Top" and "Nike Air Max 90". Display only: the stored name, the search, the store and
 * the operator keep the store's text. Codes and acronyms stay as written: words of up to three capitals (AOP, USB, XL),
 * anything with a digit (4K, O7865, 3XLT; "ULTIMATE365" becomes "Ultimate365"), capitals without a vowel (HTHR, WMNS),
 * a short list of longer acronyms (FIFA, OLED, HDMI…) and brands as they spell themselves (adidas, PUMA, ASICS, eBay).
 * Words with a capital inside ("iPhone", "AirPods", "McCartney") are never touched.
 * ---------------------------------------------------------------------------------------------------------------- */

// Acronyms of four letters and more that keep their capitals.
const upperWords = new Set(['FIFA', 'UEFA', 'NCAA', 'WNBA', 'LOVB', 'NASA', 'NASCAR', 'ESPN', 'UCLA', 'OLED', 'QLED', 'AMOLED', 'HDMI', 'DSLR', 'NVME', 'HEPA', 'JPEG', 'ANSI', 'RGBW', 'SWAT', 'ASAP', 'NVIDIA', 'LEGO', 'IKEA', 'YETI', 'BAPE', 'DKNY', 'USMNT', 'USWNT', 'MLBPA', 'NFLPA']);
// Common words of two or three letters that a shouting title writes in capitals: "SPORT TEE" reads "Sport Tee".
const shortWords = new Set(['TEE', 'CAP', 'BAG', 'SET', 'HAT', 'TOP', 'PRO', 'ALL', 'ARE', 'MY', 'LOW', 'CUT', 'NEW', 'ONE', 'TWO', 'SIX', 'TEN', 'BOY', 'MEN', 'FUN', 'RUN', 'KIT', 'LEG', 'ARM', 'SUN', 'DAY', 'WAY', 'OUT', 'OFF', 'UP', 'ON', 'BIG', 'KID', 'AIR', 'ZIP', 'PAD', 'MAT', 'CUP', 'PAN', 'POT', 'LID', 'BOX', 'PIN', 'PEN', 'INK', 'OIL', 'GEL', 'WAX', 'TOE', 'RED', 'TAN', 'SKY', 'ICE', 'SEA', 'OAK', 'ASH', 'GUM', 'JET', 'HOT', 'DRY', 'FLY', 'POP', 'MIX', 'FIT', 'BOW', 'MAX', 'MID', 'HI', 'GO', 'NO', 'YES', 'OUR', 'HER', 'HIS', 'WE', 'ME', 'BE', 'IS', 'IT', 'DO', 'EYE', 'LIP', 'TIP', 'RIB', 'HEM', 'JOY', 'GYM', 'RUG', 'MUG', 'TUB', 'JAR', 'CAN', 'TIN', 'KEY', 'SKI', 'SPA', 'TOY', 'WEB', 'NET', 'ROW', 'BAY', 'DOG', 'CAT', 'PET', 'BEE', 'OWL', 'FOX', 'NEO', 'MAN', 'GUY', 'LAB', 'ART', 'OLD', 'WOW', 'BED', 'TAB', 'END', 'AGE', 'ACE', 'FAN', 'BAR', 'GEO', 'TRI', 'DUO', 'EGG', 'HUG', 'ELF', 'ZEN', 'RAY', 'SUB', 'FLO', 'TEK', 'CHI', 'BRA', 'LUX', 'SOX', 'TRY',
  // Joining words: small inside a recased title, capitalised inside a compound ("GO-TO" → "Go-To").
  'TO', 'OF', 'IN', 'AND', 'THE', 'FOR', 'BY', 'AT', 'OR', 'AN']);
// Joining words that stay small inside a title the display recased ("Shorts with Pockets").
const minorWords = new Set(['an', 'and', 'or', 'of', 'the', 'with', 'for', 'in', 'to', 'by', 'at', 'from', 'и', 'в', 'с', 'для', 'на']);
// Acronyms an all-lowercase title writes in small letters.
const lowerAcronyms = new Set(['usb', 'led', 'lcd', 'tv', 'hd', 'uhd', 'hdr', 'ssd', 'hdd', 'gps', 'nfc', 'pc', 'uk', 'eu', 'usa', 'uv', 'spf', 'dna', 'og', 'nba', 'nfl', 'mlb', 'nhl', 'fifa', 'oled', 'hdmi', 'ai', 'diy', 'bpa', 'rgb', 'xs', 'xl', 'xxl', 'xxs', 'xxxl', '2xl', '3xl', '4xl', 'ps5', 'ps4', 'mp3', '4k', '8k', '5g']);
// Brands whose spelling is not "Capital + small letters" (from the store list); words that are also ordinary words
// (GOAT, COS, REVOLVE…) are left out.
const brandSkip = new Set(['goat', 'cos', 'end.', 'svd', 'dsw', 'next', 'on', 'revolve', 'otto', 'merit']);
const brandSpellings = new Map<string, string>();
for (const { name } of storeBrands) {
  if (/\s/.test(name) || brandSkip.has(name.toLowerCase()) || !/^[\p{L}\p{N}]+$/u.test(name)) continue;
  if (name !== capitalised(name)) brandSpellings.set(name.toLowerCase(), name);
}
for (const extra of ['iPhone', 'iPad', 'iMac', 'MacBook', 'AirPods', 'AirTag', 'PlayStation', 'YouTube', 'PUMA', 'ASICS', 'HOKA', 'UGG', 'adidas']) brandSpellings.set(extra.toLowerCase(), extra);

function capitalised(word: string): string {
  // "MEN'S" → "Men's", "O'NEILL" → "O'Neill".
  const parts = word.split(/(['’])/u);
  return parts.map((part, index) => {
    if (!part || part === "'" || part === '’') return part;
    if (index > 0 && parts[index - 2]?.length !== 1) return part.toLocaleLowerCase();
    return part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase();
  }).join('');
}
const hasLower = (text: string) => /\p{Ll}/u.test(text), hasUpper = (text: string) => /\p{Lu}/u.test(text);
const hasVowel = (word: string) => /[aeiouаеёиоуыэюяіїєөүұ]/iu.test(word.normalize('NFD').replace(/\p{M}/gu, ''));

type CaseContext = { lowerTitle: boolean; first: boolean; brand?: string };
function caseWord(word: string, { lowerTitle, first, brand }: CaseContext): string {
  const lower = word.toLocaleLowerCase();
  if (brand && lower === brand.toLocaleLowerCase()) return brand;
  if (/\p{N}/u.test(word)) {
    // "ULTIMATE365" → "Ultimate365"; codes (4K, O7865, XL2, 3XLT, ADI365) stay.
    const lettersThenDigits = /^(\p{Lu}{4,})(\p{N}+)$/u.exec(word);
    if (lettersThenDigits && hasVowel(lettersThenDigits[1]) && !upperWords.has(lettersThenDigits[1])) return capitalised(lettersThenDigits[1]) + lettersThenDigits[2];
    if (lowerTitle && (lowerAcronyms.has(lower) || /^\d+(?:gb|tb|mb)$/u.test(lower))) return word.toLocaleUpperCase();
    return word;
  }
  const spelled = brandSpellings.get(lower);
  if (spelled) return spelled;
  if (hasLower(word) && hasUpper(word)) return word; // "Tee", "iPhone", "AirPods", "McCartney"
  if (hasUpper(word)) {
    const letters = word.replace(/['’]/gu, '');
    if (letters.length === 1 || upperWords.has(word)) return word;
    if (!first && minorWords.has(lower)) return lower;
    if (letters.length <= 3) return shortWords.has(word) ? capitalised(word) : word;
    return hasVowel(letters) ? capitalised(word) : word;
  }
  // All small letters: only a title written wholly in small letters is recased.
  if (!lowerTitle) return word;
  if (lowerAcronyms.has(lower)) return word.toLocaleUpperCase();
  if (!first && minorWords.has(lower)) return word;
  return capitalised(word);
}

const wordPattern = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
/** Recases the words of a text for display (see above). `brand`: the product's brand, kept in its own spelling. */
export function displayCase(text: string, brand?: string): string {
  const mark = (brand ?? '').trim();
  const source = text.replace(/\s+/g, ' ').trim();
  if (!source) return source;
  // The brand's own letters do not count: "adidas" in "adidas cushioned socks" is the brand, not a sign of a lowercase title.
  const rest = mark ? source.split(' ').filter(word => word.toLocaleLowerCase() !== mark.toLocaleLowerCase()).join(' ') : source;
  const lowerTitle = !hasUpper(rest) && hasLower(rest);
  const markWord = mark && !/\s/.test(mark) && mark !== capitalised(mark) ? mark : undefined;
  let seen = false;
  const cased = source.split(' ').map(token => {
    // Codes with an underscore ("X_PLR") and links are left as written.
    if (token.includes('_') || /^https?:/i.test(token)) { seen = true; return token; }
    return token.replace(wordPattern, (word: string, at: number) => {
      // Inside a compound ("GO-TO", "ALL-IN-ONE") a joining word is a part of the word and gets its capital.
      const first = !seen || /[-‐]/u.test(token.charAt(at - 1));
      seen = true;
      return caseWord(word, { lowerTitle, first, brand: markWord });
    });
  }).join(' ');
  return upperFirst(cased, mark);
}

/** The first letter of a shown title is a capital, unless the title starts with a word spelled small on purpose (adidas, iPhone). */
export function upperFirst(text: string, brand?: string): string {
  const match = /[\p{L}\p{N}]+/u.exec(text);
  if (!match || !/^\p{Ll}/u.test(match[0])) return text;
  const word = match[0];
  if (hasUpper(word)) return text; // "iPhone", "eBay"
  const mark = (brand ?? '').trim();
  if (mark && word === mark.split(/\s/)[0]) return text; // the brand as it writes itself ("adidas")
  if (brandSpellings.get(word) === word) return text; // "adidas", "lululemon"
  return text.slice(0, match.index) + word.charAt(0).toLocaleUpperCase() + text.slice(match.index + 1);
}

const leadSeparators = /^[\s·•|:,–—-]+/u;
/** "adidas ADIDAS Crazy Lite" → "adidas Crazy Lite": the brand once at the start. */
export function withoutRepeatedBrand(name: string, brand?: string): string {
  const mark = (brand ?? '').trim();
  let text = name.replace(/\s+/g, ' ').trim();
  if (!mark) return text;
  const lower = mark.toLocaleLowerCase();
  const startsWith = (value: string) => value.slice(0, mark.length).toLocaleLowerCase() === lower && /^(?:$|[\s·•|:,–—-])/u.test(value.slice(mark.length));
  if (!startsWith(text)) return text;
  for (let guard = 0; guard < 3; guard++) {
    const rest = text.slice(mark.length).replace(leadSeparators, '');
    const after = rest.slice(mark.length).replace(leadSeparators, '');
    // What is left after the second brand must still name something.
    if (!startsWith(rest) || after.length < 3 || !/\p{L}/u.test(after)) break;
    text = `${text.slice(0, mark.length)} ${after}`;
  }
  return text;
}

/**
 * The product's name on every screen (catalog cards, home rails, "Вы смотрели", the product page and its title, cart,
 * checkout, orders, parcels, notices): without the department word, the brand once, recased. With `withoutBrand`
 * (the catalog card prints the brand on its own line) the brand also leaves the start.
 */
export function productTitle(name: string, brand?: string, { withoutBrand = '' as string | false }: { withoutBrand?: string | false } = {}): string {
  const mark = (brand ?? '').trim();
  const text = displayCase(withoutRepeatedBrand(withoutDepartment(name, mark), mark), mark);
  if (!withoutBrand) return text;
  // The card's brand line may be the store's spelling of the brand ("adidas" for "ADIDAS"): both leave the start.
  return upperFirst(nameWithoutBrand(nameWithoutBrand(text, mark), withoutBrand));
}

/* Option values: "s" → "S", "2xl" → "2XL", "one size" → "One size", "BLACK / WHITE" → "Black / White". */
const oneSize = /^(?:one ?size(?: fits (?:all|most))?|onesize|os|o\/s|osfa|osfm|one-size)$/iu;
const letterSize = /^\d{0,2}[xsmlt]{1,5}(?:\s?[/-]\s?\d{0,2}[xsmlt]{1,5})?$/iu;
export type OptionKind = 'color' | 'fit' | 'size' | 'other';
/** One option value as the screens show it. Numbers ("10.5", "34") and codes stay; the store's value stays in the data. */
export function displayOptionValue(value: string, kind?: OptionKind): string {
  let text = value.replace(/\s+/g, ' ').trim();
  if (!text) return text;
  if (oneSize.test(text)) return 'One size';
  if (kind !== 'color' && letterSize.test(text)) return text.toLocaleUpperCase();
  // A size the store wrote in capitals is a code ("OSFW", "XLT", "12K"): kept.
  if ((kind === 'size' || kind === 'fit') && !hasLower(text)) return text;
  if (/^(?:OS[A-Z]{1,3}|NS)$/u.test(text)) return text;
  // "Black /White", "Black/ White" → "Black / White"; "Black/White" without spaces stays as the store wrote it.
  if (/\s\/|\/\s/u.test(text)) text = text.replace(/\s*\/\s*/gu, ' / ');
  const lowerValue = !hasUpper(text) && hasLower(text);
  let first = true;
  return text.replace(wordPattern, word => {
    const cased = caseWord(word, { lowerTitle: lowerValue, first, brand: undefined });
    first = false;
    // In a value every word stands on its own ("Collegiate Navy"); joining words stay small ("Black and White").
    return lowerValue && /^\p{Ll}/u.test(cased) && !/\p{N}/u.test(cased) && !minorWords.has(cased) ? capitalised(cased) : cased;
  });
}

/** A shown option label ("black / white · xl"): each part recased, sizes by their look. */
export function displayVariantLabel(label: string): string {
  return label.split(' · ').map(part => displayOptionValue(part)).join(' · ');
}

/** `productTitle` of a product that may be missing (a notice whose order is gone). */
export function titleOf(product: { name: string; brand?: string } | undefined): string | undefined {
  return product ? productTitle(product.name, product.brand) : undefined;
}
