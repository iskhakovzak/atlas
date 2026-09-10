export type Locale = "ru" | "uz" | "en";
const copy = {
  ru: {catalog:"Каталог",link:"Заказ по ссылке",batch:"Импорт списка",orders:"Мои заказы",account:"Кабинет",signin:"Войти",cart:"Корзина",balance:"Баланс",footer:"Atlas · Магазины мира — в одном месте."},
  uz: {catalog:"Katalog",link:"Havola orqali buyurtma",batch:"Ro‘yxatni import qilish",orders:"Buyurtmalarim",account:"Kabinet",signin:"Kirish",cart:"Savat",balance:"Balans",footer:"Atlas · Dunyo do‘konlari bir joyda."},
  en: {catalog:"Catalog",link:"Order by link",batch:"Import list",orders:"My orders",account:"Account",signin:"Sign in",cart:"Cart",balance:"Balance",footer:"Atlas · The world’s stores, in one place."},
};
export function ui(locale:Locale){return copy[locale]}
