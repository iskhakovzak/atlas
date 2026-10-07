import type { Notification, Order, State } from './domain.ts';

/** Why an order waits for the customer: an extra charge to approve, a change to answer, or an unfinished payment. */
export type OrderAttention = 'extra' | 'change' | 'payment';

export function orderAttention(order: Order): OrderAttention | null {
  if (order.cancelled) return null;
  const extra = (!order.storeShippingExtraApproved && (order.storeShippingSettlement?.extra ?? 0) > 0)
    || (!order.extraApproved && (order.settlement?.extra ?? 0) > 0)
    || (!order.customsExtraApproved && (order.customsSettlement?.extra ?? 0) > 0);
  if (extra) return 'extra';
  if ((order.changeRequests ?? []).some(request => request.status === 'pending')) return 'change';
  if (order.status < 5 && order.payment?.status === 'pending') return 'payment';
  return null;
}

/** Where a notification leads: its order (opened in place by the hash) or the declaration it saved. */
export function noticeTarget(notice: Pick<Notification, 'orderId' | 'code'>): { href: string; kind: 'order' | 'document' } | null {
  if (notice.orderId) return { href: '/orders#' + encodeURIComponent(notice.orderId), kind: 'order' };
  if (notice.code === 'declaration-saved') return { href: '/declaration', kind: 'document' };
  return null;
}

/** The notifications panel: orders that need an answer (newest first, with their latest message), then recent updates. */
export function noticePanel(state: Pick<State, 'orders' | 'notifications'>, recent = 8) {
  const sorted = [...state.notifications].sort((a, b) => b.at - a.at);
  const action = state.orders
    .map(order => ({ order, reason: orderAttention(order), notice: sorted.find(item => item.orderId === order.id) }))
    .filter((entry): entry is { order: Order; reason: OrderAttention; notice: Notification | undefined } => entry.reason !== null)
    .sort((a, b) => (b.notice?.at ?? 0) - (a.notice?.at ?? 0));
  const shown = new Set(action.map(entry => entry.notice?.id).filter(Boolean));
  return {
    unread: state.notifications.filter(item => !item.read).length,
    action,
    updates: sorted.filter(item => !shown.has(item.id)).slice(0, recent),
    total: state.notifications.length,
  };
}
