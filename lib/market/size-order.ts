/**
 * The order sizes are shown in: shoe sizes by value, then letter sizes from the smallest up (XS, S, M, L, XL, 2XL),
 * plain ones before each fit group (S Tall, M Tall…), then anything else in natural order (30x30 before 30x32).
 * No imports: the link-order page and the catalog both use it without pulling each other in.
 */

/** Letter sizes the catalog upper-cases ("xs" → "XS"); kept as the catalog normalised them before (normalizeSize). */
export const letterSizes = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL'];

/** One step per size: XXL and 2XL (and the other spellings) are the same size. */
const letterRank: Record<string, number> = {
  XXXS: 0, '3XS': 0, XXS: 1, '2XS': 1, XS: 2, S: 3, M: 4, L: 5, XL: 6,
  XXL: 7, '2XL': 7, XXXL: 8, '3XL': 8, XXXXL: 9, '4XL': 9, XXXXXL: 10, '5XL': 10,
};

type SizeKey =
  | { kind: 0; value: number }
  | { kind: 1; rank: number; fit: string }
  | { kind: 2 };

function sizeKey(raw: string): SizeKey {
  // "US 9" and "9" are one size; "9,5" is "9.5".
  const value = raw.replace(/\s+/g, ' ').trim().replace(/^US\s*/i, '');
  const number = value.replace(/^(\d+),(\d+)$/, '$1.$2');
  if (/^\d+(\.\d+)?$/.test(number)) return { kind: 0, value: Number(number) };
  const [first = '', ...rest] = value.split(' ');
  const rank = letterRank[first.toUpperCase()];
  if (rank === undefined) return { kind: 2 };
  // A fit word after the size (Tall, Petite, Long…) makes its own group; "(8-10)" and the like stay with the size.
  const tail = rest.join(' ');
  return { kind: 1, rank, fit: /^\p{L}/u.test(tail) ? tail.toLowerCase() : '' };
}

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** Array.prototype.sort comparator for size labels. */
export function compareSizes(a: string, b: string): number {
  const ka = sizeKey(a), kb = sizeKey(b);
  if (ka.kind !== kb.kind) return ka.kind - kb.kind;
  if (ka.kind === 0 && kb.kind === 0 && ka.value !== kb.value) return ka.value - kb.value;
  if (ka.kind === 1 && kb.kind === 1) {
    if (ka.fit !== kb.fit) return !ka.fit ? -1 : !kb.fit ? 1 : natural(ka.fit, kb.fit);
    if (ka.rank !== kb.rank) return ka.rank - kb.rank;
  }
  return natural(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}
