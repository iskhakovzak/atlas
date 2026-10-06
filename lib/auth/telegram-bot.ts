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
export const botText = {
  ru: {
    confirm: 'Вход на сайт Atlas.\n\nНажмите «Подтвердить вход», если это вы сейчас входите. Если вы не начинали вход — ничего не нажимайте.',
    confirmButton: '✅ Подтвердить вход',
    linkConfirm: 'Привязка Telegram к вашему кабинету Atlas.\n\nНажмите «Подтвердить», если это вы. Если нет — ничего не нажимайте.',
    linkButton: '✅ Подтвердить',
    done: 'Готово, вы вошли в Atlas. Вернитесь в браузер — страница откроется сама.',
    linked: 'Готово, Telegram привязан к кабинету. Вернитесь в браузер.',
    expired: 'Ссылка для входа устарела. Вернитесь на сайт и нажмите «Войти через Telegram» ещё раз.',
    hello: 'Это бот для входа в Atlas. Откройте сайт и нажмите «Войти через Telegram».',
    open: 'Открыть Atlas',
    toast: 'Вход подтверждён',
  },
  uz: {
    confirm: 'Atlas saytiga kirish.\n\nHozir kirayotgan bo‘lsangiz, «Kirishni tasdiqlash» tugmasini bosing. Kirishni boshlamagan bo‘lsangiz, hech narsa bosmang.',
    confirmButton: '✅ Kirishni tasdiqlash',
    linkConfirm: 'Telegramni Atlas kabinetingizga bog‘lash.\n\nBu siz bo‘lsangiz, «Tasdiqlash»ni bosing. Aks holda hech narsa bosmang.',
    linkButton: '✅ Tasdiqlash',
    done: 'Tayyor, Atlasga kirdingiz. Brauzerga qayting — sahifa o‘zi ochiladi.',
    linked: 'Tayyor, Telegram kabinetga bog‘landi. Brauzerga qayting.',
    expired: 'Kirish havolasi eskirgan. Saytga qaytib, «Telegram orqali kirish»ni yana bosing.',
    hello: 'Bu Atlasga kirish uchun bot. Saytni ochib, «Telegram orqali kirish»ni bosing.',
    open: 'Atlasni ochish',
    toast: 'Kirish tasdiqlandi',
  },
  en: {
    confirm: 'Signing in to Atlas.\n\nTap “Confirm sign-in” if it is you signing in now. If you did not start signing in, do not tap anything.',
    confirmButton: '✅ Confirm sign-in',
    linkConfirm: 'Attaching Telegram to your Atlas account.\n\nTap “Confirm” if it is you. Otherwise do not tap anything.',
    linkButton: '✅ Confirm',
    done: 'Done, you are signed in to Atlas. Go back to the browser — the page opens by itself.',
    linked: 'Done, Telegram is attached to your account. Go back to the browser.',
    expired: 'This sign-in link has expired. Go back to the site and tap “Sign in with Telegram” again.',
    hello: 'This bot signs you in to Atlas. Open the site and tap “Sign in with Telegram”.',
    open: 'Open Atlas',
    toast: 'Sign-in confirmed',
  },
} satisfies Record<Lang, Record<string, string>>;

export type BotUpdate =
  | { kind: 'start'; chatId: number; token?: string; lang: Lang }
  | { kind: 'confirm'; callbackId: string; chatId: number; messageId: number; token: string; lang: Lang; user: { id: string; name: string } };

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw | undefined => value && typeof value === 'object' ? value as Raw : undefined;
function person(from: Raw | undefined) {
  if (!from || !/^\d{1,20}$/.test(String(from.id ?? '')) || from.is_bot === true) return undefined;
  const name = [from.first_name, from.last_name].filter(value => typeof value === 'string' && value.trim()).join(' ').slice(0, 120);
  const username = typeof from.username === 'string' ? from.username.slice(0, 64) : '';
  return { id: String(from.id), name: name || (username ? '@' + username : '') };
}

/** What the bot has to answer: /start with or without a token in a private chat, or the confirm tap. */
export function parseBotUpdate(update: unknown): BotUpdate | null {
  const root = obj(update);
  const message = obj(root?.message);
  const chat = obj(message?.chat);
  if (message && chat?.type === 'private' && typeof chat.id === 'number' && typeof message.text === 'string') {
    const match = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/.exec(message.text.trim());
    if (!match || !person(obj(message.from))) return null;
    return { kind: 'start', chatId: chat.id, token: validStartToken(match[1]) ? match[1] : undefined, lang: botLang(obj(message.from)?.language_code) };
  }
  const callback = obj(root?.callback_query);
  const callbackMessage = obj(callback?.message);
  const callbackChat = obj(callbackMessage?.chat);
  const user = person(obj(callback?.from));
  const data = typeof callback?.data === 'string' ? callback.data : '';
  const token = data.startsWith('ok:') ? data.slice(3) : '';
  if (callback && user && typeof callback.id === 'string' && callbackChat?.type === 'private' && typeof callbackChat.id === 'number'
    && typeof callbackMessage?.message_id === 'number' && validStartToken(token))
    return { kind: 'confirm', callbackId: callback.id, chatId: callbackChat.id, messageId: callbackMessage.message_id, token, lang: botLang(obj(callback.from)?.language_code), user };
  return null;
}
