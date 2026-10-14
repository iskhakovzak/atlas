import type { Communication, Notification, State } from './domain.ts';

// Telegram order notices: the account side. Kept apart from the message texts (telegram-notices.ts) so that
// persist() can decide "nothing to send" without loading any copy.

/** "Open the bot and press Start" stays valid this long after "Turn on" on the site. */
export const telegramPendingWindow = 30 * 60_000;
/** Only notices this recent are sent: a write that reaches older ones (a restored backup) sends nothing. */
export const telegramFreshness = 10 * 60_000;

/** Why the notices are off: the customer's switch, /stop in the bot, Telegram refused delivery, Telegram unlinked. */
export type TelegramOffReason = 'customer' | 'bot-stop' | 'blocked' | 'unlinked';
export type TelegramLanguage = Communication['language'];

/** Notices `next` has and `previous` had not (by id), unread and fresh, oldest first (the order they happened in). */
export function newNotices(previous: Pick<State, 'notifications'>, next: Pick<State, 'notifications'>, now = Date.now()): Notification[] {
  if (previous.notifications === next.notifications) return [];
  const known = new Set(previous.notifications.map((item) => item.id));
  return next.notifications
    .filter((item) => !known.has(item.id) && !item.read && item.at <= now + 60_000 && now - item.at <= telegramFreshness)
    .sort((a, b) => a.at - b.at);
}
export const hasNewNotice = (previous: Pick<State, 'notifications'>, next: Pick<State, 'notifications'>, now = Date.now()) =>
  newNotices(previous, next, now).length > 0;

/**
 * The cheap gate persist() runs before loading anything: the write comes from Atlas (operations), the
 * customer has the notices on and the write added a notice.
 */
export function shouldNotifyTelegram(notify: boolean | undefined, previous: State | undefined, next: State, now = Date.now()) {
  return notify === true && previous !== undefined && next.communication.telegramEnabled === true && hasNewNotice(previous, next, now);
}

export type TelegramChange =
  | { kind: 'on'; now: number; language?: TelegramLanguage }
  | { kind: 'pending'; now: number; language?: TelegramLanguage }
  /** `since`: turn off only the consent given at that moment (a delivery refused after a newer "Turn on" leaves it). */
  | { kind: 'off'; reason: TelegramOffReason; now: number; since?: number };

const telegramKeys = ['telegramEnabled', 'telegramSince', 'telegramOff', 'telegramOffAt', 'telegramPendingAt'] as const;
const withoutTelegram = (value: Communication): Communication => {
  const rest = { ...value };
  for (const key of telegramKeys) delete rest[key];
  return rest;
};

/** The account with the notices switched; the very same object when nothing changes (no write needed). */
export function setTelegramNotices(state: State, change: TelegramChange): State {
  const current = state.communication;
  const language = 'language' in change && change.language ? change.language : current.language;
  if (change.kind === 'on')
    return { ...state, communication: { ...withoutTelegram(current), language, telegramEnabled: true, telegramSince: change.now } };
  // A new "Turn on" replaces an older reason for "off": once the wait ends it must not show again.
  if (change.kind === 'pending')
    return { ...state, communication: { ...withoutTelegram(current), language, telegramEnabled: false, telegramPendingAt: change.now } };
  if (change.since !== undefined && !(current.telegramEnabled === true && current.telegramSince === change.since)) return state;
  if (current.telegramEnabled !== true && current.telegramPendingAt === undefined) return state;
  return { ...state, communication: { ...withoutTelegram(current), telegramEnabled: false, telegramOff: change.reason, telegramOffAt: change.now } };
}

/**
 * A server-side write of the notices: `saved`, `unchanged` (nothing to write) or `failed` (still conflicting
 * after the retries, or the database failed). Kept apart so "already off" is never said when nothing was saved.
 */
export type AccountUpdate<S> = { status: 'saved'; state: S } | { status: 'unchanged'; state: S } | { status: 'failed'; error?: unknown };

/**
 * Applies `change` to the latest saved account and writes it only while the revision still matches; a
 * concurrent write (`conflict`) is read again and retried, 3 tries in all. Never throws.
 */
export async function casUpdate<S>(
  io: {
    load: () => Promise<{ state: S; revision: number }>;
    save: (next: S, current: { state: S; revision: number }) => Promise<unknown>;
    conflict: (error: unknown) => boolean;
  },
  change: (state: S) => S,
  attempts = 3,
): Promise<AccountUpdate<S>> {
  let error: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let current: { state: S; revision: number };
    try {
      current = await io.load();
    } catch (loadError) {
      return { status: 'failed', error: loadError };
    }
    const next = change(current.state);
    if (next === current.state) return { status: 'unchanged', state: current.state };
    try {
      await io.save(next, current);
      return { status: 'saved', state: next };
    } catch (saveError) {
      if (!io.conflict(saveError)) return { status: 'failed', error: saveError };
      error = saveError;
    }
  }
  return { status: 'failed', error };
}

/** What the bot answers to /stop over the accounts that Telegram leads to: a failure is never "already off". */
export type StopOutcome = 'stopped' | 'already' | 'failed';
export function stopOutcome(results: readonly AccountUpdate<unknown>[]): StopOutcome {
  if (results.some((result) => result.status === 'failed')) return 'failed';
  return results.some((result) => result.status === 'saved') ? 'stopped' : 'already';
}

/** The t.me link that starts the bot with "notify": a Start within the pending window turns the notices on. */
export const telegramNotifyLink = (bot: string) => `https://t.me/${encodeURIComponent(bot)}?start=notify`;
/** A "Turn on" on the site that still waits for Start in the bot. */
export const telegramPending = (value: Communication, now = Date.now()) =>
  value.telegramEnabled !== true && value.telegramPendingAt !== undefined && now - value.telegramPendingAt <= telegramPendingWindow && value.telegramPendingAt <= now + 60_000;

export type TelegramView =
  | { kind: 'on'; since: number }
  /** On, but the Telegram now attached was attached after the consent: a new consent is needed. */
  | { kind: 'changed' }
  | { kind: 'pending'; at: number }
  | { kind: 'off'; reason?: TelegramOffReason };

/**
 * What the settings card shows. `linkedAt` — when the account's Telegram was attached (from /api/auth/links;
 * undefined for an account created with Telegram). The server makes the same check before each message.
 */
export function telegramView(value: Communication, linkedAt: number | undefined, now = Date.now()): TelegramView {
  if (value.telegramEnabled === true && value.telegramSince !== undefined)
    return linkedAt !== undefined && linkedAt > value.telegramSince ? { kind: 'changed' } : { kind: 'on', since: value.telegramSince };
  if (telegramPending(value, now)) return { kind: 'pending', at: value.telegramPendingAt! };
  const reason = value.telegramOff;
  return { kind: 'off', ...(reason === 'customer' || reason === 'bot-stop' || reason === 'blocked' || reason === 'unlinked' ? { reason } : {}) };
}

/** Tashkent is UTC+5 all year. Messages between 22:00 and 08:00 there arrive without sound. */
export function tashkentNight(at: number) {
  const hour = new Date(at + 5 * 3_600_000).getUTCHours();
  return hour >= 22 || hour < 8;
}
/** Notices that only inform (nothing to do, nothing changed for the worse): never with sound. */
export const quietNoticeCodes: readonly string[] = ['store-shipping-within', 'customs-duty-match', 'customs-duty-refund', 'parcel-refund', 'parcel-weighed'];
export const quietNotice = (code: string | undefined) =>
  code !== undefined && (quietNoticeCodes.includes(code) || (code.startsWith('store-shipping-') && code.endsWith('-legacy')));
/** A batch is silent when every notice in it is informational, or at night in Tashkent. */
export const telegramSilent = (notices: readonly Pick<Notification, 'code'>[], now = Date.now()) =>
  tashkentNight(now) || notices.every((item) => quietNotice(item.code));
