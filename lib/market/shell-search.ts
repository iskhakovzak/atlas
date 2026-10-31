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
