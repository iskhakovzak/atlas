import type { Order, State } from './domain.ts';

export type RecipientAllowance = { key: string; name: string; usedUsd: number; orders: number };

/** The duty-free allowance belongs to a person, so orders are grouped by the recipient's name:
 * a saved recipient's name, else the name typed at checkout. Two addresses of one person share it. */
export function recipientKey(name: string | undefined) {
  const normalized = (name ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
  return normalized ? `name:${normalized}` : 'unknown';
}

export function orderRecipientName(state: State, order: Order) {
  const profile = order.deliveryProfileId ? state.deliveryProfiles.find((item) => item.id === order.deliveryProfileId) : undefined;
  return profile?.recipient ?? order.delivery?.recipient ?? '';
}

/** Merchandise value in USD of this calendar month's non-cancelled orders, per recipient.
 * Atlas counts by order date: the customs arrival date is not known yet. */
export function monthlyAllowance(state: State, fallbackFx: number, now = Date.now()): RecipientAllowance[] {
  const month = new Date(now);
  const groups = new Map<string, RecipientAllowance>();
  for (const order of state.orders) {
    const created = new Date(order.createdAt);
    if (order.cancelled || created.getMonth() !== month.getMonth() || created.getFullYear() !== month.getFullYear()) continue;
    const name = orderRecipientName(state, order);
    const key = recipientKey(name);
    const group = groups.get(key) ?? { key, name: name.trim(), usedUsd: 0, orders: 0 };
    group.usedUsd += order.quote.merchandise / (order.quote.fx ?? fallbackFx);
    group.orders += 1;
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, usedUsd: Math.round(group.usedUsd) })).sort((a, b) => b.usedUsd - a.usedUsd);
}

/** This month's USD already counted for one person (0 when there is nothing yet). */
export function monthlyUsedFor(state: State, name: string | undefined, fallbackFx: number, now = Date.now()) {
  const key = recipientKey(name);
  return monthlyAllowance(state, fallbackFx, now).find((group) => group.key === key)?.usedUsd ?? 0;
}
