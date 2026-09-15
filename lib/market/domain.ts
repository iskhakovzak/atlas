import { z } from "zod";
import { combinedShipmentWeight, customsVersion, usdRates } from "./world.ts";

export const money = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n) + " сум";
const positive = z.number().finite().positive();
const amount = z.number().int().nonnegative();
const signedAmount = z.number().int().min(-100_000_000).max(100_000_000);
export const productSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(140),
  brand: z.string(),
  category: z.string(),
  usd: positive.max(10000),
  weight: positive.max(50),
  image: z.string(),
  variants: z.array(z.string()).min(1),
  sourceUrl: z.string().optional(),
  sourceVariantId: z.string().max(120).optional(),
  description: z.string().optional(),
  country: z.string().optional(),
  sourceCurrency: z.string().optional(),
  sourcePrice: z.number().nonnegative().optional(),
  sourceShippingUsd: z.number().nonnegative().optional(),
  sourceShipping: z.number().nonnegative().optional(),
  sourceShippingCurrency: z.string().optional(),
  sourceShippingEstimated: z.boolean().optional(),
  shippingKnown: z.boolean().optional(),
  boxedWeight: positive.optional(),
  weightOrigin: z.string().optional(),
  importedAt: amount.optional(),
  sourceExpiresAt: amount.optional(),
  imageOrigin: z.string().optional(),
  declarationDescription: z.string().max(240).optional(),
});
export type Product = z.infer<typeof productSchema>;
export const products: Product[] = [
  {
    id: "sneaker",
    country: "США",
    boxedWeight: 1.6,
    name: "Кроссовки на каждый день",
    brand: "Обувь · США",
    category: "Обувь",
    usd: 99,
    weight: 2.1,
    image: "/images/sneaker.jpg",
    variants: ["US 8", "US 9", "US 10", "US 11"],
    description:
      "Спокойный силуэт для повседневного гардероба. Выберите размер и посмотрите, как складывается цена с доставкой.",
  },
  {
    id: "headphones",
    country: "Германия",
    boxedWeight: 0.2,
    name: "Беспроводные наушники",
    brand: "Аудио · Европа",
    category: "Электроника",
    usd: 129,
    weight: 0.7,
    image: "/images/headphones.jpg",
    variants: ["Чёрный", "Светлый"],
    description:
      "Для любимой музыки и рабочего ритма. В этом примере можно пройти покупку электроники из зарубежного магазина.",
  },
  {
    id: "backpack",
    country: "Испания",
    boxedWeight: 0.7,
    name: "Городской рюкзак",
    brand: "Аксессуары · Европа",
    category: "Аксессуары",
    usd: 65,
    weight: 1.2,
    image: "/images/backpack.jpg",
    variants: ["Стандартный"],
    description:
      "Один рюкзак для повседневных планов. Изучите расчёт покупки и доставки до оформления заказа.",
  },
];
export const pricingSchema = z.object({
  fx: positive.max(1_000_000),
  perKg: positive.max(10_000_000),
  margin: z.number().finite().min(0).max(1),
  buyoutFee: z.number().finite().min(0).max(1).default(0),
  conversionFee: z.number().finite().min(0).max(1).default(0),
  deliveryMargin: z.number().finite().min(0).max(1).default(0),
  optionalServices: z.number().finite().min(0).max(10_000_000).default(0),
  reserve: z.number().finite().min(0).max(2),
  divisor: positive.max(100_000),
  rates: z.record(z.string(), positive).default(usdRates),
  version: z.string().min(1).max(80),
  updatedAt: amount,
  managedBy: z.string().max(160).optional(),
});
export type Pricing = z.infer<typeof pricingSchema>;
export const tariff: Pricing = {
  fx: 12800,
  perKg: 90000,
  margin: 0.12,
  buyoutFee: 0,
  conversionFee: 0,
  deliveryMargin: 0,
  optionalServices: 0,
  reserve: 0.2,
  divisor: 5000,
  rates: usdRates,
  version: "demo-1",
  updatedAt: 0,
};
const quoteSchema = z.object({
  id: z.string(),
  createdAt: amount,
  expiresAt: amount,
  merchandise: amount,
  service: amount,
  shipping: amount,
  reserve: amount,
  total: amount,
  weight: positive,
  tariffVersion: z.string(),
  fx: positive.optional(),
  margin: z.number().finite().min(0).max(1).optional(),
  reserveRate: z.number().finite().min(0).max(2).optional(),
  perKg: positive.optional(),
  divisor: positive.optional(),
  sourceShipping: amount.optional(),
  buyout: amount.optional(),
  conversion: amount.optional(),
  deliveryMargin: amount.optional(),
  optionalServices: amount.optional(),
  buyoutFeeRate: z.number().finite().min(0).max(1).optional(),
  conversionFeeRate: z.number().finite().min(0).max(1).optional(),
  deliveryMarginRate: z.number().finite().min(0).max(1).optional(),
});
export type Quote = z.infer<typeof quoteSchema>;
export function price(
  usd: number,
  weight: number,
  quantity = 1,
  sourceShippingUsd = 0,
  config: Pricing = tariff,
) {
  if (
    !Number.isFinite(usd) ||
    usd <= 0 ||
    usd > 10000 ||
    !Number.isFinite(weight) ||
    weight <= 0 ||
    weight > 50 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 10
  )
    throw Error("Проверьте цену, вес и количество (от 1 до 10).");
  if (
    !Number.isFinite(sourceShippingUsd) ||
    sourceShippingUsd < 0 ||
    sourceShippingUsd > 10000
  )
    throw Error("Проверьте доставку магазина.");
  const billableUnitWeight = Math.max(1, weight);
  const sourceShipping = Math.ceil(sourceShippingUsd * quantity * config.fx);
  const merchandise = Math.round(usd * quantity * config.fx),
    service = Math.round(merchandise * config.margin),
    buyout = Math.round(merchandise * config.buyoutFee),
    conversion = Math.round(merchandise * config.conversionFee),
    shippingBase = Math.ceil(billableUnitWeight * quantity * config.perKg),
    deliveryMargin = Math.round(shippingBase * config.deliveryMargin),
    shipping = shippingBase,
    reserve = Math.ceil(shippingBase * config.reserve);
  return {
    merchandise,
    service,
    shipping,
    reserve,
    sourceShipping,
    buyout,
    conversion,
    deliveryMargin,
    optionalServices: config.optionalServices,
    total: merchandise + service + buyout + conversion + shipping + deliveryMargin + reserve + sourceShipping + config.optionalServices,
    weight: billableUnitWeight * quantity,
  };
}
export function quote(
  usd: number,
  weight: number,
  now = Date.now(),
  quantity = 1,
  sourceShippingUsd = 0,
  config: Pricing = tariff,
): Quote {
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    expiresAt: now + 15 * 60000,
    ...price(usd, weight, quantity, sourceShippingUsd, config),
    tariffVersion: config.version,
    fx: config.fx,
    margin: config.margin,
    buyoutFeeRate: config.buyoutFee,
    conversionFeeRate: config.conversionFee,
    deliveryMarginRate: config.deliveryMargin,
    reserveRate: config.reserve,
    perKg: config.perKg,
    divisor: config.divisor,
  };
}
const settlementSchema = z.object({
  actualWeight: positive,
  dimensionalWeight: positive,
  chargeableWeight: positive,
  shipping: amount,
  refund: amount,
  extra: amount,
  dimensions: z.array(positive).length(3).optional(),
});
export type Settlement = z.infer<typeof settlementSchema>;
const storeShippingSettlementSchema = z.object({
  estimated: amount,
  actual: amount,
  actualUsd: z.number().finite().nonnegative(),
  refund: amount,
  extra: amount,
});
export type StoreShippingSettlement = z.infer<
  typeof storeShippingSettlementSchema
>;
export function settle(
  q: Quote,
  w: number,
  l: number,
  h: number,
  d: number,
): Settlement {
  if (
    [w, l, h, d].some((n) => !Number.isFinite(n) || n <= 0) ||
    w > 500 ||
    Math.max(l, h, d) > 300
  )
    throw Error(
      "Введите вес до 500 кг и размеры до 300 см. Все значения должны быть больше нуля.",
    );
  const dimensionalWeight = (l * h * d) / (q.divisor ?? 5000),
    chargeableWeight = Math.max(w, dimensionalWeight),
    shipping = Math.ceil(chargeableWeight * (q.perKg ?? 90000)),
    diff = q.shipping + q.reserve - shipping;
  return {
    actualWeight: w,
    dimensionalWeight,
    chargeableWeight,
    shipping,
    refund: Math.max(0, diff),
    extra: Math.max(0, -diff),
    dimensions: [l, h, d],
  };
}
export const statuses = [
  "Ожидает выкупа",
  "Выкуплен",
  "На зарубежном складе",
  "Готов к отправке",
  "В пути",
  "Доставлен",
];
const historySchema = z.object({ at: amount, text: z.string() });
export const deliveryProfileSchema = z.object({
  recipient: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(30),
  region: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(220),
  postalCode: z.string().trim().max(20).default(""),
  comment: z.string().trim().max(300).default(""),
});
export type DeliveryProfile = z.infer<typeof deliveryProfileSchema>;
const savedDeliveryProfileSchema = deliveryProfileSchema.extend({
  id: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(60),
  primary: z.boolean().default(false),
});
export type SavedDeliveryProfile = z.infer<typeof savedDeliveryProfileSchema>;
export const identityProfileSchema = z.object({
  documentId: z.string().min(1).max(100),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  passportMasked: z.string().max(32),
  nationality: z.string().trim().max(80).default(""),
  confirmedAt: amount,
});
export type IdentityProfile = z.infer<typeof identityProfileSchema>;
const paymentSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "paid", "refunded"]),
  method: z.enum(["payment-link", "balance"]),
  amount: amount,
  createdAt: amount,
  updatedAt: amount,
});
export type Payment = z.infer<typeof paymentSchema>;
const parcelEventSchema = z.object({
  at: amount,
  status: z.string().max(80),
  location: z.string().max(120).optional(),
});
const parcelSchema = z.object({
  id: z.string(),
  carrier: z.string().min(2).max(80),
  trackingNumber: z.string().min(3).max(100),
  warehouseCode: z.string().max(80).default(""),
  events: z.array(parcelEventSchema).default([]),
});
export type Parcel = z.infer<typeof parcelSchema>;
const assignmentSchema = z.object({
  team: z.enum(["Закупки", "Склад", "Поддержка", "Финансы"]),
  priority: z.enum(["Обычный", "Высокий", "Срочный"]),
  assignedAt: amount,
});
export type Assignment = z.infer<typeof assignmentSchema>;
const staffNoteSchema = z.object({
  id: z.string(),
  at: amount,
  author: z.string().max(160),
  text: z.string().min(1).max(500),
});
export const changeRequestKindSchema = z.enum([
  "price",
  "variant",
  "substitution",
  "source-shipping",
  "warehouse-service",
  "customs",
]);
const changeRequestSchema = z.object({
  id: z.string().min(1).max(100),
  kind: changeRequestKindSchema,
  title: z.string().min(2).max(120),
  reason: z.string().min(2).max(500),
  previousValue: z.string().max(240).optional(),
  proposedValue: z.string().max(240).optional(),
  amountDelta: signedAmount.default(0),
  status: z.enum(["pending", "approved", "declined"]),
  createdAt: amount,
  respondedAt: amount.optional(),
});
export type ChangeRequest = z.infer<typeof changeRequestSchema>;
export const warehouseConditionSchema = z.enum(["ok", "damaged", "mismatch"]);
export const warehouseServiceSchema = z.enum(["photo", "repack", "consolidate", "split", "fragile"]);
const warehouseInspectionSchema = z.object({
  inspectedAt: amount,
  condition: warehouseConditionSchema,
  quantityReceived: z.number().int().min(0).max(100),
  notes: z.string().max(500).default(""),
  services: z.array(warehouseServiceSchema).max(5).default([]),
  packageGroup: z.string().max(80).default(""),
});
export type WarehouseInspection = z.infer<typeof warehouseInspectionSchema>;
const orderSchema = z.object({
  id: z.string(),
  product: productSchema,
  variant: z.string(),
  quote: quoteSchema,
  status: z.number().int().min(0).max(5),
  createdAt: amount,
  history: z.array(historySchema),
  settlement: settlementSchema.optional(),
  extraApproved: z.boolean().optional(),
  storeShippingSettlement: storeShippingSettlementSchema.optional(),
  storeShippingExtraApproved: z.boolean().optional(),
  quantity: z.number().int().min(1).max(10).default(1),
  cancelled: z.boolean().default(false),
  batchId: z.string().optional(),
  balanceUsed: amount.default(0),
  customsConsent: z
    .object({ version: z.string(), acceptedAt: amount })
    .optional(),
  delivery: deliveryProfileSchema.optional(),
  payment: paymentSchema.optional(),
  parcel: parcelSchema.optional(),
  assignment: assignmentSchema.optional(),
  staffNotes: z.array(staffNoteSchema).optional(),
  changeRequests: z.array(changeRequestSchema).optional(),
  warehouseInspection: warehouseInspectionSchema.optional(),
});
export type Order = z.infer<typeof orderSchema>;
const entrySchema = z.object({
  id: z.string(),
  orderId: z.string(),
  at: amount,
  amount: amount,
  debit: z.string(),
  credit: z.string(),
  description: z.string(),
});
export type Entry = z.infer<typeof entrySchema>;
const notificationSchema = z.object({
  id: z.string(),
  at: amount,
  title: z.string().max(120),
  message: z.string().max(300),
  read: z.boolean().default(false),
  orderId: z.string().optional(),
});
export type Notification = z.infer<typeof notificationSchema>;
export const communicationSchema = z.object({
  emailEnabled: z.boolean().default(false),
  smsEnabled: z.boolean().default(false),
  email: z.string().trim().email().or(z.literal("")),
  phone: z.string().trim().max(30),
  language: z.enum(["ru", "uz", "en"]).default("ru"),
});
export type Communication = z.infer<typeof communicationSchema>;
const messageDeliverySchema = z.object({
  id: z.string(),
  at: amount,
  channel: z.enum(["email", "sms"]),
  destination: z.string().max(120),
  title: z.string().max(120),
  status: z.literal("preview"),
  orderId: z.string().optional(),
});
export type MessageDelivery = z.infer<typeof messageDeliverySchema>;
const supportReplySchema = z.object({ id: z.string(), at: amount, author: z.enum(["customer", "support"]), text: z.string().min(1).max(1000) });
const supportTicketSchema = z.object({
  id: z.string(), subject: z.string().min(3).max(120), status: z.enum(["open", "answered", "closed"]),
  createdAt: amount, updatedAt: amount, replies: z.array(supportReplySchema).default([]),
});
export type SupportTicket = z.infer<typeof supportTicketSchema>;
const declarationSchema = z.object({
  id: z.string(), createdAt: amount, status: z.literal("submitted-preview"),
  identity: identityProfileSchema, delivery: deliveryProfileSchema,
  orderIds: z.array(z.string()).min(1),
  lines: z.array(z.object({ orderId: z.string(), description: z.string().max(240), country: z.string().max(100), quantity: z.number().int().positive(), value: amount })),
  totalValue: amount,
});
export type Declaration = z.infer<typeof declarationSchema>;
const cartSchema = z.object({
  id: z.string(),
  product: productSchema,
  variant: z.string(),
  quantity: z.number().int().min(1).max(10),
  quote: quoteSchema,
});
export type CartItem = z.infer<typeof cartSchema>;

function merchantParcelKey(item: CartItem) {
  if (!item.product.sourceUrl || item.product.boxedWeight === undefined)
    return `item:${item.id}`;
  try {
    const host = new URL(item.product.sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
    return `store:${host}:${item.product.country ?? ""}`;
  } catch {
    return `item:${item.id}`;
  }
}

/** Recalculate international delivery once per merchant parcel. */
export function repriceCart(items: CartItem[], now = Date.now(), config: Pricing = tariff) {
  const next = items.map((item) => ({
    ...item,
    quote: quote(
      item.product.usd,
      item.product.weight,
      now,
      item.quantity,
      item.product.sourceShippingUsd ?? 0,
      config,
    ),
  }));
  const groups = new Map<string, number[]>();
  next.forEach((item, index) => {
    if (!item.product.sourceUrl || item.product.boxedWeight === undefined) return;
    const key = merchantParcelKey(item);
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  for (const indexes of groups.values()) {
    const contributions = indexes.map((index) => next[index].product.boxedWeight! * next[index].quantity);
    const boxedTotal = contributions.reduce((sum, value) => sum + value, 0);
    const chargeableWeight = combinedShipmentWeight(boxedTotal);
    const shippingTotal = Math.ceil(chargeableWeight * config.perKg);
    const reserveTotal = Math.ceil(shippingTotal * config.reserve);
    const deliveryMarginTotal = Math.round(shippingTotal * config.deliveryMargin);
    let shippingLeft = shippingTotal;
    let reserveLeft = reserveTotal;
    let marginLeft = deliveryMarginTotal;
    let weightLeft = chargeableWeight;
    indexes.forEach((index, position) => {
      const item = next[index];
      const last = position === indexes.length - 1;
      const share = contributions[position] / boxedTotal;
      const shipping = last ? shippingLeft : Math.min(shippingLeft, Math.round(shippingTotal * share));
      const reserve = last ? reserveLeft : Math.min(reserveLeft, Math.round(reserveTotal * share));
      const deliveryMargin = last ? marginLeft : Math.min(marginLeft, Math.round(deliveryMarginTotal * share));
      const weight = last ? weightLeft : Math.min(weightLeft, Math.round(chargeableWeight * share * 1000) / 1000);
      shippingLeft -= shipping;
      reserveLeft -= reserve;
      marginLeft -= deliveryMargin;
      weightLeft = Math.round((weightLeft - weight) * 1000) / 1000;
      item.quote = {
        ...item.quote,
        shipping,
        reserve,
        deliveryMargin,
        weight,
        total: item.quote.total - item.quote.shipping - item.quote.reserve - (item.quote.deliveryMargin ?? 0) + shipping + reserve + deliveryMargin,
      };
    });
  }
  return next;
}
export const stateSchema = z.object({
  orders: z.array(orderSchema),
  entries: z.array(entrySchema),
  cart: z.array(cartSchema).default([]),
  favorites: z.array(z.string()).default([]),
  checkoutKeys: z.array(z.string()).default([]),
  notifications: z.array(notificationSchema).default([]),
  deliveryProfile: deliveryProfileSchema.optional(),
  deliveryProfiles: z.array(savedDeliveryProfileSchema).default([]),
  identityProfile: identityProfileSchema.optional(),
  declarations: z.array(declarationSchema).default([]),
  communication: communicationSchema.default({
    emailEnabled: false,
    smsEnabled: false,
    email: "",
    phone: "",
    language: "ru",
  }),
  messageDeliveries: z.array(messageDeliverySchema).default([]),
  supportTickets: z.array(supportTicketSchema).default([]),
  version: z.number().default(3),
});
export type State = z.infer<typeof stateSchema>;
export const blank = (): State => ({
  orders: [],
  entries: [],
  cart: [],
  favorites: [],
  checkoutKeys: [],
  notifications: [],
  communication: {
    emailEnabled: false,
    smsEnabled: false,
    email: "",
    phone: "",
    language: "ru",
  },
  messageDeliveries: [],
  deliveryProfiles: [],
  supportTickets: [],
  declarations: [],
  version: 3,
});
export const parseState = (raw: string): State =>
  stateSchema.parse(JSON.parse(raw));
const withNotification = (
  state: State,
  title: string,
  message: string,
  orderId?: string,
  now = Date.now(),
): State => {
  const deliveries: MessageDelivery[] = [];
  if (state.communication.emailEnabled && state.communication.email)
    deliveries.push({
      id: crypto.randomUUID(),
      at: now,
      channel: "email",
      destination: state.communication.email,
      title,
      status: "preview",
      orderId,
    });
  if (state.communication.smsEnabled && state.communication.phone)
    deliveries.push({
      id: crypto.randomUUID(),
      at: now,
      channel: "sms",
      destination: state.communication.phone,
      title,
      status: "preview",
      orderId,
    });
  return {
    ...state,
    notifications: [
      { id: crypto.randomUUID(), at: now, title, message, read: false, orderId },
      ...state.notifications,
    ].slice(0, 80),
    messageDeliveries: [...deliveries, ...state.messageDeliveries].slice(0, 120),
  };
};
export const markNotificationsRead = (state: State): State => ({
  ...state,
  notifications: state.notifications.map((item) => ({ ...item, read: true })),
});
export const updateCommunication = (
  state: State,
  value: Communication,
): State => ({ ...state, communication: communicationSchema.parse(value) });
export function confirmIdentity(state: State, value: Omit<IdentityProfile, "passportMasked" | "confirmedAt"> & { passportNumber: string }, now = Date.now()): State {
  const cleanNumber = value.passportNumber.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (cleanNumber.length < 6 || cleanNumber.length > 20) throw Error("Проверьте номер паспорта.");
  const birth = new Date(value.birthDate + "T00:00:00Z");
  if (!Number.isFinite(birth.getTime()) || birth.getTime() > now || birth.getUTCFullYear() < new Date(now).getUTCFullYear() - 120) throw Error("Проверьте дату рождения.");
  return { ...state, identityProfile: identityProfileSchema.parse({ ...value, passportMasked: "•••• " + cleanNumber.slice(-4), confirmedAt: now }) };
}

export function clearIdentity(state: State, documentId: string): State {
  return state.identityProfile?.documentId === documentId ? { ...state, identityProfile: undefined } : state;
}

export function submitDeclarationPreview(state: State, orderIds: string[], now = Date.now()): State {
  if (!state.identityProfile) throw Error("Сначала подтвердите паспортные данные.");
  if (!state.deliveryProfile) throw Error("Сначала сохраните адрес доставки.");
  const selected = [...new Set(orderIds)].map((id) => state.orders.find((order) => order.id === id)).filter((order): order is Order => !!order && !order.cancelled);
  if (!selected.length) throw Error("Выберите хотя бы один действующий заказ.");
  const lines = selected.map((order) => ({ orderId: order.id, description: order.product.declarationDescription ?? order.product.name, country: order.product.country ?? "Не указана", quantity: order.quantity, value: order.quote.merchandise }));
  const declaration: Declaration = { id: "DEC-" + crypto.randomUUID().slice(0, 8).toUpperCase(), createdAt: now, status: "submitted-preview", identity: state.identityProfile, delivery: state.deliveryProfile, orderIds: selected.map((order) => order.id), lines, totalValue: lines.reduce((sum, line) => sum + line.value, 0) };
  return withNotification({ ...state, declarations: [declaration, ...state.declarations].slice(0, 20) }, "Тестовая декларация подготовлена", `Пакет ${declaration.id} сохранён внутри Atlas. В таможню он не отправлялся.`);
}
export const balanceOf = (state: State) =>
  state.entries.reduce(
    (sum, e) =>
      sum +
      (e.credit === "customer-credit" ? e.amount : 0) -
      (e.debit === "customer-credit" ? e.amount : 0),
    0,
  );
export const totalOf = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + item.quote.total, 0);
export const approvedAdjustments = (order: Order) =>
  (order.changeRequests ?? [])
    .filter((request) => request.status === "approved")
    .reduce((sum, request) => sum + request.amountDelta, 0);
export const orderPayable = (order: Order) =>
  Math.max(0, order.quote.total + approvedAdjustments(order));
export function addToCart(
  state: State,
  p: Product,
  variant: string,
  now = Date.now(),
  config: Pricing = tariff,
): State {
  if (!p.variants.includes(variant)) throw Error("Выберите вариант товара.");
  const item = state.cart.find(
    (i) => i.product.id === p.id && i.variant === variant,
  );
  if (item)
    return changeQuantity(state, item.id, item.quantity + 1, now, config);
  const cart = [
    ...state.cart,
    {
      id: crypto.randomUUID(),
      product: p,
      variant,
      quantity: 1,
      quote: quote(p.usd, p.weight, now, 1, p.sourceShippingUsd ?? 0, config),
    },
  ];
  return { ...state, cart: repriceCart(cart, now, config)};
}
export function changeQuantity(
  state: State,
  id: string,
  quantity: number,
  now = Date.now(),
  config: Pricing = tariff,
): State {
  const item = state.cart.find((i) => i.id === id);
  if (!item) throw Error("Товар уже удалён из корзины.");
  return {
    ...state,
    cart: repriceCart(state.cart.map((i) =>
      i.id === id
        ? {
            ...i,
            quantity,
            quote: quote(
              i.product.usd,
              i.product.weight,
              now,
              quantity,
              i.product.sourceShippingUsd ?? 0,
              config,
            ),
          }
        : i,
    ), now, config),
  };
}
export function renewCart(
  state: State,
  now = Date.now(),
  config: Pricing = tariff,
): State {
  return {
    ...state,
    cart: repriceCart(state.cart.map((i) => ({
      ...i,
      quote: quote(
        i.product.usd,
        i.product.weight,
        now,
        i.quantity,
        i.product.sourceShippingUsd ?? 0,
        config,
      ),
    })), now, config),
  };
}
export const cartSignature = (items: CartItem[]) =>
  items.map((i) => i.id + ":" + i.quote.id).join("|");
export function checkoutCart(
  state: State,
  key: string,
  signature: string,
  useBalance: boolean,
  now = Date.now(),
  consentVersion?: string,
  delivery?: DeliveryProfile,
): State {
  if (state.checkoutKeys.includes(key)) return state;
  if (!state.cart.length) throw Error("Корзина пуста.");
  if (consentVersion !== customsVersion)
    throw Error("Подтвердите таможенные условия.");
  if (
    state.cart.some(
      (i) => i.product.sourceUrl && i.product.shippingKnown !== true,
    )
  )
    throw Error(
      "Уточните стоимость доставки магазина для каждого товара по ссылке.",
    );
  if (cartSignature(state.cart) !== signature)
    throw Error("Корзина изменилась. Проверьте новый итог перед оформлением.");
  if (state.cart.some((i) => now >= i.quote.expiresAt))
    throw Error("Расчёт истёк. Обновите его перед оформлением.");
  let available = useBalance ? Math.max(0, balanceOf(state)) : 0;
  const checkedDelivery = delivery
    ? deliveryProfileSchema.parse(delivery)
    : state.deliveryProfile;
  const entries = [...state.entries];
  const orders = state.cart.map((i) => {
    const id = "AT-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const balanceUsed = Math.min(i.quote.total, available);
    const payable = i.quote.total - balanceUsed;
    available -= balanceUsed;
    if (balanceUsed)
      entries.push({
        id: "pay:" + id,
        orderId: id,
        at: now,
        amount: balanceUsed,
        debit: "customer-credit",
        credit: "order-funds",
        description: "Оплата заказа демобалансом",
      });
    return {
      id,
      product: i.product,
      variant: i.variant,
      quote: i.quote,
      quantity: i.quantity,
      createdAt: now,
      status: 0,
      cancelled: false,
      balanceUsed,
      batchId: key,
      delivery: checkedDelivery,
      payment: {
        id: "PAY-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
        status: payable === 0 ? "paid" : "pending",
        method: payable === 0 ? "balance" : "payment-link",
        amount: payable,
        createdAt: now,
        updatedAt: now,
      },
      customsConsent: { version: customsVersion, acceptedAt: now },
      history: [
        {
          at: now,
          text:
            "Предрелизный заказ оформлен. Сумма " +
            money(i.quote.total) +
            (payable ? ". Ожидается тестовая оплата." : ". Оплачен демобалансом."),
        },
      ],
    } as Order;
  });
  return {
    ...state,
    cart: [],
    orders: [...orders, ...state.orders],
    entries,
    checkoutKeys: [...state.checkoutKeys, key],
    deliveryProfile: checkedDelivery,
  };
}
const getOrder = (state: State, id: string) => {
  const o = state.orders.find((o) => o.id === id);
  if (!o) throw Error("Заказ не найден.");
  return o;
};
const replace = (s: State, o: Order) => ({
  ...s,
  orders: s.orders.map((x) => (x.id === o.id ? o : x)),
});
export function confirmDemoPayment(
  state: State,
  id: string,
  now = Date.now(),
): State {
  const o = getOrder(state, id);
  if (!o.payment || o.payment.status === "paid") return state;
  if (o.cancelled || o.payment.status !== "pending")
    throw Error("Тестовая оплата для этого заказа недоступна.");
  const next = replace(state, {
    ...o,
    payment: { ...o.payment, status: "paid", updatedAt: now },
    history: [
      ...o.history,
      { at: now, text: "Тестовый платёж подтверждён. Реального списания не было." },
    ],
  });
  next.entries = [
    ...state.entries,
    {
      id: "demo-payment:" + id,
      orderId: id,
      at: now,
      amount: o.payment.amount,
      debit: "demo-provider",
      credit: "order-funds",
      description: "Тестовая оплата по платёжной ссылке",
    },
  ];
  return withNotification(
    next,
    "Оплата подтверждена",
    "Предрелизный платёж принят в тестовом режиме. Реального списания не было.",
    id,
    now,
  );
}

export function assignOrder(
  state: State,
  id: string,
  team: Assignment["team"],
  priority: Assignment["priority"],
  now = Date.now(),
): State {
  const o = getOrder(state, id);
  if (o.cancelled) throw Error("Отменённый заказ нельзя назначить.");
  return replace(state, {
    ...o,
    assignment: { team, priority, assignedAt: now },
    history: [...o.history, { at: now, text: `Назначено: ${team}. Приоритет: ${priority}.` }],
  });
}

export function addStaffNote(
  state: State,
  id: string,
  text: string,
  author: string,
  now = Date.now(),
): State {
  const o = getOrder(state, id);
  const value = text.trim();
  if (!value || value.length > 500) throw Error("Введите заметку до 500 символов.");
  return replace(state, {
    ...o,
    staffNotes: [
      ...(o.staffNotes ?? []),
      { id: crypto.randomUUID(), at: now, author: author.slice(0, 160), text: value },
    ].slice(-40),
    history: [...o.history, { at: now, text: "Оператор добавил внутреннюю заметку." }],
  });
}

export function createChangeRequest(
  state: State,
  id: string,
  value: Omit<ChangeRequest, "id" | "status" | "createdAt" | "respondedAt">,
  now = Date.now(),
): State {
  const o = getOrder(state, id);
  if (o.cancelled || o.status >= 5) throw Error("Изменения для этого заказа недоступны.");
  if ((o.changeRequests ?? []).some((request) => request.status === "pending"))
    throw Error("Сначала дождитесь ответа на текущий запрос.");
  const request = changeRequestSchema.parse({
    ...value,
    id: "CHG-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
    status: "pending",
    createdAt: now,
  });
  return withNotification(
    replace(state, {
      ...o,
      changeRequests: [...(o.changeRequests ?? []), request],
      history: [...o.history, { at: now, text: `Запрошено согласование: ${request.title}.` }],
    }),
    "Нужно ваше решение",
    `${request.title}${request.amountDelta ? ` · изменение ${money(request.amountDelta)}` : ""}.`,
    id,
    now,
  );
}

export function respondToChangeRequest(
  state: State,
  id: string,
  requestId: string,
  decision: "approved" | "declined",
  expectedAmountDelta: number,
  now = Date.now(),
): State {
  const o = getOrder(state, id);
  const request = (o.changeRequests ?? []).find((item) => item.id === requestId);
  if (!request || request.status !== "pending") throw Error("Запрос уже обработан или не найден.");
  if (request.amountDelta !== expectedAmountDelta) throw Error("Сумма изменилась. Проверьте запрос заново.");
  const nextRequest = { ...request, status: decision, respondedAt: now } as ChangeRequest;
  const nextOrder: Order = {
    ...o,
    variant: decision === "approved" && request.kind === "variant" && request.proposedValue
      ? request.proposedValue
      : o.variant,
    changeRequests: (o.changeRequests ?? []).map((item) => item.id === requestId ? nextRequest : item),
    history: [...o.history, { at: now, text: decision === "approved" ? `Покупатель подтвердил: ${request.title}.` : `Покупатель отклонил: ${request.title}.` }],
  };
  return withNotification(
    replace(state, nextOrder),
    decision === "approved" ? "Изменение подтверждено" : "Изменение отклонено",
    request.title,
    id,
    now,
  );
}

export function inspectWarehouseOrder(
  state: State,
  id: string,
  value: Omit<WarehouseInspection, "inspectedAt">,
  now = Date.now(),
): State {
  const o = getOrder(state, id);
  if (o.cancelled || o.status !== 2) throw Error("Приёмка доступна только для заказа на зарубежном складе.");
  const warehouseInspection = warehouseInspectionSchema.parse({ ...value, inspectedAt: now });
  if (warehouseInspection.condition === "ok" && warehouseInspection.quantityReceived !== o.quantity)
    throw Error("При полном соответствии количество должно совпадать с заказом.");
  return withNotification(
    replace(state, {
      ...o,
      warehouseInspection,
      history: [...o.history, { at: now, text: warehouseInspection.condition === "ok" ? "Склад подтвердил комплектность и состояние товара." : "Склад зафиксировал проблему; требуется решение оператора и покупателя." }],
    }),
    warehouseInspection.condition === "ok" ? "Товар принят на складе" : "На складе обнаружена проблема",
    warehouseInspection.condition === "ok" ? "Комплектность и состояние подтверждены." : "Откройте заказ: оператор подготовит вариант решения.",
    id,
    now,
  );
}

export function setParcel(
  state: State,
  id: string,
  carrier: string,
  trackingNumber: string,
  warehouseCode: string,
  now = Date.now(),
): State {
  const o = getOrder(state, id);
  if (o.cancelled || o.status < 1) throw Error("Сначала подтвердите выкуп заказа.");
  const parcel = parcelSchema.parse({
    id: o.parcel?.id ?? "PCL-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
    carrier: carrier.trim(),
    trackingNumber: trackingNumber.trim(),
    warehouseCode: warehouseCode.trim(),
    events: [
      ...(o.parcel?.events ?? []),
      { at: now, status: "Трек-номер подтверждён", location: warehouseCode.trim() || undefined },
    ],
  });
  return withNotification(
    replace(state, {
      ...o,
      parcel,
      history: [...o.history, { at: now, text: `Добавлен трек-номер ${parcel.trackingNumber}.` }],
    }),
    "Добавлен трек-номер",
    `${parcel.carrier}: ${parcel.trackingNumber}`,
    id,
    now,
  );
}
export function confirmStoreShipping(
  state: State,
  id: string,
  actualUsd: number,
  now = Date.now(),
): State {
  const o = getOrder(state, id);
  if (o.storeShippingSettlement) return state;
  if (o.cancelled || o.status !== 0 || !o.product.sourceShippingEstimated)
    throw Error("Подтверждение доставки для этого заказа недоступно.");
  if (!Number.isFinite(actualUsd) || actualUsd < 0 || actualUsd > 10000)
    throw Error("Укажите фактическую доставку магазина в USD.");
  const estimated = o.quote.sourceShipping ?? 0;
  const actual = Math.ceil(actualUsd * (o.quote.fx ?? tariff.fx));
  const diff = estimated - actual;
  const settlement: StoreShippingSettlement = {
    estimated,
    actual,
    actualUsd,
    refund: Math.max(0, diff),
    extra: Math.max(0, -diff),
  };
  const next = replace(state, {
    ...o,
    storeShippingSettlement: settlement,
    history: [
      ...o.history,
      {
        at: now,
        text: settlement.extra
          ? "Менеджер подтвердил доставку магазина. Требуется согласование доплаты " +
            money(settlement.extra)
          : "Менеджер подтвердил доставку магазина. Возврат разницы: " +
            money(settlement.refund),
      },
    ],
  });
  if (settlement.refund)
    next.entries = [
      ...state.entries,
      {
        id: "store-shipping:" + id,
        orderId: id,
        at: now,
        amount: settlement.refund,
        debit: "store-shipping-reserve",
        credit: "customer-credit",
        description: "Возврат разницы доставки магазина",
      },
    ];
  return withNotification(
    next,
    settlement.extra ? "Нужно согласовать доставку" : "Доставка магазина уточнена",
    settlement.extra
      ? "Менеджер уточнил стоимость. Откройте заказ и подтвердите доплату."
      : settlement.refund
        ? "Разница с резервом возвращена на демобаланс."
        : "Стоимость совпала с резервом заказа.",
    id,
    now,
  );
}

export function approveStoreShippingExtra(
  state: State,
  id: string,
  expectedAmount: number,
  now = Date.now(),
): State {
  const o = getOrder(state, id);
  if (o.storeShippingExtraApproved) return state;
  if (
    o.cancelled ||
    !o.storeShippingSettlement?.extra ||
    o.storeShippingSettlement.extra !== expectedAmount
  )
    throw Error("Сумма изменилась. Проверьте расчёт.");
  return replace(state, {
    ...o,
    storeShippingExtraApproved: true,
    history: [
      ...o.history,
      {
        at: now,
        text:
          "Покупатель подтвердил доплату за доставку магазина " +
          money(o.storeShippingSettlement.extra),
      },
    ],
  });
}

export function advanceOrder(
  state: State,
  id: string,
  expected: number,
  now = Date.now(),
): State {
  const o = getOrder(state, id);
  if (o.status !== expected)
    throw Error("Статус уже изменился. Проверьте заказ.");
  if (
    o.cancelled ||
    o.status >= 5 ||
    o.status === 2 ||
    (o.status === 0 && o.payment?.status === "pending") ||
    (o.status === 3 && !o.parcel) ||
    (o.settlement?.extra && !o.extraApproved) ||
    (o.product.sourceShippingEstimated && !o.storeShippingSettlement) ||
    (o.storeShippingSettlement?.extra && !o.storeShippingExtraApproved)
    || (o.changeRequests ?? []).some((request) => request.status === "pending")
  )
    throw Error("Этот переход пока недоступен.");
  if (o.status === 3 && !o.settlement)
    throw Error("Сначала сохраните взвешивание.");
  const nextStatus = o.status + 1;
  const parcel = o.parcel
    ? {
        ...o.parcel,
        events:
          nextStatus >= 4
            ? [
                ...o.parcel.events,
                {
                  at: now,
                  status: nextStatus === 4 ? "Передано в международную доставку" : "Доставлено получателю",
                  location: nextStatus === 4 ? "Международный маршрут" : o.delivery?.city,
                },
              ]
            : o.parcel.events,
      }
    : undefined;
  return withNotification(replace(state, {
    ...o,
    status: nextStatus,
    parcel,
    history: [...o.history, { at: now, text: statuses[nextStatus] }],
  }), "Статус заказа изменён", statuses[nextStatus], id, now);
}
export function receiveOrder(
  state: State,
  id: string,
  dimensions: [number, number, number, number],
  now = Date.now(),
): State {
  const o = getOrder(state, id);
  if (o.settlement) return state;
  if (o.cancelled || o.status !== 2)
    throw Error("Заказ ещё не готов к взвешиванию.");
  if (!o.warehouseInspection)
    throw Error("Сначала завершите приёмку и проверку товара на складе.");
  if (
    o.warehouseInspection.condition !== "ok" &&
    !(o.changeRequests ?? []).some((request) =>
      request.status === "approved" &&
      request.createdAt >= o.warehouseInspection!.inspectedAt &&
      ["substitution", "warehouse-service"].includes(request.kind),
    )
  ) throw Error("Сначала согласуйте с покупателем решение по проблеме на складе.");
  const s = settle(o.quote, ...dimensions);
  const next = replace(state, {
    ...o,
    settlement: s,
    status: 3,
    parcel: o.parcel
      ? {
          ...o.parcel,
          events: [
            ...o.parcel.events,
            { at: now, status: "Принято и взвешено на складе", location: o.parcel.warehouseCode || undefined },
          ],
        }
      : o.parcel,
    history: [
      ...o.history,
      {
        at: now,
        text: s.extra
          ? "Взвешивание завершено. Требуется согласование доплаты " +
            money(s.extra)
          : "Взвешивание завершено. Возврат остатка: " + money(s.refund),
      },
    ],
  });
  if (s.refund)
    next.entries = [
      ...state.entries,
      {
        id: "settlement:" + id,
        orderId: id,
        at: now,
        amount: s.refund,
        debit: "shipping-reserve",
        credit: "customer-credit",
        description: "Возврат остатка доставки",
      },
    ];
  return withNotification(
    next,
    s.extra ? "Нужна доплата за доставку" : "Посылка взвешена",
    s.extra
      ? "Фактический или объёмный вес превысил резерв. Проверьте новый расчёт."
      : s.refund
        ? "Остаток доставки возвращён на демобаланс."
        : "Фактическая стоимость доставки подтверждена.",
    id,
    now,
  );
}
export function approveExtra(
  state: State,
  id: string,
  expectedAmount: number,
  now = Date.now(),
): State {
  const o = getOrder(state, id);
  if (o.extraApproved) return state;
  if (
    o.cancelled ||
    !o.settlement?.extra ||
    o.settlement.extra !== expectedAmount
  )
    throw Error("Сумма изменилась. Проверьте расчёт.");
  return replace(state, {
    ...o,
    extraApproved: true,
    history: [
      ...o.history,
      {
        at: now,
        text:
          "Покупатель подтвердил тестовую доплату " + money(o.settlement.extra),
      },
    ],
  });
}
export function cancelOrder(state: State, id: string, now = Date.now()): State {
  const o = getOrder(state, id);
  if (o.cancelled) return state;
  if (o.status !== 0)
    throw Error("Заказ уже выкуплен. Автоматическая отмена недоступна.");
  const next = replace(state, {
    ...o,
    cancelled: true,
    payment: o.payment
      ? { ...o.payment, status: "refunded", updatedAt: now }
      : o.payment,
    history: [
      ...o.history,
      {
        at: now,
        text: "Отменён до выкупа. Вся сумма возвращена на демобаланс.",
      },
    ],
  });
  return {
    ...next,
    entries: [
      ...state.entries,
      {
        id: "cancel:" + id,
        orderId: id,
        at: now,
        amount: o.quote.total,
        debit: "order-funds",
        credit: "customer-credit",
        description: "Возврат отменённого заказа",
      },
    ],
  };
}
export function validateSource(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw Error("Введите полную ссылку, начиная с https://.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !url.hostname.includes(".") ||
    url.hostname === "localhost" ||
    /^\d[\d.]*$/.test(url.hostname)
  )
    throw Error("Нужна HTTPS-ссылка на страницу магазина.");
  return url.toString();
}
