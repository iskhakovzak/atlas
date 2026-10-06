import { localizedStatuses, type Locale } from './i18n.ts';
import { formatSum } from './home-copy.ts';

/**
 * Order history and notifications in the customer's language. The domain keeps writing the Russian `text`
 * (`title`/`message`) for operators, exports and older clients; since 6 October 2026 customer-visible events also
 * carry `code` and `params` (soum amounts as numbers), rendered here in ru/uz/en with formatSum. Entries without a
 * code, or with one this module does not know, go through the legacy localizer of stored Russian strings.
 * Payments are simulated: a hold is never called charged money, and nothing here says money moved through a bank.
 */
export type HistoryParams = Record<string, number | string>;
type Coded = { code?: string; params?: HistoryParams };
type Values = { sum: (key: string) => string; text: (key: string) => string; num: (key: string) => number; has: (key: string) => boolean; title: () => string };
type Copy = Record<Locale, (v: Values) => string>;

class MissingParam extends Error {}
function values(params: HistoryParams | undefined, locale: Locale): Values {
  const p = params ?? {};
  const num = (key: string) => { const value = p[key]; if (typeof value !== 'number' || !Number.isFinite(value)) throw new MissingParam(key); return value; };
  const text = (key: string) => { const value = p[key]; if (value === undefined || value === '') throw new MissingParam(key); return String(value); };
  return {
    num, text,
    sum: (key) => formatSum(num(key), locale),
    has: (key) => typeof p[key] === 'number' ? p[key] !== 0 : Boolean(p[key]),
    title: () => text(locale === 'ru' ? 'titleRu' : locale === 'uz' ? 'titleUz' : 'titleEn'),
  };
}
function render(table: Record<string, Copy>, item: Coded, locale: Locale): string | undefined {
  const copy = item.code ? table[item.code] : undefined;
  if (!copy) return undefined;
  try { return copy[locale](values(item.params, locale)); } catch (error) { if (error instanceof MissingParam) return undefined; throw error; }
}

const historyCopy: Record<string, Copy> = {
  checkout: {
    ru: v => `Заказ оформлен в Atlas. Сумма ${v.sum('total')}. ${v.has('fromBalance') ? 'Учтено из внутреннего баланса Atlas.' : 'Оплата на сайте не подключена, деньги не списывались.'}`,
    uz: v => `Buyurtma Atlasda rasmiylashtirildi. Summa ${v.sum('total')}. ${v.has('fromBalance') ? 'Atlas ichki balansidan hisobga olindi.' : 'Saytda to‘lov ulanmagan, pul yechilmagan.'}`,
    en: v => `Order placed in Atlas. Total ${v.sum('total')}. ${v.has('fromBalance') ? 'Accounted for from the Atlas internal balance.' : 'Online payment is not connected; no money was charged.'}`,
  },
  'store-hold': {
    ru: v => `Резерв на доставку магазина ${v.sum('hold')} держим отдельно, в сумму заказа он не входит. Фактическую доставку менеджер подтвердит у магазина.`,
    uz: v => `Do‘kon yetkazib berishi uchun ${v.sum('hold')} zaxira alohida turadi va buyurtma summasiga kirmaydi. Haqiqiy yetkazib berishni menejer do‘kondan tasdiqlaydi.`,
    en: v => `A store-delivery hold of ${v.sum('hold')} is kept separately and is not part of the order total. A manager will confirm the actual delivery with the store.`,
  },
  'customs-help': {
    ru: v => `Покупатель выбрал оплату таможни через Atlas: сбор ${v.sum('fee')} и предоплата пошлины ${v.sum('duty')} входят в сумму заказа. Остаток пошлины вернётся на баланс, доплата — только с согласия покупателя.`,
    uz: v => `Xaridor bojxona to‘lovini Atlas orqali tanladi: ${v.sum('fee')} xizmat haqi va ${v.sum('duty')} bojning oldindan to‘lovi buyurtma summasiga kiradi. Bojning qoldig‘i balansga qaytadi, qo‘shimcha to‘lov — faqat xaridor roziligi bilan.`,
    en: v => `The customer chose to have Atlas pay customs: the ${v.sum('fee')} fee and the ${v.sum('duty')} duty prepayment are part of the order total. Unused duty returns to the balance; any extra only with the customer’s consent.`,
  },
  'source-price-changed': {
    ru: v => `Цена в магазине изменилась до оформления: ${v.text('from')} → ${v.text('to')} ${v.text('currency')}. Покупатель оформил заказ по новому расчёту.`,
    uz: v => `Do‘kondagi narx rasmiylashtirishdan oldin o‘zgardi: ${v.text('from')} → ${v.text('to')} ${v.text('currency')}. Xaridor buyurtmani yangi hisob bo‘yicha rasmiylashtirdi.`,
    en: v => `The store price changed before checkout: ${v.text('from')} → ${v.text('to')} ${v.text('currency')}. The customer placed the order at the new total.`,
  },
  'source-shipping-changed': {
    ru: v => `Доставка магазина изменилась до оформления: ${v.text('from')} → ${v.text('to')} ${v.text('currency')}.`,
    uz: v => `Do‘kon yetkazib berishi rasmiylashtirishdan oldin o‘zgardi: ${v.text('from')} → ${v.text('to')} ${v.text('currency')}.`,
    en: v => `Store delivery changed before checkout: ${v.text('from')} → ${v.text('to')} ${v.text('currency')}.`,
  },
  'store-shipping-over': {
    ru: v => `Менеджер подтвердил доставку магазина ${v.sum('actual')}. Это больше резерва ${v.sum('hold')}: нужно согласие покупателя на разницу ${v.sum('extra')}.`,
    uz: v => `Menejer do‘kon yetkazib berishini ${v.sum('actual')} deb tasdiqladi. Bu ${v.sum('hold')} zaxiradan ko‘p: ${v.sum('extra')} farq uchun xaridor roziligi kerak.`,
    en: v => `A manager confirmed store delivery at ${v.sum('actual')}. That is more than the ${v.sum('hold')} hold: the customer’s consent is needed for the ${v.sum('extra')} difference.`,
  },
  'store-shipping-within': {
    ru: v => `Менеджер подтвердил доставку магазина ${v.sum('actual')} в пределах резерва ${v.sum('hold')}.` + (v.has('released') ? ` Неиспользованная часть резерва ${v.sum('released')} освобождается.` : ''),
    uz: v => `Menejer do‘kon yetkazib berishini ${v.sum('actual')} deb tasdiqladi — ${v.sum('hold')} zaxira doirasida.` + (v.has('released') ? ` Zaxiraning ishlatilmagan qismi ${v.sum('released')} bo‘shatiladi.` : ''),
    en: v => `A manager confirmed store delivery at ${v.sum('actual')}, within the ${v.sum('hold')} hold.` + (v.has('released') ? ` The unused ${v.sum('released')} of the hold is released.` : ''),
  },
  'store-shipping-extra-legacy': {
    ru: v => `Менеджер подтвердил доставку магазина. Требуется согласование доплаты ${v.sum('extra')}`,
    uz: v => `Menejer do‘kon yetkazib berishini tasdiqladi. ${v.sum('extra')} qo‘shimcha to‘lovni kelishish kerak.`,
    en: v => `A manager confirmed store delivery. An additional ${v.sum('extra')} needs approval.`,
  },
  'store-shipping-refund-legacy': {
    ru: v => `Менеджер подтвердил доставку магазина. Возврат разницы: ${v.sum('refund')}`,
    uz: v => `Menejer do‘kon yetkazib berishini tasdiqladi. Farq: ${v.sum('refund')}.`,
    en: v => `A manager confirmed store delivery. Difference: ${v.sum('refund')}.`,
  },
  // Older order whose cheaper store delivery found no (or only part of the) payment recorded: no refund is claimed.
  'store-shipping-partial-legacy': {
    ru: v => `Менеджер подтвердил доставку магазина. Она дешевле резерва на ${v.sum('refund')}; ` + (v.has('credited') ? `оплата по заказу записана не полностью — на внутренний баланс Atlas зачислено ${v.sum('credited')}.` : 'оплата по заказу не записана — на баланс ничего не зачислено.'),
    uz: v => `Menejer do‘kon yetkazib berishini tasdiqladi. U zaxiradan ${v.sum('refund')} arzonroq; ` + (v.has('credited') ? `buyurtma bo‘yicha to‘lov to‘liq qayd etilmagan — Atlas ichki balansiga ${v.sum('credited')} yozildi.` : 'buyurtma bo‘yicha to‘lov qayd etilmagan — balansga hech narsa yozilmadi.'),
    en: v => `A manager confirmed store delivery. It is ${v.sum('refund')} below the reserve; ` + (v.has('credited') ? `only part of the payment is recorded for the order — ${v.sum('credited')} was credited to the Atlas internal balance.` : 'no payment is recorded for the order, so nothing was credited to the balance.'),
  },
  'store-shipping-extra-approved': {
    ru: v => `В Atlas записано согласие на доплату за доставку магазина ${v.sum('extra')}; списания нет.`,
    uz: v => `Atlasda do‘kon yetkazib berishi uchun ${v.sum('extra')} qo‘shimcha to‘lovga rozilik qayd etildi; pul yechilmadi.`,
    en: v => `Approval for the additional ${v.sum('extra')} store delivery was recorded in Atlas; no charge was made.`,
  },
  'customs-duty-over': {
    ru: v => `Таможня начислила пошлину ${v.sum('actual')}. Это больше предоплаты ${v.sum('estimated')}: нужно согласие покупателя на разницу ${v.sum('extra')}.`,
    uz: v => `Bojxona ${v.sum('actual')} boj hisobladi. Bu ${v.sum('estimated')} oldindan to‘lovdan ko‘p: ${v.sum('extra')} farq uchun xaridor roziligi kerak.`,
    en: v => `Customs charged ${v.sum('actual')} duty. That is more than the ${v.sum('estimated')} prepayment: the customer’s consent is needed for the ${v.sum('extra')} difference.`,
  },
  'customs-duty-paid': {
    ru: v => `Таможня начислила пошлину ${v.sum('actual')}. Atlas оплатил её из предоплаты ${v.sum('estimated')}.` + (v.has('refund') ? ` Остаток ${v.sum('refund')} учтён на внутреннем балансе Atlas.` : ''),
    uz: v => `Bojxona ${v.sum('actual')} boj hisobladi. Atlas uni ${v.sum('estimated')} oldindan to‘lovdan to‘ladi.` + (v.has('refund') ? ` Qoldiq ${v.sum('refund')} Atlas ichki balansida qayd etildi.` : ''),
    en: v => `Customs charged ${v.sum('actual')} duty. Atlas covered it from the ${v.sum('estimated')} prepayment.` + (v.has('refund') ? ` The remaining ${v.sum('refund')} was recorded in the Atlas internal balance.` : ''),
  },
  'customs-extra-approved': {
    ru: v => `В Atlas записано согласие на доплату пошлины ${v.sum('extra')}; списания нет.`,
    uz: v => `Atlasda ${v.sum('extra')} boj qo‘shimcha to‘loviga rozilik qayd etildi; pul yechilmadi.`,
    en: v => `Approval for the additional ${v.sum('extra')} duty was recorded in Atlas; no charge was made.`,
  },
  'parcel-extra': {
    ru: v => `Взвешивание завершено. Требуется согласование доплаты ${v.sum('extra')}`,
    uz: v => `Tortish yakunlandi. ${v.sum('extra')} qo‘shimcha to‘lovni kelishish kerak.`,
    en: v => `Weighing complete. An additional ${v.sum('extra')} needs approval.`,
  },
  'parcel-weighed': {
    ru: v => `Взвешивание завершено. Возврат остатка: ${v.sum('refund')}`,
    uz: v => `Tortish yakunlandi. Qoldiq: ${v.sum('refund')}.`,
    en: v => `Weighing complete. Remainder: ${v.sum('refund')}.`,
  },
  'extra-approved': {
    ru: v => `В Atlas записано согласие на доплату ${v.sum('extra')}; списания нет.`,
    uz: v => `Atlasda ${v.sum('extra')} qo‘shimcha summa bo‘yicha rozilik qayd etildi; pul yechilmadi.`,
    en: v => `Approval for the additional amount ${v.sum('extra')} was recorded in Atlas; no charge was made.`,
  },
  'cancel-refund': {
    ru: v => `Заказ отменён до выкупа. Сумма ${v.sum('refund')} учтена на внутреннем балансе Atlas; банковский перевод не выполнялся.`,
    uz: v => `Buyurtma xariddan oldin bekor qilindi. ${v.sum('refund')} Atlas ichki balansida qayd etildi; bank o‘tkazmasi bajarilmadi.`,
    en: v => `Order cancelled before purchase. ${v.sum('refund')} was recorded in the Atlas internal balance; no bank transfer was made.`,
  },
  'cancel-unpaid': {
    ru: () => 'Заказ отменён до оплаты. Списаний не было.',
    uz: () => 'Buyurtma to‘lovdan oldin bekor qilindi. Pul yechilmagan.',
    en: () => 'Order cancelled before payment. Nothing was charged.',
  },
  'tracking-added': {
    ru: v => `Добавлен трек-номер ${v.text('tracking')}.`,
    uz: v => `Kuzatuv raqami qo‘shildi: ${v.text('tracking')}.`,
    en: v => `Tracking number added: ${v.text('tracking')}.`,
  },
  'service-requested': {
    ru: v => `Клиент запросил услугу склада «${v.title()}»; оператор проверит выполнимость и отправит стоимость на согласование.`,
    uz: v => `Mijoz «${v.title()}» ombor xizmatini so‘radi; operator bajarish imkonini tekshirib, narxni kelishuvga yuboradi.`,
    en: v => `The customer requested the “${v.title()}” warehouse service; an operator will check feasibility and send the price for approval.`,
  },
  'service-done': {
    ru: v => `Склад отметил услугу «${v.title()}» выполненной.`,
    uz: v => `Ombor «${v.title()}» xizmatini bajarilgan deb belgiladi.`,
    en: v => `The warehouse marked the “${v.title()}” service as done.`,
  },
  'service-declined': {
    ru: v => `Оператор отклонил услугу «${v.title()}»: ${v.text('reason')}`,
    uz: v => `Operator «${v.title()}» xizmatini rad etdi: ${v.text('reason')}`,
    en: v => `An operator declined the “${v.title()}” service: ${v.text('reason')}`,
  },
  'change-requested': {
    ru: v => `Запрошено согласование: ${v.text('title')}.`,
    uz: v => `Kelishuv so‘raldi: ${v.text('title')}.`,
    en: v => `Approval requested: ${v.text('title')}.`,
  },
  'change-approved': {
    ru: v => `Покупатель подтвердил: ${v.text('title')}.`,
    uz: v => `Xaridor tasdiqladi: ${v.text('title')}.`,
    en: v => `The customer approved: ${v.text('title')}.`,
  },
  'change-declined': {
    ru: v => `Покупатель отклонил: ${v.text('title')}.`,
    uz: v => `Xaridor rad etdi: ${v.text('title')}.`,
    en: v => `The customer declined: ${v.text('title')}.`,
  },
};
const statusName = (locale: Locale, v: Values) => { const name = localizedStatuses(locale)[v.num('status')]; if (!name) throw new MissingParam('status'); return name; };
historyCopy.status = { ru: v => statusName('ru', v), uz: v => statusName('uz', v), en: v => statusName('en', v) };

const noticeTitles: Record<string, Record<Locale, string>> = {
  approval: { ru: 'Нужно согласовать доставку', uz: 'Yetkazib berishni kelishish kerak', en: 'Store delivery needs your approval' },
  storeDone: { ru: 'Доставка магазина уточнена', uz: 'Do‘kon yetkazib berishi aniqlandi', en: 'Store delivery confirmed' },
  duty: { ru: 'Нужно согласовать пошлину', uz: 'Bojni kelishish kerak', en: 'Duty needs your approval' },
  dutyPaid: { ru: 'Пошлина оплачена', uz: 'Boj to‘landi', en: 'Duty paid' },
  extra: { ru: 'Нужна доплата за доставку', uz: 'Yetkazib berish uchun qo‘shimcha to‘lov kerak', en: 'Additional delivery payment needed' },
  weighed: { ru: 'Посылка взвешена', uz: 'Jo‘natma tortildi', en: 'Parcel weighed' },
};
type NoticeCopy = { title: Record<Locale, string> | Copy; message: Copy };
const noticeCopy: Record<string, NoticeCopy> = {
  'store-shipping-over': { title: noticeTitles.approval, message: {
    ru: v => `Фактическая доставка магазина ${v.sum('actual')} больше резерва ${v.sum('hold')}. Откройте заказ и подтвердите разницу ${v.sum('extra')}.`,
    uz: v => `Do‘konning haqiqiy yetkazib berishi ${v.sum('actual')} — ${v.sum('hold')} zaxiradan ko‘p. Buyurtmani oching va ${v.sum('extra')} farqni tasdiqlang.`,
    en: v => `The store’s actual delivery of ${v.sum('actual')} is above the ${v.sum('hold')} hold. Open the order and approve the ${v.sum('extra')} difference.`,
  } },
  'store-shipping-within': { title: noticeTitles.storeDone, message: {
    ru: v => `Фактическая доставка магазина ${v.sum('actual')} в пределах резерва ${v.sum('hold')}. Деньги не списывались: оплата на сайте не подключена.`,
    uz: v => `Do‘konning haqiqiy yetkazib berishi ${v.sum('actual')} — ${v.sum('hold')} zaxira doirasida. Pul yechilmagan: saytda to‘lov ulanmagan.`,
    en: v => `The store’s actual delivery of ${v.sum('actual')} is within the ${v.sum('hold')} hold. Nothing was charged: online payment is not connected.`,
  } },
  'store-shipping-extra-legacy': { title: noticeTitles.approval, message: {
    ru: v => `Менеджер уточнил стоимость. Откройте заказ и подтвердите доплату ${v.sum('extra')}.`,
    uz: v => `Menejer narxni aniqladi. Buyurtmani oching va ${v.sum('extra')} qo‘shimcha to‘lovni tasdiqlang.`,
    en: v => `A manager confirmed the cost. Open the order and approve the additional ${v.sum('extra')}.`,
  } },
  'store-shipping-refund-legacy': { title: noticeTitles.storeDone, message: {
    ru: v => `Разница ${v.sum('credited')} учтена на внутреннем балансе Atlas. Банковский перевод не выполнялся.`,
    uz: v => `${v.sum('credited')} farq Atlas ichki balansida qayd etildi. Bank o‘tkazmasi bajarilmadi.`,
    en: v => `The ${v.sum('credited')} difference was recorded in the Atlas internal balance. No bank transfer was made.`,
  } },
  'store-shipping-unpaid-legacy': { title: noticeTitles.storeDone, message: {
    ru: () => 'Доставка магазина дешевле резерва. Оплата по заказу не записана, поэтому на баланс ничего не зачислено.',
    uz: () => 'Do‘kon yetkazib berishi zaxiradan arzonroq. Buyurtma bo‘yicha to‘lov qayd etilmagan, shuning uchun balansga hech narsa yozilmadi.',
    en: () => 'Store delivery cost less than the reserve. No payment is recorded for the order, so nothing was credited to the balance.',
  } },
  'store-shipping-match-legacy': { title: noticeTitles.storeDone, message: {
    ru: () => 'Стоимость совпала с резервом заказа.',
    uz: () => 'Narx buyurtma zaxirasiga teng chiqdi.',
    en: () => 'The cost matched the order reserve.',
  } },
  'customs-duty-over': { title: noticeTitles.duty, message: {
    ru: v => `Таможня начислила ${v.sum('actual')}, больше предоплаты ${v.sum('estimated')}. Откройте заказ и подтвердите доплату ${v.sum('extra')}.`,
    uz: v => `Bojxona ${v.sum('actual')} hisobladi, bu ${v.sum('estimated')} oldindan to‘lovdan ko‘p. Buyurtmani oching va ${v.sum('extra')} qo‘shimcha to‘lovni tasdiqlang.`,
    en: v => `Customs charged ${v.sum('actual')}, above the ${v.sum('estimated')} prepayment. Open the order and approve the additional ${v.sum('extra')}.`,
  } },
  'customs-duty-refund': { title: noticeTitles.dutyPaid, message: {
    ru: v => `Остаток предоплаты пошлины ${v.sum('refund')} учтён на внутреннем балансе Atlas. Банковский перевод не выполнялся.`,
    uz: v => `Boj oldindan to‘lovining qoldig‘i ${v.sum('refund')} Atlas ichki balansida qayd etildi. Bank o‘tkazmasi bajarilmadi.`,
    en: v => `The remaining ${v.sum('refund')} of the duty prepayment was recorded in the Atlas internal balance. No bank transfer was made.`,
  } },
  'customs-duty-match': { title: noticeTitles.dutyPaid, message: {
    ru: v => `Пошлина ${v.sum('actual')} совпала с предоплатой.`,
    uz: v => `${v.sum('actual')} boj oldindan to‘lovga teng.`,
    en: v => `The ${v.sum('actual')} duty matched the prepayment.`,
  } },
  'parcel-extra': { title: noticeTitles.extra, message: {
    ru: v => `Фактический или объёмный вес превысил резерв: нужна доплата ${v.sum('extra')}. Проверьте новый расчёт.`,
    uz: v => `Haqiqiy yoki hajmiy vazn zaxiradan oshdi: ${v.sum('extra')} qo‘shimcha to‘lov kerak. Yangi hisobni tekshiring.`,
    en: v => `The actual or dimensional weight exceeded the reserve: an additional ${v.sum('extra')} is needed. Check the new calculation.`,
  } },
  'parcel-refund': { title: noticeTitles.weighed, message: {
    ru: v => `Остаток ${v.sum('refund')} учтён на внутреннем балансе Atlas. Банковский перевод не выполнялся.`,
    uz: v => `Qoldiq ${v.sum('refund')} Atlas ichki balansida qayd etildi. Bank o‘tkazmasi bajarilmadi.`,
    en: v => `The remaining ${v.sum('refund')} was recorded in the Atlas internal balance. No bank transfer was made.`,
  } },
  'parcel-weighed': { title: noticeTitles.weighed, message: {
    ru: () => 'Фактическая стоимость доставки подтверждена.',
    uz: () => 'Yetkazib berishning haqiqiy narxi tasdiqlandi.',
    en: () => 'The actual delivery cost is confirmed.',
  } },
  'tracking-added': { title: { ru: 'Добавлен трек-номер', uz: 'Kuzatuv raqami qo‘shildi', en: 'Tracking number added' }, message: {
    ru: v => `${v.text('carrier')}: ${v.text('tracking')}`, uz: v => `${v.text('carrier')}: ${v.text('tracking')}`, en: v => `${v.text('carrier')}: ${v.text('tracking')}`,
  } },
  'service-requested': { title: { ru: 'Запрос передан оператору', uz: 'So‘rov operatorga yuborildi', en: 'Request sent to an operator' }, message: {
    ru: v => `${v.title()}. Оператор подтвердит цену и выполнимость до начала работы.`,
    uz: v => `${v.title()}. Operator narx va bajarish imkonini ish boshlanishidan oldin tasdiqlaydi.`,
    en: v => `${v.title()}. An operator confirms the price and feasibility before the work starts.`,
  } },
  'service-done': { title: { ru: 'Услуга выполнена', uz: 'Xizmat bajarildi', en: 'Service done' }, message: { ru: v => v.title(), uz: v => v.title(), en: v => v.title() } },
  'service-declined': { title: { ru: 'Услуга недоступна', uz: 'Xizmat mavjud emas', en: 'Service unavailable' }, message: {
    ru: v => `${v.title()}: ${v.text('reason')}`, uz: v => `${v.title()}: ${v.text('reason')}`, en: v => `${v.title()}: ${v.text('reason')}`,
  } },
  'change-requested': { title: { ru: 'Нужно ваше решение', uz: 'Qaroringiz kerak', en: 'Your decision is needed' }, message: {
    ru: v => `${v.text('title')}${v.has('delta') ? ` · изменение ${v.sum('delta')}` : ''}.`,
    uz: v => `${v.text('title')}${v.has('delta') ? ` · o‘zgarish ${v.sum('delta')}` : ''}.`,
    en: v => `${v.text('title')}${v.has('delta') ? ` · change ${v.sum('delta')}` : ''}.`,
  } },
  'change-approved': { title: { ru: 'Изменение подтверждено', uz: 'O‘zgarish tasdiqlandi', en: 'Change approved' }, message: { ru: v => v.text('title'), uz: v => v.text('title'), en: v => v.text('title') } },
  'change-declined': { title: { ru: 'Изменение отклонено', uz: 'O‘zgarish rad etildi', en: 'Change declined' }, message: { ru: v => v.text('title'), uz: v => v.text('title'), en: v => v.text('title') } },
  status: { title: { ru: 'Статус заказа изменён', uz: 'Buyurtma holati o‘zgardi', en: 'Order status changed' }, message: historyCopy.status },
};

/** Fixed Russian strings stored by earlier and current versions, in every language. */
export const legacyStoredCopy: Record<string, Record<Locale, string>> = {
  "Оплата заказа из внутреннего баланса Atlas": {
    ru: "Учтено во внутреннем балансе Atlas",
    uz: "Atlas ichki balansida hisobga olindi",
    en: "Accounted for in the Atlas internal balance",
  },
  "Статус оплаты записан в Atlas; провайдер не подключён": {
    ru: "Отметка оплаты записана в Atlas; провайдер не подключён",
    uz: "To‘lov holati Atlasda qayd etildi; provayder ulanmagan",
    en: "Payment status recorded in Atlas; provider not connected",
  },
  "Статус оплаты отмечен в Atlas. Платёжный провайдер не подтвердил списание.": {
    ru: "Статус отмечен в Atlas; провайдер не подтвердил списание.",
    uz: "Holat Atlasda qayd etildi; provayder pul yechilishini tasdiqlamadi.",
    en: "Status recorded in Atlas; the provider did not confirm a charge.",
  },
  "Статус оплаты обновлён в Atlas": {
    ru: "Статус оплаты записан в Atlas",
    uz: "To‘lov holati Atlasda qayd etildi",
    en: "Payment status recorded in Atlas",
  },
  "Платёжный провайдер не подключён: списания и банковского подтверждения нет.": {
    ru: "Платёжный провайдер не подключён: списания и банковского подтверждения нет.",
    uz: "To‘lov provayderi ulanmagan: pul yechilmagan va bank tasdig‘i yo‘q.",
    en: "No payment provider is connected; no charge or bank confirmation exists.",
  },
  "Черновик декларации подготовлен": {
    ru: "Черновик декларации сохранён в Atlas",
    uz: "Deklaratsiya qoralamasi Atlasda saqlandi",
    en: "Declaration draft saved in Atlas",
  },
  "Разница учтена на внутреннем балансе Atlas. Банковский перевод не выполнялся.": {
    ru: "Разница учтена на внутреннем балансе Atlas. Банковский перевод не выполнялся.",
    uz: "Farq Atlas ichki balansida qayd etildi. Bank o‘tkazmasi bajarilmadi.",
    en: "The difference was recorded in the Atlas internal balance. No bank transfer was made.",
  },
  "Остаток учтён на внутреннем балансе Atlas. Банковский перевод не выполнялся.": {
    ru: "Остаток учтён на внутреннем балансе Atlas. Банковский перевод не выполнялся.",
    uz: "Qoldiq Atlas ichki balansida qayd etildi. Bank o‘tkazmasi bajarilmadi.",
    en: "The remainder was recorded in the Atlas internal balance. No bank transfer was made.",
  },
  "Заказ отменён до выкупа. Сумма учтена на внутреннем балансе Atlas; банковский перевод не выполнялся.": {
    ru: "Заказ отменён до выкупа. Сумма учтена на внутреннем балансе Atlas; банковский перевод не выполнялся.",
    uz: "Buyurtma xariddan oldin bekor qilindi. Summa Atlas ichki balansida qayd etildi; bank o‘tkazmasi bajarilmadi.",
    en: "Order cancelled before purchase. The amount was recorded in the Atlas internal balance; no bank transfer was made.",
  },
  "Заказ отменён до оплаты. Списаний не было.": {
    ru: "Заказ отменён до оплаты. Списаний не было.",
    uz: "Buyurtma to‘lovdan oldin bekor qilindi. Pul yechilmagan.",
    en: "Order cancelled before payment. Nothing was charged.",
  },
  "Оплата заказа демобалансом": {
    ru: "Учтено во внутреннем балансе Atlas",
    uz: "Atlas ichki balansida hisobga olindi",
    en: "Accounted for in the Atlas internal balance",
  },
  "Тестовая оплата по платёжной ссылке": {
    ru: "Отметка оплаты записана в Atlas",
    uz: "To‘lov holati Atlasda qayd etildi",
    en: "Payment status recorded in Atlas",
  },
  "Тестовый платёж подтверждён. Реального списания не было.": {
    ru: "В Atlas записана отметка; платёж провайдером не подтверждён и деньги не списывались.",
    uz: "Atlasda qayd yozildi; to‘lov provayder tomonidan tasdiqlanmagan va pul yechilmagan.",
    en: "Recorded in Atlas; not confirmed by a payment provider and no money was charged.",
  },
  "Предрелизный платёж принят в тестовом режиме. Реального списания не было.": {
    ru: "Статус записан в Atlas. Платёжный провайдер не подключён, деньги не списывались.",
    uz: "Holat Atlasda qayd etildi. To‘lov provayderi ulanmagan, pul yechilmagan.",
    en: "Status recorded in Atlas. No payment provider is connected and no money was charged.",
  },
  "Оплата подтверждена": {
    ru: "Статус оплаты записан в Atlas",
    uz: "To‘lov holati Atlasda qayd etildi",
    en: "Payment status recorded in Atlas",
  },
  "Тестовая декларация подготовлена": {
    ru: "Предпросмотр декларации сохранён в Atlas",
    uz: "Deklaratsiya ko‘rib chiqish uchun Atlasda saqlandi",
    en: "Declaration preview saved in Atlas",
  },
  "Разница с резервом возвращена на демобаланс.": {
    ru: "Разница учтена во внутреннем балансе Atlas; перевод не выполнялся.",
    uz: "Farq Atlas ichki balansida qayd etildi; pul o‘tkazilmadi.",
    en: "The difference was recorded in the Atlas internal balance; no transfer was made.",
  },
  "Остаток доставки возвращён на демобаланс.": {
    ru: "Остаток доставки учтён во внутреннем балансе Atlas; перевод не выполнялся.",
    uz: "Yetkazib berish qoldig‘i Atlas ichki balansida qayd etildi; pul o‘tkazilmadi.",
    en: "The shipping remainder was recorded in the Atlas internal balance; no transfer was made.",
  },
  "Отменён до выкупа. Вся сумма возвращена на демобаланс.": {
    ru: "Заказ отменён; сумма учтена во внутреннем балансе Atlas. Перевод денег не выполнялся.",
    uz: "Buyurtma bekor qilindi; summa Atlas ichki balansida qayd etildi. Pul o‘tkazilmadi.",
    en: "Order cancelled; the amount was recorded in the Atlas internal balance. No transfer was made.",
  },
  "Цена и вариант сверены с магазином перед оформлением.": {
    ru: "Цена и вариант сверены с магазином перед оформлением.",
    uz: "Narx va variant rasmiylashtirishdan oldin do‘kon bilan tekshirildi.",
    en: "Price and option were checked with the store before checkout.",
  },
  "Магазин не ответил при оформлении; цена была сверена незадолго до этого. Оператор сверит её перед выкупом.": {
    ru: "Магазин не ответил при оформлении; цена была сверена незадолго до этого. Оператор сверит её перед выкупом.",
    uz: "Rasmiylashtirishda do‘kon javob bermadi; narx shundan biroz oldin tekshirilgan edi. Operator xariddan oldin uni qayta tekshiradi.",
    en: "The store did not respond at checkout; the price had been checked shortly before. An operator will recheck it before purchase.",
  },
  "Склад подтвердил комплектность и состояние товара.": {
    ru: "Склад подтвердил комплектность и состояние товара.",
    uz: "Ombor tovarning to‘liqligi va holatini tasdiqladi.",
    en: "The warehouse confirmed the item’s contents and condition.",
  },
  "Склад зафиксировал проблему; требуется решение оператора и покупателя.": {
    ru: "Склад зафиксировал проблему; требуется решение оператора и покупателя.",
    uz: "Ombor muammoni qayd etdi; operator va xaridor qarori kerak.",
    en: "The warehouse recorded a problem; the operator and the customer need to decide.",
  },
  "Товар принят на складе": { ru: "Товар принят на складе", uz: "Tovar omborda qabul qilindi", en: "Item received at the warehouse" },
  "На складе обнаружена проблема": { ru: "На складе обнаружена проблема", uz: "Omborda muammo aniqlandi", en: "The warehouse found a problem" },
  "Комплектность и состояние подтверждены.": { ru: "Комплектность и состояние подтверждены.", uz: "To‘liqligi va holati tasdiqlandi.", en: "Contents and condition confirmed." },
  "Откройте заказ: оператор подготовит вариант решения.": { ru: "Откройте заказ: оператор подготовит вариант решения.", uz: "Buyurtmani oching: operator yechim variantini tayyorlaydi.", en: "Open the order: an operator will prepare a solution." },
  "Оператор добавил внутреннюю заметку.": { ru: "Оператор добавил внутреннюю заметку.", uz: "Operator ichki izoh qo‘shdi.", en: "An operator added an internal note." },
  "Оператор обновил разбор проблемы/возврата.": { ru: "Оператор обновил разбор проблемы/возврата.", uz: "Operator muammo/qaytarish ko‘rib chiqilishini yangiladi.", en: "An operator updated the problem/refund review." },
  "Оператор отправил уведомление в Atlas.": { ru: "Оператор отправил уведомление в Atlas.", uz: "Operator Atlasda bildirishnoma yubordi.", en: "An operator sent a notification in Atlas." },
  "Нужно согласовать доставку": noticeTitles.approval,
  "Доставка магазина уточнена": noticeTitles.storeDone,
  "Фактическая доставка магазина больше резерва. Откройте заказ и подтвердите разницу.": {
    ru: "Фактическая доставка магазина больше резерва. Откройте заказ и подтвердите разницу.",
    uz: "Do‘konning haqiqiy yetkazib berishi zaxiradan ko‘p. Buyurtmani oching va farqni tasdiqlang.",
    en: "The store’s actual delivery is above the hold. Open the order and approve the difference.",
  },
  "Фактическая доставка магазина в пределах резерва. Списаний не было: оплата пока не подключена.": {
    ru: "Фактическая доставка магазина в пределах резерва. Деньги не списывались: оплата на сайте не подключена.",
    uz: "Do‘konning haqiqiy yetkazib berishi zaxira doirasida. Pul yechilmagan: saytda to‘lov ulanmagan.",
    en: "The store’s actual delivery is within the hold. Nothing was charged: online payment is not connected.",
  },
  "Менеджер уточнил стоимость. Откройте заказ и подтвердите доплату.": {
    ru: "Менеджер уточнил стоимость. Откройте заказ и подтвердите доплату.",
    uz: "Menejer narxni aniqladi. Buyurtmani oching va qo‘shimcha to‘lovni tasdiqlang.",
    en: "A manager confirmed the cost. Open the order and approve the additional amount.",
  },
  "Стоимость совпала с резервом заказа.": { ru: "Стоимость совпала с резервом заказа.", uz: "Narx buyurtma zaxirasiga teng chiqdi.", en: "The cost matched the order reserve." },
  "Доставка магазина дешевле резерва. Оплата по заказу не записана, поэтому на баланс ничего не зачислено.": {
    ru: "Доставка магазина дешевле резерва. Оплата по заказу не записана, поэтому на баланс ничего не зачислено.",
    uz: "Do‘kon yetkazib berishi zaxiradan arzonroq. Buyurtma bo‘yicha to‘lov qayd etilmagan, shuning uchun balansga hech narsa yozilmadi.",
    en: "Store delivery cost less than the reserve. No payment is recorded for the order, so nothing was credited to the balance.",
  },
  "Нужно согласовать пошлину": noticeTitles.duty,
  "Пошлина оплачена": noticeTitles.dutyPaid,
  "Таможня начислила больше предоплаты. Откройте заказ и подтвердите доплату.": {
    ru: "Таможня начислила больше предоплаты. Откройте заказ и подтвердите доплату.",
    uz: "Bojxona oldindan to‘lovdan ko‘p hisobladi. Buyurtmani oching va qo‘shimcha to‘lovni tasdiqlang.",
    en: "Customs charged more than the prepayment. Open the order and approve the additional amount.",
  },
  "Остаток предоплаты пошлины учтён на внутреннем балансе Atlas. Банковский перевод не выполнялся.": {
    ru: "Остаток предоплаты пошлины учтён на внутреннем балансе Atlas. Банковский перевод не выполнялся.",
    uz: "Boj oldindan to‘lovining qoldig‘i Atlas ichki balansida qayd etildi. Bank o‘tkazmasi bajarilmadi.",
    en: "The rest of the duty prepayment was recorded in the Atlas internal balance. No bank transfer was made.",
  },
  "Пошлина совпала с предоплатой.": { ru: "Пошлина совпала с предоплатой.", uz: "Boj oldindan to‘lovga teng.", en: "The duty matched the prepayment." },
  "Нужна доплата за доставку": noticeTitles.extra,
  "Посылка взвешена": noticeTitles.weighed,
  "Фактический или объёмный вес превысил резерв. Проверьте новый расчёт.": {
    ru: "Фактический или объёмный вес превысил резерв. Проверьте новый расчёт.",
    uz: "Haqiqiy yoki hajmiy vazn zaxiradan oshdi. Yangi hisobni tekshiring.",
    en: "The actual or dimensional weight exceeded the reserve. Check the new calculation.",
  },
  "Фактическая стоимость доставки подтверждена.": { ru: "Фактическая стоимость доставки подтверждена.", uz: "Yetkazib berishning haqiqiy narxi tasdiqlandi.", en: "The actual delivery cost is confirmed." },
  "Добавлен трек-номер": { ru: "Добавлен трек-номер", uz: "Kuzatuv raqami qo‘shildi", en: "Tracking number added" },
  "Запрос передан оператору": { ru: "Запрос передан оператору", uz: "So‘rov operatorga yuborildi", en: "Request sent to an operator" },
  "Услуга выполнена": { ru: "Услуга выполнена", uz: "Xizmat bajarildi", en: "Service done" },
  "Услуга недоступна": { ru: "Услуга недоступна", uz: "Xizmat mavjud emas", en: "Service unavailable" },
  "Нужно ваше решение": { ru: "Нужно ваше решение", uz: "Qaroringiz kerak", en: "Your decision is needed" },
  "Изменение подтверждено": { ru: "Изменение подтверждено", uz: "O‘zgarish tasdiqlandi", en: "Change approved" },
  "Изменение отклонено": { ru: "Изменение отклонено", uz: "O‘zgarish rad etildi", en: "Change declined" },
  "Статус заказа изменён": { ru: "Статус заказа изменён", uz: "Buyurtma holati o‘zgardi", en: "Order status changed" },
  "Возврат разницы доставки магазина": { ru: "Возврат разницы доставки магазина", uz: "Do‘kon yetkazib berishi farqi qaytarildi", en: "Store delivery difference returned" },
  "Возврат остатка доставки": { ru: "Возврат остатка доставки", uz: "Yetkazib berish qoldig‘i qaytarildi", en: "Delivery remainder returned" },
  "Возврат отменённого заказа": { ru: "Возврат отменённого заказа", uz: "Bekor qilingan buyurtma qaytarildi", en: "Cancelled order returned to the balance" },
  "Возврат остатка предоплаты пошлины": { ru: "Возврат остатка предоплаты пошлины", uz: "Boj oldindan to‘lovining qoldig‘i qaytarildi", en: "Duty prepayment remainder returned" },
};

// "1 234 567 сум" as money() wrote it (no-break spaces, a leading minus for negative deltas).
const SUM = '(-?[\\d\\s\\u00a0\\u202f]+) сум';
const amountOf = (value: string) => (value.trim().startsWith('-') ? -1 : 1) * Number(value.replace(/[^\d]/g, ''));
const pattern = (source: string) => new RegExp('^' + source.replaceAll('{sum}', SUM) + '$');
const teams: Record<string, Record<Locale, string>> = {
  Закупки: { ru: 'Закупки', uz: 'Xaridlar', en: 'Purchasing' }, Склад: { ru: 'Склад', uz: 'Ombor', en: 'Warehouse' },
  Поддержка: { ru: 'Поддержка', uz: 'Yordam', en: 'Support' }, Финансы: { ru: 'Финансы', uz: 'Moliya', en: 'Finance' },
};
const priorities: Record<string, Record<Locale, string>> = {
  Обычный: { ru: 'Обычный', uz: 'Oddiy', en: 'Normal' }, Высокий: { ru: 'Высокий', uz: 'Yuqori', en: 'High' }, Срочный: { ru: 'Срочный', uz: 'Shoshilinch', en: 'Urgent' },
};
/** Stored Russian strings with amounts: the pattern and how to read its parameters into a history code. */
const legacyPatterns: { re: RegExp; code: string; read: (m: RegExpMatchArray) => HistoryParams }[] = [
  { re: pattern('Предварительный резерв доставки магазина {sum} удерживается отдельно и не входит в сумму заказа\\. Менеджер уточнит фактическую доставку\\.'), code: 'store-hold', read: m => ({ hold: amountOf(m[1]) }) },
  { re: pattern('Покупатель выбрал оплату таможни через Atlas: сбор {sum} и предоплата пошлины {sum} входят в сумму заказа\\. .*'), code: 'customs-help', read: m => ({ fee: amountOf(m[1]), duty: amountOf(m[2]) }) },
  { re: pattern('Менеджер подтвердил доставку магазина {sum}\\. Это больше резерва {sum}: нужно согласие покупателя на разницу {sum}\\.'), code: 'store-shipping-over', read: m => ({ actual: amountOf(m[1]), hold: amountOf(m[2]), extra: amountOf(m[3]) }) },
  { re: pattern('Менеджер подтвердил доставку магазина {sum} в пределах резерва {sum}\\.(?: Неиспользованная часть резерва {sum} освобождается\\.)?'), code: 'store-shipping-within', read: m => ({ actual: amountOf(m[1]), hold: amountOf(m[2]), released: m[3] ? amountOf(m[3]) : 0 }) },
  { re: pattern('Менеджер подтвердил доставку магазина\\. Требуется согласование доплаты {sum}'), code: 'store-shipping-extra-legacy', read: m => ({ extra: amountOf(m[1]) }) },
  { re: pattern('Менеджер подтвердил доставку магазина\\. Возврат разницы: {sum}'), code: 'store-shipping-refund-legacy', read: m => ({ refund: amountOf(m[1]) }) },
  { re: pattern('Покупатель подтвердил доплату за доставку магазина {sum}'), code: 'store-shipping-extra-approved', read: m => ({ extra: amountOf(m[1]) }) },
  { re: pattern('Таможня начислила пошлину {sum}\\. Это больше предоплаты {sum}: нужно согласие покупателя на разницу {sum}\\.'), code: 'customs-duty-over', read: m => ({ actual: amountOf(m[1]), estimated: amountOf(m[2]), extra: amountOf(m[3]) }) },
  { re: pattern('Таможня начислила пошлину {sum}\\. Atlas оплатил её из предоплаты {sum}\\.(?: Остаток {sum} возвращён на баланс\\.)?'), code: 'customs-duty-paid', read: m => ({ actual: amountOf(m[1]), estimated: amountOf(m[2]), refund: m[3] ? amountOf(m[3]) : 0 }) },
  { re: pattern('Покупатель подтвердил доплату пошлины {sum}'), code: 'customs-extra-approved', read: m => ({ extra: amountOf(m[1]) }) },
  { re: pattern('Взвешивание завершено\\. Требуется согласование доплаты {sum}'), code: 'parcel-extra', read: m => ({ extra: amountOf(m[1]) }) },
  { re: pattern('Взвешивание завершено\\. Возврат остатка: {sum}'), code: 'parcel-weighed', read: m => ({ refund: amountOf(m[1]) }) },
  { re: pattern('Покупатель (?:согласовал|подтвердил тестовую) доплату {sum}'), code: 'extra-approved', read: m => ({ extra: amountOf(m[1]) }) },
  { re: pattern('(?:Заказ оформлен в Atlas|Предрелизный заказ оформлен)\\. Сумма {sum}\\. (Ожидается подтверждение платёжного провайдера|Учтено из внутреннего баланса Atlas|Ожидается тестовая оплата|Оплачен демобалансом)\\.'), code: 'checkout', read: m => ({ total: amountOf(m[1]), fromBalance: /баланс/.test(m[2]) ? 1 : 0 }) },
  { re: pattern('Цена в магазине изменилась до оформления: (\\S+) → (\\S+) (\\S+)\\. Покупатель оформил заказ по новому расчёту\\.'), code: 'source-price-changed', read: m => ({ from: m[1], to: m[2], currency: m[3] }) },
  { re: pattern('Доставка магазина изменилась до оформления: (\\S+) → (\\S+) (\\S+)\\.'), code: 'source-shipping-changed', read: m => ({ from: m[1], to: m[2], currency: m[3] }) },
  { re: pattern('Добавлен трек-номер (.+)\\.'), code: 'tracking-added', read: m => ({ tracking: m[1] }) },
  { re: pattern('Запрошено согласование: (.+)\\.'), code: 'change-requested', read: m => ({ title: m[1] }) },
  { re: pattern('Покупатель подтвердил: (.+)\\.'), code: 'change-approved', read: m => ({ title: m[1] }) },
  { re: pattern('Покупатель отклонил: (.+)\\.'), code: 'change-declined', read: m => ({ title: m[1] }) },
];
const legacyNoticePatterns: { re: RegExp; code: string; read: (m: RegExpMatchArray) => HistoryParams }[] = [
  { re: pattern('(.+) · изменение {sum}\\.'), code: 'change-requested', read: m => ({ title: m[1], delta: amountOf(m[2]) }) },
];

/** Stored Russian text (history, notification fields, ledger descriptions) in the customer's language; unknown text stays as is. */
export function localizeLegacyStoredCopy(value: string, locale: Locale): string {
  const exact = legacyStoredCopy[value];
  if (exact) return exact[locale];
  const status = localizedStatuses('ru').indexOf(value);
  if (status >= 0) return localizedStatuses(locale)[status];
  for (const { re, code, read } of legacyPatterns) {
    const match = value.match(re);
    if (match) return render(historyCopy, { code, params: read(match) }, locale) ?? value;
  }
  const assignment = value.match(/^Назначено: (.+)\. Приоритет: (.+)\.$/);
  if (assignment && teams[assignment[1]] && priorities[assignment[2]])
    return { ru: 'Назначено', uz: 'Tayinlandi', en: 'Assigned' }[locale] + `: ${teams[assignment[1]][locale]}. ` + { ru: 'Приоритет', uz: 'Ustuvorlik', en: 'Priority' }[locale] + `: ${priorities[assignment[2]][locale]}.`;
  const declaration = value.match(/^Пакет ([A-Z0-9-]+) сохранён внутри Atlas\. В таможню он не отправлялся\.$/);
  if (declaration) {
    return {
      ru: `Пакет ${declaration[1]} сохранён в Atlas; в таможню не отправлялся.`,
      uz: `${declaration[1]} paketi Atlasda saqlandi; bojxonaga yuborilmadi.`,
      en: `Package ${declaration[1]} was saved in Atlas and was not sent to customs.`,
    }[locale];
  }
  for (const { re, code, read } of legacyNoticePatterns) {
    const match = value.match(re);
    if (match) {
      const copy = noticeCopy[code];
      try { return copy.message[locale](values(read(match), locale)); } catch { return value; }
    }
  }
  return value;
}

/** One history line in the customer's language: by its code when it has one, else from the stored Russian text. */
export function renderHistory(entry: Coded & { text: string }, locale: Locale): string {
  return render(historyCopy, entry, locale) ?? localizeLegacyStoredCopy(entry.text, locale);
}

/** A notification's title and message in the customer's language; operator-written ones stay as written. */
export function renderNotification(notice: Coded & { title: string; message: string }, locale: Locale): { title: string; message: string } {
  const copy = notice.code ? noticeCopy[notice.code] : undefined;
  if (copy) {
    const message = render({ [notice.code!]: copy.message }, notice, locale);
    if (message !== undefined) {
      const title = typeof copy.title[locale] === 'function' ? render({ [notice.code!]: copy.title as Copy }, notice, locale) : copy.title[locale] as string;
      if (title !== undefined) return { title, message };
    }
  }
  return { title: localizeLegacyStoredCopy(notice.title, locale), message: localizeLegacyStoredCopy(notice.message, locale) };
}

/** Every code the renderers know, for tests and for keeping ru/uz/en in step. */
export const historyCodes = Object.keys(historyCopy);
export const notificationCodes = Object.keys(noticeCopy);
