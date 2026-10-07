import type { Locale } from './i18n.ts';
import {withCyrillic} from './uz-cyrl.ts';

// The home chapter rail on wide screens (app/home-rail.tsx): its accessible name and the chapter names the home copy has no
// short label for. «How it works» and «Rates» are homeCopy.nav.how / .tariffs, the button is homeCopy.sticky.paste.
export type HomeRailCopy = {
  label: string;
  chapters: { top: string; finds: string; trust: string; faq: string; end: string };
};

export const homeRailCopy: Record<Locale, HomeRailCopy> = withCyrillic({
  ru: {
    label: 'Разделы главной',
    chapters: { top: 'Расчёт', finds: 'Подборка', trust: 'Ваши деньги', faq: 'Вопросы', end: 'Заказать' },
  },
  uz: {
    label: 'Bosh sahifa bo‘limlari',
    chapters: { top: 'Hisob', finds: 'Tovarlar', trust: 'Pulingiz', faq: 'Savollar', end: 'Buyurtma' },
  },
  en: {
    label: 'Home page sections',
    chapters: { top: 'Estimate', finds: 'Selection', trust: 'Your money', faq: 'Questions', end: 'Order' },
  },
});
