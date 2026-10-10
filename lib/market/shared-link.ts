// "Поделиться → Atlas" and "Заменить ссылку": a store app shares its product as text ("Look at these
// shoes https://… via Nike") or as a URL with a title. Pure, so the share route (app/share/route.ts),
// the order-by-link page and node tests read the link the same way. The importer still checks the
// store allowlist; this only finds the first web link.

const linkPattern = /\bhttps?:\/\/[^\s<>"'()\[\]{}]+/i;
/** Longer than any product page link; a share of a whole article is cut before it reaches the address bar. */
export const SHARED_TEXT_LIMIT = 2048;

/** The first http(s) link in the given texts, in order (the shared URL first, then the text, then the title); "" when there is none. */
export function extractSharedLink(...texts: Array<string | null | undefined>): string {
  for (const text of texts) {
    if (typeof text !== "string" || !text) continue;
    const found = text.slice(0, SHARED_TEXT_LIMIT).match(linkPattern)?.[0];
    if (!found) continue;
    // A sentence often ends right after the link: "…/CW2288-111." or "…/item»".
    const link = found.replace(/[.,;:!?…»”’]+$/u, "");
    try {
      const url = new URL(link);
      if (url.hostname.includes(".") && !url.username && !url.password) return url.href;
    } catch { /* not a web address: look further */ }
  }
  return "";
}

/** Where the share route sends the customer: the order form with the link, or the empty form saying nothing was found. */
export function sharedLinkTarget(link: string): string {
  return link ? `/order-by-link?url=${encodeURIComponent(link)}` : "/order-by-link?shared=nolink";
}
