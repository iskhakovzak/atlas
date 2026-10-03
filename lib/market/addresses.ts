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
export function uzPhoneDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length > 9 && digits.startsWith("998")) digits = digits.slice(3);
  return digits.slice(0, 9);
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
