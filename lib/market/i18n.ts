import {withCyrillic,pickLocale} from './uz-cyrl.ts';
/** `oz` is Uzbek in Cyrillic script (html lang uz-Cyrl): its copy is the Uzbek Latin copy transliterated (lib/market/uz-cyrl.ts). */
export type Locale = "ru" | "uz" | "en" | "oz";
export const locales:readonly Locale[] = ["ru", "uz", "oz", "en"];
export function supportedLocale(value:unknown):Locale|null{
  return value === "ru" || value === "uz" || value === "en" || value === "oz" ? value : null;
}
/** Languages people type copy in (admin forms, stored texts); Uzbek Cyrillic is derived from `uz`. */
export type TextLocale = Exclude<Locale, "oz">;
/** True for Uzbek in either script. */
export const isUzbek = (locale:Locale) => locale === "uz" || locale === "oz";

/** Site language when neither a saved choice nor the browser language matches a supported one. */
export const defaultLocale:Locale="uz";

const apiErrors:Record<Locale,Record<number,string>>=/*@__PURE__*/withCyrillic({
  ru:{400:"Проверьте данные и попробуйте снова.",401:"Войдите, чтобы продолжить.",403:"У вас нет доступа к этому действию.",404:"Запрошенные данные не найдены.",405:"Этот способ запроса не поддерживается.",409:"Данные изменились. Обновите страницу и повторите действие.",413:"Запрос слишком большой.",422:"Не удалось обработать данные. Проверьте их и попробуйте снова.",429:"Слишком много запросов. Попробуйте позже.",503:"Не удалось выполнить запрос. Попробуйте ещё раз."},
  uz:{400:"Ma’lumotlarni tekshirib, qayta urinib ko‘ring.",401:"Davom etish uchun tizimga kiring.",403:"Bu amalni bajarish uchun ruxsat yo‘q.",404:"So‘ralgan ma’lumot topilmadi.",405:"Bu so‘rov usuli qo‘llab-quvvatlanmaydi.",409:"Ma’lumotlar o‘zgardi. Sahifani yangilab, qayta urinib ko‘ring.",413:"So‘rov hajmi juda katta.",422:"Ma’lumotlarni qayta ishlab bo‘lmadi. Tekshirib, qayta urinib ko‘ring.",429:"So‘rovlar soni oshib ketdi. Keyinroq urinib ko‘ring.",503:"So‘rov bajarilmadi. Qayta urinib ko‘ring."},
  en:{400:"Check the details and try again.",401:"Sign in to continue.",403:"You don’t have access to this action.",404:"The requested information wasn’t found.",405:"This request method isn’t supported.",409:"The data changed. Refresh the page and try again.",413:"The request is too large.",422:"Couldn’t process the information. Check it and try again.",429:"Too many requests. Try again later.",503:"The request couldn’t be completed. Please try again."},
});

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
    // uz-Cyrl (and uz-Cyrl-UZ) is Uzbek in Cyrillic script: the internal `oz`.
    const full=tag.toLowerCase();
    return {tag:full.startsWith("uz-cyrl")?"oz":full.split("-")[0],quality:Number.isFinite(quality)?quality:0,index};
  }).filter(entry=>entry.quality>0).sort((a,b)=>b.quality-a.quality||a.index-b.index)??[];
  for(const entry of accepted){const locale=supportedLocale(entry.tag);if(locale)return locale;}
  return defaultLocale;
}

/** Request header that middleware.ts sets for `?lang=uz|oz|ru|en` page versions. */
export const pageLocaleHeader="x-atlas-locale";

/** Language a page renders in: an explicit `?lang=` version (passed on by middleware), then the saved choice, the browser language and Uzbek. */
export function renderLocale(requested:string|null|undefined,cookieHeader:string|null|undefined,acceptLanguage:string|null|undefined):Locale{
  return supportedLocale(requested)??preferredLocale(cookieHeader,acceptLanguage);
}

export function apiErrorMessage(status:number,locale:Locale):string{
  return apiErrors[locale][status]??apiErrors[locale][503];
}

export function importManualEntryMessage(locale:Locale):string{
  return pickLocale({
    ru:"Магазин пока не подтвердил все данные. Повторите загрузку позже — для добавления нужны проверенные цена и наличие варианта.",
    uz:"Do‘kon barcha ma’lumotlarni hali tasdiqlamadi. Keyinroq qayta yuklang — qo‘shish uchun variant narxi va mavjudligi tekshirilishi kerak.",
    en:"The store has not confirmed all details yet. Retry later — adding an option requires a verified price and availability.",
  }, locale);
}

/** A link Atlas does not read automatically (manualEntryStoreRoots, a site outside the store list, a browser store
 * whose gateway did not answer): the customer types the details in and confirms them. */
export function importManualStoreMessage(locale:Locale):string{
  return pickLocale({
    ru:"Atlas не получает данные этого товара автоматически. Откройте товар на сайте магазина и впишите название, цену, вариант и доставку сами — оператор Atlas сверит их перед выкупом.",
    uz:"Atlas bu tovar ma’lumotlarini avtomatik olmaydi. Tovarni do‘kon saytida oching va nomi, narxi, varianti va yetkazishni o‘zingiz kiriting — Atlas operatori xariddan oldin ularni solishtiradi.",
    en:"Atlas does not get this item's details automatically. Open the item on the store's site and enter the name, price, option and shipping yourself — an Atlas operator checks them before buying.",
  }, locale);
}

/** A Walmart link whose data a collection service is still gathering; the page retries by itself. */
export function importPendingMessage(locale:Locale):string{
  return pickLocale({
    ru:"Собираем данные товара через сервис магазина — это может занять до нескольких минут. Страница обновится сама.",
    uz:"Mahsulot ma’lumotlari do‘kon xizmati orqali yig‘ilmoqda — bu bir necha daqiqagacha davom etishi mumkin. Sahifa o‘zi yangilanadi.",
    en:"Gathering the product details through the store's data service — this can take up to a few minutes. The page will update by itself.",
  }, locale);
}

/** The language the screen shows once the server returns the account. The account keeps its own language for messages,
 *  which can differ from the one this device shows (cookie, Accept-Language, a choice in the header). It becomes the
 *  screen's only when the customer has just saved it ("Interface and notification language"); every other answer keeps
 *  the screen as it is. Before this, any action (opening checkout, say) switched an English page to the account's Russian. */
export function screenLocale(shown:Locale, account:Locale, savedNow:boolean):Locale{
  return savedNow ? account : shown;
}
export function setLocaleCookie(locale:Locale):void{
  if(typeof document==="undefined")return;
  const secure=window.location.protocol==="https:"?"; Secure":"";
  document.cookie=`atlas-language=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
const copy = /*@__PURE__*/withCyrillic({
  ru: {catalog:"Каталог",link:"Заказ по ссылке",batch:"Импорт списка",orders:"Мои заказы",account:"Кабинет",signin:"Войти",cart:"Корзина",balance:"Баланс",favorites:"Избранное",home:"Главная",terms:"Правила и данные",customs:"Таможня",retry:"Повторить",openSignIn:"Открыть вход",footer:"Atlas · Магазины мира — в одном месте.",contactTitle:"Связаться с Atlas",contactSupport:"Поддержка в личном кабинете"},
  uz: {catalog:"Katalog",link:"Havola orqali buyurtma",batch:"Ro‘yxatni import qilish",orders:"Buyurtmalarim",account:"Kabinet",signin:"Kirish",cart:"Savat",balance:"Balans",favorites:"Saqlanganlar",home:"Bosh sahifa",terms:"Qoidalar va ma’lumotlar",customs:"Bojxona",retry:"Qayta urinish",openSignIn:"Kirishni ochish",footer:"Atlas · Dunyo do‘konlari bir joyda.",contactTitle:"Atlas bilan bog‘lanish",contactSupport:"Shaxsiy kabinetdagi yordam"},
  en: {catalog:"Catalog",link:"Order by link",batch:"Import list",orders:"My orders",account:"Account",signin:"Sign in",cart:"Cart",balance:"Balance",favorites:"Saved",home:"Home",terms:"Terms & privacy",customs:"Customs",retry:"Try again",openSignIn:"Open sign in",footer:"Atlas · The world’s stores, in one place.",contactTitle:"Contact Atlas",contactSupport:"Support in your account"},
});
export function ui(locale:Locale){
  return copy[locale];
}
const orderStatuses = /*@__PURE__*/withCyrillic({
  ru: ["Ожидает выкупа", "Выкуплен", "На зарубежном складе", "Готов к отправке", "В пути", "Доставлен"],
  uz: ["Xarid kutilmoqda", "Xarid qilindi", "Xorijdagi omborda", "Jo‘natishga tayyor", "Yo‘lda", "Yetkazildi"],
  en: ["Awaiting purchase", "Purchased", "At overseas warehouse", "Ready to ship", "In transit", "Delivered"],
});
export function localizedStatuses(locale:Locale){return orderStatuses[locale]}
const routeTitles:Record<Locale,Record<string,string>>=/*@__PURE__*/withCyrillic({
  ru:{catalog:'Каталог',products:'Каталог',favorites:'Избранное',link:'Заказ по ссылке',stores:'Магазины',cart:'Корзина',checkout:'Оформление',orders:'Мои заказы',balance:'Баланс',operations:'Кабинет оператора',notifications:'Уведомления',account:'Личный кабинет',customs:'Таможенные условия',analytics:'Аналитика',legal:'Правила Atlas',identity:'Паспорт',declaration:'Декларация',batch:'Импорт списка',admin:'Администрирование',login:'Вход',notfound:'Страница не найдена',privacy:'Политика конфиденциальности',terms:'Условия использования',support:'Поддержка',app:'Приложение','delete-account':'Удаление аккаунта'},
  uz:{catalog:'Katalog',products:'Katalog',favorites:'Saqlanganlar',link:'Havola orqali buyurtma',stores:'Do‘konlar',cart:'Savat',checkout:'Rasmiylashtirish',orders:'Buyurtmalarim',balance:'Balans',operations:'Operator kabineti',notifications:'Bildirishnomalar',account:'Shaxsiy kabinet',customs:'Bojxona shartlari',analytics:'Tahlil',legal:'Atlas qoidalari',identity:'Pasport',declaration:'Deklaratsiya',batch:'Ro‘yxat importi',admin:'Boshqaruv',login:'Kirish',notfound:'Sahifa topilmadi',privacy:'Maxfiylik siyosati',terms:'Foydalanish shartlari',support:'Yordam',app:'Ilova','delete-account':'Akkauntni o‘chirish'},
  en:{catalog:'Catalog',products:'Catalog',favorites:'Saved',link:'Order by link',stores:'Stores',cart:'Cart',checkout:'Checkout',orders:'My orders',balance:'Balance',operations:'Operator workspace',notifications:'Notifications',account:'Account',customs:'Customs terms',analytics:'Analytics',legal:'Atlas terms',identity:'Passport',declaration:'Declaration',batch:'List import',admin:'Administration',login:'Sign in',notfound:'Page not found',privacy:'Privacy policy',terms:'Terms of use',support:'Support',app:'App','delete-account':'Delete account'},
});
export function routeTitle(locale:Locale,view:string){return routeTitles[locale][view]??view}

export const serverErrors: Record<Locale, Record<string, string>> = /*@__PURE__*/withCyrillic({
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
    'err_10': 'Не удалось выполнить действие: обновите страницу и повторите. Если не помогло — напишите в поддержку.',
    'err_11': 'Профиль временно заблокирован. Обратитесь в поддержку Atlas.',
    'err_12': 'Оформление временно приостановлено до завершения проверки профиля.',
    'err_13': 'Паспорт не найден. Введите данные паспорта заново.',
    'err_14': 'Сначала выберите сохранённого получателя.',
    'err_15': 'Доступно только оператору.',
    'err_16': 'Проверьте данные операции.',
    'err_17': 'Действие с заказом не прошло проверку данных. Обновите страницу и повторите.',
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
    'err_60': 'Укажите адрес доставки.',
    'err_61': 'Укажите почтовый индекс получателя: 6 цифр.',
    'err_62': 'Проверьте цену, вес и количество (от 1 до 10).',
    'err_63': 'Количество — от 1 до 10.',
    'err_64': 'Выберите обязательные услуги перед оформлением.',
    'err_65': 'Сначала сохраните адрес доставки.',
    'err_66': 'Сначала подтвердите паспорт этого получателя.',
    'err_67': 'Для проверки не хватает ссылки, цены или валюты товара.',
    'err_68': 'Магазин изменил валюту витрины. Загрузите товар заново.',
    'err_69': 'Выбранный вариант не удалось сверить с данными магазина. Загрузите товар заново.',
    // err_70/err_71 stay word for word the messages lib/importer/verify.ts stores on a cart line (tests/audit-error-codes.test.mjs).
    'err_70': 'Магазин не подтвердил цену выбранного варианта. Выберите другой цвет или размер либо вставьте ссылку заново.',
    'err_71': 'Этого варианта сейчас нет в наличии у магазина. Выберите другой цвет или размер.',
    'err_72': 'Этого магазина нет в списке поддерживаемых. Вставьте ссылку из одного из {count} магазинов или заполните товар вручную.',
    'err_73': 'Товар не найден в каталоге. Добавьте его по ссылке на магазин.',
    'err_74': 'Выберите товары для оформления.',
    'err_75': 'Расчёт истёк. Обновите его перед оформлением.',
    'err_76': 'Тарифы Atlas обновились. Проверьте новый итог перед оформлением.',
    'err_77': 'Пошлина пересчитана для выбранного получателя. Проверьте итог перед оформлением.',
    'err_78': 'Пока доставляем только по Ташкенту. Укажите адрес в Ташкенте.',
    'err_79': 'Сканы и фото паспорта больше не принимаем. Введите серию, номер и ПИНФЛ текстом.',
    'err_80': 'Проверьте получателя: имя, телефон, регион, город и адрес не короче 5 символов. Исправьте его в кабинете и повторите.',
    // Telegram order notices (POST /api/actions telegram-notify).
    'err_81': 'Сначала привяжите Telegram к кабинету.',
    'err_82': 'Бот пока не может вам написать: откройте его в Telegram и нажмите «Start».',
    'err_83': 'Telegram сейчас не отвечает. Повторите через минуту.',
    'err_84': 'Уведомления в Telegram пока недоступны.',
    'err_85': 'Вернуть товар уже нельзя. Добавьте его снова со страницы товара.',
    // Promo codes (redesign stage 6, lib/market/promo.ts).
    'err_86': 'Такого промокода нет или он выключен. Проверьте написание.',
    'err_87': 'Срок действия промокода закончился или ещё не начался.',
    'err_88': 'Промокод уже использован максимальное число раз.',
    'err_89': 'Сумма заказа меньше той, с которой действует промокод.',
    'err_90': 'Скидка по промокоду пересчитана. Проверьте итог и нажмите «Оплатить» ещё раз.',
    'err_91': 'Промокоды пока недоступны: примените миграцию базы 0017.',
    'err_92': 'Проверьте промокод: 3–30 латинских букв или цифр, процент от 1 до 100 или сумма в сумах, конец срока позже начала.',
    'err_93': 'Промокод с таким текстом уже есть. Придумайте другой.',
    'err_55': 'Нельзя отключить собственный доступ.',
    'err_56': 'Основного администратора из настроек хостинга отключить нельзя.',
    'err_57': 'Заметки о клиентах пока недоступны: примените миграцию базы 0011.',
    'err_52': 'Контент сайта изменён в другой вкладке. Загружена актуальная версия — проверьте поля и сохраните снова.',
    'err_53': 'В контенте сайта есть ошибки. Исправьте отмеченные поля и сохраните снова.',
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
    'err_10': 'Amalni bajarib bo‘lmadi: sahifani yangilab, qayta urining. Yordam bermasa — qo‘llab-quvvatlashga yozing.',
    'err_11': 'Profil vaqtincha bloklangan. Atlas yordam xizmatiga murojaat qiling.',
    'err_12': 'Rasmiylashtirish profil tekshiruvi tugaguncha vaqtincha to‘xtatildi.',
    'err_13': 'Pasport topilmadi. Pasport ma’lumotlarini qayta kiriting.',
    'err_14': 'Avval saqlangan qabul qiluvchini tanlang.',
    'err_15': 'Faqat operator uchun mavjud.',
    'err_16': 'Amaliyot ma’lumotlarini tekshiring.',
    'err_17': 'Buyurtma bilan amal ma’lumotlari tekshiruvdan o‘tmadi. Sahifani yangilab, qayta urining.',
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
    'err_60': 'Yetkazib berish manzilini kiriting.',
    'err_61': 'Qabul qiluvchining pochta indeksini kiriting: 6 ta raqam.',
    'err_62': 'Narx, vazn va miqdorni tekshiring (1 dan 10 gacha).',
    'err_63': 'Miqdor — 1 dan 10 gacha.',
    'err_64': 'Rasmiylashtirishdan oldin majburiy xizmatlarni tanlang.',
    'err_65': 'Avval yetkazib berish manzilini saqlang.',
    'err_66': 'Avval ushbu qabul qiluvchining pasportini tasdiqlang.',
    'err_67': 'Tekshirish uchun tovar havolasi, narxi yoki valyutasi yetishmayapti.',
    'err_68': 'Do‘kon vitrina valyutasini o‘zgartirdi. Tovarni qayta yuklang.',
    'err_69': 'Tanlangan variantni do‘kon ma’lumotlari bilan solishtirib bo‘lmadi. Tovarni qayta yuklang.',
    'err_70': 'Do‘kon bu variant narxini tasdiqlamadi. Boshqa rang yoki o‘lchamni tanlang yoki havolani qayta kiriting.',
    'err_71': 'Bu variant hozir do‘konda yo‘q. Boshqa rang yoki o‘lchamni tanlang.',
    'err_72': 'Bu do‘kon qo‘llab-quvvatlanadiganlar ro‘yxatida yo‘q. {count} ta do‘kondan biridagi havolani qo‘ying yoki tovarni qo‘lda to‘ldiring.',
    'err_73': 'Tovar katalogda topilmadi. Uni do‘kon havolasi orqali qo‘shing.',
    'err_74': 'Rasmiylashtirish uchun tovarlarni tanlang.',
    'err_75': 'Hisob-kitob muddati tugadi. Rasmiylashtirishdan oldin uni yangilang.',
    'err_76': 'Atlas tariflari yangilandi. Rasmiylashtirishdan oldin yangi jami summani tekshiring.',
    'err_77': 'Tanlangan qabul qiluvchi uchun boj qayta hisoblandi. Rasmiylashtirishdan oldin jami summani tekshiring.',
    'err_78': 'Hozircha faqat Toshkent bo‘ylab yetkazamiz. Toshkentdagi manzilni kiriting.',
    'err_79': 'Pasport skanlari va suratlari endi qabul qilinmaydi. Seriya, raqam va JSHSHIRni matn bilan kiriting.',
    'err_80': 'Qabul qiluvchini tekshiring: ism, telefon, viloyat, shahar va kamida 5 belgili manzil. Uni kabinetda tuzatib, qayta urinib ko‘ring.',
    'err_81': 'Avval Telegramni kabinetga bog‘lang.',
    'err_82': 'Bot hozircha sizga yoza olmaydi: uni Telegramda oching va «Start»ni bosing.',
    'err_83': 'Telegram hozir javob bermayapti. Bir daqiqadan so‘ng qayta urining.',
    'err_84': 'Telegramdagi bildirishnomalar hozircha mavjud emas.',
    'err_85': 'Tovarni endi qaytarib bo‘lmaydi. Uni tovar sahifasidan qayta qo‘shing.',
    'err_86': 'Bunday promokod yo‘q yoki u o‘chirilgan. Yozilishini tekshiring.',
    'err_87': 'Promokodning amal qilish muddati tugagan yoki hali boshlanmagan.',
    'err_88': 'Promokod ruxsat etilgan marta ishlatib bo‘lingan.',
    'err_89': 'Buyurtma summasi promokod amal qiladigan summadan kam.',
    'err_90': 'Promokod chegirmasi qayta hisoblandi. Jamini tekshirib, «To‘lash»ni yana bosing.',
    'err_91': 'Promokodlar hozircha mavjud emas: 0017 migratsiyasini qo‘llang.',
    'err_92': 'Promokodni tekshiring: 3–30 lotin harfi yoki raqam, 1 dan 100 gacha foiz yoki so‘mdagi summa, tugash sanasi boshlanishdan keyin.',
    'err_93': 'Bunday matnli promokod allaqachon bor. Boshqasini o‘ylab toping.',
    'err_55': 'O‘z ruxsatingizni o‘chirib bo‘lmaydi.',
    'err_56': 'Hosting sozlamalaridagi asosiy administratorni o‘chirib bo‘lmaydi.',
    'err_57': 'Mijozlar haqidagi eslatmalar hozircha mavjud emas: 0011 migratsiyasini qo‘llang.',
    'err_52': 'Sayt kontenti boshqa oynada o‘zgartirilgan. Joriy versiya yuklandi — maydonlarni tekshirib, qayta saqlang.',
    'err_53': 'Sayt kontentida xatolar bor. Belgilangan maydonlarni tuzatib, qayta saqlang.',
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
    'err_10': 'Couldn’t complete the action: refresh the page and try again. If it keeps failing, contact support.',
    'err_11': 'Profile temporarily blocked. Contact Atlas support.',
    'err_12': 'Checkout temporarily suspended until profile verification is complete.',
    'err_13': 'Passport not found. Enter the passport details again.',
    'err_14': 'First, select a saved recipient.',
    'err_15': 'Available to operator only.',
    'err_16': 'Check operation data.',
    'err_17': 'The order action didn’t pass the data check. Refresh the page and try again.',
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
    'err_60': 'Enter the delivery address.',
    'err_61': 'Enter the recipient’s postal code: 6 digits.',
    'err_62': 'Check the price, weight and quantity (from 1 to 10).',
    'err_63': 'The quantity must be from 1 to 10.',
    'err_64': 'Choose the required services before checking out.',
    'err_65': 'Save the delivery address first.',
    'err_66': 'Confirm this recipient’s passport first.',
    'err_67': 'The item’s link, price or currency is missing, so it can’t be checked.',
    'err_68': 'The store changed its currency. Load the item again.',
    'err_69': 'The selected option couldn’t be matched with the store’s data. Reload the item.',
    'err_70': 'The store didn’t confirm this option’s price. Pick another color or size, or paste the link again.',
    'err_71': 'This option is out of stock at the store. Choose another color or size.',
    'err_72': 'This store isn’t on the supported list. Paste a link from one of the {count} stores or fill in the item manually.',
    'err_73': 'Item not found in the catalog. Add it with a link to the store.',
    'err_74': 'Select the items to check out.',
    'err_75': 'The quote has expired. Refresh it before checking out.',
    'err_76': 'Atlas rates have been updated. Check the new total before checking out.',
    'err_77': 'The duty was recalculated for the selected recipient. Check the total before checking out.',
    'err_78': 'For now we deliver only within Tashkent. Enter an address in Tashkent.',
    'err_79': 'Passport scans and photos are no longer accepted. Type the series, number and PINFL instead.',
    'err_80': 'Check the recipient: name, phone, region, city and an address of at least 5 characters. Fix it in your account and try again.',
    'err_81': 'Attach Telegram to your account first.',
    'err_82': 'The bot can’t message you yet: open it in Telegram and tap “Start”.',
    'err_83': 'Telegram isn’t responding right now. Try again in a minute.',
    'err_84': 'Telegram notifications aren’t available yet.',
    'err_85': 'The item can no longer be restored. Add it again from its page.',
    'err_86': 'There is no such promo code, or it is switched off. Check the spelling.',
    'err_87': 'The promo code has expired or is not valid yet.',
    'err_88': 'The promo code has been used the maximum number of times.',
    'err_89': 'The order is below the amount this promo code starts from.',
    'err_90': 'The promo discount was recalculated. Check the total and press “Pay” again.',
    'err_91': 'Promo codes are not available yet: apply database migration 0017.',
    'err_92': 'Check the promo code: 3–30 Latin letters or digits, a percent from 1 to 100 or an amount in soum, and an end after the start.',
    'err_93': 'A promo code with this text already exists. Choose another one.',
    'err_55': 'You cannot disable your own access.',
    'err_56': 'The primary administrator from the hosting settings cannot be disabled.',
    'err_57': 'Customer notes are not available yet: apply database migration 0011.',
    'err_52': 'The site content was changed in another tab. The current version is loaded — check the fields and save again.',
    'err_53': 'The site content has errors. Fix the marked fields and save again.',
  },
});
/**
 * Refusals whose cause is newer data on the server than on screen: the quote ran out (err_75), the tariff changed
 * (err_76), the duty for the recipient is another (err_77). The client reloads the account after them, so the cart
 * and the tariff it shows are the ones the next attempt is checked against.
 */
export const reloadAfterErrorCodes: readonly string[] = ['err_75', 'err_76', 'err_77', 'err_90'];
/** The localized text of an error code; `{name}` placeholders take the given values. */
export function serverError(locale:Locale, key:string, params?:Record<string,string|number>){
  const text = serverErrors[locale][key] ?? pickLocale({
    ru: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
    uz: 'So‘rovni bajarib bo‘lmadi. Qayta urinib ko‘ring.',
    en: 'The request could not be completed. Please try again.',
  }, locale);
  return params ? text.replace(/\{(\w+)\}/g, (match, name:string) => name in params ? String(params[name]) : match) : text;
}

/** Header, bottom bar and profile menu words (app/marketplace.tsx, app/profile-menu.tsx). `byLink` is the old short tab name,
 *  kept for the footer and tests; the bottom bar's centre button says `link`. */
export type NavCopy = { catalog: string; byLink: string; stores: string; how: string; tariffs: string; orders: string; signin: string; account: string; language: string; help: string;
  link: string; buyByLink: string; delivery: string; profile: string; profileMenu: string; search: string; searchPlaceholder: string; searchShort: string;
  balance: string; notifications: string; favorites: string; documents: string; theme: string; signOut: string; needsAction: string };
/** Header navigation words, kept here (loaded on every page) rather than in the home page copy, which uses them as `nav`. */
export const navCopy: Record<Locale, NavCopy> = /*@__PURE__*/withCyrillic({
  ru: { catalog: 'Каталог', byLink: 'По ссылке', stores: 'Магазины', how: 'Как это работает', tariffs: 'Тарифы', orders: 'Мои заказы', signin: 'Войти', account: 'Кабинет', language: 'Язык сайта', help: 'Помощь',
    link: 'Ссылка', buyByLink: 'Купить по ссылке', delivery: 'Доставка', profile: 'Профиль', profileMenu: 'Меню профиля', search: 'Поиск', searchPlaceholder: 'Товар или ссылка', searchShort: 'Найти',
    balance: 'Баланс', notifications: 'Уведомления', favorites: 'Избранное', documents: 'Документы', theme: 'Тема', signOut: 'Выйти', needsAction: 'заказ ждёт вашего действия' },
  uz: { catalog: 'Katalog', byLink: 'Havola', stores: 'Do‘konlar', how: 'Qanday ishlaydi', tariffs: 'Tariflar', orders: 'Buyurtmalarim', signin: 'Kirish', account: 'Kabinet', language: 'Sayt tili', help: 'Yordam',
    link: 'Havola', buyByLink: 'Havola orqali xarid', delivery: 'Yetkazib berish', profile: 'Profil', profileMenu: 'Profil menyusi', search: 'Qidiruv', searchPlaceholder: 'Tovar yoki havola', searchShort: 'Topish',
    balance: 'Balans', notifications: 'Bildirishnomalar', favorites: 'Saqlanganlar', documents: 'Hujjatlar', theme: 'Mavzu', signOut: 'Chiqish', needsAction: 'buyurtma harakatingizni kutmoqda' },
  en: { catalog: 'Catalog', byLink: 'By link', stores: 'Stores', how: 'How it works', tariffs: 'Rates', orders: 'My orders', signin: 'Sign in', account: 'Account', language: 'Site language', help: 'Help',
    link: 'Link', buyByLink: 'Buy by link', delivery: 'Delivery', profile: 'Profile', profileMenu: 'Profile menu', search: 'Search', searchPlaceholder: 'Item or link', searchShort: 'Find',
    balance: 'Balance', notifications: 'Notifications', favorites: 'Saved', documents: 'Documents', theme: 'Theme', signOut: 'Sign out', needsAction: 'an order needs your action' },
});

export type FooterCopy = { tagline: string; buyers: string; contacts: string; legal: string; support: string; rules: string; privacy: string; customs: string; faq: string; telegramSupport: string; telegramChannel: string; phone: string; instagram: string; email: string; hours: string; pickup: string; theme: string; inn: string };
/** Footer words (every page), apart from the home page copy, which uses them as `footer` and `trust.inn`. */
export const footerCopy: Record<Locale, FooterCopy> = /*@__PURE__*/withCyrillic({
  ru: {
      tagline: 'Покупки в зарубежных магазинах с доставкой в Ташкент.', buyers: 'Покупателям', contacts: 'Контакты', legal: 'Юридическая информация',
      support: 'Поддержка в личном кабинете', rules: 'Все документы', privacy: 'Политика данных', customs: 'Таможня', faq: 'Частые вопросы',
      telegramSupport: 'Telegram-бот', telegramChannel: 'Telegram-канал', phone: 'Телефон', instagram: 'Instagram', email: 'Почта', hours: 'Часы работы', pickup: 'Пункт выдачи', theme: 'Тема',
      inn: 'ИНН',
  },
  uz: {
      tagline: 'Xorijiy do‘konlardan Toshkentga yetkazib berish bilan xaridlar.', buyers: 'Xaridorlarga', contacts: 'Bog‘lanish', legal: 'Yuridik ma’lumotlar',
      support: 'Shaxsiy kabinetdagi yordam', rules: 'Barcha hujjatlar', privacy: 'Ma’lumotlar siyosati', customs: 'Bojxona', faq: 'Savollar',
      telegramSupport: 'Telegram-bot', telegramChannel: 'Telegram-kanal', phone: 'Telefon', instagram: 'Instagram', email: 'Pochta', hours: 'Ish vaqti', pickup: 'Topshirish punkti', theme: 'Mavzu',
      inn: 'STIR',
  },
  en: {
      tagline: 'Shopping in international stores with delivery to Tashkent.', buyers: 'For shoppers', contacts: 'Contacts', legal: 'Legal information',
      support: 'Support in your account', rules: 'All documents', privacy: 'Privacy policy', customs: 'Customs', faq: 'FAQ',
      telegramSupport: 'Telegram bot', telegramChannel: 'Telegram channel', phone: 'Phone', instagram: 'Instagram', email: 'Email', hours: 'Working hours', pickup: 'Pickup point', theme: 'Theme',
      inn: 'Tax ID (INN)',
  },
});
