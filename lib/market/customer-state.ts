// The account document as the customer may see it (3 November 2026). The stored JSON also carries the operators' own
// work on an order: internal notes with the author's address (`staffNotes`) and the team and priority it is assigned
// to (`assignment`). Those are read by staff through GET /api/operations only; every answer that hands the account to
// the customer (GET /api/account, POST /api/actions, the Telegram switch, the data export) goes through here.
// Safe for writes: the server applies each action to the stored document, never to what the browser holds, so the
// fields stay in D1 on the next save. No Cloudflare imports.
import type { Order, State } from "./domain.ts";

/** Order fields that only operators see. */
export const staffOnlyOrderFields = ["staffNotes", "assignment"] as const;

export function customerOrder(order: Order): Order {
  if (!staffOnlyOrderFields.some((key) => key in order)) return order;
  const copy: Partial<Order> = { ...order };
  for (const key of staffOnlyOrderFields) delete copy[key];
  return copy as Order;
}

/** A shallow copy of the account without the staff-only order fields; the stored state is left untouched. */
export function customerState(state: State): State {
  return { ...state, orders: state.orders.map(customerOrder) };
}
