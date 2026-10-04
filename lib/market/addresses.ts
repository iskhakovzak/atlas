export const regions = ["Ташкент", "Республика Каракалпакстан", "Андижанская область", "Бухарская область", "Джизакская область", "Кашкадарьинская область", "Навоийская область", "Наманганская область", "Самаркандская область", "Сурхандарьинская область", "Сырдарьинская область", "Ташкентская область", "Ферганская область", "Хорезмская область"];

export const cities = ["Ташкент", "Нукус", "Андижан", "Бухара", "Джизак", "Карши", "Навои", "Наманган", "Самарканд", "Термез", "Гулистан", "Нурафшан", "Фергана", "Ургенч", "Коканд", "Чирчик", "Алмалык", "Бекабад"];

export const streets = ["ул. Амира Темура", "ул. Шота Руставели", "ул. Нукусская", "ул. Мукими", "ул. Бунёдкор", "ул. Беруни", "ул. Буюк Ипак Йули", "ул. Мирзо Улугбека", "ул. Афросиаб", "ул. Навои", "ул. Бабура", "ул. Истикбол", "ул. Тараса Шевченко", "ул. Фурката", "ул. Катта Миробод"];

/** Region names stay Russian in saved addresses; these are display labels only. */
const regionNames: Record<string, { uz: string; en: string; capital: string }> = {
  "Ташкент": { uz: "Toshkent shahri", en: "Tashkent city", capital: "Ташкент" },
  "Республика Каракалпакстан": { uz: "Qoraqalpog‘iston Respublikasi", en: "Republic of Karakalpakstan", capital: "Нукус" },
  "Андижанская область": { uz: "Andijon viloyati", en: "Andijan Region", capital: "Андижан" },
  "Бухарская область": { uz: "Buxoro viloyati", en: "Bukhara Region", capital: "Бухара" },
  "Джизакская область": { uz: "Jizzax viloyati", en: "Jizzakh Region", capital: "Джизак" },
  "Кашкадарьинская область": { uz: "Qashqadaryo viloyati", en: "Kashkadarya Region", capital: "Карши" },
  "Навоийская область": { uz: "Navoiy viloyati", en: "Navoi Region", capital: "Навои" },
  "Наманганская область": { uz: "Namangan viloyati", en: "Namangan Region", capital: "Наманган" },
  "Самаркандская область": { uz: "Samarqand viloyati", en: "Samarkand Region", capital: "Самарканд" },
  "Сурхандарьинская область": { uz: "Surxondaryo viloyati", en: "Surkhandarya Region", capital: "Термез" },
  "Сырдарьинская область": { uz: "Sirdaryo viloyati", en: "Syrdarya Region", capital: "Гулистан" },
  "Ташкентская область": { uz: "Toshkent viloyati", en: "Tashkent Region", capital: "Нурафшан" },
  "Ферганская область": { uz: "Farg‘ona viloyati", en: "Fergana Region", capital: "Фергана" },
  "Хорезмская область": { uz: "Xorazm viloyati", en: "Khorezm Region", capital: "Ургенч" },
};

export function regionLabel(region: string, locale: "ru" | "uz" | "en") {
  return locale === "ru" ? region : regionNames[region]?.[locale] ?? region;
}

/** The regional centre, used to prefill an empty city when a region is picked. */
export function regionCapital(region: string) {
  return regionNames[region]?.capital;
}

/** The nine local digits of an Uzbek number, whatever way it was typed or stored. */
/** The nine local digits of an Uzbek number. A stored or pasted international form ("+998 90 1…",
 * "998901234567") loses its country code; a local number that starts with 99 8… keeps it. */
export function uzPhoneDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (/^\s*\+\s*998/.test(value) || (digits.length >= 12 && digits.startsWith("998"))) digits = digits.slice(3);
  return digits.slice(0, 9);
}

/** Digits to the left of a caret in a grouped value. */
export function digitsBefore(value: string, position: number) {
  return value.slice(0, position).replace(/\D/g, "").length;
}

/** Caret index in "90 123 45 67" right after the given number of digits. */
export function caretAfterDigits(formatted: string, count: number) {
  if (count <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < formatted.length; index++) if (/\d/.test(formatted[index]) && ++seen === count) return index + 1;
  return formatted.length;
}

/**
 * One edit of the local phone field: the new digits and how many digits stay left of the caret.
 * A tenth digit typed into a full number is ignored instead of pushing the last one out.
 */
export function editUzPhone(previous: string, raw: string, caret: number) {
  const all = raw.replace(/\D/g, "");
  if (/^\s*\+\s*998/.test(raw) || (all.length >= 12 && all.startsWith("998"))) {
    const digits = uzPhoneDigits(raw);
    return { digits, caret: digits.length };
  }
  if (all.length > 9) return { digits: previous, caret: Math.max(0, Math.min(previous.length, digitsBefore(raw, caret) - (all.length - previous.length))) };
  return { digits: all, caret: digitsBefore(raw, caret) };
}

/** Backspace or Delete next to a group space removes the neighbouring digit, not only the space. */
export function deleteAcrossSpace(digits: string, formatted: string, caret: number, key: "Backspace" | "Delete") {
  const space = key === "Backspace" ? caret - 1 : caret;
  if (formatted[space] !== " ") return null;
  const before = digitsBefore(formatted, caret);
  return key === "Backspace"
    ? { digits: digits.slice(0, before - 1) + digits.slice(before), caret: before - 1 }
    : { digits: digits.slice(0, before) + digits.slice(before + 1), caret: before };
}

/** "901234567" → "90 123 45 67"; partial input is grouped as it is typed. */
export function formatUzLocal(digits: string) {
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean).join(" ");
}

/** Stored form: "+998 90 123 45 67". */
export function uzPhone(digits: string) {
  return digits ? `+998 ${formatUzLocal(digits)}` : "";
}

export function suggestions(values: string[], query: string) {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return values.slice(0, 12);
  return values.filter((value) => value.toLocaleLowerCase("ru").includes(needle)).slice(0, 12);
}
