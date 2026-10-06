import { statuses, type CartCustoms, type CustomsEstimate, type IdentityProfile, type Order, type Pricing, type SavedDeliveryProfile, type State } from './domain.ts';
import { courierAllowanceUsd, customsCheckedOn, customsParams } from './customs.ts';
import { tashkentDay, tashkentMonth } from './world.ts';

/** `parts`: each counted order this month (order ID and USD), for the cabinet meter. */
export type RecipientAllowance = { key: string; name: string; usedUsd: number; orders: number; parts?: { id: string; usd: number }[] };
/** One person for the allowance: a normalized name, and the masked passport when one is linked. */
export type AllowancePerson = { name: string; passport?: string };

const normalizedName = (name: string | undefined) => (name ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');

/** The duty-free allowance belongs to a person, so it is grouped by the recipient's name (not the address). */
export function recipientKey(name: string | undefined, passport?: string) {
  const normalized = normalizedName(name);
  return normalized ? `name:${normalized}${passport ? `|${passport}` : ''}` : 'unknown';
}

export function orderRecipientName(state: State, order: Order) {
  const profile = order.deliveryProfileId ? state.deliveryProfiles.find((item) => item.id === order.deliveryProfileId) : undefined;
  return profile?.recipient ?? order.delivery?.recipient ?? '';
}

const identities = (state: State): IdentityProfile[] => state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);

/** The person a saved recipient stands for: their name and, when confirmed, their passport. */
export function profilePerson(state: State, profile: SavedDeliveryProfile): AllowancePerson {
  const passport = identities(state).find((identity) => identity.recipientProfileId === profile.id)?.passportMasked;
  return { name: normalizedName(profile.recipient), passport };
}

export function orderPerson(state: State, order: Order): AllowancePerson {
  const profile = order.deliveryProfileId ? state.deliveryProfiles.find((item) => item.id === order.deliveryProfileId) : undefined;
  const passport = order.identity?.passportMasked ?? (profile ? profilePerson(state, profile).passport : undefined);
  return { name: normalizedName(orderRecipientName(state, order)), passport };
}

/** Same person: the same name, and the same passport whenever both sides have one. */
export function samePerson(a: AllowancePerson, b: AllowancePerson) {
  return Boolean(a.name) && a.name === b.name && (!a.passport || !b.passport || a.passport === b.passport);
}

/**
 * Orders that use the allowance: bought (status "Выкуплен" or later), paid and not cancelled. Unpaid,
 * not yet bought or cancelled orders are not imported, so they do not count (owner's rule, 4 October 2026).
 */
export function countsTowardAllowance(order: Order) {
  return !order.cancelled && order.status >= 1 && (!order.payment || order.payment.status === 'paid');
}

/** "2026-10" for a moment in Tashkent time (UTC+5): the calendar month the allowance is counted in, whatever the
 * time zone of the Worker or the browser, and the same calendar as accounting. */
export const monthOf = tashkentMonth;

/**
 * The calendar month the order uses the allowance in. CM resolution No. 244 §3(b) applies the norm "within one
 * calendar month" to goods imported for a person, so it is the month of import. Atlas does not record the customs
 * date: a delivered order counts in the month it was delivered, one still on its way counts in the current month.
 */
export function allowanceMonth(order: Order, now = Date.now()) {
  if (order.status >= 5) {
    const delivered = [...order.history].reverse().find((event) => event.text === statuses[5]);
    return monthOf(delivered?.at ?? order.createdAt);
  }
  return monthOf(now);
}

const orderUsd = (order: Order, fallbackFx: number) => order.quote.merchandise / (order.quote.fx ?? fallbackFx);

/** This month's counted merchandise (USD) per person. */
export function monthlyAllowance(state: State, fallbackFx: number, now = Date.now()): RecipientAllowance[] {
  const month = monthOf(now);
  const groups: (RecipientAllowance & { person: AllowancePerson })[] = [];
  for (const order of state.orders) {
    if (!countsTowardAllowance(order) || allowanceMonth(order, now) !== month) continue;
    const person = orderPerson(state, order);
    if (!person.name) continue;
    let group = groups.find((item) => samePerson(item.person, person));
    if (!group) {
      group = { key: recipientKey(person.name, person.passport), name: orderRecipientName(state, order).trim(), usedUsd: 0, orders: 0, parts: [], person };
      groups.push(group);
    } else if (!group.person.passport && person.passport) group.person = person;
    const usd = orderUsd(order, fallbackFx);
    group.usedUsd += usd;
    group.orders += 1;
    group.parts!.push({ id: order.id, usd: Math.round(usd * 100) / 100 });
  }
  return groups.map((group) => ({ key: group.key, name: group.name, orders: group.orders, usedUsd: Math.round(group.usedUsd), parts: group.parts })).sort((a, b) => b.usedUsd - a.usedUsd);
}

/** This month's counted USD for one person (0 when there is nothing yet). */
export function monthlyUsedFor(state: State, who: string | AllowancePerson | undefined, fallbackFx: number, now = Date.now()) {
  const person = typeof who === 'object' ? who : { name: normalizedName(who) };
  if (!person.name) return 0;
  const month = monthOf(now);
  const used = state.orders
    .filter((order) => countsTowardAllowance(order) && allowanceMonth(order, now) === month && samePerson(orderPerson(state, order), person))
    .reduce((sum, order) => sum + orderUsd(order, fallbackFx), 0);
  return Math.round(used);
}

/** The allowance the catalog shows: for the primary saved recipient, else the first saved one,
 * else the recipient of the latest order. Null when the account has no recipient yet. */
export function catalogAllowance(state: State, fallbackFx: number, now = Date.now()) {
  const profile = state.deliveryProfiles.find((item) => item.primary) ?? state.deliveryProfiles[0];
  const latest = [...state.orders].sort((a, b) => b.createdAt - a.createdAt)[0];
  const name = (profile?.recipient ?? (latest ? orderRecipientName(state, latest) : '')).trim();
  if (!name) return null;
  const usedUsd = monthlyUsedFor(state, profile ? profilePerson(state, profile) : name, fallbackFx, now);
  return { name, usedUsd, remainingUsd: Math.max(0, courierAllowanceUsd - usedUsd) };
}

/**
 * The customs estimate for this cart and one recipient: the allowance left this month after counted Atlas orders
 * and what the customer used elsewhere, the dutiable part of the cart, the estimated payment and the optional
 * "Atlas helps pay customs" fee. Informational: none of it is part of the cart total.
 */
export function cartCustomsEstimate(
  state: State,
  pricing: Pricing,
  recipient: { profile?: SavedDeliveryProfile; name?: string },
  choices: CartCustoms | undefined = state.cartCustoms,
  now = Date.now(),
): CustomsEstimate {
  const person: AllowancePerson = recipient.profile ? profilePerson(state, recipient.profile) : { name: normalizedName(recipient.name) };
  const params = customsParams(pricing, tashkentDay(now));
  const cents = (value: number) => Math.round(value * 100) / 100;
  const valueUsd = cents(state.cart.reduce((sum, item) => sum + item.product.usd * item.quantity, 0));
  const atlasUsedUsd = monthlyUsedFor(state, person, pricing.fx, now);
  const outsideUnknown = Boolean(choices?.outsideUsed) && choices?.outsideUsd === undefined;
  const outsideUsedUsd = choices?.outsideUsed ? cents(choices.outsideUsd ?? 0) : 0;
  const remaining = outsideUnknown ? 0 : Math.max(0, params.allowanceUsd - atlasUsedUsd - outsideUsedUsd);
  const dutiableUsd = cents(Math.max(0, valueUsd - remaining));
  const helpRequested = Boolean(choices?.help);
  // The fee is a line of the bill (repriceCart); here only its USD equivalent for the order's customs record.
  const helpFee = state.cart.reduce((sum, item) => sum + (item.quote.customsHelp ?? 0), 0);
  return {
    recipientKey: recipientKey(person.name, person.passport),
    recipientName: (recipient.profile?.recipient ?? recipient.name ?? '').trim().slice(0, 100) || undefined,
    month: monthOf(now),
    allowanceUsd: params.allowanceUsd,
    atlasUsedUsd,
    ...(choices?.outsideUsed ? { outsideUsedUsd } : {}),
    ...(outsideUnknown ? { outsideUnknown } : {}),
    valueUsd,
    dutiableUsd,
    rate: params.rate,
    minimumPerKg: params.minimumPerKg,
    estimateUsd: cents(dutiableUsd * params.rate),
    // Owner's rule (5.10.2026): Atlas pays customs for 4.98% of the cart's amount to pay, offered in every cart.
    ...(helpRequested ? { helpRequested, helpFeeUsd: cents(helpFee / pricing.fx) } : {}),
    checkedOn: customsCheckedOn,
  };
}
