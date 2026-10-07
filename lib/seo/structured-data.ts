import type { Locale, TextLocale } from '../market/i18n.ts';
import { pickLocale, withCyrillic } from '../market/uz-cyrl.ts';

// schema.org JSON-LD for the public pages. Only facts the site already shows: no prices, stock,
// ratings or delivery promises (imported products are editable estimates, see CLAUDE.md).

export const siteOrigin = 'https://atlasmarket.uz';

type Contacts = {
  telegramSupport: string | null;
  telegramChannel: string | null;
  phone: string | null;
  instagram: string | null;
  supportEmail: string | null;
};
type Legal = { entityName: string | null; inn: string | null; address: Record<TextLocale, string> | null };

const organizationText: Record<Locale, string> = withCyrillic({
  uz: 'Xorijiy do‘konlardan xarid qilishda vositachi va logistika agenti: tovarni xorijda sotib olib, O‘zbekistonga yetkazib beradi.',
  ru: 'Посредник и логистический агент для покупок в зарубежных магазинах: выкупает товар за рубежом и доставляет его в Узбекистан.',
  en: 'Purchasing intermediary and logistics agent for international shopping: buys items abroad and delivers them to Uzbekistan.',
});
const homeName: Record<Locale, string> = withCyrillic({ uz: 'Bosh sahifa', ru: 'Главная', en: 'Home' });

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
    availableLanguage: ['uz', 'ru', 'en'],
    ...(contacts.supportEmail ? { email: contacts.supportEmail } : {}),
    ...(contacts.phone ? { telephone: contacts.phone } : {}),
    ...(contacts.telegramSupport ? { url: `https://t.me/${contacts.telegramSupport}` } : {}),
  }] : undefined;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteOrigin}/#organization`,
        name: 'Atlas',
        url: siteOrigin,
        // A square mark: search engines crop a 1200×630 banner badly.
        logo: { '@type': 'ImageObject', url: `${siteOrigin}/icon-512.png`, width: 512, height: 512 },
        image: `${siteOrigin}/og-image.png`,
        description: organizationText[locale],
        areaServed: { '@type': 'Country', name: 'Uzbekistan' },
        ...(legal?.entityName ? { legalName: legal.entityName } : {}),
        // INN is the Uzbek taxpayer number.
        ...(legal?.inn ? { taxID: legal.inn } : {}),
        ...(legal?.address && pickLocale(legal.address, locale) ? { address: { '@type': 'PostalAddress', streetAddress: pickLocale(legal.address, locale), addressCountry: 'UZ' } } : {}),
        ...(sameAs.length ? { sameAs } : {}),
        ...(contactPoint ? { contactPoint } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': `${siteOrigin}/#website`,
        name: 'Atlas',
        url: siteOrigin,
        inLanguage: ['uz', 'ru', 'en'],
        publisher: { '@id': `${siteOrigin}/#organization` },
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

/** Home → page trail for a public subpage, in the page language. */
export function breadcrumbs(locale: Locale, path: string, title: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: homeName[locale], item: localizedUrl('/', locale) },
      { '@type': 'ListItem', position: 2, name: title, item: localizedUrl(path, locale) },
    ],
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
