import { normalizeProductLink } from './shared-link.ts';
import { validateSource } from './domain.ts';
import { isSupportedStoreHost } from '../importer/stores.ts';

/** Accept a full URL without changing a variant query, or find a link in shared text. */
export function orderLinkIn(text: string): string {
  const raw = text.trim();
  const candidate = /^https?:\/\/\S+$/i.test(raw) ? raw.replace(/^http:/i, 'https:') : normalizeProductLink(raw);
  if (!candidate || candidate.length > 3000) return '';
  try {
    const link = validateSource(candidate);
    return new URL(link).port ? '' : link;
  } catch { return ''; }
}

/** Only stores Atlas can read may be warmed from the clipboard. */
export function storeLinkIn(text: string): string {
  const link = orderLinkIn(text);
  return link && isSupportedStoreHost(new URL(link).hostname) ? link : '';
}
