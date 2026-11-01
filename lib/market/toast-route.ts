// Toasts belong to the screen they were raised on (owner, 2 November 2026: "переходишь — всё исчезает сразу").
// Only the catalog's product sheet keeps them: opening it (pushState to /catalog/p/<id>) or closing it (back to
// /catalog) is the same screen, so an "added to cart" message raised in the sheet survives it.

/** The path without a language prefix, query, hash or trailing slash. */
export function routeKey(path: string): string {
  const bare = (path.split(/[?#]/)[0] || '/').replace(/^\/(?:uz|oz|en|ru)(?=\/|$)/, '') || '/';
  return bare.length > 1 ? bare.replace(/\/+$/, '') : bare;
}

const catalogScreen = (path: string) => path === '/catalog' || path.startsWith('/catalog/p/');

/** Whether the toasts on screen stay when the address changes from `from` to `to`. */
export function toastSurvivesRoute(from: string, to: string): boolean {
  const a = routeKey(from), b = routeKey(to);
  if (a === b) return true;
  return catalogScreen(a) && catalogScreen(b);
}
