// The normalized operational projection of one account (migrations 0004 and 0009): customer row, order records,
// fee lines, status events and the books row of each order. The JSON document stays the source of truth; these
// rows are rebuilt from it. Kept apart from server.ts (no cloudflare:workers) so tests run it against SQLite.
import {orderPayable,type Order,type State} from './domain.ts';
import {orderFinance} from './finance.ts';

/** The part of a D1 binding the projection uses. */
export type ProjectionStatement={
 bind(...values:unknown[]):ProjectionStatement;
 all<T=Record<string,unknown>>():Promise<{results:T[]}>;
};
export type ProjectionDb={prepare(sql:string):ProjectionStatement;batch(statements:ProjectionStatement[]):Promise<unknown>};

/**
 * Everything the projection of one order is derived from: the order itself and its demo payment entry (the auto
 * ledger reads it). Two equal fingerprints give identical rows, so an unchanged order needs no write.
 */
export function orderFingerprint(order:Order,entries:State['entries']){
 const payment=entries.find(entry=>entry.id==='demo-payment:'+order.id);
 return JSON.stringify(payment?[order,payment]:[order]);
}

/**
 * Orders whose projection must be written. Without a previous document (first sync, operator's full rebuild,
 * account deletion) every order; otherwise only new orders and orders whose fingerprint changed.
 */
export function changedOrders(state:State,previous?:State|null):Order[]{
 if(!previous)return state.orders;
 const before=new Map(previous.orders.map(order=>[order.id,orderFingerprint(order,previous.entries)]));
 return state.orders.filter(order=>before.get(order.id)!==orderFingerprint(order,state.entries));
}

/**
 * Order IDs present in the previous document and missing now. The domain never removes an order (cancelling is a
 * flag), and the law keeps order and accounting rows, so the projection keeps them too: the caller only logs this.
 */
export function vanishedOrderIds(state:State,previous?:State|null){
 if(!previous)return [];
 const now=new Set(state.orders.map(order=>order.id));
 return previous.orders.map(order=>order.id).filter(id=>!now.has(id));
}

/** Order IDs from `orderIds` that the operational tables already hold for another customer. */
export async function foreignOrderIds(db:ProjectionDb,id:string,orderIds:string[]){
 const foreign=new Set<string>();
 // D1 binds at most 100 values per statement.
 for(let start=0;start<orderIds.length;start+=90){
  const chunk=orderIds.slice(start,start+90);
  const rows=await db.prepare(`SELECT id FROM market_order_records WHERE customer_id<>? AND id IN (${chunk.map(()=>'?').join(',')})`).bind(id,...chunk).all<{id:string}>();
  for(const row of rows.results)foreign.add(row.id);
 }
 return foreign;
}

/** Fee lines of one order as [id, kind, label, amount, created_at]. */
export function feeLines(order:Order){
 const fees=[['item','Товар',order.quote.merchandise],['service','Сервис Atlas',order.quote.service],['buyout','Комиссия за выкуп',order.quote.buyout??0],['conversion','Конвертация',order.quote.conversion??0],['merchant_shipping','Доставка магазина',order.quote.sourceShipping??0],['international_shipping','Международная доставка',order.quote.shipping],['delivery_margin','Маржа доставки',order.quote.deliveryMargin??0],['international_reserve','Резерв доставки',order.quote.reserve],['optional_services','Дополнительные услуги',order.quote.optionalServices??0],['customs_help','Оплата таможни через Atlas',order.quote.customsHelp??0],['customs_duty','Предоплата пошлины',order.quote.customsDuty??0]] as const;
 const lines:[string,string,string,number,number][]=fees.map(([kind,label,amount])=>[`${order.id}:${kind}`,kind,label,amount,order.createdAt]);
 for(const adjustment of (order.changeRequests??[]).filter(item=>item.status==='approved'&&item.amountDelta!==0))lines.push([`${order.id}:adjustment:${adjustment.id}`,`adjustment_${adjustment.kind}`,adjustment.title,adjustment.amountDelta,adjustment.respondedAt??adjustment.createdAt]);
 return lines;
}

/**
 * Writes the projection of `state` for customer `id` and returns the orders it wrote. With `previous` (the document
 * this save replaced) only changed orders are written: their record, fee lines (replaced), every history event
 * (INSERT OR IGNORE, so an order that missed a sync heals on its next change) and books row. The customer row is
 * always upserted (one statement; its updated_at is the "last sync" of the system screen).
 * An order number already used by another customer never overwrites their rows, fee lines or books.
 */
export async function writeProjection(db:ProjectionDb,id:string,state:State,options:{now:number;previous?:State|null}){
 const {now,previous}=options,email=id.startsWith('email:')?id.slice(6):id;
 const vanished=vanishedOrderIds(state,previous);
 if(vanished.length)console.error('Orders disappeared from an account document; projection rows kept',vanished.slice(0,10));
 const candidates=changedOrders(state,previous);
 const foreign=candidates.length?await foreignOrderIds(db,id,candidates.map(order=>order.id)):new Set<string>();
 if(foreign.size)console.error('Order IDs already belong to another customer; not synced',[...foreign].slice(0,10));
 const orders=candidates.filter(order=>!foreign.has(order.id));
 const statements=[db.prepare("INSERT INTO market_customers (id,email,name,phone,locale,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,phone=excluded.phone,locale=excluded.locale,updated_at=excluded.updated_at").bind(id,email,state.deliveryProfile?.recipient??email,state.deliveryProfile?.phone??null,state.communication.language,now,now)];
 for(const order of orders){
  statements.push(db.prepare('INSERT INTO market_order_records (id,customer_id,status,source_store,source_url,currency,total,assigned_role,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,source_store=excluded.source_store,source_url=excluded.source_url,currency=excluded.currency,total=excluded.total,assigned_role=excluded.assigned_role,updated_at=excluded.updated_at WHERE market_order_records.customer_id=excluded.customer_id').bind(order.id,id,order.cancelled?'cancelled':String(order.status),order.product.brand,order.product.sourceUrl??null,'UZS',orderPayable(order),order.assignment?.team??null,order.createdAt,now));
  statements.push(db.prepare('DELETE FROM market_order_fee_lines WHERE order_id=?').bind(order.id));
  for(const [lineId,kind,label,amount,createdAt] of feeLines(order))statements.push(db.prepare('INSERT INTO market_order_fee_lines (id,order_id,kind,label,amount,currency,created_at) VALUES (?,?,?,?,?,?,?)').bind(lineId,order.id,kind,label,amount,'UZS',createdAt));
  for(const event of order.history)statements.push(db.prepare('INSERT OR IGNORE INTO market_order_events (id,order_id,actor_id,event_type,payload,created_at) VALUES (?,?,?,?,?,?)').bind(`${order.id}:status:${event.at}`,order.id,null,'status',JSON.stringify({text:event.text}),event.at));
 }
 await db.batch(statements);
 // The books (migration 0009) in their own batch: a database without the table still syncs everything above.
 if(orders.length)try{
  await db.batch(orders.map(order=>{const f=orderFinance(order,id);return db.prepare('INSERT INTO market_order_finance (order_id,customer_id,status,created_at,paid_at,month,goods,store_shipping,reserve,payable,commission,delivery,fx_gain,services,revenue,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET customer_id=excluded.customer_id,status=excluded.status,paid_at=excluded.paid_at,month=excluded.month,goods=excluded.goods,store_shipping=excluded.store_shipping,reserve=excluded.reserve,payable=excluded.payable,commission=excluded.commission,delivery=excluded.delivery,fx_gain=excluded.fx_gain,services=excluded.services,revenue=excluded.revenue,updated_at=excluded.updated_at WHERE market_order_finance.customer_id=excluded.customer_id').bind(f.orderId,f.customerId,f.status,f.createdAt,f.paidAt??null,f.month??null,f.goods,f.storeShipping,f.reserve,f.payable,f.commission,f.delivery,f.fxGain,f.services,f.revenue,now)}));
 }catch(error){console.error('Order finance projection failed',error)}
 return {orders,foreign};
}
