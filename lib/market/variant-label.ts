// What a chosen option is called on every screen after the choice (cart, checkout, orders, notifications, toasts;
// 2 November 2026, owner: "чел уже выбрал — оставь самое основное"). The store's full item specifics stay in the data
// (sourceOptions); only the values that select an option are shown, value only, in picker order: colour, size type, size,
// then width, length and the like — "Black / White · Regular · 2XL". eBay's descriptive specifics (Department, Type,
// Style, Material, Brand, MPN…) and placeholder values ("see description", "Not Available") never show.
import { axisKind } from './variant-axes.ts';

type Option = { name: string; value: string };

// Axes a customer chooses between besides colour and size (lib/market/variant-axes.ts names them in the picker).
const choosingName = /^(?:width|shoe width|length|inseam|waist|waist size|leg length|cup size|band size|band \/ cup|pack|pack size|count|number of items|quantity|capacity|storage|storage capacity|volume|flavou?r|scent|shade|model|edition|configuration|set|bundle|объ[её]м|вариант)$/i;
const emptyValue = /^(?:see description|not available|n\/a|na|does not apply|not applicable|unbranded|-|—|\s*)$/i;

const clean = (value: unknown) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

/** Whether a store option names a choice (colour, size, width…) rather than describes the item (Department, Brand…). */
export function isChoosingOption(name: string, value: string): boolean {
  const key = clean(name), shown = clean(value).replace(/^"|"$/g, '');
  if (!key || !shown || emptyValue.test(shown)) return false;
  return axisKind(key) !== 'other' || choosingName.test(key);
}

const rank = (name: string) => ({ color: 0, fit: 1, size: 2, other: 3 })[axisKind(name)];

/**
 * The option's short name. With the store's options (or an eBay-style label "Name: Value · Name: Value"), only the
 * choosing values in picker order; a plain label ("Beige / White · M") is kept as it is, minus empty parts.
 */
export function variantSummary(variant = '', options?: readonly Option[]): string {
  const label = clean(variant);
  const named = label.split(' · ').map(part => /^([^:]{1,40}):\s*(.+)$/.exec(part.trim())).filter((match): match is RegExpExecArray => Boolean(match));
  const fromLabel = named.map(match => ({ name: match[1], value: match[2] }));
  const labelIsNamed = named.length > 0 && named.length === label.split(' · ').length;
  // A label with the store's names ("Size Type: Regular · Size: 2XL", sometimes cut short and followed by eBay's item
  // IDs) is rebuilt from the options; a plain label is already the short name.
  const source = (named.length > 0 && (options?.length || labelIsNamed)) || !label
    ? [...(options ?? []), ...fromLabel.filter(item => !(options ?? []).some(option => clean(option.name) === clean(item.name)))]
    : [];
  if (!source.length) return label.split(' · ').map(clean).filter(part => part && !emptyValue.test(part)).join(' · ');
  const seen = new Set<string>();
  const values = source
    .filter(option => isChoosingOption(option.name, option.value))
    .map((option, index) => ({ name: clean(option.name), value: clean(option.value).replace(/^"|"$/g, ''), index }))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.index - b.index)
    .filter(option => { const key = option.value.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; })
    .map(option => option.value);
  return values.join(' · ');
}
