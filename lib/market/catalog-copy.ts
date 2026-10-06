import type { Locale } from './i18n.ts';
import { tashkentMonth } from './world.ts';
import type { CatalogSort, PriceBand } from './catalog-query.ts';

const usd = (value: number) => '$' + Math.max(0, Math.floor(value));

const ru = {
  title: 'Каталог товаров',
  intro: 'Товары из зарубежных магазинов с итогом в сумах: цена, сервис и доставка до Узбекистана. Цену и наличие Atlas проверит, когда вы оформите заказ.',
  stats: (products: number, stores: number) => `${products} ${plural(products, ['товар', 'товара', 'товаров'])} из ${stores} ${stores % 10 === 1 && stores % 100 !== 11 ? 'магазина' : 'магазинов'}`,
  teaserTitle: 'Подборка товаров',
  teaserIntro: 'Товары из зарубежных магазинов, отобранные Atlas. Сумма на карточке уже с доставкой в Узбекистан.',
  viewAll: (count: number) => `Весь каталог (${count})`,
  teaserPrev: 'Предыдущие товары', teaserNext: 'Следующие товары',
  search: 'Поиск по каталогу', searchPlaceholder: 'Товар, бренд или магазин', clearSearch: 'Очистить поиск',
  all: 'Все', categoriesLabel: 'Категории', collections: 'Подборки',
  filters: 'Фильтры', filtersTitle: 'Фильтры', show: (count: number) => count ? `Показать ${count} ${plural(count, ['товар', 'товара', 'товаров'])}` : 'Ничего не найдено',
  reset: 'Сбросить', resetAll: 'Сбросить всё', close: 'Закрыть',
  sort: 'Сортировка', sorts: { best: 'Рекомендуем', cheap: 'Дешевле', expensive: 'Дороже', new: 'Новые' } as Record<CatalogSort, string>,
  store: 'Магазин', storesMore: (count: number) => `Ещё ${count}`, storesLess: 'Свернуть',
  price: 'Цена с доставкой',
  bands: { 'to-300k': 'до 300 тыс.', '300k-600k': '300–600 тыс.', '600k-1m': '600 тыс. – 1 млн', '1m-2m': '1–2 млн', 'from-2m': 'от 2 млн' } as Record<PriceBand, string>,
  size: 'Размер', sizeHint: 'Выберите обувь или одежду — появятся размеры, которые есть в магазинах.', sizeNote: 'По списку размеров магазина; наличие проверим при заказе.',
  special: 'Условия',
  duty: 'Без пошлины', dutyGuest: 'Цена товара до $200 — беспошлинный лимит на получателя в месяц.',
  dutyMember: (left: number, name: string) => `Цена товара не больше остатка лимита: ${usd(left)} для ${name}.`,
  sale: 'Со скидкой', saleHint: 'Магазин снизил цену относительно своей базовой.',
  fresh: 'Актуальная цена', freshHint: 'Цена подтверждена магазином недавно.',
  found: (count: number, total: number) => count === total ? `${count} ${plural(count, ['товар', 'товара', 'товаров'])}` : `Найдено ${count} из ${total}`,
  showing: (shown: number, total: number) => `Показано ${shown} из ${total}`, more: 'Показать ещё',
  emptyTitle: 'Ничего не нашлось', emptyHint: 'Уберите один из фильтров или закажите нужный товар по ссылке.',
  without: (label: string, count: number) => `Без «${label}» — ${count}`,
  endTitle: 'Не нашли нужное?', endText: (stores: number) => `Вставьте ссылку на товар из любого из ${stores} магазинов — посчитаем итог в сумах.`,
  endLink: 'Заказать по ссылке', endStores: 'Все магазины',
  allowanceLeft: (left: number, name: string, month: string) => `Без пошлины в ${month}: осталось ${usd(left)} из $200 для ${name}.`,
  allowanceSpent: (name: string, month: string) => `Беспошлинный лимит для ${name} в ${month} исчерпан: на новые заказы может начисляться пошлина.`,
  allowanceShow: 'Показать подходящие', allowanceHow: 'Как считается',
  parcelBanner: (stores: string) => `В корзине уже есть посылка из ${stores}. Товары этого магазина поедут вместе — доставка обойдётся дешевле.`,
  parcelShow: 'Показать эти товары',
  parcelLine: (store: string) => `С посылкой из ${store}`,
  parcelHint: (alone: string) => `Посчитано, как в корзине: одна посылка на магазин, минимум 1 кг. Отдельной посылкой — ${alone}.`,
  overLimit: 'Дороже лимита без пошлины', overLimitHint: 'Цена товара выше остатка беспошлинного лимита: при ввозе может начисляться пошлина.',
  loading: 'Загружаем каталог…',
  chip: { store: 'Магазин', price: 'Цена', size: 'Размер', search: 'Поиск', collection: 'Подборка', category: 'Категория' },
  remove: 'Убрать фильтр',
  categories: { 'Обувь': 'Обувь', 'Одежда': 'Одежда', 'Электроника': 'Электроника', 'Аксессуары': 'Аксессуары', 'Красота и уход': 'Красота и уход', 'Дом и быт': 'Дом и быт', 'Спорт': 'Спорт', 'Другое': 'Другое' } as Record<string, string>,
};
type Copy = typeof ru;

const uz: Copy = {
  title: 'Tovarlar katalogi',
  intro: 'Xorijiy do‘konlardagi tovarlar yakuniy narxi so‘mda: narx, xizmat va O‘zbekistongacha yetkazish. Buyurtma berganingizda Atlas narx va mavjudlikni tekshiradi.',
  stats: (products: number, stores: number) => `${stores} ta do‘kondan ${products} ta tovar`,
  teaserTitle: 'Tovarlar to‘plami',
  teaserIntro: 'Atlas tanlagan xorijiy do‘kon tovarlari. Kartadagi summa O‘zbekistonga yetkazish bilan.',
  viewAll: (count: number) => `Butun katalog (${count})`,
  teaserPrev: 'Oldingi tovarlar', teaserNext: 'Keyingi tovarlar',
  search: 'Katalogdan qidirish', searchPlaceholder: 'Tovar, brend yoki do‘kon', clearSearch: 'Qidiruvni tozalash',
  all: 'Barchasi', categoriesLabel: 'Toifalar', collections: 'To‘plamlar',
  filters: 'Filtrlar', filtersTitle: 'Filtrlar', show: (count: number) => count ? `${count} ta tovarni ko‘rsatish` : 'Hech narsa topilmadi',
  reset: 'Tozalash', resetAll: 'Hammasini tozalash', close: 'Yopish',
  sort: 'Saralash', sorts: { best: 'Tavsiya etamiz', cheap: 'Arzonroq', expensive: 'Qimmatroq', new: 'Yangilari' },
  store: 'Do‘kon', storesMore: (count: number) => `Yana ${count} ta`, storesLess: 'Yig‘ish',
  price: 'Yetkazish bilan narx',
  bands: { 'to-300k': '300 minggacha', '300k-600k': '300–600 ming', '600k-1m': '600 ming – 1 mln', '1m-2m': '1–2 mln', 'from-2m': '2 mln dan' },
  size: 'O‘lcham', sizeHint: 'Poyabzal yoki kiyimni tanlang — do‘konlardagi o‘lchamlar chiqadi.', sizeNote: 'Do‘kon o‘lchamlari ro‘yxati bo‘yicha; mavjudlikni buyurtmada tekshiramiz.',
  special: 'Shartlar',
  duty: 'Bojsiz', dutyGuest: 'Tovar narxi $200 gacha — qabul qiluvchiga oyiga bojsiz limit.',
  dutyMember: (left: number, name: string) => `Tovar narxi limit qoldig‘idan oshmaydi: ${name} uchun ${usd(left)}.`,
  sale: 'Chegirmali', saleHint: 'Do‘kon narxni o‘zining asosiy narxidan pasaytirgan.',
  fresh: 'Dolzarb narx', freshHint: 'Narx yaqinda do‘kon tomonidan tasdiqlangan.',
  found: (count: number, total: number) => count === total ? `${count} ta tovar` : `${total} tadan ${count} ta topildi`,
  showing: (shown: number, total: number) => `${total} tadan ${shown} ta ko‘rsatildi`, more: 'Yana ko‘rsatish',
  emptyTitle: 'Hech narsa topilmadi', emptyHint: 'Filtrlardan birini olib tashlang yoki kerakli tovarga havola orqali buyurtma bering.',
  without: (label: string, count: number) => `«${label}» filtrisiz — ${count}`,
  endTitle: 'Keraklisini topmadingizmi?', endText: (stores: number) => `${stores} ta do‘konning istalganidan tovar havolasini qo‘ying — yakuniy narxni so‘mda hisoblaymiz.`,
  endLink: 'Havola orqali buyurtma', endStores: 'Barcha do‘konlar',
  allowanceLeft: (left: number, name: string, month: string) => `${month} oyida bojsiz: ${name} uchun $200 dan ${usd(left)} qoldi.`,
  allowanceSpent: (name: string, month: string) => `${name} uchun ${month} oyidagi bojsiz limit tugadi: yangi buyurtmalarga boj hisoblanishi mumkin.`,
  allowanceShow: 'Mos tovarlarni ko‘rsatish', allowanceHow: 'Qanday hisoblanadi',
  parcelBanner: (stores: string) => `Savatda ${stores} posilkasi bor. Shu do‘kon tovarlari birga jo‘natiladi — yetkazish arzonroq bo‘ladi.`,
  parcelShow: 'Shu tovarlarni ko‘rsatish',
  parcelLine: (store: string) => `${store} posilkasi bilan`,
  parcelHint: (alone: string) => `Savatdagidek hisoblangan: har bir do‘konga bitta posilka, kamida 1 kg. Alohida posilkada — ${alone}.`,
  overLimit: 'Bojsiz limitdan qimmat', overLimitHint: 'Tovar narxi bojsiz limit qoldig‘idan yuqori: olib kirishda boj hisoblanishi mumkin.',
  loading: 'Katalog yuklanmoqda…',
  chip: { store: 'Do‘kon', price: 'Narx', size: 'O‘lcham', search: 'Qidiruv', collection: 'To‘plam', category: 'Toifa' },
  remove: 'Filtrni olib tashlash',
  categories: { 'Обувь': 'Poyabzal', 'Одежда': 'Kiyim', 'Электроника': 'Elektronika', 'Аксессуары': 'Aksessuarlar', 'Красота и уход': 'Go‘zallik va parvarish', 'Дом и быт': 'Uy va ro‘zg‘or', 'Спорт': 'Sport', 'Другое': 'Boshqa' },
};

const en: Copy = {
  title: 'Product catalog',
  intro: 'Products from international stores with the total in soum: price, service and delivery to Uzbekistan. Atlas checks the price and stock when you place the order.',
  stats: (products: number, stores: number) => `${products} ${products === 1 ? 'product' : 'products'} from ${stores} ${stores === 1 ? 'store' : 'stores'}`,
  teaserTitle: 'Product selection',
  teaserIntro: 'Products from international stores, selected by Atlas. The amount on each card already includes delivery to Uzbekistan.',
  viewAll: (count: number) => `Full catalog (${count})`,
  teaserPrev: 'Previous products', teaserNext: 'Next products',
  search: 'Search the catalog', searchPlaceholder: 'Product, brand or store', clearSearch: 'Clear search',
  all: 'All', categoriesLabel: 'Categories', collections: 'Collections',
  filters: 'Filters', filtersTitle: 'Filters', show: (count: number) => count ? `Show ${count} ${count === 1 ? 'product' : 'products'}` : 'No matches',
  reset: 'Clear', resetAll: 'Clear all', close: 'Close',
  sort: 'Sort', sorts: { best: 'Recommended', cheap: 'Lowest price', expensive: 'Highest price', new: 'Newest' },
  store: 'Store', storesMore: (count: number) => `${count} more`, storesLess: 'Show less',
  price: 'Price with delivery',
  bands: { 'to-300k': 'under 300k', '300k-600k': '300k–600k', '600k-1m': '600k–1m', '1m-2m': '1m–2m', 'from-2m': '2m and up' },
  size: 'Size', sizeHint: 'Choose shoes or clothing to see the sizes stores list.', sizeNote: 'Based on the store’s size list; stock is checked when you order.',
  special: 'Conditions',
  duty: 'Duty-free', dutyGuest: 'Product price up to $200 — the monthly duty-free allowance per recipient.',
  dutyMember: (left: number, name: string) => `Product price within the remaining allowance: ${usd(left)} for ${name}.`,
  sale: 'On sale', saleHint: 'The store lowered the price from its base price.',
  fresh: 'Current price', freshHint: 'The store confirmed the price recently.',
  found: (count: number, total: number) => count === total ? `${count} ${count === 1 ? 'product' : 'products'}` : `${count} of ${total} found`,
  showing: (shown: number, total: number) => `Showing ${shown} of ${total}`, more: 'Show more',
  emptyTitle: 'Nothing found', emptyHint: 'Remove a filter or order the product you need by link.',
  without: (label: string, count: number) => `Without “${label}” — ${count}`,
  endTitle: 'Didn’t find it?', endText: (stores: number) => `Paste a product link from any of ${stores} stores and we’ll show the total in soum.`,
  endLink: 'Order by link', endStores: 'All stores',
  allowanceLeft: (left: number, name: string, month: string) => `Duty-free in ${month}: ${usd(left)} of $200 left for ${name}.`,
  allowanceSpent: (name: string, month: string) => `The ${month} duty-free allowance for ${name} is used up: new orders may be charged duty.`,
  allowanceShow: 'Show what fits', allowanceHow: 'How it works',
  parcelBanner: (stores: string) => `Your cart already has a parcel from ${stores}. Products from that store ship together, so delivery costs less.`,
  parcelShow: 'Show these products',
  parcelLine: (store: string) => `With your ${store} parcel`,
  parcelHint: (alone: string) => `Priced like the cart: one parcel per store, at least 1 kg. As a separate parcel: ${alone}.`,
  overLimit: 'Above the duty-free allowance', overLimitHint: 'The product price is above the remaining duty-free allowance: duty may be charged on import.',
  loading: 'Loading the catalog…',
  chip: { store: 'Store', price: 'Price', size: 'Size', search: 'Search', collection: 'Collection', category: 'Category' },
  remove: 'Remove filter',
  categories: { 'Обувь': 'Shoes', 'Одежда': 'Clothing', 'Электроника': 'Electronics', 'Аксессуары': 'Accessories', 'Красота и уход': 'Beauty & care', 'Дом и быт': 'Home & living', 'Спорт': 'Sports', 'Другое': 'Other' },
};

function plural(count: number, [one, few, many]: [string, string, string]) {
  const tens = count % 100, units = count % 10;
  if (tens >= 11 && tens <= 14) return many;
  return units === 1 ? one : units >= 2 && units <= 4 ? few : many;
}

export const catalogCopy: Record<Locale, Copy> = { ru, uz, en };
/** Month in the form the allowance sentences need ("октябре", "oktabr", "October"). */
export function allowanceMonth(locale: Locale, now = Date.now()) {
  // Tashkent calendar, like the allowance itself (lib/market/allowance.ts monthOf), not the browser time zone.
  const month = Number(tashkentMonth(now).slice(5, 7)) - 1;
  if (locale === 'ru') return ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'][month];
  if (locale === 'uz') return ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'][month];
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month];
}
