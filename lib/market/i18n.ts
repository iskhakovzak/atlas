export type Locale = "ru" | "uz" | "en";
export function supportedLocale(value:unknown):Locale|null{
  return value === "ru" || value === "uz" || value === "en" ? value : null;
}
const copy = {
  ru: {catalog:"Каталог",link:"Заказ по ссылке",batch:"Импорт списка",orders:"Мои заказы",account:"Кабинет",signin:"Войти",cart:"Корзина",balance:"Баланс",favorites:"Избранное",home:"Главная",terms:"Правила и данные",customs:"Таможня",retry:"Повторить",openSignIn:"Открыть вход",footer:"Atlas · Магазины мира — в одном месте."},
  uz: {catalog:"Katalog",link:"Havola orqali buyurtma",batch:"Ro‘yxatni import qilish",orders:"Buyurtmalarim",account:"Kabinet",signin:"Kirish",cart:"Savat",balance:"Balans",favorites:"Saqlanganlar",home:"Bosh sahifa",terms:"Qoidalar va ma’lumotlar",customs:"Bojxona",retry:"Qayta urinish",openSignIn:"Kirishni ochish",footer:"Atlas · Dunyo do‘konlari bir joyda."},
  en: {catalog:"Catalog",link:"Order by link",batch:"Import list",orders:"My orders",account:"Account",signin:"Sign in",cart:"Cart",balance:"Balance",favorites:"Saved",home:"Home",terms:"Terms & privacy",customs:"Customs",retry:"Try again",openSignIn:"Open sign in",footer:"Atlas · The world’s stores, in one place."},
};
export function ui(locale:Locale){return copy[locale]}
const orderStatuses = {
  ru: ["Ожидает выкупа", "Выкуплен", "На зарубежном складе", "Готов к отправке", "В пути", "Доставлен"],
  uz: ["Xarid kutilmoqda", "Xarid qilindi", "Xorijdagi omborda", "Jo‘natishga tayyor", "Yo‘lda", "Yetkazildi"],
  en: ["Awaiting purchase", "Purchased", "At overseas warehouse", "Ready to ship", "In transit", "Delivered"],
};
export function localizedStatuses(locale:Locale){return orderStatuses[locale]}
const routeTitles:Record<Locale,Record<string,string>>={
  ru:{catalog:'Каталог',favorites:'Избранное',link:'Заказ по ссылке',cart:'Корзина',orders:'Мои заказы',balance:'Баланс',operations:'Кабинет оператора',notifications:'Уведомления',account:'Личный кабинет',customs:'Таможенные условия',analytics:'Аналитика',legal:'Правила Atlas',identity:'Паспорт',declaration:'Декларация',batch:'Импорт списка',admin:'Администрирование'},
  uz:{catalog:'Katalog',favorites:'Saqlanganlar',link:'Havola orqali buyurtma',cart:'Savat',orders:'Buyurtmalarim',balance:'Balans',operations:'Operator kabineti',notifications:'Bildirishnomalar',account:'Shaxsiy kabinet',customs:'Bojxona shartlari',analytics:'Tahlil',legal:'Atlas qoidalari',identity:'Pasport',declaration:'Deklaratsiya',batch:'Ro‘yxat importi',admin:'Boshqaruv'},
  en:{catalog:'Catalog',favorites:'Saved',link:'Order by link',cart:'Cart',orders:'My orders',balance:'Balance',operations:'Operator workspace',notifications:'Notifications',account:'Account',customs:'Customs terms',analytics:'Analytics',legal:'Atlas terms',identity:'Passport',declaration:'Declaration',batch:'List import',admin:'Administration'},
};
export function routeTitle(locale:Locale,view:string){return routeTitles[locale][view]??view}

