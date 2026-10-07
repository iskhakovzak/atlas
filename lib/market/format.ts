import type { Locale } from './i18n.ts';
import {withCyrillic,uzText} from './uz-cyrl.ts';
import {isUzbek} from './i18n.ts';

// Number, money, date and weight formatting shared by every page. Kept apart from the home page copy
// (home-copy.ts re-exports it) so pages that only format a sum do not load the home page texts.
/** Whole number with non-breaking-space thousand groups: 1234567 → "1 234 567". */
export function groupDigits(amount: number) {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Soum amounts with space-grouped digits in every language: "1 234 567 сум".
 * Digits never split; the currency word may wrap as a whole on narrow cards. */
export function formatSum(amount: number, locale: Locale) {
  return `${groupDigits(amount)} ${locale === 'ru' ? 'сум' : isUzbek(locale) ? uzText(locale, 'so‘m') : 'UZS'}`;
}

/** Dollar rates as the carrier writes them: "$15", "$1,5" (ru/uz) or "$1.5" (en). */
export function formatUsd(amount: number, locale: Locale) {
  const value = Math.round(amount * 100) / 100;
  return `$${Number.isInteger(value) ? value : value.toFixed(2).replace(/0$/, '').replace('.', locale === 'en' ? '.' : ',')}`;
}

/** Russian noun form for a count: ruPlural(207, ['магазин', 'магазина', 'магазинов']) → "магазинов". */
export function ruPlural(count: number, forms: [string, string, string]) {
  const tail = count % 100, last = count % 10;
  return tail >= 11 && tail <= 14 ? forms[2] : last === 1 ? forms[0] : last >= 2 && last <= 4 ? forms[1] : forms[2];
}

/** A store price in dollars, always with cents when it has them: "$2,72", "$2,70", "$100" (en: "$2.72"). */
export function formatPriceUsd(amount: number, locale: Locale) {
  const value = Math.round(amount * 100) / 100;
  return `$${Number.isInteger(value) ? value : value.toFixed(2).replace('.', locale === 'en' ? '.' : ',')}`;
}

const monthNames: Record<Locale, string[]> = /*@__PURE__*/withCyrillic({
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
});
/** Day and month in Tashkent time, spelled the same on the server and in the browser: "3 октября", "3-oktabr", "3 October". */
export function formatDayMonth(time: number, locale: Locale) {
  const date = new Date(time + 5 * 3_600_000);
  const day = date.getUTCDate(), month = monthNames[locale][date.getUTCMonth()];
  return isUzbek(locale) ? uzText(locale, `${day}-${month}`) : `${day} ${month}`;
}

/** A share as people write it: 0.0998 → "9,98%" (ru/uz) or "9.98%" (en); never rounded to "10%". */
export function formatPercent(share: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 2 }).format(share * 100) + '%';
}

/** Weights in kilograms with a decimal comma outside English: 1.3 → "1,3". */
export function formatKg(kg: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 2 }).format(kg);
}
