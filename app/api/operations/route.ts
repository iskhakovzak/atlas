import { z } from "zod";
import { actionSchema, applyAction } from "@/lib/market/actions";
import { pricingSchema, validateServiceCatalog } from "@/lib/market/domain";
import { policySchema } from "@/lib/market/policy";
import {
  failure,
  HttpError,
  identity,
  json,
  operator,
  operatorAccounts,
  auditEvents,
  ensurePrimaryOperator,
  persist,
  pricingAndPolicy,
  recordAudit,
  requestJson,
  sameOrigin,
  savePricing,
  savePolicy,
  saveStaffMember,
  rebuildOperationalProjection,
  operationalHealth,
  operationalCustomers,
  setCustomerStatus,
  errorSummary,
  staffMembers,
  storedAccount,
} from "@/lib/market/server";
import {apiErrorMessage,requestLocale} from "@/lib/market/i18n";

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
      buyoutFee: true,
      conversionFee: true,
      deliveryMargin: true,
      optionalServices: true,
      reserve: true,
      divisor: true,
      rates: true,
      countryOverrides: true,
      serviceCatalog: true,
    }),
  }),
  z.object({
    kind: z.literal("staff"),
    value: z.object({
      email: z.string().trim().email().max(320),
      displayName: z.string().trim().min(2).max(120),
      role: z.enum(["support", "procurement", "warehouse", "finance", "admin"]),
      status: z.enum(["invited", "active", "disabled"]),
    }),
  }),
  z.object({kind:z.literal("projection-rebuild")}),
  z.object({kind:z.literal("customer-status"),accountId:z.string().min(1).max(320),status:z.enum(["active","review","blocked"])}),
]);

async function requireOperator() {
  const user = await identity();
  if (!operator(user.email)) throw new HttpError(403, 'err_15');
  return user;
}

export async function GET(request:Request) {
  try {
    const user=await requireOperator();
    await ensurePrimaryOperator(user);
    const [accounts, settings, staff, audit, health, customerStatuses, errors] = await Promise.all([
      operatorAccounts(),
      pricingAndPolicy(),
      staffMembers(),
      auditEvents(),
      operationalHealth(),
      operationalCustomers(),
      errorSummary(),
    ]);
    return json({ accounts, pricing: settings.pricing, policy: settings.policy, staff, audit, health, customerStatuses, errors });
  } catch (error) {
    return failure(error,request);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireOperator();
    const payload = updateSchema.safeParse(await requestJson(request));
    if (!payload.success) throw new HttpError(400, 'err_16');
    if(payload.data.kind==='projection-rebuild'){const count=await rebuildOperationalProjection();await recordAudit(user,'projection.rebuild','system',undefined,{accounts:count});return json({health:await operationalHealth(),audit:await auditEvents()});}
    if(payload.data.kind==='customer-status'){await setCustomerStatus(payload.data.accountId,payload.data.status);await recordAudit(user,'customer.status','customer',payload.data.accountId,{status:payload.data.status});return json({health:await operationalHealth(),audit:await auditEvents()});}
    if(payload.data.kind==='staff'){
      const isPrimary=operator(payload.data.value.email);
      const value=isPrimary?{...payload.data.value,role:'admin' as const,status:'active' as const}:payload.data.value;
      const member=await saveStaffMember(value);
      await recordAudit(user,'staff.update','staff',member.email,{role:member.role,status:member.status});
      return json({member,staff:await staffMembers(),audit:await auditEvents()});
    }
    if (payload.data.kind === "pricing") {
      const now = Date.now();
      const next = pricingSchema.parse({
        ...payload.data.value,
        version: `managed-${now}`,
        updatedAt: now,
        managedBy: user.email,
      });
      try { validateServiceCatalog(next.serviceCatalog); }
      catch (error) { throw new HttpError(400, (error as Error).message); }
      await savePricing(next, user.userId);
      await recordAudit(user,'pricing.update','settings','pricing',{version:next.version});
      return json({ pricing: next });
    }
    if (payload.data.kind === "policy") {
      const now = Date.now();
      const next = policySchema.parse({ ...payload.data.value, version: `policy-${now}`, updatedAt: now, managedBy: user.email });
      await savePolicy(next, user.userId);
      await recordAudit(user,'policy.update','settings','policy',{version:next.version});
      return json({ policy: next });
    }
    const parsedAction = actionSchema.safeParse(payload.data.action);
    if (!parsedAction.success)
      throw new HttpError(400, 'err_17');
    if (
      ![
        "advance",
        "receive",
        "confirm-store-shipping",
        "order-image",
        "assign-order",
        "staff-note",
        "parcel-set",
        "change-request-create",
        "warehouse-inspect",
        "warehouse-service-complete",
        "warehouse-service-decline",
        "support-reply",
      ].includes(parsedAction.data.type)
    )
      throw new HttpError(403, 'err_18');
    const current = await storedAccount(payload.data.accountId);
    if (current.revision !== payload.data.revision) {
      const locale=requestLocale(request);
      return json(
        { error: locale==='ru'?"Заказ изменился. Очередь обновлена.":apiErrorMessage(409,locale), account: current },
        409,
      );
    }
    let next;
    try {
      const {pricing:currentPricing,policy:currentPolicy} = await pricingAndPolicy();
      next = applyAction(current.state, parsedAction.data, true, currentPricing, currentPolicy);
    } catch (error) {
      throw new HttpError(400, (error as Error).message);
    }
    await persist(current.id, next, current.revision);
    const orderId='id' in parsedAction.data?String(parsedAction.data.id):undefined;
    await recordAudit(user,`order.${parsedAction.data.type}`,'order',orderId,{accountId:current.id});
    return json({
      account: { ...current, state: next, revision: current.revision + 1 },
    });
  } catch (error) {
    return failure(error,request);
  }
}
