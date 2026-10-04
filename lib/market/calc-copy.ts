import type { Locale } from './i18n.ts';

/** Shared wording of the order calculation: the link-order page, the cart and the orders. */
export type CalcCopy = {
  onlyOption: string; chooseOptions: string; chosen: string; quantity: string; less: string; more: string; removeOption: string;
  stockLeft: (count: number) => string; stockMore: (count: number) => string; stockUnknown: string; stockByEbay: string; outOfStock: string;
  optionLabel: string; optionPlaceholder: string; addOptions: (lines: number, units: number) => string;
  blocks: { product: string; price: string; storeShipping: string; country: string; weight: string; customs: string; comment: string };
  price: string; currency: string; storeShippingAmount: string; storeShippingUnknown: string; storeShippingStated: string; useStated: string;
  storeShippingRule: (freeFrom: string) => string; category: string; boxedWeight: string;
  weightStore: string; weightEstimate: (category: string) => string; weightTitle: string; weightCustomer: string; weightCatalog: string;
  weightRule: string; parcelWeight: (kg: string) => string;
  commentPlaceholder: string; commentHint: string; commentShort: string;
  lines: { items: string; atlasFee: (percent: string) => string; buyout: string; conversion: string; storeShipping: string; free: string; international: (kg: string) => string; intlReserve: string; optional: string; total: string; holdOutside: string };
  hold: string; holdNote: string; holdHelp: (freeFrom: string) => string; freeNote: (freeFrom: string) => string;
  feeHelp: string; intlReserveHelp: string;
  fxCbu: (rate: string, cbu: string, markup: string, when: string) => string; fxSet: (rate: string) => string;
  customs: {
    title: string; recipient: string; noRecipient: string; limitShort: string; atlasShort: string; outsideShort: string; itemsShort: string; notNeeded: string; allowance: (limit: string) => string; atlasUsed: (usd: string) => string;
    outside: string; outsideAmount: string; outsideUnknown: string; dutiable: string; estimate: string; none: (left: string) => string;
    minimum: (perKg: string) => string; help: string; helpFee: (percent: string, base: string, fee: string) => string; helpNote: string;
    separate: string; rule: string; dispute: string; sources: string; relative: string;
  };
};

export const calcCopy: Record<Locale, CalcCopy> = {
  ru: {
    onlyOption: 'Единственный доступный вариант', chooseOptions: 'Можно выбрать несколько вариантов', chosen: 'Выбрано', quantity: 'Количество', less: 'Меньше', more: 'Больше', removeOption: 'Убрать вариант',
    stockLeft: n => `Осталось ${n} шт.`, stockMore: n => `Больше ${n} шт.`, stockUnknown: 'Остаток магазин не сообщает', stockByEbay: 'по данным eBay', outOfStock: 'Нет в наличии',
    optionLabel: 'Вариант', optionPlaceholder: 'Например: EU 42, чёрный', addOptions: (lines, units) => lines > 1 ? `Добавить ${lines} варианта · ${units} шт.` : units > 1 ? `Добавить · ${units} шт.` : 'Добавить в корзину',
    blocks: { product: 'Товар и вариант', price: 'Цена в магазине', storeShipping: 'Доставка магазина до склада Atlas', country: 'Страна отправки', weight: 'Вес', customs: 'Таможня', comment: 'Комментарий к заказу' },
    price: 'Цена', currency: 'Валюта', storeShippingAmount: 'Сумма доставки', storeShippingUnknown: 'Магазин не указал доставку', storeShippingStated: 'Указана магазином', useStated: 'Использовать доставку со страницы',
    storeShippingRule: freeFrom => `Если магазин не указал доставку: при заказе из него больше чем на ${freeFrom} она бесплатна, иначе удерживаем отдельный резерв — он не входит в сумму заказа.`,
    category: 'Категория', boxedWeight: 'Вес товара с коробкой, кг',
    weightStore: 'Вес с упаковкой указан магазином.', weightEstimate: category => `Оценка Atlas для категории «${category}» — исправьте, если знаете точнее.`, weightTitle: 'Оценка Atlas по названию товара — исправьте, если знаете точнее.', weightCustomer: 'Вес указан вами.', weightCatalog: 'Вес задан Atlas для товара каталога.',
    weightRule: 'К весу посылки добавляем 0,3 кг на упаковку — один раз на посылку из одного магазина. Минимум — 1 кг. Склад взвесит посылку, и доставка пересчитается по факту.', parcelWeight: kg => `Платный вес посылки: ${kg} кг`,
    commentPlaceholder: 'Пожелание или важная информация, которую нам нужно учесть перед заказом', commentHint: 'Видит только Atlas, магазину не отправляется.', commentShort: 'Комментарий',
    lines: { items: 'Товары', atlasFee: p => `Комиссия Atlas · ${p}`, buyout: 'Выкуп', conversion: 'Конвертация', storeShipping: 'Доставка магазина', free: 'Бесплатно', international: kg => `Международная доставка · ${kg} кг`, intlReserve: 'Резерв международной доставки', optional: 'Дополнительные услуги', total: 'Итого к оплате', holdOutside: 'резерв отдельно' },
    hold: 'Предварительный резерв доставки магазина', holdNote: 'Удерживается отдельно, в сумму заказа не входит',
    holdHelp: freeFrom => `Магазин не указал доставку до склада. Мы удерживаем этот резерв отдельно от оплаты заказа, пока менеджер не узнает фактическую сумму. Если доставка окажется дешевле — остаток освободим; если дороже — сначала спросим вас. При заказе из магазина больше чем на ${freeFrom} доставка бесплатна и резерв не нужен.`,
    freeNote: freeFrom => `Заказ из магазина больше ${freeFrom}: доставка до склада бесплатна.`,
    feeHelp: 'Комиссия Atlas — 9,98% от стоимости товаров. На доставку и таможню не начисляется.',
    intlReserveHelp: 'Запас на случай, если посылка окажется тяжелее расчётной. После взвешивания неиспользованную часть вернём на баланс Atlas; если доставка выйдет дороже — сначала согласуем доплату.',
    fxCbu: (rate, cbu, markup, when) => `Курс: $1 = ${rate} — курс ЦБ ${cbu} × ${markup}, обновлён ${when}.`,
    fxSet: rate => `Курс: $1 = ${rate} — установленный курс Atlas, не курс ЦБ в реальном времени.`,
    customs: {
      title: 'Таможня, ориентир', recipient: 'Получатель', limitShort: 'Лимит в этом месяце', atlasShort: 'Учтено заказов Atlas', outsideShort: 'Покупки вне Atlas', itemsShort: 'Товары в корзине', notNeeded: 'не требуется', noRecipient: 'Получатель ещё не выбран — считаем полный лимит.', allowance: limit => `Лимит без пошлины — ${limit} в календарный месяц на каждого получателя.`,
      atlasUsed: usd => `Уже учтено заказов Atlas этого получателя в этом месяце: ${usd}.`,
      outside: 'Я уже использовал(а) часть месячного лимита вне Atlas', outsideAmount: 'Сумма покупок вне Atlas в этом месяце, $', outsideUnknown: 'Сумма не указана — считаем, что лимит этого месяца уже использован полностью.',
      dutiable: 'Облагается сверх лимита', estimate: 'Таможенный платёж, ориентир', none: left => `Не требуется: остаток лимита ${left}.`,
      minimum: perKg => `не меньше ${perKg} за кг облагаемого веса — итог подтверждает таможня`,
      help: 'Atlas поможет оплатить таможню', helpFee: (p, base, fee) => `Комиссия Atlas ${p} от ${base} = ${fee}`, helpNote: 'Это запрос, а не платёж: комиссия Atlas не является таможенным платежом и не входит в сумму заказа. Сумму подтвердит оператор.',
      separate: 'Таможня не входит в сумму заказа и оплачивается отдельно.', rule: 'Пошлина берётся только с суммы сверх лимита (ПКМ №244). Месяц — календарный месяц ввоза посылки.',
      dispute: 'Ставка 20%, но не меньше $2 за кг: сводная редакция ПП-4508 применяет её с 01.09.2026, а УП-174 — с 01.01.2027. Точную ставку подтверждает таможня.',
      sources: 'Источники', relative: 'Лимит исчерпан? Оформите заказ на родственника — если получать будет он и укажет свои данные и паспорт.',
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
    weightRule: 'Jo‘natma vazniga qadoq uchun 0,3 kg qo‘shamiz — bitta do‘kondan kelgan jo‘natmaga bir marta. Kamida 1 kg. Ombor jo‘natmani tortadi va yetkazish haqiqiy vazn bo‘yicha qayta hisoblanadi.', parcelWeight: kg => `Jo‘natmaning pullik vazni: ${kg} kg`,
    commentPlaceholder: 'Buyurtmadan oldin hisobga olishimiz kerak bo‘lgan istak yoki muhim ma’lumot', commentHint: 'Faqat Atlas ko‘radi, do‘konga yuborilmaydi.', commentShort: 'Izoh',
    lines: { items: 'Tovarlar', atlasFee: p => `Atlas komissiyasi · ${p}`, buyout: 'Xarid', conversion: 'Konvertatsiya', storeShipping: 'Do‘kon yetkazishi', free: 'Bepul', international: kg => `Xalqaro yetkazish · ${kg} kg`, intlReserve: 'Xalqaro yetkazish zaxirasi', optional: 'Qo‘shimcha xizmatlar', total: 'To‘lov uchun jami', holdOutside: 'zaxira alohida' },
    hold: 'Do‘kon yetkazishi uchun dastlabki zaxira', holdNote: 'Alohida ushlab turiladi, buyurtma summasiga kirmaydi',
    holdHelp: freeFrom => `Do‘kon omborgacha yetkazishni ko‘rsatmagan. Menejer haqiqiy summani bilguncha bu zaxirani buyurtma to‘lovidan alohida ushlab turamiz. Arzon chiqsa — qoldig‘ini bo‘shatamiz; qimmat chiqsa — avval sizdan so‘raymiz. Do‘kondan ${freeFrom} dan ortiq buyurtmada yetkazish bepul va zaxira kerak emas.`,
    freeNote: freeFrom => `Do‘kondan ${freeFrom} dan ortiq buyurtma: omborgacha yetkazish bepul.`,
    feeHelp: 'Atlas komissiyasi — tovarlar qiymatining 9,98%. Yetkazish va bojxonaga qo‘llanmaydi.',
    intlReserveHelp: 'Jo‘natma hisobdagidan og‘ir chiqsa, zaxira. Tortishdan keyin ishlatilmagan qismini Atlas balansiga qaytaramiz; qimmatroq chiqsa — avval qo‘shimcha to‘lovni kelishamiz.',
    fxCbu: (rate, cbu, markup, when) => `Kurs: $1 = ${rate} — MB kursi ${cbu} × ${markup}, ${when} da yangilangan.`,
    fxSet: rate => `Kurs: $1 = ${rate} — Atlas belgilagan kurs, real vaqtdagi MB kursi emas.`,
    customs: {
      title: 'Taxminiy bojxona', recipient: 'Qabul qiluvchi', limitShort: 'Shu oy limiti', atlasShort: 'Atlas buyurtmalari hisobga olindi', outsideShort: 'Atlasdan tashqari xaridlar', itemsShort: 'Savatdagi tovarlar', notNeeded: 'kerak emas', noRecipient: 'Qabul qiluvchi hali tanlanmagan — to‘liq limit hisoblanadi.', allowance: limit => `Bojsiz limit — har bir qabul qiluvchiga kalendar oyida ${limit}.`,
      atlasUsed: usd => `Shu oy bu qabul qiluvchining Atlas buyurtmalari hisobga olindi: ${usd}.`,
      outside: 'Oylik limitning bir qismini Atlasdan tashqarida ishlatganman', outsideAmount: 'Shu oy Atlasdan tashqari xaridlar summasi, $', outsideUnknown: 'Summa ko‘rsatilmagan — shu oy limiti to‘liq ishlatilgan deb hisoblaymiz.',
      dutiable: 'Limitdan oshgan qism', estimate: 'Taxminiy bojxona to‘lovi', none: left => `Kerak emas: limit qoldig‘i ${left}.`,
      minimum: perKg => `soliq solinadigan har kg uchun kamida ${perKg} — yakuniy summani bojxona tasdiqlaydi`,
      help: 'Atlas bojxonani to‘lashga yordam beradi', helpFee: (p, base, fee) => `Atlas komissiyasi ${base} dan ${p} = ${fee}`, helpNote: 'Bu so‘rov, to‘lov emas: Atlas komissiyasi bojxona to‘lovi emas va buyurtma summasiga kirmaydi. Summani operator tasdiqlaydi.',
      separate: 'Bojxona buyurtma summasiga kirmaydi va alohida to‘lanadi.', rule: 'Boj faqat limitdan oshgan qismdan olinadi (VMQ №244). Oy — jo‘natma olib kirilgan kalendar oyi.',
      dispute: 'Stavka 20%, lekin har kg uchun kamida $2: PP-4508 jamlangan tahririda 01.09.2026 dan, PF-174 da esa 01.01.2027 dan. Aniq stavkani bojxona tasdiqlaydi.',
      sources: 'Manbalar', relative: 'Limit tugadimi? Buyurtmani qarindoshingizga rasmiylashtiring — agar u qabul qilsa va o‘z ma’lumotlari va pasportini ko‘rsatsa.',
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
    weightRule: 'We add 0.3 kg for packaging to the parcel weight — once per parcel from one store. Minimum 1 kg. The warehouse weighs the parcel and delivery is recalculated on the actual weight.', parcelWeight: kg => `Billable parcel weight: ${kg} kg`,
    commentPlaceholder: 'A wish or important information we should take into account before ordering', commentHint: 'Only Atlas sees it; it is not sent to the store.', commentShort: 'Comment',
    lines: { items: 'Items', atlasFee: p => `Atlas fee · ${p}`, buyout: 'Buyout', conversion: 'Conversion', storeShipping: 'Store delivery', free: 'Free', international: kg => `International delivery · ${kg} kg`, intlReserve: 'International delivery reserve', optional: 'Extra services', total: 'Total to pay', holdOutside: 'held separately' },
    hold: 'Preliminary store-delivery reserve', holdNote: 'Held separately, not part of the order amount',
    holdHelp: freeFrom => `The store did not state delivery to the warehouse. We hold this reserve apart from the order payment until a manager learns the actual amount. If delivery costs less, the rest is released; if more, we ask you first. For orders from a store over ${freeFrom} delivery is free and no reserve is needed.`,
    freeNote: freeFrom => `Order from this store over ${freeFrom}: delivery to the warehouse is free.`,
    feeHelp: 'The Atlas fee is 9.98% of the item value. It is not charged on delivery or customs.',
    intlReserveHelp: 'A buffer in case the parcel is heavier than estimated. After weighing, the unused part goes back to your Atlas balance; if delivery costs more, we agree the extra with you first.',
    fxCbu: (rate, cbu, markup, when) => `Rate: $1 = ${rate} — Central Bank rate ${cbu} × ${markup}, updated ${when}.`,
    fxSet: rate => `Rate: $1 = ${rate} — a rate set by Atlas, not the live Central Bank rate.`,
    customs: {
      title: 'Customs, estimate', recipient: 'Recipient', limitShort: 'Allowance this month', atlasShort: 'Atlas orders counted', outsideShort: 'Purchases outside Atlas', itemsShort: 'Items in the cart', notNeeded: 'not needed', noRecipient: 'No recipient chosen yet — the full allowance is assumed.', allowance: limit => `Duty-free allowance: ${limit} per calendar month for each recipient.`,
      atlasUsed: usd => `Already counted this month from this recipient’s Atlas orders: ${usd}.`,
      outside: 'I have already used part of this month’s allowance outside Atlas', outsideAmount: 'Purchases outside Atlas this month, $', outsideUnknown: 'No amount given — we treat this month’s allowance as fully used.',
      dutiable: 'Dutiable above the allowance', estimate: 'Customs payment, estimate', none: left => `Not needed: ${left} of the allowance left.`,
      minimum: perKg => `at least ${perKg} per dutiable kg — customs confirms the final amount`,
      help: 'Atlas helps pay customs', helpFee: (p, base, fee) => `Atlas fee ${p} of ${base} = ${fee}`, helpNote: 'This is a request, not a payment: the Atlas fee is not a customs payment and is not part of the order amount. An operator confirms the amount.',
      separate: 'Customs is not part of the order amount and is paid separately.', rule: 'Duty applies only to the amount above the allowance (CM resolution No. 244). The month is the calendar month the parcel is imported.',
      dispute: 'Rate 20%, at least $2 per kg: the consolidated PP-4508 applies it from 01.09.2026, UP-174 from 01.01.2027. Customs confirms the exact rate.',
      sources: 'Sources', relative: 'Allowance used up? Order for a relative — if they receive the parcel and give their own details and passport.',
    },
  },
};
