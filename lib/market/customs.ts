// Informational personal courier-import estimate. Never part of an Atlas charge or quote.
// PP-4508: excess value, unified payment (no additional VAT).
// UP-174 §8 explicitly schedules 20% / $2 per kg from 2027-01-01.
export const customsCheckedOn = '2026-09-11';
export const courierAllowanceUsd = 200;
export const customsReferences = [
  { title: 'ПКМ №244: лимит курьерского ввоза', url: 'https://lex.uz/docs/7484114' },
  { title: 'ПП-4508: единый таможенный платёж', url: 'https://lex.uz/docs/4585742' },
  { title: 'УП-174, п. 8: ставка с 01.01.2027', url: 'https://lex.uz/docs/8444993' },
  { title: 'ПП-136: отдельный режим бондовых складов', url: 'https://lex.uz/docs/8131421' },
];
export function courierRule(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < '2025-05-01') return null;
  return date >= '2027-01-01' ? { rate: 0.2, minimumPerKg: 2 } : { rate: 0.3, minimumPerKg: 3 };
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
