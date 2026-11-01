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

const departmentWords = /^(?:(men|man|mens|men's|male)|(women|woman|womens|women's|ladies|female)|(kids|kid's|kids'|youth|boys|boy's|girls|girl's|junior|juniors)|(baby|babies|infant|infants|toddler|toddlers)|(unisex))(?=[\s·•|:,–—\-]|$)[\s·•|:,–—\-]*/iu;
const departmentKeys = ['men', 'women', 'kids', 'baby', 'unisex'] as const;
export type NameDepartment = typeof departmentKeys[number];

/**
 * Store titles often start with who the item is for ("adidas men Core Pants", "Women's Swift Run"): the card says it as a
 * small label instead (owner, 2 November 2026), so the word leaves the shown title — at the start or right after the
 * brand. Display only: the stored name and the search keep it.
 */
export function withoutDepartment(name: string, brand?: string) {
  const full = name.trim(), mark = (brand ?? '').trim();
  const strip = (text: string) => { const rest = text.replace(departmentWords, ''); return rest.length >= 3 && /\p{L}/u.test(rest) ? rest : text; };
  if (mark && full.slice(0, mark.length).toLocaleLowerCase() === mark.toLocaleLowerCase() && /^\s/.test(full.slice(mark.length))) {
    const after = full.slice(mark.length).trimStart(), rest = strip(after);
    return rest === after ? full : `${full.slice(0, mark.length)} ${rest}`;
  }
  return strip(full);
}

/** Who the item is for, read from the start of its title (or right after the brand) when the facets do not say it. */
export function departmentInName(name: string, brand?: string): NameDepartment | undefined {
  let text = name.trim();
  const mark = (brand ?? '').trim();
  if (mark && text.slice(0, mark.length).toLocaleLowerCase() === mark.toLocaleLowerCase()) text = text.slice(mark.length).trimStart();
  const match = departmentWords.exec(text);
  if (!match) return undefined;
  const index = match.slice(1).findIndex(Boolean);
  return index >= 0 ? departmentKeys[index] : undefined;
}

const departmentText: Record<NameDepartment, { ru: string; uz: string; en: string }> = {
  men: { ru: 'Мужское', uz: 'Erkaklar uchun', en: 'Men' },
  women: { ru: 'Женское', uz: 'Ayollar uchun', en: 'Women' },
  kids: { ru: 'Детское', uz: 'Bolalar uchun', en: 'Kids' },
  baby: { ru: 'Для малышей', uz: 'Chaqaloqlar uchun', en: 'Baby' },
  unisex: { ru: 'Унисекс', uz: 'Uniseks', en: 'Unisex' },
};
/** The card's small "who it is for" label: the facets' department, else the word read from the title. Latin uz; the caller converts for oz. */
export function departmentLabel(product: { name: string; brand?: string; facets?: { department?: string } }, locale: 'ru' | 'uz' | 'en'): string {
  const key = (product.facets?.department ?? departmentInName(product.name, product.brand)) as NameDepartment | undefined;
  return key && departmentText[key] ? departmentText[key][locale] : '';
}
