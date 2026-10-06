// Server side of the admin: thresholds (market_settings key "admin"), the dashboard, filtered audit pages,
// customer notes (migration 0011), staff sign-ins and the system status. Rights are checked by the route.
import {database,HttpError,operatorAccounts,pricingAndPolicy,staffMembers,type AuditEvent,type StaffMember} from './server';
import {readCatalog} from './catalog-server';
import {adminSettingsSchema,attentionFor,attentionItems,dashboardKpis,defaultAdminSettings,orderFunnel,parseAdminSettings,auditPageSize,type AdminSettings,type AttentionItem,type DashboardAccount,type DashboardKpis,type FunnelStage} from './admin-dashboard';
import type {Permission} from './access';
import {statuses,type Pricing} from './domain';
import type {OrderFinance} from './finance';
import {buildInvestorSnapshot,hostOf,isExpenseKind,type InvestorSnapshot} from './investor-metrics';

// ---------- Thresholds ----------
export async function adminSettings():Promise<AdminSettings>{
 const row=await database().prepare("SELECT value FROM market_settings WHERE key='admin'").first<{value:string}>();
 return row?parseAdminSettings(row.value):defaultAdminSettings;
}
export async function saveAdminSettings(input:unknown,user:{userId:string;email:string}):Promise<AdminSettings>{
 const parsed=adminSettingsSchema.safeParse(input);
 if(!parsed.success)throw new HttpError(400,'err_16');
 const now=Date.now(),next:AdminSettings={...parsed.data,version:`admin-${now}`,updatedAt:now,managedBy:user.email};
 await database().prepare("INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES ('admin',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(JSON.stringify(next),now,user.userId).run();
 return next;
}

// ---------- Dashboard ----------
export type AdminDashboard={kpis:DashboardKpis;funnel:FunnelStage[];attention:AttentionItem[];attentionTotal:number;catalogErrors:number;computedAt:number};
/** Catalog entries whose last store check failed (name, error, when); an unreadable catalog gives none. */
export async function catalogCheckErrors(){
 try{
  const {document}=await readCatalog();
  return document.entries.filter(entry=>entry.draft.lastCheckError).map(entry=>({id:entry.id,name:entry.draft.name,error:entry.draft.lastCheckError!,at:entry.draft.checkedAt}));
 }catch(error){console.error('Catalog read for the dashboard failed',error);return []}
}
/** Everything on the overview tab, computed on the server; attention items are cut to the viewer's rights. */
export async function adminDashboard(input:{accounts:DashboardAccount[];pricing:Pricing;staff:StaffMember[];settings:AdminSettings;can:(permission:Permission)=>boolean;now?:number}):Promise<AdminDashboard>{
 const now=input.now??Date.now();
 const catalogErrors=input.can('catalog.manage')?await catalogCheckErrors():[];
 const all=attentionItems({accounts:input.accounts,pricing:input.pricing,catalogErrors,staff:input.staff,settings:input.settings,now});
 const attention=attentionFor(all,input.can);
 return {kpis:dashboardKpis(input.accounts,now),funnel:orderFunnel(input.accounts),attention,attentionTotal:attention.length,catalogErrors:catalogErrors.length,computedAt:now};
}

// ---------- Audit: server-side filter and pages ----------
export type AuditPageQuery={actor?:string;entity?:string;from?:number|null;to?:number|null;q?:string;page?:number;pageSize?:number};
type AuditRow={id:string;actor_id:string;actor_email:string;action:string;entity_type:string;entity_id:string|null;details:string|null;created_at:number};
const toEvent=(row:AuditRow):AuditEvent=>({id:row.id,actorId:row.actor_id,actorEmail:row.actor_email,action:row.action,entityType:row.entity_type,entityId:row.entity_id??undefined,details:row.details??undefined,createdAt:row.created_at});
function auditWhere(query:AuditPageQuery){
 const clauses:string[]=[],binds:(string|number)[]=[];
 if(query.actor&&query.actor!=='all'){clauses.push('actor_email=?');binds.push(query.actor.toLowerCase().slice(0,320))}
 if(query.entity&&query.entity!=='all'){clauses.push('entity_type=?');binds.push(query.entity.slice(0,80))}
 if(typeof query.from==='number'){clauses.push('created_at>=?');binds.push(query.from)}
 if(typeof query.to==='number'){clauses.push('created_at<=?');binds.push(query.to)}
 const q=query.q?.trim().slice(0,120);
 if(q){clauses.push("(action LIKE ? OR entity_type LIKE ? OR coalesce(entity_id,'') LIKE ? OR actor_email LIKE ? OR coalesce(details,'') LIKE ?)");const like=`%${q.replace(/[%_]/g,'')}%`;binds.push(like,like,like,like,like)}
 return {where:clauses.length?' WHERE '+clauses.join(' AND '):'',binds};
}
export async function auditPage(query:AuditPageQuery){
 const db=database(),{where,binds}=auditWhere(query);
 const pageSize=Math.min(Math.max(1,query.pageSize??auditPageSize),200);
 const total=(await db.prepare(`SELECT COUNT(*) count FROM market_audit_events${where}`).bind(...binds).first<{count:number}>())?.count??0;
 const pages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(Math.max(1,query.page??1),pages);
 const rows=await db.prepare(`SELECT id,actor_id,actor_email,action,entity_type,entity_id,details,created_at FROM market_audit_events${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...binds,pageSize,(page-1)*pageSize).all<AuditRow>();
 return {events:rows.results.map(toEvent),total,page,pages,pageSize};
}
/** Up to 5000 matching events for the CSV export, newest first. */
export async function auditExport(query:AuditPageQuery){
 const {where,binds}=auditWhere(query);
 const rows=await database().prepare(`SELECT id,actor_id,actor_email,action,entity_type,entity_id,details,created_at FROM market_audit_events${where} ORDER BY created_at DESC LIMIT 5000`).bind(...binds).all<AuditRow>();
 return rows.results.map(toEvent);
}
/** Distinct authors and entity types for the filter controls (cheap, indexed). */
export async function auditFacets(){
 const db=database();
 const [actors,entities]=await Promise.all([
  db.prepare('SELECT DISTINCT actor_email FROM market_audit_events ORDER BY actor_email LIMIT 200').all<{actor_email:string}>(),
  db.prepare('SELECT DISTINCT entity_type FROM market_audit_events ORDER BY entity_type LIMIT 50').all<{entity_type:string}>(),
 ]);
 return {actors:actors.results.map(row=>row.actor_email),entities:entities.results.map(row=>row.entity_type)};
}

// ---------- Customer notes (migration 0011) ----------
export type CustomerNote={id:string;customerId:string;authorEmail:string;text:string;createdAt:number};
/** Before migration 0011 the table is missing: the card then shows no notes instead of failing. */
export async function customerNotes(customerId:string):Promise<CustomerNote[]>{
 try{
  const rows=await database().prepare('SELECT id,customer_id,author_email,text,created_at FROM market_customer_notes WHERE customer_id=? ORDER BY created_at DESC LIMIT 100').bind(customerId).all<{id:string;customer_id:string;author_email:string;text:string;created_at:number}>();
  return rows.results.map(row=>({id:row.id,customerId:row.customer_id,authorEmail:row.author_email,text:row.text,createdAt:row.created_at}));
 }catch(error){console.error('Customer notes read failed',error);return []}
}
export async function addCustomerNote(customerId:string,text:string,user:{userId:string;email:string}):Promise<CustomerNote>{
 const note:CustomerNote={id:crypto.randomUUID(),customerId,authorEmail:user.email.toLowerCase(),text:text.trim().slice(0,1000),createdAt:Date.now()};
 if(!note.text)throw new HttpError(400,'err_16');
 try{await database().prepare('INSERT INTO market_customer_notes (id,customer_id,author_id,author_email,text,created_at) VALUES (?,?,?,?,?,?)').bind(note.id,customerId,user.userId,note.authorEmail,note.text,note.createdAt).run()}
 catch(error){console.error('Customer note write failed',error);throw new HttpError(503,'err_57')}
 return note;
}

// ---------- Team ----------
/** Last session start per staff email (market_auth_sessions keeps the sign-in email); an older schema gives nothing. */
export async function staffLastSignIns(emails:string[]):Promise<Record<string,number>>{
 const result:Record<string,number>={};
 if(!emails.length)return result;
 try{
  for(let start=0;start<emails.length;start+=90){
   const chunk=emails.slice(start,start+90).map(email=>email.toLowerCase());
   const rows=await database().prepare(`SELECT email,MAX(created_at) last FROM market_auth_sessions WHERE email IN (${chunk.map(()=>'?').join(',')}) GROUP BY email`).bind(...chunk).all<{email:string;last:number}>();
   for(const row of rows.results)if(row.email)result[row.email.toLowerCase()]=row.last;
  }
 }catch(error){console.error('Staff sign-in read failed',error)}
 return result;
}
export async function disableStaffMember(email:string):Promise<StaffMember>{
 const normalized=email.trim().toLowerCase(),now=Date.now();
 const result=await database().prepare("UPDATE market_staff_directory SET status='disabled',updated_at=? WHERE email=?").bind(now,normalized).run();
 if(!result.meta.changes)throw new HttpError(404,'err_5');
 const member=(await staffMembers()).find(item=>item.email===normalized);
 if(!member)throw new HttpError(404,'err_5');
 return member;
}

// ---------- System status ----------
export type SystemStatus={
 db:{ok:boolean;latencyMs:number};
 fx:{rate:number;source:string;cbuDate?:string;updatedAt?:number};
 pricing:{version:string;revision?:number;updatedAt:number};
 projection:{lastSyncAt:number|null;customers:number;orders:number};
 backup:{lastAt:number|null;records:number|null;checksum?:string};
 customerNotesTable:boolean;
 checkedAt:number;
};
export async function systemStatus():Promise<SystemStatus>{
 const db=database(),started=Date.now();
 let dbOk=true;
 try{await db.prepare('SELECT 1').first()}catch{dbOk=false}
 const latencyMs=Date.now()-started;
 const {pricing}=await pricingAndPolicy();
 const [sync,customers,orders,backup,notes]=await Promise.all([
  db.prepare('SELECT MAX(updated_at) at FROM market_customers').first<{at:number|null}>().catch(()=>null),
  db.prepare('SELECT COUNT(*) count FROM market_customers').first<{count:number}>().catch(()=>null),
  db.prepare('SELECT COUNT(*) count FROM market_order_records').first<{count:number}>().catch(()=>null),
  db.prepare('SELECT record_count,checksum,created_at FROM market_backup_exports ORDER BY created_at DESC LIMIT 1').first<{record_count:number;checksum:string;created_at:number}>().catch(()=>null),
  db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='market_customer_notes'").first<{name:string}>().catch(()=>null),
 ]);
 return {
  db:{ok:dbOk,latencyMs},
  fx:{rate:pricing.fx,source:pricing.fxSource,cbuDate:pricing.fxCbuDate,updatedAt:pricing.fxUpdatedAt},
  pricing:{version:pricing.version,revision:pricing.revision,updatedAt:pricing.updatedAt},
  projection:{lastSyncAt:sync?.at??null,customers:customers?.count??0,orders:orders?.count??0},
  backup:{lastAt:backup?.created_at??null,records:backup?.record_count??null,checksum:backup?.checksum?.slice(0,12)},
  customerNotesTable:!!notes,
  checkedAt:Date.now(),
 };
}
/** Everything the overview needs when the route already holds accounts, pricing and staff. */
export async function dashboardFor(can:(permission:Permission)=>boolean,accounts?:DashboardAccount[],pricing?:Pricing,staff?:StaffMember[]){
 const [rows,settings,current,members]=await Promise.all([accounts??operatorAccounts(),adminSettings(),pricing?Promise.resolve(pricing):pricingAndPolicy().then(value=>value.pricing),staff??(can('staff.manage')?staffMembers():Promise.resolve([]))]);
 return {settings,dashboard:await adminDashboard({accounts:rows,pricing:current,staff:members,settings,can})};
}

// ---------- Investor showcase (Admin → «Для инвестора», GET /api/operations?investor=1) ----------
/**
 * The anonymised snapshot behind the investor tab: every order in the books (market_order_finance) with its stage and
 * source host (market_order_records), the «Доставлен» date (market_order_events), the ledger expenses linked to it
 * (market_ledger_entries) and, from the account documents, the product country / category and the customers' carts.
 * Customers become c1, c2, … — no emails or names leave the server; the test flag is computed here from the email domain.
 * A source that cannot be read gives nothing for its part instead of failing the page; `coverage` says what answered.
 */
export async function investorSnapshot(now=Date.now()):Promise<InvestorSnapshot>{
 const db=database();
 const read=async<T,>(label:string,work:()=>Promise<T>,fallback:T)=>{try{return await work()}catch(error){console.error(`Investor snapshot: ${label} read failed`,error);return fallback}};
 const [financeRows,recordRows,customerRows,ledgerRows,deliveredRows,accounts]=await Promise.all([
  read('finance',()=>db.prepare('SELECT order_id,customer_id,status,created_at,paid_at,month,goods,store_shipping,reserve,payable,commission,delivery,fx_gain,services,revenue FROM market_order_finance ORDER BY created_at ASC LIMIT 20000').all<{order_id:string;customer_id:string;status:OrderFinance['status'];created_at:number;paid_at:number|null;month:string|null;goods:number;store_shipping:number;reserve:number;payable:number;commission:number;delivery:number;fx_gain:number;services:number;revenue:number}>().then(rows=>rows.results),[]),
  read('records',()=>db.prepare('SELECT id,status,source_store,source_url FROM market_order_records LIMIT 20000').all<{id:string;status:string;source_store:string|null;source_url:string|null}>().then(rows=>rows.results),[]),
  read('customers',()=>db.prepare('SELECT id,email,created_at FROM market_customers LIMIT 20000').all<{id:string;email:string;created_at:number}>().then(rows=>rows.results),[]),
  read('ledger',()=>db.prepare('SELECT order_id,kind,SUM(amount_uzs) total FROM market_ledger_entries WHERE voided_at IS NULL AND order_id IS NOT NULL GROUP BY order_id,kind LIMIT 20000').all<{order_id:string;kind:string;total:number}>().then(rows=>rows.results),[]),
  read('events',()=>db.prepare("SELECT order_id,MIN(created_at) at FROM market_order_events WHERE event_type='status' AND payload=? GROUP BY order_id LIMIT 20000").bind(JSON.stringify({text:statuses[5]})).all<{order_id:string;at:number}>().then(rows=>rows.results),[]),
  read('accounts',()=>operatorAccounts(),[]),
 ]);
 const finance:OrderFinance[]=financeRows.map(r=>({orderId:r.order_id,customerId:r.customer_id,status:r.status,createdAt:r.created_at,...(r.paid_at!==null?{paidAt:r.paid_at}:{}),...(r.month?{month:r.month}:{}),goods:r.goods,storeShipping:r.store_shipping,reserve:r.reserve,payable:r.payable,commission:r.commission,delivery:r.delivery,fxGain:r.fx_gain,services:r.services,revenue:r.revenue}));
 const records=Object.fromEntries(recordRows.map(row=>[row.id,{status:row.status,sourceUrl:row.source_url,sourceStore:row.source_store}]));
 const linkedExpenses:Record<string,number>={};
 for(const row of ledgerRows)if(isExpenseKind(row.kind))linkedExpenses[row.order_id]=(linkedExpenses[row.order_id]??0)+row.total;
 const deliveredAt=Object.fromEntries(deliveredRows.map(row=>[row.order_id,row.at]));
 const orderMeta:Record<string,{country?:string;category?:string;host?:string}>={},cartLines:Record<string,number>={};
 for(const account of accounts){
  cartLines[account.id]=account.state.cart.length;
  for(const order of account.state.orders)orderMeta[order.id]={...(order.product.country?{country:order.product.country}:{}),...(order.product.category?{category:order.product.category}:{}),...(hostOf(order.product.sourceUrl)?{host:hostOf(order.product.sourceUrl)}:{})};
 }
 return buildInvestorSnapshot({finance,records,customers:customerRows.map(row=>({id:row.id,email:row.email,createdAt:row.created_at})),linkedExpenses,deliveredAt,orderMeta,cartLines,accountsRead:accounts.length,now});
}
