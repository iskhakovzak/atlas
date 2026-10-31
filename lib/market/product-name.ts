/**
 * A catalog card prints the brand on its own line, so the title does not start with it again: "Nike Club · Fleece Hoodie"
 * under "Nike" reads "Club · Fleece Hoodie" (direction A, 1 November 2026). Display only: the stored name, the search,
 * the product sheet, the cart and the order keep the full name.
 */
const separators = /^[\s·•|:,–—\-®™]+/u;
export function nameWithoutBrand(name: string, brand: string | undefined) {
  const full = name.trim(), mark = (brand ?? '').trim();
  if (!mark || full.length <= mark.length) return full;
  if (full.slice(0, mark.length).toLocaleLowerCase() !== mark.toLocaleLowerCase()) return full;
  const after = full.slice(mark.length);
  // "Nikeland Socks" is not "Nike" + "land Socks": the brand must end at a word boundary.
  if (/^[\p{L}\p{N}]/u.test(after)) return full;
  const rest = after.replace(separators, '');
  // What is left must still name something ("Apple" + " 2" says nothing on its own).
  if (rest.length < 3 || !/\p{L}/u.test(rest)) return full;
  // Kept as the store wrote it: "iPhone 15" must not become "IPhone 15".
  return rest;
}

const letters = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
/**
 * The brand line of a card. Imported brands are sometimes the store's raw field ("Brand: TONY'S TEXTILES") or a slug
 * ("kylie-cosmetics"): the label drops the "Brand:" prefix and, when it names the store, takes the store's own spelling.
 * A marketplace is not the maker: the importer often records the marketplace itself as the brand ("Amazon" over a Sony
 * headset, "eBay" over an HP laptop), so with `marketplace` (that store's own name) such a brand is an empty label, and
 * so is no brand at all; the card then shows the category (the store is the mark on the photo).
 */
export function displayBrand(brand: string | undefined, store: string, marketplace?: string) {
  const text = (brand ?? '').trim().replace(/^(brand|бренд|marka)\s*:\s*/iu, '').trim();
  if (!text) return '';
  if (marketplace && [store, marketplace].some((name) => name && letters(text) === letters(name))) return '';
  return store && letters(text) === letters(store) ? store : text;
}
