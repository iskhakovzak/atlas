import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {blank,parseState,pricingSchema,tariff,orderPayable,type Pricing,type State} from './domain';
import {defaultPolicy,policySchema,type Policy} from './policy';
export function database(){if(!env.DB)throw Error('Серверное хранилище пока недоступно.');return env.DB}
export async function identity(){const user=await getChatGPTUser();if(!user)throw new HttpError(401,'Войдите, чтобы продолжить.');return user}
export function operator(email:string){return !!env.ATLAS_OPERATOR_EMAIL&&email.toLowerCase()===env.ATLAS_OPERATOR_EMAIL.toLowerCase()}
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)throw new HttpError(403,'Недопустимый источник запроса.')}
export const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function account(user:{userId:string;platformUserId?:string|null;displayName:string}){const now=Date.now(),db=database();if(user.platformUserId&&user.platformUserId!==user.userId)await db.prepare('INSERT OR IGNORE INTO market_accounts (user_id,name,state,revision,created_at,updated_at) SELECT ?,name,state,revision,created_at,updated_at FROM market_accounts WHERE user_id=?').bind(user.userId,user.platformUserId).run();await db.prepare('INSERT OR IGNORE INTO market_accounts (user_id,name,state,revision,created_at,updated_at) VALUES (?,?,?,0,?,?)').bind(user.userId,user.displayName,JSON.stringify(blank()),now,now).run();const row=await db.prepare('SELECT name,state,revision,created_at FROM market_accounts WHERE user_id=?').bind(user.userId).first<{name:string;state:string;revision:number;created_at:number}>();if(!row)throw Error('Account unavailable');return {...row,state:parseState(row.state)}}
export async function persist(id:string,state:State,revision:number){
 const serialized=JSON.stringify(state);if(serialized.length>1000000)throw new HttpError(413,'Достигнут лимит данных тестового профиля.');
 const now=Date.now(),result=await database().prepare('UPDATE market_accounts SET state=?, revision=revision+1, updated_at=? WHERE user_id=? AND revision=?').bind(serialized,now,id,revision).run();
 if(!result.meta.changes)throw new HttpError(409,'Заказ изменился в другой вкладке. Данные обновлены — повторите действие.');
 try{await syncOperationalProjection(id,state,now)}catch(error){console.error('Operational projection sync failed',error)}
}

export async function syncOperationalProjection(id:string,state:State,now=Date.now()){
 const db=database(),email=id.startsWith('email:')?id.slice(6):id;
 const statements=[db.prepare("INSERT INTO market_customers (id,email,name,phone,locale,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,phone=excluded.phone,locale=excluded.locale,updated_at=excluded.updated_at").bind(id,email,state.deliveryProfile?.recipient??email,state.deliveryProfile?.phone??null,state.communication.language,now,now)];
 for(const order of state.orders){
  statements.push(db.prepare('INSERT INTO market_order_records (id,customer_id,status,source_store,source_url,currency,total,assigned_role,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,source_store=excluded.source_store,source_url=excluded.source_url,currency=excluded.currency,total=excluded.total,assigned_role=excluded.assigned_role,updated_at=excluded.updated_at').bind(order.id,id,order.cancelled?'cancelled':String(order.status),order.product.brand,order.product.sourceUrl??null,'UZS',orderPayable(order),order.assignment?.team??null,order.createdAt,now));
  statements.push(db.prepare('DELETE FROM market_order_fee_lines WHERE order_id=?').bind(order.id));
  const fees=[['item','Товар',order.quote.merchandise],['service','Сервис Atlas',order.quote.service],['buyout','Комиссия за выкуп',order.quote.buyout??0],['conversion','Конвертация',order.quote.conversion??0],['merchant_shipping','Доставка магазина',order.quote.sourceShipping??0],['international_shipping','Международная доставка',order.quote.shipping],['delivery_margin','Маржа доставки',order.quote.deliveryMargin??0],['international_reserve','Резерв доставки',order.quote.reserve],['optional_services','Дополнительные услуги',order.quote.optionalServices??0]] as const;
  for(const [kind,label,amount] of fees)statements.push(db.prepare('INSERT INTO market_order_fee_lines (id,order_id,kind,label,amount,currency,created_at) VALUES (?,?,?,?,?,?,?)').bind(`${order.id}:${kind}`,order.id,kind,label,amount,'UZS',order.createdAt));
  for(const adjustment of (order.changeRequests??[]).filter(item=>item.status==='approved'&&item.amountDelta!==0))statements.push(db.prepare('INSERT INTO market_order_fee_lines (id,order_id,kind,label,amount,currency,created_at) VALUES (?,?,?,?,?,?,?)').bind(`${order.id}:adjustment:${adjustment.id}`,order.id,`adjustment_${adjustment.kind}`,adjustment.title,adjustment.amountDelta,'UZS',adjustment.respondedAt??adjustment.createdAt));
  for(const event of order.history)statements.push(db.prepare('INSERT OR IGNORE INTO market_order_events (id,order_id,actor_id,event_type,payload,created_at) VALUES (?,?,?,?,?,?)').bind(`${order.id}:status:${event.at}`,order.id,null,'status',JSON.stringify({text:event.text}),event.at));
 }
 await db.batch(statements);
}

export async function rebuildOperationalProjection(){
 const rows=await operatorAccounts();for(const row of rows)await syncOperationalProjection(row.id,row.state,row.updatedAt);return rows.length;
}

export async function customerStatus(id:string){const row=await database().prepare('SELECT status FROM market_customers WHERE id=?').bind(id).first<{status:string}>();return row?.status??'active'}
export async function setCustomerStatus(id:string,status:'active'|'review'|'blocked'){const result=await database().prepare('UPDATE market_customers SET status=?,updated_at=? WHERE id=?').bind(status,Date.now(),id).run();if(!result.meta.changes)throw new HttpError(404,'Клиент не найден в операционной базе. Выполните синхронизацию.');}
export async function operationalHealth(){
 const db=database();const [customers,orders,fees,events]=await Promise.all([
  db.prepare('SELECT COUNT(*) count FROM market_customers').first<{count:number}>(),db.prepare('SELECT COUNT(*) count FROM market_order_records').first<{count:number}>(),db.prepare('SELECT COUNT(*) count FROM market_order_fee_lines').first<{count:number}>(),db.prepare('SELECT COUNT(*) count FROM market_order_events').first<{count:number}>()
 ]);return{customers:customers?.count??0,orders:orders?.count??0,feeLines:fees?.count??0,events:events?.count??0,checkedAt:Date.now()};
}
export async function operationalCustomers(){const rows=await database().prepare('SELECT id,status FROM market_customers').all<{id:string;status:'active'|'review'|'blocked'}>();return Object.fromEntries(rows.results.map(row=>[row.id,row.status]));}
export async function pricing():Promise<Pricing>{const row=await database().prepare("SELECT value FROM market_settings WHERE key='pricing'").first<{value:string}>();if(!row)return tariff;try{const parsed=pricingSchema.safeParse(JSON.parse(row.value));return parsed.success?parsed.data:tariff}catch{return tariff}}
export async function savePricing(next:Pricing,userId:string){await database().prepare("INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES ('pricing',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(JSON.stringify(next),next.updatedAt,userId).run()}
export async function policy():Promise<Policy>{const row=await database().prepare("SELECT value FROM market_settings WHERE key='policy'").first<{value:string}>();if(!row)return defaultPolicy;try{const parsed=policySchema.safeParse(JSON.parse(row.value));return parsed.success?parsed.data:defaultPolicy}catch{return defaultPolicy}}
export async function savePolicy(next:Policy,userId:string){await database().prepare("INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES ('policy',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(JSON.stringify(next),next.updatedAt,userId).run()}
export async function operatorAccounts(){const rows=await database().prepare('SELECT user_id,name,state,revision,updated_at FROM market_accounts ORDER BY updated_at DESC LIMIT 200').all<{user_id:string;name:string;state:string;revision:number;updated_at:number}>();return rows.results.map(row=>({id:row.user_id,name:row.name,state:parseState(row.state),revision:row.revision,updatedAt:row.updated_at}))}
export async function storedAccount(id:string){const row=await database().prepare('SELECT user_id,name,state,revision,updated_at FROM market_accounts WHERE user_id=?').bind(id).first<{user_id:string;name:string;state:string;revision:number;updated_at:number}>();if(!row)throw new HttpError(404,'Профиль покупателя не найден.');return {id:row.user_id,name:row.name,state:parseState(row.state),revision:row.revision,updatedAt:row.updated_at}}

export type StaffRole='support'|'procurement'|'warehouse'|'finance'|'admin';
export type StaffStatus='invited'|'active'|'disabled';
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
export async function failure(error:unknown){if(error instanceof HttpError)return json({error:error.message},error.status);console.error(error);try{await database().prepare('INSERT INTO market_operational_errors (id,area,message,details,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),'api','Unhandled request failure',error instanceof Error?JSON.stringify({name:error.name,stack:error.stack?.slice(0,1800)}):null,Date.now()).run()}catch{}return json({error:'Не удалось выполнить запрос. Попробуйте ещё раз.'},503)}

export async function errorSummary(){const rows=await database().prepare('SELECT id,area,message,created_at,resolved_at FROM market_operational_errors ORDER BY created_at DESC LIMIT 100').all<{id:string;area:string;message:string;created_at:number;resolved_at:number|null}>();return rows.results.map(row=>({id:row.id,area:row.area,message:row.message,createdAt:row.created_at,resolvedAt:row.resolved_at??undefined}))}

export async function requestJson(request:Request,maxBytes=1100000):Promise<unknown>{
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Пустой запрос.');
 let text='',size=0;const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new HttpError(413,'Слишком большой запрос.')}text+=decoder.decode(value,{stream:true})}text+=decoder.decode();try{return JSON.parse(text)}catch{throw new HttpError(400,'Некорректный JSON.')}
}
