import { z } from 'zod';

/**
 * Promo codes (redesign stage 6, 1 November 2026). The operator creates them in the admin («Промокоды»); the customer
 * types one at checkout. A code takes money only off the Сервис Atlas line — the Atlas fee (`service` with `buyout` and
 * `conversion`) — never off the goods, the store delivery, international delivery, the guarantee or the duty, and never
 * below zero. Atlas acts as the buyer's agent, so the discount lowers Atlas's own income (lib/market/finance.ts); the
 * goods stay transit at full price. Pure helpers shared by the server (POST /api/actions checks and counts the use) and
 * the checkout page (shows the same discount before the order); nothing here trusts the browser.
 */

export const promoKinds = ['percent', 'fixed'] as const;
export type PromoKind = (typeof promoKinds)[number];

/** Codes are stored and compared in upper case without spaces: «summer10», « SUMMER10 » and «SUMMER10» are one code. */
export const normalizePromoCode = (value: string) => value.normalize('NFKC').replace(/\s+/g, '').toUpperCase();
/** 3–30 Latin letters, digits, «-» and «_»; the first one a letter or digit. */
export const promoCodePattern = /^[A-Z0-9][A-Z0-9_-]{2,29}$/;

const day = 24 * 60 * 60_000;
const optionalTime = z.number().int().nonnegative().max(8_640_000_000_000).nullable().optional();
const optionalCount = z.number().int().min(1).max(1_000_000).nullable().optional();

/** What the operator sends (admin form). Amounts in soum, percent from 1 to 100. */
export const promoInputSchema = z.object({
  id: z.string().min(1).max(80).optional(),
  code: z.string().trim().min(3).max(40).transform(normalizePromoCode).refine((code) => promoCodePattern.test(code), 'code'),
  kind: z.enum(promoKinds),
  value: z.number().finite().positive().max(100_000_000),
  /** Valid from / to (ms, inclusive start, exclusive end). Either may be absent. */
  startsAt: optionalTime,
  endsAt: optionalTime,
  /** Uses in total across all customers; absent = no cap. */
  maxUses: optionalCount,
  /** The order sum (soum) the code starts from; absent = any order. */
  minOrder: z.number().int().min(1).max(10_000_000_000).nullable().optional(),
  active: z.boolean(),
  note: z.string().trim().max(200).optional(),
}).superRefine((value, context) => {
  if (value.kind === 'percent' && (value.value > 100 || value.value < 1)) context.addIssue({ code: 'custom', path: ['value'], message: 'percent' });
  if (value.kind === 'fixed' && !Number.isInteger(value.value)) context.addIssue({ code: 'custom', path: ['value'], message: 'fixed' });
  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) context.addIssue({ code: 'custom', path: ['endsAt'], message: 'window' });
});
export type PromoInput = z.infer<typeof promoInputSchema>;

/** A stored code (market_promo_codes) with its use count. */
export type PromoRule = {
  id: string;
  code: string;
  kind: PromoKind;
  value: number;
  startsAt?: number | null;
  endsAt?: number | null;
  maxUses?: number | null;
  minOrder?: number | null;
  active: boolean;
  uses: number;
  note?: string | null;
  createdAt?: number;
  updatedAt?: number;
  /** Sum of the discounts given (admin list only). */
  discountTotal?: number;
};

/** The code as it is kept with each order of a checkout (orderSchema.promo). */
export type AppliedPromo = { id: string; code: string; kind: PromoKind; value: number };

/** Refusal codes (lib/market/i18n.ts): unknown or switched off, outside its dates, used up, order below the minimum, discount changed. */
export const promoErrors = { unknown: 'err_86', expired: 'err_87', usedUp: 'err_88', minOrder: 'err_89', changed: 'err_90' } as const;

type QuoteLike = { service: number; buyout?: number; conversion?: number; total: number; customsDuty?: number };
type LineLike = { id: string; quote: QuoteLike };

/** The part of a line the code may lower: the Atlas fee in Сервис Atlas (the delivery inside that line is not discounted). */
export const promoBase = (quote: Pick<QuoteLike, 'service' | 'buyout' | 'conversion'>) => Math.max(0, quote.service + (quote.buyout ?? 0) + (quote.conversion ?? 0));

/** The order sum a minimum is compared with: everything in the bill except a prepaid duty, before the discount. */
export const promoOrderSum = (lines: { quote: QuoteLike }[]) => lines.reduce((sum, line) => sum + line.quote.total - (line.quote.customsDuty ?? 0), 0);

/**
 * Why the code cannot be used now (an error code), or undefined. `orderSum` is checked against the minimum only when
 * given (the code check on the checkout page leaves it to the page, which knows the cart).
 */
export function promoProblem(rule: Pick<PromoRule, 'active' | 'startsAt' | 'endsAt' | 'maxUses' | 'uses' | 'minOrder'> | null | undefined, now: number, orderSum?: number): string | undefined {
  if (!rule || !rule.active) return promoErrors.unknown;
  if ((rule.startsAt && now < rule.startsAt) || (rule.endsAt && now >= rule.endsAt)) return promoErrors.expired;
  if (rule.maxUses && rule.uses >= rule.maxUses) return promoErrors.usedUp;
  if (orderSum !== undefined && rule.minOrder && orderSum < rule.minOrder) return promoErrors.minOrder;
  return undefined;
}

/**
 * The discount for these lines, in whole soum, and each line's share. Percent: of the Atlas fee, rounded down. Fixed:
 * the amount, at most the Atlas fee. Shared in proportion to each line's fee (the last line takes what rounding left),
 * so no line ever goes below zero and the total never exceeds the fee.
 */
export function promoDiscount(rule: Pick<PromoRule, 'kind' | 'value'>, lines: LineLike[]): { total: number; perLine: Map<string, number> } {
  const perLine = new Map<string, number>();
  const bases = lines.map((line) => promoBase(line.quote));
  const base = bases.reduce((sum, value) => sum + value, 0);
  if (base <= 0 || !(rule.value > 0)) return { total: 0, perLine };
  const wanted = rule.kind === 'percent' ? Math.floor(base * Math.min(100, rule.value) / 100) : Math.floor(rule.value);
  const total = Math.max(0, Math.min(base, wanted));
  let left = total;
  lines.forEach((line, index) => {
    const share = index === lines.length - 1 ? left : Math.min(bases[index], Math.floor(total * bases[index] / base));
    const amount = Math.max(0, Math.min(share, bases[index], left));
    left -= amount;
    if (amount) perLine.set(line.id, amount);
  });
  // Rounding left a little and the last line had no room: it goes to the first line that still has some.
  for (let index = 0; left > 0 && index < lines.length; index++) {
    const room = bases[index] - (perLine.get(lines[index].id) ?? 0);
    const extra = Math.min(room, left);
    if (extra > 0) { perLine.set(lines[index].id, (perLine.get(lines[index].id) ?? 0) + extra); left -= extra; }
  }
  return { total: total - left, perLine };
}

/** The admin form suggests a code valid for 30 days from today. */
export const defaultPromoDays = 30;
export const promoDefaultEnd = (now: number) => now + defaultPromoDays * day;

/** The public part of a code the checkout page may see (no use counts, no notes). */
export type PromoPreview = { code: string; kind: PromoKind; value: number; minOrder?: number | null; endsAt?: number | null };
export const promoPreview = (rule: PromoRule): PromoPreview => ({ code: rule.code, kind: rule.kind, value: rule.value, minOrder: rule.minOrder ?? null, endsAt: rule.endsAt ?? null });
