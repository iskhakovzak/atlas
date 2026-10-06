/**
 * Capital letters as people write names and addresses, applied while they type. Only a lowercase letter at
 * the start is raised; the rest stays as typed ("McDonald", "ул." inside an address), and an apostrophe
 * inside an Uzbek word ("G‘ulomov", "O'tkir") is not a word start.
 */
const wordStart = /(^|[\s-])(\p{Ll})/gu;
/** Every word: "karimova zarina-xon" → "Karimova Zarina-Xon". For full names, surname and first name. */
export function capitalizeWords(value: string) {
  return value.replace(wordStart, (_, before: string, letter: string) => before + letter.toUpperCase());
}
/** Only the first letter: "навои 12, кв. 5" → "Навои 12, кв. 5". For addresses and cities. */
export function capitalizeFirst(value: string) {
  return value.replace(/^(\s*)(\p{Ll})/u, (_, before: string, letter: string) => before + letter.toUpperCase());
}
