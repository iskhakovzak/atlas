import type { Locale } from './i18n.ts';
import { courierAllowanceUsd } from './customs.ts';
import { formatUsd } from './home-copy.ts';
import {withCyrillic} from './uz-cyrl.ts';

/**
 * Short notes the store card shows for stores that deserve a warning before ordering, keyed by StoreBrand.key.
 * A note may take the dispatch days of the store country (storeCountryTerms) and the duty-free allowance the
 * page counts with, so it never repeats a number the tariff or the settings may have changed.
 */
export type StoreNoteContext = { days: string | null; limit: string };
type Note = Record<Locale, string | ((context: StoreNoteContext) => string)>;

const usedGoods: Note = withCyrillic({
  ru: 'Часто б/у и остатки: смотрите состояние и продавца.',
  uz: 'Ko‘pincha ishlatilgan va qoldiq tovarlar: holati va sotuvchiga qarang.',
  en: 'Often used items and leftovers: check the condition and the seller.',
});
const supplements: Note = withCyrillic({
  ru: 'БАДы и витамины: проверьте нормы ввоза.',
  uz: 'BFQ va vitaminlar: olib kirish me’yorlarini tekshiring.',
  en: 'Supplements and vitamins: check the import allowances.',
});
const fromChina: Note = withCyrillic({
  ru: ({ days }) => `Отправка из Китая${days ? `, сроки ${days}` : ''}.`,
  uz: ({ days }) => `Xitoydan jo‘natiladi${days ? `, muddati ${days}` : ''}.`,
  en: ({ days }) => `Ships from China${days ? `, ${days}` : ''}.`,
});
// Duty is customs' decision: the note names the allowance and says it is an estimate.
const luxury: Note = withCyrillic({
  ru: ({ limit }) => `При цене выше ${limit} — пошлина сверх лимита (оценка).`,
  uz: ({ limit }) => `Narx ${limit} dan yuqori bo‘lsa — limitdan ortig‘iga boj (taxmin).`,
  en: ({ limit }) => `Above ${limit}, duty applies to the excess over the allowance (estimate).`,
});
const resale: Note = withCyrillic({
  ru: 'Площадка перепродажи: цена зависит от размера.',
  uz: 'Qayta sotish maydonchasi: narx o‘lchamga bog‘liq.',
  en: 'A resale marketplace: the price depends on the size.',
});

export const storeNotes: Record<string, Note> = {
  ebay: usedGoods,
  iherb: supplements,
  aliexpress: fromChina, xiaomi: fromChina,
  gucci: luxury, prada: luxury, dior: luxury, chanel: luxury, louisvuitton: luxury, valentino: luxury, moncler: luxury, tiffany: luxury,
  stockx: resale, goat: resale,
};

/**
 * The note for a store, or undefined when the store needs none. `days` is the express range of its country
 * ("7–9 раб. дней"); `limit` the formatted duty-free allowance (the courier allowance unless the caller knows better).
 */
export function storeNote(key: string, locale: Locale, context: Partial<StoreNoteContext> = {}): string | undefined {
  const note = storeNotes[key]?.[locale];
  if (typeof note !== 'function') return note;
  return note({ days: context.days ?? null, limit: context.limit ?? formatUsd(courierAllowanceUsd, locale) });
}
