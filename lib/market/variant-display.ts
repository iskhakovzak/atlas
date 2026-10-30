// Short names for store options (eBay lists every item specific on every option: brand, department, material…).

type OptionLike = { label: string; options?: { name: string; value: string }[]; price?: number };

const valueOf = (item: OptionLike, name: string) => item.options?.find((option) => option.name === name)?.value;

/** `follower` adds nothing once `leader` is known: every value of the leader comes with one value of the follower. */
function follows(items: OptionLike[], leader: string, follower: string) {
  const seen = new Map<string | undefined, string | undefined>();
  for (const item of items) {
    const key = valueOf(item, leader), value = valueOf(item, follower);
    if (seen.has(key) && seen.get(key) !== value) return false;
    seen.set(key, value);
  }
  return true;
}

/**
 * The axes that tell the options apart, in the store's order: an axis with one value for all of them (Brand: adidas)
 * is dropped, and so is one that only repeats an earlier axis (eBay's "Size: 5-" beside "US Shoe Size: 5.5").
 */
export function distinguishingAxes(items: OptionLike[]): string[] {
  const names = [...new Set(items.flatMap((item) => (item.options ?? []).map((option) => option.name)))];
  const varying = names.filter((name) => new Set(items.map((item) => valueOf(item, name))).size > 1);
  return varying.filter((name, index) => !varying.slice(0, index).some((earlier) => follows(items, earlier, name)));
}

/**
 * What a tile shows: the values of the distinguishing axes ("5.5", or "Black · 5.5"), the axis names once as the
 * group heading, and whether a price on each tile says anything (it does only when the prices differ).
 */
export function optionDisplay(items: OptionLike[]) {
  const axes = distinguishingAxes(items);
  const text = (item: OptionLike) => {
    const values = axes.map((name) => valueOf(item, name)).filter(Boolean);
    return values.length ? values.join(' · ') : item.label;
  };
  const prices = new Set(items.map((item) => item.price).filter((price) => price !== undefined));
  return { axes, text, priceVaries: prices.size > 1 };
}
