import type { Locale } from './i18n.ts';
import type { DeliveryRegion } from './site-content.ts';

/** Whole number with non-breaking-space thousand groups: 1234567 → "1 234 567". */
export function groupDigits(amount: number) {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Soum amounts with space-grouped digits in every language: "1 234 567 сум".
 * Digits never split; the currency word may wrap as a whole on narrow cards. */
export function formatSum(amount: number, locale: Locale) {
  return `${groupDigits(amount)} ${locale === 'ru' ? 'сум' : locale === 'uz' ? 'so‘m' : 'UZS'}`;
}

function ruDays(max: number) {
  const tail = max % 100, last = max % 10;
  return tail >= 11 && tail <= 14 ? 'рабочих дней' : last === 1 ? 'рабочий день' : last >= 2 && last <= 4 ? 'рабочих дня' : 'рабочих дней';
}

/** Dollar rates as the carrier writes them: "$15", "$1,5" (ru/uz) or "$1.5" (en). */
export function formatUsd(amount: number, locale: Locale) {
  const value = Math.round(amount * 100) / 100;
  return `$${Number.isInteger(value) ? value : value.toFixed(2).replace(/0$/, '').replace('.', locale === 'en' ? '.' : ',')}`;
}

/** Russian noun form for a count: ruPlural(207, ['магазин', 'магазина', 'магазинов']) → "магазинов". */
export function ruPlural(count: number, forms: [string, string, string]) {
  const tail = count % 100, last = count % 10;
  return tail >= 11 && tail <= 14 ? forms[2] : last === 1 ? forms[0] : last >= 2 && last <= 4 ? forms[1] : forms[2];
}

/** A store price in dollars, always with cents when it has them: "$2,72", "$2,70", "$100" (en: "$2.72"). */
export function formatPriceUsd(amount: number, locale: Locale) {
  const value = Math.round(amount * 100) / 100;
  return `$${Number.isInteger(value) ? value : value.toFixed(2).replace('.', locale === 'en' ? '.' : ',')}`;
}

const monthNames: Record<Locale, string[]> = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
/** Day and month in Tashkent time, spelled the same on the server and in the browser: "3 октября", "3-oktabr", "3 October". */
export function formatDayMonth(time: number, locale: Locale) {
  const date = new Date(time + 5 * 3_600_000);
  const day = date.getUTCDate(), month = monthNames[locale][date.getUTCMonth()];
  return locale === 'uz' ? `${day}-${month}` : `${day} ${month}`;
}

/** A share as people write it: 0.0998 → "9,98%" (ru/uz) or "9.98%" (en); never rounded to "10%". */
export function formatPercent(share: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 2 }).format(share * 100) + '%';
}

/** Weights in kilograms with a decimal comma outside English: 1.3 → "1,3". */
export function formatKg(kg: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 2 }).format(kg);
}

type Step = { title: string; text: string };
type Faq = { q: string; a: string };
type Facts = { fee: string; markup: string; cbu: boolean; freeFrom: string; allowance: string };

export type HomeCopy = {
  nav: { catalog: string; stores: string; how: string; tariffs: string; orders: string; signin: string; account: string; language: string };
  hero: { title: string; lead: string; label: string; placeholder: string; calculate: string; invalid: string; guestNote: string; memberNote: string; popular: string; openStore: string; batch: string; catalog: string; allStores: (count: number) => string; storesHint: string };
  how: { title: string; steps: [Step, Step, Step, Step]; paymentsLabel: string; pickupLabel: string; deliveryLabel: string; courier: string };
  example: {
    title: string; product: string; routeLabel: string; to: string; days: (min: number, max: number) => string;
    item: string; itemNoteCbu: (usd: string, rate: string, markup: string) => string; itemNoteSet: (usd: string, rate: string) => string;
    service: string; serviceDetail: (percent: string) => string;
    delivery: string; deliveryNote: (boxed: string, packaging: string, perKg: string) => string;
    reserve: string; reserveNote: string; reserveHelpLabel: string; reserveHelp: string; total: string;
    outsideTitle: string; dutyLabel: string; dutyStatus: string; dutyNote: (allowance: string) => string;
  };
  catalog: { title: string; intro: string; order: string; storePrice: string; total: string; breakdown: string };
  tariffs: { title: string; lead: string; from: string; time: string; perKg: string; perKgUnit: string; per100g: (usd: string) => string; days: (min: number, max: number) => string; pending: string; noDays: string; regions: Record<DeliveryRegion, string>; speeds: { express: string; standard: string }; speedsLabel: string; weightNote: string; rateNote: string };
  trust: { title: string; facts: (facts: Facts) => string[]; ordersDone: string; trackingTitle: string; example: string; trackingProduct: string; trackingOrder: string; trackingNote: string; reviewsTitle: string; photosTitle: string; legalTitle: string; entity: string; inn: string; address: string; legalLink: string };
  faq: { title: string; timesQuestion: string; timesKnown: (list: string) => string; timesUnknown: string; customsLink: string; prohibitedOfficial: string; prohibitedRules: string; items: { customs: Faq; returns: Faq; prohibited: Faq; weight: Faq; account: Faq } };
  closing: { title: string; text: string };
  footer: { tagline: string; buyers: string; contacts: string; legal: string; support: string; rules: string; privacy: string; customs: string; faq: string; telegramSupport: string; telegramChannel: string; phone: string; instagram: string; pickup: string; theme: string };
  sticky: { paste: string };
  /** Wide screens only (app/home-facts.tsx and the inserts in app/home-sections.tsx): facts row, step examples, route card, FAQ links. */
  wide: {
    factsLabel: string; andMore: string; storesUnit: (count: number) => string; countriesUnit: (count: number) => string; countriesSub: string;
    priceFrom: (price: string) => string; daysUnit: (max: number) => string; fromWarehouse: string; stepCheck: [string, string];
    routeTitle: string; routeStore: string; routeStoreNote: string; routeFly: string; routeFlyNote: string; routeCustoms: string; routeCustomsNote: string;
    or: string; faqMore: string;
  };
};

export const homeCopy: Record<Locale, HomeCopy> = {
  ru: {
    nav: { catalog: 'Каталог', stores: 'Магазины', how: 'Как это работает', tariffs: 'Тарифы', orders: 'Мои заказы', signin: 'Войти', account: 'Кабинет', language: 'Язык сайта' },
    hero: {
      title: 'Покупаем в магазинах США, Европы и Китая и привозим в Ташкент',
      lead: 'Вставьте ссылку на товар. Сразу покажем счёт в сумах, каждой строкой, ещё до оплаты.',
      label: 'Ссылка на товар', placeholder: 'Вставьте ссылку на товар', calculate: 'Рассчитать',
      invalid: 'Вставьте полную ссылку на страницу товара — она начинается с https://',
      guestNote: 'Расчёт бесплатный, регистрация не нужна.', memberNote: 'Расчёт бесплатный и ни к чему не обязывает.',
      popular: 'Популярные магазины', openStore: 'откроется в новой вкладке', batch: 'Добавить несколько ссылок', catalog: 'Смотреть подборку товаров',
      allStores: (count) => `Все ${count} ${ruPlural(count, ['магазин', 'магазина', 'магазинов'])}`,
      storesHint: 'Откройте магазин, скопируйте ссылку на товар и вставьте её в поле выше.',
    },
    how: {
      title: 'Как это работает',
      steps: [
        { title: 'Вставьте ссылку', text: 'Скопируйте ссылку на товар в зарубежном магазине и вставьте её в поле выше.' },
        { title: 'Проверьте счёт', text: 'Сразу покажем итог в сумах: товар, комиссия и доставка отдельными строками.' },
        { title: 'Подтвердите заказ', text: 'Подтвердите расчёт в личном кабинете. Перед этим мы ещё раз сверим цену с магазином, а товар выкупим сами.' },
        { title: 'Получите в Ташкенте', text: 'Привезём посылку в Узбекистан. Статус заказа виден в кабинете на каждом этапе.' },
      ],
      paymentsLabel: 'Способы оплаты', pickupLabel: 'Пункт выдачи', deliveryLabel: 'Доставка', courier: 'Курьерская доставка',
    },
    example: {
      title: 'Пример счёта', product: 'кроссовки Nike за $100', routeLabel: 'Маршрут', to: 'Ташкент',
      days: (min, max) => `экспресс, обычно ${min}–${max} ${ruDays(max)}`,
      item: 'Цена товара',
      itemNoteCbu: (usd, rate, markup) => `${usd} по курсу ${rate} сум: ЦБ плюс ${markup}`,
      itemNoteSet: (usd, rate) => `${usd} по курсу Atlas ${rate} сум`,
      service: 'Комиссия Atlas', serviceDetail: (percent) => `${percent} от цены товара`,
      delivery: 'Доставка в Узбекистан', deliveryNote: (boxed, packaging, perKg) => `${boxed} кг в коробке и ${packaging} кг упаковки по ${perKg} за кг`,
      reserve: 'Возвратный резерв', reserveNote: 'неиспользованное вернём на баланс после взвешивания', reserveHelpLabel: 'Что такое возвратный резерв',
      reserveHelp: 'Запас на случай, если посылка окажется тяжелее расчётной. После взвешивания на складе неиспользованную часть вернём на ваш баланс Atlas. Если доставка выйдет дороже резерва, доплата — только с вашего согласия.',
      total: 'К оплате',
      outsideTitle: 'Не входит в сумму к оплате',
      dutyLabel: 'Таможенная пошлина', dutyStatus: 'не нужна',
      dutyNote: (allowance) => `Без пошлины можно ввезти до ${allowance} в месяц на одного получателя, с учётом покупок вне Atlas.`,
    },
    catalog: { title: 'Подборка товаров', intro: 'Товары из зарубежных магазинов, отобранные Atlas, с итогом в сумах.', order: 'Заказать', storePrice: 'Цена в магазине', total: 'С доставкой в Узбекистан', breakdown: 'Из чего сумма' },
    tariffs: {
      title: 'Сроки и тарифы', lead: 'Экспресс или обычная доставка от нашего склада за рубежом до Узбекистана — на выбор при оформлении. В таблице — обычный срок в рабочих днях; доставка магазина до склада и таможня идут сверх него.',
      from: 'Откуда', time: 'Срок доставки', perKg: 'Цена за 1 кг', perKgUnit: '/кг',
      per100g: (usd) => `${usd} за 100 г`,
      days: (min, max) => `${min}–${max} ${ruDays(max)}`, pending: 'уточняется',
      speeds: { express: 'Экспресс', standard: 'Обычная' }, speedsLabel: 'Скорость доставки', noDays: 'Срок зависит от магазина и рейса, покажем его в расчёте по вашей ссылке.',
      regions: { us: 'США', uk: 'Великобритания', cn: 'Китай', de: 'Германия', it: 'Италия', es: 'Испания' },
      weightNote: 'Вес считаем с коробкой и добавляем 0,3 кг на упаковку, один раз на посылку. Минимум 1 кг на посылку из одного магазина.',
      rateNote: 'Текущие тарифы Atlas, не оферта.',
    },
    trust: {
      title: 'Как мы обращаемся с вашими деньгами', ordersDone: 'заказов уже доставили',
      facts: ({ fee, markup, cbu, freeFrom, allowance }) => [
        'Сверяем цену с магазином, когда вы добавляете товар в корзину, и ещё раз перед оформлением. Если она изменилась, сначала покажем новую сумму.',
        cbu ? `Курс считаем от курса ЦБ Узбекистана плюс ${markup} и пишем рядом с суммой, когда он обновлён.` : 'Курс Atlas пишем рядом с суммой.',
        `Комиссия Atlas ${fee} от цены товаров стоит в счёте отдельной строкой.`,
        `Если магазин не указал доставку, при заказе из него дороже ${freeFrom} она бесплатна. Иначе держим на неё отдельный резерв — в сумму к оплате он не входит.`,
        'Склад взвесит посылку: если она легче расчёта — разницу вернём на баланс. Оплата сверх счёта — только с вашего согласия.',
        `Лимит без пошлины ${allowance} в месяц считаем отдельно для каждого получателя.`,
      ],
      trackingTitle: 'Отслеживание заказа', example: 'Пример', trackingProduct: 'Кроссовки Nike', trackingOrder: 'Заказ AT-1042', trackingNote: 'Так выглядит статус заказа в личном кабинете.',
      reviewsTitle: 'Отзывы клиентов', photosTitle: 'Посылки наших клиентов',
      legalTitle: 'Юридическая информация', entity: 'Компания', inn: 'ИНН', address: 'Адрес', legalLink: 'Правила сервиса',
    },
    faq: {
      title: 'Частые вопросы', timesQuestion: 'Сколько ждать заказ?',
      timesKnown: (list) => `От нашего склада за рубежом обычно: ${list}. Скорость выбираете при оформлении. К этому добавьте доставку магазина до склада и таможенное оформление.`,
      timesUnknown: 'Срок складывается из доставки магазина до нашего склада, перевозки в Узбекистан и таможни. Обычные сроки по странам — в таблице «Сроки и тарифы».',
      customsLink: 'Подробнее о таможне', prohibitedOfficial: 'Официальный список', prohibitedRules: 'Правила сервиса',
      items: {
        customs: { q: 'Что такое лимит $200 на таможне?', a: 'Покупки для себя на сумму до $200 в месяц на одного получателя ввозятся без пошлины. Если за месяц набралось больше, пошлину платят только с превышения. Ставку и пример расчёта мы держим на странице «Таможня»; окончательную сумму определяет таможня.' },
        returns: { q: 'Можно ли вернуть товар?', a: 'До выкупа заказ можно отменить — вернём деньги за вычетом расходов, которые вы видели заранее. После выкупа вернуть товар можно, если это принимает магазин: мы поможем оформить возврат. Деньги возвращаем тем же способом, которым вы платили, или на баланс Atlas.' },
        prohibited: { q: 'Какие товары нельзя заказать?', a: 'Оружие и боеприпасы, взрывчатые и наркотические вещества, табак, а также всё, что запрещают магазин, перевозчик или таможня Узбекистана.' },
        weight: { q: 'Как считается вес?', a: 'Берём вес товара с коробкой — его указывает магазин, а если нет, Atlas даёт оценку по виду товара, и её можно исправить. К посылке добавляем 0,3 кг на упаковку, один раз. Минимум — 1 кг на посылку из одного магазина. После взвешивания на складе пересчитаем: если вышло меньше, разницу вернём на баланс.' },
        account: { q: 'Нужна ли регистрация?', a: 'Для расчёта нет. Чтобы оформить заказ, войдите удобным способом: аккаунт создастся автоматически.' },
      },
    },
    closing: { title: 'Посчитайте свой заказ', text: 'Вставьте ссылку на товар: счёт в сумах появится сразу, до регистрации и оплаты.' },
    footer: {
      tagline: 'Покупки в зарубежных магазинах с доставкой в Узбекистан.', buyers: 'Покупателям', contacts: 'Контакты', legal: 'Юридическая информация',
      support: 'Поддержка в личном кабинете', rules: 'Правила сервиса', privacy: 'Политика данных', customs: 'Таможня', faq: 'Частые вопросы',
      telegramSupport: 'Telegram-бот', telegramChannel: 'Telegram-канал', phone: 'Телефон', instagram: 'Instagram', pickup: 'Пункт выдачи', theme: 'Тема',
    },
    sticky: { paste: 'Вставить ссылку' },
    wide: {
      factsLabel: 'Atlas в цифрах', andMore: 'и другие',
      storesUnit: (count) => ruPlural(count, ['магазин', 'магазина', 'магазинов']), countriesUnit: (count) => ruPlural(count, ['страна', 'страны', 'стран']), countriesSub: 'откуда везём',
      priceFrom: (price) => `от ${price}`, daysUnit: (max) => ruDays(max), fromWarehouse: 'от склада',
      stepCheck: ['Если цена изменилась, сначала покажем новую сумму.', 'Оплата сверх счёта — только с вашего согласия.'],
      routeTitle: 'Из чего складывается срок',
      routeStore: 'Магазин → наш склад', routeStoreNote: 'срок магазина, сверх таблицы',
      routeFly: 'Склад → Узбекистан', routeFlyNote: 'по таблице',
      routeCustoms: 'Таможня', routeCustomsNote: 'оформление, сверх таблицы',
      or: 'или', faqMore: 'Не нашли ответ?',
    },
  },
  uz: {
    nav: { catalog: 'Katalog', stores: 'Do‘konlar', how: 'Qanday ishlaydi', tariffs: 'Tariflar', orders: 'Buyurtmalarim', signin: 'Kirish', account: 'Kabinet', language: 'Sayt tili' },
    hero: {
      title: 'AQSh, Yevropa va Xitoy do‘konlaridan xarid qilib, Toshkentga olib kelamiz',
      lead: 'Tovar havolasini qo‘ying. Hisobni darhol so‘mda, har bir satri bilan, to‘lovdan oldin ko‘rsatamiz.',
      label: 'Tovar havolasi', placeholder: 'Tovar havolasini qo‘ying', calculate: 'Hisoblash',
      invalid: 'Tovar sahifasining to‘liq havolasini qo‘ying — u https:// bilan boshlanadi',
      guestNote: 'Hisoblash bepul, ro‘yxatdan o‘tish shart emas.', memberNote: 'Hisoblash bepul va hech narsaga majburlamaydi.',
      popular: 'Mashhur do‘konlar', openStore: 'yangi oynada ochiladi', batch: 'Bir nechta havola qo‘shish', catalog: 'Tovarlar to‘plamini ko‘rish',
      allStores: (count) => `Barcha ${count} ta do‘kon`,
      storesHint: 'Do‘konni oching, tovar havolasini nusxalang va yuqoridagi maydonga qo‘ying.',
    },
    how: {
      title: 'Bu qanday ishlaydi',
      steps: [
        { title: 'Havolani qo‘ying', text: 'Xorijiy do‘kondagi tovar havolasini nusxalab, yuqoridagi maydonga qo‘ying.' },
        { title: 'Hisobni tekshiring', text: 'Yakuniy narxni darhol so‘mda ko‘rsatamiz: tovar, komissiya va yetkazib berish alohida satrlarda.' },
        { title: 'Buyurtmani tasdiqlang', text: 'Hisobni shaxsiy kabinetda tasdiqlang. Undan oldin narxni do‘kon bilan yana bir bor solishtiramiz, tovarni esa o‘zimiz sotib olamiz.' },
        { title: 'Toshkentda qabul qiling', text: 'Jo‘natmani O‘zbekistonga olib kelamiz. Buyurtma holati har bir bosqichda kabinetda ko‘rinadi.' },
      ],
      paymentsLabel: 'To‘lov usullari', pickupLabel: 'Topshirish punkti', deliveryLabel: 'Yetkazib berish', courier: 'Kuryer orqali yetkazib berish',
    },
    example: {
      title: 'Hisob namunasi', product: 'Nike krossovkalari, $100', routeLabel: 'Yo‘nalish', to: 'Toshkent',
      days: (min, max) => `ekspress, odatda ${min}–${max} ish kuni`,
      item: 'Tovar narxi',
      itemNoteCbu: (usd, rate, markup) => `${usd}, kurs ${rate} so‘m: MB kursi va ${markup}`,
      itemNoteSet: (usd, rate) => `${usd}, Atlas kursi ${rate} so‘m`,
      service: 'Atlas komissiyasi', serviceDetail: (percent) => `tovar narxining ${percent}`,
      delivery: 'O‘zbekistonga yetkazib berish', deliveryNote: (boxed, packaging, perKg) => `qutisi bilan ${boxed} kg va qadoq ${packaging} kg, har kg uchun ${perKg}`,
      reserve: 'Qaytariladigan zaxira', reserveNote: 'ishlatilmagan qismi tortilgandan keyin balansga qaytadi', reserveHelpLabel: 'Qaytariladigan zaxira nima',
      reserveHelp: 'Jo‘natma hisoblangandan og‘irroq chiqsa, ehtiyot uchun qo‘yiladi. Omborda tortilgandan keyin ishlatilmagan qismi Atlas balansingizga qaytariladi. Yetkazib berish zaxiradan qimmatroq bo‘lsa, qo‘shimcha to‘lov — faqat roziligingiz bilan.',
      total: 'To‘lov uchun',
      outsideTitle: 'To‘lov summasiga kirmaydi',
      dutyLabel: 'Bojxona to‘lovi', dutyStatus: 'kerak emas',
      dutyNote: (allowance) => `Bitta oluvchiga oyiga ${allowance} gacha bojsiz olib kirish mumkin, Atlasdan tashqari xaridlar ham hisobga olinadi.`,
    },
    catalog: { title: 'Tovarlar to‘plami', intro: 'Atlas tanlagan xorijiy do‘kon tovarlari, yakuniy narxi so‘mda.', order: 'Buyurtma berish', storePrice: 'Do‘kondagi narx', total: 'O‘zbekistonga yetkazish bilan', breakdown: 'Summa nimadan iborat' },
    tariffs: {
      title: 'Muddatlar va tariflar', lead: 'Xorijdagi omborimizdan O‘zbekistonga ekspress yoki oddiy yetkazib berish — rasmiylashtirishda tanlaysiz. Jadvalda — odatdagi muddat, ish kunlarida; do‘kondan omborgacha yetkazish va bojxona bunga kirmaydi.',
      from: 'Qayerdan', time: 'Yetkazish muddati', perKg: '1 kg narxi', perKgUnit: '/kg',
      per100g: (usd) => `100 g uchun ${usd}`,
      days: (min, max) => `${min}–${max} ish kuni`, pending: 'aniqlanmoqda',
      speeds: { express: 'Ekspress', standard: 'Oddiy' }, speedsLabel: 'Yetkazish tezligi', noDays: 'Muddat do‘kon va reysga bog‘liq, uni havolangiz bo‘yicha hisobda ko‘rsatamiz.',
      regions: { us: 'AQSh', uk: 'Buyuk Britaniya', cn: 'Xitoy', de: 'Germaniya', it: 'Italiya', es: 'Ispaniya' },
      weightNote: 'Og‘irlikni quti bilan hisoblaymiz va qadoq uchun 0,3 kg qo‘shamiz, jo‘natmaga bir marta. Bitta do‘kondan kelgan jo‘natma uchun kamida 1 kg.',
      rateNote: 'Atlasning joriy tariflari, oferta emas.',
    },
    trust: {
      title: 'Pulingiz bilan qanday ishlaymiz', ordersDone: 'ta buyurtma yetkazildi',
      facts: ({ fee, markup, cbu, freeFrom, allowance }) => [
        'Tovarni savatga qo‘shganingizda va rasmiylashtirishdan oldin yana narxni do‘kon bilan solishtiramiz. U o‘zgargan bo‘lsa, avval yangi summani ko‘rsatamiz.',
        cbu ? `Kursni O‘zbekiston Markaziy banki kursiga ${markup} qo‘shib hisoblaymiz va summaning yonida qachon yangilanganini yozamiz.` : 'Atlas kursini summaning yonida yozamiz.',
        `Atlas komissiyasi (tovarlar narxining ${fee}) hisobda alohida satrda turadi.`,
        `Do‘kon yetkazishni ko‘rsatmagan bo‘lsa, undan ${freeFrom} dan qimmat buyurtmada u bepul. Aks holda unga alohida zaxira qo‘yamiz — u to‘lov summasiga kirmaydi.`,
        'Ombor jo‘natmani tortadi: hisobdan yengil chiqsa — farqni balansga qaytaramiz. Hisobdan ortiq to‘lov — faqat roziligingiz bilan.',
        `Oyiga ${allowance} bojsiz limitni har bir oluvchi uchun alohida hisoblaymiz.`,
      ],
      trackingTitle: 'Buyurtmani kuzatish', example: 'Namuna', trackingProduct: 'Nike krossovkalari', trackingOrder: 'AT-1042 buyurtma', trackingNote: 'Buyurtma holati shaxsiy kabinetda shunday ko‘rinadi.',
      reviewsTitle: 'Mijozlar fikrlari', photosTitle: 'Mijozlarimiz jo‘natmalari',
      legalTitle: 'Yuridik ma’lumotlar', entity: 'Kompaniya', inn: 'STIR', address: 'Manzil', legalLink: 'Xizmat qoidalari',
    },
    faq: {
      title: 'Ko‘p beriladigan savollar', timesQuestion: 'Buyurtmani qancha kutish kerak?',
      timesKnown: (list) => `Xorijdagi omborimizdan odatda: ${list}. Tezlikni rasmiylashtirishda tanlaysiz. Bunga do‘kondan omborgacha yetkazish va bojxona rasmiylashtiruvini qo‘shing.`,
      timesUnknown: 'Muddat do‘kondan omborimizgacha yetkazish, O‘zbekistonga tashish va bojxonadan iborat. Mamlakatlar bo‘yicha odatdagi muddatlar «Muddatlar va tariflar» jadvalida.',
      customsLink: 'Bojxona haqida batafsil', prohibitedOfficial: 'Rasmiy ro‘yxat', prohibitedRules: 'Xizmat qoidalari',
      items: {
        customs: { q: 'Bojxonadagi 200 $ limiti nima?', a: 'Shaxsiy foydalanish uchun bitta oluvchiga oyiga 200 $ gacha bo‘lgan xaridlar bojsiz olib kiriladi. Agar oy davomida ko‘proq bo‘lsa, boj faqat oshgan qismidan to‘lanadi. Stavka va hisob namunasi «Bojxona» sahifasida; yakuniy summani bojxona belgilaydi.' },
        returns: { q: 'Tovarni qaytarish mumkinmi?', a: 'Xariddan oldin buyurtmani bekor qilish mumkin — oldindan ko‘rgan xarajatlaringizni chegirib, pulni qaytaramiz. Xariddan keyin tovarni do‘kon qabul qilsa, qaytarish mumkin: rasmiylashtirishga yordam beramiz. Pul siz to‘lagan usulda yoki Atlas balansiga qaytariladi.' },
        prohibited: { q: 'Qaysi tovarlarni buyurtma qilib bo‘lmaydi?', a: 'Qurol va o‘q-dorilar, portlovchi va giyohvand moddalar, tamaki, shuningdek do‘kon, tashuvchi yoki O‘zbekiston bojxonasi taqiqlagan barcha narsalar.' },
        weight: { q: 'Og‘irlik qanday hisoblanadi?', a: 'Tovar og‘irligini quti bilan olamiz — uni do‘kon ko‘rsatadi, bo‘lmasa Atlas tovar turiga qarab baholaydi va uni tuzatish mumkin. Jo‘natmaga qadoq uchun 0,3 kg bir marta qo‘shamiz. Bitta do‘kondan kelgan jo‘natma uchun kamida 1 kg. Omborda tortilgandan keyin qayta hisoblaymiz: kam chiqsa, farq balansingizga qaytariladi.' },
        account: { q: 'Ro‘yxatdan o‘tish kerakmi?', a: 'Hisoblash uchun yo‘q. Buyurtma berish uchun qulay usulda kiring: akkaunt avtomatik yaratiladi.' },
      },
    },
    closing: { title: 'Buyurtmangizni hisoblang', text: 'Tovar havolasini qo‘ying: so‘mdagi hisob ro‘yxatdan o‘tish va to‘lovdan oldin darhol chiqadi.' },
    footer: {
      tagline: 'Xorijiy do‘konlardan O‘zbekistonga yetkazib berish bilan xaridlar.', buyers: 'Xaridorlarga', contacts: 'Aloqa', legal: 'Yuridik ma’lumotlar',
      support: 'Shaxsiy kabinetdagi yordam', rules: 'Xizmat qoidalari', privacy: 'Ma’lumotlar siyosati', customs: 'Bojxona', faq: 'Savollar',
      telegramSupport: 'Telegram-bot', telegramChannel: 'Telegram-kanal', phone: 'Telefon', instagram: 'Instagram', pickup: 'Topshirish punkti', theme: 'Mavzu',
    },
    sticky: { paste: 'Havolani qo‘yish' },
    wide: {
      factsLabel: 'Atlas raqamlarda', andMore: 'va boshqalar',
      storesUnit: () => 'ta do‘kon', countriesUnit: () => 'ta davlat', countriesSub: 'qayerdan olib kelamiz',
      priceFrom: (price) => `${price} dan`, daysUnit: () => 'ish kuni', fromWarehouse: 'ombordan',
      stepCheck: ['Narx o‘zgargan bo‘lsa, avval yangi summani ko‘rsatamiz.', 'Hisobdan ortiq to‘lov — faqat roziligingiz bilan.'],
      routeTitle: 'Muddat nimalardan iborat',
      routeStore: 'Do‘kon → omborimiz', routeStoreNote: 'do‘kon muddati, jadvalga kirmaydi',
      routeFly: 'Ombor → O‘zbekiston', routeFlyNote: 'jadval bo‘yicha',
      routeCustoms: 'Bojxona', routeCustomsNote: 'rasmiylashtiruv, jadvalga kirmaydi',
      or: 'yoki', faqMore: 'Javob topmadingizmi?',
    },
  },
  en: {
    nav: { catalog: 'Catalog', stores: 'Stores', how: 'How it works', tariffs: 'Rates', orders: 'My orders', signin: 'Sign in', account: 'Account', language: 'Site language' },
    hero: {
      title: 'We buy from stores in the USA, Europe and China and bring it to Tashkent',
      lead: 'Paste a product link. We show the bill in soum right away, line by line, before you pay.',
      label: 'Product link', placeholder: 'Paste a product link', calculate: 'Calculate',
      invalid: 'Paste the full product page link — it starts with https://',
      guestNote: 'The estimate is free, no sign-up needed.', memberNote: 'The estimate is free and commits you to nothing.',
      popular: 'Popular stores', openStore: 'opens in a new tab', batch: 'Add several links', catalog: 'Browse the product selection',
      allStores: (count) => `All ${count} stores`,
      storesHint: 'Open a store, copy the product link and paste it into the field above.',
    },
    how: {
      title: 'How it works',
      steps: [
        { title: 'Paste the link', text: 'Copy a product link from a store abroad and paste it into the field above.' },
        { title: 'Check the bill', text: 'We show the total in soum right away: item, fee and delivery on separate lines.' },
        { title: 'Confirm the order', text: 'Confirm the estimate in your account. Before that we check the price with the store once more, and we buy the item ourselves.' },
        { title: 'Collect it in Tashkent', text: 'We bring the parcel to Uzbekistan. Your account shows the order status at every stage.' },
      ],
      paymentsLabel: 'Payment methods', pickupLabel: 'Pickup point', deliveryLabel: 'Delivery', courier: 'Courier delivery',
    },
    example: {
      title: 'Example bill', product: 'Nike sneakers, $100', routeLabel: 'Route', to: 'Tashkent',
      days: (min, max) => `express, usually ${min}–${max} business days`,
      item: 'Item price',
      itemNoteCbu: (usd, rate, markup) => `${usd} at ${rate} soum: Central Bank rate plus ${markup}`,
      itemNoteSet: (usd, rate) => `${usd} at the Atlas rate of ${rate} soum`,
      service: 'Atlas fee', serviceDetail: (percent) => `${percent} of the item price`,
      delivery: 'Delivery to Uzbekistan', deliveryNote: (boxed, packaging, perKg) => `${boxed} kg boxed and ${packaging} kg packaging at ${perKg} per kg`,
      reserve: 'Refundable reserve', reserveNote: 'what is unused returns to your balance after weighing', reserveHelpLabel: 'What is the refundable reserve',
      reserveHelp: 'A buffer in case the parcel is heavier than estimated. After warehouse weighing, any unused part returns to your Atlas balance. If delivery costs more than the reserve, any extra payment needs your consent.',
      total: 'To pay',
      outsideTitle: 'Not in the amount to pay',
      dutyLabel: 'Customs duty', dutyStatus: 'not needed',
      dutyNote: (allowance) => `Up to ${allowance} a month per recipient enters duty-free, counting purchases outside Atlas.`,
    },
    catalog: { title: 'Product selection', intro: 'Products from international stores, selected by Atlas, with the total in soum.', order: 'Order', storePrice: 'Store price', total: 'With delivery to Uzbekistan', breakdown: 'What’s in the total' },
    tariffs: {
      title: 'Delivery times and rates', lead: 'Express or standard delivery from our warehouse abroad to Uzbekistan — you choose at checkout. The table shows the usual time in business days; the store’s shipping to the warehouse and customs come on top.',
      from: 'From', time: 'Delivery time', perKg: 'Price per kg', perKgUnit: '/kg',
      per100g: (usd) => `${usd} per 100 g`,
      days: (min, max) => `${min}–${max} business days`, pending: 'to be confirmed',
      speeds: { express: 'Express', standard: 'Standard' }, speedsLabel: 'Delivery speed', noDays: 'Timing depends on the store and the flight; we show it in the estimate for your link.',
      regions: { us: 'USA', uk: 'United Kingdom', cn: 'China', de: 'Germany', it: 'Italy', es: 'Spain' },
      weightNote: 'We count the item with its box and add 0.3 kg for packaging, once per parcel. Minimum 1 kg per parcel from one store.',
      rateNote: 'Current Atlas rates, not an offer.',
    },
    trust: {
      title: 'How we handle your money', ordersDone: 'orders delivered',
      facts: ({ fee, markup, cbu, freeFrom, allowance }) => [
        'We check the price with the store when you add an item to the cart and again before checkout. If it has changed, we show you the new total first.',
        cbu ? `The rate is the Central Bank of Uzbekistan rate plus ${markup}, shown next to the total with the time it was updated.` : 'The Atlas rate is shown next to the total.',
        `The Atlas fee, ${fee} of the item price, is a separate line in the bill.`,
        `If a store does not state delivery, it is free on orders from that store over ${freeFrom}. Otherwise we hold a separate reserve for it, outside the amount to pay.`,
        'The warehouse weighs the parcel: if it is lighter than estimated, the difference returns to your balance. Anything above the bill is paid only with your consent.',
        `The ${allowance} monthly duty-free limit is counted separately for each recipient.`,
      ],
      trackingTitle: 'Order tracking', example: 'Example', trackingProduct: 'Nike sneakers', trackingOrder: 'Order AT-1042', trackingNote: 'This is how an order status looks in your account.',
      reviewsTitle: 'Customer reviews', photosTitle: 'Our customers’ parcels',
      legalTitle: 'Legal information', entity: 'Company', inn: 'Tax ID (INN)', address: 'Address', legalLink: 'Terms of service',
    },
    faq: {
      title: 'Frequently asked questions', timesQuestion: 'How long does delivery take?',
      timesKnown: (list) => `From our warehouse abroad, usually: ${list}. You choose the speed at checkout. Add the store’s shipping to the warehouse and customs clearance.`,
      timesUnknown: 'Delivery time covers the store’s shipping to our warehouse, transport to Uzbekistan and customs. See “Delivery times and rates” for the usual times by country.',
      customsLink: 'More about customs', prohibitedOfficial: 'Official list', prohibitedRules: 'Terms of service',
      items: {
        customs: { q: 'What is the $200 customs limit?', a: 'Personal purchases up to $200 a month per recipient enter without duty. If a month’s total is higher, duty applies only to the excess. The rate and a worked example are on the Customs page; customs sets the final amount.' },
        returns: { q: 'Can I return an item?', a: 'Before purchase you can cancel the order — we refund the money minus costs you saw in advance. After purchase a return is possible if the store accepts it; we help arrange it. Refunds go back by the payment method you used or to your Atlas balance.' },
        prohibited: { q: 'Which items can’t be ordered?', a: 'Weapons and ammunition, explosives, narcotics, tobacco, and anything the store, the carrier or Uzbekistan customs prohibits.' },
        weight: { q: 'How is weight calculated?', a: 'We take the item weight with its box — the store states it, or Atlas estimates it by the kind of item and you can correct it. We add 0.3 kg for packaging, once per parcel. Minimum 1 kg per parcel from one store. After warehouse weighing we recalculate: if it comes out lower, the difference returns to your balance.' },
        account: { q: 'Do I need to sign up?', a: 'Not for an estimate. To place an order, sign in the way that suits you: the account is created automatically.' },
      },
    },
    closing: { title: 'Price your order', text: 'Paste a product link: the bill in soum appears at once, before sign-up or payment.' },
    footer: {
      tagline: 'Shopping in international stores with delivery to Uzbekistan.', buyers: 'For shoppers', contacts: 'Contacts', legal: 'Legal information',
      support: 'Support in your account', rules: 'Terms of service', privacy: 'Privacy policy', customs: 'Customs', faq: 'FAQ',
      telegramSupport: 'Telegram bot', telegramChannel: 'Telegram channel', phone: 'Phone', instagram: 'Instagram', pickup: 'Pickup point', theme: 'Theme',
    },
    sticky: { paste: 'Paste a link' },
    wide: {
      factsLabel: 'Atlas in numbers', andMore: 'and more',
      storesUnit: (count) => (count === 1 ? 'store' : 'stores'), countriesUnit: (count) => (count === 1 ? 'country' : 'countries'), countriesSub: 'where we ship from',
      priceFrom: (price) => `from ${price}`, daysUnit: () => 'business days', fromWarehouse: 'from warehouse',
      stepCheck: ['If the price has changed, we show the new total first.', 'Paying more than the bill — only with your consent.'],
      routeTitle: 'What the delivery time is made of',
      routeStore: 'Store → our warehouse', routeStoreNote: 'the store’s shipping, on top of the table',
      routeFly: 'Warehouse → Uzbekistan', routeFlyNote: 'per the table',
      routeCustoms: 'Customs', routeCustomsNote: 'clearance, on top of the table',
      or: 'or', faqMore: 'Didn’t find an answer?',
    },
  },
};
