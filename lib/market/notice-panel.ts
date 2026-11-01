import type { Notification, Order, State } from './domain.ts';

/** Why an order waits for the customer: an extra charge to approve or an extra invoice to pay, a change to answer, or an unfinished payment. */
export type OrderAttention = 'extra' | 'change' | 'payment';

export function orderAttention(order: Order): OrderAttention | null {
  if (order.cancelled) return null;
  const extra = (!order.storeShippingExtraApproved && (order.storeShippingSettlement?.extra ?? 0) > 0)
    || (!order.extraApproved && (order.settlement?.extra ?? 0) > 0)
    || (!order.customsExtraApproved && (order.customsSettlement?.extra ?? 0) > 0)
    || (order.extraCharges ?? []).some(charge => charge.status === 'pending');
  if (extra) return 'extra';
  if ((order.changeRequests ?? []).some(request => request.status === 'pending')) return 'change';
  if (order.status < 5 && order.payment?.status === 'pending') return 'payment';
  return null;
}

/** The parcel page of an order: any order of a parcel opens the whole parcel (lib/market/parcels.ts). */
export const parcelPath = (orderId: string) => '/account/parcels/' + encodeURIComponent(orderId);
/** Notices about where the parcel is: they open the parcel page instead of the list of orders. */
const parcelNoticeCodes = new Set(['status', 'parcel-stage', 'tracking-added']);

/** Where a notification leads: its order (opened in place by the hash), the declaration it saved or the support section. */
export function noticeTarget(notice: Pick<Notification, 'orderId' | 'code'> & Partial<Pick<Notification, 'params'>>): { href: string; kind: 'order' | 'parcel' | 'document' | 'support' } | null {
  // The passport goes to the documents page, opened on that recipient (1 November 2026).
  if (notice.code === 'passport-needed') {
    const recipient = notice.params?.recipient;
    return { href: '/account/documents' + (typeof recipient === 'string' && recipient ? '?recipient=' + encodeURIComponent(recipient) : ''), kind: 'document' };
  }
  // A new stage opens the parcel itself: its eight-stage bar and the one next step (owner, 1 November 2026).
  // Its link says "Открыть посылку", not "Открыть заказ" (kind 'parcel').
  if (notice.orderId && notice.code && parcelNoticeCodes.has(notice.code)) return { href: parcelPath(notice.orderId), kind: 'parcel' };
  if (notice.orderId) return { href: '/orders#' + encodeURIComponent(notice.orderId), kind: 'order' };
  if (notice.code === 'declaration-saved') return { href: '/account/documents#declarations', kind: 'document' };
  if (notice.code === 'support-answered') return { href: '/account#support', kind: 'support' };
  return null;
}

/** Notifications that speak of each reason: a "доплата" item never shows a message about something else. */
export const reasonCodes: Record<OrderAttention, readonly string[]> = {
  extra: ['parcel-extra', 'store-shipping-over', 'store-shipping-extra-legacy', 'customs-duty-over', 'extra-charge-requested'],
  change: ['change-requested'],
  // No notification asks for the payment: the checkout itself does.
  payment: [],
};
const urgency: OrderAttention[] = ['extra', 'change', 'payment'];

/**
 * The notifications panel: purchases that need an answer, one item per checkout (the same count as the
 * "Нужно действие" tab of "My orders"), newest first, each with its latest message about that very reason;
 * then recent updates.
 */
export function noticePanel(state: Pick<State, 'orders' | 'notifications'>, recent = 8) {
  const sorted = [...state.notifications].sort((a, b) => b.at - a.at);
  const byCheckout = new Map<string, { order: Order; reason: OrderAttention; notice: Notification | undefined; at: number }>();
  for (const order of state.orders) {
    const reason = orderAttention(order);
    if (!reason) continue;
    const notice = sorted.find(item => item.orderId === order.id && item.code !== undefined && reasonCodes[reason].includes(item.code));
    const key = order.batchId ?? order.id;
    const entry = { order, reason, notice, at: notice?.at ?? order.createdAt };
    const current = byCheckout.get(key);
    // The most urgent reason of the checkout wins; within one reason, the newest message.
    if (!current || urgency.indexOf(reason) < urgency.indexOf(current.reason) || (reason === current.reason && entry.at > current.at)) byCheckout.set(key, entry);
  }
  const action = [...byCheckout.values()].sort((a, b) => b.at - a.at).map(({ order, reason, notice }) => ({ order, reason, notice }));
  const shown = new Set(action.map(entry => entry.notice?.id).filter(Boolean));
  return {
    unread: state.notifications.filter(item => !item.read).length,
    action,
    updates: sorted.filter(item => !shown.has(item.id)).slice(0, recent),
    total: state.notifications.length,
  };
}
