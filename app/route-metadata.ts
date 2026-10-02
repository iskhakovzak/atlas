import type { Metadata } from 'next';

// Route-level openGraph replaces the root object, so each route repeats the preview image.
const images = [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Atlas — покупки в зарубежных магазинах с доставкой в Узбекистан' }];

export const catalogRouteMetadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { type: 'website', url: '/', images },
};

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
