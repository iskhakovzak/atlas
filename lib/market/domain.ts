import { z } from "zod";
import { combinedShipmentWeight, customsVersion, usdRates } from "./world.ts";

export const money = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n) + " сум";
const positive = z.number().finite().positive();
const amount = z.number().int().nonnegative();
const signedAmount = z.number().int().min(-100_000_000).max(100_000_000);
const localizedTextSchema = z.object({
  ru: z.string().trim().min(1).max(120),
  uz: z.string().trim().min(1).max(120),
  en: z.string().trim().min(1).max(120),
});
const localizedDescriptionSchema = z.object({
  ru: z.string().trim().max(500),
  uz: z.string().trim().max(500),
  en: z.string().trim().max(500),
});
export const sourceVariantSchema = z.object({
  id: z.string().trim().max(120).optional(),
  label: z.string().trim().max(140),
  size: z.string().trim().max(100).optional(),
  sizeLabel: z.string().trim().max(100).optional(),
  color: z.string().trim().max(100).optional(),
  available: z.boolean(),
  availabilityKnown: z.boolean().optional(),
  price: z.number().finite().nonnegative().optional(),
  image: z.string().trim().max(3000).optional(),
});
export type SourceVariant = z.infer<typeof sourceVariantSchema>;
export const serviceOfferingSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,79}$/),
  title: localizedTextSchema,
  description: localizedDescriptionSchema,
  requestStage: z.enum(["checkout", "warehouse"]),
  unit: z.enum(["package", "item", "day", "photo", "half-hour"]),
  pricingMode: z.enum(["fixed", "operator-quote"]),
  feeUzs: amount.max(20_000_000).default(0),
  countryPrices: z.record(z.string().min(1).max(80), amount.max(20_000_000)).default({}),
  enabled: z.boolean().default(false),
  required: z.boolean().default(false),
});
export type ServiceOffering = z.infer<typeof serviceOfferingSchema>;
const defaultServiceOfferings: ServiceOffering[] = [
  { id: "content-photo", title: { ru: "Фото содержимого", uz: "Ichidagi mahsulot fotosi", en: "Contents photo" }, description: { ru: "Открыть посылку и сфотографировать содержимое одним кадром.", uz: "Posilkani ochib, ichidagi mahsulotlarni bitta kadrda suratga olish.", en: "Open the parcel and photograph its contents in one overview." }, requestStage: "checkout", unit: "package", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: true, required: false },
  { id: "detailed-photos", title: { ru: "Дополнительные фото", uz: "Qo‘shimcha fotosuratlar", en: "Detailed photos" }, description: { ru: "Крупные фото товара, ярлыков и комплектации по запросу.", uz: "So‘rov bo‘yicha tovar, yorliq va komplektatsiyaning yaqin fotosuratlari.", en: "Close-up photos of the item, labels and included parts on request." }, requestStage: "checkout", unit: "photo", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: true, required: false },
  { id: "visual-inspection", title: { ru: "Проверка состояния", uz: "Holatini tekshirish", en: "Condition inspection" }, description: { ru: "Визуально проверить упаковку и доступные части товара без вскрытия заводских пломб.", uz: "Zavod plombalarini buzmasdan qadoq va ko‘rinadigan qismlarni tekshirish.", en: "Visually check the packaging and accessible parts without breaking factory seals." }, requestStage: "warehouse", unit: "package", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: true, required: false },
  { id: "consolidation", title: { ru: "Объединение посылок", uz: "Posilkalarni birlashtirish", en: "Package consolidation" }, description: { ru: "Объединить несколько полученных посылок, если склад и маршрут это позволяют.", uz: "Ombor va yo‘nalish imkon bersa, bir nechta qabul qilingan posilkani birlashtirish.", en: "Combine multiple received packages when the warehouse and route allow it." }, requestStage: "warehouse", unit: "package", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: true, required: false },
  { id: "repack", title: { ru: "Переупаковка", uz: "Qayta qadoqlash", en: "Repacking" }, description: { ru: "Заменить внешнюю коробку или упаковать товар компактнее, если это возможно.", uz: "Imkon bo‘lsa, tashqi qutini almashtirish yoki tovarni ixchamroq qadoqlash.", en: "Replace the outer box or repack more compactly when possible." }, requestStage: "warehouse", unit: "package", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: true, required: false },
  { id: "split-package", title: { ru: "Разделение посылки", uz: "Posilkani bo‘lish", en: "Split package" }, description: { ru: "Разделить содержимое на отдельные отправления после проверки ограничений маршрута.", uz: "Yo‘nalish cheklovlari tekshirilgach, tarkibni alohida jo‘natmalarga ajratish.", en: "Separate contents into shipments after route restrictions are checked." }, requestStage: "warehouse", unit: "package", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: true, required: false },
  { id: "extra-packing", title: { ru: "Дополнительная упаковка", uz: "Qo‘shimcha qadoqlash", en: "Extra packing material" }, description: { ru: "Пузырчатая плёнка, дополнительная защита или укрепление коробки по доступности.", uz: "Mavjudligiga qarab pufakchali plyonka, qo‘shimcha himoya yoki qutini mustahkamlash.", en: "Bubble wrap, extra protection or box reinforcement, subject to availability." }, requestStage: "checkout", unit: "package", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: true, required: false },
  { id: "fragile-handling", title: { ru: "Маркировка «Хрупкое»", uz: "«Mo‘rt» belgisi", en: "Fragile handling" }, description: { ru: "Дополнительная маркировка и осторожная обработка, если их поддерживает склад.", uz: "Ombor qo‘llab-quvvatlasa, qo‘shimcha belgi va ehtiyotkor ishlov.", en: "Extra fragile marking and careful handling if supported by the warehouse." }, requestStage: "checkout", unit: "package", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: true, required: false },
  { id: "express-processing", title: { ru: "Срочная обработка", uz: "Tezkor ishlov", en: "Express processing" }, description: { ru: "Приоритет в очереди склада; срок зависит от фактической загрузки.", uz: "Ombor navbatida ustuvorlik; muddat haqiqiy yuklamaga bog‘liq.", en: "Priority in the warehouse queue; timing depends on actual workload." }, requestStage: "warehouse", unit: "package", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: true, required: false },
  { id: "remove-tags", title: { ru: "Снять ценники и бирки", uz: "Narx yorliqlari va teglarni olib tashlash", en: "Remove price tags and labels" }, description: { ru: "Снять наружные ценники или бирки, если это возможно без повреждения товара.", uz: "Tovarga zarar yetkazmasdan tashqi narx yorliqlari yoki teglarni olib tashlash.", en: "Remove external price tags or labels when this can be done without damaging the item." }, requestStage: "warehouse", unit: "item", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: true, required: false },
  { id: "special-request", title: { ru: "Особое поручение складу", uz: "Omborga maxsus topshiriq", en: "Special warehouse request" }, description: { ru: "Опишите нестандартную просьбу. Оператор подтвердит выполнимость и стоимость.", uz: "Nostandart iltimosni yozing. Operator bajarish imkoniyati va narxni tasdiqlaydi.", en: "Describe a custom request. An operator will confirm feasibility and price." }, requestStage: "warehouse", unit: "half-hour", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: true, required: false },
  { id: "storage-extension", title: { ru: "Дополнительное хранение", uz: "Qo‘shimcha saqlash", en: "Extended storage" }, description: { ru: "Запросить дополнительные дни хранения; условия подтвердит оператор.", uz: "Qo‘shimcha saqlash kunlarini so‘rash; shartlarni operator tasdiqlaydi.", en: "Request extra storage days; an operator will confirm the terms." }, requestStage: "warehouse", unit: "day", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: true, required: false },
  { id: "return-to-store", title: { ru: "Возврат продавцу", uz: "Sotuvchiga qaytarish", en: "Return to merchant" }, description: { ru: "Запрос на возврат зависит от правил магазина, срока и стоимости обратной доставки.", uz: "Qaytarish do‘kon qoidalari, muddat va qayta yetkazish narxiga bog‘liq.", en: "A return depends on the store's policy, deadline and return-shipping cost." }, requestStage: "warehouse", unit: "package", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: true, required: false },
  { id: "package-disposal", title: { ru: "Утилизация посылки", uz: "Posilkani utilizatsiya qilish", en: "Package disposal" }, description: { ru: "Запрос на утилизацию после подтверждения владельца и условий склада.", uz: "Egasi va ombor shartlari tasdiqlangach utilizatsiya so‘rovi.", en: "A disposal request, subject to owner confirmation and warehouse rules." }, requestStage: "warehouse", unit: "package", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: true, required: false },
  { id: "shipping-insurance", title: { ru: "Страхование отправления", uz: "Jo‘natmani sug‘urtalash", en: "Shipment insurance" }, description: { ru: "Недоступно, пока не подтверждены страховщик, покрытие, исключения и порядок выплат.", uz: "Sug‘urtalovchi, qoplama, istisnolar va to‘lov tartibi tasdiqlanmaguncha mavjud emas.", en: "Unavailable until the insurer, coverage, exclusions and claim process are confirmed." }, requestStage: "warehouse", unit: "package", pricingMode: "operator-quote", feeUzs: 0, countryPrices: {}, enabled: false, required: false },
];
export const productSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(140),
  brand: z.string(),
  category: z.string(),
  usd: positive.max(10000),
  weight: positive.max(50),
  image: z.string(),
  variants: z.array(z.string()).min(1),
  /** Optional merchant matrix for storefront and link-order fallback; never a quote authority. */
  sourceVariants: z.array(sourceVariantSchema).max(250).optional(),
  /** Optional safe merchant gallery, with the primary image first. */
  sourceImages: z.array(z.string().max(3000)).max(12).optional(),
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
  /** Customer explicitly reviewed a manual fallback after the merchant fetch failed. */
  sourceManuallyConfirmed: z.boolean().optional(),
  /** Public listing snapshot remains discoverable, but its price is no longer current. */
  priceNeedsConfirmation: z.boolean().optional(),
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
  // Warehouse service options are versioned with pricing. Old settings receive
  // the safe starter catalogue; submitted orders keep their own snapshots.
  serviceCatalog: z.array(serviceOfferingSchema).max(40).default(defaultServiceOfferings),
  // Optional dispatch-country overrides. Keys use the same country labels as
  // Product.country (the country of actual dispatch), not the customer's country.
  // Old centrally managed pricing rows remain valid and inherit the base tariff.
  countryOverrides: z.record(z.string().min(1).max(80), z.object({
    perKg: positive.max(10_000_000).optional(),
    margin: z.number().finite().min(0).max(1).optional(),
    buyoutFee: z.number().finite().min(0).max(1).optional(),
    conversionFee: z.number().finite().min(0).max(1).optional(),
    deliveryMargin: z.number().finite().min(0).max(1).optional(),
    optionalServices: z.number().finite().min(0).max(10_000_000).optional(),
    reserve: z.number().finite().min(0).max(2).optional(),
  }).strict()).default({}),
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
  serviceCatalog: defaultServiceOfferings,
  countryOverrides: {},
  version: "demo-1",
  updatedAt: 0,
};
/** Resolve only the pricing dimensions explicitly overridden for this item's
 * actual dispatch country. FX rates stay currency-based in `rates`. */
export function pricingForCountry(config: Pricing, country?: string): Pricing {
  const override = country ? config.countryOverrides?.[country] : undefined;
  return override ? { ...config, ...override } : config;
}
export const serviceTitle = (service: ServiceOffering | WarehouseServiceRequest, locale: "ru" | "uz" | "en") => service.title[locale];
export const serviceDescription = (service: ServiceOffering | WarehouseServiceRequest, locale: "ru" | "uz" | "en") => service.description[locale];
export function serviceFeeForCountry(service: ServiceOffering, country?: string) {
  return country && service.countryPrices[country] !== undefined
    ? service.countryPrices[country]
    : service.feeUzs;
}
export function validateServiceCatalog(services: ServiceOffering[]) {
  const seen = new Set<string>();
  for (const service of services) {
    if (seen.has(service.id)) throw Error("Идентификаторы услуг должны быть уникальными.");
    seen.add(service.id);
    if (service.required && (service.requestStage !== "checkout" || service.pricingMode !== "fixed"))
      throw Error("Обязательная услуга должна предлагаться при оформлении и иметь фиксированный тариф.");
    if (service.enabled && service.pricingMode === "fixed" && serviceFeeForCountry(service) <= 0)
      throw Error("Для активной услуги с фиксированной ценой задайте положительный базовый тариф.");
    if (service.enabled && service.pricingMode === "fixed" && Object.values(service.countryPrices).some((fee) => fee <= 0))
      throw Error("У активной услуги все заданные тарифы по странам должны быть больше нуля.");
    if (service.id === "shipping-insurance" && service.enabled)
      throw Error("Страхование нельзя включить без подтверждённого страховщика, покрытия и процесса претензий.");
  }
  return services;
}
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
  recipientProfileId: z.string().min(1).max(80).optional(),
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
export const orderIssueCategorySchema = z.enum(["stalled", "merchant", "payment", "warehouse", "delivery", "other"]);
export type OrderIssueCategory = z.infer<typeof orderIssueCategorySchema>;
export const orderIssueStatusSchema = z.enum(["open", "investigating", "waiting-customer", "waiting-merchant", "refund-review", "resolved"]);
export type OrderIssueStatus = z.infer<typeof orderIssueStatusSchema>;
const orderIssueEventSchema = z.object({
  id: z.string().min(1).max(100),
  at: amount,
  category: orderIssueCategorySchema,
  status: orderIssueStatusSchema,
  proposedRefund: z.number().int().min(0).max(100_000_000).optional(),
});
const orderIssueCaseSchema = z.object({
  category: orderIssueCategorySchema,
  status: orderIssueStatusSchema,
  proposedRefund: z.number().int().min(0).max(100_000_000).optional(),
  updatedAt: amount,
  history: z.array(orderIssueEventSchema).max(40),
});
export type OrderIssueCase = z.infer<typeof orderIssueCaseSchema>;
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
  warehouseServiceRequestId: z.string().min(1).max(100).optional(),
  resolvesWarehouseIssue: z.boolean().optional(),
  amountDelta: signedAmount.default(0),
  status: z.enum(["pending", "approved", "declined"]),
  createdAt: amount,
  respondedAt: amount.optional(),
});
export type ChangeRequest = z.infer<typeof changeRequestSchema>;
const warehouseServiceRequestSchema = z.object({
  id: z.string().min(1).max(100),
  serviceId: z.string().min(2).max(80),
  title: localizedTextSchema,
  description: localizedDescriptionSchema,
  unit: z.enum(["package", "item", "day", "photo", "half-hour"]),
  units: z.number().int().min(1).max(100),
  pricingMode: z.enum(["fixed", "operator-quote"]),
  feeUzs: amount.max(20_000_000).optional(),
  country: z.string().max(80).optional(),
  customerNote: z.string().trim().max(500).optional(),
  origin: z.enum(["checkout", "warehouse"]),
  status: z.enum(["requested", "quoted", "approved", "declined", "completed"]),
  requestedAt: amount,
  quotedAmount: amount.max(100_000_000).optional(),
  quoteChangeRequestId: z.string().max(100).optional(),
  completedAt: amount.optional(),
});
export type WarehouseServiceRequest = z.infer<typeof warehouseServiceRequestSchema>;
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
  deliveryProfileId: z.string().min(1).max(80).optional(),
  identity: identityProfileSchema.optional(),
  payment: paymentSchema.optional(),
  parcel: parcelSchema.optional(),
  assignment: assignmentSchema.optional(),
  staffNotes: z.array(staffNoteSchema).optional(),
  issueCase: orderIssueCaseSchema.optional(),
  changeRequests: z.array(changeRequestSchema).optional(),
  warehouseServiceRequests: z.array(warehouseServiceRequestSchema).max(40).optional(),
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
  requestedServiceIds: z.array(z.string().min(2).max(80)).max(40).default([]),
  requestedServiceUnits: z.record(z.string().min(2).max(80), z.number().int().min(1).max(100)).optional(),
  quote: quoteSchema,
});
export type CartItem = z.infer<typeof cartSchema>;

function buildServiceRequest(
  service: ServiceOffering,
  country: string | undefined,
  units: number,
  origin: WarehouseServiceRequest["origin"],
  now: number,
  customerNote?: string,
): WarehouseServiceRequest {
  return warehouseServiceRequestSchema.parse({
    id: "WSR-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
    serviceId: service.id,
    title: service.title,
    description: service.description,
    unit: service.unit,
    units,
    pricingMode: service.pricingMode,
    feeUzs: service.pricingMode === "fixed" ? serviceFeeForCountry(service, country) : undefined,
    country,
    customerNote: customerNote?.trim() || undefined,
    origin,
    status: "requested",
    requestedAt: now,
  });
}

export function setCartServices(
  state: State,
  id: string,
  serviceIds: string[],
  config: Pricing = tariff,
  serviceUnits: Record<string, number> = {},
) {
  const item = state.cart.find((candidate) => candidate.id === id);
  if (!item) throw Error("Товар уже удалён из корзины.");
  const allowed = config.serviceCatalog.filter((service) => service.enabled && service.requestStage === "checkout");
  const selected = [...new Set(serviceIds)];
  if (selected.some((serviceId) => !allowed.some((service) => service.id === serviceId)))
    throw Error("Одна из услуг больше недоступна. Обновите страницу.");
  if (Object.keys(serviceUnits).some((serviceId) => !selected.includes(serviceId)))
    throw Error("Количество можно задать только для выбранной услуги.");
  for (const [serviceId, units] of Object.entries(serviceUnits)) {
    const service = allowed.find((candidate) => candidate.id === serviceId);
    if (!service || ["package", "item"].includes(service.unit) || !Number.isInteger(units) || units < 1 || units > 100)
      throw Error("Проверьте количество дополнительной услуги.");
  }
  for (const required of allowed.filter((service) => service.required)) {
    if (!selected.includes(required.id)) throw Error("Выберите обязательные услуги перед оформлением.");
  }
  return {
    ...state,
    cart: state.cart.map((candidate) => candidate.id === id ? {
      ...candidate,
      requestedServiceIds: selected,
      requestedServiceUnits: Object.fromEntries(Object.entries(serviceUnits).filter(([serviceId]) => selected.includes(serviceId))),
    } : candidate),
  };
}

export function requestWarehouseService(
  state: State,
  id: string,
  serviceId: string,
  units: number,
  config: Pricing = tariff,
  now = Date.now(),
  customerNote?: string,
): State {
  const order = getOrder(state, id);
  if (order.cancelled || order.status !== 2 || !order.warehouseInspection)
    throw Error("Услуги можно запросить после приёмки товара и до взвешивания.");
  if ((order.changeRequests ?? []).some((request) => request.status === "pending"))
    throw Error("Сначала дождитесь ответа на текущий запрос по заказу.");
  if ((order.warehouseServiceRequests ?? []).length >= 40)
    throw Error("Достигнут лимит услуг для этого заказа.");
  const service = config.serviceCatalog.find((item) => item.id === serviceId && item.enabled && item.requestStage === "warehouse");
  if (!service) throw Error("Эта услуга сейчас недоступна.");
  const note = customerNote?.trim();
  if (service.id === "special-request" && !note)
    throw Error("Опишите, что именно нужно сделать на складе.");
  if (note && note.length > 500) throw Error("Комментарий к услуге должен быть не длиннее 500 символов.");
  const previous = order.warehouseServiceRequests ?? [];
  if (previous.some((request) => request.serviceId === serviceId && ["requested", "quoted", "approved"].includes(request.status)))
    throw Error("Эта услуга уже запрошена для заказа.");
  const count = service.unit === "package" ? 1 : service.unit === "item" ? order.quantity : units;
  if (!Number.isInteger(count) || count < 1 || count > 100) throw Error("Проверьте количество услуги.");
  const request = buildServiceRequest(service, order.product.country, count, "warehouse", now, note);
  return withNotification(replace(state, {
    ...order,
    warehouseServiceRequests: [...previous, request],
    history: [...order.history, { at: now, text: `Клиент запросил услугу склада «${service.title.ru}»; оператор проверит выполнимость и отправит стоимость на согласование.` }],
  }), "Запрос передан оператору", `${service.title.ru}. Цена и возможность будут подтверждены до выполнения.`, id, now);
}

export function completeWarehouseService(state: State, id: string, requestId: string, now = Date.now()): State {
  const order = getOrder(state, id);
  if (order.cancelled || order.status !== 2 || !order.warehouseInspection)
    throw Error("Услуги можно отметить только после приёмки и до взвешивания.");
  const request = (order.warehouseServiceRequests ?? []).find((item) => item.id === requestId);
  if (!request || request.status !== "approved") throw Error("Сначала получите согласие покупателя на услугу.");
  const completed = { ...request, status: "completed" as const, completedAt: now };
  return withNotification(replace(state, {
    ...order,
    warehouseServiceRequests: (order.warehouseServiceRequests ?? []).map((item) => item.id === requestId ? completed : item),
    history: [...order.history, { at: now, text: `Склад отметил услугу «${request.title.ru}» выполненной.` }],
  }), "Услуга выполнена", request.title.ru, id, now);
}

export function declineWarehouseService(state: State, id: string, requestId: string, reason: string, now = Date.now()): State {
  const order = getOrder(state, id);
  if (order.cancelled || order.status !== 2 || !order.warehouseInspection)
    throw Error("Запрос можно отклонить после приёмки товара и до взвешивания.");
  const request = (order.warehouseServiceRequests ?? []).find((item) => item.id === requestId);
  if (!request || request.status !== "requested") throw Error("Запрос уже обработан или не найден.");
  if ((order.changeRequests ?? []).some((change) => change.status === "pending" && change.warehouseServiceRequestId === requestId))
    throw Error("Сначала обработайте ожидающее согласование услуги.");
  const note = reason.trim();
  if (note.length < 2 || note.length > 500) throw Error("Укажите причину недоступности услуги.");
  return withNotification(replace(state, {
    ...order,
    warehouseServiceRequests: (order.warehouseServiceRequests ?? []).map((item) => item.id === requestId ? { ...item, status: "declined" as const } : item),
    history: [...order.history, { at: now, text: `Оператор отклонил услугу «${request.title.ru}»: ${note}` }],
  }), "Услуга недоступна", `${request.title.ru}: ${note}`, id, now);
}

export function merchantParcelKey(item: CartItem) {
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
  const next = items.map((item) => {
    const itemPricing = pricingForCountry(config, item.product.country);
    return {
      ...item,
      quote: quote(
        item.product.usd,
        item.product.weight,
        now,
        item.quantity,
        item.product.sourceShippingUsd ?? 0,
        itemPricing,
      ),
    };
  });
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
    const countryPricing = pricingForCountry(config, next[indexes[0]].product.country);
    const shippingTotal = Math.ceil(chargeableWeight * countryPricing.perKg);
    const reserveTotal = Math.ceil(shippingTotal * countryPricing.reserve);
    const deliveryMarginTotal = Math.round(shippingTotal * countryPricing.deliveryMargin);
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
  identityProfiles: z.array(identityProfileSchema).optional(),
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
  const confirmed = identityProfileSchema.parse({ ...value, passportMasked: "•••• " + cleanNumber.slice(-4), confirmedAt: now });
  const profiles = state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);
  return { ...state, identityProfile: confirmed, identityProfiles: [confirmed, ...profiles.filter((profile) => profile.documentId !== confirmed.documentId && profile.recipientProfileId !== confirmed.recipientProfileId)] };
}

export function clearIdentity(state: State, documentId: string): State {
  return { ...state, identityProfile: state.identityProfile?.documentId === documentId ? undefined : state.identityProfile, identityProfiles: (state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : [])).filter((profile) => profile.documentId !== documentId) };
}

/** Saves a recipient. `id` edits that recipient in place; `primary` chooses the default one.
 * Older clients send neither, and the saved recipient becomes the default, as before. */
export function saveDeliveryProfile(state: State, value: DeliveryProfile, label: string, id?: string, primary?: boolean): State {
  const target = id ? state.deliveryProfiles.find((profile) => profile.id === id) : undefined;
  if (id && !target) throw Error("Получатель не найден. Обновите страницу.");
  const existing = target ?? state.deliveryProfiles.find((profile) => JSON.stringify(profile).includes(JSON.stringify(value)));
  const others = state.deliveryProfiles.filter((profile) => profile.id !== existing?.id);
  // There is always exactly one default recipient: it cannot be switched off, only moved to another one.
  const makePrimary = primary === undefined || primary || Boolean(existing?.primary) || !others.length;
  const profile = savedDeliveryProfileSchema.parse({ ...value, id: existing?.id ?? crypto.randomUUID(), label, primary: makePrimary });
  const rest = makePrimary ? others.map((item) => ({ ...item, primary: false })) : others;
  const deliveryProfiles = existing
    ? state.deliveryProfiles.map((item) => item.id === profile.id ? profile : rest.find((other) => other.id === item.id) ?? item)
    : makePrimary ? [profile, ...rest] : [...rest, profile];
  const primaryProfile = deliveryProfiles.find((item) => item.primary) ?? deliveryProfiles[0];
  return { ...state, deliveryProfiles, deliveryProfile: deliveryProfileSchema.parse(primaryProfile) };
}

export function submitDeclarationPreview(state: State, orderIds: string[], now = Date.now()): State {
  const selected = [...new Set(orderIds)].map((id) => state.orders.find((order) => order.id === id)).filter((order): order is Order => !!order && !order.cancelled);
  if (!selected.length) throw Error("Выберите хотя бы один действующий заказ.");
  const recipientIds = new Set(selected.map((order) => order.deliveryProfileId ?? "legacy"));
  if (recipientIds.size > 1) throw Error("Подготовьте отдельную декларацию для каждого получателя.");
  const first = selected[0];
  const profiles = state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);
  const identity = first.identity ?? profiles.find((profile) => profile.recipientProfileId === first.deliveryProfileId) ?? state.identityProfile;
  const delivery = first.delivery ?? (first.deliveryProfileId ? state.deliveryProfiles.find((profile) => profile.id === first.deliveryProfileId) : undefined) ?? state.deliveryProfile;
  if (!identity) throw Error("Сначала подтвердите паспортные данные получателя.");
  if (!delivery) throw Error("Сначала сохраните адрес доставки.");
  const lines = selected.map((order) => ({ orderId: order.id, description: order.product.declarationDescription ?? order.product.name, country: order.product.country ?? "Не указана", quantity: order.quantity, value: order.quote.merchandise }));
  const declaration: Declaration = { id: "DEC-" + crypto.randomUUID().slice(0, 8).toUpperCase(), createdAt: now, status: "submitted-preview", identity, delivery, orderIds: selected.map((order) => order.id), lines, totalValue: lines.reduce((sum, line) => sum + line.value, 0) };
  return withNotification({ ...state, declarations: [declaration, ...state.declarations].slice(0, 20) }, "Черновик декларации подготовлен", `Пакет ${declaration.id} сохранён внутри Atlas. В таможню он не отправлялся.`);
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
export const orderNeedsOperatorAttention = (order: Order) =>
  Boolean(order.issueCase && order.issueCase.status !== "resolved") ||
  (!order.cancelled && (
    Boolean(order.settlement?.extra && !order.extraApproved) ||
    Boolean(order.storeShippingSettlement?.extra && !order.storeShippingExtraApproved) ||
    (order.changeRequests ?? []).some((request) => request.status === "pending") ||
    order.warehouseInspection?.condition === "damaged" ||
    order.warehouseInspection?.condition === "mismatch"
  ));
export function addToCart(
  state: State,
  p: Product,
  variant: string,
  now = Date.now(),
  config: Pricing = tariff,
): State {
  if (!p.variants.includes(variant)) throw Error("Выберите вариант товара.");
  const itemPricing = pricingForCountry(config, p.country);
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
      requestedServiceIds: config.serviceCatalog.filter((service) => service.enabled && service.required && service.requestStage === "checkout").map((service) => service.id),
      quote: quote(p.usd, p.weight, now, 1, p.sourceShippingUsd ?? 0, itemPricing),
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
  const itemPricing = pricingForCountry(config, item.product.country);
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
              itemPricing,
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
        pricingForCountry(config, i.product.country),
      ),
    })), now, config),
  };
}
export const cartSignature = (items: CartItem[]) =>
  items.map((i) => {
    const services = [...(i.requestedServiceIds ?? [])].sort().map((serviceId) =>
      `${serviceId}:${i.requestedServiceUnits?.[serviceId] ?? 1}`,
    ).join(",");
    return i.id + ":" + i.quote.id + ":" + services;
  }).join("|");
export function checkoutCart(
  state: State,
  key: string,
  signature: string,
  useBalance: boolean,
  now = Date.now(),
  consentVersion?: string,
  delivery?: DeliveryProfile,
  deliveryProfileId?: string,
  identityProfileId?: string,
  config: Pricing = tariff,
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
  const availableServices = config.serviceCatalog.filter((service) => service.enabled && service.requestStage === "checkout");
  for (const item of state.cart) {
    const selected = item.requestedServiceIds ?? [];
    if (selected.some((serviceId) => !availableServices.some((service) => service.id === serviceId)))
      throw Error("Одна из выбранных услуг больше недоступна. Обновите корзину.");
    if (Object.entries(item.requestedServiceUnits ?? {}).some(([serviceId, units]) => {
      const service = availableServices.find((candidate) => candidate.id === serviceId);
      return !selected.includes(serviceId) || !service || ["package", "item"].includes(service.unit) || !Number.isInteger(units) || units < 1 || units > 100;
    })) throw Error("Количество дополнительной услуги изменилось. Проверьте корзину заново.");
    if (availableServices.some((service) => service.required && !selected.includes(service.id)))
      throw Error("Выберите обязательные услуги перед оформлением.");
  }
  if (state.cart.some((i) => now >= i.quote.expiresAt))
    throw Error("Расчёт истёк. Обновите его перед оформлением.");
  let available = useBalance ? Math.max(0, balanceOf(state)) : 0;
  const selectedDelivery = deliveryProfileId ? state.deliveryProfiles.find((profile) => profile.id === deliveryProfileId) : undefined;
  if (deliveryProfileId && !selectedDelivery) throw Error("Выбранный получатель больше не сохранён. Обновите профиль.");
  const checkedDelivery = selectedDelivery
    ? deliveryProfileSchema.parse(selectedDelivery)
    : delivery
      ? deliveryProfileSchema.parse(delivery)
    : state.deliveryProfile;
  const profiles = state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);
  const selectedIdentity = identityProfileId ? profiles.find((profile) => profile.documentId === identityProfileId) : undefined;
  if (identityProfileId && (!selectedDelivery || !selectedIdentity || selectedIdentity.recipientProfileId !== selectedDelivery.id)) throw Error("Паспорт не привязан к выбранному получателю.");
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
        description: "Оплата заказа из внутреннего баланса Atlas",
      });
    const serviceRequests = (i.requestedServiceIds ?? []).map((serviceId) => {
      const service = availableServices.find((candidate) => candidate.id === serviceId);
      if (!service) throw Error("Одна из выбранных услуг больше недоступна. Обновите корзину.");
      const units = service.unit === "item" ? i.quantity
        : service.unit === "package" ? 1
        : i.requestedServiceUnits?.[serviceId] ?? 1;
      return buildServiceRequest(service, i.product.country, units, "checkout", now);
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
      deliveryProfileId: selectedDelivery?.id,
      identity: selectedIdentity,
      warehouseServiceRequests: serviceRequests.length ? serviceRequests : undefined,
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
            "Заказ оформлен в Atlas. Сумма " +
            money(i.quote.total) +
            (payable ? ". Ожидается подтверждение платёжного провайдера." : ". Учтено из внутреннего баланса Atlas."),
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
    throw Error("Оплата недоступна: платёжный провайдер не подключён.");
  const next = replace(state, {
    ...o,
    payment: { ...o.payment, status: "paid", updatedAt: now },
    history: [
      ...o.history,
      { at: now, text: "Статус оплаты отмечен в Atlas. Платёжный провайдер не подтвердил списание." },
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
      description: "Статус оплаты записан в Atlas; провайдер не подключён",
    },
  ];
  return withNotification(
    next,
    "Статус оплаты обновлён в Atlas",
    "Платёжный провайдер не подключён: списания и банковского подтверждения нет.",
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

export function updateOrderIssueCase(
  state: State,
  id: string,
  category: OrderIssueCategory,
  status: OrderIssueStatus,
  proposedRefund?: number,
  now = Date.now(),
): State {
  const order = getOrder(state, id);
  const event = orderIssueEventSchema.parse({
    id: crypto.randomUUID(), at: now, category, status,
    ...(proposedRefund === undefined ? {} : { proposedRefund }),
  });
  const issueCase = orderIssueCaseSchema.parse({
    category, status,
    ...(proposedRefund === undefined ? {} : { proposedRefund }),
    updatedAt: now,
    history: [...(order.issueCase?.history ?? []), event].slice(-40),
  });
  return replace(state, {
    ...order,
    issueCase,
    history: [...order.history, { at: now, text: "Оператор обновил разбор проблемы/возврата." }],
  });
}

export function sendCustomerNotification(
  state: State,
  id: string,
  title: string,
  message: string,
  now = Date.now(),
): State {
  const o = getOrder(state, id);
  const cleanTitle = title.trim();
  const cleanMessage = message.trim();
  if (cleanTitle.length < 2 || cleanTitle.length > 120)
    throw Error("Заголовок уведомления должен содержать от 2 до 120 символов.");
  if (!cleanMessage || cleanMessage.length > 300)
    throw Error("Текст уведомления должен содержать от 1 до 300 символов.");
  return {
    ...state,
    notifications: [
      { id: crypto.randomUUID(), at: now, title: cleanTitle, message: cleanMessage, read: false, orderId: o.id },
      ...state.notifications,
    ].slice(0, 80),
    orders: state.orders.map((order) => order.id === id
      ? { ...order, history: [...order.history, { at: now, text: "Оператор отправил уведомление в Atlas." }] }
      : order),
  };
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
  const serviceRequest = value.warehouseServiceRequestId
    ? (o.warehouseServiceRequests ?? []).find((request) => request.id === value.warehouseServiceRequestId)
    : undefined;
  if (value.resolvesWarehouseIssue && (
    value.kind !== "substitution" ||
    !o.warehouseInspection ||
    o.warehouseInspection.condition === "ok" ||
    !value.proposedValue?.trim()
  )) throw Error("Решение проблемы требует явной замены товара и указания нового варианта.");
  if (value.warehouseServiceRequestId && (!serviceRequest || serviceRequest.status !== "requested" || value.kind !== "warehouse-service"))
    throw Error("Запрос на эту складскую услугу уже обработан или не найден.");
  if (serviceRequest) {
    if (o.status < 2 || o.status >= 4 || !o.warehouseInspection)
      throw Error("Стоимость складской услуги можно предложить после приёмки товара.");
    if (value.amountDelta < 0) throw Error("Стоимость услуги не может быть отрицательной.");
    if (serviceRequest.pricingMode === "fixed" && value.amountDelta !== (serviceRequest.feeUzs ?? 0) * serviceRequest.units)
      throw Error("Сумма не совпадает с зафиксированным тарифом услуги.");
  }
  const request = changeRequestSchema.parse({
    ...value,
    id: "CHG-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
    status: "pending",
    createdAt: now,
  });
  const warehouseServiceRequests = serviceRequest
    ? (o.warehouseServiceRequests ?? []).map((item) => item.id === serviceRequest.id
      ? { ...item, status: "quoted" as const, quotedAmount: request.amountDelta, quoteChangeRequestId: request.id }
      : item)
    : o.warehouseServiceRequests;
  return withNotification(
    replace(state, {
      ...o,
      changeRequests: [...(o.changeRequests ?? []), request],
      warehouseServiceRequests,
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
  const warehouseServiceRequests = request.warehouseServiceRequestId
    ? (o.warehouseServiceRequests ?? []).map((serviceRequest) => serviceRequest.id === request.warehouseServiceRequestId
      ? { ...serviceRequest, status: decision, quotedAmount: request.amountDelta }
      : serviceRequest)
    : o.warehouseServiceRequests;
  const nextOrder: Order = {
    ...o,
    variant: decision === "approved" && request.kind === "variant" && request.proposedValue
      ? request.proposedValue
      : o.variant,
    changeRequests: (o.changeRequests ?? []).map((item) => item.id === requestId ? nextRequest : item),
    warehouseServiceRequests,
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
        ? "Разница учтена на внутреннем балансе Atlas. Банковский перевод не выполнялся."
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
    || (o.status >= 2 && (o.warehouseServiceRequests ?? []).some((request) => ["requested", "quoted", "approved"].includes(request.status)))
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
  if ((o.warehouseServiceRequests ?? []).some((request) => ["requested", "quoted", "approved"].includes(request.status)))
    throw Error("Сначала завершите или отклоните выбранные складские услуги.");
  if (
    o.warehouseInspection.condition !== "ok" &&
    !(o.changeRequests ?? []).some((request) =>
      request.status === "approved" &&
      request.createdAt >= o.warehouseInspection!.inspectedAt &&
      request.kind === "substitution" &&
      request.resolvesWarehouseIssue === true &&
      !!request.proposedValue?.trim(),
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
        ? "Остаток учтён на внутреннем балансе Atlas. Банковский перевод не выполнялся."
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
          "Покупатель согласовал доплату " + money(o.settlement.extra),
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
        text: "Заказ отменён до выкупа. Сумма учтена на внутреннем балансе Atlas; банковский перевод не выполнялся.",
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
