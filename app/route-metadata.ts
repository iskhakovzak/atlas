import type { Metadata } from 'next';
import { routeTitle, type Locale } from '../lib/market/i18n.ts';
import {withCyrillic} from '../lib/market/uz-cyrl.ts';
import { alternateOgLocales, defaultImage, ogLocale, pageMetadata } from '../lib/seo/metadata.ts';
import { pageLanguageSet, type LanguageSet } from '../lib/seo/locales.ts';

export type PublicPage = 'home' | 'catalog' | 'stores' | 'customs' | 'legal' | 'privacy' | 'terms' | 'support' | 'app' | 'delete-account';
const paths: Record<PublicPage, string> = { home: '/', catalog: '/catalog', stores: '/stores', customs: '/customs', legal: '/legal', privacy: '/privacy', terms: '/terms', support: '/support', app: '/app', 'delete-account': '/delete-account' };

export function publicPath(page: PublicPage): string {
  return paths[page];
}

/** Every public page, in sitemap order. */
export const publicPages = Object.keys(paths) as PublicPage[];

/** Language versions per page: the legal documents exist only in Russian for now (lib/seo/locales.ts). */
export const pageLanguages = Object.fromEntries(publicPages.map((page) => [page, pageLanguageSet(paths[page])])) as Record<PublicPage, LanguageSet>;

// Titles that already name Atlas are used as is, so the "%s · Atlas" template does not repeat the brand.
const pageText: Record<PublicPage, Record<Locale, { title: string; description: string }>> = {
  home: /*@__PURE__*/withCyrillic({
    uz: { title: 'Atlas — xorijiy do‘konlardan Toshkentga yetkazib berish', description: 'Xorijiy do‘kondagi tovar havolasini qo‘ying va yakuniy narxni so‘mda biling: tovar narxi va xalqaro yetkazish bilan Atlas xizmati, tarkibi hisobda ko‘rinadi.' },
    ru: { title: 'Atlas — покупки в зарубежных магазинах с доставкой в Ташкент', description: 'Вставьте ссылку на товар из зарубежного магазина и узнайте итог в сумах: цена товара и сервис Atlas с международной доставкой, состав виден в счёте.' },
    en: { title: 'Atlas — shop international stores with delivery to Tashkent', description: 'Paste a product link from a store abroad and see the total in soum with delivery to Tashkent: the item and the Atlas service, broken down in the bill.' },
  }),
  catalog: /*@__PURE__*/withCyrillic({
    uz: { title: 'Xorijiy tovarlar katalogi Toshkentga yetkazish bilan', description: 'Poyabzal, kiyim, elektronika va go‘zallik — yakuniy narx so‘mda, Toshkentga yetkazish bilan. Do‘kon, narx, o‘lcham va bojsiz limit filtrlari.' },
    ru: { title: 'Каталог зарубежных товаров с доставкой в Ташкент', description: 'Обувь, одежда, электроника и красота с итогом в сумах и доставкой в Ташкент. Фильтры по магазину, цене, размеру и беспошлинному лимиту.' },
    en: { title: 'International product catalog, delivered to Tashkent', description: 'Shoes, clothing, electronics and beauty with the total in soum and delivery to Tashkent. Filter by store, price, size and duty-free allowance.' },
  }),
  stores: /*@__PURE__*/withCyrillic({
    uz: { title: 'AQSh, Yevropa, Xitoy do‘konlari: Toshkentga buyurtma', description: 'AQSh, Yevropa, Xitoy va boshqa davlatlar do‘konlari: Atlas havolangiz bo‘yicha tovarni sotib olib, Toshkentga yetkazadi. Muddat, 1 kg narxi va valyuta.' },
    ru: { title: 'Магазины США, Европы и Китая с доставкой в Ташкент', description: 'Магазины США, Европы, Китая и других стран: Atlas выкупит товар по вашей ссылке и доставит в Ташкент. Для каждого магазина — срок, цена за 1 кг и валюта.' },
    en: { title: 'US, EU and Chinese stores with delivery to Tashkent', description: 'Stores in the US, Europe, China and beyond: Atlas buys the item from your link and delivers it to Tashkent. Delivery time, price per kg and currency.' },
  }),
  customs: /*@__PURE__*/withCyrillic({
    uz: { title: 'Bojsiz limit va boj: O‘zbekistonga posilkalar', description: 'Bojsiz limit qanday ishlashi, qanday ma’lumotlar kerakligi va O‘zbekistonga buyurtmalarda bojxona to‘lovlari qanday hisoblanishi.' },
    ru: { title: 'Таможенный лимит и пошлина на посылки в Узбекистан', description: 'Как работает беспошлинный лимит, какие данные нужны и как рассчитываются таможенные платежи при заказе в Узбекистан.' },
    en: { title: 'Customs duty and duty-free allowance in Uzbekistan', description: 'How the duty-free allowance works, which details are needed and how customs payments are calculated for orders to Uzbekistan.' },
  }),
  legal: /*@__PURE__*/withCyrillic({
    uz: { title: 'Huquqiy ma’lumotlar', description: 'Atlas xizmati qoidalari, buyurtma berish, hisob-kitob va ma’lumotlarni qayta ishlash tartibi.' },
    ru: { title: 'Правовая информация', description: 'Правила сервиса Atlas, порядок заказа, расчётов и обработки информации.' },
    en: { title: 'Legal information', description: 'Atlas service terms: ordering, payments and how information is processed.' },
  }),
  privacy: /*@__PURE__*/withCyrillic({
    uz: { title: 'Maxfiylik siyosati', description: 'Atlas sayti va ilovalari qanday ma’lumotlarni qayta ishlashi, ular kimga uzatilishi mumkinligi, akkauntni o‘chirish va rozilikni qaytarib olish tartibi.' },
    ru: { title: 'Политика конфиденциальности', description: 'Какие данные обрабатывают сайт и приложения Atlas, кому они могут передаваться, как удалить аккаунт и отозвать согласие.' },
    en: { title: 'Privacy policy', description: 'Which data the Atlas website and apps process, who it may be shared with, how to delete your account and withdraw consent.' },
  }),
  terms: /*@__PURE__*/withCyrillic({
    uz: { title: 'Foydalanish shartlari', description: 'Atlas ommaviy ofertasi: vositachilik va logistika xizmatlari, iOS va Android ilovalari shartlari, to‘lov va qaytarish.' },
    ru: { title: 'Условия использования', description: 'Публичная оферта Atlas: посреднические и логистические услуги, условия приложений для iOS и Android, оплата и возврат.' },
    en: { title: 'Terms of use', description: 'The Atlas public offer: intermediary and logistics services, terms for the iOS and Android apps, payment and refunds.' },
  }),
  support: /*@__PURE__*/withCyrillic({
    uz: { title: 'Atlas yordam xizmati', description: 'Atlas bilan qanday bog‘lanish, buyurtma holatini qayerdan ko‘rish, bojxona, hujjatlar va akkauntni o‘chirish bo‘yicha javoblar.' },
    ru: { title: 'Поддержка Atlas', description: 'Как связаться с Atlas, где смотреть статус заказа, ответы о таможне, документах и удалении аккаунта.' },
    en: { title: 'Atlas support', description: 'How to reach Atlas, where to check your order status, answers about customs, documents and account deletion.' },
  }),
  app: /*@__PURE__*/withCyrillic({
    uz: { title: 'Atlas ilovasi iOS va Android uchun', description: 'Atlas ilovasi sayt bilan bir xil ishlaydi: havola bo‘yicha hisob, buyurtmalar, hujjatlar va bildirishnomalar bitta akkauntda.' },
    ru: { title: 'Приложение Atlas для iOS и Android', description: 'Приложение Atlas делает то же, что и сайт: расчёт по ссылке, заказы, документы и уведомления в одном аккаунте.' },
    en: { title: 'Atlas app for iOS and Android', description: 'The Atlas app does the same as the website: link estimates, orders, documents and notifications in one account.' },
  }),
  'delete-account': /*@__PURE__*/withCyrillic({
    uz: { title: 'Akkauntni o‘chirish', description: 'Atlas akkauntini ilovada yoki saytda qanday o‘chirish, nima darhol o‘chirilishi va nima qonun bo‘yicha shaxsiy ma’lumotlarsiz saqlanishi.' },
    ru: { title: 'Удаление аккаунта', description: 'Как удалить аккаунт Atlas в приложении или на сайте, что удаляется сразу и что хранится без личных данных по закону.' },
    en: { title: 'Delete your account', description: 'How to delete your Atlas account in the app or on the website, what is removed immediately and what is kept without personal data by law.' },
  }),
};

const rootText: Record<Locale, { title: string; description: string; social: string }> = /*@__PURE__*/withCyrillic({
  uz: { title: 'Atlas — butun dunyodan xaridlar', description: 'Xorijiy do‘konlardan tovar toping, variantlarni tekshiring va Toshkentga yetkazib berish bilan hisobni so‘mda oling.', social: 'Xorijiy do‘konlar, so‘mda shaffof hisob va Toshkentga yetkazib berish.' },
  ru: { title: 'Atlas — покупки со всего мира', description: 'Находите товары в зарубежных магазинах, проверяйте варианты и получайте расчёт в сумах с доставкой в Ташкент.', social: 'Зарубежные магазины, прозрачный расчёт в сумах и доставка в Ташкент.' },
  en: { title: 'Atlas — shopping from around the world', description: 'Find products in international stores, check the options and get the total in soum with delivery to Tashkent.', social: 'International stores, transparent pricing in soum and delivery to Tashkent.' },
});

/**
 * Public pages: `/path` is the x-default, rendered in the visitor's language (Uzbek for crawlers without a
 * preference); `/path?lang=xx` are self-canonical hreflang versions rendered in that language on the server
 * (middleware.ts). Titles always match the language of the page text. Built by lib/seo/metadata.ts, which the
 * redesigned pages (/catalog/p/[id], /stores/[slug], /delivery) use too.
 */
export function publicMetadata(page: PublicPage, lang: string | undefined, fallback: Locale = 'uz'): Metadata {
  return pageMetadata({ path: paths[page], lang, fallback, text: (locale) => pageText[page][locale], languages: pageLanguages[page] });
}

const productText: Record<Locale, (title: string, sum?: string) => string> = /*@__PURE__*/withCyrillic({
  uz: (title, sum) => `${title} — ${sum ? `Toshkentgacha ${sum}, ` : ''}narx so‘mda: tovar, Atlas xizmati va tarif bo‘yicha yetkazish. Narxni xariddan oldin do‘kon bilan tekshiramiz.`,
  ru: (title, sum) => `${title} — ${sum ? `${sum} до Ташкента, ` : ''}сумма в сумах: товар, сервис Atlas и доставка по тарифу. Цену сверяем с магазином перед выкупом.`,
  en: (title, sum) => `${title} — ${sum ? `${sum} to Tashkent, ` : ''}the sum in soum: the item, the Atlas service and delivery by tariff. We check the price with the store before buying.`,
});

/** A catalog product page (/catalog/p/[id]): its own title, description and photo, with the shared canonical/hreflang rules. */
export function productMetadata(product: { id: string; name: string; brand?: string; image?: string }, sum: string | undefined, lang: string | undefined, fallback: Locale = 'uz'): Metadata {
  const brand = product.brand?.trim();
  const title = brand && !product.name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${product.name}` : product.name;
  return pageMetadata({
    path: '/catalog/p/' + encodeURIComponent(product.id),
    lang,
    fallback,
    text: (locale) => ({ title, description: productText[locale](title, sum) }),
    image: product.image?.startsWith('https://') ? { url: product.image, alt: title } : undefined,
  });
}

export function homeMetadata(lang?: string, fallback: Locale = 'uz'): Metadata {
  return publicMetadata('home', lang, fallback);
}

export const privateRouteMetadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

/** Private and order-entry pages: never indexed, but titled in the page language so tabs and history stay readable. */
export function privateMetadata(view: string, locale: Locale): Metadata {
  return { ...privateRouteMetadata, title: routeTitle(locale, view) };
}

/** Meta-tag codes from Google Search Console and Yandex Webmaster; empty values add no tag. */
export type SiteVerification = { google?: string; yandex?: string };

/** Root defaults in the page language; pages without their own title (such as the 404 page) use them. */
export function rootMetadata(locale: Locale, codes: SiteVerification = {}): Metadata {
  const text = rootText[locale];
  const google = codes.google?.trim(), yandex = codes.yandex?.trim();
  return {
    ...(google || yandex ? { verification: { ...(google ? { google } : {}), ...(yandex ? { yandex } : {}) } } : {}),
    metadataBase: new URL('https://atlasmarket.uz'),
    title: { default: text.title, template: '%s · Atlas' },
    description: text.description,
    applicationName: 'Atlas',
    category: 'shopping',
    creator: 'Atlas',
    openGraph: {
      type: 'website', locale: ogLocale[locale], alternateLocale: alternateOgLocales(locale),
      siteName: 'Atlas', title: text.title, description: text.social, images: [defaultImage(locale)],
    },
    twitter: { card: 'summary_large_image', title: text.title, description: text.social, images: [defaultImage(locale).url] },
    icons: {
      icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/favicon.ico', sizes: '32x32' }],
      shortcut: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
    manifest: '/manifest.webmanifest',
    // Added to an iPhone home screen, Atlas opens as its own app with its name and a light status bar; Web Push on iOS
    // works only from such an installed copy (iOS 16.4+).
    appleWebApp: { capable: true, title: 'Atlas', statusBarStyle: 'default' },
  };
}
