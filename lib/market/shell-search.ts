// The header search on wide screens (app/marketplace.tsx): one field for the catalog search and for a pasted store link.
// Pure and small, so the shell carries no store list; the order page checks the link itself (app/global-link-order.tsx).

/** The catalog's search field takes the focus when the header's search icon led there (app/catalog-view.tsx). */
export const focusSearchKey = 'atlas-focus-search';

/** A product link in what was typed or pasted: a web address anywhere in the text, or one bare address with a path
 *  ("zara.com/uz/…"). Words, and a bare domain without a path ("nike.com"), are a search. */
export function headerSearchLink(text: string): string {
  const raw = text.trim();
  const found = raw.match(/https?:\/\/[^\s<>"'«»]+/i)?.[0];
  if (found) return found;
  return !/\s/.test(raw) && /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\/\S*$/i.test(raw) ? 'https://' + raw : '';
}

/** Where the header search sends what was typed: a link to its calculation, words to the catalog search; '' for nothing. */
export function headerSearchTarget(text: string): string {
  const raw = text.trim();
  if (!raw) return '';
  const link = headerSearchLink(raw);
  return link ? '/order-by-link?url=' + encodeURIComponent(link) : '/catalog?q=' + encodeURIComponent(raw.slice(0, 80));
}

/**
 * Phones (≤ 760 px), 1.11.2026: on the catalog and a store's page the header's field IS the catalog search (owner: the
 * phone's /catalog header had an empty middle). The page publishes its query here; the header reads it and sends what is
 * typed back, so the grid filters in place and ?q= follows (app/catalog-view.tsx). One page at a time; null when none.
 */
export type CatalogSearch = { owner: object; q: string; placeholder?: string; set: (q: string) => void };
let catalogSearch: CatalogSearch | null = null;
const catalogSearchListeners = new Set<() => void>();
export function subscribeCatalogSearch(listener: () => void): () => void {
  catalogSearchListeners.add(listener);
  return () => { catalogSearchListeners.delete(listener); };
}
export const readCatalogSearch = (): CatalogSearch | null => catalogSearch;
/** The page's search now (its query, placeholder and setter); `null` with its owner takes it away if it is still that page's. */
export function publishCatalogSearch(owner: object, next: Omit<CatalogSearch, 'owner'> | null): void {
  if (!next) { if (catalogSearch?.owner !== owner) return; catalogSearch = null; }
  else if (catalogSearch?.owner === owner && catalogSearch.q === next.q && catalogSearch.placeholder === next.placeholder && catalogSearch.set === next.set) return;
  else catalogSearch = { owner, ...next };
  for (const listener of catalogSearchListeners) listener();
}
