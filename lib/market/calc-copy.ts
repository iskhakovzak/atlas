import type { Locale } from './i18n.ts';
import {withCyrillic} from './uz-cyrl.ts';

/** Shared wording of the order calculation: the link-order page, the cart and the orders. */
export type CalcCopy = {
  onlyOption: string; chooseOptions: string; chosen: string; quantity: string; less: string; more: string; removeOption: string;
  stockLeft: (count: number) => string; stockMore: (count: number) => string; stockUnknown: string; stockByEbay: string; outOfStock: string;
  optionLabel: string; optionPlaceholder: string; addOptions: (lines: number, units: number) => string;
  blocks: { product: string; price: string; storeShipping: string; country: string; weight: string; customs: string; comment: string };
  price: string; currency: string; storeShippingAmount: string; storeShippingUnknown: string; storeShippingStated: string; useStated: string;
  storeShippingRule: (freeFrom: string) => string; category: string; boxedWeight: string;
  weightStore: string; weightEstimate: (category: string) => string; weightTitle: string; weightCustomer: string; weightCatalog: string;
  /** `packaging`: the per-parcel packaging allowance (world.packagingKg), formatted for the locale. */
  weightRule: (packaging: string) => string; parcelWeight: (kg: string) => string;
  commentPlaceholder: string; commentHint: string; commentShort: string;
  lines: { items: string; /** One line for the fee and international delivery (owner, 10.10.2026); the parts fold under `serviceBreakdown`. */ service: string; serviceBreakdown: string; atlasFee: (percent: string) => string; buyout: string; conversion: string; storeShipping: string; free: string; international: (kg: string) => string; intlReserve: string; /** Parcel insurance chosen in the cart, part of the total. */ insurance: string; optional: string; total: string; holdOutside: string; customsHelp: (percent: string) => string; customsDuty: string };
  hold: string; holdNote: string; holdHelp: (freeFrom: string) => string; freeNote: (freeFrom: string) => string;
  /** Rates come from the tariff (pricing.margin, pricing.customsHelpFee), never typed into the copy. */
  feeHelp: (percent: string) => string; intlReserveHelp: string; customsHelpHelp: (percent: string) => string; customsDutyHelp: string; outside: string;
  /** Delivery speed words for the international line and the blank bill. */
  speeds: { express: string; standard: string }; speedRule: (express: string, expressDays: string, standard: string, standardDays: string) => string;
  blank: {
    title: string; lead: string; item: string; itemCbu: (markup: string) => string; itemSet: string; fee: string; feeRule: (percent: string) => string;
    delivery: string; deliveryRule: (perKg: string, packaging: string) => string; reserve: string; reserveRule: string; total: string;
    storeRule: (freeFrom: string, hold: string) => string; customsRule: (allowance: string) => string;
  };
  customs: {
    title: string; allowanceTitle: (limit: string) => string; allowanceNote: string; overNote: (over: string, estimate: string) => string; overIncluded: (over: string, estimate: string) => string;
    /** The item page's preview: who pays the duty is chosen later, in the cart. */
    overPreview: (over: string, estimate: string) => string;
    recipient: string; limitShort: string; atlasShort: string; outsideShort: string; notNeeded: string;
    outside: string; outsideAmount: string; outsideUnknown: string; dutiable: string; estimate: string;
    help: string; helpFee: (percent: string, fee: string) => string;
    separate: string; rule: string;  relative: string;
    /** Who pays the duty: two cards in the cart instead of one checkbox (owner, 7.10.2026). */
    /** `fee`: everything "Atlas pays customs" adds to the bill — the duty and the fee together. */
    choice: { title: string; atlas: string; badge: string; perk: string; fee: (amount: string, duty: string, percent: string) => string; self: string; selfOver: string; selfFee: string;
      remember: string; rememberedAtlas: string; rememberedSelf: string; change: string; noDuty: (left: string) => string };
    /** "How customs is calculated": a popover with a small calculator instead of a link away from the cart. */
    how: { title: string; rule: (limit: string, rate: string, perKg: string) => string; left: (amount: string) => string; leftNone: string; try: string; minus: string; plus: string; amount: string; none: string; over: (excess: string, duty: string) => string; final: string; details: string; close: string };
  };
};

export const calcCopy: Record<Locale, CalcCopy> = /*@__PURE__*/withCyrillic({
  ru: {
    onlyOption: 'Единственный доступный вариант', chooseOptions: 'Можно выбрать несколько вариантов', chosen: 'Выбрано', quantity: 'Количество', less: 'Меньше', more: 'Больше', removeOption: 'Убрать вариант',
    stockLeft: n => `Осталось ${n} шт.`, stockMore: n => `Больше ${n} шт.`, stockUnknown: 'Остаток магазин не сообщает', stockByEbay: 'по данным eBay', outOfStock: 'Нет в наличии',
    optionLabel: 'Вариант', optionPlaceholder: 'Например: EU 42, чёрный', addOptions: (lines, units) => lines > 1 ? `Добавить ${lines} варианта · ${units} шт.` : units > 1 ? `Добавить · ${units} шт.` : 'Добавить в корзину',
    blocks: { product: 'Товар и вариант', price: 'Цена в магазине', storeShipping: 'Доставка магазина до склада Atlas', country: 'Страна отправки', weight: 'Вес', customs: 'Таможня', comment: 'Комментарий к заказу' },
    price: 'Цена', currency: 'Валюта', storeShippingAmount: 'Сумма доставки', storeShippingUnknown: 'Магазин не указал доставку', storeShippingStated: 'Указана магазином', useStated: 'Использовать доставку со страницы',
    storeShippingRule: freeFrom => `Если магазин не указал доставку: при заказе из него больше чем на ${freeFrom} она бесплатна, иначе удерживаем отдельный резерв — он не входит в сумму заказа.`,
    category: 'Категория', boxedWeight: 'Вес товара с коробкой, кг',
    weightStore: 'Вес с упаковкой указан магазином.', weightEstimate: category => `Оценка Atlas для категории «${category}» — исправьте, если знаете точнее.`, weightTitle: 'Оценка Atlas по названию товара — исправьте, если знаете точнее.', weightCustomer: 'Вес указан вами.', weightCatalog: 'Вес задан Atlas для товара каталога.',
    weightRule: packaging => `К весу посылки добавляем ${packaging} кг на упаковку — один раз на посылку из одного магазина. Минимум — 1 кг. Склад взвесит посылку: если она легче — разницу вернём на баланс, если тяжелее — доплата только с вашего согласия.`, parcelWeight: kg => `Платный вес посылки: ${kg} кг`,
    commentPlaceholder: 'Пожелание или важная информация, которую нам нужно учесть перед заказом', commentHint: 'Видит только Atlas, магазину не отправляется.', commentShort: 'Комментарий',
    lines: { items: 'Товары', service: 'Сервис Atlas', serviceBreakdown: 'Состав сервиса', atlasFee: p => p ? `Комиссия Atlas ${p}` : 'Комиссия Atlas', buyout: 'Выкуп', conversion: 'Конвертация', storeShipping: 'Доставка магазина', free: 'Бесплатно', international: kg => kg ? `Международная доставка, ${kg} кг` : 'Международная доставка', intlReserve: 'Резерв международной доставки', insurance: 'Страхование посылки', optional: 'Дополнительные услуги', total: 'К оплате', holdOutside: 'резерв отдельно', customsHelp: p => `Оплата таможни через Atlas ${p}`, customsDuty: 'Таможенная пошлина, предоплата' },
    hold: 'Резерв на доставку магазина', holdNote: 'Остаток освободим, когда магазин подтвердит цену доставки',
    holdHelp: freeFrom => `Магазин не указал доставку до склада. Этот резерв держим отдельно от оплаты заказа, пока менеджер не подтвердит фактическую сумму у магазина. Если доставка выйдет дешевле — остаток освободим; если дороже — разница только с вашего согласия. При заказе из магазина дороже ${freeFrom} доставка бесплатна и резерв не нужен.`,
    freeNote: freeFrom => `Заказ из магазина больше ${freeFrom}: доставка до склада бесплатна.`,
    feeHelp: p => `Комиссия Atlas — ${p} от стоимости товаров. На доставку и таможню не начисляется.`,
    intlReserveHelp: 'Запас на случай, если посылка окажется тяжелее расчётной. После взвешивания неиспользованную часть вернём на баланс Atlas; если доставка выйдет дороже — доплата только с вашего согласия.',
    customsHelpHelp: p => `Сбор за оплату таможни через Atlas: ${p} от цены товаров, без доставки.`,
    customsDutyHelp: 'Рассчитано по правилам таможни для этого получателя. Atlas оплатит пошлину на таможне: если она выйдет меньше — остаток вернём на баланс, если больше — доплата только с вашего согласия.',
    speeds: { express: 'экспресс', standard: 'обычная' }, speedRule: (express, expressDays, standard, standardDays) => `экспресс ${expressDays} — ${express}, обычная ${standardDays} — ${standard}`,
    outside: 'Не входит в сумму к оплате',
    blank: {
      title: 'Так будет выглядеть счёт', lead: 'Вставьте ссылку, и мы заполним каждую строку в сумах.',
      item: 'Цена товара', itemCbu: markup => `по курсу ЦБ плюс ${markup}`, itemSet: 'по установленному курсу Atlas',
      fee: 'Комиссия Atlas', feeRule: percent => `${percent} от цены товара`,
      delivery: 'Доставка в Ташкент', deliveryRule: (perKg, packaging) => `${perKg} за кг, плюс ${packaging} кг упаковки, минимум 1 кг`,
      reserve: 'Возвратный резерв', reserveRule: 'запас на вес; остаток вернём на баланс', total: 'К оплате',
      storeRule: (freeFrom, hold) => `Доставка магазина до склада, если он её не указал: бесплатно при заказе дороже ${freeFrom}, иначе резерв ${hold} отдельно.`,
      customsRule: allowance => `Таможенная пошлина: до ${allowance} в месяц на получателя не нужна.`,
    },
    customs: {
      title: 'Таможенная пошлина', allowanceTitle: limit => `Без таможенной пошлины — до ${limit} в месяц`, allowanceNote: 'На одного получателя, включая покупки вне Atlas.', overNote: (over, estimate) => `В этой корзине ${over} сверх лимита: таможня начислит пошлину ≈ ${estimate}. Она не входит в сумму заказа.`, overIncluded: (over, estimate) => `В этой корзине ${over} сверх лимита: пошлина ≈ ${estimate} уже в счёте. Если таможня начислит меньше — остаток вернём на баланс.`,
      overPreview: (over, estimate) => `Сверх лимита ${over}: пошлина ≈ ${estimate}. Кто её оплатит — Atlas или вы, — выберете в корзине.`,
      recipient: 'Получатель', limitShort: 'Лимит в этом месяце', atlasShort: 'Учтено заказов Atlas', outsideShort: 'Покупки вне Atlas', notNeeded: 'не нужна',
      outside: 'Я уже превысил(а) лимит в этом месяце (покупки вне Atlas)', outsideAmount: 'Сколько уже потрачено вне Atlas, $ (если знаете)', outsideUnknown: 'Сумма не указана — считаем, что лимит этого месяца уже использован полностью.',
      dutiable: 'Облагается сверх лимита', estimate: 'Таможенный платёж по расчёту',
      help: 'Таможню оплачивает Atlas', helpFee: (p, fee) => `Комиссия Atlas ${p} от стоимости товара: ${fee}`,
      separate: 'Таможня не входит в сумму заказа и оплачивается отдельно.', rule: 'Пошлина берётся только с суммы сверх лимита (ПКМ №244). Месяц — календарный месяц ввоза посылки.',
      relative: 'Лимит исчерпан? Оформите заказ на родственника — если получать будет он и укажет свои данные и паспорт.',
      choice: {
        title: 'Как оплатить таможню', atlas: 'Atlas оплатит таможню', badge: 'Удобнее',
        perk: 'Пошлину по расчёту вносим сразу с заказом. Если таможня начислит больше — доплата только с вашего согласия',
        fee: (amount, duty, p) => `+ ${amount} · пошлина ≈ ${duty} и сбор ${p}`,
        self: 'Оплачу сам(а)', selfOver: 'Ждёте счёт от таможни и оплачиваете сами. Пока он не оплачен, посылка стоит на таможне.',
        selfFee: 'без сбора',
        remember: 'Запомнить для следующих заказов', rememberedAtlas: 'Таможню оплачивает Atlas', rememberedSelf: 'Таможню оплачиваете вы', change: 'Изменить',
        noDuty: left => `Пошлины нет · в этом месяце осталось ${left}`,
      },
      how: {
        title: 'Как считается таможня', rule: (limit, rate, perKg) => `До ${limit} в месяц на получателя — без пошлины. Сверх лимита — ${rate} от превышения, но не меньше ${perKg} за каждый кг посылки.`,
        left: amount => `У получателя в этом месяце осталось ${amount} лимита`, leftNone: 'Лимит получателя в этом месяце уже использован',
        try: 'Проверьте на сумме', minus: 'Меньше на $50', plus: 'Больше на $50', amount: 'Стоимость товаров',
        none: 'Пошлины нет — сумма в пределах лимита', over: (excess, duty) => `Сверх лимита ${excess} → пошлина ≈ ${duty}`,
        final: 'Окончательную сумму начисляет таможня.', details: 'Подробнее о таможне', close: 'Закрыть',
      },
    },
  },
  uz: {
    onlyOption: 'Yagona mavjud variant', chooseOptions: 'Bir nechta variantni tanlash mumkin', chosen: 'Tanlandi', quantity: 'Soni', less: 'Kamroq', more: 'Ko‘proq', removeOption: 'Variantni olib tashlash',
    stockLeft: n => `${n} dona qoldi`, stockMore: n => `${n} donadan ko‘p`, stockUnknown: 'Do‘kon qoldiqni aytmaydi', stockByEbay: 'eBay ma’lumotiga ko‘ra', outOfStock: 'Mavjud emas',
    optionLabel: 'Variant', optionPlaceholder: 'Masalan: EU 42, qora', addOptions: (lines, units) => lines > 1 ? `${lines} ta variantni qo‘shish · ${units} dona` : units > 1 ? `Qo‘shish · ${units} dona` : 'Savatga qo‘shish',
    blocks: { product: 'Tovar va variant', price: 'Do‘kondagi narx', storeShipping: 'Do‘kondan Atlas omborigacha yetkazish', country: 'Jo‘natish mamlakati', weight: 'Vazn', customs: 'Bojxona', comment: 'Buyurtmaga izoh' },
    price: 'Narx', currency: 'Valyuta', storeShippingAmount: 'Yetkazish summasi', storeShippingUnknown: 'Do‘kon yetkazishni ko‘rsatmagan', storeShippingStated: 'Do‘kon ko‘rsatgan', useStated: 'Sahifadagi yetkazishni ishlatish',
    storeShippingRule: freeFrom => `Do‘kon yetkazishni ko‘rsatmagan bo‘lsa: undan ${freeFrom} dan ortiq buyurtmada bepul, aks holda alohida zaxira ushlab turiladi — u buyurtma summasiga kirmaydi.`,
    category: 'Kategoriya', boxedWeight: 'Qutidagi tovar vazni, kg',
    weightStore: 'Qadoqli vaznni do‘kon ko‘rsatgan.', weightEstimate: category => `«${category}» uchun Atlas bahosi — aniqroq bilsangiz, tuzating.`, weightTitle: 'Tovar nomi bo‘yicha Atlas bahosi — aniqroq bilsangiz, tuzating.', weightCustomer: 'Vaznni siz kiritdingiz.', weightCatalog: 'Katalog tovari vaznini Atlas belgilagan.',
    weightRule: packaging => `Jo‘natma vazniga qadoq uchun ${packaging} kg qo‘shamiz — bitta do‘kondan kelgan jo‘natmaga bir marta. Kamida 1 kg. Ombor jo‘natmani tortadi: yengil chiqsa — farqni balansga qaytaramiz, og‘ir chiqsa — qo‘shimcha to‘lov faqat sizning roziligingiz bilan.`, parcelWeight: kg => `Jo‘natmaning pullik vazni: ${kg} kg`,
    commentPlaceholder: 'Buyurtmadan oldin hisobga olishimiz kerak bo‘lgan istak yoki muhim ma’lumot', commentHint: 'Faqat Atlas ko‘radi, do‘konga yuborilmaydi.', commentShort: 'Izoh',
    lines: { items: 'Tovarlar', service: 'Atlas xizmati', serviceBreakdown: 'Xizmat tarkibi', atlasFee: p => p ? `Atlas komissiyasi ${p}` : 'Atlas komissiyasi', buyout: 'Xarid', conversion: 'Konvertatsiya', storeShipping: 'Do‘kon yetkazishi', free: 'Bepul', international: kg => kg ? `Xalqaro yetkazish, ${kg} kg` : 'Xalqaro yetkazish', intlReserve: 'Xalqaro yetkazish zaxirasi', insurance: 'Posilkani sug‘urtalash', optional: 'Qo‘shimcha xizmatlar', total: 'To‘lov uchun', holdOutside: 'zaxira alohida', customsHelp: p => `Bojxonani Atlas orqali to‘lash ${p}`, customsDuty: 'Bojxona boji, oldindan to‘lov' },
    hold: 'Do‘kon yetkazishi uchun zaxira', holdNote: 'Do‘kon yetkazish narxini tasdiqlagach, qoldig‘ini bo‘shatamiz',
    holdHelp: freeFrom => `Do‘kon omborgacha yetkazishni ko‘rsatmagan. Menejer haqiqiy summani do‘kondan tasdiqlaguncha bu zaxirani buyurtma to‘lovidan alohida ushlab turamiz. Arzon chiqsa — qoldig‘ini bo‘shatamiz; qimmat chiqsa — farq faqat roziligingiz bilan. Do‘kondan ${freeFrom} dan qimmat buyurtmada yetkazish bepul va zaxira kerak emas.`,
    freeNote: freeFrom => `Do‘kondan ${freeFrom} dan ortiq buyurtma: omborgacha yetkazish bepul.`,
    feeHelp: p => `Atlas komissiyasi — tovarlar qiymatining ${p}. Yetkazish va bojxonaga qo‘llanmaydi.`,
    intlReserveHelp: 'Jo‘natma hisobdagidan og‘ir chiqsa, zaxira. Tortishdan keyin ishlatilmagan qismini Atlas balansiga qaytaramiz; qimmatroq chiqsa — qo‘shimcha to‘lov faqat roziligingiz bilan.',
    customsHelpHelp: p => `Bojxonani Atlas orqali to‘lash yig‘imi: tovarlar narxining ${p}, yetkazishsiz.`,
    customsDutyHelp: 'Bu qabul qiluvchi uchun bojxona qoidalari bo‘yicha hisoblangan. Bojni Atlas bojxonada to‘laydi: kam chiqsa — qoldiqni balansga qaytaramiz, ko‘p chiqsa — qo‘shimcha to‘lov faqat roziligingiz bilan.',
    speeds: { express: 'ekspress', standard: 'oddiy' }, speedRule: (express, expressDays, standard, standardDays) => `ekspress ${expressDays} — ${express}, oddiy ${standardDays} — ${standard}`,
    outside: 'To‘lov summasiga kirmaydi',
    blank: {
      title: 'Hisob shunday ko‘rinadi', lead: 'Havolani qo‘ying, har bir satrni so‘mda to‘ldiramiz.',
      item: 'Tovar narxi', itemCbu: markup => `MB kursi va ${markup} ustama bilan`, itemSet: 'Atlas belgilagan kurs bilan',
      fee: 'Atlas komissiyasi', feeRule: percent => `tovar narxining ${percent}`,
      delivery: 'Toshkentga yetkazib berish', deliveryRule: (perKg, packaging) => `har kg uchun ${perKg}, qadoq uchun ${packaging} kg, kamida 1 kg`,
      reserve: 'Qaytariladigan zaxira', reserveRule: 'og‘irlik uchun zaxira; qolgani balansga qaytadi', total: 'To‘lov uchun',
      storeRule: (freeFrom, hold) => `Do‘kon omborgacha yetkazish narxini ko‘rsatmasa: ${freeFrom} dan qimmat buyurtmada bepul, aks holda ${hold} zaxira alohida.`,
      customsRule: allowance => `Bojxona to‘lovi: bitta oluvchiga oyiga ${allowance} gacha kerak emas.`,
    },
    customs: {
      title: 'Bojxona boji', allowanceTitle: limit => `Bojxona bojisiz — oyiga ${limit} gacha`, allowanceNote: 'Bitta qabul qiluvchiga, Atlasdan tashqari xaridlar bilan birga.', overNote: (over, estimate) => `Bu savatda limitdan ${over} ortiq: bojxona taxminan ${estimate} boj hisoblaydi. U buyurtma summasiga kirmaydi.`, overIncluded: (over, estimate) => `Bu savatda limitdan ${over} ortiq: taxminan ${estimate} boj hisobga kiritildi. Bojxona kamroq hisoblasa — qoldiqni balansga qaytaramiz.`,
      overPreview: (over, estimate) => `Limitdan ${over} ortiq: boj taxminan ${estimate}. Uni Atlas yoki o‘zingiz to‘lashingizni savatda tanlaysiz.`,
      recipient: 'Qabul qiluvchi', limitShort: 'Shu oy limiti', atlasShort: 'Atlas buyurtmalari hisobga olindi', outsideShort: 'Atlasdan tashqari xaridlar', notNeeded: 'kerak emas',
      outside: 'Shu oy limitni oshirib bo‘lganman (Atlasdan tashqari xaridlar)', outsideAmount: 'Atlasdan tashqari qancha sarflangan, $ (bilsangiz)', outsideUnknown: 'Summa ko‘rsatilmagan — shu oy limiti to‘liq ishlatilgan deb hisoblaymiz.',
      dutiable: 'Limitdan oshgan qism', estimate: 'Hisoblangan bojxona to‘lovi',
      help: 'Bojxonani Atlas to‘laydi', helpFee: (p, fee) => `Atlas komissiyasi tovar narxidan ${p}: ${fee}`,
      separate: 'Bojxona buyurtma summasiga kirmaydi va alohida to‘lanadi.', rule: 'Boj faqat limitdan oshgan qismdan olinadi (VMQ №244). Oy — jo‘natma olib kirilgan kalendar oyi.',
      relative: 'Limit tugadimi? Buyurtmani qarindoshingizga rasmiylashtiring — agar u qabul qilsa va o‘z ma’lumotlari va pasportini ko‘rsatsa.',
      choice: {
        title: 'Bojxonani qanday to‘lash', atlas: 'Bojxonani Atlas to‘laydi', badge: 'Qulayroq',
        perk: 'Hisoblangan bojni buyurtma bilan darhol to‘laymiz. Bojxona ko‘proq hisoblasa — qo‘shimcha to‘lov faqat roziligingiz bilan',
        fee: (amount, duty, p) => `+ ${amount} · boj ≈ ${duty} va ${p} yig‘im`,
        self: 'O‘zim to‘layman', selfOver: 'Bojxona hisobini kutib, o‘zingiz to‘laysiz. To‘lanmaguncha jo‘natma bojxonada turadi.',
        selfFee: 'yig‘imsiz',
        remember: 'Keyingi buyurtmalar uchun eslab qolish', rememberedAtlas: 'Bojxonani Atlas to‘laydi', rememberedSelf: 'Bojxonani o‘zingiz to‘laysiz', change: 'O‘zgartirish',
        noDuty: left => `Boj yo‘q · shu oy ${left} qoldi`,
      },
      how: {
        title: 'Bojxona qanday hisoblanadi', rule: (limit, rate, perKg) => `Bitta qabul qiluvchiga oyiga ${limit} gacha — bojsiz. Limitdan oshgan qismdan ${rate}, lekin posilkaning har kg uchun kamida ${perKg}.`,
        left: amount => `Qabul qiluvchida shu oy ${amount} limit qoldi`, leftNone: 'Qabul qiluvchining shu oydagi limiti ishlatib bo‘lingan',
        try: 'Summada tekshiring', minus: '$50 kamroq', plus: '$50 ko‘proq', amount: 'Tovarlar qiymati',
        none: 'Boj yo‘q — summa limit doirasida', over: (excess, duty) => `Limitdan ${excess} ortiq → boj ≈ ${duty}`,
        final: 'Yakuniy summani bojxona hisoblaydi.', details: 'Bojxona haqida batafsil', close: 'Yopish',
      },
    },
  },
  en: {
    onlyOption: 'The only available option', chooseOptions: 'You can choose several options', chosen: 'Chosen', quantity: 'Quantity', less: 'Fewer', more: 'More', removeOption: 'Remove option',
    stockLeft: n => `${n} left`, stockMore: n => `More than ${n}`, stockUnknown: 'The store does not say how many are left', stockByEbay: 'according to eBay', outOfStock: 'Out of stock',
    optionLabel: 'Option', optionPlaceholder: 'For example: EU 42, black', addOptions: (lines, units) => lines > 1 ? `Add ${lines} options · ${units} pcs` : units > 1 ? `Add · ${units} pcs` : 'Add to cart',
    blocks: { product: 'Item and option', price: 'Store price', storeShipping: 'Store delivery to the Atlas warehouse', country: 'Dispatch country', weight: 'Weight', customs: 'Customs', comment: 'Order comment' },
    price: 'Price', currency: 'Currency', storeShippingAmount: 'Delivery amount', storeShippingUnknown: 'The store did not state delivery', storeShippingStated: 'Stated by the store', useStated: 'Use the delivery from the page',
    storeShippingRule: freeFrom => `If the store does not state delivery: it is free for orders from that store over ${freeFrom}; otherwise we hold a separate reserve that is not part of the order amount.`,
    category: 'Category', boxedWeight: 'Boxed item weight, kg',
    weightStore: 'The store states the packed weight.', weightEstimate: category => `Atlas estimate for “${category}” — correct it if you know better.`, weightTitle: 'Atlas estimate from the product name — correct it if you know better.', weightCustomer: 'You entered the weight.', weightCatalog: 'Atlas set the weight for this catalog item.',
    weightRule: packaging => `We add ${packaging} kg for packaging to the parcel weight — once per parcel from one store. Minimum 1 kg. The warehouse weighs the parcel: if it is lighter, the difference goes back to your balance; if heavier, any extra payment needs your consent.`, parcelWeight: kg => `Billable parcel weight: ${kg} kg`,
    commentPlaceholder: 'A wish or important information we should take into account before ordering', commentHint: 'Only Atlas sees it; it is not sent to the store.', commentShort: 'Comment',
    lines: { items: 'Items', service: 'Atlas service', serviceBreakdown: 'Service breakdown', atlasFee: p => p ? `Atlas fee ${p}` : 'Atlas fee', buyout: 'Buyout', conversion: 'Conversion', storeShipping: 'Store delivery', free: 'Free', international: kg => kg ? `International delivery, ${kg} kg` : 'International delivery', intlReserve: 'International delivery reserve', insurance: 'Parcel insurance', optional: 'Extra services', total: 'To pay', holdOutside: 'held separately', customsHelp: p => `Customs paid through Atlas ${p}`, customsDuty: 'Customs duty, prepaid' },
    hold: 'Store-delivery reserve', holdNote: 'The rest is released once the store confirms the delivery price',
    holdHelp: freeFrom => `The store did not state delivery to the warehouse. We hold this reserve apart from the order payment until a manager confirms the actual amount with the store. If delivery costs less, the rest is released; if more, the difference needs your consent. For orders from a store over ${freeFrom} delivery is free and no reserve is needed.`,
    freeNote: freeFrom => `Order from this store over ${freeFrom}: delivery to the warehouse is free.`,
    feeHelp: p => `The Atlas fee is ${p} of the item value. It is not charged on delivery or customs.`,
    intlReserveHelp: 'A buffer in case the parcel is heavier than estimated. After weighing, the unused part goes back to your Atlas balance; if delivery costs more, any extra needs your consent.',
    customsHelpHelp: p => `The fee for customs paid through Atlas: ${p} of the goods price, delivery excluded.`,
    customsDutyHelp: 'Calculated under the customs rules for this recipient. Atlas pays the duty at customs: if it comes out lower, the rest returns to your balance; if higher, any extra needs your consent.',
    speeds: { express: 'express', standard: 'standard' }, speedRule: (express, expressDays, standard, standardDays) => `express ${expressDays} at ${express}, standard ${standardDays} at ${standard}`,
    outside: 'Not in the amount to pay',
    blank: {
      title: 'This is how the bill will look', lead: 'Paste a link and we fill in every line in soum.',
      item: 'Item price', itemCbu: markup => `at the Central Bank rate plus ${markup}`, itemSet: 'at the rate set by Atlas',
      fee: 'Atlas fee', feeRule: percent => `${percent} of the item price`,
      delivery: 'Delivery to Tashkent', deliveryRule: (perKg, packaging) => `${perKg} per kg, plus ${packaging} kg packaging, at least 1 kg`,
      reserve: 'Refundable reserve', reserveRule: 'a weight buffer; what is left returns to your balance', total: 'To pay',
      storeRule: (freeFrom, hold) => `Store delivery to the warehouse, when the store does not state it: free on orders over ${freeFrom}, otherwise a ${hold} reserve kept apart.`,
      customsRule: allowance => `Customs duty: not needed up to ${allowance} a month per recipient.`,
    },
    customs: {
      title: 'Customs duty', allowanceTitle: limit => `No customs duty up to ${limit} a month`, allowanceNote: 'Per recipient, including purchases outside Atlas.', overNote: (over, estimate) => `This cart is ${over} over the allowance: customs will charge about ${estimate}. It is not part of the order amount.`, overIncluded: (over, estimate) => `This cart is ${over} over the allowance: about ${estimate} of duty is already in the bill. If customs charges less, the rest returns to your balance.`,
      overPreview: (over, estimate) => `${over} over the allowance: duty ≈ ${estimate}. You choose in the cart whether Atlas pays it or you do.`,
      recipient: 'Recipient', limitShort: 'Allowance this month', atlasShort: 'Atlas orders counted', outsideShort: 'Purchases outside Atlas', notNeeded: 'not needed',
      outside: 'I have already gone over this month’s allowance (purchases outside Atlas)', outsideAmount: 'Already spent outside Atlas, $ (if you know)', outsideUnknown: 'No amount given — we treat this month’s allowance as fully used.',
      dutiable: 'Dutiable above the allowance', estimate: 'Calculated customs payment',
      help: 'Atlas pays customs', helpFee: (p, fee) => `Atlas fee ${p} of the item value: ${fee}`,
      separate: 'Customs is not part of the order amount and is paid separately.', rule: 'Duty applies only to the amount above the allowance (CM resolution No. 244). The month is the calendar month the parcel is imported.',
      relative: 'Allowance used up? Order for a relative — if they receive the parcel and give their own details and passport.',
      choice: {
        title: 'How to pay customs', atlas: 'Atlas pays customs', badge: 'Easier',
        perk: 'We pay the calculated duty with the order. If customs charges more, any extra only with your consent',
        fee: (amount, duty, p) => `+ ${amount} · duty ≈ ${duty} and a ${p} fee`,
        self: 'I will pay myself', selfOver: 'You wait for the customs bill and pay it yourself; until then the parcel stays at customs.',
        selfFee: 'no fee',
        remember: 'Remember for next orders', rememberedAtlas: 'Atlas pays customs', rememberedSelf: 'You pay customs', change: 'Change',
        noDuty: left => `No duty · ${left} of allowance left this month`,
      },
      how: {
        title: 'How customs is calculated', rule: (limit, rate, perKg) => `Up to ${limit} a month per recipient: no duty. Above it: ${rate} of the excess, but at least ${perKg} per kg of the parcel.`,
        left: amount => `This recipient has ${amount} of allowance left this month`, leftNone: 'This recipient’s allowance for the month is used up',
        try: 'Try an amount', minus: '$50 less', plus: '$50 more', amount: 'Goods value',
        none: 'No duty: the amount is within the allowance', over: (excess, duty) => `${excess} over the allowance → duty ≈ ${duty}`,
        final: 'Customs sets the final amount.', details: 'More about customs', close: 'Close',
      },
    },
  },
});
