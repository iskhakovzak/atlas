import type { Metadata } from 'next';
import { routeTitle, supportedLocale, type Locale } from '../lib/market/i18n.ts';

const ogLocale: Record<Locale, string> = { uz: 'uz_UZ', ru: 'ru_RU', en: 'en_US' };
const ogImage: Record<Locale, string> = { uz: '/og-image-uz.png', ru: '/og-image.png', en: '/og-image-en.png' };
const imageAlt: Record<Locale, string> = {
  uz: 'Atlas — xorijiy do‘konlardan O‘zbekistonga yetkazib berish',
  ru: 'Atlas — покупки в зарубежных магазинах с доставкой в Узбекистан',
  en: 'Atlas — shop international stores with delivery to Uzbekistan',
};
// Route-level openGraph replaces the root object, so each route repeats the preview image.
const images = (locale: Locale) => [{ url: ogImage[locale], width: 1200, height: 630, alt: imageAlt[locale] }];

export type PublicPage = 'home' | 'catalog' | 'stores' | 'customs' | 'legal' | 'privacy' | 'terms' | 'support' | 'app' | 'delete-account';
const paths: Record<PublicPage, string> = { home: '/', catalog: '/catalog', stores: '/stores', customs: '/customs', legal: '/legal', privacy: '/privacy', terms: '/terms', support: '/support', app: '/app', 'delete-account': '/delete-account' };

const pageText: Record<PublicPage, Record<Locale, { title: string; description: string }>> = {
  home: {
    uz: { title: 'Atlas — xorijiy do‘konlardan O‘zbekistonga yetkazib berish', description: 'Istalgan xorijiy do‘kondagi tovar havolasini qo‘ying va yakuniy narxni so‘mda biling: tovar, xizmat va yetkazib berish alohida satrlarda.' },
    ru: { title: 'Atlas — покупки в зарубежных магазинах с доставкой в Узбекистан', description: 'Вставьте ссылку на товар из любого зарубежного магазина и узнайте итог в сумах: товар, сервис и доставка отдельными строками.' },
    en: { title: 'Atlas — shop international stores with delivery to Uzbekistan', description: 'Paste a link from any international store and see the total in soum: item, service and delivery on separate lines.' },
  },
  catalog: {
    uz: { title: 'Xorijiy do‘konlar tovarlari katalogi', description: 'Poyabzal, kiyim, elektronika va go‘zallik mahsulotlari — yakuniy narxi so‘mda, O‘zbekistongacha yetkazish bilan. Do‘kon, narx, o‘lcham va bojsiz limit bo‘yicha filtrlar.' },
    ru: { title: 'Каталог товаров из зарубежных магазинов', description: 'Обувь, одежда, электроника и красота с итогом в сумах и доставкой в Узбекистан. Фильтры по магазину, цене, размеру и беспошлинному лимиту.' },
    en: { title: 'Catalog of products from international stores', description: 'Shoes, clothing, electronics and beauty with the total in soum and delivery to Uzbekistan. Filter by store, price, size and duty-free allowance.' },
  },
  stores: {
    uz: { title: 'Buyurtma berish mumkin bo‘lgan do‘konlar', description: 'Atlas orqali havola bo‘yicha buyurtma berish mumkin bo‘lgan xorijiy do‘konlar katalogi.' },
    ru: { title: 'Магазины для заказа', description: 'Каталог зарубежных магазинов, откуда можно оформить заказ по ссылке через Atlas.' },
    en: { title: 'Stores you can order from', description: 'A directory of international stores you can order from by link through Atlas.' },
  },
  customs: {
    uz: { title: 'Bojxona shartlari', description: 'Bojsiz limit qanday ishlashi, qanday ma’lumotlar kerakligi va O‘zbekistonga buyurtmalarda bojxona to‘lovlari qanday hisoblanishi.' },
    ru: { title: 'Таможенные условия', description: 'Как работает беспошлинный лимит, какие данные нужны и как рассчитываются таможенные платежи при заказе в Узбекистан.' },
    en: { title: 'Customs terms', description: 'How the duty-free allowance works, which details are needed and how customs payments are calculated for orders to Uzbekistan.' },
  },
  legal: {
    uz: { title: 'Huquqiy ma’lumotlar', description: 'Atlas xizmati qoidalari, buyurtma berish, hisob-kitob va ma’lumotlarni qayta ishlash tartibi.' },
    ru: { title: 'Правовая информация', description: 'Правила сервиса Atlas, порядок заказа, расчётов и обработки информации.' },
    en: { title: 'Legal information', description: 'Atlas service terms: ordering, payments and how information is processed.' },
  },
  privacy: {
    uz: { title: 'Maxfiylik siyosati', description: 'Atlas sayti va ilovalari qanday ma’lumotlarni qayta ishlashi, ular kimga uzatilishi mumkinligi, akkauntni o‘chirish va rozilikni qaytarib olish tartibi.' },
    ru: { title: 'Политика конфиденциальности', description: 'Какие данные обрабатывают сайт и приложения Atlas, кому они могут передаваться, как удалить аккаунт и отозвать согласие.' },
    en: { title: 'Privacy policy', description: 'Which data the Atlas website and apps process, who it may be shared with, how to delete your account and withdraw consent.' },
  },
  terms: {
    uz: { title: 'Foydalanish shartlari', description: 'Atlas ommaviy ofertasi: vositachilik va logistika xizmatlari, iOS va Android ilovalari shartlari, to‘lov va qaytarish.' },
    ru: { title: 'Условия использования', description: 'Публичная оферта Atlas: посреднические и логистические услуги, условия приложений для iOS и Android, оплата и возврат.' },
    en: { title: 'Terms of use', description: 'The Atlas public offer: intermediary and logistics services, terms for the iOS and Android apps, payment and refunds.' },
  },
  support: {
    uz: { title: 'Atlas yordam xizmati', description: 'Atlas bilan qanday bog‘lanish, buyurtma holatini qayerdan ko‘rish, bojxona, hujjatlar va akkauntni o‘chirish bo‘yicha javoblar.' },
    ru: { title: 'Поддержка Atlas', description: 'Как связаться с Atlas, где смотреть статус заказа, ответы о таможне, документах и удалении аккаунта.' },
    en: { title: 'Atlas support', description: 'How to reach Atlas, where to check your order status, answers about customs, documents and account deletion.' },
  },
  app: {
    uz: { title: 'Atlas ilovasi iOS va Android uchun', description: 'Atlas ilovasi sayt bilan bir xil ishlaydi: havola bo‘yicha hisob, buyurtmalar, hujjatlar va bildirishnomalar bitta akkauntda.' },
    ru: { title: 'Приложение Atlas для iOS и Android', description: 'Приложение Atlas делает то же, что и сайт: расчёт по ссылке, заказы, документы и уведомления в одном аккаунте.' },
    en: { title: 'Atlas app for iOS and Android', description: 'The Atlas app does the same as the website: link estimates, orders, documents and notifications in one account.' },
  },
  'delete-account': {
    uz: { title: 'Akkauntni o‘chirish', description: 'Atlas akkauntini ilovada yoki saytda qanday o‘chirish, nima darhol o‘chirilishi va nima qonun bo‘yicha shaxsiy ma’lumotlarsiz saqlanishi.' },
    ru: { title: 'Удаление аккаунта', description: 'Как удалить аккаунт Atlas в приложении или на сайте, что удаляется сразу и что хранится без личных данных по закону.' },
    en: { title: 'Delete your account', description: 'How to delete your Atlas account in the app or on the website, what is removed immediately and what is kept without personal data by law.' },
  },
};

const rootText: Record<Locale, { title: string; description: string; social: string }> = {
  uz: { title: 'Atlas — butun dunyodan xaridlar', description: 'Xorijiy do‘konlardan tovar toping, variantlarni tekshiring va O‘zbekistonga yetkazib berish bilan hisobni so‘mda oling.', social: 'Xorijiy do‘konlar, so‘mda shaffof hisob va O‘zbekistonga yetkazib berish.' },
  ru: { title: 'Atlas — покупки со всего мира', description: 'Находите товары в зарубежных магазинах, проверяйте варианты и получайте расчёт в сумах с доставкой в Узбекистан.', social: 'Зарубежные магазины, прозрачный расчёт в сумах и доставка в Узбекистан.' },
  en: { title: 'Atlas — shopping from around the world', description: 'Find products in international stores, check the options and get the total in soum with delivery to Uzbekistan.', social: 'International stores, transparent pricing in soum and delivery to Uzbekistan.' },
};

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
  // The home title carries the brand; other pages use the root "%s · Atlas" template.
  const socialTitle = page === 'home' ? text.title : `${text.title} · Atlas`;
  return {
    title: page === 'home' ? { absolute: text.title } : text.title,
    description: text.description,
    alternates: { canonical: url, languages: { uz: version('uz'), ru: version('ru'), en: version('en'), 'x-default': path } },
    openGraph: { type: 'website', url, title: socialTitle, description: text.description, locale: ogLocale[locale], images: images(locale) },
    twitter: { card: 'summary_large_image', title: socialTitle, description: text.description, images: [ogImage[locale]] },
  };
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

/** Root defaults in the page language; pages without their own title (such as the 404 page) use them. */
export function rootMetadata(locale: Locale): Metadata {
  const text = rootText[locale];
  return {
    metadataBase: new URL('https://atlasmarket.uz'),
    title: { default: text.title, template: '%s · Atlas' },
    description: text.description,
    applicationName: 'Atlas',
    category: 'shopping',
    creator: 'Atlas',
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
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
