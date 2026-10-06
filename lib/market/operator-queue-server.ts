// GET /api/operations?queue=1: the operator queue without whole customer documents. SQLite's json_each reads the
// orders inside market_accounts.state on the database side, so the Worker receives a few scalars per order for
// tabs, counts and search, and the full JSON only of the orders on the requested page (plus their parcel siblings,
// balance entries and notifications). Works on the existing tables; no migration, no dependency on the projection.
// Kept apart from server.ts (no cloudflare:workers) so tests run it against SQLite.
import {stateSchema,type Order} from './domain.ts';
import {operatorQueueMaxPageSize,operatorQueuePageSize,parseQueueCursor,queueCursor,queueMatches,queueOrder,queueTabsOf,slimQueueAccount,type OperatorQueueCounts,type OperatorQueueResponse,type OperatorQueueTab} from './operator-queue.ts';

export type QueueStatement={bind(...values:unknown[]):QueueStatement;all<T=Record<string,unknown>>():Promise<{results:T[]}>};
export type QueueDb={prepare(sql:string):QueueStatement};

type SummaryRow={account_id:string;id:string;created_at:number;status:number;cancelled:number|null;issue_status:string|null;settlement_extra:number|null;extra_approved:number|null;store_extra:number|null;store_extra_approved:number|null;customs_extra:number|null;customs_extra_approved:number|null;change_pending:number;inspection:string|null;payment_status:string|null;product_name:string|null;brand:string|null;variant:string|null;recipient:string|null;recipient_phone:string|null;city:string|null};
const field=(path:string,as:string)=>`json_extract(o.value,'${path}') AS ${as}`;
const summarySql=`SELECT a.user_id AS account_id,${[
 field('$.id','id'),field('$.createdAt','created_at'),field('$.status','status'),field('$.cancelled','cancelled'),field('$.issueCase.status','issue_status'),
 field('$.settlement.extra','settlement_extra'),field('$.extraApproved','extra_approved'),field('$.storeShippingSettlement.extra','store_extra'),field('$.storeShippingExtraApproved','store_extra_approved'),
 field('$.customsSettlement.extra','customs_extra'),field('$.customsExtraApproved','customs_extra_approved'),field('$.warehouseInspection.condition','inspection'),field('$.payment.status','payment_status'),
 field('$.product.name','product_name'),field('$.product.brand','brand'),field('$.variant','variant'),field('$.delivery.recipient','recipient'),field('$.delivery.phone','recipient_phone'),field('$.delivery.city','city'),
].join(',')},EXISTS(SELECT 1 FROM json_each(o.value,'$.changeRequests') c WHERE json_extract(c.value,'$.status')='pending') AS change_pending FROM market_accounts a, json_each(a.state,'$.orders') o`;

export type QueueSummary={accountId:string;id:string;createdAt:number;order:Order;credit:number;search:Parameters<typeof queueMatches>[0]};
/**
 * One light row per order of every account: enough of the order for `queueTabsOf` (the fields
 * orderNeedsOperatorAttention, the done and refund rules read) and for `queueMatches`.
 */
export async function queueSummaries(db:QueueDb):Promise<QueueSummary[]>{
 const [orders,accounts,credits]=await Promise.all([
  db.prepare(summarySql).all<SummaryRow>(),
  db.prepare("SELECT user_id,name,json_extract(state,'$.communication.phone') AS phone FROM market_accounts").all<{user_id:string;name:string;phone:string|null}>(),
  db.prepare("SELECT a.user_id AS account_id,json_extract(e.value,'$.orderId') AS order_id,SUM(json_extract(e.value,'$.amount')) AS credit FROM market_accounts a, json_each(a.state,'$.entries') e WHERE json_extract(e.value,'$.credit')='customer-credit' AND json_extract(e.value,'$.orderId') IS NOT NULL GROUP BY a.user_id,json_extract(e.value,'$.orderId')").all<{account_id:string;order_id:string;credit:number}>(),
 ]);
 const owners=new Map(accounts.results.map(row=>[row.user_id,row]));
 const credit=new Map(credits.results.map(row=>[`${row.account_id}\n${row.order_id}`,Number(row.credit)||0]));
 return orders.results.filter(row=>typeof row.id==='string').map(row=>{
  // Only the fields the queue rules read; the cast is safe for queueTabsOf and nothing else uses it.
  const order={
   id:row.id,status:Number(row.status),cancelled:!!row.cancelled,createdAt:Number(row.created_at)||0,
   issueCase:row.issue_status?{status:row.issue_status}:undefined,
   settlement:row.settlement_extra!==null?{extra:row.settlement_extra}:undefined,extraApproved:!!row.extra_approved,
   storeShippingSettlement:row.store_extra!==null?{extra:row.store_extra}:undefined,storeShippingExtraApproved:!!row.store_extra_approved,
   customsSettlement:row.customs_extra!==null?{extra:row.customs_extra}:undefined,customsExtraApproved:!!row.customs_extra_approved,
   changeRequests:row.change_pending?[{status:'pending'}]:[],
   warehouseInspection:row.inspection?{condition:row.inspection}:undefined,
   payment:row.payment_status?{status:row.payment_status}:undefined,
  } as unknown as Order;
  const owner=owners.get(row.account_id);
  return {accountId:row.account_id,id:row.id,createdAt:order.createdAt,order,credit:credit.get(`${row.account_id}\n${row.id}`)??0,
   search:{id:row.id,productName:row.product_name??undefined,brand:row.brand??undefined,variant:row.variant??undefined,accountName:owner?.name,accountId:row.account_id,profilePhone:owner?.phone??undefined,recipient:row.recipient??undefined,recipientPhone:row.recipient_phone??undefined,city:row.city??undefined}};
 });
}

export function queueCounts(summaries:QueueSummary[]):OperatorQueueCounts{
 const counts={active:0,attention:0,done:0,refunds:0,weighing:0};
 for(const item of summaries){const tabs=queueTabsOf(item.order,item.credit);for(const key of Object.keys(counts) as (keyof OperatorQueueCounts)[])if(tabs[key])counts[key]++}
 return counts;
}

type AccountRow={user_id:string;name:string;revision:number;updated_at:number;communication:string|null};
/** Full JSON of the page orders and of every order sharing their store batch, with the related entries and notifications. */
async function pageAccounts(db:QueueDb,page:QueueSummary[]){
 const accountIds=[...new Set(page.map(item=>item.accountId))];
 if(!accountIds.length)return [];
 const ids=JSON.stringify(accountIds),orderIds=JSON.stringify([...new Set(page.map(item=>item.id))]);
 const [accounts,orders]=await Promise.all([
  db.prepare("SELECT user_id,name,revision,updated_at,json_extract(state,'$.communication') AS communication FROM market_accounts WHERE user_id IN (SELECT value FROM json_each(?))").bind(ids).all<AccountRow>(),
  // Page orders, then (second pass) their batch siblings: a store parcel is one batch of one account.
  db.prepare("SELECT a.user_id AS account_id,o.value AS value,json_extract(o.value,'$.batchId') AS batch FROM market_accounts a, json_each(a.state,'$.orders') o WHERE a.user_id IN (SELECT value FROM json_each(?)) AND json_extract(o.value,'$.id') IN (SELECT value FROM json_each(?))").bind(ids,orderIds).all<{account_id:string;value:string;batch:string|null}>(),
 ]);
 const batches=JSON.stringify([...new Set(orders.results.map(row=>`${row.account_id}\n${row.batch??''}`).filter(key=>!key.endsWith('\n')))]);
 const siblings=batches==='[]'?{results:[]}:await db.prepare("SELECT a.user_id AS account_id,o.value AS value FROM market_accounts a, json_each(a.state,'$.orders') o WHERE a.user_id IN (SELECT value FROM json_each(?)) AND (a.user_id||char(10)||json_extract(o.value,'$.batchId')) IN (SELECT value FROM json_each(?))").bind(ids,batches).all<{account_id:string;value:string}>();
 const group=(rows:{account_id:string;value:string}[])=>{const map=new Map<string,unknown[]>();for(const row of rows)map.set(row.account_id,[...(map.get(row.account_id)??[]),JSON.parse(row.value)]);return map};
 const orderMap=group([...orders.results,...siblings.results]);
 // Entries and notifications of the orders sent (slimQueueAccount keeps the same set).
 const kept=JSON.stringify([...new Set([...orders.results,...siblings.results].map(row=>`${row.account_id}\n${(JSON.parse(row.value) as {id?:string}).id??''}`))]);
 const related=(path:string)=>db.prepare(`SELECT a.user_id AS account_id,x.value AS value FROM market_accounts a, json_each(a.state,'${path}') x WHERE a.user_id IN (SELECT value FROM json_each(?)) AND (a.user_id||char(10)||json_extract(x.value,'$.orderId')) IN (SELECT value FROM json_each(?))`).bind(ids,kept).all<{account_id:string;value:string}>();
 const [entries,notifications]=await Promise.all([related('$.entries'),related('$.notifications')]);
 const entryMap=group(entries.results),noticeMap=group(notifications.results);
 const listed=new Set(page.map(item=>item.id));
 return accounts.results.map(row=>{
  const seen=new Set<string>(),docs=(orderMap.get(row.user_id)??[]).filter(order=>{const id=(order as {id?:string}).id??'';if(seen.has(id))return false;seen.add(id);return true});
  // The same schema the full document goes through, so old documents get the same defaults.
  const state=stateSchema.parse({orders:docs,entries:entryMap.get(row.user_id)??[],notifications:noticeMap.get(row.user_id)??[],...(row.communication?{communication:JSON.parse(row.communication)}:{})});
  return slimQueueAccount({id:row.user_id,name:row.name,revision:row.revision,updatedAt:row.updated_at,state},listed);
 });
}

/** `order` (a link to one order) returns just that order whatever its tab; the counts stay global. */
export type OperatorQueueQuery={tab:OperatorQueueTab;q?:string;cursor?:string|null;limit?:number;order?:string};
export async function operatorQueue(db:QueueDb,query:OperatorQueueQuery):Promise<OperatorQueueResponse>{
 const limit=Math.min(operatorQueueMaxPageSize,Math.max(1,Math.floor(query.limit??operatorQueuePageSize)||operatorQueuePageSize));
 const summaries=await queueSummaries(db);
 const counts=queueCounts(summaries);
 const after=parseQueueCursor(query.cursor);
 const matching=summaries.filter(item=>query.order?item.id===query.order:queueTabsOf(item.order,item.credit)[query.tab]&&queueMatches(item.search,query.q??'')).sort(queueOrder);
 const start=after?matching.findIndex(item=>queueOrder(item,after)>0):0;
 const page=start<0?[]:matching.slice(start,start+limit);
 const more=start>=0&&start+limit<matching.length;
 const accounts=await pageAccounts(db,page);
 return {accounts,orderIds:page.map(item=>item.id),counts,total:matching.length,nextCursor:more&&page.length?queueCursor(page[page.length-1]):null};
}
/** Counts only (after an operator action), without any order JSON. */
export async function operatorQueueCounts(db:QueueDb){return queueCounts(await queueSummaries(db))}
