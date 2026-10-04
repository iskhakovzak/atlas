import type { Locale } from './i18n.ts';

function ruPlural(count: number, one: string, few: string, many: string) {
  const tail = count % 100, last = count % 10;
  if (tail >= 11 && tail <= 14) return many;
  return last === 1 ? one : last >= 2 && last <= 4 ? few : many;
}

/** "3 товара" / "3 ta tovar" / "3 items". */
export function itemCount(count: number, locale: Locale) {
  if (locale === 'ru') return `${count} ${ruPlural(count, 'товар', 'товара', 'товаров')}`;
  if (locale === 'uz') return `${count} ta tovar`;
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

/** "2 посылки" / "2 ta posilka" / "2 parcels". */
export function parcelCount(count: number, locale: Locale) {
  if (locale === 'ru') return `${count} ${ruPlural(count, 'посылка', 'посылки', 'посылок')}`;
  if (locale === 'uz') return `${count} ta posilka`;
  return `${count} ${count === 1 ? 'parcel' : 'parcels'}`;
}

/** Whole minutes left on a price, never "0": "14 мин" / "14 daqiqa" / "14 min". */
export function minutesLeft(milliseconds: number, locale: Locale) {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60000));
  return `${minutes} ${locale === 'uz' ? 'daqiqa' : locale === 'ru' ? 'мин' : 'min'}`;
}

const countryNames: Record<string, { uz: string; en: string }> = {
  'США': { uz: 'AQSH', en: 'United States' }, 'Испания': { uz: 'Ispaniya', en: 'Spain' }, 'Германия': { uz: 'Germaniya', en: 'Germany' },
  'Великобритания': { uz: 'Buyuk Britaniya', en: 'United Kingdom' }, 'Франция': { uz: 'Fransiya', en: 'France' }, 'Италия': { uz: 'Italiya', en: 'Italy' },
  'Румыния': { uz: 'Ruminiya', en: 'Romania' }, 'Китай': { uz: 'Xitoy', en: 'China' }, 'Турция': { uz: 'Turkiya', en: 'Turkey' },
  'Япония': { uz: 'Yaponiya', en: 'Japan' }, 'Южная Корея': { uz: 'Janubiy Koreya', en: 'South Korea' }, 'ОАЭ': { uz: 'BAA', en: 'United Arab Emirates' },
  'Канада': { uz: 'Kanada', en: 'Canada' }, 'Австралия': { uz: 'Avstraliya', en: 'Australia' }, 'Другая страна': { uz: 'Boshqa mamlakat', en: 'Other country' },
};

const uzMonths = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** Long date; Uzbek is built by hand because browser Intl data renders it as "2026 M10 3". */
export function formatLongDate(timestamp: number, locale: Locale) {
  const date = new Date(timestamp);
  if (locale === 'uz') return `${date.getDate()}-${uzMonths[date.getMonth()]}, ${date.getFullYear()}-yil`;
  return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Short date with time, year only when it is not the current one: "3 октября, 14:05" / "3-oktabr, 14:05". */
export function formatDateTime(timestamp: number, locale: Locale, now = Date.now()) {
  const date = new Date(timestamp), sameYear = date.getFullYear() === new Date(now).getFullYear();
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (locale === 'uz') return `${date.getDate()}-${uzMonths[date.getMonth()]}${sameYear ? '' : ` ${date.getFullYear()}-yil`}, ${time}`;
  const day = date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
  return `${day}, ${time}`;
}

/** Date without time, year only when it is not the current one: "3 октября" / "3-oktabr". */
export function formatShortDate(timestamp: number, locale: Locale, now = Date.now()) {
  const date = new Date(timestamp), sameYear = date.getFullYear() === new Date(now).getFullYear();
  if (locale === 'uz') return `${date.getDate()}-${uzMonths[date.getMonth()]}${sameYear ? '' : ` ${date.getFullYear()}-yil`}`;
  return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "3 заказа" / "3 ta buyurtma" / "3 orders". */
export function orderCount(count: number, locale: Locale) {
  if (locale === 'ru') return `${count} ${ruPlural(count, 'заказ', 'заказа', 'заказов')}`;
  if (locale === 'uz') return `${count} ta buyurtma`;
  return `${count} ${count === 1 ? 'order' : 'orders'}`;
}

/** Stored country names are Russian; show them in the interface language. */
export function countryLabel(country: string, locale: Locale) {
  return locale === 'ru' ? country : countryNames[country]?.[locale] ?? country;
}

type Sentence = { before: string; link: string; after: string };

export type CartCopy = {
  title: string;
  steps: [string, string, string];
  stepsLabel: string;
  loading: string;
  signin: { title: string; text: string; action: string };
  empty: { title: string; text: string; paste: string; stores: string };
  item: {
    remove: string; decrease: string; increase: string; quantity: string; storePrice: string; openStore: string; parcelFrom: (store: string) => string; forQuantity: (count: number) => string;
    /** Store-delivery reserve of one store order: how much more removes it, or that it is not taken. */
    parcelReserve: (missing: string, reserve: string) => string; parcelFree: (freeFrom: string) => string;
    /** Results of the live check with the store. */
    priceUp: (from: string, to: string) => string; priceDown: (from: string, to: string) => string; shippingChanged: (from: string, to: string) => string;
    issues: { currency: string; variant: string; price: string; unreachable: string }; reload: string; checked: (time: string) => string;
  };
  services: { title: string; optional: string; hint: string; fixed: string; quote: string; notIncluded: string; quantity: string; required: string; units: { package: string; item: string; day: string; photo: string; 'half-hour': string } };
  summary: {
    title: string; items: string; storeShipping: string; storeNoReserve: string; storeShippingHelp: (freeFrom: string) => string; service: string; serviceHelp: string; serviceHelpLabel: string;
    international: string; internationalHelp: string; internationalHelpLabel: string; reserve: string; reserveHelp: string; reserveHelpLabel: string;
    optional: string; balance: string; available: string; fromBalance: string; payable: string; checkout: string; renew: string;
    validFor: (time: string) => string; checking: string; expired: string; assurance: string; simulation: string; continue: string;
    verifying: string; recheckNote: string;
  };
  sticky: { label: string; checkout: string };
  checkout: {
    title: string; hint: string; reviewTitle: string; reviewHint: string; deliveryUz: string; saved: string; primary: string; passportOk: string; passportMissing: string;
    newRecipient: string; chooseHint: string; recipient: string; phone: string; region: string; city: string; street: string; streetPlaceholder: string;
    addressHint: string; postal: string; comment: string; next: string; edit: string; consent: Sentence; consentRequired: string;
    serviceNotAdded: string; servicePriceLater: string; confirm: string; saving: string; preorderNote: string; estimated: string; saveRecipient: string;
  };
  success: { title: string; hint: string; statusTitle: string; saved: string; pending: string; confirm: string; updating: string; orders: string; noCharge: string };
};

export type AccountCopy = {
  title: string;
  manage: string;
  since: (date: string) => string;
  signin: { title: string; text: string; action: string };
  next: {
    label: string; approval: string; payment: string; inProgress: string; cart: string; cartHint: (items: string) => string;
    recipient: string; recipientHint: string; allSet: string; allSetHint: string; open: string; add: string; newOrder: string;
    stage: (current: number, total: number) => string;
  };
  tiles: {
    label: string; orders: string; ordersActive: (count: number) => string; ordersTotal: (count: number) => string; none: string;
    cart: string; cartEmpty: string; balance: string; balanceSub: string; notifications: string; unread: (count: number) => string; noUnread: string;
  };
  customs: { title: string; used: (used: number, limit: number) => string; left: (amount: number) => string; over: (amount: number) => string; note: string; link: string; perPerson: string; empty: string; unnamed: string; cart: (amount: number) => string };
  recipients: { title: string; lead: string; primary: string; passportOk: (masked: string) => string; passportMissing: string; addPassport: string; remove: string; add: string; empty: string; edit: string; makePrimary: string };
  documents: { title: string; passport: string; passportCount: (count: number) => string; missing: string; declarations: string; declarationsCount: (count: number) => string; note: string };
  support: {
    title: string; lead: string; telegram: string; waiting: string; answered: string; closed: string; messages: (count: number) => string; history: string;
    team: string; you: string; replyPlaceholder: string; reply: string; none: string; newTicket: string; subject: string; question: string; send: string; sent: string;
    aboutOrder: (id: string) => string;
  };
  settings: { title: string; language: string; theme: string; rules: string; signOut: string };
};

const reserveHelp = {
  ru: 'Резерв закладывается, пока не известны точный вес и габариты посылки. Если доставка выйдет дешевле, разница вернётся на баланс Atlas. Если дороже — сначала сообщим сумму и спросим вашего согласия.',
  uz: 'Posilkaning aniq vazni va o‘lchami ma’lum bo‘lguncha zaxira qo‘yiladi. Yetkazish arzonroq bo‘lsa, farq Atlas balansiga qaytadi. Qimmatroq bo‘lsa — avval summani aytamiz va roziligingizni so‘raymiz.',
  en: 'The reserve covers the parcel until its exact weight and size are known. If delivery costs less, the difference returns to your Atlas balance. If it costs more, we tell you the amount and ask for your approval first.',
};

export const cartCopy: Record<Locale, CartCopy> = {
  ru: {
    title: 'Корзина',
    steps: ['Корзина', 'Получатель', 'Подтверждение'],
    stepsLabel: 'Этапы оформления',
    loading: 'Загружаем корзину…',
    signin: { title: 'Войдите, чтобы открыть корзину', text: 'Корзина и заказы хранятся в вашем профиле Atlas.', action: 'Войти' },
    empty: { title: 'Корзина пуста', text: 'Вставьте ссылку на товар из любого магазина — посчитаем цену с доставкой до Ташкента.', paste: 'Вставить ссылку', stores: 'Смотреть магазины' },
    item: { remove: 'Удалить', decrease: 'Уменьшить количество', increase: 'Увеличить количество', quantity: 'Количество', storePrice: 'В магазине', openStore: 'Открыть в магазине', parcelFrom: store => `Посылка из ${store}`, forQuantity: count => `за ${count} шт.`,
      parcelReserve: (missing, reserve) => `Ещё ${missing} из этого магазина — и резерв ${reserve} на его доставку не понадобится.`,
      parcelFree: freeFrom => `Из этого магазина от ${freeFrom} — резерв на его доставку не берём.`,
      priceUp: (from, to) => `Цена в магазине выросла: ${from} → ${to}. Итог пересчитан.`,
      priceDown: (from, to) => `Цена в магазине снизилась: ${from} → ${to}. Итог пересчитан.`,
      shippingChanged: (from, to) => `Доставка магазина изменилась: ${from} → ${to}.`,
      issues: { currency: 'Магазин сменил валюту витрины — откройте товар заново.', variant: 'Этот вариант больше не найден в магазине — выберите его заново.', price: 'Магазин не подтвердил цену — откройте товар заново.', unreachable: 'Магазин не ответил при проверке. Atlas сверит цену перед выкупом.' },
      reload: 'Открыть товар', checked: time => `Цена сверена с магазином в ${time}` },
    services: {
      title: 'Услуги склада', optional: 'по желанию',
      hint: 'Отметьте пожелания. Оператор проверит возможность после приёмки; услугу выполнят только после показа точной суммы и вашего согласия.',
      fixed: 'Тариф', quote: 'Стоимость уточнит оператор', notIncluded: 'не входит в сумму заказа', quantity: 'Количество', required: 'обязательно',
      units: { package: 'посылка', item: 'шт.', day: 'день', photo: 'фото', 'half-hour': '30 мин' },
    },
    summary: {
      title: 'Итого', items: 'Товары', storeShipping: 'Доставка магазина', storeNoReserve: 'Без резерва', service: 'Сервис Atlas',
      storeShippingHelp: freeFrom => `Если магазин не указал цену доставки до нашего склада, закладываем резерв $10 — один на заказ из магазина. От ${freeFrom} товаров из одного магазина резерв не берём: такие заказы обычно везут бесплатно. Если магазин всё же возьмёт плату, сначала спросим вас.`,
      serviceHelp: 'Выкуп товара, оплата в валюте магазина и сопровождение заказа до выдачи.', serviceHelpLabel: 'Что входит в сервис Atlas',
      international: 'Международная доставка',
      internationalHelp: 'Товары одного магазина едут одной посылкой: вес складывается, упаковка учитывается один раз. Минимальный оплачиваемый вес посылки — 1 кг.',
      internationalHelpLabel: 'Как считается доставка',
      reserve: 'Возвратный резерв', reserveHelp: reserveHelp.ru, reserveHelpLabel: 'Что такое возвратный резерв',
      optional: 'Общий сбор Atlas', balance: 'Оплатить с баланса Atlas', available: 'Доступно', fromBalance: 'С баланса Atlas', payable: 'К оплате',
      checkout: 'Оформить заказ', renew: 'Обновить расчёт', validFor: time => `Цена зафиксирована ещё ${time}`, checking: 'Проверяем срок цены…',
      expired: 'Срок расчёта истёк — обновите цену перед оформлением.', assurance: 'Доплата — только с вашего согласия',
      simulation: 'Оплата на сайте пока не подключена: деньги не списываются.', continue: 'Продолжить покупки',
      verifying: 'Сверяем цены с магазинами…', recheckNote: 'Перед оформлением Atlas сверит цены с магазинами и пересчитает итог по текущему тарифу.',
    },
    sticky: { label: 'Итог корзины', checkout: 'Оформить' },
    checkout: {
      title: 'Получатель и адрес', hint: 'Данные сохранятся в профиле и попадут в заказ.', reviewTitle: 'Проверьте заказ', reviewHint: 'Последний шаг: проверьте получателя, состав и сумму.',
      deliveryUz: 'Доставка по Узбекистану', saved: 'Сохранённые получатели', primary: 'основной', passportOk: 'Паспорт добавлен', passportMissing: 'Паспорт не добавлен',
      newRecipient: 'Новый получатель', chooseHint: 'Выберите того, кто будет получать посылку.', recipient: 'Получатель (ФИО)', phone: 'Телефон',
      region: 'Область', city: 'Город', street: 'Улица, дом, квартира', streetPlaceholder: 'Начните вводить улицу',
      addressHint: 'Подсказки работают на устройстве — адрес не уходит в сторонние сервисы поиска.', postal: 'Индекс', comment: 'Комментарий для курьера',
      next: 'Далее: проверка', edit: 'Изменить',
      consent: { before: 'Я ознакомлен(а) с ', link: 'таможенными условиями', after: ' и понимаю, что сверх месячного лимита возможна пошлина.' },
      consentRequired: 'Отметьте согласие с таможенными условиями.',
      serviceNotAdded: 'не входит в итог до вашего согласия', servicePriceLater: 'цена после проверки оператора',
      confirm: 'Подтвердить предзаказ', saving: 'Сохраняем заказ…',
      preorderNote: 'Предзаказ сохранится в Atlas. Реальная оплата и доставка ещё не подключены.', estimated: 'Предварительный итог',
      saveRecipient: 'Сохранить получателя в профиле — для следующих заказов и паспорта',
    },
    success: {
      title: 'Предзаказ оформлен', hint: 'Провайдер оплаты ещё не подключён. Atlas не списывает деньги и не создаёт отправку.',
      statusTitle: 'Статус заказа обновлён', saved: 'В Atlas записана отметка об оплате. Провайдер не подключён, деньги не списывались.',
      pending: 'Заказ сохранён. Для реальной оплаты Atlas должен подключить платёжного провайдера.', confirm: 'Записать отметку в Atlas',
      updating: 'Обновляем…', orders: 'Открыть заказы', noCharge: 'Реальных списаний, писем, SMS и доставки не происходит.',
    },
  },
  uz: {
    title: 'Savat',
    steps: ['Savat', 'Qabul qiluvchi', 'Tasdiqlash'],
    stepsLabel: 'Rasmiylashtirish bosqichlari',
    loading: 'Savat yuklanmoqda…',
    signin: { title: 'Savatni ochish uchun kiring', text: 'Savat va buyurtmalar Atlas profilingizda saqlanadi.', action: 'Kirish' },
    empty: { title: 'Savat bo‘sh', text: 'Istalgan do‘kondagi tovar havolasini qo‘ying — Toshkentgacha yetkazish bilan narxini hisoblaymiz.', paste: 'Havolani qo‘yish', stores: 'Do‘konlarni ko‘rish' },
    item: { remove: 'O‘chirish', decrease: 'Miqdorni kamaytirish', increase: 'Miqdorni oshirish', quantity: 'Miqdor', storePrice: 'Do‘konda', openStore: 'Do‘konda ochish', parcelFrom: store => `${store} posilkasi`, forQuantity: count => `${count} dona uchun`,
      parcelReserve: (missing, reserve) => `Bu do‘kondan yana ${missing} lik tovar qo‘shing — ${reserve} yetkazish zaxirasi kerak bo‘lmaydi.`,
      parcelFree: freeFrom => `Bu do‘kondan ${freeFrom} va undan ko‘p — yetkazish zaxirasi olinmaydi.`,
      priceUp: (from, to) => `Do‘kondagi narx oshdi: ${from} → ${to}. Jami qayta hisoblandi.`,
      priceDown: (from, to) => `Do‘kondagi narx tushdi: ${from} → ${to}. Jami qayta hisoblandi.`,
      shippingChanged: (from, to) => `Do‘kon yetkazishi o‘zgardi: ${from} → ${to}.`,
      issues: { currency: 'Do‘kon valyutani o‘zgartirdi — tovarni qayta oching.', variant: 'Bu variant do‘konda topilmadi — uni qayta tanlang.', price: 'Do‘kon narxni tasdiqlamadi — tovarni qayta oching.', unreachable: 'Tekshiruvda do‘kon javob bermadi. Atlas xariddan oldin narxni tekshiradi.' },
      reload: 'Tovarni ochish', checked: time => `Narx do‘kon bilan ${time} da tekshirildi` },
    services: {
      title: 'Ombor xizmatlari', optional: 'ixtiyoriy',
      hint: 'Istaklaringizni belgilang. Operator qabuldan keyin imkoniyatni tekshiradi; xizmat faqat aniq narx ko‘rsatilib, roziligingiz olingandan so‘ng bajariladi.',
      fixed: 'Tarif', quote: 'Narxni operator aniqlaydi', notIncluded: 'buyurtma summasiga kirmaydi', quantity: 'Miqdor', required: 'majburiy',
      units: { package: 'posilka', item: 'dona', day: 'kun', photo: 'foto', 'half-hour': '30 daqiqa' },
    },
    summary: {
      title: 'Jami', items: 'Tovarlar', storeShipping: 'Do‘kon yetkazishi', storeNoReserve: 'Zaxirasiz', service: 'Atlas xizmati',
      storeShippingHelp: freeFrom => `Do‘kon omborimizgacha yetkazish narxini ko‘rsatmasa, $10 zaxira qo‘yamiz — do‘kondan bitta buyurtmaga bir marta. Bitta do‘kondan ${freeFrom} va undan ortiq tovarga zaxira olinmaydi: bunday buyurtmalar odatda bepul yetkaziladi. Do‘kon baribir haq olsa, avval sizdan so‘raymiz.`,
      serviceHelp: 'Tovarni sotib olish, do‘kon valyutasida to‘lash va buyurtmani topshirishgacha kuzatib borish.', serviceHelpLabel: 'Atlas xizmatiga nimalar kiradi',
      international: 'Xalqaro yetkazish',
      internationalHelp: 'Bir do‘kon tovarlari bitta posilkada keladi: vazn qo‘shiladi, qadoq bir marta hisoblanadi. Posilkaning minimal to‘lovli vazni — 1 kg.',
      internationalHelpLabel: 'Yetkazish qanday hisoblanadi',
      reserve: 'Qaytariladigan zaxira', reserveHelp: reserveHelp.uz, reserveHelpLabel: 'Qaytariladigan zaxira nima',
      optional: 'Atlas umumiy yig‘imi', balance: 'Atlas balansidan to‘lash', available: 'Mavjud', fromBalance: 'Atlas balansidan', payable: 'To‘lash uchun',
      checkout: 'Buyurtmani rasmiylashtirish', renew: 'Hisobni yangilash', validFor: time => `Narx yana ${time} amal qiladi`, checking: 'Narx muddati tekshirilmoqda…',
      expired: 'Hisob muddati tugadi — rasmiylashtirishdan oldin narxni yangilang.', assurance: 'Qo‘shimcha to‘lov — faqat roziligingiz bilan',
      simulation: 'Saytda to‘lov hali ulanmagan: pul yechilmaydi.', continue: 'Xaridni davom ettirish',
      verifying: 'Narxlarni do‘konlar bilan tekshiryapmiz…', recheckNote: 'Rasmiylashtirishdan oldin Atlas narxlarni do‘konlar bilan tekshiradi va jamini joriy tarif bo‘yicha qayta hisoblaydi.',
    },
    sticky: { label: 'Savat jami', checkout: 'Rasmiylashtirish' },
    checkout: {
      title: 'Qabul qiluvchi va manzil', hint: 'Ma’lumotlar profilingizda saqlanadi va buyurtmaga biriktiriladi.', reviewTitle: 'Buyurtmani tekshiring', reviewHint: 'Oxirgi qadam: qabul qiluvchi, tarkib va summani tekshiring.',
      deliveryUz: 'O‘zbekiston bo‘ylab yetkazish', saved: 'Saqlangan qabul qiluvchilar', primary: 'asosiy', passportOk: 'Pasport qo‘shilgan', passportMissing: 'Pasport qo‘shilmagan',
      newRecipient: 'Yangi qabul qiluvchi', chooseHint: 'Posilkani kim qabul qilishini tanlang.', recipient: 'Qabul qiluvchi (F.I.Sh.)', phone: 'Telefon',
      region: 'Viloyat', city: 'Shahar', street: 'Ko‘cha, uy, xonadon', streetPlaceholder: 'Ko‘cha nomini yozing',
      addressHint: 'Maslahatlar qurilmangizda ishlaydi — manzil tashqi qidiruv xizmatlariga yuborilmaydi.', postal: 'Indeks', comment: 'Kuryer uchun izoh',
      next: 'Keyingi: tekshirish', edit: 'O‘zgartirish',
      consent: { before: '', link: 'Bojxona shartlari', after: ' bilan tanishdim va oylik limitdan oshsa, boj to‘lovi bo‘lishi mumkinligini tushunaman.' },
      consentRequired: 'Bojxona shartlariga roziligingizni belgilang.',
      serviceNotAdded: 'roziligingizgacha jamiga kirmaydi', servicePriceLater: 'narx operator tekshiruvidan so‘ng',
      confirm: 'Oldindan buyurtmani tasdiqlash', saving: 'Buyurtma saqlanmoqda…',
      preorderNote: 'Oldindan buyurtma Atlas’da saqlanadi. Haqiqiy to‘lov va yetkazish hali ulanmagan.', estimated: 'Dastlabki jami',
      saveRecipient: 'Qabul qiluvchini profilga saqlash — keyingi buyurtmalar va pasport uchun',
    },
    success: {
      title: 'Oldindan buyurtma yaratildi', hint: 'To‘lov provayderi hali ulanmagan. Atlas pul yechmaydi va jo‘natma yaratmaydi.',
      statusTitle: 'Buyurtma holati yangilandi', saved: 'To‘lov belgisi Atlas’da qayd etildi. Provayder ulanmagan, pul yechilmadi.',
      pending: 'Buyurtma saqlandi. Haqiqiy to‘lov uchun Atlas to‘lov provayderini ulashi kerak.', confirm: 'Atlas’da belgini qayd etish',
      updating: 'Yangilanmoqda…', orders: 'Buyurtmalarni ochish', noCharge: 'Haqiqiy yechib olish, xat, SMS va yetkazish amalga oshirilmaydi.',
    },
  },
  en: {
    title: 'Cart',
    steps: ['Cart', 'Recipient', 'Confirmation'],
    stepsLabel: 'Checkout steps',
    loading: 'Loading cart…',
    signin: { title: 'Sign in to open your cart', text: 'Your cart and orders are saved to your Atlas profile.', action: 'Sign in' },
    empty: { title: 'Your cart is empty', text: 'Paste a product link from any store — we will calculate the price with delivery to Tashkent.', paste: 'Paste a link', stores: 'Browse stores' },
    item: { remove: 'Remove', decrease: 'Decrease quantity', increase: 'Increase quantity', quantity: 'Quantity', storePrice: 'In store', openStore: 'Open in store', parcelFrom: store => `Parcel from ${store}`, forQuantity: count => `for ${count}`,
      parcelReserve: (missing, reserve) => `Add ${missing} more from this store and the ${reserve} store-delivery reserve goes away.`,
      parcelFree: freeFrom => `${freeFrom} or more from this store — no store-delivery reserve.`,
      priceUp: (from, to) => `The store price went up: ${from} → ${to}. Total recalculated.`,
      priceDown: (from, to) => `The store price went down: ${from} → ${to}. Total recalculated.`,
      shippingChanged: (from, to) => `Store delivery changed: ${from} → ${to}.`,
      issues: { currency: 'The store changed its currency — open the item again.', variant: 'This option is no longer listed — choose it again.', price: 'The store did not confirm the price — open the item again.', unreachable: 'The store did not answer the check. Atlas confirms the price before buying.' },
      reload: 'Open item', checked: time => `Price checked with the store at ${time}` },
    services: {
      title: 'Warehouse services', optional: 'optional',
      hint: 'Choose preferences. An operator checks feasibility after intake; work starts only after the exact price is shown and you approve it.',
      fixed: 'Rate', quote: 'Operator will quote', notIncluded: 'not included in the order total', quantity: 'Quantity', required: 'required',
      units: { package: 'package', item: 'item', day: 'day', photo: 'photo', 'half-hour': '30 min' },
    },
    summary: {
      title: 'Summary', items: 'Items', storeShipping: 'Store delivery', storeNoReserve: 'No reserve', service: 'Atlas service',
      storeShippingHelp: freeFrom => `When a store does not state delivery to our warehouse, we add a $10 reserve — once per store order. From ${freeFrom} of items from one store there is no reserve: such orders usually ship free. If the store still charges, we ask you first.`,
      serviceHelp: 'Buying the item, paying in the store’s currency and handling the order until pickup.', serviceHelpLabel: 'What the Atlas service covers',
      international: 'International delivery',
      internationalHelp: 'Items from one store travel as one parcel: weights add up and packaging counts once. The minimum billable parcel weight is 1 kg.',
      internationalHelpLabel: 'How delivery is calculated',
      reserve: 'Refundable reserve', reserveHelp: reserveHelp.en, reserveHelpLabel: 'What the refundable reserve is',
      optional: 'General Atlas fee', balance: 'Pay from Atlas balance', available: 'Available', fromBalance: 'From Atlas balance', payable: 'To pay',
      checkout: 'Check out', renew: 'Refresh estimate', validFor: time => `Price held for ${time}`, checking: 'Checking price validity…',
      expired: 'The estimate expired — refresh the price before checkout.', assurance: 'Extra charges only with your approval',
      simulation: 'Online payment is not connected yet: no money is charged.', continue: 'Continue shopping',
      verifying: 'Checking prices with the stores…', recheckNote: 'Before checkout Atlas checks prices with the stores and recalculates the total at the current rates.',
    },
    sticky: { label: 'Cart total', checkout: 'Check out' },
    checkout: {
      title: 'Recipient and address', hint: 'The details are saved to your profile and attached to the order.', reviewTitle: 'Review your order', reviewHint: 'Last step: check the recipient, items and total.',
      deliveryUz: 'Delivery in Uzbekistan', saved: 'Saved recipients', primary: 'primary', passportOk: 'Passport added', passportMissing: 'No passport added',
      newRecipient: 'New recipient', chooseHint: 'Choose the person who will receive the parcel.', recipient: 'Recipient (full name)', phone: 'Phone',
      region: 'Region', city: 'City', street: 'Street, building, apartment', streetPlaceholder: 'Start typing a street',
      addressHint: 'Suggestions run on your device — the address is not sent to third-party search.', postal: 'Postal code', comment: 'Note for the courier',
      next: 'Next: review', edit: 'Edit',
      consent: { before: 'I have read the ', link: 'customs terms', after: ' and understand that duty may apply above the monthly allowance.' },
      consentRequired: 'Please confirm the customs terms.',
      serviceNotAdded: 'not added until you approve', servicePriceLater: 'price after operator review',
      confirm: 'Confirm pre-order', saving: 'Saving order…',
      preorderNote: 'Your pre-order is saved in Atlas. Real payments and delivery are not connected yet.', estimated: 'Estimated total',
      saveRecipient: 'Save this recipient to your profile — for next orders and the passport',
    },
    success: {
      title: 'Pre-order created', hint: 'A payment provider is not connected yet. Atlas does not charge or ship orders.',
      statusTitle: 'Order status updated', saved: 'Atlas recorded a payment status. No provider is connected and no money was charged.',
      pending: 'The order is saved. Atlas must connect a payment provider before accepting real payments.', confirm: 'Record status in Atlas',
      updating: 'Updating…', orders: 'View orders', noCharge: 'No real charge, email, SMS or delivery occurs.',
    },
  },
};

export const accountCopy: Record<Locale, AccountCopy> = {
  ru: {
    title: 'Личный кабинет',
    manage: 'Управление Atlas',
    since: date => `Профиль создан ${date}`,
    signin: { title: 'Вход и создание аккаунта', text: 'Войдите через Telegram, телефон, почту или Google — профиль Atlas создастся автоматически.', action: 'Войти или зарегистрироваться' },
    next: {
      label: 'Сейчас важно', approval: 'Нужно ваше решение', payment: 'Завершите оплату', inProgress: 'Заказ в работе',
      cart: 'Проверьте корзину', cartHint: items => `В корзине ${items}. Осталось оформить заказ.`,
      recipient: 'Добавьте получателя', recipientHint: 'Адрес подставится при оформлении заказа.',
      allSet: 'Всё в порядке', allSetHint: 'Сейчас от вас ничего не требуется.', open: 'Открыть', add: 'Добавить', newOrder: 'Заказать по ссылке',
      stage: (current, total) => `Этап ${current} из ${total}`,
    },
    tiles: {
      label: 'Коротко о покупках', orders: 'Заказы', ordersActive: count => `${count} в работе`, ordersTotal: count => `всего ${count}`, none: 'пока нет',
      cart: 'Корзина', cartEmpty: 'пусто', balance: 'Баланс', balanceSub: 'внутренний счёт Atlas',
      notifications: 'Уведомления', unread: count => `${count} ${ruPlural(count, 'новое', 'новых', 'новых')}`, noUnread: 'нет новых',
    },
    customs: {
      title: 'Таможенный лимит месяца', used: (used, limit) => `$${used} из $${limit}`, left: amount => `Ещё $${amount} без пошлины`,
      over: amount => `Превышение $${amount}: возможен таможенный платёж`,
      note: 'Считаются только покупки через Atlas в этом месяце, по дате заказа. Покупки в других сервисах учитывайте сами.', link: 'Как считается таможня',
      perPerson: 'Лимит $200 — на каждого получателя.', empty: 'В этом месяце заказов ещё не было — лимит свободен.', unnamed: 'Получатель не указан', cart: amount => `В корзине ещё $${amount} — учтите при оформлении.`,
    },
    recipients: {
      title: 'Получатели и адреса', lead: 'Подставляются при оформлении заказа.', primary: 'основной', passportOk: masked => `Паспорт ${masked}`,
      passportMissing: 'Паспорт не добавлен', addPassport: 'Добавить паспорт', remove: 'Удалить', add: 'Добавить получателя', empty: 'Сохранённых получателей пока нет.', edit: 'Изменить', makePrimary: 'Сделать основным',
    },
    documents: {
      title: 'Документы', passport: 'Паспорт', passportCount: count => `добавлено: ${count}`, missing: 'не добавлен',
      declarations: 'Декларации', declarationsCount: count => count ? `подготовлено: ${count}` : 'пока нет', note: 'Счета и фото со склада — внутри каждого заказа.',
    },
    support: {
      title: 'Поддержка', lead: 'Ответ придёт сюда и в уведомления.', telegram: 'Написать в Telegram', waiting: 'Ждём ответа', answered: 'Есть ответ', closed: 'Закрыто',
      messages: count => `${count} ${ruPlural(count, 'сообщение', 'сообщения', 'сообщений')}`, history: 'Открыть переписку', team: 'Поддержка Atlas', you: 'Вы',
      replyPlaceholder: 'Ваш ответ', reply: 'Ответить', none: 'Обращений пока нет.', newTicket: 'Новое обращение', subject: 'Тема', question: 'Опишите вопрос',
      send: 'Отправить', sent: 'Обращение отправлено.', aboutOrder: id => `Вопрос по заказу ${id}`,
    },
    settings: { title: 'Настройки', language: 'Язык', theme: 'Тема', rules: 'Правила и обработка данных', signOut: 'Выйти из аккаунта' },
  },
  uz: {
    title: 'Shaxsiy kabinet',
    manage: 'Atlas boshqaruvi',
    since: date => `Profil yaratilgan: ${date}`,
    signin: { title: 'Kirish va akkaunt yaratish', text: 'Telegram, telefon, pochta yoki Google orqali kiring — Atlas profilingiz avtomatik yaratiladi.', action: 'Kirish yoki ro‘yxatdan o‘tish' },
    next: {
      label: 'Hozir muhim', approval: 'Qaroringiz kerak', payment: 'To‘lovni yakunlang', inProgress: 'Buyurtma jarayonda',
      cart: 'Savatni tekshiring', cartHint: items => `Savatda ${items} bor. Buyurtmani rasmiylashtirish qoldi.`,
      recipient: 'Qabul qiluvchini qo‘shing', recipientHint: 'Manzil buyurtma rasmiylashtirishda avtomatik qo‘yiladi.',
      allSet: 'Hammasi joyida', allSetHint: 'Hozir sizdan hech narsa talab qilinmaydi.', open: 'Ochish', add: 'Qo‘shish', newOrder: 'Havola orqali buyurtma',
      stage: (current, total) => `Bosqich: ${current} / ${total}`,
    },
    tiles: {
      label: 'Xaridlar haqida qisqacha', orders: 'Buyurtmalar', ordersActive: count => `${count} ta jarayonda`, ordersTotal: count => `jami ${count} ta`, none: 'hali yo‘q',
      cart: 'Savat', cartEmpty: 'bo‘sh', balance: 'Balans', balanceSub: 'Atlas ichki hisobi',
      notifications: 'Bildirishnomalar', unread: count => `${count} ta yangi`, noUnread: 'yangi yo‘q',
    },
    customs: {
      title: 'Oylik bojxona limiti', used: (used, limit) => `$${used} / $${limit}`, left: amount => `Yana $${amount} bojsiz`,
      over: amount => `$${amount} ortiqcha: bojxona to‘lovi bo‘lishi mumkin`,
      note: 'Faqat shu oy Atlas orqali qilingan xaridlar buyurtma sanasi bo‘yicha hisoblanadi. Boshqa xizmatlardagi xaridlarni o‘zingiz hisobga oling.', link: 'Bojxona qanday hisoblanadi',
      perPerson: '$200 limit — har bir qabul qiluvchiga.', empty: 'Bu oy hali buyurtma yo‘q — limit bo‘sh.', unnamed: 'Qabul qiluvchi ko‘rsatilmagan', cart: amount => `Savatda yana $${amount} — rasmiylashtirishda hisobga oling.`,
    },
    recipients: {
      title: 'Qabul qiluvchilar va manzillar', lead: 'Buyurtma rasmiylashtirishda avtomatik qo‘yiladi.', primary: 'asosiy', passportOk: masked => `Pasport ${masked}`,
      passportMissing: 'Pasport qo‘shilmagan', addPassport: 'Pasport qo‘shish', remove: 'O‘chirish', add: 'Qabul qiluvchi qo‘shish', empty: 'Hali saqlangan qabul qiluvchilar yo‘q.', edit: 'O‘zgartirish', makePrimary: 'Asosiy qilish',
    },
    documents: {
      title: 'Hujjatlar', passport: 'Pasport', passportCount: count => `qo‘shilgan: ${count}`, missing: 'qo‘shilmagan',
      declarations: 'Deklaratsiyalar', declarationsCount: count => count ? `tayyorlangan: ${count}` : 'hali yo‘q', note: 'Hisoblar va ombor fotosuratlari — har bir buyurtma ichida.',
    },
    support: {
      title: 'Yordam', lead: 'Javob shu yerga va bildirishnomalarga keladi.', telegram: 'Telegram’da yozish', waiting: 'Javob kutilmoqda', answered: 'Javob bor', closed: 'Yopilgan',
      messages: count => `${count} ta xabar`, history: 'Yozishmani ochish', team: 'Atlas yordami', you: 'Siz',
      replyPlaceholder: 'Javobingiz', reply: 'Javob berish', none: 'Hali murojaatlar yo‘q.', newTicket: 'Yangi murojaat', subject: 'Mavzu', question: 'Savolingizni yozing',
      send: 'Yuborish', sent: 'Murojaat yuborildi.', aboutOrder: id => `${id} buyurtma bo‘yicha savol`,
    },
    settings: { title: 'Sozlamalar', language: 'Til', theme: 'Ko‘rinish', rules: 'Qoidalar va ma’lumotlarga ishlov berish', signOut: 'Akkauntdan chiqish' },
  },
  en: {
    title: 'Your account',
    manage: 'Manage Atlas',
    since: date => `Member since ${date}`,
    signin: { title: 'Sign in and create an account', text: 'Sign in with Telegram, phone, email or Google — your Atlas profile is created automatically.', action: 'Sign in or sign up' },
    next: {
      label: 'Needs your attention', approval: 'Your approval is needed', payment: 'Complete payment', inProgress: 'Order in progress',
      cart: 'Review your cart', cartHint: items => `${items} in your cart. Only checkout is left.`,
      recipient: 'Add a recipient', recipientHint: 'The address will be filled in at checkout.',
      allSet: 'You’re all set', allSetHint: 'Nothing needs your attention right now.', open: 'Open', add: 'Add', newOrder: 'Order by link',
      stage: (current, total) => `Step ${current} of ${total}`,
    },
    tiles: {
      label: 'Your shopping at a glance', orders: 'Orders', ordersActive: count => `${count} in progress`, ordersTotal: count => `${count} total`, none: 'none yet',
      cart: 'Cart', cartEmpty: 'empty', balance: 'Balance', balanceSub: 'Atlas internal account',
      notifications: 'Notifications', unread: count => `${count} new`, noUnread: 'nothing new',
    },
    customs: {
      title: 'Monthly customs allowance', used: (used, limit) => `$${used} of $${limit}`, left: amount => `$${amount} left duty-free`,
      over: amount => `$${amount} over: customs duty may apply`,
      note: 'Only this month’s purchases through Atlas are counted, by order date. Track purchases made through other services yourself.', link: 'How customs is calculated',
      perPerson: 'The $200 allowance is per recipient.', empty: 'No orders this month yet — the allowance is free.', unnamed: 'No recipient given', cart: amount => `$${amount} more in the cart — keep it in mind at checkout.`,
    },
    recipients: {
      title: 'Recipients & addresses', lead: 'Filled in automatically at checkout.', primary: 'primary', passportOk: masked => `Passport ${masked}`,
      passportMissing: 'No passport added', addPassport: 'Add passport', remove: 'Remove', add: 'Add recipient', empty: 'No saved recipients yet.', edit: 'Edit', makePrimary: 'Make default',
    },
    documents: {
      title: 'Documents', passport: 'Passport', passportCount: count => `added: ${count}`, missing: 'not added',
      declarations: 'Declarations', declarationsCount: count => count ? `prepared: ${count}` : 'none yet', note: 'Invoices and warehouse photos are inside each order.',
    },
    support: {
      title: 'Support', lead: 'Replies arrive here and in notifications.', telegram: 'Message us on Telegram', waiting: 'Waiting for reply', answered: 'Reply received', closed: 'Closed',
      messages: count => `${count} ${count === 1 ? 'message' : 'messages'}`, history: 'Open conversation', team: 'Atlas support', you: 'You',
      replyPlaceholder: 'Your reply', reply: 'Reply', none: 'No tickets yet.', newTicket: 'New request', subject: 'Subject', question: 'Describe your question',
      send: 'Send', sent: 'Request sent.', aboutOrder: id => `Question about order ${id}`,
    },
    settings: { title: 'Settings', language: 'Language', theme: 'Theme', rules: 'Terms and data processing', signOut: 'Sign out' },
  },
};

export type OrdersCopy = {
  title: string;
  active: (count: number) => string;
  attention: (count: number) => string;
  showAttention: string;
  search: string;
  actionNeeded: string;
  stage: (current: number, total: number) => string;
  progress: string;
  placed: (date: string) => string;
  quantity: (count: number) => string;
  openStore: string;
  item: string;
  total: string;
  atCheckout: (amount: string) => string;
  delivery: string;
  tracking: string;
  payment: string;
  orderNumber: string;
  newOrder: string;
  cart: string;
  repeat: string;
  ask: string;
  allowance: string;
  allowanceValue: (used: number, limit: number) => string;
  recipients: string;
  allRecipients: string;
};

export type BalanceCopy = {
  title: string;
  label: string;
  note: string;
  spend: string;
  withdraw: string;
  withdrawTitle: string;
  withdrawText: string;
  close: string;
  reserve: string;
  reserveText: string;
  orders: string;
  history: string;
  operations: (count: number) => string;
  order: string;
  emptyTitle: string;
  emptyText: string;
  notice: string;
  signin: { title: string; text: string; action: string };
  loading: string;
};

export type NoticesCopy = {
  title: string;
  unread: (count: number) => string;
  allRead: string;
  readAll: string;
  filtersLabel: string;
  filters: { all: string; unread: string; orders: string };
  newBadge: string;
  more: (count: number) => string;
  openOrder: string;
  emptyTitle: string;
  emptyText: string;
  emptyFilter: string;
  orders: string;
  settings: string;
  signin: { title: string; text: string; action: string };
  loading: string;
};

export const ordersCopy: Record<Locale, OrdersCopy> = {
  ru: {
    title: 'Мои заказы', active: count => `${count} в работе`,
    attention: count => `Нужно ваше решение: ${orderCount(count, 'ru')}`, showAttention: 'Показать',
    search: 'Номер заказа или товар', actionNeeded: 'Нужно ваше действие', stage: (current, total) => `Этап ${current} из ${total}`, progress: 'Ход заказа',
    placed: date => `Оформлен ${date}`, quantity: count => `${count} шт.`, openStore: 'Открыть в магазине', item: 'Товар', total: 'Сумма заказа',
    atCheckout: amount => `при оформлении ${amount}`, delivery: 'Получатель', tracking: 'Отслеживание', payment: 'Оплата',
    orderNumber: 'Номер заказа', newOrder: 'Заказать по ссылке', cart: 'Корзина',
    repeat: 'Повторить заказ', ask: 'Вопрос по заказу', allowance: 'Лимит получателя', allowanceValue: (used, limit) => `$${used} из $${limit} в этом месяце`, recipients: 'Получатель', allRecipients: 'Все',
  },
  uz: {
    title: 'Buyurtmalarim', active: count => `${count} ta jarayonda`,
    attention: count => `Qaroringiz kerak: ${orderCount(count, 'uz')}`, showAttention: 'Ko‘rsatish',
    search: 'Buyurtma raqami yoki tovar', actionNeeded: 'Sizdan harakat kerak', stage: (current, total) => `Bosqich: ${current} / ${total}`, progress: 'Buyurtma jarayoni',
    placed: date => `Rasmiylashtirilgan: ${date}`, quantity: count => `${count} dona`, openStore: 'Do‘konda ochish', item: 'Tovar', total: 'Buyurtma summasi',
    atCheckout: amount => `rasmiylashtirishda ${amount}`, delivery: 'Qabul qiluvchi', tracking: 'Kuzatish', payment: 'To‘lov',
    orderNumber: 'Buyurtma raqami', newOrder: 'Havola orqali buyurtma', cart: 'Savat',
    repeat: 'Qayta buyurtma', ask: 'Buyurtma bo‘yicha savol', allowance: 'Qabul qiluvchi limiti', allowanceValue: (used, limit) => `bu oy $${used} / $${limit}`, recipients: 'Qabul qiluvchi', allRecipients: 'Barchasi',
  },
  en: {
    title: 'My orders', active: count => `${count} in progress`,
    attention: count => `Your decision is needed: ${orderCount(count, 'en')}`, showAttention: 'Show',
    search: 'Order number or item', actionNeeded: 'Action needed', stage: (current, total) => `Step ${current} of ${total}`, progress: 'Order progress',
    placed: date => `Placed ${date}`, quantity: count => `${count} pcs`, openStore: 'Open in store', item: 'Item', total: 'Order total',
    atCheckout: amount => `${amount} at checkout`, delivery: 'Recipient', tracking: 'Tracking', payment: 'Payment',
    orderNumber: 'Order number', newOrder: 'Order by link', cart: 'Cart',
    repeat: 'Order again', ask: 'Ask about this order', allowance: 'Recipient allowance', allowanceValue: (used, limit) => `$${used} of $${limit} this month`, recipients: 'Recipient', allRecipients: 'All',
  },
};

export const balanceCopy: Record<Locale, BalanceCopy> = {
  ru: {
    title: 'Баланс', label: 'Баланс Atlas', note: 'Внутренний счёт для расчётов по заказам — не банковская карта и не кошелёк.',
    spend: 'Заказать по ссылке', withdraw: 'Вывести', withdrawTitle: 'Вывод пока не подключён',
    withdrawText: 'Atlas ещё не подключил платёжного провайдера для перечисления средств. Этот экран не отправит запрос и не выполнит перевод. Баланс — внутренний учёт заказов, не банковский счёт.',
    close: 'Понятно', reserve: 'Резерв доставки в заказах', reserveText: 'Уже входит в суммы заказов. После взвешивания посылок остаток вернётся на баланс, а доплату выше резерва согласуем отдельно.',
    orders: 'Мои заказы', history: 'История операций', operations: count => `${count} ${ruPlural(count, 'операция', 'операции', 'операций')}`, order: 'Заказ',
    emptyTitle: 'Операций пока нет', emptyText: 'Здесь появятся возвраты разницы после взвешивания и оплата заказов с баланса.',
    notice: 'Платёжный провайдер и вывод средств пока не подключены. Переводы не выполняются.',
    signin: { title: 'Войдите, чтобы открыть баланс', text: 'Расчёты по заказам и возвратам хранятся в вашем профиле.', action: 'Войти' }, loading: 'Загружаем операции…',
  },
  uz: {
    title: 'Balans', label: 'Atlas balansi', note: 'Buyurtmalar bo‘yicha hisob-kitob uchun ichki hisob — bank kartasi yoki hamyon emas.',
    spend: 'Havola orqali buyurtma', withdraw: 'Yechib olish', withdrawTitle: 'Yechib olish hali ulanmagan',
    withdrawText: 'Atlas hali mablag‘ o‘tkazish uchun to‘lov provayderini ulamagan. Bu ekran so‘rov yubormaydi va pul o‘tkazmaydi. Balans — buyurtmalarning ichki hisobi, bank hisob raqami emas.',
    close: 'Tushunarli', reserve: 'Buyurtmalardagi yetkazish zaxirasi', reserveText: 'Buyurtma summalariga allaqachon kiritilgan. Posilkalar tortilgach qoldiq balansga qaytadi, zaxiradan ortiq to‘lov alohida kelishiladi.',
    orders: 'Buyurtmalarim', history: 'Amallar tarixi', operations: count => `${count} ta amal`, order: 'Buyurtma',
    emptyTitle: 'Hali amallar yo‘q', emptyText: 'Tortishdan keyingi farq qaytarilishi va balansdan to‘langan buyurtmalar shu yerda ko‘rinadi.',
    notice: 'To‘lov provayderi va pul yechib olish hali ulanmagan. O‘tkazmalar bajarilmaydi.',
    signin: { title: 'Balansni ochish uchun kiring', text: 'Buyurtma va qaytarishlar hisobi profilingizda saqlanadi.', action: 'Kirish' }, loading: 'Amallar yuklanmoqda…',
  },
  en: {
    title: 'Balance', label: 'Atlas balance', note: 'An internal account for order settlements — not a bank card or a wallet.',
    spend: 'Order by link', withdraw: 'Withdraw', withdrawTitle: 'Withdrawals are not connected',
    withdrawText: 'Atlas has not connected a payment provider for payouts. This screen will not submit a request or transfer funds. The balance is internal order accounting, not a bank account.',
    close: 'Got it', reserve: 'Delivery reserve in orders', reserveText: 'Already included in order totals. After parcels are weighed, any remainder returns to your balance; charges above the reserve are agreed separately.',
    orders: 'My orders', history: 'Transaction history', operations: count => `${count} ${count === 1 ? 'transaction' : 'transactions'}`, order: 'Order',
    emptyTitle: 'No transactions yet', emptyText: 'Refunds after weighing and orders paid from the balance will appear here.',
    notice: 'A payment provider and withdrawals are not connected yet. No transfers are made.',
    signin: { title: 'Sign in to open your balance', text: 'Order and refund settlements are saved in your profile.', action: 'Sign in' }, loading: 'Loading transactions…',
  },
};

export const noticesCopy: Record<Locale, NoticesCopy> = {
  ru: {
    title: 'Уведомления', unread: count => `${count} ${ruPlural(count, 'непрочитанное', 'непрочитанных', 'непрочитанных')}`, allRead: 'Всё прочитано',
    readAll: 'Прочитать все', filtersLabel: 'Показать', filters: { all: 'Все', unread: 'Непрочитанные', orders: 'По заказам' }, newBadge: 'Новое',
    more: count => `Ещё ${count} ${ruPlural(count, 'обновление', 'обновления', 'обновлений')}`, openOrder: 'Открыть заказ',
    emptyTitle: 'Пока всё спокойно', emptyText: 'Здесь появятся смена статусов, возвраты и вопросы по вашим заказам.', emptyFilter: 'Таких уведомлений нет.',
    orders: 'Мои заказы', settings: 'Настройки email и SMS',
    signin: { title: 'Войдите, чтобы открыть уведомления', text: 'Сообщения Atlas хранятся в вашем профиле.', action: 'Войти' }, loading: 'Загружаем уведомления…',
  },
  uz: {
    title: 'Bildirishnomalar', unread: count => `${count} ta o‘qilmagan`, allRead: 'Hammasi o‘qilgan',
    readAll: 'Hammasini o‘qilgan qilish', filtersLabel: 'Ko‘rsatish', filters: { all: 'Barchasi', unread: 'O‘qilmagan', orders: 'Buyurtmalar bo‘yicha' }, newBadge: 'Yangi',
    more: count => `Yana ${count} ta yangilanish`, openOrder: 'Buyurtmani ochish',
    emptyTitle: 'Hozircha hammasi tinch', emptyText: 'Holat o‘zgarishlari, qaytarishlar va buyurtmalaringiz bo‘yicha savollar shu yerda ko‘rinadi.', emptyFilter: 'Bunday bildirishnomalar yo‘q.',
    orders: 'Buyurtmalarim', settings: 'Email va SMS sozlamalari',
    signin: { title: 'Bildirishnomalarni ochish uchun kiring', text: 'Atlas xabarlari profilingizda saqlanadi.', action: 'Kirish' }, loading: 'Bildirishnomalar yuklanmoqda…',
  },
  en: {
    title: 'Notifications', unread: count => `${count} unread`, allRead: 'All caught up',
    readAll: 'Mark all as read', filtersLabel: 'Show', filters: { all: 'All', unread: 'Unread', orders: 'Orders' }, newBadge: 'New',
    more: count => `${count} more ${count === 1 ? 'update' : 'updates'}`, openOrder: 'Open order',
    emptyTitle: 'All quiet for now', emptyText: 'Status changes, refunds and questions about your orders will appear here.', emptyFilter: 'No matching notifications.',
    orders: 'My orders', settings: 'Email and SMS settings',
    signin: { title: 'Sign in to open notifications', text: 'Atlas messages are saved in your profile.', action: 'Sign in' }, loading: 'Loading notifications…',
  },
};

export type LinkOrderCopy = {
  title: string;
  lead: string;
  leadLoaded: string;
  label: string;
  placeholder: string;
  calculate: string;
  loading: string;
  hint: string;
  stores: string;
  batch: string;
  openStore: string;
  change: string;
  storePrice: string;
  checkedAt: (time: string) => string;
  unconfirmed: string;
  total: string;
  emptyTotal: string;
  data: string;
  dataHint: string;
  shippingReserve: string;
  storeShipping: (amount: string) => string;
  kg: string;
  add: string;
  addShort: string;
  signinAdd: string;
  guest: string;
  details: string;
  unnamed: string;
  fillFromStore: string;
};

export const linkOrderCopy: Record<Locale, LinkOrderCopy> = {
  ru: {
    title: 'Заказ по ссылке', lead: 'Вставьте ссылку на товар из любого магазина — посчитаем итог с доставкой до Ташкента.', leadLoaded: 'Выберите вариант и проверьте расчёт.',
    label: 'Ссылка на товар', placeholder: 'Вставьте ссылку на товар', calculate: 'Рассчитать', loading: 'Загружаем цену и варианты из магазина…',
    hint: 'Нужна ссылка на страницу товара: Nike, Zara, Amazon, eBay и другие магазины.', stores: 'Где это работает', batch: 'Добавить несколько ссылок',
    openStore: 'Открыть в магазине', change: 'Другая ссылка', storePrice: 'Цена в магазине', checkedAt: time => `проверено в ${time}`,
    unconfirmed: 'Магазин не подтвердил все данные — проверьте их ниже.', total: 'Итого с доставкой до Ташкента', emptyTotal: 'Укажите цену и вес — покажем итог.',
    data: 'Данные для расчёта', dataHint: 'Откройте, если что-то не совпадает со страницей магазина.', shippingReserve: 'доставка магазина: резерв', storeShipping: amount => `доставка магазина ${amount}`, kg: 'кг',
    add: 'Добавить в корзину', addShort: 'В корзину', signinAdd: 'Войти и продолжить', guest: 'Расчёт доступен без входа. Чтобы добавить товар в корзину, понадобится войти.', details: 'Подробности загрузки',
    unnamed: 'Название не получено — укажите его ниже', fillFromStore: 'Заполните по странице товара в магазине.',
  },
  uz: {
    title: 'Havola orqali buyurtma', lead: 'Istalgan do‘kondagi tovar havolasini qo‘ying — Toshkentgacha yetkazish bilan jami summani hisoblaymiz.', leadLoaded: 'Variantni tanlang va hisobni tekshiring.',
    label: 'Tovar havolasi', placeholder: 'Tovar havolasini qo‘ying', calculate: 'Hisoblash', loading: 'Do‘kondan narx va variantlar yuklanmoqda…',
    hint: 'Tovar sahifasi havolasi kerak: Nike, Zara, Amazon, eBay va boshqa do‘konlar.', stores: 'Qayerlarda ishlaydi', batch: 'Bir nechta havola qo‘shish',
    openStore: 'Do‘konda ochish', change: 'Boshqa havola', storePrice: 'Do‘kondagi narx', checkedAt: time => `${time} da tekshirildi`,
    unconfirmed: 'Do‘kon barcha ma’lumotlarni tasdiqlamadi — quyida tekshiring.', total: 'Toshkentgacha yetkazish bilan jami', emptyTotal: 'Narx va vaznni kiriting — jami summani ko‘rsatamiz.',
    data: 'Hisob uchun ma’lumotlar', dataHint: 'Do‘kon sahifasiga mos kelmasa, oching.', shippingReserve: 'do‘kon yetkazishi: zaxira', storeShipping: amount => `do‘kon yetkazishi ${amount}`, kg: 'kg',
    add: 'Savatga qo‘shish', addShort: 'Savatga', signinAdd: 'Kirish va davom etish', guest: 'Hisobni kirmasdan ko‘rish mumkin. Tovarni savatga qo‘shish uchun kirish kerak.', details: 'Yuklash tafsilotlari',
    unnamed: 'Nomi olinmadi — quyida kiriting', fillFromStore: 'Do‘kondagi tovar sahifasiga qarab to‘ldiring.',
  },
  en: {
    title: 'Order by link', lead: 'Paste a product link from any store — we will calculate the total with delivery to Tashkent.', leadLoaded: 'Choose an option and review the estimate.',
    label: 'Product link', placeholder: 'Paste a product link', calculate: 'Calculate', loading: 'Loading price and options from the store…',
    hint: 'Use a product page link: Nike, Zara, Amazon, eBay and other stores.', stores: 'Where it works', batch: 'Add several links',
    openStore: 'Open in store', change: 'Another link', storePrice: 'Store price', checkedAt: time => `checked at ${time}`,
    unconfirmed: 'The store did not confirm every detail — review them below.', total: 'Total with delivery to Tashkent', emptyTotal: 'Enter a price and weight to see the total.',
    data: 'Calculation details', dataHint: 'Open if anything differs from the store page.', shippingReserve: 'store delivery: reserve', storeShipping: amount => `store delivery ${amount}`, kg: 'kg',
    add: 'Add to cart', addShort: 'Add', signinAdd: 'Sign in and continue', guest: 'You can see the estimate without signing in. Sign in to add the item to your cart.', details: 'Import details',
    unnamed: 'No name received — enter it below', fillFromStore: 'Fill these in from the product page in the store.',
  },
};

export type RecipientCopy = {
  addTitle: string; editTitle: string; note: string;
  labelLegend: string; labels: { home: string; work: string; parents: string; other: string }; customLabel: string;
  name: string; nameHint: string; phone: string; phoneHint: string; phoneError: string;
  region: string; regionPlaceholder: string; city: string; address: string; addressPlaceholder: string;
  postal: string; comment: string; commentPlaceholder: string; optional: string;
  primary: string; save: string; saving: string; saved: string; updated: string; required: string; privacy: string;
};

export const recipientCopy: Record<Locale, RecipientCopy> = {
  ru: {
    addTitle: 'Новый получатель', editTitle: 'Изменить получателя', note: 'Тот, кто заберёт посылку. ФИО — как в паспорте.',
    labelLegend: 'Как подписать', labels: { home: 'Дом', work: 'Работа', parents: 'Родители', other: 'Другое' }, customLabel: 'Своя подпись',
    name: 'ФИО получателя', nameHint: 'Как в паспорте — так посылку выдадут без вопросов.',
    phone: 'Телефон', phoneHint: 'Курьер позвонит перед доставкой.', phoneError: 'Введите 9 цифр номера после +998.',
    region: 'Область', regionPlaceholder: 'Выберите область', city: 'Город или район', address: 'Улица, дом, квартира', addressPlaceholder: 'Например: ул. Навои, 15, кв. 4',
    postal: 'Индекс', comment: 'Комментарий для курьера', commentPlaceholder: 'Подъезд, ориентир, удобное время', optional: 'необязательно',
    primary: 'Основной получатель — подставляется в заказ сам', save: 'Сохранить получателя', saving: 'Сохраняем…', saved: 'Получатель сохранён.', updated: 'Изменения сохранены.',
    required: 'Заполните это поле.', privacy: 'Подсказки работают на устройстве — адрес не уходит в сторонние сервисы поиска.',
  },
  uz: {
    addTitle: 'Yangi qabul qiluvchi', editTitle: 'Qabul qiluvchini o‘zgartirish', note: 'Posilkani oladigan odam. F.I.Sh. — pasportdagidek.',
    labelLegend: 'Qanday nomlash', labels: { home: 'Uy', work: 'Ish', parents: 'Ota-ona', other: 'Boshqa' }, customLabel: 'O‘z nomingiz',
    name: 'Qabul qiluvchining F.I.Sh.', nameHint: 'Pasportdagidek — shunda posilka muammosiz beriladi.',
    phone: 'Telefon', phoneHint: 'Kuryer yetkazishdan oldin qo‘ng‘iroq qiladi.', phoneError: '+998 dan keyin 9 ta raqamni kiriting.',
    region: 'Viloyat', regionPlaceholder: 'Viloyatni tanlang', city: 'Shahar yoki tuman', address: 'Ko‘cha, uy, xonadon', addressPlaceholder: 'Masalan: Navoiy ko‘chasi, 15-uy, 4-xonadon',
    postal: 'Indeks', comment: 'Kuryer uchun izoh', commentPlaceholder: 'Podyezd, mo‘ljal, qulay vaqt', optional: 'ixtiyoriy',
    primary: 'Asosiy qabul qiluvchi — buyurtmaga avtomatik qo‘yiladi', save: 'Qabul qiluvchini saqlash', saving: 'Saqlanmoqda…', saved: 'Qabul qiluvchi saqlandi.', updated: 'O‘zgarishlar saqlandi.',
    required: 'Bu maydonni to‘ldiring.', privacy: 'Maslahatlar qurilmangizda ishlaydi — manzil tashqi qidiruv xizmatlariga yuborilmaydi.',
  },
  en: {
    addTitle: 'New recipient', editTitle: 'Edit recipient', note: 'The person who will collect the parcel. Full name as in the passport.',
    labelLegend: 'Label', labels: { home: 'Home', work: 'Work', parents: 'Parents', other: 'Other' }, customLabel: 'Your own label',
    name: 'Recipient’s full name', nameHint: 'As in the passport, so the parcel is handed over without questions.',
    phone: 'Phone', phoneHint: 'The courier calls before delivery.', phoneError: 'Enter the 9 digits after +998.',
    region: 'Region', regionPlaceholder: 'Choose a region', city: 'City or district', address: 'Street, building, apartment', addressPlaceholder: 'For example: Navoi St 15, apt 4',
    postal: 'Postal code', comment: 'Note for the courier', commentPlaceholder: 'Entrance, landmark, convenient time', optional: 'optional',
    primary: 'Default recipient — filled in at checkout', save: 'Save recipient', saving: 'Saving…', saved: 'Recipient saved.', updated: 'Changes saved.',
    required: 'Fill in this field.', privacy: 'Suggestions run on your device — the address is not sent to third-party search.',
  },
};

export type DocsCopy = {
  title: string; lead: string; whose: string; whoseHint: string; noRecipient: string; addRecipient: string;
  passportOk: (masked: string) => string; passportMissing: string; uploadStep: string; replaceStep: string; checkStep: string;
  pickFirst: string; uploaded: string; uploadedFilled: string; autoFailed: string; confirmedToast: string; deleteConfirm: string; deleted: string;
  loadError: string; uploadError: string; deleteError: string; scans: string;
  declTitle: string; declLead: string; need: string; needRecipient: string; needPassport: string; needOrders: string; addPassport: string; newOrder: string;
  ordersFor: (name: string) => string; selectGroup: string; usd: (amount: number) => string; overLimit: string; history: string;
};

export const docsCopy: Record<Locale, DocsCopy> = {
  ru: {
    title: 'Паспорт получателя', lead: 'Нужен для таможенного оформления посылки. Скан и данные видите только вы.',
    whose: 'Чей паспорт', whoseHint: 'Паспорт привязывается к получателю — тому, кто заберёт посылку.', noRecipient: 'Сначала добавьте получателя.', addRecipient: 'Добавить получателя',
    passportOk: masked => `Паспорт ${masked}`, passportMissing: 'паспорт не добавлен', uploadStep: 'Фото разворота', replaceStep: 'Заменить скан', checkStep: 'Проверьте данные',
    pickFirst: 'Выберите получателя выше.', uploaded: 'Скан загружен — проверьте и заполните данные.', uploadedFilled: 'Скан загружен, найденные данные заполнены.',
    autoFailed: 'Автораспознавание не сработало — поля можно заполнить вручную.', confirmedToast: 'Паспортные данные подтверждены.', deleteConfirm: 'Удалить скан паспорта из защищённого хранилища?', deleted: 'Скан удалён.',
    loadError: 'Не удалось загрузить документы.', uploadError: 'Не удалось загрузить документ.', deleteError: 'Не удалось удалить документ.', scans: 'Загруженные сканы',
    declTitle: 'Декларация', declLead: 'Соберём черновик из ваших заказов и подтверждённого паспорта — без повторного ввода.', need: 'Что нужно для декларации',
    needRecipient: 'Получатель', needPassport: 'Паспорт получателя', needOrders: 'Хотя бы один заказ', addPassport: 'Добавить паспорт', newOrder: 'Заказать по ссылке',
    ordersFor: name => `Заказы для: ${name}`, selectGroup: 'Выбрать все', usd: amount => `≈ $${amount}`, overLimit: 'Больше $200 — сверх лимита возможна пошлина.', history: 'Черновики деклараций',
  },
  uz: {
    title: 'Qabul qiluvchi pasporti', lead: 'Posilkani bojxonada rasmiylashtirish uchun kerak. Skan va ma’lumotlarni faqat siz ko‘rasiz.',
    whose: 'Kimning pasporti', whoseHint: 'Pasport qabul qiluvchiga — posilkani oladigan odamga bog‘lanadi.', noRecipient: 'Avval qabul qiluvchini qo‘shing.', addRecipient: 'Qabul qiluvchi qo‘shish',
    passportOk: masked => `Pasport ${masked}`, passportMissing: 'pasport qo‘shilmagan', uploadStep: 'Pasport sahifasi surati', replaceStep: 'Skanni almashtirish', checkStep: 'Ma’lumotlarni tekshiring',
    pickFirst: 'Yuqorida qabul qiluvchini tanlang.', uploaded: 'Skan yuklandi — ma’lumotlarni tekshirib to‘ldiring.', uploadedFilled: 'Skan yuklandi, topilgan ma’lumotlar to‘ldirildi.',
    autoFailed: 'Avtomatik aniqlash ishlamadi — maydonlarni qo‘lda to‘ldirish mumkin.', confirmedToast: 'Pasport ma’lumotlari tasdiqlandi.', deleteConfirm: 'Pasport skani himoyalangan omborxonadan o‘chirilsinmi?', deleted: 'Skan o‘chirildi.',
    loadError: 'Hujjatlarni yuklab bo‘lmadi.', uploadError: 'Hujjatni yuklab bo‘lmadi.', deleteError: 'Hujjatni o‘chirib bo‘lmadi.', scans: 'Yuklangan skanlar',
    declTitle: 'Deklaratsiya', declLead: 'Buyurtmalaringiz va tasdiqlangan pasportdan qoralama tayyorlaymiz — qayta kiritmasdan.', need: 'Deklaratsiya uchun nima kerak',
    needRecipient: 'Qabul qiluvchi', needPassport: 'Qabul qiluvchi pasporti', needOrders: 'Kamida bitta buyurtma', addPassport: 'Pasport qo‘shish', newOrder: 'Havola orqali buyurtma',
    ordersFor: name => `Buyurtmalar: ${name}`, selectGroup: 'Hammasini tanlash', usd: amount => `≈ $${amount}`, overLimit: '$200 dan ko‘p — limitdan ortiq qismga boj bo‘lishi mumkin.', history: 'Deklaratsiya qoralamalari',
  },
  en: {
    title: 'Recipient passport', lead: 'Needed to clear the parcel through customs. Only you can see the scan and details.',
    whose: 'Whose passport', whoseHint: 'A passport belongs to a recipient — the person who collects the parcel.', noRecipient: 'Add a recipient first.', addRecipient: 'Add recipient',
    passportOk: masked => `Passport ${masked}`, passportMissing: 'no passport yet', uploadStep: 'Photo page', replaceStep: 'Replace scan', checkStep: 'Check the details',
    pickFirst: 'Choose a recipient above.', uploaded: 'Scan uploaded — check and complete the details.', uploadedFilled: 'Scan uploaded; the details found were filled in.',
    autoFailed: 'Automatic reading did not work — you can fill in the fields yourself.', confirmedToast: 'Passport details confirmed.', deleteConfirm: 'Delete the passport scan from protected storage?', deleted: 'Scan deleted.',
    loadError: 'Could not load documents.', uploadError: 'Could not upload the document.', deleteError: 'Could not delete the document.', scans: 'Uploaded scans',
    declTitle: 'Declaration', declLead: 'We build a draft from your orders and the confirmed passport — nothing to retype.', need: 'What a declaration needs',
    needRecipient: 'A recipient', needPassport: 'The recipient’s passport', needOrders: 'At least one order', addPassport: 'Add passport', newOrder: 'Order by link',
    ordersFor: name => `Orders for: ${name}`, selectGroup: 'Select all', usd: amount => `≈ $${amount}`, overLimit: 'Over $200 — duty may apply above the allowance.', history: 'Declaration drafts',
  },
};

type NotFoundCopy = { title: string; text: string; home: string; paste: string; stores: string };

/** Unknown addresses keep the site shell and offer the main ways back. */
export const notFoundCopy: Record<Locale, NotFoundCopy> = {
  ru: { title: 'Страница не найдена', text: 'Ссылка устарела или в адресе опечатка. Начните с главной или вставьте ссылку на товар — посчитаем итог в сумах.', home: 'На главную', paste: 'Вставить ссылку на товар', stores: 'Магазины' },
  uz: { title: 'Sahifa topilmadi', text: 'Havola eskirgan yoki manzilda xato bor. Bosh sahifadan boshlang yoki tovar havolasini qo‘ying — yakuniy narxni so‘mda hisoblab beramiz.', home: 'Bosh sahifa', paste: 'Tovar havolasini qo‘yish', stores: 'Do‘konlar' },
  en: { title: 'Page not found', text: 'The link may be out of date or the address has a typo. Start from the home page or paste a product link and we’ll work out the total in soum.', home: 'Home page', paste: 'Paste a product link', stores: 'Stores' },
};