import { z } from "zod";
import { actionSchema, applyAction } from "@/lib/market/actions";
import { pricingSchema } from "@/lib/market/domain";
import { policySchema } from "@/lib/market/policy";
import {
  failure,
  HttpError,
  identity,
  json,
  operator,
  operatorAccounts,
  persist,
  pricing,
  policy,
  requestJson,
  sameOrigin,
  savePricing,
  savePolicy,
  storedAccount,
} from "@/lib/market/server";

const updateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("action"),
    accountId: z.string().min(1).max(320),
    revision: z.number().int().nonnegative(),
    action: z.unknown(),
  }),
  z.object({
    kind: z.literal("policy"),
    value: policySchema.pick({ maxCartLines: true, maxCartWeightKg: true, maxMerchandiseUsd: true, blockedCategories: true, restrictedTerms: true }),
  }),
  z.object({
    kind: z.literal("pricing"),
    value: pricingSchema.pick({
      fx: true,
      perKg: true,
      margin: true,
      reserve: true,
      divisor: true,
      rates: true,
    }),
  }),
]);

async function requireOperator() {
  const user = await identity();
  if (!operator(user.email)) throw new HttpError(403, "Доступно только оператору.");
  return user;
}

export async function GET() {
  try {
    await requireOperator();
    const [accounts, currentPricing, currentPolicy] = await Promise.all([
      operatorAccounts(),
      pricing(),
      policy(),
    ]);
    return json({ accounts, pricing: currentPricing, policy: currentPolicy });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireOperator();
    const payload = updateSchema.safeParse(await requestJson(request));
    if (!payload.success) throw new HttpError(400, "Проверьте данные операции.");
    if (payload.data.kind === "pricing") {
      const now = Date.now();
      const next = pricingSchema.parse({
        ...payload.data.value,
        version: `managed-${now}`,
        updatedAt: now,
        managedBy: user.email,
      });
      await savePricing(next, user.userId);
      return json({ pricing: next });
    }
    if (payload.data.kind === "policy") {
      const now = Date.now();
      const next = policySchema.parse({ ...payload.data.value, version: `policy-${now}`, updatedAt: now, managedBy: user.email });
      await savePolicy(next, user.userId);
      return json({ policy: next });
    }
    const parsedAction = actionSchema.safeParse(payload.data.action);
    if (!parsedAction.success)
      throw new HttpError(400, "Проверьте действие с заказом.");
    if (
      ![
        "advance",
        "receive",
        "confirm-store-shipping",
        "order-image",
        "assign-order",
        "staff-note",
        "parcel-set",
      ].includes(parsedAction.data.type)
    )
      throw new HttpError(403, "Это действие недоступно оператору.");
    const current = await storedAccount(payload.data.accountId);
    if (current.revision !== payload.data.revision)
      return json(
        { error: "Заказ изменился. Очередь обновлена.", account: current },
        409,
      );
    let next;
    try {
      const [currentPricing,currentPolicy] = await Promise.all([pricing(),policy()]);
      next = applyAction(current.state, parsedAction.data, true, currentPricing, currentPolicy);
    } catch (error) {
      throw new HttpError(400, (error as Error).message);
    }
    await persist(current.id, next, current.revision);
    return json({
      account: { ...current, state: next, revision: current.revision + 1 },
    });
  } catch (error) {
    return failure(error);
  }
}
