import { deliveryPerKgUsdFor, deliverySpeeds, type DeliverySpeed, type Pricing } from './domain.ts';
import { deliveryDaysFor, deliveryRegions } from './site-content.ts';
import { homeCopy } from './home-copy.ts';
import { formatUsd } from './format.ts';
import type { Locale } from './i18n.ts';

// Home rates as data: the two speed cards and the table by country (app/home-sections.tsx DeliveryTariffs) read the
// same rows, so a card never shows a price or a day the table does not. Each region keeps its own price per speed
// (pricing.countryOverrides): the cards then say "from" and the table prints the price in every cell.

export type TariffOption = { speed: DeliverySpeed; days: readonly [number, number] | null; usd: number };
export type TariffRow = { region: (typeof deliveryRegions)[number]; options: TariffOption[] };

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

/** Shortest and longest business days of a speed across the regions that have them; null when none has. */
export function speedDaysRange(rows: TariffRow[], speed: DeliverySpeed): { min: number; max: number } | null {
  const days = rows.flatMap(row => row.options.filter(option => option.speed === speed && option.days).map(option => option.days!));
  return days.length ? { min: Math.min(...days.map(d => d[0])), max: Math.max(...days.map(d => d[1])) } : null;
}

/**
 * How many business days express saves over standard, counted per country (each end of the range on its own) and
 * joined: {min: 2, max: 5} on the current tariff. A country without days for both speeds is left out. Null when no
 * country has both, or express is not faster at both ends somewhere, so the line in the rates table never overstates.
 */
export function expressLead(rows: TariffRow[]): { min: number; max: number } | null {
  let min = Infinity, max = -Infinity;
  for (const row of rows) {
    const express = row.options.find(option => option.speed === 'express')?.days;
    const standard = row.options.find(option => option.speed === 'standard')?.days;
    if (!express || !standard) continue;
    const low = standard[0] - express[0], high = standard[1] - express[1];
    if (Math.min(low, high) <= 0) return null;
    min = Math.min(min, low, high);
    max = Math.max(max, low, high);
  }
  return Number.isFinite(min) ? { min, max } : null;
}

/** A speed's price per kg: the lowest across the regions, with "from" only when the regions' prices differ. */
export function factPrice(rows: TariffRow[], speed: DeliverySpeed, locale: Locale): string | null {
  const range = speedPriceRange(rows, speed);
  if (!range) return null;
  const value = formatUsd(range.min, locale);
  return range.min === range.max ? value : homeCopy[locale].tariffs.priceFrom(value);
}
