import type { Locale, TextLocale } from '../market/i18n.ts';
import { pickLocale, withCyrillic } from '../market/uz-cyrl.ts';
import { absoluteUrl, canonicalPath, hreflangCode, seoLocales, siteOrigin, type LanguageSet } from './locales.ts';

// schema.org JSON-LD for the public pages. Only facts the site already shows: no prices, stock,
// ratings or delivery promises (imported products are editable estimates, see CLAUDE.md).

export { siteOrigin };
const organizationId = `${siteOrigin}/#organization`;
const websiteId = `${siteOrigin}/#website`;
/** The four page languages as BCP 47 codes: uz, uz-Cyrl, ru, en. */
const pageLanguages = seoLocales.map((locale) => hreflangCode[locale]);
/** Atlas delivers only within Tashkent (servedRegions, err_78), so the service area is the city, not the country. */
const tashkent = { '@type': 'City', name: 'Tashkent', containedInPlace: { '@type': 'Country', name: 'Uzbekistan' } };

type Contacts = {
  telegramSupport: string | null;
  telegramChannel: string | null;
  phone: string | null;
  instagram: string | null;
  supportEmail: string | null;
};
type Legal = { entityName: string | null; inn: string | null; address: Record<TextLocale, string> | null };

const organizationText: Record<Locale, string> = /*@__PURE__*/withCyrillic({
  uz: 'Xorijiy do‘konlardan xarid qilishda vositachi va logistika agenti: tovarni xorijda sotib olib, Toshkentga yetkazib beradi.',
  ru: 'Посредник и логистический агент для покупок в зарубежных магазинах: выкупает товар за рубежом и доставляет его в Ташкент.',
  en: 'Purchasing intermediary and logistics agent for international shopping: buys items abroad and delivers them to Tashkent.',
});
const homeName: Record<Locale, string> = /*@__PURE__*/withCyrillic({ uz: 'Bosh sahifa', ru: 'Главная', en: 'Home' });

/** `/path` → `https://atlasmarket.uz/path?lang=xx`, the self-canonical language version of a public page. */
export function localizedUrl(path: string, locale: Locale): string {
  return `${siteOrigin}${path}?lang=${locale}`;
}

/** Organization and WebSite for every page; contacts and legal details appear only once the operator has published them. */
export function siteGraph(locale: Locale, contacts: Contacts, legal?: Legal) {
  const sameAs = [
    contacts.telegramChannel && `https://t.me/${contacts.telegramChannel}`,
    contacts.instagram && `https://instagram.com/${contacts.instagram}`,
  ].filter((value): value is string => !!value);
  const contactPoint = contacts.supportEmail || contacts.phone || contacts.telegramSupport ? [{
    '@type': 'ContactPoint',
    contactType: 'customer support',
    areaServed: 'UZ',
    availableLanguage: pageLanguages,
    ...(contacts.supportEmail ? { email: contacts.supportEmail } : {}),
    ...(contacts.phone ? { telephone: contacts.phone } : {}),
    ...(contacts.telegramSupport ? { url: `https://t.me/${contacts.telegramSupport}` } : {}),
  }] : undefined;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'Atlas',
        // The domain the brand is shown with; "Atlas" alone names many companies.
        alternateName: 'atlasmarket.uz',
        url: siteOrigin,
        // A square mark: search engines crop a 1200×630 banner badly.
        logo: { '@type': 'ImageObject', url: `${siteOrigin}/icon-512.png`, width: 512, height: 512 },
        image: `${siteOrigin}/og-image.png`,
        description: organizationText[locale],
        areaServed: tashkent,
        ...(legal?.entityName ? { legalName: legal.entityName } : {}),
        // INN is the Uzbek taxpayer number.
        ...(legal?.inn ? { taxID: legal.inn } : {}),
        ...(legal?.address && pickLocale(legal.address, locale) ? { address: { '@type': 'PostalAddress', streetAddress: pickLocale(legal.address, locale), addressCountry: 'UZ' } } : {}),
        ...(sameAs.length ? { sameAs } : {}),
        ...(contactPoint ? { contactPoint } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: 'Atlas',
        url: siteOrigin,
        inLanguage: pageLanguages,
        publisher: { '@id': organizationId },
        // The catalog reads `?q=` (lib/market/catalog-query.ts), so search engines can offer a site search box.
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${siteOrigin}/catalog?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
}

/** Shell views of the indexable subpages (app/marketplace.tsx) → their paths; private views have none. */
export const publicViewPaths: Record<string, string> = {
  products: '/catalog', stores: '/stores', customs: '/customs', legal: '/legal', privacy: '/privacy',
  terms: '/terms', support: '/support', app: '/app', 'delete-account': '/delete-account',
};

/**
 * A breadcrumb trail as the page shows it. Each `path` is linked in the same form as the page's canonical: with
 * `?lang=xx` when the page was opened as a language version, without it on the x-default address (a trail of
 * `?lang=uz` links on `/customs` pointed away from the canonical). A Russian-only page links its `?lang=ru` version.
 */
export function breadcrumbList(trail: readonly { name: string; path: string; languages?: LanguageSet }[], requested: Locale | null | undefined) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: siteOrigin + canonicalPath(crumb.path, requested ?? null, crumb.languages),
    })),
  };
}

/** Home → page trail for a public subpage, in the page language. */
export function breadcrumbs(locale: Locale, path: string, title: string, requested: Locale | null | undefined, languages: LanguageSet = 'all') {
  return breadcrumbList([{ name: homeName[locale], path: '/' }, { name: title, path, languages }], requested);
}

/**
 * A page with dated, sourced content (/customs): when it was last checked and the official documents it cites.
 * `dateModified` must be the date the page itself shows.
 */
export function webPage({ path, requested, locale, name, dateModified, citations = [] }: { path: string; requested: Locale | null | undefined; locale: Locale; name: string; dateModified: string; citations?: readonly string[] }) {
  const url = absoluteUrl(path, requested);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': url,
    url,
    name,
    inLanguage: hreflangCode[locale],
    dateModified,
    isPartOf: { '@id': websiteId },
    publisher: { '@id': organizationId },
    ...(citations.length ? { citation: [...citations] } : {}),
  };
}

export type ProductSeo = {
  /** `/catalog/p/{id}` without `?lang`. */
  path: string;
  requested: Locale | null | undefined;
  name: string;
  /** Text the page shows, not store copy hidden from visitors. */
  description?: string | null;
  /** Absolute photo URLs, main photo first. */
  images: readonly string[];
  brand?: string | null;
  /** Atlas catalog id. */
  sku: string;
  category?: string | null;
  color?: string | null;
  /**
   * The total in soum the page shows, a whole number. Leave it out while the price waits for the store's confirmation
   * (`priceNeedsConfirmation`): then there is no Offer at all, never a guessed price.
   */
  priceUzs?: number | null;
  /** ISO date until which the shown total holds (the rate is fixed at payment). */
  priceValidUntil?: string;
  /**
   * Only when the store itself confirmed stock of the shown variant at the last check (`availabilityKnown === true`).
   * The site says "we will check" otherwise, so the field is left out rather than claiming InStock.
   */
  availability?: 'InStock' | 'OutOfStock' | null;
  /** Only when the store states it (eBay sells used items). */
  condition?: 'new' | 'used' | null;
  gtin?: string | null;
  mpn?: string | null;
};

/**
 * schema.org Product for a catalog page. No rating, review, return policy or shipping details: Atlas has no product
 * reviews and the store sets returns (CLAUDE.md, SEO audit 1 November 2026). The Offer exists only with a real price in
 * UZS, and its availability only when the store confirmed it.
 */
export function productJsonLd(product: ProductSeo) {
  const url = absoluteUrl(product.path, product.requested);
  const price = typeof product.priceUzs === 'number' && Number.isFinite(product.priceUzs) && product.priceUzs > 0 ? Math.round(product.priceUzs) : null;
  const images = product.images.filter((src) => src.startsWith('https://'));
  const text = (value: string | null | undefined) => value?.trim() || undefined;
  const description = text(product.description), brand = text(product.brand), category = text(product.category), color = text(product.color), gtin = text(product.gtin), mpn = text(product.mpn);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${siteOrigin}${product.path}#product`,
    url,
    name: product.name,
    sku: product.sku,
    ...(images.length ? { image: images } : {}),
    ...(description ? { description } : {}),
    ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
    ...(category ? { category } : {}),
    ...(color ? { color } : {}),
    ...(gtin ? { gtin } : {}),
    ...(mpn ? { mpn } : {}),
    ...(product.condition ? { itemCondition: `https://schema.org/${product.condition === 'used' ? 'UsedCondition' : 'NewCondition'}` } : {}),
    ...(price ? {
      offers: {
        '@type': 'Offer',
        url,
        price: String(price),
        priceCurrency: 'UZS',
        ...(product.priceValidUntil ? { priceValidUntil: product.priceValidUntil } : {}),
        ...(product.availability ? { availability: `https://schema.org/${product.availability}` } : {}),
        seller: { '@id': organizationId },
      },
    } : {}),
  };
}

/** A listing page (a store's products, a category): its name and the product URLs it links to, without prices. */
export function collectionPage({ path, requested, name, description, itemPaths }: { path: string; requested: Locale | null | undefined; name: string; description?: string; itemPaths: readonly string[] }) {
  const url = absoluteUrl(path, requested);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': url,
    url,
    name,
    ...(description ? { description } : {}),
    isPartOf: { '@id': websiteId },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: itemPaths.length,
      itemListElement: itemPaths.map((item, index) => ({ '@type': 'ListItem', position: index + 1, url: absoluteUrl(item, requested) })),
    },
  };
}

/** The questions and answers exactly as the page shows them. */
export function faqPage(items: readonly { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.filter((item) => item.q.trim() && item.a.trim()).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** JSON for an inline `<script type="application/ld+json">`: `<` is escaped so text can never close the tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
