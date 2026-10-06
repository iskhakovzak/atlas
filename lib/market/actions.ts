import { z } from "zod";
import {
  productSchema,
  addToCart,
  changeQuantity,
  renewCart,
  repriceCart,
  customsHelpChosen,
  confirmCustomsDuty,
  approveCustomsExtra,
  checkoutCart,
  advanceOrder,
  receiveOrder,
  approveExtra,
  confirmStoreShipping,
  approveStoreShippingExtra,
  cancelOrder,
  deliverySpeedSchema,
  setCartDeliverySpeed,
  balanceOf,
  totalOf,
  validateSource,
  tariff,
  markNotificationsRead,
  deliveryProfileSchema,
  assertDeliveryAddress,
  storeDiscount,
  communicationSchema,
  confirmDemoPayment,
  updateCommunication,
  assignOrder,
  addStaffNote,
  updateOrderIssueCase,
  sendCustomerNotification,
  setParcel,
  confirmIdentity,
  clearIdentity,
  saveDeliveryProfile,
  submitDeclarationPreview,
  createChangeRequest,
  respondToChangeRequest,
  inspectWarehouseOrder,
  setCartServices,
  requestWarehouseService,
  completeWarehouseService,
  declineWarehouseService,
  changeRequestKindSchema,
  warehouseConditionSchema,
  warehouseServiceSchema,
  orderIssueCategorySchema,
  orderIssueStatusSchema,
  cartCustomsSchema,
  setCartNote,
  setCartCustoms,
  type Pricing,
  type Product,
  type State,
} from "./domain.ts";
import { cartCustomsEstimate } from "./allowance.ts";
import { assertCartPolicy, defaultPolicy, productRestriction, type Policy } from "./policy.ts";
import { customsVersion, paddedWeight, toUsd } from "./world.ts";
import { safeImage } from "../importer/extract.ts";
const id = z.string().max(5000),
  amount = z.number().finite().nonnegative();
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("favorite"), id }),
  z.object({ type: z.literal("order-image"), id, image: z.string().max(5000) }),
  z.object({
    type: z.literal("cart-add"),
    product: productSchema,
    variant: z.string(),
    quantity: z.number().int().min(1).max(10).optional(),
    note: z.string().max(500).optional(),
  }),
  // Several options of one product at once (sizes, colors), each with its own quantity; one store check covers them.
  z.object({
    type: z.literal("cart-add-many"),
    items: z.array(z.object({ product: productSchema, variant: z.string(), quantity: z.number().int().min(1).max(10) })).min(1).max(20),
    note: z.string().max(500).optional(),
  }),
  z.object({ type: z.literal("cart-note"), id, note: z.string().max(500) }),
  z.object({ type: z.literal("cart-customs"), value: cartCustomsSchema }),
  z.object({
    type: z.literal("cart-quantity"),
    id,
    quantity: z.number().int().min(1).max(10),
  }),
  z.object({ type: z.literal("cart-remove"), id }),
  z.object({ type: z.literal("cart-services"), id, serviceIds: z.array(z.string().min(2).max(80)).max(40), serviceUnits: z.record(z.string().min(2).max(80), z.number().int().min(1).max(100)).optional() }),
  z.object({ type: z.literal("cart-renew") }),
  // Before checkout: the server checks prices with the stores and reprices the cart (app/api/actions/route.ts).
  z.object({ type: z.literal("cart-check") }),
  z.object({
    type: z.literal("checkout"),
    key: id,
    signature: z.string().max(100000),
    useBalance: z.boolean(),
    expectedCredit: amount,
    consentVersion: z.literal(customsVersion),
    delivery: deliveryProfileSchema.optional(),
    deliveryProfileId: z.string().min(1).max(80).optional(),
    identityProfileId: z.string().min(1).max(100).optional(),
    // Keeps an address typed at checkout as a saved recipient; the orders then refer to it.
    saveRecipientLabel: z.string().trim().min(1).max(60).optional(),
    // The postal code for a recipient saved before it was required; saved into that recipient.
    postalCode: z.string().trim().max(20).optional(),
    // "Atlas pays customs for me": the duty the confirmation step showed for this recipient (soum).
    customsDuty: amount.optional(),
  }),
  z.object({ type: z.literal("payment-demo"), id }),
  z.object({ type: z.literal("communication-save"), value: communicationSchema }),
  // `id` edits a saved recipient; `primary` chooses the default one. Older clients send neither.
  z.object({ type: z.literal("delivery-profile-save"), value: deliveryProfileSchema, label: z.string().trim().min(1).max(60), id: z.string().min(1).max(80).optional(), primary: z.boolean().optional() }),
  z.object({ type: z.literal("delivery-profile-remove"), id: z.string().min(1).max(80) }),
  z.object({ type: z.literal("support-create"), subject: z.string().trim().min(3).max(120), text: z.string().trim().min(1).max(1000) }),
  z.object({ type: z.literal("support-reply"), id: z.string().min(1).max(80), text: z.string().trim().min(1).max(1000) }),
  z.object({
    type: z.literal("assign-order"),
    id,
    team: z.enum(["Закупки", "Склад", "Поддержка", "Финансы"]),
    priority: z.enum(["Обычный", "Высокий", "Срочный"]),
  }),
  z.object({ type: z.literal("staff-note"), id, text: z.string().min(1).max(500) }),
  z.object({ type: z.literal("customer-notification"), id, title: z.string().trim().min(2).max(120), message: z.string().trim().min(1).max(300) }),
  z.object({ type: z.literal("order-issue-update"), id, category: orderIssueCategorySchema, status: orderIssueStatusSchema, proposedRefund: z.number().int().min(0).max(100_000_000).optional() }),
  z.object({
    type: z.literal("change-request-create"),
    id,
    kind: changeRequestKindSchema,
    title: z.string().trim().min(2).max(120),
    reason: z.string().trim().min(2).max(500),
    previousValue: z.string().trim().max(240).optional(),
    proposedValue: z.string().trim().max(240).optional(),
    warehouseServiceRequestId: z.string().min(1).max(100).optional(),
    resolvesWarehouseIssue: z.boolean().optional(),
    amountDelta: z.number().int().min(-100_000_000).max(100_000_000),
  }),
  z.object({
    type: z.literal("change-request-respond"),
    id,
    requestId: z.string().min(1).max(100),
    decision: z.enum(["approved", "declined"]),
    expectedAmountDelta: z.number().int().min(-100_000_000).max(100_000_000),
  }),
  z.object({
    type: z.literal("warehouse-inspect"),
    id,
    condition: warehouseConditionSchema,
    quantityReceived: z.number().int().min(0).max(100),
    notes: z.string().trim().max(500),
    services: z.array(warehouseServiceSchema).max(5),
    packageGroup: z.string().trim().max(80),
  }),
  z.object({ type: z.literal("warehouse-service-request"), id, serviceId: z.string().min(2).max(80), units: z.number().int().min(1).max(100).default(1), customerNote: z.string().trim().max(500).optional() }),
  z.object({ type: z.literal("warehouse-service-complete"), id, requestId: z.string().min(1).max(100) }),
  z.object({ type: z.literal("warehouse-service-decline"), id, requestId: z.string().min(1).max(100), reason: z.string().trim().min(2).max(500) }),
  z.object({
    type: z.literal("parcel-set"),
    id,
    carrier: z.string().min(2).max(80),
    trackingNumber: z.string().min(3).max(100),
    warehouseCode: z.string().max(80),
  }),
  z.object({ type: z.literal("advance"), id, expected: z.number().int() }),
  z.object({
    type: z.literal("receive"),
    id,
    dimensions: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  }),
  z.object({ type: z.literal("approve-extra"), id, amount }),
  z.object({ type: z.literal("confirm-store-shipping"), id, actualUsd: amount }),
  z.object({ type: z.literal("approve-store-shipping-extra"), id, amount }),
  z.object({ type: z.literal("confirm-customs-duty"), id, actualUsd: amount }),
  z.object({ type: z.literal("approve-customs-extra"), id, amount }),
  z.object({ type: z.literal("cancel"), id }),
  z.object({ type: z.literal("cart-delivery-speed"), speed: deliverySpeedSchema }),
  z.object({ type: z.literal("notifications-read") }),
  z.object({ type: z.literal("identity-confirm"), documentId: z.string().min(1).max(100), recipientProfileId: z.string().min(1).max(80).optional(), firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), birthDate: z.string(), passportNumber: z.string().min(6).max(24), nationality: z.string().trim().max(80) }),
  z.object({ type: z.literal("identity-clear"), documentId: z.string().min(1).max(100) }),
  z.object({ type: z.literal("declaration-preview"), orderIds: z.array(z.string().max(100)).min(1).max(30) }),
  // No action may replace the account document wholesale: the former "import-legacy" took client JSON
  // as the whole state, so a customer could write their own balance, paid orders and staff fields.
]);
export type Action = z.infer<typeof actionSchema>;
/** A product as the server accepts it into the cart: USD, store delivery and weight recomputed from the store data. */
function checkedCartProduct(sent: Product, pricing: Pricing, policy: Policy): Product {
  // The "before the discount" price is display only; one that is not above the price is dropped.
  const product: Product = storeDiscount(sent) ? sent : { ...sent, sourceReferencePrice: undefined };
  const restriction = productRestriction(product, policy);
  if (restriction) throw Error(restriction);
  if (!product.sourceUrl) return product;
  if (product.boxedWeight === undefined || !product.country || !product.shippingKnown)
    throw Error("Укажите страну, вес с коробкой и доставку магазина.");
  const sourceUrl = validateSource(product.sourceUrl);
  if (product.sourcePrice === undefined || product.sourceShipping === undefined || !product.sourceCurrency)
    throw Error("Укажите цену, валюту и доставку магазина.");
  if (product.image && !safeImage(product.image, sourceUrl)) throw Error("Некорректная ссылка на изображение.");
  if (product.sourceImages?.some((image) => !safeImage(image, sourceUrl))) throw Error("Некорректная ссылка на изображение.");
  return {
    ...product,
    sourceUrl,
    usd: toUsd(product.sourcePrice, product.sourceCurrency, pricing.rates),
    sourceShippingUsd: toUsd(product.sourceShipping, product.sourceShippingCurrency ?? product.sourceCurrency, pricing.rates),
    weight: paddedWeight(product.boxedWeight),
  };
}
export function applyAction(
  s: State,
  a: Action,
  isOperator: boolean,
  pricing: Pricing = tariff,
  policy: Policy = defaultPolicy,
): State {
  if (
    (a.type === "advance" ||
      a.type === "receive" ||
      a.type === "confirm-store-shipping" ||
      a.type === "confirm-customs-duty" ||
      a.type === "assign-order" ||
      a.type === "staff-note" ||
      a.type === "customer-notification" ||
      a.type === "order-issue-update" ||
      a.type === "parcel-set" ||
      a.type === "change-request-create" ||
      a.type === "warehouse-inspect" ||
      a.type === "warehouse-service-complete" ||
      a.type === "warehouse-service-decline") &&
    !isOperator
  )
    throw Error("Доступно только оператору.");
  if (a.type === "warehouse-service-request" && isOperator)
    throw Error("Запросить дополнительную услугу может владелец заказа.");
  switch (a.type) {
    case "order-image": {
      const o = s.orders.find((o) => o.id === a.id);
      if (!o?.product.sourceUrl)
        throw Error("У заказа нет ссылки на источник.");
      const image = safeImage(a.image, o.product.sourceUrl);
      if (!image) throw Error("Изображение недоступно.");
      return {
        ...s,
        orders: s.orders.map((x) =>
          x.id === a.id
            ? {
                ...x,
                product: {
                  ...x.product,
                  image,
                  imageOrigin: "страница магазина",
                },
                history: [
                  ...x.history,
                  {
                    at: Date.now(),
                    text: "Обновлено фото товара из источника.",
                  },
                ],
              }
            : x,
        ),
      };
    }
    case "favorite":
      return {
        ...s,
        favorites: s.favorites.includes(a.id)
          ? s.favorites.filter((i) => i !== a.id)
          : [...s.favorites, a.id],
      };
    case "cart-add": {
      const next = addToCart(s, checkedCartProduct(a.product, pricing, policy), a.variant, Date.now(), pricing, a.quantity ?? 1, a.note);
      assertCartPolicy(next.cart, policy);
      return next;
    }
    case "cart-add-many": {
      const now = Date.now();
      // One revision: either every chosen option is added, or none.
      const next = a.items.reduce((state, item) => addToCart(state, checkedCartProduct(item.product, pricing, policy), item.variant, now, pricing, item.quantity, a.note), s);
      assertCartPolicy(next.cart, policy);
      return next;
    }
    case "cart-note":
      return setCartNote(s, a.id, a.note);
    case "cart-customs":
      return setCartCustoms(s, a.value, Date.now(), pricing);
    case "cart-quantity":
      { const next = changeQuantity(s, a.id, a.quantity, Date.now(), pricing); assertCartPolicy(next.cart, policy); return next; }
    case "cart-remove":
      // The rest of that store's parcel is priced again: its shipping share and store-delivery reserve change.
      return { ...s, cart: repriceCart(s.cart.filter((i) => i.id !== a.id), Date.now(), pricing, customsHelpChosen(s)) };
    case "cart-services":
      return setCartServices(s, a.id, a.serviceIds, pricing, a.serviceUnits);
    case "cart-renew":
    case "cart-check":
      return renewCart(s, Date.now(), pricing);
    case "checkout": {
      if (s.checkoutKeys.includes(a.key)) return s;
      if (
        (a.useBalance
          // The prepaid duty (checked against the server's figure in checkoutCart) is part of what the balance can pay.
          ? Math.min(totalOf(s.cart) + (customsHelpChosen(s) ? a.customsDuty ?? 0 : 0), Math.max(0, balanceOf(s)))
          : 0) !== a.expectedCredit
      )
        throw Error("Баланс изменился. Проверьте итог заново.");
      assertCartPolicy(s.cart, policy);
      // Saved in the same revision as the orders, so a failed checkout saves nothing.
      let next = s, deliveryProfileId = a.deliveryProfileId;
      if (a.saveRecipientLabel && !deliveryProfileId && a.delivery) {
        const value = deliveryProfileSchema.parse(a.delivery);
        next = saveDeliveryProfile(s, value, a.saveRecipientLabel, undefined, !s.deliveryProfiles.length);
        deliveryProfileId = next.deliveryProfiles.find((profile) => JSON.stringify(deliveryProfileSchema.parse(profile)) === JSON.stringify(value))?.id;
      }
      if (deliveryProfileId && a.postalCode) {
        const stored = next.deliveryProfiles.find((profile) => profile.id === deliveryProfileId);
        if (stored) next = saveDeliveryProfile(next, { ...deliveryProfileSchema.parse(stored), postalCode: a.postalCode }, stored.label, stored.id, stored.primary);
      }
      // An order needs the street address and a six-digit postal code. A missing saved recipient is reported by checkoutCart.
      const address = deliveryProfileId ? next.deliveryProfiles.find((profile) => profile.id === deliveryProfileId) : a.delivery ?? next.deliveryProfile;
      if (!deliveryProfileId || address) assertDeliveryAddress(address);
      // The server works out the customs estimate for the chosen recipient; the browser's figures are not used.
      const recipientProfile = deliveryProfileId ? next.deliveryProfiles.find((profile) => profile.id === deliveryProfileId) : undefined;
      const customs = cartCustomsEstimate(next, pricing, { profile: recipientProfile, name: a.delivery?.recipient });
      return checkoutCart(
        next,
        a.key,
        a.signature,
        a.useBalance,
        Date.now(),
        a.consentVersion,
        a.delivery,
        deliveryProfileId,
        a.identityProfileId,
        pricing,
        customs,
        a.customsDuty,
      );
    }
    case "payment-demo":
      return confirmDemoPayment(s, a.id);
    case "communication-save":
      return updateCommunication(s, a.value);
    case "delivery-profile-save": {
      const value = deliveryProfileSchema.parse(a.value);
      const stored = a.id ? s.deliveryProfiles.find((profile) => profile.id === a.id) : undefined;
      // Making an older recipient the default does not ask for the postal code it was saved without; any edit does.
      const unchanged = stored && JSON.stringify(deliveryProfileSchema.parse(stored)) === JSON.stringify(value);
      if (!unchanged) assertDeliveryAddress(value);
      return saveDeliveryProfile(s, value, a.label, a.id, a.primary);
    }
    case "delivery-profile-remove": {
      const rest = s.deliveryProfiles.filter((item) => item.id !== a.id);
      const remaining = rest.length && !rest.some((item) => item.primary) ? rest.map((item, index) => ({ ...item, primary: index === 0 })) : rest;
      return { ...s, deliveryProfiles: remaining, deliveryProfile: remaining.find((item) => item.primary) ?? remaining[0], identityProfiles: s.identityProfiles?.map((profile) => profile.recipientProfileId === a.id ? { ...profile, recipientProfileId: undefined } : profile) };
    }
    case "support-create": {
      const now = Date.now();
      const ticket = { id: `SUP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, subject: a.subject, status: "open" as const, createdAt: now, updatedAt: now, replies: [{ id: crypto.randomUUID(), at: now, author: "customer" as const, text: a.text }] };
      return { ...s, supportTickets: [ticket, ...s.supportTickets] };
    }
    case "support-reply":
      return { ...s, supportTickets: s.supportTickets.map((ticket) => ticket.id === a.id ? { ...ticket, status: isOperator ? "answered" as const : "open" as const, updatedAt: Date.now(), replies: [...ticket.replies, { id: crypto.randomUUID(), at: Date.now(), author: isOperator ? "support" as const : "customer" as const, text: a.text }] } : ticket) };
    case "assign-order":
      return assignOrder(s, a.id, a.team, a.priority);
    case "staff-note":
      return addStaffNote(s, a.id, a.text, "Оператор");
    case "customer-notification":
      return sendCustomerNotification(s, a.id, a.title, a.message);
    case "order-issue-update":
      return updateOrderIssueCase(s, a.id, a.category, a.status, a.proposedRefund);
    case "change-request-create":
      return createChangeRequest(s, a.id, a);
    case "change-request-respond":
      return respondToChangeRequest(s, a.id, a.requestId, a.decision, a.expectedAmountDelta);
    case "warehouse-inspect":
      return inspectWarehouseOrder(s, a.id, a);
    case "warehouse-service-request":
      return requestWarehouseService(s, a.id, a.serviceId, a.units, pricing, Date.now(), a.customerNote);
    case "warehouse-service-complete":
      return completeWarehouseService(s, a.id, a.requestId);
    case "warehouse-service-decline":
      return declineWarehouseService(s, a.id, a.requestId, a.reason);
    case "parcel-set":
      return setParcel(s, a.id, a.carrier, a.trackingNumber, a.warehouseCode);
    case "advance":
      return advanceOrder(s, a.id, a.expected);
    case "receive":
      return receiveOrder(s, a.id, a.dimensions);
    case "approve-extra":
      return approveExtra(s, a.id, a.amount);
    case "confirm-customs-duty":
      return confirmCustomsDuty(s, a.id, a.actualUsd);
    case "approve-customs-extra":
      return approveCustomsExtra(s, a.id, a.amount);
    case "confirm-store-shipping":
      return confirmStoreShipping(s, a.id, a.actualUsd);
    case "approve-store-shipping-extra":
      return approveStoreShippingExtra(s, a.id, a.amount);
    case "cancel":
      return cancelOrder(s, a.id);
    case "cart-delivery-speed":
      return setCartDeliverySpeed(s, a.speed, Date.now(), pricing);
    case "notifications-read":
      return markNotificationsRead(s);
    case "identity-confirm":
      return confirmIdentity(s, a);
    case "identity-clear":
      return clearIdentity(s, a.documentId);
    case "declaration-preview":
      return submitDeclarationPreview(s, a.orderIds);
  }
}
