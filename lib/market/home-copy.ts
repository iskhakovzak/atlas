import type { Locale } from './i18n.ts';
import type { DeliveryRegion } from './site-content.ts';
import {withCyrillic} from './uz-cyrl.ts';
import {footerCopy,type FooterCopy} from './i18n.ts';
import {ruPlural} from './format.ts';
export {groupDigits,formatSum,formatUsd,ruPlural,formatPriceUsd,formatDayMonth,formatPercent,formatKg} from './format.ts';

function ruDays(max: number) {
  const tail = max % 100, last = max % 10;
  return tail >= 11 && tail <= 14 ? 'рабочих дней' : last === 1 ? 'рабочий день' : last >= 2 && last <= 4 ? 'рабочих дня' : 'рабочих дней';
}

type Step = { title: string; text: string };
type Faq = { q: string; a: string };
type Facts = { fee: string };
/** One rule of the money section: a short title over its text (the icons follow the order, app/home-sections.tsx). */
type Fact = { title: string; text: string };

export type HomeCopy = {
  hero: {
    title: string; lead: string; label: string; placeholder: string; calculate: string; invalid: string;
    /** Plain words in the link field (no link at all): how to get a link, with the catalog and store buttons under it. */
    notLink: string; searchCatalog: (q: string) => string; openStoreNamed: (store: string) => string;
    /** The two facts with a tick under the field (guest / signed in). */
    guestPoints: [string, string]; memberPoints: [string, string];
    openStore: string; batch: string };
  /** Three steps (owner, 1.11.2026: was four): the link, the bill and payment, the parcel in Tashkent. */
  how: { title: string; steps: [Step, Step, Step]; paymentsLabel: string; deliveryLabel: string; courier: string; allStores: (count: number) => string };
  example: {
    title: string; product: (usd: string) => string; days: (min: number, max: number) => string;
    item: string; itemNote: (usd: string) => string; totalUsd: (usd: string) => string;
    /** One «Atlas service» line, as in the real bill (app/cost-lines.tsx); `fee` and `delivery` are its parts. */
    service: string; serviceParts: string; fee: (percent: string) => string;
    /** Under the «Atlas service» line: what its sum holds (the fee alone read as the whole line, review 1.11.2026). */
    serviceNote: (percent: string) => string;
    delivery: string; deliveryNote: (weight: string, perKg: string) => string;
    reserve: string; reserveNote: (packaging: string) => string; reserveHelp: string; total: string;
    dutyTitle: (allowance: string) => string; dutyUsed: (used: string, left: string) => string;
  };
  tariffs: { title: string; lead: string; country: string; time: string; perKg: string; perKgUnit: string; per100g: (usd: string) => string; days: (min: number, max: number) => string; pending: string; regions: Record<DeliveryRegion, string>; speeds: { express: string; standard: string }; speedsLabel: string; weightNote: string; rateNote: string;
    /** The rates table's own country names where a long one needs a soft hyphen. */
    tableRegions?: Partial<Record<DeliveryRegion, string>>;
    /** Under the express card: how many business days express saves (lib/market/home-facts.ts expressLead); `to` is the range's upper end. */
    faster: (range: string, to: number) => string;
    /** A speed whose price differs by country: "from $12". */
    priceFrom: (price: string) => string;
    /** The disclosure with the table by country (a link to /delivery once that page exists), and what its days count. */
    all: string; tableNote: string;
  };
  trust: { title: string; facts: (facts: Facts) => Fact[]; ordersDone: string; example: string; trackingProduct: string; reviewsTitle: string; photosTitle: string };
  faq: { title: string; timesQuestion: string; timesKnown: (list: string) => string; timesUnknown: string; timesLink: string; customsLink: string; prohibitedOfficial: string; prohibitedRules: string;
    /** Under the five questions: the support page (it has the weight question and the contacts). */
    more: string;
    items: { customs: (allowance: string) => Faq; returns: Faq; prohibited: Faq; weight: Faq; account: Faq } };
  footer: FooterCopy;
  /**
   * The hero's "continue" card for a signed-in customer (app/home-resume.tsx, lib/market/next-step.ts):
   * a decision on an order, the checkout's payment, or the cart. No sums or timers — only what waits.
   */
  resume: { approval: string; payment: string; items: (count: number) => string; cart: (count: number) => string; cartNote: string };
};

export const homeCopy: Record<Locale, HomeCopy> = /*@__PURE__*/withCyrillic({
  ru: {
    hero: {
      title: 'Покупки из США, Европы и Китая — в Ташкент',
      lead: 'Вставьте ссылку на товар — сразу покажем итог в сумах. Выкупим и привезём сами.',
      label: 'Ссылка на товар', placeholder: 'Вставьте ссылку', calculate: 'Рассчитать',
      invalid: 'Вставьте полную ссылку на страницу товара — она начинается с https://',
      notLink: 'Это не ссылка на товар. Откройте товар в магазине, скопируйте адрес страницы и вставьте сюда.',
      searchCatalog: (q) => `Найти «${q}» в каталоге Atlas`, openStoreNamed: (store) => `Открыть ${store}`,
      guestPoints: ['Расчёт бесплатный', 'Регистрация не нужна'], memberPoints: ['Расчёт бесплатный', 'Ни к чему не обязывает'],
      openStore: 'откроется в новой вкладке', batch: 'Несколько ссылок сразу',
    },
    how: {
      title: 'Как это работает',
      steps: [
        { title: 'Вставьте ссылку', text: 'Скопируйте ссылку на товар в зарубежном магазине и вставьте её в поле выше — или выберите товар в каталоге Atlas.' },
        { title: 'Проверьте счёт и оплатите', text: 'Выберите цвет и размер и проверьте итог в сумах: товар и одна строка «Сервис Atlas». Товар у магазина выкупим мы сами.' },
        { title: 'Получите в Ташкенте', text: 'Привезём посылку в Ташкент. Статус заказа виден в кабинете на каждом этапе.' },
      ],
      paymentsLabel: 'Способы оплаты', deliveryLabel: 'Доставка', courier: 'Курьерская доставка',
      allStores: (count) => `Все ${count} ${ruPlural(count, ['магазин', 'магазина', 'магазинов'])}`,
    },
    example: {
      title: 'Пример счёта', product: usd => `кроссовки Nike за ${usd}`,
      days: (min, max) => `обычная доставка, ${min}–${max} ${ruDays(max)}`,
      item: 'Цена товара',
      itemNote: usd => `${usd} по курсу Atlas`,
      totalUsd: usd => `≈ ${usd} вместе с доставкой в Ташкент`,
      service: 'Сервис Atlas', serviceParts: 'Состав сервиса', fee: (percent) => `Комиссия ${percent}`,
      serviceNote: (percent) => `Комиссия ${percent} и доставка до Ташкента`,
      delivery: 'Доставка', deliveryNote: (weight, perKg) => `${weight} кг × ${perKg}`,
      reserve: 'Возвратный резерв', reserveNote: packaging => `В расчёт веса заложено ${packaging} кг запаса на упаковку. После взвешивания неиспользованную сумму вернём на баланс.`,
      reserveHelp: 'Запас на случай, если посылка окажется тяжелее расчётной. После взвешивания на складе неиспользованную часть вернём на ваш баланс Atlas. Если доставка выйдет дороже резерва, сначала согласуем доплату с вами.',
      total: 'К оплате',
      dutyTitle: allowance => `Без таможенной пошлины — до\u00a0${allowance} в\u00a0месяц`,
      dutyUsed: (used, left) => `Заказ ${used} · ещё ${left} без пошлины`,
    },
    tariffs: {
      title: 'Сроки и тарифы', lead: 'Экспресс или обычная доставка от нашего склада за рубежом до Ташкента — на выбор при оформлении.',
      country: 'Страна', time: 'Срок доставки', perKg: 'Цена за 1 кг', perKgUnit: '/кг',
      per100g: (usd) => `${usd} за 100 г`,
      days: (min, max) => `${min}–${max} ${ruDays(max)}`, pending: 'уточняется',
      speeds: { express: 'Экспресс', standard: 'Обычная' }, speedsLabel: 'Скорость доставки',
      regions: { us: 'США', uk: 'Великобритания', cn: 'Китай', de: 'Германия', it: 'Италия', es: 'Испания' },
      // A phone cell breaks it as «Велико-/британия», not «Великобри/тания».
      tableRegions: { uk: 'Велико\u00adбритания' },
      faster: (range, to) => `На ${range} ${ruDays(to)} быстрее`,
      priceFrom: (price) => `от ${price}`,
      all: 'Тарифы по странам и калькулятор', tableNote: 'Сроки — в рабочих днях от нашего склада; доставка магазина до склада и таможня идут сверх них.',
      weightNote: 'Вес считаем с коробкой и добавляем 0,3 кг на упаковку, один раз на посылку. Минимум 1 кг на посылку из одного магазина.',
      rateNote: 'Текущие тарифы Atlas, не оферта.',
    },
    trust: {
      title: 'Деньги и гарантии', ordersDone: 'заказов уже доставили',
      facts: ({ fee }) => [
        { title: 'Цена сверяется дважды', text: 'Сверяем цену с магазином, когда вы добавляете товар в корзину, и ещё раз перед оформлением. Если она изменилась, сначала покажем новую сумму. Курс фиксируется при оплате.' },
        { title: 'Сервис — одной строкой', text: `Комиссия Atlas ${fee} от цены товаров и международная доставка стоят в счёте одной строкой «Сервис Atlas» — состав виден по нажатию.` },
        { title: 'Легче расчёта — вернём разницу', text: 'Склад взвесит посылку: если она легче расчёта — разницу вернём на баланс. Оплата сверх счёта — только с вашего согласия.' },
      ],
      example: 'Пример', trackingProduct: 'Кроссовки Nike',
      reviewsTitle: 'Отзывы клиентов', photosTitle: 'Посылки наших клиентов',
    },
    faq: {
      title: 'Частые вопросы', timesQuestion: 'Сколько ждать заказ?',
      timesKnown: (list) => `От нашего склада за рубежом обычно: ${list}. Плюс доставка магазина до склада и таможня.`, timesLink: 'Сроки по странам',
      timesUnknown: 'Срок складывается из доставки магазина до нашего склада, перевозки в Ташкент и таможни. Обычные сроки по странам — в таблице «Сроки и тарифы».',
      customsLink: 'Подробнее о таможне', prohibitedOfficial: 'Официальный список', prohibitedRules: 'Ограничения в оферте', more: 'Ещё вопросы и поддержка',
      items: {
        customs: (allowance) => ({ q: `Что такое лимит ${allowance} на таможне?`, a: `Покупки для себя на сумму до ${allowance} в месяц на одного получателя ввозятся без пошлины. Если за месяц набралось больше, пошлину платят только с превышения. Ставку и пример расчёта мы держим на странице «Таможня»; окончательную сумму определяет таможня.` }),
        returns: { q: 'Можно ли вернуть товар?', a: 'До выкупа заказ можно отменить — вернём деньги за вычетом расходов, указанных в счёте. После выкупа вернуть товар можно, если это принимает магазин: мы поможем оформить возврат. Деньги возвращаем на баланс Atlas или на ту же карту, с которой вы платили, — на другую карту не переводим.' },
        prohibited: { q: 'Какие товары нельзя заказать?', a: 'Топливо и б/у детали топливных систем, спиртные напитки, ограниченные лекарства, едкие и опасные химикаты, наркотические вещества, оружие и боеприпасы, легковоспламеняющееся (в том числе спреи и парфюм больше 100 мл на коробку), острые предметы без упаковки, амортизаторы без упаковки, игрушки 18+, табак, а также всё, что запрещают магазин, перевозчик или таможня Узбекистана. Полный список — на странице «Таможня».' },
        weight: { q: 'Как считается вес?', a: 'Берём вес товара с коробкой — его указывает магазин, а если нет, Atlas даёт оценку по виду товара, и её можно исправить. К посылке добавляем 0,3 кг на упаковку, один раз. Минимум — 1 кг на посылку из одного магазина. После взвешивания на складе пересчитаем: если вышло меньше, разницу вернём на баланс.' },
        account: { q: 'Нужна ли регистрация?', a: 'Для расчёта цены — нет. Чтобы оформить заказ, войдите удобным способом: аккаунт создастся автоматически.' },
      },
    },
    footer: footerCopy.ru,
    resume: {
      approval: 'Нужно ваше решение по заказу', payment: 'Завершите оплату заказа',
      items: (count) => `${count} ${ruPlural(count, ['товар', 'товара', 'товаров'])}`,
      cart: (count) => `В корзине ${count} ${ruPlural(count, ['товар', 'товара', 'товаров'])}`, cartNote: 'Осталось оформить заказ',
    },
  },
  uz: {
    hero: {
      title: 'AQSh, Yevropa va Xitoydan — Toshkentga',
      lead: 'Tovar havolasini qo‘ying — yakuniy summani darhol so‘mda ko‘rsatamiz. Sotib olib, o‘zimiz olib kelamiz.',
      label: 'Tovar havolasi', placeholder: 'Havolani qo‘ying', calculate: 'Hisoblash',
      invalid: 'Tovar sahifasining to‘liq havolasini qo‘ying — u https:// bilan boshlanadi',
      notLink: 'Bu tovar havolasi emas. Tovarni do‘konda oching, sahifa manzilini nusxalab, shu yerga qo‘ying.',
      searchCatalog: (q) => `Atlas katalogida qidirish: «${q}»`, openStoreNamed: (store) => `${store} saytini ochish`,
      guestPoints: ['Hisoblash bepul', 'Ro‘yxatdan o‘tish shart emas'], memberPoints: ['Hisoblash bepul', 'Hech narsaga majburlamaydi'],
      openStore: 'yangi oynada ochiladi', batch: 'Bir nechta havola',
    },
    how: {
      title: 'Bu qanday ishlaydi',
      steps: [
        { title: 'Havolani qo‘ying', text: 'Xorijiy do‘kondagi tovar havolasini nusxalab, yuqoridagi maydonga qo‘ying — yoki Atlas katalogidan tanlang.' },
        { title: 'Hisobni tekshirib, to‘lang', text: 'Rang va o‘lchamni tanlang, yakuniy narxni so‘mda tekshiring: tovar va bitta «Atlas xizmati» satri. Tovarni do‘kondan o‘zimiz sotib olamiz.' },
        { title: 'Toshkentda qabul qiling', text: 'Jo‘natmani Toshkentga olib kelamiz. Buyurtma holati har bir bosqichda kabinetda ko‘rinadi.' },
      ],
      paymentsLabel: 'To‘lov usullari', deliveryLabel: 'Yetkazib berish', courier: 'Kuryer orqali yetkazib berish',
      allStores: (count) => `Barcha ${count} ta do‘kon`,
    },
    example: {
      title: 'Hisob namunasi', product: usd => `Nike krossovkalari, ${usd}`,
      days: (min, max) => `oddiy yetkazib berish, ${min}–${max} ish kuni`,
      item: 'Tovar narxi',
      itemNote: usd => `${usd}, Atlas kursi bilan`,
      totalUsd: usd => `Toshkentga yetkazish bilan ≈ ${usd}`,
      service: 'Atlas xizmati', serviceParts: 'Xizmat tarkibi', fee: (percent) => `Komissiya ${percent}`,
      serviceNote: (percent) => `Komissiya ${percent} va Toshkentgacha yetkazish`,
      delivery: 'Yetkazib berish', deliveryNote: (weight, perKg) => `${weight} kg × ${perKg}`,
      reserve: 'Qaytariladigan zaxira', reserveNote: packaging => `Vazn hisobiga qadoq uchun ${packaging} kg zaxira kiritilgan. Omborda tortilgach, ishlatilmagan summa balansga qaytariladi.`,
      reserveHelp: 'Jo‘natma hisoblangandan og‘irroq chiqsa, ehtiyot uchun qo‘yiladi. Omborda tortilgandan keyin ishlatilmagan qismi Atlas balansingizga qaytariladi. Yetkazib berish zaxiradan qimmatroq bo‘lsa, qo‘shimcha to‘lovni avval siz bilan kelishamiz.',
      total: 'To‘lovga',
      dutyTitle: allowance => `Oyiga ${allowance}\u00a0gacha — bojsiz`,
      dutyUsed: (used, left) => `Buyurtma ${used} · yana ${left} bojsiz`,
    },
    tariffs: {
      title: 'Muddatlar va tariflar', lead: 'Xorijdagi omborimizdan Toshkentga ekspress yoki oddiy yetkazib berish — rasmiylashtirishda tanlaysiz.',
      country: 'Davlat', time: 'Yetkazish muddati', perKg: '1 kg narxi', perKgUnit: '/kg',
      per100g: (usd) => `100 g uchun ${usd}`,
      days: (min, max) => `${min}–${max} ish kuni`, pending: 'aniqlanmoqda',
      speeds: { express: 'Ekspress', standard: 'Oddiy' }, speedsLabel: 'Yetkazish tezligi',
      regions: { us: 'AQSh', uk: 'Buyuk Britaniya', cn: 'Xitoy', de: 'Germaniya', it: 'Italiya', es: 'Ispaniya' },
      // The same name as above (it breaks at its space); kept so every language has the same keys (tests/home.test.mjs).
      tableRegions: { uk: 'Buyuk Britaniya' },
      faster: (range) => `${range} ish kuni tezroq`,
      priceFrom: (price) => `${price} dan`,
      all: 'Mamlakatlar bo‘yicha tariflar va kalkulyator', tableNote: 'Muddatlar — omborimizdan, ish kunlarida; do‘kondan omborgacha yetkazish va bojxona bunga kirmaydi.',
      weightNote: 'Og‘irlikni quti bilan hisoblaymiz va qadoq uchun 0,3 kg qo‘shamiz, jo‘natmaga bir marta. Bitta do‘kondan kelgan jo‘natma uchun kamida 1 kg.',
      rateNote: 'Atlasning joriy tariflari, oferta emas.',
    },
    trust: {
      title: 'Pul va kafolatlar', ordersDone: 'ta buyurtma yetkazildi',
      facts: ({ fee }) => [
        { title: 'Narx ikki marta tekshiriladi', text: 'Tovarni savatga qo‘shganingizda va rasmiylashtirishdan oldin yana narxni do‘kon bilan solishtiramiz. U o‘zgargan bo‘lsa, avval yangi summani ko‘rsatamiz. Kurs to‘lov paytida qayd etiladi.' },
        { title: 'Xizmat — bitta satrda', text: `Atlas komissiyasi (tovarlar narxining ${fee}) va xalqaro yetkazish hisobda bitta «Atlas xizmati» satrida turadi — tarkibi bosganda ko‘rinadi.` },
        { title: 'Yengil chiqsa — farqni qaytaramiz', text: 'Ombor jo‘natmani tortadi: hisobdan yengil chiqsa — farqni balansga qaytaramiz. Hisobdan ortiq to‘lov — faqat roziligingiz bilan.' },
      ],
      example: 'Namuna', trackingProduct: 'Nike krossovkalari',
      reviewsTitle: 'Mijozlar fikrlari', photosTitle: 'Mijozlarimiz jo‘natmalari',
    },
    faq: {
      title: 'Ko‘p beriladigan savollar', timesQuestion: 'Buyurtmani qancha kutish kerak?',
      timesKnown: (list) => `Xorijdagi omborimizdan odatda: ${list}. Bunga do‘kondan omborgacha yetkazish va bojxona qo‘shiladi.`, timesLink: 'Davlatlar bo‘yicha muddatlar',
      timesUnknown: 'Muddat do‘kondan omborimizgacha yetkazish, Toshkentga tashish va bojxonadan iborat. Mamlakatlar bo‘yicha odatdagi muddatlar «Muddatlar va tariflar» jadvalida.',
      customsLink: 'Bojxona haqida batafsil', prohibitedOfficial: 'Rasmiy ro‘yxat', prohibitedRules: 'Ofertadagi cheklovlar', more: 'Boshqa savollar va yordam',
      items: {
        customs: (allowance) => ({ q: `Bojxonadagi ${allowance} limiti nima?`, a: `Shaxsiy foydalanish uchun bitta oluvchiga oyiga ${allowance} gacha bo‘lgan xaridlar bojsiz olib kiriladi. Agar oy davomida ko‘proq bo‘lsa, boj faqat oshgan qismidan to‘lanadi. Stavka va hisob namunasi «Bojxona» sahifasida; yakuniy summani bojxona belgilaydi.` }),
        returns: { q: 'Tovarni qaytarish mumkinmi?', a: 'Xariddan oldin buyurtmani bekor qilish mumkin — hisobda ko‘rsatilgan xarajatlarni chegirib, pulni qaytaramiz. Xariddan keyin tovarni do‘kon qabul qilsa, qaytarish mumkin: rasmiylashtirishga yordam beramiz. Pul Atlas balansiga yoki siz to‘lagan kartaning o‘ziga qaytariladi — boshqa kartaga o‘tkazmaymiz.' },
        prohibited: { q: 'Qaysi tovarlarni buyurtma qilib bo‘lmaydi?', a: 'Yoqilg‘i va yoqilg‘i tizimining ishlatilgan qismlari, spirtli ichimliklar, cheklangan dori-darmonlar, kuydiruvchi va xavfli kimyoviy moddalar, giyohvand moddalar, qurol va o‘q-dorilar, tez alangalanuvchi buyumlar (bir qutiga 100 ml dan ortiq sprey va parfyum ham), qadoqsiz o‘tkir buyumlar va amortizatorlar, 18+ o‘yinchoqlar, tamaki, shuningdek do‘kon, tashuvchi yoki O‘zbekiston bojxonasi taqiqlagan barcha narsalar. To‘liq ro‘yxat «Bojxona» sahifasida.' },
        weight: { q: 'Og‘irlik qanday hisoblanadi?', a: 'Tovar og‘irligini quti bilan olamiz — uni do‘kon ko‘rsatadi, bo‘lmasa Atlas tovar turiga qarab baholaydi va uni tuzatish mumkin. Jo‘natmaga qadoq uchun 0,3 kg bir marta qo‘shamiz. Bitta do‘kondan kelgan jo‘natma uchun kamida 1 kg. Omborda tortilgandan keyin qayta hisoblaymiz: kam chiqsa, farq balansingizga qaytariladi.' },
        account: { q: 'Ro‘yxatdan o‘tish kerakmi?', a: 'Narxni hisoblash uchun — yo‘q. Buyurtma berish uchun qulay usulda kiring, akkaunt avtomatik yaratiladi.' },
      },
    },
    footer: footerCopy.uz,
    resume: {
      approval: 'Buyurtma bo‘yicha qaroringiz kerak', payment: 'Buyurtma to‘lovini yakunlang',
      items: (count) => `${count} ta tovar`,
      cart: (count) => `Savatda ${count} ta tovar`, cartNote: 'Buyurtmani rasmiylashtirish qoldi',
    },
  },
  en: {
    hero: {
      title: 'Shop US, European and Chinese stores — delivered to Tashkent',
      lead: 'Paste a product link — we show the total in soum right away. We buy it and bring it to you.',
      label: 'Product link', placeholder: 'Paste a link', calculate: 'Calculate',
      invalid: 'Paste the full product page link — it starts with https://',
      notLink: 'That’s not a product link. Open the item in the store, copy the page address and paste it here.',
      searchCatalog: (q) => `Search the Atlas catalog for “${q}”`, openStoreNamed: (store) => `Open ${store}`,
      guestPoints: ['Free estimate', 'No sign-up needed'], memberPoints: ['Free estimate', 'No commitment'],
      openStore: 'opens in a new tab', batch: 'Several links at once',
    },
    how: {
      title: 'How it works',
      steps: [
        { title: 'Paste the link', text: 'Copy a product link from a store abroad and paste it into the field above — or pick an item in the Atlas catalog.' },
        { title: 'Check the bill and pay', text: 'Pick the colour and size and check the total in soum: the item and one “Atlas service” line. We buy the item from the store ourselves.' },
        { title: 'Collect it in Tashkent', text: 'We bring the parcel to Tashkent. Your account shows the order status at every stage.' },
      ],
      paymentsLabel: 'Payment methods', deliveryLabel: 'Delivery', courier: 'Courier delivery',
      allStores: (count) => `All ${count} stores`,
    },
    example: {
      title: 'Example bill', product: usd => `Nike sneakers, ${usd}`,
      days: (min, max) => `standard delivery, ${min}–${max} business days`,
      item: 'Item price',
      itemNote: usd => `${usd} at the Atlas rate`,
      totalUsd: usd => `≈ ${usd} including delivery to Tashkent`,
      service: 'Atlas service', serviceParts: 'Service breakdown', fee: (percent) => `Fee ${percent}`,
      serviceNote: (percent) => `${percent} fee and delivery to Tashkent`,
      delivery: 'Delivery', deliveryNote: (weight, perKg) => `${weight} kg × ${perKg}`,
      reserve: 'Refundable reserve', reserveNote: packaging => `Estimated weight includes a ${packaging} kg packaging allowance. Any unused amount returns to your balance after weighing.`,
      reserveHelp: 'A buffer in case the parcel is heavier than estimated. After warehouse weighing, any unused part returns to your Atlas balance. If delivery costs more than the reserve, we agree the extra payment with you first.',
      total: 'To pay',
      dutyTitle: allowance => `No customs duty — up to\u00a0${allowance} per\u00a0month`,
      dutyUsed: (used, left) => `This order ${used} · ${left} more duty-free`,
    },
    tariffs: {
      title: 'Delivery times and rates', lead: 'Express or standard delivery from our warehouse abroad to Tashkent — you choose at checkout.',
      country: 'Country', time: 'Delivery time', perKg: 'Price per kg', perKgUnit: '/kg',
      per100g: (usd) => `${usd} per 100 g`,
      days: (min, max) => `${min}–${max} business days`, pending: 'to be confirmed',
      speeds: { express: 'Express', standard: 'Standard' }, speedsLabel: 'Delivery speed',
      regions: { us: 'USA', uk: 'United Kingdom', cn: 'China', de: 'Germany', it: 'Italy', es: 'Spain' },
      // The same name as above (it breaks at its space); kept so every language has the same keys (tests/home.test.mjs).
      tableRegions: { uk: 'United Kingdom' },
      faster: (range, to) => `${range} business ${to === 1 ? 'day' : 'days'} faster`,
      priceFrom: (price) => `from ${price}`,
      all: 'Rates by country and calculator', tableNote: 'Times are business days from our warehouse; the store’s shipping to the warehouse and customs come on top.',
      weightNote: 'We count the item with its box and add 0.3 kg for packaging, once per parcel. Minimum 1 kg per parcel from one store.',
      rateNote: 'Current Atlas rates, not an offer.',
    },
    trust: {
      title: 'Money and guarantees', ordersDone: 'orders delivered',
      facts: ({ fee }) => [
        { title: 'The price is checked twice', text: 'We check the price with the store when you add an item to the cart and again before checkout. If it has changed, we show you the new total first. The rate is fixed at payment.' },
        { title: 'The service is one line', text: `The Atlas fee, ${fee} of the item price, and international delivery are one “Atlas service” line in the bill — tap it for the breakdown.` },
        { title: 'Lighter parcel — the difference back', text: 'The warehouse weighs the parcel: if it is lighter than estimated, the difference returns to your balance. Anything above the bill is paid only with your consent.' },
      ],
      example: 'Example', trackingProduct: 'Nike sneakers',
      reviewsTitle: 'Customer reviews', photosTitle: 'Our customers’ parcels',
    },
    faq: {
      title: 'Frequently asked questions', timesQuestion: 'How long does delivery take?',
      timesKnown: (list) => `From our warehouse abroad, usually: ${list}. Add the store’s shipping to the warehouse and customs.`, timesLink: 'Times by country',
      timesUnknown: 'Delivery time covers the store’s shipping to our warehouse, transport to Tashkent and customs. See “Delivery times and rates” for the usual times by country.',
      customsLink: 'More about customs', prohibitedOfficial: 'Official list', prohibitedRules: 'Restrictions in the offer', more: 'More questions and support',
      items: {
        customs: (allowance) => ({ q: `What is the ${allowance} customs limit?`, a: `Personal purchases up to ${allowance} a month per recipient enter without duty. If a month’s total is higher, duty applies only to the excess. The rate and a worked example are on the Customs page; customs sets the final amount.` }),
        returns: { q: 'Can I return an item?', a: 'Before purchase you can cancel the order — we refund the money minus the costs shown in your bill. After purchase a return is possible if the store accepts it; we help arrange it. Refunds go to your Atlas balance or back to the same card you paid with — never to another card.' },
        prohibited: { q: 'Which items can’t be ordered?', a: 'Fuel and used fuel-system parts, alcoholic drinks, restricted medicines, corrosive and hazardous chemicals, narcotics, weapons and ammunition, flammables (including sprays and perfumes over 100 ml per box), unpackaged sharp items and shock absorbers, 18+ toys, tobacco, and anything the store, the carrier or Uzbekistan customs prohibits. The full list is on the Customs page.' },
        weight: { q: 'How is weight calculated?', a: 'We take the item weight with its box — the store states it, or Atlas estimates it by the kind of item and you can correct it. We add 0.3 kg for packaging, once per parcel. Minimum 1 kg per parcel from one store. After warehouse weighing we recalculate: if it comes out lower, the difference returns to your balance.' },
        account: { q: 'Do I need to sign up?', a: 'Not for an estimate. To place an order, sign in the way that suits you: the account is created automatically.' },
      },
    },
    footer: footerCopy.en,
    resume: {
      approval: 'Your decision is needed on an order', payment: 'Finish paying for your order',
      items: (count) => `${count} ${count === 1 ? 'item' : 'items'}`,
      cart: (count) => `${count} ${count === 1 ? 'item' : 'items'} in your cart`, cartNote: 'Only checkout is left',
    },
  },
});
