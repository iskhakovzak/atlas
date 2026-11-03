// The Telegram Login Widget without eval (3 November 2026). With `data-onauth="fn(user)"` the widget turns the
// attribute into a function with eval(), which the enforced CSP (lib/security/csp.ts) blocks: the widget then never
// drew its button. Atlas now loads it without data-onauth and reads the result itself, the two ways the widget
// delivers it: a message from its iframe on oauth.telegram.org, or `#tgAuthResult=` after the redirect fallback.
// The data is untrusted either way: /api/auth/telegram checks Telegram's signature (verifyTelegramAuth).

export const telegramWidgetOrigin = "https://oauth.telegram.org";
export const telegramWidgetScript = "https://telegram.org/js/telegram-widget.js?22";

export type TelegramWidgetUser = Record<string, unknown>;

const isUser = (value: unknown): value is TelegramWidgetUser => !!value && typeof value === "object" && !Array.isArray(value);

/** The user from an iframe message (`{"event":"auth_user","auth_data":{…}}`, also with `init` on a remembered login). */
export function telegramUserFromMessage(data: unknown): TelegramWidgetUser | null {
  let parsed: unknown = data;
  if (typeof data === "string") {
    try { parsed = JSON.parse(data); } catch { return null; }
  }
  if (!isUser(parsed) || parsed.event !== "auth_user") return null;
  return isUser(parsed.auth_data) ? parsed.auth_data : null;
}

const resultPattern = /[#?&]tgAuthResult=([A-Za-z0-9\-_=]*)$/;

/** The user from `#tgAuthResult=<base64url JSON>` and the hash without it, as the widget itself reads it. */
export function telegramUserFromHash(hash: string): { user: TelegramWidgetUser; hash: string } | null {
  const match = hash.match(resultPattern);
  if (!match) return null;
  let data = (match[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = data.length % 4;
  if (pad > 1) data += "=".repeat(4 - pad);
  try {
    const user: unknown = JSON.parse(atob(data));
    return isUser(user) ? { user, hash: hash.replace(resultPattern, "") } : null;
  } catch {
    return null;
  }
}
