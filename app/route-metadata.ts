import type { Metadata } from 'next';

export const catalogRouteMetadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { type: 'website', url: '/' },
};

export const customsRouteMetadata: Metadata = {
  title: 'Таможенные условия',
  description: 'Как работает беспошлинный лимит, какие данные нужны и как рассчитываются таможенные платежи при заказе в Узбекистан.',
  alternates: { canonical: '/customs' },
  openGraph: { type: 'website', url: '/customs', title: 'Таможенные условия · Atlas', description: 'Понятная информация о таможенных правилах и расчёте для заказов в Узбекистан.' },
};

export const legalRouteMetadata: Metadata = {
  title: 'Правовая информация',
  description: 'Правила сервиса Atlas, порядок заказа, расчётов и обработки информации.',
  alternates: { canonical: '/legal' },
  openGraph: { type: 'website', url: '/legal', title: 'Правовая информация · Atlas', description: 'Правила и условия использования сервиса Atlas.' },
};

export const storesRouteMetadata: Metadata = {
  title: 'Магазины для заказа',
  description: 'Каталог зарубежных магазинов, откуда можно оформить заказ по ссылке через Atlas.',
  alternates: { canonical: '/stores' },
  openGraph: { type: 'website', url: '/stores', title: 'Магазины для заказа · Atlas', description: 'Зарубежные магазины для заказа товаров в Узбекистан через Atlas.' },
};

export const privateRouteMetadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};
