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

type Step = { title: string; text: string };
type Faq = { q: string; a: string };

export type HomeCopy = {
  nav: { catalog: string; stores: string; how: string; tariffs: string; orders: string; signin: string; account: string; language: string };
  hero: { title: string; lead: string; label: string; placeholder: string; calculate: string; invalid: string; guestNote: string; memberNote: string; popular: string; openStore: string; batch: string; catalog: string; allStores: string };
  how: { title: string; steps: [Step, Step, Step, Step]; paymentsLabel: string; pickupLabel: string };
  example: { title: string; lead: string; product: string; meta: string; item: string; service: string; serviceDetail: (percent: string) => string; delivery: string; reserve: string; reserveHelpLabel: string; reserveHelp: string; total: string; note: string };
  catalog: { title: string; intro: string; order: string; storePrice: string; total: string; breakdown: string };
  tariffs: { title: string; lead: string; from: string; time: string; perKg: string; per100g: (usd: string) => string; days: (min: number, max: number) => string; pending: string; noDays: string; regions: Record<DeliveryRegion, string>; weightNote: string; fxNote: (rate: string) => string; rateNote: string };
  trust: { title: string; ordersDone: string; points: [Step, Step, Step]; trackingTitle: string; example: string; trackingItem: string; trackingNote: string; reviewsTitle: string; photosTitle: string; legalTitle: string; entity: string; inn: string; address: string; legalLink: string };
  faq: { title: string; timesQuestion: string; timesKnown: (list: string) => string; timesUnknown: string; customsLink: string; prohibitedOfficial: string; prohibitedRules: string; items: { customs: Faq; returns: Faq; prohibited: Faq; weight: Faq; account: Faq } };
  footer: { tagline: string; buyers: string; contacts: string; legal: string; support: string; rules: string; privacy: string; customs: string; faq: string; telegramSupport: string; telegramChannel: string; phone: string; instagram: string; pickup: string; theme: string };
  sticky: { paste: string };
};

export const homeCopy: Record<Locale, HomeCopy> = {
  ru: {
    nav: { catalog: 'Каталог', stores: 'Магазины', how: 'Как это работает', tariffs: 'Тарифы', orders: 'Мои заказы', signin: 'Войти', account: 'Кабинет', language: 'Язык сайта' },
    hero: {
      title: 'Покупайте в любых магазинах мира — доставим в Узбекистан',
      lead: 'Вставьте ссылку на товар — сразу покажем итог в сумах. Цена товара, сервис и доставка — отдельными строками, без скрытых комиссий.',
      label: 'Ссылка на товар', placeholder: 'Вставьте ссылку на товар', calculate: 'Рассчитать',
      invalid: 'Вставьте полную ссылку на страницу товара — она начинается с https://',
      guestNote: 'Расчёт бесплатный и без регистрации.', memberNote: 'Расчёт бесплатный и ни к чему не обязывает.',
      popular: 'Популярные магазины', openStore: 'откроется в новой вкладке', batch: 'Добавить несколько ссылок', catalog: 'Смотреть подборку товаров', allStores: 'Все магазины',
    },
    how: {
      title: 'Как это работает',
      steps: [
        { title: 'Вставьте ссылку', text: 'Скопируйте ссылку на товар в любом зарубежном магазине и вставьте её в поле выше.' },
        { title: 'Получите расчёт', text: 'Сразу покажем итог в сумах: товар, сервис, доставка и возвратный резерв — отдельными строками.' },
        { title: 'Оплатите заказ', text: 'Подтвердите расчёт и оплатите заказ в личном кабинете. Товар у магазина выкупим мы.' },
        { title: 'Получите в Ташкенте', text: 'Привезём посылку в Узбекистан. Статус заказа виден в кабинете на каждом этапе.' },
      ],
      paymentsLabel: 'Способы оплаты', pickupLabel: 'Пункт выдачи',
    },
    example: {
      title: 'Пример расчёта',
      lead: 'Так выглядит расчёт для кроссовок за $100 весом 1 кг. Все строки видны до оплаты.',
      product: 'Кроссовки из магазина Nike', meta: '$100 · вес 1 кг',
      item: 'Цена товара', service: 'Сервис Atlas', serviceDetail: (percent) => `${percent}% от цены товара`,
      delivery: 'Доставка в Узбекистан', reserve: 'Возвратный резерв', reserveHelpLabel: 'Что такое возвратный резерв',
      reserveHelp: 'Запас на случай, если посылка окажется тяжелее расчётной. После взвешивания на складе неиспользованную часть вернём на ваш баланс Atlas. Если доставка выйдет дороже резерва, сначала согласуем доплату с вами.',
      total: 'Итого',
      note: 'Ориентир по текущему тарифу Atlas, не оферта. Доставку магазина до склада и таможенную пошлину (если она нужна) покажем отдельно в расчёте по вашей ссылке.',
    },
    catalog: { title: 'Подборка товаров', intro: 'Товары из зарубежных магазинов, отобранные Atlas, — с итогом в сумах.', order: 'Заказать', storePrice: 'Цена в магазине', total: 'Итог с доставкой', breakdown: 'Показать расчёт' },
    tariffs: {
      title: 'Сроки и тарифы', lead: 'Экспресс-доставка от нашего склада за рубежом до Узбекистана. Цена зависит от веса посылки. Сроки примерные, в рабочих днях; доставка магазина до склада и таможня — сверх них.',
      from: 'Откуда', time: 'Срок доставки', perKg: 'Цена за 1 кг', per100g: (usd) => `${usd} за 100 г`,
      days: (min, max) => `${min}–${max} ${ruDays(max)}`, pending: 'уточняется', noDays: 'Срок зависит от магазина и рейса — покажем его в расчёте по вашей ссылке.',
      regions: { us: 'США', uk: 'Великобритания', cn: 'Китай', de: 'Германия', it: 'Италия', es: 'Испания' },
      weightNote: 'Вес считаем с коробкой и добавляем 0,5 кг на упаковку и запас. Минимум — 1 кг на посылку из одного магазина.',
      fxNote: (rate) => `В сумах — по курсу Atlas: $1 = ${rate}.`,
      rateNote: 'Текущие тарифы Atlas, не оферта.',
    },
    trust: {
      title: 'Почему Atlas', ordersDone: 'заказов уже доставили',
      points: [
        { title: 'Стоимость перед вами', text: 'Товар, сервис, доставка и возвратный резерв — отдельными строками ещё до оплаты.' },
        { title: 'Каждый этап на виду', text: 'Выкуп, склад, отправка и получение — статусы в вашем кабинете.' },
        { title: 'Данные под защитой', text: 'Паспорт и данные заказов доступны только вам и только в кабинете Atlas.' },
      ],
      trackingTitle: 'Отслеживание заказа', example: 'Пример', trackingItem: 'Кроссовки Nike · заказ AT-1042', trackingNote: 'Так выглядит статус заказа в личном кабинете.',
      reviewsTitle: 'Отзывы клиентов', photosTitle: 'Посылки наших клиентов',
      legalTitle: 'Юридическая информация', entity: 'Компания', inn: 'ИНН', address: 'Адрес', legalLink: 'Правила сервиса',
    },
    faq: {
      title: 'Частые вопросы', timesQuestion: 'Сколько ждать заказ?',
      timesKnown: (list) => `Экспресс от нашего склада за рубежом, ориентировочно: ${list}. К этому добавьте доставку магазина до склада; точный срок зависит от магазина и таможни.`,
      timesUnknown: 'Срок складывается из доставки магазина до нашего склада, перевозки в Узбекистан и таможни. Ориентиры по странам — в таблице «Сроки и тарифы», точный срок покажем в заказе.',
      customsLink: 'Подробнее о таможне', prohibitedOfficial: 'Официальный список', prohibitedRules: 'Правила сервиса',
      items: {
        customs: { q: 'Что такое лимит $200 на таможне?', a: 'Покупки для себя на сумму до $200 в месяц ввозятся без пошлины. Если за месяц набралось больше, пошлину платят только с превышения: ориентир — 20% от суммы сверх $200, но не меньше $2 за килограмм. Например, при заказах на $250 пошлина считается с $50 — около $10. Окончательную сумму определяет таможня.' },
        returns: { q: 'Можно ли вернуть товар?', a: 'До выкупа заказ можно отменить — вернём деньги за вычетом расходов, которые вы видели заранее. После выкупа вернуть товар можно, если это принимает магазин: мы поможем оформить возврат. Деньги возвращаем тем же способом оплаты, если это технически возможно.' },
        prohibited: { q: 'Какие товары нельзя заказать?', a: 'Оружие и боеприпасы, взрывчатые и наркотические вещества, табак, а также всё, что запрещают магазин, перевозчик или таможня Узбекистана.' },
        weight: { q: 'Как считается вес?', a: 'Берём вес товара с коробкой и добавляем 0,5 кг на упаковку и запас. Минимум — 1 кг на посылку из одного магазина. После взвешивания на складе пересчитаем: если вышло меньше, разницу вернём на баланс.' },
        account: { q: 'Нужна ли регистрация?', a: 'Для расчёта — нет. Чтобы оформить заказ, войдите удобным способом — аккаунт создастся автоматически.' },
      },
    },
    footer: {
      tagline: 'Покупки в зарубежных магазинах с доставкой в Узбекистан.', buyers: 'Покупателям', contacts: 'Контакты', legal: 'Юридическая информация',
      support: 'Поддержка в личном кабинете', rules: 'Правила сервиса', privacy: 'Политика данных', customs: 'Таможня', faq: 'Частые вопросы',
      telegramSupport: 'Telegram-бот', telegramChannel: 'Telegram-канал', phone: 'Телефон', instagram: 'Instagram', pickup: 'Пункт выдачи', theme: 'Тема',
    },
    sticky: { paste: 'Вставить ссылку' },
  },
  uz: {
    nav: { catalog: 'Katalog', stores: 'Do‘konlar', how: 'Qanday ishlaydi', tariffs: 'Tariflar', orders: 'Buyurtmalarim', signin: 'Kirish', account: 'Kabinet', language: 'Sayt tili' },
    hero: {
      title: 'Dunyoning istalgan do‘konidan xarid qiling — O‘zbekistonga yetkazib beramiz',
      lead: 'Tovar havolasini qo‘ying — yakuniy narxni darhol so‘mda ko‘rsatamiz. Tovar narxi, xizmat va yetkazib berish alohida satrlarda, yashirin komissiyalarsiz.',
      label: 'Tovar havolasi', placeholder: 'Tovar havolasini qo‘ying', calculate: 'Hisoblash',
      invalid: 'Tovar sahifasining to‘liq havolasini qo‘ying — u https:// bilan boshlanadi',
      guestNote: 'Hisoblash bepul va ro‘yxatdan o‘tmasdan.', memberNote: 'Hisoblash bepul va hech narsaga majburlamaydi.',
      popular: 'Mashhur do‘konlar', openStore: 'yangi oynada ochiladi', batch: 'Bir nechta havola qo‘shish', catalog: 'Tovarlar to‘plamini ko‘rish', allStores: 'Barcha do‘konlar',
    },
    how: {
      title: 'Bu qanday ishlaydi',
      steps: [
        { title: 'Havolani qo‘ying', text: 'Istalgan xorijiy do‘kondagi tovar havolasini nusxalab, yuqoridagi maydonga qo‘ying.' },
        { title: 'Hisobni oling', text: 'Yakuniy narxni darhol so‘mda ko‘rsatamiz: tovar, xizmat, yetkazib berish va qaytariladigan zaxira — alohida satrlarda.' },
        { title: 'Buyurtmani to‘lang', text: 'Hisobni tasdiqlang va buyurtmani shaxsiy kabinetda to‘lang. Tovarni do‘kondan biz sotib olamiz.' },
        { title: 'Toshkentda qabul qiling', text: 'Jo‘natmani O‘zbekistonga olib kelamiz. Buyurtma holati har bir bosqichda kabinetda ko‘rinadi.' },
      ],
      paymentsLabel: 'To‘lov usullari', pickupLabel: 'Topshirish punkti',
    },
    example: {
      title: 'Hisob namunasi',
      lead: 'Narxi 100 $, og‘irligi 1 kg bo‘lgan krossovkalar uchun hisob shunday ko‘rinadi. Barcha satrlar to‘lovdan oldin ko‘rinadi.',
      product: 'Nike do‘konidan krossovkalar', meta: '100 $ · og‘irligi 1 kg',
      item: 'Tovar narxi', service: 'Atlas xizmati', serviceDetail: (percent) => `tovar narxining ${percent}%`,
      delivery: 'O‘zbekistonga yetkazib berish', reserve: 'Qaytariladigan zaxira', reserveHelpLabel: 'Qaytariladigan zaxira nima',
      reserveHelp: 'Jo‘natma hisoblangandan og‘irroq chiqsa, ehtiyot uchun qo‘yiladi. Omborda tortilgandan keyin ishlatilmagan qismi Atlas balansingizga qaytariladi. Yetkazib berish zaxiradan qimmatroq bo‘lsa, qo‘shimcha to‘lovni avval siz bilan kelishamiz.',
      total: 'Jami',
      note: 'Atlasning joriy tarifi bo‘yicha taxminiy hisob, oferta emas. Do‘kondan omborgacha yetkazish va bojxona to‘lovini (agar kerak bo‘lsa) havolangiz bo‘yicha hisobda alohida ko‘rsatamiz.',
    },
    catalog: { title: 'Tovarlar to‘plami', intro: 'Atlas tanlagan xorijiy do‘kon tovarlari — yakuniy narxi so‘mda.', order: 'Buyurtma berish', storePrice: 'Do‘kondagi narx', total: 'Yetkazish bilan jami', breakdown: 'Hisobni ko‘rsatish' },
    tariffs: {
      title: 'Muddatlar va tariflar', lead: 'Xorijdagi omborimizdan O‘zbekistonga ekspress yetkazib berish. Narx jo‘natma og‘irligiga bog‘liq. Muddatlar taxminiy, ish kunlarida; do‘kondan omborgacha yetkazish va bojxona bunga kirmaydi.',
      from: 'Qayerdan', time: 'Yetkazish muddati', perKg: '1 kg narxi', per100g: (usd) => `100 g uchun ${usd}`,
      days: (min, max) => `${min}–${max} ish kuni`, pending: 'aniqlanmoqda', noDays: 'Muddat do‘kon va reysga bog‘liq — uni havolangiz bo‘yicha hisobda ko‘rsatamiz.',
      regions: { us: 'AQSh', uk: 'Buyuk Britaniya', cn: 'Xitoy', de: 'Germaniya', it: 'Italiya', es: 'Ispaniya' },
      weightNote: 'Og‘irlikni quti bilan hisoblaymiz va qadoq hamda zaxira uchun 0,5 kg qo‘shamiz. Bitta do‘kondan kelgan jo‘natma uchun kamida 1 kg.',
      fxNote: (rate) => `So‘mda — Atlas kursi bo‘yicha: $1 = ${rate}.`,
      rateNote: 'Atlasning joriy tariflari, oferta emas.',
    },
    trust: {
      title: 'Nega Atlas', ordersDone: 'ta buyurtma yetkazildi',
      points: [
        { title: 'Narx oldindan ko‘rinadi', text: 'Tovar, xizmat, yetkazib berish va qaytariladigan zaxira — to‘lovdan oldin alohida satrlarda.' },
        { title: 'Har bir bosqich nazoratda', text: 'Xarid, ombor, jo‘natish va qabul qilish — holatlar kabinetingizda.' },
        { title: 'Ma’lumotlar himoyalangan', text: 'Pasport va buyurtma ma’lumotlari faqat sizga va faqat Atlas kabinetida ko‘rinadi.' },
      ],
      trackingTitle: 'Buyurtmani kuzatish', example: 'Namuna', trackingItem: 'Nike krossovkalari · AT-1042 buyurtma', trackingNote: 'Buyurtma holati shaxsiy kabinetda shunday ko‘rinadi.',
      reviewsTitle: 'Mijozlar fikrlari', photosTitle: 'Mijozlarimiz jo‘natmalari',
      legalTitle: 'Yuridik ma’lumotlar', entity: 'Kompaniya', inn: 'STIR', address: 'Manzil', legalLink: 'Xizmat qoidalari',
    },
    faq: {
      title: 'Ko‘p beriladigan savollar', timesQuestion: 'Buyurtmani qancha kutish kerak?',
      timesKnown: (list) => `Xorijdagi omborimizdan ekspress, taxminan: ${list}. Bunga do‘kondan omborgacha yetkazishni qo‘shing; aniq muddat do‘kon va bojxonaga bog‘liq.`,
      timesUnknown: 'Muddat do‘kondan omborimizgacha yetkazish, O‘zbekistonga tashish va bojxonadan iborat. Mamlakatlar bo‘yicha taxminiy muddatlar «Muddatlar va tariflar» jadvalida, aniq muddatni buyurtmada ko‘rsatamiz.',
      customsLink: 'Bojxona haqida batafsil', prohibitedOfficial: 'Rasmiy ro‘yxat', prohibitedRules: 'Xizmat qoidalari',
      items: {
        customs: { q: 'Bojxonadagi 200 $ limiti nima?', a: 'Shaxsiy foydalanish uchun oyiga 200 $ gacha bo‘lgan xaridlar bojsiz olib kiriladi. Agar oy davomida ko‘proq bo‘lsa, boj faqat oshgan qismidan to‘lanadi: taxminan 200 $ dan ortiq summaning 20%, lekin har bir kilogramm uchun kamida 2 $. Masalan, 250 $ lik buyurtmalarda boj 50 $ dan hisoblanadi — taxminan 10 $. Yakuniy summani bojxona belgilaydi.' },
        returns: { q: 'Tovarni qaytarish mumkinmi?', a: 'Xariddan oldin buyurtmani bekor qilish mumkin — oldindan ko‘rgan xarajatlaringizni chegirib, pulni qaytaramiz. Xariddan keyin tovarni do‘kon qabul qilsa, qaytarish mumkin: rasmiylashtirishga yordam beramiz. Pul texnik imkon bo‘lsa, to‘langan usulda qaytariladi.' },
        prohibited: { q: 'Qaysi tovarlarni buyurtma qilib bo‘lmaydi?', a: 'Qurol va o‘q-dorilar, portlovchi va giyohvand moddalar, tamaki, shuningdek do‘kon, tashuvchi yoki O‘zbekiston bojxonasi taqiqlagan barcha narsalar.' },
        weight: { q: 'Og‘irlik qanday hisoblanadi?', a: 'Tovar og‘irligini quti bilan olamiz va qadoq hamda zaxira uchun 0,5 kg qo‘shamiz. Bitta do‘kondan kelgan jo‘natma uchun kamida 1 kg. Omborda tortilgandan keyin qayta hisoblaymiz: kam chiqsa, farq balansingizga qaytariladi.' },
        account: { q: 'Ro‘yxatdan o‘tish kerakmi?', a: 'Hisoblash uchun — yo‘q. Buyurtma berish uchun qulay usulda kiring — akkaunt avtomatik yaratiladi.' },
      },
    },
    footer: {
      tagline: 'Xorijiy do‘konlardan O‘zbekistonga yetkazib berish bilan xaridlar.', buyers: 'Xaridorlarga', contacts: 'Aloqa', legal: 'Yuridik ma’lumotlar',
      support: 'Shaxsiy kabinetdagi yordam', rules: 'Xizmat qoidalari', privacy: 'Ma’lumotlar siyosati', customs: 'Bojxona', faq: 'Savollar',
      telegramSupport: 'Telegram-bot', telegramChannel: 'Telegram-kanal', phone: 'Telefon', instagram: 'Instagram', pickup: 'Topshirish punkti', theme: 'Mavzu',
    },
    sticky: { paste: 'Havolani qo‘yish' },
  },
  en: {
    nav: { catalog: 'Catalog', stores: 'Stores', how: 'How it works', tariffs: 'Rates', orders: 'My orders', signin: 'Sign in', account: 'Account', language: 'Site language' },
    hero: {
      title: 'Shop any store in the world — we deliver to Uzbekistan',
      lead: 'Paste a product link and see the total in soum right away. Item price, service and delivery on separate lines, with no hidden fees.',
      label: 'Product link', placeholder: 'Paste a product link', calculate: 'Calculate',
      invalid: 'Paste the full product page link — it starts with https://',
      guestNote: 'The estimate is free and needs no sign-up.', memberNote: 'The estimate is free and commits you to nothing.',
      popular: 'Popular stores', openStore: 'opens in a new tab', batch: 'Add several links', catalog: 'Browse the product selection', allStores: 'All stores',
    },
    how: {
      title: 'How it works',
      steps: [
        { title: 'Paste the link', text: 'Copy a product link from any international store and paste it into the field above.' },
        { title: 'Get the estimate', text: 'We show the total in soum right away: item, service, delivery and refundable reserve on separate lines.' },
        { title: 'Pay for the order', text: 'Confirm the estimate and pay in your account. We buy the item from the store.' },
        { title: 'Collect it in Tashkent', text: 'We bring the parcel to Uzbekistan. Your account shows the order status at every stage.' },
      ],
      paymentsLabel: 'Payment methods', pickupLabel: 'Pickup point',
    },
    example: {
      title: 'Example estimate',
      lead: 'This is the estimate for $100 sneakers weighing 1 kg. Every line is visible before you pay.',
      product: 'Sneakers from the Nike store', meta: '$100 · weight 1 kg',
      item: 'Item price', service: 'Atlas service', serviceDetail: (percent) => `${percent}% of the item price`,
      delivery: 'Delivery to Uzbekistan', reserve: 'Refundable reserve', reserveHelpLabel: 'What is the refundable reserve',
      reserveHelp: 'A buffer in case the parcel is heavier than estimated. After warehouse weighing, any unused part returns to your Atlas balance. If delivery costs more than the reserve, we agree the extra payment with you first.',
      total: 'Total',
      note: 'An estimate at the current Atlas rate, not an offer. Store delivery to our warehouse and customs duty (if any) appear separately in the estimate for your link.',
    },
    catalog: { title: 'Product selection', intro: 'Products from international stores, selected by Atlas, with the total in soum.', order: 'Order', storePrice: 'Store price', total: 'Total with delivery', breakdown: 'Show estimate' },
    tariffs: {
      title: 'Delivery times and rates', lead: 'Express delivery from our warehouse abroad to Uzbekistan. The price depends on parcel weight. Times are approximate, in business days; the store’s shipping to the warehouse and customs come on top.',
      from: 'From', time: 'Delivery time', perKg: 'Price per kg', per100g: (usd) => `${usd} per 100 g`,
      days: (min, max) => `${min}–${max} business days`, pending: 'to be confirmed', noDays: 'Timing depends on the store and the flight — we show it in the estimate for your link.',
      regions: { us: 'USA', uk: 'United Kingdom', cn: 'China', de: 'Germany', it: 'Italy', es: 'Spain' },
      weightNote: 'We weigh the item with its box and add 0.5 kg for packaging and a buffer. Minimum 1 kg per parcel from one store.',
      fxNote: (rate) => `In soum at the Atlas rate: $1 = ${rate}.`,
      rateNote: 'Current Atlas rates, not an offer.',
    },
    trust: {
      title: 'Why Atlas', ordersDone: 'orders delivered',
      points: [
        { title: 'The price up front', text: 'Item, service, delivery and refundable reserve on separate lines before you pay.' },
        { title: 'Every stage visible', text: 'Purchase, warehouse, shipping and delivery — statuses in your account.' },
        { title: 'Your data protected', text: 'Passport and order details are visible only to you, only in your Atlas account.' },
      ],
      trackingTitle: 'Order tracking', example: 'Example', trackingItem: 'Nike sneakers · order AT-1042', trackingNote: 'This is how an order status looks in your account.',
      reviewsTitle: 'Customer reviews', photosTitle: 'Our customers’ parcels',
      legalTitle: 'Legal information', entity: 'Company', inn: 'Tax ID (INN)', address: 'Address', legalLink: 'Terms of service',
    },
    faq: {
      title: 'Frequently asked questions', timesQuestion: 'How long does delivery take?',
      timesKnown: (list) => `Express from our warehouse abroad, approximately: ${list}. Add the store’s shipping to the warehouse; the exact time depends on the store and customs.`,
      timesUnknown: 'Delivery time covers the store’s shipping to our warehouse, transport to Uzbekistan and customs. See “Delivery times and rates” for country estimates; your order shows the exact time.',
      customsLink: 'More about customs', prohibitedOfficial: 'Official list', prohibitedRules: 'Terms of service',
      items: {
        customs: { q: 'What is the $200 customs limit?', a: 'Personal purchases up to $200 a month enter without duty. If a month’s total is higher, duty applies only to the excess: roughly 20% of the amount above $200, but at least $2 per kilogram. For example, with $250 of orders duty is calculated on $50 — about $10. Customs sets the final amount.' },
        returns: { q: 'Can I return an item?', a: 'Before purchase you can cancel the order — we refund the money minus costs you saw in advance. After purchase a return is possible if the store accepts it; we help arrange it. Refunds go back by the payment method you used, when technically possible.' },
        prohibited: { q: 'Which items can’t be ordered?', a: 'Weapons and ammunition, explosives, narcotics, tobacco, and anything the store, the carrier or Uzbekistan customs prohibits.' },
        weight: { q: 'How is weight calculated?', a: 'We take the item weight with its box and add 0.5 kg for packaging and a buffer. Minimum 1 kg per parcel from one store. After warehouse weighing we recalculate: if it comes out lower, the difference returns to your balance.' },
        account: { q: 'Do I need to sign up?', a: 'Not for an estimate. To place an order, sign in the way that suits you — the account is created automatically.' },
      },
    },
    footer: {
      tagline: 'Shopping in international stores with delivery to Uzbekistan.', buyers: 'For shoppers', contacts: 'Contacts', legal: 'Legal information',
      support: 'Support in your account', rules: 'Terms of service', privacy: 'Privacy policy', customs: 'Customs', faq: 'FAQ',
      telegramSupport: 'Telegram bot', telegramChannel: 'Telegram channel', phone: 'Phone', instagram: 'Instagram', pickup: 'Pickup point', theme: 'Theme',
    },
    sticky: { paste: 'Paste a link' },
  },
};
