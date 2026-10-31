/**
 * «Топ-цена» (owner, 1 November 2026): only the best ~12 % of the published catalogue, so the badge still means something.
 * Computed on the server where the public catalogue is built (catalog-editor.ts `publicCatalog`): every visitor sees
 * the same badges, and the browser never decides on its own which deal is the best.
 *
 * A deal's score is its discount (%) × what it saves ($): −60 % off a $20 T-shirt ($12) loses to −40 % off a $150
 * jacket ($60). Cards are ranked inside their category (shoes against shoes), then the categories are interleaved by
 * rank share — the best of every category first, then the second best… — so one large category does not take every
 * badge. At least a 30 % store discount qualifies, and only on a price the store confirmed in the last two weeks
 * (review, 1 November 2026): «Топ-цена» promises more than «−N %», so a dated price («≈ … на 13 сент») keeps its «−N %»
 * pill but never this badge. On a catalogue whose prices are all older, no card has it.
 */
export const topDealShare = 0.12;
export const topDealMinPercent = 30;
export const topDealMaxAgeMs = 14 * 24 * 60 * 60 * 1000;

/** The price may carry «Топ-цена»: confirmed (not waiting for a re-check) and read from the store at most two weeks ago. */
export function topDealPriceFresh(product: { priceNeedsConfirmation?: boolean; sourceCheckedAt?: number }, now: number) {
  return product.priceNeedsConfirmation !== true && typeof product.sourceCheckedAt === 'number' && now - product.sourceCheckedAt <= topDealMaxAgeMs;
}

export type TopDealCandidate = {
  id: string; category: string;
  /** Store discount in whole percent (reference price against the current one). */
  discount: number;
  /** Reference price minus current price, USD. */
  savingsUsd: number;
};

const score = (item: TopDealCandidate) => item.discount * item.savingsUsd;

/** Ids of the products that get the badge: at most `share` of the whole list (one at least when anything qualifies). */
export function topDealIds(items: TopDealCandidate[], share = topDealShare): Set<string> {
  const eligible = items.filter((item) => item.discount >= topDealMinPercent && item.savingsUsd > 0 && Number.isFinite(score(item)));
  if (!eligible.length) return new Set();
  const budget = Math.max(1, Math.round(items.length * share));
  const sizes = new Map<string, number>();
  for (const item of items) sizes.set(item.category, (sizes.get(item.category) ?? 0) + 1);
  const byCategory = new Map<string, TopDealCandidate[]>();
  for (const item of eligible) byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
  const ranked: { item: TopDealCandidate; place: number }[] = [];
  for (const [category, list] of byCategory) {
    list.sort((a, b) => score(b) - score(a) || b.discount - a.discount || a.id.localeCompare(b.id));
    // Place 0.05 is "in the best 5 % of its category": a category's 1st of 20 comes before another's 1st of 3.
    list.forEach((item, index) => ranked.push({ item, place: (index + 1) / sizes.get(category)! }));
  }
  ranked.sort((a, b) => a.place - b.place || score(b.item) - score(a.item) || a.item.id.localeCompare(b.item.id));
  return new Set(ranked.slice(0, budget).map(({ item }) => item.id));
}
