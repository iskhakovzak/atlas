import { balanceOf, type Order, type State } from "./domain.ts";

/**
 * Version of the data-processing consent (privacy policy + terms of use) the consent gate asks for and
 * the cabinet lists. Bump it when either document changes materially; customers then confirm again.
 */
export const consentVersion = "2026-10-06";
export const consentDocuments = ["privacy", "terms"] as const;
export type ConsentDocument = (typeof consentDocuments)[number];

/**
 * Money is in flight for the order: the customer paid it (a payment link marked paid, or settled from the
 * balance at checkout), or Atlas already bought it (status 1 and up; the domain never advances an unpaid
 * order past "awaiting purchase"). Such an order has to finish or be settled by support before the account goes.
 */
export const paidOrder = (order: Order) => order.payment?.status === "paid" || order.status >= 1;

/** Orders that stop deletion: live, not yet delivered and paid. */
export function deletionBlockers(state: State): Order[] {
  return state.orders.filter((order) => !order.cancelled && order.status < 5 && paidOrder(order));
}

/** Requests the customer never paid for: cancelled automatically as part of deletion. */
export function autoCancelledOrders(state: State): Order[] {
  return state.orders.filter((order) => !order.cancelled && order.status === 0 && !paidOrder(order));
}

export type DeletionSummary = {
  orders: { total: number; active: number; blocked: number; autoCancel: number };
  recipients: number;
  passports: number;
  declarations: number;
  tickets: number;
  favorites: number;
  cartItems: number;
  notifications: number;
  balance: number;
};

/** Counts for the confirmation dialog and the audit row (no personal data). */
export function deletionSummary(state: State): DeletionSummary {
  const identityProfiles = state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);
  return {
    orders: {
      total: state.orders.length,
      active: state.orders.filter((order) => !order.cancelled && order.status < 5).length,
      blocked: deletionBlockers(state).length,
      autoCancel: autoCancelledOrders(state).length,
    },
    recipients: state.deliveryProfiles.length,
    passports: identityProfiles.length,
    declarations: state.declarations.length,
    tickets: state.supportTickets.length,
    favorites: state.favorites.length,
    cartItems: state.cart.reduce((sum, item) => sum + item.quantity, 0),
    notifications: state.notifications.length,
    balance: balanceOf(state),
  };
}

/**
 * The stable name a deleted customer keeps in the order and accounting records: "deleted:" + the first
 * 16 hex characters of HMAC-SHA-256(secret, userId). This is pseudonymisation under a server key, not an
 * irreversible hash: without the secret the alias cannot be matched to a user ID by enumerating e-mails or
 * phone numbers, and whoever holds the secret can confirm (not recover) a match. The same user ID and
 * secret always map to the same pseudonym, so a repeated deletion (or two tables written at different
 * times) stays consistent. The secret is required: an empty one would leave the alias enumerable.
 */
export async function pseudonym(userId: string, secret: string): Promise<string> {
  if (!secret) throw new Error("ATLAS_AUTH_SECRET is required for account deletion");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(userId));
  return "deleted:" + Array.from(new Uint8Array(digest).slice(0, 8), (value) => value.toString(16).padStart(2, "0")).join("");
}

export const isPseudonym = (id: string) => /^deleted:[0-9a-f]{16}$/.test(id);

/** The consents the account holds at the current version, by document. */
export function missingConsents(state: Pick<State, "consents">, version = consentVersion): ConsentDocument[] {
  const held = new Set((state.consents ?? []).filter((item) => item.version === version).map((item) => item.key));
  return consentDocuments.filter((key) => !held.has(key));
}
