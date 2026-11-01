import { absoluteUrl, hreflangCode, languageAlternates, pageLanguageSet, publicPaths, seoLocales, siteOrigin, type LanguageSet } from './locales.ts';
import { productPath, storePath } from './routes.ts';

// /sitemap.xml, built on request (app/sitemap.xml/route.ts) instead of a hand-written file (1 November 2026). Every
// listed page appears as its x-default address and its `?lang=` versions, each with the full set of xhtml:link
// alternates; a Russian-only page appears once, as `?lang=ru`. No changefreq or priority (Google ignores both);
// lastmod only where a real date is known.

export type SitemapEntry = {
  /** Path without `?lang`. */
  path: string;
  /** When the page content last changed (ISO date, epoch milliseconds or Date); left out when unknown. */
  lastmod?: string | number | Date;
  languages?: LanguageSet;
};

/** One sitemap file holds at most 50,000 URLs (sitemaps.org). */
export const sitemapUrlLimit = 50_000;

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function isoDate(value: SitemapEntry['lastmod']): string | undefined {
  if (value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

/** The addresses one entry contributes: `/path` and its four versions, or the single Russian version. */
export function entryUrls(entry: SitemapEntry): string[] {
  const languages = entry.languages ?? pageLanguageSet(entry.path);
  if (languages === 'ru') return [absoluteUrl(entry.path, 'ru')];
  return [absoluteUrl(entry.path), ...seoLocales.map((locale) => absoluteUrl(entry.path, locale))];
}

/** The `<urlset>` document for these entries. */
export function buildSitemap(entries: readonly SitemapEntry[]): string {
  const blocks: string[] = [];
  for (const entry of entries) {
    const languages = entry.languages ?? pageLanguageSet(entry.path);
    const alternates = Object.entries(languageAlternates(entry.path, languages))
      .map(([hreflang, href]) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(siteOrigin + href)}"/>`)
      .join('\n');
    const lastmod = isoDate(entry.lastmod);
    for (const loc of entryUrls({ ...entry, languages })) {
      blocks.push(`  <url>\n    <loc>${escapeXml(loc)}</loc>\n${alternates}${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`);
    }
  }
  if (blocks.length > sitemapUrlLimit) throw new Error(`sitemap has ${blocks.length} URLs, more than ${sitemapUrlLimit}: split it into a sitemap index`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${blocks.join('\n')}\n</urlset>\n`;
}

/** The fixed public pages. `lastmod` per path where the page states a date (/customs: "checked on"). */
export function publicPageEntries(lastmods: Record<string, string> = {}, extraPaths: readonly string[] = []): SitemapEntry[] {
  return [...publicPaths, ...extraPaths].map((path) => ({ path, ...(lastmods[path] ? { lastmod: lastmods[path] } : {}) }));
}

/** The catalog fields the product entries read (MerchantFind from publicCatalog). */
export type SitemapProduct = { id: string; addedAt?: number; sourceCheckedAt?: number; confirmedAt?: number };

/** Published products → `/catalog/p/{id}`, dated by the latest of publication, store check and operator confirmation. */
export function productEntries(products: readonly SitemapProduct[]): SitemapEntry[] {
  return products.map((product) => {
    const times = [product.addedAt, product.sourceCheckedAt, product.confirmedAt].filter((time): time is number => typeof time === 'number' && time > 0);
    return { path: productPath(product.id), ...(times.length ? { lastmod: Math.max(...times) } : {}) };
  });
}

/** Stores with an indexable page → `/stores/{slug}`. Only stores with enough own content belong here (doorway pages). */
export function storeEntries(stores: readonly { slug: string; lastmod?: SitemapEntry['lastmod'] }[]): SitemapEntry[] {
  return stores.map((store) => ({ path: storePath(store.slug), ...(store.lastmod === undefined ? {} : { lastmod: store.lastmod }) }));
}

/** hreflang code of every version, for tests and llms.txt. */
export const sitemapHreflangs = [...seoLocales.map((locale) => hreflangCode[locale]), 'x-default'];
