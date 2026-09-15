import { z } from "zod";
import {
  productSchema,
  parseState,
  addToCart,
  changeQuantity,
  renewCart,
  checkoutCart,
  advanceOrder,
  receiveOrder,
  approveExtra,
  confirmStoreShipping,
  approveStoreShippingExtra,
  cancelOrder,
  balanceOf,
  totalOf,
  validateSource,
  tariff,
  markNotificationsRead,
  deliveryProfileSchema,
  communicationSchema,
  confirmDemoPayment,
  updateCommunication,
  assignOrder,
  addStaffNote,
  setParcel,
  confirmIdentity,
  clearIdentity,
  submitDeclarationPreview,
  createChangeRequest,
  respondToChangeRequest,
  inspectWarehouseOrder,
  changeRequestKindSchema,
  warehouseConditionSchema,
  warehouseServiceSchema,
  type Pricing,
  type State,
} from "./domain.ts";
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
  }),
  z.object({
    type: z.literal("cart-quantity"),
    id,
    quantity: z.number().int().min(1).max(10),
  }),
  z.object({ type: z.literal("cart-remove"), id }),
  z.object({ type: z.literal("cart-renew") }),
  z.object({
    type: z.literal("checkout"),
    key: id,
    signature: z.string().max(100000),
    useBalance: z.boolean(),
    expectedCredit: amount,
    consentVersion: z.literal(customsVersion),
    delivery: deliveryProfileSchema.optional(),
  }),
  z.object({ type: z.literal("payment-demo"), id }),
  z.object({ type: z.literal("communication-save"), value: communicationSchema }),
  z.object({ type: z.literal("delivery-profile-save"), value: deliveryProfileSchema, label: z.string().trim().min(1).max(60) }),
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
  z.object({
    type: z.literal("change-request-create"),
    id,
    kind: changeRequestKindSchema,
    title: z.string().trim().min(2).max(120),
    reason: z.string().trim().min(2).max(500),
    previousValue: z.string().trim().max(240).optional(),
    proposedValue: z.string().trim().max(240).optional(),
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
  z.object({ type: z.literal("cancel"), id }),
  z.object({ type: z.literal("notifications-read") }),
  z.object({ type: z.literal("identity-confirm"), documentId: z.string().min(1).max(100), firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), birthDate: z.string(), passportNumber: z.string().min(6).max(24), nationality: z.string().trim().max(80) }),
  z.object({ type: z.literal("identity-clear"), documentId: z.string().min(1).max(100) }),
  z.object({ type: z.literal("declaration-preview"), orderIds: z.array(z.string().max(100)).min(1).max(30) }),
  z.object({ type: z.literal("import-legacy"), data: z.string().max(1000000) }),
]);
export type Action = z.infer<typeof actionSchema>;
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
      a.type === "assign-order" ||
      a.type === "staff-note" ||
      a.type === "parcel-set" ||
      a.type === "change-request-create" ||
      a.type === "warehouse-inspect") &&
    !isOperator
  )
    throw Error("Доступно только оператору.");
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
      const restriction = productRestriction(a.product, policy);
      if (restriction) throw Error(restriction);
      if (a.product.sourceUrl) {
        if (
          a.product.boxedWeight === undefined ||
          !a.product.country ||
          !a.product.shippingKnown
        )
          throw Error("Укажите страну, вес с коробкой и доставку магазина.");
        a.product.sourceUrl = validateSource(a.product.sourceUrl);
        if (
          a.product.sourcePrice === undefined ||
          a.product.sourceShipping === undefined ||
          !a.product.sourceCurrency
        )
          throw Error("Укажите цену, валюту и доставку магазина.");
        a.product.usd = toUsd(
          a.product.sourcePrice,
          a.product.sourceCurrency,
          pricing.rates,
        );
        a.product.sourceShippingUsd = toUsd(
          a.product.sourceShipping,
          a.product.sourceShippingCurrency ?? a.product.sourceCurrency,
          pricing.rates,
        );
        a.product.weight = paddedWeight(a.product.boxedWeight);
        if (a.product.image && !safeImage(a.product.image, a.product.sourceUrl))
          throw Error("Некорректная ссылка на изображение.");
      }
      const next = addToCart(s, a.product, a.variant, Date.now(), pricing);
      assertCartPolicy(next.cart, policy);
      return next;
    }
    case "cart-quantity":
      { const next = changeQuantity(s, a.id, a.quantity, Date.now(), pricing); assertCartPolicy(next.cart, policy); return next; }
    case "cart-remove":
      return { ...s, cart: s.cart.filter((i) => i.id !== a.id) };
    case "cart-renew":
      return renewCart(s, Date.now(), pricing);
    case "checkout":
      if (s.checkoutKeys.includes(a.key)) return s;
      if (
        (a.useBalance
          ? Math.min(totalOf(s.cart), Math.max(0, balanceOf(s)))
          : 0) !== a.expectedCredit
      )
        throw Error("Баланс изменился. Проверьте итог заново.");
      assertCartPolicy(s.cart, policy);
      return checkoutCart(
        s,
        a.key,
        a.signature,
        a.useBalance,
        Date.now(),
        a.consentVersion,
        a.delivery,
      );
    case "payment-demo":
      return confirmDemoPayment(s, a.id);
    case "communication-save":
      return updateCommunication(s, a.value);
    case "delivery-profile-save": {
      const value = deliveryProfileSchema.parse(a.value);
      const existing = s.deliveryProfiles.find((profile) => JSON.stringify(profile).includes(JSON.stringify(value)));
      const profile = { ...value, id: existing?.id ?? crypto.randomUUID(), label: a.label, primary: true };
      return { ...s, deliveryProfile: value, deliveryProfiles: [profile, ...s.deliveryProfiles.filter((item) => item.id !== profile.id).map((item) => ({ ...item, primary: false }))] };
    }
    case "delivery-profile-remove": {
      const rest = s.deliveryProfiles.filter((item) => item.id !== a.id);
      return { ...s, deliveryProfiles: rest, deliveryProfile: rest.find((item) => item.primary) ?? rest[0] };
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
    case "change-request-create":
      return createChangeRequest(s, a.id, a);
    case "change-request-respond":
      return respondToChangeRequest(s, a.id, a.requestId, a.decision, a.expectedAmountDelta);
    case "warehouse-inspect":
      return inspectWarehouseOrder(s, a.id, a);
    case "parcel-set":
      return setParcel(s, a.id, a.carrier, a.trackingNumber, a.warehouseCode);
    case "advance":
      return advanceOrder(s, a.id, a.expected);
    case "receive":
      return receiveOrder(s, a.id, a.dimensions);
    case "approve-extra":
      return approveExtra(s, a.id, a.amount);
    case "confirm-store-shipping":
      return confirmStoreShipping(s, a.id, a.actualUsd);
    case "approve-store-shipping-extra":
      return approveStoreShippingExtra(s, a.id, a.amount);
    case "cancel":
      return cancelOrder(s, a.id);
    case "notifications-read":
      return markNotificationsRead(s);
    case "identity-confirm":
      return confirmIdentity(s, a);
    case "identity-clear":
      return clearIdentity(s, a.documentId);
    case "declaration-preview":
      return submitDeclarationPreview(s, a.orderIds);
    case "import-legacy":
      if (
        s.orders.length ||
        s.entries.length ||
        s.cart.length ||
        s.favorites.length
      )
        throw Error("Импорт возможен только в пустой профиль.");
      return parseState(a.data);
  }
}
