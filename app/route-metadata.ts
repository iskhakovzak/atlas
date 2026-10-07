import type { Metadata } from 'next';
import { routeTitle, supportedLocale, type Locale } from '../lib/market/i18n.ts';
import {withCyrillic} from '../lib/market/uz-cyrl.ts';

const ogLocale: Record<Locale, string> = withCyrillic({ uz: 'uz_UZ', ru: 'ru_RU', en: 'en_US' });
const ogImage: Record<Locale, string> = withCyrillic({ uz: '/og-image-uz.png', ru: '/og-image.png', en: '/og-image-en.png' });
const imageAlt: Record<Locale, string> = withCyrillic({
  uz: 'Atlas — xorijiy do‘konlardan O‘zbekistonga yetkazib berish',
  ru: 'Atlas — покупки в зарубежных магазинах с доставкой в Узбекистан',
  en: 'Atlas — shop international stores with delivery to Uzbekistan',
});
// Route-level openGraph replaces the root object, so each route repeats the preview image.
const images = (locale: Locale) => [{ url: ogImage[locale], width: 1200, height: 630, alt: imageAlt[locale] }];

export type PublicPage = 'home' | 'catalog' | 'stores' | 'customs' | 'legal' | 'privacy' | 'terms' | 'support' | 'app' | 'delete-account';
const paths: Record<PublicPage, string> = { home: '/', catalog: '/catalog', stores: '/stores', customs: '/customs', legal: '/legal', privacy: '/privacy', terms: '/terms', support: '/support', app: '/app', 'delete-account': '/delete-account' };

export function publicPath(page: PublicPage): string {
  return paths[page];
}

// Titles that already name Atlas are used as is, so the "%s · Atlas" template does not repeat the brand.
const pageText: Record<PublicPage, Record<Locale, { title: string; description: string }>> = {
  home: withCyrillic({
    uz: { title: 'Atlas — xorijiy do‘konlardan O‘zbekistonga yetkazib berish', description: 'Istalgan xorijiy do‘kondagi tovar havolasini qo‘ying va yakuniy narxni so‘mda biling: tovar, xizmat va yetkazib berish alohida satrlarda.' },
    ru: { title: 'Atlas — покупки в зарубежных магазинах с доставкой в Узбекистан', description: 'Вставьте ссылку на товар из любого зарубежного магазина и узнайте итог в сумах: товар, сервис и доставка отдельными строками.' },
    en: { title: 'Atlas — shop international stores with delivery to Uzbekistan', description: 'Paste a link from any international store and see the total in soum: item, service and delivery on separate lines.' },
  }),
  catalog: withCyrillic({
    uz: { title: 'Xorijiy tovarlar katalogi — O‘zbekistonga yetkazib berish', description: 'Poyabzal, kiyim, elektronika va go‘zallik mahsulotlari — yakuniy narxi so‘mda, O‘zbekistongacha yetkazish bilan. Do‘kon, narx, o‘lcham va bojsiz limit bo‘yicha filtrlar.' },
    ru: { title: 'Каталог зарубежных товаров с доставкой в Узбекистан', description: 'Обувь, одежда, электроника и красота с итогом в сумах и доставкой в Узбекистан. Фильтры по магазину, цене, размеру и беспошлинному лимиту.' },
    en: { title: 'Catalog of international products with delivery to Uzbekistan', description: 'Shoes, clothing, electronics and beauty with the total in soum and delivery to Uzbekistan. Filter by store, price, size and duty-free allowance.' },
  }),
  stores: withCyrillic({
    uz: { title: 'AQSh, Yevropa va Xitoy do‘konlaridan O‘zbekistonga buyurtma', description: 'AQSh, Yevropa, Xitoy va boshqa mamlakatlardagi do‘konlar: Atlas havolangiz bo‘yicha tovarni sotib olib, O‘zbekistonga yetkazadi. Har bir do‘kon uchun muddat, 1 kg narxi va valyuta.' },
    ru: { title: 'Магазины США, Европы и Китая для заказа в Узбекистан', description: 'Магазины США, Европы, Китая и других стран: Atlas выкупит товар по вашей ссылке и доставит в Узбекистан. Для каждого магазина — срок, цена за 1 кг и валюта.' },
    en: { title: 'Order from US, European and Chinese stores to Uzbekistan', description: 'Stores in the US, Europe, China and other countries: Atlas buys the item from your link and delivers it to Uzbekistan. Delivery time, price per kg and currency for each store.' },
  }),
  customs: withCyrillic({
    uz: { title: 'O‘zbekistonga jo‘natmalar uchun bojsiz limit va bojxona to‘lovi', description: 'Bojsiz limit qanday ishlashi, qanday ma’lumotlar kerakligi va O‘zbekistonga buyurtmalarda bojxona to‘lovlari qanday hisoblanishi.' },
    ru: { title: 'Таможенный лимит и пошлина на посылки в Узбекистан', description: 'Как работает беспошлинный лимит, какие данные нужны и как рассчитываются таможенные платежи при заказе в Узбекистан.' },
    en: { title: 'Customs duty and duty-free allowance for parcels to Uzbekistan', description: 'How the duty-free allowance works, which details are needed and how customs payments are calculated for orders to Uzbekistan.' },
  }),
  legal: withCyrillic({
    uz: { title: 'Huquqiy ma’lumotlar', description: 'Atlas xizmati qoidalari, buyurtma berish, hisob-kitob va ma’lumotlarni qayta ishlash tartibi.' },
    ru: { title: 'Правовая информация', description: 'Правила сервиса Atlas, порядок заказа, расчётов и обработки информации.' },
    en: { title: 'Legal information', description: 'Atlas service terms: ordering, payments and how information is processed.' },
  }),
  privacy: withCyrillic({
    uz: { title: 'Maxfiylik siyosati', description: 'Atlas sayti va ilovalari qanday ma’lumotlarni qayta ishlashi, ular kimga uzatilishi mumkinligi, akkauntni o‘chirish va rozilikni qaytarib olish tartibi.' },
    ru: { title: 'Политика конфиденциальности', description: 'Какие данные обрабатывают сайт и приложения Atlas, кому они могут передаваться, как удалить аккаунт и отозвать согласие.' },
    en: { title: 'Privacy policy', description: 'Which data the Atlas website and apps process, who it may be shared with, how to delete your account and withdraw consent.' },
  }),
  terms: withCyrillic({
    uz: { title: 'Foydalanish shartlari', description: 'Atlas ommaviy ofertasi: vositachilik va logistika xizmatlari, iOS va Android ilovalari shartlari, to‘lov va qaytarish.' },
    ru: { title: 'Условия использования', description: 'Публичная оферта Atlas: посреднические и логистические услуги, условия приложений для iOS и Android, оплата и возврат.' },
    en: { title: 'Terms of use', description: 'The Atlas public offer: intermediary and logistics services, terms for the iOS and Android apps, payment and refunds.' },
  }),
  support: withCyrillic({
    uz: { title: 'Atlas yordam xizmati', description: 'Atlas bilan qanday bog‘lanish, buyurtma holatini qayerdan ko‘rish, bojxona, hujjatlar va akkauntni o‘chirish bo‘yicha javoblar.' },
    ru: { title: 'Поддержка Atlas', description: 'Как связаться с Atlas, где смотреть статус заказа, ответы о таможне, документах и удалении аккаунта.' },
    en: { title: 'Atlas support', description: 'How to reach Atlas, where to check your order status, answers about customs, documents and account deletion.' },
  }),
  app: withCyrillic({
    uz: { title: 'Atlas ilovasi iOS va Android uchun', description: 'Atlas ilovasi sayt bilan bir xil ishlaydi: havola bo‘yicha hisob, buyurtmalar, hujjatlar va bildirishnomalar bitta akkauntda.' },
    ru: { title: 'Приложение Atlas для iOS и Android', description: 'Приложение Atlas делает то же, что и сайт: расчёт по ссылке, заказы, документы и уведомления в одном аккаунте.' },
    en: { title: 'Atlas app for iOS and Android', description: 'The Atlas app does the same as the website: link estimates, orders, documents and notifications in one account.' },
  }),
  'delete-account': withCyrillic({
    uz: { title: 'Akkauntni o‘chirish', description: 'Atlas akkauntini ilovada yoki saytda qanday o‘chirish, nima darhol o‘chirilishi va nima qonun bo‘yicha shaxsiy ma’lumotlarsiz saqlanishi.' },
    ru: { title: 'Удаление аккаунта', description: 'Как удалить аккаунт Atlas в приложении или на сайте, что удаляется сразу и что хранится без личных данных по закону.' },
    en: { title: 'Delete your account', description: 'How to delete your Atlas account in the app or on the website, what is removed immediately and what is kept without personal data by law.' },
  }),
};

const rootText: Record<Locale, { title: string; description: string; social: string }> = withCyrillic({
  uz: { title: 'Atlas — butun dunyodan xaridlar', description: 'Xorijiy do‘konlardan tovar toping, variantlarni tekshiring va O‘zbekistonga yetkazib berish bilan hisobni so‘mda oling.', social: 'Xorijiy do‘konlar, so‘mda shaffof hisob va O‘zbekistonga yetkazib berish.' },
  ru: { title: 'Atlas — покупки со всего мира', description: 'Находите товары в зарубежных магазинах, проверяйте варианты и получайте расчёт в сумах с доставкой в Узбекистан.', social: 'Зарубежные магазины, прозрачный расчёт в сумах и доставка в Узбекистан.' },
  en: { title: 'Atlas — shopping from around the world', description: 'Find products in international stores, check the options and get the total in soum with delivery to Uzbekistan.', social: 'International stores, transparent pricing in soum and delivery to Uzbekistan.' },
});

/**
 * Public pages: `/path` is the x-default, rendered in the visitor's language (Uzbek for crawlers
 * without a preference); `/path?lang=xx` are self-canonical hreflang versions rendered in that
 * language on the server (middleware.ts). Titles always match the language of the page text.
 */
export function publicMetadata(page: PublicPage, lang: string | undefined, fallback: Locale = 'uz'): Metadata {
  const requested = supportedLocale(lang);
  const locale = requested ?? fallback;
  const path = paths[page];
  const version = (code: Locale) => `${path}?lang=${code}`;
  const url = requested ? version(requested) : path;
  const text = pageText[page][locale];
  // Titles that already carry the brand stand alone; the rest use the root "%s · Atlas" template.
  const branded = text.title.includes('Atlas');
  const socialTitle = branded ? text.title : `${text.title} · Atlas`;
  return {
    title: branded ? { absolute: text.title } : text.title,
    description: text.description,
    robots: publicRobots,
    alternates: { canonical: url, languages: { uz: version('uz'), 'uz-Cyrl': version('oz'), ru: version('ru'), en: version('en'), 'x-default': path } },
    openGraph: { type: 'website', url, title: socialTitle, description: text.description, locale: ogLocale[locale], images: images(locale) },
    twitter: { card: 'summary_large_image', title: socialTitle, description: text.description, images: [ogImage[locale]] },
  };
}

// Set on public pages only: a root-level `index, follow` would be repeated next to the
// framework's `noindex` on the 404 page.
const publicRobots: Metadata['robots'] = { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } };

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
      type: 'website', locale: ogLocale[locale], alternateLocale: (['uz', 'ru', 'en'] as const).filter((code) => code !== locale).map((code) => ogLocale[code]),
      siteName: 'Atlas', title: text.title, description: text.social, images: images(locale),
    },
    twitter: { card: 'summary_large_image', title: text.title, description: text.social, images: [ogImage[locale]] },
    icons: {
      icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/favicon.ico', sizes: '32x32' }],
      shortcut: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
    manifest: '/manifest.webmanifest',
  };
}
