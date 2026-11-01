import type { Locale } from './i18n.ts';
import { withCyrillic } from './uz-cyrl.ts';

/**
 * Words of the one product page (app/product-detail.tsx, app/global-link-order.tsx): the catalog sheet, /catalog/p/[id]
 * and /order-by-link once the product is in (redesign stage 5, 1 November 2026). Kept apart so the catalog chunk does not
 * carry the link page's long copy, and the other way round.
 */
export type ProductDetailCopy = {
  /** Under the big sum: what the sum covers. */
  toTashkent: string;
  /** Before a sum that is the cheapest option while none is chosen (Uzbek puts it after: `fromAfter`). */
  from: string;
  fromAfter: string;
  breakdown: string;
  item: string;
  service: string;
  serviceHelp: (fee: string) => string;
  delivery: (kg: string, speed: string) => string;
  storeShipping: string;
  guarantee: string;
  duty: string;
  /** Customs is paid at the border, not in this sum: said next to its estimate. */
  dutyApart: string;
  noDuty: (limit: string) => string;
  total: string;
  priceChecked: (date: string) => string;
  priceCheckedToday: (time: string) => string;
  priceCheckOnAdd: string;
  guaranteeTrust: string;
  days: (from: number, to: number) => string;
  about: string;
  deliveryTitle: string;
  noDescription: string;
  added: (units: number) => string;
  checkout: string;
  close: string;
  pricePending: string;
  /** A dated catalog card: the recorded price is shown as an estimate until the store is asked (one tap). */
  datedNote: (date: string) => string;
  checkPrice: string;
  approx: string;
};

export const productDetailCopy: Record<Locale, ProductDetailCopy> = /*@__PURE__*/withCyrillic({
  ru: {
    toTashkent: 'до Ташкента, всё включено',
    from: 'от',
    fromAfter: '',
    breakdown: 'Из чего сумма',
    item: 'Товар',
    service: 'Сервис Atlas',
    serviceHelp: fee => `Комиссия Atlas ${fee} от цены товара: выкуп, проверка и упаковка на складе.`,
    delivery: (kg, speed) => kg ? `Доставка по тарифу · ${kg} кг · ${speed}` : `Доставка по тарифу · ${speed}`,
    storeShipping: 'Доставка магазина до склада',
    guarantee: 'Гарантия сохранности',
    duty: 'Пошлина',
    dutyApart: 'оплачивается на таможне',
    noDuty: limit => `Без пошлины до ${limit} в месяц`,
    total: 'Итого',
    priceChecked: date => `Цена сверена ${date}`,
    priceCheckedToday: time => `Цена сверена сегодня в ${time}`,
    priceCheckOnAdd: 'Цену сверим с магазином при добавлении',
    guaranteeTrust: 'Гарантия сохранности',
    days: (from, to) => `${from}–${to} рабочих дней`,
    about: 'О товаре',
    deliveryTitle: 'Доставка',
    noDescription: 'Описание магазина откроется по ссылке на его страницу.',
    added: units => units > 1 ? `Добавлено в корзину: ${units} шт.` : 'Добавлено в корзину',
    checkout: 'Оформить',
    close: 'Закрыть',
    pricePending: 'уточняем…',
    datedNote: date => `Цена на ${date}. Сверим её и варианты с магазином — это несколько секунд.`,
    checkPrice: 'Сверить цену',
    approx: 'около',
  },
  uz: {
    toTashkent: 'Toshkentgacha, hammasi kiritilgan',
    from: '',
    fromAfter: 'dan',
    breakdown: 'Summa nimadan iborat',
    item: 'Tovar',
    service: 'Atlas xizmati',
    serviceHelp: fee => `Atlas komissiyasi tovar narxining ${fee}: xarid, tekshiruv va omborda qadoqlash.`,
    delivery: (kg, speed) => kg ? `Tarif bo‘yicha yetkazish · ${kg} kg · ${speed}` : `Tarif bo‘yicha yetkazish · ${speed}`,
    storeShipping: 'Do‘kondan omborgacha yetkazish',
    guarantee: 'Saqlash kafolati',
    duty: 'Boj',
    dutyApart: 'bojxonada to‘lanadi',
    noDuty: limit => `Oyiga ${limit} gacha bojsiz`,
    total: 'Jami',
    priceChecked: date => `Narx ${date} tekshirilgan`,
    priceCheckedToday: time => `Narx bugun ${time} da tekshirilgan`,
    priceCheckOnAdd: 'Qo‘shishda narxni do‘kon bilan tekshiramiz',
    guaranteeTrust: 'Saqlash kafolati',
    days: (from, to) => `${from}–${to} ish kuni`,
    about: 'Tovar haqida',
    deliveryTitle: 'Yetkazish',
    noDescription: 'Do‘kon tavsifi uning sahifasidagi havola orqali ochiladi.',
    added: units => units > 1 ? `Savatga qo‘shildi: ${units} dona` : 'Savatga qo‘shildi',
    checkout: 'Rasmiylashtirish',
    close: 'Yopish',
    pricePending: 'aniqlanmoqda…',
    datedNote: date => `Narx ${date} holatiga. Uni va variantlarni do‘kon bilan tekshiramiz — bir necha soniya.`,
    checkPrice: 'Narxni tekshirish',
    approx: 'taxminan',
  },
  en: {
    toTashkent: 'to Tashkent, all included',
    from: 'from',
    fromAfter: '',
    breakdown: 'What the sum is made of',
    item: 'Item',
    service: 'Atlas service',
    serviceHelp: fee => `Atlas fee, ${fee} of the item price: buying, checking and packing at the warehouse.`,
    delivery: (kg, speed) => kg ? `Delivery by tariff · ${kg} kg · ${speed}` : `Delivery by tariff · ${speed}`,
    storeShipping: 'Store delivery to the warehouse',
    guarantee: 'Safe-arrival guarantee',
    duty: 'Duty',
    dutyApart: 'paid at customs',
    noDuty: limit => `No duty up to ${limit} a month`,
    total: 'Total',
    priceChecked: date => `Price checked ${date}`,
    priceCheckedToday: time => `Price checked today at ${time}`,
    priceCheckOnAdd: 'We check the price with the store when you add it',
    guaranteeTrust: 'Safe-arrival guarantee',
    days: (from, to) => `${from}–${to} business days`,
    about: 'About the item',
    deliveryTitle: 'Delivery',
    noDescription: 'The store’s description is on its own page, linked below.',
    added: units => units > 1 ? `Added to cart: ${units} pcs` : 'Added to cart',
    checkout: 'Check out',
    close: 'Close',
    pricePending: 'checking…',
    datedNote: date => `Price as of ${date}. We’ll check it and the options with the store — a few seconds.`,
    checkPrice: 'Check the price',
    approx: 'about',
  },
});
