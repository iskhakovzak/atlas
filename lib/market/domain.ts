import { z } from "zod";
import { combinedShipmentWeight, customsVersion, usdRates } from "./world.ts";
import {pickLocale} from './uz-cyrl.ts';
import type {Locale} from './i18n.ts';

export const money = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n) + " сум";
/**
 * A domain error the API can localize: `code` (err_NN) picks the uz/en/ru text in lib/market/i18n.ts, `message`
 * stays the Russian text written into carts, logs and operator screens.
 */
export const codedError = (code: string, message: string) => Object.assign(new Error(message), { code });
const positive = z.number().finite().positive();
const amount = z.number().int().nonnegative();
const storeAmount = z.number().finite().nonnegative().max(1_000_000);
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
  sourceUrl:z.string().max(3000).optional(),
  productId:z.string().max(120).optional(),
  sellerId:z.string().max(120).optional(),
  offerId:z.string().max(120).optional(),
  colorId:z.string().max(120).optional(),
  options:z.array(z.object({name:z.string().trim().max(100),value:z.string().trim().max(140)})).max(16).optional(),
  images:z.array(z.string().max(3000)).max(12).optional(),
  label: z.string().trim().max(140),
  size: z.string().trim().max(100).optional(),
  sizeLabel: z.string().trim().max(100).optional(),
  sizeAlternates:z.array(z.object({system:z.string().trim().max(40),value:z.string().trim().max(100)})).max(8).optional(),
  color: z.string().trim().max(100).optional(),
  available: z.boolean(),
  availabilityKnown: z.boolean().optional(),
  price: z.number().finite().nonnegative().optional(),
  image: z.string().trim().max(3000).optional(),
  /** Units the store reports for this option (eBay); absent when the store does not say. */
  quantity: z.number().int().min(0).max(100_000).optional(),
  /** The store only says "more than N". */
  quantityMoreThan: z.number().int().min(0).max(100_000).optional(),
});
export type SourceVariant = z.infer<typeof sourceVariantSchema>;
export const sourceColorwayGallerySchema=z.object({color:z.string().trim().max(120),colorId:z.string().max(120).optional(),images:z.array(z.string().max(3000)).max(12)});
/** How a warehouse service is priced: a fixed rate, a quote from the operator, or a percent of the parcel value. */
export const servicePricingModeSchema = z.enum(["fixed", "operator-quote", "value-percent"]);
export const serviceOfferingSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,79}$/),
  title: localizedTextSchema,
  description: localizedDescriptionSchema,
  requestStage: z.enum(["checkout", "warehouse"]),
  unit: z.enum(["package", "item", "day", "photo", "half-hour"]),
  pricingMode: servicePricingModeSchema,
  feeUzs: amount.max(20_000_000).default(0),
  countryPrices: z.record(z.string().min(1).max(80), amount.max(20_000_000)).default({}),
  /**
   * "value-percent" (since 10 October 2026, parcel insurance): this share of the parcel's goods value, or
   * `valuePercentHigh` once the parcel is worth more than `valueThresholdUsd`. Counted into the order total.
   */
  valuePercent: z.number().finite().min(0).max(0.5).optional(),
  valuePercentHigh: z.number().finite().min(0).max(0.5).optional(),
  valueThresholdUsd: z.number().finite().min(0).max(100_000).optional(),
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
  { id: "shipping-insurance", title: { ru: "Страхование посылки", uz: "Posilkani sug‘urtalash", en: "Parcel insurance" }, description: { ru: "100 % возмещения при утере или порче. Без страховки: $15 за кг при утере, $3 за кг при порче.", uz: "Yo‘qolish yoki shikastlanishda 100 % qoplanadi. Sug‘urtasiz: yo‘qolsa kg uchun $15, shikastlansa kg uchun $3.", en: "100% compensation for loss or damage. Without insurance: $15 per kg for loss, $3 per kg for damage." }, requestStage: "checkout", unit: "package", pricingMode: "value-percent", feeUzs: 0, countryPrices: {}, valuePercent: 0.02, valuePercentHigh: 0.03, valueThresholdUsd: 200, enabled: true, required: false },
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
  sourceColorwayImages:z.array(sourceColorwayGallerySchema).max(250).optional(),
  sourceUrl: z.string().optional(),
  sourceVariantId: z.string().max(120).optional(),
  sourceGroupId:z.string().max(120).optional(),
  sourceProductId:z.string().max(120).optional(),
  sourceSellerId:z.string().max(120).optional(),
  sourceOfferId:z.string().max(120).optional(),
  sourceColorId:z.string().max(120).optional(),
  sourceOptions:z.array(z.object({name:z.string().trim().max(100),value:z.string().trim().max(140)})).max(16).optional(),
  sourceVariantScope:z.enum(['group','color','item']).optional(),
  sourceVariantsComplete:z.boolean().optional(),
  description: z.string().optional(),
  country: z.string().optional(),
  sourceCurrency: z.string().optional(),
  sourcePrice: z.number().nonnegative().optional(),
  /** The store's price before its discount, in sourceCurrency. Shown crossed out next to sourcePrice; never part of a total. */
  sourceReferencePrice: z.number().positive().max(1_000_000).optional(),
  sourceShippingUsd: z.number().nonnegative().optional(),
  sourceShipping: z.number().nonnegative().optional(),
  sourceShippingCurrency: z.string().optional(),
  sourceShippingEstimated: z.boolean().optional(),
  shippingKnown: z.boolean().optional(),
  boxedWeight: positive.optional(),
  weightOrigin: z.string().optional(),
  importedAt: amount.optional(),
  sourceExpiresAt: amount.optional(),
  /** Server time of the last successful check against the live store (cart-add, cart-check, checkout).
   * The server overwrites whatever a client sends here. */
  sourceCheckedAt: amount.optional(),
  /** Customer explicitly reviewed a manual fallback after the merchant fetch failed. */
  sourceManuallyConfirmed: z.boolean().optional(),
  /** Public listing snapshot remains discoverable, but its price is no longer current. */
  priceNeedsConfirmation: z.boolean().optional(),
  imageOrigin: z.string().optional(),
  declarationDescription: z.string().max(240).optional(),
  /** Units left for the chosen option as the store reports them (only eBay does); the server sets these. */
  stockQuantity: z.number().int().min(0).max(100_000).optional(),
  stockMoreThan: z.number().int().min(0).max(100_000).optional(),
  stockSource: z.enum(["ebay","merchant"]).optional(),
  /** How the boxed weight was found: published by the store, or an editable estimate. */
  weightBasis: z.enum(["store", "estimate", "catalog", "customer"]).optional(),
});
export type Product = z.infer<typeof productSchema>;
/**
 * The store's discount on a product: the crossed-out price (in the store's currency) and the percentage off.
 * Null when there is none, or when the "before" price is not believable (not above the price, or over 10 times it).
 */
export function storeDiscount(product: Pick<Product, "usd" | "sourcePrice" | "sourceReferencePrice">): { was: number; percent: number } | null {
  const now = product.sourcePrice ?? product.usd, was = product.sourceReferencePrice;
  if (!was || !(now > 0) || !(was > now) || was > now * 10) return null;
  const percent = Math.round((was - now) / was * 100);
  return percent > 0 ? { was, percent } : null;
}
/** The most units of one line the customer may choose: 10, or fewer when the store reports less stock. */
export const maxLineQuantity = (product: Pick<Product, "stockQuantity">) =>
  Math.max(0, Math.min(10, product.stockQuantity ?? 10));
export const products: Product[] = [
  {
    id: "sneaker",
    country: "США",
    boxedWeight: 1.6,
    name: "Кроссовки на каждый день",
    brand: "Обувь · США",
    category: "Обувь",
    usd: 99,
    weight: 1.9,
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
    weight: 0.5,
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
    weight: 1,
    image: "/images/backpack.jpg",
    variants: ["Стандартный"],
    description:
      "Один рюкзак для повседневных планов. Изучите расчёт покупки и доставки до оформления заказа.",
  },
];
export const pricingSchema = z.object({
  fx: positive.max(1_000_000),
  // International delivery per kg in soum, as quotes and settlements use it. When `perKgUsd` is set
  // (the carrier prices in USD), `normalizePricing` derives this from it at the current rate.
  perKg: positive.max(10_000_000),
  perKgUsd: positive.max(1_000).optional(),
  /** Standard (slower) international delivery per kg in USD; the owner's $13.98 when unset (6 October 2026). */
  standardPerKgUsd: positive.max(1_000).optional(),
  margin: z.number().finite().min(0).max(1),
  buyoutFee: z.number().finite().min(0).max(1).default(0),
  conversionFee: z.number().finite().min(0).max(1).default(0),
  deliveryMargin: z.number().finite().min(0).max(1).default(0),
  optionalServices: z.number().finite().min(0).max(10_000_000).default(0),
  reserve: z.number().finite().min(0).max(2),
  divisor: positive.max(100_000),
  // Unknown store delivery is reserved once per store parcel, and not at all from this much
  // merchandise (USD) from that store: most stores ship such orders free. Old rows get $50.
  storeShippingFreeFromUsd: z.number().finite().min(0).max(10_000).default(50),
  rates: z.record(z.string(), positive).default(usdRates),
  // Warehouse service options are versioned with pricing. Old settings receive
  // the safe starter catalogue; submitted orders keep their own snapshots.
  serviceCatalog: z.array(serviceOfferingSchema).max(40).default(defaultServiceOfferings),
  // Optional dispatch-country overrides. Keys use the same country labels as
  // Product.country (the country of actual dispatch), not the customer's country.
  // Old centrally managed pricing rows remain valid and inherit the base tariff.
  countryOverrides: z.record(z.string().min(1).max(80), z.object({
    perKg: positive.max(10_000_000).optional(),
    perKgUsd: positive.max(1_000).optional(),
    standardPerKgUsd: positive.max(1_000).optional(),
    margin: z.number().finite().min(0).max(1).optional(),
    buyoutFee: z.number().finite().min(0).max(1).optional(),
    conversionFee: z.number().finite().min(0).max(1).optional(),
    deliveryMargin: z.number().finite().min(0).max(1).optional(),
    optionalServices: z.number().finite().min(0).max(10_000_000).optional(),
    reserve: z.number().finite().min(0).max(2).optional(),
  }).strict()).default({}),
  // Delivery time per region in business days [from, to], edited in the admin (Тарифы). A region left out
  // falls back to lib/market/site-content.ts; the home rates table and the example bill read it.
  deliveryDays: z.record(z.enum(["us", "uk", "cn", "de", "it", "es"]), z.tuple([z.number().int().min(1).max(120), z.number().int().min(1).max(120)]).refine(([from, to]) => from <= to, "from ≤ to")).optional(),
  /** Standard delivery in business days per dispatch region (admin override of site-content's 9–14). */
  standardDeliveryDays: z.record(z.enum(["us", "uk", "cn", "de", "it", "es"]), z.tuple([z.number().int().min(1).max(120), z.number().int().min(1).max(120)]).refine(([from, to]) => from <= to, "from ≤ to")).optional(),
  // Where `fx` comes from: the Central Bank of Uzbekistan's USD rate × `fxMarkup`, fetched by the server
  // (lib/market/fx-server.ts), or a rate the operator sets. Customers see which one and when it was set.
  fxSource: z.enum(["cbu", "manual"]).default("manual"),
  fxMarkup: z.number().finite().min(1).max(1.2).default(1.012),
  fxCbuRate: positive.max(1_000_000).optional(),
  fxCbuDate: z.string().max(20).optional(),
  fxUpdatedAt: amount.optional(),
  // Customs estimate overrides (informational only, never in the total); defaults and sources in customs.ts.
  customsAllowanceUsd: z.number().finite().min(0).max(10_000).optional(),
  customsRate: z.number().finite().min(0).max(1).optional(),
  customsMinimumPerKg: z.number().finite().min(0).max(100).optional(),
  // "Atlas pays customs for me": this share of the goods price (no delivery), a line in the bill when the customer
  // chooses it, with the estimated duty prepaid in the order and settled later (owner's decisions, 5 October 2026).
  customsHelpFee: z.number().finite().min(0).max(0.2).default(0.0498),
  // Owner decisions already applied to this row (see upgradePricing).
  revision: z.number().int().min(0).max(1000).optional(),
  version: z.string().min(1).max(80),
  updatedAt: amount,
  managedBy: z.string().max(160).optional(),
});
export type Pricing = z.infer<typeof pricingSchema>;
/** Atlas express delivery from the US, UK, China, Germany, Italy and Spain: $15.98 per kg (owner, 6 October 2026). */
export const deliveryPerKgUsd = 15.98;
/** Atlas standard delivery (9–14 business days): $13.98 per kg (owner, 6 October 2026). */
export const standardDeliveryPerKgUsd = 13.98;
/** How fast the parcel travels from the Atlas warehouse abroad; the price and days differ, the rest of the quote does not. */
export const deliverySpeeds = ["express", "standard"] as const;
export type DeliverySpeed = (typeof deliverySpeeds)[number];
export const deliverySpeedSchema = z.enum(deliverySpeeds);
export const defaultDeliverySpeed: DeliverySpeed = "express";
/** Atlas service fee on merchandise only (owner's decision, 4 October 2026); never on delivery or customs. */
export const atlasServiceFee = 0.0998;
/** Atlas pays the customer's customs for this share of the goods price, delivery excluded (owner, 5 October 2026). */
export const customsHelpShare = 0.0498;
/**
 * Owner decisions that tariffs saved earlier still lack: 1 = $15 per kg, 2 = 9.98% fee and the CBU rate × 1.012,
 * 3 = no international reserve in the bill and customs payment at 4.98% of the cart (5 October 2026),
 * 4 = $14.98 per kg everywhere and the fee exactly 9.98%: no buyout or conversion percent on top (6 October 2026),
 * 5 = express $15.98 and standard $13.98 per kg (6 October 2026, evening); $15 and $14.98 saved earlier become $15.98.
 */
export const pricingRevision = 5;
/** Until the server reads the Central Bank rate, the owner's estimate stands in, shown as a set rate. */
const startingFx = 11990;
export const tariff: Pricing = {
  fx: startingFx,
  perKg: Math.round(deliveryPerKgUsd * startingFx),
  perKgUsd: deliveryPerKgUsd,
  standardPerKgUsd: standardDeliveryPerKgUsd,
  fxSource: "cbu",
  fxMarkup: 1.012,
  customsHelpFee: customsHelpShare,
  revision: pricingRevision,
  margin: atlasServiceFee,
  buyoutFee: 0,
  conversionFee: 0,
  deliveryMargin: 0,
  optionalServices: 0,
  // The parcel is billed by its estimated weight; the warehouse weighs it and the difference is refunded to the
  // balance or asked for with consent. A separate reserve on top only added numbers (owner, 5 October 2026).
  reserve: 0,
  divisor: 5000,
  storeShippingFreeFromUsd: 50,
  rates: usdRates,
  serviceCatalog: defaultServiceOfferings,
  countryOverrides: {},
  version: "demo-1",
  updatedAt: 0,
};
/** The rate in use: the Central Bank rate × markup once the server has read it, else the set rate. */
export function effectiveFx(config: Pick<Pricing, "fx" | "fxSource" | "fxMarkup" | "fxCbuRate">) {
  return config.fxSource === "cbu" && config.fxCbuRate ? Math.round(config.fxCbuRate * (config.fxMarkup ?? 1.012)) : config.fx;
}
/** Derive the rate, then soum per kg from USD per kg at that rate, for the base rate and each country override. */
export function normalizePricing(config: Pricing): Pricing {
  const fx = effectiveFx(config);
  const soum = (usd: number) => Math.round(usd * fx);
  const countryOverrides = Object.fromEntries(Object.entries(config.countryOverrides ?? {}).map(([country, override]) =>
    [country, override.perKgUsd === undefined ? override : { ...override, perKg: soum(override.perKgUsd) }]));
  return { ...config, fx, perKg: config.perKgUsd === undefined ? config.perKg : soum(config.perKgUsd), countryOverrides, serviceCatalog: upgradeServiceCatalog(config.serviceCatalog) };
}
/**
 * A tariff saved before the owner's decisions lacks them: $15.98 express and $13.98 standard per kg, the 9.98% fee and the Central Bank
 * rate × 1.012. It gets them under a new version, so carts quoted under the old one are shown again.
 */
export function upgradePricing(config: Pricing): Pricing {
  const revision = config.revision ?? 0;
  if (revision >= pricingRevision) return normalizePricing(config);
  const earlier = revision >= 2 ? config : { ...config, margin: atlasServiceFee, fxSource: "cbu" as const, fxMarkup: 1.012 };
  // A saved buyout or conversion percent showed as a 10.98% fee; per-country rates and fees gave other prices.
  const strip = ["reserve", ...(revision < 4 ? ["perKg", "perKgUsd", "margin", "buyoutFee", "conversionFee", "deliveryMargin"] : [])] as const;
  // Revision 5: the old $15 and $14.98 defaults become express $15.98; standard $13.98 is added; the commission
  // is exactly the 9.98% fee (no buyout or conversion fee on top).
  const legacyPerKg = [undefined, 15, 14.98];
  return normalizePricing({
    ...earlier,
    ...(revision < 4 ? { deliveryMargin: 0 } : {}),
    perKgUsd: revision < 4 || legacyPerKg.includes(earlier.perKgUsd) ? deliveryPerKgUsd : earlier.perKgUsd,
    standardPerKgUsd: earlier.standardPerKgUsd ?? standardDeliveryPerKgUsd,
    margin: atlasServiceFee,
    buyoutFee: 0,
    conversionFee: 0,
    reserve: 0,
    customsHelpFee: customsHelpShare,
    countryOverrides: Object.fromEntries(Object.entries(earlier.countryOverrides ?? {})
      .map(([country, override]) => { const rest: Record<string, unknown> = { ...override }; for (const key of strip) delete rest[key]; return [country, rest]; })
      .filter(([, rest]) => Object.keys(rest).length > 0)),
    revision: pricingRevision,
    version: `${config.version.slice(0, 70)}+r${pricingRevision}`,
  });
}
/** Delivery per kg in USD for a dispatch country and speed, as the customer pays it (with the delivery margin). */
export function deliveryPerKgUsdFor(config: Pricing, country?: string, speed: DeliverySpeed = defaultDeliverySpeed) {
  const p = pricingForCountry(config, country);
  const override = country ? config.countryOverrides?.[country] : undefined;
  if (speed === "standard") return Math.round((p.standardPerKgUsd ?? standardDeliveryPerKgUsd) * (1 + p.deliveryMargin) * 100) / 100;
  // A soum-only country override wins over the base USD rate.
  const usd = override?.perKg !== undefined && override.perKgUsd === undefined ? p.perKg / p.fx : (p.perKgUsd ?? p.perKg / p.fx);
  return Math.round(usd * (1 + p.deliveryMargin) * 100) / 100;
}
/** Soum per kg for a speed from a tariff already resolved for the country (pricingForCountry). */
export function perKgSoumFor(config: Pricing, speed: DeliverySpeed = defaultDeliverySpeed) {
  return speed === "standard" ? Math.round((config.standardPerKgUsd ?? standardDeliveryPerKgUsd) * config.fx) : config.perKg;
}
/** Resolve only the pricing dimensions explicitly overridden for this item's
 * actual dispatch country. FX rates stay currency-based in `rates`. */
export function pricingForCountry(config: Pricing, country?: string): Pricing {
  const override = country ? config.countryOverrides?.[country] : undefined;
  return override ? { ...config, ...override } : config;
}
export const serviceTitle = (service: ServiceOffering | WarehouseServiceRequest, locale: Locale) => pickLocale(service.title, locale);
export const serviceDescription = (service: ServiceOffering | WarehouseServiceRequest, locale: Locale) => pickLocale(service.description, locale);
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
    if (service.required && (service.requestStage !== "checkout" || service.pricingMode === "operator-quote"))
      throw Error("Обязательная услуга должна предлагаться при оформлении и иметь фиксированный тариф или процент.");
    if (service.pricingMode === "value-percent" && (service.requestStage !== "checkout" || service.unit !== "package"))
      throw Error("Процент от стоимости считается только для посылки при оформлении.");
    if (service.enabled && service.pricingMode === "value-percent" && !(service.valuePercent && service.valuePercent > 0))
      throw Error("Для услуги с процентом от стоимости задайте процент больше нуля.");
    if (service.enabled && service.pricingMode === "fixed" && serviceFeeForCountry(service) <= 0)
      throw Error("Для активной услуги с фиксированной ценой задайте положительный базовый тариф.");
    if (service.enabled && service.pricingMode === "fixed" && Object.values(service.countryPrices).some((fee) => fee <= 0))
      throw Error("У активной услуги все заданные тарифы по странам должны быть больше нуля.");
  }
  return services;
}
/** The rate a value-percent service takes for a parcel worth `valueUsd`; 0 for other pricing modes. */
export function valueServiceRate(service: Pick<ServiceOffering, "pricingMode" | "valuePercent" | "valuePercentHigh" | "valueThresholdUsd">, valueUsd: number) {
  if (service.pricingMode !== "value-percent") return 0;
  const base = service.valuePercent ?? 0;
  return service.valueThresholdUsd !== undefined && service.valuePercentHigh !== undefined && valueUsd > service.valueThresholdUsd
    ? service.valuePercentHigh
    : base;
}
/** The insurance entry saved before 10 October 2026 was locked off ("Недоступно, пока…"); it becomes the owner's terms. */
const lockedInsuranceDescription = "Недоступно, пока не подтверждены страховщик, покрытие, исключения и порядок выплат.";
function upgradeServiceCatalog(services: ServiceOffering[]) {
  const insurance = defaultServiceOfferings.find((service) => service.id === "shipping-insurance")!;
  return services.some((service) => service.id === insurance.id && service.description.ru === lockedInsuranceDescription)
    ? services.map((service) => service.id === insurance.id && service.description.ru === lockedInsuranceDescription ? insurance : service)
    : services;
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
  /** The Atlas markup on the Central Bank rate inside `fx` (1.012 = 1.2%), when the rate was the CBU one. For accounting. */
  fxMarkup: z.number().finite().min(1).max(1.2).optional(),
  margin: z.number().finite().min(0).max(1).optional(),
  reserveRate: z.number().finite().min(0).max(2).optional(),
  perKg: positive.optional(),
  /** Which international delivery the customer chose; quotes saved before 6 October 2026 are express. */
  deliverySpeed: deliverySpeedSchema.optional(),
  divisor: positive.optional(),
  sourceShipping: amount.optional(),
  /** Unknown store delivery, held separately: never part of `total` or the amount to pay (4 October 2026). */
  storeShippingHold: amount.optional(),
  buyout: amount.optional(),
  conversion: amount.optional(),
  deliveryMargin: amount.optional(),
  optionalServices: amount.optional(),
  /** "Atlas pays customs for me": `customsHelpRate` of this line's goods (`merchandise`), included in `total`. */
  customsHelp: amount.optional(),
  /** With "Atlas pays customs for me": this line's share of the estimated duty, prepaid in `total` (settled later). */
  customsDuty: amount.optional(),
  customsHelpRate: z.number().finite().min(0).max(0.2).optional(),
  /**
   * Checkout services priced as a percent of the parcel's goods (parcel insurance, since 10 October 2026): this
   * line's share — `rate` of its `merchandise` — included in `total`.
   */
  serviceFees: z.array(z.object({ id: z.string().min(2).max(80), amount, rate: z.number().finite().min(0).max(0.5) })).max(10).optional(),
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
  speed: DeliverySpeed = defaultDeliverySpeed,
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
    throw codedError("err_62", "Проверьте цену, вес и количество (от 1 до 10).");
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
    shippingBase = Math.ceil(billableUnitWeight * quantity * perKgSoumFor(config, speed)),
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
  speed: DeliverySpeed = defaultDeliverySpeed,
): Quote {
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    expiresAt: now + 15 * 60000,
    ...price(usd, weight, quantity, sourceShippingUsd, config, speed),
    deliverySpeed: speed,
    tariffVersion: config.version,
    fx: config.fx,
    ...(config.fxSource === "cbu" ? { fxMarkup: config.fxMarkup ?? 1.012 } : {}),
    margin: config.margin,
    buyoutFeeRate: config.buyoutFee,
    conversionFeeRate: config.conversionFee,
    deliveryMarginRate: config.deliveryMargin,
    reserveRate: config.reserve,
    perKg: perKgSoumFor(config, speed),
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
  /** Weighed as one store parcel (since 6 October 2026): the orders weighed together and the parcel's whole delivery. */
  parcelOrderIds: z.array(z.string().max(80)).max(500).optional(),
  parcelShipping: amount.optional(),
});
export type Settlement = z.infer<typeof settlementSchema>;
const storeShippingSettlementSchema = z.object({
  estimated: amount,
  actual: amount,
  actualUsd: z.number().finite().nonnegative(),
  refund: amount,
  extra: amount,
  /** The order had a separate hold (not paid with the order): `estimated` is the hold, `released` its unused part. */
  held: z.boolean().optional(),
  released: amount.optional(),
});
export type StoreShippingSettlement = z.infer<
  typeof storeShippingSettlementSchema
>;
/** The duty customs actually charged against the prepaid estimate: the rest back to the balance, more with consent. */
const customsSettlementSchema = z.object({
  estimated: amount,
  actual: amount,
  actualUsd: z.number().finite().nonnegative(),
  refund: amount,
  extra: amount,
  at: amount,
});
export type CustomsSettlement = z.infer<typeof customsSettlementSchema>;
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
    // The owner's minimum: a parcel is billed at least 1 kg, as it was quoted (combinedShipmentWeight).
    chargeableWeight = Math.max(1, w, dimensionalWeight),
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
/**
 * `text` stays the Russian line (operators, exports, older clients). Since 6 October 2026 customer-visible events also
 * carry `code` and `params` (soum amounts as numbers), and lib/market/history-copy.ts renders them in ru/uz/en.
 */
const historyParamsSchema = z.record(z.union([z.number(), z.string()]));
export type HistoryParams = z.infer<typeof historyParamsSchema>;
const historySchema = z.object({ at: amount, text: z.string(), code: z.string().max(60).optional(), params: historyParamsSchema.optional() });
export type HistoryEntry = z.infer<typeof historySchema>;
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
/**
 * Uzbekistan postal codes are six digits. Every new address needs one (owner's decision, 5.10.2026);
 * recipients and orders saved earlier may have none, so the stored schema keeps the field optional.
 */
export const isPostalCode = (value?: string) => /^\d{6}$/.test(value ?? "");
export function assertDeliveryAddress(delivery?: DeliveryProfile) {
  if (!delivery || delivery.address.trim().length < 5) throw codedError("err_60", "Укажите адрес доставки.");
  if (!isPostalCode(delivery.postalCode)) throw codedError("err_61", "Укажите почтовый индекс получателя: 6 цифр.");
}
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
/**
 * An extra invoice the operator issues on a paid order (since 10 October 2026), for example when a manually entered
 * item turned out dearer at the store. The customer sees "Доплатить" only while it is `pending`; paying records the
 * mark in Atlas like the order's own payment (no provider is connected, nothing is charged).
 */
const extraChargeSchema = z.object({
  id: z.string().min(1).max(40),
  amount: z.number().int().positive(),
  amountUsd: z.number().finite().positive().max(10000),
  reason: z.string().min(2).max(300),
  status: z.enum(["pending", "paid", "cancelled"]),
  requestedAt: amount,
  paidAt: amount.optional(),
  cancelledAt: amount.optional(),
});
export type ExtraCharge = z.infer<typeof extraChargeSchema>;
const warehouseServiceRequestSchema = z.object({
  id: z.string().min(1).max(100),
  serviceId: z.string().min(2).max(80),
  title: localizedTextSchema,
  description: localizedDescriptionSchema,
  unit: z.enum(["package", "item", "day", "photo", "half-hour"]),
  units: z.number().int().min(1).max(100),
  pricingMode: servicePricingModeSchema,
  feeUzs: amount.max(20_000_000).optional(),
  country: z.string().max(80).optional(),
  customerNote: z.string().trim().max(500).optional(),
  origin: z.enum(["checkout", "warehouse"]),
  status: z.enum(["requested", "quoted", "approved", "declined", "completed"]),
  requestedAt: amount,
  quotedAmount: amount.max(100_000_000).optional(),
  quoteChangeRequestId: z.string().max(100).optional(),
  completedAt: amount.optional(),
  /**
   * One request for a whole store parcel (since 7 October 2026): the orders of one checkout from one store and
   * country it covers, this one included. Kept on one order so the parcel is not charged once per size or color.
   */
  parcelOrderIds: z.array(z.string().max(80)).max(50).optional(),
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
/** One checkout's customs estimate for one recipient and calendar month (CM resolution No. 244). */
export const customsEstimateSchema = z.object({
  recipientKey: z.string().max(200),
  recipientName: z.string().max(100).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  allowanceUsd: z.number().finite().nonnegative(),
  atlasUsedUsd: z.number().finite().nonnegative(),
  outsideUsedUsd: z.number().finite().nonnegative().optional(),
  /** The customer used part of the allowance elsewhere but did not say how much: counted as fully used. */
  outsideUnknown: z.boolean().optional(),
  valueUsd: z.number().finite().nonnegative(),
  /** The cart's estimated weight, for the per-kg minimum of the duty (customsDutyUsd); estimates before 7.10.2026 have none. */
  weightKg: z.number().finite().nonnegative().optional(),
  dutiableUsd: z.number().finite().nonnegative(),
  rate: z.number().finite().min(0).max(1),
  minimumPerKg: z.number().finite().min(0),
  estimateUsd: z.number().finite().nonnegative(),
  helpRequested: z.boolean().optional(),
  helpFeeUsd: z.number().finite().nonnegative().optional(),
  checkedOn: z.string().max(20),
});
export type CustomsEstimate = z.infer<typeof customsEstimateSchema>;
/** The customer's customs choices in the cart: allowance used outside Atlas, and the "help pay customs" request. */
export const cartCustomsSchema = z.object({
  outsideUsed: z.boolean().default(false),
  outsideUsd: z.number().finite().min(0).max(100_000).optional(),
  help: z.boolean().default(false),
  /** "Remember for next orders" (owner, 7.10.2026): true saves `help` as the account's choice, false forgets it. */
  remember: z.boolean().optional(),
});
export type CartCustoms = z.infer<typeof cartCustomsSchema>;
/** Who pays customs in later carts, as the customer asked Atlas to remember it. */
export const customsPreferenceSchema = z.object({ help: z.boolean() });
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
  customsSettlement: customsSettlementSchema.optional(),
  customsExtraApproved: z.boolean().optional(),
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
  extraCharges: z.array(extraChargeSchema).max(20).optional(),
  warehouseServiceRequests: z.array(warehouseServiceRequestSchema).max(40).optional(),
  warehouseInspection: warehouseInspectionSchema.optional(),
  /** The customer's note from the cart line; for operators only, never sent to the store. */
  note: z.string().max(500).optional(),
  /** The customs estimate the customer saw at checkout for this recipient and month (informational). */
  customs: customsEstimateSchema.optional(),
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
  code: z.string().max(60).optional(),
  params: historyParamsSchema.optional(),
});
export type Notification = z.infer<typeof notificationSchema>;
export const communicationSchema = z.object({
  emailEnabled: z.boolean().default(false),
  smsEnabled: z.boolean().default(false),
  email: z.string().trim().email().or(z.literal("")),
  phone: z.string().trim().max(30),
  language: z.enum(["ru", "uz", "en", "oz"]).default("ru"),
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
  /** The store's price (or stated delivery) changed since the item was added; the server updated it and repriced. */
  // Store prices keep their cents (12.79 USD), unlike soum amounts.
  priceChange: z.object({
    previousPrice: storeAmount, price: storeAmount, currency: z.string().max(8),
    previousShipping: storeAmount.optional(), shipping: storeAmount.optional(), at: amount,
  }).optional(),
  /** The last live check could not confirm the item. Only "unreachable" with a recent earlier check lets checkout go on. */
  sourceIssue: z.object({ kind: z.enum(["currency", "variant", "price", "unreachable", "stock"]), at: amount }).optional(),
  /** International delivery speed for this line; lines saved before 6 October 2026 are express. */
  deliverySpeed: deliverySpeedSchema.optional(),
  /** The customer's note for Atlas about this item; kept through repricing, shown to operators, never sent to the store. */
  note: z.string().trim().max(500).optional(),
  /** `false`: left in the cart for later, outside the next checkout and its parcel prices (owner, 7.10.2026). Absent = chosen. */
  selected: z.boolean().optional(),
});
export type CartItem = z.infer<typeof cartSchema>;
/** The line goes into the next checkout: everything the customer did not leave for later. */
export const inCheckout = (item: Pick<CartItem, "selected">) => item.selected !== false;
/** The lines of the next checkout, in cart order. */
export const checkoutLines = <T extends Pick<CartItem, "selected">>(cart: T[]) => cart.filter(inCheckout);
export type SourceIssueKind = NonNullable<CartItem["sourceIssue"]>["kind"];
/** Problems the customer has to resolve (reload the product); an unreachable store after a recent check is not one. */
export const blockingSourceIssue = (item: Pick<CartItem, "sourceIssue">) => Boolean(item.sourceIssue && item.sourceIssue.kind !== "unreachable");

function buildServiceRequest(
  service: ServiceOffering,
  country: string | undefined,
  units: number,
  origin: WarehouseServiceRequest["origin"],
  now: number,
  customerNote?: string,
  /**
   * A value-percent service (insurance) is paid with the order: recorded as done at that amount, so there is
   * nothing to quote and it never holds the parcel back from weighing (assertReadyToWeigh).
   */
  paidAmount?: number,
): WarehouseServiceRequest {
  return warehouseServiceRequestSchema.parse({
    ...(paidAmount !== undefined ? { status: "completed", quotedAmount: paidAmount, completedAt: now } : { status: "requested" }),
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
    if (!selected.includes(required.id)) throw codedError("err_64", "Выберите обязательные услуги перед оформлением.");
  }
  return {
    ...state,
    // Insurance and other value-percent services are in the line totals: their fees follow the choice at once.
    cart: withValueServiceFees(state.cart.map((candidate) => candidate.id === id ? {
      ...candidate,
      requestedServiceIds: selected,
      requestedServiceUnits: Object.fromEntries(Object.entries(serviceUnits).filter(([serviceId]) => selected.includes(serviceId))),
    } : candidate), config),
  };
}

/**
 * The checkout services a line can carry now: services switched off since are dropped, required ones added, and
 * units kept only for counted services (photos, days). Done on the server when the cart is renewed, so the cart
 * page no longer sends a fix-up request of its own per line.
 */
function currentCartServices(item: Partial<Pick<CartItem, "requestedServiceIds" | "requestedServiceUnits">>, config: Pricing) {
  const allowed = config.serviceCatalog.filter((service) => service.enabled && service.requestStage === "checkout");
  const kept = (item.requestedServiceIds ?? []).filter((serviceId) => allowed.some((service) => service.id === serviceId));
  const requestedServiceIds = [...kept, ...allowed.filter((service) => service.required && !kept.includes(service.id)).map((service) => service.id)];
  const requestedServiceUnits = Object.fromEntries(Object.entries(item.requestedServiceUnits ?? {}).filter(([serviceId]) =>
    requestedServiceIds.includes(serviceId) && allowed.some((service) => service.id === serviceId && !["package", "item"].includes(service.unit))));
  return { requestedServiceIds, requestedServiceUnits };
}

/**
 * How many units one store parcel's request for a checkout service covers (owner, 7.10.2026): a package service
 * once per parcel, an item service once per piece, a counted one (photos, days) as the customer typed it. The
 * lines are one parcel's lines; three sizes of one model never make the parcel service count three times.
 */
export function parcelServiceUnits(service: Pick<ServiceOffering, "id" | "unit">, lines: Pick<CartItem, "quantity" | "requestedServiceUnits">[]) {
  if (service.unit === "package") return 1;
  if (service.unit === "item") return Math.min(100, Math.max(1, lines.reduce((sum, line) => sum + line.quantity, 0)));
  return Math.min(100, Math.max(1, ...lines.map((line) => line.requestedServiceUnits?.[service.id] ?? 0)));
}

/** Cart lines by store parcel (one store shipping from one country), in cart order. */
export function storeParcels<T extends Pick<CartItem, "id" | "product">>(items: T[]) {
  const parcels: { key: string; items: T[] }[] = [];
  for (const item of items) {
    const key = storeParcelKey(item);
    const parcel = parcels.find((entry) => entry.key === key);
    if (parcel) parcel.items.push(item);
    else parcels.push({ key, items: [item] });
  }
  return parcels;
}

/** A cart line's value-percent service fees (parcel insurance), soum. */
export const serviceFeesOf = (q: Pick<Quote, "serviceFees">) => (q.serviceFees ?? []).reduce((sum, fee) => sum + fee.amount, 0);
/** The goods value of one store parcel in USD, as value-percent services see it (no delivery, no fees). */
export const parcelValueUsd = (lines: Pick<CartItem, "product" | "quantity">[]) =>
  Math.round(lines.reduce((sum, line) => sum + line.product.usd * line.quantity, 0) * 100) / 100;
/**
 * Each line's value-percent fees (owner, 10.10.2026: insurance 2% of the parcel, 3% above $200). A store parcel
 * takes the service when any of its lines chose it; the rate follows the whole parcel's goods value and each line
 * pays that rate on its own goods. Lines left for later make their own parcel, as in delivery (repriceCart).
 */
export function valueServiceFees<T extends Pick<CartItem, "id" | "product" | "quantity" | "requestedServiceIds" | "selected"> & { quote: Pick<Quote, "merchandise"> }>(items: T[], config: Pricing) {
  const services = config.serviceCatalog.filter((service) => service.enabled && service.requestStage === "checkout" && service.pricingMode === "value-percent");
  const fees = new Map<string, NonNullable<Quote["serviceFees"]>>();
  if (!services.length) return fees;
  const parcels = new Map<string, T[]>();
  for (const item of items) {
    const key = storeParcelKey(item) + (inCheckout(item) ? "" : ":later");
    parcels.set(key, [...(parcels.get(key) ?? []), item]);
  }
  for (const lines of parcels.values()) {
    const value = parcelValueUsd(lines);
    for (const service of services) {
      if (!lines.some((line) => (line.requestedServiceIds ?? []).includes(service.id))) continue;
      const rate = valueServiceRate(service, value);
      for (const line of lines) fees.set(line.id, [...(fees.get(line.id) ?? []), { id: service.id, amount: Math.round(line.quote.merchandise * rate), rate }]);
    }
  }
  return fees;
}
/** The lines with their value-percent fees put in (old ones taken out of the total first). */
export function withValueServiceFees<T extends CartItem>(items: T[], config: Pricing): T[] {
  const fees = valueServiceFees(items, config);
  return items.map((item) => {
    const next = fees.get(item.id);
    if (!next && !item.quote.serviceFees) return item;
    const total = item.quote.total - serviceFeesOf(item.quote) + (next ?? []).reduce((sum, fee) => sum + fee.amount, 0);
    return { ...item, quote: { ...item.quote, serviceFees: next, total } };
  });
}
/** A warehouse service's name in every language, for coded history and notifications. */
const serviceParams = (service: Pick<ServiceOffering, "id" | "title"> | WarehouseServiceRequest): HistoryParams => ({
  service: "serviceId" in service ? service.serviceId : service.id,
  titleRu: service.title.ru, titleUz: service.title.uz, titleEn: service.title.en,
});
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
  const active = (request: WarehouseServiceRequest) => request.serviceId === serviceId && ["requested", "quoted", "approved"].includes(request.status);
  if (previous.some(active))
    throw Error("Эта услуга уже запрошена для заказа.");
  // A parcel service covers every order of the same checkout and store parcel: asked on a sibling, it is not asked again.
  const parcelOrderIds = service.unit !== "package" || !order.batchId ? [] : state.orders
    .filter((other) => other.batchId === order.batchId && !other.cancelled && storeParcelKey(other) === storeParcelKey(order))
    .map((other) => other.id);
  if (state.orders.some((other) => other.id !== id && (other.warehouseServiceRequests ?? []).some((request) => active(request) && request.parcelOrderIds?.includes(id))))
    throw Error("Эта услуга уже запрошена для посылки этого магазина.");
  const count = service.unit === "package" ? 1 : service.unit === "item" ? order.quantity : units;
  if (!Number.isInteger(count) || count < 1 || count > 100) throw Error("Проверьте количество услуги.");
  const request = {
    ...buildServiceRequest(service, order.product.country, count, "warehouse", now, note),
    ...(parcelOrderIds.length > 1 ? { parcelOrderIds } : {}),
  };
  return withNotification(replace(state, {
    ...order,
    warehouseServiceRequests: [...previous, request],
    history: [...order.history, { at: now, text: `Клиент запросил услугу склада «${service.title.ru}»; оператор проверит выполнимость и отправит стоимость на согласование.`, code: "service-requested", params: serviceParams(service) }],
  }), "Запрос передан оператору", `${service.title.ru}. Цена и возможность будут подтверждены до выполнения.`, id, now, { code: "service-requested", params: serviceParams(service) });
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
    history: [...order.history, { at: now, text: `Склад отметил услугу «${request.title.ru}» выполненной.`, code: "service-done", params: serviceParams(request) }],
  }), "Услуга выполнена", request.title.ru, id, now, { code: "service-done", params: serviceParams(request) });
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
    history: [...order.history, { at: now, text: `Оператор отклонил услугу «${request.title.ru}»: ${note}`, code: "service-declined", params: { ...serviceParams(request), reason: note } }],
  }), "Услуга недоступна", `${request.title.ru}: ${note}`, id, now, { code: "service-declined", params: { ...serviceParams(request), reason: note } });
}

/** One store order: the same store host shipping from the same country. */
export function storeParcelKey(item: Pick<CartItem, "id" | "product">) {
  if (!item.product.sourceUrl) return `item:${item.id}`;
  try {
    const host = new URL(item.product.sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
    return `store:${host}:${item.product.country ?? ""}`;
  } catch {
    return `item:${item.id}`;
  }
}

/** One international shipment: a store order whose items all have a boxed weight. */
export function merchantParcelKey(item: CartItem) {
  return item.product.boxedWeight === undefined ? `item:${item.id}` : storeParcelKey(item);
}

/**
 * Store delivery charged in the quote: only an amount the store states. Unknown delivery is never
 * charged: it is free above `storeShippingFreeFromUsd` of items from that store, else held separately
 * (storeShippingHoldUsd). A store that still charges is settled by confirmStoreShipping with consent.
 */
/** The hold a link order starts with when the store does not state its delivery (USD, editable by the customer). */
export const unknownStoreShippingUsd = 10;
export function storeShippingUsd(product: Pick<Product, "sourceShippingUsd" | "sourceShippingEstimated">) {
  return product.sourceShippingEstimated ? 0 : product.sourceShippingUsd ?? 0;
}
/** Unknown store delivery is free when items from that store cost strictly more than the threshold ($50). */
export function storeShippingFree(product: Pick<Product, "sourceShippingEstimated">, storeSubtotalUsd: number, config: Pricing = tariff) {
  return Boolean(product.sourceShippingEstimated) && storeSubtotalUsd > (config.storeShippingFreeFromUsd ?? tariff.storeShippingFreeFromUsd);
}
/** The preliminary hold for unknown store delivery (USD): outside the total and the amount to pay. */
export function storeShippingHoldUsd(product: Pick<Product, "sourceShippingUsd" | "sourceShippingEstimated">, storeSubtotalUsd: number, config: Pricing = tariff) {
  return product.sourceShippingEstimated && !storeShippingFree(product, storeSubtotalUsd, config) ? product.sourceShippingUsd ?? 0 : 0;
}

/**
 * Unknown store delivery per store order in the cart: one hold up to the threshold, free above it. Lines left for
 * later form their own store order, so the one being checked out is held (or free) for what it holds.
 */
export function storeShippingReserves(items: CartItem[], config: Pricing = tariff) {
  const groups = new Map<string, CartItem[]>();
  for (const item of items) {
    const key = storeParcelKey(item) + (inCheckout(item) ? "" : ":later");
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups].flatMap(([key, group]) => {
    const estimated = group.filter((item) => item.product.sourceShippingEstimated);
    if (!estimated.length) return [];
    const subtotalUsd = Math.round(group.reduce((sum, item) => sum + item.product.usd * item.quantity, 0) * 100) / 100;
    const freeFromUsd = config.storeShippingFreeFromUsd ?? tariff.storeShippingFreeFromUsd;
    const reserveUsd = Math.max(...estimated.map((item) => storeShippingHoldUsd(item.product, subtotalUsd, config)));
    // "Free above $50": the smallest addition that makes the subtotal strictly greater.
    const missingUsd = reserveUsd > 0 ? Math.max(0.01, Math.round((freeFromUsd - subtotalUsd + 0.01) * 100) / 100) : 0;
    return [{ key, itemIds: estimated.map((item) => item.id), subtotalUsd, reserveUsd, freeFromUsd, missingUsd, free: reserveUsd === 0 }];
  });
}

/**
 * Whether this cart's lines carry the "Atlas pays customs for me" fee: the choice made in this cart, else the one the
 * customer asked to remember. The fee is charged only when there is duty to pay (`withCustomsHelpFor`).
 */
export const customsHelpChosen = (state: Pick<State, "cartCustoms" | "customsPreference">) =>
  state.cartCustoms ? Boolean(state.cartCustoms.help) : Boolean(state.customsPreference?.help);
/** The estimated duty in soum, rounded up as it is prepaid with the order. */
export const customsDutySoum = (estimate: Pick<CustomsEstimate, "estimateUsd">, fx: number) => Math.ceil(estimate.estimateUsd * fx);
/** Cart lines without the customs payment fee. */
export function withoutCustomsHelp<T extends { quote: Quote }>(items: T[]): T[] {
  return items.map((item) => item.quote.customsHelp === undefined ? item : {
    ...item,
    quote: { ...item.quote, total: item.quote.total - item.quote.customsHelp, customsHelp: undefined, customsHelpRate: undefined },
  });
}
/**
 * The lines as billed for one recipient (owner, 7.10.2026): with no duty to pay there is nothing for Atlas to pay,
 * so the fee comes off even when the customer chose "Atlas pays customs".
 */
export const withCustomsHelpFor = <T extends { quote: Quote }>(items: T[], estimate: Pick<CustomsEstimate, "estimateUsd"> | undefined, fx: number) =>
  estimate && customsDutySoum(estimate, fx) > 0 ? items : withoutCustomsHelp(items);
/** The customer picks express or standard delivery for the whole cart; every line is requoted at that rate. */
export function setCartDeliverySpeed(state: State, speed: DeliverySpeed, now = Date.now(), config: Pricing = tariff): State {
  if (!deliverySpeeds.includes(speed)) throw Error("Выберите экспресс или обычную доставку.");
  if (!state.cart.length) throw Error("Корзина пуста.");
  return { ...state, cart: repriceCart(state.cart.map((item) => ({ ...item, deliverySpeed: speed })), now, config, customsHelpChosen(state)) };
}
/** The speed the cart is quoted at (all lines share it); an older cart without the field is express. */
export function cartDeliverySpeed(cart: Pick<CartItem, "deliverySpeed">[]): DeliverySpeed {
  return cart.find((item) => item.deliverySpeed)?.deliverySpeed ?? defaultDeliverySpeed;
}
/**
 * Recalculate international delivery once per merchant parcel, and unknown store delivery once per store order.
 * With `customsHelp`, every line also carries the customs payment fee on the rest of its total.
 */
export function repriceCart(items: CartItem[], now = Date.now(), config: Pricing = tariff, customsHelp = false) {
  const next = items.map((item) => {
    const itemPricing = pricingForCountry(config, item.product.country);
    return {
      ...item,
      quote: quote(
        item.product.usd,
        item.product.weight,
        now,
        item.quantity,
        storeShippingUsd(item.product),
        itemPricing,
        item.deliverySpeed ?? defaultDeliverySpeed,
      ),
    };
  });
  const groups = new Map<string, number[]>();
  next.forEach((item, index) => {
    if (!item.product.sourceUrl || item.product.boxedWeight === undefined) return;
    // The lines left for later make their own parcel: the one being checked out is priced for what it holds.
    const key = merchantParcelKey(item) + (inCheckout(item) ? "" : ":later");
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  for (const indexes of groups.values()) {
    const contributions = indexes.map((index) => next[index].product.boxedWeight! * next[index].quantity);
    const boxedTotal = contributions.reduce((sum, value) => sum + value, 0);
    const chargeableWeight = combinedShipmentWeight(boxedTotal);
    const countryPricing = pricingForCountry(config, next[indexes[0]].product.country);
    const shippingTotal = Math.ceil(chargeableWeight * perKgSoumFor(countryPricing, next[indexes[0]].deliverySpeed ?? defaultDeliverySpeed));
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
  // The hold is split by merchandise across that store's lines for display and order snapshots; the totals stay without it.
  for (const parcel of storeShippingReserves(next, config)) {
    const indexes = parcel.itemIds.map((id) => next.findIndex((item) => item.id === id));
    const holdTotal = Math.ceil(parcel.reserveUsd * config.fx);
    const merchandiseTotal = indexes.reduce((sum, index) => sum + next[index].quote.merchandise, 0);
    let left = holdTotal;
    indexes.forEach((index, position) => {
      const item = next[index];
      const share = merchandiseTotal ? item.quote.merchandise / merchandiseTotal : 1 / indexes.length;
      const storeShippingHold = position === indexes.length - 1 ? left : Math.min(left, Math.round(holdTotal * share));
      left -= storeShippingHold;
      item.quote = { ...item.quote, storeShippingHold };
    });
  }
  if (customsHelp) {
    const rate = config.customsHelpFee ?? customsHelpShare;
    for (const item of next) {
      const fee = Math.round(item.quote.merchandise * rate);
      item.quote = { ...item.quote, customsHelp: fee, customsHelpRate: rate, total: item.quote.total + fee };
    }
  }
  return withValueServiceFees(next, config);
}
/** The separate hold for unknown store delivery across cart lines (soum); never part of the amount to pay. */
export const holdOf = (items: { quote: Pick<Quote, "storeShippingHold"> }[]) =>
  items.reduce((sum, item) => sum + (item.quote.storeShippingHold ?? 0), 0);
/** The legal documents a customer consents to (lib/market/account-delete.ts holds the current version). */
export const consentKeys = ["privacy", "terms"] as const;
export const consentKeySchema = z.enum(consentKeys);
const consentSchema = z.object({ key: consentKeySchema, version: z.string().min(1).max(40), acceptedAt: amount });
export type Consent = z.infer<typeof consentSchema>;
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
  cartCustoms: cartCustomsSchema.optional(),
  /** Who pays customs, remembered from an earlier cart; used while the current cart has no choice of its own. */
  customsPreference: customsPreferenceSchema.optional(),
  /** Data-processing consents (privacy policy, terms of use): one entry per document, latest version wins. Absent in older documents. */
  consents: z.array(consentSchema).max(10).optional(),
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
  coded?: { code: string; params?: HistoryParams },
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
      { id: crypto.randomUUID(), at: now, title, message, read: false, orderId, ...(coded ? { code: coded.code, ...(coded.params ? { params: coded.params } : {}) } : {}) },
      ...state.notifications,
    ].slice(0, 80),
    messageDeliveries: [...deliveries, ...state.messageDeliveries].slice(0, 120),
  };
};
export const markNotificationsRead = (state: State): State => ({
  ...state,
  notifications: state.notifications.map((item) => ({ ...item, read: true })),
});
/**
 * Records consent to the given documents at `version`: one entry per document, a newer acceptance of the
 * same document replaces the older one. Accepting a version already held changes nothing (same state object).
 */
export function acceptConsents(state: State, documents: readonly Consent["key"][], version: string, now = Date.now()): State {
  const keys = [...new Set(documents)];
  const current = state.consents ?? [];
  if (keys.every((key) => current.some((item) => item.key === key && item.version === version))) return state;
  const kept = current.filter((item) => !keys.includes(item.key));
  const added = keys.map((key) => ({ key, version, acceptedAt: now }));
  return { ...state, consents: [...kept, ...added].slice(-10) };
}
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
  // An order for a saved recipient takes only that recipient's passport: never the last confirmed one or another person's.
  // Orders without a saved recipient (older ones, or a typed address) keep the earlier fallback.
  const recipientId = first.deliveryProfileId;
  const identity = recipientId
    ? (first.identity && (!first.identity.recipientProfileId || first.identity.recipientProfileId === recipientId) ? first.identity : undefined)
      ?? profiles.find((profile) => profile.recipientProfileId === recipientId)
    : first.identity ?? profiles.find((profile) => profile.recipientProfileId === undefined) ?? state.identityProfile;
  const delivery = first.delivery ?? (first.deliveryProfileId ? state.deliveryProfiles.find((profile) => profile.id === first.deliveryProfileId) : undefined) ?? state.deliveryProfile;
  if (!identity && recipientId) throw codedError("err_66", "Сначала подтвердите паспорт этого получателя.");
  if (!identity) throw Error("Сначала подтвердите паспортные данные получателя.");
  if (!delivery) throw codedError("err_65", "Сначала сохраните адрес доставки.");
  const lines = selected.map((order) => ({ orderId: order.id, description: order.product.declarationDescription ?? order.product.name, country: order.product.country ?? "Не указана", quantity: order.quantity, value: order.quote.merchandise }));
  const declaration: Declaration = { id: "DEC-" + crypto.randomUUID().slice(0, 8).toUpperCase(), createdAt: now, status: "submitted-preview", identity, delivery, orderIds: selected.map((order) => order.id), lines, totalValue: lines.reduce((sum, line) => sum + line.value, 0) };
  return withNotification({ ...state, declarations: [declaration, ...state.declarations].slice(0, 20) }, "Черновик декларации подготовлен", `Пакет ${declaration.id} сохранён внутри Atlas. В таможню он не отправлялся.`, undefined, now, { code: "declaration-saved", params: { declaration: declaration.id } });
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
/** Extra invoices the customer paid (marked in Atlas); a pending one is not part of the order sum yet. */
export const paidExtraCharges = (order: Pick<Order, "extraCharges">) =>
  (order.extraCharges ?? []).filter((charge) => charge.status === "paid").reduce((sum, charge) => sum + charge.amount, 0);
export const pendingExtraCharge = (order: Pick<Order, "extraCharges" | "cancelled">) =>
  order.cancelled ? undefined : (order.extraCharges ?? []).find((charge) => charge.status === "pending");
export const orderPayable = (order: Order) =>
  Math.max(0, order.quote.total + approvedAdjustments(order) + paidExtraCharges(order));
export const orderNeedsOperatorAttention = (order: Order) =>
  Boolean(order.issueCase && order.issueCase.status !== "resolved") ||
  (!order.cancelled && (
    Boolean(order.settlement?.extra && !order.extraApproved) ||
    Boolean(order.storeShippingSettlement?.extra && !order.storeShippingExtraApproved) ||
    Boolean(order.customsSettlement?.extra && !order.customsExtraApproved) ||
    (order.changeRequests ?? []).some((request) => request.status === "pending") ||
    Boolean(pendingExtraCharge(order)) ||
    order.warehouseInspection?.condition === "damaged" ||
    order.warehouseInspection?.condition === "mismatch"
  ));
/** One model in the cart: the sizes or colors of one store item (one link, one name), or one catalog product. */
export const cartModelKey = (product: Pick<Product, "id" | "name" | "sourceUrl">) => product.sourceUrl ? `${product.sourceUrl}\n${product.name}` : product.id;
export function addToCart(
  state: State,
  p: Product,
  variant: string,
  now = Date.now(),
  config: Pricing = tariff,
  quantity = 1,
  note?: string,
): State {
  if (!p.variants.includes(variant)) throw Error("Выберите вариант товара.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw codedError("err_63", "Количество — от 1 до 10.");
  const comment = note?.trim().slice(0, 500) || undefined;
  const item = state.cart.find(
    (i) => i.product.id === p.id && i.variant === variant,
  );
  if (item) {
    // The same option again adds to that line (with the fresh store data) and keeps its note unless a new one is given.
    const merged = { ...state, cart: state.cart.map((i) => i.id === item.id ? { ...i, product: p, note: comment ?? i.note } : i) };
    return changeQuantity(merged, item.id, item.quantity + quantity, now, config);
  }
  if (quantity > maxLineQuantity(p)) throw Error(`В магазине осталось ${p.stockQuantity} шт. этого варианта.`);
  const itemPricing = pricingForCountry(config, p.country);
  // A new line travels at the speed the cart already has (all lines share one choice).
  const speed = cartDeliverySpeed(state.cart);
  // Warehouse services are chosen per store parcel: a new line joins the services its parcel already has.
  const id = crypto.randomUUID();
  const sibling = state.cart.find((line) => storeParcelKey(line) === storeParcelKey({ id, product: p }));
  const services = currentCartServices(sibling ?? {}, config);
  const cart = [
    ...state.cart,
    {
      id,
      product: p,
      variant,
      quantity,
      deliverySpeed: speed,
      requestedServiceIds: services.requestedServiceIds,
      ...(Object.keys(services.requestedServiceUnits).length ? { requestedServiceUnits: services.requestedServiceUnits } : {}),
      quote: quote(p.usd, p.weight, now, quantity, storeShippingUsd(p), itemPricing, speed),
      ...(comment ? { note: comment } : {}),
    },
  ];
  return { ...state, cart: repriceCart(cart, now, config, customsHelpChosen(state))};
}
/**
 * Chooses which lines go into the next checkout (owner, 7.10.2026). The rest stay in the cart; the cart is priced
 * again, so the parcel being checked out carries the delivery, minimum weight and store reserve of what it holds.
 */
export function setCartSelection(state: State, ids: string[], selected: boolean, now = Date.now(), config: Pricing = tariff): State {
  const chosen = new Set(ids);
  if (!chosen.size || [...chosen].some((id) => !state.cart.some((item) => item.id === id)))
    throw Error("Товар уже удалён из корзины. Обновите страницу.");
  if (state.cart.every((item) => !chosen.has(item.id) || inCheckout(item) === selected)) return state;
  const cart = state.cart.map((item) => chosen.has(item.id) ? { ...item, selected: selected ? undefined : false } : item);
  return { ...state, cart: repriceCart(cart, now, config, customsHelpChosen(state)) };
}
/** The customer's note on a cart line; an empty text removes it. */
export function setCartNote(state: State, id: string, note: string): State {
  if (!state.cart.some((item) => item.id === id)) throw Error("Товар уже удалён из корзины.");
  const comment = note.trim().slice(0, 500);
  return { ...state, cart: state.cart.map((item) => item.id === id ? { ...item, note: comment || undefined } : item) };
}
/** Customs choices for this cart; "Atlas pays customs for me" adds or removes its fee in every line at once. */
export function setCartCustoms(state: State, value: CartCustoms, now = Date.now(), config: Pricing = tariff): State {
  const { remember, ...checked } = cartCustomsSchema.parse(value);
  const customsPreference = remember === true ? { help: checked.help } : remember === false ? undefined : state.customsPreference;
  const next = { ...state, customsPreference, cartCustoms: { ...checked, outsideUsd: checked.outsideUsed ? checked.outsideUsd : undefined } };
  return checked.help === customsHelpChosen(state) ? next : renewCart(next, now, config);
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
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw codedError("err_63", "Количество — от 1 до 10.");
  // Only a stock count the store itself reported limits the quantity; an unknown stock does not.
  if (quantity > maxLineQuantity(item.product)) throw Error(`В магазине осталось ${item.product.stockQuantity} шт. этого варианта.`);
  const itemPricing = pricingForCountry(config, item.product.country);
  return {
    ...state,
    cart: repriceCart(state.cart.map((i) =>
      i.id === id
        ? {
            ...i,
            quantity,
            // Lowering the quantity to what the store has left resolves a stock mark.
            sourceIssue: i.sourceIssue?.kind === "stock" ? undefined : i.sourceIssue,
            quote: quote(
              i.product.usd,
              i.product.weight,
              now,
              quantity,
              storeShippingUsd(i.product),
              itemPricing,
            ),
          }
        : i,
    ), now, config, customsHelpChosen(state)),
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
      // The services follow the current catalog (one switched off is dropped, a required one added).
      ...currentCartServices(i, config),
      quote: quote(
        i.product.usd,
        i.product.weight,
        now,
        i.quantity,
        storeShippingUsd(i.product),
        pricingForCountry(config, i.product.country),
      ),
    })), now, config, customsHelpChosen(state)),
  };
}
export const cartSignature = (items: CartItem[]) =>
  items.map((i) => {
    const services = [...(i.requestedServiceIds ?? [])].sort().map((serviceId) =>
      `${serviceId}:${i.requestedServiceUnits?.[serviceId] ?? 1}`,
    ).join(",");
    return i.id + ":" + i.quote.id + ":" + services;
  }).join("|");
/** What the live store check said about this item, kept in the order history. */
function sourceCheckHistory(item: CartItem, now: number) {
  const notes: HistoryEntry[] = [];
  const change = item.priceChange;
  if (change && change.previousPrice !== change.price)
    notes.push({ at: now, text: `Цена в магазине изменилась до оформления: ${change.previousPrice} → ${change.price} ${change.currency}. Покупатель оформил заказ по новому расчёту.`, code: "source-price-changed", params: { from: change.previousPrice, to: change.price, currency: change.currency } });
  if (change?.shipping !== undefined && change.previousShipping !== change.shipping)
    notes.push({ at: now, text: `Доставка магазина изменилась до оформления: ${change.previousShipping ?? 0} → ${change.shipping} ${item.product.sourceShippingCurrency ?? change.currency}.`, code: "source-shipping-changed", params: { from: change.previousShipping ?? 0, to: change.shipping, currency: item.product.sourceShippingCurrency ?? change.currency } });
  if (item.sourceIssue?.kind === "unreachable")
    notes.push({ at: now, text: "Магазин не ответил при оформлении; цена была сверена незадолго до этого. Оператор сверит её перед выкупом.", code: "source-unreachable" });
  else if (item.product.sourceCheckedAt && now - item.product.sourceCheckedAt <= 10 * 60_000)
    notes.push({ at: now, text: "Цена и вариант сверены с магазином перед оформлением.", code: "source-checked" });
  return notes;
}

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
  customs?: CustomsEstimate,
  expectedCustomsDuty?: number,
): State {
  if (state.checkoutKeys.includes(key)) return state;
  if (!state.cart.length) throw Error("Корзина пуста.");
  // Only the chosen lines are ordered; the ones left for later stay in the cart (owner, 7.10.2026).
  const lines = checkoutLines(state.cart);
  if (!lines.length) throw codedError("err_74", "Выберите товары для оформления.");
  if (consentVersion !== customsVersion)
    throw Error("Подтвердите таможенные условия.");
  if (
    lines.some(
      (i) => i.product.sourceUrl && i.product.shippingKnown !== true,
    )
  )
    throw Error(
      "Уточните стоимость доставки магазина для каждого товара по ссылке.",
    );
  if (cartSignature(state.cart) !== signature)
    throw Error("Корзина изменилась. Проверьте новый итог перед оформлением.");
  const availableServices = config.serviceCatalog.filter((service) => service.enabled && service.requestStage === "checkout");
  for (const item of lines) {
    const selected = item.requestedServiceIds ?? [];
    if (selected.some((serviceId) => !availableServices.some((service) => service.id === serviceId)))
      throw Error("Одна из выбранных услуг больше недоступна. Обновите корзину.");
    if (Object.entries(item.requestedServiceUnits ?? {}).some(([serviceId, units]) => {
      const service = availableServices.find((candidate) => candidate.id === serviceId);
      return !selected.includes(serviceId) || !service || ["package", "item"].includes(service.unit) || !Number.isInteger(units) || units < 1 || units > 100;
    })) throw Error("Количество дополнительной услуги изменилось. Проверьте корзину заново.");
    if (availableServices.some((service) => service.required && !selected.includes(service.id)))
      throw codedError("err_64", "Выберите обязательные услуги перед оформлением.");
  }
  if (lines.some((i) => now >= i.quote.expiresAt))
    throw codedError("err_75", "Расчёт истёк. Обновите его перед оформлением.");
  // A quote made before the operator changed the tariff must be shown again, not accepted silently.
  if (lines.some((i) => i.quote.tariffVersion !== config.version))
    throw codedError("err_76", "Тарифы Atlas обновились. Проверьте новый итог перед оформлением.");
  if (lines.some(blockingSourceIssue))
    throw Error("Магазин изменил данные товара. Загрузите отмеченные товары заново.");
  // The customs payment fee is in the bill exactly when the customer chose it; the server reprices on every change.
  if (lines.some((i) => Boolean(i.quote.customsHelp) !== customsHelpChosen(state)))
    throw Error("Корзина пересчитана. Проверьте новый итог перед оформлением.");
  // "Atlas pays customs for me": the duty estimated for this recipient is prepaid with the order, split by goods value.
  // The customer saw this amount on the confirmation step; a different one means the recipient or the month changed.
  // Insurance is in the line totals; a line priced before the choice or the catalog changed is shown again.
  const expectedFees = valueServiceFees(lines, config);
  if (lines.some((i) => serviceFeesOf(i.quote) !== serviceFeesOf({ serviceFees: expectedFees.get(i.id) })))
    throw Error("Корзина пересчитана. Проверьте новый итог перед оформлением.");
  const dutyTotal = customsHelpChosen(state) && customs ? customsDutySoum(customs, config.fx) : 0;
  if (customsHelpChosen(state) && (expectedCustomsDuty ?? 0) !== dutyTotal)
    throw codedError("err_77", "Пошлина пересчитана для выбранного получателя. Проверьте итог перед оформлением.");
  const merchandiseTotal = lines.reduce((sum, i) => sum + i.quote.merchandise, 0);
  let dutyLeft = dutyTotal;
  // No duty for this recipient: no fee either (owner, 7.10.2026).
  const cart = !dutyTotal ? withoutCustomsHelp(lines) : lines.map((i, index, items) => {
    const duty = index === items.length - 1 ? dutyLeft : Math.min(dutyLeft, Math.round(dutyTotal * (merchandiseTotal ? i.quote.merchandise / merchandiseTotal : 1 / items.length)));
    dutyLeft -= duty;
    return { ...i, quote: { ...i.quote, customsDuty: duty, total: i.quote.total + duty } };
  });
  const overStock = lines.find((i) => i.quantity > maxLineQuantity(i.product));
  if (overStock) throw Error(`В магазине осталось ${overStock.product.stockQuantity} шт. «${overStock.product.name}». Уменьшите количество.`);
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
  // 48 random bits: order numbers are global across customers, so 8 hex digits would start to collide.
  const orderIds = cart.map(() => "AT-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase());
  const paymentId = "PAY-" + crypto.randomUUID().slice(0, 8).toUpperCase();
  // Checkout services are asked once per store parcel, on its first order, for every order of that parcel
  // (owner, 7.10.2026): three sizes of one model no longer make three requests for one "contents photo".
  const parcelRequests = new Map<string, WarehouseServiceRequest[]>();
  for (const parcel of storeParcels(cart)) {
    const chosen = availableServices.filter((service) => parcel.items.some((line) => (line.requestedServiceIds ?? []).includes(service.id)));
    const ids = parcel.items.map((line) => orderIds[cart.indexOf(line)]);
    // A value-percent service (insurance) was paid with the order: the request records the amount, nothing to quote.
    const paid = (service: ServiceOffering) => service.pricingMode === "value-percent"
      ? parcel.items.reduce((sum, line) => sum + (line.quote.serviceFees ?? []).filter((fee) => fee.id === service.id).reduce((total, fee) => total + fee.amount, 0), 0)
      : undefined;
    parcelRequests.set(ids[0], chosen.map((service) => ({
      ...buildServiceRequest(service, parcel.items[0].product.country, parcelServiceUnits(service, parcel.items), "checkout", now, undefined, paid(service)),
      ...(ids.length > 1 ? { parcelOrderIds: ids } : {}),
    })));
  }
  const orders = cart.map((i, index) => {
    const id = orderIds[index];
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
    const serviceRequests = parcelRequests.get(id) ?? [];
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
        // One payment for the whole checkout: every line carries the same id with its own share.
        id: paymentId,
        status: payable === 0 ? "paid" : "pending",
        method: payable === 0 ? "balance" : "payment-link",
        amount: payable,
        createdAt: now,
        updatedAt: now,
      },
      customsConsent: { version: customsVersion, acceptedAt: now },
      // Each option keeps its own note (owner, 7.10.2026): nothing is merged across sizes.
      ...(i.note ? { note: i.note } : {}),
      ...(customs ? { customs } : {}),
      history: [
        {
          at: now,
          text:
            "Заказ оформлен в Atlas. Сумма " +
            money(i.quote.total) +
            (payable ? ". Ожидается подтверждение платёжного провайдера." : ". Учтено из внутреннего баланса Atlas."),
          code: "checkout",
          params: { total: i.quote.total, fromBalance: payable ? 0 : 1 },
        },
        ...(i.quote.storeShippingHold
          ? [{ at: now, text: "Предварительный резерв доставки магазина " + money(i.quote.storeShippingHold) + " удерживается отдельно и не входит в сумму заказа. Менеджер уточнит фактическую доставку.", code: "store-hold", params: { hold: i.quote.storeShippingHold } }]
          : []),
        ...(i.quote.customsHelp
          ? [{ at: now, text: "Покупатель выбрал оплату таможни через Atlas: сбор " + money(i.quote.customsHelp) + " и предоплата пошлины " + money(i.quote.customsDuty ?? 0) + " входят в сумму заказа. Остаток пошлины вернётся на баланс, доплата — только с согласия покупателя.", code: "customs-help", params: { fee: i.quote.customsHelp, duty: i.quote.customsDuty ?? 0 } }]
          : []),
        ...(serviceFeesOf(i.quote)
          ? [{ at: now, text: "Посылка застрахована: " + money(serviceFeesOf(i.quote)) + " входит в сумму заказа.", code: "insured", params: { fee: serviceFeesOf(i.quote) } }]
          : []),
        ...sourceCheckHistory(i, now),
      ],
    } as Order;
  });
  // The lines left for later become the next checkout: selected again, so the cart is not left with nothing chosen.
  const later = state.cart.filter((item) => !inCheckout(item)).map((item) => ({ ...item, selected: undefined }));
  return {
    ...state,
    // The lines left for later stay, already priced as their own parcels.
    cart: later,
    // The customs choice belongs to this checkout. Lines left for later keep it, so their totals still match it;
    // an empty cart starts the next one from the remembered choice (`customsPreference`).
    cartCustoms: later.length ? state.cartCustoms : undefined,
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
      { at: now, text: "Статус оплаты отмечен в Atlas. Платёжный провайдер не подтвердил списание.", code: "payment-recorded" },
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
    { code: "payment-recorded" },
  );
}

/** Lines of one checkout still waiting for their payment mark: they are paid together, as one order. */
export function pendingBatchPayments(state: Pick<State, "orders">, batchId: string) {
  return state.orders.filter((order) => order.batchId === batchId && !order.cancelled && order.payment?.status === "pending");
}

/**
 * One payment for a whole checkout (since 10 October 2026): every line still waiting is marked at once, with the
 * total the customer saw. Each line keeps its own history and ledger entry (the books are per order); the customer
 * gets one notification. Paying again changes nothing.
 */
export function confirmDemoBatchPayment(
  state: State,
  batchId: string,
  expectedAmount: number,
  now = Date.now(),
): State {
  const lines = pendingBatchPayments(state, batchId);
  if (!lines.length) {
    if (!state.orders.some((order) => order.batchId === batchId)) throw Error("Заказ не найден.");
    return state;
  }
  const total = lines.reduce((sum, order) => sum + order.payment!.amount, 0);
  if (total !== expectedAmount) throw Error("Сумма изменилась. Проверьте расчёт.");
  let next = state;
  for (const order of lines) {
    const o = getOrder(next, order.id);
    next = replace(next, {
      ...o,
      payment: { ...o.payment!, status: "paid", updatedAt: now },
      history: [
        ...o.history,
        { at: now, text: "Статус оплаты отмечен в Atlas. Платёжный провайдер не подтвердил списание.", code: "payment-recorded" },
      ],
    });
    next.entries = [
      ...next.entries,
      {
        id: "demo-payment:" + o.id,
        orderId: o.id,
        at: now,
        amount: o.payment!.amount,
        debit: "demo-provider",
        credit: "order-funds",
        description: "Статус оплаты записан в Atlas; провайдер не подключён",
      },
    ];
  }
  return withNotification(
    next,
    "Статус оплаты обновлён в Atlas",
    "Платёжный провайдер не подключён: списания и банковского подтверждения нет.",
    lines[0].id,
    now,
    { code: "payment-recorded" },
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
      history: [...o.history, { at: now, text: `Запрошено согласование: ${request.title}.`, code: "change-requested", params: { title: request.title } }],
    }),
    "Нужно ваше решение",
    `${request.title}${request.amountDelta ? ` · изменение ${money(request.amountDelta)}` : ""}.`,
    id,
    now,
    { code: "change-requested", params: { title: request.title, delta: request.amountDelta } },
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
    history: [...o.history, { at: now, text: decision === "approved" ? `Покупатель подтвердил: ${request.title}.` : `Покупатель отклонил: ${request.title}.`, code: decision === "approved" ? "change-approved" : "change-declined", params: { title: request.title } }],
  };
  return withNotification(
    replace(state, nextOrder),
    decision === "approved" ? "Изменение подтверждено" : "Изменение отклонено",
    request.title,
    id,
    now,
    { code: decision === "approved" ? "change-approved" : "change-declined", params: { title: request.title } },
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
      history: [...o.history, { at: now, text: warehouseInspection.condition === "ok" ? "Склад подтвердил комплектность и состояние товара." : "Склад зафиксировал проблему; требуется решение оператора и покупателя.", code: warehouseInspection.condition === "ok" ? "warehouse-ok" : "warehouse-problem" }],
    }),
    warehouseInspection.condition === "ok" ? "Товар принят на складе" : "На складе обнаружена проблема",
    warehouseInspection.condition === "ok" ? "Комплектность и состояние подтверждены." : "Откройте заказ: оператор подготовит вариант решения.",
    id,
    now,
    { code: warehouseInspection.condition === "ok" ? "warehouse-ok" : "warehouse-problem" },
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
      history: [...o.history, { at: now, text: `Добавлен трек-номер ${parcel.trackingNumber}.`, code: "tracking-added", params: { carrier: parcel.carrier, tracking: parcel.trackingNumber } }],
    }),
    "Добавлен трек-номер",
    `${parcel.carrier}: ${parcel.trackingNumber}`,
    id,
    now,
    { code: "tracking-added", params: { carrier: parcel.carrier, tracking: parcel.trackingNumber } },
  );
}
/**
 * The money recorded for this order in the ledger (balance used at checkout, a recorded payment, later movements),
 * less what already went back to the customer from it (store delivery, duty or delivery remainders). An unpaid
 * order has none: cancelling it credits nothing.
 */
export function cancelRefundAmount(state: Pick<State, "entries">, order: Pick<Order, "id">) {
  let left = 0;
  for (const entry of state.entries) {
    if (entry.orderId !== order.id) continue;
    if (entry.credit === "order-funds") left += entry.amount;
    if (entry.debit === "order-funds") left -= entry.amount;
    else if (entry.credit === "customer-credit") left -= entry.amount;
  }
  return Math.max(0, left);
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
  const actual = Math.ceil(actualUsd * (o.quote.fx ?? tariff.fx));
  if (o.quote.storeShippingHold !== undefined) {
    // Orders since 4 October 2026: the hold was kept apart from the order sum and nothing was paid for store
    // delivery. Within the hold the customer already agreed to it and the rest is released; above the hold
    // (or with free delivery, any charge) the difference waits for the customer's approval.
    const hold = o.quote.storeShippingHold;
    const held: StoreShippingSettlement = { estimated: hold, actual, actualUsd, refund: 0, extra: Math.max(0, actual - hold), held: true, released: Math.max(0, hold - actual) };
    const text = held.extra
      ? `Менеджер подтвердил доставку магазина ${money(actual)}. Это больше резерва ${money(hold)}: нужно согласие покупателя на разницу ${money(held.extra)}.`
      : `Менеджер подтвердил доставку магазина ${money(actual)} в пределах резерва ${money(hold)}.` + (held.released ? ` Неиспользованная часть резерва ${money(held.released)} освобождается.` : "");
    const coded = { code: held.extra ? "store-shipping-over" : "store-shipping-within", params: { actual, hold, extra: held.extra, released: held.released ?? 0 } };
    return withNotification(
      replace(state, { ...o, storeShippingSettlement: held, history: [...o.history, { at: now, text, ...coded }] }),
      held.extra ? "Нужно согласовать доставку" : "Доставка магазина уточнена",
      held.extra ? "Фактическая доставка магазина больше резерва. Откройте заказ и подтвердите разницу." : "Фактическая доставка магазина в пределах резерва. Списаний не было: оплата пока не подключена.",
      id,
      now,
      coded,
    );
  }
  const estimated = o.quote.sourceShipping ?? 0;
  const diff = estimated - actual;
  const settlement: StoreShippingSettlement = {
    estimated,
    actual,
    actualUsd,
    refund: Math.max(0, diff),
    extra: Math.max(0, -diff),
  };
  // Older orders paid the estimate inside the order sum: only money actually recorded for the order goes back.
  const credited = Math.min(settlement.refund, cancelRefundAmount(state, o));
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
          : credited < settlement.refund
            // Nothing (or only part) was recorded for the order: no "refund" the customer never had.
            ? `Менеджер подтвердил доставку магазина. Она дешевле резерва на ${money(settlement.refund)}; ` +
              (credited
                ? `оплата по заказу записана не полностью — на внутренний баланс Atlas зачислено ${money(credited)}.`
                : "оплата по заказу не записана — на баланс ничего не зачислено.")
            : "Менеджер подтвердил доставку магазина. Возврат разницы: " +
              money(settlement.refund),
        ...(settlement.extra
          ? { code: "store-shipping-extra-legacy", params: { actual, extra: settlement.extra } }
          : credited < settlement.refund
            ? { code: "store-shipping-partial-legacy", params: { actual, refund: settlement.refund, credited } }
            : { code: "store-shipping-refund-legacy", params: { actual, refund: settlement.refund, credited } }),
      },
    ],
  });
  if (credited)
    next.entries = [
      ...state.entries,
      {
        id: "store-shipping:" + id,
        orderId: id,
        at: now,
        amount: credited,
        debit: "store-shipping-reserve",
        credit: "customer-credit",
        description: "Возврат разницы доставки магазина",
      },
    ];
  const notice = settlement.extra ? "store-shipping-extra-legacy" : credited ? "store-shipping-refund-legacy" : settlement.refund ? "store-shipping-unpaid-legacy" : "store-shipping-match-legacy";
  return withNotification(
    next,
    settlement.extra ? "Нужно согласовать доставку" : "Доставка магазина уточнена",
    settlement.extra
      ? "Менеджер уточнил стоимость. Откройте заказ и подтвердите доплату."
      : credited
        ? "Разница учтена на внутреннем балансе Atlas. Банковский перевод не выполнялся."
        : settlement.refund
          ? "Доставка магазина дешевле резерва. Оплата по заказу не записана, поэтому на баланс ничего не зачислено."
          : "Стоимость совпала с резервом заказа.",
    id,
    now,
    { code: notice, params: { actual, extra: settlement.extra, refund: settlement.refund, credited } },
  );
}

/** The operator enters the duty customs charged; the prepaid estimate is settled: the rest to the balance, more with consent. */
export function confirmCustomsDuty(state: State, id: string, actualUsd: number, now = Date.now()): State {
  const o = getOrder(state, id);
  if (o.customsSettlement) return state;
  if (o.cancelled || !o.quote.customsHelp)
    throw Error("Atlas не оплачивает таможню по этому заказу.");
  if (!Number.isFinite(actualUsd) || actualUsd < 0 || actualUsd > 100000)
    throw Error("Укажите начисленную пошлину в USD.");
  const estimated = o.quote.customsDuty ?? 0;
  const actual = Math.ceil(actualUsd * (o.quote.fx ?? tariff.fx));
  const settlement: CustomsSettlement = { estimated, actual, actualUsd, refund: Math.max(0, estimated - actual), extra: Math.max(0, actual - estimated), at: now };
  const text = settlement.extra
    ? `Таможня начислила пошлину ${money(actual)}. Это больше предоплаты ${money(estimated)}: нужно согласие покупателя на разницу ${money(settlement.extra)}.`
    : `Таможня начислила пошлину ${money(actual)}. Atlas оплатил её из предоплаты ${money(estimated)}.` + (settlement.refund ? ` Остаток ${money(settlement.refund)} возвращён на баланс.` : "");
  const params = { actual, estimated, extra: settlement.extra, refund: settlement.refund };
  const next = replace(state, { ...o, customsSettlement: settlement, history: [...o.history, { at: now, text, code: settlement.extra ? "customs-duty-over" : "customs-duty-paid", params }] });
  if (settlement.refund)
    next.entries = [...state.entries, { id: "customs-duty:" + id, orderId: id, at: now, amount: settlement.refund, debit: "customs-duty-prepaid", credit: "customer-credit", description: "Возврат остатка предоплаты пошлины" }];
  return withNotification(
    next,
    settlement.extra ? "Нужно согласовать пошлину" : "Пошлина оплачена",
    settlement.extra ? "Таможня начислила больше предоплаты. Откройте заказ и подтвердите доплату." : settlement.refund ? "Остаток предоплаты пошлины учтён на внутреннем балансе Atlas. Банковский перевод не выполнялся." : "Пошлина совпала с предоплатой.",
    id,
    now,
    { code: settlement.extra ? "customs-duty-over" : settlement.refund ? "customs-duty-refund" : "customs-duty-match", params },
  );
}
export function approveCustomsExtra(state: State, id: string, expectedAmount: number, now = Date.now()): State {
  const o = getOrder(state, id);
  if (o.customsExtraApproved) return state;
  if (o.cancelled || !o.customsSettlement?.extra || o.customsSettlement.extra !== expectedAmount)
    throw Error("Сумма изменилась. Проверьте расчёт.");
  return replace(state, { ...o, customsExtraApproved: true, history: [...o.history, { at: now, text: "Покупатель подтвердил доплату пошлины " + money(o.customsSettlement.extra), code: "customs-extra-approved", params: { extra: o.customsSettlement.extra } }] });
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
        code: "store-shipping-extra-approved",
        params: { extra: o.storeShippingSettlement.extra },
      },
    ],
  });
}

/** The operator issues an extra invoice on a paid order: an amount in USD at the order's rate and the reason. */
export function requestExtraCharge(state: State, id: string, amountUsd: number, reason: string, now = Date.now()): State {
  const o = getOrder(state, id);
  if (o.cancelled || o.status >= 5 || o.payment?.status !== "paid")
    throw Error("Доплату можно выставить только по оплаченному активному заказу.");
  if (pendingExtraCharge(o)) throw Error("По заказу уже ждёт доплата. Отмените её или дождитесь оплаты.");
  if ((o.extraCharges ?? []).length >= 20) throw Error("По заказу слишком много счетов на доплату.");
  if (!Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > 10000) throw Error("Укажите сумму доплаты в USD.");
  const text = reason.replace(/\s+/g, " ").trim();
  if (text.length < 2 || text.length > 300) throw Error("Укажите причину доплаты.");
  const usd = Math.round(amountUsd * 100) / 100;
  const charge = extraChargeSchema.parse({
    id: "EXT-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
    amount: Math.ceil(usd * (o.quote.fx ?? tariff.fx)),
    amountUsd: usd,
    reason: text,
    status: "pending",
    requestedAt: now,
  });
  const params = { amount: charge.amount, reason: charge.reason };
  return withNotification(
    replace(state, {
      ...o,
      extraCharges: [...(o.extraCharges ?? []), charge],
      history: [...o.history, { at: now, text: `Оператор выставил счёт на доплату ${money(charge.amount)}: ${charge.reason}`, code: "extra-charge-requested", params }],
    }),
    "Нужна доплата по заказу",
    `${money(charge.amount)} · ${charge.reason}`.slice(0, 300),
    id,
    now,
    { code: "extra-charge-requested", params },
  );
}
/** The operator withdraws an unpaid extra invoice (a mistake, or the store refunded the difference). */
export function cancelExtraCharge(state: State, id: string, chargeId: string, now = Date.now()): State {
  const o = getOrder(state, id);
  const charge = (o.extraCharges ?? []).find((item) => item.id === chargeId);
  if (!charge) throw Error("Счёт на доплату не найден.");
  if (charge.status === "cancelled") return state;
  if (charge.status !== "pending") throw Error("Этот счёт уже оплачен.");
  const params = { amount: charge.amount };
  return withNotification(
    replace(state, {
      ...o,
      extraCharges: (o.extraCharges ?? []).map((item) => item.id === chargeId ? { ...item, status: "cancelled" as const, cancelledAt: now } : item),
      history: [...o.history, { at: now, text: `Счёт на доплату ${money(charge.amount)} отменён оператором.`, code: "extra-charge-cancelled", params }],
    }),
    "Доплата отменена",
    `Счёт на ${money(charge.amount)} больше не нужно оплачивать.`,
    id,
    now,
    { code: "extra-charge-cancelled", params },
  );
}
/**
 * The customer pays an extra invoice. As with the order's payment, Atlas records the mark only: no provider is
 * connected and nothing is charged. The amount must be the one the customer saw.
 */
export function payExtraCharge(state: State, id: string, chargeId: string, expectedAmount: number, now = Date.now()): State {
  const o = getOrder(state, id);
  const charge = (o.extraCharges ?? []).find((item) => item.id === chargeId);
  if (!charge) throw Error("Счёт на доплату не найден.");
  if (charge.status === "paid") return state;
  if (o.cancelled || charge.status !== "pending") throw Error("Этот счёт больше не ждёт оплаты.");
  if (charge.amount !== expectedAmount) throw Error("Сумма изменилась. Проверьте расчёт.");
  const params = { amount: charge.amount };
  const next = replace(state, {
    ...o,
    extraCharges: (o.extraCharges ?? []).map((item) => item.id === chargeId ? { ...item, status: "paid" as const, paidAt: now } : item),
    history: [...o.history, { at: now, text: `Доплата ${money(charge.amount)} отмечена в Atlas. Платёжный провайдер не подтвердил списание.`, code: "extra-charge-paid", params }],
  });
  next.entries = [
    ...state.entries,
    { id: "extra-charge:" + charge.id, orderId: id, at: now, amount: charge.amount, debit: "demo-provider", credit: "order-funds", description: "Доплата по счёту оператора записана в Atlas; провайдер не подключён" },
  ];
  return withNotification(
    next,
    "Доплата отмечена в Atlas",
    "Платёжный провайдер не подключён: списания и банковского подтверждения нет.",
    id,
    now,
    { code: "extra-charge-paid", params },
  );
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
    // Atlas pays customs for this order: the actual duty is settled before the order is marked delivered.
    || (o.status === 4 && Boolean(o.quote.customsHelp) && (!o.customsSettlement || Boolean(o.customsSettlement.extra && !o.customsExtraApproved)))
    || (o.changeRequests ?? []).some((request) => request.status === "pending")
    // An extra invoice waits for the customer: the operator moves the order on after it is paid or withdrawn.
    || Boolean(pendingExtraCharge(o))
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
    history: [...o.history, { at: now, text: statuses[nextStatus], code: "status", params: { status: nextStatus } }],
  }), "Статус заказа изменён", statuses[nextStatus], id, now, { code: "status", params: { status: nextStatus } });
}
/**
 * The orders weighed together with this one: lines of one checkout from the same store host and dispatch country,
 * each with a source link and a boxed weight. repriceCart quoted their international delivery as one parcel
 * (merchantParcelKey), so the warehouse weighs them once. Other and older orders weigh alone. Cancelled lines and
 * lines not bought yet (status 0) are not in the box and never hold the parcel back.
 */
export function parcelOrders(state: Pick<State, "orders">, order: Order): Order[] {
  if (order.cancelled || !order.batchId || !order.product.sourceUrl || order.product.boxedWeight === undefined) return [order];
  const key = storeParcelKey(order);
  const parcel = state.orders.filter((candidate) =>
    !candidate.cancelled &&
    (candidate.id === order.id || candidate.status > 0) &&
    candidate.batchId === order.batchId &&
    Boolean(candidate.product.sourceUrl) &&
    candidate.product.boxedWeight !== undefined &&
    storeParcelKey(candidate) === key);
  return parcel.length ? parcel : [order];
}
/** The order is at the warehouse and nothing is open that must be settled before weighing. */
export function readyToWeigh(o: Order) {
  try { assertReadyToWeigh(o); return true; } catch { return false; }
}
function assertReadyToWeigh(o: Order) {
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
}
/** Records one order's weighing: status, parcel event, history, the refund entry and the customer notification. */
function recordWeighing(state: State, o: Order, s: Settlement, now: number): State {
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
        ...(s.extra ? { code: "parcel-extra", params: { extra: s.extra } } : { code: "parcel-weighed", params: { refund: s.refund } }),
      },
    ],
  });
  if (s.refund)
    next.entries = [
      ...state.entries,
      {
        id: "settlement:" + o.id,
        orderId: o.id,
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
    o.id,
    now,
    { code: s.extra ? "parcel-extra" : s.refund ? "parcel-refund" : "parcel-weighed", params: { extra: s.extra, refund: s.refund } },
  );
}
/**
 * The warehouse weighs the whole store parcel at once (6 October 2026): every order of it must be ready, the parcel's
 * delivery is ceil(max(weight, volume weight) × the quoted rate) once, split by the orders' quoted delivery (the
 * shares repriceCart gave them) with the remainder on the last one. A parcel weighed exactly at its quoted weight
 * leaves every order at its quote. `without` lists bought orders of this parcel that have not reached the warehouse
 * (status 1): the operator weighs the rest without them, and they are weighed alone later. A single order, or a
 * parcel already partly weighed, is weighed alone. Weighing again changes nothing.
 */
export function receiveOrder(
  state: State,
  id: string,
  dimensions: [number, number, number, number],
  now = Date.now(),
  without: string[] = [],
): State {
  const o = getOrder(state, id);
  if (o.settlement) return state;
  const whole = parcelOrders(state, o);
  for (const skipped of without) {
    const order = whole.find((candidate) => candidate.id === skipped);
    // Left out: a bought order still on the way, or one at the warehouse with something open (a problem, a service).
    if (!order || order.id === o.id || order.settlement || order.status > 2 || (order.status === 2 && readyToWeigh(order)))
      throw Error("Без взвешивания можно оставить только заказ этой посылки, который ещё не пришёл на склад или ждёт решения.");
  }
  const parcel = whole.filter((order) => !without.includes(order.id));
  if (parcel.length < 2 || whole.some((order) => order.settlement)) {
    assertReadyToWeigh(o);
    return recordWeighing(state, o, settle(o.quote, ...dimensions), now);
  }
  for (const order of parcel) {
    try { assertReadyToWeigh(order); } catch (error) { throw Error(`Заказ ${order.id}: ${(error as Error).message}`); }
  }
  const weighed = settle(parcel[0].quote, ...dimensions);
  const shippingTotal = weighed.shipping;
  const byShipping = parcel.map((order) => order.quote.shipping);
  const byWeight = parcel.map((order) => order.quote.weight);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const basis = sum(byShipping) > 0 ? byShipping : sum(byWeight) > 0 ? byWeight : parcel.map(() => 1);
  const basisTotal = sum(basis);
  const parcelOrderIds = parcel.map((order) => order.id);
  let left = shippingTotal;
  let next = state;
  parcel.forEach((order, position) => {
    const shipping = position === parcel.length - 1 ? left : Math.min(left, Math.round(shippingTotal * basis[position] / basisTotal));
    left -= shipping;
    const diff = order.quote.shipping + order.quote.reserve - shipping;
    next = recordWeighing(next, order, {
      actualWeight: weighed.actualWeight,
      dimensionalWeight: weighed.dimensionalWeight,
      chargeableWeight: weighed.chargeableWeight,
      shipping,
      refund: Math.max(0, diff),
      extra: Math.max(0, -diff),
      dimensions: weighed.dimensions,
      parcelOrderIds,
      parcelShipping: shippingTotal,
    }, now);
  });
  return next;
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
        code: "extra-approved",
        params: { extra: o.settlement.extra },
      },
    ],
  });
}
/**
 * Cancels an order before purchase. Only the funds actually recorded for it go back to the internal balance
 * (cancelRefundAmount): nothing for an unpaid order, the balance used for a partly paid one. A pending payment
 * stays pending on the cancelled order; only a recorded payment is marked refunded.
 */
export function cancelOrder(state: State, id: string, now = Date.now()): State {
  const o = getOrder(state, id);
  if (o.cancelled) return state;
  if (o.status !== 0)
    throw Error("Заказ уже выкуплен. Автоматическая отмена недоступна.");
  const refund = cancelRefundAmount(state, o);
  const next = replace(state, {
    ...o,
    cancelled: true,
    payment: o.payment?.status === "paid"
      ? { ...o.payment, status: "refunded", updatedAt: now }
      : o.payment,
    history: [
      ...o.history,
      refund
        ? { at: now, text: "Заказ отменён до выкупа. Сумма учтена на внутреннем балансе Atlas; банковский перевод не выполнялся.", code: "cancel-refund", params: { refund } }
        : { at: now, text: "Заказ отменён до оплаты. Списаний не было.", code: "cancel-unpaid" },
    ],
  });
  if (!refund) return next;
  return {
    ...next,
    entries: [
      ...state.entries,
      {
        id: "cancel:" + id,
        orderId: id,
        at: now,
        amount: refund,
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
