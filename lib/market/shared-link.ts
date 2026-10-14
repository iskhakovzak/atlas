// "Поделиться → Atlas" and "Заменить ссылку": a store app shares its product as text ("Look at these
// shoes https://… via Nike") or as a URL with a title. Pure, so the share route (app/share/route.ts),
// the order-by-link page and node tests read the link the same way. The importer still checks the
// store allowlist; this only finds the first web link.

import { brandAliases, normalizeSearch, searchWords as catalogSynonymWords, transliterate } from "./catalog-synonyms.ts";
import { brandForHost, storefrontLabel } from "./store-brands.ts";
import type { Locale } from "./i18n.ts";

const linkPattern = /\bhttps?:\/\/[^\s<>"'()\[\]{}]+/i;
/** Longer than any product page link; a share of a whole article is cut before it reaches the address bar. */
export const SHARED_TEXT_LIMIT = 2048;

/** The first http(s) link in the given texts, in order (the shared URL first, then the text, then the title); "" when there is none. */
export function extractSharedLink(...texts: Array<string | null | undefined>): string {
  for (const text of texts) {
    if (typeof text !== "string" || !text) continue;
    const found = text.slice(0, SHARED_TEXT_LIMIT).match(linkPattern)?.[0];
    if (!found) continue;
    // A sentence often ends right after the link: "…/CW2288-111." or "…/item»".
    const link = found.replace(/[.,;:!?…»”’]+$/u, "");
    try {
      const url = new URL(link);
      if (url.hostname.includes(".") && !url.username && !url.password) return url.href;
    } catch { /* not a web address: look further */ }
  }
  return "";
}

/** A bare "store.com/path" with no scheme, as people type it or copy it from an app's address bar. */
const bareLinkPattern = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i;

/**
 * A link field's text as a product link (home hero, app/home-sections.tsx): the first web link in pasted text
 * ("Look: https://… via Nike"), an http link moved to https, or a bare "nike.com/t/…" with https:// added. "" when there
 * is no link: plain words, a domain without a page, other schemes. The https rule and the store allowlist stay with
 * validateSource and the importer; this only fixes the obvious format.
 */
export function normalizeProductLink(raw: string): string {
  const text = raw.trim().slice(0, SHARED_TEXT_LIMIT);
  if (!text) return "";
  const found = extractSharedLink(text);
  if (found) {
    const url = new URL(found);
    if (url.protocol === "http:") url.protocol = "https:";
    return url.href;
  }
  // Through extractSharedLink again, so the host and login checks are the same.
  return !/\s/.test(text) && bareLinkPattern.test(text) ? extractSharedLink("https://" + text) : "";
}

/** A word that is a site address: "nike.com", "www.zara.com/uz", "example.com/item/1" (a letter domain ending, so "5.5" is not). */
const addressWord = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i;

/**
 * Text meant as a link, not a search by words ("nike кроссовки"): a scheme anywhere, one word with a dot or a slash
 * ("nike.com", "htps//nike/t"), or a site address among other words ("Look: example.com/item/1").
 */
export function looksLikeLink(raw: string): boolean {
  const text = raw.trim();
  if (text.includes("://")) return true;
  if (!/\s/.test(text)) return /[./]/.test(text);
  return text.split(/\s+/).some(word => addressWord.test(word.replace(/^[«"'(]+|[.,;:!?…»”’")]+$/gu, "")));
}

/** Lower case, "ё" as "е" and one apostrophe, as the catalog search reads text (lib/market/catalog-synonyms.ts normalizeSearch). */
const foldText = (text: string) => text.toLocaleLowerCase().replace(/ё/g, "е").replace(/[’‘ʼ`´]/g, "'");

/** The words of typed text: letters and digits, keeping "&" and "'" inside a name (H&M, Macy's). */
export function searchWords(text: string): string[] {
  return foldText(text).split(/[^\p{L}\p{N}&']+/u).map(word => word.replace(/^['&]+|['&]+$/g, "")).filter(Boolean);
}

/**
 * The first store the words name: "nike кроссовки" → Nike, "h&m" → H&M, "new balance 990" → New Balance, and in the
 * Russian spellings the catalog search knows ("найк" → Nike, "нью бэланс" → New Balance; lib/market/catalog-synonyms.ts).
 * A name or key shorter than 3 letters (the store "On") never matches, so an ordinary word does not offer a store.
 */
export function storeNamedIn<T extends { key: string; name: string }>(text: string, stores: readonly T[]): T | null {
  const typed = searchWords(text);
  if (!typed.length) return null;
  const spoken = ` ${typed.join(" ")} `;
  const line = brandAliases.reduce((all, [cyrillic, latin]) => spoken.includes(` ${cyrillic} `) ? `${all}${latin} ` : all, spoken);
  const words = line.trim().split(" ");
  return stores.find(store => {
    const name = searchWords(store.name).join(" ");
    return (name.length >= 3 && line.includes(` ${name} `)) || (store.key.length >= 3 && words.includes(store.key));
  }) ?? null;
}

/** A catalog product as the home field reads it: the fields the catalog search looks at (MerchantFind fits). */
export type SearchableProduct = { name: string; brand: string; category?: string; country?: string; store?: string; sourceUrl?: string };

/** The store host the catalog keys a product by (lib/market/catalog-query.ts storeHost): the link's host without "www.", else the store field. */
function productHost(product: SearchableProduct): string {
  try { if (product.sourceUrl) return new URL(product.sourceUrl).hostname.toLowerCase().replace(/^www\./, ""); } catch { /* the store field */ }
  return (product.store ?? "").toLowerCase();
}

/**
 * The words the catalog search reads for a product, as app/catalog-view.tsx builds them: name, brand, category, country,
 * store host and label (lib/market/catalog-query.ts matches), plus the category synonyms ("кроссовки", "krossovka"), Russian
 * brand spellings ("найк") and the storefront label in the page language (lib/market/catalog-synonyms.ts). Only the
 * translated category label is missing (the home page does not load the catalog copy): a word found only there is not
 * offered, which errs on the safe side.
 */
function catalogTokens(product: SearchableProduct, locale: Locale): string[] {
  const host = productHost(product);
  const category = product.category ?? "";
  const label = brandForHost(host) ? storefrontLabel(host, "ru") : host;
  const extra = catalogSynonymWords({ product: { name: product.name, brand: product.brand, category }, store: host }, locale);
  return searchWords(normalizeSearch([product.name, product.brand, category, product.country ?? "", host, label, extra].join(" ")));
}

/** The longest search the catalog field keeps whole; longer word lists lose their last words, never half a word. */
const CATALOG_SEARCH_LIMIT = 60;

/**
 * A catalog search that finds something: the words of the text (3+ letters) that one catalog product carries, each as the
 * start of a word the catalog search reads for it (catalogTokens), as typed or transliterated like the catalog does
 * ("найк" → Nike through its Russian spelling, "кроссовки" → any shoes, "аир" → "air"; "orce" is not found in "Force").
 * The catalog matches every word of `q` anywhere in that text (lib/market/catalog-query.ts, wordMatches), so that product
 * is always in the result. "" when no product has any of the words.
 */
export function catalogSearchFor(text: string, products: readonly SearchableProduct[], locale: Locale = "ru"): string {
  const words = [...new Set(searchWords(text).filter(word => word.length >= 3 && word.length <= CATALOG_SEARCH_LIMIT))].slice(0, 6);
  if (!words.length) return "";
  const latin = new Map(words.map(word => [word, transliterate(word)]));
  let best: string[] = [];
  for (const product of products) {
    if (best.length === words.length) break;
    const tokens = catalogTokens(product, locale);
    const startsWord = (start: string) => tokens.some(token => token.startsWith(start));
    const found = words.filter(word => startsWord(word) || (latin.get(word) !== word && startsWord(latin.get(word)!)));
    if (found.length > best.length) best = found;
  }
  let search = "";
  for (const word of best) {
    const next = search ? `${search} ${word}` : word;
    if (next.length > CATALOG_SEARCH_LIMIT) break;
    search = next;
  }
  return search;
}

/** Where the share route sends the customer: the order form with the link, or the empty form saying nothing was found. */
export function sharedLinkTarget(link: string): string {
  return link ? `/order-by-link?url=${encodeURIComponent(link)}` : "/order-by-link?shared=nolink";
}
