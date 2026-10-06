export type Locale = "ru" | "uz" | "en";
export function supportedLocale(value:unknown):Locale|null{
  return value === "ru" || value === "uz" || value === "en" ? value : null;
}

/** Site language when neither a saved choice nor the browser language matches a supported one. */
export const defaultLocale:Locale="uz";

const apiErrors:Record<Locale,Record<number,string>>={
  ru:{400:"Проверьте данные и попробуйте снова.",401:"Войдите, чтобы продолжить.",403:"У вас нет доступа к этому действию.",404:"Запрошенные данные не найдены.",405:"Этот способ запроса не поддерживается.",409:"Данные изменились. Обновите страницу и повторите действие.",413:"Запрос слишком большой.",422:"Не удалось обработать данные. Проверьте их и попробуйте снова.",429:"Слишком много запросов. Попробуйте позже.",503:"Не удалось выполнить запрос. Попробуйте ещё раз."},
  uz:{400:"Ma’lumotlarni tekshirib, qayta urinib ko‘ring.",401:"Davom etish uchun tizimga kiring.",403:"Bu amalni bajarish uchun ruxsat yo‘q.",404:"So‘ralgan ma’lumot topilmadi.",405:"Bu so‘rov usuli qo‘llab-quvvatlanmaydi.",409:"Ma’lumotlar o‘zgardi. Sahifani yangilab, qayta urinib ko‘ring.",413:"So‘rov hajmi juda katta.",422:"Ma’lumotlarni qayta ishlab bo‘lmadi. Tekshirib, qayta urinib ko‘ring.",429:"So‘rovlar soni oshib ketdi. Keyinroq urinib ko‘ring.",503:"So‘rov bajarilmadi. Qayta urinib ko‘ring."},
  en:{400:"Check the details and try again.",401:"Sign in to continue.",403:"You don’t have access to this action.",404:"The requested information wasn’t found.",405:"This request method isn’t supported.",409:"The data changed. Refresh the page and try again.",413:"The request is too large.",422:"Couldn’t process the information. Check it and try again.",429:"Too many requests. Try again later.",503:"The request couldn’t be completed. Please try again."},
};

/** Resolve only display language from a validated preference cookie or Accept-Language. */
export function requestLocale(request?:Request):Locale{
  if(!request)return defaultLocale;
  return preferredLocale(request.headers.get("cookie"),request.headers.get("accept-language"));
}

/** Saved "atlas-language" cookie first, then the highest-ranked supported Accept-Language, then the site default. */
export function preferredLocale(cookieHeader:string|null|undefined,acceptLanguage:string|null|undefined):Locale{
  const cookie=cookieHeader?.split(";").map(part=>part.trim()).find(part=>part.startsWith("atlas-language="));
  const saved=supportedLocale(cookie?.slice("atlas-language=".length));
  if(saved)return saved;
  const accepted=acceptLanguage?.split(",").map((entry,index)=>{
    const [tag,...params]=entry.trim().split(";");
    const quality=Number(params.find(param=>param.trim().startsWith("q="))?.trim().slice(2)??1);
    return {tag:tag.toLowerCase().split("-")[0],quality:Number.isFinite(quality)?quality:0,index};
  }).filter(entry=>entry.quality>0).sort((a,b)=>b.quality-a.quality||a.index-b.index)??[];
  for(const entry of accepted){const locale=supportedLocale(entry.tag);if(locale)return locale;}
  return defaultLocale;
}

/** Request header that middleware.ts sets for `?lang=uz|ru|en` page versions. */
export const pageLocaleHeader="x-atlas-locale";

/** Language a page renders in: an explicit `?lang=` version (passed on by middleware), then the saved choice, the browser language and Uzbek. */
export function renderLocale(requested:string|null|undefined,cookieHeader:string|null|undefined,acceptLanguage:string|null|undefined):Locale{
  return supportedLocale(requested)??preferredLocale(cookieHeader,acceptLanguage);
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
  ru: {catalog:"Каталог",link:"Заказ по ссылке",batch:"Импорт списка",orders:"Мои заказы",account:"Кабинет",signin:"Войти",cart:"Корзина",balance:"Баланс",favorites:"Избранное",home:"Главная",terms:"Правила и данные",customs:"Таможня",retry:"Повторить",openSignIn:"Открыть вход",footer:"Atlas · Магазины мира — в одном месте.",contactTitle:"Связаться с Atlas",contactSupport:"Поддержка в личном кабинете"},
  uz: {catalog:"Katalog",link:"Havola orqali buyurtma",batch:"Ro‘yxatni import qilish",orders:"Buyurtmalarim",account:"Kabinet",signin:"Kirish",cart:"Savat",balance:"Balans",favorites:"Saqlanganlar",home:"Bosh sahifa",terms:"Qoidalar va ma’lumotlar",customs:"Bojxona",retry:"Qayta urinish",openSignIn:"Kirishni ochish",footer:"Atlas · Dunyo do‘konlari bir joyda.",contactTitle:"Atlas bilan bog‘lanish",contactSupport:"Shaxsiy kabinetdagi yordam"},
  en: {catalog:"Catalog",link:"Order by link",batch:"Import list",orders:"My orders",account:"Account",signin:"Sign in",cart:"Cart",balance:"Balance",favorites:"Saved",home:"Home",terms:"Terms & privacy",customs:"Customs",retry:"Try again",openSignIn:"Open sign in",footer:"Atlas · The world’s stores, in one place.",contactTitle:"Contact Atlas",contactSupport:"Support in your account"},
};
export function ui(locale:Locale){
  return copy[locale];
}
const orderStatuses = {
  ru: ["Ожидает выкупа", "Выкуплен", "На зарубежном складе", "Готов к отправке", "В пути", "Доставлен"],
  uz: ["Xarid kutilmoqda", "Xarid qilindi", "Xorijdagi omborda", "Jo‘natishga tayyor", "Yo‘lda", "Yetkazildi"],
  en: ["Awaiting purchase", "Purchased", "At overseas warehouse", "Ready to ship", "In transit", "Delivered"],
};
export function localizedStatuses(locale:Locale){return orderStatuses[locale]}
const routeTitles:Record<Locale,Record<string,string>>={
  ru:{catalog:'Каталог',products:'Каталог',favorites:'Избранное',link:'Заказ по ссылке',stores:'Магазины',cart:'Корзина',orders:'Мои заказы',balance:'Баланс',operations:'Кабинет оператора',notifications:'Уведомления',account:'Личный кабинет',customs:'Таможенные условия',analytics:'Аналитика',legal:'Правила Atlas',identity:'Паспорт',declaration:'Декларация',batch:'Импорт списка',admin:'Администрирование',login:'Вход',notfound:'Страница не найдена',privacy:'Политика конфиденциальности',terms:'Условия использования',support:'Поддержка',app:'Приложение','delete-account':'Удаление аккаунта'},
  uz:{catalog:'Katalog',products:'Katalog',favorites:'Saqlanganlar',link:'Havola orqali buyurtma',stores:'Do‘konlar',cart:'Savat',orders:'Buyurtmalarim',balance:'Balans',operations:'Operator kabineti',notifications:'Bildirishnomalar',account:'Shaxsiy kabinet',customs:'Bojxona shartlari',analytics:'Tahlil',legal:'Atlas qoidalari',identity:'Pasport',declaration:'Deklaratsiya',batch:'Ro‘yxat importi',admin:'Boshqaruv',login:'Kirish',notfound:'Sahifa topilmadi',privacy:'Maxfiylik siyosati',terms:'Foydalanish shartlari',support:'Yordam',app:'Ilova','delete-account':'Akkauntni o‘chirish'},
  en:{catalog:'Catalog',products:'Catalog',favorites:'Saved',link:'Order by link',stores:'Stores',cart:'Cart',orders:'My orders',balance:'Balance',operations:'Operator workspace',notifications:'Notifications',account:'Account',customs:'Customs terms',analytics:'Analytics',legal:'Atlas terms',identity:'Passport',declaration:'Declaration',batch:'List import',admin:'Administration',login:'Sign in',notfound:'Page not found',privacy:'Privacy policy',terms:'Terms of use',support:'Support',app:'App','delete-account':'Delete account'},
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
    'err_34': 'Цена в магазине только что изменилась. Мы загрузили новую цену — проверьте итог и добавьте товар ещё раз.',
    'err_35': 'Цена в магазине изменилась. Корзина пересчитана — проверьте новый итог и оформите заказ ещё раз.',
    'err_36': 'Магазин изменил данные товара: валюту, вариант или цену. Откройте отмеченный товар и добавьте его заново.',
    'err_37': 'Тарифы Atlas обновились. Корзина пересчитана — проверьте новый итог и оформите заказ ещё раз.',
    'err_38': 'Магазин сейчас не отвечает, поэтому цену не удалось сверить. Попробуйте через несколько минут.',
    'err_39': 'Слишком много проверок цен у магазинов. Подождите несколько минут и повторите.',
    'err_40': 'На сегодня загружено слишком много файлов документа. Попробуйте завтра или напишите в поддержку.',
    'err_41': 'Сначала завершите или отмените оплаченные заказы в работе — или напишите в поддержку, и мы поможем закрыть их.',
    'err_42': 'Подтвердите удаление аккаунта.',
    'err_43': 'Отметьте, что понимаете: баланс Atlas будет потерян.',
    'err_44': 'Слишком много попыток удаления. Попробуйте через час.',
    'err_50': 'У вашей роли нет доступа к этому действию.',
    'err_51': 'Заблокировать клиента может только администратор.',
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
    'err_34': 'Do‘kondagi narx hozirgina o‘zgardi. Yangi narxni yukladik — jamini tekshirib, tovarni qayta qo‘shing.',
    'err_35': 'Do‘kondagi narx o‘zgardi. Savat qayta hisoblandi — yangi jamini tekshirib, buyurtmani qayta rasmiylashtiring.',
    'err_36': 'Do‘kon tovar ma’lumotlarini o‘zgartirdi: valyuta, variant yoki narx. Belgilangan tovarni ochib, qayta qo‘shing.',
    'err_37': 'Atlas tariflari yangilandi. Savat qayta hisoblandi — yangi jamini tekshirib, buyurtmani qayta rasmiylashtiring.',
    'err_38': 'Do‘kon hozir javob bermayapti, shuning uchun narxni tekshirib bo‘lmadi. Bir necha daqiqadan so‘ng urinib ko‘ring.',
    'err_39': 'Do‘konlarda narx tekshiruvi juda ko‘p bo‘ldi. Bir necha daqiqa kutib, qayta urinib ko‘ring.',
    'err_40': 'Bugun hujjat fayllari juda ko‘p yuklandi. Ertaga urinib ko‘ring yoki qo‘llab-quvvatlashga yozing.',
    'err_41': 'Avval jarayondagi to‘langan buyurtmalarni yakunlang yoki bekor qiling — yoki yordam xizmatiga yozing, ularni yopishga yordam beramiz.',
    'err_42': 'Akkauntni o‘chirishni tasdiqlang.',
    'err_43': 'Atlas balansi yo‘qolishini tushunganingizni belgilang.',
    'err_44': 'O‘chirishga urinishlar juda ko‘p. Bir soatdan so‘ng urinib ko‘ring.',
    'err_50': 'Sizning rolingizda bu amalga ruxsat yo‘q.',
    'err_51': 'Mijozni faqat administrator bloklashi mumkin.',
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
    'err_34': 'The store price just changed. We loaded the new price — check the total and add the item again.',
    'err_35': 'A store price changed. Your cart was recalculated — check the new total and check out again.',
    'err_36': 'The store changed the item’s currency, option or price. Open the marked item and add it again.',
    'err_37': 'Atlas rates were updated. Your cart was recalculated — check the new total and check out again.',
    'err_38': 'The store is not responding, so the price could not be checked. Try again in a few minutes.',
    'err_39': 'Too many price checks with the stores. Wait a few minutes and try again.',
    'err_40': 'Too many document files uploaded today. Try again tomorrow or contact support.',
    'err_41': 'Finish or cancel your paid orders in progress first — or write to support and we will help close them.',
    'err_42': 'Confirm the account deletion.',
    'err_43': 'Tick that you understand the Atlas balance will be lost.',
    'err_44': 'Too many deletion attempts. Try again in an hour.',
    'err_50': 'Your role does not allow this action.',
    'err_51': 'Only an administrator can block a customer.',
  },
};
export function serverError(locale:Locale, key:string){
  return serverErrors[locale][key] ?? {
    ru: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
    uz: 'So‘rovni bajarib bo‘lmadi. Qayta urinib ko‘ring.',
    en: 'The request could not be completed. Please try again.',
  }[locale];
}
