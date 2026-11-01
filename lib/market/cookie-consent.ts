/**
 * Cookies and browser storage: what the visitor allowed (2 November 2026).
 *
 * Three categories. "Necessary" (session, security, cart, language and theme, drafts) always runs and is only
 * disclosed. "analytics" (our own page-speed beacon and its local summary) and "partners" (the Impact partner tag)
 * are optional: off until the visitor turns them on, and stopped again when they are turned off.
 *
 * The choice is kept on the device (localStorage, `cookieConsentKey`) and, for a signed-in customer, also in the
 * account (`State.cookieConsent`, action `cookie-consent`). The newer of the two at the current version wins, so a
 * choice made on a phone also applies on the laptop and a change on either is not undone by the other.
 * Bump `cookieConsentVersion` when the categories or what runs in them change: everybody is asked again.
 * Pure helpers over a Storage-like object, so tests run in node.
 */
export const cookieConsentVersion = '2026-11-02';
export const cookieConsentKey = 'atlas-cookie-consent';
/** Earlier one-button notices (a single "I accept" for everything, Impact included); removed on the next choice. */
export const legacyConsentKeys = ['atlas-consent-v1', 'atlas-storage-notice-v1'] as const;
export const optionalCategories = ['analytics', 'partners'] as const;
export type OptionalCategory = (typeof optionalCategories)[number];
/** Fired on window after the choice changes on this page; `storage` covers other tabs. */
export const consentChangeEvent = 'atlas:consent-change';
/** Fired by the footer link and the settings page: the card opens with the category switches. */
export const consentOpenEvent = 'atlas:consent-open';
/** Local speed summary kept by app/performance-probe.tsx (lib/market/performance.ts); analytics only. */
export const analyticsStorageKeys = ['atlas:performance:v1'] as const;

export type CookieChoice = { version: string; analytics: boolean; partners: boolean; at: number };
type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };

/** A stored choice, only when it is well formed and made at the current version; anything else means "not asked yet". */
export function parseCookieChoice(value: unknown, version = cookieConsentVersion): CookieChoice | null {
  let data = value;
  if (typeof value === 'string') { try { data = JSON.parse(value); } catch { return null; } }
  if (!data || typeof data !== 'object') return null;
  const item = data as Record<string, unknown>;
  if (item.version !== version || typeof item.analytics !== 'boolean' || typeof item.partners !== 'boolean') return null;
  if (typeof item.at !== 'number' || !Number.isFinite(item.at) || item.at <= 0) return null;
  return { version, analytics: item.analytics, partners: item.partners, at: item.at };
}

export function makeCookieChoice(allow: { analytics: boolean; partners: boolean }, now = Date.now()): CookieChoice {
  return { version: cookieConsentVersion, analytics: allow.analytics === true, partners: allow.partners === true, at: now };
}

export function readCookieChoice(storage: Pick<StorageLike, 'getItem'> | null): CookieChoice | null {
  try { return parseCookieChoice(storage?.getItem(cookieConsentKey) ?? null); } catch { return null; }
}

/** Saves the choice, drops the old notice keys and, when analytics is off, its local data. Never throws. */
export function writeCookieChoice(storage: StorageLike | null, choice: CookieChoice): boolean {
  if (!storage) return false;
  try {
    storage.setItem(cookieConsentKey, JSON.stringify(choice));
    for (const key of legacyConsentKeys) storage.removeItem(key);
    if (!choice.analytics) for (const key of analyticsStorageKeys) storage.removeItem(key);
    return true;
  } catch { return false; }
}

/** The choice in force: the newer of the device's and the account's, each only at the current version. */
export function effectiveCookieChoice(local: CookieChoice | null, account: unknown): CookieChoice | null {
  const fromAccount = parseCookieChoice(account);
  if (!local) return fromAccount;
  if (!fromAccount) return local;
  return fromAccount.at > local.at ? fromAccount : local;
}

/** Optional categories run only with an explicit yes; no choice means no. */
export const cookieAllowed = (choice: CookieChoice | null, category: OptionalCategory) => choice?.[category] === true;

/** Impact's first-party cookies (IR_*, irclickid…): deleted when partner links are switched off. */
export const partnerCookiePattern = /^(IR_|_ir|irclickid|ir_)/i;
export function partnerCookieNames(cookieHeader: string): string[] {
  return cookieHeader.split(';').map((part) => part.split('=')[0]?.trim() ?? '').filter((name) => name && partnerCookiePattern.test(name));
}
