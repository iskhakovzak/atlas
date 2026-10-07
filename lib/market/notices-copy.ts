import type { Locale } from './i18n.ts';
import {withCyrillic,uzText} from './uz-cyrl.ts';
import {isUzbek} from './i18n.ts';

// The notifications panel sits in the header of every page, so its words live apart from the account copy
// (customer-copy.ts re-exports them) and the header does not load every account text.
function ruPlural(count: number, one: string, few: string, many: string) {
  const tail = count % 100, last = count % 10;
  if (tail >= 11 && tail <= 14) return many;
  return last === 1 ? one : last >= 2 && last <= 4 ? few : many;
}

/** "3 товара" / "3 ta tovar" / "3 items". */

export const uzMonths = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** Short date with time, year only when it is not the current one: "3 октября, 14:05" / "3-oktabr, 14:05". */
export function formatDateTime(timestamp: number, locale: Locale, now = Date.now()) {
  const date = new Date(timestamp), sameYear = date.getFullYear() === new Date(now).getFullYear();
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (isUzbek(locale)) return uzText(locale, `${date.getDate()}-${uzMonths[date.getMonth()]}${sameYear ? '' : ` ${date.getFullYear()}-yil`}, ${time}`);
  const day = date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
  return `${day}, ${time}`;
}

export type NoticesCopy = {
  title: string;
  unread: (count: number) => string;
  allRead: string;
  readAll: string;
  filtersLabel: string;
  filters: { all: string; unread: string; orders: string };
  newBadge: string;
  more: (count: number) => string;
  openOrder: string;
  emptyTitle: string;
  emptyText: string;
  emptyFilter: string;
  orders: string;
  settings: string;
  signin: { title: string; text: string; action: string };
  loading: string;
};

export const noticesCopy: Record<Locale, NoticesCopy> = /*@__PURE__*/withCyrillic({
  ru: {
    title: 'Уведомления', unread: count => `${count} ${ruPlural(count, 'непрочитанное', 'непрочитанных', 'непрочитанных')}`, allRead: 'Всё прочитано',
    readAll: 'Отметить все прочитанными', filtersLabel: 'Показать', filters: { all: 'Все', unread: 'Непрочитанные', orders: 'По заказам' }, newBadge: 'Новое',
    more: count => `Ещё ${count} ${ruPlural(count, 'обновление', 'обновления', 'обновлений')}`, openOrder: 'Открыть заказ',
    emptyTitle: 'Пока всё спокойно', emptyText: 'Здесь появятся изменения статусов, возвраты и вопросы по вашим заказам.', emptyFilter: 'Таких уведомлений нет.',
    orders: 'Мои заказы', settings: 'Настройки email и SMS',
    signin: { title: 'Войдите, чтобы открыть уведомления', text: 'Сообщения Atlas хранятся в вашем профиле.', action: 'Войти' }, loading: 'Загружаем уведомления…',
  },
  uz: {
    title: 'Bildirishnomalar', unread: count => `${count} ta o‘qilmagan`, allRead: 'Hammasi o‘qilgan',
    readAll: 'Hammasini o‘qilgan deb belgilash', filtersLabel: 'Ko‘rsatish', filters: { all: 'Barchasi', unread: 'O‘qilmagan', orders: 'Buyurtmalar bo‘yicha' }, newBadge: 'Yangi',
    more: count => `Yana ${count} ta yangilanish`, openOrder: 'Buyurtmani ochish',
    emptyTitle: 'Hozircha hammasi tinch', emptyText: 'Holat o‘zgarishlari, qaytarishlar va buyurtmalaringiz bo‘yicha savollar shu yerda ko‘rinadi.', emptyFilter: 'Bunday bildirishnomalar yo‘q.',
    orders: 'Buyurtmalarim', settings: 'Email va SMS sozlamalari',
    signin: { title: 'Bildirishnomalarni ochish uchun kiring', text: 'Atlas xabarlari profilingizda saqlanadi.', action: 'Kirish' }, loading: 'Bildirishnomalar yuklanmoqda…',
  },
  en: {
    title: 'Notifications', unread: count => `${count} unread`, allRead: 'All caught up',
    readAll: 'Mark all as read', filtersLabel: 'Show', filters: { all: 'All', unread: 'Unread', orders: 'Orders' }, newBadge: 'New',
    more: count => `${count} more ${count === 1 ? 'update' : 'updates'}`, openOrder: 'Open order',
    emptyTitle: 'All quiet for now', emptyText: 'Status changes, refunds and questions about your orders will appear here.', emptyFilter: 'No matching notifications.',
    orders: 'My orders', settings: 'Email and SMS settings',
    signin: { title: 'Sign in to open notifications', text: 'Atlas messages are saved in your profile.', action: 'Sign in' }, loading: 'Loading notifications…',
  },
});
