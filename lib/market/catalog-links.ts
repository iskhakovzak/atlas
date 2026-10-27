/**
 * Small client helpers of the catalog's address and of the guest's heart: pure, so `node:test` covers them.
 *
 * - `?item=<id>` opens one product's sheet over the catalog (a product row in the store card links there);
 *   the sheet drops it on close, the filters stay.
 * - A guest's tap on a heart is remembered for one viewer (localStorage) across sign-in, so that very product is
 *   saved on return. Nothing is saved without the tap and the sign-in; a lost or stale note does nothing.
 */

/** Catalog link that also opens one product's sheet: `/catalog?store=a.com&item=<id>`. */
export function catalogItemHref(catalogHref: string, id: string): string {
  const [path, hash = ''] = catalogHref.split('#');
  return path + (path.includes('?') ? '&' : '?') + 'item=' + encodeURIComponent(id) + (hash ? '#' + hash : '');
}

/** The product id an address asks to open (`?item=`), or null. */
export function itemParam(search: string): string | null {
  const id = new URLSearchParams(search).get('item');
  return id ? id : null;
}

/** The same address without `item` (path, the other parameters and the hash kept), for `history.replaceState`. */
export function withoutItemParam(href: string): string {
  const url = new URL(href, 'https://atlas.local');
  // Pair by pair, so the other parameters keep their spelling ("store=a.com,b.com" is not re-encoded).
  const key = (pair: string) => { const raw = pair.split('=')[0].replace(/\+/g, ' '); try { return decodeURIComponent(raw); } catch { return raw; } };
  const rest = url.search.slice(1).split('&').filter((pair) => pair && key(pair) !== 'item');
  return url.pathname + (rest.length ? '?' + rest.join('&') : '') + url.hash;
}

export const pendingFavoriteKey = 'atlas-pending-favorite';
/** A sign-in that takes longer than this (or another day's visit) does not save anything. */
export const pendingFavoriteTtlMs = 30 * 60 * 1000;

/** This viewer's localStorage, or null where reading it throws (private windows, blocked site data). */
export function browserStorage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}

type ReadStorage = Pick<Storage, 'getItem' | 'removeItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

/** Remembers the guest's heart; storage may be missing or throw (private mode, blocked site data). */
export function rememberPendingFavorite(storage: WriteStorage | null | undefined, id: string, now: number): void {
  try { storage?.setItem(pendingFavoriteKey, JSON.stringify({ id, at: now })); } catch { /* a convenience only */ }
}

/** Reads and always removes the note, so it acts at most once. */
export function takePendingFavorite(storage: ReadStorage | null | undefined): string | null {
  try {
    const raw = storage?.getItem(pendingFavoriteKey) ?? null;
    if (raw !== null) storage?.removeItem(pendingFavoriteKey);
    return raw;
  } catch { return null; }
}

/**
 * The product to save after sign-in, or null: a malformed or stale note, a product no longer in the catalog,
 * or one already saved (the `favorite` action toggles, so saving it again would remove it).
 */
export function pendingFavoriteToSave(raw: string | null, { now, catalogIds, favorites }: { now: number; catalogIds: ReadonlySet<string>; favorites: readonly string[] }): string | null {
  if (!raw) return null;
  let note: unknown;
  try { note = JSON.parse(raw); } catch { return null; }
  if (!note || typeof note !== 'object') return null;
  const { id, at } = note as { id?: unknown; at?: unknown };
  if (typeof id !== 'string' || !id || typeof at !== 'number' || !Number.isFinite(at)) return null;
  if (now - at > pendingFavoriteTtlMs || at - now > 60_000) return null;
  if (!catalogIds.has(id) || favorites.includes(id)) return null;
  return id;
}

/**
 * Collage photos for the sets strip: each set, in the order shown, takes up to `size` photos of its own products
 * that an earlier set has not used yet, then fills up with its already used ones. "On sale" and "From Amazon"
 * stopped repeating the same four photos; every photo is still a product of that set.
 */
export function distinctCovers(sets: readonly { items: readonly { product: { id: string; image?: string } }[] }[], size = 4): string[][] {
  const used = new Set<string>();
  return sets.map((set) => {
    const withPhoto = set.items.filter((item) => Boolean(item.product.image));
    const fresh = withPhoto.filter((item) => !used.has(item.product.id));
    const picked = fresh.slice(0, size);
    if (picked.length < size) picked.push(...withPhoto.filter((item) => used.has(item.product.id)).slice(0, size - picked.length));
    for (const item of picked) used.add(item.product.id);
    return picked.map((item) => item.product.image as string);
  });
}

/** Products this device opened in the catalog, newest first (ids, at most 12): the "Recently viewed" row. */
const recentKey = 'atlas-recent-products';
export function readRecentProducts(storage: Pick<Storage, 'getItem'> | null): string[] {
  try {
    const list = JSON.parse(storage?.getItem(recentKey) ?? '[]');
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string').slice(0, 12) : [];
  } catch { return []; }
}
export function rememberRecentProduct(storage: Pick<Storage, 'getItem' | 'setItem'> | null, id: string): string[] {
  const next = [id, ...readRecentProducts(storage).filter((item) => item !== id)].slice(0, 12);
  try { storage?.setItem(recentKey, JSON.stringify(next)); } catch { /* private mode: the row just stays empty */ }
  return next;
}
export function clearRecentProducts(storage: Pick<Storage, 'removeItem'> | null) {
  try { storage?.removeItem(recentKey); } catch { /* nothing to clear */ }
}
