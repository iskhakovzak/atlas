/**
 * Tab-only memory of the "what waits for you" card and toast (sessionStorage; a private window simply forgets):
 * the steps put off with «Позже» on the home card, and the mark that this tab has just signed in, so the one toast
 * shows after a sign-in and never on a later page change.
 */
const laterKey = 'atlas-action-later', signedInKey = 'atlas-signed-in';
/** A sign-in that took longer than this (an abandoned Google page) no longer counts as "just signed in". */
const signedInFresh = 15 * 60_000;

export function readLater(): Set<string> {
  try { const saved = JSON.parse(sessionStorage.getItem(laterKey) ?? '[]'); return new Set(Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : []); } catch { return new Set(); }
}

export function putOffLater(key: string): Set<string> {
  const keys = readLater(); keys.add(key);
  try { sessionStorage.setItem(laterKey, JSON.stringify([...keys].slice(-20))); } catch { /* private mode: hidden until the page reloads */ }
  return keys;
}

/** Called by the sign-in page just before it leaves for the account (a code, Telegram) or a provider (Google, Apple). */
export function markSignedIn(now = Date.now()) {
  try { sessionStorage.setItem(signedInKey, String(now)); } catch { /* no toast then */ }
}

/** True once per sign-in: reads and clears the mark. */
export function takeSignedIn(now = Date.now()): boolean {
  try {
    const at = Number(sessionStorage.getItem(signedInKey));
    if (!at) return false;
    sessionStorage.removeItem(signedInKey);
    return now - at >= 0 && now - at < signedInFresh;
  } catch { return false; }
}
