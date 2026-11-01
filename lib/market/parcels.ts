import { claimKindsOpen, deliveredStage, parcelStageOf, pendingExtraCharge, type DeliveryProfile, type Order, type State } from './domain.ts';
import { groupOrders, type OrderGroup, type OrderStoreGroup } from './order-groups.ts';
import { orderAttention, parcelPath } from './notice-panel.ts';
import { documentsPath, missingPassports } from './profile-strip.ts';

/**
 * The buyer's profile is built around the parcel (owner, 1 November 2026; docs/adr/0001-parcel-is-the-tracked-object.md):
 * everything that travels to Tashkent in one box — the lines of one checkout from one store and dispatch country, the
 * same key the warehouse weighs them by (domain.ts storeParcelKey, order-groups.ts buildStores). Until the overseas
 * warehouse each order keeps its own purchase stage; from there the parcel has one stage for all of them.
 */
export type BuyerParcel = {
  /** The parcel's first order: its page is /account/parcels/<id>, and any order of the parcel opens it too. */
  id: string;
  group: OrderGroup;
  store: OrderStoreGroup;
  /** Every line of the parcel, cancelled ones too, in checkout order. */
  orders: Order[];
  live: Order[];
  /** The least advanced live line on the eight-stage scale; undefined when every line is cancelled. */
  stage?: number;
  /** The checkout still waits for its one payment: stage 0 reads "Ждёт оплаты", not "Ожидает выкупа". */
  awaitingPayment: boolean;
  /** Recipient and address shared by the live lines (one per checkout since 6 October 2026). */
  delivery?: DeliveryProfile;
  deliveryProfileId?: string;
  createdAt: number;
};

/** Every parcel of the account, newest checkout first (the account keeps its orders newest first). */
export function buyerParcels(orders: readonly Order[]): BuyerParcel[] {
  return groupOrders(orders).flatMap((group) => group.stores.map((store) => {
    const live = store.orders.filter((order) => !order.cancelled);
    const stage = live.length ? Math.min(...live.map(parcelStageOf)) : undefined;
    return {
      id: store.orders[0].id,
      group,
      store,
      orders: store.orders,
      live,
      ...(stage !== undefined ? { stage } : {}),
      awaitingPayment: live.some((order) => order.payment?.status === 'pending'),
      ...(group.delivery ? { delivery: group.delivery.profile } : live[0]?.delivery ? { delivery: live[0].delivery } : {}),
      ...(live[0]?.deliveryProfileId ? { deliveryProfileId: live[0].deliveryProfileId } : {}),
      createdAt: Math.min(...store.orders.map((order) => order.createdAt)),
    };
  }));
}

/** The parcel an order belongs to (any of its order numbers opens the page). */
export function parcelOf(orders: readonly Order[], orderId: string): BuyerParcel | undefined {
  return buyerParcels(orders).find((parcel) => parcel.orders.some((order) => order.id === orderId));
}

/** On its way or not yet bought: shown under "Активные посылки". */
export const parcelActive = (parcel: BuyerParcel) => parcel.stage !== undefined && parcel.stage < deliveredStage;

/** What the buyer has to do. `passport` is new here (1 November 2026): customs needs it before dispatch. */
export type ProfileActionKind = 'extra' | 'change' | 'payment' | 'passport';
export type ProfileAction = {
  kind: ProfileActionKind;
  /** The order the action is about (the first unpaid line of a checkout, the line with the decision). */
  orderId: string;
  /** The parcel of that order: the hub links the action to its parcel card. */
  parcelId: string;
  /** Where the one button leads: the decision or the payment on "Мои заказы", the passport on the documents page. */
  href: string;
  name: string;
  /** Payment: the checkout's one amount; доплата: the amount waiting for the buyer's approval. */
  amount?: number;
  /** Payment: items in the checkout. */
  items?: number;
  /** Payment: live lines of the checkout (one line is named by its product, several by their item count). */
  lines?: number;
  /** Passport: the saved recipient. */
  recipientId?: string;
  recipientName?: string;
};

/** The доплата an order waits for: the store's shipping, the warehouse weight, the customs duty, or an extra invoice
 *  (the amounts of the "Доплатить" buttons on "Мои заказы", app/order-workspace.tsx and app/order-extra-charges.tsx). */
export function pendingExtraAmount(order: Order): number {
  return (!order.storeShippingExtraApproved ? order.storeShippingSettlement?.extra ?? 0 : 0)
    || (!order.extraApproved ? order.settlement?.extra ?? 0 : 0)
    || (!order.customsExtraApproved ? order.customsSettlement?.extra ?? 0 : 0)
    || (pendingExtraCharge(order)?.amount ?? 0);
}

type ActionState = Pick<State, 'orders' | 'deliveryProfiles'> & Partial<Pick<State, 'identityProfiles' | 'identityProfile'>>;

/**
 * «Требует действия»: a доплата or a change first (one per checkout), then each checkout's one payment, then each
 * recipient's passport. The same reasons as the header dot and the notifications panel (notice-panel.ts orderAttention).
 */
export function profileActions(state: ActionState): ProfileAction[] {
  const parcels = buyerParcels(state.orders);
  const parcelIdOf = (orderId: string) => parcels.find((parcel) => parcel.orders.some((order) => order.id === orderId))?.id ?? orderId;
  const decisions: ProfileAction[] = [], payments: ProfileAction[] = [], seenCheckouts = new Set<string>();
  for (const order of state.orders) {
    const reason = orderAttention(order);
    if (reason !== 'extra' && reason !== 'change') continue;
    const checkout = order.batchId ?? order.id;
    if (seenCheckouts.has(checkout)) continue;
    seenCheckouts.add(checkout);
    const extra = reason === 'extra' ? pendingExtraAmount(order) : 0;
    decisions.push({ kind: reason, orderId: order.id, parcelId: parcelIdOf(order.id), href: '/orders#' + encodeURIComponent(order.id), name: order.product.name, ...(extra > 0 ? { amount: extra } : {}) });
  }
  for (const group of groupOrders(state.orders)) {
    if (!group.payment) continue;
    const order = group.orders.find((item) => !item.cancelled && item.payment?.status === 'pending');
    if (!order) continue;
    // The amount on the pay button of "Мои заказы" (the balance part is already out of it).
    payments.push({ kind: 'payment', orderId: order.id, parcelId: parcelIdOf(order.id), href: '/orders#' + encodeURIComponent(order.id), name: order.product.name, amount: group.payment.amount, items: group.items, lines: group.orders.filter((item) => !item.cancelled).length });
  }
  const passports = missingPassports(state).map(({ recipientId, name, order }): ProfileAction => ({ kind: 'passport', orderId: order.id, parcelId: parcelIdOf(order.id), href: documentsPath(recipientId), name: order.product.name, recipientId, recipientName: name }));
  return [...decisions, ...payments, ...passports];
}

/** The parcel's one next step: its first action, if any (a passport counts for the parcel's recipient). */
export function parcelAction(parcel: BuyerParcel, actions: readonly ProfileAction[]): ProfileAction | undefined {
  const ids = new Set(parcel.orders.map((order) => order.id));
  return actions.find((action) => ids.has(action.orderId) || action.parcelId === parcel.id)
    ?? actions.find((action) => action.kind === 'passport' && action.recipientId !== undefined && action.recipientId === parcel.deliveryProfileId && parcel.stage !== undefined && parcel.stage < deliveredStage && !parcel.awaitingPayment);
}

/** Orders of the parcel where a claim can be filed now (claims are filed inside the order, domain.ts claimKindsOpen). */
export function parcelClaimOrders(parcel: BuyerParcel, now = Date.now()): Order[] {
  return parcel.live.filter((order) => claimKindsOpen(order, now).length > 0);
}

export { parcelPath, documentsPath, missingPassports };
