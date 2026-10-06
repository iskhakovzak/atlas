// The operator's order queue: which tab an order belongs to, how search matches it, and the trimmed account the
// browser gets with each order. Shared by the server (GET /api/operations?queue=1) and app/order-workspace.tsx,
// so both sides sort and filter orders the same way.
import {blank,orderNeedsOperatorAttention,parcelOrders,type Order,type State} from './domain.ts';

export const operatorQueueTabs=['active','attention','done','refunds'] as const;
export type OperatorQueueTab=typeof operatorQueueTabs[number];
export const operatorQueuePageSize=50,operatorQueueMaxPageSize=100;
export type OperatorQueueCounts={active:number;attention:number;done:number;refunds:number;weighing:number};

/** Atlas internal-balance credit recorded for an order (refund tab). */
export const orderCredit=(entries:State['entries'],orderId:string)=>entries.reduce((total,entry)=>entry.orderId===orderId&&entry.credit==='customer-credit'?total+entry.amount:total,0);

/** The tabs (and the "awaiting weighing" figure) an order counts in. `credit` is its customer credit. */
export function queueTabsOf(order:Order,credit:number){
 return {
  active:!order.cancelled&&order.status<5,
  attention:orderNeedsOperatorAttention(order),
  done:(order.cancelled||order.status===5)&&(!order.issueCase||order.issueCase.status==='resolved'),
  refunds:order.cancelled||order.payment?.status==='refunded'||credit>0,
  weighing:!order.cancelled&&order.status===2,
 };
}

export type QueueSearchFields={id:string;productName?:string;brand?:string;variant?:string;accountName?:string;accountId?:string;profilePhone?:string;recipient?:string;recipientPhone?:string;city?:string};
export function queueSearchFields(order:Order,account?:{id:string;name:string;state:Pick<State,'communication'>}):QueueSearchFields{
 return {id:order.id,productName:order.product.name,brand:order.product.brand,variant:order.variant,accountName:account?.name,accountId:account?.id,profilePhone:account?.state.communication.phone,recipient:order.delivery?.recipient,recipientPhone:order.delivery?.phone,city:order.delivery?.city};
}
/** Order number, item, brand, variant, customer name or id/email, recipient, city; phones by 4+ digits. */
export function queueMatches(fields:QueueSearchFields,query:string){
 const needle=query.trim().toLocaleLowerCase();
 if(!needle)return true;
 const searchable=[fields.id,fields.productName,fields.brand,fields.variant,fields.accountName,fields.accountId,fields.profilePhone,fields.recipient,fields.recipientPhone,fields.city];
 const digits=query.replace(/\D/g,""),phones=`${fields.profilePhone??''} ${fields.recipientPhone??''}`.replace(/\D/g,"");
 return searchable.filter(Boolean).join(" ").toLocaleLowerCase().includes(needle)||digits.length>=4&&phones.includes(digits);
}

/** One account as the queue sends it: only the listed orders (with their store-parcel siblings) and what they need. */
export type OperatorQueueAccount={id:string;name:string;revision:number;updatedAt:number;state:State};
export type OperatorQueueResponse={
 accounts:OperatorQueueAccount[];
 /** The page, newest first; each id is an order of one of `accounts`. */
 orderIds:string[];
 counts:OperatorQueueCounts;
 /** Orders matching tab and search in total; the page holds at most `limit` of them. */
 total:number;
 nextCursor:string|null;
};
/**
 * Keeps from a full account only what the operator screen reads for `orderIds`: those orders and the other orders
 * of their store parcel (one weighing settles the parcel), their balance entries and notifications, contacts.
 */
export function slimQueueAccount(account:{id:string;name:string;revision:number;updatedAt:number;state:State},orderIds:ReadonlySet<string>):OperatorQueueAccount{
 const listed=account.state.orders.filter(order=>orderIds.has(order.id));
 const keep=new Set(listed.flatMap(order=>parcelOrders(account.state,order).map(item=>item.id)));
 for(const order of listed)keep.add(order.id);
 const orders=account.state.orders.filter(order=>keep.has(order.id));
 const related=(orderId?:string)=>!!orderId&&keep.has(orderId);
 return {id:account.id,name:account.name,revision:account.revision,updatedAt:account.updatedAt,state:{...blank(),orders,entries:account.state.entries.filter(entry=>related(entry.orderId)),notifications:account.state.notifications.filter(notification=>related(notification.orderId)),communication:account.state.communication}};
}

/** Cursor of the page after `order`: newest first, ties by account and order id. */
export const queueCursor=(item:{createdAt:number;accountId:string;id:string})=>`${item.createdAt}:${encodeURIComponent(item.accountId)}:${encodeURIComponent(item.id)}`;
export function parseQueueCursor(value:string|null|undefined){
 const [at,account,id]=(value??'').split(':');
 const createdAt=Number(at);
 if(!value||!Number.isFinite(createdAt)||account===undefined||id===undefined)return null;
 try{return {createdAt,accountId:decodeURIComponent(account),id:decodeURIComponent(id)}}catch{return null}
}
/** Newest first; equal times by account id, then order id (descending), so pages never overlap. */
export function queueOrder(a:{createdAt:number;accountId:string;id:string},b:{createdAt:number;accountId:string;id:string}){
 return b.createdAt-a.createdAt||(a.accountId<b.accountId?1:a.accountId>b.accountId?-1:0)||(a.id<b.id?1:a.id>b.id?-1:0);
}
/**
 * One account seen twice (two pages, or a page and a link): the newer copy wins for revision and for every order,
 * entry and notification it holds; the rest of the older copy stays.
 */
export function mergeQueueAccount(older:OperatorQueueAccount,newer:OperatorQueueAccount):OperatorQueueAccount{
 const union=<T extends {id:string}>(a:T[],b:T[])=>{const ids=new Set(b.map(item=>item.id));return [...a.filter(item=>!ids.has(item.id)),...b]};
 return {...newer,state:{...newer.state,orders:union(older.state.orders,newer.state.orders),entries:union(older.state.entries,newer.state.entries),notifications:union(older.state.notifications,newer.state.notifications)}};
}
/** Merges accounts of a new response into the loaded ones. */
export function mergeQueueAccounts(loaded:OperatorQueueAccount[],incoming:OperatorQueueAccount[]){
 const byId=new Map(loaded.map(account=>[account.id,account]));
 for(const account of incoming){const current=byId.get(account.id);byId.set(account.id,current?mergeQueueAccount(current,account):account)}
 return [...byId.values()];
}
