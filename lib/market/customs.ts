// Informational personal courier-import estimate. Never part of an Atlas charge or quote.
// PP-4508's consolidated 2026-09-01 text shows 20% / $2 per kg, while UP-174 §8
// expressly schedules that rate from 2027-01-01. Do not estimate the disputed
// 2026-09-01–2026-12-31 period until the effective date is confirmed with Customs.
export const customsCheckedOn = '2026-09-29';
export const courierAllowanceUsd = 200;
const customsRuleDisputeStart = '2026-09-01';
const scheduledCourierRateStart = '2027-01-01';
export const customsReferences = [
  { title: 'ПКМ №244: лимит личного курьерского ввоза', url: 'https://lex.uz/docs/7484114' },
  { title: 'ПП-4508: действующая сводная редакция', url: 'https://lex.uz/ru/docs/4585744?ONDATE=01.09.2026' },
  { title: 'УП-174: ставка и дата начала применения', url: 'https://lex.uz/uz/docs/8444993' },
  { title: 'ПП-136: отдельный режим бондовых складов', url: 'https://lex.uz/docs/8131421' },
];
function validArrivalDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
export function courierRateNeedsConfirmation(date: string) {
  return validArrivalDate(date) && date >= customsRuleDisputeStart && date < scheduledCourierRateStart;
}
export function courierRule(date: string) {
  if (!validArrivalDate(date) || date < '2025-05-01' || courierRateNeedsConfirmation(date)) return null;
  return date >= scheduledCourierRateStart ? { rate: 0.2, minimumPerKg: 2 } : { rate: 0.3, minimumPerKg: 3 };
}
export function estimateCourierCustoms({ valueUsd, usedUsd = 0, grossKg, date }: { valueUsd: number; usedUsd?: number; grossKg?: number; date: string }) {
  const rule = courierRule(date);
  if (!rule || ![valueUsd, usedUsd].every(n => Number.isFinite(n) && n >= 0 && n <= 1_000_000) || (grossKg !== undefined && (!Number.isFinite(grossKg) || grossKg <= 0 || grossKg > 1000))) return null;
  const cents = (n: number) => Math.round(n * 100) / 100;
  const remainingUsd = Math.max(0, courierAllowanceUsd - usedUsd);
  const excessUsd = cents(Math.max(0, valueUsd - remainingUsd));
  const lowerUsd = cents(excessUsd * rule.rate);
  // Dutiable weight is unknown until allocation by customs. Do not invent a pro-rata
  // weight: give a range from the value-based amount to the full provided gross-weight floor.
  const upperUsd = !excessUsd ? 0 : grossKg === undefined ? undefined : cents(Math.max(lowerUsd, grossKg * rule.minimumPerKg));
  return { ...rule, remainingUsd, excessUsd, lowerUsd, upperUsd };
}
