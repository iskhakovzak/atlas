import { insuredDeliveryOf, parcelValueUsd, uninsuredLossPerKgUsd, valueServiceRate, type CartItem, type Order, type Quote, type ServiceOffering } from './domain.ts';
import { packagingKg } from './world.ts';
import { catalogUrlKey } from './catalog-query.ts';

/**
 * What the cart shows about one store parcel, read from the lines the server already priced (lib/market/domain.ts
 * repriceCart, valueServiceFees, claimLimit). Display only: the server prices and settles everything itself.
 */

/** A store page's host as the catalog keys stores: lower case, without "www."; "" without a valid URL. */
export function sourceHost(url: string | undefined) {
  if (!url) return '';
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

/** The store of a parcel: the host of its first line with a store page. */
export function parcelStoreHost(lines: { product: { sourceUrl?: string } }[]) {
  for (const line of lines) { const host = sourceHost(line.product.sourceUrl); if (host) return host; }
  return '';
}

type RoomLine = { quantity: number; product: { sourceUrl?: string; boxedWeight?: number } };
/**
 * Kilograms that still fit into the 1 kg the parcel's international delivery is charged for at least
 * (combinedShipmentWeight: boxed weight plus packagingKg once, never under 1 kg). Only the lines being checked out,
 * and only when each has a store page and a boxed weight: the server combines exactly those into one parcel.
 * Rounded down to 0.1 kg; undefined below `minimum`, when there is nothing worth saying.
 */
export function parcelRoomKg(lines: RoomLine[], minimum = 0.2) {
  if (!lines.length || lines.some((line) => !line.product.sourceUrl || line.product.boxedWeight === undefined)) return undefined;
  const boxed = lines.reduce((sum, line) => sum + line.product.boxedWeight! * line.quantity, 0);
  // The epsilon keeps 1 − (0.5 + 0.3) = 0.19999… at 0.2 instead of flooring it to 0.1.
  const room = Math.floor((1 - (boxed + packagingKg)) * 10 + 1e-6) / 10;
  return room >= minimum - 1e-9 ? room : undefined;
}

type ValueLine = Pick<CartItem, 'product' | 'quantity'> & { quote: Pick<Quote, 'merchandise' | 'shipping' | 'deliveryMargin' | 'sourceShipping' | 'fx'> };
/**
 * What a value-percent service (the Atlas safe-arrival guarantee) costs this parcel, soum: the rate follows the whole
 * parcel's value (the higher one above its threshold) and each line pays it on its own goods and delivery, rounded per
 * line as the server does (valueServiceFees). Shown before the box is ticked too.
 */
export function guaranteeAmount(service: Pick<ServiceOffering, 'pricingMode' | 'valuePercent' | 'valuePercentHigh' | 'valueThresholdUsd'>, lines: ValueLine[], fx: number) {
  const rate = valueServiceRate(service, parcelValueUsd(lines, fx));
  return lines.reduce((sum, line) => sum + Math.round((line.quote.merchandise + insuredDeliveryOf(line.quote)) * rate), 0);
}

/**
 * Without the guarantee, the most Atlas pays when this parcel is lost, soum: each line (it becomes its own order) up to
 * $15 per kg of its weight, never more than its goods (claimLimit for a loss).
 */
export function uninsuredParcelLimit(lines: { quote: Pick<Quote, 'merchandise' | 'weight' | 'fx'> }[], fx: number) {
  return lines.reduce((sum, line) => sum + Math.min(line.quote.merchandise, Math.round(uninsuredLossPerKgUsd * line.quote.weight * (line.quote.fx ?? fx))), 0);
}

/**
 * "You ordered before" under an empty cart: the latest delivered, not cancelled orders that have a store page, one per
 * product page (newest first), so each can be ordered again by its link.
 */
export function reorderCandidates<T extends Pick<Order, 'id' | 'status' | 'cancelled' | 'createdAt'> & { product: { sourceUrl?: string } }>(orders: T[], limit = 3) {
  const seen = new Set<string>();
  const picked: T[] = [];
  for (const order of [...orders].sort((a, b) => b.createdAt - a.createdAt)) {
    if (order.status !== 5 || order.cancelled || !order.product.sourceUrl) continue;
    const key = catalogUrlKey(order.product.sourceUrl);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(order);
    if (picked.length >= limit) break;
  }
  return picked;
}
