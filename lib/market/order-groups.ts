import { orderPayable, type DeliverySpeed, type Order } from './domain.ts';
import type { Locale } from './i18n.ts';
import { storefrontLabel } from './store-brands.ts';
import {withCyrillic} from './uz-cyrl.ts';

/**
 * "My orders" shows one checkout as one group: every cart line becomes its own Order at checkout
 * (domain.ts checkoutCart), and all lines of one checkout share `batchId`. Inside a group the lines
 * are split by store and dispatch country, the same key that makes one parcel (domain.ts storeParcelKey).
 * Orders placed before batch ids, or by link one at a time, form a group of one.
 */

/** The customer-facing stage of a group, from the most urgent line down. */
export type OrderGroupStage = 'attention' | 'active' | 'done' | 'cancelled';

export type OrderStoreGroup = {
  /** Store host + dispatch country, or `item:<id>` when the line has no source link. */
  key: string;
  /** Store host without "www.", or "" for catalogue items without a link. */
  host: string;
  /** Product brand of the first line; the label falls back to it when the host is unknown. */
  brand: string;
  /** Dispatch country as stored (Russian label), "" when unknown. */
  country: string;
  orders: Order[];
  items: number;
  payable: number;
};

export type OrderGroup = {
  /** `batch:<batchId>` or `order:<id>`; stable across renders. */
  key: string;
  batchId?: string;
  orders: Order[];
  stores: OrderStoreGroup[];
  /** Sum of `orderPayable` over the lines that are not cancelled. */
  payable: number;
  /** Quantity of goods over the lines that are not cancelled. */
  items: number;
  /** Earliest `createdAt` in the group. */
  createdAt: number;
  /** Lowest status among the lines still in progress; 5 when every line is done; undefined when all are cancelled. */
  status?: number;
  stage: OrderGroupStage;
  /** Number of lines that wait for the customer's decision. */
  attention: number;
  cancelled: number;
};

export function orderStoreHost(order: Pick<Order, 'product'>) {
  if (!order.product.sourceUrl) return '';
  try {
    return new URL(order.product.sourceUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** The customer must act: an extra to approve, a pending change request, or a payment to record. */
export function orderNeedsCustomerDecision(order: Order) {
  if (order.cancelled) return false;
  return Boolean(order.settlement?.extra && !order.extraApproved)
    || Boolean(order.storeShippingSettlement?.extra && !order.storeShippingExtraApproved)
    || (order.changeRequests ?? []).some((request) => request.status === 'pending')
    || order.payment?.status === 'pending';
}

function storeKey(order: Order) {
  const host = orderStoreHost(order);
  return host ? `store:${host}:${order.product.country ?? ''}` : `item:${order.id}`;
}

function buildStores(orders: Order[]): OrderStoreGroup[] {
  const stores: OrderStoreGroup[] = [];
  const byKey = new Map<string, OrderStoreGroup>();
  for (const order of orders) {
    const key = storeKey(order);
    let store = byKey.get(key);
    if (!store) {
      store = { key, host: orderStoreHost(order), brand: order.product.brand ?? '', country: order.product.country ?? '', orders: [], items: 0, payable: 0 };
      byKey.set(key, store);
      stores.push(store);
    }
    store.orders.push(order);
    if (!order.cancelled) {
      store.items += order.quantity;
      store.payable += orderPayable(order);
    }
  }
  return stores;
}

function buildGroup(key: string, batchId: string | undefined, orders: Order[]): OrderGroup {
  const live = orders.filter((order) => !order.cancelled);
  const inProgress = live.filter((order) => order.status < 5);
  const attention = live.filter(orderNeedsCustomerDecision).length;
  const cancelled = orders.length - live.length;
  const status = live.length === 0 ? undefined : inProgress.length ? Math.min(...inProgress.map((order) => order.status)) : 5;
  const stage: OrderGroupStage = live.length === 0 ? 'cancelled' : attention ? 'attention' : inProgress.length ? 'active' : 'done';
  return {
    key,
    batchId,
    orders,
    stores: buildStores(orders),
    payable: live.reduce((sum, order) => sum + orderPayable(order), 0),
    items: live.reduce((sum, order) => sum + order.quantity, 0),
    createdAt: Math.min(...orders.map((order) => order.createdAt)),
    status,
    stage,
    attention,
    cancelled,
  };
}

/** Groups in the order the lines are given (first line of each group wins); the lines keep their order inside. */
export function groupOrders(orders: readonly Order[]): OrderGroup[] {
  const groups: OrderGroup[] = [];
  const byBatch = new Map<string, Order[]>();
  const sequence: { key: string; batchId?: string; orders: Order[] }[] = [];
  for (const order of orders) {
    if (!order.batchId) {
      sequence.push({ key: `order:${order.id}`, orders: [order] });
      continue;
    }
    let batch = byBatch.get(order.batchId);
    if (!batch) {
      batch = [];
      byBatch.set(order.batchId, batch);
      sequence.push({ key: `batch:${order.batchId}`, batchId: order.batchId, orders: batch });
    }
    batch.push(order);
  }
  for (const entry of sequence) groups.push(buildGroup(entry.key, entry.batchId, entry.orders));
  return groups;
}

/** "Nike" for a known store host, the host itself for an unknown one, the brand for a catalogue item. */
export function storeGroupName(store: Pick<OrderStoreGroup, 'host' | 'brand'>, locale: Locale) {
  return (store.host && storefrontLabel(store.host, locale)) || store.brand || store.host;
}

/** Distinct store names of a group, in order of appearance. */
export function groupStoreNames(group: Pick<OrderGroup, 'stores'>, locale: Locale) {
  return [...new Set(group.stores.map((store) => storeGroupName(store, locale)).filter(Boolean))];
}

export type OrderGroupCopy = {
  /** "Заказ от 6 октября" — the group heading; the date is formatted by the caller. */
  title: (date: string) => string;
  /** "Из Nike (США)" — a store section heading; country already localized, may be empty. */
  from: (store: string, country: string) => string;
  payable: string;
  stage: { attention: string; active: string; done: string; cancelled: string };
  cancelledLines: (count: number) => string;
  /** "Доставка" row label in order details. */
  delivery: string;
  speed: Record<DeliverySpeed, string>;
  days: (min: number, max: number) => string;
};

export const orderGroupCopy: Record<Locale, OrderGroupCopy> = withCyrillic({
  ru: {
    title: (date) => `Заказ от ${date}`,
    from: (store, country) => country ? `Из ${store} (${country})` : `Из ${store}`,
    payable: 'К оплате',
    stage: { attention: 'Нужно ваше решение', active: 'В работе', done: 'Выполнен', cancelled: 'Отменён' },
    cancelledLines: (count) => `${count} отменено`,
    delivery: 'Доставка',
    speed: { express: 'Экспресс', standard: 'Обычная доставка' },
    days: (min, max) => `${min}–${max} раб. дней`,
  },
  uz: {
    title: (date) => `${date} buyurtmasi`,
    from: (store, country) => country ? `${store} (${country}) dan` : `${store} dan`,
    payable: 'To‘lovga',
    stage: { attention: 'Qaroringiz kerak', active: 'Jarayonda', done: 'Bajarildi', cancelled: 'Bekor qilingan' },
    cancelledLines: (count) => `${count} ta bekor qilingan`,
    delivery: 'Yetkazib berish',
    speed: { express: 'Ekspress', standard: 'Oddiy yetkazib berish' },
    days: (min, max) => `${min}–${max} ish kuni`,
  },
  en: {
    title: (date) => `Order of ${date}`,
    from: (store, country) => country ? `From ${store} (${country})` : `From ${store}`,
    payable: 'To pay',
    stage: { attention: 'Your decision is needed', active: 'In progress', done: 'Completed', cancelled: 'Cancelled' },
    cancelledLines: (count) => `${count} cancelled`,
    delivery: 'Delivery',
    speed: { express: 'Express', standard: 'Standard delivery' },
    days: (min, max) => `${min}–${max} business days`,
  },
});
