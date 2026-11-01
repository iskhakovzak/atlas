import { supportedLocale, type Locale } from '../market/i18n.ts';

// Language versions of public pages (1 November 2026). `/path` is the x-default, rendered in the visitor's language
// (Uzbek for crawlers without a preference); `/path?lang=xx` is the self-canonical version in one language, rendered
// on the server (middleware.ts). `oz` (Uzbek in Cyrillic) is internal: outside it is `uz-Cyrl`.

export const siteOrigin = 'https://atlasmarket.uz';

/** The four language versions, in the order hreflang lists them. */
export const seoLocales: readonly Locale[] = ['uz', 'oz', 'ru', 'en'];

/** BCP 47 code of a locale, as hreflang and `<html lang>` use it. */
export const hreflangCode: Record<Locale, string> = { uz: 'uz', oz: 'uz-Cyrl', ru: 'ru', en: 'en' };

/** Which language versions a page really has: all four, or only Russian (the legal documents until their translations are reviewed). */
export type LanguageSet = 'all' | 'ru';

/**
 * Pages written only in Russian: the legal documents until reviewed uz/en translations exist (app/legal-documents.tsx).
 * Their uz/oz/en addresses show the Russian text in a translated frame, so every address canonicalizes to `?lang=ru`
 * and hreflang lists only that version (SEO audit, 1 November 2026). Empty this list once the translations are published.
 */
export const russianOnlyPaths: readonly string[] = ['/legal', '/privacy', '/terms'];

/** The language versions a public path really has. */
export function pageLanguageSet(path: string): LanguageSet {
  return russianOnlyPaths.includes(path) ? 'ru' : 'all';
}

/** `/path` → `/path?lang=xx` (a hash stays last). Relative: Next resolves it against metadataBase. */
export function localizedPath(path: string, locale: Locale): string {
  const [base, hash] = splitHash(path);
  return `${base}${base.includes('?') ? '&' : '?'}lang=${locale}${hash}`;
}

/** Absolute URL of a path, or of its `?lang=xx` version. */
export function absoluteUrl(path: string, locale?: Locale | null): string {
  return siteOrigin + (locale ? localizedPath(path, locale) : path);
}

/**
 * hreflang map for `alternates.languages`: every version plus the x-default `/path`. A page that exists only in
 * Russian lists only that version, and its x-default is the Russian URL too (all its other addresses canonicalize there).
 */
export function languageAlternates(path: string, languages: LanguageSet = 'all'): Record<string, string> {
  if (languages === 'ru') return { ru: localizedPath(path, 'ru'), 'x-default': localizedPath(path, 'ru') };
  const out: Record<string, string> = {};
  for (const locale of seoLocales) out[hreflangCode[locale]] = localizedPath(path, locale);
  out['x-default'] = path;
  return out;
}

/** Canonical path of a page opened with `?lang=` (or without it): self-canonical, except a Russian-only page. */
export function canonicalPath(path: string, requested: Locale | null, languages: LanguageSet = 'all'): string {
  if (languages === 'ru') return localizedPath(path, 'ru');
  return requested ? localizedPath(path, requested) : path;
}

/** Public pages whose internal links keep the page language (`?lang=`), see `withLang`. */
export const publicPaths: readonly string[] = ['/', '/catalog', '/stores', '/customs', '/legal', '/privacy', '/terms', '/support', '/app', '/delete-account'];

/** True for a public page and for the future public families (`/catalog/p/…`, `/stores/…`, `/delivery`). */
export function isPublicPath(pathname: string): boolean {
  return publicPaths.includes(pathname) || pathname === '/delivery' || /^\/catalog\/p\/[^/]+$/.test(pathname) || /^\/stores\/[^/]+$/.test(pathname);
}

/**
 * An internal link in the language of a page that was opened as a `?lang=` version: `/catalog` → `/catalog?lang=ru`.
 * Crawlers follow these links without a cookie or Accept-Language, so without the parameter every link from the
 * Russian version led to the Uzbek x-default. Private pages, other sites, links that already name a language and
 * pages opened without `?lang` keep the href as is.
 */
export function withLang(href: string, lang: Locale | null | undefined): string {
  if (!lang || !href.startsWith('/') || href.startsWith('//')) return href;
  const [base, hash] = splitHash(href);
  const [pathname, query = ''] = base.split('?');
  if (!isPublicPath(pathname || '/')) return href;
  const params = new URLSearchParams(query);
  if (supportedLocale(params.get('lang'))) return href;
  params.set('lang', lang);
  return `${pathname || '/'}?${params.toString()}${hash}`;
}

function splitHash(value: string): [string, string] {
  const at = value.indexOf('#');
  return at === -1 ? [value, ''] : [value.slice(0, at), value.slice(at)];
}
