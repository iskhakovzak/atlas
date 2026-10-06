import { z } from "zod";
import { env } from "cloudflare:workers";
import { actionSchema, applyAction } from "@/lib/market/actions";
import { normalizePricing, pricingRevision, pricingSchema, validateServiceCatalog } from "@/lib/market/domain";
import { policySchema } from "@/lib/market/policy";
import { canPerformAction, customerStatusAllowed, hasPermission, hasStaffAccess, operationsKindPermissions, operationsQueryPermissions, operatorActionTypes, type Permission } from "@/lib/market/access";
import { addCustomerNote, auditExport, auditFacets, auditPage, customerNotes, dashboardFor, disableStaffMember, saveAdminSettings, staffLastSignIns, systemStatus } from "@/lib/market/admin-server";
import { adminSettingsSchema, auditCsv, customerRow, customersCsv, dayEnd, dayStart, staffDeactivationError } from "@/lib/market/admin-dashboard";
import { orderPayable } from "@/lib/market/domain";
import {
  accessFor,
  assertPermission,
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
  refreshCbuFx,
  requestJson,
  sameOrigin,
  savePricing,
  savePolicy,
  saveStaffMember,
  rebuildOperationalProjection,
  operationalHealth,
  operationalCustomers,
  setCustomerStatus,
  customerStatus,
  errorSummary,
  staffMembers,
  storedAccount,
} from "@/lib/market/server";
import {apiErrorMessage,requestLocale} from "@/lib/market/i18n";
import { vitalsSummary } from "@/lib/market/telemetry-store";
import { database } from "@/lib/market/server";
import { operatorQueue, operatorQueueCounts } from "@/lib/market/operator-queue-server";
import { operatorQueueTabs, type OperatorQueueTab } from "@/lib/market/operator-queue";

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
      perKgUsd: true,
      standardPerKgUsd: true,
      margin: true,
      buyoutFee: true,
      conversionFee: true,
      deliveryMargin: true,
      optionalServices: true,
      reserve: true,
      divisor: true,
      storeShippingFreeFromUsd: true,
      fxSource: true,
      fxMarkup: true,
      customsAllowanceUsd: true,
      customsRate: true,
      customsMinimumPerKg: true,
      customsHelpFee: true,
      rates: true,
      countryOverrides: true,
      deliveryDays: true,
      standardDeliveryDays: true,
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
  z.object({kind:z.literal("fx-refresh")}),
  z.object({kind:z.literal("customer-status"),accountId:z.string().min(1).max(320),status:z.enum(["active","review","blocked"])}),
  z.object({kind:z.literal("customer-note"),accountId:z.string().min(1).max(320),text:z.string().trim().min(1).max(1000)}),
  z.object({kind:z.literal("staff-deactivate"),email:z.string().trim().email().max(320),reason:z.string().trim().min(2).max(500)}),
  z.object({kind:z.literal("admin-settings"),value:adminSettingsSchema.pick({attention:true})}),
]);
const csv=(body:string,filename:string)=>new Response(body,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'no-store'}});
/** Query sections of GET: each one only for its right, each answers alone (no account documents in these responses). */
async function querySection(request:Request,user:{userId:string;email:string},access:Awaited<ReturnType<typeof accessFor>>){
  const params=new URL(request.url).searchParams;
  const section=['audit','customers','customer','system'].find(name=>params.has(name));
  if(!section)return null;
  assertPermission(access,operationsQueryPermissions[section]);
  if(section==='audit'){
    const query={actor:params.get('actor')??undefined,entity:params.get('entity')??undefined,from:dayStart(params.get('from')),to:dayEnd(params.get('to')),q:params.get('q')??undefined,page:Number(params.get('page')??'1')||1,pageSize:Number(params.get('pageSize')??'')||undefined};
    if(params.get('audit')==='csv'){const events=await auditExport(query);await recordAudit(user,'audit.export','system',undefined,{count:events.length});return csv(auditCsv(events),`atlas-audit-${new Date().toISOString().slice(0,10)}.csv`);}
    const [page,facets]=await Promise.all([auditPage(query),auditFacets()]);
    return json({audit:page.events,total:page.total,page:page.page,pages:page.pages,pageSize:page.pageSize,facets});
  }
  if(section==='customers'){
    const [accounts,statuses]=await Promise.all([operatorAccounts(),operationalCustomers()]);
    const rows=accounts.map(account=>customerRow(account,statuses[account.id]??'active'));
    await recordAudit(user,'customers.export','customer',undefined,{count:rows.length});
    return csv(customersCsv(rows),`atlas-customers-${new Date().toISOString().slice(0,10)}.csv`);
  }
  if(section==='customer'){
    const id=params.get('customer')??'';
    const [account,status,notes]=await Promise.all([storedAccount(id),customerStatus(id),customerNotes(id)]);
    const orders=account.state.orders.map(order=>({id:order.id,status:order.status,cancelled:order.cancelled,payable:orderPayable(order),createdAt:order.createdAt,name:order.product.name,brand:order.product.brand,payment:order.payment?.status??null,deliverySpeed:order.quote.deliverySpeed??'express'})).sort((a,b)=>b.createdAt-a.createdAt);
    const tickets=account.state.supportTickets.map(ticket=>({id:ticket.id,subject:ticket.subject,status:ticket.status,updatedAt:ticket.updatedAt,replies:ticket.replies.length})).sort((a,b)=>b.updatedAt-a.updatedAt);
    const recipients=(account.state.deliveryProfiles??[]).map(profile=>({recipient:profile.recipient,city:profile.city??'',phone:profile.phone??''}));
    return json({customer:customerRow(account,status as 'active'|'review'|'blocked'),revision:account.revision,orders,tickets,notes,recipients,language:account.state.communication.language});
  }
  return json({system:await systemStatus()});
}

/**
 * The operator queue without whole customer documents (lib/market/operator-queue-server.ts), for the same
 * `operations.read` right as the full response: ?queue=1&tab=&q=&cursor=&limit= gives one page, ?queue=1&order=ID
 * the page with one order (a link to it), ?queue=counts only the tab counts.
 */
async function queueSection(request:Request){
  const params=new URL(request.url).searchParams;
  if(!params.has('queue'))return null;
  if(params.get('queue')==='counts')return json({counts:await operatorQueueCounts(database())});
  const tab=(operatorQueueTabs as readonly string[]).includes(params.get('tab')??'')?params.get('tab') as OperatorQueueTab:'active';
  const order=params.get('order')?.slice(0,120)||undefined;
  return json(await operatorQueue(database(),{tab,q:params.get('q')?.slice(0,200)??'',cursor:params.get('cursor'),limit:Number(params.get('limit')??'')||undefined,order}));
}

/** Any active staff member (or the administrator); the caller checks the finer permission on `access`. */
async function requireOperator() {
  const user = await identity();
  const access = await accessFor(user);
  if (!hasStaffAccess(access)) throw new HttpError(403, 'err_15');
  return { user, access };
}

export async function GET(request:Request) {
  try {
    const {user,access}=await requireOperator();
    assertPermission(access,'operations.read');
    if(operator(user.email))await ensurePrimaryOperator(user);
    const can=(permission:Permission)=>hasPermission(access,permission);
    const queue=await queueSection(request);
    if(queue)return queue;
    const section=await querySection(request,user,access);
    if(section)return section;
    // Each section only for the matching right; empty values keep the response shape for every client.
    const [accounts, settings, staff, audit, health, customerStatuses, errors, vitals] = await Promise.all([
      operatorAccounts(),
      pricingAndPolicy(),
      can('staff.manage')?staffMembers():[],
      can('audit.read')?auditEvents():[],
      operationalHealth(),
      operationalCustomers(),
      can('system.manage')?errorSummary():[],
      // Before migration 0007 is applied the table is missing; the dashboard then shows no field data.
      can('system.manage')?vitalsSummary().catch(() => null):null,
    ]);
    // Configuration the operator must fix in the hosting secrets; names only, never values.
    const setupWarnings = !can('system.manage')||env.ATLAS_AUTH_SECRET ? [] : ["Не задан секрет ATLAS_AUTH_SECRET: коды входа хранятся без секретной соли. Задайте его в секретах хостинга по AUTH_SETUP.md."];
    // The overview is computed here (thresholds from market_settings "admin"); attention items are cut to the viewer's rights.
    const {settings:adminSettings,dashboard}=await dashboardFor(can,accounts,settings.pricing,staff).catch(error=>{console.error('Admin dashboard failed',error);return {settings:null,dashboard:null}});
    const staffSignIns=can('staff.manage')&&staff.length?await staffLastSignIns(staff.map(member=>member.email)):{};
    return json({ accounts, pricing: settings.pricing, policy: settings.policy, staff, staffSignIns, audit, health, customerStatuses, errors, vitals, setupWarnings, dashboard, adminSettings, access:{operator:access.operator,role:access.role,permissions:access.permissions} });
  } catch (error) {
    return failure(error,request);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const {user,access} = await requireOperator();
    const payload = updateSchema.safeParse(await requestJson(request));
    if (!payload.success) throw new HttpError(400, 'err_16');
    // Every update kind needs its own right; actions are checked per action type below.
    if (payload.data.kind !== 'action') assertPermission(access, operationsKindPermissions[payload.data.kind]);
    if(payload.data.kind==='projection-rebuild'){const count=await rebuildOperationalProjection();await recordAudit(user,'projection.rebuild','system',undefined,{accounts:count});return json({health:await operationalHealth(),audit:await auditEvents()});}
    if(payload.data.kind==='customer-status'){if(!customerStatusAllowed(access,payload.data.status))throw new HttpError(403, 'err_51');await setCustomerStatus(payload.data.accountId,payload.data.status);await recordAudit(user,'customer.status','customer',payload.data.accountId,{status:payload.data.status});return json({health:await operationalHealth(),audit:await auditEvents()});}
    if(payload.data.kind==='customer-note'){
      const note=await addCustomerNote(payload.data.accountId,payload.data.text,user);
      await recordAudit(user,'customer.note','customer',payload.data.accountId,{noteId:note.id,length:note.text.length});
      return json({note,notes:await customerNotes(payload.data.accountId)});
    }
    if(payload.data.kind==='staff-deactivate'){
      const refusal=staffDeactivationError({targetEmail:payload.data.email,actorEmail:user.email,operatorEmail:env.ATLAS_OPERATOR_EMAIL??null});
      if(refusal)throw new HttpError(403,refusal);
      const member=await disableStaffMember(payload.data.email);
      await recordAudit(user,'staff.deactivate','staff',member.email,{reason:payload.data.reason,previousRole:member.role});
      return json({member,staff:await staffMembers(),audit:await auditEvents()});
    }
    if(payload.data.kind==='admin-settings'){
      const next=await saveAdminSettings(payload.data.value,user);
      await recordAudit(user,'admin.settings','settings','admin',{attention:next.attention,version:next.version});
      return json({adminSettings:next,audit:await auditEvents()});
    }
    if(payload.data.kind==='staff'){
      const isPrimary=operator(payload.data.value.email);
      const value=isPrimary?{...payload.data.value,role:'admin' as const,status:'active' as const}:payload.data.value;
      const member=await saveStaffMember(value);
      await recordAudit(user,'staff.update','staff',member.email,{role:member.role,status:member.status});
      return json({member,staff:await staffMembers(),audit:await auditEvents()});
    }
    if (payload.data.kind === "fx-refresh") {
      const next = await refreshCbuFx().catch(() => null);
      if (!next) throw new HttpError(502, "Не удалось получить курс ЦБ. Попробуйте позже или задайте курс вручную.");
      await recordAudit(user, "pricing.fx-refresh", "settings", "pricing", { version: next.version, fx: next.fx });
      return json({ pricing: next });
    }
    if (payload.data.kind === "pricing") {
      const now = Date.now();
      const current = (await pricingAndPolicy()).pricing;
      const next = normalizePricing(pricingSchema.parse({
        ...payload.data.value,
        // The Central Bank rate already read stays with the tariff; switching to a set rate keeps `fx` as entered.
        fxCbuRate: current.fxCbuRate,
        fxCbuDate: current.fxCbuDate,
        fxUpdatedAt: payload.data.value.fxSource === "cbu" ? current.fxUpdatedAt : now,
        revision: pricingRevision,
        version: `managed-${now}`,
        updatedAt: now,
        managedBy: user.email,
      }));
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
    // Customer-only actions are never operator actions (err_18); staff actions need the role's right (err_50).
    if (!operatorActionTypes.includes(parsedAction.data.type)) throw new HttpError(403, 'err_18');
    if (!canPerformAction(access, parsedAction.data.type)) throw new HttpError(403, 'err_50');
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
    await persist(current.id, next, current.revision, current.state);
    const orderId='id' in parsedAction.data?String(parsedAction.data.id):undefined;
    await recordAudit(user,`order.${parsedAction.data.type}`,'order',orderId,{accountId:current.id});
    return json({
      account: { ...current, state: next, revision: current.revision + 1 },
    });
  } catch (error) {
    return failure(error,request);
  }
}
