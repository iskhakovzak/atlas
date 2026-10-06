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
    parcelReserve: (missing: string) => string;
    /** Results of the live check with the store. */
    priceUp: (from: string, to: string) => string; priceDown: (from: string, to: string) => string; shippingChanged: (from: string, to: string) => string;
    issues: { currency: string; variant: string; price: string; unreachable: string; stock: string }; reload: string; checked: (time: string) => string;
  };
  services: { title: string; optional: string; hint: string; fixed: string; quote: string; notIncluded: string; quantity: string; required: string; units: { package: string; item: string; day: string; photo: string; 'half-hour': string } };
  /** Several options of one product (sizes, colors): one note and one set of services for all of them (owner, 7.10.2026). */
  shared: { title: string; services: string };
  summary: {
    title: string; items: string; storeShipping: string; storeNoReserve: string; storeShippingHelp: (freeFrom: string) => string; service: string; serviceHelp: string; serviceHelpLabel: string;
    international: string; internationalHelp: string; internationalHelpLabel: string; reserve: string; reserveHelp: string; reserveHelpLabel: string;
    optional: string; balance: string; available: string; fromBalance: string; payable: string; checkout: string; renew: string;
    validFor: (time: string) => string; checking: string; expired: string; assurance: string; continue: string; outside: string;
    verifying: string; recheckNote: string;
  };
  sticky: { label: string; checkout: string };
  checkout: {
    title: string; hint: string; reviewTitle: string; reviewHint: string; saved: string; primary: string; passportOk: string; passportMissing: string;
    newRecipient: string; recipient: string; phone: string; region: string; city: string; street: string; streetPlaceholder: string;
    postal: string; postalHint: string; postalMissing: string; comment: string; next: string; edit: string; consent: Sentence; consentRequired: string;
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
    due: string; orderNo: (id: string) => string; noCharge: string;
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
  settings: {
    title: string; language: string; theme: string; rules: string; signOut: string;
    support: string; privacy: string; terms: string;
    consents: string; consentsNone: string; consentsAccept: string; consentVersion: (version: string) => string; consentDoc: Record<'privacy' | 'terms', string>;
    restore: string; restored: (orders: number) => string;
    about: string; aboutVersion: (version: string, build: string) => string; aboutPlatform: Record<'ios' | 'android', string>; aboutLink: string;
  };
  deletion: {
    title: string; lead: string; open: string; removed: string; removedList: string[]; kept: string; keptList: string[];
    blocked: (count: number) => string; blockedHint: string; orders: string; support: string; supportSubject: string;
    autoCancel: (count: number) => string; balance: (sum: string) => string; confirm: string; cancel: string; done: string; failed: string;
  };
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
    empty: { title: 'Корзина пуста', text: 'Вставьте ссылку на товар из зарубежного магазина, и мы посчитаем цену с доставкой до Ташкента.', paste: 'Вставить ссылку', stores: 'Смотреть магазины' },
    item: { remove: 'Удалить', decrease: 'Уменьшить количество', increase: 'Увеличить количество', quantity: 'Количество', storePrice: 'В магазине', openStore: 'Открыть в магазине', parcelFrom: store => `Посылка из ${store}`, forQuantity: count => `за ${count} шт.`,
      parcelReserve: missing => `Доставка магазина уточняется. Ещё ${missing} из этого магазина — и она бесплатна.`,
      priceUp: (from, to) => `Цена в магазине выросла: ${from} → ${to}. Итог пересчитан.`,
      priceDown: (from, to) => `Цена в магазине снизилась: ${from} → ${to}. Итог пересчитан.`,
      shippingChanged: (from, to) => `Доставка магазина изменилась: ${from} → ${to}.`,
      issues: { currency: 'Магазин сменил валюту витрины — откройте товар заново.', variant: 'Этот вариант больше не найден в магазине — выберите его заново.', price: 'Магазин не подтвердил цену — откройте товар заново.', unreachable: 'Магазин не ответил при проверке. Atlas сверит цену перед выкупом.', stock: 'У магазина осталось меньше, чем в корзине, — уменьшите количество.' },
      reload: 'Открыть товар', checked: time => `Цена сверена с магазином в ${time}` },
    services: {
      title: 'Услуги склада', optional: 'по желанию',
      hint: 'Отметьте пожелания. Оператор проверит возможность после приёмки; услугу выполнят только после показа точной суммы и вашего согласия.',
      fixed: 'Тариф', quote: 'Цену назовёт оператор', notIncluded: 'не входит в сумму заказа', quantity: 'Количество', required: 'обязательно',
      units: { package: 'посылка', item: 'шт.', day: 'день', photo: 'фото', 'half-hour': '30 мин' },
    },
    shared: { title: 'Комментарий и услуги склада — общие для всех вариантов этого товара', services: 'Выбранные услуги применяются к каждому варианту.' },
    summary: {
      title: 'Итого', items: 'Товары', storeShipping: 'Доставка магазина', storeNoReserve: 'Без резерва', service: 'Сервис Atlas',
      storeShippingHelp: freeFrom => `Если магазин не указал цену доставки до нашего склада, держим резерв $10 — один на заказ из магазина, отдельно от суммы к оплате. При товарах из одного магазина дороже ${freeFrom} резерва нет: доставка магазина для вас бесплатна. Если магазин всё же возьмёт плату, доплата — только с вашего согласия.`,
      serviceHelp: 'Выкуп товара, оплата в валюте магазина и сопровождение заказа до выдачи.', serviceHelpLabel: 'Что входит в сервис Atlas',
      international: 'Доставка в Узбекистан',
      internationalHelp: 'Товары одного магазина едут одной посылкой: вес складывается, упаковка учитывается один раз. Минимальный оплачиваемый вес посылки — 1 кг.',
      internationalHelpLabel: 'Как считается доставка',
      reserve: 'Возвратный резерв', reserveHelp: reserveHelp.ru, reserveHelpLabel: 'Что такое возвратный резерв',
      optional: 'Общий сбор Atlas', balance: 'Оплатить с баланса Atlas', available: 'Доступно', fromBalance: 'С баланса Atlas', payable: 'К оплате',
      checkout: 'Оформить заказ', renew: 'Обновить расчёт', validFor: time => `Цена зафиксирована ещё ${time}`, checking: 'Проверяем срок цены…',
      expired: 'Срок расчёта истёк — обновите цену перед оформлением.', assurance: 'Оплата — только с вашего согласия',
      continue: 'Продолжить покупки', outside: 'Не входит в сумму к оплате',
      verifying: 'Сверяем цены…', recheckNote: 'Перед оформлением сверим цены с магазинами.',
    },
    sticky: { label: 'Итог корзины', checkout: 'Оформить' },
    checkout: {
      title: 'Получатель и адрес', hint: 'Кому и куда доставить посылку по Узбекистану.', reviewTitle: 'Проверьте заказ', reviewHint: 'Последний шаг: проверьте получателя, состав и сумму.',
      saved: 'Кому доставить', primary: 'основной', passportOk: 'Паспорт добавлен', passportMissing: 'Паспорт не добавлен',
      newRecipient: 'Новый получатель', recipient: 'Получатель (ФИО)', phone: 'Телефон',
      region: 'Область', city: 'Город', street: 'Улица, дом, квартира', streetPlaceholder: 'Начните вводить улицу',
      postal: 'Почтовый индекс', postalHint: '6 цифр, например 100000.', postalMissing: 'У этого получателя не указан индекс. Сохраним его в профиле получателя.', comment: 'Комментарий для курьера',
      next: 'Далее: проверка', edit: 'Изменить',
      consent: { before: 'Я ознакомлен(а) с ', link: 'таможенными условиями', after: ' и понимаю, что сверх месячного лимита платится пошлина.' },
      consentRequired: 'Отметьте согласие с таможенными условиями.',
      serviceNotAdded: 'не входит в итог до вашего согласия', servicePriceLater: 'цена после проверки оператора',
      confirm: 'Подтвердить предзаказ', saving: 'Сохраняем заказ…',
      preorderNote: 'Предзаказ сохранится в вашем кабинете Atlas. Оплата и доставка через сайт не подключены — деньги не списываются.', estimated: 'К оплате',
      saveRecipient: 'Сохранить получателя в профиле — для следующих заказов и паспорта',
    },
    success: {
      title: 'Предзаказ оформлен', hint: 'Оплата на сайте не подключена: Atlas не списывает деньги и не создаёт отправку.',
      statusTitle: 'Статус заказа обновлён', saved: 'В Atlas записана отметка об оплате. Провайдер не подключён, деньги не списывались.',
      pending: 'Заказ сохранён в кабинете. Оплата на сайте не подключена, поэтому деньги не списываются.', confirm: 'Записать отметку в Atlas',
      updating: 'Обновляем…', orders: 'Открыть заказы', noCharge: 'Деньги не списываются, письма и SMS не отправляются, доставка не создаётся.',
    },
  },
  uz: {
    title: 'Savat',
    steps: ['Savat', 'Qabul qiluvchi', 'Tasdiqlash'],
    stepsLabel: 'Rasmiylashtirish bosqichlari',
    loading: 'Savat yuklanmoqda…',
    signin: { title: 'Savatni ochish uchun kiring', text: 'Savat va buyurtmalar Atlas profilingizda saqlanadi.', action: 'Kirish' },
    empty: { title: 'Savat bo‘sh', text: 'Xorijiy do‘kondagi tovar havolasini qo‘ying, Toshkentgacha yetkazish bilan narxini hisoblaymiz.', paste: 'Havolani qo‘yish', stores: 'Do‘konlarni ko‘rish' },
    item: { remove: 'O‘chirish', decrease: 'Miqdorni kamaytirish', increase: 'Miqdorni oshirish', quantity: 'Miqdor', storePrice: 'Do‘konda', openStore: 'Do‘konda ochish', parcelFrom: store => `${store} posilkasi`, forQuantity: count => `${count} dona uchun`,
      parcelReserve: missing => `Do‘kon yetkazishi aniqlanmoqda. Bu do‘kondan yana ${missing} — va u bepul.`,
      priceUp: (from, to) => `Do‘kondagi narx oshdi: ${from} → ${to}. Jami qayta hisoblandi.`,
      priceDown: (from, to) => `Do‘kondagi narx tushdi: ${from} → ${to}. Jami qayta hisoblandi.`,
      shippingChanged: (from, to) => `Do‘kon yetkazishi o‘zgardi: ${from} → ${to}.`,
      issues: { currency: 'Do‘kon valyutani o‘zgartirdi — tovarni qayta oching.', variant: 'Bu variant do‘konda topilmadi — uni qayta tanlang.', price: 'Do‘kon narxni tasdiqlamadi — tovarni qayta oching.', unreachable: 'Tekshiruvda do‘kon javob bermadi. Atlas xariddan oldin narxni tekshiradi.', stock: 'Do‘konda savatdagidan kam qoldi — sonini kamaytiring.' },
      reload: 'Tovarni ochish', checked: time => `Narx do‘kon bilan ${time} da tekshirildi` },
    services: {
      title: 'Ombor xizmatlari', optional: 'ixtiyoriy',
      hint: 'Istaklaringizni belgilang. Operator qabuldan keyin imkoniyatni tekshiradi; xizmat faqat aniq narx ko‘rsatilib, roziligingiz olingandan so‘ng bajariladi.',
      fixed: 'Tarif', quote: 'Narxni operator aytadi', notIncluded: 'buyurtma summasiga kirmaydi', quantity: 'Miqdor', required: 'majburiy',
      units: { package: 'posilka', item: 'dona', day: 'kun', photo: 'foto', 'half-hour': '30 daqiqa' },
    },
    shared: { title: 'Izoh va ombor xizmatlari — shu tovarning barcha variantlari uchun umumiy', services: 'Tanlangan xizmatlar har bir variantga qo‘llanadi.' },
    summary: {
      title: 'Jami', items: 'Tovarlar', storeShipping: 'Do‘kon yetkazishi', storeNoReserve: 'Zaxirasiz', service: 'Atlas xizmati',
      storeShippingHelp: freeFrom => `Do‘kon omborimizgacha yetkazish narxini ko‘rsatmasa, $10 zaxira ushlab turamiz — do‘kondan bitta buyurtmaga bir marta, to‘lov summasidan alohida. Bitta do‘kondan ${freeFrom} dan qimmat tovarlarga zaxira yo‘q: do‘kon yetkazishi siz uchun bepul. Do‘kon baribir haq olsa, qo‘shimcha to‘lov — faqat roziligingiz bilan.`,
      serviceHelp: 'Tovarni sotib olish, do‘kon valyutasida to‘lash va buyurtmani topshirishgacha kuzatib borish.', serviceHelpLabel: 'Atlas xizmatiga nimalar kiradi',
      international: 'O‘zbekistonga yetkazish',
      internationalHelp: 'Bir do‘kon tovarlari bitta posilkada keladi: vazn qo‘shiladi, qadoq bir marta hisoblanadi. Posilkaning minimal to‘lovli vazni — 1 kg.',
      internationalHelpLabel: 'Yetkazish qanday hisoblanadi',
      reserve: 'Qaytariladigan zaxira', reserveHelp: reserveHelp.uz, reserveHelpLabel: 'Qaytariladigan zaxira nima',
      optional: 'Atlas umumiy yig‘imi', balance: 'Atlas balansidan to‘lash', available: 'Mavjud', fromBalance: 'Atlas balansidan', payable: 'To‘lash uchun',
      checkout: 'Buyurtmani rasmiylashtirish', renew: 'Hisobni yangilash', validFor: time => `Narx yana ${time} amal qiladi`, checking: 'Narx muddati tekshirilmoqda…',
      expired: 'Hisob muddati tugadi — rasmiylashtirishdan oldin narxni yangilang.', assurance: 'To‘lov — faqat roziligingiz bilan',
      continue: 'Xaridni davom ettirish', outside: 'To‘lov summasiga kirmaydi',
      verifying: 'Narxlar tekshirilmoqda…', recheckNote: 'Rasmiylashtirishdan oldin narxlarni do‘konlar bilan tekshiramiz.',
    },
    sticky: { label: 'Savat jami', checkout: 'Rasmiylashtirish' },
    checkout: {
      title: 'Qabul qiluvchi va manzil', hint: 'Posilkani O‘zbekistonda kimga va qayerga yetkazamiz.', reviewTitle: 'Buyurtmani tekshiring', reviewHint: 'Oxirgi qadam: qabul qiluvchi, tarkib va summani tekshiring.',
      saved: 'Kimga yetkazamiz', primary: 'asosiy', passportOk: 'Pasport qo‘shilgan', passportMissing: 'Pasport qo‘shilmagan',
      newRecipient: 'Yangi qabul qiluvchi', recipient: 'Qabul qiluvchi (F.I.Sh.)', phone: 'Telefon',
      region: 'Viloyat', city: 'Shahar', street: 'Ko‘cha, uy, xonadon', streetPlaceholder: 'Ko‘cha nomini yozing',
      postal: 'Pochta indeksi', postalHint: '6 ta raqam, masalan 100000.', postalMissing: 'Bu qabul qiluvchida indeks ko‘rsatilmagan. Uni qabul qiluvchi profilida saqlaymiz.', comment: 'Kuryer uchun izoh',
      next: 'Keyingi: tekshirish', edit: 'O‘zgartirish',
      consent: { before: '', link: 'Bojxona shartlari', after: ' bilan tanishdim va oylik limitdan oshgan qismga boj to‘lanishini tushunaman.' },
      consentRequired: 'Bojxona shartlariga roziligingizni belgilang.',
      serviceNotAdded: 'roziligingizgacha jamiga kirmaydi', servicePriceLater: 'narx operator tekshiruvidan so‘ng',
      confirm: 'Oldindan buyurtmani tasdiqlash', saving: 'Buyurtma saqlanmoqda…',
      preorderNote: 'Oldindan buyurtma Atlas kabinetingizda saqlanadi. Sayt orqali to‘lov va yetkazish ulanmagan — pul yechilmaydi.', estimated: 'To‘lov uchun',
      saveRecipient: 'Qabul qiluvchini profilga saqlash — keyingi buyurtmalar va pasport uchun',
    },
    success: {
      title: 'Oldindan buyurtma yaratildi', hint: 'Saytda to‘lov ulanmagan: Atlas pul yechmaydi va jo‘natma yaratmaydi.',
      statusTitle: 'Buyurtma holati yangilandi', saved: 'To‘lov belgisi Atlas’da qayd etildi. Provayder ulanmagan, pul yechilmadi.',
      pending: 'Buyurtma kabinetda saqlandi. Saytda to‘lov ulanmagan, shuning uchun pul yechilmaydi.', confirm: 'Atlas’da belgini qayd etish',
      updating: 'Yangilanmoqda…', orders: 'Buyurtmalarni ochish', noCharge: 'Pul yechilmaydi, xat va SMS yuborilmaydi, yetkazish yaratilmaydi.',
    },
  },
  en: {
    title: 'Cart',
    steps: ['Cart', 'Recipient', 'Confirmation'],
    stepsLabel: 'Checkout steps',
    loading: 'Loading cart…',
    signin: { title: 'Sign in to open your cart', text: 'Your cart and orders are saved to your Atlas profile.', action: 'Sign in' },
    empty: { title: 'Your cart is empty', text: 'Paste a product link from a store abroad and we calculate the price with delivery to Tashkent.', paste: 'Paste a link', stores: 'Browse stores' },
    item: { remove: 'Remove', decrease: 'Decrease quantity', increase: 'Increase quantity', quantity: 'Quantity', storePrice: 'In store', openStore: 'Open in store', parcelFrom: store => `Parcel from ${store}`, forQuantity: count => `for ${count}`,
      parcelReserve: missing => `Store delivery is being confirmed. Add ${missing} more from this store and it is free.`,
      priceUp: (from, to) => `The store price went up: ${from} → ${to}. Total recalculated.`,
      priceDown: (from, to) => `The store price went down: ${from} → ${to}. Total recalculated.`,
      shippingChanged: (from, to) => `Store delivery changed: ${from} → ${to}.`,
      issues: { currency: 'The store changed its currency — open the item again.', variant: 'This option is no longer listed — choose it again.', price: 'The store did not confirm the price — open the item again.', unreachable: 'The store did not answer the check. Atlas confirms the price before buying.', stock: 'The store has fewer left than your cart asks for — lower the quantity.' },
      reload: 'Open item', checked: time => `Price checked with the store at ${time}` },
    services: {
      title: 'Warehouse services', optional: 'optional',
      hint: 'Choose preferences. An operator checks feasibility after intake; work starts only after the exact price is shown and you approve it.',
      fixed: 'Rate', quote: 'Operator will quote', notIncluded: 'not included in the order total', quantity: 'Quantity', required: 'required',
      units: { package: 'package', item: 'item', day: 'day', photo: 'photo', 'half-hour': '30 min' },
    },
    shared: { title: 'Note and warehouse services are shared by every option of this item', services: 'Chosen services apply to each option.' },
    summary: {
      title: 'Summary', items: 'Items', storeShipping: 'Store delivery', storeNoReserve: 'No reserve', service: 'Atlas service',
      storeShippingHelp: freeFrom => `When a store does not state delivery to our warehouse, we hold a $10 reserve — once per store order, apart from the amount to pay. Over ${freeFrom} of items from one store there is no reserve: store delivery is free for you. If the store still charges, any extra payment needs your consent.`,
      serviceHelp: 'Buying the item, paying in the store’s currency and handling the order until pickup.', serviceHelpLabel: 'What the Atlas service covers',
      international: 'Delivery to Uzbekistan',
      internationalHelp: 'Items from one store travel as one parcel: weights add up and packaging counts once. The minimum billable parcel weight is 1 kg.',
      internationalHelpLabel: 'How delivery is calculated',
      reserve: 'Refundable reserve', reserveHelp: reserveHelp.en, reserveHelpLabel: 'What the refundable reserve is',
      optional: 'General Atlas fee', balance: 'Pay from Atlas balance', available: 'Available', fromBalance: 'From Atlas balance', payable: 'To pay',
      checkout: 'Check out', renew: 'Refresh estimate', validFor: time => `Price held for ${time}`, checking: 'Checking price validity…',
      expired: 'The estimate expired — refresh the price before checkout.', assurance: 'Payment only with your approval',
      continue: 'Continue shopping', outside: 'Not in the amount to pay',
      verifying: 'Checking prices…', recheckNote: 'We check prices with the stores before checkout.',
    },
    sticky: { label: 'Cart total', checkout: 'Check out' },
    checkout: {
      title: 'Recipient and address', hint: 'Who receives the parcel and where in Uzbekistan.', reviewTitle: 'Review your order', reviewHint: 'Last step: check the recipient, items and total.',
      saved: 'Deliver to', primary: 'primary', passportOk: 'Passport added', passportMissing: 'No passport added',
      newRecipient: 'New recipient', recipient: 'Recipient (full name)', phone: 'Phone',
      region: 'Region', city: 'City', street: 'Street, building, apartment', streetPlaceholder: 'Start typing a street',
      postal: 'Postal code', postalHint: '6 digits, for example 100000.', postalMissing: 'This recipient has no postal code yet. We will save it to the recipient.', comment: 'Note for the courier',
      next: 'Next: review', edit: 'Edit',
      consent: { before: 'I have read the ', link: 'customs terms', after: ' and understand that duty applies above the monthly allowance.' },
      consentRequired: 'Please confirm the customs terms.',
      serviceNotAdded: 'not added until you approve', servicePriceLater: 'price after operator review',
      confirm: 'Confirm pre-order', saving: 'Saving order…',
      preorderNote: 'Your pre-order is saved in your Atlas account. Payment and delivery through the site are not connected — no money is charged.', estimated: 'To pay',
      saveRecipient: 'Save this recipient to your profile — for next orders and the passport',
    },
    success: {
      title: 'Pre-order created', hint: 'Online payment is not connected: Atlas does not charge or ship orders.',
      statusTitle: 'Order status updated', saved: 'Atlas recorded a payment status. No provider is connected and no money was charged.',
      pending: 'The order is saved in your account. Online payment is not connected, so no money is charged.', confirm: 'Record status in Atlas',
      updating: 'Updating…', orders: 'View orders', noCharge: 'No money is charged, no email or SMS is sent, and no delivery is created.',
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
      due: 'К оплате', orderNo: id => `Заказ ${id}`, noCharge: 'Оплата на сайте не подключена: деньги не списываются.',
    },
    tiles: {
      label: 'Коротко о покупках', orders: 'Заказы', ordersActive: count => `${count} в работе`, ordersTotal: count => `всего ${count}`, none: 'пока нет',
      cart: 'Корзина', cartEmpty: 'пусто', balance: 'Баланс', balanceSub: 'внутренний счёт Atlas',
      notifications: 'Уведомления', unread: count => `${count} ${ruPlural(count, 'новое', 'новых', 'новых')}`, noUnread: 'нет новых',
    },
    customs: {
      title: 'Таможенный лимит месяца', used: (used, limit) => `$${used} из $${limit}`, left: amount => `Ещё $${amount} без пошлины`,
      over: amount => `Сверх лимита $${amount} — с этой суммы платится пошлина`,
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
    settings: {
      title: 'Настройки', language: 'Язык', theme: 'Тема', rules: 'Правила и обработка данных', signOut: 'Выйти из аккаунта',
      support: 'Поддержка и помощь', privacy: 'Политика конфиденциальности', terms: 'Условия использования',
      consents: 'Согласия', consentsNone: 'Не зафиксированы', consentsAccept: 'Принять', consentVersion: version => `редакция ${version}`, consentDoc: { privacy: 'Политика конфиденциальности', terms: 'Условия использования' },
      restore: 'Восстановить покупки', restored: orders => `В Atlas нет встроенных покупок App Store и Google Play. Заказы (${orders}) и баланс восстановлены из вашего аккаунта.`,
      about: 'О приложении', aboutVersion: (version, build) => `Версия ${version} (${build})`, aboutPlatform: { ios: 'iOS', android: 'Android' }, aboutLink: 'Подробнее о приложении',
    },
    deletion: {
      title: 'Удалить аккаунт', lead: 'Аккаунт и личные данные будут удалены без возможности восстановления.', open: 'Удалить аккаунт',
      removed: 'Будет удалено', removedList: ['профиль и контакты', 'получатели и адреса', 'сканы паспортов', 'корзина и избранное', 'уведомления', 'способы входа', 'история обращений в поддержку'],
      kept: 'Останется без личных данных', keptList: ['записи о заказах и бухгалтерские записи, которые требует хранить закон, — на установленный законом срок, под обезличенным идентификатором'],
      blocked: count => count === 1 ? 'Один оплаченный заказ ещё в работе.' : `Оплаченных заказов в работе: ${count}.`, blockedHint: 'Сначала дождитесь доставки или отмените их — или напишите в поддержку, и мы поможем закрыть их.',
      orders: 'Открыть заказы', support: 'Написать в поддержку', supportSubject: 'Удаление аккаунта',
      autoCancel: count => count === 1 ? 'Один неоплаченный запрос будет отменён автоматически.' : `Неоплаченные запросы (${count}) будут отменены автоматически.`,
      balance: sum => `Понимаю, что баланс ${sum} будет потерян`, confirm: 'Удалить аккаунт навсегда', cancel: 'Отмена', done: 'Аккаунт удалён.', failed: 'Не удалось удалить аккаунт.',
    },
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
      due: 'To‘lov uchun', orderNo: id => `${id} buyurtma`, noCharge: 'Saytda to‘lov ulanmagan: pul yechilmaydi.',
    },
    tiles: {
      label: 'Xaridlar haqida qisqacha', orders: 'Buyurtmalar', ordersActive: count => `${count} ta jarayonda`, ordersTotal: count => `jami ${count} ta`, none: 'hali yo‘q',
      cart: 'Savat', cartEmpty: 'bo‘sh', balance: 'Balans', balanceSub: 'Atlas ichki hisobi',
      notifications: 'Bildirishnomalar', unread: count => `${count} ta yangi`, noUnread: 'yangi yo‘q',
    },
    customs: {
      title: 'Oylik bojxona limiti', used: (used, limit) => `$${used} / $${limit}`, left: amount => `Yana $${amount} bojsiz`,
      over: amount => `Limitdan $${amount} ortiq — bu summadan boj to‘lanadi`,
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
    settings: {
      title: 'Sozlamalar', language: 'Til', theme: 'Ko‘rinish', rules: 'Qoidalar va ma’lumotlarga ishlov berish', signOut: 'Akkauntdan chiqish',
      support: 'Yordam va qo‘llab-quvvatlash', privacy: 'Maxfiylik siyosati', terms: 'Foydalanish shartlari',
      consents: 'Roziliklar', consentsNone: 'Qayd etilmagan', consentsAccept: 'Qabul qilish', consentVersion: version => `${version} tahriri`, consentDoc: { privacy: 'Maxfiylik siyosati', terms: 'Foydalanish shartlari' },
      restore: 'Xaridlarni tiklash', restored: orders => `Atlasda App Store va Google Play ichki xaridlari yo‘q. Buyurtmalar (${orders}) va balans akkauntingizdan tiklandi.`,
      about: 'Ilova haqida', aboutVersion: (version, build) => `Versiya ${version} (${build})`, aboutPlatform: { ios: 'iOS', android: 'Android' }, aboutLink: 'Ilova haqida batafsil',
    },
    deletion: {
      title: 'Akkauntni o‘chirish', lead: 'Akkaunt va shaxsiy ma’lumotlar qaytarib bo‘lmaydigan tarzda o‘chiriladi.', open: 'Akkauntni o‘chirish',
      removed: 'O‘chiriladi', removedList: ['profil va kontaktlar', 'qabul qiluvchilar va manzillar', 'pasport skanlari', 'savat va sevimlilar', 'bildirishnomalar', 'kirish usullari', 'yordam xizmatiga murojaatlar tarixi'],
      kept: 'Shaxsiy ma’lumotlarsiz saqlanadi', keptList: ['qonun saqlashni talab qiladigan buyurtma va buxgalteriya yozuvlari — qonunda belgilangan muddatga, shaxssizlantirilgan identifikator ostida'],
      blocked: count => count === 1 ? 'Bitta to‘langan buyurtma hali jarayonda.' : `Jarayondagi to‘langan buyurtmalar: ${count}.`, blockedHint: 'Avval yetkazilishini kuting yoki ularni bekor qiling — yoki yordam xizmatiga yozing, yopishga yordam beramiz.',
      orders: 'Buyurtmalarni ochish', support: 'Yordam xizmatiga yozish', supportSubject: 'Akkauntni o‘chirish',
      autoCancel: count => count === 1 ? 'Bitta to‘lanmagan so‘rov avtomatik bekor qilinadi.' : `To‘lanmagan so‘rovlar (${count}) avtomatik bekor qilinadi.`,
      balance: sum => `${sum} balans yo‘qolishini tushunaman`, confirm: 'Akkauntni butunlay o‘chirish', cancel: 'Bekor qilish', done: 'Akkaunt o‘chirildi.', failed: 'Akkauntni o‘chirib bo‘lmadi.',
    },
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
      due: 'To pay', orderNo: id => `Order ${id}`, noCharge: 'Online payment is not connected: no money is charged.',
    },
    tiles: {
      label: 'Your shopping at a glance', orders: 'Orders', ordersActive: count => `${count} in progress`, ordersTotal: count => `${count} total`, none: 'none yet',
      cart: 'Cart', cartEmpty: 'empty', balance: 'Balance', balanceSub: 'Atlas internal account',
      notifications: 'Notifications', unread: count => `${count} new`, noUnread: 'nothing new',
    },
    customs: {
      title: 'Monthly customs allowance', used: (used, limit) => `$${used} of $${limit}`, left: amount => `$${amount} left duty-free`,
      over: amount => `$${amount} over the allowance — duty applies to this amount`,
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
    settings: {
      title: 'Settings', language: 'Language', theme: 'Theme', rules: 'Terms and data processing', signOut: 'Sign out',
      support: 'Support and help', privacy: 'Privacy policy', terms: 'Terms of use',
      consents: 'Consents', consentsNone: 'Not recorded', consentsAccept: 'Accept', consentVersion: version => `edition ${version}`, consentDoc: { privacy: 'Privacy policy', terms: 'Terms of use' },
      restore: 'Restore purchases', restored: orders => `Atlas has no App Store or Google Play in-app purchases. Your orders (${orders}) and balance were restored from your account.`,
      about: 'About the app', aboutVersion: (version, build) => `Version ${version} (${build})`, aboutPlatform: { ios: 'iOS', android: 'Android' }, aboutLink: 'More about the app',
    },
    deletion: {
      title: 'Delete account', lead: 'The account and personal data will be deleted permanently.', open: 'Delete account',
      removed: 'Will be deleted', removedList: ['profile and contacts', 'recipients and addresses', 'passport scans', 'cart and favourites', 'notifications', 'sign-in methods', 'support history'],
      kept: 'Kept without personal data', keptList: ['order and accounting records the law requires us to keep — for the statutory period, under an anonymised identifier'],
      blocked: count => count === 1 ? 'One paid order is still in progress.' : `Paid orders in progress: ${count}.`, blockedHint: 'Wait for delivery or cancel them first — or write to support and we will help close them.',
      orders: 'Open orders', support: 'Write to support', supportSubject: 'Account deletion',
      autoCancel: count => count === 1 ? 'One unpaid request will be cancelled automatically.' : `Unpaid requests (${count}) will be cancelled automatically.`,
      balance: sum => `I understand the balance of ${sum} will be lost`, confirm: 'Delete account permanently', cancel: 'Cancel', done: 'Account deleted.', failed: 'Could not delete the account.',
    },
  },
};

export type OrdersCopy = {
  title: string;
  active: (count: number) => string;
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
    search: 'Номер заказа или товар', actionNeeded: 'Нужно ваше действие', stage: (current, total) => `Этап ${current} из ${total}`, progress: 'Ход заказа',
    placed: date => `Оформлен ${date}`, quantity: count => `${count} шт.`, openStore: 'Открыть в магазине', item: 'Товар', total: 'Сумма заказа',
    atCheckout: amount => `при оформлении ${amount}`, delivery: 'Получатель', tracking: 'Отслеживание', payment: 'Оплата',
    orderNumber: 'Номер заказа', newOrder: 'Заказать по ссылке', cart: 'Корзина',
    repeat: 'Повторить заказ', ask: 'Вопрос по заказу', allowance: 'Лимит получателя', allowanceValue: (used, limit) => `$${used} из $${limit} в этом месяце`, recipients: 'Получатель', allRecipients: 'Все',
  },
  uz: {
    title: 'Buyurtmalarim', active: count => `${count} ta jarayonda`,
    search: 'Buyurtma raqami yoki tovar', actionNeeded: 'Sizdan harakat kerak', stage: (current, total) => `Bosqich: ${current} / ${total}`, progress: 'Buyurtma jarayoni',
    placed: date => `Rasmiylashtirilgan: ${date}`, quantity: count => `${count} dona`, openStore: 'Do‘konda ochish', item: 'Tovar', total: 'Buyurtma summasi',
    atCheckout: amount => `rasmiylashtirishda ${amount}`, delivery: 'Qabul qiluvchi', tracking: 'Kuzatish', payment: 'To‘lov',
    orderNumber: 'Buyurtma raqami', newOrder: 'Havola orqali buyurtma', cart: 'Savat',
    repeat: 'Qayta buyurtma', ask: 'Buyurtma bo‘yicha savol', allowance: 'Qabul qiluvchi limiti', allowanceValue: (used, limit) => `bu oy $${used} / $${limit}`, recipients: 'Qabul qiluvchi', allRecipients: 'Barchasi',
  },
  en: {
    title: 'My orders', active: count => `${count} in progress`,
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
    spend: 'Заказать по ссылке', withdraw: 'Вывести', withdrawTitle: 'Вывод на сайте не подключён',
    withdrawText: 'Перечисление средств с баланса на сайте не подключено: этот экран не отправляет запрос и не переводит деньги. Баланс — внутренний учёт заказов, не банковский счёт.',
    close: 'Понятно', reserve: 'Резерв доставки в заказах', reserveText: 'Уже входит в суммы заказов. После взвешивания посылок остаток вернётся на баланс, а доплата выше резерва — только с вашего согласия.',
    orders: 'Мои заказы', history: 'История операций', operations: count => `${count} ${ruPlural(count, 'операция', 'операции', 'операций')}`, order: 'Заказ',
    emptyTitle: 'Операций пока нет', emptyText: 'Здесь появятся возвраты разницы после взвешивания и оплата заказов с баланса.',
    notice: 'Оплата и вывод средств на сайте не подключены — деньги не переводятся.',
    signin: { title: 'Войдите, чтобы открыть баланс', text: 'Расчёты по заказам и возвратам хранятся в вашем профиле.', action: 'Войти' }, loading: 'Загружаем операции…',
  },
  uz: {
    title: 'Balans', label: 'Atlas balansi', note: 'Buyurtmalar bo‘yicha hisob-kitob uchun ichki hisob — bank kartasi yoki hamyon emas.',
    spend: 'Havola orqali buyurtma', withdraw: 'Yechib olish', withdrawTitle: 'Saytda yechib olish ulanmagan',
    withdrawText: 'Saytda balansdan pul o‘tkazish ulanmagan: bu ekran so‘rov yubormaydi va pul o‘tkazmaydi. Balans — buyurtmalarning ichki hisobi, bank hisob raqami emas.',
    close: 'Tushunarli', reserve: 'Buyurtmalardagi yetkazish zaxirasi', reserveText: 'Buyurtma summalariga allaqachon kiritilgan. Posilkalar tortilgach qoldiq balansga qaytadi, zaxiradan ortiq to‘lov — faqat roziligingiz bilan.',
    orders: 'Buyurtmalarim', history: 'Amallar tarixi', operations: count => `${count} ta amal`, order: 'Buyurtma',
    emptyTitle: 'Hali amallar yo‘q', emptyText: 'Tortishdan keyingi farq qaytarilishi va balansdan to‘langan buyurtmalar shu yerda ko‘rinadi.',
    notice: 'Saytda to‘lov va pul yechib olish ulanmagan — pul o‘tkazilmaydi.',
    signin: { title: 'Balansni ochish uchun kiring', text: 'Buyurtma va qaytarishlar hisobi profilingizda saqlanadi.', action: 'Kirish' }, loading: 'Amallar yuklanmoqda…',
  },
  en: {
    title: 'Balance', label: 'Atlas balance', note: 'An internal account for order settlements — not a bank card or a wallet.',
    spend: 'Order by link', withdraw: 'Withdraw', withdrawTitle: 'Withdrawals are not connected',
    withdrawText: 'Payouts from the balance are not connected on the site: this screen does not submit a request or transfer funds. The balance is internal order accounting, not a bank account.',
    close: 'Got it', reserve: 'Delivery reserve in orders', reserveText: 'Already included in order totals. After parcels are weighed, any remainder returns to your balance; anything above the reserve needs your consent.',
    orders: 'My orders', history: 'Transaction history', operations: count => `${count} ${count === 1 ? 'transaction' : 'transactions'}`, order: 'Order',
    emptyTitle: 'No transactions yet', emptyText: 'Refunds after weighing and orders paid from the balance will appear here.',
    notice: 'Payments and withdrawals are not connected on the site — no money is transferred.',
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
  /** Short sign-in label for the phone total bar; `signinAdd` says the item goes to the cart after sign-in. */
  signinAddShort: string;
  /** Where this device keeps nothing (blocked storage): an honest sign-in label and guest note, no promise. */
  signinContinue: string;
  guestNoKeep: string;
  /** Opening the page without a link brought back the unfinished draft. */
  resumed: (host: string) => string;
  startNew: string;
  /** An earlier choice that cannot be applied as it was: the store did not answer, or now lists its own options. */
  choice: { unanswered: (list: string) => string; typed: (item: string) => string };
  /** Calculation details Atlas loaded from the store: shown as read-only lines with a lock. */
  locked: {
    badge: string; catalogBadge: string; hint: string; catalogHint: string; value: string;
    note: (time: string) => string; partNote: string; catalogNote: string; manualNote: string;
    reserve: (amount: string) => string; byOption: string; weight: string;
  };
  /** A chosen option the reloaded product no longer sells; another one is never picked silently. */
  optionGone: (labels: string[]) => string;
  /** The cart add a guest asked for, sent after sign-in; `…Elsewhere` when it was sent from the cart, not the item page. */
  pending: {
    added: (units: number) => string; addedItem: (name: string, units: number) => string; changed: string; failed: string;
    changedElsewhere: string; failedElsewhere: string; open: string; sending: string; speedKept: string; notKept: string;
  };
};

export const linkOrderCopy: Record<Locale, LinkOrderCopy> = {
  ru: {
    title: 'Заказ по ссылке', lead: 'Вставьте ссылку на товар из зарубежного магазина, и мы посчитаем итог с доставкой до Ташкента.', leadLoaded: 'Выберите вариант и проверьте расчёт.',
    label: 'Ссылка на товар', placeholder: 'Вставьте ссылку на товар', calculate: 'Рассчитать', loading: 'Загружаем цену и варианты из магазина…',
    hint: 'Нужна ссылка на страницу товара: Nike, Zara, Amazon, eBay и другие магазины.', stores: 'Где это работает', batch: 'Добавить несколько ссылок',
    openStore: 'Открыть в магазине', change: 'Другая ссылка', storePrice: 'Цена в магазине', checkedAt: time => `проверено в ${time}`,
    unconfirmed: 'Магазин не подтвердил все данные — проверьте их ниже.', total: 'Итого с доставкой до Ташкента', emptyTotal: 'Укажите цену и вес — покажем итог.',
    data: 'Данные для расчёта', shippingReserve: 'доставка магазина: резерв', storeShipping: amount => `доставка магазина ${amount}`, kg: 'кг',
    add: 'Добавить в корзину', addShort: 'В корзину', signinAdd: 'Войти — товар добавится в корзину', guest: 'Расчёт доступен без входа. Нажмите кнопку внизу и войдите — товар сам добавится в корзину, выбранные варианты и количество сохранятся.', details: 'Подробности загрузки',
    unnamed: 'Название не получено — укажите его ниже', fillFromStore: 'Заполните по странице товара в магазине.',
    signinAddShort: 'Войти и добавить',
    locked: {
      badge: 'Загружено Atlas', catalogBadge: 'Из каталога Atlas', hint: 'Только для просмотра — Atlas получил их из магазина.', catalogHint: 'Только для просмотра — значения из каталога Atlas.', value: 'изменить нельзя',
      note: time => `Эти данные Atlas получил из магазина${time ? ` в ${time}` : ''} — изменить их нельзя. Если что-то не совпадает с магазином, напишите в комментарии к заказу.`,
      partNote: 'Поля без замка магазин не сообщил — заполните их по странице товара.',
      catalogNote: 'Значения с замком взяты из каталога Atlas — изменить их нельзя. Если что-то не совпадает с магазином, напишите в комментарии к заказу.',
      manualNote: 'Atlas не смог загрузить эти данные из магазина — заполните их по странице товара. Перед выкупом Atlas сверит их с магазином.',
      reserve: amount => `резерв ${amount}`, byOption: 'по выбранному варианту', weight: 'Вес — оценка Atlas. Склад взвесит посылку, поэтому точный вес указывать не нужно.',
    },
    optionGone: labels => labels.length > 1 ? `Варианты ${labels.map(label => `«${label}»`).join(', ')} больше не продаются — выберите другие.` : `Вариант «${labels[0] ?? ''}» больше не продаётся — выберите другой.`,
    signinContinue: 'Войти и продолжить',
    guestNoKeep: 'Расчёт доступен без входа. Это устройство не сохраняет данные сайта, поэтому после входа товар нужно будет добавить ещё раз.',
    resumed: host => `Вернули незавершённый заказ: ${host}`, startNew: 'Начать с новой ссылки',
    choice: {
      unanswered: list => `Магазин сейчас не ответил, поэтому варианты не загрузились. Раньше вы выбрали: ${list} — укажите вариант вручную.`,
      typed: item => `Раньше вы указали «${item}». Теперь магазин показал свои варианты — выберите подходящий.`,
    },
    pending: {
      added: units => `Товар добавлен в корзину: +${units} шт.`, addedItem: (name, units) => `Добавлено в корзину: «${name}», ${units} шт.`,
      changed: 'Пока вы входили, цена в магазине изменилась — товар не добавлен. Проверьте новый итог и добавьте его снова.',
      failed: 'Не удалось добавить товар после входа. Проверьте данные и добавьте его ещё раз.',
      changedElsewhere: 'Пока вы входили, цена в магазине изменилась — товар не добавлен. Откройте товар, проверьте новый итог и добавьте его снова.',
      failedElsewhere: 'Не удалось добавить товар после входа. Откройте товар и добавьте его ещё раз.',
      open: 'Открыть товар', sending: 'Добавляем товар в корзину после входа…',
      speedKept: 'В корзине оставлена прежняя скорость доставки — её можно сменить в корзине.',
      notKept: 'Не удалось запомнить товар на этом устройстве. Войдите — после входа добавьте его ещё раз.',
    },
  },
  uz: {
    title: 'Havola orqali buyurtma', lead: 'Xorijiy do‘kondagi tovar havolasini qo‘ying, Toshkentgacha yetkazish bilan jami summani hisoblaymiz.', leadLoaded: 'Variantni tanlang va hisobni tekshiring.',
    label: 'Tovar havolasi', placeholder: 'Tovar havolasini qo‘ying', calculate: 'Hisoblash', loading: 'Do‘kondan narx va variantlar yuklanmoqda…',
    hint: 'Tovar sahifasi havolasi kerak: Nike, Zara, Amazon, eBay va boshqa do‘konlar.', stores: 'Qayerlarda ishlaydi', batch: 'Bir nechta havola qo‘shish',
    openStore: 'Do‘konda ochish', change: 'Boshqa havola', storePrice: 'Do‘kondagi narx', checkedAt: time => `${time} da tekshirildi`,
    unconfirmed: 'Do‘kon barcha ma’lumotlarni tasdiqlamadi — quyida tekshiring.', total: 'Toshkentgacha yetkazish bilan jami', emptyTotal: 'Narx va vaznni kiriting — jami summani ko‘rsatamiz.',
    data: 'Hisob uchun ma’lumotlar', shippingReserve: 'do‘kon yetkazishi: zaxira', storeShipping: amount => `do‘kon yetkazishi ${amount}`, kg: 'kg',
    add: 'Savatga qo‘shish', addShort: 'Savatga', signinAdd: 'Kirish — tovar savatga qo‘shiladi', guest: 'Hisobni kirmasdan ko‘rish mumkin. Pastdagi tugmani bosib kiring — tovar o‘zi savatga qo‘shiladi, tanlangan variantlar va soni saqlanadi.', details: 'Yuklash tafsilotlari',
    unnamed: 'Nomi olinmadi — quyida kiriting', fillFromStore: 'Do‘kondagi tovar sahifasiga qarab to‘ldiring.',
    signinAddShort: 'Kirib qo‘shish',
    locked: {
      badge: 'Atlas yukladi', catalogBadge: 'Atlas katalogidan', hint: 'Faqat ko‘rish uchun — Atlas ularni do‘kondan oldi.', catalogHint: 'Faqat ko‘rish uchun — qiymatlar Atlas katalogidan.', value: 'o‘zgartirib bo‘lmaydi',
      note: time => `Bu ma’lumotlarni Atlas do‘kondan${time ? ` ${time} da` : ''} oldi — ularni o‘zgartirib bo‘lmaydi. Do‘kondagi bilan mos kelmasa, buyurtmaga izohda yozing.`,
      partNote: 'Qulfsiz maydonlarni do‘kon ko‘rsatmagan — ularni tovar sahifasiga qarab to‘ldiring.',
      catalogNote: 'Qulfli qiymatlar Atlas katalogidan olingan — ularni o‘zgartirib bo‘lmaydi. Do‘kondagi bilan mos kelmasa, buyurtmaga izohda yozing.',
      manualNote: 'Atlas bu ma’lumotlarni do‘kondan yuklay olmadi — ularni tovar sahifasiga qarab to‘ldiring. Xariddan oldin Atlas ularni do‘kon bilan solishtiradi.',
      reserve: amount => `zaxira ${amount}`, byOption: 'tanlangan variant bo‘yicha', weight: 'Vazn — Atlas bahosi. Ombor jo‘natmani tortadi, shuning uchun aniq vaznni kiritish shart emas.',
    },
    optionGone: labels => labels.length > 1 ? `${labels.map(label => `«${label}»`).join(', ')} variantlari endi sotilmaydi — boshqasini tanlang.` : `«${labels[0] ?? ''}» varianti endi sotilmaydi — boshqasini tanlang.`,
    signinContinue: 'Kirish va davom etish',
    guestNoKeep: 'Hisobni kirmasdan ko‘rish mumkin. Bu qurilma sayt ma’lumotlarini saqlamaydi, shuning uchun kirgandan keyin tovarni qayta qo‘shish kerak bo‘ladi.',
    resumed: host => `Tugallanmagan buyurtma qaytarildi: ${host}`, startNew: 'Yangi havoladan boshlash',
    choice: {
      unanswered: list => `Do‘kon hozir javob bermadi, shuning uchun variantlar yuklanmadi. Avval tanlaganingiz: ${list} — variantni qo‘lda kiriting.`,
      typed: item => `Avval «${item}» ni kiritgansiz. Endi do‘kon o‘z variantlarini ko‘rsatdi — mosini tanlang.`,
    },
    pending: {
      added: units => `Tovar savatga qo‘shildi: +${units} dona`, addedItem: (name, units) => `Savatga qo‘shildi: «${name}», ${units} dona`,
      changed: 'Siz kirayotganingizda do‘kondagi narx o‘zgardi — tovar qo‘shilmadi. Yangi jamini tekshirib, uni qayta qo‘shing.',
      failed: 'Kirgandan keyin tovarni qo‘shib bo‘lmadi. Ma’lumotlarni tekshirib, uni qayta qo‘shing.',
      changedElsewhere: 'Siz kirayotganingizda do‘kondagi narx o‘zgardi — tovar qo‘shilmadi. Tovarni ochib, yangi jamini tekshiring va qayta qo‘shing.',
      failedElsewhere: 'Kirgandan keyin tovarni qo‘shib bo‘lmadi. Tovarni ochib, uni qayta qo‘shing.',
      open: 'Tovarni ochish', sending: 'Kirgandan keyin tovarni savatga qo‘shyapmiz…',
      speedKept: 'Savatda avvalgi yetkazish tezligi qoldirildi — uni savatda o‘zgartirish mumkin.',
      notKept: 'Tovarni bu qurilmada eslab qolib bo‘lmadi. Kiring — kirgandan keyin uni qayta qo‘shing.',
    },
  },
  en: {
    title: 'Order by link', lead: 'Paste a product link from a store abroad and we calculate the total with delivery to Tashkent.', leadLoaded: 'Choose an option and review the estimate.',
    label: 'Product link', placeholder: 'Paste a product link', calculate: 'Calculate', loading: 'Loading price and options from the store…',
    hint: 'Use a product page link: Nike, Zara, Amazon, eBay and other stores.', stores: 'Where it works', batch: 'Add several links',
    openStore: 'Open in store', change: 'Another link', storePrice: 'Store price', checkedAt: time => `checked at ${time}`,
    unconfirmed: 'The store did not confirm every detail — review them below.', total: 'Total with delivery to Tashkent', emptyTotal: 'Enter a price and weight to see the total.',
    data: 'Calculation details', shippingReserve: 'store delivery: reserve', storeShipping: amount => `store delivery ${amount}`, kg: 'kg',
    add: 'Add to cart', addShort: 'Add', signinAdd: 'Sign in — the item goes to your cart', guest: 'You can see the estimate without signing in. Press the button below and sign in — the item is added to your cart by itself, with the options and quantities you chose.', details: 'Import details',
    unnamed: 'No name received — enter it below', fillFromStore: 'Fill these in from the product page in the store.',
    signinAddShort: 'Sign in & add',
    locked: {
      badge: 'Loaded by Atlas', catalogBadge: 'From the Atlas catalog', hint: 'View only — Atlas got these from the store.', catalogHint: 'View only — values from the Atlas catalog.', value: 'cannot be changed',
      note: time => `Atlas got these details from the store${time ? ` at ${time}` : ''} — they cannot be changed. If something differs from the store, say so in the order comment.`,
      partNote: 'The store did not give the fields without a lock — fill them in from the product page.',
      catalogNote: 'Values with a lock come from the Atlas catalog and cannot be changed. If something differs from the store, say so in the order comment.',
      manualNote: 'Atlas could not load these details from the store — fill them in from the product page. Atlas checks them with the store before buying.',
      reserve: amount => `reserve ${amount}`, byOption: 'per chosen option', weight: 'Weight is an Atlas estimate. The warehouse weighs the parcel, so you do not need the exact weight.',
    },
    optionGone: labels => labels.length > 1 ? `Options ${labels.map(label => `“${label}”`).join(', ')} are no longer sold — choose others.` : `Option “${labels[0] ?? ''}” is no longer sold — choose another.`,
    signinContinue: 'Sign in and continue',
    guestNoKeep: 'You can see the estimate without signing in. This device does not keep site data, so after signing in you will need to add the item again.',
    resumed: host => `Your unfinished order is back: ${host}`, startNew: 'Start with a new link',
    choice: {
      unanswered: list => `The store did not answer just now, so its options did not load. You chose earlier: ${list} — enter the option by hand.`,
      typed: item => `You entered “${item}” earlier. The store now lists its own options — choose the matching one.`,
    },
    pending: {
      added: units => `Added to your cart: ${units} pcs`, addedItem: (name, units) => `Added to your cart: “${name}”, ${units} pcs`,
      changed: 'The store price changed while you were signing in — the item was not added. Check the new total and add it again.',
      failed: 'Could not add the item after sign-in. Check the details and add it again.',
      changedElsewhere: 'The store price changed while you were signing in — the item was not added. Open the item, check the new total and add it again.',
      failedElsewhere: 'Could not add the item after sign-in. Open the item and add it again.',
      open: 'Open item', sending: 'Adding the item to your cart after sign-in…',
      speedKept: 'Your cart keeps its earlier delivery speed — you can change it in the cart.',
      notKept: 'This device could not keep the item. Sign in, then add it again.',
    },
  },
};

export type RecipientCopy = {
  addTitle: string; editTitle: string; note: string;
  labelLegend: string; labels: { home: string; work: string; parents: string; other: string }; customLabel: string;
  name: string; nameHint: string; phone: string; phoneHint: string; phoneError: string;
  region: string; regionPlaceholder: string; city: string; address: string; addressPlaceholder: string;
  postal: string; postalHint: string; postalError: string; comment: string; commentPlaceholder: string; optional: string;
  primary: string; save: string; saving: string; saved: string; updated: string; required: string; privacy: string;
};

export const recipientCopy: Record<Locale, RecipientCopy> = {
  ru: {
    addTitle: 'Новый получатель', editTitle: 'Изменить получателя', note: 'Тот, кто заберёт посылку. ФИО — как в паспорте.',
    labelLegend: 'Как подписать', labels: { home: 'Дом', work: 'Работа', parents: 'Родители', other: 'Другое' }, customLabel: 'Своя подпись',
    name: 'ФИО получателя', nameHint: 'Как в паспорте — так посылку выдадут без вопросов.',
    phone: 'Телефон', phoneHint: 'Курьер позвонит перед доставкой.', phoneError: 'Введите 9 цифр номера после +998.',
    region: 'Область', regionPlaceholder: 'Выберите область', city: 'Город или район', address: 'Улица, дом, квартира', addressPlaceholder: 'Например: ул. Навои, 15, кв. 4',
    postal: 'Почтовый индекс', postalHint: '6 цифр, например 100000.', postalError: 'Введите 6 цифр индекса.', comment: 'Комментарий для курьера', commentPlaceholder: 'Подъезд, ориентир, удобное время', optional: 'необязательно',
    primary: 'Основной получатель — подставляется в заказ сам', save: 'Сохранить получателя', saving: 'Сохраняем…', saved: 'Получатель сохранён.', updated: 'Изменения сохранены.',
    required: 'Заполните это поле.', privacy: 'Подсказки работают на устройстве — адрес не уходит в сторонние сервисы поиска.',
  },
  uz: {
    addTitle: 'Yangi qabul qiluvchi', editTitle: 'Qabul qiluvchini o‘zgartirish', note: 'Posilkani oladigan odam. F.I.Sh. — pasportdagidek.',
    labelLegend: 'Qanday nomlash', labels: { home: 'Uy', work: 'Ish', parents: 'Ota-ona', other: 'Boshqa' }, customLabel: 'O‘z nomingiz',
    name: 'Qabul qiluvchining F.I.Sh.', nameHint: 'Pasportdagidek — shunda posilka muammosiz beriladi.',
    phone: 'Telefon', phoneHint: 'Kuryer yetkazishdan oldin qo‘ng‘iroq qiladi.', phoneError: '+998 dan keyin 9 ta raqamni kiriting.',
    region: 'Viloyat', regionPlaceholder: 'Viloyatni tanlang', city: 'Shahar yoki tuman', address: 'Ko‘cha, uy, xonadon', addressPlaceholder: 'Masalan: Navoiy ko‘chasi, 15-uy, 4-xonadon',
    postal: 'Pochta indeksi', postalHint: '6 ta raqam, masalan 100000.', postalError: 'Indeksning 6 ta raqamini kiriting.', comment: 'Kuryer uchun izoh', commentPlaceholder: 'Podyezd, mo‘ljal, qulay vaqt', optional: 'ixtiyoriy',
    primary: 'Asosiy qabul qiluvchi — buyurtmaga avtomatik qo‘yiladi', save: 'Qabul qiluvchini saqlash', saving: 'Saqlanmoqda…', saved: 'Qabul qiluvchi saqlandi.', updated: 'O‘zgarishlar saqlandi.',
    required: 'Bu maydonni to‘ldiring.', privacy: 'Maslahatlar qurilmangizda ishlaydi — manzil tashqi qidiruv xizmatlariga yuborilmaydi.',
  },
  en: {
    addTitle: 'New recipient', editTitle: 'Edit recipient', note: 'The person who will collect the parcel. Full name as in the passport.',
    labelLegend: 'Label', labels: { home: 'Home', work: 'Work', parents: 'Parents', other: 'Other' }, customLabel: 'Your own label',
    name: 'Recipient’s full name', nameHint: 'As in the passport, so the parcel is handed over without questions.',
    phone: 'Phone', phoneHint: 'The courier calls before delivery.', phoneError: 'Enter the 9 digits after +998.',
    region: 'Region', regionPlaceholder: 'Choose a region', city: 'City or district', address: 'Street, building, apartment', addressPlaceholder: 'For example: Navoi St 15, apt 4',
    postal: 'Postal code', postalHint: '6 digits, for example 100000.', postalError: 'Enter the 6 digits of the postal code.', comment: 'Note for the courier', commentPlaceholder: 'Entrance, landmark, convenient time', optional: 'optional',
    primary: 'Default recipient — filled in at checkout', save: 'Save recipient', saving: 'Saving…', saved: 'Recipient saved.', updated: 'Changes saved.',
    required: 'Fill in this field.', privacy: 'Suggestions run on your device — the address is not sent to third-party search.',
  },
};

export type DocsCopy = {
  title: string; lead: string; whose: string; whoseHint: string; noRecipient: string; addRecipient: string;
  passportOk: (masked: string) => string; passportMissing: string; uploadStep: string; replaceStep: string; checkStep: string;
  pickFirst: string; uploaded: string; uploadedFilled: string; autoFailed: string; reading: string; confirmedToast: string; deleteConfirm: string; deleted: string;
  loadError: string; uploadError: string; deleteError: string; scans: string;
  declTitle: string; declLead: string; need: string; needRecipient: string; needPassport: string; needOrders: string; addPassport: string; newOrder: string;
  ordersFor: (name: string) => string; selectGroup: string; usd: (amount: number) => string; overLimit: string; history: string;
};

export const docsCopy: Record<Locale, DocsCopy> = {
  ru: {
    title: 'Паспорт или ID-карта получателя', lead: 'Нужны для таможенного оформления посылки. Скан видите вы и сотрудники Atlas, которые оформляют посылку.',
    whose: 'Чей паспорт', whoseHint: 'Паспорт привязывается к получателю — тому, кто заберёт посылку.', noRecipient: 'Сначала добавьте получателя.', addRecipient: 'Добавить получателя',
    passportOk: masked => `Паспорт ${masked}`, passportMissing: 'паспорт не добавлен', uploadStep: 'Фото разворота паспорта или оборота ID-карты', replaceStep: 'Заменить скан', checkStep: 'Проверьте данные',
    pickFirst: 'Выберите получателя выше.', uploaded: 'Скан загружен — проверьте и заполните данные.', uploadedFilled: 'Скан загружен, найденные данные заполнены.',
    autoFailed: 'Не удалось распознать документ — заполните поля вручную. Лучше читается чёткое фото без бликов, где видны строки с символами «<».', reading: 'Распознаём документ…', confirmedToast: 'Паспортные данные подтверждены.', deleteConfirm: 'Удалить скан паспорта из защищённого хранилища?', deleted: 'Скан удалён.',
    loadError: 'Не удалось загрузить документы.', uploadError: 'Не удалось загрузить документ.', deleteError: 'Не удалось удалить документ.', scans: 'Загруженные сканы',
    declTitle: 'Декларация', declLead: 'Соберём черновик из ваших заказов и подтверждённого паспорта — без повторного ввода.', need: 'Что нужно для декларации',
    needRecipient: 'Получатель', needPassport: 'Паспорт получателя', needOrders: 'Хотя бы один заказ', addPassport: 'Добавить паспорт', newOrder: 'Заказать по ссылке',
    ordersFor: name => `Заказы для: ${name}`, selectGroup: 'Выбрать все', usd: amount => `≈ $${amount}`, overLimit: 'Больше $200 — с превышения платится пошлина.', history: 'Черновики деклараций',
  },
  uz: {
    title: 'Qabul qiluvchi pasporti yoki ID-kartasi', lead: 'Posilkani bojxonada rasmiylashtirish uchun kerak. Skanni siz va posilkani rasmiylashtiradigan Atlas xodimlari ko‘radi.',
    whose: 'Kimning pasporti', whoseHint: 'Pasport qabul qiluvchiga — posilkani oladigan odamga bog‘lanadi.', noRecipient: 'Avval qabul qiluvchini qo‘shing.', addRecipient: 'Qabul qiluvchi qo‘shish',
    passportOk: masked => `Pasport ${masked}`, passportMissing: 'pasport qo‘shilmagan', uploadStep: 'Pasport sahifasi yoki ID-karta orqa tomoni surati', replaceStep: 'Skanni almashtirish', checkStep: 'Ma’lumotlarni tekshiring',
    pickFirst: 'Yuqorida qabul qiluvchini tanlang.', uploaded: 'Skan yuklandi — ma’lumotlarni tekshirib to‘ldiring.', uploadedFilled: 'Skan yuklandi, topilgan ma’lumotlar to‘ldirildi.',
    autoFailed: 'Hujjatni aniqlab bo‘lmadi — maydonlarni qo‘lda to‘ldiring. «<» belgili qatorlar ko‘rinadigan aniq, yaltirashsiz surat yaxshiroq o‘qiladi.', reading: 'Hujjat aniqlanmoqda…', confirmedToast: 'Pasport ma’lumotlari tasdiqlandi.', deleteConfirm: 'Pasport skani himoyalangan omborxonadan o‘chirilsinmi?', deleted: 'Skan o‘chirildi.',
    loadError: 'Hujjatlarni yuklab bo‘lmadi.', uploadError: 'Hujjatni yuklab bo‘lmadi.', deleteError: 'Hujjatni o‘chirib bo‘lmadi.', scans: 'Yuklangan skanlar',
    declTitle: 'Deklaratsiya', declLead: 'Buyurtmalaringiz va tasdiqlangan pasportdan qoralama tayyorlaymiz — qayta kiritmasdan.', need: 'Deklaratsiya uchun nima kerak',
    needRecipient: 'Qabul qiluvchi', needPassport: 'Qabul qiluvchi pasporti', needOrders: 'Kamida bitta buyurtma', addPassport: 'Pasport qo‘shish', newOrder: 'Havola orqali buyurtma',
    ordersFor: name => `Buyurtmalar: ${name}`, selectGroup: 'Hammasini tanlash', usd: amount => `≈ $${amount}`, overLimit: '$200 dan ko‘p — limitdan ortiq qismga boj to‘lanadi.', history: 'Deklaratsiya qoralamalari',
  },
  en: {
    title: 'Recipient passport or ID card', lead: 'Needed to clear the parcel through customs. The scan is seen by you and by the Atlas staff who process the parcel.',
    whose: 'Whose passport', whoseHint: 'A passport belongs to a recipient — the person who collects the parcel.', noRecipient: 'Add a recipient first.', addRecipient: 'Add recipient',
    passportOk: masked => `Passport ${masked}`, passportMissing: 'no passport yet', uploadStep: 'Passport photo page or the back of the ID card', replaceStep: 'Replace scan', checkStep: 'Check the details',
    pickFirst: 'Choose a recipient above.', uploaded: 'Scan uploaded — check and complete the details.', uploadedFilled: 'Scan uploaded; the details found were filled in.',
    autoFailed: 'The document could not be read — fill in the fields yourself. A sharp photo without glare, showing the lines with “<” symbols, reads best.', reading: 'Reading the document…', confirmedToast: 'Passport details confirmed.', deleteConfirm: 'Delete the passport scan from protected storage?', deleted: 'Scan deleted.',
    loadError: 'Could not load documents.', uploadError: 'Could not upload the document.', deleteError: 'Could not delete the document.', scans: 'Uploaded scans',
    declTitle: 'Declaration', declLead: 'We build a draft from your orders and the confirmed passport — nothing to retype.', need: 'What a declaration needs',
    needRecipient: 'A recipient', needPassport: 'The recipient’s passport', needOrders: 'At least one order', addPassport: 'Add passport', newOrder: 'Order by link',
    ordersFor: name => `Orders for: ${name}`, selectGroup: 'Select all', usd: amount => `≈ $${amount}`, overLimit: 'Over $200 — duty applies to the excess.', history: 'Declaration drafts',
  },
};

type NotFoundCopy = { title: string; text: string; home: string; paste: string; stores: string };

/** Unknown addresses keep the site shell and offer the main ways back. */
export const notFoundCopy: Record<Locale, NotFoundCopy> = {
  ru: { title: 'Страница не найдена', text: 'Ссылка устарела или в адресе опечатка. Начните с главной или вставьте ссылку на товар — посчитаем итог в сумах.', home: 'На главную', paste: 'Вставить ссылку на товар', stores: 'Магазины' },
  uz: { title: 'Sahifa topilmadi', text: 'Havola eskirgan yoki manzilda xato bor. Bosh sahifadan boshlang yoki tovar havolasini qo‘ying — yakuniy narxni so‘mda hisoblab beramiz.', home: 'Bosh sahifa', paste: 'Tovar havolasini qo‘yish', stores: 'Do‘konlar' },
  en: { title: 'Page not found', text: 'The link is out of date or the address has a typo. Start from the home page or paste a product link and we’ll work out the total in soum.', home: 'Home page', paste: 'Paste a product link', stores: 'Stores' },
};