import type { Order, State } from './domain.ts';
import { groupOrders, type OrderGroup } from './order-groups.ts';
import { orderAttention } from './notice-panel.ts';

/**
 * "What needs you now", shared by the account's first card and the home "continue" strip.
 * The same rule as /orders and the notifications panel: an extra charge or a change waits for the customer,
 * over all lines (no status filter), so neither place misses an item the orders page asks about.
 */
export function pendingApprovalOf(orders: readonly Order[]): Order | undefined {
  return orders.find(order => { const reason = orderAttention(order); return reason === 'extra' || reason === 'change'; });
}

/** The checkout whose one payment is still to record (its amount, not one line's share) and its first unpaid line. */
export function pendingPaymentOf(groups: readonly OrderGroup[]): { group: OrderGroup; order: Order } | undefined {
  const group = groups.find(item => item.payment);
  const order = group?.orders.find(item => !item.cancelled && item.payment?.status === 'pending');
  return group && order ? { group, order } : undefined;
}

export type NextStep = {
  kind: 'approval' | 'payment' | 'cart';
  /** The order the step opens (`/orders#id`); none for the cart. */
  orderId?: string;
  /** The product name when the step is about one line; a checkout of several lines is named by its item count. */
  name?: string;
  /** Items in the cart, in the checkout waiting for payment, or on the line waiting for a decision. */
  items: number;
};

/**
 * The one thing a signed-in customer can carry on with: a decision on an order first, then the checkout's
 * payment, then the cart. `null` when nothing waits — an order simply in progress needs no action.
 */
export function nextStepOf(state: Pick<State, 'orders' | 'cart'>): NextStep | null {
  const approval = pendingApprovalOf(state.orders);
  if (approval) return { kind: 'approval', orderId: approval.id, name: approval.product.name, items: approval.quantity };
  const due = pendingPaymentOf(groupOrders(state.orders));
  if (due) return { kind: 'payment', orderId: due.order.id, ...(due.group.orders.length > 1 ? {} : { name: due.order.product.name }), items: due.group.items };
  const items = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  return items > 0 ? { kind: 'cart', items } : null;
}
