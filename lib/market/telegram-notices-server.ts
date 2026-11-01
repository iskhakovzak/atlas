import { database, deferBackground, HttpError, json, persist, rateLimit, storedAccount } from "./server";
import type { State } from "./domain";
import { requestLocale, serverError } from "./i18n";
import { consentVersion } from "./account-delete";
import { botReply, telegramCopy, telegramMessagesFor, telegramSettingsPath, telegramSupportPath, welcomeMessage } from "./telegram-notices";
import { casUpdate, newNotices, setTelegramNotices, shouldNotifyTelegram, stopOutcome, telegramPending, type AccountUpdate, type TelegramChange, type TelegramLanguage, type TelegramOffReason } from "./telegram-state";
import { sendTelegram, telegramAccountsOf, telegramBotConnected, telegramConfigured, telegramConsentSubject, telegramNoticesLive, type TelegramNoticeHooks } from "@/lib/auth/server";
import { siteOrigin } from "@/lib/seo/structured-data";

// Order notices in Telegram, only with the customer's consent (owner, 14.10.2026).
// - Sent only for writes Atlas makes (POST /api/operations passes `notify` to persist), to the account that
//   write saved — never to whoever is signed in.
// - The recipient is checked before every message: the Telegram attached no later than the consent.
// - Buttons lead to the public site (siteOrigin); only the live deployment sends (telegramNoticesLive).
// - Telegram's refusal turns the notices off only for "blocked" / "not started", and only the consent the
//   message was sent under (a newer "Turn on" stays).

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const brief = (error: unknown) => String(error).slice(0, 200);
/** The switch: the database could not be read — "try again", never "attach Telegram first". */
const databaseDown = (): never => {
  throw new HttpError(503, "err_83");
};

/**
 * Applies `change` to the latest saved account, again on a concurrent write (3 tries). saved / unchanged /
 * failed (still conflicting or the database failed) — told apart, so a failure is never reported as done.
 */
function updateAccount(userId: string, change: (state: State) => State): Promise<AccountUpdate<State>> {
  return casUpdate(
    {
      load: () => storedAccount(userId),
      save: (next, current) => persist(userId, next, current.revision, current.state),
      conflict: (error) => error instanceof HttpError && error.status === 409,
    },
    change,
  );
}

/** Turns the notices off (CAS). With `since`, only the consent given at that moment: a newer one stays. */
export function disableTelegramNotices(userId: string, reason: TelegramOffReason, options: { since?: number } = {}) {
  const change: TelegramChange = { kind: "off", reason, now: Date.now(), ...(options.since !== undefined ? { since: options.since } : {}) };
  return updateAccount(userId, (state) => setTelegramNotices(state, change));
}

/** Proof of consent outside the account document, like the privacy consent (market_legal_consents, no migration). */
async function recordConsent(userId: string, at: number) {
  try {
    await database()
      .prepare("INSERT OR IGNORE INTO market_legal_consents (id,customer_id,document_key,document_version,accepted_at) VALUES (?,?,?,?,?)")
      .bind(crypto.randomUUID(), userId, "telegram-notices", `${consentVersion} ${new Date(at).toISOString()}`, at)
      .run();
  } catch (error) {
    console.error("Telegram consent record failed", String(error).slice(0, 200));
  }
}

/** For the operator's monitor: what kind of refusal, never the token, the text or who it was for. */
async function recordProblem(kind: string) {
  try {
    await database()
      .prepare("INSERT INTO market_operational_errors (id,area,message,details,created_at) VALUES (?,?,?,?,?)")
      .bind(crypto.randomUUID(), "telegram", "Telegram order notice not delivered", JSON.stringify({ kind }), Date.now())
      .run();
  } catch {
    /* the monitor is best effort */
  }
}

/**
 * Sends the notices a write added (persist, in the background). `userId` is the account persist saved —
 * the customer of an order an operator moved — never the signed-in person. Never throws.
 */
export async function deliverTelegramNotices(userId: string, previous: State, next: State, now = Date.now()) {
  if (!shouldNotifyTelegram(true, previous, next, now) || !telegramConfigured()) return;
  const since = next.communication.telegramSince;
  if (since === undefined) return;
  // A database error means "send nothing": the bell still has the notice.
  const subject = await telegramConsentSubject(userId, since).catch(() => null);
  if (!subject) return;
  try {
    // Keyed by the account first, so deleting the account clears it (account-delete-server.ts).
    await rateLimit(`${userId}:tg-notify`, 30, 60 * 60_000);
  } catch {
    return; // more than 30 messages an hour: the bell still has them all
  }
  // The news in one message, then each action (the passport, a доплата) in its own (telegramMessagesFor, 1 November 2026).
  for (const message of telegramMessagesFor(newNotices(previous, next, now), next.orders, next.communication.language, siteOrigin, now)) {
    let sent = await sendTelegram(subject, message);
    // Only Telegram's own "wait" is retried, once and briefly; a timeout may have delivered, so it is not.
    if (!sent.ok && sent.failure.kind === "rate" && (sent.failure.retryAfter ?? 99) <= 3) {
      await sleep((sent.failure.retryAfter ?? 1) * 1000);
      sent = await sendTelegram(subject, message);
    }
    if (sent.ok) continue;
    if (sent.failure.kind === "blocked" || sent.failure.kind === "not-started") {
      // Blocked: nothing more can arrive, so the rest of this write is not tried either.
      const off = await disableTelegramNotices(userId, "blocked", { since });
      if (off.status === "failed") {
        console.error("Telegram notices not turned off", brief(off.error));
        await recordProblem("off-failed");
      }
      return;
    }
    await recordProblem(sent.failure.kind);
  }
}

/** The welcome after a successful "Turn on"; if Telegram refuses it after all, the consent it followed is undone. */
async function welcome(userId: string, subject: string, locale: TelegramLanguage, since: number) {
  const sent = await sendTelegram(subject, welcomeMessage(locale, siteOrigin));
  if (sent.ok) return;
  let undone: AccountUpdate<State> | undefined;
  if (sent.failure.kind === "not-started")
    undone = await updateAccount(userId, (state) =>
      state.communication.telegramEnabled === true && state.communication.telegramSince === since ? setTelegramNotices(state, { kind: "pending", now: Date.now() }) : state,
    );
  else if (sent.failure.kind === "blocked") undone = await disableTelegramNotices(userId, "blocked", { since });
  else await recordProblem("welcome-" + sent.failure.kind);
  if (undone?.status === "failed") {
    console.error("Telegram notices not undone after the welcome", brief(undone.error));
    await recordProblem("off-failed");
  }
}

/**
 * POST /api/actions {type:"telegram-notify"}: the customer's own switch. On: limit → the bot is set up, its
 * webhook connected and this is the live site → a Telegram is attached → an invisible "typing…" proves the bot
 * may write → saved → consent recorded → welcome in the background. Off: saved at once, nothing sent.
 */
export async function toggleTelegramNotices(
  request: Request,
  userId: string,
  current: { state: State; revision: number },
  action: { enabled: boolean; language?: TelegramLanguage },
) {
  const now = Date.now(), value = current.state.communication;
  const respond = (state: State, revision: number) => json({ state, revision });
  if (!action.enabled) {
    const next = setTelegramNotices(current.state, { kind: "off", reason: "customer", now });
    if (next === current.state) return respond(current.state, current.revision);
    await persist(userId, next, current.revision, current.state);
    return respond(next, current.revision + 1);
  }
  await rateLimit(`${userId}:telegram-test`, 5, 10 * 60_000);
  if (!telegramConfigured() || !telegramNoticesLive(request) || !(await telegramBotConnected())) throw new HttpError(503, "err_84");
  const subject = await telegramConsentSubject(userId).catch(databaseDown);
  if (!subject) throw new HttpError(409, "err_81");
  // Already on, and the consent still holds for this Telegram: nothing to test or send again.
  if (value.telegramEnabled === true && value.telegramSince !== undefined && (await telegramConsentSubject(userId, value.telegramSince).catch(databaseDown)) === subject)
    return respond(current.state, current.revision);
  const probe = await sendTelegram(subject, { action: "typing" }, "sendChatAction");
  if (!probe.ok) {
    if (probe.failure.kind === "blocked" || probe.failure.kind === "not-started") {
      // Telegram lets a bot write only after Start: the site remembers the request, and Start within 30 minutes completes it.
      const pending = setTelegramNotices(current.state, { kind: "pending", now, language: action.language });
      await persist(userId, pending, current.revision, current.state);
      return json({ error: serverError(requestLocale(request), "err_82"), errorCode: "err_82", state: pending, revision: current.revision + 1 }, 409);
    }
    throw new HttpError(503, "err_83");
  }
  const next = setTelegramNotices(current.state, { kind: "on", now, language: action.language });
  await persist(userId, next, current.revision, current.state);
  await recordConsent(userId, now);
  deferBackground(welcome(userId, subject, next.communication.language, now), "Telegram welcome failed");
  return respond(next, current.revision + 1);
}

/**
 * The bot's side of the notices (lib/auth/server.ts telegramWebhook); answers in the account's language.
 * The account a Telegram opens, or null when it has none. Throws when the database cannot be read.
 */
async function accountFor(subject: string) {
  const [userId] = await telegramAccountsOf(subject);
  if (!userId) return null;
  const stored = await storedAccount(userId).catch((error) => {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  });
  return stored ? { userId, state: stored.state } : null;
}

/** /start notify, or plain /start (`plain`): true when it answered. Throws when it could not be done. */
async function startNotices(update: Parameters<TelegramNoticeHooks["notify"]>[0], live: boolean) {
  const found = await accountFor(update.subject);
  if (!found) {
    if (update.plain) return false;
    const t = telegramCopy[update.lang];
    await sendTelegram(update.subject, botReply(t.notifyStart, siteOrigin, { text: t.openSettings, path: telegramSettingsPath }));
    return true;
  }
  const value = found.state.communication, t = telegramCopy[value.language];
  // "Turn on" pressed on the site within 30 minutes, from this very Telegram: the consent is already given there.
  if (live && telegramPending(value) && (await telegramConsentSubject(found.userId, value.telegramPendingAt)) === update.subject) {
    const now = Date.now();
    const result = await updateAccount(found.userId, (state) => (telegramPending(state.communication, now) ? setTelegramNotices(state, { kind: "on", now }) : state));
    if (result.status === "failed") throw result.error ?? new Error("Telegram notices not turned on");
    if (result.status === "saved") {
      await recordConsent(found.userId, value.telegramPendingAt!);
      await sendTelegram(update.subject, welcomeMessage(result.state.communication.language, siteOrigin));
      return true;
    }
    // Unchanged: the wait ended meanwhile; answered below like any other Start.
  }
  if (update.plain) return false;
  if (value.telegramEnabled === true && value.telegramSince !== undefined && (await telegramConsentSubject(found.userId, value.telegramSince)) === update.subject) {
    await sendTelegram(update.subject, welcomeMessage(value.language, siteOrigin));
    return true;
  }
  await sendTelegram(update.subject, botReply(t.notifyStart, siteOrigin, { text: t.openSettings, path: telegramSettingsPath }));
  return true;
}

export const telegramNoticeHooks: TelegramNoticeHooks = {
  // /stop turns off every account this Telegram leads to; "already off" only when nothing failed and nothing
  // was on — a failed write (D1, three conflicts in a row) asks to send /stop again instead.
  async stop(update) {
    let language: TelegramLanguage = update.lang;
    let outcome: ReturnType<typeof stopOutcome>;
    try {
      const results = await Promise.all((await telegramAccountsOf(update.subject)).map((userId) => disableTelegramNotices(userId, "bot-stop")));
      const first = results[0];
      if (first && first.status !== "failed") language = first.state.communication.language;
      outcome = stopOutcome(results);
      for (const result of results) if (result.status === "failed") console.error("Telegram /stop not saved", brief(result.error));
    } catch (error) {
      console.error("Telegram /stop failed", brief(error));
      outcome = "failed";
    }
    if (outcome === "failed") await recordProblem("stop-failed");
    const t = telegramCopy[language];
    await sendTelegram(update.subject, botReply(outcome === "stopped" ? t.stopped : outcome === "already" ? t.alreadyOff : t.stopFailed, siteOrigin));
  },
  async notify(update, live) {
    try {
      return await startNotices(update, live);
    } catch (error) {
      console.error("Telegram /start notify failed", brief(error));
      await recordProblem("notify-failed");
      // A plain Start falls back to the usual welcome; "/start notify" is told it did not work, not "turn it on on the site".
      if (update.plain) return false;
      await sendTelegram(update.subject, botReply(telegramCopy[update.lang].notifyFailed, siteOrigin));
      return true;
    }
  },
  async text(update) {
    const found = await accountFor(update.subject).catch(() => null);
    const t = telegramCopy[found?.state.communication.language ?? update.lang];
    await sendTelegram(update.subject, botReply(t.autoReply, siteOrigin, { text: t.contactSupport, path: telegramSupportPath }));
  },
};

/** After Telegram is detached from the account: the notices have nowhere to go. */
export async function telegramDetached(userId: string, subject: string) {
  if (!subject.startsWith("tg:")) return;
  const off = await disableTelegramNotices(userId, "unlinked");
  // Nothing more goes out regardless: the consent check needs the attached Telegram.
  if (off.status === "failed") console.error("Telegram notices not turned off after unlinking", brief(off.error));
}
