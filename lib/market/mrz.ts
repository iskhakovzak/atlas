/**
 * Machine-readable zone of a passport (TD3: 2 lines of 44) or an ID card (TD1: 3 lines of 30, the Uzbek
 * biometric ID card's back side). OCR text is noisy, so lines are found by their length and shape, and the
 * document number and dates are checked with their ICAO 9303 check digits; letters OCR confuses with digits
 * (O/0, I/1, B/8, S/5, Z/2, G/6) are corrected where a field must be numeric.
 */
export type MrzFields = { lastName?: string; firstName?: string; passportNumber?: string; nationality?: string; birthDate?: string; documentType?: 'passport' | 'id-card' };

const toDigit: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', B: '8', S: '5', Z: '2', G: '6' };
const digits = (value: string) => value.replace(/[A-Z]/g, (char) => toDigit[char] ?? char);
const weights = [7, 3, 1];
const charValue = (char: string) => char === '<' ? 0 : /\d/.test(char) ? Number(char) : char.charCodeAt(0) - 55;
export function checkDigit(value: string) { let sum = 0; for (let i = 0; i < value.length; i++) sum += charValue(value[i]) * weights[i % 3]; return sum % 10; }
const valid = (value: string, check: string) => /^\d$/.test(check) && checkDigit(value) === Number(check);

function date(value: string, past: boolean, now = new Date()) {
  if (!/^\d{6}$/.test(value)) return undefined;
  const yy = Number(value.slice(0, 2)), mm = Number(value.slice(2, 4)), dd = Number(value.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;
  const current = now.getFullYear() % 100, year = past ? (yy > current ? 1900 + yy : 2000 + yy) : 2000 + yy;
  return `${year}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
}
function names(field: string) {
  // Filler "<" read as K or L leaves a tail like "KLLLLLLKL": it is cut off with the real filler.
  const [last = '', ...rest] = field.replace(/[<KL]{5,}$/, '').replace(/<+$/, '').split('<<');
  const clean = (value: string) => value.replace(/<+/g, ' ').replace(/[0-9]/g, '').trim();
  return { lastName: clean(last) || undefined, firstName: clean(rest.join(' ')) || undefined };
}
/** The document number with its check digit: as read, or with letters turned into digits where that makes it valid. */
function documentNumber(field: string, check: string) {
  const raw = field.replace(/<+$/, '');
  // Uzbek numbers are two letters and seven digits (AA1234567): letters read in the digit part are always
  // corrected when the result checks out (some swaps, like 6 and G, leave the check digit unchanged).
  const fixed = field.slice(0, 2) + digits(field.slice(2));
  if (fixed !== field && /^[A-Z]{2}\d{7}$/.test(fixed) && valid(fixed, digits(check))) return fixed;
  return raw;
}

export function parseMrzText(text: string): MrzFields {
  // OCR shortens runs of "<" fillers, so lines are recognised by their shape, not their length; the fields
  // read here all sit before the fillers.
  const lines = text.toUpperCase().split(/\r?\n/).map((line) => line.replace(/\s+/g, '').replace(/[«‹]/g, '<').replace(/[^A-Z0-9<]/g, '')).filter((line) => line.length >= 10);
  // Passport: "P<UZB" + names, then the number line (9-character number, check digit, nationality, birth date).
  const p = lines.findIndex((line, index) => /^P[A-Z<][A-Z]{3}/.test(line) && /^[A-Z0-9<]{9}[0-9A-Z][A-Z<]{3}[0-9A-Z]{6}/.test(lines[index + 1] ?? ''));
  if (p >= 0) {
    const first = lines[p].padEnd(44, '<'), second = lines[p + 1].padEnd(44, '<');
    const birth = digits(second.slice(13, 19));
    return { ...names(first.slice(5)), passportNumber: documentNumber(second.slice(0, 9), second[9]), nationality: second.slice(10, 13).replace(/</g, '') || undefined, birthDate: date(birth, true), documentType: 'passport' };
  }
  // ID card: "I<UZB" + number and check digit, then birth date/sex/expiry/nationality, then the names.
  const i = lines.findIndex((line, index) => /^[IAC][A-Z<][A-Z]{3}[A-Z0-9<]{9}[0-9A-Z]/.test(line) && /^[0-9A-Z]{7}[MFX<]/.test(lines[index + 1] ?? ''));
  if (i >= 0 && lines[i + 2]) {
    const first = lines[i].padEnd(30, '<'), second = lines[i + 1].padEnd(30, '<'), third = lines[i + 2].padEnd(30, '<');
    const birth = digits(second.slice(0, 6));
    return { ...names(third), passportNumber: documentNumber(first.slice(5, 14), first[14]), nationality: second.slice(15, 18).replace(/</g, '') || first.slice(2, 5).replace(/</g, '') || undefined, birthDate: date(birth, true), documentType: 'id-card' };
  }
  return {};
}
