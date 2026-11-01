import type { Locale } from './i18n.ts';
import { withCyrillic } from './uz-cyrl.ts';

// The delivery page (/delivery, redesign stage 8, 1 November 2026): rates per dispatch country, the duty-free limit and a
// weight calculator. Every number on it comes from the tariff (lib/market/home-facts.ts tariffRows), never from this copy.

function ruPlural(count: number, [one, few, many]: [string, string, string]) {
  const tens = count % 100, units = count % 10;
  if (tens >= 11 && tens <= 14) return many;
  return units === 1 ? one : units >= 2 && units <= 4 ? few : many;
}

const ru = {
  title: 'Доставка в Ташкент',
  lead: 'Из каждой страны — своя цена за килограмм и свой срок. Скорость выбираете при оформлении: экспресс или обычная.',
  countriesTitle: 'Откуда везём',
  stores: (count: number) => `${count} ${ruPlural(count, ['магазин', 'магазина', 'магазинов'])}`,
  storesLink: 'Магазины страны',
  perKg: '/кг',
  pending: 'срок уточняется',
  days: (min: number, max: number) => `${min}–${max} раб. дней`,
  limitTitle: (limit: string) => `Без пошлины до ${limit} в месяц`,
  limitText: (limit: string) => `Лимит считается на каждого получателя за календарный месяц. Сверх ${limit} — таможенный платёж; его сумму покажем в корзине до оплаты.`,
  limitLink: 'Как считается пошлина',
  weightTitle: 'Как считаем вес',
  weightRules: [
    'Вес берём с коробкой магазина.',
    'Добавляем 0,3 кг на упаковку — один раз на посылку.',
    'Минимум 1 кг на посылку из одного магазина: товары одного магазина едут вместе.',
  ],
  calcTitle: 'Калькулятор доставки',
  calcLead: 'Сколько стоит доставка от склада за рубежом до Ташкента. Цена товара и Сервис Atlas — в расчёте по ссылке.',
  calcCountry: 'Страна магазина',
  calcWeight: 'Вес с коробкой, кг',
  calcWeightHint: 'Например, кроссовки в коробке — около 1,2 кг.',
  calcSpeed: 'Скорость',
  calcBilled: (kg: string) => `К оплате ${kg} кг`,
  calcBilledNote: 'с упаковкой, не меньше 1 кг',
  calcTotal: 'Доставка до Ташкента',
  calcSum: (sum: string) => `≈ ${sum} по курсу Atlas`,
  calcInvalid: 'Введите вес от 0,01 до 50 кг.',
  calcCta: 'Рассчитать товар по ссылке',
  courierTitle: 'По Ташкенту',
  note: 'Текущие тарифы Atlas, не оферта. Сроки ориентировочные, в рабочих днях от склада за рубежом; курс Atlas — на день расчёта.',
};
type DeliveryCopy = typeof ru;

const uz: DeliveryCopy = {
  title: 'Toshkentga yetkazib berish',
  lead: 'Har bir mamlakatdan — kilogramm uchun o‘z narxi va o‘z muddati. Tezlikni rasmiylashtirishda tanlaysiz: ekspress yoki oddiy.',
  countriesTitle: 'Qayerdan olib kelamiz',
  stores: (count: number) => `${count} ta do‘kon`,
  storesLink: 'Mamlakat do‘konlari',
  perKg: '/kg',
  pending: 'muddat aniqlanadi',
  days: (min: number, max: number) => `${min}–${max} ish kuni`,
  limitTitle: (limit: string) => `Oyiga ${limit} gacha bojsiz`,
  limitText: (limit: string) => `Limit har bir qabul qiluvchiga kalendar oyi uchun hisoblanadi. ${limit} dan oshgan qismiga bojxona to‘lovi olinadi; uning summasini to‘lovdan oldin savatda ko‘rsatamiz.`,
  limitLink: 'Boj qanday hisoblanadi',
  weightTitle: 'Og‘irlikni qanday hisoblaymiz',
  weightRules: [
    'Og‘irlik do‘kon qutisi bilan olinadi.',
    'Qadoq uchun 0,3 kg qo‘shamiz — posilkaga bir marta.',
    'Bitta do‘kondan posilkaga kamida 1 kg: bir do‘kon tovarlari birga keladi.',
  ],
  calcTitle: 'Yetkazish kalkulyatori',
  calcLead: 'Xorijdagi ombordan Toshkentgacha yetkazish qancha turadi. Tovar narxi va Atlas xizmati — havola bo‘yicha hisobda.',
  calcCountry: 'Do‘kon mamlakati',
  calcWeight: 'Quti bilan og‘irlik, kg',
  calcWeightHint: 'Masalan, qutidagi krossovka — taxminan 1,2 kg.',
  calcSpeed: 'Tezlik',
  calcBilled: (kg: string) => `To‘lovga ${kg} kg`,
  calcBilledNote: 'qadoq bilan, kamida 1 kg',
  calcTotal: 'Toshkentgacha yetkazish',
  calcSum: (sum: string) => `≈ ${sum} Atlas kursi bo‘yicha`,
  calcInvalid: 'Og‘irlikni 0,01 dan 50 kg gacha kiriting.',
  calcCta: 'Tovarni havola bo‘yicha hisoblash',
  courierTitle: 'Toshkent bo‘ylab',
  note: 'Atlasning joriy tariflari, oferta emas. Muddatlar taxminiy, xorijdagi ombordan ish kunlarida; Atlas kursi — hisob kuniga.',
};

const en: DeliveryCopy = {
  title: 'Delivery to Tashkent',
  lead: 'Each country has its own price per kilogram and its own delivery time. You choose the speed at checkout: express or standard.',
  countriesTitle: 'Where we ship from',
  stores: (count: number) => `${count} ${count === 1 ? 'store' : 'stores'}`,
  storesLink: 'Stores in this country',
  perKg: '/kg',
  pending: 'time to be confirmed',
  days: (min: number, max: number) => `${min}–${max} business days`,
  limitTitle: (limit: string) => `Duty-free up to ${limit} a month`,
  limitText: (limit: string) => `The allowance counts per recipient per calendar month. Above ${limit} a customs payment applies; we show its amount in the cart before you pay.`,
  limitLink: 'How the duty is calculated',
  weightTitle: 'How we count the weight',
  weightRules: [
    'The weight includes the store’s box.',
    'We add 0.3 kg for packaging, once per parcel.',
    'At least 1 kg per parcel from one store: items from one store travel together.',
  ],
  calcTitle: 'Delivery calculator',
  calcLead: 'What delivery costs from the warehouse abroad to Tashkent. The item price and the Atlas service are in the link estimate.',
  calcCountry: 'Store country',
  calcWeight: 'Weight with the box, kg',
  calcWeightHint: 'For example, boxed sneakers weigh about 1.2 kg.',
  calcSpeed: 'Speed',
  calcBilled: (kg: string) => `Billed ${kg} kg`,
  calcBilledNote: 'with packaging, at least 1 kg',
  calcTotal: 'Delivery to Tashkent',
  calcSum: (sum: string) => `≈ ${sum} at the Atlas rate`,
  calcInvalid: 'Enter a weight from 0.01 to 50 kg.',
  calcCta: 'Price an item by its link',
  courierTitle: 'Within Tashkent',
  note: 'Current Atlas rates, not an offer. Times are approximate, in business days from the warehouse abroad; the Atlas exchange rate is that of the day of the estimate.',
};

export const deliveryCopy: Record<Locale, DeliveryCopy> = /*@__PURE__*/withCyrillic({ ru, uz, en });
