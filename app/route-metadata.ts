import type { Metadata } from 'next';

// Route-level openGraph replaces the root object, so each route repeats the preview image.
const images = [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Atlas — покупки в зарубежных магазинах с доставкой в Узбекистан' }];

const homeText = {
  uz: { title: 'Atlas — xorijiy do‘konlardan O‘zbekistonga yetkazib berish', description: 'Istalgan xorijiy do‘kondagi tovar havolasini qo‘ying va yakuniy narxni so‘mda biling: tovar, xizmat va yetkazib berish alohida satrlarda.', ogLocale: 'uz_UZ', image: '/og-image-uz.png' },
  ru: { title: 'Atlas — покупки в зарубежных магазинах с доставкой в Узбекистан', description: 'Вставьте ссылку на товар из любого зарубежного магазина и узнайте итог в сумах: товар, сервис и доставка отдельными строками.', ogLocale: 'ru_RU', image: '/og-image.png' },
  en: { title: 'Atlas — shop international stores with delivery to Uzbekistan', description: 'Paste a link from any international store and see the total in soum: item, service and delivery on separate lines.', ogLocale: 'en_US', image: '/og-image-en.png' },
} as const;

/** Home metadata: "/" is the Uzbek x-default; "/?lang=xx" pages are self-canonical hreflang alternates. */
export function homeMetadata(lang?: string): Metadata {
  const locale = lang === 'uz' || lang === 'ru' || lang === 'en' ? lang : null;
  const text = homeText[locale ?? 'uz'];
  const url = locale ? `/?lang=${locale}` : '/';
  return {
    title: { absolute: text.title },
    description: text.description,
    alternates: { canonical: url, languages: { uz: '/?lang=uz', ru: '/?lang=ru', en: '/?lang=en', 'x-default': '/' } },
    openGraph: { type: 'website', url, title: text.title, description: text.description, locale: text.ogLocale, images: [{ ...images[0], url: text.image }] },
    twitter: { card: 'summary_large_image', title: text.title, description: text.description, images: [text.image] },
  };
}

export const customsRouteMetadata: Metadata = {
  title: 'Таможенные условия',
  description: 'Как работает беспошлинный лимит, какие данные нужны и как рассчитываются таможенные платежи при заказе в Узбекистан.',
  alternates: { canonical: '/customs' },
  openGraph: { type: 'website', url: '/customs', title: 'Таможенные условия · Atlas', description: 'Понятная информация о таможенных правилах и расчёте для заказов в Узбекистан.', images },
};

export const legalRouteMetadata: Metadata = {
  title: 'Правовая информация',
  description: 'Правила сервиса Atlas, порядок заказа, расчётов и обработки информации.',
  alternates: { canonical: '/legal' },
  openGraph: { type: 'website', url: '/legal', title: 'Правовая информация · Atlas', description: 'Правила и условия использования сервиса Atlas.', images },
};

export const storesRouteMetadata: Metadata = {
  title: 'Магазины для заказа',
  description: 'Каталог зарубежных магазинов, откуда можно оформить заказ по ссылке через Atlas.',
  alternates: { canonical: '/stores' },
  openGraph: { type: 'website', url: '/stores', title: 'Магазины для заказа · Atlas', description: 'Зарубежные магазины для заказа товаров в Узбекистан через Atlas.', images },
};

export const privateRouteMetadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};
