import type { Locale } from './i18n.ts';
import {withCyrillic} from './uz-cyrl.ts';

// The 404 boundary is part of every page, so its words live apart from the account copy (customer-copy.ts).
type NotFoundCopy = { title: string; text: string; home: string; catalog: string; paste: string; stores: string; delivery: string; search: string; searchPlaceholder: string; find: string; linksLabel: string };

/** Unknown addresses keep the site shell and offer a search and the main ways back. */
export const notFoundCopy: Record<Locale, NotFoundCopy> = /*@__PURE__*/withCyrillic({
  ru: { title: 'Страница не найдена', text: 'Ссылка устарела или в адресе опечатка. Найдите товар или вставьте ссылку на него — посчитаем итог в сумах.', home: 'Главная', catalog: 'Каталог', paste: 'Купить по ссылке', stores: 'Магазины', delivery: 'Доставка и тарифы', search: 'Поиск по каталогу', searchPlaceholder: 'Товар, бренд или ссылка', find: 'Найти', linksLabel: 'Разделы сайта' },
  uz: { title: 'Sahifa topilmadi', text: 'Havola eskirgan yoki manzilda xato bor. Tovarni toping yoki uning havolasini qo‘ying — yakuniy narxni so‘mda hisoblaymiz.', home: 'Bosh sahifa', catalog: 'Katalog', paste: 'Havola orqali xarid', stores: 'Do‘konlar', delivery: 'Yetkazish va tariflar', search: 'Katalog bo‘yicha qidiruv', searchPlaceholder: 'Tovar, brend yoki havola', find: 'Topish', linksLabel: 'Sayt bo‘limlari' },
  en: { title: 'Page not found', text: 'The link is out of date or the address has a typo. Search for the item or paste its link and we’ll work out the total in soum.', home: 'Home', catalog: 'Catalog', paste: 'Buy by link', stores: 'Stores', delivery: 'Delivery and rates', search: 'Search the catalog', searchPlaceholder: 'Item, brand or link', find: 'Find', linksLabel: 'Site sections' },
});
