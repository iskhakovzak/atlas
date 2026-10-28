import { extractSharedLink, normalizeProductLink } from './shared-link.ts';
import { validateSource } from './domain.ts';
import { isSupportedStoreHost } from '../importer/stores.ts';

/** A store product link in copied text, as the link field would take it; "" for anything else (app/clipboard-suggest.tsx). */
export function storeLinkIn(text: string): string {
  const raw = extractSharedLink(text) || normalizeProductLink(text);
  if (!raw) return '';
  try {
    const link = validateSource(raw);
    return isSupportedStoreHost(new URL(link).hostname) ? link : '';
  } catch { return ''; }
}
