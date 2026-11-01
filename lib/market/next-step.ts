import type { Order, Product, State } from './domain.ts';
import type { OrderGroup } from './order-groups.ts';
import { orderAttention } from './notice-panel.ts';
import { profileActions, type ProfileAction, type ProfileActionKind } from './parcels.ts';

/**
 * "What needs you now", shared by the home "continue" card and the profile's «Требует действия» (1 November 2026).
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

export type NextStepKind = ProfileActionKind | 'cart';

export type NextStep = {
  kind: NextStepKind;
  /** Stable for the session: «Позже» on the home card hides this step (kind and order), not every later one. */
  key: string;
  /** Where the one button leads: the decision or the payment on "Мои заказы", the passport form, the cart. */
  href: string;
  /** The order the step is about (small grey under the line); none for the cart. */
  orderId?: string;
  /** The product of that order: its 40 px photo and its name in the line. */
  product?: Product;
  /** The доплата or the checkout's one payment. */
  amount?: number;
  /** Items in the cart or in the checkout waiting for payment. */
  items: number;
  /** Payment: live lines of the checkout (several are named by their item count, not one product). */
  lines?: number;
  /** Passport: the saved recipient whose passport customs needs. */
  recipientName?: string;
};

/** A «Требует действия» reason as a card: its order's product for the photo and the name. */
export function stepOfAction(action: ProfileAction, orders: readonly Order[]): NextStep {
  const order = orders.find((item) => item.id === action.orderId);
  return {
    kind: action.kind,
    key: action.kind + ':' + (action.recipientId ?? action.orderId),
    href: action.href,
    orderId: action.orderId,
    ...(order ? { product: order.product } : {}),
    ...(action.amount !== undefined ? { amount: action.amount } : {}),
    items: action.items ?? order?.quantity ?? 1,
    ...(action.lines !== undefined ? { lines: action.lines } : {}),
    ...(action.recipientName ? { recipientName: action.recipientName } : {}),
  };
}

type StepState = Pick<State, 'orders' | 'cart' | 'deliveryProfiles'> & Partial<Pick<State, 'identityProfiles' | 'identityProfile'>>;

/**
 * Everything that waits for a signed-in customer, most urgent first: a decision on an order (a доплата, then a change),
 * then a checkout's payment, then a recipient's passport (lib/market/parcels.ts profileActions), and last the cart.
 * An order simply in progress needs nothing.
 */
export function nextStepsOf(state: StepState): NextStep[] {
  const steps: NextStep[] = profileActions(state).map((action) => stepOfAction(action, state.orders));
  const items = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  if (items > 0) steps.push({ kind: 'cart', key: 'cart', href: '/cart', items, ...(state.cart[0] ? { product: state.cart[0].product } : {}) });
  return steps;
}

/** The one step the home card shows: the first not put off with «Позже» in this tab. `null` when nothing waits. */
export function nextStepOf(state: StepState, later: ReadonlySet<string> = new Set()): NextStep | null {
  return nextStepsOf(state).find((step) => !later.has(step.key)) ?? null;
}
