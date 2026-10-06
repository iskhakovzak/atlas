import type { Locale } from './i18n.ts';
import { tashkentMonth } from './world.ts';
import { storeCountryNames } from './store-brands.ts';
import type { CatalogSort, PriceBand } from './catalog-query.ts';

const usd = (value: number) => '$' + Math.max(0, Math.floor(value));
// `limit` in the allowance strings is the monthly duty-free allowance the page counts with (one source, never a literal).

const ru = {
  title: 'Каталог товаров',
  intro: 'Итог в сумах с доставкой до Узбекистана; цену и наличие Atlas сверит с магазином при заказе.',
  stats: (products: number, stores: number) => `${products} ${plural(products, ['товар', 'товара', 'товаров'])} из ${stores} ${stores % 10 === 1 && stores % 100 !== 11 ? 'магазина' : 'магазинов'}`,
  teaserTitle: 'Подборка товаров',
  teaserIntro: 'Товары из зарубежных магазинов, отобранные Atlas. Сумма на карточке уже с доставкой в Узбекистан.',
  viewAll: (count: number) => `Весь каталог (${count})`,
  viewAllShort: 'Весь каталог',
  // Compact banners: one line, the sentence opens on tap.
  bannerLimit: (left: number, limit: number) => `Без пошлины: осталось ${usd(left)} из ${usd(limit)}`,
  bannerLimitSpent: 'Беспошлинный лимит исчерпан',
  bannerParcel: (stores: string) => `Посылка из ${stores} уже в корзине`,
  details: 'Подробнее', collapse: 'Свернуть',
  // Sets strip: the operator's collections first, then presets on the existing filters.
  sets: { limit: (limit: number) => `В лимите ${usd(limit)}`, cheap: 'До 300 тыс. сум', sale: 'Со скидкой', new: 'Новое', from: (store: string) => `Из ${store}` },
  setCount: (count: number) => `${count} ${plural(count, ['товар', 'товара', 'товаров'])}`,
  // Card 2.0.
  storePrice: 'Цена магазина',
  storePriceOn: (date: string) => `Цена магазина · ${date}`,
  checkPrice: 'Уточнить цену',
  total: 'С доставкой в Узбекистан', totalStale: 'С доставкой ≈', breakdown: 'Из чего сумма',
  afterCheck: 'Рассчитаем после проверки цены',
  confirmedBy: (date: string) => `наличие подтверждено оператором ${date}`,
  days: (from: number, to: number) => `${from}–${to} раб. дн`,
  kg: 'кг',
  factsHint: 'Срок ориентировочный',
  weightEstimate: 'вес — оценка Atlas', weightStore: 'вес — по данным магазина',
  inCart: 'В корзине · открыть',
  open: (name: string) => `Открыть: ${name}`,
  // Product sheet.
  staleNotice: (date: string) => `Цена и наличие по данным магазина на ${date}: Atlas сверит их при добавлении в корзину.`,
  speedNote: 'Скорость выбирается для всей корзины при оформлении.',
  teaserPrev: 'Предыдущие товары', teaserNext: 'Следующие товары',
  search: 'Поиск по каталогу', searchPlaceholder: 'Товар, бренд или магазин', clearSearch: 'Очистить поиск',
  all: 'Все', categoriesLabel: 'Категории', collections: 'Подборки',
  filters: 'Фильтры', filtersTitle: 'Фильтры', show: (count: number) => count ? `Показать ${count} ${plural(count, ['товар', 'товара', 'товаров'])}` : 'Ничего не найдено',
  reset: 'Сбросить', resetAll: 'Сбросить всё', close: 'Закрыть',
  sort: 'Сортировка', sorts: { best: 'Рекомендуем', cheap: 'Дешевле', expensive: 'Дороже', new: 'Новые' } as Record<CatalogSort, string>,
  store: 'Магазин', storesMore: (count: number) => `Ещё ${count}`, storesLess: 'Свернуть',
  price: 'Цена с доставкой',
  bands: { 'to-300k': 'до 300 тыс.', '300k-600k': '300–600 тыс.', '600k-1m': '600 тыс. – 1 млн', '1m-2m': '1–2 млн', 'from-2m': 'от 2 млн' } as Record<PriceBand, string>,
  size: 'Размер', sizeHint: 'Выберите обувь или одежду — появятся размеры, которые есть в магазинах.', sizeNote: 'По списку размеров магазина; выбранный размер Atlas сверит с магазином при добавлении в корзину.',
  special: 'Условия',
  duty: 'Без пошлины', dutyGuest: (limit: number) => `Цена товара до ${usd(limit)} — беспошлинный лимит на получателя в месяц.`,
  dutyMember: (left: number, name: string) => `Цена товара не больше остатка лимита: ${usd(left)} для ${name}.`,
  sale: 'Со скидкой', saleHint: 'Магазин снизил цену относительно своей базовой.',
  fresh: 'Актуальная цена', freshHint: 'Цена подтверждена магазином недавно.',
  found: (count: number, total: number) => count === total ? `${count} ${plural(count, ['товар', 'товара', 'товаров'])}` : `Найдено ${count} из ${total}`,
  showing: (shown: number, total: number) => `Показано ${shown} из ${total}`, more: 'Показать ещё',
  emptyTitle: 'Ничего не нашлось', emptyHint: 'Уберите один из фильтров или закажите нужный товар по ссылке.',
  without: (label: string, count: number) => `Без «${label}» — ${count}`,
  endTitle: 'Не нашли нужное?', endText: (stores: number) => `Вставьте ссылку на товар из любого из ${stores} магазинов — посчитаем итог в сумах.`,
  endLink: 'Заказать по ссылке', endStores: 'Все магазины',
  allowanceLeft: (left: number, name: string, month: string, limit: number) => `Без пошлины в ${month}: осталось ${usd(left)} из ${usd(limit)} для ${name}.`,
  allowanceSpent: (name: string, month: string) => `Беспошлинный лимит для ${name} в ${month} исчерпан: новые заказы облагаются пошлиной.`,
  allowanceShow: 'Показать подходящие', allowanceHow: 'Как считается',
  parcelBanner: (stores: string) => `В корзине уже есть посылка из ${stores}. Товары этого магазина поедут вместе — доставка обойдётся дешевле.`,
  parcelShow: 'Показать эти товары',
  loading: 'Загружаем каталог…',
  chip: { store: 'Магазин', price: 'Цена', size: 'Размер', search: 'Поиск', collection: 'Подборка', category: 'Категория' },
  remove: 'Убрать фильтр',
  categories: { 'Обувь': 'Обувь', 'Одежда': 'Одежда', 'Электроника': 'Электроника', 'Аксессуары': 'Аксессуары', 'Красота и уход': 'Красота и уход', 'Дом и быт': 'Дом и быт', 'Спорт': 'Спорт', 'Другое': 'Другое' } as Record<string, string>,
};
type Copy = typeof ru;

const uz: Copy = {
  title: 'Tovarlar katalogi',
  intro: 'Yakuniy narx so‘mda, O‘zbekistongacha yetkazish bilan; narx va mavjudlikni Atlas buyurtmada do‘kon bilan solishtiradi.',
  stats: (products: number, stores: number) => `${stores} ta do‘kondan ${products} ta tovar`,
  teaserTitle: 'Tovarlar to‘plami',
  teaserIntro: 'Atlas tanlagan xorijiy do‘kon tovarlari. Kartadagi summa O‘zbekistonga yetkazish bilan.',
  viewAll: (count: number) => `Butun katalog (${count})`,
  viewAllShort: 'Butun katalog',
  bannerLimit: (left: number, limit: number) => `Bojsiz: ${usd(limit)} dan ${usd(left)} qoldi`,
  bannerLimitSpent: 'Bojsiz limit tugadi',
  bannerParcel: (stores: string) => `${stores} posilkasi savatda bor`,
  details: 'Batafsil', collapse: 'Yig‘ish',
  sets: { limit: (limit: number) => `${usd(limit)} limit ichida`, cheap: '300 minggacha', sale: 'Chegirmali', new: 'Yangi', from: (store: string) => `${store} dan` },
  setCount: (count: number) => `${count} ta tovar`,
  storePrice: 'Do‘kon narxi',
  storePriceOn: (date: string) => `Do‘kon narxi · ${date}`,
  checkPrice: 'Narxni aniqlash',
  total: 'O‘zbekistonga yetkazish bilan', totalStale: 'Yetkazish bilan ≈', breakdown: 'Summa nimadan iborat',
  afterCheck: 'Narx tekshirilgach hisoblaymiz',
  confirmedBy: (date: string) => `mavjudligini operator tasdiqladi, ${date}`,
  days: (from: number, to: number) => `${from}–${to} ish kuni`,
  kg: 'kg',
  factsHint: 'Muddat taxminiy',
  weightEstimate: 'og‘irlik — Atlas bahosi', weightStore: 'og‘irlik — do‘kon ma’lumoti',
  inCart: 'Savatda · ochish',
  open: (name: string) => `Ochish: ${name}`,
  staleNotice: (date: string) => `Narx va mavjudlik — do‘kon ma’lumoti, ${date}: Atlas ularni savatga qo‘shishda tekshiradi.`,
  speedNote: 'Tezlik rasmiylashtirishda butun savat uchun tanlanadi.',
  teaserPrev: 'Oldingi tovarlar', teaserNext: 'Keyingi tovarlar',
  search: 'Katalogdan qidirish', searchPlaceholder: 'Tovar, brend yoki do‘kon', clearSearch: 'Qidiruvni tozalash',
  all: 'Barchasi', categoriesLabel: 'Toifalar', collections: 'To‘plamlar',
  filters: 'Filtrlar', filtersTitle: 'Filtrlar', show: (count: number) => count ? `${count} ta tovarni ko‘rsatish` : 'Hech narsa topilmadi',
  reset: 'Tozalash', resetAll: 'Hammasini tozalash', close: 'Yopish',
  sort: 'Saralash', sorts: { best: 'Tavsiya etamiz', cheap: 'Arzonroq', expensive: 'Qimmatroq', new: 'Yangilari' },
  store: 'Do‘kon', storesMore: (count: number) => `Yana ${count} ta`, storesLess: 'Yig‘ish',
  price: 'Yetkazish bilan narx',
  bands: { 'to-300k': '300 minggacha', '300k-600k': '300–600 ming', '600k-1m': '600 ming – 1 mln', '1m-2m': '1–2 mln', 'from-2m': '2 mln dan' },
  size: 'O‘lcham', sizeHint: 'Poyabzal yoki kiyimni tanlang — do‘konlardagi o‘lchamlar chiqadi.', sizeNote: 'Do‘kon o‘lchamlari ro‘yxati bo‘yicha; tanlangan o‘lchamni Atlas savatga qo‘shishda do‘kon bilan solishtiradi.',
  special: 'Shartlar',
  duty: 'Bojsiz', dutyGuest: (limit: number) => `Tovar narxi ${usd(limit)} gacha — qabul qiluvchiga oyiga bojsiz limit.`,
  dutyMember: (left: number, name: string) => `Tovar narxi limit qoldig‘idan oshmaydi: ${name} uchun ${usd(left)}.`,
  sale: 'Chegirmali', saleHint: 'Do‘kon narxni o‘zining asosiy narxidan pasaytirgan.',
  fresh: 'Dolzarb narx', freshHint: 'Narx yaqinda do‘kon tomonidan tasdiqlangan.',
  found: (count: number, total: number) => count === total ? `${count} ta tovar` : `${total} tadan ${count} ta topildi`,
  showing: (shown: number, total: number) => `${total} tadan ${shown} ta ko‘rsatildi`, more: 'Yana ko‘rsatish',
  emptyTitle: 'Hech narsa topilmadi', emptyHint: 'Filtrlardan birini olib tashlang yoki kerakli tovarga havola orqali buyurtma bering.',
  without: (label: string, count: number) => `«${label}» filtrisiz — ${count}`,
  endTitle: 'Keraklisini topmadingizmi?', endText: (stores: number) => `${stores} ta do‘konning istalganidan tovar havolasini qo‘ying — yakuniy narxni so‘mda hisoblaymiz.`,
  endLink: 'Havola orqali buyurtma', endStores: 'Barcha do‘konlar',
  allowanceLeft: (left: number, name: string, month: string, limit: number) => `${month} oyida bojsiz: ${name} uchun ${usd(limit)} dan ${usd(left)} qoldi.`,
  allowanceSpent: (name: string, month: string) => `${name} uchun ${month} oyidagi bojsiz limit tugadi: yangi buyurtmalarga boj hisoblanadi.`,
  allowanceShow: 'Mos tovarlarni ko‘rsatish', allowanceHow: 'Qanday hisoblanadi',
  parcelBanner: (stores: string) => `Savatda ${stores} posilkasi bor. Shu do‘kon tovarlari birga jo‘natiladi — yetkazish arzonroq bo‘ladi.`,
  parcelShow: 'Shu tovarlarni ko‘rsatish',
  loading: 'Katalog yuklanmoqda…',
  chip: { store: 'Do‘kon', price: 'Narx', size: 'O‘lcham', search: 'Qidiruv', collection: 'To‘plam', category: 'Toifa' },
  remove: 'Filtrni olib tashlash',
  categories: { 'Обувь': 'Poyabzal', 'Одежда': 'Kiyim', 'Электроника': 'Elektronika', 'Аксессуары': 'Aksessuarlar', 'Красота и уход': 'Go‘zallik va parvarish', 'Дом и быт': 'Uy va ro‘zg‘or', 'Спорт': 'Sport', 'Другое': 'Boshqa' },
};

const en: Copy = {
  title: 'Product catalog',
  intro: 'Totals in soum with delivery to Uzbekistan; Atlas checks the price and stock with the store when you order.',
  stats: (products: number, stores: number) => `${products} ${products === 1 ? 'product' : 'products'} from ${stores} ${stores === 1 ? 'store' : 'stores'}`,
  teaserTitle: 'Product selection',
  teaserIntro: 'Products from international stores, selected by Atlas. The amount on each card already includes delivery to Uzbekistan.',
  viewAll: (count: number) => `Full catalog (${count})`,
  viewAllShort: 'Full catalog',
  bannerLimit: (left: number, limit: number) => `Duty-free: ${usd(left)} of ${usd(limit)} left`,
  bannerLimitSpent: 'Duty-free allowance used up',
  bannerParcel: (stores: string) => `A ${stores} parcel is already in your cart`,
  details: 'Details', collapse: 'Collapse',
  sets: { limit: (limit: number) => `Within the ${usd(limit)} allowance`, cheap: 'Under 300k soum', sale: 'On sale', new: 'New', from: (store: string) => `From ${store}` },
  setCount: (count: number) => `${count} ${count === 1 ? 'product' : 'products'}`,
  storePrice: 'Store price',
  storePriceOn: (date: string) => `Store price · ${date}`,
  checkPrice: 'Check current price',
  total: 'With delivery to Uzbekistan', totalStale: 'With delivery ≈', breakdown: 'What’s in the total',
  afterCheck: 'Calculated after the price check',
  confirmedBy: (date: string) => `stock confirmed by an operator on ${date}`,
  days: (from: number, to: number) => `${from}–${to} bus. days`,
  kg: 'kg',
  factsHint: 'Delivery time is approximate',
  weightEstimate: 'weight is an Atlas estimate', weightStore: 'weight as the store states it',
  inCart: 'In your cart · open',
  open: (name: string) => `Open: ${name}`,
  staleNotice: (date: string) => `Price and stock are the store’s data as of ${date}: Atlas checks them when you add the item to the cart.`,
  speedNote: 'The speed is chosen for the whole cart at checkout.',
  teaserPrev: 'Previous products', teaserNext: 'Next products',
  search: 'Search the catalog', searchPlaceholder: 'Product, brand or store', clearSearch: 'Clear search',
  all: 'All', categoriesLabel: 'Categories', collections: 'Collections',
  filters: 'Filters', filtersTitle: 'Filters', show: (count: number) => count ? `Show ${count} ${count === 1 ? 'product' : 'products'}` : 'No matches',
  reset: 'Clear', resetAll: 'Clear all', close: 'Close',
  sort: 'Sort', sorts: { best: 'Recommended', cheap: 'Lowest price', expensive: 'Highest price', new: 'Newest' },
  store: 'Store', storesMore: (count: number) => `${count} more`, storesLess: 'Show less',
  price: 'Price with delivery',
  bands: { 'to-300k': 'under 300k', '300k-600k': '300k–600k', '600k-1m': '600k–1m', '1m-2m': '1m–2m', 'from-2m': '2m and up' },
  size: 'Size', sizeHint: 'Choose shoes or clothing to see the sizes stores list.', sizeNote: 'Based on the store’s size list; Atlas checks the chosen size with the store when you add it to the cart.',
  special: 'Conditions',
  duty: 'Duty-free', dutyGuest: (limit: number) => `Product price up to ${usd(limit)} — the monthly duty-free allowance per recipient.`,
  dutyMember: (left: number, name: string) => `Product price within the remaining allowance: ${usd(left)} for ${name}.`,
  sale: 'On sale', saleHint: 'The store lowered the price from its base price.',
  fresh: 'Current price', freshHint: 'The store confirmed the price recently.',
  found: (count: number, total: number) => count === total ? `${count} ${count === 1 ? 'product' : 'products'}` : `${count} of ${total} found`,
  showing: (shown: number, total: number) => `Showing ${shown} of ${total}`, more: 'Show more',
  emptyTitle: 'Nothing found', emptyHint: 'Remove a filter or order the product you need by link.',
  without: (label: string, count: number) => `Without “${label}” — ${count}`,
  endTitle: 'Didn’t find it?', endText: (stores: number) => `Paste a product link from any of ${stores} stores and we’ll show the total in soum.`,
  endLink: 'Order by link', endStores: 'All stores',
  allowanceLeft: (left: number, name: string, month: string, limit: number) => `Duty-free in ${month}: ${usd(left)} of ${usd(limit)} left for ${name}.`,
  allowanceSpent: (name: string, month: string) => `The ${month} duty-free allowance for ${name} is used up: new orders are subject to duty.`,
  allowanceShow: 'Show what fits', allowanceHow: 'How it works',
  parcelBanner: (stores: string) => `Your cart already has a parcel from ${stores}. Products from that store ship together, so delivery costs less.`,
  parcelShow: 'Show these products',
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

/**
 * Product.country labels are Russian; the storefront names the country in the customer's language.
 * The names come from the store directory (all 32 store countries), plus the tariff countries it lacks.
 */
const extraCountryNames: Record<string, Record<Locale, string>> = { 'Румыния': { ru: 'Румыния', uz: 'Ruminiya', en: 'Romania' } };
const countryByRussianName = new Map<string, Record<Locale, string>>([
  ...Object.values(storeCountryNames).map((names) => [names.ru, names] as const),
  ...Object.entries(extraCountryNames).map(([ru, names]) => [ru, names] as const),
]);
export function countryLabel(country: string | undefined, locale: Locale) {
  if (!country) return '';
  return countryByRussianName.get(country)?.[locale] ?? country;
}

/** "13 сен", "13-sen", "13 Sept": the day a store price was recorded, as a card prints it. */
export function shortDate(time: number, locale: Locale) {
  if (!Number.isFinite(time) || time <= 0) return '';
  try {
    const text = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : locale === 'uz' ? 'uz-UZ' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Tashkent' }).format(time);
    return text.replace(/\.$/, '');
  } catch {
    const date = new Date(time + 5 * 3_600_000);
    return `${date.getUTCDate()}.${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}
/** Month in the form the allowance sentences need ("октябре", "oktabr", "October"). */
export function allowanceMonth(locale: Locale, now = Date.now()) {
  // Tashkent calendar, like the allowance itself (lib/market/allowance.ts monthOf), not the browser time zone.
  const month = Number(tashkentMonth(now).slice(5, 7)) - 1;
  if (locale === 'ru') return ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'][month];
  if (locale === 'uz') return ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'][month];
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month];
}
