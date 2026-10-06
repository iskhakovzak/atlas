/**
 * Uzbek Cyrillic (Ўзбекча) is drawn from the Uzbek Latin copy: the dictionaries keep ru/uz/en and
 * `withCyrillic` adds the `oz` version through `toCyrillic`. Transliteration is the draft; the word
 * list below holds the reviewed exceptions (Russian loanwords with ь/я/ц, words that keep Latin).
 */

/** Words that stay as written: brands, services, codes. Matched case-insensitively on the whole word. */
const keepLatin = new Set([
  "atlas", "zara", "amazon", "ebay", "iherb", "shein", "temu", "aliexpress", "trendyol", "wildberries", "ozon", "uzum",
  "nike", "adidas", "puma", "mango", "uniqlo", "bershka", "massimo", "dutti", "pull", "bear", "stradivarius", "oysho",
  "sephora", "farfetch", "lamoda", "zalando", "costco", "walmart", "target", "macy", "carter", "carters", "levi", "levis",
  "telegram", "google", "apple", "android", "ios", "iphone", "ipad", "safari", "chrome", "firefox", "gmail", "whatsapp",
  "instagram", "facebook", "youtube", "tiktok", "click", "payme", "uzcard", "humo", "visa", "mastercard", "paypal",
  "email", "e-mail", "dhl", "fedex", "ups", "usps", "cdek", "express", "id", "pdf", "csv", "sms", "ok",
  "app", "store", "play", "uz", "ru", "en", "latn", "cyrl",
]);

/** Brands that take Uzbek suffixes (Atlasda, Telegramga): the brand stays Latin, the suffix turns Cyrillic (Atlasда). */
const brandStems = ["aliexpress", "wildberries", "mastercard", "instagram", "telegram", "whatsapp", "trendyol", "sephora", "android",
  "amazon", "google", "iphone", "uzcard", "paypal", "adidas", "atlas", "iherb", "gmail", "payme", "apple", "shein", "zara", "ebay", "temu", "nike"];

/** Latin acronyms kept in Cyrillic text. Any other ALL-CAPS word is Uzbek (a heading, AQSH, STIR) and is transliterated. */
const acronyms = new Set([
  "USD", "UZS", "EUR", "GBP", "CNY", "TRY", "AED", "KRW", "JPY", "RUB", "KZT", "CHF", "SEK", "DKK", "PLN", "CZK", "RON", "HUF",
  "SMS", "PDF", "JPG", "JPEG", "PNG", "WEBP", "HEIC", "GIF", "MB", "KB", "GB", "ID", "JSON", "CSV", "XLSX", "MRZ", "EU", "UK", "US", "USA", "UAE",
  "UZ", "RU", "EN", "OK", "URL", "API", "QR", "FAQ", "VIP", "PIN", "OTP", "HTML", "IP", "VAT", "GTIN", "SKU", "EAN", "UPC", "IMEI",
  "DHL", "UPS", "EMS", "USPS", "CDEK", "FBA", "HS", "ATL", "DEC", "AT", "ASOS", "COS", "GAP", "NYX", "CBU", "TIN", "INN", "IBAN", "SWIFT",
]);

/**
 * Reviewed loanword stems where letter-by-letter output is wrong: Latin drops ь and ъ and writes "ya/yu/ye"
 * for я/ю/ье. The stem is replaced and the Uzbek suffix after it is transliterated as usual. `soft` stems end
 * in ь, which stays before a consonant or at the end of the word and drops before a vowel (профиль, профилда→
 * профильда, профили).
 */
const stems: Array<[latin: string, cyrillic: string, soft?: true]> = [
  ["yanvar", "январ", true], ["fevral", "феврал", true], ["aprel", "апрел", true], ["iyun", "июн", true], ["iyul", "июл", true],
  ["sentyabr", "сентябр", true], ["sentabr", "сентябр", true], ["oktyabr", "октябр", true], ["oktabr", "октябр", true],
  ["noyabr", "ноябр", true], ["dekabr", "декабр", true],
  ["profil", "профил", true], ["model", "модел", true], ["kalendar", "календар", true], ["mebel", "мебел", true],
  ["avtomobil", "автомобил", true], ["portfel", "портфел", true], ["rubl", "рубл", true], ["rol", "рол", true],
  ["kompyuter", "компьютер"], ["kuryer", "курьер"], ["kalkulyator", "калькулятор"], ["podyezd", "подъезд"], ["filtr", "фильтр"],
  ["shveytsar", "швейцар"], ["aktyor", "актёр"], ["aksiya", "акция"], ["aksiz", "акциз"], ["konsert", "концерт"],
];
/** Whole words only: a stem here would also match unrelated Uzbek words. */
const exact: Record<string, string> = { stil: "стиль" };

const vowels = "aeiouAEIOU";
const isUpper = (ch: string) => ch !== ch.toLowerCase() && ch === ch.toUpperCase();
/** Marks after o/g that form ў/ғ, and the tutuq belgisi that becomes ъ. */
const turned = new Set(["‘", "ʻ", "'", "`", "´"]);
const glottal = new Set(["’", "ʼ", "'", "`", "´"]);

const single: Record<string, string> = {
  a: "а", b: "б", d: "д", e: "е", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л", m: "м", n: "н", o: "о",
  p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", x: "х", y: "й", z: "з", c: "ц", w: "в",
};

function caseLike(source: string, target: string, next?: string) {
  if (!isUpper(source[0])) return target;
  // A capitalised digraph inside an all-caps word stays all caps (SHAHAR → ШАҲАР), else only the first letter.
  const allCaps = source.length > 1 ? isUpper(source[1]) || (next !== undefined && isUpper(next)) : next !== undefined && isUpper(next);
  return allCaps ? target.toUpperCase() : target[0].toUpperCase() + target.slice(1);
}

/** One Uzbek word in Latin script to Cyrillic. */
function word(latin: string): string {
  const lower = latin.toLowerCase().replace(/[‘ʻ`´]/g, "'").replace(/[’ʼ]/g, "’");
  const cased = (cyrillic: string) => isUpper(latin[0]) ? (latin.length > 1 && isUpper(latin[1]) ? cyrillic.toUpperCase() : cyrillic[0].toUpperCase() + cyrillic.slice(1)) : cyrillic;
  if (exact[lower]) return cased(exact[lower]);
  const stem = stems.find(([from]) => lower.startsWith(from));
  if (stem) {
    const [from, to, soft] = stem, rest = latin.slice(from.length);
    const sign = soft && (!rest || !vowels.includes(rest[0])) ? "ь" : "";
    return cased(to + sign) + (rest ? word(rest) : "");
  }
  let out = "";
  for (let i = 0; i < latin.length; i++) {
    const ch = latin[i], low = ch.toLowerCase(), next = latin[i + 1], nextLow = next?.toLowerCase(), after = latin[i + 2];
    const prev = i ? latin[i - 1] : "";
    if ((low === "o" || low === "g") && next && turned.has(next)) {
      out += caseLike(ch, low === "o" ? "ў" : "ғ", after);
      i++;
      continue;
    }
    if (glottal.has(ch)) { if (i > 0 && i < latin.length - 1) out += "ъ"; else out += ch; continue; }
    if (low === "s" && nextLow === "h") { out += caseLike(ch + next, "ш", after); i++; continue; }
    if (low === "c" && nextLow === "h") { out += caseLike(ch + next, "ч", after); i++; continue; }
    // Loanword stems -tsiya/-tsion/-tsent: ts → ц.
    if (low === "t" && nextLow === "s" && /^(iya|iy|ion|ent|ex|ikl)/i.test(latin.slice(i + 2))) { out += caseLike(ch, "ц", after); i++; continue; }
    if (low === "y" && nextLow && "aoue".includes(nextLow)) {
      // yo‘ is й + ў (yo‘l → йўл), not ё.
      if (nextLow === "o" && after && turned.has(after)) { out += caseLike(ch, "й", next); continue; }
      const map: Record<string, string> = { a: "я", o: "ё", u: "ю", e: "е" };
      out += caseLike(ch + next, map[nextLow], after);
      i++;
      continue;
    }
    if (low === "e" && (i === 0 || vowels.includes(prev) || prev === "-")) { out += caseLike(ch, "э", next); continue; }
    const mapped = single[low];
    out += mapped ? caseLike(ch, mapped, next) : ch;
  }
  return out;
}

/** True when a token is not Uzbek prose: brand, code, mixed case, digits, address. */
function keep(token: string): boolean {
  if (/\d/.test(token)) return true;
  const plain = token.replace(/[‘’ʻʼ'`´]/g, "");
  if (keepLatin.has(plain.toLowerCase())) return true;
  // Latin acronyms (USD, SMS, PDF); Uzbek ones (AQSH, BAA, STIR) and capitalised headings are transliterated.
  if (plain.length >= 2 && plain === plain.toUpperCase() && acronyms.has(plain)) return true;
  // camelCase / internal capitals: iHerb, eBay, WhatsApp.
  if (/[a-z][A-Z]/.test(plain)) return true;
  return false;
}

/** "Atlasda" → "Atlasда", "Telegram’ga" → "Telegram’га": a known brand followed by a lowercase Uzbek suffix. */
function branded(token: string): string | null {
  const low = token.toLowerCase();
  const stem = brandStems.find(brand => low.startsWith(brand) && low.length > brand.length);
  if (!stem) return null;
  const rest = token.slice(stem.length), mark = rest.match(/^[’ʼ'`´]/)?.[0] ?? "", suffix = rest.slice(mark.length);
  // Only case and plural endings, so Uzbek words that merely start like a brand (zarar, temur) are not split.
  if (!/^(?:lar)?(?:da|dagi|dan|ga|gacha|ni|ning|niki|dek|si|i)?$/.test(suffix) || !suffix) return null;
  return token.slice(0, stem.length) + mark + word(suffix);
}

/** Marks a value (a product name, an operator's note) that must stay as written inside transliterated copy. */
export const verbatim = (value: string) => `\uE000${value}\uE001`;

/** Uzbek Latin text to Cyrillic. URLs, e-mails, brands, codes and `verbatim` values are left as they are. */
export function toCyrillic(text: string): string {
  if (!text || !/[A-Za-z\uE000]/.test(text)) return text;
  // Leave verbatim values, URLs, e-mail addresses, file names, paths and {placeholders} untouched.
  return text.replace(/(\uE000[^\uE001]*\uE001|https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w-]+\.[\w.]+|\/[\w\-/?=&#.%]*|\{[^}]*\}|\b[\w-]+\.(?:com|uz|ru|net|org|io|app|pdf|csv)\b)|([A-Za-z‘’ʻʼ'`´]+(?:-[A-Za-z‘’ʻʼ'`´]+)*)/g, (match, protectedPart: string | undefined, token: string | undefined) => {
    if (protectedPart) return protectedPart.startsWith("\uE000") ? protectedPart.slice(1, -1) : protectedPart;
    if (!token) return match;
    // A leading or trailing quote mark is punctuation, not a letter.
    const lead = token.match(/^[‘’ʻʼ'`´]+/)?.[0] ?? "", tail = token.match(/[’ʼ'`´]+$/)?.[0] ?? "";
    let core = token.slice(lead.length, token.length - tail.length);
    // o‘/g‘ at the end of a word keep their mark: "bo‘" style endings are rare, but "to‘g‘" is not.
    let back = tail;
    if (tail && /[oOgG]$/.test(core) && turned.has(tail[0])) { core += tail[0]; back = tail.slice(1); }
    if (!core) return match;
    const parts = core.split("-").map(part => (part && !keep(part) ? branded(part) ?? word(part) : part));
    return lead + parts.join("-") + back;
  });
}

/** Locale tags for Intl and <html lang>; `oz` is the internal code for Uzbek Cyrillic. */
export function intlLocale(locale: string): string {
  return locale === "oz" ? "uz-Cyrl-UZ" : locale === "uz" ? "uz-Latn-UZ" : locale === "ru" ? "ru-RU" : "en-US";
}
export function htmlLang(locale: string): string {
  return locale === "oz" ? "uz-Cyrl" : locale;
}

type Fn = (...args: never[]) => unknown;
const isElement = (value: unknown) => typeof value === "object" && value !== null && "$$typeof" in value;

/** Transliterate a function's result while keeping its arguments (names, codes, amounts) as passed in. */
function wrap<F extends Fn>(fn: F): F {
  return ((...args: never[]) => {
    const result = fn(...args);
    if (typeof result !== "string") return deep(result);
    const shielded: string[] = [];
    let text = result;
    for (const arg of args as unknown[]) {
      if (typeof arg !== "string" || arg.length < 2 || !text.includes(arg)) continue;
      const mark = `\u0000${shielded.length}\u0000`;
      text = text.split(arg).join(mark);
      shielded.push(arg);
    }
    let out = toCyrillic(text);
    shielded.forEach((arg, index) => { out = out.split(`\u0000${index}\u0000`).join(arg); });
    return out;
  }) as F;
}

/** Deep copy of Uzbek Latin copy in Cyrillic: strings, nested objects, arrays and copy functions. */
export function deep<T>(value: T): T {
  if (typeof value === "string") return toCyrillic(value) as T;
  if (typeof value === "function") return wrap(value as unknown as Fn) as unknown as T;
  if (Array.isArray(value)) return value.map(item => deep(item)) as T;
  if (value && typeof value === "object" && !isElement(value) && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = deep(item);
    return out as T;
  }
  return value;
}

/** A ru/uz/en dictionary with the Uzbek Cyrillic version added as `oz`, built on first use. */
export function withCyrillic<T>(dict: { ru: T; uz: T; en: T }): { ru: T; uz: T; en: T; oz: T } {
  let cached: T | undefined;
  const out = { ...dict } as { ru: T; uz: T; en: T; oz: T };
  Object.defineProperty(out, "oz", { enumerable: true, configurable: true, get: () => (cached ??= deep(dict.uz)) });
  return out;
}

/** Pick a ru/uz/en entry; Uzbek Cyrillic is the Uzbek Latin entry transliterated. */
export function pickLocale<T>(dict: { ru: T; uz: T; en: T }, locale: string): T {
  return locale === "oz" ? deep(dict.uz) : dict[locale as "ru" | "uz" | "en"] ?? dict.ru;
}

/** Uzbek copy for either script: the Latin value as is, or transliterated for `oz`. */
export function uzText<T>(locale: string, value: T): T {
  return locale === "oz" ? deep(value) : value;
}
