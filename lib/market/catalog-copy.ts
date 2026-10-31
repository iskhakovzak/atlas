import type { Locale } from './i18n.ts';
import { tashkentMonth } from './world.ts';
import { storeCountryNames } from './store-brands.ts';
import type { CatalogSort } from './catalog-query.ts';
import {withCyrillic,uzText} from './uz-cyrl.ts';
import {isUzbek} from './i18n.ts';

const usd = (value: number) => '$' + Math.max(0, Math.floor(value));
// `limit` in the allowance strings is the monthly duty-free allowance the page counts with (one source, never a literal).

const ru = {
  title: 'Каталог товаров',
  intro: 'Итог в сумах с доставкой до Ташкента; цену и наличие Atlas сверит с магазином при заказе.',
  stats: (products: number, stores: number) => `${products} ${plural(products, ['товар', 'товара', 'товаров'])} из ${stores} ${stores % 10 === 1 && stores % 100 !== 11 ? 'магазина' : 'магазинов'}`,
  teaserTitle: 'Подборка товаров',
  teaserIntro: 'Товары из зарубежных магазинов, отобранные Atlas. Сумма на карточке уже с доставкой в Ташкент.',
  viewAll: (count: number) => `Весь каталог (${count})`,
  viewAllShort: 'Весь каталог',
  // Compact banners: one line, the sentence opens on tap.
  bannerLimit: (left: number, limit: number) => `Без пошлины: осталось ${usd(left)} из ${usd(limit)}`,
  bannerLimitSpent: 'Беспошлинный лимит исчерпан',
  details: 'Подробнее', collapse: 'Свернуть',
  quickLabel: 'Быстрые фильтры', quickOff: (percent: number) => `−${percent} % и больше`, quickPrice: (max: number) => `До ${compactSum(max, 'ru')}`,
  // Card 2.0.
  storePrice: 'Цена магазина',
  storePriceOn: (date: string) => `Цена магазина · ${date}`,
  checkPrice: 'Уточнить цену',
  total: 'С доставкой в Ташкент', totalStale: 'С доставкой ≈', totalShort: 'До Ташкента', totalStaleShort: 'До Ташкента ≈', breakdown: 'Из чего сумма',
  afterCheck: 'Рассчитаем после проверки цены',
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
  search: 'Поиск по каталогу', searchPlaceholder: 'Товар, бренд или магазин', searchPlaceholderShort: 'Товар или бренд', clearSearch: 'Очистить поиск',
  all: 'Все', categoriesLabel: 'Категории', collections: 'Подборки', recentTitle: 'Вы смотрели', recentClear: 'Очистить',
  filters: 'Фильтры', filtersTitle: 'Фильтры', show: (count: number) => count ? `Показать ${count} ${plural(count, ['товар', 'товара', 'товаров'])}` : 'Ничего не найдено',
  reset: 'Сбросить', resetAll: 'Сбросить всё', close: 'Закрыть',
  sort: 'Сортировка', sorts: { best: 'Популярные', cheap: 'Дешевле', expensive: 'Дороже', discount: 'Больше скидка', new: 'Новые' } as Record<CatalogSort, string>,
  store: 'Магазин', storesMore: (count: number) => `Ещё ${count}`, storesLess: 'Свернуть', category: 'Категория', brand: 'Бренд',
  price: 'Цена с доставкой', priceFrom: 'от', priceTo: 'до', priceMinLabel: 'Цена с доставкой от, сум', priceMaxLabel: 'Цена с доставкой до, сум',
  priceChip: (min: number, max: number) => priceText(min, max, 'ru'),
  discount: 'Скидка', discountAny: 'Не важно', discountSome: 'Любая скидка', discountFrom: (percent: number) => `от ${percent} %`,
  size: 'Размер', sizeShoes: 'Обувь', sizeClothes: 'Одежда и аксессуары', sizeNote: 'По списку размеров магазина; выбранный размер Atlas сверит с магазином при добавлении в корзину.',
  stock: 'Размер в наличии', stockHint: 'Только товары, где выбранный размер магазин показывает в наличии сейчас.',
  selected: (count: number) => `выбрано: ${count}`,
  perPage: 'Показывать по', pages: 'Страницы каталога', prevPage: 'Предыдущая страница', nextPage: 'Следующая страница', page: (page: number) => `Страница ${page}`,
  range: (from: number, to: number, total: number) => `Показано ${from}–${to} из ${total}`,
  sizesCount: (count: number) => `${count} ${plural(count, ['размер', 'размера', 'размеров'])}`, colorsMore: (count: number) => `ещё ${count} ${plural(count, ['цвет', 'цвета', 'цветов'])}`, colors: 'Цвета', colorsCount: (count: number) => `${count} ${plural(count, ['цвет', 'цвета', 'цветов'])}`,
  special: 'Условия',
  duty: 'Без пошлины', dutyGuest: (limit: number) => `Цена товара до ${usd(limit)} — беспошлинный лимит на получателя в месяц.`,
  dutyMember: (left: number, name: string) => `Цена товара не больше остатка лимита: ${usd(left)} для ${name}.`,
  sale: 'Со скидкой',
  fresh: 'Актуальная цена', freshHint: 'Цена подтверждена магазином недавно.',
  found: (count: number, total: number) => count === total ? `${count} ${plural(count, ['товар', 'товара', 'товаров'])}` : `Найдено ${count} из ${total}`,
  catalogEmptyTitle: 'Каталог скоро пополнится', catalogEmptyHint: 'Пока закажите любой товар по ссылке из магазина — покажем итог в сумах с доставкой в Ташкент.',
  emptyTitle: 'Ничего не нашлось', emptyHint: 'Уберите один из фильтров или закажите нужный товар по ссылке.',
  without: (label: string, count: number) => `Без «${label}» — ${count}`,
  endTitle: 'Не нашли нужное?', endText: (stores: number) => `Вставьте ссылку на товар из любого из ${stores} магазинов — посчитаем итог в сумах.`,
  endLink: 'Заказать по ссылке', endStores: 'Все магазины', order: 'Заказать',
  addToCart: 'В корзину', choose: (name: string) => `Выбрать вариант и добавить в корзину: ${name}`, toTashkent: 'до Ташкента', priceOn: (date: string) => `на ${date}`,
  showMore: (count: number) => `Показать ещё ${count}`, shown: (count: number, total: number) => `Показано ${count} из ${total}`, storeOf: (store: string) => `Магазин: ${store}`,
  allowanceLeft: (left: number, name: string, month: string, limit: number) => `Без пошлины в ${month}: осталось ${usd(left)} из ${usd(limit)} для ${name}.`,
  allowanceSpent: (name: string, month: string) => `Беспошлинный лимит для ${name} в ${month} исчерпан: новые заказы облагаются пошлиной.`,
  allowanceShow: 'Показать подходящие', allowanceHow: 'Как считается',
  loading: 'Загружаем каталог…',
  chip: { store: 'Магазин', price: 'Цена', size: 'Размер', search: 'Поиск', collection: 'Подборка', category: 'Категория', discount: (percent: number) => percent > 1 ? `Скидка от ${percent} %` : 'Со скидкой' },
  remove: 'Убрать фильтр',
  categories: { 'Обувь': 'Обувь', 'Одежда': 'Одежда', 'Электроника': 'Электроника', 'Аксессуары': 'Аксессуары', 'Красота и уход': 'Красота и уход', 'Дом и быт': 'Дом и быт', 'Спорт': 'Спорт', 'Другое': 'Другое' } as Record<string, string>,
};
type Copy = typeof ru;

const uz: Copy = {
  title: 'Tovarlar katalogi',
  intro: 'Yakuniy narx so‘mda, Toshkentgacha yetkazish bilan; narx va mavjudlikni Atlas buyurtmada do‘kon bilan solishtiradi.',
  stats: (products: number, stores: number) => `${stores} ta do‘kondan ${products} ta tovar`,
  teaserTitle: 'Tovarlar to‘plami',
  teaserIntro: 'Atlas tanlagan xorijiy do‘kon tovarlari. Kartadagi summa Toshkentga yetkazish bilan.',
  viewAll: (count: number) => `Butun katalog (${count})`,
  viewAllShort: 'Butun katalog',
  bannerLimit: (left: number, limit: number) => `Bojsiz: ${usd(limit)} dan ${usd(left)} qoldi`,
  bannerLimitSpent: 'Bojsiz limit tugadi',
  details: 'Batafsil', collapse: 'Yig‘ish',
  quickLabel: 'Tezkor filtrlar', quickOff: (percent: number) => `−${percent} % va undan ko‘p`, quickPrice: (max: number) => uzJoin(compactSum(max, 'uz'), 'gacha'),
  storePrice: 'Do‘kon narxi',
  storePriceOn: (date: string) => `Do‘kon narxi · ${date}`,
  checkPrice: 'Narxni aniqlash',
  total: 'Toshkentga yetkazish bilan', totalStale: 'Yetkazish bilan ≈', totalShort: 'Toshkentgacha', totalStaleShort: 'Toshkentgacha ≈', breakdown: 'Summa nimadan iborat',
  afterCheck: 'Narx tekshirilgach hisoblaymiz',
  days: (from: number, to: number) => `${from}–${to} ish kuni`,
  kg: 'kg',
  factsHint: 'Muddat taxminiy',
  weightEstimate: 'og‘irlik — Atlas bahosi', weightStore: 'og‘irlik — do‘kon ma’lumoti',
  inCart: 'Savatda · ochish',
  open: (name: string) => `Ochish: ${name}`,
  staleNotice: (date: string) => `Narx va mavjudlik — do‘kon ma’lumoti, ${date}: Atlas ularni savatga qo‘shishda tekshiradi.`,
  speedNote: 'Tezlik rasmiylashtirishda butun savat uchun tanlanadi.',
  teaserPrev: 'Oldingi tovarlar', teaserNext: 'Keyingi tovarlar',
  search: 'Katalogdan qidirish', searchPlaceholder: 'Tovar, brend yoki do‘kon', searchPlaceholderShort: 'Tovar yoki brend', clearSearch: 'Qidiruvni tozalash',
  all: 'Barchasi', categoriesLabel: 'Toifalar', collections: 'To‘plamlar', recentTitle: 'Siz ko‘rgan tovarlar', recentClear: 'Tozalash',
  filters: 'Filtrlar', filtersTitle: 'Filtrlar', show: (count: number) => count ? `${count} ta tovarni ko‘rsatish` : 'Hech narsa topilmadi',
  reset: 'Tozalash', resetAll: 'Hammasini tozalash', close: 'Yopish',
  sort: 'Saralash', sorts: { best: 'Ommabop', cheap: 'Arzonroq', expensive: 'Qimmatroq', discount: 'Chegirma kattaroq', new: 'Yangilari' },
  store: 'Do‘kon', storesMore: (count: number) => `Yana ${count} ta`, storesLess: 'Yig‘ish', category: 'Toifa', brand: 'Brend',
  price: 'Yetkazish bilan narx', priceFrom: 'dan', priceTo: 'gacha', priceMinLabel: 'Yetkazish bilan eng kam narx, so‘m', priceMaxLabel: 'Yetkazish bilan eng yuqori narx, so‘m',
  priceChip: (min: number, max: number) => priceText(min, max, 'uz'),
  discount: 'Chegirma', discountAny: 'Farqi yo‘q', discountSome: 'Har qanday chegirma', discountFrom: (percent: number) => `${percent} % dan`,
  size: 'O‘lcham', sizeShoes: 'Poyabzal', sizeClothes: 'Kiyim va aksessuarlar', sizeNote: 'Do‘kon o‘lchamlari ro‘yxati bo‘yicha; tanlangan o‘lchamni Atlas savatga qo‘shishda do‘kon bilan solishtiradi.',
  stock: 'O‘lcham mavjud', stockHint: 'Faqat tanlangan o‘lcham do‘konda hozir mavjud bo‘lgan tovarlar.',
  selected: (count: number) => `tanlandi: ${count}`,
  perPage: 'Har sahifada', pages: 'Katalog sahifalari', prevPage: 'Oldingi sahifa', nextPage: 'Keyingi sahifa', page: (page: number) => `${page}-sahifa`,
  range: (from: number, to: number, total: number) => `${total} tadan ${from}–${to} ko‘rsatildi`,
  sizesCount: (count: number) => `${count} ta o‘lcham`, colorsMore: (count: number) => `yana ${count} ta rang`, colors: 'Ranglar', colorsCount: (count: number) => `${count} ta rang`,
  special: 'Shartlar',
  duty: 'Bojsiz', dutyGuest: (limit: number) => `Tovar narxi ${usd(limit)} gacha — qabul qiluvchiga oyiga bojsiz limit.`,
  dutyMember: (left: number, name: string) => `Tovar narxi limit qoldig‘idan oshmaydi: ${name} uchun ${usd(left)}.`,
  sale: 'Chegirmali',
  fresh: 'Dolzarb narx', freshHint: 'Narx yaqinda do‘kon tomonidan tasdiqlangan.',
  found: (count: number, total: number) => count === total ? `${count} ta tovar` : `${total} tadan ${count} ta topildi`,
  catalogEmptyTitle: 'Katalog tez orada to‘ldiriladi', catalogEmptyHint: 'Hozircha istalgan tovarga do‘kon havolasi orqali buyurtma bering — Toshkentgacha yetkazish bilan jami summani so‘mda ko‘rsatamiz.',
  emptyTitle: 'Hech narsa topilmadi', emptyHint: 'Filtrlardan birini olib tashlang yoki kerakli tovarga havola orqali buyurtma bering.',
  without: (label: string, count: number) => `«${label}» filtrisiz — ${count}`,
  endTitle: 'Keraklisini topmadingizmi?', endText: (stores: number) => `${stores} ta do‘konning istalganidan tovar havolasini qo‘ying — yakuniy narxni so‘mda hisoblaymiz.`,
  endLink: 'Havola orqali buyurtma', endStores: 'Barcha do‘konlar', order: 'Buyurtma berish',
  addToCart: 'Savatga', choose: (name: string) => `Variantni tanlab, savatga qo‘shish: ${name}`, toTashkent: 'Toshkentgacha', priceOn: (date: string) => `${date} holatiga`,
  showMore: (count: number) => `Yana ${count} ta ko‘rsatish`, shown: (count: number, total: number) => `${total} tadan ${count} tasi ko‘rsatildi`, storeOf: (store: string) => `Do‘kon: ${store}`,
  allowanceLeft: (left: number, name: string, month: string, limit: number) => `${month} oyida bojsiz: ${name} uchun ${usd(limit)} dan ${usd(left)} qoldi.`,
  allowanceSpent: (name: string, month: string) => `${name} uchun ${month} oyidagi bojsiz limit tugadi: yangi buyurtmalarga boj hisoblanadi.`,
  allowanceShow: 'Mos tovarlarni ko‘rsatish', allowanceHow: 'Qanday hisoblanadi',
  loading: 'Katalog yuklanmoqda…',
  chip: { store: 'Do‘kon', price: 'Narx', size: 'O‘lcham', search: 'Qidiruv', collection: 'To‘plam', category: 'Toifa', discount: (percent: number) => percent > 1 ? `${percent} % dan chegirma` : 'Chegirmali' },
  remove: 'Filtrni olib tashlash',
  categories: { 'Обувь': 'Poyabzal', 'Одежда': 'Kiyim', 'Электроника': 'Elektronika', 'Аксессуары': 'Aksessuarlar', 'Красота и уход': 'Go‘zallik va parvarish', 'Дом и быт': 'Uy va ro‘zg‘or', 'Спорт': 'Sport', 'Другое': 'Boshqa' },
};

const en: Copy = {
  title: 'Product catalog',
  intro: 'Totals in soum with delivery to Tashkent; Atlas checks the price and stock with the store when you order.',
  stats: (products: number, stores: number) => `${products} ${products === 1 ? 'product' : 'products'} from ${stores} ${stores === 1 ? 'store' : 'stores'}`,
  teaserTitle: 'Product selection',
  teaserIntro: 'Products from international stores, selected by Atlas. The amount on each card already includes delivery to Tashkent.',
  viewAll: (count: number) => `Full catalog (${count})`,
  viewAllShort: 'Full catalog',
  bannerLimit: (left: number, limit: number) => `Duty-free: ${usd(left)} of ${usd(limit)} left`,
  bannerLimitSpent: 'Duty-free allowance used up',
  details: 'Details', collapse: 'Collapse',
  quickLabel: 'Quick filters', quickOff: (percent: number) => `${percent}% off or more`, quickPrice: (max: number) => `Under ${compactSum(max, 'en')}`,
  storePrice: 'Store price',
  storePriceOn: (date: string) => `Store price · ${date}`,
  checkPrice: 'Check current price',
  total: 'With delivery to Tashkent', totalStale: 'With delivery ≈', totalShort: 'To Tashkent', totalStaleShort: 'To Tashkent ≈', breakdown: 'What’s in the total',
  afterCheck: 'Calculated after the price check',
  days: (from: number, to: number) => `${from}–${to} bus. days`,
  kg: 'kg',
  factsHint: 'Delivery time is approximate',
  weightEstimate: 'weight is an Atlas estimate', weightStore: 'weight as the store states it',
  inCart: 'In your cart · open',
  open: (name: string) => `Open: ${name}`,
  staleNotice: (date: string) => `Price and stock are the store’s data as of ${date}: Atlas checks them when you add the item to the cart.`,
  speedNote: 'The speed is chosen for the whole cart at checkout.',
  teaserPrev: 'Previous products', teaserNext: 'Next products',
  search: 'Search the catalog', searchPlaceholder: 'Product, brand or store', searchPlaceholderShort: 'Product or brand', clearSearch: 'Clear search',
  all: 'All', categoriesLabel: 'Categories', collections: 'Collections', recentTitle: 'Recently viewed', recentClear: 'Clear',
  filters: 'Filters', filtersTitle: 'Filters', show: (count: number) => count ? `Show ${count} ${count === 1 ? 'product' : 'products'}` : 'No matches',
  reset: 'Clear', resetAll: 'Clear all', close: 'Close',
  sort: 'Sort', sorts: { best: 'Popular', cheap: 'Lowest price', expensive: 'Highest price', discount: 'Biggest discount', new: 'Newest' },
  store: 'Store', storesMore: (count: number) => `${count} more`, storesLess: 'Show less', category: 'Category', brand: 'Brand',
  price: 'Price with delivery', priceFrom: 'from', priceTo: 'to', priceMinLabel: 'Lowest price with delivery, soum', priceMaxLabel: 'Highest price with delivery, soum',
  priceChip: (min: number, max: number) => priceText(min, max, 'en'),
  discount: 'Discount', discountAny: 'Any', discountSome: 'Any discount', discountFrom: (percent: number) => `${percent}% or more`,
  size: 'Size', sizeShoes: 'Shoes', sizeClothes: 'Clothing & accessories', sizeNote: 'Based on the store’s size list; Atlas checks the chosen size with the store when you add it to the cart.',
  stock: 'Size in stock', stockHint: 'Only products where the store lists the chosen size as available now.',
  selected: (count: number) => `${count} selected`,
  perPage: 'Per page', pages: 'Catalog pages', prevPage: 'Previous page', nextPage: 'Next page', page: (page: number) => `Page ${page}`,
  range: (from: number, to: number, total: number) => `Showing ${from}–${to} of ${total}`,
  sizesCount: (count: number) => `${count} ${count === 1 ? 'size' : 'sizes'}`, colorsMore: (count: number) => `${count} more ${count === 1 ? 'colour' : 'colours'}`, colors: 'Colours', colorsCount: (count: number) => `${count} ${count === 1 ? 'colour' : 'colours'}`,
  special: 'Conditions',
  duty: 'Duty-free', dutyGuest: (limit: number) => `Product price up to ${usd(limit)} — the monthly duty-free allowance per recipient.`,
  dutyMember: (left: number, name: string) => `Product price within the remaining allowance: ${usd(left)} for ${name}.`,
  sale: 'On sale',
  fresh: 'Current price', freshHint: 'The store confirmed the price recently.',
  found: (count: number, total: number) => count === total ? `${count} ${count === 1 ? 'product' : 'products'}` : `${count} of ${total} found`,
  catalogEmptyTitle: 'The catalog is being filled', catalogEmptyHint: 'For now, order any product by its store link and we’ll show the total in soum with delivery to Tashkent.',
  emptyTitle: 'Nothing found', emptyHint: 'Remove a filter or order the product you need by link.',
  without: (label: string, count: number) => `Without “${label}” — ${count}`,
  endTitle: 'Didn’t find it?', endText: (stores: number) => `Paste a product link from any of ${stores} stores and we’ll show the total in soum.`,
  endLink: 'Order by link', endStores: 'All stores', order: 'Order',
  addToCart: 'Add to cart', choose: (name: string) => `Choose options and add to cart: ${name}`, toTashkent: 'to Tashkent', priceOn: (date: string) => `as of ${date}`,
  showMore: (count: number) => `Show ${count} more`, shown: (count: number, total: number) => `Showing ${count} of ${total}`, storeOf: (store: string) => `Store: ${store}`,
  allowanceLeft: (left: number, name: string, month: string, limit: number) => `Duty-free in ${month}: ${usd(left)} of ${usd(limit)} left for ${name}.`,
  allowanceSpent: (name: string, month: string) => `The ${month} duty-free allowance for ${name} is used up: new orders are subject to duty.`,
  allowanceShow: 'Show what fits', allowanceHow: 'How it works',
  loading: 'Loading the catalog…',
  chip: { store: 'Store', price: 'Price', size: 'Size', search: 'Search', collection: 'Collection', category: 'Category', discount: (percent: number) => percent > 1 ? `${percent}% off or more` : 'On sale' },
  remove: 'Remove filter',
  categories: { 'Обувь': 'Shoes', 'Одежда': 'Clothing', 'Электроника': 'Electronics', 'Аксессуары': 'Accessories', 'Красота и уход': 'Beauty & care', 'Дом и быт': 'Home & living', 'Спорт': 'Sports', 'Другое': 'Other' },
};

/** "300 тыс.", "1,2 млн", "300 ming", "300k": a delivered-total bound as a chip prints it. */
export function compactSum(value: number, locale: 'ru' | 'uz' | 'en') {
  // Decided after rounding: 999 600 is "1 млн", not "1000 тыс.".
  const million = value >= 999_500;
  const amount = million ? Math.round(value / 100_000) / 10 : Math.round(value / 1000);
  const text = locale === 'en' ? String(amount) : String(amount).replace('.', ',');
  if (locale === 'ru') return `${text} ${million ? 'млн' : 'тыс.'}`;
  if (locale === 'uz') return `${text} ${million ? 'mln' : 'ming'}`;
  return `${text}${million ? 'm' : 'k'}`;
}
const uzJoin = (amount: string, suffix: string) => amount.endsWith('ming') ? amount + suffix : amount + ' ' + suffix;
function priceText(min: number, max: number, locale: 'ru' | 'uz' | 'en') {
  const [from, to] = [compactSum(min, locale), compactSum(max, locale)];
  if (min && max) return `${from} – ${to}`;
  if (max) return locale === 'ru' ? `до ${to}` : locale === 'uz' ? uzJoin(to, 'gacha') : `under ${to}`;
  return locale === 'ru' ? `от ${from}` : locale === 'uz' ? uzJoin(from, 'dan') : `${from} and up`;
}

function plural(count: number, [one, few, many]: [string, string, string]) {
  const tens = count % 100, units = count % 10;
  if (tens >= 11 && tens <= 14) return many;
  return units === 1 ? one : units >= 2 && units <= 4 ? few : many;
}

export const catalogCopy: Record<Locale, Copy> = /*@__PURE__*/withCyrillic({ ru, uz, en });

/**
 * Product.country labels are Russian; the storefront names the country in the customer's language.
 * The names come from the store directory (all 32 store countries), plus the tariff countries it lacks.
 */
const extraCountryNames: Record<string, Record<Locale, string>> = { 'Румыния': /*@__PURE__*/withCyrillic({ ru: 'Румыния', uz: 'Ruminiya', en: 'Romania' }) };
const countryByRussianName = new Map<string, Record<Locale, string>>([
  ...Object.values(storeCountryNames).map((names) => [names.ru, names] as const),
  ...Object.entries(extraCountryNames).map(([ru, names]) => [ru, names] as const),
]);
export function countryLabel(country: string | undefined, locale: Locale) {
  if (!country) return '';
  return countryByRussianName.get(country)?.[locale] ?? country;
}

/** "13 сен", "13-sen", "13 Sept": the day a store price was recorded, as a card prints it. */
const uzShortMonths = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'];

export function shortDate(time: number, locale: Locale) {
  if (!Number.isFinite(time) || time <= 0) return '';
  // Browsers often ship without Uzbek month names and print "M09 13": Uzbek uses its own short months.
  if (isUzbek(locale)) {
    const date = new Date(time + 5 * 3_600_000);
    return uzText(locale, `${date.getUTCDate()}-${uzShortMonths[date.getUTCMonth()]}`);
  }
  try {
    const text = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Tashkent' }).format(time);
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
  if (isUzbek(locale)) return uzText(locale, ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'][month]);
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month];
}
