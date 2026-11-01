// One variant picker for every product page (2 ноября 2026, owner: "сделай везде один стандарт").
// A store lists combinations ("Regular · 2XL · Black / White"); the page shows the dimensions instead — colour, then the
// other axes (size type, size, width…) as small chips — and finds the combination from what was picked on each axis.
// No imports from the app: the link-order page and the tests use it alike.
import { compareSizes } from './size-order.ts';

export type AxisOption = { name: string; value: string };
export type AxisVariant = {
  label: string;
  color?: string;
  size?: string;
  sizeLabel?: string;
  options?: AxisOption[];
  price?: number;
  available: boolean;
  availabilityKnown?: boolean;
  quantity?: number;
};
export type AxisKind = 'color' | 'fit' | 'size' | 'other';
export type VariantAxis = { name: string; kind: AxisKind; values: string[] };
export type AxisPicks = Record<string, string>;

const colorName = /^(?:main |primary |exterior )?(?:colou?r|shade|цвет|rang)$/i;
const fitName = /size type|size range|^fit$|тип размера|o[‘'`]?lcham turi/i;
const sizeName = /size|размер|o[‘'`]?lcham/i;
// Store identifiers that differ per option but tell the customer nothing (eBay lists the UPC of every option).
const identifierName = /^(?:upc|ean|gtin|isbn|mpn|sku|item number|model number|manufacturer part number|asin)$/i;

export function axisKind(name: string): AxisKind {
  const key = name.trim();
  return colorName.test(key) ? 'color' : fitName.test(key) ? 'fit' : sizeName.test(key) ? 'size' : 'other';
}

/** Can be ordered: on sale, or listed without a stock answer; only the store's own "sold out" closes it. */
export function orderable(item: Pick<AxisVariant, 'available' | 'availabilityKnown' | 'quantity'>): boolean {
  if (item.quantity === 0) return false;
  return item.availabilityKnown === false || item.available === true;
}

const clean = (value: unknown) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

/** The option's values by axis name: the store's options, with the importer's colour and size fields taking precedence. */
const dimensionCache = new WeakMap<AxisVariant, Map<string, string>>();
function dimensions(item: AxisVariant): Map<string, string> {
  const cached = dimensionCache.get(item);
  if (cached) return cached;
  const out = new Map<string, string>();
  for (const option of item.options ?? []) {
    const name = clean(option?.name), value = clean(option?.value);
    if (!name || !value || identifierName.test(name) || out.has(name)) continue;
    out.set(name, value);
  }
  const color = clean(item.color);
  if (color && ![...out.values()].includes(color)) {
    const existing = [...out.keys()].find(name => axisKind(name) === 'color');
    out.set(existing ?? 'Color', color);
  }
  const size = clean(item.size);
  if (size && ![...out.values()].includes(size)) {
    const name = clean(item.sizeLabel) || 'Size';
    out.set(out.has(name) && out.get(name) !== size ? `${name} ` : name, size);
  }
  dimensionCache.set(item, out);
  return out;
}

/** The value an option has on an axis ('' when the store did not name it). */
export function axisValue(item: AxisVariant, axis: string): string {
  return dimensions(item).get(axis) ?? '';
}

/**
 * The axes that tell the options apart. An axis with one value for all (Brand: adidas) is dropped; so is one that adds
 * no new combination to the axes already kept (eBay's "Size: 5-" beside "US Shoe Size: 5.5", or a UPC). Colour and
 * sizes are kept first, so a sparse list (Regular 2XL, Big & Tall 3XLT) keeps the size rather than the size type.
 * Shown in the order: colour, size type / fit, size, then the rest in the store's order.
 */
export function variantAxes(items: AxisVariant[]): VariantAxis[] {
  const dims = items.map(dimensions);
  const names: string[] = [];
  for (const map of dims) for (const name of map.keys()) if (!names.includes(name)) names.push(name);
  const varying = names.filter(name => new Set(dims.map(map => map.get(name) ?? '')).size > 1);
  const rank = (name: string) => ({ color: 0, size: 1, fit: 2, other: 3 })[axisKind(name)];
  const priority = [...varying].sort((a, b) => rank(a) - rank(b) || names.indexOf(a) - names.indexOf(b));
  const kept: string[] = [];
  const combos = (axes: string[]) => new Set(dims.map(map => axes.map(name => map.get(name) ?? '').join('\u0000'))).size;
  for (const name of priority) if (combos([...kept, name]) > combos(kept)) kept.push(name);
  // A size type that splits a size list (Regular: 2XL; Big & Tall: 3XLT, 6XL) is kept as its own switch, unless it
  // only renames another axis one to one.
  const oneToOne = (a: string, b: string) => [[a, b], [b, a]].every(([from, to]) => {
    const seen = new Map<string, string>();
    return dims.every(map => { const key = map.get(from) ?? '', value = map.get(to) ?? ''; if (seen.has(key) && seen.get(key) !== value) return false; seen.set(key, value); return true; });
  });
  for (const name of priority) if (axisKind(name) === 'fit' && !kept.includes(name) && !kept.some(other => oneToOne(name, other))) kept.push(name);
  const order = (name: string) => ({ color: 0, fit: 1, size: 2, other: 3 })[axisKind(name)];
  return kept
    .sort((a, b) => order(a) - order(b) || names.indexOf(a) - names.indexOf(b))
    .map(name => {
      const kind = axisKind(name);
      const values = [...new Set(dims.map(map => map.get(name) ?? '').filter(Boolean))];
      return { name, kind, values: kind === 'size' ? values.sort(compareSizes) : values };
    });
}

const matches = (item: AxisVariant, picks: AxisPicks, axes: VariantAxis[]) =>
  axes.every(axis => !picks[axis.name] || axisValue(item, axis.name) === picks[axis.name]);

/**
 * Whether an option on an axis can still be picked: some orderable option has it together with the picks on the axes
 * shown before it. Later picks never close an earlier axis — picking there resets the later picks that conflict.
 */
export function axisOptionState(items: AxisVariant[], axes: VariantAxis[], picks: AxisPicks, axisName: string, value: string): 'open' | 'out' {
  const index = axes.findIndex(axis => axis.name === axisName);
  const earlier = axes.slice(0, Math.max(0, index));
  return items.some(item => orderable(item) && axisValue(item, axisName) === value && matches(item, picks, earlier)) ? 'open' : 'out';
}

/**
 * A pick on one axis: the axes after it keep their picks only while an orderable option still has them all; an axis
 * left with a single possible value takes it. Tapping the picked value again clears it (and what depends on it).
 */
export function pickAxis(items: AxisVariant[], axes: VariantAxis[], picks: AxisPicks, axisName: string, value: string): AxisPicks {
  const index = axes.findIndex(axis => axis.name === axisName);
  if (index < 0) return picks;
  const next: AxisPicks = {};
  for (const axis of axes.slice(0, index)) if (picks[axis.name]) next[axis.name] = picks[axis.name];
  if (picks[axisName] === value) return next;
  next[axisName] = value;
  for (const axis of axes.slice(index + 1)) {
    const earlier = axes.slice(0, axes.indexOf(axis));
    const possible = axis.values.filter(option => items.some(item => orderable(item) && axisValue(item, axis.name) === option && matches(item, next, earlier)));
    const current = picks[axis.name];
    if (current && possible.includes(current)) next[axis.name] = current;
    else if (possible.length === 1) next[axis.name] = possible[0];
  }
  return next;
}

/** The option the picks name once every axis is picked (an orderable one first); undefined while a pick is missing. */
export function resolveVariant<T extends AxisVariant>(items: T[], axes: VariantAxis[], picks: AxisPicks): T | undefined {
  if (!axes.length || axes.some(axis => !picks[axis.name])) return undefined;
  const found = items.filter(item => matches(item, picks, axes));
  return found.find(orderable) ?? found[0];
}

/** The picks that name an option (to show a restored or preselected choice). */
export function picksOf(item: AxisVariant | undefined, axes: VariantAxis[]): AxisPicks {
  const out: AxisPicks = {};
  if (!item) return out;
  for (const axis of axes) { const value = axisValue(item, axis.name); if (value) out[axis.name] = value; }
  return out;
}

/** Lowest and highest store price among the orderable options matching the picks so far (for "от $13"). */
export function priceRange(items: AxisVariant[], axes: VariantAxis[], picks: AxisPicks): { min?: number; max?: number } {
  const prices = items.filter(item => orderable(item) && matches(item, picks, axes)).map(item => item.price)
    .filter((price): price is number => typeof price === 'number' && Number.isFinite(price) && price > 0);
  return prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : {};
}

/** Large axes hide what can no longer be picked instead of listing a wall of struck-out chips. */
export const hideClosedFrom = 16;

/**
 * Fills the colour and size fields from the store's named options when the importer left them empty (eBay group
 * listings name "Color" and "Size" only as options), so the colour tiles with photos and the size chips apply to them.
 * Nothing is invented: only values the store named for that option.
 */
export function withOptionAxes<T extends AxisVariant>(items: T[]): T[] {
  if (!items.some(item => (!item.color || !item.size) && item.options?.length)) return items;
  const axes = variantAxes(items);
  const color = axes.find(axis => axis.kind === 'color')?.name;
  const size = axes.find(axis => axis.kind === 'size')?.name;
  if (!color && !size) return items;
  return items.map(item => {
    const map = dimensions(item);
    const nextColor = !item.color && color ? map.get(color) : undefined;
    const nextSize = !item.size && size ? map.get(size) : undefined;
    return nextColor || nextSize
      ? { ...item, ...(nextColor ? { color: nextColor } : {}), ...(nextSize ? { size: nextSize, sizeLabel: item.sizeLabel ?? size } : {}) }
      : item;
  });
}

const axisNames: Record<string, [string, string, string]> = {
  'color': ['Цвет', 'Rang', 'Color'], 'colour': ['Цвет', 'Rang', 'Colour'], 'main color': ['Цвет', 'Rang', 'Color'], 'exterior color': ['Цвет', 'Rang', 'Color'],
  'цвет': ['Цвет', 'Rang', 'Color'], 'shade': ['Оттенок', 'Tus', 'Shade'],
  'size type': ['Тип размера', 'O‘lcham turi', 'Size type'], 'size range': ['Тип размера', 'O‘lcham turi', 'Size type'],
  'size': ['Размер', 'O‘lcham', 'Size'], 'размер': ['Размер', 'O‘lcham', 'Size'],
  'us shoe size': ['Размер US', 'US o‘lcham', 'US size'], 'size us': ['Размер US', 'US o‘lcham', 'US size'], 'us': ['Размер US', 'US o‘lcham', 'US size'], 'us size': ['Размер US', 'US o‘lcham', 'US size'],
  'shoe size': ['Размер обуви', 'Poyabzal o‘lchami', 'Shoe size'],
  'style': ['Стиль', 'Uslub', 'Style'], 'material': ['Материал', 'Material', 'Material'],
  'width': ['Ширина', 'Kenglik', 'Width'], 'shoe width': ['Ширина', 'Kenglik', 'Width'],
  'length': ['Длина', 'Uzunlik', 'Length'], 'skirt length': ['Длина', 'Uzunlik', 'Length'], 'inseam': ['Длина по шаговому шву', 'Ichki chok uzunligi', 'Inseam'],
  'waist': ['Талия', 'Bel', 'Waist'], 'waist size': ['Талия', 'Bel', 'Waist'],
  'fit': ['Посадка', 'Bichim', 'Fit'],
  'pack': ['В упаковке', 'Qadoqda', 'Pack'], 'pack size': ['В упаковке', 'Qadoqda', 'Pack'], 'count': ['Количество', 'Soni', 'Count'],
  'number of items': ['Количество', 'Soni', 'Count'], 'quantity': ['Количество', 'Soni', 'Quantity'],
  'capacity': ['Объём', 'Hajm', 'Capacity'], 'storage capacity': ['Память', 'Xotira', 'Storage'], 'storage': ['Память', 'Xotira', 'Storage'],
  'volume': ['Объём', 'Hajm', 'Volume'], 'объём': ['Объём', 'Hajm', 'Volume'], 'объем': ['Объём', 'Hajm', 'Volume'],
  'flavor': ['Вкус', 'Ta’m', 'Flavor'], 'flavour': ['Вкус', 'Ta’m', 'Flavour'], 'scent': ['Аромат', 'Hid', 'Scent'],
  'pattern': ['Узор', 'Naqsh', 'Pattern'], 'model': ['Модель', 'Model', 'Model'],
  'вариант': ['Вариант', 'Variant', 'Option'], 'band / cup': ['Обхват / чашка', 'Aylana / chashka', 'Band / cup'],
  'cup size': ['Чашка', 'Chashka', 'Cup size'], 'band size': ['Обхват', 'Aylana', 'Band size'],
};

/**
 * An axis name in the page language as [ru, uz (Latin), en]; a name the list does not know stays as the store wrote it
 * (in every language). The caller applies the Cyrillic Uzbek spelling.
 */
export function axisLabel(name: string): [string, string, string] {
  const key = name.replace(/\s+/g, ' ').trim().toLowerCase();
  return axisNames[key] ?? [name.trim(), name.trim(), name.trim()];
}
