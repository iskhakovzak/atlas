export type Locale = "ru" | "uz" | "en";
export function supportedLocale(value:unknown):Locale|null{
  return value === "ru" || value === "uz" || value === "en" ? value : null;
}

const apiErrors:Record<Locale,Record<number,string>>={
  ru:{400:"Проверьте данные и попробуйте снова.",401:"Войдите, чтобы продолжить.",403:"У вас нет доступа к этому действию.",404:"Запрошенные данные не найдены.",405:"Этот способ запроса не поддерживается.",409:"Данные изменились. Обновите страницу и повторите действие.",413:"Запрос слишком большой.",422:"Не удалось обработать данные. Проверьте их и попробуйте снова.",429:"Слишком много запросов. Попробуйте позже.",503:"Не удалось выполнить запрос. Попробуйте ещё раз."},
  uz:{400:"Ma’lumotlarni tekshirib, qayta urinib ko‘ring.",401:"Davom etish uchun tizimga kiring.",403:"Bu amalni bajarish uchun ruxsat yo‘q.",404:"So‘ralgan ma’lumot topilmadi.",405:"Bu so‘rov usuli qo‘llab-quvvatlanmaydi.",409:"Ma’lumotlar o‘zgardi. Sahifani yangilab, qayta urinib ko‘ring.",413:"So‘rov hajmi juda katta.",422:"Ma’lumotlarni qayta ishlab bo‘lmadi. Tekshirib, qayta urinib ko‘ring.",429:"So‘rovlar soni oshib ketdi. Keyinroq urinib ko‘ring.",503:"So‘rov bajarilmadi. Qayta urinib ko‘ring."},
  en:{400:"Check the details and try again.",401:"Sign in to continue.",403:"You don’t have access to this action.",404:"The requested information wasn’t found.",405:"This request method isn’t supported.",409:"The data changed. Refresh the page and try again.",413:"The request is too large.",422:"Couldn’t process the information. Check it and try again.",429:"Too many requests. Try again later.",503:"The request couldn’t be completed. Please try again."},
};

/** Resolve only display language from a validated preference cookie or Accept-Language. */
export function requestLocale(request?:Request):Locale{
  if(!request)return "ru";
  const cookie=request.headers.get("cookie")?.split(";").map(part=>part.trim()).find(part=>part.startsWith("atlas-language="));
  const saved=supportedLocale(cookie?.slice("atlas-language=".length));
  if(saved)return saved;
  const accepted=request.headers.get("accept-language")?.split(",").map((entry,index)=>{
    const [tag,...params]=entry.trim().split(";");
    const quality=Number(params.find(param=>param.trim().startsWith("q="))?.trim().slice(2)??1);
    return {tag:tag.toLowerCase().split("-")[0],quality:Number.isFinite(quality)?quality:0,index};
  }).filter(entry=>entry.quality>0).sort((a,b)=>b.quality-a.quality||a.index-b.index)??[];
  for(const entry of accepted){const locale=supportedLocale(entry.tag);if(locale)return locale;}
  return "ru";
}

export function apiErrorMessage(status:number,locale:Locale):string{
  return apiErrors[locale][status]??apiErrors[locale][503];
}

export function importManualEntryMessage(locale:Locale):string{
  return {
    ru:"Не все данные магазина загрузились. Подтвердите цену, валюту и вариант, затем добавьте товар в корзину. Atlas сверит цену и валюту, если магазин ответит.",
    uz:"Do‘kon ma’lumotlarining hammasi yuklanmadi. Narx, valyuta va variantni tasdiqlab, savatga qo‘shing. Do‘kon javob bersa, Atlas narx va valyutani solishtiradi.",
    en:"Some store details did not load. Confirm the price, currency and option, then add it to your cart. Atlas compares them when the store responds.",
  }[locale];
}

export function setLocaleCookie(locale:Locale):void{
  if(typeof document==="undefined")return;
  const secure=window.location.protocol==="https:"?"; Secure":"";
  document.cookie=`atlas-language=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
const copy = {
  ru: {catalog:"Каталог",link:"Заказ по ссылке",batch:"Импорт списка",orders:"Мои заказы",account:"Кабинет",signin:"Войти",cart:"Корзина",balance:"Баланс",favorites:"Избранное",home:"Главная",terms:"Правила и данные",customs:"Таможня",retry:"Повторить",openSignIn:"Открыть вход",footer:"Atlas · Магазины мира — в одном месте.",contactTitle:"Связаться с Atlas",contactSupport:"Поддержка в личном кабинете",paymentTitle:"Способы оплаты",paymentPlanned:"Планируем подключить: Visa, Mastercard, Apple Pay, Google Pay, Uzcard и Humo. Реальные платежи пока не принимаются."},
  uz: {catalog:"Katalog",link:"Havola orqali buyurtma",batch:"Ro‘yxatni import qilish",orders:"Buyurtmalarim",account:"Kabinet",signin:"Kirish",cart:"Savat",balance:"Balans",favorites:"Saqlanganlar",home:"Bosh sahifa",terms:"Qoidalar va ma’lumotlar",customs:"Bojxona",retry:"Qayta urinish",openSignIn:"Kirishni ochish",footer:"Atlas · Dunyo do‘konlari bir joyda.",contactTitle:"Atlas bilan bog‘lanish",contactSupport:"Shaxsiy kabinetdagi yordam",paymentTitle:"To‘lov usullari",paymentPlanned:"Ulash rejalashtirilgan: Visa, Mastercard, Apple Pay, Google Pay, Uzcard va Humo. Hozircha haqiqiy to‘lovlar qabul qilinmaydi."},
  en: {catalog:"Catalog",link:"Order by link",batch:"Import list",orders:"My orders",account:"Account",signin:"Sign in",cart:"Cart",balance:"Balance",favorites:"Saved",home:"Home",terms:"Terms & privacy",customs:"Customs",retry:"Try again",openSignIn:"Open sign in",footer:"Atlas · The world’s stores, in one place.",contactTitle:"Contact Atlas",contactSupport:"Support in your account",paymentTitle:"Payment methods",paymentPlanned:"Planned: Visa, Mastercard, Apple Pay, Google Pay, Uzcard and Humo. Real payments are not accepted yet."},
};
export function ui(locale:Locale){return copy[locale]}
const orderStatuses = {
  ru: ["Ожидает выкупа", "Выкуплен", "На зарубежном складе", "Готов к отправке", "В пути", "Доставлен"],
  uz: ["Xarid kutilmoqda", "Xarid qilindi", "Xorijdagi omborda", "Jo‘natishga tayyor", "Yo‘lda", "Yetkazildi"],
  en: ["Awaiting purchase", "Purchased", "At overseas warehouse", "Ready to ship", "In transit", "Delivered"],
};
export function localizedStatuses(locale:Locale){return orderStatuses[locale]}
const routeTitles:Record<Locale,Record<string,string>>={
  ru:{catalog:'Каталог',favorites:'Избранное',link:'Заказ по ссылке',stores:'Магазины',cart:'Корзина',orders:'Мои заказы',balance:'Баланс',operations:'Кабинет оператора',notifications:'Уведомления',account:'Личный кабинет',customs:'Таможенные условия',analytics:'Аналитика',legal:'Правила Atlas',identity:'Паспорт',declaration:'Декларация',batch:'Импорт списка',admin:'Администрирование'},
  uz:{catalog:'Katalog',favorites:'Saqlanganlar',link:'Havola orqali buyurtma',stores:'Do‘konlar',cart:'Savat',orders:'Buyurtmalarim',balance:'Balans',operations:'Operator kabineti',notifications:'Bildirishnomalar',account:'Shaxsiy kabinet',customs:'Bojxona shartlari',analytics:'Tahlil',legal:'Atlas qoidalari',identity:'Pasport',declaration:'Deklaratsiya',batch:'Ro‘yxat importi',admin:'Boshqaruv'},
  en:{catalog:'Catalog',favorites:'Saved',link:'Order by link',stores:'Stores',cart:'Cart',orders:'My orders',balance:'Balance',operations:'Operator workspace',notifications:'Notifications',account:'Account',customs:'Customs terms',analytics:'Analytics',legal:'Atlas terms',identity:'Passport',declaration:'Declaration',batch:'List import',admin:'Administration'},
};
export function routeTitle(locale:Locale,view:string){return routeTitles[locale][view]??view}

export const serverErrors: Record<Locale, Record<string, string>> = {
  ru: {
    'err_1': 'Войдите, чтобы продолжить.',
    'err_2': 'Недопустимый источник запроса.',
    'err_3': 'Достигнут лимит данных профиля.',
    'err_4': 'Заказ изменился в другой вкладке. Данные обновлены — повторите действие.',
    'err_5': 'Клиент не найден в операционной базе. Выполните синхронизацию.',
    'err_6': 'Профиль покупателя не найден.',
    'err_7': 'Пустой запрос.',
    'err_8': 'Слишком большой запрос.',
    'err_9': 'Некорректный JSON.',
    'err_10': 'Проверьте данные запроса и согласие с условиями.',
    'err_11': 'Профиль временно заблокирован. Обратитесь в поддержку Atlas.',
    'err_12': 'Оформление временно приостановлено до завершения проверки профиля.',
    'err_13': 'Скан паспорта не найден. Загрузите его заново.',
    'err_14': 'Сначала выберите сохранённого получателя.',
    'err_15': 'Доступно только оператору.',
    'err_16': 'Проверьте данные операции.',
    'err_17': 'Проверьте действие с заказом.',
    'err_18': 'Это действие недоступно оператору.',
    'err_19': 'Укажите ссылку.',
    'err_20': 'Слишком много запросов. Попробуйте через минуту.',
    'err_21': 'Защищённое хранилище документов пока недоступно.',
    'err_22': 'Файл слишком большой. Максимум 8 МБ.',
    'err_23': 'Выберите файл паспорта.',
    'err_24': 'Поддерживаются JPG, PNG и PDF до 8 МБ.',
    'err_25': 'Содержимое файла не соответствует выбранному формату.',
    'err_26': 'Не указан документ.',
    'err_27': 'Документ не найден.',
    'err_28': 'Доступ только администратору.',
    'err_29': 'Доступ только администратору.',
    'err_30': 'Проверьте поля карточки и подборки.',
    'err_31': 'Каталог изменён. Обновите список перед сохранением.',
    'err_32': 'Достигнут лимит импорта. Продолжите через минуту.',
    'err_33': 'Подборка не найдена.',
  },
  uz: {
    'err_1': 'Davom etish uchun tizimga kiring.',
    'err_2': 'Ruxsatsiz so‘rov manbasi.',
    'err_3': 'Profil ma’lumotlari chegarasiga yetildi.',
    'err_4': 'Buyurtma boshqa oynada o‘zgargan. Ma’lumotlar yangilandi — amalni takrorlang.',
    'err_5': 'Mijoz operatsion bazada topilmadi. Sinxronizatsiya qiling.',
    'err_6': 'Xaridor profili topilmadi.',
    'err_7': 'Bo‘sh so‘rov.',
    'err_8': 'Juda katta so‘rov.',
    'err_9': 'Noto‘g‘ri JSON.',
    'err_10': 'So‘rov ma’lumotlarini va shartlarga rozilikni tekshiring.',
    'err_11': 'Profil vaqtincha bloklangan. Atlas yordam xizmatiga murojaat qiling.',
    'err_12': 'Rasmiylashtirish profil tekshiruvi tugaguncha vaqtincha to‘xtatildi.',
    'err_13': 'Pasport skaneri topilmadi. Uni qayta yuklang.',
    'err_14': 'Avval saqlangan qabul qiluvchini tanlang.',
    'err_15': 'Faqat operator uchun mavjud.',
    'err_16': 'Amaliyot ma’lumotlarini tekshiring.',
    'err_17': 'Buyurtma bilan amalni tekshiring.',
    'err_18': 'Bu amal operator uchun mavjud emas.',
    'err_19': 'Havolani ko‘rsating.',
    'err_20': 'Juda ko‘p so‘rovlar. Bir daqiqadan so‘ng qayta urinib ko‘ring.',
    'err_21': 'Himoyalangan hujjatlar ombori hozircha mavjud emas.',
    'err_22': 'Fayl juda katta. Maksimum 8 MB.',
    'err_23': 'Pasport faylini tanlang.',
    'err_24': '8 MB gacha JPG, PNG va PDF qo‘llab-quvvatlanadi.',
    'err_25': 'Fayl tarkibi tanlangan formatga mos kelmaydi.',
    'err_26': 'Hujjat ko‘rsatilmagan.',
    'err_27': 'Hujjat topilmadi.',
    'err_28': 'Faqat administrator uchun ruxsat.',
    'err_29': 'Faqat administrator uchun ruxsat.',
    'err_30': 'Karta va to‘plam maydonlarini tekshiring.',
    'err_31': 'Katalog o‘zgartirildi. Saqlashdan oldin ro‘yxatni yangilang.',
    'err_32': 'Import limiti yetildi. Bir daqiqadan so‘ng davom eting.',
    'err_33': 'To‘plam topilmadi.',
  },
  en: {
    'err_1': 'Sign in to continue.',
    'err_2': 'Invalid request origin.',
    'err_3': 'Profile data limit reached.',
    'err_4': 'Order changed in another tab. Data refreshed — please retry.',
    'err_5': 'Customer not found in operational database. Run sync.',
    'err_6': 'Customer profile not found.',
    'err_7': 'Empty request.',
    'err_8': 'Request too large.',
    'err_9': 'Invalid JSON.',
    'err_10': 'Check request data and agreement to terms.',
    'err_11': 'Profile temporarily blocked. Contact Atlas support.',
    'err_12': 'Checkout temporarily suspended until profile verification is complete.',
    'err_13': 'Passport scan not found. Upload it again.',
    'err_14': 'First, select a saved recipient.',
    'err_15': 'Available to operator only.',
    'err_16': 'Check operation data.',
    'err_17': 'Check order action.',
    'err_18': 'This action is not available to the operator.',
    'err_19': 'Provide a link.',
    'err_20': 'Too many requests. Try again in a minute.',
    'err_21': 'Secure document storage is currently unavailable.',
    'err_22': 'File too large. Maximum 8 MB.',
    'err_23': 'Select passport file.',
    'err_24': 'JPG, PNG, and PDF up to 8 MB are supported.',
    'err_25': 'File content does not match the selected format.',
    'err_26': 'Document not specified.',
    'err_27': 'Document not found.',
    'err_28': 'Admin access only.',
    'err_29': 'Admin access only.',
    'err_30': 'Check card and collection fields.',
    'err_31': 'Catalog modified. Refresh the list before saving.',
    'err_32': 'Import limit reached. Continue in a minute.',
    'err_33': 'Collection not found.',
  },
};
export function serverError(locale:Locale, key:string){
  return serverErrors[locale][key] ?? {
    ru: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
    uz: 'So‘rovni bajarib bo‘lmadi. Qayta urinib ko‘ring.',
    en: 'The request could not be completed. Please try again.',
  }[locale];
}
