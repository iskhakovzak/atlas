import { normalizePricing, type Pricing } from './domain.ts';

/** The Central Bank of Uzbekistan's official USD rate (JSON, no key needed). */
export const cbuUsdUrl = 'https://cbu.uz/ru/arkhiv-kursov-valyut/json/USD/';
/** The rate is published once a day; the server asks again after this long. */
export const fxRefreshAfterMs = 6 * 60 * 60_000;

/** Read the USD rate and its date ("03.10.2026" → "2026-10-03") from the CBU response; null if it looks wrong. */
export function parseCbuRate(body: unknown): { rate: number; date: string } | null {
  const row = Array.isArray(body) ? body.find((item) => item && typeof item === 'object' && (item as { Ccy?: unknown }).Ccy === 'USD') as { Rate?: unknown; Date?: unknown; Nominal?: unknown } | undefined : undefined;
  if (!row) return null;
  const rate = Number(String(row.Rate ?? '').replace(',', '.'));
  const nominal = Number(row.Nominal ?? 1);
  const date = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(row.Date ?? ''));
  if (!Number.isFinite(rate) || nominal !== 1 || rate < 1000 || rate > 100_000 || !date) return null;
  return { rate: Math.round(rate * 100) / 100, date: `${date[3]}-${date[2]}-${date[1]}` };
}

/** Whether the server should read the CBU rate again for this tariff. */
export function fxRefreshDue(pricing: Pick<Pricing, 'fxSource' | 'fxUpdatedAt'>, now = Date.now()) {
  return pricing.fxSource === 'cbu' && (!pricing.fxUpdatedAt || now - pricing.fxUpdatedAt >= fxRefreshAfterMs);
}

/**
 * The tariff with a new CBU rate. A different rate in soum is a new tariff version, so carts quoted at the old
 * rate are shown again before checkout; the same rate only records when it was checked.
 */
export function withCbuRate(pricing: Pricing, cbu: { rate: number; date: string }, now = Date.now()): Pricing {
  const next = normalizePricing({ ...pricing, fxCbuRate: cbu.rate, fxCbuDate: cbu.date, fxUpdatedAt: now });
  return next.fx === pricing.fx ? next : { ...next, version: `cbu-${cbu.date}-${now}`.slice(0, 80), updatedAt: now };
}
