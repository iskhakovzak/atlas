import { z } from "zod";
import type { CartItem, Product } from "./domain.ts";

export const policySchema = z.object({
  maxCartLines: z.number().int().min(1).max(20),
  maxCartWeightKg: z.number().finite().positive().max(200),
  maxMerchandiseUsd: z.number().finite().positive().max(50_000),
  blockedCategories: z.array(z.string().trim().min(1).max(80)).max(20),
  restrictedTerms: z.array(z.string().trim().min(2).max(80)).max(40),
  version: z.string().min(1).max(80),
  updatedAt: z.number().int().nonnegative(),
  managedBy: z.string().max(160).optional(),
});
export type Policy = z.infer<typeof policySchema>;
export const defaultPolicy: Policy = {
  maxCartLines: 10,
  maxCartWeightKg: 30,
  maxMerchandiseUsd: 2_000,
  blockedCategories: [],
  restrictedTerms: ["weapon", "оружие", "боеприпас", "взрывчат", "наркот", "tobacco", "табак"],
  version: "policy-1",
  updatedAt: 0,
};
const normalized = (value: string) => value.toLocaleLowerCase("ru");
export function productRestriction(product: Product, policy: Policy) {
  if (policy.blockedCategories.some((category) => normalized(category) === normalized(product.category))) return `Категория «${product.category}» временно недоступна для оформления.`;
  const haystack = normalized(`${product.name} ${product.brand} ${product.description ?? ""} ${product.declarationDescription ?? ""}`);
  const term = policy.restrictedTerms.find((item) => haystack.includes(normalized(item)));
  return term ? `Товар требует ручной проверки по ограничению «${term}».` : null;
}
export function assertCartPolicy(items: CartItem[], policy: Policy) {
  if (items.length > policy.maxCartLines) throw Error(`В одной партии можно оформить до ${policy.maxCartLines} разных позиций.`);
  const weight = items.reduce((sum, item) => sum + item.quote.weight, 0);
  if (weight > policy.maxCartWeightKg) throw Error(`Расчётный вес партии превышает ${policy.maxCartWeightKg} кг.`);
  const merchandiseUsd = items.reduce((sum, item) => sum + item.quote.merchandise / (item.quote.fx ?? 12_800), 0);
  if (merchandiseUsd > policy.maxMerchandiseUsd) throw Error(`Стоимость товаров в партии выше управляемого предела $${policy.maxMerchandiseUsd}.`);
  for (const item of items) { const restriction = productRestriction(item.product, policy); if (restriction) throw Error(restriction); }
}
