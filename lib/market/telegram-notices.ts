import type { Notification, Order } from './domain.ts';
import type { Locale } from './i18n.ts';
import { renderNotification } from './history-copy.ts';
import { noticeTarget, reasonCodes } from './notice-panel.ts';
import { noticesCopy } from './notices-copy.ts';
import { withCyrillic } from './uz-cyrl.ts';
import { telegramSilent } from './telegram-state.ts';

// Order notices in Telegram: the bot's words and the message built from the account's new notices.
// The words hold no HTML: Uzbek Cyrillic is transliterated from the Latin copy and would turn <b> into <б>.
// Only what the bell already says goes out — title, text, the product's name and the order number;
// never a passport, an address, a recipient or a phone.

export const telegramCopy = /*@__PURE__*/withCyrillic({
  ru: {
    welcomeTitle: 'Уведомления Atlas включены',
    welcome: 'Сюда будут приходить новости о ваших заказах: статус, вес посылки, трек-номер, доплаты, вопросы, где нужно ваше решение, и ответы поддержки.\n\nAtlas никогда не просит в Telegram данные карты, коды из SMS или пароли.\n\nВыключить — /stop или в кабинете на сайте.',
    stopped: '🔕 Уведомления о заказах выключены. Включить снова можно в кабинете на сайте.',
    alreadyOff: 'Уведомления о заказах уже выключены.',
    stopFailed: 'Не получилось выключить уведомления. Отправьте /stop ещё раз через минуту.',
    notifyStart: 'Чтобы получать сюда уведомления о заказах, включите их в кабинете Atlas.',
    notifyFailed: 'Не получилось включить уведомления. Отправьте /start ещё раз через минуту.',
    openSettings: 'Открыть настройки',
    autoReply: 'Этот бот только присылает уведомления и не читает ответы. Вопрос по заказу — напишите в поддержку.',
    contactSupport: 'Написать в поддержку',
    action: 'Нужно ваше действие',
    batch: (count: number) => `Новости по заказам: ${count}`,
    more: (count: number) => `…и ещё ${count}`,
    all: 'Все уведомления',
    openReply: 'Открыть ответ',
    openDocument: 'Открыть документ',
    open: 'Открыть в Atlas',
    openParcel: 'Открыть посылку',
    addPassport: 'Добавить паспорт',
    stopCommand: 'Выключить уведомления о заказах',
  },
  uz: {
    welcomeTitle: 'Atlas bildirishnomalari yoqildi',
    welcome: 'Bu yerga buyurtmalaringiz bo‘yicha yangiliklar keladi: holat, posilka vazni, kuzatuv raqami, qo‘shimcha to‘lovlar, qaroringiz kerak bo‘lgan savollar va yordam xizmati javoblari.\n\nAtlas Telegramda hech qachon karta ma’lumotlari, SMS kodlari yoki parollarni so‘ramaydi.\n\nO‘chirish — /stop yoki saytdagi kabinetda.',
    stopped: '🔕 Buyurtmalar haqidagi bildirishnomalar o‘chirildi. Qayta yoqish — saytdagi kabinetda.',
    alreadyOff: 'Buyurtmalar haqidagi bildirishnomalar allaqachon o‘chirilgan.',
    stopFailed: 'Bildirishnomalarni o‘chirib bo‘lmadi. Bir daqiqadan so‘ng /stop ni qayta yuboring.',
    notifyStart: 'Buyurtmalar haqidagi bildirishnomalarni bu yerda olish uchun ularni Atlas kabinetida yoqing.',
    notifyFailed: 'Bildirishnomalarni yoqib bo‘lmadi. Bir daqiqadan so‘ng /start ni qayta yuboring.',
    openSettings: 'Sozlamalarni ochish',
    autoReply: 'Bu bot faqat bildirishnoma yuboradi va javoblarni o‘qimaydi. Buyurtma bo‘yicha savol bo‘lsa — yordam xizmatiga yozing.',
    contactSupport: 'Yordamga yozish',
    action: 'Sizdan harakat kerak',
    batch: (count: number) => `Buyurtmalar bo‘yicha yangiliklar: ${count}`,
    more: (count: number) => `…va yana ${count} ta`,
    all: 'Barcha bildirishnomalar',
    openReply: 'Javobni ochish',
    openDocument: 'Hujjatni ochish',
    open: 'Atlasda ochish',
    openParcel: 'Posilkani ochish',
    addPassport: 'Pasport qo‘shish',
    stopCommand: 'Buyurtma bildirishnomalarini o‘chirish',
  },
  en: {
    welcomeTitle: 'Atlas notifications are on',
    welcome: 'Updates on your orders will arrive here: status, parcel weight, tracking number, extra payments, questions that need your decision, and replies from support.\n\nAtlas never asks for card details, SMS codes or passwords in Telegram.\n\nTo turn off, send /stop or use your account on the site.',
    stopped: '🔕 Order notifications are off. You can turn them back on in your account on the site.',
    alreadyOff: 'Order notifications are already off.',
    stopFailed: 'Couldn’t turn the notifications off. Send /stop again in a minute.',
    notifyStart: 'To get order notifications here, turn them on in your Atlas account.',
    notifyFailed: 'Couldn’t turn the notifications on. Send /start again in a minute.',
    openSettings: 'Open settings',
    autoReply: 'This bot only sends notifications and doesn’t read replies. For questions about an order, contact support.',
    contactSupport: 'Contact support',
    action: 'Your action is needed',
    batch: (count: number) => `Order updates: ${count}`,
    more: (count: number) => `…and ${count} more`,
    all: 'All notifications',
    openReply: 'Open the reply',
    openDocument: 'Open document',
    open: 'Open in Atlas',
    openParcel: 'Open the parcel',
    addPassport: 'Add passport',
    stopCommand: 'Turn off order notifications',
  },
});

/** Where the settings card lives and where "Contact support" opens the empty form. */
export const telegramSettingsPath = '/account/settings#telegram-notices';
export const telegramSupportPath = '/account?support=new#support';

type Button = { text: string; url: string };
export type TelegramMessage = {
  text: string;
  parse_mode: 'HTML';
  disable_notification: boolean;
  link_preview_options: { is_disabled: true };
  reply_markup?: { inline_keyboard: Button[][] };
};

const escapeHtml = (value: string) => value.replace(/[]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (value: string, max: number) => (value.length > max ? value.slice(0, max - 1).trimEnd() + '…' : value);
/** Telegram counts its 4096 characters after reading the HTML: tags do not count, an entity is one character. */
export const visibleLength = (html: string) => html.replace(/<\/?[bi]>/g, '').replace(/&(?:amp|lt|gt);/g, '_').length;
// The passport is asked for in a notice of its own (1 November 2026): it is an action, not news.
const actionCodes = new Set([...Object.values(reasonCodes).flat(), 'passport-needed']);
/** A notice that asks the buyer to do something (a passport, a доплата, a decision): it travels as a message of its own. */
export const isActionNotice = (notice: Pick<Notification, 'code'>) => !!notice.code && actionCodes.has(notice.code);
/** Buttons only lead to the site itself over https: Telegram refuses anything else, and nothing else is ours. */
const button = (text: string, origin: string, path: string): Button[][] | undefined =>
  /^https:\/\/[^/]+$/.test(origin) ? [[{ text, url: origin + path }]] : undefined;
export const plainMessage = (text: string, origin: string, link?: { text: string; path: string }, silent = false): TelegramMessage => {
  const keyboard = link ? button(link.text, origin, link.path) : undefined;
  return { text, parse_mode: 'HTML', disable_notification: silent, link_preview_options: { is_disabled: true }, ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}) };
};

/** One notice: "Your action is needed" when it asks for something, title, text, product · order. */
function noticeBlock(notice: Notification, orders: readonly Pick<Order, 'id' | 'product'>[], locale: Locale) {
  const t = telegramCopy[locale];
  const { title, message } = renderNotification(notice, locale);
  const order = notice.orderId ? orders.find((item) => item.id === notice.orderId) : undefined;
  const about = notice.orderId ? (order ? `${clip(order.product.name, 60)} · ${notice.orderId}` : notice.orderId) : '';
  return [
    isActionNotice(notice) ? `<i>${escapeHtml(t.action)}</i>` : '',
    `<b>${escapeHtml(clip(title, 120))}</b>`,
    escapeHtml(clip(message, 600)),
    about ? escapeHtml(about) : '',
  ].filter(Boolean).join('\n');
}

/**
 * The message for the notices one write added (oldest first): one notice with its own button, or up to five
 * under "Order updates: N" with "All notifications". Silent when only informational or at night in Tashkent.
 * `origin` is the public site (siteOrigin), never the request's host.
 */
export function formatTelegramNotices(notices: readonly Notification[], orders: readonly Pick<Order, 'id' | 'product'>[], locale: Locale, origin: string, now = Date.now()): TelegramMessage | null {
  if (!notices.length) return null;
  const t = telegramCopy[locale], silent = telegramSilent(notices, now);
  if (notices.length === 1) {
    const [notice] = notices, target = noticeTarget(notice);
    const label = notice.code === 'passport-needed' ? t.addPassport : target?.kind === 'parcel' ? t.openParcel : target?.kind === 'order' ? noticesCopy[locale].openOrder : target?.kind === 'support' ? t.openReply : target?.kind === 'document' ? t.openDocument : t.open;
    const path = target?.href ?? '/notifications?id=' + encodeURIComponent(notice.id);
    return plainMessage(noticeBlock(notice, orders, locale), origin, { text: label, path }, silent);
  }
  // Newest first in a batch, as in the bell; at most five, the rest counted.
  const sorted = [...notices].sort((a, b) => b.at - a.at);
  let shown = Math.min(sorted.length, 5), text = '';
  for (;;) {
    const blocks = sorted.slice(0, shown).map((notice) => noticeBlock(notice, orders, locale));
    const rest = sorted.length - shown;
    text = [`<b>${escapeHtml(t.batch(sorted.length))}</b>`, ...blocks, rest > 0 ? escapeHtml(t.more(rest)) : ''].filter(Boolean).join('\n\n');
    // Telegram's limit is 4096 characters; long operator texts drop whole notices from the batch instead of
    // failing it. The HTML itself is never cut: a cut tag or entity would make Telegram refuse the message.
    // One notice is at most ~800 characters (title 120, text 600, product 60), so a single block always fits.
    if (visibleLength(text) <= 3900 || shown === 1) break;
    shown -= 1;
  }
  return plainMessage(text, origin, { text: t.all, path: '/notifications' }, silent);
}

/**
 * Every message one write sends (owner, 1 November 2026): the news together in one message, then each notice that asks
 * for an action — the passport, a доплата, a decision — in a message of its own, with its own button and "Your action
 * is needed". So "Добавить паспорт" is never folded into "Order updates: 2" behind "All notifications".
 */
export function telegramMessagesFor(notices: readonly Notification[], orders: readonly Pick<Order, 'id' | 'product'>[], locale: Locale, origin: string, now = Date.now()): TelegramMessage[] {
  const news = formatTelegramNotices(notices.filter((notice) => !isActionNotice(notice)), orders, locale, origin, now);
  const actions = notices.filter(isActionNotice).map((notice) => formatTelegramNotices([notice], orders, locale, origin, now));
  return [news, ...actions].filter((message): message is TelegramMessage => message !== null);
}

/** The first message after "Turn on": what will come, what Atlas never asks for, how to stop. */
export function welcomeMessage(locale: Locale, origin: string): TelegramMessage {
  const t = telegramCopy[locale];
  return plainMessage(`✅ <b>${escapeHtml(t.welcomeTitle)}</b>\n\n${escapeHtml(t.welcome)}`, origin);
}
/** A short answer of the bot (plain words, escaped), with at most one button to the site. */
export const botReply = (text: string, origin: string, link?: { text: string; path: string }) => plainMessage(escapeHtml(text), origin, link);
