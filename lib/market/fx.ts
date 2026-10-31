import { normalizePricing, type Pricing } from './domain.ts';

/** The Central Bank of Uzbekistan's official USD rate (JSON, no key needed). */
export const cbuUsdUrl = 'https://cbu.uz/ru/arkhiv-kursov-valyut/json/USD/';
/**
 * Banks' USD selling rates (bank.uz lists every Uzbek bank; it answers from the server abroad, cbu.uz does not).
 * The rate in use is a bank's selling rate × markup; the Central Bank rate stays as the fallback source.
 */
export const bankRatesUrl = 'https://bank.uz/currency';
/** The bank whose selling rate is preferred (National Bank of Uzbekistan); otherwise the middle of all banks' rates. */
export const preferredBank = 'nbu';

/** Read the USD selling rates from bank.uz's "best rates" USD tab; null if there are too few or they look wrong. */
export function parseBankSellRate(html: string, today: string): { rate: number; date: string; bank: string } | null {
  const start = html.indexOf('id="best_USD"');
  if (start < 0) return null;
  const end = html.indexOf('role="tabpanel"', start + 20);
  const tab = html.slice(start, end > start ? end : start + 200_000);
  const sell = tab.indexOf('bc-inner-blocks-right');
  if (sell < 0) return null;
  const rates = [...tab.slice(sell).matchAll(/href="\/currency\/bank\/([a-z0-9-]{1,60})"[\s\S]{0,600}?green-date">\s*(\d{1,3}(?: \d{3})*(?:\.\d{1,4})?)\s*сум/g)]
    .map((match) => ({ bank: match[1], rate: Number(match[2].replaceAll(' ', '')) }))
    .filter((row) => Number.isFinite(row.rate) && row.rate >= 1000 && row.rate <= 100_000);
  if (rates.length < 3) return null;
  const sorted = rates.map((row) => row.rate).sort((a, b) => a - b);
  const middle = sorted[Math.floor(sorted.length / 2)];
  const chosen = rates.find((row) => row.bank === preferredBank && Math.abs(row.rate - middle) / middle < 0.05) ?? { bank: 'median', rate: middle };
  return { rate: Math.round(chosen.rate * 100) / 100, date: today, bank: chosen.bank };
}

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
