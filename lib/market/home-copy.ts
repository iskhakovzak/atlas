import type { Locale } from './i18n.ts';
import type { DeliveryRegion } from './site-content.ts';
import {withCyrillic} from './uz-cyrl.ts';
import {footerCopy,navCopy,type FooterCopy,type NavCopy} from './i18n.ts';
import {ruPlural} from './format.ts';
export {groupDigits,formatSum,formatUsd,ruPlural,formatPriceUsd,formatDayMonth,formatPercent,formatKg} from './format.ts';

function ruDays(max: number) {
  const tail = max % 100, last = max % 10;
  return tail >= 11 && tail <= 14 ? 'рабочих дней' : last === 1 ? 'рабочий день' : last >= 2 && last <= 4 ? 'рабочих дня' : 'рабочих дней';
}

type Step = { title: string; text: string };
type Faq = { q: string; a: string };
type Facts = { fee: string; freeFrom: string; hold: string; holdExample: string };
/** One rule of the money section: a short title over its text (the icons follow the order, app/home-sections.tsx). */
type Fact = { title: string; text: string };

export type HomeCopy = {
  nav: NavCopy;
  hero: {
    title: string; lead: string; label: string; placeholder: string; calculate: string; invalid: string;
    /** Plain words in the link field (no link at all): how to get a link, with the catalog and store buttons under it. */
    notLink: string; searchCatalog: (q: string) => string; openStoreNamed: (store: string) => string;
    guestNote: string; memberNote: string;
    /** The hero's note as two points with a tick (the same facts as guestNote / memberNote, which step 1 still shows). */
    guestPoints: [string, string]; memberPoints: [string, string];
    popular: string; openStore: string; batch: string; catalog: string; allStores: (count: number) => string; storesHint: string };
  how: { title: string; steps: [Step, Step, Step, Step]; paymentsLabel: string; pickupLabel: string; deliveryLabel: string; courier: string; moreStores: (count: number) => string; confirm: string };
  example: {
    title: string; product: (usd: string) => string; routeLabel: string; to: string; days: (min: number, max: number) => string;
    item: string; itemNote: (usd: string) => string; totalUsd: (usd: string) => string;
    /** The legend under the bar: what share of the total is the item and what is the Atlas service. */
    shareItem: (percent: string) => string; shareService: (percent: string) => string;
    /** One «Atlas service» line, as in the real bill (app/cost-lines.tsx); `fee` and `delivery` are its parts. */
    service: string; serviceParts: string; fee: (percent: string) => string;
    delivery: string; deliveryNote: (weight: string, perKg: string) => string;
    reserve: string; reserveNote: (packaging: string) => string; reserveHelpLabel: string; reserveHelp: string; total: string;
    dutyTitle: (allowance: string) => string; dutyNote: string; dutyUsed: (used: string, left: string) => string;
  };
  catalog: { title: string; intro: string; order: string; storePrice: string; total: string; breakdown: string };
  tariffs: { title: string; lead: string; from: string; country: string; time: string; perKg: string; perKgUnit: string; per100g: (usd: string) => string; days: (min: number, max: number) => string; pending: string; noDays: string; regions: Record<DeliveryRegion, string>; speeds: { express: string; standard: string }; speedsLabel: string; weightNote: string; rateNote: string;
    /** The rates table's own country names where a long one needs a soft hyphen (the plain names also go to the canvas decor and the facts row). */
    tableRegions?: Partial<Record<DeliveryRegion, string>>;
    /** Under the express chip: how many business days express saves (lib/market/home-facts.ts expressLead); `to` is the range's upper end. */
    faster: (range: string, to: number) => string;
  };
  trust: { title: string; facts: (facts: Facts) => Fact[]; ordersDone: string; trackingTitle: string; trackingNow: string; example: string; trackingProduct: string; trackingOrder: string; trackingNote: string; reviewsTitle: string; photosTitle: string; legalTitle: string; entity: string; inn: string; address: string; legalLink: string };
  faq: { title: string; timesQuestion: string; timesKnown: (list: string) => string; timesUnknown: string; timesLink: string; customsLink: string; prohibitedOfficial: string; prohibitedRules: string; items: { customs: (allowance: string) => Faq; returns: Faq; prohibited: Faq; weight: Faq; account: Faq } };
  closing: { title: string; text: string };
  footer: FooterCopy;
  sticky: { paste: string };
  /**
   * The hero's "continue" card for a signed-in customer (app/home-resume.tsx, lib/market/next-step.ts):
   * a decision on an order, the checkout's payment, or the cart. No sums or timers — only what waits.
   */
  resume: { approval: string; payment: string; items: (count: number) => string; cart: (count: number) => string; cartNote: string };
  /** Wide screens only (app/home-facts.tsx and the inserts in app/home-sections.tsx): facts row, step examples, route card, FAQ links. */
  wide: {
    factsLabel: string; andMore: string; storesUnit: (count: number) => string; countriesUnit: (count: number) => string; countriesSub: string;
    priceFrom: (price: string) => string; daysUnit: (max: number) => string; fromWarehouse: string; stepCheck: [string, string];
    routeTitle: string; routeStore: string; routeStoreNote: string; routeFly: string; routeFlyNote: string; routeCustoms: string; routeCustomsNote: string;
    or: string; faqMore: string;
  };
};

export const homeCopy: Record<Locale, HomeCopy> = /*@__PURE__*/withCyrillic({
  ru: {
    nav: navCopy.ru,
    hero: {
      title: 'Покупаем в магазинах США, Европы и Китая и привозим в Ташкент',
      lead: 'Вставьте ссылку на товар. Сразу покажем счёт в сумах, каждой строкой, ещё до оплаты.',
      label: 'Ссылка на товар', placeholder: 'Вставьте ссылку', calculate: 'Рассчитать',
      invalid: 'Вставьте полную ссылку на страницу товара — она начинается с https://',
      notLink: 'Это не ссылка на товар. Откройте товар в магазине, скопируйте адрес страницы и вставьте сюда.',
      searchCatalog: (q) => `Найти «${q}» в каталоге Atlas`, openStoreNamed: (store) => `Открыть ${store}`,
      guestNote: 'Расчёт бесплатный, регистрация не нужна.', memberNote: 'Расчёт бесплатный и ни к чему не обязывает.',
      guestPoints: ['Расчёт бесплатный', 'Регистрация не нужна'], memberPoints: ['Расчёт бесплатный', 'Ни к чему не обязывает'],
      popular: 'Популярные магазины', openStore: 'откроется в новой вкладке', batch: 'Добавить несколько ссылок', catalog: 'Смотреть подборку товаров',
      allStores: (count) => `Все ${count} ${ruPlural(count, ['магазин', 'магазина', 'магазинов'])}`,
      storesHint: 'Откройте магазин, скопируйте ссылку на товар и вставьте её в поле выше.',
    },
    how: {
      title: 'Как это работает',
      steps: [
        { title: 'Вставьте ссылку', text: 'Скопируйте ссылку на товар в зарубежном магазине и вставьте её в поле выше.' },
        { title: 'Проверьте счёт', text: 'Выберите цвет или размер, если нужно, и проверьте итог в сумах: товар и одна строка «Сервис Atlas» — комиссия и доставка, состав открывается нажатием.' },
        { title: 'Подтвердите заказ', text: 'Подтвердите расчёт в личном кабинете. Товар у магазина выкупим мы сами.' },
        { title: 'Получите в Ташкенте', text: 'Привезём посылку в Ташкент. Статус заказа виден в кабинете на каждом этапе.' },
      ],
      paymentsLabel: 'Способы оплаты', pickupLabel: 'Пункт выдачи', deliveryLabel: 'Доставка', courier: 'Курьерская доставка',
      moreStores: (count) => `и ещё ${count}`, confirm: 'Подтвердить расчёт',
    },
    example: {
      title: 'Пример счёта', product: usd => `кроссовки Nike за ${usd}`, routeLabel: 'Маршрут', to: 'Ташкент',
      days: (min, max) => `обычная доставка, ${min}–${max} ${ruDays(max)}`,
      item: 'Цена товара',
      itemNote: usd => `${usd} по курсу Atlas`,
      totalUsd: usd => `≈ ${usd} вместе с доставкой в Ташкент`,
      shareItem: percent => `Товар ${percent}`, shareService: percent => `Сервис ${percent}`,
      service: 'Сервис Atlas', serviceParts: 'Состав сервиса', fee: (percent) => `Комиссия ${percent}`,
      delivery: 'Доставка', deliveryNote: (weight, perKg) => `${weight} кг × ${perKg}`,
      reserve: 'Возвратный резерв', reserveNote: packaging => `В расчёт веса заложено ${packaging} кг запаса на упаковку. После взвешивания неиспользованную сумму вернём на баланс.`, reserveHelpLabel: 'Что такое возвратный резерв',
      reserveHelp: 'Запас на случай, если посылка окажется тяжелее расчётной. После взвешивания на складе неиспользованную часть вернём на ваш баланс Atlas. Если доставка выйдет дороже резерва, сначала согласуем доплату с вами.',
      total: 'К оплате',
      dutyTitle: allowance => `Без таможенной пошлины — до\u00a0${allowance} в\u00a0месяц`,
      dutyNote: 'На одного получателя, включая покупки вне Atlas.',
      dutyUsed: (used, left) => `Заказ ${used} · ещё ${left} без пошлины`,
    },
    catalog: { title: 'Подборка товаров', intro: 'Товары из зарубежных магазинов, отобранные Atlas, с итогом в сумах.', order: 'Заказать', storePrice: 'Цена в магазине', total: 'С доставкой в Ташкент', breakdown: 'Из чего сумма' },
    tariffs: {
      title: 'Сроки и тарифы', lead: 'Экспресс или обычная доставка от нашего склада за рубежом до Ташкента — на выбор при оформлении. В таблице — типичные сроки в рабочих днях; доставка магазина до склада и таможня идут сверх них.',
      from: 'Откуда', country: 'Страна', time: 'Срок доставки', perKg: 'Цена за 1 кг', perKgUnit: '/кг',
      per100g: (usd) => `${usd} за 100 г`,
      days: (min, max) => `${min}–${max} ${ruDays(max)}`, pending: 'уточняется',
      speeds: { express: 'Экспресс', standard: 'Обычная' }, speedsLabel: 'Скорость доставки', noDays: 'Срок зависит от магазина и рейса, покажем его в расчёте по вашей ссылке.',
      regions: { us: 'США', uk: 'Великобритания', cn: 'Китай', de: 'Германия', it: 'Италия', es: 'Испания' },
      // A phone cell breaks it as «Велико-/британия», not «Великобри/тания».
      tableRegions: { uk: 'Велико\u00adбритания' },
      faster: (range, to) => `На ${range} ${ruDays(to)} быстрее`,
      weightNote: 'Вес считаем с коробкой и добавляем 0,3 кг на упаковку, один раз на посылку. Минимум 1 кг на посылку из одного магазина.',
      rateNote: 'Текущие тарифы Atlas, не оферта.',
    },
    trust: {
      title: 'Как мы обращаемся с вашими деньгами', ordersDone: 'заказов уже доставили',
      facts: ({ fee, freeFrom, hold, holdExample }) => [
        { title: 'Цена сверяется дважды', text: 'Сверяем цену с магазином, когда вы добавляете товар в корзину, и ещё раз перед оформлением. Если она изменилась, сначала покажем новую сумму.' },
        { title: 'Курс фиксируется при оплате', text: 'Цены в долларах переводим в сумы по курсу Atlas на день расчёта. Курс фиксируется в заказе при оплате.' },
        { title: 'Сервис — одной строкой', text: `Комиссия Atlas ${fee} от цены товаров и международная доставка стоят в счёте одной строкой «Сервис Atlas» — состав виден по нажатию.` },
        { title: 'Доставка до склада — из резерва', text: `Если магазин не указал доставку до склада, при заказе из него дороже ${freeFrom} она бесплатна. Если дешевле, держим на неё резерв ${hold} — отдельно, в сумму к оплате он не входит. Например, заказ на ${holdExample}: когда магазин назовёт цену доставки, оплатим её из резерва, а остаток освободим; если доставка дороже ${hold} — доплата только с вашего согласия.` },
        { title: 'Легче расчёта — вернём разницу', text: 'Склад взвесит посылку: если она легче расчёта — разницу вернём на баланс. Оплата сверх счёта — только с вашего согласия.' },
      ],
      trackingTitle: 'Отслеживание заказа', trackingNow: 'Сейчас', example: 'Пример', trackingProduct: 'Кроссовки Nike', trackingOrder: 'Заказ AT-1042', trackingNote: 'Так выглядит статус заказа в личном кабинете.',
      reviewsTitle: 'Отзывы клиентов', photosTitle: 'Посылки наших клиентов',
      legalTitle: 'Юридическая информация', entity: 'Компания', inn: footerCopy.ru.inn, address: 'Адрес', legalLink: 'Публичная оферта',
    },
    faq: {
      title: 'Частые вопросы', timesQuestion: 'Сколько ждать заказ?',
      timesKnown: (list) => `От нашего склада за рубежом обычно: ${list}. Плюс доставка магазина до склада и таможня.`, timesLink: 'Сроки по странам',
      timesUnknown: 'Срок складывается из доставки магазина до нашего склада, перевозки в Ташкент и таможни. Обычные сроки по странам — в таблице «Сроки и тарифы».',
      customsLink: 'Подробнее о таможне', prohibitedOfficial: 'Официальный список', prohibitedRules: 'Ограничения в оферте',
      items: {
        customs: (allowance) => ({ q: `Что такое лимит ${allowance} на таможне?`, a: `Покупки для себя на сумму до ${allowance} в месяц на одного получателя ввозятся без пошлины. Если за месяц набралось больше, пошлину платят только с превышения. Ставку и пример расчёта мы держим на странице «Таможня»; окончательную сумму определяет таможня.` }),
        returns: { q: 'Можно ли вернуть товар?', a: 'До выкупа заказ можно отменить — вернём деньги за вычетом расходов, указанных в счёте. После выкупа вернуть товар можно, если это принимает магазин: мы поможем оформить возврат. Деньги возвращаем на баланс Atlas или на ту же карту, с которой вы платили, — на другую карту не переводим.' },
        prohibited: { q: 'Какие товары нельзя заказать?', a: 'Топливо и б/у детали топливных систем, спиртные напитки, ограниченные лекарства, едкие и опасные химикаты, наркотические вещества, оружие и боеприпасы, легковоспламеняющееся (в том числе спреи и парфюм больше 100 мл на коробку), острые предметы без упаковки, амортизаторы без упаковки, игрушки 18+, табак, а также всё, что запрещают магазин, перевозчик или таможня Узбекистана. Полный список — на странице «Таможня».' },
        weight: { q: 'Как считается вес?', a: 'Берём вес товара с коробкой — его указывает магазин, а если нет, Atlas даёт оценку по виду товара, и её можно исправить. К посылке добавляем 0,3 кг на упаковку, один раз. Минимум — 1 кг на посылку из одного магазина. После взвешивания на складе пересчитаем: если вышло меньше, разницу вернём на баланс.' },
        account: { q: 'Нужна ли регистрация?', a: 'Для расчёта цены — нет. Чтобы оформить заказ, войдите удобным способом: аккаунт создастся автоматически.' },
      },
    },
    closing: { title: 'Посчитайте свой заказ', text: 'Вставьте ссылку на товар: счёт в сумах появится сразу, до регистрации и оплаты.' },
    footer: footerCopy.ru,
    sticky: { paste: 'Вставить ссылку' },
    resume: {
      approval: 'Нужно ваше решение по заказу', payment: 'Завершите оплату заказа',
      items: (count) => `${count} ${ruPlural(count, ['товар', 'товара', 'товаров'])}`,
      cart: (count) => `В корзине ${count} ${ruPlural(count, ['товар', 'товара', 'товаров'])}`, cartNote: 'Осталось оформить заказ',
    },
    wide: {
      factsLabel: 'Atlas в цифрах', andMore: 'и другие',
      storesUnit: (count) => ruPlural(count, ['магазин', 'магазина', 'магазинов']), countriesUnit: (count) => ruPlural(count, ['страна', 'страны', 'стран']), countriesSub: 'откуда везём',
      priceFrom: (price) => `от ${price}`, daysUnit: (max) => ruDays(max), fromWarehouse: 'от склада',
      stepCheck: ['Если цена изменилась, сначала покажем новую сумму.', 'Оплата сверх счёта — только с вашего согласия.'],
      routeTitle: 'Из чего складывается срок',
      routeStore: 'Магазин → наш склад', routeStoreNote: 'срок магазина, сверх таблицы',
      routeFly: 'Склад → Ташкент', routeFlyNote: 'по таблице',
      routeCustoms: 'Таможня', routeCustomsNote: 'оформление, сверх таблицы',
      or: 'или', faqMore: 'Не нашли ответ?',
    },
  },
  uz: {
    nav: navCopy.uz,
    hero: {
      title: 'AQSh, Yevropa va Xitoy do‘konlaridan xarid qilib, Toshkentga olib kelamiz',
      lead: 'Tovar havolasini qo‘ying. Hisobni darhol so‘mda, har bir satri bilan, to‘lovdan oldin ko‘rsatamiz.',
      label: 'Tovar havolasi', placeholder: 'Havolani qo‘ying', calculate: 'Hisoblash',
      invalid: 'Tovar sahifasining to‘liq havolasini qo‘ying — u https:// bilan boshlanadi',
      notLink: 'Bu tovar havolasi emas. Tovarni do‘konda oching, sahifa manzilini nusxalab, shu yerga qo‘ying.',
      searchCatalog: (q) => `Atlas katalogida qidirish: «${q}»`, openStoreNamed: (store) => `${store} saytini ochish`,
      guestNote: 'Hisoblash bepul, ro‘yxatdan o‘tish shart emas.', memberNote: 'Hisoblash bepul va hech narsaga majburlamaydi.',
      guestPoints: ['Hisoblash bepul', 'Ro‘yxatdan o‘tish shart emas'], memberPoints: ['Hisoblash bepul', 'Hech narsaga majburlamaydi'],
      popular: 'Mashhur do‘konlar', openStore: 'yangi oynada ochiladi', batch: 'Bir nechta havola qo‘shish', catalog: 'Tovarlar to‘plamini ko‘rish',
      allStores: (count) => `Barcha ${count} ta do‘kon`,
      storesHint: 'Do‘konni oching, tovar havolasini nusxalang va yuqoridagi maydonga qo‘ying.',
    },
    how: {
      title: 'Bu qanday ishlaydi',
      steps: [
        { title: 'Havolani qo‘ying', text: 'Xorijiy do‘kondagi tovar havolasini nusxalab, yuqoridagi maydonga qo‘ying.' },
        { title: 'Hisobni tekshiring', text: 'Kerak bo‘lsa, rang yoki o‘lchamni tanlang va yakuniy narxni so‘mda tekshiring: tovar va bitta «Atlas xizmati» satri — komissiya va yetkazib berish, tarkibi bosganda ochiladi.' },
        { title: 'Buyurtmani tasdiqlang', text: 'Hisobni shaxsiy kabinetda tasdiqlang. Tovarni do‘kondan o‘zimiz sotib olamiz.' },
        { title: 'Toshkentda qabul qiling', text: 'Jo‘natmani Toshkentga olib kelamiz. Buyurtma holati har bir bosqichda kabinetda ko‘rinadi.' },
      ],
      paymentsLabel: 'To‘lov usullari', pickupLabel: 'Topshirish punkti', deliveryLabel: 'Yetkazib berish', courier: 'Kuryer orqali yetkazib berish',
      moreStores: (count) => `va yana ${count} ta`, confirm: 'Hisobni tasdiqlash',
    },
    example: {
      title: 'Hisob namunasi', product: usd => `Nike krossovkalari, ${usd}`, routeLabel: 'Yo‘nalish', to: 'Toshkent',
      days: (min, max) => `oddiy yetkazib berish, ${min}–${max} ish kuni`,
      item: 'Tovar narxi',
      itemNote: usd => `${usd}, Atlas kursi bilan`,
      totalUsd: usd => `Toshkentga yetkazish bilan ≈ ${usd}`,
      shareItem: percent => `Tovar ${percent}`, shareService: percent => `Xizmat ${percent}`,
      service: 'Atlas xizmati', serviceParts: 'Xizmat tarkibi', fee: (percent) => `Komissiya ${percent}`,
      delivery: 'Yetkazib berish', deliveryNote: (weight, perKg) => `${weight} kg × ${perKg}`,
      reserve: 'Qaytariladigan zaxira', reserveNote: packaging => `Vazn hisobiga qadoq uchun ${packaging} kg zaxira kiritilgan. Omborda tortilgach, ishlatilmagan summa balansga qaytariladi.`, reserveHelpLabel: 'Qaytariladigan zaxira nima',
      reserveHelp: 'Jo‘natma hisoblangandan og‘irroq chiqsa, ehtiyot uchun qo‘yiladi. Omborda tortilgandan keyin ishlatilmagan qismi Atlas balansingizga qaytariladi. Yetkazib berish zaxiradan qimmatroq bo‘lsa, qo‘shimcha to‘lovni avval siz bilan kelishamiz.',
      total: 'To‘lovga',
      dutyTitle: allowance => `Oyiga ${allowance}\u00a0gacha — bojsiz`,
      dutyNote: 'Bitta oluvchiga, Atlasdan tashqari xaridlar ham hisobga olinadi.',
      dutyUsed: (used, left) => `Buyurtma ${used} · yana ${left} bojsiz`,
    },
    catalog: { title: 'Tovarlar to‘plami', intro: 'Atlas tanlagan xorijiy do‘kon tovarlari, yakuniy narxi so‘mda.', order: 'Buyurtma berish', storePrice: 'Do‘kondagi narx', total: 'Toshkentga yetkazish bilan', breakdown: 'Summa nimadan iborat' },
    tariffs: {
      title: 'Muddatlar va tariflar', lead: 'Xorijdagi omborimizdan Toshkentga ekspress yoki oddiy yetkazib berish — rasmiylashtirishda tanlaysiz. Jadvalda — odatdagi muddat, ish kunlarida; do‘kondan omborgacha yetkazish va bojxona bunga kirmaydi.',
      from: 'Qayerdan', country: 'Davlat', time: 'Yetkazish muddati', perKg: '1 kg narxi', perKgUnit: '/kg',
      per100g: (usd) => `100 g uchun ${usd}`,
      days: (min, max) => `${min}–${max} ish kuni`, pending: 'aniqlanmoqda',
      speeds: { express: 'Ekspress', standard: 'Oddiy' }, speedsLabel: 'Yetkazish tezligi', noDays: 'Muddat do‘kon va reysga bog‘liq, uni havolangiz bo‘yicha hisobda ko‘rsatamiz.',
      regions: { us: 'AQSh', uk: 'Buyuk Britaniya', cn: 'Xitoy', de: 'Germaniya', it: 'Italiya', es: 'Ispaniya' },
      // The same name as above (it breaks at its space); kept so every language has the same keys (tests/home.test.mjs).
      tableRegions: { uk: 'Buyuk Britaniya' },
      faster: (range) => `${range} ish kuni tezroq`,
      weightNote: 'Og‘irlikni quti bilan hisoblaymiz va qadoq uchun 0,3 kg qo‘shamiz, jo‘natmaga bir marta. Bitta do‘kondan kelgan jo‘natma uchun kamida 1 kg.',
      rateNote: 'Atlasning joriy tariflari, oferta emas.',
    },
    trust: {
      title: 'Pulingiz bilan qanday ishlaymiz', ordersDone: 'ta buyurtma yetkazildi',
      facts: ({ fee, freeFrom, hold, holdExample }) => [
        { title: 'Narx ikki marta tekshiriladi', text: 'Tovarni savatga qo‘shganingizda va rasmiylashtirishdan oldin yana narxni do‘kon bilan solishtiramiz. U o‘zgargan bo‘lsa, avval yangi summani ko‘rsatamiz.' },
        { title: 'Kurs to‘lovda qayd etiladi', text: 'Dollardagi narxlarni hisob kunidagi Atlas kursi bilan so‘mga o‘tkazamiz. Kurs to‘lov paytida buyurtmada qayd etiladi.' },
        { title: 'Xizmat — bitta satrda', text: `Atlas komissiyasi (tovarlar narxining ${fee}) va xalqaro yetkazish hisobda bitta «Atlas xizmati» satrida turadi — tarkibi bosganda ko‘rinadi.` },
        { title: 'Omborgacha yetkazish — zaxiradan', text: `Do‘kon omborgacha yetkazish narxini ko‘rsatmagan bo‘lsa, undan ${freeFrom} dan qimmat buyurtmada yetkazish bepul. Arzonroq buyurtmada unga ${hold} zaxira qo‘yamiz — u alohida turadi va to‘lov summasiga kirmaydi. Masalan, ${holdExample} lik buyurtma: do‘kon yetkazish narxini aytgach, uni zaxiradan to‘laymiz, qoldig‘ini bo‘shatamiz; yetkazish ${hold} dan qimmat bo‘lsa — qo‘shimcha to‘lov faqat roziligingiz bilan.` },
        { title: 'Yengil chiqsa — farqni qaytaramiz', text: 'Ombor jo‘natmani tortadi: hisobdan yengil chiqsa — farqni balansga qaytaramiz. Hisobdan ortiq to‘lov — faqat roziligingiz bilan.' },
      ],
      trackingTitle: 'Buyurtmani kuzatish', trackingNow: 'Hozir', example: 'Namuna', trackingProduct: 'Nike krossovkalari', trackingOrder: 'AT-1042 buyurtma', trackingNote: 'Buyurtma holati shaxsiy kabinetda shunday ko‘rinadi.',
      reviewsTitle: 'Mijozlar fikrlari', photosTitle: 'Mijozlarimiz jo‘natmalari',
      legalTitle: 'Yuridik ma’lumotlar', entity: 'Kompaniya', inn: footerCopy.uz.inn, address: 'Manzil', legalLink: 'Ommaviy oferta',
    },
    faq: {
      title: 'Ko‘p beriladigan savollar', timesQuestion: 'Buyurtmani qancha kutish kerak?',
      timesKnown: (list) => `Xorijdagi omborimizdan odatda: ${list}. Bunga do‘kondan omborgacha yetkazish va bojxona qo‘shiladi.`, timesLink: 'Davlatlar bo‘yicha muddatlar',
      timesUnknown: 'Muddat do‘kondan omborimizgacha yetkazish, Toshkentga tashish va bojxonadan iborat. Mamlakatlar bo‘yicha odatdagi muddatlar «Muddatlar va tariflar» jadvalida.',
      customsLink: 'Bojxona haqida batafsil', prohibitedOfficial: 'Rasmiy ro‘yxat', prohibitedRules: 'Ofertadagi cheklovlar',
      items: {
        customs: (allowance) => ({ q: `Bojxonadagi ${allowance} limiti nima?`, a: `Shaxsiy foydalanish uchun bitta oluvchiga oyiga ${allowance} gacha bo‘lgan xaridlar bojsiz olib kiriladi. Agar oy davomida ko‘proq bo‘lsa, boj faqat oshgan qismidan to‘lanadi. Stavka va hisob namunasi «Bojxona» sahifasida; yakuniy summani bojxona belgilaydi.` }),
        returns: { q: 'Tovarni qaytarish mumkinmi?', a: 'Xariddan oldin buyurtmani bekor qilish mumkin — hisobda ko‘rsatilgan xarajatlarni chegirib, pulni qaytaramiz. Xariddan keyin tovarni do‘kon qabul qilsa, qaytarish mumkin: rasmiylashtirishga yordam beramiz. Pul Atlas balansiga yoki siz to‘lagan kartaning o‘ziga qaytariladi — boshqa kartaga o‘tkazmaymiz.' },
        prohibited: { q: 'Qaysi tovarlarni buyurtma qilib bo‘lmaydi?', a: 'Yoqilg‘i va yoqilg‘i tizimining ishlatilgan qismlari, spirtli ichimliklar, cheklangan dori-darmonlar, kuydiruvchi va xavfli kimyoviy moddalar, giyohvand moddalar, qurol va o‘q-dorilar, tez alangalanuvchi buyumlar (bir qutiga 100 ml dan ortiq sprey va parfyum ham), qadoqsiz o‘tkir buyumlar va amortizatorlar, 18+ o‘yinchoqlar, tamaki, shuningdek do‘kon, tashuvchi yoki O‘zbekiston bojxonasi taqiqlagan barcha narsalar. To‘liq ro‘yxat «Bojxona» sahifasida.' },
        weight: { q: 'Og‘irlik qanday hisoblanadi?', a: 'Tovar og‘irligini quti bilan olamiz — uni do‘kon ko‘rsatadi, bo‘lmasa Atlas tovar turiga qarab baholaydi va uni tuzatish mumkin. Jo‘natmaga qadoq uchun 0,3 kg bir marta qo‘shamiz. Bitta do‘kondan kelgan jo‘natma uchun kamida 1 kg. Omborda tortilgandan keyin qayta hisoblaymiz: kam chiqsa, farq balansingizga qaytariladi.' },
        account: { q: 'Ro‘yxatdan o‘tish kerakmi?', a: 'Narxni hisoblash uchun — yo‘q. Buyurtma berish uchun qulay usulda kiring, akkaunt avtomatik yaratiladi.' },
      },
    },
    closing: { title: 'Buyurtmangizni hisoblang', text: 'Tovar havolasini qo‘ying: so‘mdagi hisob ro‘yxatdan o‘tish va to‘lovdan oldin darhol chiqadi.' },
    footer: footerCopy.uz,
    sticky: { paste: 'Havolani qo‘yish' },
    resume: {
      approval: 'Buyurtma bo‘yicha qaroringiz kerak', payment: 'Buyurtma to‘lovini yakunlang',
      items: (count) => `${count} ta tovar`,
      cart: (count) => `Savatda ${count} ta tovar`, cartNote: 'Buyurtmani rasmiylashtirish qoldi',
    },
    wide: {
      factsLabel: 'Atlas raqamlarda', andMore: 'va boshqalar',
      storesUnit: () => 'ta do‘kon', countriesUnit: () => 'ta davlat', countriesSub: 'qayerdan olib kelamiz',
      priceFrom: (price) => `${price} dan`, daysUnit: () => 'ish kuni', fromWarehouse: 'ombordan',
      stepCheck: ['Narx o‘zgargan bo‘lsa, avval yangi summani ko‘rsatamiz.', 'Hisobdan ortiq to‘lov — faqat roziligingiz bilan.'],
      routeTitle: 'Muddat nimalardan iborat',
      routeStore: 'Do‘kon → omborimiz', routeStoreNote: 'do‘kon muddati, jadvalga kirmaydi',
      routeFly: 'Ombor → Toshkent', routeFlyNote: 'jadval bo‘yicha',
      routeCustoms: 'Bojxona', routeCustomsNote: 'rasmiylashtiruv, jadvalga kirmaydi',
      or: 'yoki', faqMore: 'Javob topmadingizmi?',
    },
  },
  en: {
    nav: navCopy.en,
    hero: {
      title: 'We buy from stores in the USA, Europe and China and bring it to Tashkent',
      lead: 'Paste a product link. We show the bill in soum right away, line by line, before you pay.',
      label: 'Product link', placeholder: 'Paste a link', calculate: 'Calculate',
      invalid: 'Paste the full product page link — it starts with https://',
      notLink: 'That’s not a product link. Open the item in the store, copy the page address and paste it here.',
      searchCatalog: (q) => `Search the Atlas catalog for “${q}”`, openStoreNamed: (store) => `Open ${store}`,
      guestNote: 'The estimate is free, no sign-up needed.', memberNote: 'The estimate is free and commits you to nothing.',
      guestPoints: ['Free estimate', 'No sign-up needed'], memberPoints: ['Free estimate', 'No commitment'],
      popular: 'Popular stores', openStore: 'opens in a new tab', batch: 'Add several links', catalog: 'Browse the product selection',
      allStores: (count) => `All ${count} stores`,
      storesHint: 'Open a store, copy the product link and paste it into the field above.',
    },
    how: {
      title: 'How it works',
      steps: [
        { title: 'Paste the link', text: 'Copy a product link from a store abroad and paste it into the field above.' },
        { title: 'Check the bill', text: 'Pick the colour or size if needed and check the total in soum: the item and one “Atlas service” line — fee and delivery, with the breakdown one tap away.' },
        { title: 'Confirm the order', text: 'Confirm the estimate in your account. We buy the item from the store ourselves.' },
        { title: 'Collect it in Tashkent', text: 'We bring the parcel to Tashkent. Your account shows the order status at every stage.' },
      ],
      paymentsLabel: 'Payment methods', pickupLabel: 'Pickup point', deliveryLabel: 'Delivery', courier: 'Courier delivery',
      moreStores: (count) => `and ${count} more`, confirm: 'Confirm the bill',
    },
    example: {
      title: 'Example bill', product: usd => `Nike sneakers, ${usd}`, routeLabel: 'Route', to: 'Tashkent',
      days: (min, max) => `standard delivery, ${min}–${max} business days`,
      item: 'Item price',
      itemNote: usd => `${usd} at the Atlas rate`,
      totalUsd: usd => `≈ ${usd} including delivery to Tashkent`,
      shareItem: percent => `Item ${percent}`, shareService: percent => `Service ${percent}`,
      service: 'Atlas service', serviceParts: 'Service breakdown', fee: (percent) => `Fee ${percent}`,
      delivery: 'Delivery', deliveryNote: (weight, perKg) => `${weight} kg × ${perKg}`,
      reserve: 'Refundable reserve', reserveNote: packaging => `Estimated weight includes a ${packaging} kg packaging allowance. Any unused amount returns to your balance after weighing.`, reserveHelpLabel: 'What is the refundable reserve',
      reserveHelp: 'A buffer in case the parcel is heavier than estimated. After warehouse weighing, any unused part returns to your Atlas balance. If delivery costs more than the reserve, we agree the extra payment with you first.',
      total: 'To pay',
      dutyTitle: allowance => `No customs duty — up to\u00a0${allowance} per\u00a0month`,
      dutyNote: 'Per recipient, including purchases outside Atlas.',
      dutyUsed: (used, left) => `This order ${used} · ${left} more duty-free`,
    },
    catalog: { title: 'Product selection', intro: 'Products from international stores, selected by Atlas, with the total in soum.', order: 'Order', storePrice: 'Store price', total: 'With delivery to Tashkent', breakdown: 'What’s in the total' },
    tariffs: {
      title: 'Delivery times and rates', lead: 'Express or standard delivery from our warehouse abroad to Tashkent — you choose at checkout. The table shows the usual time in business days; the store’s shipping to the warehouse and customs come on top.',
      from: 'From', country: 'Country', time: 'Delivery time', perKg: 'Price per kg', perKgUnit: '/kg',
      per100g: (usd) => `${usd} per 100 g`,
      days: (min, max) => `${min}–${max} business days`, pending: 'to be confirmed',
      speeds: { express: 'Express', standard: 'Standard' }, speedsLabel: 'Delivery speed', noDays: 'Timing depends on the store and the flight; we show it in the estimate for your link.',
      regions: { us: 'USA', uk: 'United Kingdom', cn: 'China', de: 'Germany', it: 'Italy', es: 'Spain' },
      // The same name as above (it breaks at its space); kept so every language has the same keys (tests/home.test.mjs).
      tableRegions: { uk: 'United Kingdom' },
      faster: (range, to) => `${range} business ${to === 1 ? 'day' : 'days'} faster`,
      weightNote: 'We count the item with its box and add 0.3 kg for packaging, once per parcel. Minimum 1 kg per parcel from one store.',
      rateNote: 'Current Atlas rates, not an offer.',
    },
    trust: {
      title: 'How we handle your money', ordersDone: 'orders delivered',
      facts: ({ fee, freeFrom, hold, holdExample }) => [
        { title: 'The price is checked twice', text: 'We check the price with the store when you add an item to the cart and again before checkout. If it has changed, we show you the new total first.' },
        { title: 'The rate is fixed at payment', text: 'Dollar prices become soum at the Atlas rate on the day of the estimate. The rate is fixed in the order at payment.' },
        { title: 'The service is one line', text: `The Atlas fee, ${fee} of the item price, and international delivery are one “Atlas service” line in the bill — tap it for the breakdown.` },
        { title: 'Store shipping comes from a reserve', text: `If a store does not state shipping to the warehouse, it is free on orders from that store over ${freeFrom}. On smaller orders we hold a ${hold} reserve for it, kept apart from the amount to pay. For example, on a ${holdExample} order: once the store names its delivery price, we pay it from the reserve and release the rest; if delivery costs more than ${hold}, any extra needs your consent.` },
        { title: 'Lighter parcel — the difference back', text: 'The warehouse weighs the parcel: if it is lighter than estimated, the difference returns to your balance. Anything above the bill is paid only with your consent.' },
      ],
      trackingTitle: 'Order tracking', trackingNow: 'Now', example: 'Example', trackingProduct: 'Nike sneakers', trackingOrder: 'Order AT-1042', trackingNote: 'This is how an order status looks in your account.',
      reviewsTitle: 'Customer reviews', photosTitle: 'Our customers’ parcels',
      legalTitle: 'Legal information', entity: 'Company', inn: footerCopy.en.inn, address: 'Address', legalLink: 'Public offer',
    },
    faq: {
      title: 'Frequently asked questions', timesQuestion: 'How long does delivery take?',
      timesKnown: (list) => `From our warehouse abroad, usually: ${list}. Add the store’s shipping to the warehouse and customs.`, timesLink: 'Times by country',
      timesUnknown: 'Delivery time covers the store’s shipping to our warehouse, transport to Tashkent and customs. See “Delivery times and rates” for the usual times by country.',
      customsLink: 'More about customs', prohibitedOfficial: 'Official list', prohibitedRules: 'Restrictions in the offer',
      items: {
        customs: (allowance) => ({ q: `What is the ${allowance} customs limit?`, a: `Personal purchases up to ${allowance} a month per recipient enter without duty. If a month’s total is higher, duty applies only to the excess. The rate and a worked example are on the Customs page; customs sets the final amount.` }),
        returns: { q: 'Can I return an item?', a: 'Before purchase you can cancel the order — we refund the money minus the costs shown in your bill. After purchase a return is possible if the store accepts it; we help arrange it. Refunds go to your Atlas balance or back to the same card you paid with — never to another card.' },
        prohibited: { q: 'Which items can’t be ordered?', a: 'Fuel and used fuel-system parts, alcoholic drinks, restricted medicines, corrosive and hazardous chemicals, narcotics, weapons and ammunition, flammables (including sprays and perfumes over 100 ml per box), unpackaged sharp items and shock absorbers, 18+ toys, tobacco, and anything the store, the carrier or Uzbekistan customs prohibits. The full list is on the Customs page.' },
        weight: { q: 'How is weight calculated?', a: 'We take the item weight with its box — the store states it, or Atlas estimates it by the kind of item and you can correct it. We add 0.3 kg for packaging, once per parcel. Minimum 1 kg per parcel from one store. After warehouse weighing we recalculate: if it comes out lower, the difference returns to your balance.' },
        account: { q: 'Do I need to sign up?', a: 'Not for an estimate. To place an order, sign in the way that suits you: the account is created automatically.' },
      },
    },
    closing: { title: 'Price your order', text: 'Paste a product link: the bill in soum appears at once, before sign-up or payment.' },
    footer: footerCopy.en,
    sticky: { paste: 'Paste a link' },
    resume: {
      approval: 'Your decision is needed on an order', payment: 'Finish paying for your order',
      items: (count) => `${count} ${count === 1 ? 'item' : 'items'}`,
      cart: (count) => `${count} ${count === 1 ? 'item' : 'items'} in your cart`, cartNote: 'Only checkout is left',
    },
    wide: {
      factsLabel: 'Atlas in numbers', andMore: 'and more',
      storesUnit: (count) => (count === 1 ? 'store' : 'stores'), countriesUnit: (count) => (count === 1 ? 'country' : 'countries'), countriesSub: 'where we ship from',
      priceFrom: (price) => `from ${price}`, daysUnit: () => 'business days', fromWarehouse: 'from warehouse',
      stepCheck: ['If the price has changed, we show the new total first.', 'Paying more than the bill — only with your consent.'],
      routeTitle: 'What the delivery time is made of',
      routeStore: 'Store → our warehouse', routeStoreNote: 'the store’s shipping, on top of the table',
      routeFly: 'Warehouse → Tashkent', routeFlyNote: 'per the table',
      routeCustoms: 'Customs', routeCustomsNote: 'clearance, on top of the table',
      or: 'or', faqMore: 'Didn’t find an answer?',
    },
  },
});
