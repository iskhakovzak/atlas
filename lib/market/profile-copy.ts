import type { Locale } from './i18n.ts';
import { withCyrillic } from './uz-cyrl.ts';
import type { ProfileActionKind } from './parcels.ts';

/**
 * Words of the parcel-first profile (1 November 2026): the hub, the parcel page, documents and settings. Terms as in
 * GLOSSARY.md — Заказ, Посылка, Этап посылки, Доставлен, Получатель. Nothing here promises a date, a price or a
 * delivery Atlas has not confirmed; payments stay simulated (no word says money was charged).
 */
export type ProfileCopy = {
  hub: {
    title: string;
    actions: string;
    allSet: string;
    allSetHint: string;
    parcels: string;
    parcelsEmpty: string;
    parcelsEmptyHint: string;
    newOrder: string;
    openParcel: string;
    allParcels: string;
    tiles: { label: string; orders: string; ordersSub: (active: number, total: number) => string; balance: string; balanceSub: string; documents: string; documentsSub: (passports: number, declarations: number) => string; notifications: string; notificationsSub: (unread: number) => string; favorites: string; favoritesSub: (count: number) => string; settings: string; settingsSub: string };
    recentDone: string;
  };
  action: Record<ProfileActionKind, { title: string; button: string }> & {
    paymentHint: (items: string) => string;
    passportTitle: (name: string) => string;
    passportHint: string;
    decisionHint: (name: string) => string;
    pay: (amount: string) => string;
  };
  stage: {
    of: (current: number, total: number) => string;
    awaitingPayment: string;
    next: (name: string) => string;
    bar: string;
  };
  parcel: {
    title: (store: string) => string;
    fallbackTitle: string;
    placed: (date: string) => string;
    number: string;
    notFound: string;
    notFoundHint: string;
    back: string;
    nothingToDo: string;
    delivered: string;
    cancelled: string;
    orders: (count: number) => string;
    ordersHint: string;
    orderStage: string;
    openOrder: string;
    recipient: string;
    tracking: string;
    carrier: string;
    trackingNumber: string;
    events: string;
    noTracking: string;
    documents: string;
    passportOk: (masked: string) => string;
    passportMissing: string;
    addPassport: string;
    declaration: (id: string) => string;
    allDocuments: string;
    claim: string;
    claimHint: string;
    total: string;
    support: string;
  };
  documents: { title: string; lead: string; passports: string; declarations: string };
  settings: { title: string; lead: string; language: string; theme: string; notices: string; noticesLead: string; signIn: string; help: string; account: string };
};

export const profileCopy: Record<Locale, ProfileCopy> = /*@__PURE__*/withCyrillic<ProfileCopy>({
  ru: {
    hub: {
      title: 'Профиль',
      actions: 'Требует действия',
      allSet: 'От вас ничего не нужно',
      allSetHint: 'Когда посылка перейдёт на новый этап, напишем в Telegram и в уведомлениях.',
      parcels: 'Активные посылки',
      parcelsEmpty: 'Активных посылок нет',
      parcelsEmptyHint: 'Вставьте ссылку на товар — посчитаем итог с доставкой в Ташкент.',
      newOrder: 'Заказать по ссылке',
      openParcel: 'Открыть посылку',
      allParcels: 'Все заказы',
      tiles: {
        label: 'Разделы профиля',
        orders: 'Заказы и посылки', ordersSub: (active, total) => active ? `В пути и в работе: ${active}` : total ? `Всего: ${total}` : 'Пока нет',
        balance: 'Баланс', balanceSub: 'Внутренний баланс Atlas',
        documents: 'Документы', documentsSub: (passports, declarations) => passports || declarations ? `Паспорта: ${passports} · декларации: ${declarations}` : 'Паспорта и декларации',
        notifications: 'Уведомления', notificationsSub: (unread) => unread ? `Новых: ${unread}` : 'Новых нет',
        favorites: 'Избранное', favoritesSub: (count) => count ? `Сохранено: ${count}` : 'Пока пусто',
        settings: 'Настройки', settingsSub: 'Язык, тема, Telegram, аккаунт',
      },
      recentDone: 'Недавно доставлены',
    },
    action: {
      extra: { title: 'Нужна доплата', button: 'Посмотреть доплату' },
      change: { title: 'Нужно ваше решение', button: 'Ответить' },
      payment: { title: 'Заказ ждёт оплаты', button: 'Оплатить' },
      passport: { title: 'Нужен паспорт получателя', button: 'Добавить паспорт' },
      paymentHint: (items) => `Один платёж за весь заказ: ${items}. После оплаты выкупим товар в магазине.`,
      passportTitle: (name) => `Нужен паспорт: ${name}`,
      passportHint: 'Он нужен для таможенной декларации до отправки посылки.',
      decisionHint: (name) => name,
      pay: (amount) => `Оплатить ${amount}`,
    },
    stage: { of: (current, total) => `Этап ${current} из ${total}`, awaitingPayment: 'Ждёт оплаты', next: (name) => `Дальше: ${name}`, bar: 'Этапы посылки' },
    parcel: {
      title: (store) => `Посылка из ${store}`,
      fallbackTitle: 'Посылка',
      placed: (date) => `Оформлена ${date}`,
      number: 'Номер',
      notFound: 'Посылка не найдена',
      notFoundHint: 'Возможно, ссылка устарела. Все ваши заказы — в разделе «Заказы и посылки».',
      back: 'В профиль',
      nothingToDo: 'От вас ничего не нужно. О следующем этапе напишем в Telegram и в уведомлениях.',
      delivered: 'Курьер передал посылку получателю.',
      cancelled: 'Все заказы этой посылки отменены.',
      orders: (count) => count === 1 ? 'Заказ в посылке' : `Заказы в посылке: ${count}`,
      ordersHint: 'До зарубежного склада у каждого заказа свой этап выкупа, дальше посылка едет целиком.',
      orderStage: 'Этап заказа',
      openOrder: 'Счёт и история',
      recipient: 'Получатель',
      tracking: 'Отслеживание',
      carrier: 'Перевозчик',
      trackingNumber: 'Трек-номер',
      events: 'События',
      noTracking: 'Трек-номер появится, когда склад передаст посылку перевозчику.',
      documents: 'Документы',
      passportOk: (masked) => `Паспорт получателя: ${masked}`,
      passportMissing: 'Паспорт получателя ещё не добавлен',
      addPassport: 'Добавить паспорт',
      declaration: (id) => `Декларация ${id}`,
      allDocuments: 'Все документы',
      claim: 'Проблема с посылкой',
      claimHint: 'Претензию подают по заказу: о потере — пока посылка в пути, о повреждении — после доставки.',
      total: 'Сумма заказов',
      support: 'Вопрос по посылке',
    },
    documents: { title: 'Документы', lead: 'Паспорта получателей и таможенные декларации в одном месте. Паспорт нужен для декларации до отправки посылки.', passports: 'Паспорта получателей', declarations: 'Декларации' },
    settings: { title: 'Настройки', lead: 'Язык, тема, уведомления и аккаунт.', language: 'Язык и тема', theme: 'Тема', notices: 'Уведомления о посылках', noticesLead: 'О каждом новом этапе посылки и о том, что нужно сделать, пишем в уведомлениях на сайте, а если включить — в Telegram и в браузере.', signIn: 'Способы входа', help: 'Помощь и документы', account: 'Аккаунт' },
  },
  uz: {
    hub: {
      title: 'Profil',
      actions: 'Harakat kerak',
      allSet: 'Sizdan hech narsa talab qilinmaydi',
      allSetHint: 'Posilka yangi bosqichga o‘tganda Telegram va bildirishnomalarda xabar beramiz.',
      parcels: 'Faol posilkalar',
      parcelsEmpty: 'Faol posilkalar yo‘q',
      parcelsEmptyHint: 'Tovar havolasini qo‘ying — Toshkentgacha yetkazish bilan yakuniy summani hisoblaymiz.',
      newOrder: 'Havola orqali buyurtma',
      openParcel: 'Posilkani ochish',
      allParcels: 'Barcha buyurtmalar',
      tiles: {
        label: 'Profil bo‘limlari',
        orders: 'Buyurtmalar va posilkalar', ordersSub: (active, total) => active ? `Yo‘lda va jarayonda: ${active}` : total ? `Jami: ${total}` : 'Hozircha yo‘q',
        balance: 'Balans', balanceSub: 'Atlas ichki balansi',
        documents: 'Hujjatlar', documentsSub: (passports, declarations) => passports || declarations ? `Pasportlar: ${passports} · deklaratsiyalar: ${declarations}` : 'Pasportlar va deklaratsiyalar',
        notifications: 'Bildirishnomalar', notificationsSub: (unread) => unread ? `Yangi: ${unread}` : 'Yangi yo‘q',
        favorites: 'Saqlanganlar', favoritesSub: (count) => count ? `Saqlangan: ${count}` : 'Hozircha bo‘sh',
        settings: 'Sozlamalar', settingsSub: 'Til, mavzu, Telegram, akkaunt',
      },
      recentDone: 'Yaqinda yetkazilgan',
    },
    action: {
      extra: { title: 'Qo‘shimcha to‘lov kerak', button: 'Qo‘shimcha to‘lovni ko‘rish' },
      change: { title: 'Qaroringiz kerak', button: 'Javob berish' },
      payment: { title: 'Buyurtma to‘lovni kutmoqda', button: 'To‘lash' },
      passport: { title: 'Qabul qiluvchining pasporti kerak', button: 'Pasport qo‘shish' },
      paymentHint: (items) => `Butun buyurtma uchun bitta to‘lov: ${items}. To‘lovdan keyin tovarni do‘kondan xarid qilamiz.`,
      passportTitle: (name) => `Pasport kerak: ${name}`,
      passportHint: 'U posilka jo‘natilishidan oldin bojxona deklaratsiyasi uchun kerak.',
      decisionHint: (name) => name,
      pay: (amount) => `${amount} to‘lash`,
    },
    stage: { of: (current, total) => `Bosqich: ${current} / ${total}`, awaitingPayment: 'To‘lov kutilmoqda', next: (name) => `Keyingi: ${name}`, bar: 'Posilka bosqichlari' },
    parcel: {
      title: (store) => `${store} posilkasi`,
      fallbackTitle: 'Posilka',
      placed: (date) => `${date} rasmiylashtirilgan`,
      number: 'Raqam',
      notFound: 'Posilka topilmadi',
      notFoundHint: 'Havola eskirgan bo‘lishi mumkin. Barcha buyurtmalaringiz — «Buyurtmalar va posilkalar» bo‘limida.',
      back: 'Profilga',
      nothingToDo: 'Sizdan hech narsa talab qilinmaydi. Keyingi bosqich haqida Telegram va bildirishnomalarda xabar beramiz.',
      delivered: 'Kuryer posilkani qabul qiluvchiga topshirdi.',
      cancelled: 'Bu posilkaning barcha buyurtmalari bekor qilingan.',
      orders: (count) => count === 1 ? 'Posilkadagi buyurtma' : `Posilkadagi buyurtmalar: ${count}`,
      ordersHint: 'Xorijdagi omborgacha har bir buyurtmaning o‘z xarid bosqichi bor, keyin posilka butunligicha yo‘lga chiqadi.',
      orderStage: 'Buyurtma bosqichi',
      openOrder: 'Hisob va tarix',
      recipient: 'Qabul qiluvchi',
      tracking: 'Kuzatish',
      carrier: 'Tashuvchi',
      trackingNumber: 'Kuzatuv raqami',
      events: 'Voqealar',
      noTracking: 'Kuzatuv raqami ombor posilkani tashuvchiga topshirganda paydo bo‘ladi.',
      documents: 'Hujjatlar',
      passportOk: (masked) => `Qabul qiluvchining pasporti: ${masked}`,
      passportMissing: 'Qabul qiluvchining pasporti hali qo‘shilmagan',
      addPassport: 'Pasport qo‘shish',
      declaration: (id) => `${id} deklaratsiyasi`,
      allDocuments: 'Barcha hujjatlar',
      claim: 'Posilka bilan muammo',
      claimHint: 'Da’vo buyurtma bo‘yicha beriladi: yo‘qolish haqida — posilka yo‘lda ekanida, shikastlanish haqida — yetkazilgandan keyin.',
      total: 'Buyurtmalar summasi',
      support: 'Posilka bo‘yicha savol',
    },
    documents: { title: 'Hujjatlar', lead: 'Qabul qiluvchilarning pasportlari va bojxona deklaratsiyalari bir joyda. Pasport posilka jo‘natilishidan oldin deklaratsiya uchun kerak.', passports: 'Qabul qiluvchilar pasportlari', declarations: 'Deklaratsiyalar' },
    settings: { title: 'Sozlamalar', lead: 'Til, mavzu, bildirishnomalar va akkaunt.', language: 'Til va mavzu', theme: 'Mavzu', notices: 'Posilkalar haqida bildirishnomalar', noticesLead: 'Posilkaning har bir yangi bosqichi va nima qilish kerakligi haqida saytdagi bildirishnomalarda, yoqsangiz — Telegram va brauzerda ham yozamiz.', signIn: 'Kirish usullari', help: 'Yordam va hujjatlar', account: 'Akkaunt' },
  },
  en: {
    hub: {
      title: 'Profile',
      actions: 'Needs your action',
      allSet: 'Nothing needed from you',
      allSetHint: 'When a parcel moves to a new stage, we’ll tell you in Telegram and in notifications.',
      parcels: 'Active parcels',
      parcelsEmpty: 'No active parcels',
      parcelsEmptyHint: 'Paste a product link — we’ll calculate the total with delivery to Tashkent.',
      newOrder: 'Order by link',
      openParcel: 'Open parcel',
      allParcels: 'All orders',
      tiles: {
        label: 'Profile sections',
        orders: 'Orders and parcels', ordersSub: (active, total) => active ? `On the way and in progress: ${active}` : total ? `Total: ${total}` : 'None yet',
        balance: 'Balance', balanceSub: 'Atlas internal balance',
        documents: 'Documents', documentsSub: (passports, declarations) => passports || declarations ? `Passports: ${passports} · declarations: ${declarations}` : 'Passports and declarations',
        notifications: 'Notifications', notificationsSub: (unread) => unread ? `New: ${unread}` : 'Nothing new',
        favorites: 'Saved', favoritesSub: (count) => count ? `Saved: ${count}` : 'Empty for now',
        settings: 'Settings', settingsSub: 'Language, theme, Telegram, account',
      },
      recentDone: 'Recently delivered',
    },
    action: {
      extra: { title: 'Extra payment needed', button: 'Review extra payment' },
      change: { title: 'Your decision is needed', button: 'Reply' },
      payment: { title: 'The order awaits payment', button: 'Pay' },
      passport: { title: 'Recipient’s passport needed', button: 'Add passport' },
      paymentHint: (items) => `One payment for the whole order: ${items}. Once paid, we buy the item at the store.`,
      passportTitle: (name) => `Passport needed: ${name}`,
      passportHint: 'Customs needs it for the declaration before the parcel ships.',
      decisionHint: (name) => name,
      pay: (amount) => `Pay ${amount}`,
    },
    stage: { of: (current, total) => `Stage ${current} of ${total}`, awaitingPayment: 'Awaiting payment', next: (name) => `Next: ${name}`, bar: 'Parcel stages' },
    parcel: {
      title: (store) => `Parcel from ${store}`,
      fallbackTitle: 'Parcel',
      placed: (date) => `Placed ${date}`,
      number: 'Number',
      notFound: 'Parcel not found',
      notFoundHint: 'The link may be out of date. All your orders are under “Orders and parcels”.',
      back: 'To profile',
      nothingToDo: 'Nothing needed from you. We’ll tell you about the next stage in Telegram and in notifications.',
      delivered: 'The courier handed the parcel to the recipient.',
      cancelled: 'Every order of this parcel was cancelled.',
      orders: (count) => count === 1 ? 'Order in the parcel' : `Orders in the parcel: ${count}`,
      ordersHint: 'Until the overseas warehouse each order has its own purchase stage; from there the parcel travels as one.',
      orderStage: 'Order stage',
      openOrder: 'Bill and history',
      recipient: 'Recipient',
      tracking: 'Tracking',
      carrier: 'Carrier',
      trackingNumber: 'Tracking number',
      events: 'Events',
      noTracking: 'The tracking number appears once the warehouse hands the parcel to the carrier.',
      documents: 'Documents',
      passportOk: (masked) => `Recipient’s passport: ${masked}`,
      passportMissing: 'The recipient’s passport isn’t added yet',
      addPassport: 'Add passport',
      declaration: (id) => `Declaration ${id}`,
      allDocuments: 'All documents',
      claim: 'A problem with the parcel',
      claimHint: 'Claims are filed per order: a loss while the parcel is on its way, damage after delivery.',
      total: 'Orders total',
      support: 'Question about the parcel',
    },
    documents: { title: 'Documents', lead: 'Recipients’ passports and customs declarations in one place. Customs needs the passport for the declaration before the parcel ships.', passports: 'Recipients’ passports', declarations: 'Declarations' },
    settings: { title: 'Settings', lead: 'Language, theme, notifications and account.', language: 'Language and theme', theme: 'Theme', notices: 'Parcel notifications', noticesLead: 'We tell you about every new stage of a parcel and anything you need to do in the site’s notifications — and, if you turn them on, in Telegram and the browser.', signIn: 'Sign-in methods', help: 'Help and documents', account: 'Account' },
  },
});
