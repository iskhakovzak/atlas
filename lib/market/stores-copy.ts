import type { Locale } from './i18n.ts';
import type { StoreRegion } from './store-brands.ts';

function ruPlural(count: number, [one, few, many]: [string, string, string]) {
  const tens = count % 100, units = count % 10;
  if (tens >= 11 && tens <= 14) return many;
  return units === 1 ? one : units >= 2 && units <= 4 ? few : many;
}

const ru = {
  overline: 'Магазины',
  title: (count: number) => `${count} ${ruPlural(count, ['магазин', 'магазина', 'магазинов'])} мира в одном месте`,
  intro: 'Найдите товар в любом из них и вставьте ссылку в Atlas — посчитаем итог в сумах с доставкой до Узбекистана.',
  steps: [['Откройте магазин', 'Нажмите на него ниже — сайт откроется в новой вкладке.'], ['Скопируйте ссылку', 'На iPhone: «Поделиться» → «Скопировать». На компьютере — из адресной строки.'], ['Вставьте в Atlas', 'Покажем цену, сервис и доставку отдельными строками.']] as [string, string][],
  pasteLabel: 'Ссылка на товар', pastePlaceholder: 'Вставьте ссылку на товар', calculate: 'Рассчитать', paste: 'Вставить из буфера',
  popular: 'Популярные', directory: 'Все магазины', search: 'Найти магазин или бренд', clear: 'Очистить',
  all: 'Все', regionLabel: 'Где покупать', regions: { us: 'США', eu: 'Европа', asia: 'Азия', other: 'Другие страны' } as Record<StoreRegion, string>,
  count: (count: number) => `${count} ${ruPlural(count, ['магазин', 'магазина', 'магазинов'])}`,
  countries: (count: number) => `${count} ${ruPlural(count, ['страна', 'страны', 'стран'])}`,
  more: (count: number) => `+${count}`,
  noResults: 'Такого магазина нет в списке. Попробуйте другое название или домен — либо просто вставьте ссылку на товар: если магазин поддерживается, расчёт откроется.',
  open: (domain: string) => `Открыть ${domain}`, storefronts: 'Витрины по странам', inCatalog: (count: number) => `${count} ${ruPlural(count, ['товар', 'товара', 'товаров'])} в каталоге Atlas`,
  viewCatalog: 'Смотреть', howTitle: 'Как заказать', close: 'Закрыть', newTab: 'откроется в новой вкладке',
  note: 'Список означает, что домен разрешён для заказа по ссылке через Atlas. Он не гарантирует доступность каждой страницы, наличие или цену. Логотипы принадлежат их владельцам; Atlas не является официальным представителем магазинов.',
};
type Copy = typeof ru;

const uz: Copy = {
  overline: 'Do‘konlar',
  title: (count: number) => `Dunyoning ${count} ta do‘koni bir joyda`,
  intro: 'Istalgan do‘kondan tovar toping va havolasini Atlasga qo‘ying — O‘zbekistongacha yetkazish bilan yakuniy narxni so‘mda hisoblaymiz.',
  steps: [['Do‘konni oching', 'Quyida bosing — sayt yangi oynada ochiladi.'], ['Havolani nusxalang', 'iPhone’da: «Ulashish» → «Nusxalash». Kompyuterda — manzil satridan.'], ['Atlasga qo‘ying', 'Narx, xizmat va yetkazishni alohida satrlarda ko‘rsatamiz.']],
  pasteLabel: 'Tovar havolasi', pastePlaceholder: 'Tovar havolasini qo‘ying', calculate: 'Hisoblash', paste: 'Buferdan qo‘yish',
  popular: 'Mashhur', directory: 'Barcha do‘konlar', search: 'Do‘kon yoki brendni toping', clear: 'Tozalash',
  all: 'Barchasi', regionLabel: 'Qayerdan xarid qilish', regions: { us: 'AQSh', eu: 'Yevropa', asia: 'Osiyo', other: 'Boshqa mamlakatlar' },
  count: (count: number) => `${count} ta do‘kon`,
  countries: (count: number) => `${count} ta mamlakat`,
  more: (count: number) => `+${count}`,
  noResults: 'Bunday do‘kon ro‘yxatda yo‘q. Boshqa nom yoki domenni sinab ko‘ring — yoki tovar havolasini qo‘ying: do‘kon qo‘llab-quvvatlansa, hisob ochiladi.',
  open: (domain: string) => `${domain} saytini ochish`, storefronts: 'Mamlakatlar bo‘yicha vitrinalar', inCatalog: (count: number) => `Atlas katalogida ${count} ta tovar`,
  viewCatalog: 'Ko‘rish', howTitle: 'Qanday buyurtma berish', close: 'Yopish', newTab: 'yangi oynada ochiladi',
  note: 'Ro‘yxat ushbu domendan Atlas orqali havola bo‘yicha buyurtma berish mumkinligini bildiradi. Har bir sahifa, mavjudlik yoki narx kafolatlanmaydi. Logotiplar egalariga tegishli; Atlas do‘konlarning rasmiy vakili emas.',
};

const en: Copy = {
  overline: 'Stores',
  title: (count: number) => `${count} stores from around the world in one place`,
  intro: 'Find a product in any of them and paste its link into Atlas — we’ll show the total in soum with delivery to Uzbekistan.',
  steps: [['Open a store', 'Tap it below — the site opens in a new tab.'], ['Copy the link', 'On iPhone: Share → Copy. On a computer: from the address bar.'], ['Paste it into Atlas', 'We show price, service and delivery on separate lines.']],
  pasteLabel: 'Product link', pastePlaceholder: 'Paste a product link', calculate: 'Calculate', paste: 'Paste from clipboard',
  popular: 'Popular', directory: 'All stores', search: 'Find a store or brand', clear: 'Clear',
  all: 'All', regionLabel: 'Where to shop', regions: { us: 'USA', eu: 'Europe', asia: 'Asia', other: 'Other countries' },
  count: (count: number) => `${count} ${count === 1 ? 'store' : 'stores'}`,
  countries: (count: number) => `${count} ${count === 1 ? 'country' : 'countries'}`,
  more: (count: number) => `+${count}`,
  noResults: 'This store isn’t on the list. Try another name or domain — or just paste a product link: if the store is supported, the estimate opens.',
  open: (domain: string) => `Open ${domain}`, storefronts: 'Storefronts by country', inCatalog: (count: number) => `${count} ${count === 1 ? 'product' : 'products'} in the Atlas catalog`,
  viewCatalog: 'View', howTitle: 'How to order', close: 'Close', newTab: 'opens in a new tab',
  note: 'A listed store means its domain is allowed for link orders through Atlas. It does not guarantee every page, stock or price. Logos belong to their owners; Atlas is not an official representative of these stores.',
};

export const storesCopy: Record<Locale, Copy> = { ru, uz, en };
