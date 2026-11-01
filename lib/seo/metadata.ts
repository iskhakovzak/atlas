import type { Metadata } from 'next';
import { supportedLocale, type Locale } from '../market/i18n.ts';
import { withCyrillic } from '../market/uz-cyrl.ts';
import { canonicalPath, languageAlternates, type LanguageSet } from './locales.ts';

// Metadata of an indexable page, shared by the existing public pages (app/route-metadata.ts) and the pages the
// redesign adds (/catalog/p/[id], /stores/[slug], /delivery): canonical, hreflang, Open Graph and Twitter in one place.

export const ogLocale: Record<Locale, string> = /*@__PURE__*/withCyrillic({ uz: 'uz_UZ', ru: 'ru_RU', en: 'en_US' });
const ogImage: Record<Locale, string> = /*@__PURE__*/withCyrillic({ uz: '/og-image-uz.png', ru: '/og-image.png', en: '/og-image-en.png' });
const imageAlt: Record<Locale, string> = /*@__PURE__*/withCyrillic({
  uz: 'Atlas — xorijiy do‘konlardan Toshkentga yetkazib berish',
  ru: 'Atlas — покупки в зарубежных магазинах с доставкой в Ташкент',
  en: 'Atlas — shop international stores with delivery to Tashkent',
});

export type SeoImage = { url: string; width?: number; height?: number; alt: string };

/** The site preview image (1200×630) in the page language. */
export function defaultImage(locale: Locale): SeoImage {
  return { url: ogImage[locale], width: 1200, height: 630, alt: imageAlt[locale] };
}

/** Other Open Graph locales than the page's own (`oz` shares uz_UZ, so it is never listed twice). */
export function alternateOgLocales(locale: Locale): string[] {
  return [...new Set((['uz', 'ru', 'en'] as const).map((code) => ogLocale[code]))].filter((code) => code !== ogLocale[locale]);
}

/** Search-engine directives of an indexable page. Set per page: a root-level `index` would sit next to the 404 page's `noindex`. */
export const indexRobots: Metadata['robots'] = { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } };

export type PageSeo = {
  /** The page path without `?lang`, such as `/catalog/p/abc`. */
  path: string;
  /** `?lang=` as the request sent it; anything else means the x-default address. */
  lang: string | null | undefined;
  /** The language the page renders in when there is no valid `?lang` (pageLocale()). */
  fallback: Locale;
  /** Title and description in the rendered language. A title naming Atlas stands alone; the rest get "· Atlas". */
  text: (locale: Locale) => { title: string; description: string };
  /** Preview image (a product photo); the site banner when absent. */
  image?: SeoImage;
  /** 'ru' for a page whose content exists only in Russian: every address canonicalizes to `?lang=ru`. */
  languages?: LanguageSet;
  /** `og:type`; product pages may use 'website' too (Next has no 'product' type). */
  type?: 'website' | 'article';
};

/**
 * Canonical, hreflang (uz, uz-Cyrl, ru, en, x-default), Open Graph (with og:locale:alternate) and Twitter for one
 * page. `/path?lang=xx` is self-canonical; `/path` is the x-default and canonical to itself.
 */
export function pageMetadata({ path, lang, fallback, text, image, languages = 'all', type = 'website' }: PageSeo): Metadata {
  const requested = supportedLocale(lang);
  const locale = requested ?? fallback;
  const url = canonicalPath(path, requested, languages);
  const { title, description } = text(locale);
  const branded = title.includes('Atlas');
  const socialTitle = branded ? title : `${title} · Atlas`;
  const preview = image ?? defaultImage(locale);
  return {
    title: branded ? { absolute: title } : title,
    description,
    robots: indexRobots,
    alternates: { canonical: url, languages: languageAlternates(path, languages) },
    openGraph: { type, url, siteName: 'Atlas', title: socialTitle, description, locale: ogLocale[locale], alternateLocale: alternateOgLocales(locale), images: [preview] },
    twitter: { card: 'summary_large_image', title: socialTitle, description, images: [{ url: preview.url, alt: preview.alt }] },
    // Vinext 1.0 renders no tag for openGraph.alternateLocale (node_modules/vinext/dist/shims/metadata.js), so the
    // alternates also go out as <meta name="og:locale:alternate">, which link-preview parsers read too.
    other: { 'og:locale:alternate': alternateOgLocales(locale) },
  };
}
