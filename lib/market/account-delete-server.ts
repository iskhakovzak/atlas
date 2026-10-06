import {env} from 'cloudflare:workers';
import {revokeProviderTokens} from '@/lib/auth/server';
import {database,syncOperationalProjection} from './server.ts';
import {cancelOrder,type State} from './domain.ts';
import {autoCancelledOrders,deletionSummary,pseudonym,type DeletionSummary} from './account-delete.ts';

export type DeletedAccount={pseudonym:string;summary:DeletionSummary;documents:number};

// Tables from later migrations (0008 auth links, 0009 accounting) may be missing on a local database.
async function optionalRows<T>(sql:string,...binds:unknown[]):Promise<T[]>{
 try{return (await database().prepare(sql).bind(...binds).all<T>()).results}catch{return []}
}
// `%`, `_` and the escape itself inside a user ID must not act as LIKE wildcards.
const likeEscape=(value:string)=>value.replace(/[\\%_]/g,match=>'\\'+match);
const likePrefix=(value:string)=>likeEscape(value)+':%';

/**
 * Deletes a customer account. Personal data goes (profile document, recipients, passport scans and their
 * rows, sessions, attached sign-in methods, the customer row); the order and accounting records the law
 * requires to be kept stay under a pseudonym keyed by ATLAS_AUTH_SECRET (lib/market/account-delete.ts):
 * without the server secret it cannot be matched to an e-mail or phone number by enumeration. Without the
 * secret the deletion is refused (generic 503) rather than written under an enumerable alias. Callers check
 * the blockers (lib/market/account-delete.ts) first; this function assumes the deletion may proceed.
 */
export async function deleteAccount(user:{userId:string;email:string;contact?:string},state:State,now=Date.now()):Promise<DeletedAccount>{
 const secret=env.ATLAS_AUTH_SECRET;
 if(!secret){console.error('Account deletion refused: ATLAS_AUTH_SECRET is not set');throw new Error('ATLAS_AUTH_SECRET is required for account deletion')}
 const db=database(),id=user.userId,alias=await pseudonym(id,secret),summary=deletionSummary(state);
 // 1. Sign-in methods attached to this account: their own (empty) accounts and sessions go with it.
 const linked=await optionalRows<{subject:string;contact:string}>('SELECT subject,contact FROM market_auth_links WHERE user_id=?',id);
 const ids=[id,...linked.map(row=>row.subject)],inList=ids.map(()=>'?').join(',');
 // 2. Passport scans in the private bucket, by the documents table. A failed R2 delete stops here: the
 //    customer retries and nothing is left behind without a row pointing at it. No bucket, nothing to delete.
 const documents=(await db.prepare('SELECT object_key FROM market_identity_documents WHERE user_id=?').bind(id).all<{object_key:string}>()).results;
 if(env.BUCKET)for(const row of documents)await env.BUCKET.delete(row.object_key);
 // 3. Requests the customer never paid for are cancelled in the operational projection, so the operator
 //    queue does not keep waiting for a customer who left. Best effort: the projection is rebuildable.
 try{
  const final=autoCancelledOrders(state).reduce((current,order)=>cancelOrder(current,order.id,now),state);
  await syncOperationalProjection(id,final,now);
 }catch(error){console.error('Projection sync before account deletion failed',error)}
 // 4. Tokens Atlas holds at sign-in providers (Sign in with Apple requires revocation). Never throws.
 await revokeProviderTokens(id);
 // 5. One batch for the tables every database has (migrations 0000–0006): either everything or nothing.
 const details=JSON.stringify({orders:summary.orders,recipients:summary.recipients,passports:summary.passports,documents:documents.length,declarations:summary.declarations,tickets:summary.tickets,favorites:summary.favorites,cartItems:summary.cartItems,notifications:summary.notifications,linkedMethods:linked.length,balanceLost:summary.balance>0});
 await db.batch([
  db.prepare('DELETE FROM market_identity_documents WHERE user_id=?').bind(id),
  db.prepare(`DELETE FROM market_auth_sessions WHERE user_id IN (${inList})`).bind(...ids),
  db.prepare(`DELETE FROM market_accounts WHERE user_id IN (${inList})`).bind(...ids),
  db.prepare(`DELETE FROM market_customers WHERE id IN (${inList})`).bind(...ids),
  db.prepare('UPDATE market_order_records SET customer_id=?,updated_at=? WHERE customer_id=?').bind(alias,now,id),
  db.prepare('UPDATE market_order_events SET actor_id=? WHERE actor_id=?').bind(alias,id),
  db.prepare('UPDATE market_legal_consents SET customer_id=? WHERE customer_id=?').bind(alias,id),
  db.prepare('UPDATE market_audit_events SET actor_id=?,actor_email=? WHERE actor_id=?').bind(alias,alias,id),
  db.prepare("UPDATE market_audit_events SET entity_id=? WHERE entity_type='customer' AND entity_id=?").bind(alias,id),
  db.prepare('UPDATE market_order_documents SET customer_id=? WHERE customer_id=?').bind(alias,id),
  db.prepare('UPDATE market_order_documents SET uploaded_by=? WHERE uploaded_by=?').bind(alias,id),
  // The operator queue still shows the kept orders, under a customer that is plainly a deleted account.
  db.prepare("INSERT INTO market_customers (id,email,name,phone,locale,status,created_at,updated_at) VALUES (?,?,?,NULL,'ru','deleted',?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at").bind(alias,alias,'Удалённый аккаунт',now,now),
  db.prepare('INSERT INTO market_audit_events (id,actor_id,actor_email,action,entity_type,entity_id,details,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),alias,alias,'account.deleted','customer',alias,details,now),
 ]);
 // 6. Tables that may not exist locally, and tidy-ups that must not undo the deletion above: one by one.
 const contacts=[...new Set([user.email,user.contact??'',...linked.map(row=>row.contact)].filter(Boolean))];
 const optional:Array<[string,string,unknown[]]>=[
  ['auth links','DELETE FROM market_auth_links WHERE user_id=? OR subject=?',[id,id]],
  ['order finance','UPDATE market_order_finance SET customer_id=?,updated_at=? WHERE customer_id=?',[alias,now,id]],
  ['ledger author','UPDATE market_ledger_entries SET created_by=? WHERE created_by=?',[alias,id]],
  ['ledger voider','UPDATE market_ledger_entries SET voided_by=? WHERE voided_by=?',[alias,id]],
  ['ledger counterparty','UPDATE market_ledger_entries SET counterparty=? WHERE counterparty=?',[alias,id]],
  ['backup exports','UPDATE market_backup_exports SET requested_by=? WHERE requested_by=?',[alias,id]],
  ['settings author','UPDATE market_settings SET updated_by=? WHERE updated_by=?',[alias,id]],
  // Audit details written as JSON ({"accountId":"email:…"}) name the customer: the quoted ID is replaced in place.
  ['audit details','UPDATE market_audit_events SET details=replace(details,?,?) WHERE details IS NOT NULL AND instr(details,?)>0',[JSON.stringify(id),JSON.stringify(alias),JSON.stringify(id)]],
  ['rate limits',"DELETE FROM market_rate_limits WHERE key LIKE ? ESCAPE '\\'",[likePrefix(id)]],
  ...(contacts.length?[['sign-in challenges',`DELETE FROM market_auth_challenges WHERE target IN (${contacts.map(()=>'?').join(',')})`,contacts] as [string,string,unknown[]]]:[]),
  // Live app handoff codes and link tickets keep the user's JSON ({"userId":"email:…",…}) in `target`.
  ['handoff and link tickets',"DELETE FROM market_auth_challenges WHERE kind IN ('handoff','link-ticket') AND target LIKE ? ESCAPE '\\'",['%'+likeEscape(`"userId":${JSON.stringify(id)}`)+'%']],
 ];
 for(const [label,sql,binds] of optional){
  try{await db.prepare(sql).bind(...binds).run()}catch(error){console.error(`Account deletion: ${label} not cleaned`,error)}
 }
 return {pseudonym:alias,summary,documents:documents.length};
}
