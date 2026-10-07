import type { Locale } from './i18n.ts';
import {withCyrillic} from './uz-cyrl.ts';

// The 404 boundary is part of every page, so its words live apart from the account copy (customer-copy.ts).
type NotFoundCopy = { title: string; text: string; home: string; paste: string; stores: string };

/** Unknown addresses keep the site shell and offer the main ways back. */
export const notFoundCopy: Record<Locale, NotFoundCopy> = /*@__PURE__*/withCyrillic({
  ru: { title: 'Страница не найдена', text: 'Ссылка устарела или в адресе опечатка. Начните с главной или вставьте ссылку на товар — посчитаем итог в сумах.', home: 'На главную', paste: 'Вставить ссылку на товар', stores: 'Магазины' },
  uz: { title: 'Sahifa topilmadi', text: 'Havola eskirgan yoki manzilda xato bor. Bosh sahifadan boshlang yoki tovar havolasini qo‘ying — yakuniy narxni so‘mda hisoblab beramiz.', home: 'Bosh sahifa', paste: 'Tovar havolasini qo‘yish', stores: 'Do‘konlar' },
  en: { title: 'Page not found', text: 'The link is out of date or the address has a typo. Start from the home page or paste a product link and we’ll work out the total in soum.', home: 'Home page', paste: 'Paste a product link', stores: 'Stores' },
});
