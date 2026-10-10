import { orderPayable, type DeliveryProfile, type DeliverySpeed, type Order, type WarehouseServiceRequest } from './domain.ts';
import { localizedStatuses, type Locale } from './i18n.ts';
import { brandForHost, storefrontLabel } from './store-brands.ts';
import {withCyrillic} from './uz-cyrl.ts';

/**
 * "My orders" shows one checkout as one group: every cart line becomes its own Order at checkout
 * (domain.ts checkoutCart), and all lines of one checkout share `batchId`. Inside a group the lines
 * are split by store and dispatch country, the same key that makes one parcel (domain.ts storeParcelKey),
 * and inside a store by model (one product in several sizes or colors), so the list reads
 * checkout → store parcel → item → variants, each variant line with its own stage.
 * Orders placed before batch ids, or by link one at a time, form a group of one.
 */

/** The customer-facing stage of a group, from the most urgent line down. */
export type OrderGroupStage = 'attention' | 'active' | 'done' | 'cancelled';
/** The tab of "My orders" a whole checkout sits in: its lines never spread over several tabs. */
export type OrderGroupTab = 'attention' | 'active' | 'done';

/** One model in a store section: the lines that differ only by variant (size, color) and quantity. */
export type OrderModelGroup = {
  key: string;
  /** Product of the first line: the model's name, photo and link. */
  product: Order['product'];
  orders: Order[];
  /** Quantity over the lines that are not cancelled. */
  items: number;
};

/** A warehouse service asked once for a whole store parcel (since 7 October 2026), kept on one order of it: `holder`. */
export type ParcelServiceRequest = { request: WarehouseServiceRequest; holder: string };

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
  models: OrderModelGroup[];
  /** Services asked for the whole parcel: shown once on the store section, not on every line. */
  parcelServices: ParcelServiceRequest[];
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
  /** "Нужно решение" when a line waits for the customer, "В работе" while a line moves, "Завершённые" when all are delivered or cancelled. */
  tab: OrderGroupTab;
  /** Lines not cancelled, counted by status, lowest status first: `[{ status: 3, count: 2 }, { status: 5, count: 1 }]`. */
  progress: { status: number; count: number }[];
  /** Newest history entry over all lines (by time, not position): the last thing that happened to this checkout. */
  latest?: { order: Order; entry: Order['history'][number] };
  /** Things that wait for the customer: one per line decision, plus one for the checkout's payment. */
  attention: number;
  /** The checkout's payment still to record: one payment for every waiting line, never one per line. */
  payment?: { id: string; amount: number; lines: number };
  /** Recipient, address and speed shared by every live line: shown once on the card, not in each line. */
  delivery?: { profile: DeliveryProfile; speed: DeliverySpeed };
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

/** The customer must act: an extra to approve (weighing, store delivery, duty), a pending change request, or a payment to record. */
export function orderNeedsCustomerDecision(order: Order) {
  if (order.cancelled) return false;
  return Boolean(order.settlement?.extra && !order.extraApproved)
    || Boolean(order.storeShippingSettlement?.extra && !order.storeShippingExtraApproved)
    || Boolean(order.customsSettlement?.extra && !order.customsExtraApproved)
    || (order.extraCharges ?? []).some((charge) => charge.status === 'pending')
    || (order.changeRequests ?? []).some((request) => request.status === 'pending')
    || order.payment?.status === 'pending';
}

/** A decision about this line itself; the payment is the whole checkout's (see `OrderGroup.payment`). */
export function orderNeedsLineDecision(order: Order) {
  return orderNeedsCustomerDecision({ ...order, payment: undefined });
}

/** The same model in the cart and in orders: link + name for imported goods (their id carries the variant), else the id. */
export function orderModelKey(order: Pick<Order, 'product'>) {
  return order.product.sourceUrl ? `${order.product.sourceUrl}\n${order.product.name}` : order.product.id;
}

/** A request that covers more than its own order: one warehouse service for the whole store parcel. */
export function isParcelServiceRequest(request: Pick<WarehouseServiceRequest, 'parcelOrderIds'>) {
  return (request.parcelOrderIds?.length ?? 0) > 1;
}

/** Parcel-wide requests among `orders` that cover `orderId`, wherever they are kept. */
export function parcelServicesFor(orders: readonly Order[], orderId: string): ParcelServiceRequest[] {
  return orders.flatMap((order) => (order.warehouseServiceRequests ?? [])
    .filter((request) => isParcelServiceRequest(request) && request.parcelOrderIds!.includes(orderId))
    .map((request) => ({ request, holder: order.id })));
}

function storeKey(order: Order) {
  const host = orderStoreHost(order);
  // Without a store link (catalogue items), lines of one brand and country still travel as one parcel.
  if (host) return `store:${host}:${order.product.country ?? ''}`;
  return order.product.brand ? `brand:${order.product.brand}:${order.product.country ?? ''}` : `item:${order.id}`;
}

function buildModels(orders: Order[]): OrderModelGroup[] {
  const models: OrderModelGroup[] = [];
  const byKey = new Map<string, OrderModelGroup>();
  for (const order of orders) {
    const key = orderModelKey(order);
    let model = byKey.get(key);
    if (!model) {
      model = { key, product: order.product, orders: [], items: 0 };
      byKey.set(key, model);
      models.push(model);
    }
    model.orders.push(order);
    if (!order.cancelled) model.items += order.quantity;
  }
  return models;
}

function buildStores(orders: Order[]): OrderStoreGroup[] {
  const stores: OrderStoreGroup[] = [];
  const byKey = new Map<string, OrderStoreGroup>();
  for (const order of orders) {
    const key = storeKey(order);
    let store = byKey.get(key);
    if (!store) {
      store = { key, host: orderStoreHost(order), brand: order.product.brand ?? '', country: order.product.country ?? '', orders: [], models: [], parcelServices: [], items: 0, payable: 0 };
      byKey.set(key, store);
      stores.push(store);
    }
    store.orders.push(order);
    if (!order.cancelled) {
      store.items += order.quantity;
      store.payable += orderPayable(order);
    }
  }
  for (const store of stores) {
    store.models = buildModels(store.orders);
    store.parcelServices = store.orders.flatMap((order) => (order.warehouseServiceRequests ?? [])
      .filter(isParcelServiceRequest)
      .map((request) => ({ request, holder: order.id })));
  }
  return stores;
}

function latestEvent(orders: Order[]): OrderGroup['latest'] {
  let latest: OrderGroup['latest'];
  for (const order of orders) {
    for (const entry of order.history) if (!latest || entry.at >= latest.entry.at) latest = { order, entry };
  }
  return latest;
}

/** The recipient and speed of a checkout when all its live lines agree (they do for every checkout since 6 October 2026). */
export function sharedDelivery(orders: readonly Order[]): OrderGroup['delivery'] {
  const live = orders.filter((order) => !order.cancelled);
  const first = live[0]?.delivery;
  if (!first) return undefined;
  const key = (order: Order) => order.delivery && [order.delivery.recipient, order.delivery.phone, order.delivery.region, order.delivery.city, order.delivery.address, order.delivery.postalCode ?? '', order.quote.deliverySpeed ?? 'express'].join('|');
  const same = key(live[0]);
  return live.every((order) => key(order) === same) ? { profile: first, speed: live[0].quote.deliverySpeed ?? 'express' } : undefined;
}

function buildGroup(key: string, batchId: string | undefined, orders: Order[]): OrderGroup {
  const live = orders.filter((order) => !order.cancelled);
  const inProgress = live.filter((order) => order.status < 5);
  const waiting = live.filter((order) => order.payment?.status === 'pending');
  const payment = waiting.length ? { id: waiting[0].payment!.id, amount: waiting.reduce((sum, order) => sum + order.payment!.amount, 0), lines: waiting.length } : undefined;
  const attention = live.filter(orderNeedsLineDecision).length + (payment ? 1 : 0);
  const delivery = sharedDelivery(orders);
  const cancelled = orders.length - live.length;
  const status = live.length === 0 ? undefined : inProgress.length ? Math.min(...inProgress.map((order) => order.status)) : 5;
  const stage: OrderGroupStage = live.length === 0 ? 'cancelled' : attention ? 'attention' : inProgress.length ? 'active' : 'done';
  const counts = new Map<number, number>();
  for (const order of live) counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
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
    tab: stage === 'cancelled' ? 'done' : stage,
    progress: [...counts].sort(([a], [b]) => a - b).map(([value, count]) => ({ status: value, count })),
    latest: latestEvent(orders),
    attention,
    ...(payment ? { payment } : {}),
    ...(delivery ? { delivery } : {}),
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

/** The bare store name for a short link, "Открыть в Nike": the brand of a known host, else the host or the brand. */
export function storeShortName(store: Pick<OrderStoreGroup, 'host' | 'brand'>) {
  return (store.host && brandForHost(store.host)?.name) || store.host || store.brand;
}

/** Distinct store names of a group, in order of appearance. */
export function groupStoreNames(group: Pick<OrderGroup, 'stores'>, locale: Locale) {
  return [...new Set(group.stores.map((store) => storeGroupName(store, locale)).filter(Boolean))];
}

/**
 * The honest stage of a checkout: the status name only when every live line is at it ("В пути"); otherwise
 * "На разных этапах" with a count per status, so a group never reads "Доставлен" while a line is still on the way.
 */
export function groupStageText(group: Pick<OrderGroup, 'progress' | 'stage' | 'payment'>, locale: Locale): { label: string; summary?: string; tone: 'ok' | 'info' | 'muted' } {
  const copy = orderGroupCopy[locale];
  if (group.stage === 'cancelled' || !group.progress.length) return { label: copy.stage.cancelled, tone: 'muted' };
  const names = localizedStatuses(locale);
  if (group.progress.length === 1) {
    const [only] = group.progress;
    // Nothing is bought before the checkout's payment: say so instead of "Ожидает выкупа".
    if (group.payment && only.status === 0) return { label: copy.awaitingPayment, tone: 'info' };
    return { label: names[only.status] ?? copy.stage.active, tone: only.status === 5 ? 'ok' : 'info' };
  }
  return { label: copy.mixed, summary: group.progress.map(({ status, count }) => copy.statusCount(names[status] ?? '', count)).join(' · '), tone: 'info' };
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
  /** The lines of one checkout are at different stages. */
  mixed: string;
  /** Every line waits for the checkout's payment. */
  awaitingPayment: string;
  /** "В пути: 2" — one part of the mixed-stage summary; the status name comes localized. */
  statusCount: (status: string, count: number) => string;
  /** Badge on a checkout or a line: the customer has something to do. */
  action: (count: number) => string;
  /** "Открыть в Nike" — the short store link of a model. */
  openIn: (store: string) => string;
  /** "Последнее событие" over the whole checkout or one line. */
  latest: string;
  /** Heading of the action block of a line: what to do now. */
  now: string;
  /** Collapsible blocks of a line. */
  calculation: string;
  history: (count: number) => string;
  agreements: (count: number) => string;
  /** Services asked once for the whole store parcel. */
  parcelServices: string;
  /** Operator note on a parcel-wide service request: the orders it covers. */
  parcelCovers: (ids: string) => string;
  serviceStatus: Record<WarehouseServiceRequest['status'], string>;
  /** Line without a stored variant. */
  noVariant: string;
  /** The checkout total over the lines not cancelled. */
  total: string;
  /** "Дальше: В пути" under the compact progress. */
  next: (status: string) => string;
  /** Short recipient row label. */
  recipient: string;
  /** Accessible name of a line: "Заказ AT-1". */
  line: (id: string) => string;
  /** The checkout's one payment: heading, what it covers, the button. */
  payTitle: string;
  payCovers: (items: string) => string;
  payButton: string;
};

export const orderGroupCopy: Record<Locale, OrderGroupCopy> = /*@__PURE__*/withCyrillic({
  ru: {
    title: (date) => `Заказ от ${date}`,
    from: (store, country) => country ? `Из ${store} (${country})` : `Из ${store}`,
    payable: 'К оплате',
    stage: { attention: 'Нужно ваше решение', active: 'В работе', done: 'Выполнен', cancelled: 'Отменён' },
    cancelledLines: (count) => `${count} отменено`,
    delivery: 'Доставка',
    speed: { express: 'Экспресс', standard: 'Обычная доставка' },
    days: (min, max) => `${min}–${max} раб. дней`,
    mixed: 'На разных этапах',
    awaitingPayment: 'Ожидает оплаты',
    statusCount: (status, count) => `${status}: ${count}`,
    action: (count) => count > 1 ? `Нужно действие · ${count}` : 'Нужно действие',
    openIn: (store) => `Открыть в ${store}`,
    latest: 'Последнее событие',
    now: 'Что сделать сейчас',
    calculation: 'Подробный расчёт',
    history: (count) => `Вся история · ${count}`,
    agreements: (count) => `Согласования · ${count}`,
    parcelServices: 'Услуги для всей посылки',
    parcelCovers: (ids) => `на всю посылку: ${ids}`,
    serviceStatus: { requested: 'запрошено', quoted: 'ждёт вашего решения', approved: 'одобрено, ждёт выполнения', declined: 'отклонено', completed: 'выполнено' },
    noVariant: 'Без варианта',
    total: 'Итого',
    next: (status) => `Дальше: ${status}`,
    recipient: 'Получатель',
    line: (id) => `Заказ ${id}`,
    payTitle: 'Оплата заказа',
    payCovers: (items) => `Один платёж за весь заказ: ${items}.`,
    payButton: 'Оплатить заказ',
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
    mixed: 'Turli bosqichlarda',
    awaitingPayment: 'To‘lov kutilmoqda',
    statusCount: (status, count) => `${status}: ${count}`,
    action: (count) => count > 1 ? `Harakat kerak · ${count}` : 'Harakat kerak',
    openIn: (store) => `${store}’da ochish`,
    latest: 'So‘nggi voqea',
    now: 'Hozir nima qilish kerak',
    calculation: 'Batafsil hisob',
    history: (count) => `Butun tarix · ${count}`,
    agreements: (count) => `Kelishuvlar · ${count}`,
    parcelServices: 'Butun posilka uchun xizmatlar',
    parcelCovers: (ids) => `butun posilka uchun: ${ids}`,
    serviceStatus: { requested: 'so‘ralgan', quoted: 'qaroringiz kutilmoqda', approved: 'tasdiqlangan, bajarilishi kutilmoqda', declined: 'rad etilgan', completed: 'bajarilgan' },
    noVariant: 'Variantsiz',
    total: 'Jami',
    next: (status) => `Keyingi: ${status}`,
    recipient: 'Qabul qiluvchi',
    line: (id) => `${id} buyurtmasi`,
    payTitle: 'Buyurtma to‘lovi',
    payCovers: (items) => `Butun buyurtma uchun bitta to‘lov: ${items}.`,
    payButton: 'Buyurtmani to‘lash',
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
    mixed: 'At different stages',
    awaitingPayment: 'Awaiting payment',
    statusCount: (status, count) => `${status}: ${count}`,
    action: (count) => count > 1 ? `Action needed · ${count}` : 'Action needed',
    openIn: (store) => `View on ${store}`,
    latest: 'Latest update',
    now: 'What to do now',
    calculation: 'Detailed calculation',
    history: (count) => `Full history · ${count}`,
    agreements: (count) => `Approvals · ${count}`,
    parcelServices: 'Services for the whole parcel',
    parcelCovers: (ids) => `whole parcel: ${ids}`,
    serviceStatus: { requested: 'requested', quoted: 'awaiting your decision', approved: 'approved, awaiting fulfilment', declined: 'declined', completed: 'done' },
    noVariant: 'No variant',
    total: 'Total',
    next: (status) => `Next: ${status}`,
    recipient: 'Recipient',
    line: (id) => `Order ${id}`,
    payTitle: 'Order payment',
    payCovers: (items) => `One payment for the whole order: ${items}.`,
    payButton: 'Pay for the order',
  },
});
