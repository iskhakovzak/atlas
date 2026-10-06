import type { Pricing } from './domain.ts';

// Informational personal courier-import estimate. Never part of an Atlas charge or quote.
// Checked on lex.uz on 4 October 2026:
// - CM resolution No. 244 of 19.04.2025 (in force from 01.05.2025): goods for an individual in international
//   courier shipments are duty-free up to $200, and the norm applies "within one calendar month" (§3(b));
//   the single customs payment is charged on the part above the norm (§10). Postal shipments: $100.
// - PP-4508, consolidated text dated 01.09.2026: single customs payment 20% of customs value, at least $2 per kg.
// - UP-174 of 27.08.2026, §8: the same 20% / $2 per kg "from 1 January 2027". The dates conflict, so the
//   estimate says so and the parameters can be overridden in the tariff settings (Pricing.customs*).
export const customsCheckedOn = '2026-10-04';
export const courierAllowanceUsd = 200;
const customsRuleDisputeStart = '2026-09-01';
const scheduledCourierRateStart = '2027-01-01';
export const customsReferences = [
  { title: 'ПКМ №244: лимит $200 в календарный месяц, платёж с превышения', url: 'https://lex.uz/docs/7484114' },
  { title: 'ПП-4508: действующая сводная редакция', url: 'https://lex.uz/ru/docs/4585744?ONDATE=01.09.2026' },
  { title: 'УП-174: ставка и дата начала применения', url: 'https://lex.uz/uz/docs/8444993' },
  { title: 'ПП-136: отдельный режим бондовых складов', url: 'https://lex.uz/docs/8131458' },
];
function validArrivalDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
export function courierRateNeedsConfirmation(date: string) {
  return validArrivalDate(date) && date >= customsRuleDisputeStart && date < scheduledCourierRateStart;
}
export function courierRule(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < '2025-05-01') return null;
  // Follow the consolidated PP-4508 version effective 2026-09-01. UP-174 §8
  // separately gives 2027-01-01 as the start date; see the legal ambiguity above.
  return date >= '2026-09-01' ? { rate: 0.2, minimumPerKg: 2 } : { rate: 0.3, minimumPerKg: 3 };
}
/** The allowance and rate for a date, with the operator's overrides from the tariff settings when set. */
export function customsParams(pricing: Partial<Pick<Pricing, 'customsAllowanceUsd' | 'customsRate' | 'customsMinimumPerKg'>> | undefined, date: string) {
  const rule = courierRule(date) ?? { rate: 0.2, minimumPerKg: 2 };
  return {
    allowanceUsd: pricing?.customsAllowanceUsd ?? courierAllowanceUsd,
    rate: pricing?.customsRate ?? rule.rate,
    minimumPerKg: pricing?.customsMinimumPerKg ?? rule.minimumPerKg,
    needsConfirmation: pricing?.customsRate === undefined && courierRateNeedsConfirmation(date),
  };
}
/**
 * The single customs payment when the parcel is over the allowance: `rate` of the excess, but at least `minimumPerKg`
 * for each kg of the whole parcel (PP-4508). Owner, 7.10.2026: the parcel's full weight, not a share of it — the upper
 * end of the range `estimateCourierCustoms` shows, so the prepaid duty rarely needs topping up; what customs charges
 * less returns to the balance. The cart, its checkout and the "How customs is calculated" window all use this one
 * formula, so their amounts match.
 */
export function customsDutyUsd({ excessUsd, rate, minimumPerKg, weightKg = 0 }: { excessUsd: number; rate: number; minimumPerKg: number; weightKg?: number }) {
  if (!(excessUsd > 0)) return 0;
  return Math.round(Math.max(excessUsd * rate, (weightKg > 0 ? weightKg : 0) * minimumPerKg) * 100) / 100;
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
