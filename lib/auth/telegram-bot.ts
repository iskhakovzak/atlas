import {withCyrillic} from '../market/uz-cyrl.ts';
/**
 * Sign-in through the Atlas Telegram bot (owner, 6 October 2026): the button opens the Telegram app with a
 * one-time start token, the bot asks to confirm, and the page that started it signs in by itself.
 * The token is bound to the browser that asked for it (a secret cookie), so a link sent to someone else
 * never signs the sender in, and the bot only confirms after a tap in the person's own Telegram.
 * Pure helpers; the database and Bot API calls live in lib/auth/server.ts.
 */
export const TG_LOGIN_COOKIE = '__Host-atlas_tg';
export const TG_LOGIN_TTL_MS = 10 * 60 * 1000;
/** market_settings key set once the operator connects the bot's webhook in the admin. */
export const TG_BOT_SETTING = 'telegram-bot';
/** The welcome animation the bot sends first (public/telegram), and the market_settings key of its Telegram file_id. */
export const TG_WELCOME_ANIMATION = '/telegram/atlas-welcome.mp4';
export const TG_ANIMATION_SETTING = 'telegram-bot-animation';
export const TG_CHALLENGE_KINDS = ['telegram-bot', 'telegram-link'] as const;
export type TgChallengeKind = typeof TG_CHALLENGE_KINDS[number];

/** randomToken(24): 32 base64url characters, inside Telegram's start limit (64 of A-Z a-z 0-9 _ -). */
export function validStartToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32}$/.test(value);
}
/** The app link (Telegram Desktop or the phone app) and the t.me link that opens the app or its web page. */
export function botLinks(bot: string, token: string) {
  return { app: `tg://resolve?domain=${encodeURIComponent(bot)}&start=${token}`, web: `https://t.me/${encodeURIComponent(bot)}?start=${token}` };
}

type Lang = 'ru' | 'uz' | 'en';
export function botLang(code: unknown): Lang {
  const value = typeof code === 'string' ? code.toLowerCase() : '';
  return value.startsWith('uz') ? 'uz' : value.startsWith('en') ? 'en' : 'ru';
}
export const botText = /*@__PURE__*/withCyrillic({
  ru: {
    confirm: '<b>Вход на сайт Atlas</b>\n\nНажмите «Подтвердить вход», и сайт откроется сам.\n\nЕсли вы не начинали вход — ничего не нажимайте.',
    confirmButton: '✅ Подтвердить вход',
    linkConfirm: '<b>Привязка Telegram к кабинету Atlas</b>\n\nНажмите «Подтвердить», если это вы. Если нет — ничего не нажимайте.',
    linkButton: '✅ Подтвердить',
    done: '✅ <b>Вы вошли в Atlas</b>\n\nВернитесь в браузер — страница уже открывается.',
    linked: '✅ <b>Telegram привязан к кабинету</b>\n\nВернитесь в браузер.',
    expired: 'Ссылка для входа устарела. Вернитесь на сайт и нажмите «Войти через Telegram» ещё раз.',
    hello: '<b>Atlas — покупки в магазинах мира с доставкой в Ташкент</b>\n\nЧтобы войти, откройте сайт и нажмите «Войти через Telegram».',
    open: 'Открыть Atlas',
    toast: 'Вход подтверждён',
  },
  uz: {
    confirm: '<b>Atlas saytiga kirish</b>\n\n«Kirishni tasdiqlash»ni bosing — sayt o‘zi ochiladi.\n\nKirishni boshlamagan bo‘lsangiz, hech narsa bosmang.',
    confirmButton: '✅ Kirishni tasdiqlash',
    linkConfirm: '<b>Telegramni Atlas kabinetiga bog‘lash</b>\n\nBu siz bo‘lsangiz, «Tasdiqlash»ni bosing. Aks holda hech narsa bosmang.',
    linkButton: '✅ Tasdiqlash',
    done: '✅ <b>Atlasga kirdingiz</b>\n\nBrauzerga qayting — sahifa allaqachon ochilmoqda.',
    linked: '✅ <b>Telegram kabinetga bog‘landi</b>\n\nBrauzerga qayting.',
    expired: 'Kirish havolasi eskirgan. Saytga qaytib, «Telegram orqali kirish»ni yana bosing.',
    hello: '<b>Atlas — dunyo do‘konlaridan Toshkentga yetkazib berish bilan xaridlar</b>\n\nKirish uchun saytni ochib, «Telegram orqali kirish»ni bosing.',
    open: 'Atlasni ochish',
    toast: 'Kirish tasdiqlandi',
  },
  en: {
    confirm: '<b>Signing in to Atlas</b>\n\nTap “Confirm sign-in” and the site opens by itself.\n\nIf you did not start signing in, do not tap anything.',
    confirmButton: '✅ Confirm sign-in',
    linkConfirm: '<b>Attaching Telegram to your Atlas account</b>\n\nTap “Confirm” if it is you. Otherwise do not tap anything.',
    linkButton: '✅ Confirm',
    done: '✅ <b>You are signed in to Atlas</b>\n\nGo back to the browser — the page is already opening.',
    linked: '✅ <b>Telegram is attached to your account</b>\n\nGo back to the browser.',
    expired: 'This sign-in link has expired. Go back to the site and tap “Sign in with Telegram” again.',
    hello: '<b>Atlas — shopping from stores worldwide with delivery to Tashkent</b>\n\nTo sign in, open the site and tap “Sign in with Telegram”.',
    open: 'Open Atlas',
    toast: 'Sign-in confirmed',
  },
}) satisfies Record<Lang, Record<string, string>>;

export type BotUpdate =
  | { kind: 'start'; chatId: number; token?: string; lang: Lang }
  | { kind: 'confirm'; callbackId: string; chatId: number; messageId: number; token: string; lang: Lang; user: { id: string; name: string }; media: boolean }
  // Order notices (lib/market/telegram-notices-server.ts). `subject` is the sender's "tg:<id>".
  /** Plain /start too: it completes a "Turn on" pressed on the site within the last 30 minutes. */
  | { kind: 'notify'; chatId: number; subject: string; lang: Lang; plain: boolean }
  | { kind: 'stop'; chatId: number; subject: string; lang: Lang }
  /** Any other text: the bot does not read replies and points to support (at most once an hour per chat). */
  | { kind: 'text'; chatId: number; subject: string; lang: Lang };

/** The bot's command menu: only /stop, in the languages Telegram users here have; the default is Uzbek. */
export const botCommands = {
  default: [{ command: 'stop', description: 'Buyurtma bildirishnomalarini o‘chirish' }],
  ru: [{ command: 'stop', description: 'Выключить уведомления о заказах' }],
  uz: [{ command: 'stop', description: 'Buyurtma bildirishnomalarini o‘chirish' }],
  en: [{ command: 'stop', description: 'Turn off order notifications' }],
} as const;

/**
 * The Telegram an account's order notices may go to, from the rows already read (lib/auth/server.ts
 * telegramConsentSubject). An account created with Telegram ("tg:<id>") uses its own unless that Telegram was
 * since attached to another account. Any other account needs exactly one attached Telegram, attached no later
 * than the consent (`since`): a Telegram attached after it — a re-link, someone else's — needs a new consent.
 */
export function consentSubject(userId: string, rows: { attachedElsewhere?: boolean; links?: readonly { subject: string; created_at: number }[] }, since?: number): string | null {
  if (userId.startsWith('tg:')) return rows.attachedElsewhere ? null : userId;
  const links = (rows.links ?? []).filter((link) => link.subject.startsWith('tg:'));
  if (links.length !== 1) return null;
  return since !== undefined && !(links[0].created_at <= since) ? null : links[0].subject;
}

/** Why the Bot API refused a message, read from its description (not the code alone). */
export type BotFailure = { kind: 'blocked' | 'not-started' | 'rate' | 'bad-request' | 'unavailable'; retryAfter?: number };
/**
 * blocked — the person blocked the bot or deleted their account; not-started — the bot may not write first
 * (no Start yet) or the chat is unknown; rate — Telegram asks to wait; unavailable — network, timeout,
 * Telegram's own error or a bad token (not the customer's doing); bad-request — anything else, such as
 * HTML Telegram could not parse: that is Atlas's mistake and never turns a customer's notices off.
 */
export function classifyBotFailure(reply: { status: number; description?: string; retryAfter?: number }): BotFailure {
  const text = (reply.description ?? '').toLowerCase();
  if (reply.status === 429) return { kind: 'rate', ...(reply.retryAfter !== undefined ? { retryAfter: reply.retryAfter } : {}) };
  if (/chat not found|can't initiate conversation|can.t initiate|peer_id_invalid/.test(text)) return { kind: 'not-started' };
  if (/blocked by the user|user is deactivated|bot was kicked/.test(text)) return { kind: 'blocked' };
  if (reply.status === 403) return { kind: 'blocked' };
  if (reply.status === 0 || reply.status === 401 || reply.status === 404 || reply.status >= 500) return { kind: 'unavailable' };
  return { kind: 'bad-request' };
}

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw | undefined => value && typeof value === 'object' ? value as Raw : undefined;
function person(from: Raw | undefined) {
  if (!from || !/^\d{1,20}$/.test(String(from.id ?? '')) || from.is_bot === true) return undefined;
  const name = [from.first_name, from.last_name].filter(value => typeof value === 'string' && value.trim()).join(' ').slice(0, 120);
  const username = typeof from.username === 'string' ? from.username.slice(0, 64) : '';
  return { id: String(from.id), name: name || (username ? '@' + username : '') };
}

/**
 * What the bot has to answer in a private chat: /start with or without a token, /start notify, /stop, any
 * other text, or the confirm tap.
 */
export function parseBotUpdate(update: unknown): BotUpdate | null {
  const root = obj(update);
  const message = obj(root?.message);
  const chat = obj(message?.chat);
  if (message && chat?.type === 'private' && typeof chat.id === 'number' && typeof message.text === 'string') {
    const from = person(obj(message.from));
    if (!from) return null;
    const text = message.text.trim(), lang = botLang(obj(message.from)?.language_code), subject = 'tg:' + from.id;
    // "/stop", "/stop please", "/stop@bot", or just the word "stop"/"стоп": whoever writes it wants the notices off.
    if (/^\/stop(?:@\w+)?(?:\s[\s\S]*)?$/i.test(text) || /^(?:stop|стоп)[.!]*$/i.test(text)) return { kind: 'stop', chatId: chat.id, subject, lang };
    const match = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/.exec(text);
    if (!match) return { kind: 'text', chatId: chat.id, subject, lang };
    if (match[1] === 'notify') return { kind: 'notify', chatId: chat.id, subject, lang, plain: false };
    return { kind: 'start', chatId: chat.id, token: validStartToken(match[1]) ? match[1] : undefined, lang };
  }
  const callback = obj(root?.callback_query);
  const callbackMessage = obj(callback?.message);
  const callbackChat = obj(callbackMessage?.chat);
  const user = person(obj(callback?.from));
  const data = typeof callback?.data === 'string' ? callback.data : '';
  const token = data.startsWith('ok:') ? data.slice(3) : '';
  if (callback && user && typeof callback.id === 'string' && callbackChat?.type === 'private' && typeof callbackChat.id === 'number'
    && typeof callbackMessage?.message_id === 'number' && validStartToken(token))
    // A message with the welcome animation is edited by its caption, a plain one by its text.
    return { kind: 'confirm', callbackId: callback.id, chatId: callbackChat.id, messageId: callbackMessage.message_id, token, lang: botLang(obj(callback.from)?.language_code), user,
      media: Boolean(callbackMessage.animation || callbackMessage.video || callbackMessage.document || typeof callbackMessage.caption === 'string') };
  return null;
}
