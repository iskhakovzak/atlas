import { deliveryPerKgUsdFor, deliverySpeeds, type DeliverySpeed, type Pricing } from './domain.ts';
import { deliveryDaysFor, deliveryRegions, type DeliveryRegion } from './site-content.ts';
import { homeCopy } from './home-copy.ts';
import { formatUsd } from './format.ts';
import type { Locale } from './i18n.ts';

// Home rates as data: the country cards (app/home-sections.tsx DeliveryTariffs) and the wide-screen facts row
// (app/home-facts.tsx) read the same rows, so the row never shows a price or a day the table does not.

export type TariffOption = { speed: DeliverySpeed; days: readonly [number, number] | null; usd: number };
export type TariffRow = { region: (typeof deliveryRegions)[number]; options: TariffOption[] };
export type DayGroup = { days: readonly [number, number]; regions: DeliveryRegion[] };

/** Every dispatch region with its days and price per kg for each speed. The country with an override wins, else the region's first. */
export function tariffRows(pricing: Pricing): TariffRow[] {
  return deliveryRegions.map(region => {
    const country = region.countries.find(name => pricing.countryOverrides?.[name]) ?? region.countries[0];
    const options = deliverySpeeds.map((speed: DeliverySpeed) => ({ speed, days: deliveryDaysFor(pricing, region.id, speed), usd: deliveryPerKgUsdFor(pricing, country, speed) }));
    return { region, options };
  });
}

/** Lowest and highest price per kg of a speed across the regions; null when no region has it. */
export function speedPriceRange(rows: TariffRow[], speed: DeliverySpeed): { min: number; max: number } | null {
  const prices = rows.flatMap(row => row.options.filter(option => option.speed === speed).map(option => option.usd));
  return prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null;
}

/** Regions grouped by the same express days, fastest first; regions without days are left out (never one range for all). */
export function expressDayGroups(rows: TariffRow[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const row of rows) {
    const days = row.options.find(option => option.speed === 'express')?.days;
    if (!days) continue;
    const key = `${days[0]}-${days[1]}`;
    const group = groups.get(key) ?? { days, regions: [] };
    group.regions.push(row.region.id);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.days[0] - b.days[0] || a.days[1] - b.days[1]);
}

/** Facts row price: the lowest price per kg of a speed, with "from" only when the regions' prices differ. */
export function factPrice(rows: TariffRow[], speed: DeliverySpeed, locale: Locale): string | null {
  const range = speedPriceRange(rows, speed);
  if (!range) return null;
  const value = formatUsd(range.min, locale);
  return range.min === range.max ? value : homeCopy[locale].wide.priceFrom(value);
}

/** Facts row days: the fastest express group. Its flag leads only for a single region, so the days never sit with all six flags. */
export function factDays(rows: TariffRow[]): (DayGroup & { lead: DeliveryRegion | null }) | null {
  const group = expressDayGroups(rows)[0];
  return group ? { ...group, lead: group.regions.length === 1 ? group.regions[0] : null } : null;
}

/** Facts row days, the line under them: what the days are first ("express, from warehouse"), the countries last, so a
 * narrow cell (two countries or more in the fastest group) cuts only the list, never what the days count from. */
export function factDaysNote(group: DayGroup, locale: Locale): string {
  const c = homeCopy[locale];
  return `${c.tariffs.speeds.express.toLocaleLowerCase(locale)}, ${c.wide.fromWarehouse} · ${group.regions.map(id => c.tariffs.regions[id]).join(', ')}`;
}
