import { needsPassport, type Order, type State } from './domain.ts';
import { orderAttention } from './notice-panel.ts';

/**
 * The one thing waiting for the buyer, for the header: the dot on "Профиль" (the bottom bar and the profile button) and
 * the dot on «Документы» while a passport is missing. Loaded on every page, so it stays small: no grouping and no copy.
 * The mint strip under the header that read it until 1 November 2026 is gone (owner: "вообще не то"); the home card,
 * the profile and one toast after sign-in say what waits instead (lib/market/next-step.ts, lib/market/action-copy.ts).
 * The profile hub lists the same reasons in the same order (lib/market/parcels.ts profileActions): a доплата or a
 * change, then a payment, then a recipient's passport.
 */
export type StripKind = 'extra' | 'change' | 'payment' | 'passport';
export type StripAction = { kind: StripKind; orderId: string; href: string };

type PassportState = Pick<State, 'orders' | 'deliveryProfiles'> & Partial<Pick<State, 'identityProfiles' | 'identityProfile'>>;

export const documentsPath = (recipientId?: string) => '/account/documents' + (recipientId ? '?recipient=' + encodeURIComponent(recipientId) : '');

/** Recipients of paid orders still on their way whose passport is not in the account — domain.ts needsPassport, the rule the notice uses too. */
export function missingPassports(state: PassportState): { recipientId: string; name: string; order: Order }[] {
  const identities = state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);
  const seen = new Map<string, { recipientId: string; name: string; order: Order }>();
  for (const order of state.orders) {
    const id = order.deliveryProfileId;
    if (!id || seen.has(id) || !needsPassport(order)) continue;
    if (identities.some((profile) => profile.recipientProfileId === id)) continue;
    const profile = state.deliveryProfiles.find((item) => item.id === id);
    if (!profile) continue;
    seen.set(id, { recipientId: id, name: profile.recipient, order });
  }
  return [...seen.values()];
}

export function firstProfileAction(state: PassportState): StripAction | undefined {
  for (const order of state.orders) {
    const reason = orderAttention(order);
    if (reason === 'extra' || reason === 'change') return { kind: reason, orderId: order.id, href: '/orders#' + encodeURIComponent(order.id) };
  }
  const unpaid = state.orders.find((order) => orderAttention(order) === 'payment');
  if (unpaid) return { kind: 'payment', orderId: unpaid.id, href: '/orders#' + encodeURIComponent(unpaid.id) };
  const passport = missingPassports(state)[0];
  return passport ? { kind: 'passport', orderId: passport.order.id, href: documentsPath(passport.recipientId) } : undefined;
}
