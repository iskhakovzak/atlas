export type Locale = "ru" | "uz" | "en";
const copy = {
  ru: {catalog:"Каталог",link:"Заказ по ссылке",batch:"Импорт списка",orders:"Мои заказы",account:"Кабинет",signin:"Войти",cart:"Корзина",balance:"Баланс",footer:"Предрелизная версия. Реальных списаний и отправок нет."},
  uz: {catalog:"Katalog",link:"Havola orqali buyurtma",batch:"Ro‘yxatni import qilish",orders:"Buyurtmalarim",account:"Kabinet",signin:"Kirish",cart:"Savat",balance:"Balans",footer:"Relizdan oldingi versiya. Haqiqiy to‘lov va jo‘natish yo‘q."},
  en: {catalog:"Catalog",link:"Order by link",batch:"Import list",orders:"My orders",account:"Account",signin:"Sign in",cart:"Cart",balance:"Balance",footer:"Pre-release version. No real charges or shipments."},
};
export function ui(locale:Locale){return copy[locale]}
