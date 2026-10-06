import {env,waitUntil} from 'cloudflare:workers';
import {currentUser} from '@/lib/auth/server';
import {blank,parseState,pricingSchema,tariff,upgradePricing,type Pricing,type State} from './domain';
import {defaultPolicy,policySchema,type Policy} from './policy';
import {cbuUsdUrl,fxRefreshDue,parseCbuRate,withCbuRate} from './fx';
import {foreignOrderIds,writeProjection} from './projection';
import {apiErrorMessage,requestLocale,serverError} from './i18n';
import {emailVerifiedSignIn,hasPermission,resolveAccess,type Permission,type StaffAccess,type StaffRole,type StaffStatus} from './access';
export type {Permission,StaffAccess,StaffRole,StaffStatus};
export function database(){if(!env.DB)throw Error('Серверное хранилище пока недоступно.');return env.DB}
export function deferBackground(task:Promise<unknown>,label:string){waitUntil(task.catch(error=>console.error(label,error)))}
export async function identity(){const user=await currentUser();if(!user)throw new HttpError(401, 'err_1');return user}
// Only a verified email sign-in (email code or Google) carries an email, so phone/Telegram users can never match.
export function operator(email:string){return !!email&&!!env.ATLAS_OPERATOR_EMAIL&&email.toLowerCase()===env.ATLAS_OPERATOR_EMAIL.toLowerCase()}
/**
 * Access of the signed-in user: ATLAS_OPERATOR_EMAIL is always admin; otherwise an `active` row of
 * market_staff_directory with the same email, and only when the sign-in method verified that email
 * (email code, Google, Apple). Before migration 0005 the table may be missing: then staff get nothing.
 */
export async function accessFor(user:{email:string;method?:string}):Promise<StaffAccess>{
 const operatorEmail=env.ATLAS_OPERATOR_EMAIL??null;
 const direct=resolveAccess({email:user.email,method:user.method,operatorEmail});
 if(direct.operator||!emailVerifiedSignIn(user))return direct;
 let staff:{role:string;status:string}|null=null;
 try{staff=await database().prepare('SELECT role,status FROM market_staff_directory WHERE email=?').bind(user.email.trim().toLowerCase()).first<{role:string;status:string}>()}catch(error){console.error('Staff directory read failed',error)}
 return resolveAccess({email:user.email,method:user.method,operatorEmail,staff});
}
/** 403 `err_50` unless the resolved access holds the permission (admin holds all). */
export function assertPermission(access:StaffAccess,permission:Permission){if(!hasPermission(access,permission))throw new HttpError(403, 'err_50');return access}
/** Resolves the user's access and requires one permission; returns the access for further checks. */
export async function requirePermission(user:{email:string;method?:string},permission:Permission){return assertPermission(await accessFor(user),permission)}
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)throw new HttpError(403, 'err_2')}
/** Counts one use of `name` in a fixed window; past `max`, refuses with 429 and the given error code. */
export async function rateLimit(name:string,max:number,windowMs:number,errorCode='err_20'){
 const now=Date.now(),key=`${name}:${Math.floor(now/windowMs)}`;
 const row=await database().prepare('INSERT INTO market_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+windowMs).first<{count:number}>();
 if(!row||row.count>max)throw new HttpError(429,errorCode);
}
export const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function account(user:{userId:string;platformUserId?:string|null;displayName:string}){
 const db=database();
 const select=()=>db.prepare('SELECT name,state,revision,created_at FROM market_accounts WHERE user_id=?').bind(user.userId).first<{name:string;state:string;revision:number;created_at:number}>();
 let row=await select();
 if(!row){
  const now=Date.now(),writes=[];
  if(user.platformUserId&&user.platformUserId!==user.userId)writes.push(db.prepare('INSERT OR IGNORE INTO market_accounts (user_id,name,state,revision,created_at,updated_at) SELECT ?,name,state,revision,created_at,updated_at FROM market_accounts WHERE user_id=?').bind(user.userId,user.platformUserId));
  writes.push(db.prepare('INSERT OR IGNORE INTO market_accounts (user_id,name,state,revision,created_at,updated_at) VALUES (?,?,?,0,?,?)').bind(user.userId,user.displayName,JSON.stringify(blank()),now,now));
  await db.batch(writes);
  row=await select();
 }
 if(!row)throw Error('Account unavailable');
 return {...row,state:parseState(row.state)};
}
/**
 * Saves the account document when `revision` still matches. `previous` is the document this save replaces (the
 * caller already holds it): the projection then writes only the orders that changed. Without it, a full sync.
 */
export async function persist(id:string,state:State,revision:number,previous?:State){
 const serialized=JSON.stringify(state);if(serialized.length>1000000)throw new HttpError(413, 'err_3');
 // A document the next read cannot parse would lock the customer out of the account: refuse to save it.
 try{parseState(serialized)}catch(error){throw new Error('Refused to save an account state that does not parse: '+(error as Error).message.slice(0,400))}
 const now=Date.now(),result=await database().prepare('UPDATE market_accounts SET state=?, revision=revision+1, updated_at=? WHERE user_id=? AND revision=?').bind(serialized,now,id,revision).run();
 if(!result.meta.changes)throw new HttpError(409, 'err_4');
 deferBackground(syncLatestOperationalProjection(id,previous),'Operational projection sync failed');
}

/**
 * Brings the projection up to the latest saved document. Each pass diffs against the document the previous pass
 * wrote (first pass: the document the save replaced), so a newer save that landed meanwhile is covered too, and a
 * pass that raced an older one rewrites the orders it may have overwritten. An incremental pass that fails falls
 * back to a full sync of the account once.
 */
async function syncLatestOperationalProjection(id:string,previous?:State){
 const db=database();
 let base:State|null=previous??null;
 for(let attempt=0;attempt<3;attempt++){
  const row=await db.prepare('SELECT state,revision,updated_at FROM market_accounts WHERE user_id=?').bind(id).first<{state:string;revision:number;updated_at:number}>();
  if(!row)return;
  const current=parseState(row.state);
  try{await syncOperationalProjection(id,current,row.updated_at,base)}
  catch(error){if(!base)throw error;console.error('Incremental projection sync failed; full sync of the account',error);await syncOperationalProjection(id,current,row.updated_at)}
  const latest=await db.prepare('SELECT revision FROM market_accounts WHERE user_id=?').bind(id).first<{revision:number}>();
  if(latest?.revision===row.revision)return;
  base=current;
 }
 console.error('Operational projection sync remains behind canonical account state');
}

/**
 * Writes the operational projection of one account (lib/market/projection.ts). With `previous` only changed
 * orders are written (every account save); without it every order (full rebuild, account deletion).
 */
export async function syncOperationalProjection(id:string,state:State,now=Date.now(),previous?:State|null){
 const db=database();
 const {orders:written,foreign}=await writeProjection(db,id,state,{now,previous});
 // Auto ledger: the written orders, plus (incrementally) unchanged orders whose auto entries were skipped for a
 // closed month, so reopening the month retries them on the customer's next save as before.
 let orders=written;
 if(previous&&state.orders.length)try{
  const {skippedAutoEntries}=await import('./finance-server');
  const retry=new Set((await skippedAutoEntries()).map(item=>item.orderId)),ids=new Set(written.map(order=>order.id));
  const extra=state.orders.filter(order=>retry.has(order.id)&&!ids.has(order.id));
  if(extra.length){const foreignExtra=await foreignOrderIds(db,id,extra.map(order=>order.id));orders=[...written,...extra.filter(order=>!foreignExtra.has(order.id)&&!foreign.has(order.id))]}
 }catch(error){console.error('Skipped auto entries read failed',error)}
 // Auto ledger entries from order events (lib/market/finance-auto.ts): idempotent, manual rows untouched. Loaded lazily to avoid an import cycle.
 if(orders.length)try{const {syncAutoLedger}=await import('./finance-server');await syncAutoLedger(id,orders,state.entries,now)}catch(error){console.error('Auto ledger sync failed',error)}
}

export async function rebuildOperationalProjection(){
 const rows=await operatorAccounts();for(const row of rows)await syncOperationalProjection(row.id,row.state,row.updatedAt);return rows.length;
}

export async function customerStatus(id:string){const row=await database().prepare('SELECT status FROM market_customers WHERE id=?').bind(id).first<{status:string}>();return row?.status??'active'}
export async function setCustomerStatus(id:string,status:'active'|'review'|'blocked'){const result=await database().prepare('UPDATE market_customers SET status=?,updated_at=? WHERE id=?').bind(status,Date.now(),id).run();if(!result.meta.changes)throw new HttpError(404, 'err_5');}
export async function operationalHealth(){
 const db=database();const [customers,orders,fees,events]=await Promise.all([
  db.prepare('SELECT COUNT(*) count FROM market_customers').first<{count:number}>(),db.prepare('SELECT COUNT(*) count FROM market_order_records').first<{count:number}>(),db.prepare('SELECT COUNT(*) count FROM market_order_fee_lines').first<{count:number}>(),db.prepare('SELECT COUNT(*) count FROM market_order_events').first<{count:number}>()
 ]);return{customers:customers?.count??0,orders:orders?.count??0,feeLines:fees?.count??0,events:events?.count??0,checkedAt:Date.now()};
}
export async function operationalCustomers(){const rows=await database().prepare('SELECT id,status FROM market_customers').all<{id:string;status:'active'|'review'|'blocked'}>();return Object.fromEntries(rows.results.map(row=>[row.id,row.status]));}
function parsePricingValue(value:string|undefined):Pricing{if(!value)return tariff;try{const parsed=pricingSchema.safeParse(JSON.parse(value));return parsed.success?upgradePricing(parsed.data):tariff}catch{return tariff}}
function parsePolicyValue(value:string|undefined):Policy{if(!value)return defaultPolicy;try{const parsed=policySchema.safeParse(JSON.parse(value));return parsed.success?parsed.data:defaultPolicy}catch{return defaultPolicy}}
export async function pricing():Promise<Pricing>{const row=await database().prepare("SELECT value FROM market_settings WHERE key='pricing'").first<{value:string}>();return scheduleFxRefresh(parsePricingValue(row?.value))}
export async function pricingAndPolicy():Promise<{pricing:Pricing;policy:Policy}>{const rows=await database().prepare("SELECT key,value FROM market_settings WHERE key IN ('pricing','policy')").all<{key:string;value:string}>();const values=new Map(rows.results.map(row=>[row.key,row.value]));return {pricing:scheduleFxRefresh(parsePricingValue(values.get('pricing'))),policy:parsePolicyValue(values.get('policy'))}}
/** A tariff on the Central Bank rate reads it again in the background when it is older than 6 hours. */
function scheduleFxRefresh(current:Pricing){if(fxRefreshDue(current))deferBackground(refreshCbuFx(),'CBU rate refresh failed');return current}
/**
 * Read the CBU USD rate and store it in the tariff (rate × markup, new version when the soum rate changes).
 * One refresh at a time (D1 lease); the write applies only if the tariff did not change meanwhile.
 */
export async function refreshCbuFx(now=Date.now()):Promise<Pricing|null>{
 const db=database();
 const lease=await db.prepare('INSERT INTO market_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,expires_at=excluded.expires_at WHERE market_rate_limits.expires_at<? RETURNING key').bind('atlas:fx-refresh:lease',now+120000,now).first<{key:string}>();
 if(!lease)return null;
 // A failed attempt keeps the 2-minute lease, so the bank is not asked again on every request.
 // Workers support only "follow" or "manual": a redirect is not followed and counts as a failed read.
 const response=await fetch(cbuUsdUrl,{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(8000)});
 const text=response.status===200?await response.text():'';
 const cbu=text.length<64000?parseCbuRate(JSON.parse(text||'null')):null;
 if(!cbu)throw Error('CBU rate response was not usable');
 const row=await db.prepare("SELECT value FROM market_settings WHERE key='pricing'").first<{value:string}>();
 const current=parsePricingValue(row?.value);
 let result:Pricing|null=current;
 if(current.fxSource==='cbu'){
  const next=withCbuRate(current,cbu,now);
  const value=JSON.stringify(next);
  const write=row
   ?await db.prepare("UPDATE market_settings SET value=?,updated_at=?,updated_by=? WHERE key='pricing' AND value=?").bind(value,now,'system:cbu',row.value).run()
   :await db.prepare("INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES ('pricing',?,?,?) ON CONFLICT(key) DO NOTHING").bind(value,now,'system:cbu').run();
  result=write.meta.changes?next:null;
 }
 await db.prepare('DELETE FROM market_rate_limits WHERE key=?').bind('atlas:fx-refresh:lease').run();
 return result;
}
export async function savePricing(next:Pricing,userId:string){await database().prepare("INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES ('pricing',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(JSON.stringify(next),next.updatedAt,userId).run()}
export async function policy():Promise<Policy>{const row=await database().prepare("SELECT value FROM market_settings WHERE key='policy'").first<{value:string}>();return parsePolicyValue(row?.value)}
export async function savePolicy(next:Policy,userId:string){await database().prepare("INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES ('policy',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(JSON.stringify(next),next.updatedAt,userId).run()}
export async function operatorAccounts(){const rows=await database().prepare('SELECT user_id,name,state,revision,updated_at FROM market_accounts ORDER BY updated_at DESC LIMIT 200').all<{user_id:string;name:string;state:string;revision:number;updated_at:number}>();return rows.results.map(row=>({id:row.user_id,name:row.name,state:parseState(row.state),revision:row.revision,updatedAt:row.updated_at}))}
export async function storedAccount(id:string){const row=await database().prepare('SELECT user_id,name,state,revision,updated_at FROM market_accounts WHERE user_id=?').bind(id).first<{user_id:string;name:string;state:string;revision:number;updated_at:number}>();if(!row)throw new HttpError(404, 'err_6');return {id:row.user_id,name:row.name,state:parseState(row.state),revision:row.revision,updatedAt:row.updated_at}}

export type StaffMember={id:string;email:string;displayName:string;role:StaffRole;status:StaffStatus;createdAt:number;updatedAt:number};
export type AuditEvent={id:string;actorId:string;actorEmail:string;action:string;entityType:string;entityId?:string;details?:string;createdAt:number};

export async function ensurePrimaryOperator(user:{userId:string;email:string;displayName:string}){
 const now=Date.now();
 await database().prepare("INSERT INTO market_staff_directory (id,email,display_name,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,role='admin',status='active',updated_at=excluded.updated_at").bind(user.userId,user.email.toLowerCase(),user.displayName,'admin','active',now,now).run();
}
export async function staffMembers():Promise<StaffMember[]>{
 const rows=await database().prepare('SELECT id,email,display_name,role,status,created_at,updated_at FROM market_staff_directory ORDER BY CASE status WHEN \'active\' THEN 0 WHEN \'invited\' THEN 1 ELSE 2 END, updated_at DESC LIMIT 100').all<{id:string;email:string;display_name:string;role:StaffRole;status:StaffStatus;created_at:number;updated_at:number}>();
 return rows.results.map(row=>({id:row.id,email:row.email,displayName:row.display_name,role:row.role,status:row.status,createdAt:row.created_at,updatedAt:row.updated_at}));
}
export async function saveStaffMember(value:{email:string;displayName:string;role:StaffRole;status:StaffStatus}){
 const now=Date.now(),email=value.email.trim().toLowerCase(),id='staff:'+email;
 await database().prepare('INSERT INTO market_staff_directory (id,email,display_name,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,role=excluded.role,status=excluded.status,updated_at=excluded.updated_at').bind(id,email,value.displayName.trim(),value.role,value.status,now,now).run();
 return {id,email,displayName:value.displayName.trim(),role:value.role,status:value.status,createdAt:now,updatedAt:now} satisfies StaffMember;
}
export async function recordAudit(user:{userId:string;email:string},action:string,entityType:string,entityId?:string,details?:unknown){
 const safeDetails=details===undefined?null:JSON.stringify(details).slice(0,4000);
 await database().prepare('INSERT INTO market_audit_events (id,actor_id,actor_email,action,entity_type,entity_id,details,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,user.email.toLowerCase(),action.slice(0,100),entityType.slice(0,80),entityId?.slice(0,320)??null,safeDetails,Date.now()).run();
}
export async function auditEvents():Promise<AuditEvent[]>{
 const rows=await database().prepare('SELECT id,actor_id,actor_email,action,entity_type,entity_id,details,created_at FROM market_audit_events ORDER BY created_at DESC LIMIT 100').all<{id:string;actor_id:string;actor_email:string;action:string;entity_type:string;entity_id:string|null;details:string|null;created_at:number}>();
 return rows.results.map(row=>({id:row.id,actorId:row.actor_id,actorEmail:row.actor_email,action:row.action,entityType:row.entity_type,entityId:row.entity_id??undefined,details:row.details??undefined,createdAt:row.created_at}));
}
export async function failure(error:unknown,request?:Request){
 const locale=requestLocale(request);
 if(error instanceof HttpError){
  const errorCode=/^err_\d+$/.test(error.message)?error.message:undefined;
  const message=errorCode?serverError(locale,errorCode):locale==='ru'?error.message:apiErrorMessage(error.status,locale);
  return json({error:message,...(errorCode?{errorCode}:{})},error.status);
 }
 console.error(error);
 try{await database().prepare('INSERT INTO market_operational_errors (id,area,message,details,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),'api','Unhandled request failure',error instanceof Error?JSON.stringify({name:error.name,stack:error.stack?.slice(0,1800)}):null,Date.now()).run()}catch{}
 return json({error:apiErrorMessage(503,locale)},503);
}

// Browser reports (areas "client" and "csp") count repeats and remember the last time and route they were seen.
export async function errorSummary(){const field=(path:string)=>`CASE WHEN json_valid(details) THEN json_extract(details,'${path}') END`;const rows=await database().prepare(`SELECT id,area,message,created_at,resolved_at,${field('$.count')} AS count,${field('$.lastSeen')} AS last_seen,${field('$.route')} AS route FROM market_operational_errors ORDER BY coalesce(${field('$.lastSeen')},created_at) DESC LIMIT 100`).all<{id:string;area:string;message:string;created_at:number;resolved_at:number|null;count:number|null;last_seen:number|null;route:string|null}>();return rows.results.map(row=>({id:row.id,area:row.area,message:row.message,createdAt:row.created_at,resolvedAt:row.resolved_at??undefined,...(typeof row.count==='number'?{count:row.count}:{}),...(typeof row.last_seen==='number'?{lastSeen:row.last_seen}:{}),...(row.route?{route:row.route}:{})}))}

export async function requestJson(request:Request,maxBytes=1100000):Promise<unknown>{
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400, 'err_7');
 let text='',size=0;const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new HttpError(413, 'err_8')}text+=decoder.decode(value,{stream:true})}text+=decoder.decode();try{return JSON.parse(text)}catch{throw new HttpError(400, 'err_9')}
}
